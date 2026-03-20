/**
 * Sistema de Hooks Event-Driven para Game Hub
 *
 * Fornece uma implementação de EventEmitter especializada para jogos,
 * com eventos predefinidos e APIs para comunicação entre componentes.
 *
 * @module hooks
 */

/**
 * Eventos predefinidos do sistema de hooks.
 * @readonly
 * @enum {string}
 */
export const GameEvents = {
  // Ciclo de vida do jogo
  GAME_START: 'game:start',
  GAME_END: 'game:end',
  GAME_WIN: 'game:win',
  GAME_LOSE: 'game:lose',

  // Movimentos
  MOVE_VALID: 'move:valid',
  MOVE_INVALID: 'move:invalid',

  // Conquistas
  ACHIEVEMENT_UNLOCK: 'achievement:unlock',

  // Multiplayer
  MULTIPLAYER_OPPONENT_JOIN: 'multiplayer:opponent:join',
  MULTIPLAYER_OPPONENT_LEAVE: 'multiplayer:opponent:leave'
};

/**
 * Sistema de Hooks Event-Driven para jogos.
 *
 * Gerencia eventos e listeners permitindo comunicação
 * desacoplada entre componentes do jogo.
 *
 * @class GameHooks
 *
 * @example
 * const hooks = new GameHooks();
 *
 * hooks.on('game:win', ({ gameId, score, time }) => {
 *   console.log(`Vitória em ${gameId}! Score: ${score}`);
 * });
 *
 * hooks.emit('game:win', { gameId: 'chess', score: 100, time: 120 });
 */
export class GameHooks {
  /**
   * Cria uma instância de GameHooks.
   *
   * @param {Object} options - Opções de configuração
   * @param {boolean} [options.strictMode=false] - Se true, emite aviso para eventos não predefinidos
   * @param {string} [options.gameId=null] - ID do jogo para contexto
   */
  constructor(options = {}) {
    this.options = {
      strictMode: false,
      gameId: null,
      ...options
    };

    /** @private @type {Map<string, Set<Function>>} */
    this._listeners = new Map();

    /** @private @type {Map<string, Set<Function>>} */
    this._onceListeners = new Map();

    /** @private @type {WeakMap<Function, Function>} */
    this._wrappedListeners = new WeakMap();
  }

  /**
   * Verifica se um evento é predefinido.
   *
   * @private
   * @param {string} event - Nome do evento
   * @returns {boolean} Se o evento é predefinido
   */
  _isPredefinedEvent(event) {
    return Object.values(GameEvents).includes(event);
  }

  /**
   * Registra um listener para um evento.
   *
   * @param {string} event - Nome do evento
   * @param {Function} listener - Função callback que recebe os dados do evento
   * @returns {Function} Função para remover o listener (única forma de remover callbacks anônimos)
   *
   * @example
   * const remove = hooks.on('game:win', ({ score }) => console.log(score));
   * remove(); // Remove o listener
   */
  on(event, listener) {
    if (typeof event !== 'string') {
      throw new Error('[GameHooks] event deve ser uma string');
    }

    if (typeof listener !== 'function') {
      throw new Error('[GameHooks] listener deve ser uma função');
    }

    if (this.options.strictMode && !this._isPredefinedEvent(event)) {
      console.warn(`[GameHooks] Evento não predefinido: ${event}`);
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }

    this._listeners.get(event).add(listener);

    // Retorna função de unsubscribe
    return () => this.off(event, listener);
  }

  /**
   * Registra um listener que executa apenas uma vez.
   *
   * @param {string} event - Nome do evento
   * @param {Function} listener - Função callback
   * @returns {Function} Função para remover o listener
   *
   * @example
   * hooks.once('game:start', () => console.log('Primeira partida iniciada!'));
   */
  once(event, listener) {
    if (typeof event !== 'string') {
      throw new Error('[GameHooks] event deve ser uma string');
    }

    if (typeof listener !== 'function') {
      throw new Error('[GameHooks] listener deve ser uma função');
    }

    if (!this._onceListeners.has(event)) {
      this._onceListeners.set(event, new Set());
    }

    // Cria wrapper que remove o listener após execução
    const wrappedListener = (data) => {
      this.off(event, wrappedListener);
      listener(data);
    };

    // Guarda referência para poder remover via off()
    this._wrappedListeners.set(listener, wrappedListener);
    this._onceListeners.get(event).add(listener);

    // Registra o wrapped como listener normal
    return this.on(event, wrappedListener);
  }

  /**
   * Remove um listener de um evento.
   *
   * @param {string} event - Nome do evento
   * @param {Function} listener - Função a ser removida (a função original, não o wrapper)
   * @returns {boolean} Se o listener foi encontrado e removido
   *
   * @example
   * const onWin = ({ score }) => console.log(score);
   * hooks.on('game:win', onWin);
   * hooks.off('game:win', onWin); // true
   */
  off(event, listener) {
    if (typeof event !== 'string') {
      throw new Error('[GameHooks] event deve ser uma string');
    }

    if (typeof listener !== 'function') {
      return false;
    }

    let removed = false;

    // Tenta remover de listeners normais
    const listeners = this._listeners.get(event);
    if (listeners) {
      removed = listeners.delete(listener) || removed;

      // Limpa o Set vazio
      if (listeners.size === 0) {
        this._listeners.delete(event);
      }
    }

    // Tenta remover de once listeners (usa o wrapper guardado)
    const onceListeners = this._onceListeners.get(event);
    if (onceListeners) {
      // Verifica se o listener original está registrado em once
      if (onceListeners.has(listener)) {
        onceListeners.delete(listener);

        // Remove o wrapper correspondente dos listeners normais
        const wrapped = this._wrappedListeners.get(listener);
        if (wrapped && listeners) {
          listeners.delete(wrapped);
        }

        removed = true;

        // Limpa o Set vazio
        if (onceListeners.size === 0) {
          this._onceListeners.delete(event);
        }
      }
    }

    return removed;
  }

  /**
   * Emite um evento para todos os listeners registrados.
   *
   * @param {string} event - Nome do evento
   * @param {Object} [data={}] - Dados a serem passados para os listeners
   * @returns {boolean} Se algum listener foi chamado
   *
   * @example
   * hooks.emit('game:win', { gameId: 'chess', score: 100, time: 120 });
   * hooks.emit('move:valid', { from: 'e2', to: 'e4', piece: 'pawn' });
   */
  emit(event, data = {}) {
    if (typeof event !== 'string') {
      throw new Error('[GameHooks] event deve ser uma string');
    }

    const listeners = this._listeners.get(event);
    const onceListeners = this._onceListeners.get(event);

    const hasListeners = (listeners && listeners.size > 0) || (onceListeners && onceListeners.size > 0);

    if (!hasListeners) {
      return false;
    }

    // Enriquece os dados com metadados
    const enrichedData = {
      ...data,
      _event: event,
      _timestamp: Date.now(),
      _gameId: this.options.gameId
    };

    // Executa listeners normais
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(enrichedData);
        } catch (error) {
          console.error(`[GameHooks] Erro ao executar listener de "${event}":`, error);
        }
      });
    }

    // Executa once listeners e remove
    if (onceListeners) {
      // Cria uma cópia para iterar pois o wrapped listener remove do original
      const onceCopy = new Set(onceListeners);
      onceCopy.forEach(listener => {
        try {
          // Chama o listener original, não o wrapped
          listener(enrichedData);
        } catch (error) {
          console.error(`[GameHooks] Erro ao executar once listener de "${event}":`, error);
        }
      });
      // Limpa todos os once listeners deste evento
      onceListeners.clear();
      this._onceListeners.delete(event);
    }

    return true;
  }

  /**
   * Retorna a quantidade de listeners registrados para um evento.
   *
   * @param {string} event - Nome do evento
   * @returns {number} Quantidade de listeners
   *
   * @example
   * hooks.on('game:win', () => {});
   * hooks.on('game:win', () => {});
   * hooks.listenerCount('game:win'); // 2
   */
  listenerCount(event) {
    if (typeof event !== 'string') {
      return 0;
    }

    const count = this._listeners.get(event)?.size || 0;
    const onceCount = this._onceListeners.get(event)?.size || 0;

    return count + onceCount;
  }

  /**
   * Retorna os nomes de todos os eventos que possuem listeners.
   *
   * @returns {string[]} Array com nomes dos eventos
   *
   * @example
   * hooks.on('game:win', () => {});
   * hooks.on('game:end', () => {});
   * hooks.eventNames(); // ['game:win', 'game:end']
   */
  eventNames() {
    const names = new Set();

    this._listeners.forEach((_, event) => names.add(event));
    this._onceListeners.forEach((_, event) => names.add(event));

    return Array.from(names);
  }

  /**
   * Remove todos os listeners de um evento específico ou de todos os eventos.
   *
   * @param {string} [event] - Nome do evento (omitir para limpar todos)
   * @returns {number} Quantidade de listeners removidos
   *
   * @example
   * hooks.removeAllListeners('game:win'); // Remove listeners de 'game:win'
   * hooks.removeAllListeners(); // Remove todos os listeners
   */
  removeAllListeners(event) {
    if (event) {
      const count = this.listenerCount(event);
      this._listeners.delete(event);
      this._onceListeners.delete(event);
      return count;
    }

    let totalCount = 0;
    this._listeners.forEach((set, ev) => {
      totalCount += set.size;
    });
    this._onceListeners.forEach((set, ev) => {
      totalCount += set.size;
    });

    this._listeners.clear();
    this._onceListeners.clear();

    return totalCount;
  }

  /**
   * Verifica se há listeners registrados para um evento.
   *
   * @param {string} event - Nome do evento
   * @returns {boolean} Se existe pelo menos um listener
   */
  hasListeners(event) {
    return this.listenerCount(event) > 0;
  }

  /**
   * Destrói a instância, removendo todos os listeners.
   */
  destroy() {
    this.removeAllListeners();
  }
}

/**
 * Cria uma instância global de GameHooks para uso compartilhado.
 *
 * Útil para cenários onde múltiplos componentes precisam
 * compartilhar o mesmo bus de eventos.
 *
 * @returns {GameHooks} Instância compartilhada
 *
 * @example
 * import { createGlobalHooks } from './hooks.js';
 *
 * const hooks = createGlobalHooks();
 * hooks.on('game:win', handleWin);
 */
let globalHooksInstance = null;

export function createGlobalHooks() {
  if (!globalHooksInstance) {
    globalHooksInstance = new GameHooks({ strictMode: true });
  }
  return globalHooksInstance;
}

/**
 * Reseta a instância global (útil para testes).
 */
export function resetGlobalHooks() {
  if (globalHooksInstance) {
    globalHooksInstance.destroy();
    globalHooksInstance = null;
  }
}
