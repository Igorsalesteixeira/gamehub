# E2E Testing for Games

> Padrões para testes E2E com Playwright em jogos canvas

## Mock Supabase

```javascript
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

test.beforeEach(async ({ page }) => {
  await page.route('**/supabase.js', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: mockSupabaseCode,
    });
  });
});
```

## Viewport Testing

```javascript
const DEVICES = [
  { name: 'Desktop', viewport: { width: 1280, height: 720 } },
  { name: 'iPhone 12', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'Pixel 5', viewport: { width: 393, height: 851 }, mobile: true },
];

for (const device of DEVICES) {
  test.describe(`${device.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(device.viewport);
    });
  });
}
```

## Canvas Assertions

```javascript
// Canvas está visível
await expect(page.locator('#game-canvas')).toBeVisible();

// Screenshot comparison (com tolerância)
expect(await page.screenshot()).toMatchSnapshot('game-board.png', {
  threshold: 0.2
});
```

## Input Testing

```javascript
// Keyboard
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);

// Touch (mobile)
await page.locator('[data-dir="right"]').tap();

// Drag (card games)
await page.locator('.card').first().dragTo(
  page.locator('.column').nth(1)
);
```

## Error Monitoring

```javascript
test('deve carregar sem erros', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignorar erros conhecidos do Chrome
      if (!text.includes('Blocked call to navigator.vibrate') &&
          !text.includes('favicon')) {
        errors.push(text);
      }
    }
  });

  await page.goto('/games/snake/');
  expect(errors).toHaveLength(0);
});
```

## Game State Testing

```javascript
// Verificar localStorage
test('deve salvar high score', async ({ page }) => {
  await page.goto('/games/snake/');
  // ... jogar ...
  const bestScore = await page.evaluate(() => {
    return localStorage.getItem('snake_best');
  });
  expect(bestScore).not.toBeNull();
});
```

## Testes Críticos por Tipo

### Arcade
- [ ] Iniciar jogo
- [ ] Mover com teclas/setas
- [ ] Pausar com P
- [ ] Game over e restart

### Card Games
- [ ] Drag and drop cartas
- [ ] Duplo clique para foundation
- [ ] Clique no monte

### Multiplayer
- [ ] Conectar à sala
- [ ] Movimento sincroniza
- [ ] Desconexão/reconexão
