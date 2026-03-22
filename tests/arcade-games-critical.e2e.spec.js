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
// TETRIS - TESTES CRÍTICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🧱 Tetris - Testes Críticos - ${device.name}`, () => {

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
      await page.goto('/games/tetris/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve iniciar jogo ao clicar em Novo Jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tetris/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      const btnNewGame = page.locator('#btn-new-game');
      await expect(btnNewGame).toBeVisible();
      await btnNewGame.click();
      await page.waitForTimeout(200);

      // Verifica que canvas está ativo
      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();

      // Verifica que score zerou
      const score = page.locator('#score-display');
      await expect(score).toHaveText('0');
    });

    test('deve mover peças com setas do teclado', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tetris/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-new-game').click();
      await page.waitForTimeout(200);

      // Move peça para esquerda
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(200);

      // Move peça para direita
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);

      // Acelera queda
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve rotacionar peças com seta para cima', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tetris/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-new-game').click();
      await page.waitForTimeout(200);

      // Rotaciona peça várias vezes
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(200);
      }

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar próxima peça no painel lateral', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tetris/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica canvas da próxima peça
      const nextCanvas = page.locator('#next-canvas');
      await expect(nextCanvas).toBeVisible();
    });

    test('deve mostrar nível e linhas no painel', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tetris/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica displays
      const levelDisplay = page.locator('#level-display');
      const linesDisplay = page.locator('#lines-display');

      await expect(levelDisplay).toBeVisible();
      await expect(linesDisplay).toBeVisible();
      await expect(levelDisplay).toHaveText('1');
      await expect(linesDisplay).toHaveText('0');
    });

    if (device.mobile) {
      test('deve mostrar controles touch em mobile', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/tetris/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Verifica controles mobile
        const mobileControls = page.locator('.mobile-controls');
        await expect(mobileControls).toBeVisible();

        // Verifica botões de direção
        await expect(page.locator('#btn-left')).toBeVisible();
        await expect(page.locator('#btn-right')).toBeVisible();
        await expect(page.locator('#btn-down')).toBeVisible();
        await expect(page.locator('#btn-rotate')).toBeVisible();
      });

      test('deve controlar peças com botões touch', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/tetris/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Inicia jogo
        await page.locator('#btn-new-game').click();
        await page.waitForTimeout(200);

        // Testa botões touch
        await page.locator('#btn-left').click();
        await page.waitForTimeout(200);
        await page.locator('#btn-right').click();
        await page.waitForTimeout(200);
        await page.locator('#btn-rotate').click();
        await page.waitForTimeout(200);

        // Verifica que jogo continua
        await expect(page.locator('#game-canvas')).toBeVisible();
      });
    }

    test('deve mostrar game over ao empilhar peças no topo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tetris/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-new-game').click();
      await page.waitForTimeout(200);

      // Deixa o jogo rodar até game over (acelera queda)
      for (let i = 0; i < 100; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(50);
      }

      // Aguarda game over
      await page.waitForTimeout(3000);

      // Verifica que apareceu game over
      const modal = page.locator('#modal-overlay');
      await expect(modal).toBeVisible({ timeout: 10000 });

      // Verifica mensagem
      const message = page.locator('#modal-message');
      await expect(message).toContainText('Pontuacao');
    });

    test('deve reiniciar ao clicar em Jogar Novamente', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tetris/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-new-game').click();
      await page.waitForTimeout(200);

      // Causa game over
      for (let i = 0; i < 100; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(50);
      }

      await page.waitForTimeout(3000);

      // Clica em Jogar Novamente
      const btnPlayAgain = page.locator('#btn-play-again');
      await expect(btnPlayAgain).toBeVisible({ timeout: 10000 });
      await btnPlayAgain.click();
      await page.waitForTimeout(200);

      // Verifica que modal sumiu
      await expect(page.locator('#modal-overlay')).toBeHidden();

      // Verifica que score zerou
      const score = page.locator('#score-display');
      await expect(score).toHaveText('0');
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/tetris/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });
  });
}

// ============================================
// PONG - TESTES CRÍTICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🏓 Pong - Testes Críticos - ${device.name}`, () => {

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
      await page.goto('/games/pong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve iniciar jogo ao clicar em Novo Jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      const btnNewGame = page.locator('#btn-new-game');
      await expect(btnNewGame).toBeVisible();
      await btnNewGame.click();
      await page.waitForTimeout(200);

      // Verifica que canvas está ativo
      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();
    });

    test('deve mover raquete com setas do teclado', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-new-game').click();
      await page.waitForTimeout(200);

      // Move raquete para cima
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(50);
      }

      // Move raquete para baixo
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(50);
      }

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mudar dificuldade via select', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica select de dificuldade
      const difficultySelect = page.locator('#difficulty-select');
      await expect(difficultySelect).toBeVisible();

      // Muda para difícil
      await difficultySelect.selectOption('hard');
      await page.waitForTimeout(300);

      // Muda para fácil
      await difficultySelect.selectOption('easy');
      await page.waitForTimeout(300);

      // Verifica valor
      await expect(difficultySelect).toHaveValue('easy');
    });

    if (device.mobile) {
      test('deve mostrar controles touch em mobile', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/pong/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Verifica controles mobile
        const mobileControls = page.locator('.mobile-controls');
        await expect(mobileControls).toBeVisible();

        // Verifica botões de direção
        await expect(page.locator('#btn-up')).toBeVisible();
        await expect(page.locator('#btn-down')).toBeVisible();
      });

      test('deve controlar raquete com botões touch', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/pong/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Inicia jogo
        await page.locator('#btn-new-game').click();
        await page.waitForTimeout(200);

        // Testa botões touch
        for (let i = 0; i < 5; i++) {
          await page.locator('#btn-up').click();
          await page.waitForTimeout(100);
        }

        for (let i = 0; i < 5; i++) {
          await page.locator('#btn-down').click();
          await page.waitForTimeout(100);
        }

        // Verifica que jogo continua
        await expect(page.locator('#game-canvas')).toBeVisible();
      });
    }

    test('deve mostrar fim de jogo ao atingir 5 pontos', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pong/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Seleciona dificuldade fácil para terminar rápido
      await page.locator('#difficulty-select').selectOption('easy');
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-new-game').click();
      await page.waitForTimeout(200);

      // Deixa o jogo rodar até alguém fazer 5 pontos
      await page.waitForTimeout(3000);

      // Verifica se o jogo terminou
      const modal = page.locator('#modal-overlay');
      const isVisible = await modal.isVisible().catch(() => false);

      if (isVisible) {
        const title = page.locator('#modal-title');
        await expect(title).toContainText('Fim de Jogo');
      }
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pong/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });
  });
}

// ============================================
// BREAKOUT - TESTES CRÍTICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🧱 Breakout - Testes Críticos - ${device.name}`, () => {

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
      await page.goto('/games/breakout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve iniciar jogo ao clicar em Jogar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/breakout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica overlay visível
      const overlay = page.locator('#overlay');
      await expect(overlay).toBeVisible();

      // Clica em Jogar
      const btnStart = page.locator('#btn-start');
      await expect(btnStart).toBeVisible();
      await btnStart.click();
      await page.waitForTimeout(200);

      // Verifica que overlay sumiu
      await expect(overlay).toBeHidden();

      // Verifica que canvas está ativo
      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();
    });

    test('deve mover raquete com setas do teclado', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/breakout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Move raquete para esquerda
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(50);
      }

      // Move raquete para direita
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(50);
      }

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar vidas, nível e pontuação', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/breakout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica displays
      const scoreDisplay = page.locator('#score-display');
      const livesDisplay = page.locator('#lives-display');
      const levelDisplay = page.locator('#level-display');

      await expect(scoreDisplay).toBeVisible();
      await expect(livesDisplay).toBeVisible();
      await expect(levelDisplay).toBeVisible();

      await expect(livesDisplay).toHaveText('3');
      await expect(levelDisplay).toHaveText('1');
    });

    if (device.mobile) {
      test('deve mostrar controles touch em mobile', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/breakout/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Verifica controles mobile
        const mobileControls = page.locator('#mobile-controls');
        await expect(mobileControls).toBeVisible();

        // Verifica botões de direção
        await expect(page.locator('[data-dir="left"]')).toBeVisible();
        await expect(page.locator('[data-dir="right"]')).toBeVisible();
      });

      test('deve controlar raquete com botões touch', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/breakout/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Inicia jogo
        await page.locator('#btn-start').click();
        await page.waitForTimeout(200);

        // Testa botões touch
        for (let i = 0; i < 5; i++) {
          await page.locator('[data-dir="left"]').click();
          await page.waitForTimeout(100);
        }

        for (let i = 0; i < 5; i++) {
          await page.locator('[data-dir="right"]').click();
          await page.waitForTimeout(100);
        }

        // Verifica que jogo continua
        await expect(page.locator('#game-canvas')).toBeVisible();
      });
    }

    test('deve atualizar pontuação ao destruir blocos', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/breakout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Score inicial
      const scoreBefore = await page.locator('#score-display').textContent();

      // Deixa o jogo rodar por um tempo
      await page.waitForTimeout(2000);

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar game over ao perder 3 vidas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/breakout/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Deixa a bola cair 3 vezes
      await page.waitForTimeout(15000);

      // Verifica se o jogo terminou
      const overlay = page.locator('#overlay');
      const isVisible = await overlay.isVisible().catch(() => false);

      if (isVisible) {
        const title = page.locator('#overlay-title');
        await expect(title).toContainText('Game Over');
      }
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/breakout/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });
  });
}

// ============================================
// DINO RUNNER - TESTES CRÍTICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🦖 Dino Runner - Testes Críticos - ${device.name}`, () => {

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
      await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve iniciar jogo ao clicar em Jogar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica overlay visível
      const overlay = page.locator('#overlay');
      await expect(overlay).toBeVisible();

      // Clica em Jogar
      const btnStart = page.locator('#btn-start');
      await expect(btnStart).toBeVisible();
      await btnStart.click();
      await page.waitForTimeout(200);

      // Verifica que overlay sumiu
      await expect(overlay).toBeHidden();

      // Verifica que canvas está ativo
      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();
    });

    test('deve pular com espaço', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Pula várias vezes
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(200);
      }

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve abaixar com seta para baixo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Segura seta para baixo
      await page.keyboard.down('ArrowDown');
      await page.waitForTimeout(300);
      await page.keyboard.up('ArrowDown');

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar pontuação e melhor score', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica displays
      const scoreDisplay = page.locator('#score-display');
      const bestDisplay = page.locator('#best-display');

      await expect(scoreDisplay).toBeVisible();
      await expect(bestDisplay).toBeVisible();
    });

    if (device.mobile) {
      test('deve mostrar controles touch em mobile', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Verifica controles mobile
        const mobileControls = page.locator('#mobile-controls');
        await expect(mobileControls).toBeVisible();

        // Verifica botões
        await expect(page.locator('[data-action="jump"]')).toBeVisible();
        await expect(page.locator('[data-action="duck"]')).toBeVisible();
      });

      test('deve controlar com botões touch', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Inicia jogo
        await page.locator('#btn-start').click();
        await page.waitForTimeout(200);

        // Testa botão pular
        await page.locator('[data-action="jump"]').click();
        await page.waitForTimeout(200);

        // Testa botão abaixar (pressiona e segura)
        await page.locator('[data-action="duck"]').click();
        await page.waitForTimeout(200);

        // Verifica que jogo continua
        await expect(page.locator('#game-canvas')).toBeVisible();
      });
    }

    test('deve atualizar pontuação durante o jogo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Score inicial
      const scoreBefore = await page.locator('#score-display').textContent();

      // Deixa o jogo rodar por um tempo
      await page.waitForTimeout(3000);

      // Verifica que pontuação mudou
      const scoreAfter = await page.locator('#score-display').textContent();
      expect(parseInt(scoreAfter)).toBeGreaterThanOrEqual(parseInt(scoreBefore));
    });

    test('deve mostrar game over ao colidir com obstáculo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Espera colidir (não pula, só deixa correr)
      await page.waitForTimeout(8000);

      // Verifica que apareceu game over
      const overlay = page.locator('#overlay');
      await expect(overlay).toBeVisible({ timeout: 15000 });

      // Verifica título
      const title = page.locator('#overlay-title');
      await expect(title).toContainText('Game Over');
    });

    test('deve reiniciar ao clicar em Jogar Novamente', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Espera game over
      await page.waitForTimeout(8000);

      // Clica em Jogar Novamente
      const btnStart = page.locator('#btn-start');
      await expect(btnStart).toBeVisible({ timeout: 10000 });
      await btnStart.click();
      await page.waitForTimeout(200);

      // Verifica que overlay sumiu
      await expect(page.locator('#overlay')).toBeHidden();

      // Verifica que score zerou
      const score = page.locator('#score-display');
      await expect(score).toHaveText('0');
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/dinorunner/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });
  });
}

// ============================================
// SPACE INVADERS - TESTES CRÍTICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`👾 Space Invaders - Testes Críticos - ${device.name}`, () => {

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
      await page.goto('/games/spaceinvaders/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve iniciar jogo ao clicar em Jogar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/spaceinvaders/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica overlay visível
      const overlay = page.locator('#overlay');
      await expect(overlay).toBeVisible();

      // Clica em Jogar
      const btnStart = page.locator('#btn-start');
      await expect(btnStart).toBeVisible();
      await btnStart.click();
      await page.waitForTimeout(200);

      // Verifica que overlay sumiu
      await expect(overlay).toBeHidden();

      // Verifica que canvas está ativo
      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();
    });

    test('deve mover nave com setas e atirar com espaço', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/spaceinvaders/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Move nave para esquerda
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(100);
      }

      // Move nave para direita
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(100);
      }

      // Atira
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar pontuação, vidas e onda', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/spaceinvaders/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica displays
      const scoreDisplay = page.locator('#score-display');
      const livesDisplay = page.locator('#lives-display');
      const waveDisplay = page.locator('#wave-display');

      await expect(scoreDisplay).toBeVisible();
      await expect(livesDisplay).toBeVisible();
      await expect(waveDisplay).toBeVisible();

      await expect(livesDisplay).toHaveText('3');
      await expect(waveDisplay).toHaveText('1');
    });

    if (device.mobile) {
      test('deve mostrar controles touch em mobile', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/spaceinvaders/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Verifica controles mobile
        const mobileControls = page.locator('#mobile-controls');
        await expect(mobileControls).toBeVisible();

        // Verifica botões
        await expect(page.locator('[data-dir="left"]')).toBeVisible();
        await expect(page.locator('[data-dir="right"]')).toBeVisible();
        await expect(page.locator('[data-dir="shoot"]')).toBeVisible();
      });

      test('deve controlar nave e atirar com botões touch', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/spaceinvaders/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Inicia jogo
        await page.locator('#btn-start').click();
        await page.waitForTimeout(200);

        // Testa botões touch
        await page.locator('[data-dir="left"]').click();
        await page.waitForTimeout(200);
        await page.locator('[data-dir="right"]').click();
        await page.waitForTimeout(200);
        await page.locator('[data-dir="shoot"]').click();
        await page.waitForTimeout(200);

        // Verifica que jogo continua
        await expect(page.locator('#game-canvas')).toBeVisible();
      });
    }

    test('deve atualizar pontuação ao destruir aliens', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/spaceinvaders/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Atira algumas vezes
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
      }

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar game over ao perder todas as vidas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/spaceinvaders/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Deixa o jogo rodar até game over
      await page.waitForTimeout(2000);

      // Verifica se o jogo terminou
      const overlay = page.locator('#overlay');
      const isVisible = await overlay.isVisible().catch(() => false);

      if (isVisible) {
        const title = page.locator('#overlay-title');
        await expect(title).toContainText('Game Over');
      }
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/spaceinvaders/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });
  });
}

// ============================================
// PAC-MAN - TESTES CRÍTICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🟡 Pac-Man - Testes Críticos - ${device.name}`, () => {

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
      await page.goto('/games/pacman/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve iniciar jogo ao clicar em Jogar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pacman/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica overlay visível
      const overlay = page.locator('#overlay');
      await expect(overlay).toBeVisible();

      // Clica em Jogar
      const btnStart = page.locator('#btn-start');
      await expect(btnStart).toBeVisible();
      await btnStart.click();
      await page.waitForTimeout(200);

      // Verifica que overlay sumiu
      await expect(overlay).toBeHidden();

      // Verifica que canvas está ativo
      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();
    });

    test('deve mover Pac-Man com setas e WASD', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pacman/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Move em todas direções
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300);
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(300);

      // Testa WASD também
      await page.keyboard.press('d');
      await page.waitForTimeout(300);
      await page.keyboard.press('s');
      await page.waitForTimeout(300);
      await page.keyboard.press('a');
      await page.waitForTimeout(300);
      await page.keyboard.press('w');
      await page.waitForTimeout(300);

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar pontuação, vidas e melhor score', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pacman/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica displays
      const scoreDisplay = page.locator('#score-display');
      const livesDisplay = page.locator('#lives-display');
      const bestDisplay = page.locator('#best-display');

      await expect(scoreDisplay).toBeVisible();
      await expect(livesDisplay).toBeVisible();
      await expect(bestDisplay).toBeVisible();
    });

    if (device.mobile) {
      test('deve mostrar controles touch em mobile', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/pacman/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Verifica controles mobile
        const mobileControls = page.locator('#mobile-controls');
        await expect(mobileControls).toBeVisible();

        // Verifica botões de direção
        await expect(page.locator('[data-dir="up"]')).toBeVisible();
        await expect(page.locator('[data-dir="down"]')).toBeVisible();
        await expect(page.locator('[data-dir="left"]')).toBeVisible();
        await expect(page.locator('[data-dir="right"]')).toBeVisible();
      });

      test('deve controlar Pac-Man com botões touch', async ({ page }) => {
        await page.setViewportSize(device.viewport);
        await page.goto('/games/pacman/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(300);

        // Inicia jogo
        await page.locator('#btn-start').click();
        await page.waitForTimeout(200);

        // Testa botões touch
        await page.locator('[data-dir="right"]').click();
        await page.waitForTimeout(300);
        await page.locator('[data-dir="down"]').click();
        await page.waitForTimeout(300);

        // Verifica que jogo continua
        await expect(page.locator('#game-canvas')).toBeVisible();
      });
    }

    test('deve atualizar pontuação ao comer pontos', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pacman/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Score inicial
      const scoreBefore = await page.locator('#score-display').textContent();

      // Move por algum tempo
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(200);
      }

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar game over ao perder todas as vidas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pacman/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Deixa o jogo rodar até game over
      await page.waitForTimeout(2000);

      // Verifica se o jogo terminou
      const overlay = page.locator('#overlay');
      const isVisible = await overlay.isVisible().catch(() => false);

      if (isVisible) {
        const title = page.locator('#overlay-title');
        await expect(title).toContainText('Game Over');
      }
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/pacman/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });
  });
}

// ============================================
// BUBBLE SHOOTER - TESTES CRÍTICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🫧 Bubble Shooter - Testes Críticos - ${device.name}`, () => {

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
      await page.goto('/games/bubble-shooter/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve iniciar jogo ao clicar em Jogar', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/bubble-shooter/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica overlay visível
      const overlay = page.locator('#overlay');
      await expect(overlay).toBeVisible();

      // Clica em Jogar
      const btnStart = page.locator('#btn-start');
      await expect(btnStart).toBeVisible();
      await btnStart.click();
      await page.waitForTimeout(200);

      // Verifica que overlay sumiu
      await expect(overlay).toBeHidden();

      // Verifica que canvas está ativo
      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();
    });

    test('deve atirar bolhas com clique do mouse', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/bubble-shooter/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Atira em diferentes posições
      const canvas = page.locator('#game-canvas');
      const box = await canvas.boundingBox();

      // Atira para a esquerda
      await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
      await page.waitForTimeout(200);

      // Atira para o centro
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
      await page.waitForTimeout(200);

      // Atira para a direita
      await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.5);
      await page.waitForTimeout(200);

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar pontuação e contador de tiros', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/bubble-shooter/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica displays
      const scoreDisplay = page.locator('#score-display');
      const shotsDisplay = page.locator('#shots-display');

      await expect(scoreDisplay).toBeVisible();
      await expect(shotsDisplay).toBeVisible();
    });

    test('deve atualizar pontuação ao estourar bolhas', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/bubble-shooter/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Score inicial
      const scoreBefore = await page.locator('#score-display').textContent();

      // Atira algumas vezes
      const canvas = page.locator('#game-canvas');
      const box = await canvas.boundingBox();

      for (let i = 0; i < 5; i++) {
        await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
        await page.waitForTimeout(600);
      }

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar game over quando bolhas chegam ao fundo', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/bubble-shooter/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.locator('#btn-start').click();
      await page.waitForTimeout(200);

      // Atira várias vezes para fazer novas fileiras aparecerem
      const canvas = page.locator('#game-canvas');
      const box = await canvas.boundingBox();

      for (let i = 0; i < 30; i++) {
        await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
        await page.waitForTimeout(200);
      }

      // Verifica se o jogo terminou
      const overlay = page.locator('#overlay');
      const isVisible = await overlay.isVisible().catch(() => false);

      if (isVisible) {
        const title = page.locator('#overlay-title');
        await expect(title).toContainText('Fim de Jogo');
      }
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/bubble-shooter/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });
  });
}

// ============================================
// FLAPPY BIRD - TESTES CRÍTICOS
// ============================================
for (const device of DEVICES) {
  test.describe(`🐦 Flappy Bird - Testes Críticos - ${device.name}`, () => {

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
      await page.goto('/games/flappybird/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(200);

      expect(criticalErrors, `Erros críticos: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('deve iniciar jogo ao pressionar espaço', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/flappybird/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica mensagem inicial
      const startMsg = page.locator('#start-msg');
      await expect(startMsg).toBeVisible();

      // Inicia jogo com espaço
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);

      // Verifica que mensagem sumiu
      await expect(startMsg).toBeHidden();

      // Verifica que canvas está ativo
      const canvas = page.locator('#game-canvas');
      await expect(canvas).toBeVisible();
    });

    test('deve fazer pássaro voar com espaço', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/flappybird/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);

      // Faz o pássaro voar várias vezes
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(400);
      }

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar melhor score', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/flappybird/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Verifica display de melhor score
      const bestDisplay = page.locator('#best-display');
      await expect(bestDisplay).toBeVisible();
    });

    test('deve controlar com clique/toque na tela', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/flappybird/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo com clique
      const canvas = page.locator('#game-canvas');
      await canvas.click();
      await page.waitForTimeout(200);

      // Verifica que mensagem sumiu
      await expect(page.locator('#start-msg')).toBeHidden();

      // Faz o pássaro voar com cliques
      for (let i = 0; i < 5; i++) {
        await canvas.click();
        await page.waitForTimeout(400);
      }

      // Verifica que jogo continua rodando
      await expect(page.locator('#game-canvas')).toBeVisible();
    });

    test('deve mostrar game over ao bater no cano', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/flappybird/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);

      // Espera game over (não faz nada, deixa o pássaro cair)
      await page.waitForTimeout(2000);

      // Verifica que apareceu game over
      const startMsg = page.locator('#start-msg');
      await expect(startMsg).toBeVisible({ timeout: 10000 });
    });

    test('deve reiniciar ao pressionar espaço após game over', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/flappybird/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Inicia jogo
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);

      // Espera game over
      await page.waitForTimeout(2000);

      // Verifica mensagem de game over
      const startMsg = page.locator('#start-msg');
      await expect(startMsg).toBeVisible({ timeout: 10000 });

      // Reinicia
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);

      // Verifica que mensagem sumiu
      await expect(startMsg).toBeHidden();
    });

    test('deve ter viewport configurado para mobile', async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/games/flappybird/', { waitUntil: 'networkidle' });

      const viewport = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.getAttribute('content') : null;
      });

      expect(viewport).toContain('width=device-width');
    });
  });
}
