/**
 * Gerenciador de Áudio
 *
 * Sistema de gerenciamento de sons usando Web Audio API
 * com suporte para sons gerados proceduralmente.
 *
 * @module skills/sound-manager
 * @example
 * import { SoundManager } from '../shared/skills/sound-manager/index.js';
 *
 * const sounds = new SoundManager();
 * await sounds.init();
 *
 * sounds.play('win');
 * sounds.setVolume(0.5);
 * sounds.mute();
 */

/**
 * Configurações predefinidas de sons.
 * @private
 */
const SOUND_PRESETS = {
  win: {
    oscillator: {
      type: 'sine',
      frequencies: [523.25, 659.25, 783.99, 1046.5],
      timing: [0, 0.1, 0.2, 0.3],
      duration: 0.5
    },
    envelope: {
      attack: 0.05,
      decay: 0.4,
      sustain: 0.3,
      release: 0.1
    },
    gain: 0.3
  },

  move: {
    oscillator: {
      type: 'triangle',
      frequency: 300,
      duration: 0.1
    },
    envelope: {
      attack: 0.01,
      decay: 0.05,
      sustain: 0,
      release: 0.02
    },
    gain: 0.1,
    slide: { from: 300, to: 400 }
  },

  error: {
    oscillator: {
      type: 'sawtooth',
      frequency: 150,
      duration: 0.3
    },
    envelope: {
      attack: 0.02,
      decay: 0.2,
      sustain: 0.1,
      release: 0.1
    },
    gain: 0.2,
    slide: { from: 150, to: 100 }
  },

  click: {
    oscillator: {
      type: 'sine',
      frequency: 800,
      duration: 0.05
    },
    envelope: {
      attack: 0.005,
      decay: 0.04,
      sustain: 0,
      release: 0.01
    },
    gain: 0.05
  },

  start: {
    oscillator: {
      type: 'sine',
      frequencies: [440, 554, 659],
      timing: [0, 0.1, 0.2],
      duration: 0.4
    },
    envelope: {
      attack: 0.05,
      decay: 0.3,
      sustain: 0.2,
      release: 0.1
    },
    gain: 0.2
  },

  gameover: {
    oscillator: {
      type: 'sawtooth',
      frequencies: [300, 250, 200, 150],
      timing: [0, 0.15, 0.3, 0.45],
      duration: 0.6
    },
    envelope: {
      attack: 0.05,
      decay: 0.5,
      sustain: 0.1,
      release: 0.2
    },
    gain: 0.3,
    slide: { from: 300, to: 150 }
  }
};

/**
 * Gerenciador unificado de sons.
 * @class SoundManager
 */
export class SoundManager {
  /**
   * Cria uma instância do SoundManager.
   *
   * @param {Object} options - Opções de configuração
   * @param {number} [options.volume=1.0] - Volume inicial (0-1)
   * @param {boolean} [options.muted=false] - Se inicia mudo
   * @param {boolean} [options.resumeOnInteraction=true] - Resume audio context em interação
   */
  constructor(options = {}) {
    this.volume = options.volume ?? 1.0;
    this.muted = options.muted || false;
    this.resumeOnInteraction = options.resumeOnInteraction ?? true;

    this._audioContext = null;
    this._masterGain = null;
    this._initialized = false;
    this._sounds = new Map();

    // Bind handlers
    this._resumeAudio = this._resumeAudio.bind(this);
  }

  /**
   * Inicializa o Web Audio API.
   * Deve ser chamado após interação do usuário (clique/toque).
   *
   * @returns {Promise<boolean>} Se inicializou com sucesso
   */
  async init() {
    if (this._initialized) return true;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        console.warn('[SoundManager] Web Audio API não suportada');
        return false;
      }

      this._audioContext = new AudioContext();
      this._masterGain = this._audioContext.createGain();
      this._masterGain.connect(this._audioContext.destination);
      this._masterGain.gain.value = this.muted ? 0 : this.volume;

      this._initialized = true;

      // Resume em interações futuras se necessário
      if (this.resumeOnInteraction) {
        document.addEventListener('click', this._resumeAudio, { once: true });
        document.addEventListener('touchstart', this._resumeAudio, { once: true });
        document.addEventListener('keydown', this._resumeAudio, { once: true });
      }

      return true;
    } catch (e) {
      console.error('[SoundManager] Erro ao inicializar:', e);
      return false;
    }
  }

  /**
   * Resume o audio context (navegadores bloqueiam até interação).
   * @private
   */
  _resumeAudio() {
    if (this._audioContext?.state === 'suspended') {
      this._audioContext.resume();
    }
  }

  /**
   * Verifica se está inicializado.
   * @returns {boolean}
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Verifica se Web Audio API está disponível.
   * @returns {boolean}
   */
  isSupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  /**
   * Reproduz um som predefinido.
   *
   * @param {string} type - Tipo do som ('win', 'move', 'error', 'click', 'start', 'gameover')
   * @param {Object} [options] - Opções de override
   * @returns {Promise<boolean>} Se o som foi reproduzido
   *
   * @example
   * await sounds.play('win');
   * await sounds.play('click', { gain: 0.5 });
   */
  async play(type, options = {}) {
    if (!this._initialized) {
      await this.init();
    }

    if (!this._initialized || this.muted) {
      return false;
    }

    const preset = SOUND_PRESETS[type];
    if (!preset) {
      console.warn(`[SoundManager] Tipo de som desconhecido: ${type}`);
      return false;
    }

    try {
      const merged = this._mergePreset(preset, options);
      await this._playSound(merged);
      return true;
    } catch (e) {
      console.error('[SoundManager] Erro ao tocar som:', e);
      return false;
    }
  }

  /**
   * Reproduz som customizado.
   *
   * @param {Object} config - Configuração do som
   * @param {string} config.type - Tipo do oscilador ('sine', 'square', 'sawtooth', 'triangle')
   * @param {number|number[]} config.frequencies - Frequência ou array de frequências
   * @param {number} config.duration - Duração em segundos
   * @param {number} [config.gain=0.3] - Volume do som
   * @returns {Promise<boolean>}
   *
   * @example
   * await sounds.playCustom({
   *   type: 'sine',
   *   frequencies: [440, 880],
   *   duration: 0.5,
   *   gain: 0.3
   * });
   */
  async playCustom(config) {
    if (!this._initialized) {
      await this.init();
    }

    if (!this._initialized || this.muted) {
      return false;
    }

    try {
      await this._playSound(config);
      return true;
    } catch (e) {
      console.error('[SoundManager] Erro ao tocar som customizado:', e);
      return false;
    }
  }

  /**
   * Reproduz o som usando Web Audio API.
   * @private
   */
  async _playSound(config) {
    const now = this._audioContext.currentTime;
    const osc = this._audioContext.createOscillator();
    const gainNode = this._audioContext.createGain();

    osc.connect(gainNode);
    gainNode.connect(this._masterGain);

    // Configura oscilador
    osc.type = config.oscillator?.type || config.type || 'sine';

    // Frequências
    const freqs = config.oscillator?.frequencies ||
                  (Array.isArray(config.frequencies) ? config.frequencies : [config.frequencies || 440]);
    const timing = config.oscillator?.timing || freqs.map((_, i) => i * (config.duration / freqs.length));
    const duration = config.oscillator?.duration || config.duration;

    // Define frequências em sequência
    osc.frequency.setValueAtTime(freqs[0], now);
    for (let i = 1; i < freqs.length; i++) {
      osc.frequency.setValueAtTime(freqs[i], now + timing[i]);
    }

    // Slide opcional
    if (config.slide) {
      osc.frequency.setValueAtTime(config.slide.from, now);
      osc.frequency.exponentialRampToValueAtTime(config.slide.to, now + duration);
    }

    // Envelope ADSR
    const envelope = config.envelope || {};
    const attack = envelope.attack || 0.01;
    const decay = envelope.decay || 0.1;
    const sustain = envelope.sustain ?? 0.3;
    const release = envelope.release || 0.1;
    const peakGain = (config.oscillator?.gain || config.gain || 0.3) * this.volume;

    // Aplica envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(peakGain, now + attack);
    gainNode.gain.setTargetAtTime(peakGain * sustain, now + attack, decay / 3);
    gainNode.gain.setValueAtTime(peakGain * sustain, now + duration - release);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Toca
    osc.start(now);
    osc.stop(now + duration + release);

    // Cleanup
    setTimeout(() => {
      osc.disconnect();
      gainNode.disconnect();
    }, (duration + release + 0.1) * 1000);
  }

  /**
   * Mescla preset com opções customizadas.
   * @private
   */
  _mergePreset(preset, options) {
    return {
      ...preset,
      ...options,
      oscillator: {
        ...preset.oscillator,
        ...options.oscillator
      },
      envelope: {
        ...preset.envelope,
        ...options.envelope
      }
    };
  }

  /**
   * Define o volume global.
   *
   * @param {number} value - Volume entre 0 e 1
   */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this._masterGain && !this.muted) {
      this._masterGain.gain.setValueAtTime(this.volume, this._audioContext.currentTime);
    }
  }

  /**
   * Retorna o volume atual.
   * @returns {number}
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Muta todos os sons.
   */
  mute() {
    this.muted = true;
    if (this._masterGain) {
      this._masterGain.gain.setValueAtTime(0, this._audioContext.currentTime);
    }
  }

  /**
   * Desmuta os sons.
   */
  unmute() {
    this.muted = false;
    if (this._masterGain) {
      this._masterGain.gain.setValueAtTime(this.volume, this._audioContext.currentTime);
    }
  }

  /**
   * Alterna entre mudo/não mudo.
   * @returns {boolean} Novo estado (true = mudo)
   */
  toggleMute() {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.muted;
  }

  /**
   * Verifica se está mudo.
   * @returns {boolean}
   */
  isMuted() {
    return this.muted;
  }

  /**
   * Toca som de vibração curta (feedback).
   *
   * @param {number} [duration=10] - Duração em ms
   */
  haptic(duration = 10) {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }

  /**
   * Pausa o audio context.
   */
  suspend() {
    if (this._audioContext?.state === 'running') {
      this._audioContext.suspend();
    }
  }

  /**
   * Resume o audio context.
   */
  resume() {
    if (this._audioContext?.state === 'suspended') {
      this._audioContext.resume();
    }
  }

  /**
   * Destrói o SoundManager, limpando recursos.
   */
  destroy() {
    this._sounds.clear();

    document.removeEventListener('click', this._resumeAudio);
    document.removeEventListener('touchstart', this._resumeAudio);
    document.removeEventListener('keydown', this._resumeAudio);

    if (this._masterGain) {
      this._masterGain.disconnect();
      this._masterGain = null;
    }

    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }

    this._initialized = false;
  }
}

/**
 * Cria um SoundManager pré-configurado.
 *
 * @param {Object} options - Opções
 * @returns {SoundManager} Instância configurada
 * @example
 * const sounds = createSoundManager({ volume: 0.5 });
 * await sounds.init();
 */
export function createSoundManager(options = {}) {
  return new SoundManager(options);
}
