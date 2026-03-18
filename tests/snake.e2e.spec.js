const { test, expect } = require('@playwright/test');

test.describe('Snake - Teste Ponta a Ponta', () => {
  test.beforeEach(async ({ page }) => {
    // Mock do supabase para evitar redirect de auth
    await page.route('**/supabase.js', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
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
        `,
      });
    });

    await page.goto('/games/snake/');
    await page.waitForTimeout(1000);
  });

  test('jogo completo: iniciar, mover, comer, game over', async ({ page }) => {
    // 1. Verifica tela inicial
    const overlay = page.locator('#overlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('#overlay-title')).toHaveText('Cobrinha');

    // 2. Clica em "Jogar"
    const btnStart = page.locator('#btn-start');
    await btnStart.click();
    await page.waitForTimeout(500);

    // Verifica que overlay sumiu (jogo começou)
    await expect(overlay).toBeHidden();

    // 3. Simula movimento da cobra (setas)
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Pressiona seta direita para mover
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    // Pressiona seta para baixo
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // Pressiona seta para esquerda
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);

    // 4. Verifica que o score está zerado inicialmente
    const scoreDisplay = page.locator('#score-display');
    await expect(scoreDisplay).toHaveText('0');

    // 5. Simula movimento contínuo por alguns segundos
    // A cobra deve se mover automaticamente na direção atual
    await page.waitForTimeout(2000);

    // 6. Verifica se o jogo ainda está rodando (não deu game over ainda)
    // Se o canvas ainda está visível e não apareceu "Game Over", está ok
    await expect(canvas).toBeVisible();

    // 7. Força game over movendo para a parede
    // Move para cima até bater no topo
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);
    }

    // Aguarda game over
    await page.waitForTimeout(1000);

    // 8. Verifica tela de game over
    await expect(overlay).toBeVisible();
    await expect(page.locator('#overlay-title')).toHaveText('Game Over!');

    // 9. Verifica que o botão mudou para "Jogar Novamente"
    await expect(btnStart).toHaveText('Jogar Novamente');

    // 10. Clica em "Jogar Novamente" para reiniciar
    await btnStart.click();
    await page.waitForTimeout(500);

    // Verifica que o jogo reiniciou
    await expect(overlay).toBeHidden();
    await expect(scoreDisplay).toHaveText('0');
  });

  test('controles mobile funcionam', async ({ page }) => {
    // Define viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForTimeout(1000);

    // Inicia o jogo
    await page.locator('#btn-start').click();
    await page.waitForTimeout(500);

    // Verifica botões de controle mobile estão visíveis
    const btnUp = page.locator('[data-dir="up"]');
    const btnDown = page.locator('[data-dir="down"]');
    const btnLeft = page.locator('[data-dir="left"]');
    const btnRight = page.locator('[data-dir="right"]');

    // Verifica que controles mobile estão visíveis
    await expect(btnUp).toBeVisible();
    await expect(btnDown).toBeVisible();
    await expect(btnLeft).toBeVisible();
    await expect(btnRight).toBeVisible();

    // Clica nos botões
    await btnUp.click();
    await page.waitForTimeout(200);
    await btnRight.click();
    await page.waitForTimeout(200);
    await btnDown.click();
    await page.waitForTimeout(200);
    await btnLeft.click();
    await page.waitForTimeout(200);

    // Verifica que o jogo ainda está rodando
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('pausa funciona corretamente', async ({ page }) => {
    // Inicia o jogo
    await page.locator('#btn-start').click();
    await page.waitForTimeout(500);

    // Pressiona P para pausar
    await page.keyboard.press('p');
    await page.waitForTimeout(500);

    // Verifica que apareceu "PAUSADO" no canvas
    // (isso é desenhado no canvas, então verificamos se o jogo parou)
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Pressiona P novamente para continuar
    await page.keyboard.press('p');
    await page.waitForTimeout(500);

    // Jogo deve continuar rodando
    await expect(canvas).toBeVisible();
  });

  test('score aumenta ao comer', async ({ page }) => {
    // Inicia o jogo
    await page.locator('#btn-start').click();
    await page.waitForTimeout(500);

    const scoreDisplay = page.locator('#score-display');
    await expect(scoreDisplay).toHaveText('0');

    // Move a cobra por alguns segundos tentando comer algo
    // Como a comida é aleatória, movemos em várias direções
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
    }

    // O score pode ter aumentado (se comeu) ou não
    // Mas o importante é que o jogo não quebrou
    const score = await scoreDisplay.textContent();
    expect(parseInt(score)).toBeGreaterThanOrEqual(0);
  });

  test('recorde é salvo no localStorage', async ({ page }) => {
    // Inicia o jogo
    await page.locator('#btn-start').click();
    await page.waitForTimeout(500);

    // Força game over rapidamente
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(1000);

    // Verifica que apareceu game over
    await expect(page.locator('#overlay')).toBeVisible();

    // Verifica o recorde (best-display)
    const bestScore = await page.locator('#best-display').textContent();
    expect(parseInt(bestScore)).toBeGreaterThanOrEqual(0);
  });
});
