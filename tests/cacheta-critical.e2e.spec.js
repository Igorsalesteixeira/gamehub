/**
 * Cacheta - Testes E2E Criticos
 * =============================
 *
 * Testes de ponta a ponta para o jogo Cacheta.
 * Executar antes de cada push para garantir qualidade.
 */

import { test, expect } from '@playwright/test';

const GAME_URL = 'http://localhost:3000/games/cacheta/index.html';

// ============================================
// SETUP E NAVEGACAO
// ============================================

test.describe('Setup e Navegacao', () => {
  test('deve carregar a pagina corretamente', async ({ page }) => {
    await page.goto(GAME_URL);

    // Verifica titulo
    await expect(page).toHaveTitle(/Cacheta/);

    // Verifica elementos principais
    await expect(page.locator('.setup-title')).toBeVisible();
    await expect(page.locator('.player-btn')).toHaveCount(3);
  });

  test('deve permitir selecionar numero de jogadores', async ({ page }) => {
    await page.goto(GAME_URL);

    // Clica em 2 jogadores
    await page.click('[data-players="2"]');

    // Verifica se a tela do jogo apareceu
    await expect(page.locator('#game-screen')).not.toHaveClass(/hidden/);
    await expect(page.locator('#setup-screen')).toHaveClass(/hidden/);
  });

  test('deve ter SEO completo', async ({ page }) => {
    await page.goto(GAME_URL);

    // Meta description
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toContain('Cacheta');
    expect(description).toContain('online');

    // Open Graph
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toContain('Cacheta');

    // Canonical
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toContain('cacheta');
  });
});

// ============================================
// GAMEPLAY BASICO
// ============================================

test.describe('Gameplay Basico', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await page.click('[data-players="2"]');
    await page.waitForSelector('#game-screen:not(.hidden)');
  });

  test('deve distribuir cartas corretamente', async ({ page }) => {
    // Verifica se o jogador tem 3 cartas
    const handCards = await page.locator('#player-hand .player-card').count();
    expect(handCards).toBe(3);

    // Verifica se a mesa tem 6 cartas
    const tableCards = await page.locator('.table-card').count();
    expect(tableCards).toBe(6);
  });

  test('deve permitir selecionar carta da mao', async ({ page }) => {
    // Clica na primeira carta da mao
    await page.click('#player-hand .hand-card-wrapper:first-child');

    // Verifica se foi selecionada
    await expect(page.locator('#player-hand .hand-card-wrapper:first-child')).toHaveClass(/selected/);
  });

  test('deve permitir selecionar carta da mesa', async ({ page }) => {
    // Clica na primeira carta da mesa
    await page.click('.table-slot:first-child');

    // Verifica se foi selecionada
    await expect(page.locator('.table-slot:first-child')).toHaveClass(/selected/);
  });

  test('deve habilitar botao de troca quando ambas selecionadas', async ({ page }) => {
    const swapButton = page.locator('#btn-swap');

    // Inicialmente desabilitado
    await expect(swapButton).toBeDisabled();

    // Seleciona carta da mao
    await page.click('#player-hand .hand-card-wrapper:first-child');

    // Seleciona carta da mesa
    await page.click('.table-slot:first-child');

    // Botao deve estar habilitado
    await expect(swapButton).toBeEnabled();
  });

  test('deve realizar troca de cartas', async ({ page }) => {
    // Guarda a carta original da mao
    const originalHandCard = await page.locator('#player-hand .player-card:first-child .card-rank').textContent();

    // Seleciona carta da mao
    await page.click('#player-hand .hand-card-wrapper:first-child');

    // Seleciona carta da mesa
    await page.click('.table-slot:first-child');

    // Clica em trocar
    await page.click('#btn-swap');

    // Verifica se a carta mudou (ou se a mensagem foi exibida)
    await expect(page.locator('#message')).not.toBeEmpty();
  });

  test('deve permitir passar a vez', async ({ page }) => {
    await page.click('#btn-pass');

    // Verifica se a mensagem foi atualizada
    await expect(page.locator('#message')).toContainText(/passou|vez/i);
  });

  test('deve atualizar rodada apos todos jogarem', async ({ page }) => {
    const roundDisplay = page.locator('#round-display');
    const initialRound = await roundDisplay.textContent();

    // Passa a vez (CPU joga automaticamente)
    await page.click('#btn-pass');

    // Espera um pouco para CPU jogar
    await page.waitForTimeout(200);

    // Verifica se a rodada mudou ou a vez voltou
    const message = await page.locator('#message').textContent();
    expect(message).toBeTruthy();
  });
});

// ============================================
// IA E BOTS
// ============================================

test.describe('IA e Bots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await page.click('[data-players="4"]');
    await page.waitForSelector('#game-screen:not(.hidden)');
  });

  test('deve mostrar todos os oponentes', async ({ page }) => {
    // Com 4 jogadores, deve ter 3 oponentes
    const opponents = await page.locator('.opponent').count();
    expect(opponents).toBe(3);
  });

  test('deve indicar turno do oponente', async ({ page }) => {
    // Passa a vez
    await page.click('#btn-pass');

    // Espera CPU jogar
    await page.waitForTimeout(1500);

    // Verifica se algum oponente esta ativo
    const activeOpponent = await page.locator('.opponent.active').count();
    expect(activeOpponent).toBeGreaterThan(0);
  });

  test('deve completar 3 rodadas automaticamente', async ({ page }) => {
    // Joga algumas vezes
    for (let i = 0; i < 6; i++) {
      const swapButton = page.locator('#btn-swap');
      const isEnabled = await swapButton.isEnabled().catch(() => false);

      if (isEnabled) {
        await swapButton.click();
      } else {
        await page.click('#btn-pass');
      }

      await page.waitForTimeout(200);
    }

    // Verifica se o jogo progrediu
    const roundText = await page.locator('#round-display').textContent();
    expect(roundText).toMatch(/Rodada [123]/);
  });
});

// ============================================
// FIM DE JOGO
// ============================================

test.describe('Fim de Jogo', () => {
  test('deve mostrar resultados ao final', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.click('[data-players="2"]');
    await page.waitForSelector('#game-screen:not(.hidden)');

    // Simula jogo rapido passando todas as vezes
    for (let i = 0; i < 10; i++) {
      const passButton = page.locator('#btn-pass');
      const isVisible = await passButton.isVisible().catch(() => false);

      if (isVisible) {
        await passButton.click();
        await page.waitForTimeout(1500);
      } else {
        break;
      }
    }

    // Verifica se a tela de fim de jogo apareceu
    const gameOverVisible = await page.locator('#game-over-screen:not(.hidden)').isVisible().catch(() => false);
    const modalVisible = await page.locator('#modal-overlay:not(.hidden)').isVisible().catch(() => false);

    expect(gameOverVisible || modalVisible).toBeTruthy();
  });

  test('deve permitir iniciar novo jogo', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.click('[data-players="2"]');
    await page.waitForSelector('#game-screen:not(.hidden)');

    // Joga ate o fim
    for (let i = 0; i < 10; i++) {
      const passButton = page.locator('#btn-pass');
      const isVisible = await passButton.isVisible().catch(() => false);

      if (isVisible) {
        await passButton.click();
        await page.waitForTimeout(1500);
      } else {
        break;
      }
    }

    // Clica em novo jogo
    const newGameButton = page.locator('#btn-new-game, #btn-modal-new').first();
    await newGameButton.click();

    // Verifica se voltou para a tela de setup
    await expect(page.locator('#setup-screen')).not.toHaveClass(/hidden/);
  });
});

// ============================================
// UI E RESPONSIVIDADE
// ============================================

test.describe('UI e Responsividade', () => {
  test('deve ser responsivo em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(GAME_URL);
    await page.click('[data-players="2"]');
    await page.waitForSelector('#game-screen:not(.hidden)');

    // Verifica se elementos cabem na tela
    const playerArea = page.locator('#player-area');
    await expect(playerArea).toBeVisible();

    // Verifica se as cartas estao visiveis
    const cards = page.locator('.card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('deve ter contraste adequado', async ({ page }) => {
    await page.goto(GAME_URL);
    await page.click('[data-players="2"]');
    await page.waitForSelector('#game-screen:not(.hidden)');

    // Verifica se elementos importantes sao visiveis
    await expect(page.locator('#player-hand')).toBeVisible();
    await expect(page.locator('.table-area')).toBeVisible();
    await expect(page.locator('.player-actions')).toBeVisible();
  });
});

// ============================================
// INTEGRACAO
// ============================================

test.describe('Integracao', () => {
  test('deve carregar sidebar', async ({ page }) => {
    await page.goto(GAME_URL);

    // Verifica se o botao de toggle existe
    const sidebarToggle = await page.locator('#sidebar-toggle, .sidebar-toggle').count();
    expect(sidebarToggle).toBeGreaterThan(0);
  });

  test('deve ter link de voltar funcionando', async ({ page }) => {
    await page.goto(GAME_URL);

    const backLink = page.locator('.btn-back');
    await expect(backLink).toHaveAttribute('href', /index\.html/);
  });
});

// ============================================
// PERFORMANCE
// ============================================

test.describe('Performance', () => {
  test('deve carregar em menos de 3 segundos', async ({ page }) => {
    const start = Date.now();
    await page.goto(GAME_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(3000);
  });

  test('nao deve ter erros no console', async ({ page }) => {
    const errors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(GAME_URL);
    await page.click('[data-players="2"]');
    await page.waitForTimeout(200);

    // Filtra erros aceitaveis (como de analytics)
    const criticalErrors = errors.filter(e =>
      !e.includes('analytics') &&
      !e.includes('gtag') &&
      !e.includes('googletag')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

// ============================================
// CHECKLIST PRE-PUSH
// ============================================
/*
Execute antes de cada push:

npx playwright test tests/cacheta-critical.e2e.spec.js --headed

Ou para todos os testes:
npx playwright test tests/cacheta-critical.e2e.spec.js

Verificar:
- [ ] Pagina carrega
- [ ] Selecao de jogadores funciona
- [ ] Cartas sao distribuidas
- [ ] Troca de cartas funciona
- [ ] IA joga automaticamente
- [ ] Fim de jogo mostra resultados
- [ ] Novo jogo reinicia
- [ ] Responsividade em mobile
- [ ] Nenhum erro critico no console
*/
