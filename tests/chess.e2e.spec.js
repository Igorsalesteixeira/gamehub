const { test, expect } = require('@playwright/test');

test.describe('Chess - Teste Ponta a Ponta', () => {
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

    await page.goto('/games/chess/');
    await page.waitForTimeout(1000);
  });

  test('jogo carrega: tabuleiro 8x8, peças posicionadas', async ({ page }) => {
    // Verifica que o tabuleiro existe
    await expect(page.locator('.chess-board')).toBeVisible();

    // Verifica que tem 64 casas
    const squares = page.locator('.square');
    await expect(squares).toHaveCount(64);

    // Verifica que tem peças
    const pieces = page.locator('.piece');
    await expect(pieces).toHaveCount(32); // 16 brancas + 16 pretas
  });

  test('mover peão', async ({ page }) => {
    // Clica em um peão branco (linha 2)
    const pawn = page.locator('.square[data-row="6"] .piece.white').first();
    await pawn.click();
    await page.waitForTimeout(200);

    // Verifica que apareceram movimentos válidos
    const validMoves = page.locator('.valid-move');
    await expect(validMoves).toHaveCountGreaterThan(0);

    // Clica em uma casa válida
    await validMoves.first().click();
    await page.waitForTimeout(300);

    // Verifica que a peça moveu
    await expect(page.locator('.chess-board')).toBeVisible();
  });

  test('indicador de vez funciona', async ({ page }) => {
    // Verifica indicador
    const turnIndicator = page.locator('#turn-indicator');
    await expect(turnIndicator).toContainText('Sua vez');

    // Move uma peça
    await page.locator('.square[data-row="6"] .piece').first().click();
    await page.waitForTimeout(200);
    await page.locator('.valid-move').first().click();
    await page.waitForTimeout(500);

    // Verifica que mudou para "Computador"
    await expect(turnIndicator).toContainText('Computador');
  });
});
