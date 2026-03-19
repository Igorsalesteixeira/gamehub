/**
 * Módulo de Timer de Jogo
 *
 * Timer preciso com suporte a pause/resume,
 * formatação de tempo e callbacks.
 *
 * @module timer
 */

/**
 * Timer de jogo com controle de pausa e callbacks.
 * @class GameTimer
 */
export class GameTimer {
  /**
   * Cria uma instância de GameTimer.
   *
   * @param {Object} options - Opções de configuração
   * @param {boolean} [options.autoStart=false] - Inicia automaticamente
   * @param {number} [options.startTime=0] - Tempo inicial em segundos
   * @param {number} [options.maxTime=Infinity] - Tempo máximo em segundos
   * @param {Function} [options.onTick] - Callback a cada segundo
   * @param {Function} [options.onMaxTime] - Callback quando atinge tempo máximo
   * @param {Function} [options.onPause] - Callback ao pausar
   * @param {Function} [options.onResume] - Callback ao resumir
   */
  constructor(options = {}) {
    this.options = {
      autoStart: false,
      startTime: 0,
      maxTime: Infinity,
      onTick: null,
      onMaxTime: null,
      onPause: null,
      onResume: null,
      ...options
    };

    this._elapsed = this.options.startTime * 1000; // em ms
    this._startTimestamp = null;
    this._running = false;
    this._paused = false;
    this._intervalId = null;
    this._tickInterval = 100; // atualiza a cada 100ms para precisão

    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * Inicia o timer.
   *
   * @returns {GameTimer} this (chainable)
   */
  start() {
    if (this._running) return this;

    this._startTimestamp = performance.now() - this._elapsed;
    this._running = true;
    this._paused = false;

    this._intervalId = setInterval(() => this._tick(), this._tickInterval);

    return this;
  }

  /**
   * Pausa o timer.
   *
   * @returns {GameTimer} this (chainable)
   */
  pause() {
    if (!this._running || this._paused) return this;

    this._elapsed = performance.now() - this._startTimestamp;
    this._paused = true;

    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }

    if (this.options.onPause) {
      try {
        this.options.onPause(this.getTime());
      } catch (e) {
        console.error('[GameTimer] Erro no callback onPause:', e);
      }
    }

    return this;
  }

  /**
   * Resume o timer após pausa.
   *
   * @returns {GameTimer} this (chainable)
   */
  resume() {
    if (!this._paused) return this;

    this._startTimestamp = performance.now() - this._elapsed;
    this._paused = false;

    this._intervalId = setInterval(() => this._tick(), this._tickInterval);

    if (this.options.onResume) {
      try {
        this.options.onResume(this.getTime());
      } catch (e) {
        console.error('[GameTimer] Erro no callback onResume:', e);
      }
    }

    return this;
  }

  /**
   * Alterna entre play/pause.
   *
   * @returns {GameTimer} this (chainable)
   */
  toggle() {
    if (this._paused || !this._running) {
      return this._running ? this.resume() : this.start();
    }
    return this.pause();
  }

  /**
   * Para o timer e reseta.
   *
   * @param {boolean} [keepTime=false] - Mantém o tempo atual ao invés de resetar
   * @returns {GameTimer} this (chainable)
   */
  stop(keepTime = false) {
    this._running = false;
    this._paused = false;

    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }

    if (!keepTime) {
      this._elapsed = 0;
      this._startTimestamp = null;
    }

    return this;
  }

  /**
   * Reseta o timer para zero.
   *
   * @param {boolean} [autoStart=false] - Reinicia automaticamente
   * @returns {GameTimer} this (chainable)
   */
  reset(autoStart = false) {
    this.stop();
    this._elapsed = 0;

    if (autoStart) {
      this.start();
    }

    return this;
  }

  /**
   * Define o tempo atual.
   *
   * @param {number} seconds - Tempo em segundos
   * @returns {GameTimer} this (chainable)
   */
  setTime(seconds) {
    this._elapsed = Math.max(0, seconds * 1000);

    if (this._running && !this._paused) {
      this._startTimestamp = performance.now() - this._elapsed;
    }

    return this;
  }

  /**
   * Adiciona tempo ao timer.
   *
   * @param {number} seconds - Segundos a adicionar (negativo para subtrair)
   * @returns {GameTimer} this (chainable)
   */
  addTime(seconds) {
    this._elapsed = Math.max(0, this._elapsed + seconds * 1000);

    if (this._running && !this._paused) {
      this._startTimestamp = performance.now() - this._elapsed;
    }

    return this;
  }

  /**
   * Retorna o tempo atual em segundos.
   *
   * @returns {number} Tempo em segundos
   */
  getTime() {
    if (this._running && !this._paused) {
      return Math.floor((performance.now() - this._startTimestamp) / 1000);
    }
    return Math.floor(this._elapsed / 1000);
  }

  /**
   * Retorna o tempo preciso em milissegundos.
   *
   * @returns {number} Tempo em ms
   */
  getTimeMs() {
    if (this._running && !this._paused) {
      return performance.now() - this._startTimestamp;
    }
    return this._elapsed;
  }

  /**
   * Formata o tempo como string.
   *
   * @param {string} [format='MM:SS'] - Formato: 'MM:SS', 'HH:MM:SS', 'MS' (milissegundos)
   * @returns {string} Tempo formatado
   *
   * @example
   * timer.getFormatted(); // "05:23"
   * timer.getFormatted('HH:MM:SS'); // "01:05:23"
   */
  getFormatted(format = 'MM:SS') {
    const totalSeconds = this.getTime();
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor(this.getTimeMs() % 1000);

    const pad = (n, len = 2) => String(n).padStart(len, '0');

    switch (format) {
      case 'HH:MM:SS':
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      case 'MM:SS':
        return `${pad(minutes)}:${pad(seconds)}`;
      case 'SS':
        return pad(seconds);
      case 'MS':
        return `${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`;
      case 'RAW':
        return String(totalSeconds);
      default:
        return `${pad(minutes)}:${pad(seconds)}`;
    }
  }

  /**
   * Verifica se o timer está rodando.
   * @returns {boolean}
   */
  isRunning() {
    return this._running && !this._paused;
  }

  /**
   * Verifica se o timer está pausado.
   * @returns {boolean}
   */
  isPaused() {
    return this._paused;
  }

  /**
   * Callback interno de tick.
   * @private
   */
  _tick() {
    const currentTime = this.getTime();

    if (this.options.onTick) {
      try {
        this.options.onTick(currentTime, this.getFormatted());
      } catch (e) {
        console.error('[GameTimer] Erro no callback onTick:', e);
      }
    }

    if (currentTime >= this.options.maxTime) {
      this.pause();
      if (this.options.onMaxTime) {
        try {
          this.options.onMaxTime(currentTime);
        } catch (e) {
          console.error('[GameTimer] Erro no callback onMaxTime:', e);
        }
      }
    }
  }

  /**
   * Serializa o estado do timer.
   *
   * @returns {Object} Estado serializado
   */
  serialize() {
    return {
      elapsed: this._elapsed,
      running: this._running,
      paused: this._paused,
      timestamp: Date.now()
    };
  }

  /**
   * Restaura o timer de um estado serializado.
   *
   * @param {Object} state - Estado retornado por serialize()
   * @param {boolean} [autoResume=true] - Resume se estava rodando
   * @returns {GameTimer} this (chainable)
   */
  deserialize(state, autoResume = true) {
    this.stop();

    this._elapsed = state.elapsed || 0;
    this._running = state.running || false;
    this._paused = state.paused || false;

    if (this._running && autoResume) {
      if (this._paused) {
        // Mantém pausado
      } else {
        this._startTimestamp = performance.now() - this._elapsed;
        this._intervalId = setInterval(() => this._tick(), this._tickInterval);
      }
    }

    return this;
  }

  /**
   * Destrói o timer, limpando recursos.
   */
  destroy() {
    this.stop();
  }
}

/**
 * Cria um timer de contagem regressiva.
 *
 * @param {number} seconds - Segundos para contagem
 * @param {Object} options - Opções adicionais
 * @returns {GameTimer} Timer configurado
 *
 * @example
 * const countdown = createCountdown(60, {
 *   onTick: (t) => console.log(t),
 *   onMaxTime: () => console.log('Tempo esgotado!')
 * });
 * countdown.start();
 */
export function createCountdown(seconds, options = {}) {
  return new GameTimer({
    startTime: 0,
    maxTime: seconds,
    ...options
  });
}

/**
 * Formata segundos como string de tempo.
 *
 * @param {number} seconds - Segundos
 * @param {string} [format='MM:SS'] - Formato desejado
 * @returns {string} Tempo formatado
 */
export function formatTime(seconds, format = 'MM:SS') {
  const timer = new GameTimer({ startTime: seconds });
  return timer.getFormatted(format);
}
