/**
 * Sistema de Partículas Avançado
 *
 * Fornece um sistema de partículas completo com física básica,
 * múltiplos tipos de efeitos e renderização em canvas.
 *
 * @module skills/particle-system
 * @example
 * import { ParticleSystem } from '../shared/skills/particle-system/index.js';
 *
 * const canvas = document.getElementById('particles');
 * const particles = new ParticleSystem(canvas);
 *
 * // Emitir explosão
 * particles.emit({ x: 100, y: 100, count: 50, type: 'explosion', color: '#ff6b6b' });
 *
 * // Animar no loop do jogo
 * function loop() {
 *   particles.update();
 *   requestAnimationFrame(loop);
 * }
 */

/**
 * Representa uma partícula individual com propriedades físicas.
 * @private
 * @class Particle
 */
class Particle {
  /**
   * Cria uma partícula.
   *
   * @param {Object} options - Opções da partícula
   * @param {number} options.x - Posição X inicial
   * @param {number} options.y - Posição Y inicial
   * @param {number} options.vx - Velocidade X
   * @param {number} options.vy - Velocidade Y
   * @param {string} options.color - Cor da partícula
   * @param {number} [options.size=4] - Tamanho da partícula
   * @param {number} [options.life=1.0] - Vida inicial (0-1)
   * @param {number} [options.decay=0.02] - Taxa de decaimento
   * @param {string} [options.type='circle'] - Forma ('circle', 'square', 'star')
   * @param {number} [options.gravity=0] - Gravidade aplicada
   * @param {number} [options.friction=1] - Atrito (0-1)
   * @param {number} [options.rotation=0] - Rotação inicial
   * @param {number} [options.rotationSpeed=0] - Velocidade de rotação
   */
  constructor(options) {
    this.x = options.x;
    this.y = options.y;
    this.vx = options.vx || 0;
    this.vy = options.vy || 0;
    this.color = options.color || '#ffffff';
    this.size = options.size || 4;
    this.life = options.life || 1.0;
    this.decay = options.decay || 0.02;
    this.type = options.type || 'circle';
    this.gravity = options.gravity || 0;
    this.friction = options.friction || 1;
    this.rotation = options.rotation || 0;
    this.rotationSpeed = options.rotationSpeed || 0;

    // Valores iniciais para interpolação
    this.initialSize = this.size;
    this.initialAlpha = 1;
  }

  /**
   * Atualiza a partícula.
   * @returns {boolean} Se a partícula ainda está viva
   */
  update() {
    // Aplica física
    this.vy += this.gravity;
    this.vx *= this.friction;
    this.vy *= this.friction;

    // Atualiza posição
    this.x += this.vx;
    this.y += this.vy;

    // Atualiza rotação
    this.rotation += this.rotationSpeed;

    // Decaimento
    this.life -= this.decay;

    // Calcula valores atuais baseados na vida
    const lifeRatio = Math.max(0, this.life);
    this.size = this.initialSize * lifeRatio;

    return this.life > 0;
  }

  /**
   * Renderiza a partícula no contexto 2D.
   *
   * @param {CanvasRenderingContext2D} ctx - Contexto 2D do canvas
   */
  render(ctx) {
    if (this.life <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;

    switch (this.type) {
      case 'square':
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        break;

      case 'star':
        this._drawStar(ctx, 0, 0, 5, this.size / 2, this.size);
        break;

      case 'circle':
      default:
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }

  /**
   * Desenha uma estrela.
   * @private
   */
  _drawStar(ctx, cx, cy, spikes, innerRadius, outerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Sistema de partículas completo para efeitos visuais.
 * @class ParticleSystem
 */
export class ParticleSystem {
  /**
   * Cria uma instância do sistema de partículas.
   *
   * @param {HTMLCanvasElement} canvas - Elemento canvas para renderização
   * @param {Object} options - Opções de configuração
   * @param {boolean} [options.autoResize=true] - Redimensiona automaticamente
   * @param {string} [options.blendMode='source-over'] - Modo de blend do canvas
   */
  constructor(canvas, options = {}) {
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error('[ParticleSystem] Canvas é obrigatório');
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.autoResize = options.autoResize ?? true;
    this.blendMode = options.blendMode || 'source-over';

    if (this.autoResize) {
      this._resize();
      window.addEventListener('resize', () => this._resize());
    }
  }

  /**
   * Redimensiona o canvas para o tamanho do container.
   * @private
   */
  _resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
    }
  }

  /**
   * Emite um grupo de partículas.
   *
   * @param {Object} options - Opções de emissão
   * @param {number} options.x - Posição X
   * @param {number} options.y - Posição Y
   * @param {number} [options.count=10] - Quantidade de partículas
   * @param {string} [options.type='explosion'] - Tipo de efeito
   * @param {string|string[]} [options.color='#ff6b6b'] - Cor ou array de cores
   * @param {number} [options.speed=5] - Velocidade base
   * @param {number} [options.spread=360] - Ângulo de dispersão em graus
   * @param {number} [options.life=1.0] - Vida das partículas
   */
  emit(options) {
    const {
      x,
      y,
      count = 10,
      type = 'explosion',
      color = '#ff6b6b',
      speed = 5,
      spread = 360,
      life = 1.0
    } = options;

    const colors = Array.isArray(color) ? color : [color];
    const configs = this._getParticleConfig(type);

    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * spread - spread / 2) * Math.PI / 180;
      const velocity = Math.random() * speed + configs.speedMin;

      const particleOptions = {
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: configs.sizeMin + Math.random() * (configs.sizeMax - configs.sizeMin),
        life,
        decay: configs.decay,
        type: configs.shape,
        gravity: configs.gravity,
        friction: configs.friction,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * configs.rotationSpeed
      };

      this.particles.push(new Particle(particleOptions));
    }
  }

  /**
   * Retorna configurações baseadas no tipo de efeito.
   * @private
   */
  _getParticleConfig(type) {
    const configs = {
      explosion: {
        speedMin: 3,
        sizeMin: 4,
        sizeMax: 10,
        decay: 0.03,
        shape: 'circle',
        gravity: 0.2,
        friction: 0.98,
        rotationSpeed: 10
      },
      sparkle: {
        speedMin: 1,
        sizeMin: 2,
        sizeMax: 6,
        decay: 0.02,
        shape: 'star',
        gravity: -0.1,
        friction: 0.95,
        rotationSpeed: 15
      },
      smoke: {
        speedMin: 0.5,
        sizeMin: 8,
        sizeMax: 20,
        decay: 0.01,
        shape: 'circle',
        gravity: -0.3,
        friction: 0.99,
        rotationSpeed: 5
      },
      fire: {
        speedMin: 2,
        sizeMin: 4,
        sizeMax: 12,
        decay: 0.025,
        shape: 'circle',
        gravity: -0.5,
        friction: 0.97,
        rotationSpeed: 8
      },
      magic: {
        speedMin: 1,
        sizeMin: 3,
        sizeMax: 8,
        decay: 0.015,
        shape: 'star',
        gravity: 0,
        friction: 0.96,
        rotationSpeed: 20
      }
    };

    return configs[type] || configs.explosion;
  }

  /**
   * Atualiza e renderiza todas as partículas.
   * Chamar a cada frame.
   *
   * @param {boolean} [clearCanvas=true] - Se deve limpar o canvas
   */
  update(clearCanvas = true) {
    if (clearCanvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.ctx.globalCompositeOperation = this.blendMode;

    // Atualiza e remove partículas mortas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const alive = particle.update();

      if (alive) {
        particle.render(this.ctx);
      } else {
        this.particles.splice(i, 1);
      }
    }

    this.ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Limpa todas as partículas.
   */
  clear() {
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Retorna a quantidade de partículas ativas.
   * @returns {number}
   */
  count() {
    return this.particles.length;
  }

  /**
   * Verifica se há partículas ativas.
   * @returns {boolean}
   */
  isActive() {
    return this.particles.length > 0;
  }
}

/**
 * Cria um sistema de partículas simples (factory function).
 *
 * @param {HTMLCanvasElement} canvas - Canvas para renderização
 * @param {Object} options - Opções
 * @returns {ParticleSystem} Instância configurada
 * @example
 * const particles = createParticleSystem(document.getElementById('canvas'));
 * particles.emit({ x: 100, y: 100, type: 'sparkle', count: 20 });
 */
export function createParticleSystem(canvas, options = {}) {
  return new ParticleSystem(canvas, options);
}
