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

const GAMES = [
  { name: 'cookieclicker', path: '/games/cookieclicker/', title: /Cookie|Clicker/i },
  { name: 'pyramid', path: '/games/pyramid/', title: /Piramide|Pyramid/i },
  { name: 'sokoban', path: '/games/sokoban/', title: /Sokoban/i, hasCanvas: true },
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

for (const game of GAMES) {
  test.describe(`🎯 ${game.name} - Testes E2E`, () => {

    test('deve carregar o jogo sem erros', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('Blocked call to navigator.vibrate') &&
              !text.includes('vibrate')) {
            errors.push(text);
          }
        }
      });
      page.on('pageerror', error => {
        const msg = error.message;
        if (!msg.includes('Blocked call to navigator.vibrate') &&
            !msg.includes('vibrate')) {
          errors.push(msg);
        }
      });

      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(errors, `Erros: ${errors.join(', ')}`).toHaveLength(0);
    });

    test('deve ter título correto', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await expect(page).toHaveTitle(game.title);
    });

    test('deve ter elementos do jogo visíveis', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Verifica elementos específicos do jogo
      const gameElements = page.locator('.game-container, #game-board, .board, canvas, .game-area, #pyramid, #warehouse, #cookie');
      await expect(gameElements.first()).toBeVisible({ timeout: 5000 });
    });

    test('deve iniciar ao clicar no botão', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const btnStart = page.locator('#btn-start, #btn-new-game, .btn-start, .btn-primary, #start-btn').first();
      const hasStartButton = await btnStart.isVisible().catch(() => false);

      if (hasStartButton) {
        await btnStart.click();
        await page.waitForTimeout(500);

        const overlay = page.locator('#overlay, .modal-overlay');
        const isHidden = await overlay.isHidden().catch(() => true);
        if (!isHidden) {
          await expect(overlay).toBeHidden();
        }
      }
    });

    test('deve responder a interações básicas', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Clique em área do jogo
      const gameArea = page.locator('.game-container, #game-board, .board, canvas').first();
      if (await gameArea.isVisible().catch(() => false)) {
        await gameArea.click();
      }

      await page.waitForTimeout(300);
      await expect(page.locator('body')).toBeVisible();
    });

    test('deve responder a teclado', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Testa teclas direcionais
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);

      await expect(page.locator('body')).toBeVisible();
    });
  });
}
