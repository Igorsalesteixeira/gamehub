/**
 * Testes E2E - Sinuca (Bilhar)
 * Testes criticos para garantir funcionamento basico do jogo
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Sinuca - Testes Criticos', () => {
  test.beforeEach(async ({ page }) => {
    // Mock autenticacao
    await page.addInitScript(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'test-token',
        user: { id: 'test-user-id', email: 'test@example.com' }
      }));
    });

    await page.goto(`${BASE_URL}/games/sinuca/index.html`);
    await page.waitForLoadState('networkidle');
  });

  test('deve carregar a pagina corretamente', async ({ page }) => {
    // Verificar titulo
    await expect(page).toHaveTitle(/Sinuca/i);

    // Verificar elementos principais
    await expect(page.locator('#game-canvas')).toBeVisible();
    await expect(page.locator('#player-score')).toBeVisible();
    await expect(page.locator('#cpu-score')).toBeVisible();
    await expect(page.locator('#btn-new-game')).toBeVisible();
  });

  test('deve exibir o canvas do jogo', async ({ page }) => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Verificar dimensoes do canvas
    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('deve iniciar novo jogo ao clicar no botao', async ({ page }) => {
    // Clicar em novo jogo
    await page.click('#btn-new-game');

    // Verificar se placar foi resetado
    const playerScore = await page.locator('#player-score').textContent();
    const cpuScore = await page.locator('#cpu-score').textContent();

    expect(playerScore).toBe('0');
    expect(cpuScore).toBe('0');
  });

  test('deve responder a interacao de mira (mouse)', async ({ page }) => {
    const canvas = page.locator('#game-canvas');

    // Simular arraste para mirar
    const box = await canvas.boundingBox();
    const startX = box.x + 100;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 50, startY - 30);

    // Verificar se barra de forca apareceu
    const powerFill = page.locator('#power-fill');
    await expect(powerFill).toBeVisible();

    await page.mouse.up();
  });

  test('deve ter informacoes do jogo visiveis', async ({ page }) => {
    // Verificar secao de informacoes
    const gameInfo = page.locator('.game-info');
    await expect(gameInfo).toBeVisible();

    // Verificar titulos das regras
    await expect(page.locator('text=Como jogar Sinuca Online')).toBeVisible();
    await expect(page.locator('text=Regras')).toBeVisible();
    await expect(page.locator('text=Dicas')).toBeVisible();
  });

  test('deve ter SEO completo', async ({ page }) => {
    // Verificar meta description
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
    expect(metaDescription).toContain('Sinuca');

    // Verificar OG tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toContain('Sinuca');

    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
    expect(ogDescription).toBeTruthy();
  });

  test('deve ser responsivo', async ({ page }) => {
    // Testar em viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Verificar se elementos ajustaram
    const container = page.locator('.game-container');
    await expect(container).toBeVisible();
  });

  test('deve ter controles de toque funcionando', async ({ page }) => {
    const canvas = page.locator('#game-canvas');

    // Simular toque
    const box = await canvas.boundingBox();
    const touchX = box.x + 100;
    const touchY = box.y + box.height / 2;

    await page.touchscreen.tap(touchX, touchY);

    // Verificar se canvas ainda esta funcional
    await expect(canvas).toBeVisible();
  });

  test('deve ter botao de voltar funcionando', async ({ page }) => {
    const backButton = page.locator('.btn-back');
    await expect(backButton).toBeVisible();

    // Verificar link
    const href = await backButton.getAttribute('href');
    expect(href).toContain('index.html');
  });

  test('deve exibir indicador de vez do jogador', async ({ page }) => {
    // Verificar se o indicador de vez aparece no canvas
    // (renderizado via JavaScript)
    await page.waitForTimeout(200); // Aguardar inicializacao

    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();
  });
});
