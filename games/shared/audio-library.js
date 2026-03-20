// =============================================
// AUDIO LIBRARY - Sons Gerados Proceduralmente
// =============================================
// Usa Web Audio API para gerar sons sintéticos sem arquivos externos

// =============================================
// GERADORES UTILITÁRIOS
// =============================================

/**
 * Cria um buffer de áudio com duração específica
 */
function createBuffer(ctx, duration, sampleRate = 44100) {
  return ctx.createBuffer(1, duration * sampleRate, sampleRate);
}

/**
 * Preenche buffer com onda senoidal
 */
function fillSineWave(buffer, frequency, amplitude = 1) {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude;
  }
}

/**
 * Preenche buffer com onda quadrada
 */
function fillSquareWave(buffer, frequency, amplitude = 1) {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  for (let i = 0; i < data.length; i++) {
    const phase = (i * frequency / sampleRate) % 1;
    data[i] = (phase < 0.5 ? 1 : -1) * amplitude;
  }
}

/**
 * Preenche buffer com onda triangular
 */
function fillTriangleWave(buffer, frequency, amplitude = 1) {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  for (let i = 0; i < data.length; i++) {
    const phase = (i * frequency / sampleRate) % 1;
    data[i] = (2 * Math.abs(2 * phase - 1) - 1) * amplitude;
  }
}

/**
 * Preenche buffer com onda dente de serra
 */
function fillSawtoothWave(buffer, frequency, amplitude = 1) {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  for (let i = 0; i < data.length; i++) {
    data[i] = (((i * frequency / sampleRate) % 1) * 2 - 1) * amplitude;
  }
}

/**
 * Aplica envelope ADSR
 */
function applyADSR(buffer, attack, decay, sustain, release) {
  const data = buffer.getChannelData(0);
  const length = data.length;
  const sampleRate = buffer.sampleRate;

  const attackSamples = attack * sampleRate;
  const decaySamples = decay * sampleRate;
  const releaseSamples = release * sampleRate;
  const sustainSamples = length - attackSamples - decaySamples - releaseSamples;

  for (let i = 0; i < length; i++) {
    let envelope = 0;
    if (i < attackSamples) {
      envelope = i / attackSamples;
    } else if (i < attackSamples + decaySamples) {
      envelope = 1 - ((i - attackSamples) / decaySamples) * (1 - sustain);
    } else if (i < length - releaseSamples) {
      envelope = sustain;
    } else {
      envelope = sustain * (1 - (i - (length - releaseSamples)) / releaseSamples);
    }
    data[i] *= envelope;
  }
}

/**
 * Aplica fade out
 */
function applyFadeOut(buffer, fadeDuration) {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const fadeSamples = fadeDuration * sampleRate;
  const startFade = data.length - fadeSamples;

  for (let i = startFade; i < data.length; i++) {
    const fade = 1 - (i - startFade) / fadeSamples;
    data[i] *= fade;
  }
}

// =============================================
// EFEITOS SONOROS (SFX)
// =============================================

export const sfx = {
  /**
   * Som de comer (estilo Pac-Man)
   */
  eat(ctx) {
    const duration = 0.1;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Som tipo "waka" - frequência modulada
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const freq = 440 + Math.sin(t * 20) * 100;
      data[i] = Math.sin(2 * Math.PI * freq * t) * 0.5;
    }

    applyFadeOut(buffer, 0.02);
    return buffer;
  },

  /**
   * Som de power-up
   */
  powerup(ctx) {
    const duration = 0.5;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Sweep de frequência ascendente
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const freq = 220 + progress * 880;
      data[i] = Math.sin(2 * Math.PI * freq * t) * (1 - progress * 0.5);
    }

    applyADSR(buffer, 0.05, 0.1, 0.8, 0.2);
    return buffer;
  },

  /**
   * Som de level-up / vitória
   */
  levelup(ctx) {
    const duration = 1.2;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Arpeggio de vitória
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const noteDuration = duration / notes.length;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.min(Math.floor(t / noteDuration), notes.length - 1);
      const freq = notes[noteIndex];
      data[i] = Math.sin(2 * Math.PI * freq * t) * 0.4;
    }

    applyADSR(buffer, 0.02, 0.1, 0.7, 0.3);
    return buffer;
  },

  /**
   * Som de game over
   */
  lose(ctx) {
    const duration = 1.0;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Descida de frequência
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const progress = t / duration;
      const freq = 440 * Math.pow(0.5, progress * 2);
      data[i] = Math.sin(2 * Math.PI * freq * t) * (1 - progress);
    }

    return buffer;
  },

  /**
   * Som de win / sucesso
   */
  win(ctx) {
    const duration = 1.5;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Fanfarra simples
    const notes = [440, 554, 659, 880, 880, 880]; // A4, C#5, E5, A5
    const noteDuration = duration / notes.length;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.min(Math.floor(t / noteDuration), notes.length - 1);
      const freq = notes[noteIndex];
      const vibrato = Math.sin(t * 15) * 3;
      data[i] = Math.sin(2 * Math.PI * (freq + vibrato) * t) * 0.4;
    }

    applyADSR(buffer, 0.05, 0.1, 0.8, 0.2);
    return buffer;
  },

  /**
   * Som de clique
   */
  click(ctx) {
    const duration = 0.05;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);

    // Ruído curto filtrado
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    applyADSR(buffer, 0.001, 0.02, 0, 0.03);
    return buffer;
  },

  /**
   * Som de explosão
   */
  explosion(ctx) {
    const duration = 0.4;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Ruído com decaimento exponencial
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 10);
      const noise = (Math.random() * 2 - 1);
      // Adiciona componente de baixa frequência
      const rumble = Math.sin(2 * Math.PI * 60 * t) * 0.5;
      data[i] = (noise * 0.7 + rumble * 0.3) * decay * 0.8;
    }

    return buffer;
  },

  /**
   * Som de movimento (estilo arcade)
   */
  move(ctx) {
    const duration = 0.08;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Tom curto
    const freq = 200;
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      data[i] = Math.sin(2 * Math.PI * freq * t) * 0.3;
    }

    applyADSR(buffer, 0.005, 0.02, 0.3, 0.05);
    return buffer;
  },

  /**
   * Som de rotação
   */
  rotate(ctx) {
    const duration = 0.12;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Whoosh curto
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const sweep = 600 - t * 3000;
      data[i] = Math.sin(2 * Math.PI * sweep * t) * 0.3;
    }

    applyFadeOut(buffer, 0.05);
    return buffer;
  },

  /**
   * Som de bloqueio/fixação
   */
  lock(ctx) {
    const duration = 0.15;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Som percussivo
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const freq = 150 * Math.exp(-t * 20);
      data[i] = Math.sin(2 * Math.PI * freq * t) * 0.5;
    }

    applyADSR(buffer, 0.001, 0.05, 0.2, 0.1);
    return buffer;
  },

  /**
   * Som de limpar linha(s)
   */
  clear(ctx, lines = 1) {
    const duration = 0.3 + lines * 0.1;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Escala ascendente baseada no número de linhas
    const baseFreq = 330;
    const frequencies = [];
    for (let i = 0; i < lines + 2; i++) {
      frequencies.push(baseFreq * Math.pow(1.5, i));
    }

    const noteDuration = duration / frequencies.length;
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.min(Math.floor(t / noteDuration), frequencies.length - 1);
      const freq = frequencies[noteIndex];
      data[i] = Math.sin(2 * Math.PI * freq * t) * 0.4;
    }

    applyADSR(buffer, 0.01, 0.05, 0.7, 0.15);
    return buffer;
  },

  /**
   * Som de bater/impacto
   */
  hit(ctx) {
    const duration = 0.2;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Impacto
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 15);
      data[i] = (Math.random() * 2 - 1) * decay * 0.6;
    }

    applyADSR(buffer, 0.001, 0.05, 0.3, 0.1);
    return buffer;
  },

  /**
   * Som de game over específico (Tetris style)
   */
  gameover(ctx) {
    const duration = 1.2;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Sequência descendente
    const notes = [330, 311, 294, 277, 261, 247, 233, 220]; // E4 descending
    const noteDuration = duration / notes.length;

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.min(Math.floor(t / noteDuration), notes.length - 1);
      const freq = notes[noteIndex];
      data[i] = Math.sin(2 * Math.PI * freq * t) * 0.5;
    }

    applyADSR(buffer, 0.1, 0.2, 0.6, 0.3);
    return buffer;
  },

  /**
   * Som de fantasma comido (Pac-Man)
   */
  ghostEaten(ctx) {
    const duration = 0.4;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Som de pontuação alto
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const freq = 880 + Math.sin(t * 50) * 100;
      data[i] = Math.sin(2 * Math.PI * freq * t) * 0.5;
    }

    applyADSR(buffer, 0.01, 0.1, 0.7, 0.1);
    return buffer;
  },

  /**
   * Som de power pellet (Pac-Man)
   */
  powerPellet(ctx) {
    const duration = 0.8;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Tremolo de alta frequência
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const tremolo = Math.sin(t * 30) * 0.5 + 0.5;
      const freq = 660 + tremolo * 220;
      data[i] = Math.sin(2 * Math.PI * freq * t) * 0.4;
    }

    applyADSR(buffer, 0.05, 0.1, 0.8, 0.15);
    return buffer;
  }
};

// =============================================
// BACKGROUND MUSIC (BGM) - Gerada Proceduralmente
// =============================================

export const bgm = {
  /**
   * BGM estilo arcade (loop)
   */
  arcade(ctx) {
    const duration = 4.0;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Bass line simples
    const bassLine = [
      { note: 65.41, duration: 0.5 },  // C2
      { note: 65.41, duration: 0.5 },
      { note: 73.42, duration: 0.5 },  // D2
      { note: 87.31, duration: 0.5 },  // F2
      { note: 98.00, duration: 0.5 },  // G2
      { note: 98.00, duration: 0.5 },
      { note: 87.31, duration: 0.5 },  // F2
      { note: 73.42, duration: 0.5 },  // D2
    ];

    let currentTime = 0;
    for (const { note, duration: noteDur } of bassLine) {
      const startSample = Math.floor(currentTime * sampleRate);
      const endSample = Math.floor((currentTime + noteDur) * sampleRate);

      for (let i = startSample; i < endSample && i < data.length; i++) {
        const t = (i - startSample) / sampleRate;
        // Sawtooth para som de synth retro
        const saw = ((i * note / sampleRate) % 1) * 2 - 1;
        const filtered = saw * Math.exp(-t * 3); // Filtro simples
        data[i] += filtered * 0.3;
      }
      currentTime += noteDur;
    }

    return buffer;
  },

  /**
   * BGM estilo puzzle (relaxante)
   */
  puzzle(ctx) {
    const duration = 8.0;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Melodia suave
    const melody = [
      { note: 261.63, duration: 1.0 }, // C4
      { note: 293.66, duration: 1.0 }, // D4
      { note: 329.63, duration: 1.0 }, // E4
      { note: 349.23, duration: 1.0 }, // F4
      { note: 329.63, duration: 1.0 }, // E4
      { note: 293.66, duration: 1.0 }, // D4
      { note: 261.63, duration: 2.0 }, // C4
    ];

    let currentTime = 0;
    for (const { note, duration: noteDur } of melody) {
      const startSample = Math.floor(currentTime * sampleRate);
      const endSample = Math.floor((currentTime + noteDur) * sampleRate);

      for (let i = startSample; i < endSample && i < data.length; i++) {
        const t = (i - startSample) / sampleRate;
        // Sine wave suave
        const sine = Math.sin(2 * Math.PI * note * t);
        const envelope = Math.sin((t / noteDur) * Math.PI); // Fade in/out suave
        data[i] += sine * envelope * 0.25;
      }
      currentTime += noteDur;
    }

    return buffer;
  },

  /**
   * BGM estilo strategy (atmosférica)
   */
  strategy(ctx) {
    const duration = 6.0;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Drones suaves
    const drones = [110, 164.81, 196.00]; // A2, E3, G3

    for (const freq of drones) {
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const phase = (t * freq) % 1;
        // Triangular wave suave
        const tri = 1 - 2 * Math.abs(phase - 0.5);
        const slowMod = Math.sin(t * 2) * 0.1 + 0.9; // Modulação lenta
        data[i] += tri * slowMod * 0.15;
      }
    }

    return buffer;
  },

  /**
   * BGM estilo cards (jazz suave)
   */
  cards(ctx) {
    const duration = 6.0;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Padrão de acordes simples
    const chords = [
      [261.63, 329.63, 392.00], // C
      [293.66, 349.23, 440.00], // Dm
      [246.94, 311.13, 392.00], // Bdim
      [261.63, 329.63, 392.00], // C
    ];

    const chordDuration = duration / chords.length;
    let currentTime = 0;

    for (const chord of chords) {
      const startSample = Math.floor(currentTime * sampleRate);
      const endSample = Math.floor((currentTime + chordDuration) * sampleRate);

      for (let i = startSample; i < endSample && i < data.length; i++) {
        const t = (i - startSample) / sampleRate;
        let sample = 0;
        for (const note of chord) {
          sample += Math.sin(2 * Math.PI * note * t) * 0.1;
        }
        // Envelope suave
        const envelope = Math.min(t * 2, 1) * Math.max(0, 1 - (t / chordDuration - 0.5) * 2);
        data[i] += sample * envelope * 0.5;
      }
      currentTime += chordDuration;
    }

    return buffer;
  },

  /**
   * BGM estilo snake (ritmo pulsante)
   */
  snake(ctx) {
    const duration = 2.0;
    const buffer = createBuffer(ctx, duration);
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    // Beat simples
    const beatPattern = [
      { freq: 80, amp: 0.4, duration: 0.1 },
      { freq: 0, amp: 0, duration: 0.15 },
      { freq: 120, amp: 0.2, duration: 0.05 },
      { freq: 0, amp: 0, duration: 0.15 },
      { freq: 80, amp: 0.4, duration: 0.1 },
      { freq: 0, amp: 0, duration: 0.15 },
      { freq: 100, amp: 0.25, duration: 0.05 },
      { freq: 0, amp: 0, duration: 0.15 },
    ];

    let currentTime = 0;
    for (const { freq, amp, duration: noteDur } of beatPattern) {
      const startSample = Math.floor(currentTime * sampleRate);
      const endSample = Math.floor((currentTime + noteDur) * sampleRate);

      for (let i = startSample; i < endSample && i < data.length; i++) {
        if (freq > 0) {
          const t = (i - startSample) / sampleRate;
          // Som de kick
          const kick = Math.sin(2 * Math.PI * (freq - t * 500) * t) * amp;
          data[i] += Math.max(0, kick);
        }
      }
      currentTime += noteDur;
    }

    return buffer;
  }
};

// =============================================
// EXPORTAÇÃO CONVENIENTE
// =============================================

export const audioLibrary = {
  sfx,
  bgm,

  /**
   * Obtém um gerador de SFX pelo nome
   */
  getSFX(name) {
    return sfx[name] || sfx.click;
  },

  /**
   * Obtém um gerador de BGM pelo nome
   */
  getBGM(name) {
    return bgm[name] || bgm.arcade;
  },

  /**
   * Lista todos os SFX disponíveis
   */
  listSFX() {
    return Object.keys(sfx);
  },

  /**
   * Lista todos os BGM disponíveis
   */
  listBGM() {
    return Object.keys(bgm);
  }
};

export default audioLibrary;
