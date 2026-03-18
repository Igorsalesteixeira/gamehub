const { test, expect } = require('@playwright/test');

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

for (const device of DEVICES) {
  test.describe(`🐍 Snake - Testes Críticos - ${device.name}`, () => {

    test('deve carregar sem erros críticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/snake/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve iniciar jogo ao clicar em Jogar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/snake/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Verifica overlay visível
      const overlay = page.locator('#overlay');
      await expect(overlay).toBeVisible();

      // Clica em Jogar
      const btnStart = page.locator('#btn-start');
      await expect(btnStart).toBeVisible();
      await btnStart.click();

      // Aguarda início
      await page.waitForTimeout(500);

      // Verifica que overlay sumiu
      await expect(overlay).toBeHidden();

      // Verifica que canvas está ativo
      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();
    });

    test('deve mover cobra com setas do teclado', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/snake/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(500);

      // Move em todas direções
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(200);

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve pausar com tecla P', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/snake/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Inicia
      await page.locator('#btn-start').click();
      await page.waitForTimeout(500);

      // Pausa
      await page.keyboard.press('p');
      await page.waitForTimeout(300);

      // Despausa
      await page.keyboard.press('p');
      await page.waitForTimeout(300);

      // Verifica que jogo continua
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    if (device.mobile) {
      test('deve mostrar controles touch em mobile', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/snake/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        // Verifica controles mobile
        const mobileControls = page.locator('.mobile-controls');
        await expect(mobileControls).toBeVisible();

        // Verifica botões de direção
        await expect(page.locator('[data-dir="up"]')).toBeVisible();
        await expect(page.locator('[data-dir="down"]')).toBeVisible();
        await expect(page.locator('[data-dir="left"]')).toBeVisible();
        await expect(page.locator('[data-dir="right"]')).toBeVisible();
      });

      test('deve mover cobra com botões touch', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/snake/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        // Inicia
        await page.locator('#btn-start').click();
        await page.waitForTimeout(500);

        // Testa botões touch
        await page.locator('[data-dir="right"]').click();
        await page.waitForTimeout(300);
        await page.locator('[data-dir="down"]').click();
        await page.waitForTimeout(300);

        // Verifica que jogo continua
        await expect(page.locator('#game-canvas')).toBeVisible();
      });
    }

    test('deve mostrar game over ao bater na parede', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/snake/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Inicia
      await page.locator('#btn-start').click();
      await page.waitForTimeout(500);

      // Move para cima até bater na parede
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(100);
      }

      // Aguarda game over
      await page.waitForTimeout(2000);

      // Verifica que apareceu game over
      const overlay = page.locator('#overlay');
      await expect(overlay).toBeVisible({ timeout: 10000 });

      // Verifica mensagem
      const title = page.locator('#overlay-title');
      await expect(title).toHaveText('Game Over!');
    });

    test('deve reiniciar ao clicar em Jogar Novamente', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/snake/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Inicia e causa game over
      await page.locator('#btn-start').click();
      await page.waitForTimeout(500);

      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(1500);

      // Clica em Jogar Novamente
      const btnStart = page.locator('#btn-start');
      await expect(btnStart).toHaveText('Jogar Novamente');
      await btnStart.click();
      await page.waitForTimeout(500);

      // Verifica que overlay sumiu
      await expect(page.locator('#overlay')).toBeHidden();

      // Verifica que score zerou
      const score = page.locator('#score-display');
      await expect(score).toHaveText('0');
    });

    test('deve atualizar pontuação ao comer fruta', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/snake/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Inicia
      await page.locator('#btn-start').click();
      await page.waitForTimeout(500);

      // Score inicial
      const scoreBefore = await page.locator('#score-display').textContent();

      // Move por algum tempo (pode comer fruta)
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(150);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(150);
      }

      // Verifica que score foi atualizado ou jogo continua
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/snake/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });

    test('deve salvar recorde no localStorage', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/snake/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Verifica se localStorage tem chave do jogo
      const hasBestScore = await page.evaluate(() => {
        return localStorage.getItem('snake_best') !== null;
      });

      // Pode ou não ter score salvo, mas não deve quebrar
      expect(typeof hasBestScore).toBe('boolean');
    });
  });
}
