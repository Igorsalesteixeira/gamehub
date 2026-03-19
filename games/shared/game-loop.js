/**
 * Módulo de Game Loop
 *
 * Implementação eficiente de game loop usando requestAnimationFrame
 * com controle de delta time, pause/resume e FPS configurável.
 *
 * @module game-loop
 */

/**
 * Game loop profissional com controle de FPS e delta time.
 * @class GameLoop
 */
export class GameLoop {
  /**
   * Cria uma instância de GameLoop.
   *
   * @param {Object} options - Opções de configuração
   * @param {Function} options.update - Função de update (recebe deltaTime em ms)
   * @param {Function} options.render - Função de render (opcional)
   * @param {number} [options.fps=60] - FPS alvo (30, 60, 120)
   * @param {boolean} [options.autoStart=false] - Inicia automaticamente
   * @param {boolean} [options.pauseOnBlur=true] - Pausa quando aba perde foco
   * @param {number} [options.maxDelta=100] - Delta máximo em ms (evita saltos)
   */
  constructor(options) {
    if (!options?.update || typeof options.update !== 'function') {
      throw new Error('[GameLoop] update function é obrigatória');
    }

    this.options = {
      update: options.update,
      render: options.render || null,
      fps: options.fps || 60,
      autoStart: options.autoStart ?? false,
      pauseOnBlur: options.pauseOnBlur ?? true,
      maxDelta: options.maxDelta || 100,
      onPause: options.onPause || null,
      onResume: options.onResume || null
    };

    this._running = false;
    this._paused = false;
    this._rafId = null;
    this._lastTime = 0;
    this._accumulatedTime = 0;
    this._frameCount = 0;
    this._fpsTime = 0;
    this._currentFps = 0;

    // Calcula intervalo de frame baseado no FPS alvo
    this._frameInterval = 1000 / this.options.fps;

    // Bind para manter contexto
    this._loop = this._loop.bind(this);
    this._handleVisibility = this._handleVisibility.bind(this);

    if (this.options.pauseOnBlur) {
      document.addEventListener('visibilitychange', this._handleVisibility);
    }

    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * Inicia o game loop.
   *
   * @returns {GameLoop} this (chainable)
   */
  start() {
    if (this._running) return this;

    this._running = true;
    this._paused = false;
    this._lastTime = performance.now();
    this._accumulatedTime = 0;
    this._frameCount = 0;
    this._fpsTime = 0;

    this._rafId = requestAnimationFrame(this._loop);

    return this;
  }

  /**
   * Pausa o game loop.
   *
   * @returns {GameLoop} this (chainable)
   */
  pause() {
    if (!this._running || this._paused) return this;

    this._paused = true;

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    if (this.options.onPause) {
      try {
        this.options.onPause();
      } catch (e) {
        console.error('[GameLoop] Erro no callback onPause:', e);
      }
    }

    return this;
  }

  /**
   * Resume o game loop.
   *
   * @returns {GameLoop} this (chainable)
   */
  resume() {
    if (!this._paused) return this;

    this._paused = false;
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._loop);

    if (this.options.onResume) {
      try {
        this.options.onResume();
      } catch (e) {
        console.error('[GameLoop] Erro no callback onResume:', e);
      }
    }

    return this;
  }

  /**
   * Alterna entre play/pause.
   *
   * @returns {GameLoop} this (chainable)
   */
  toggle() {
    return this._paused ? this.resume() : this.pause();
  }

  /**
   * Para o game loop completamente.
   *
   * @returns {GameLoop} this (chainable)
   */
  stop() {
    this._running = false;
    this._paused = false;

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    return this;
  }

  /**
   * Loop principal.
   * @private
   * @param {number} currentTime - Timestamp atual
   */
  _loop(currentTime) {
    if (!this._running) return;

    // Calcula delta time
    let deltaTime = currentTime - this._lastTime;
    this._lastTime = currentTime;

    // Limita delta para evitar saltos grandes (ex: aba inativa)
    deltaTime = Math.min(deltaTime, this.options.maxDelta);

    // Acumula tempo para update fixo
    this._accumulatedTime += deltaTime;

    // Update com timestep fixo
    while (this._accumulatedTime >= this._frameInterval) {
      try {
        this.options.update(this._frameInterval);
      } catch (e) {
        console.error('[GameLoop] Erro no update:', e);
        this.stop();
        return;
      }
      this._accumulatedTime -= this._frameInterval;
    }

    // Render (se houver)
    if (this.options.render) {
      try {
        this.options.render(deltaTime);
      } catch (e) {
        console.error('[GameLoop] Erro no render:', e);
      }
    }

    // Calcula FPS
    this._frameCount++;
    this._fpsTime += deltaTime;
    if (this._fpsTime >= 1000) {
      this._currentFps = this._frameCount;
      this._frameCount = 0;
      this._fpsTime = 0;
    }

    // Agenda próximo frame
    this._rafId = requestAnimationFrame(this._loop);
  }

  /**
   * Handler de visibilidade da página.
   * @private
   */
  _handleVisibility() {
    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  }

  /**
   * Retorna o FPS atual.
   * @returns {number} FPS
   */
  getFps() {
    return this._currentFps;
  }

  /**
   * Verifica se o loop está rodando.
   * @returns {boolean}
   */
  isRunning() {
    return this._running && !this._paused;
  }

  /**
   * Verifica se o loop está pausado.
   * @returns {boolean}
   */
  isPaused() {
    return this._paused;
  }

  /**
   * Altera o FPS alvo.
   *
   * @param {number} fps - Novo FPS (30, 60, 120)
   * @returns {GameLoop} this (chainable)
   */
  setFps(fps) {
    this.options.fps = fps;
    this._frameInterval = 1000 / fps;
    return this;
  }

  /**
   * Executa um único frame (útil para debug).
   *
   * @param {number} [deltaTime=16.67] - Delta time em ms
   * @returns {GameLoop} this (chainable)
   */
  step(deltaTime = 16.67) {
    if (this.options.update) {
      this.options.update(deltaTime);
    }
    if (this.options.render) {
      this.options.render(deltaTime);
    }
    return this;
  }

  /**
   * Destrói o game loop, limpando recursos.
   */
  destroy() {
    this.stop();

    if (this.options.pauseOnBlur) {
      document.removeEventListener('visibilitychange', this._handleVisibility);
    }
  }
}

/**
 * Cria um game loop simples.
 *
 * @param {Function} update - Função de update
 * @param {Object} options - Opções adicionais
 * @returns {GameLoop} Instância do game loop
 *
 * @example
 * const loop = createLoop((dt) => {
 *   player.x += player.vx * dt;
 * });
 * loop.start();
 */
export function createLoop(update, options = {}) {
  return new GameLoop({
    update,
    ...options
  });
}

/**
 * Cria um loop de animação (apenas render, sem update fixo).
 *
 * @param {Function} render - Função de render
 * @param {Object} options - Opções adicionais
 * @returns {GameLoop} Instância do game loop
 */
export function createAnimation(render, options = {}) {
  return new GameLoop({
    update: () => {}, // noop
    render,
    fps: 60,
    ...options
  });
}
