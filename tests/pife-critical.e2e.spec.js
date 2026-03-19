
/**
 * Testes E2E Criticos - Pife
 * Verifica funcionalidades essenciais do jogo
 */

import { test, expect } from '@playwright/test';

const GAME_URL = 'http://localhost:8080/games/pife/';

test.describe('Pife - Testes Criticos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    // Aguarda o jogo carregar
    await page.waitForSelector('.config-panel', { timeout: 5000 });
  });

  test('deve exibir tela de configuracao inicial', async ({ page }) => {
    // Verifica se o painel de configuracao esta visivel
    const configPanel = await page.locator('.config-panel');
    await expect(configPanel).toBeVisible();

    // Verifica seletor de jogadores
    const playerButtons = await page.locator('.player-btn');
    await expect(playerButtons).toHaveCount(3);

    // Verifica botao de iniciar
    const startButton = await page.locator('#btn-start');
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Iniciar Jogo');
  });

  test('deve iniciar jogo com 2 jogadores', async ({ page }) => {
    // Seleciona 2 jogadores
    await page.click('.player-btn[data-players="2"]');

    // Inicia o jogo
    await page.click('#btn-start');

    // Verifica se a area do jogo apareceu
    const gameArea = await page.locator('#game-area');
    await expect(gameArea).toBeVisible();

    // Verifica se o painel de configuracao sumiu
    const configPanel = await page.locator('.config-panel');
    await expect(configPanel).toHaveClass(/hidden/);

    // Verifica se o jogador tem 9 cartas
    const playerCards = await page.locator('#player-hand .card');
    await expect(playerCards).toHaveCount(9);
  });

  test('deve permitir comprar do monte', async ({ page }) => {
    // Inicia jogo com 2 jogadores
    await page.click('.player-btn[data-players="2"]');
    await page.click('#btn-start');

    // Aguarda o jogo iniciar
    await page.waitForTimeout(500);

    // Clica no monte
    await page.click('#deck-pile .deck-card');

    // Aguarda animacao
    await page.waitForTimeout(300);

    // Verifica se o jogador agora tem 10 cartas
    const playerCards = await page.locator('#player-hand .card');
    await expect(playerCards).toHaveCount(10);

    // Verifica mensagem de descarte
    const message = await page.locator('#message');
    await expect(message).toContainText('descartar');
  });

  test('deve permitir selecionar e descartar carta', async ({ page }) => {
    // Inicia jogo
    await page.click('.player-btn[data-players="2"]');
    await page.click('#btn-start');
    await page.waitForTimeout(500);

    // Compra do monte
    await page.click('#deck-pile .deck-card');
    await page.waitForTimeout(300);

    // Seleciona primeira carta
    const firstCard = await page.locator('#player-hand .card').first();
    await firstCard.click();

    // Verifica se a carta foi selecionada
    await expect(firstCard).toHaveClass(/selected/);

    // Clica novamente para descartar
    await firstCard.click();
    await page.waitForTimeout(300);

    // Verifica se voltou a ter 9 cartas
    const playerCards = await page.locator('#player-hand .card');
    await expect(playerCards).toHaveCount(9);
  });

  test('deve exibir oponentes corretamente', async ({ page }) => {
    // Inicia jogo com 4 jogadores
    await page.click('.player-btn[data-players="4"]');
    await page.click('#btn-start');
    await page.waitForTimeout(500);

    // Verifica se ha 3 oponentes (4 total - 1 humano)
    const opponents = await page.locator('.opponent');
    await expect(opponents).toHaveCount(3);

    // Verifica se cada oponente mostra contagem de cartas
    for (const opp of await opponents.all()) {
      const cardCount = await opp.locator('.opp-count');
      await expect(cardCount).toContainText('9');
    }
  });

  test('deve permitir ordenar cartas', async ({ page }) => {
    // Inicia jogo
    await page.click('.player-btn[data-players="2"]');
    await page.click('#btn-start');
    await page.waitForTimeout(500);

    // Clica no botao ordenar
    await page.click('#btn-sort');

    // Verifica se o botao responde (nao ha mudanca visual obvia)
    const sortButton = await page.locator('#btn-sort');
    await expect(sortButton).toBeEnabled();
  });

  test('deve ter SEO completo', async ({ page }) => {
    // Verifica title
    await expect(page).toHaveTitle(/Pife/);

    // Verifica meta description
    const metaDescription = await page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /Pife/);

    // Verifica meta keywords
    const metaKeywords = await page.locator('meta[name="keywords"]');
    await expect(metaKeywords).toHaveAttribute('content', /pife/);

    // Verifica OG tags
    const ogTitle = await page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /Pife/);
  });

  test('deve ter estrutura de dados Schema.org', async ({ page }) => {
    // Verifica se existe o script JSON-LD
    const jsonLd = await page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toHaveCount(1);

    // Verifica se contem dados do jogo
    const content = await jsonLd.textContent();
    expect(content).toContain('Pife');
    expect(content).toContain('VideoGame');
  });

  test('deve integrar com sidebar', async ({ page }) => {
    // Verifica se o botao da sidebar existe
    const sidebarToggle = await page.locator('#sidebar-toggle');
    await expect(sidebarToggle).toBeVisible();

    // Clica para abrir sidebar
    await sidebarToggle.click();

    // Verifica se a sidebar abriu
    const sidebar = await page.locator('#sidebar');
    await expect(sidebar).toHaveClass(/open/);

    // Verifica se o link do Pife esta presente
    const pifeLink = await page.locator('a[href*="pife"]');
    await expect(pifeLink).toHaveCount(1);
  });

  test('deve permitir iniciar novo jogo apos terminar', async ({ page }) => {
    // Inicia jogo
    await page.click('.player-btn[data-players="2"]');
    await page.click('#btn-start');
    await page.waitForTimeout(500);

    // Clica em novo jogo
    await page.click('#btn-new');

    // Verifica se voltou para a tela de configuracao
    const configPanel = await page.locator('.config-panel');
    await expect(configPanel).toBeVisible();
  });

  test('deve exibir regras do jogo na pagina', async ({ page }) => {
    // Verifica se a secao de informacoes existe
    const gameInfo = await page.locator('.game-info');
    await expect(gameInfo).toBeVisible();

    // Verifica se contem informacoes sobre regras
    const content = await gameInfo.textContent();
    expect(content).toContain('Regras');
    expect(content).toContain('sequencias');
  });
});
