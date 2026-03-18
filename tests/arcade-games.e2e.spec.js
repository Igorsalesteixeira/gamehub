const { test, expect } = require('@playwright/test');

// Mock do Supabase
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
  { name: 'snake', path: '/games/snake/', title: /Cobrinha|Snake/ },
  { name: 'tetris', path: '/games/tetris/', title: /Tetris/ },
  { name: 'pong', path: '/games/pong/', title: /Pong/ },
  { name: 'breakout', path: '/games/breakout/', title: /Breakout/ },
  { name: 'dinorunner', path: '/games/dinorunner/', title: /Dino|Runner/ },
  { name: 'spaceinvaders', path: '/games/spaceinvaders/', title: /Space|Invaders/ },
  { name: 'pacman', path: '/games/pacman/', title: /Pacman|Pac-man/ },
  { name: 'bubble-shooter', path: '/games/bubble-shooter/', title: /Bubble/ },
  { name: 'flappybird', path: '/games/flappybird/', title: /Flappy/ },
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
  test.describe(`🎮 ${game.name} - Testes E2E`, () => {

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

    test('deve ter canvas do jogo visível', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });

      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible({ timeout: 5000 });
    });

    test('deve iniciar ao clicar no botão', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const btnStart = page.locator('#btn-start').first();
      await expect(btnStart).toBeVisible({ timeout: 5000 });

      await btnStart.click();
      await page.waitForTimeout(500);

      // Verifica que o overlay sumiu
      const overlay = page.locator('#overlay');
      await expect(overlay).toBeHidden();
    });

    test('deve pausar com a tecla P', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Inicia o jogo
      await page.locator('#btn-start').first().click();
      await page.waitForTimeout(500);

      // Testa pausar
      await page.keyboard.press('p');
      await page.waitForTimeout(300);

      // Apenas verifica que não houve erro
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve responder a controles do teclado', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Inicia
      await page.locator('#btn-start').first().click();
      await page.waitForTimeout(500);

      // Testa setas (não deve quebrar)
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(200);

      await expect(page.locator('#game-canvas')).toBeVisible();
    });
  });
}
