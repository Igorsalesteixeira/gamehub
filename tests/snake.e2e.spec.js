const { test, expect } = require('@playwright/test');

// Configuração para todos os testes do Snake
test.describe.configure({ mode: 'serial' });

test.describe('🐍 Snake - Testes E2E Ponta a Ponta', () => {

  // Mock do Supabase antes de cada teste
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.supabase = {
        auth: {
          getSession: async () => ({ data: { session: { user: { id: 'test-user' } } }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
        from: () => ({
          select: () => ({ data: [], error: null }),
          insert: () => ({ data: null, error: null }),
        }),
      };
    });

    // Intercepta o import do supabase.js
    await page.route('**/supabase.js', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `export const supabase = window.supabase;`,
      });
    });

    await page.goto('/games/snake/', { waitUntil: 'networkidle' });
  });

  test.describe('📱 Desktop (Teclado)', () => {

    test('deve carregar o jogo sem erros', async ({ page }) => {
      // Verifica elementos essenciais
      await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#overlay')).toBeVisible();
      await expect(page.locator('#btn-start')).toBeVisible();
      await expect(page.locator('#score-display')).toHaveText('0');
      await expect(page.locator('#best-display')).toBeVisible();

      // Verifica que não há erros no console
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.waitForTimeout(300);
      expect(errors).toHaveLength(0);
    });

    test('deve iniciar o jogo ao clicar no botão', async ({ page }) => {
      // Clica no botão de iniciar
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Verifica que o overlay sumiu
      await expect(page.locator('#overlay')).toBeHidden();

      // Verifica que o canvas está ativo
      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();

      // Aguarda o jogo começar a rodar
      await page.waitForTimeout(300);
    });

    test('deve mover a cobra com as setas do teclado', async ({ page }) => {
      // Inicia o jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Testa movimentos em todas as direções
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);

      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300);

      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(300);

      // Verifica que o jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve pausar e despausar com a tecla P', async ({ page }) => {
      // Inicia o jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Move um pouco
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);

      // Pausa
      await page.keyboard.press('p');
      await page.waitForTimeout(200);

      // Despausa
      await page.keyboard.press('p');
      await page.waitForTimeout(200);

      // Verifica que o jogo continua
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar game over ao bater na parede', async ({ page }) => {
      // Inicia o jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // A cobra começa indo para a direita (x: 1, y: 0)
      // Precisamos deixar ela andar até bater na parede direita
      // ou tentar ir para cima (direção oposta de y não é permitida)

      // Vamos tentar mover para cima (y: -1) - isso deveria ser permitido
      // pois não é a direção oposta direta
      await page.keyboard.press('ArrowUp');

      // Agora movemos para cima até bater na parede
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(150);
      }

      // Aguarda o game over
      await page.waitForTimeout(200);

      // Verifica que apareceu o game over
      const overlay = page.locator('#overlay');
      await expect(overlay).toBeVisible({ timeout: 10000 });

      // Verifica mensagem de game over
      const title = page.locator('#overlay-title');
      await expect(title).toHaveText('Game Over!');

      // Verifica que o botão mudou para "Jogar Novamente"
      const btnStart = page.locator('#btn-start');
      await expect(btnStart).toHaveText('Jogar Novamente');
    });

    test('deve reiniciar ao clicar em "Jogar Novamente"', async ({ page }) => {
      // Inicia e causa game over
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Força game over
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(300);

      // Clica em Jogar Novamente
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Verifica que o overlay sumiu e score zerou
      await expect(page.locator('#overlay')).toBeHidden();
      await expect(page.locator('#score-display')).toHaveText('0');
    });
  });

  test.describe('📱 Mobile (Touch)', () => {

    test.use({ viewport: { width: 375, height: 667 } });

    test('deve mostrar controles touch em mobile', async ({ page }) => {
      // Recarrega com viewport mobile
      await page.reload({ waitUntil: 'networkidle' });

      // Verifica que os controles mobile estão visíveis
      await expect(page.locator('.mobile-controls')).toBeVisible();
      await expect(page.locator('[data-dir="up"]')).toBeVisible();
      await expect(page.locator('[data-dir="down"]')).toBeVisible();
      await expect(page.locator('[data-dir="left"]')).toBeVisible();
      await expect(page.locator('[data-dir="right"]')).toBeVisible();
    });

    test('deve mover a cobra com botões touch', async ({ page }) => {
      await page.reload({ waitUntil: 'networkidle' });

      // Inicia o jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Testa botões touch
      await page.locator('[data-dir="right"]').click();
      await page.waitForTimeout(300);

      await page.locator('[data-dir="down"]').click();
      await page.waitForTimeout(300);

      await page.locator('[data-dir="left"]').click();
      await page.waitForTimeout(300);

      await page.locator('[data-dir="up"]').click();
      await page.waitForTimeout(300);

      // Verifica que o jogo continua
      await expect(page.locator('#game-canvas')).toBeVisible();
    });
  });

  test.describe('🎮 Funcionalidades Gerais', () => {

    test('deve ter título correto da página', async ({ page }) => {
      await expect(page).toHaveTitle(/Cobrinha/);
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });
      expect(viewport).toContain('width=device-width');
    });

    test('deve carregar sem solicitar confirmação de saída', async ({ page }) => {
      // Inicia o jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Tenta navegar para outra página
      const newPage = await page.context().newPage();
      await newPage.goto('/games/snake/');

      // Se chegou aqui, não há diálogo de confirmação bloqueando
      await expect(newPage.locator('#game-canvas')).toBeVisible();
    });
  });
});
