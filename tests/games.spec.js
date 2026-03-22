const { test, expect } = require('@playwright/test');


// Mock do supabase para testes
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

// Lista de todos os jogos
const GAMES = [
  // Arcade
  { name: 'snake', path: '/games/snake/', hasCanvas: true },
  { name: 'tetris', path: '/games/tetris/', hasCanvas: true },
  { name: 'pong', path: '/games/pong/', hasCanvas: true },
  { name: 'breakout', path: '/games/breakout/', hasCanvas: true },
  { name: 'dinorunner', path: '/games/dinorunner/', hasCanvas: true },
  { name: 'spaceinvaders', path: '/games/spaceinvaders/', hasCanvas: true },
  { name: 'pacman', path: '/games/pacman/', hasCanvas: true },
  { name: 'bubble-shooter', path: '/games/bubble-shooter/', hasCanvas: true },
  { name: 'flappybird', path: '/games/flappybird/', hasCanvas: true },

  // Puzzle
  { name: 'game2048', path: '/games/game2048/', hasCanvas: false },
  { name: 'sudoku', path: '/games/sudoku/', hasCanvas: false },
  { name: 'minesweeper', path: '/games/minesweeper/', hasCanvas: false },
  { name: 'memory', path: '/games/memory/', hasCanvas: false },
  { name: 'puzzle15', path: '/games/puzzle15/', hasCanvas: false },
  { name: 'sokoban', path: '/games/sokoban/', hasCanvas: true },
  { name: 'lightsout', path: '/games/lightsout/', hasCanvas: false },
  { name: 'nonogram', path: '/games/nonogram/', hasCanvas: false },
  { name: 'numble', path: '/games/numble/', hasCanvas: false },
  { name: 'mahjong', path: '/games/mahjong/', hasCanvas: false },

  // Word
  { name: 'termo', path: '/games/termo/', hasCanvas: false },
  { name: 'hangman', path: '/games/hangman/', hasCanvas: false },
  { name: 'anagram', path: '/games/anagram/', hasCanvas: false },
  { name: 'wordsearch', path: '/games/wordsearch/', hasCanvas: true },
  { name: 'stopgame', path: '/games/stopgame/', hasCanvas: false },

  // Card
  { name: 'solitaire', path: '/games/solitaire/', hasCanvas: false },
  { name: 'spider-solitaire', path: '/games/spider-solitaire/', hasCanvas: false },
  { name: 'freecell', path: '/games/freecell/', hasCanvas: false },
  { name: 'blackjack', path: '/games/blackjack/', hasCanvas: false },
  { name: 'truco', path: '/games/truco/', hasCanvas: false },
  { name: 'uno', path: '/games/uno/', hasCanvas: false },
  { name: 'poker', path: '/games/poker/', hasCanvas: false },
  { name: 'buraco', path: '/games/buraco/', hasCanvas: false },

  // Board
  { name: 'chess', path: '/games/chess/', hasCanvas: true },
  { name: 'checkers', path: '/games/checkers/', hasCanvas: true },
  { name: 'ludo', path: '/games/ludo/', hasCanvas: true },
  { name: 'domino', path: '/games/domino/', hasCanvas: false },
  { name: 'go', path: '/games/go/', hasCanvas: true },
  { name: 'connect4', path: '/games/connect4/', hasCanvas: false },
  { name: 'reversi', path: '/games/reversi/', hasCanvas: true },
  { name: 'battleship', path: '/games/battleship/', hasCanvas: true },
  { name: 'tictactoe', path: '/games/tictactoe/', hasCanvas: false },

  // Strategy
  { name: 'pyramid', path: '/games/pyramid/', hasCanvas: false },
  { name: 'cookieclicker', path: '/games/cookieclicker/', hasCanvas: false },
];

// Intercepta o supabase.js e retorna mock
test.beforeEach(async ({ page }) => {
  await page.route('**/supabase.js', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: mockSupabaseCode,
    });
  });
});

// Teste para cada jogo
for (const game of GAMES) {
  test.describe(`${game.name}`, () => {
    test(`carrega sem erros`, async ({ page }) => {
      // Coleta erros de console
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      page.on('pageerror', error => {
        errors.push(error.message);
      });

      // Acessa o jogo
      await page.goto(game.path);
      await page.waitForLoadState('networkidle');

      // Espera um pouco para scripts carregarem
      await page.waitForTimeout(200);

      // Verifica se há erros
      expect(errors, `Erros de JavaScript: ${errors.join(', ')}`).toHaveLength(0);
    });

    test(`elementos essenciais existem`, async ({ page }) => {
      await page.goto(game.path);
      await page.waitForTimeout(300);

      // Verifica título
      const title = await page.title();
      expect(title).not.toBe('');
      expect(title).not.toContain('404');

      // Verifica se o body carregou
      const body = await page.locator('body');
      await expect(body).toBeVisible();

      // Se tem canvas, verifica se existe
      if (game.hasCanvas) {
        const canvas = page.locator('canvas');
        await expect(canvas).toBeVisible();
      }
    });

    test(`botão de jogar funciona`, async ({ page }) => {
      await page.goto(game.path);
      await page.waitForTimeout(300);

      // Tenta clicar em botão de iniciar (vários seletores comuns)
      const startButton = page.locator('#btn-start, #btn-new-game, .btn-primary').first();

      if (await startButton.isVisible().catch(() => false)) {
        await startButton.click();
        await page.waitForTimeout(200);

        // Verifica se o overlay foi escondido ou o jogo começou
        const overlay = page.locator('#overlay, .modal-overlay').first();
        const isHidden = await overlay.isHidden().catch(() => true);
        expect(isHidden).toBeTruthy();
      }
    });
  });
}
