/**
 * Módulo Core de Jogos
 *
 * Fornece classes fundamentais para gerenciamento de estatísticas,
 * armazenamento local e comunicação entre componentes.
 *
 * @module game-core
 */

import { supabase } from '../../supabase.js';

/**
 * Gerenciador de estatísticas de jogo com persistência no Supabase.
 * @class GameStats
 */
export class GameStats {
  /**
   * Cria uma instância de GameStats.
   *
   * @param {string} gameId - Identificador único do jogo (ex: 'solitaire', 'chess')
   * @param {Object} options - Opções de configuração
   * @param {boolean} [options.autoSync=true] - Sincroniza automaticamente com Supabase
   * @param {number} [options.syncInterval=30000] - Intervalo de sync em ms (0 = desabilitado)
   */
  constructor(gameId, options = {}) {
    if (!gameId || typeof gameId !== 'string') {
      throw new Error('[GameStats] gameId é obrigatório e deve ser uma string');
    }

    this.gameId = gameId;
    this.options = {
      autoSync: true,
      syncInterval: 30000,
      ...options
    };

    this.stats = this._loadLocal();
    this._syncTimer = null;
    this._pendingSync = false;

    if (this.options.autoSync && this.options.syncInterval > 0) {
      this._startAutoSync();
    }
  }

  /**
   * Carrega estatísticas do localStorage.
   * @private
   * @returns {Object} Estatísticas carregadas ou padrão
   */
  _loadLocal() {
    try {
      const key = `gamehub_stats_${this.gameId}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : this._getDefaultStats();
    } catch (e) {
      console.warn(`[GameStats:${this.gameId}] Erro ao carregar local:`, e);
      return this._getDefaultStats();
    }
  }

  /**
   * Retorna estatísticas padrão.
   * @private
   * @returns {Object} Estatísticas padrão
   */
  _getDefaultStats() {
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      totalTime: 0,
      bestTime: null,
      highScore: 0,
      totalScore: 0,
      lastPlayed: null,
      streak: 0,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Salva estatísticas no localStorage.
   * @private
   */
  _saveLocal() {
    try {
      const key = `gamehub_stats_${this.gameId}`;
      localStorage.setItem(key, JSON.stringify(this.stats));
    } catch (e) {
      console.warn(`[GameStats:${this.gameId}] Erro ao salvar local:`, e);
    }
  }

  /**
   * Inicia sincronização automática.
   * @private
   */
  _startAutoSync() {
    this._syncTimer = setInterval(() => {
      if (this._pendingSync) {
        this.syncToCloud();
      }
    }, this.options.syncInterval);
  }

  /**
   * Para a sincronização automática.
   */
  stopAutoSync() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  }

  /**
   * Atualiza uma ou mais estatísticas.
   *
   * @param {Object} updates - Objeto com valores a atualizar
   * @returns {Object} Estatísticas atualizadas
   *
   * @example
   * stats.update({ gamesPlayed: 1, highScore: 5000 });
   * stats.update({ gamesWon: (v) => v + 1 }); // usando função
   */
  update(updates) {
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'function') {
        this.stats[key] = value(this.stats[key]);
      } else {
        this.stats[key] = value;
      }
    }

    this.stats.lastPlayed = new Date().toISOString();
    this._saveLocal();
    this._pendingSync = true;

    return { ...this.stats };
  }

  /**
   * Incrementa contadores de jogo.
   *
   * @param {boolean} won - Se o jogo foi vencido
   * @param {Object} extra - Dados extras (score, time, etc.)
   */
  recordGame(won, extra = {}) {
    this.update({
      gamesPlayed: (v) => v + 1,
      gamesWon: (v) => won ? v + 1 : v,
      gamesLost: (v) => won ? v : v + 1,
      streak: (v) => won ? v + 1 : 0
    });

    if (extra.score !== undefined) {
      this.update({
        highScore: (v) => Math.max(v, extra.score),
        totalScore: (v) => v + extra.score
      });
    }

    if (extra.time !== undefined) {
      this.update({
        totalTime: (v) => v + extra.time,
        bestTime: (v) => v === null ? extra.time : Math.min(v, extra.time)
      });
    }
  }

  /**
   * Retorna cópia das estatísticas atuais.
   * @returns {Object} Estatísticas
   */
  get() {
    return { ...this.stats };
  }

  /**
   * Reseta todas as estatísticas.
   * @param {boolean} [sync=true] - Sincroniza com nuvem após reset
   */
  reset(sync = true) {
    this.stats = this._getDefaultStats();
    this._saveLocal();
    this._pendingSync = true;

    if (sync) {
      return this.syncToCloud();
    }
  }

  /**
   * Sincroniza estatísticas com Supabase.
   *
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async syncToCloud() {
    let user = null;
    try {
      const res = await supabase.auth.getUser();
      user = res?.data?.user;
    } catch { /* auth indisponível */ }
    if (!user) {
      console.log(`[GameStats:${this.gameId}] Usuário não logado, pulando sync`);
      return false;
    }

    try {
      const { error } = await supabase
        .from('game_stats')
        .upsert({
          user_id: user.id,
          game_id: this.gameId,
          stats: this.stats,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,game_id'
        });

      if (error) throw error;

      this._pendingSync = false;
      return true;
    } catch (e) {
      console.error(`[GameStats:${this.gameId}] Erro no sync:`, e);
      return false;
    }
  }

  /**
   * Carrega estatísticas do Supabase (mescla com local).
   *
   * @returns {Promise<boolean>} Sucesso da operação
   */
  async loadFromCloud() {
    let user = null;
    try {
      const res = await supabase.auth.getUser();
      user = res?.data?.user;
    } catch { /* auth indisponível */ }
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('game_stats')
        .select('stats')
        .eq('user_id', user.id)
        .eq('game_id', this.gameId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

      if (data?.stats) {
        // Mescla: mantém o maior valor para contadores
        this.stats = {
          ...this._getDefaultStats(),
          ...data.stats,
          gamesPlayed: Math.max(this.stats.gamesPlayed, data.stats.gamesPlayed || 0),
          gamesWon: Math.max(this.stats.gamesWon, data.stats.gamesWon || 0),
          highScore: Math.max(this.stats.highScore, data.stats.highScore || 0)
        };
        this._saveLocal();
      }

      return true;
    } catch (e) {
      console.error(`[GameStats:${this.gameId}] Erro ao carregar da nuvem:`, e);
      return false;
    }
  }

  /**
   * Destrói a instância, limpando timers.
   */
  destroy() {
    this.stopAutoSync();
  }
}

/**
 * Wrapper para localStorage com namespace.
 * Previne colisões entre jogos.
 * @class GameStorage
 */
export class GameStorage {
  /**
   * Cria uma instância de GameStorage.
   *
   * @param {string} namespace - Namespace para isolamento (ex: 'solitaire')
   * @param {Object} options - Opções
   * @param {boolean} [options.encrypt=false] - Criptografa dados (simples)
   */
  constructor(namespace, options = {}) {
    if (!namespace) {
      throw new Error('[GameStorage] namespace é obrigatório');
    }

    this.namespace = `gamehub_${namespace}`;
    this.options = options;
  }

  /**
   * Gera chave completa com namespace.
   * @private
   * @param {string} key - Chave original
   * @returns {string} Chave com namespace
   */
  _key(key) {
    return `${this.namespace}_${key}`;
  }

  /**
   * Salva um valor.
   *
   * @param {string} key - Chave
   * @param {*} value - Valor (será serializado)
   * @returns {boolean} Sucesso
   */
  set(key, value) {
    try {
      const data = JSON.stringify({
        value,
        timestamp: Date.now()
      });
      localStorage.setItem(this._key(key), data);
      return true;
    } catch (e) {
      console.warn(`[GameStorage] Erro ao salvar ${key}:`, e);
      return false;
    }
  }

  /**
   * Recupera um valor.
   *
   * @param {string} key - Chave
   * @param {*} [defaultValue=null] - Valor padrão se não existir
   * @returns {*} Valor armazenado ou default
   */
  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(this._key(key));
      if (!data) return defaultValue;

      const parsed = JSON.parse(data);
      return parsed.value;
    } catch (e) {
      console.warn(`[GameStorage] Erro ao ler ${key}:`, e);
      return defaultValue;
    }
  }

  /**
   * Remove um valor.
   *
   * @param {string} key - Chave
   * @returns {boolean} Sucesso
   */
  remove(key) {
    try {
      localStorage.removeItem(this._key(key));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Verifica se chave existe.
   *
   * @param {string} key - Chave
   * @returns {boolean} Se existe
   */
  has(key) {
    return localStorage.getItem(this._key(key)) !== null;
  }

  /**
   * Retorna todas as chaves do namespace.
   *
   * @returns {string[]} Lista de chaves (sem prefixo)
   */
  keys() {
    const keys = [];
    const prefix = this._key('');

    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey?.startsWith(prefix)) {
        keys.push(fullKey.slice(prefix.length));
      }
    }

    return keys;
  }

  /**
   * Limpa todos os valores do namespace.
   *
   * @returns {number} Quantidade de itens removidos
   */
  clear() {
    const keys = this.keys();
    keys.forEach(key => this.remove(key));
    return keys.length;
  }

  /**
   * Salva estado de jogo (com validação).
   *
   * @param {string} slot - Nome do slot de save
   * @param {Object} state - Estado do jogo
   * @returns {boolean} Sucesso
   */
  saveGame(slot, state) {
    return this.set(`save_${slot}`, {
      state,
      savedAt: new Date().toISOString(),
      version: 1
    });
  }

  /**
   * Carrega estado de jogo.
   *
   * @param {string} slot - Nome do slot
   * @returns {Object|null} Estado do jogo ou null
   */
  loadGame(slot) {
    const data = this.get(`save_${slot}`);
    return data?.state || null;
  }

  /**
   * Lista slots de save disponíveis.
   *
   * @returns {Array<{slot: string, savedAt: string}>} Slots disponíveis
   */
  listSaves() {
    return this.keys()
      .filter(k => k.startsWith('save_'))
      .map(k => {
        const data = this.get(k);
        return {
          slot: k.slice(5),
          savedAt: data?.savedAt
        };
      })
      .filter(Boolean);
  }
}

/**
 * Gerenciador de melhor pontuação usando localStorage.
 * @class BestScoreManager
 */
export class BestScoreManager {
  constructor(gameId) {
    this.key = `best_score_${gameId}`;
  }

  get() {
    return parseInt(localStorage.getItem(this.key)) || 0;
  }

  checkAndUpdate(score) {
    const best = this.get();
    if (score > best) {
      localStorage.setItem(this.key, score);
      return true;
    }
    return false;
  }
}

/**
 * Implementação do padrão Observer para comunicação entre componentes.
 * @class EventEmitter
 */
export class EventEmitter {
  constructor() {
    this._events = new Map();
    this._once = new WeakSet();
  }

  /**
   * Registra um listener para um evento.
   *
   * @param {string} event - Nome do evento
   * @param {Function} listener - Função callback
   * @param {Object} [options] - Opções
   * @param {boolean} [options.once=false] - Executa apenas uma vez
   * @returns {Function} Função para remover o listener
   *
   * @example
   * const remove = emitter.on('score', (points) => console.log(points));
   * remove(); // remove o listener
   */
  on(event, listener, options = {}) {
    if (typeof listener !== 'function') {
      throw new Error('[EventEmitter] listener deve ser uma função');
    }

    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }

    const listeners = this._events.get(event);

    if (options.once) {
      const wrapped = (...args) => {
        this.off(event, wrapped);
        listener(...args);
      };
      listeners.add(wrapped);
      return () => this.off(event, wrapped);
    } else {
      listeners.add(listener);
      return () => this.off(event, listener);
    }
  }

  /**
   * Registra um listener que executa apenas uma vez.
   *
   * @param {string} event - Nome do evento
   * @param {Function} listener - Função callback
   * @returns {Function} Função para remover
   */
  once(event, listener) {
    return this.on(event, listener, { once: true });
  }

  /**
   * Remove um listener.
   *
   * @param {string} event - Nome do evento
   * @param {Function} listener - Função a remover
   * @returns {boolean} Se o listener foi removido
   */
  off(event, listener) {
    const listeners = this._events.get(event);
    if (!listeners) return false;

    return listeners.delete(listener);
  }

  /**
   * Emite um evento para todos os listeners.
   *
   * @param {string} event - Nome do evento
   * @param {...*} args - Argumentos para os listeners
   * @returns {boolean} Se algum listener foi chamado
   */
  emit(event, ...args) {
    const listeners = this._events.get(event);
    if (!listeners || listeners.size === 0) return false;

    listeners.forEach(listener => {
      try {
        listener(...args);
      } catch (e) {
        console.error(`[EventEmitter] Erro em listener de ${event}:`, e);
      }
    });

    return true;
  }

  /**
   * Emite evento com resultado agregado.
   *
   * @param {string} event - Nome do evento
   * @param {...*} args - Argumentos
   * @returns {Array} Resultados dos listeners
   */
  emitWithResults(event, ...args) {
    const listeners = this._events.get(event);
    if (!listeners) return [];

    const results = [];
    listeners.forEach(listener => {
      try {
        results.push(listener(...args));
      } catch (e) {
        console.error(`[EventEmitter] Erro em listener de ${event}:`, e);
      }
    });

    return results;
  }

  /**
   * Remove todos os listeners de um evento.
   *
   * @param {string} [event] - Nome do evento (omitir para limpar tudo)
   */
  removeAllListeners(event) {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
  }

  /**
   * Retorna quantidade de listeners para um evento.
   *
   * @param {string} event - Nome do evento
   * @returns {number} Quantidade de listeners
   */
  listenerCount(event) {
    return this._events.get(event)?.size || 0;
  }

  /**
   * Retorna nomes de eventos registrados.
   *
   * @returns {string[]} Nomes dos eventos
   */
  eventNames() {
    return Array.from(this._events.keys());
  }
}
