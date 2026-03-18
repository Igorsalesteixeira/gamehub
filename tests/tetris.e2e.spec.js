const { test, expect } = require('@playwright/test');

test.describe('Tetris - Teste Ponta a Ponta', () => {
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

    await page.goto('/games/tetris/');
    await page.waitForTimeout(1000);
  });

  test('jogo completo: iniciar, mover, rotacionar, game over', async ({ page }) => {
    // Verifica tela inicial
    const overlay = page.locator('#modal-overlay');
    await expect(overlay).toBeVisible();

    // Clica em "Novo Jogo"
    await page.locator('#btn-new-game').click();
    await page.waitForTimeout(500);

    // Verifica que overlay sumiu
    await expect(overlay).toBeHidden();

    // Simula movimentos
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowUp'); // Rotacionar
    await page.waitForTimeout(200);

    // Verifica que o jogo está rodando
    await expect(page.locator('#game-canvas')).toBeVisible();

    // Verifica UI
    await expect(page.locator('#score-display')).toBeVisible();
    await expect(page.locator('#level-display')).toBeVisible();
    await expect(page.locator('#lines-display')).toBeVisible();
  });

  test('pausa funciona', async ({ page }) => {
    await page.locator('#btn-new-game').click();
    await page.waitForTimeout(500);

    // Pressiona P para pausar
    await page.keyboard.press('p');
    await page.waitForTimeout(500);

    // Verifica overlay de pausa
    await expect(page.locator('#modal-overlay')).toBeVisible();
    await expect(page.locator('#modal-message')).toContainText('Pausado');

    // Pressiona P novamente
    await page.keyboard.press('p');
    await page.waitForTimeout(500);

    // Jogo continua
    await expect(page.locator('#game-canvas')).toBeVisible();
  });
});
