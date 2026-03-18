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
  { name: 'game2048', path: '/games/game2048/', title: /2048/ },
  { name: 'sudoku', path: '/games/sudoku/', title: /Sudoku/ },
  { name: 'minesweeper', path: '/games/minesweeper/', title: /Campo|Minado|Minesweeper/ },
  { name: 'memory', path: '/games/memory/', title: /Memória|Memory/ },
  { name: 'puzzle15', path: '/games/puzzle15/', title: /15|Slide/ },
  { name: 'lightsout', path: '/games/lightsout/', title: /Lights|Out/ },
  { name: 'nonogram', path: '/games/nonogram/', title: /Nonogram/ },
  { name: 'numble', path: '/games/numble/', title: /Numble/ },
  { name: 'mahjong', path: '/games/mahjong/', title: /Mahjong/ },
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
  test.describe(`🧩 ${game.name} - Testes E2E`, () => {

    test('deve carregar o jogo sem erros', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', error => errors.push(error.message));

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

      // Verifica se o body ou container principal existe
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Verifica se há algum elemento de jogo
      const gameElements = page.locator('.game-container, #game-board, .board, .grid, .cells, canvas');
      await expect(gameElements.first()).toBeVisible({ timeout: 5000 });
    });

    test('deve iniciar ao clicar no botão', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const btnStart = page.locator('#btn-start, #btn-new-game, .btn-start, .btn-primary').first();

      // Alguns jogos podem não ter botão de início (começam automaticamente)
      const hasStartButton = await btnStart.isVisible().catch(() => false);

      if (hasStartButton) {
        await btnStart.click();
        await page.waitForTimeout(500);

        const overlay = page.locator('#overlay, .modal-overlay');
        const isHidden = await overlay.isHidden().catch(() => true);
        expect(isHidden).toBeTruthy();
      }
    });

    test('deve responder a interações', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Clica em algum elemento do jogo se existir
      const clickable = page.locator('.cell, .tile, .card, .btn, button').first();
      if (await clickable.isVisible().catch(() => false)) {
        await clickable.click();
      }

      await page.waitForTimeout(300);
      await expect(page.locator('body')).toBeVisible();
    });
  });
}
