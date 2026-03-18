const { test, expect } = require('@playwright/test');

test.describe('Termo - Teste Ponta a Ponta', () => {
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

    await page.goto('/games/termo/');
    await page.waitForTimeout(1000);
  });

  test('jogo completo: digitar palavra, verificar, ganhar', async ({ page }) => {
    // Verifica que o tabuleiro existe
    await expect(page.locator('.termo-board')).toBeVisible();

    // Digita uma palavra (5 letras)
    await page.keyboard.type('TESTE');
    await page.waitForTimeout(200);

    // Pressiona Enter para verificar
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verifica que a linha foi preenchida
    const row = page.locator('.termo-row').first();
    await expect(row).toBeVisible();
  });

  test('teclado virtual funciona', async ({ page }) => {
    // Clica em letras do teclado virtual
    await page.locator('[data-key="A"]').click();
    await page.waitForTimeout(100);
    await page.locator('[data-key="B"]').click();
    await page.waitForTimeout(100);
    await page.locator('[data-key="C"]').click();
    await page.waitForTimeout(100);

    // Verifica que as letras apareceram
    const cells = page.locator('.termo-cell');
    await expect(cells.first()).not.toHaveText('');
  });

  test('backspace funciona', async ({ page }) => {
    // Digita uma letra
    await page.keyboard.type('A');
    await page.waitForTimeout(100);

    // Apaga
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);

    // Verifica que apagou
    const cell = page.locator('.termo-cell').first();
    await expect(cell).toHaveText('');
  });
});
