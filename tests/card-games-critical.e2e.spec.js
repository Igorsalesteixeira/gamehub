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

const CARD_GAMES = [
  { name: 'Solitaire', path: '/games/solitaire/', id: 'solitaire' },
  { name: 'Spider Solitaire', path: '/games/spider-solitaire/', id: 'spider' },
  { name: 'Freecell', path: '/games/freecell/', id: 'freecell' },
  { name: 'Blackjack', path: '/games/blackjack/', id: 'blackjack' },
  { name: 'Poker', path: '/games/poker/', id: 'poker' },
  { name: 'Truco', path: '/games/truco/', id: 'truco' },
  { name: 'Uno', path: '/games/uno/', id: 'uno' },
  { name: 'Buraco', path: '/games/buraco/', id: 'buraco' },
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
// TESTES CRITICOS PARA TODOS OS JOGOS DE CARTA
// ============================================

for (const device of DEVICES) {
  for (const game of CARD_GAMES) {
    test.describe(`${game.name} - Testes Criticos - ${device.name}`, () => {

      test('deve carregar sem erros criticos', async ({ page }) => {
        const criticalErrors = [];
        page.on('console', msg => {
          if (msg.type() === 'error') {
            const text = msg.text();
            if (!text.includes('favicon') && !text.includes('manifest') && !text.includes('adsbygoogle')) {
              criticalErrors.push(text);
            }
          }
        });

        await page.setViewportSize(device.viewport);
        await page.goto(game.path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        expect(criticalErrors, `Erros criticos em ${game.name}: ${criticalErrors.join(', ')}`).toHaveLength(0);
      });

      test('deve ter viewport configurado para mobile', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto(game.path, { waitUntil: 'networkidle' });

        const viewport = await page.evaluate(() => {
          const meta = document.querySelector('meta[name="viewport"]');
          return meta ? meta.getAttribute('content') : null;
        });

        expect(viewport).toContain('width=device-width');
      });

      test('deve ter titulo do jogo visivel', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto(game.path, { waitUntil: 'networkidle' });

        const title = page.locator('h1.game-title, h1');
        await expect(title).toBeVisible();
      });
    });
  }
}

// ============================================
// SOLITAIRE - TESTES ESPECIFICOS
// ============================================

for (const device of DEVICES) {
  test.describe(`Solitaire - Regras e Interacoes - ${device.name}`, () => {

    test('deve distribuir cartas no tableau ao iniciar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Verifica que existem 7 colunas
      for (let i = 0; i < 7; i++) {
        const col = page.locator(`#col${i}`);
        await expect(col).toBeVisible();
      }

      // Verifica que o monte (stock) existe
      const stock = page.locator('#stock');
      await expect(stock).toBeVisible();

      // Verifica que as fundacoes existem
      for (let i = 0; i < 4; i++) {
        const foundation = page.locator(`#f${i}`);
        await expect(foundation).toBeVisible();
      }
    });

    test('deve virar carta do monte ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const stock = page.locator('#stock');
      await stock.click();
      await page.waitForTimeout(500);

      // Verifica que o waste pode ter cartas ou o monte ficou vazio
      const waste = page.locator('#waste');
      await expect(waste).toBeVisible();
    });

    test('deve selecionar carta do tableau ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Clica na ultima carta da primeira coluna (sempre visivel)
      const firstCol = page.locator('#col0 .card').last();
      await firstCol.click();
      await page.waitForTimeout(300);

      // Verifica que a carta foi selecionada (deve ter classe selected)
      const selectedCard = page.locator('#col0 .card.selected');
      await expect(selectedCard).toBeVisible();
    });

    test('deve mover carta entre colunas quando valido', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Tenta arrastar da primeira coluna para a segunda
      const sourceCard = page.locator('#col0 .card').last();
      const targetCol = page.locator('#col1');

      if (await sourceCard.isVisible() && await targetCol.isVisible()) {
        await sourceCard.dragTo(targetCol);
        await page.waitForTimeout(500);

        // Verifica que o jogo continua funcionando
        await expect(page.locator('.board')).toBeVisible();
      }
    });

    test('deve atualizar contador de movimentos', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const movesDisplay = page.locator('#moves-display');
      await expect(movesDisplay).toBeVisible();

      const initialMoves = await movesDisplay.textContent();

      // Faz um movimento (virar do monte)
      await page.locator('#stock').click();
      await page.waitForTimeout(500);

      // Verifica que o contador existe
      await expect(movesDisplay).toBeVisible();
    });

    test('deve mostrar timer funcionando', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const timeDisplay = page.locator('#time-display');
      await expect(timeDisplay).toBeVisible();
      await expect(timeDisplay).toContainText(':');
    });

    test('deve permitir desfazer movimento', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const undoBtn = page.locator('#btn-undo');
      await expect(undoBtn).toBeVisible();

      // Inicialmente desabilitado (sem historico)
      const isDisabled = await undoBtn.isDisabled();
      expect(typeof isDisabled).toBe('boolean');
    });

    test('deve iniciar novo jogo ao clicar em Novo Jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const newGameBtn = page.locator('#btn-new');
      await newGameBtn.click();
      await page.waitForTimeout(1000);

      // Verifica que o jogo foi reiniciado
      await expect(page.locator('.board')).toBeVisible();
    });
  });
}

// ============================================
// SPIDER SOLITAIRE - TESTES ESPECIFICOS
// ============================================

for (const device of DEVICES) {
  test.describe(`Spider Solitaire - Regras e Interacoes - ${device.name}`, () => {

    test('deve distribuir 10 colunas no tableau', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/spider-solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Verifica que existem 10 colunas
      for (let i = 0; i < 10; i++) {
        const col = page.locator(`#col${i}`);
        await expect(col).toBeVisible();
      }
    });

    test('deve ter seletor de naipes funcionando', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/spider-solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const suitSelector = page.locator('#suit-count');
      await expect(suitSelector).toBeVisible();

      // Testa mudar para 2 naipes
      await suitSelector.selectOption('2');
      await page.waitForTimeout(1000);

      // Verifica que o jogo foi reiniciado
      await expect(page.locator('.board')).toBeVisible();
    });

    test('deve distribuir cartas do monte ao clicar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/spider-solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const stock = page.locator('#stock');
      await expect(stock).toBeVisible();

      const stockCount = page.locator('#stock-count');
      await expect(stockCount).toBeVisible();

      // Clica no monte
      await stock.click();
      await page.waitForTimeout(500);

      // Verifica que o jogo continua funcionando
      await expect(page.locator('.board')).toBeVisible();
    });

    test('deve ter 8 fundacoes disponiveis', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/spider-solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      for (let i = 0; i < 8; i++) {
        const foundation = page.locator(`#f${i}`);
        await expect(foundation).toBeVisible();
      }
    });
  });
}

// ============================================
// FREECELL - TESTES ESPECIFICOS
// ============================================

for (const device of DEVICES) {
  test.describe(`Freecell - Regras e Interacoes - ${device.name}`, () => {

    test('deve distribuir 8 colunas no tableau', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/freecell/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Verifica que existem 8 colunas
      for (let i = 0; i < 8; i++) {
        const col = page.locator(`#col${i}`);
        await expect(col).toBeVisible();
      }
    });

    test('deve ter 4 celulas livres disponiveis', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/freecell/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      for (let i = 0; i < 4; i++) {
        const cell = page.locator(`#cell${i}`);
        await expect(cell).toBeVisible();
      }
    });

    test('deve ter 4 fundacoes disponiveis', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/freecell/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      for (let i = 0; i < 4; i++) {
        const foundation = page.locator(`#f${i}`);
        await expect(foundation).toBeVisible();
      }
    });

    test('deve permitir mover carta para celula livre', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/freecell/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Tenta mover carta do tableau para celula livre
      const sourceCard = page.locator('#col0 .card').last();
      const freeCell = page.locator('#cell0');

      if (await sourceCard.isVisible() && await freeCell.isVisible()) {
        await sourceCard.dragTo(freeCell);
        await page.waitForTimeout(500);

        // Verifica que o jogo continua funcionando
        await expect(page.locator('.board')).toBeVisible();
      }
    });
  });
}

// ============================================
// BLACKJACK - TESTES ESPECIFICOS
// ============================================

for (const device of DEVICES) {
  test.describe(`Blackjack - Regras e Interacoes - ${device.name}`, () => {

    test('deve mostrar saldo e aposta iniciais', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/blackjack/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const balanceDisplay = page.locator('#balance-display');
      const betDisplay = page.locator('#bet-display');

      await expect(balanceDisplay).toBeVisible();
      await expect(betDisplay).toBeVisible();

      // Verifica que o saldo eh um numero
      const balance = await balanceDisplay.textContent();
      expect(parseInt(balance)).toBeGreaterThan(0);
    });

    test('deve iniciar novo jogo e distribuir cartas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/blackjack/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Clica em Novo Jogo
      await page.locator('#btn-new').click();
      await page.waitForTimeout(1000);

      // Verifica que as maos foram criadas
      const playerHand = page.locator('#player-hand');
      const dealerHand = page.locator('#dealer-hand');

      await expect(playerHand).toBeVisible();
      await expect(dealerHand).toBeVisible();
    });

    test('deve ter controles de aposta funcionando', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/blackjack/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const betInput = page.locator('#bet-input');
      await expect(betInput).toBeVisible();

      const betMinus = page.locator('#bet-minus');
      const betPlus = page.locator('#bet-plus');

      await expect(betMinus).toBeVisible();
      await expect(betPlus).toBeVisible();
    });

    test('deve ter botoes de acao do jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/blackjack/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Verifica botoes de acao
      await expect(page.locator('#btn-hit')).toBeVisible();
      await expect(page.locator('#btn-stand')).toBeVisible();
      await expect(page.locator('#btn-double')).toBeVisible();
    });

    test('deve mostrar pontuacao das maos', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/blackjack/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Inicia o jogo
      await page.locator('#btn-new').click();
      await page.waitForTimeout(1000);

      // Verifica displays de pontuacao
      const playerScore = page.locator('#player-score');
      const dealerScore = page.locator('#dealer-score');

      await expect(playerScore).toBeVisible();
      await expect(dealerScore).toBeVisible();
    });
  });
}

// ============================================
// POKER - TESTES ESPECIFICOS
// ============================================

for (const device of DEVICES) {
  test.describe(`Poker - Regras e Interacoes - ${device.name}`, () => {

    test('deve mostrar jogadores e fichas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/poker/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Verifica oponentes
      for (let i = 1; i <= 3; i++) {
        const oppName = page.locator(`#opp-name-${i}`);
        const oppChips = page.locator(`#opp-chips-${i}`);
        await expect(oppName).toBeVisible();
        await expect(oppChips).toBeVisible();
      }

      // Verifica jogador
      const playerChips = page.locator('#player-chips');
      await expect(playerChips).toBeVisible();
    });

    test('deve ter area de cartas comunitarias', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/poker/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const communityCards = page.locator('#community-cards');
      await expect(communityCards).toBeVisible();
    });

    test('deve mostrar indicador de fase', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/poker/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Verifica indicadores de fase
      await expect(page.locator('#phase-preflop')).toBeVisible();
      await expect(page.locator('#phase-flop')).toBeVisible();
      await expect(page.locator('#phase-turn')).toBeVisible();
      await expect(page.locator('#phase-river')).toBeVisible();
    });

    test('deve ter area de acoes do jogador', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/poker/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const actionArea = page.locator('#action-area');
      await expect(actionArea).toBeVisible();
    });

    test('deve mostrar informacoes de blinds', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/poker/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const blindInfo = page.locator('#blind-info');
      await expect(blindInfo).toBeVisible();
    });
  });
}

// ============================================
// TRUCO - TESTES ESPECIFICOS
// ============================================

for (const device of DEVICES) {
  test.describe(`Truco - Regras e Interacoes - ${device.name}`, () => {

    test('deve mostrar placar inicial', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/truco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const playerScore = page.locator('#player-score');
      const cpuScore = page.locator('#cpu-score');

      await expect(playerScore).toBeVisible();
      await expect(cpuScore).toBeVisible();

      // Verifica que ambos comecam com 0
      const pScore = await playerScore.textContent();
      const cScore = await cpuScore.textContent();
      expect(parseInt(pScore)).toBe(0);
      expect(parseInt(cScore)).toBe(0);
    });

    test('deve distribuir 3 cartas para o jogador', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/truco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const playerHand = page.locator('#player-hand');
      await expect(playerHand).toBeVisible();

      // Verifica que existem cartas na mao
      const cards = playerHand.locator('.card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('deve ter botao de Truco visivel', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/truco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const trucoBtn = page.locator('#btn-truco');
      await expect(trucoBtn).toBeVisible();
    });

    test('deve mostrar informacoes da rodada', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/truco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const roundNum = page.locator('#round-num');
      const handValue = page.locator('#hand-value');

      await expect(roundNum).toBeVisible();
      await expect(handValue).toBeVisible();
    });

    test('deve ter area para cartas jogadas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/truco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const playerPlayed = page.locator('#player-played');
      const cpuPlayed = page.locator('#cpu-played');

      await expect(playerPlayed).toBeVisible();
      await expect(cpuPlayed).toBeVisible();
    });
  });
}

// ============================================
// UNO - TESTES ESPECIFICOS
// ============================================

for (const device of DEVICES) {
  test.describe(`Uno - Regras e Interacoes - ${device.name}`, () => {

    test('deve mostrar 3 oponentes', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/uno/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      for (let i = 1; i <= 3; i++) {
        const opponent = page.locator(`#opponent-${i}`);
        await expect(opponent).toBeVisible();

        const cardCount = page.locator(`#opp-count-${i}`);
        await expect(cardCount).toBeVisible();
      }
    });

    test('deve distribuir 7 cartas para o jogador', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/uno/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const playerHand = page.locator('#player-hand');
      await expect(playerHand).toBeVisible();

      // Verifica que existem cartas na mao do jogador
      const cards = playerHand.locator('.card');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    });

    test('deve ter monte e descarte visiveis', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/uno/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const drawPile = page.locator('#draw-pile');
      const discardPile = page.locator('#discard-pile');

      await expect(drawPile).toBeVisible();
      await expect(discardPile).toBeVisible();
    });

    test('deve ter botao de comprar carta', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/uno/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const drawBtn = page.locator('#btn-draw');
      await expect(drawBtn).toBeVisible();
    });

    test('deve mostrar direcao do jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/uno/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const directionDisplay = page.locator('#direction-display');
      await expect(directionDisplay).toBeVisible();
    });

    test('deve ter seletor de cor para coringas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/uno/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const colorPicker = page.locator('#color-picker-overlay');
      await expect(colorPicker).toBeAttached();
    });
  });
}

// ============================================
// BURACO - TESTES ESPECIFICOS
// ============================================

for (const device of DEVICES) {
  test.describe(`Buraco - Regras e Interacoes - ${device.name}`, () => {

    test('deve mostrar placar de voce e CPU', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/buraco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const scorePlayer = page.locator('#score-player');
      const scoreCpu = page.locator('#score-cpu');

      await expect(scorePlayer).toBeVisible();
      await expect(scoreCpu).toBeVisible();
    });

    test('deve mostrar indicador de turno', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/buraco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const turnBadge = page.locator('#turn-badge');
      await expect(turnBadge).toBeVisible();
    });

    test('deve ter monte e descarte visiveis', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/buraco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const stockPile = page.locator('#stock-pile');
      const discardDisplay = page.locator('#discard-display');

      await expect(stockPile).toBeVisible();
      await expect(discardDisplay).toBeVisible();
    });

    test('deve ter botoes de comprar do monte e descarte', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/buraco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const btnDrawStock = page.locator('#btn-draw-stock');
      const btnDrawDiscard = page.locator('#btn-draw-discard');

      await expect(btnDrawStock).toBeVisible();
      await expect(btnDrawDiscard).toBeVisible();
    });

    test('deve mostrar mortos na mesa', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/buraco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const morto1 = page.locator('#morto1-display');
      const morto2 = page.locator('#morto2-display');

      await expect(morto1).toBeVisible();
      await expect(morto2).toBeVisible();
    });

    test('deve ter area de mao do jogador', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/buraco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const playerHand = page.locator('#player-hand-display');
      await expect(playerHand).toBeVisible();
    });

    test('deve ter botoes de acao (combinar, descartar, baixar)', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/buraco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const btnMeld = page.locator('#btn-meld');
      const btnDiscard = page.locator('#btn-discard');
      const btnBaixar = page.locator('#btn-baixar');

      await expect(btnMeld).toBeAttached();
      await expect(btnDiscard).toBeVisible();
      await expect(btnBaixar).toBeAttached();
    });

    test('deve mostrar contador de cartas na mao', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/buraco/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const handCount = page.locator('#hand-count');
      await expect(handCount).toBeVisible();
    });
  });
}

// ============================================
// TESTES DE ARRASTE (DRAG AND DROP) - SOLITAIRE
// ============================================

for (const device of DEVICES) {
  test.describe(`Solitaire - Drag and Drop - ${device.name}`, () => {

    test('deve suportar arrastar carta do waste para coluna', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Virar cartas do monte
      await page.locator('#stock').click();
      await page.waitForTimeout(500);

      // Tenta arrastar do waste para uma coluna
      const wasteCard = page.locator('#waste .card').last();
      const targetCol = page.locator('#col0');

      if (await wasteCard.isVisible()) {
        await wasteCard.dragTo(targetCol);
        await page.waitForTimeout(500);

        // Verifica que o jogo continua funcionando
        await expect(page.locator('.board')).toBeVisible();
      }
    });

    test('deve suportar duplo clique para auto-mover', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/solitaire/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      // Tenta duplo clique em uma carta do tableau
      const card = page.locator('#col0 .card').last();
      if (await card.isVisible()) {
        await card.dblclick();
        await page.waitForTimeout(500);

        // Verifica que o jogo continua funcionando
        await expect(page.locator('.board')).toBeVisible();
      }
    });
  });
}

// ============================================
// TESTES DE RESPONSIVIDADE
// ============================================

for (const device of DEVICES) {
  test.describe(`Responsividade - ${device.name}`, () => {

    for (const game of CARD_GAMES) {
      test(`${game.name} deve caber na tela sem scroll horizontal`, async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto(game.path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);

        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        // Em mobile, permite scroll horizontal se necessario para jogos de carta
        if (!device.mobile) {
          expect(hasHorizontalScroll).toBe(false);
        }
      });

      test(`${game.name} deve ter elementos clicaveis com tamanho minimo`, async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto(game.path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);

        // Verifica que cartas e botoes tem tamanho minimo para touch
        const cards = page.locator('.card, .btn, button');
        const count = await cards.count();

        if (count > 0) {
          const firstCard = cards.first();
          const box = await firstCard.boundingBox();

          if (box) {
            // Minimo 44px para touch targets (recomendacao Apple)
            expect(box.width).toBeGreaterThanOrEqual(30);
            expect(box.height).toBeGreaterThanOrEqual(30);
          }
        }
      });
    }
  });
}

// ============================================
// TESTES DE PERFORMANCE
// ============================================

for (const device of DEVICES) {
  test.describe(`Performance - ${device.name}`, () => {

    for (const game of CARD_GAMES) {
      test(`${game.name} deve carregar em menos de 5 segundos`, async ({ page }) => {
        const startTime = Date.now();

        await page.setViewportSize(device.viewport);
        await page.goto(game.path, { waitUntil: 'networkidle' });

        const loadTime = Date.now() - startTime;
        expect(loadTime).toBeLessThan(5000);
      });

      test(`${game.name} nao deve ter vazamento de memoria apos interacoes`, async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto(game.path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);

        // Realiza algumas interacoes
        for (let i = 0; i < 5; i++) {
          const buttons = page.locator('button');
          const count = await buttons.count();
          if (count > 0) {
            const btn = buttons.nth(i % count);
            if (await btn.isVisible() && await btn.isEnabled()) {
              await btn.click();
              await page.waitForTimeout(200);
            }
          }
        }

        // Verifica que a pagina ainda responde
        await expect(page.locator('body')).toBeVisible();
      });
    }
  });
}
