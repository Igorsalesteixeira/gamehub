const { test, expect } = require('@playwright/test');

test.describe('Solitaire - Teste Ponta a Ponta', () => {
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

    await page.goto('/games/solitaire/');
    await page.waitForTimeout(1000);
  });

  test('jogo carrega: tabuleiro, baralho, fundações', async ({ page }) => {
    // Verifica que o tabuleiro existe
    await expect(page.locator('.solitaire-board')).toBeVisible();

    // Verifica tableau (colunas)
    const columns = page.locator('.tableau-column');
    await expect(columns).toHaveCount(7);

    // Verifica stock (monte)
    await expect(page.locator('.stock-pile')).toBeVisible();

    // Verifica fundações
    const foundations = page.locator('.foundation');
    await expect(foundations).toHaveCount(4);
  });

  test('clicar no monte vira carta', async ({ page }) => {
    // Clica no monte
    await page.locator('.stock-pile').click();
    await page.waitForTimeout(300);

    // Verifica que apareceu carta no descarte
    await expect(page.locator('.waste-pile')).toBeVisible();
  });

  test('novo jogo embaralha', async ({ page }) => {
    // Pega cartas iniciais
    const initialCards = await page.locator('.card').count();
    expect(initialCards).toBeGreaterThan(0);

    // Clica em novo jogo
    await page.locator('#btn-new-game').click();
    await page.waitForTimeout(500);

    // Verifica que ainda tem cartas
    const newCards = await page.locator('.card').count();
    expect(newCards).toBeGreaterThan(0);
  });
});
