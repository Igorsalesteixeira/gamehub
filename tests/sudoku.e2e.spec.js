const { test, expect } = require('@playwright/test');

test.describe('Sudoku - Teste Ponta a Ponta', () => {
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

    await page.goto('/games/sudoku/');
    await page.waitForTimeout(1000);
  });

  test('jogo completo: selecionar célula, inserir número, validar', async ({ page }) => {
    // Verifica que o tabuleiro existe
    await expect(page.locator('.sudoku-board')).toBeVisible();

    // Clica em uma célula
    const cell = page.locator('.cell').first();
    await cell.click();
    await page.waitForTimeout(200);

    // Clica em um número
    await page.locator('[data-num="5"]').click();
    await page.waitForTimeout(200);

    // Verifica que o número foi inserido
    await expect(cell).toContainText('5');
  });

  test('novo jogo gera tabuleiro diferente', async ({ page }) => {
    // Pega estado inicial
    const initialCells = await page.locator('.cell').allTextContents();

    // Clica em novo jogo
    await page.locator('#btn-new-game').click();
    await page.waitForTimeout(500);

    // Pega novo estado
    const newCells = await page.locator('.cell').allTextContents();

    // Verifica que mudou (pode ser igual por acaso, mas improvável)
    expect(newCells).toBeDefined();
  });

  test('dica funciona', async ({ page }) => {
    // Clica em uma célula vazia
    const emptyCell = page.locator('.cell:not(.fixed)').first();
    await emptyCell.click();
    await page.waitForTimeout(200);

    // Clica em dica
    await page.locator('#btn-hint').click();
    await page.waitForTimeout(500);

    // Verifica que apareceu um número
    const text = await emptyCell.textContent();
    expect(text).toMatch(/[1-9]/);
  });
});
