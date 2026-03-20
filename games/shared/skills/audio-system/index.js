// =============================================
// AUDIO SYSTEM - Sistema de Áudio Moderno
// =============================================
// Web Audio API com suporte a BGM, SFX e controle de volume

export class AudioSystem {
  constructor(options = {}) {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;

    this.isMuted = false;
    this.masterVolume = options.volume ?? 0.7;
    this.bgmVolume = options.bgmVolume ?? 0.5;
    this.sfxVolume = options.sfxVolume ?? 0.8;

    this.currentBGM = null;
    this.bgmSource = null;
    this.bgmBuffer = null;
    this.isPlayingBGM = false;

    this.proceduralSounds = new Map();
    this.initialized = false;
  }

  /**
   * Inicializa o contexto de áudio (deve ser chamado após interação do usuário)
   */
  init() {
    if (this.initialized) return true;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Cria nós de ganho para controle de volume
      this.masterGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      // Conecta: BGM -> master, SFX -> master, master -> destino
      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Define volumes iniciais
      this.masterGain.gain.value = this.masterVolume;
      this.bgmGain.gain.value = this.bgmVolume;
      this.sfxGain.gain.value = this.sfxVolume;

      this.initialized = true;
      return true;
    } catch (e) {
      console.warn('[AudioSystem] Falha ao inicializar:', e);
      return false;
    }
  }

  /**
   * Garante que o contexto esteja inicializado
   */
  ensureInitialized() {
    if (!this.initialized) {
      return this.init();
    }
    // Resume se estiver suspenso (política do navegador)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return true;
  }

  /**
   * Define o volume master (0-1)
   */
  setVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, value));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Define o volume do BGM (0-1)
   */
  setBGMVolume(value) {
    this.bgmVolume = Math.max(0, Math.min(1, value));
    if (this.bgmGain) {
      this.bgmGain.gain.setTargetAtTime(this.bgmVolume, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Define o volume dos SFX (0-1)
   */
  setSFXVolume(value) {
    this.sfxVolume = Math.max(0, Math.min(1, value));
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Mute global
   */
  mute() {
    this.isMuted = true;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Unmute global
   */
  unmute() {
    this.isMuted = false;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.isMuted;
  }

  /**
   * Toca música de fundo (BGM) usando buffer ou oscilador
   */
  async playBGM(source, options = {}) {
    if (!this.ensureInitialized()) return;

    const { loop = true, volume = 1, fadeIn = 0.5 } = options;

    // Para BGM atual
    this.stopBGM();

    let buffer = null;

    // Se for função, gera proceduralmente
    if (typeof source === 'function') {
      buffer = await source(this.ctx);
    } else if (source instanceof AudioBuffer) {
      buffer = source;
    }

    if (!buffer) return;

    this.bgmBuffer = buffer;
    this.currentBGM = source;

    // Cria source e conecta
    this.bgmSource = this.ctx.createBufferSource();
    this.bgmSource.buffer = buffer;
    this.bgmSource.loop = loop;
    this.bgmSource.connect(this.bgmGain);

    // Fade in
    const now = this.ctx.currentTime;
    this.bgmGain.gain.setValueAtTime(0, now);
    this.bgmGain.gain.linearRampToValueAtTime(this.bgmVolume * volume, now + fadeIn);

    this.bgmSource.start();
    this.isPlayingBGM = true;

    // Callback quando terminar (se não loop)
    this.bgmSource.onended = () => {
      if (!loop) {
        this.isPlayingBGM = false;
        this.bgmSource = null;
      }
    };
  }

  /**
   * Pausa o BGM
   */
  pauseBGM() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  /**
   * Resume o BGM
   */
  resumeBGM() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Para o BGM
   */
  stopBGM(fadeOut = 0.3) {
    if (!this.bgmSource) return;

    if (this.ctx && fadeOut > 0) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, now);
      this.bgmGain.gain.exponentialRampToValueAtTime(0.001, now + fadeOut);

      setTimeout(() => {
        if (this.bgmSource) {
          try {
            this.bgmSource.stop();
          } catch (e) {}
          this.bgmSource = null;
          this.isPlayingBGM = false;
        }
      }, fadeOut * 1000);
    } else {
      try {
        this.bgmSource.stop();
      } catch (e) {}
      this.bgmSource = null;
      this.isPlayingBGM = false;
    }
  }

  /**
   * Crossfade entre duas músicas
   */
  async crossfade(newSource, duration = 1.0, options = {}) {
    if (!this.ensureInitialized()) return;

    const oldSource = this.bgmSource;
    const oldGain = this.ctx.createGain();

    if (oldSource) {
      // Desconecta do bgmGain e conecta ao oldGain temporário
      oldSource.disconnect();
      oldSource.connect(oldGain);
      oldGain.connect(this.masterGain);

      // Fade out
      const now = this.ctx.currentTime;
      oldGain.gain.setValueAtTime(this.bgmVolume, now);
      oldGain.gain.linearRampToValueAtTime(0.001, now + duration);
    }

    // Prepara nova música
    let buffer = null;
    if (typeof newSource === 'function') {
      buffer = await newSource(this.ctx);
    } else if (newSource instanceof AudioBuffer) {
      buffer = newSource;
    }

    if (buffer) {
      const newBGMSource = this.ctx.createBufferSource();
      newBGMSource.buffer = buffer;
      newBGMSource.loop = options.loop ?? true;
      newBGMSource.connect(this.bgmGain);

      // Fade in
      const now = this.ctx.currentTime;
      this.bgmGain.gain.setValueAtTime(0, now);
      this.bgmGain.gain.linearRampToValueAtTime(this.bgmVolume * (options.volume ?? 1), now + duration);

      newBGMSource.start();
      this.bgmSource = newBGMSource;
      this.currentBGM = newSource;
      this.isPlayingBGM = true;
    }

    // Limpa source antiga após fade
    if (oldSource) {
      setTimeout(() => {
        try {
          oldSource.stop();
        } catch (e) {}
      }, duration * 1000);
    }
  }

  /**
   * Toca um efeito sonoro (SFX)
   */
  playSFX(soundGenerator, options = {}) {
    if (!this.ensureInitialized()) return;
    if (this.isMuted) return;

    const { volume = 1, pan = 0 } = options;

    try {
      let buffer;

      if (typeof soundGenerator === 'function') {
        // Gera o som proceduralmente
        buffer = soundGenerator(this.ctx);
      } else if (soundGenerator instanceof AudioBuffer) {
        buffer = soundGenerator;
      } else if (typeof soundGenerator === 'string') {
        // Toca som predefinido do audioLibrary
        return this.playPresetSFX(soundGenerator, options);
      }

      if (!buffer) return;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      // Pan (estereo)
      let destination = this.sfxGain;
      if (pan !== 0 && this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = pan;
        panner.connect(this.sfxGain);
        destination = panner;
      }

      source.connect(destination);
      source.start();
    } catch (e) {
      console.warn('[AudioSystem] Erro ao tocar SFX:', e);
    }
  }

  /**
   * Toca um som predefinido (para compatibilidade com audioLibrary)
   */
  playPresetSFX(name, options = {}) {
    // Este método será preenchido quando o audioLibrary for importado
    console.warn('[AudioSystem] Som predefinido não carregado:', name);
  }

  /**
   * Cria um oscilador simples para efeitos
   */
  playTone(frequency, duration, type = 'sine', options = {}) {
    if (!this.ensureInitialized()) return;
    if (this.isMuted) return;

    const { volume = 0.5, attack = 0.01, decay = 0.1, sustain = 0.5, release = 0.2 } = options;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;
    const totalDuration = attack + decay + sustain + release;

    // ADSR envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(volume * 0.7, now + attack + decay);
    gain.gain.setValueAtTime(volume * 0.7, now + attack + decay + sustain);
    gain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration);

    osc.start(now);
    osc.stop(now + totalDuration);
  }

  /**
   * Libera recursos
   */
  dispose() {
    this.stopBGM(0);
    if (this.ctx) {
      this.ctx.close();
    }
    this.initialized = false;
  }
}

// Instância global para reuso
let globalAudioSystem = null;

export function getGlobalAudioSystem() {
  if (!globalAudioSystem) {
    globalAudioSystem = new AudioSystem();
  }
  return globalAudioSystem;
}

export function setGlobalAudioSystem(audioSystem) {
  globalAudioSystem = audioSystem;
}
