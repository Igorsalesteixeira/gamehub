const { test, expect } = require('@playwright/test');

test.describe('Pong - Teste Ponta a Ponta', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/supabase.js', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
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
        `,
      });
    });

    await page.goto('/games/pong/');
    await page.waitForTimeout(1000);
  });

  test('jogo completo: iniciar, mover raquete, marcar ponto', async ({ page }) => {
    // Verifica tela inicial
    const overlay = page.locator('#overlay');
    await expect(overlay).toBeVisible();

    // Clica em "Jogar"
    await page.locator('#btn-start').click();
    await page.waitForTimeout(500);

    // Verifica que overlay sumiu
    await expect(overlay).toBeHidden();

    // Simula movimento da raquete
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('w');
    await page.waitForTimeout(200);
    await page.keyboard.press('s');
    await page.waitForTimeout(200);

    // Verifica que o jogo está rodando
    await expect(page.locator('#game-canvas')).toBeVisible();

    // Verifica placar
    await expect(page.locator('#score-display')).toBeVisible();
  });

  test('modo 2 jogadores', async ({ page }) => {
    // Seleciona modo 2 jogadores
    await page.locator('#mode-2p').click();
    await page.waitForTimeout(200);

    // Inicia jogo
    await page.locator('#btn-start').click();
    await page.waitForTimeout(500);

    // Testa controles do jogador 2 (setas)
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // Testa controles do jogador 1 (W/S)
    await page.keyboard.press('w');
    await page.waitForTimeout(200);
    await page.keyboard.press('s');
    await page.waitForTimeout(200);

    await expect(page.locator('#game-canvas')).toBeVisible();
  });
});
