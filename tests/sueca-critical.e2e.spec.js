// =============================================
// Sueca - Testes E2E Críticos
// =============================================

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('🃏 Sueca - Testes Críticos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/games/sueca/index.html`);
    await page.waitForLoadState('networkidle');
  });

  test('carrega sem erros no console', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('exibe título e regras corretamente', async ({ page }) => {
    await expect(page.locator('#overlay h1')).toContainText('Sueca');
    await expect(page.locator('#overlay p')).toContainText('Jogo de cartas português');
  });

  test('botões de modo de jogo funcionam', async ({ page }) => {
    await expect(page.locator('#btn-single')).toBeVisible();
    await expect(page.locator('#btn-multi')).toBeVisible();

    await page.click('#btn-single');
    await expect(page.locator('#game-rules')).toBeVisible();
  });

  test('inicia jogo vs bots', async ({ page }) => {
    await page.click('#btn-single');
    await page.click('#btn-start');

    await expect(page.locator('#overlay')).toHaveClass(/hidden/);
    await expect(page.locator('#player-hand')).toBeVisible();
  });

  test('distribui 10 cartas para o jogador', async ({ page }) => {
    await page.click('#btn-single');
    await page.click('#btn-start');

    const cards = await page.locator('#player-hand .card').count();
    expect(cards).toBe(10);
  });

  test('mostra indicador de trunfo', async ({ page }) => {
    await page.click('#btn-single');
    await page.click('#btn-start');

    await expect(page.locator('#trump-indicator')).toBeVisible();
    await expect(page.locator('#trump-suit')).not.toBeEmpty();
  });

  test('SEO - meta tags presentes', async ({ page }) => {
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toContain('Sueca');

    const keywords = await page.locator('meta[name="keywords"]').getAttribute('content');
    expect(keywords).toContain('sueca');
  });

  test('responsivo em mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    await page.click('#btn-single');
    await page.click('#btn-start');
    await expect(page.locator('#player-hand')).toBeVisible();
  });
});
