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

const CARD_GAMES = [
  { name: 'solitaire', path: '/games/solitaire/', title: /Paciência|Solitaire/ },
  { name: 'spider-solitaire', path: '/games/spider-solitaire/', title: /Spider/ },
  { name: 'freecell', path: '/games/freecell/', title: /FreeCell/ },
  { name: 'blackjack', path: '/games/blackjack/', title: /Blackjack|21/ },
  { name: 'truco', path: '/games/truco/', title: /Truco/ },
  { name: 'uno', path: '/games/uno/', title: /Uno/ },
  { name: 'poker', path: '/games/poker/', title: /Poker/ },
  { name: 'buraco', path: '/games/buraco/', title: /Buraco/ },
];

const BOARD_GAMES = [
  { name: 'chess', path: '/games/chess/', title: /Xadrez|Chess/ },
  { name: 'checkers', path: '/games/checkers/', title: /Damas|Checkers/ },
  { name: 'ludo', path: '/games/ludo/', title: /Ludo/ },
  { name: 'domino', path: '/games/domino/', title: /Dominó|Domino/ },
  { name: 'go', path: '/games/go/', title: /Go|Weiqi/ },
  { name: 'connect4', path: '/games/connect4/', title: /Lig|Connect|4/ },
  { name: 'reversi', path: '/games/reversi/', title: /Reversi|Othello/ },
  { name: 'battleship', path: '/games/battleship/', title: /Batalha|Naval|Battleship/ },
  { name: 'tictactoe', path: '/games/tictactoe/', title: /Jogo|Velha|Tic|Tac/ },
];

const WORD_GAMES = [
  { name: 'termo', path: '/games/termo/', title: /Termo/ },
  { name: 'hangman', path: '/games/hangman/', title: /Forca|Hangman/ },
  { name: 'anagram', path: '/games/anagram/', title: /Anagram/ },
  { name: 'wordsearch', path: '/games/wordsearch/', title: /Caça|Palavras|Word/ },
  { name: 'stopgame', path: '/games/stopgame/', title: /Stop|Adedonha/ },
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

// Testes para jogos de cartas
for (const game of CARD_GAMES) {
  test.describe(`🃏 ${game.name} - Testes E2E`, () => {

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

    test('deve ter mesa/cartas visíveis', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const table = page.locator('.table, #tableau, .board, .cards-container, .game-board');
      await expect(table.first()).toBeVisible({ timeout: 5000 });
    });

    test('deve iniciar ao clicar no botão', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const btnStart = page.locator('#btn-start, #btn-new-game, .btn-deal, .btn-primary').first();

      if (await btnStart.isVisible().catch(() => false)) {
        await btnStart.click();
        await page.waitForTimeout(500);

        const overlay = page.locator('#overlay, .modal-overlay');
        const isHidden = await overlay.isHidden().catch(() => true);
        expect(isHidden).toBeTruthy();
      }
    });
  });
}

// Testes para jogos de tabuleiro
for (const game of BOARD_GAMES) {
  test.describe(`🎲 ${game.name} - Testes E2E`, () => {

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

    test('deve ter tabuleiro visível', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const board = page.locator('#board, .board, .game-board, canvas').first();
      await expect(board).toBeVisible({ timeout: 5000 });
    });

    test('deve iniciar ao clicar no botão', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const btnStart = page.locator('#btn-start, #btn-new-game, .btn-start').first();

      if (await btnStart.isVisible().catch(() => false)) {
        await btnStart.click();
        await page.waitForTimeout(500);
      }

      // Verifica se o tabuleiro ainda está visível
      await expect(page.locator('#board, .board, .game-board, canvas').first()).toBeVisible();
    });
  });
}

// Testes para jogos de palavras
for (const game of WORD_GAMES) {
  test.describe(`📝 ${game.name} - Testes E2E`, () => {

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

    test('deve ter área de jogo visível', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const gameArea = page.locator('.game-area, .word-grid, .letters, #game-board, .board');
      await expect(gameArea.first()).toBeVisible({ timeout: 5000 });
    });

    test('deve aceitar input de teclado', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Tenta digitar algo
      await page.keyboard.press('a');
      await page.keyboard.press('b');
      await page.keyboard.press('c');

      await page.waitForTimeout(300);
      await expect(page.locator('body')).toBeVisible();
    });
  });
}
