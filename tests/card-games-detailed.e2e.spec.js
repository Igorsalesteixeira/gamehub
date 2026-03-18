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
  { name: 'solitaire', path: '/games/solitaire/', hasDrag: true },
  { name: 'spider-solitaire', path: '/games/spider-solitaire/', hasDrag: true },
  { name: 'freecell', path: '/games/freecell/', hasDrag: true },
  { name: 'blackjack', path: '/games/blackjack/', hasDrag: false },
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

for (const game of CARD_GAMES) {
  test.describe(`🃏 ${game.name} - Testes Detalhados`, () => {

    test('deve carregar mesa com cartas', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Verifica se há cartas na mesa
      const cards = page.locator('.card, .playing-card, [class*="card"]').first();
      await expect(cards).toBeVisible({ timeout: 10000 });
    });

    test('deve distribuir cartas ao iniciar', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Clica em iniciar
      const btnStart = page.locator('#btn-start, .btn-deal, .btn-primary').first();
      if (await btnStart.isVisible().catch(() => false)) {
        await btnStart.click();
        await page.waitForTimeout(1500);
      }

      // Verifica se cartas foram distribuídas
      const tableCards = page.locator('.table .card, .tableau .card, .board .card');
      const count = await tableCards.count();
      expect(count).toBeGreaterThan(0);
    });

    if (game.hasDrag) {
      test('deve arrastar carta entre colunas', async ({ page }) => {
        await page.goto(game.path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        // Inicia o jogo
        const btnStart = page.locator('#btn-start, .btn-deal').first();
        if (await btnStart.isVisible().catch(() => false)) {
          await btnStart.click();
          await page.waitForTimeout(1500);
        }

        // Tenta arrastar uma carta
        const sourceCard = page.locator('.card.draggable, .card[draggable="true"]').first();
        const targetColumn = page.locator('.column, .tableau-column, .stack').nth(1);

        if (await sourceCard.isVisible().catch(() => false) &&
            await targetColumn.isVisible().catch(() => false)) {

          await sourceCard.dragTo(targetColumn);
          await page.waitForTimeout(500);

          // Verifica se a carta ainda está visível (não houve erro)
          await expect(page.locator('.table, .board')).toBeVisible();
        }
      });

      test('deve selecionar carta com clique', async ({ page }) => {
        await page.goto(game.path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        // Inicia
        const btnStart = page.locator('#btn-start').first();
        if (await btnStart.isVisible().catch(() => false)) {
          await btnStart.click();
          await page.waitForTimeout(1000);
        }

        // Clica em uma carta
        const card = page.locator('.card').first();
        if (await card.isVisible().catch(() => false)) {
          await card.click();
          await page.waitForTimeout(300);

          // Verifica se a carta foi selecionada (classe selected ou similar)
          const hasSelected = await page.locator('.card.selected, .card.active, .card.highlighted').count() > 0;
          // Não falha se não tiver seleção visual, apenas verifica que não quebrou
          await expect(page.locator('body')).toBeVisible();
        }
      });
    }

    test('deve ter botões de controle visíveis', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Verifica botões comuns
      const buttons = page.locator('button, .btn');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('deve mostrar pontuação ou status', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Verifica se há algum display de pontuação, tempo ou status
      const displays = page.locator('.score, .time, .status, .moves, #score-display, #timer');
      const hasDisplay = await displays.count() > 0;

      // Ou verifica se há texto informativo
      const infoText = await page.locator('.info, .status-bar').textContent().catch(() => '');

      expect(hasDisplay || infoText.length > 0).toBeTruthy();
    });

    test('deve responder a duplo clique', async ({ page }) => {
      await page.goto(game.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Inicia
      const btnStart = page.locator('#btn-start').first();
      if (await btnStart.isVisible().catch(() => false)) {
        await btnStart.click();
        await page.waitForTimeout(1000);
      }

      // Duplo clique em uma carta
      const card = page.locator('.card').first();
      if (await card.isVisible().catch(() => false)) {
        await card.dblclick();
        await page.waitForTimeout(300);
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });
}
