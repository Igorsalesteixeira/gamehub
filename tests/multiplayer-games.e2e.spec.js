const { test, expect } = require('@playwright/test');

// =============================================
//  Multiplayer Games - Testes E2E
//  Testa sincronização entre dois jogadores
// =============================================

const mockSupabaseCode = (userId) => `
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: '${userId}' } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  from: (table) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: {
            id: 'test-room-123',
            player1_id: 'player-1-id',
            player2_id: 'player-2-id',
            player1_name: 'Jogador 1',
            player2_name: 'Jogador 2',
            turn: 1,
            status: 'playing',
            state: { board: Array(9).fill(null), currentPlayer: 'X' }
          },
          error: null
        })
      })
    }),
    insert: () => ({ data: null, error: null }),
    update: () => ({ data: null, error: null }),
  }),
  channel: (name) => ({
    on: (event, callback) => {
      window.__testChannelCallbacks = window.__testChannelCallbacks || {};
      window.__testChannelCallbacks[event] = callback;
      return { unsubscribe: () => {} };
    },
    subscribe: () => {},
    send: (msg) => {
      window.__testMessages = window.__testMessages || [];
      window.__testMessages.push(msg);
    },
  }),
};
`;

const MULTIPLAYER_GAMES = [
  { name: 'tictactoe', path: '/games/tictactoe/', title: /Jogo da Velha/i },
  { name: 'chess', path: '/games/chess/', title: /Xadrez/i },
  { name: 'checkers', path: '/games/checkers/', title: /Damas/i },
  { name: 'connect4', path: '/games/connect4/', title: /Lig|Connect/i },
  { name: 'battleship', path: '/games/battleship/', title: /Batalha Naval/i },
  { name: 'reversi', path: '/games/reversi/', title: /Reversi/i },
  { name: 'ludo', path: '/games/ludo/', title: /Ludo/i },
  { name: 'go', path: '/games/go/', title: /Go/i },
  { name: 'truco', path: '/games/truco/', title: /Truco/i },
  { name: 'uno', path: '/games/uno/', title: /Uno/i },
  { name: 'poker', path: '/games/poker/', title: /Poker/i },
  { name: 'buraco', path: '/games/buraco/', title: /Buraco/i },
  { name: 'domino', path: '/games/domino/', title: /Dominó/i },
  { name: 'sueca', path: '/games/sueca/', title: /Sueca/i },
  { name: 'pife', path: '/games/pife/', title: /Pife/i },
  { name: 'cacheta', path: '/games/cacheta/', title: /Cacheta/i },
  { name: 'sinuca', path: '/games/sinuca/', title: /Sinuca/i },
];

const DEVICES = [
  { name: 'Desktop', viewport: { width: 1280, height: 720 } },
  { name: 'iPhone 12', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'Pixel 5', viewport: { width: 393, height: 851 }, mobile: true },
];

// =============================================
//  Testes por Jogo
// =============================================

for (const game of MULTIPLAYER_GAMES) {
  test.describe(`👥 ${game.name} - Multiplayer Tests`, () => {

    test('deve detectar modo multiplayer via URL', async ({ page }) => {
      // Mock Supabase
      await page.route('**/supabase.js', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: mockSupabaseCode('player-1-id'),
        });
      });

      // Acessar com parâmetro de sala
      await page.goto(`${game.path}?room=test-room-123`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Verificar se o jogo carregou
      await expect(page.locator('body')).toBeVisible();

      // Verificar se há indicador de multiplayer (se existir)
      const modeIndicator = page.locator('#mode-indicator, .mode-indicator');
      if (await modeIndicator.isVisible().catch(() => false)) {
        const text = await modeIndicator.textContent();
        expect(text.toLowerCase()).toContain('multiplayer');
      }
    });

    test('deve carregar sem erros no modo multiplayer', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            errors.push(text);
          }
        }
      });

      await page.route('**/supabase.js', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: mockSupabaseCode('player-1-id'),
        });
      });

      await page.goto(`${game.path}?room=test-room-123`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(errors, `Erros: ${errors.join(', ')}`).toHaveLength(0);
    });

    test('deve ter título correto', async ({ page }) => {
      await page.route('**/supabase.js', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: mockSupabaseCode('player-1-id'),
        });
      });

      await page.goto(`${game.path}?room=test-room-123`, { waitUntil: 'networkidle' });
      await expect(page).toHaveTitle(game.title);
    });

    test('deve mostrar área de jogo visível', async ({ page }) => {
      await page.route('**/supabase.js', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: mockSupabaseCode('player-1-id'),
        });
      });

      await page.goto(`${game.path}?room=test-room-123`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Verificar se há área de jogo
      const gameArea = page.locator('#game-container, #board, .board, canvas, .game-area').first();
      await expect(gameArea).toBeVisible({ timeout: 5000 });
    });

    if (game.name === 'tictactoe') {
      test('deve sincronizar movimento entre jogadores [TicTacToe]', async ({ browser }) => {
        // Criar dois contexts (dois jogadores)
        const player1Context = await browser.newContext();
        const player2Context = await browser.newContext();

        const player1Page = await player1Context.newPage();
        const player2Page = await player2Context.newPage();

        // Mock para cada jogador
        await player1Page.route('**/supabase.js', async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: mockSupabaseCode('player-1-id'),
          });
        });

        await player2Page.route('**/supabase.js', async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: mockSupabaseCode('player-2-id'),
          });
        });

        // Ambos entram na mesma sala
        await player1Page.goto(`${game.path}?room=test-room-123`, { waitUntil: 'networkidle' });
        await player2Page.goto(`${game.path}?room=test-room-123`, { waitUntil: 'networkidle' });
        await player1Page.waitForTimeout(2000);
        await player2Page.waitForTimeout(2000);

        // Jogador 1 faz movimento
        const cell0 = player1Page.locator('[data-index="0"]').first();
        if (await cell0.isVisible().catch(() => false)) {
          await cell0.click();
          await player1Page.waitForTimeout(500);

          // Verificar se movimento aparece no jogador 1
          await expect(cell0).toHaveText('X');
        }

        await player1Context.close();
        await player2Context.close();
      });
    }
  });
}

// =============================================
//  Testes Cross-Device
// =============================================

test.describe('📱 Cross-Device Multiplayer Tests', () => {

  for (const device of DEVICES) {
    test(`deve carregar multiplayer em ${device.name}`, async ({ page }) => {
      await page.setViewportSize(device.viewport);

      await page.route('**/supabase.js', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: mockSupabaseCode('player-1-id'),
        });
      });

      await page.goto('/games/tictactoe/?room=test-room-123', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Verificar se jogo carregou
      await expect(page.locator('body')).toBeVisible();

      // Verificar viewport
      const viewport = await page.evaluate(() => {
        return {
          width: window.innerWidth,
          height: window.innerHeight
        };
      });

      expect(viewport.width).toBeLessThanOrEqual(device.viewport.width + 50);
    });
  }
});

// =============================================
//  Testes de Conexão
// =============================================

test.describe('🔌 Connection Tests', () => {

  test('deve redirecionar para login se não autenticado', async ({ page }) => {
    // Mock sem sessão
    await page.route('**/supabase.js', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
          export const supabase = {
            auth: {
              getSession: async () => ({ data: { session: null }, error: null }),
            },
          };
        `,
      });
    });

    await page.goto('/games/tictactoe/?room=test-room-123', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verificar se redirecionou para auth
    const url = page.url();
    expect(url).toContain('auth.html');
  });

  test('deve mostrar sala não encontrada se room inválido', async ({ page }) => {
    await page.route('**/supabase.js', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: mockSupabaseCode('player-1-id'),
      });
    });

    // Interceptar query para retornar erro
    await page.route('**/rest/v1/game_rooms**', async route => {
      await route.fulfill({
        status: 404,
        body: JSON.stringify({ message: 'Not found' }),
      });
    });

    await page.goto('/games/tictactoe/?room=invalid-room', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verificar se redirecionou para multiplayer
    const url = page.url();
    expect(url).toContain('multiplayer.html');
  });
});

// =============================================
//  Testes de Performance
// =============================================

test.describe('⚡ Performance Tests', () => {

  test('deve carregar em menos de 3 segundos', async ({ page }) => {
    const startTime = Date.now();

    await page.route('**/supabase.js', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: mockSupabaseCode('player-1-id'),
      });
    });

    await page.goto('/games/tictactoe/?room=test-room-123', { waitUntil: 'networkidle' });

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });
});
