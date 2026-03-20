/**
 * Sistema de Animações Reutilizáveis
 *
 * Fornece funções de animação comuns usando Web Animations API
 * com fallback para CSS animations.
 *
 * @module skills/animation-system
 * @example
 * import { shake, bounce, fadeIn, fadeOut, slideUp } from '../shared/skills/animation-system/index.js';
 *
 * // Aplicar animação em elemento
 * await shake(element, { duration: 500, intensity: 'medium' });
 * await fadeIn(element, { duration: 300 });
 */

/**
 * Verifica se a Web Animations API está disponível.
 * @returns {boolean}
 */
function isWAAPIAvailable() {
  return typeof Element.prototype.animate === 'function';
}

/**
 * Aplica animação CSS com fallback.
 * @private
 */
function applyAnimation(element, keyframes, options) {
  const duration = options.duration || 300;
  const easing = options.easing || 'ease-out';
  const fill = options.fill || 'forwards';

  if (isWAAPIAvailable()) {
    return element.animate(keyframes, {
      duration,
      easing,
      fill
    }).finished;
  } else {
    // Fallback com CSS
    return applyCSSAnimation(element, keyframes, duration, easing);
  }
}

/**
 * Aplica animação via CSS inline.
 * @private
 */
function applyCSSAnimation(element, keyframes, duration, easing) {
  return new Promise((resolve) => {
    const animationName = `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Cria keyframes CSS
    const keyframeCSS = keyframes.map((kf, i) => {
      const percent = i / (keyframes.length - 1) * 100;
      const props = Object.entries(kf).map(([prop, val]) => {
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${cssProp}: ${val}`;
      }).join('; ');
      return `${percent}% { ${props} }`;
    }).join('\n');

    // Injeta estilo
    const style = document.createElement('style');
    style.textContent = `@keyframes ${animationName} {\n${keyframeCSS}\n}`;
    document.head.appendChild(style);

    // Aplica animação
    element.style.animation = `${animationName} ${duration}ms ${easing} forwards`;

    // Remove e resolve após animação
    setTimeout(() => {
      element.style.animation = '';
      style.remove();
      resolve();
    }, duration);
  });
}

/**
 * Animação de tremor (shake).
 *
 * @param {HTMLElement} element - Elemento a animar
 * @param {Object} options - Opções
 * @param {number} [options.duration=500] - Duração em ms
 * @param {string} [options.intensity='medium'] - Intensidade ('low', 'medium', 'high')
 * @param {string} [options.direction='horizontal'] - Direção ('horizontal', 'vertical')
 * @returns {Promise<void>} Resolvido quando a animação termina
 *
 * @example
 * await shake(element, { intensity: 'high' });
 */
export function shake(element, options = {}) {
  const intensityMap = {
    low: 5,
    medium: 10,
    high: 20
  };

  const distance = intensityMap[options.intensity] || intensityMap.medium;
  const direction = options.direction || 'horizontal';
  const duration = options.duration || 500;

  const keyframes = direction === 'horizontal'
    ? [
        { transform: 'translateX(0)' },
        { transform: `translateX(-${distance}px)` },
        { transform: `translateX(${distance}px)` },
        { transform: `translateX(-${distance}px)` },
        { transform: `translateX(${distance}px)` },
        { transform: `translateX(-${distance * 0.5}px)` },
        { transform: `translateX(${distance * 0.5}px)` },
        { transform: 'translateX(0)' }
      ]
    : [
        { transform: 'translateY(0)' },
        { transform: `translateY(-${distance}px)` },
        { transform: `translateY(${distance}px)` },
        { transform: `translateY(-${distance}px)` },
        { transform: `translateY(${distance}px)` },
        { transform: `translateY(-${distance * 0.5}px)` },
        { transform: `translateY(${distance * 0.5}px)` },
        { transform: 'translateY(0)' }
      ];

  return applyAnimation(element, keyframes, {
    duration,
    easing: 'ease-in-out'
  });
}

/**
 * Animação de pulso/bounce.
 *
 * @param {HTMLElement} element - Elemento a animar
 * @param {Object} options - Opções
 * @param {number} [options.duration=600] - Duração em ms
 * @param {number} [options.bounces=3] - Quantidade de pulsos
 * @param {number} [options.scale=1.2] - Escala máxima
 * @returns {Promise<void>}
 *
 * @example
 * await bounce(element, { scale: 1.3, bounces: 2 });
 */
export function bounce(element, options = {}) {
  const duration = options.duration || 600;
  const bounces = options.bounces || 3;
  const scale = options.scale || 1.2;

  const keyframes = [];
  const steps = bounces * 2 + 1;

  for (let i = 0; i < steps; i++) {
    const progress = i / (steps - 1);
    const currentScale = i % 2 === 1 ? scale - (scale - 1) * (i / steps) : 1;
    keyframes.push({ transform: `scale(${currentScale})` });
  }

  return applyAnimation(element, keyframes, {
    duration,
    easing: 'ease-out'
  });
}

/**
 * Animação de entrada (fade in).
 *
 * @param {HTMLElement} element - Elemento a animar
 * @param {Object} options - Opções
 * @param {number} [options.duration=300] - Duração em ms
 * @param {string} [options.direction='none'] - Direção ('none', 'up', 'down', 'left', 'right')
 * @param {number} [options.distance=20] - Distância de deslocamento
 * @returns {Promise<void>}
 *
 * @example
 * await fadeIn(element, { direction: 'up', distance: 30 });
 */
export function fadeIn(element, options = {}) {
  const duration = options.duration || 300;
  const direction = options.direction || 'none';
  const distance = options.distance || 20;

  const keyframes = [{ opacity: 0 }];
  const finalFrame = { opacity: 1 };

  // Adiciona transformação baseada na direção
  switch (direction) {
    case 'up':
      keyframes[0].transform = `translateY(${distance}px)`;
      finalFrame.transform = 'translateY(0)';
      break;
    case 'down':
      keyframes[0].transform = `translateY(-${distance}px)`;
      finalFrame.transform = 'translateY(0)';
      break;
    case 'left':
      keyframes[0].transform = `translateX(${distance}px)`;
      finalFrame.transform = 'translateX(0)';
      break;
    case 'right':
      keyframes[0].transform = `translateX(-${distance}px)`;
      finalFrame.transform = 'translateX(0)';
      break;
  }

  keyframes.push(finalFrame);

  // Garante visibilidade inicial
  element.style.opacity = '0';

  return applyAnimation(element, keyframes, {
    duration,
    easing: 'ease-out'
  });
}

/**
 * Animação de saída (fade out).
 *
 * @param {HTMLElement} element - Elemento a animar
 * @param {Object} options - Opções
 * @param {number} [options.duration=300] - Duração em ms
 * @param {string} [options.direction='none'] - Direção de saída
 * @param {number} [options.distance=20] - Distância de deslocamento
 * @param {boolean} [options.remove=false] - Remove o elemento após animação
 * @returns {Promise<void>}
 *
 * @example
 * await fadeOut(element, { direction: 'down', remove: true });
 */
export function fadeOut(element, options = {}) {
  const duration = options.duration || 300;
  const direction = options.direction || 'none';
  const distance = options.distance || 20;
  const remove = options.remove || false;

  const keyframes = [{ opacity: 1 }];
  const finalFrame = { opacity: 0 };

  switch (direction) {
    case 'up':
      keyframes[0].transform = 'translateY(0)';
      finalFrame.transform = `translateY(-${distance}px)`;
      break;
    case 'down':
      keyframes[0].transform = 'translateY(0)';
      finalFrame.transform = `translateY(${distance}px)`;
      break;
    case 'left':
      keyframes[0].transform = 'translateX(0)';
      finalFrame.transform = `translateX(-${distance}px)`;
      break;
    case 'right':
      keyframes[0].transform = 'translateX(0)';
      finalFrame.transform = `translateX(${distance}px)`;
      break;
  }

  keyframes.push(finalFrame);

  return applyAnimation(element, keyframes, {
    duration,
    easing: 'ease-in'
  }).then(() => {
    if (remove && element.parentElement) {
      element.remove();
    }
  });
}

/**
 * Animação de slide para cima.
 *
 * @param {HTMLElement} element - Elemento a animar
 * @param {Object} options - Opções
 * @param {number} [options.duration=400] - Duração em ms
 * @param {number} [options.distance=50] - Distância do slide
 * @param {boolean} [options.fade=true] - Se deve aplicar fade
 * @returns {Promise<void>}
 *
 * @example
 * await slideUp(element, { distance: 100, fade: true });
 */
export function slideUp(element, options = {}) {
  const duration = options.duration || 400;
  const distance = options.distance || 50;
  const fade = options.fade !== false;

  const keyframes = [
    {
      transform: `translateY(${distance}px)`,
      opacity: fade ? 0 : 1
    },
    {
      transform: 'translateY(0)',
      opacity: 1
    }
  ];

  return applyAnimation(element, keyframes, {
    duration,
    easing: 'ease-out'
  });
}

/**
 * Animação de slide para baixo.
 *
 * @param {HTMLElement} element - Elemento a animar
 * @param {Object} options - Opções
 * @param {number} [options.duration=400] - Duração em ms
 * @param {number} [options.distance=50] - Distância do slide
 * @param {boolean} [options.fade=true] - Se deve aplicar fade
 * @returns {Promise<void>}
 *
 * @example
 * await slideDown(element, { distance: 100 });
 */
export function slideDown(element, options = {}) {
  const duration = options.duration || 400;
  const distance = options.distance || 50;
  const fade = options.fade !== false;

  const keyframes = [
    {
      transform: `translateY(-${distance}px)`,
      opacity: fade ? 0 : 1
    },
    {
      transform: 'translateY(0)',
      opacity: 1
    }
  ];

  return applyAnimation(element, keyframes, {
    duration,
    easing: 'ease-out'
  });
}

/**
 * Animação de rotação.
 *
 * @param {HTMLElement} element - Elemento a animar
 * @param {Object} options - Opções
 * @param {number} [options.duration=600] - Duração em ms
 * @param {number} [options.degrees=360] - Graus de rotação
 * @param {string} [options.direction='clockwise'] - Direção ('clockwise', 'counter')
 * @returns {Promise<void>}
 *
 * @example
 * await rotate(element, { degrees: 720, direction: 'clockwise' });
 */
export function rotate(element, options = {}) {
  const duration = options.duration || 600;
  const degrees = options.degrees || 360;
  const direction = options.direction === 'counter' ? -1 : 1;

  const keyframes = [
    { transform: 'rotate(0deg)' },
    { transform: `rotate(${degrees * direction}deg)` }
  ];

  return applyAnimation(element, keyframes, {
    duration,
    easing: 'ease-in-out'
  });
}

/**
 * Animação de pulso (scale in/out contínuo).
 *
 * @param {HTMLElement} element - Elemento a animar
 * @param {Object} options - Opções
 * @param {number} [options.duration=1000] - Duração do ciclo
 * @param {number} [options.scale=1.1] - Escala máxima
 * @param {number} [options.iterations=Infinity] - Quantidade de iterações
 * @returns {Animation} Objeto de animação para controle
 *
 * @example
 * const anim = pulse(element, { scale: 1.2, iterations: 3 });
 * anim.cancel(); // Parar animação
 */
export function pulse(element, options = {}) {
  const duration = options.duration || 1000;
  const scale = options.scale || 1.1;
  const iterations = options.iterations ?? Infinity;

  const keyframes = [
    { transform: 'scale(1)' },
    { transform: `scale(${scale})` },
    { transform: 'scale(1)' }
  ];

  if (isWAAPIAvailable()) {
    return element.animate(keyframes, {
      duration,
      iterations,
      easing: 'ease-in-out'
    });
  } else {
    // Fallback: adiciona classe CSS
    element.classList.add('pulsing');
    element.style.animation = `pulse ${duration}ms ease-in-out ${iterations === Infinity ? 'infinite' : iterations}`;
    return {
      cancel: () => {
        element.classList.remove('pulsing');
        element.style.animation = '';
      }
    };
  }
}

/**
 * Cria uma sequência de animações encadeadas.
 *
 * @param {HTMLElement} element - Elemento a animar
 * @param {Array<Object>} animations - Array de configurações de animação
 * @returns {Promise<void>}
 *
 * @example
 * await sequence(element, [
 *   { type: 'fadeIn', duration: 300 },
 *   { type: 'shake', duration: 500 },
 *   { type: 'bounce', duration: 600 }
 * ]);
 */
export async function sequence(element, animations) {
  const animationMap = {
    shake,
    bounce,
    fadeIn,
    fadeOut,
    slideUp,
    slideDown,
    rotate
  };

  for (const anim of animations) {
    const fn = animationMap[anim.type];
    if (fn) {
      await fn(element, anim);
    }
  }
}

/**
 * Animação de flip (3D).
 *
 * @param {HTMLElement} element - Elemento a animar
 * @param {Object} options - Opções
 * @param {number} [options.duration=600] - Duração em ms
 * @param {string} [options.axis='Y'] - Eixo de rotação ('X' ou 'Y')
 * @returns {Promise<void>}
 *
 * @example
 * await flip(element, { axis: 'Y', duration: 500 });
 */
export function flip(element, options = {}) {
  const duration = options.duration || 600;
  const axis = options.axis || 'Y';

  element.style.perspective = '1000px';
  element.style.transformStyle = 'preserve-3d';

  const keyframes = [
    { transform: `rotate${axis}(0deg)` },
    { transform: `rotate${axis}(90deg)` },
    { transform: `rotate${axis}(180deg)` }
  ];

  return applyAnimation(element, keyframes, {
    duration,
    easing: 'ease-in-out'
  });
}

// Adiciona estilos CSS para animações de fallback
if (!document.getElementById('animation-system-styles')) {
  const style = document.createElement('style');
  style.id = 'animation-system-styles';
  style.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
  `;
  document.head.appendChild(style);
}
