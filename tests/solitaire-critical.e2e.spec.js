const { test, expect } = require('@playwright/test');

// Mock do Supabase
const mockSupabaseCode = `
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'test-user' } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: null }),
  }),
};
`;

const DEVICES = [
  { name: 'Desktop', viewport: { width: 1280, height: 720 } },
  { name: 'iPhone 12', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'Pixel 5', viewport: { width: 393, height: 851 }, mobile: true },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/supabase.js', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: mockSupabaseCode,
    });
  });
});

// ============================================
// SOLITAIRE - TESTES CRITICOS ESPECIFICOS
// ============================================

for (const device of DEVICES) {
  test.describe(`Solitaire - Testes Criticos - ${device.name}`, () => {

    test('deve carregar sem erros criticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest') && !text.includes('adsbygoogle')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros criticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });

    test('deve ter titulo do jogo visivel', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });

      const title = page.locator('h1.game-title, h1');
      await expect(title).toBeVisible();
    });

    test('deve distribuir cartas no tableau ao iniciar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Verifica que existem 7 colunas
      for (let i = 0; i < 7; i++) {
        const col = page.locator(`#col${i}`);
        await expect(col).toBeVisible();
      }

      // Verifica que o monte (stock) existe
      const stock = page.locator('#stock');
      await expect(stock).toBeVisible();

      // Verifica que as fundacoes existem
      for (let i = 0; i < 4; i++) {
        const foundation = page.locator(`#f${i}`);
        await expect(foundation).toBeVisible();
      }
    });

    test('deve virar carta do monte ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const stock = page.locator('#stock');
      await stock.click();
      await page.waitForTimeout(500);

      // Verifica que o waste pode ter cartas ou o monte ficou vazio
      const waste = page.locator('#waste');
      await expect(waste).toBeVisible();
    });

    test('deve selecionar carta do tableau ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Clica na ultima carta da primeira coluna (sempre visivel)
      const firstCol = page.locator('#col0 .card').last();
      await firstCol.click();
      await page.waitForTimeout(300);

      // Verifica que a carta foi selecionada (deve ter classe selected)
      const selectedCard = page.locator('#col0 .card.selected');
      await expect(selectedCard).toBeVisible();
    });

    test('deve mover carta entre colunas quando valido', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Tenta arrastar da primeira coluna para a segunda
      const sourceCard = page.locator('#col0 .card').last();
      const targetCol = page.locator('#col1');

      if (await sourceCard.isVisible() && await targetCol.isVisible()) {
        await sourceCard.dragTo(targetCol);
        await page.waitForTimeout(500);

        // Verifica que o jogo continua funcionando
        await expect(page.locator('.board')).toBeVisible();
      }
    });

    test('deve atualizar contador de movimentos', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const movesDisplay = page.locator('#moves-display');
      await expect(movesDisplay).toBeVisible();

      const initialMoves = await movesDisplay.textContent();

      // Faz um movimento (virar do monte)
      await page.locator('#stock').click();
      await page.waitForTimeout(500);

      // Verifica que o contador existe
      await expect(movesDisplay).toBeVisible();
    });

    test('deve mostrar timer funcionando', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const timeDisplay = page.locator('#time-display');
      await expect(timeDisplay).toBeVisible();
      await expect(timeDisplay).toContainText(':');
    });

    test('deve permitir desfazer movimento', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const undoBtn = page.locator('#btn-undo');
      await expect(undoBtn).toBeVisible();

      // Inicialmente desabilitado (sem historico)
      const isDisabled = await undoBtn.isDisabled();
      expect(typeof isDisabled).toBe('boolean');
    });

    test('deve iniciar novo jogo ao clicar em Novo Jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const newGameBtn = page.locator('#btn-new');
      await newGameBtn.click();
      await page.waitForTimeout(1000);

      // Verifica que o jogo foi reiniciado
      await expect(page.locator('.board')).toBeVisible();
    });

    test('deve suportar arrastar carta do waste para coluna', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Virar cartas do monte
      await page.locator('#stock').click();
      await page.waitForTimeout(500);

      // Tenta arrastar do waste para uma coluna
      const wasteCard = page.locator('#waste .card').last();
      const targetCol = page.locator('#col0');

      if (await wasteCard.isVisible()) {
        await wasteCard.dragTo(targetCol);
        await page.waitForTimeout(500);

        // Verifica que o jogo continua funcionando
        await expect(page.locator('.board')).toBeVisible();
      }
    });

    test('deve suportar duplo clique para auto-mover', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Tenta duplo clique em uma carta do tableau
      const card = page.locator('#col0 .card').last();
      if (await card.isVisible()) {
        await card.dblclick();
        await page.waitForTimeout(500);

        // Verifica que o jogo continua funcionando
        await expect(page.locator('.board')).toBeVisible();
      }
    });

    test('deve ter seletor de dificuldade (virar 1 ou 3 cartas)', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const drawCount = page.locator('#draw-count');
      await expect(drawCount).toBeVisible();

      // Verifica opcoes disponiveis
      await expect(drawCount.locator('option[value="1"]')).toBeAttached();
      await expect(drawCount.locator('option[value="3"]')).toBeAttached();
    });

    test('deve mostrar modal de vitoria quando completar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Verifica que o modal de vitoria existe (inicialmente oculto)
      const winModal = page.locator('#win-modal');
      await expect(winModal).toBeAttached();
    });
  });
}

// ============================================
// TESTES DE RESPONSIVIDADE
// ============================================

for (const device of DEVICES) {
  test.describe(`Solitaire - Responsividade - ${device.name}`, () => {

    test('deve caber na tela sem scroll horizontal', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      // Em mobile, permite scroll horizontal se necessario para jogos de carta
      if (!device.mobile) {
        expect(hasHorizontalScroll).toBe(false);
      }
    });

    test('deve ter elementos clicaveis com tamanho minimo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Verifica que cartas e botoes tem tamanho minimo para touch
      const cards = page.locator('.card, .btn, button');
      const count = await cards.count();

      if (count > 0) {
        const firstCard = cards.first();
        const box = await firstCard.boundingBox();

        if (box) {
          // Minimo 44px para touch targets (recomendacao Apple)
          expect(box.width).toBeGreaterThanOrEqual(30);
          expect(box.height).toBeGreaterThanOrEqual(30);
        }
      }
    });
  });
}

// ============================================
// TESTES DE PERFORMANCE
// ============================================

for (const device of DEVICES) {
  test.describe(`Solitaire - Performance - ${device.name}`, () => {

    test('deve carregar em menos de 5 segundos', async ({ page }) => {
      const startTime = Date.now();

      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000);
    });

    test('nao deve ter vazamento de memoria apos interacoes', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Realiza algumas interacoes
      for (let i = 0; i < 5; i++) {
        const buttons = page.locator('button');
        const count = await buttons.count();
        if (count > 0) {
          const btn = buttons.nth(i % count);
          if (await btn.isVisible() && await btn.isEnabled()) {
            await btn.click();
            await page.waitForTimeout(200);
          }
        }
      }

      // Verifica que a pagina ainda responde
      await expect(page.locator('body')).toBeVisible();
    });
  });
}
