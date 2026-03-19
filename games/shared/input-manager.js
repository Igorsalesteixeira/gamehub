/**
 * Módulo de Gerenciamento de Input
 *
 * Centraliza o tratamento de eventos de input:
 * teclado, touch/swipe, mouse e gamepad.
 *
 * @module input-manager
 */

/**
 * Gerenciador unificado de inputs.
 * @class InputManager
 */
export class InputManager {
  /**
   * Cria uma instância de InputManager.
   *
   * @param {Object} options - Opções de configuração
   * @param {HTMLElement} [options.keyboardTarget=document] - Alvo para eventos de teclado
   * @param {HTMLElement} [options.touchTarget=null] - Alvo para eventos de touch
   * @param {HTMLElement} [options.mouseTarget=null] - Alvo para eventos de mouse
   * @param {number} [options.swipeThreshold=30] - Threshold para detectar swipe em pixels
   * @param {number} [options.longPressDelay=500] - Delay para long press em ms
   * @param {boolean} [options.preventDefault=true] - Previne comportamento padrão
   * @param {Object} [options.keyMap={}] - Mapeamento de teclas personalizado
   */
  constructor(options = {}) {
    this.options = {
      keyboardTarget: options.keyboardTarget || document,
      touchTarget: options.touchTarget || null,
      mouseTarget: options.mouseTarget || null,
      swipeThreshold: options.swipeThreshold || 30,
      longPressDelay: options.longPressDelay || 500,
      preventDefault: options.preventDefault ?? true,
      keyMap: options.keyMap || {}
    };

    this._keys = new Map();
    this._keysPressed = new Set();
    this._keysReleased = new Set();
    this._enabled = true;
    this._gamepadIndex = null;
    this._gamepadLoopId = null;

    // Touch state
    this._touchStart = null;
    this._touchStartTime = 0;
    this._longPressTimer = null;
    this._isLongPress = false;

    // Callbacks
    this._callbacks = {
      keyDown: [],
      keyUp: [],
      keyPress: [],
      swipe: [],
      tap: [],
      doubleTap: [],
      longPress: [],
      mouseMove: [],
      mouseDown: [],
      mouseUp: [],
      gamepadConnect: [],
      gamepadDisconnect: [],
      gamepadButton: []
    };

    // Bindings
    this._boundHandlers = {
      keyDown: this._handleKeyDown.bind(this),
      keyUp: this._handleKeyUp.bind(this),
      touchStart: this._handleTouchStart.bind(this),
      touchMove: this._handleTouchMove.bind(this),
      touchEnd: this._handleTouchEnd.bind(this),
      mouseMove: this._handleMouseMove.bind(this),
      mouseDown: this._handleMouseDown.bind(this),
      mouseUp: this._handleMouseUp.bind(this),
      gamepadConnect: this._handleGamepadConnect.bind(this),
      gamepadDisconnect: this._handleGamepadDisconnect.bind(this)
    };

    this._init();
  }

  /**
   * Inicializa listeners.
   * @private
   */
  _init() {
    // Keyboard
    this.options.keyboardTarget.addEventListener('keydown', this._boundHandlers.keyDown);
    this.options.keyboardTarget.addEventListener('keyup', this._boundHandlers.keyUp);

    // Touch
    if (this.options.touchTarget) {
      this.options.touchTarget.addEventListener('touchstart', this._boundHandlers.touchStart, { passive: false });
      this.options.touchTarget.addEventListener('touchmove', this._boundHandlers.touchMove, { passive: false });
      this.options.touchTarget.addEventListener('touchend', this._boundHandlers.touchEnd, { passive: true });
      this.options.touchTarget.addEventListener('touchcancel', this._boundHandlers.touchEnd, { passive: true });
    }

    // Mouse
    if (this.options.mouseTarget) {
      this.options.mouseTarget.addEventListener('mousemove', this._boundHandlers.mouseMove);
      this.options.mouseTarget.addEventListener('mousedown', this._boundHandlers.mouseDown);
      this.options.mouseTarget.addEventListener('mouseup', this._boundHandlers.mouseUp);
    }

    // Gamepad
    window.addEventListener('gamepadconnected', this._boundHandlers.gamepadConnect);
    window.addEventListener('gamepaddisconnected', this._boundHandlers.gamepadDisconnect);
  }

  /**
   * Registra um callback para um evento.
   *
   * @param {string} event - Nome do evento
   * @param {Function} callback - Função callback
   * @returns {Function} Função para remover o listener
   */
  on(event, callback) {
    if (!this._callbacks[event]) {
      console.warn(`[InputManager] Evento desconhecido: ${event}`);
      return () => {};
    }

    this._callbacks[event].push(callback);

    return () => {
      const idx = this._callbacks[event].indexOf(callback);
      if (idx > -1) this._callbacks[event].splice(idx, 1);
    };
  }

  /**
   * Emite evento para callbacks.
   * @private
   */
  _emit(event, ...args) {
    if (!this._enabled) return;

    this._callbacks[event].forEach(cb => {
      try {
        cb(...args);
      } catch (e) {
        console.error(`[InputManager] Erro em callback de ${event}:`, e);
      }
    });
  }

  /**
   * Handler de keydown.
   * @private
   */
  _handleKeyDown(e) {
    if (!this._enabled) return;

    const mappedKey = this.options.keyMap[e.key];
    if (mappedKey && this.options.preventDefault) {
      e.preventDefault();
    }

    this._keys.set(e.key, true);
    this._keysPressed.add(e.key);

    this._emit('keyDown', e.key, e);

    // Key press (único)
    if (!e.repeat) {
      this._emit('keyPress', e.key, e);
    }
  }

  /**
   * Handler de keyup.
   * @private
   */
  _handleKeyUp(e) {
    this._keys.set(e.key, false);
    this._keysPressed.delete(e.key);
    this._keysReleased.add(e.key);
    this._emit('keyUp', e.key, e);
  }

  /**
   * Handler de touchstart.
   * @private
   */
  _handleTouchStart(e) {
    if (!this._enabled) return;

    const touch = e.touches[0];
    this._touchStart = { x: touch.clientX, y: touch.clientY };
    this._touchStartTime = Date.now();
    this._isLongPress = false;

    // Long press detection
    this._longPressTimer = setTimeout(() => {
      this._isLongPress = true;
      this._emit('longPress', { x: touch.clientX, y: touch.clientY });
    }, this.options.longPressDelay);

    if (this.options.preventDefault) {
      e.preventDefault();
    }
  }

  /**
   * Handler de touchmove.
   * @private
   */
  _handleTouchMove(e) {
    if (!this._enabled || !this._touchStart) return;

    // Cancela long press se mover
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }

    if (this.options.preventDefault) {
      e.preventDefault();
    }
  }

  /**
   * Handler de touchend.
   * @private
   */
  _handleTouchEnd(e) {
    if (!this._touchStart) return;

    // Cancela long press
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }

    // Se foi long press, não processa como tap/swipe
    if (this._isLongPress) {
      this._touchStart = null;
      return;
    }

    const touch = e.changedTouches[0];
    const dx = touch.clientX - this._touchStart.x;
    const dy = touch.clientY - this._touchStart.y;
    const dt = Date.now() - this._touchStartTime;

    this._touchStart = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Detecta swipe
    if (absDx > this.options.swipeThreshold || absDy > this.options.swipeThreshold) {
      let direction;
      if (absDx > absDy) {
        direction = dx > 0 ? 'right' : 'left';
      } else {
        direction = dy > 0 ? 'down' : 'up';
      }

      this._emit('swipe', direction, { dx, dy, distance: Math.max(absDx, absDy) });
    } else if (dt < 300) {
      // Tap
      this._emit('tap', { x: touch.clientX, y: touch.clientY });
    }
  }

  /**
   * Handler de mousemove.
   * @private
   */
  _handleMouseMove(e) {
    if (!this._enabled) return;
    this._emit('mouseMove', { x: e.clientX, y: e.clientY, buttons: e.buttons });
  }

  /**
   * Handler de mousedown.
   * @private
   */
  _handleMouseDown(e) {
    if (!this._enabled) return;
    this._emit('mouseDown', { x: e.clientX, y: e.clientY, button: e.button });
  }

  /**
   * Handler de mouseup.
   * @private
   */
  _handleMouseUp(e) {
    if (!this._enabled) return;
    this._emit('mouseUp', { x: e.clientX, y: e.clientY, button: e.button });
  }

  /**
   * Handler de gamepad connect.
   * @private
   */
  _handleGamepadConnect(e) {
    this._gamepadIndex = e.gamepad.index;
    this._startGamepadLoop();
    this._emit('gamepadConnect', e.gamepad);
  }

  /**
   * Handler de gamepad disconnect.
   * @private
   */
  _handleGamepadDisconnect(e) {
    if (this._gamepadIndex === e.gamepad.index) {
      this._gamepadIndex = null;
      this._stopGamepadLoop();
    }
    this._emit('gamepadDisconnect', e.gamepad);
  }

  /**
   * Inicia loop de polling do gamepad.
   * @private
   */
  _startGamepadLoop() {
    const poll = () => {
      if (this._gamepadIndex === null) return;

      const gamepad = navigator.getGamepads()[this._gamepadIndex];
      if (gamepad) {
        gamepad.buttons.forEach((btn, idx) => {
          if (btn.pressed) {
            this._emit('gamepadButton', idx, btn.value, gamepad);
          }
        });
      }

      this._gamepadLoopId = requestAnimationFrame(poll);
    };

    this._gamepadLoopId = requestAnimationFrame(poll);
  }

  /**
   * Para loop de polling do gamepad.
   * @private
   */
  _stopGamepadLoop() {
    if (this._gamepadLoopId) {
      cancelAnimationFrame(this._gamepadLoopId);
      this._gamepadLoopId = null;
    }
  }

  /**
   * Verifica se uma tecla está pressionada.
   *
   * @param {string} key - Nome da tecla
   * @returns {boolean} Se está pressionada
   */
  isKeyDown(key) {
    return !!this._keys.get(key);
  }

  /**
   * Verifica se uma tecla foi pressionada neste frame.
   *
   * @param {string} key - Nome da tecla
   * @returns {boolean} Se foi pressionada
   */
  isKeyPressed(key) {
    return this._keysPressed.has(key);
  }

  /**
   * Verifica se uma tecla foi solta neste frame.
   *
   * @param {string} key - Nome da tecla
   * @returns {boolean} Se foi solta
   */
  isKeyReleased(key) {
    return this._keysReleased.has(key);
  }

  /**
   * Atualiza estado (limpa pressed/released).
   * Chamar no início de cada frame.
   */
  update() {
    this._keysPressed.clear();
    this._keysReleased.clear();
  }

  /**
   * Habilita/desabilita inputs.
   *
   * @param {boolean} enabled - Se deve habilitar
   */
  setEnabled(enabled) {
    this._enabled = enabled;
  }

  /**
   * Verifica se está habilitado.
   * @returns {boolean}
   */
  isEnabled() {
    return this._enabled;
  }

  /**
   * Define mapeamento de teclas.
   *
   * @param {Object} keyMap - Mapeamento { teclaOriginal: teclaMapeada }
   * @example
   * input.setKeyMap({ 'ArrowUp': 'up', 'w': 'up' });
   */
  setKeyMap(keyMap) {
    this.options.keyMap = keyMap;
  }

  /**
   * Adiciona mapeamento de tecla.
   *
   * @param {string} from - Tecla original
   * @param {string} to - Tecla mapeada
   */
  mapKey(from, to) {
    this.options.keyMap[from] = to;
  }

  /**
   * Remove mapeamento de tecla.
   *
   * @param {string} from - Tecla original
   */
  unmapKey(from) {
    delete this.options.keyMap[from];
  }

  /**
   * Limpa todos os mapeamentos.
   */
  clearKeyMap() {
    this.options.keyMap = {};
  }

  /**
   * Destrói o input manager, removendo listeners.
   */
  destroy() {
    this.options.keyboardTarget.removeEventListener('keydown', this._boundHandlers.keyDown);
    this.options.keyboardTarget.removeEventListener('keyup', this._boundHandlers.keyUp);

    if (this.options.touchTarget) {
      this.options.touchTarget.removeEventListener('touchstart', this._boundHandlers.touchStart);
      this.options.touchTarget.removeEventListener('touchmove', this._boundHandlers.touchMove);
      this.options.touchTarget.removeEventListener('touchend', this._boundHandlers.touchEnd);
      this.options.touchTarget.removeEventListener('touchcancel', this._boundHandlers.touchEnd);
    }

    if (this.options.mouseTarget) {
      this.options.mouseTarget.removeEventListener('mousemove', this._boundHandlers.mouseMove);
      this.options.mouseTarget.removeEventListener('mousedown', this._boundHandlers.mouseDown);
      this.options.mouseTarget.removeEventListener('mouseup', this._boundHandlers.mouseUp);
    }

    window.removeEventListener('gamepadconnected', this._boundHandlers.gamepadConnect);
    window.removeEventListener('gamepaddisconnected', this._boundHandlers.gamepadDisconnect);

    this._stopGamepadLoop();

    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
    }
  }
}

/**
 * Cria um input manager para controles direcionais.
 *
 * @param {Object} options - Opções
 * @param {Function} options.onDirectionChange - Callback quando direção muda
 * @returns {InputManager} Input manager configurado
 */
export function createDirectionalInput(options = {}) {
  const input = new InputManager(options);

  let currentDirection = { x: 0, y: 0 };
  let nextDirection = { x: 0, y: 0 };

  const directionMap = {
    'ArrowUp': { x: 0, y: -1 }, 'w': { x: 0, y: -1 }, 'W': { x: 0, y: -1 },
    'ArrowDown': { x: 0, y: 1 }, 's': { x: 0, y: 1 }, 'S': { x: 0, y: 1 },
    'ArrowLeft': { x: -1, y: 0 }, 'a': { x: -1, y: 0 }, 'A': { x: -1, y: 0 },
    'ArrowRight': { x: 1, y: 0 }, 'd': { x: 1, y: 0 }, 'D': { x: 1, y: 0 }
  };

  const swipeMap = {
    'up': { x: 0, y: -1 },
    'down': { x: 0, y: 1 },
    'left': { x: -1, y: 0 },
    'right': { x: 1, y: 0 }
  };

  input.on('keyDown', (key) => {
    const newDir = directionMap[key];
    if (!newDir) return;

    // Previne movimento na direção oposta
    if (currentDirection.x !== 0 && newDir.x === -currentDirection.x) return;
    if (currentDirection.y !== 0 && newDir.y === -currentDirection.y) return;

    nextDirection = newDir;
    if (options.onDirectionChange) {
      options.onDirectionChange(nextDirection);
    }
  });

  input.on('swipe', (direction) => {
    const newDir = swipeMap[direction];
    if (!newDir) return;

    if (currentDirection.x !== 0 && newDir.x === -currentDirection.x) return;
    if (currentDirection.y !== 0 && newDir.y === -currentDirection.y) return;

    nextDirection = newDir;
    if (options.onDirectionChange) {
      options.onDirectionChange(nextDirection);
    }
  });

  return {
    input,
    applyDirection() {
      currentDirection = { ...nextDirection };
      return currentDirection;
    },
    getDirection() {
      return currentDirection;
    },
    setDirection(dir) {
      currentDirection = { ...dir };
      nextDirection = { ...dir };
    },
    reset() {
      currentDirection = { x: 0, y: 0 };
      nextDirection = { x: 0, y: 0 };
    }
  };
}
