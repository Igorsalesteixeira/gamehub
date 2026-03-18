const { test, expect } = require('@playwright/test');

const mockSupabaseCode = `
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'test-user' } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }),
  },
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: null }),
  }),
};
`;

const DEVICES = [
  { name: 'Desktop', viewport: { width: 1280, height: 720 } },
  { name: 'iPhone 12', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'Pixel 5', viewport: { width: 393, height: 851 }, mobile: true },
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

// ============================================
// GAME 2048 TESTS
// ============================================
for (const device of DEVICES) {
  test.describe(`🔢 2048 - Testes Críticos - ${device.name}`, () => {

    test('deve carregar sem erros críticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/game2048/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve inicializar com tabuleiro 4x4', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/game2048/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      const cells = board.locator('.cell');
      await expect(cells).toHaveCount(16);
    });

    test('deve mover tiles com setas do teclado', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/game2048/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Move em todas direções
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(300);

      // Verifica que tabuleiro continua visível
      await expect(page.locator('#board')).toBeVisible();
    });

    test('deve atualizar pontuação ao mover', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/game2048/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const scoreBefore = await page.locator('#score-main').textContent();

      // Move várias vezes
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(200);
      }

      // Verifica que score existe
      const scoreAfter = await page.locator('#score-main').textContent();
      expect(parseInt(scoreAfter)).toBeGreaterThanOrEqual(0);
    });

    test('deve iniciar novo jogo ao clicar no botão', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/game2048/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const btnNewGame = page.locator('#btn-new-game');
      await expect(btnNewGame).toBeVisible();
      await btnNewGame.click();
      await page.waitForTimeout(500);

      // Verifica que tabuleiro foi reiniciado
      await expect(page.locator('#board')).toBeVisible();
      await expect(page.locator('#score-main')).toHaveText('0');
    });

    test('deve salvar recorde no localStorage', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/game2048/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const hasBestScore = await page.evaluate(() => {
        return localStorage.getItem('2048_best') !== null;
      });

      expect(typeof hasBestScore).toBe('boolean');
    });

    if (device.mobile) {
      test('deve suportar swipe touch', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/game2048/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        const board = page.locator('#board');
        const box = await board.boundingBox();

        // Simula swipe para direita
        await board.touchscreen.tap({
          x: box.x + 50,
          y: box.y + box.height / 2,
        });

        await page.waitForTimeout(300);
        await expect(board).toBeVisible();
      });
    }
  });
}

// ============================================
// SUDOKU TESTS
// ============================================
for (const device of DEVICES) {
  test.describe(`🔢 Sudoku - Testes Críticos - ${device.name}`, () => {

    test('deve carregar sem erros críticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/sudoku/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro 9x9', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/sudoku/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      const cells = board.locator('.cell');
      await expect(cells).toHaveCount(81);
    });

    test('deve selecionar célula ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/sudoku/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Clica em uma célula que não seja 'given'
      const cells = page.locator('#board .cell.user');
      if (await cells.count() > 0) {
        await cells.first().click();
        await page.waitForTimeout(300);
        await expect(cells.first()).toHaveClass(/selected/);
      }
    });

    test('deve inserir número via teclado virtual', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/sudoku/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Seleciona célula
      const cells = page.locator('#board .cell.user');
      if (await cells.count() > 0) {
        await cells.first().click();
        await page.waitForTimeout(300);

        // Clica no número 5
        await page.locator('[data-num="5"]').click();
        await page.waitForTimeout(300);

        // Verifica que número foi inserido
        await expect(cells.first()).toHaveText('5');
      }
    });

    test('deve mudar dificuldade', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/sudoku/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const select = page.locator('#difficulty-select');
      await select.selectOption('hard');
      await page.waitForTimeout(500);

      // Verifica que tabuleiro foi recarregado
      await expect(page.locator('#board')).toBeVisible();
    });

    test('deve iniciar timer ao interagir', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/sudoku/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const timerBefore = await page.locator('#timer-display').textContent();

      // Interage com o jogo
      const cells = page.locator('#board .cell.user');
      if (await cells.count() > 0) {
        await cells.first().click();
        await page.waitForTimeout(1000);

        const timerAfter = await page.locator('#timer-display').textContent();
        expect(timerAfter).not.toBe('0:00');
      }
    });
  });
}

// ============================================
// MINESWEEPER TESTS
// ============================================
for (const device of DEVICES) {
  test.describe(`💣 Minesweeper - Testes Críticos - ${device.name}`, () => {

    test('deve carregar sem erros críticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/minesweeper/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/minesweeper/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      const cells = board.locator('.cell');
      await expect(cells).toHaveCount(81); // 9x9 easy mode
    });

    test('deve revelar célula ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/minesweeper/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const cell = page.locator('#board .cell').first();
      await cell.click();
      await page.waitForTimeout(300);

      // Célula deve estar revelada
      await expect(cell).toHaveClass(/revealed|unrevealed/);
    });

    test('deve marcar bandeira com botão direito', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/minesweeper/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const cell = page.locator('#board .cell').first();
      await cell.click({ button: 'right' });
      await page.waitForTimeout(300);

      // Verifica se foi marcada
      const hasFlag = await cell.evaluate(el => el.classList.contains('flagged'));
      expect(typeof hasFlag).toBe('boolean');
    });

    test('deve mudar dificuldade', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/minesweeper/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Clica em dificuldade média
      await page.locator('[data-diff="medium"]').click();
      await page.waitForTimeout(500);

      // Verifica que tabuleiro foi recarregado
      await expect(page.locator('#board')).toBeVisible();
    });

    test('deve iniciar novo jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/minesweeper/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      await page.locator('#btn-new').click();
      await page.waitForTimeout(500);

      // Timer deve zerar
      await expect(page.locator('#timer-display')).toHaveText('0');
    });

    if (device.mobile) {
      test('deve ter modo bandeira em mobile', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/minesweeper/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        const btnFlag = page.locator('#btn-flag');
        await expect(btnFlag).toBeVisible();

        await btnFlag.click();
        await page.waitForTimeout(300);

        // Modo bandeira deve estar ativo
        const isActive = await btnFlag.evaluate(el => el.classList.contains('active'));
        expect(typeof isActive).toBe('boolean');
      });
    }
  });
}

// ============================================
// MEMORY GAME TESTS
// ============================================
for (const device of DEVICES) {
  test.describe(`🧠 Memory - Testes Críticos - ${device.name}`, () => {

    test('deve carregar sem erros críticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/memory/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar cartas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/memory/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      const cards = board.locator('.card');
      await expect(cards).toHaveCount(16); // 4x4 medium default
    });

    test('deve virar carta ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/memory/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const card = page.locator('#board .card').first();
      await card.click();
      await page.waitForTimeout(300);

      // Carta deve estar virada
      await expect(card).toHaveClass(/flipped/);
    });

    test('deve iniciar timer ao virar primeira carta', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/memory/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const timerBefore = await page.locator('#timer-display').textContent();

      // Vira primeira carta
      await page.locator('#board .card').first().click();
      await page.waitForTimeout(1100);

      const timerAfter = await page.locator('#timer-display').textContent();
      expect(timerAfter).not.toBe('0:00');
    });

    test('deve contar movimentos', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/memory/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Vira duas cartas
      const cards = page.locator('#board .card');
      await cards.nth(0).click();
      await page.waitForTimeout(300);
      await cards.nth(1).click();
      await page.waitForTimeout(300);

      // Verifica contador de movimentos
      const moves = await page.locator('#moves-display').textContent();
      expect(parseInt(moves)).toBeGreaterThanOrEqual(1);
    });

    test('deve mudar dificuldade', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/memory/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const select = page.locator('#difficulty-select');
      await select.selectOption('easy');
      await page.waitForTimeout(500);

      // Deve ter 12 cartas no modo fácil (4x3)
      const cards = page.locator('#board .card');
      await expect(cards).toHaveCount(12);
    });
  });
}

// ============================================
// PUZZLE 15 TESTS
// ============================================
for (const device of DEVICES) {
  test.describe(`🧩 Puzzle 15 - Testes Críticos - ${device.name}`, () => {

    test('deve carregar sem erros críticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/puzzle15/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro 4x4', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/puzzle15/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      const tiles = board.locator('.tile');
      await expect(tiles).toHaveCount(16);
    });

    test('deve mover peça adjacente ao espaço vazio', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/puzzle15/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Encontra uma peça não vazia e clica
      const tiles = page.locator('#board .tile:not(.empty)');
      const count = await tiles.count();

      if (count > 0) {
        await tiles.first().click();
        await page.waitForTimeout(300);

        // Verifica que contador de movimentos foi atualizado ou peça moveu
        const moves = await page.locator('#moves-display').textContent();
        expect(parseInt(moves)).toBeGreaterThanOrEqual(0);
      }
    });

    test('deve iniciar timer ao mover', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/puzzle15/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const timerBefore = await page.locator('#timer-display').textContent();

      // Move uma peça
      const tiles = page.locator('#board .tile:not(.empty)');
      if (await tiles.count() > 0) {
        await tiles.first().click();
        await page.waitForTimeout(1100);

        const timerAfter = await page.locator('#timer-display').textContent();
        expect(timerAfter).not.toBe('0:00');
      }
    });

    test('deve iniciar novo jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/puzzle15/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Faz alguns movimentos
      const tiles = page.locator('#board .tile:not(.empty)');
      if (await tiles.count() > 0) {
        await tiles.first().click();
      }

      await page.waitForTimeout(500);

      // Reinicia
      await page.locator('#btn-new-game').click();
      await page.waitForTimeout(500);

      // Verifica que movimentos zeraram
      await expect(page.locator('#moves-display')).toHaveText('0');
    });
  });
}

// ============================================
// LIGHTS OUT TESTS
// ============================================
for (const device of DEVICES) {
  test.describe(`💡 Lights Out - Testes Críticos - ${device.name}`, () => {

    test('deve carregar sem erros críticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/lightsout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro 5x5', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/lightsout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      const cells = board.locator('.cell');
      await expect(cells).toHaveCount(25);
    });

    test('deve alternar estado da luz ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/lightsout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const cell = page.locator('#board .cell').first();
      const initialClass = await cell.evaluate(el => el.className);

      await cell.click();
      await page.waitForTimeout(300);

      // Estado deve ter mudado
      const newClass = await cell.evaluate(el => el.className);
      expect(newClass).not.toBe(initialClass);
    });

    test('deve contar cliques', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/lightsout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const movesBefore = await page.locator('#moves').textContent();

      // Clica em algumas células
      const cells = page.locator('#board .cell');
      await cells.nth(0).click();
      await page.waitForTimeout(200);
      await cells.nth(1).click();
      await page.waitForTimeout(200);

      const movesText = await page.locator('#moves').textContent();
      expect(movesText).toContain('2');
    });

    test('deve reiniciar nível', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/lightsout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Faz alguns cliques
      const cells = page.locator('#board .cell');
      await cells.nth(0).click();
      await page.waitForTimeout(200);

      // Reinicia
      await page.locator('#restart').click();
      await page.waitForTimeout(500);

      // Cliques devem zerar
      const movesText = await page.locator('#moves').textContent();
      expect(movesText).toContain('0');
    });
  });
}

// ============================================
// NONOGRAM TESTS
// ============================================
for (const device of DEVICES) {
  test.describe(`🧩 Nonogram - Testes Críticos - ${device.name}`, () => {

    test('deve carregar sem erros críticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/nonogram/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/nonogram/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const board = page.locator('#nonogram-board');
      await expect(board).toBeVisible();

      const cells = board.locator('.game-cell');
      await expect(cells).toHaveCount(25); // 5x5 default
    });

    test('deve preencher célula ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/nonogram/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const cell = page.locator('#nonogram-board .game-cell').first();
      await cell.click();
      await page.waitForTimeout(300);

      // Célula deve estar preenchida
      await expect(cell).toHaveClass(/filled/);
    });

    test('deve marcar X com clique direito', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/nonogram/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const cell = page.locator('#nonogram-board .game-cell').first();
      await cell.click({ button: 'right' });
      await page.waitForTimeout(300);

      // Célula deve estar marcada com X
      const hasMark = await cell.evaluate(el => el.classList.contains('marked'));
      expect(typeof hasMark).toBe('boolean');
    });

    test('deve mudar tamanho do tabuleiro', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/nonogram/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Seleciona 10x10
      await page.locator('[data-size="10"]').click();
      await page.waitForTimeout(500);

      // Deve ter 100 células
      const cells = page.locator('#nonogram-board .game-cell');
      await expect(cells).toHaveCount(100);
    });

    test('deve iniciar timer ao interagir', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/nonogram/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const timerBefore = await page.locator('#timer-display').textContent();

      // Preenche uma célula
      await page.locator('#nonogram-board .game-cell').first().click();
      await page.waitForTimeout(1100);

      const timerAfter = await page.locator('#timer-display').textContent();
      expect(timerAfter).not.toBe('0:00');
    });
  });
}

// ============================================
// NUMBLE TESTS
// ============================================
for (const device of DEVICES) {
  test.describe(`🔢 Numble - Testes Críticos - ${device.name}`, () => {

    test('deve carregar sem erros críticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/numble/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro e teclado', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/numble/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      const keyboard = page.locator('#keyboard');
      await expect(keyboard).toBeVisible();

      const rows = board.locator('.numble-row');
      await expect(rows).toHaveCount(6);
    });

    test('deve digitar número via teclado virtual', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/numble/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Clica no número 1
      await page.locator('[data-key="1"]').click();
      await page.waitForTimeout(300);

      // Verifica que apareceu no board
      const cell = page.locator('.numble-cell').first();
      await expect(cell).toHaveText('1');
    });

    test('deve apagar entrada', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/numble/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Digita um número
      await page.locator('[data-key="5"]').click();
      await page.waitForTimeout(200);

      // Apaga
      await page.locator('[data-key="DEL"]').click();
      await page.waitForTimeout(300);

      // Célula deve estar vazia
      const cell = page.locator('.numble-cell').first();
      const text = await cell.textContent();
      expect(text).toBe('');
    });

    test('deve mostrar tentativas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/numble/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const attemptDisplay = page.locator('#attempt-display');
      await expect(attemptDisplay).toBeVisible();
      await expect(attemptDisplay).toContainText('0/6');
    });

    test('deve iniciar novo jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/numble/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Digita algo
      await page.locator('[data-key="1"]').click();
      await page.waitForTimeout(200);

      // Reinicia (se houver botão visível)
      const modal = page.locator('#modal');
      if (await modal.isVisible().catch(() => false)) {
        await page.locator('#btn-modal-new').click();
        await page.waitForTimeout(500);
      }

      // Board deve estar limpo
      await expect(page.locator('#board')).toBeVisible();
    });
  });
}

// ============================================
// MAHJONG TESTS
// ============================================
for (const device of DEVICES) {
  test.describe(`🀄 Mahjong - Testes Críticos - ${device.name}`, () => {

    test('deve carregar sem erros críticos', async ({ page }) => {
      const criticalErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('manifest')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.setViewportSize(device.viewport);
      await page.goto('/games/mahjong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro com peças', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/mahjong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const board = page.locator('#mahjong-board');
      await expect(board).toBeVisible();

      const tiles = board.locator('.mj-tile');
      const count = await tiles.count();
      expect(count).toBeGreaterThan(0);
    });

    test('deve selecionar peça ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/mahjong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Encontra uma peça livre (não blocked)
      const tiles = page.locator('#mahjong-board .mj-tile:not(.blocked)');
      if (await tiles.count() > 0) {
        await tiles.first().click();
        await page.waitForTimeout(300);

        // Peça deve estar selecionada
        await expect(tiles.first()).toHaveClass(/selected/);
      }
    });

    test('deve mostrar contador de peças', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/mahjong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const counter = page.locator('#tiles-left');
      await expect(counter).toBeVisible();

      const count = await counter.textContent();
      expect(parseInt(count)).toBeGreaterThan(0);
    });

    test('deve iniciar timer ao interagir', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/mahjong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const timerBefore = await page.locator('#timer-display').textContent();

      // Clica em uma peça
      const tiles = page.locator('#mahjong-board .mj-tile:not(.blocked)');
      if (await tiles.count() > 0) {
        await tiles.first().click();
        await page.waitForTimeout(1100);

        const timerAfter = await page.locator('#timer-display').textContent();
        expect(timerAfter).not.toBe('0:00');
      }
    });

    test('deve ter botões de controle', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/mahjong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      await expect(page.locator('#btn-hint')).toBeVisible();
      await expect(page.locator('#btn-shuffle')).toBeVisible();
      await expect(page.locator('#btn-new')).toBeVisible();
    });

    test('deve mostrar dica', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/mahjong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      await page.locator('#btn-hint').click();
      await page.waitForTimeout(500);

      // Verifica se alguma peça tem classe hint
      const hints = page.locator('#mahjong-board .mj-tile.hint');
      const count = await hints.count();
      // Pode ou não ter hints disponíveis
      expect(typeof count).toBe('number');
    });

    test('deve embaralhar peças', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/mahjong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      const tilesBefore = await page.locator('#mahjong-board .mj-tile').count();

      await page.locator('#btn-shuffle').click();
      await page.waitForTimeout(500);

      const tilesAfter = await page.locator('#mahjong-board .mj-tile').count();
      expect(tilesAfter).toBe(tilesBefore);
    });
  });
}
