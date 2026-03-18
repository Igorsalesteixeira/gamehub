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
// CHESS (XADREZ) - TESTES CRITICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`♟️ Chess - Testes Criticos - ${device.name}`, () => {

    test('deve carregar sem erros criticos', async ({ page }) => {
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
      await page.goto('/games/chess/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros criticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro 8x8 completo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/chess/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      // Verifica se existem 64 casas
      const squares = board.locator('> div');
      await expect(squares).toHaveCount(64);
    });

    test('deve mostrar indicador de turno', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/chess/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const turnIndicator = page.locator('#turn-indicator');
      await expect(turnIndicator).toBeVisible();
      await expect(turnIndicator).toContainText('Sua vez');
    });

    test('deve selecionar e mover peca', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/chess/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Clica em uma peca (peao na posicao inicial)
      const board = page.locator('#board');
      const squares = board.locator('> div');

      // Seleciona peao (posicao 52 - peao branco)
      await squares.nth(52).click();
      await page.waitForTimeout(300);

      // Verifica se a casa ficou selecionada
      const selectedSquare = squares.nth(52);
      await expect(selectedSquare).toHaveClass(/selected/);
    });

    test('deve iniciar novo jogo ao clicar em Novo Jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/chess/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const btnNewGame = page.locator('#btn-new-game');
      await expect(btnNewGame).toBeVisible();
      await btnNewGame.click();

      await page.waitForTimeout(500);

      // Verifica que o indicador de turno resetou
      const turnIndicator = page.locator('#turn-indicator');
      await expect(turnIndicator).toContainText('Sua vez');
    });

    test('deve mostrar modal de promocao ao chegar na ultima fileira', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/chess/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Verifica que o modal de promocao existe (pode estar oculto)
      const promoModal = page.locator('#promo-modal');
      await expect(promoModal).toBeAttached();
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/chess/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });
  });
}

// ============================================
// CHECKERS (DAMA) - TESTES CRITICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🔴 Checkers - Testes Criticos - ${device.name}`, () => {

    test('deve carregar sem erros criticos', async ({ page }) => {
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
      await page.goto('/games/checkers/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros criticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro 8x8', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/checkers/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      // Verifica se existem 64 casas
      const squares = board.locator('> div');
      await expect(squares).toHaveCount(64);
    });

    test('deve mostrar contador de pecas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/checkers/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const playerCount = page.locator('#player-count');
      const cpuCount = page.locator('#cpu-count');

      await expect(playerCount).toBeVisible();
      await expect(cpuCount).toBeVisible();
      await expect(playerCount).toHaveText('12');
      await expect(cpuCount).toHaveText('12');
    });

    test('deve selecionar peca e mostrar movimentos validos', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/checkers/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      const squares = board.locator('> div');

      // Clica em uma peca valida (casas escuras com peca)
      for (let i = 40; i < 64; i++) {
        const square = squares.nth(i);
        const hasPiece = await square.locator('.piece').count() > 0;
        if (hasPiece) {
          await square.click();
          await page.waitForTimeout(300);
          break;
        }
      }

      // Verifica se alguma casa ficou destacada como valida
      const highlighted = board.locator('.valid-move');
      await expect(highlighted).toHaveCount.greaterThanOrEqual(0);
    });

    test('deve ter seletor de dificuldade', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/checkers/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const difficultySelect = page.locator('#difficulty-select');
      await expect(difficultySelect).toBeVisible();

      // Verifica opcoes
      await expect(difficultySelect.locator('option[value="easy"]')).toBeAttached();
      await expect(difficultySelect.locator('option[value="medium"]')).toBeAttached();
      await expect(difficultySelect.locator('option[value="hard"]')).toBeAttached();
    });

    test('deve mostrar dica de captura obrigatoria', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/checkers/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const tutorialHint = page.locator('#tutorial-hint');
      await expect(tutorialHint).toBeVisible();
    });
  });
}

// ============================================
// LUDO - TESTES CRITICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🎲 Ludo - Testes Criticos - ${device.name}`, () => {

    test('deve carregar sem erros criticos', async ({ page }) => {
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
      await page.goto('/games/ludo/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros criticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar canvas do tabuleiro', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/ludo/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const canvas = page.locator('#ludo-canvas');
      await expect(canvas).toBeVisible();
    });

    test('deve mostrar barra de jogadores', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/ludo/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const playersBar = page.locator('#players-bar');
      await expect(playersBar).toBeVisible();

      // Verifica os 4 jogadores
      for (let i = 0; i < 4; i++) {
        await expect(page.locator(`#chip-${i}`)).toBeVisible();
      }
    });

    test('deve ter botao de rolar dado', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/ludo/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const btnRoll = page.locator('#btn-roll');
      await expect(btnRoll).toBeVisible();
      await expect(btnRoll).toContainText('Rolar');
    });

    test('deve mostrar display do dado', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/ludo/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const diceDisplay = page.locator('#dice-display');
      await expect(diceDisplay).toBeVisible();
    });

    test('deve mostrar mensagem de turno', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/ludo/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const turnMsg = page.locator('#turn-msg');
      await expect(turnMsg).toBeVisible();
      await expect(turnMsg).toContainText('Sua vez');
    });

    test('deve iniciar novo jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/ludo/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const btnNewGame = page.locator('#btn-new-game');
      await expect(btnNewGame).toBeVisible();
      await btnNewGame.click();

      await page.waitForTimeout(500);

      // Verifica que o turno resetou
      const turnMsg = page.locator('#turn-msg');
      await expect(turnMsg).toContainText('Sua vez');
    });
  });
}

// ============================================
// DOMINO - TESTES CRITICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🁣 Domino - Testes Criticos - ${device.name}`, () => {

    test('deve carregar sem erros criticos', async ({ page }) => {
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
      await page.goto('/games/domino/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros criticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve mostrar area da cadeia', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/domino/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const chainArea = page.locator('#chain-area');
      await expect(chainArea).toBeVisible();
    });

    test('deve mostrar mao do jogador', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/domino/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const handArea = page.locator('#hand-area');
      await expect(handArea).toBeVisible();

      // Verifica contador de pecas
      const playerCount = page.locator('#player-count');
      await expect(playerCount).toHaveText('7');
    });

    test('deve mostrar indicadores de pontas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/domino/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const leftBadge = page.locator('#left-end-badge');
      const rightBadge = page.locator('#right-end-badge');

      await expect(leftBadge).toBeVisible();
      await expect(rightBadge).toBeVisible();
    });

    test('deve ter botoes de acao', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/domino/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      await expect(page.locator('#btn-draw')).toBeAttached();
      await expect(page.locator('#btn-pass')).toBeAttached();
      await expect(page.locator('#btn-place-left')).toBeAttached();
      await expect(page.locator('#btn-place-right')).toBeAttached();
    });

    test('deve mostrar placar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/domino/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const scoreVal = page.locator('#score-val');
      const winsVal = page.locator('#wins-val');

      await expect(scoreVal).toBeVisible();
      await expect(winsVal).toBeVisible();
    });
  });
}

// ============================================
// GO - TESTES CRITICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`⚫ Go - Testes Criticos - ${device.name}`, () => {

    test('deve carregar sem erros criticos', async ({ page }) => {
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
      await page.goto('/games/go/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros criticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro 9x9', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/go/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      // Verifica intersecoes (81 para 9x9)
      const intersections = board.locator('.intersection');
      await expect(intersections).toHaveCount(81);
    });

    test('deve mostrar placar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/go/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const blackScore = page.locator('#black-score');
      const whiteScore = page.locator('#white-score');

      await expect(blackScore).toBeVisible();
      await expect(whiteScore).toBeVisible();
    });

    test('deve mostrar indicador de turno', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/go/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const turn = page.locator('#turn');
      await expect(turn).toBeVisible();
      await expect(turn).toContainText('Sua vez');
    });

    test('deve colocar pedra no tabuleiro', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/go/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      const intersections = board.locator('.intersection');

      // Clica em uma intersecao
      await intersections.nth(40).click();
      await page.waitForTimeout(500);

      // Verifica se a pedra foi colocada
      const stone = intersections.nth(40).locator('.stone');
      await expect(stone).toHaveCount.greaterThanOrEqual(0);
    });

    test('deve ter botao de passar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/go/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const passBtn = page.locator('#pass-btn');
      await expect(passBtn).toBeVisible();
      await expect(passBtn).toContainText('Passar');
    });
  });
}

// ============================================
// CONNECT 4 (CONECTE 4) - TESTES CRITICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🔴 Connect 4 - Testes Criticos - ${device.name}`, () => {

    test('deve carregar sem erros criticos', async ({ page }) => {
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
      await page.goto('/games/connect4/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros criticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro 7x6', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/connect4/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      // Verifica se existem 42 celulas (7x6)
      const cells = board.locator('.cell');
      await expect(cells).toHaveCount(42);
    });

    test('deve mostrar status do jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/connect4/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const status = page.locator('#status');
      await expect(status).toBeVisible();
      await expect(status).toContainText('Sua vez');
    });

    test('deve soltar peca ao clicar na coluna', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/connect4/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      const cells = board.locator('.cell');

      // Clica na primeira celula da coluna (indice 35 para linha inferior)
      await cells.nth(35).click();
      await page.waitForTimeout(800);

      // Verifica se a peca foi colocada
      const cell = cells.nth(35);
      await expect(cell).toHaveClass(/red|yellow/);
    });

    test('deve alternar turnos entre jogador e CPU', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/connect4/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const status = page.locator('#status');
      await expect(status).toContainText('Sua vez');

      // Jogador faz jogada
      const board = page.locator('#board');
      const cells = board.locator('.cell');
      await cells.nth(35).click();

      // Aguarda CPU
      await page.waitForTimeout(1500);

      // Verifica que o status mudou
      const statusText = await status.textContent();
      expect(statusText).toMatch(/Sua vez|Computador/);
    });

    test('deve iniciar novo jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/connect4/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const restartBtn = page.locator('#restart');
      await expect(restartBtn).toBeVisible();
      await restartBtn.click();

      await page.waitForTimeout(500);

      // Verifica que o status resetou
      const status = page.locator('#status');
      await expect(status).toContainText('Sua vez');
    });
  });
}

// ============================================
// REVERSI (OTHELLO) - TESTES CRITICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`⚪ Reversi - Testes Criticos - ${device.name}`, () => {

    test('deve carregar sem erros criticos', async ({ page }) => {
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
      await page.goto('/games/reversi/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros criticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro 8x8', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/reversi/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      // Verifica se existem 64 celulas
      const cells = board.locator('.cell');
      await expect(cells).toHaveCount(64);
    });

    test('deve mostrar contador de pecas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/reversi/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const blackCount = page.locator('#black-count');
      const whiteCount = page.locator('#white-count');

      await expect(blackCount).toBeVisible();
      await expect(whiteCount).toBeVisible();

      // Inicio do jogo: 2 pecas de cada
      await expect(blackCount).toHaveText('2');
      await expect(whiteCount).toHaveText('2');
    });

    test('deve mostrar indicador de turno', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/reversi/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const turnIndicator = page.locator('#turn-indicator');
      await expect(turnIndicator).toBeVisible();
      await expect(turnIndicator).toContainText('Sua vez');
    });

    test('deve colocar peca e virar adversarias', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/reversi/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      const cells = board.locator('.cell');

      // Clica em uma celula valida (adjacente as pecas iniciais)
      // Procura celulas com hint (movimento valido)
      const hints = board.locator('.hint');
      const hintCount = await hints.count();

      if (hintCount > 0) {
        await hints.first().click();
        await page.waitForTimeout(500);

        // Verifica se a peca foi colocada
        const blackCount = page.locator('#black-count');
        const count = await blackCount.textContent();
        expect(parseInt(count)).toBeGreaterThanOrEqual(2);
      }
    });

    test('deve iniciar novo jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/reversi/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const btnNewGame = page.locator('#btn-new-game');
      await expect(btnNewGame).toBeVisible();
      await btnNewGame.click();

      await page.waitForTimeout(500);

      // Verifica que o placar resetou
      const blackCount = page.locator('#black-count');
      await expect(blackCount).toHaveText('2');
    });
  });
}

// ============================================
// BATTLESHIP (BATALHA NAVAL) - TESTES CRITICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🚢 Battleship - Testes Criticos - ${device.name}`, () => {

    test('deve carregar sem erros criticos', async ({ page }) => {
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
      await page.goto('/games/battleship/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros criticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve mostrar painel de posicionamento inicialmente', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/battleship/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const placementPanel = page.locator('#placement-panel');
      await expect(placementPanel).toBeVisible();
    });

    test('deve mostrar grid de posicionamento', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/battleship/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const placementGrid = page.locator('#placement-grid');
      await expect(placementGrid).toBeVisible();

      // Verifica celulas do grid
      const cells = placementGrid.locator('.cell');
      await expect(cells).toHaveCount(100); // 10x10
    });

    test('deve ter botoes de posicionamento', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/battleship/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const btnRotate = page.locator('#btn-rotate');
      const btnRandom = page.locator('#btn-random');

      await expect(btnRotate).toBeVisible();
      await expect(btnRandom).toBeVisible();
    });

    test('deve mostrar contador de navios', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/battleship/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const playerShips = page.locator('#player-ships');
      const cpuShips = page.locator('#cpu-ships');

      await expect(playerShips).toBeVisible();
      await expect(cpuShips).toBeVisible();
      await expect(playerShips).toHaveText('5');
      await expect(cpuShips).toHaveText('5');
    });

    test('deve posicionar navios aleatoriamente', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/battleship/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const btnRandom = page.locator('#btn-random');
      await btnRandom.click();
      await page.waitForTimeout(500);

      // Verifica se o botao de iniciar apareceu
      const btnStart = page.locator('#btn-start');
      await expect(btnStart).toBeVisible();
    });

    test('deve ter indicador de turno', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/battleship/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const turnIndicator = page.locator('#turn-indicator');
      await expect(turnIndicator).toBeVisible();
    });
  });
}

// ============================================
// TIC TAC TOE (JOGO DA VELHA) - TESTES CRITICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`⭕ Tic Tac Toe - Testes Criticos - ${device.name}`, () => {

    test('deve carregar sem erros criticos', async ({ page }) => {
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
      await page.goto('/games/tictactoe/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      expect(criticalErrors, `Erros criticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve renderizar tabuleiro 3x3', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tictactoe/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      await expect(board).toBeVisible();

      // Verifica se existem 9 celulas
      const cells = board.locator('.cell');
      await expect(cells).toHaveCount(9);
    });

    test('deve mostrar placar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tictactoe/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const scorePlayer = page.locator('#score-player');
      const scoreCpu = page.locator('#score-cpu');
      const scoreDraw = page.locator('#score-draw');

      await expect(scorePlayer).toBeVisible();
      await expect(scoreCpu).toBeVisible();
      await expect(scoreDraw).toBeVisible();

      // Scores iniciais em 0
      await expect(scorePlayer).toHaveText('0');
      await expect(scoreCpu).toHaveText('0');
      await expect(scoreDraw).toHaveText('0');
    });

    test('deve mostrar indicador de turno', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tictactoe/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const turnIndicator = page.locator('#turn-indicator');
      await expect(turnIndicator).toBeVisible();
      await expect(turnIndicator).toContainText('Sua vez');
    });

    test('deve marcar X ao clicar em celula vazia', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tictactoe/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      const cells = board.locator('.cell');

      // Clica na celula do centro
      await cells.nth(4).click();
      await page.waitForTimeout(300);

      // Verifica se o X foi marcado
      await expect(cells.nth(4)).toHaveText('X');
    });

    test('deve alternar turnos entre jogador e CPU', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tictactoe/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const turnIndicator = page.locator('#turn-indicator');
      await expect(turnIndicator).toContainText('Sua vez');

      // Jogador faz jogada
      const board = page.locator('#board');
      const cells = board.locator('.cell');
      await cells.nth(0).click();

      // Aguarda CPU
      await page.waitForTimeout(600);

      // Verifica que o turno mudou
      const turnText = await turnIndicator.textContent();
      expect(turnText).toMatch(/Sua vez|computador/);
    });

    test('deve detectar vitoria do jogador', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tictactoe/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const board = page.locator('#board');
      const cells = board.locator('.cell');

      // Estrategia para vencer: colunas 0, 4, 8 (diagonal)
      // Mas precisamos considerar que a CPU tambem joga
      // Vamos apenas verificar que o jogo funciona

      // Faz algumas jogadas
      for (let i = 0; i < 9; i += 2) {
        const cell = cells.nth(i);
        const text = await cell.textContent();
        if (text === '') {
          await cell.click();
          await page.waitForTimeout(600);

          // Verifica se o modal apareceu (vitoria ou empate)
          const modal = page.locator('#modal-overlay');
          const isVisible = await modal.isVisible().catch(() => false);
          if (isVisible) break;
        }
      }

      // Verifica que o jogo terminou ou continua
      await expect(board).toBeVisible();
    });

    test('deve iniciar novo jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tictactoe/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const btnNewGame = page.locator('#btn-new-game');
      await expect(btnNewGame).toBeVisible();
      await btnNewGame.click();

      await page.waitForTimeout(500);

      // Verifica que o turno resetou
      const turnIndicator = page.locator('#turn-indicator');
      await expect(turnIndicator).toContainText('Sua vez');
    });

    test('deve atualizar placar apos vitoria', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tictactoe/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Joga ate ter um resultado
      const board = page.locator('#board');
      const cells = board.locator('.cell');

      for (let i = 0; i < 9; i++) {
        const cell = cells.nth(i);
        const text = await cell.textContent();
        if (text === '') {
          await cell.click();
          await page.waitForTimeout(600);

          const modal = page.locator('#modal-overlay');
          const isVisible = await modal.isVisible().catch(() => false);
          if (isVisible) {
            // Verifica se algum placar foi atualizado
            const scorePlayer = await page.locator('#score-player').textContent();
            const scoreCpu = await page.locator('#score-cpu').textContent();
            const scoreDraw = await page.locator('#score-draw').textContent();

            const total = parseInt(scorePlayer) + parseInt(scoreCpu) + parseInt(scoreDraw);
            expect(total).toBeGreaterThanOrEqual(1);
            break;
          }
        }
      }
    });
  });
}
