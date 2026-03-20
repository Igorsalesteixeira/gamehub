/**
 * State Store - IndexedDB
 *
 * Gerenciamento persistente de estado de jogos, histórico e analytics
 * usando IndexedDB para armazenamento local.
 *
 * @module state-store
 * @example
 * import { GameStateStore } from '../shared/state-store.js';
 * const store = new GameStateStore();
 * await store.saveGame('chess', 'slot1', { board: [...] });
 */

const DB_NAME = 'GameHubDB';
const DB_VERSION = 1;

/**
 * Store names no IndexedDB
 * @readonly
 * @enum {string}
 */
const STORES = {
  SAVES: 'saves',
  HISTORY: 'history',
  ANALYTICS: 'analytics'
};

/**
 * Classe principal para gerenciamento de estado persistente.
 * Utiliza IndexedDB para armazenamento local estruturado.
 *
 * @class GameStateStore
 * @example
 * const store = new GameStateStore();
 * await store.init();
 * await store.saveGame('solitaire', 'auto', gameState);
 */
export class GameStateStore {
  /**
   * Cria uma instância do GameStateStore.
   * Chame `init()` antes de usar outros métodos.
   */
  constructor() {
    /** @private @type {IDBDatabase|null} */
    this._db = null;
    /** @private @type {boolean} */
    this._initialized = false;
  }

  /**
   * Inicializa a conexão com o IndexedDB.
   * Cria os object stores se não existirem.
   *
   * @returns {Promise<boolean>} True se inicializado com sucesso
   * @throws {Error} Se o IndexedDB não for suportado
   */
  async init() {
    if (this._initialized) return true;

    if (!window.indexedDB) {
      throw new Error('[GameStateStore] IndexedDB não suportado neste navegador');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`[GameStateStore] Erro ao abrir DB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this._db = request.result;
        this._initialized = true;

        this._db.onerror = (event) => {
          console.error('[GameStateStore] Erro no database:', event.target.error);
        };

        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store para saves de jogos
        if (!db.objectStoreNames.contains(STORES.SAVES)) {
          const savesStore = db.createObjectStore(STORES.SAVES, { keyPath: 'id' });
          savesStore.createIndex('gameId', 'gameId', { unique: false });
          savesStore.createIndex('slot', 'slot', { unique: false });
          savesStore.createIndex('gameId_slot', ['gameId', 'slot'], { unique: true });
          savesStore.createIndex('savedAt', 'savedAt', { unique: false });
        }

        // Store para histórico de partidas
        if (!db.objectStoreNames.contains(STORES.HISTORY)) {
          const historyStore = db.createObjectStore(STORES.HISTORY, {
            keyPath: 'id',
            autoIncrement: true
          });
          historyStore.createIndex('gameId', 'gameId', { unique: false });
          historyStore.createIndex('playedAt', 'playedAt', { unique: false });
          historyStore.createIndex('gameId_playedAt', ['gameId', 'playedAt'], { unique: false });
        }

        // Store para analytics/eventos
        if (!db.objectStoreNames.contains(STORES.ANALYTICS)) {
          const analyticsStore = db.createObjectStore(STORES.ANALYTICS, {
            keyPath: 'id',
            autoIncrement: true
          });
          analyticsStore.createIndex('gameId', 'gameId', { unique: false });
          analyticsStore.createIndex('event', 'event', { unique: false });
          analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
          analyticsStore.createIndex('synced', 'synced', { unique: false });
          analyticsStore.createIndex('gameId_timestamp', ['gameId', 'timestamp'], { unique: false });
        }
      };
    });
  }

  /**
   * Gera ID único para um save.
   * @private
   * @param {string} gameId
   * @param {string} slot
   * @returns {string}
   */
  _makeSaveId(gameId, slot) {
    return `${gameId}::${slot}`;
  }

  /**
   * Executa operação em uma transaction.
   * @private
   * @param {string} storeName
   * @param {string} mode
   * @param {Function} operation
   * @returns {Promise<*>}
   */
  async _transaction(storeName, mode, operation) {
    if (!this._initialized) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this._db.transaction([storeName], mode);
      const store = transaction.objectStore(storeName);

      transaction.onerror = () => {
        reject(new Error(`[GameStateStore] Transaction error: ${transaction.error?.message}`));
      };

      try {
        const result = operation(store);
        if (result instanceof IDBRequest) {
          result.onsuccess = () => resolve(result.result);
          result.onerror = () => reject(result.error);
        } else {
          resolve(result);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Salva o estado de um jogo em um slot específico.
   *
   * @param {string} gameId - Identificador do jogo (ex: 'solitaire', 'chess')
   * @param {string} slot - Nome do slot (ex: 'auto', 'manual', 'quicksave')
   * @param {Object} state - Estado do jogo a ser salvo
   * @returns {Promise<boolean>} True se salvo com sucesso
   *
   * @example
   * await store.saveGame('solitaire', 'auto', {
   *   board: [...],
   *   score: 1500,
   *   moves: 42
   * });
   */
  async saveGame(gameId, slot, state) {
    if (!gameId || typeof gameId !== 'string') {
      throw new Error('[GameStateStore] gameId é obrigatório');
    }
    if (!slot || typeof slot !== 'string') {
      throw new Error('[GameStateStore] slot é obrigatório');
    }

    const saveData = {
      id: this._makeSaveId(gameId, slot),
      gameId,
      slot,
      state,
      savedAt: new Date().toISOString(),
      version: 1
    };

    return this._transaction(STORES.SAVES, 'readwrite', (store) => {
      const request = store.put(saveData);
      return request;
    }).then(() => true).catch((e) => {
      console.error(`[GameStateStore] Erro ao salvar ${gameId}/${slot}:`, e);
      return false;
    });
  }

  /**
   * Carrega o estado de um jogo de um slot específico.
   *
   * @param {string} gameId - Identificador do jogo
   * @param {string} slot - Nome do slot
   * @returns {Promise<Object|null>} Estado do jogo ou null se não encontrado
   *
   * @example
   * const state = await store.loadGame('solitaire', 'auto');
   * if (state) {
   *   restoreGame(state);
   * }
   */
  async loadGame(gameId, slot) {
    if (!gameId || !slot) {
      throw new Error('[GameStateStore] gameId e slot são obrigatórios');
    }

    return this._transaction(STORES.SAVES, 'readonly', (store) => {
      const request = store.get(this._makeSaveId(gameId, slot));
      return request;
    }).then((result) => result?.state || null).catch((e) => {
      console.error(`[GameStateStore] Erro ao carregar ${gameId}/${slot}:`, e);
      return null;
    });
  }

  /**
   * Lista todos os slots disponíveis para um jogo.
   *
   * @param {string} gameId - Identificador do jogo
   * @returns {Promise<Array<{slot: string, savedAt: string, version: number}>>}
   *          Lista de slots ordenados por data (mais recente primeiro)
   *
   * @example
   * const saves = await store.listSaves('solitaire');
   * // [{ slot: 'auto', savedAt: '2024-01-15T10:30:00Z', version: 1 }, ...]
   */
  async listSaves(gameId) {
    if (!gameId) {
      throw new Error('[GameStateStore] gameId é obrigatório');
    }

    return this._transaction(STORES.SAVES, 'readonly', (store) => {
      const index = store.index('gameId');
      const request = index.getAll(gameId);
      return request;
    }).then((results) => {
      return results
        .map(r => ({ slot: r.slot, savedAt: r.savedAt, version: r.version }))
        .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    }).catch((e) => {
      console.error(`[GameStateStore] Erro ao listar saves de ${gameId}:`, e);
      return [];
    });
  }

  /**
   * Deleta um slot de save específico.
   *
   * @param {string} gameId - Identificador do jogo
   * @param {string} slot - Nome do slot
   * @returns {Promise<boolean>} True se deletado com sucesso
   *
   * @example
   * await store.deleteSave('solitaire', 'old-save');
   */
  async deleteSave(gameId, slot) {
    if (!gameId || !slot) {
      throw new Error('[GameStateStore] gameId e slot são obrigatórios');
    }

    return this._transaction(STORES.SAVES, 'readwrite', (store) => {
      const request = store.delete(this._makeSaveId(gameId, slot));
      return request;
    }).then(() => true).catch((e) => {
      console.error(`[GameStateStore] Erro ao deletar ${gameId}/${slot}:`, e);
      return false;
    });
  }

  /**
   * Deleta todos os saves de um jogo.
   *
   * @param {string} gameId - Identificador do jogo
   * @returns {Promise<number>} Quantidade de saves deletados
   */
  async deleteAllSaves(gameId) {
    if (!gameId) {
      throw new Error('[GameStateStore] gameId é obrigatório');
    }

    const saves = await this.listSaves(gameId);
    let deleted = 0;

    for (const save of saves) {
      if (await this.deleteSave(gameId, save.slot)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Registra um evento para analytics.
   * Eventos são armazenados com timestamp e podem ser sincronizados depois.
   *
   * @param {string} gameId - Identificador do jogo
   * @param {string} event - Nome do evento (ex: 'game_start', 'level_complete', 'move')
   * @param {Object} [data={}] - Dados adicionais do evento
   * @returns {Promise<boolean>} True se registrado com sucesso
   *
   * @example
   * await store.logEvent('solitaire', 'move', {
   *   from: 'column1',
   *   to: 'foundation',
   *   card: 'hearts_A'
   * });
   */
  async logEvent(gameId, event, data = {}) {
    if (!gameId || !event) {
      throw new Error('[GameStateStore] gameId e event são obrigatórios');
    }

    const eventData = {
      gameId,
      event,
      data,
      timestamp: new Date().toISOString(),
      synced: false
    };

    return this._transaction(STORES.ANALYTICS, 'readwrite', (store) => {
      const request = store.add(eventData);
      return request;
    }).then(() => true).catch((e) => {
      console.error(`[GameStateStore] Erro ao logar evento ${event}:`, e);
      return false;
    });
  }

  /**
   * Registra o resultado de uma partida no histórico.
   *
   * @param {string} gameId - Identificador do jogo
   * @param {Object} result - Resultado da partida
   * @param {boolean} result.won - Se o jogo foi vencido
   * @param {number} [result.score] - Pontuação
   * @param {number} [result.time] - Tempo em segundos
   * @param {Object} [result.extra] - Dados extras
   * @returns {Promise<boolean>} True se registrado com sucesso
   */
  async recordGameResult(gameId, { won, score, time, extra = {} }) {
    if (!gameId) {
      throw new Error('[GameStateStore] gameId é obrigatório');
    }

    const historyEntry = {
      gameId,
      won: Boolean(won),
      score: score ?? null,
      time: time ?? null,
      extra,
      playedAt: new Date().toISOString()
    };

    return this._transaction(STORES.HISTORY, 'readwrite', (store) => {
      const request = store.add(historyEntry);
      return request;
    }).then(() => true).catch((e) => {
      console.error(`[GameStateStore] Erro ao registrar resultado:`, e);
      return false;
    });
  }

  /**
   * Obtém o histórico de partidas de um jogo.
   *
   * @param {string} gameId - Identificador do jogo
   * @param {Object} [options={}] - Opções de filtro
   * @param {number} [options.limit=50] - Máximo de registros
   * @param {number} [options.offset=0] - Offset para paginação
   * @param {string} [options.since] - Data ISO mínima (inclusive)
   * @param {string} [options.until] - Data ISO máxima (inclusive)
   * @returns {Promise<Array<Object>>} Lista de partidas
   *
   * @example
   * const history = await store.getGameHistory('solitaire', { limit: 10 });
   */
  async getGameHistory(gameId, options = {}) {
    if (!gameId) {
      throw new Error('[GameStateStore] gameId é obrigatório');
    }

    const { limit = 50, offset = 0, since, until } = options;

    return this._transaction(STORES.HISTORY, 'readonly', (store) => {
      const index = store.index('gameId_playedAt');
      const range = since || until
        ? IDBKeyRange.bound(
            [gameId, since || ''],
            [gameId, until || '\uffff']
          )
        : IDBKeyRange.only(gameId);

      const request = index.openCursor(range, 'prev');
      const results = [];
      let skipped = 0;

      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) {
            resolve(results);
            return;
          }

          if (skipped < offset) {
            skipped++;
            cursor.continue();
            return;
          }

          if (results.length < limit) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => reject(request.error);
      });
    }).catch((e) => {
      console.error(`[GameStateStore] Erro ao obter histórico:`, e);
      return [];
    });
  }

  /**
   * Obtém analytics agregados de um jogo.
   *
   * @param {string} gameId - Identificador do jogo
   * @param {string} [period='day'] - Período ('day', 'week', 'month', 'all')
   * @returns {Promise<Object>} Analytics agregados
   *
   * @example
   * const analytics = await store.getAnalytics('solitaire', 'week');
   * // {
   * //   period: 'week',
   * //   gamesPlayed: 15,
   * //   gamesWon: 8,
   * //   winRate: 0.53,
   * //   totalScore: 12500,
   * //   avgScore: 833,
   * //   bestScore: 2500,
   * //   totalTime: 3600,
   * //   avgTime: 240
   * // }
   */
  async getAnalytics(gameId, period = 'day') {
    if (!gameId) {
      throw new Error('[GameStateStore] gameId é obrigatório');
    }

    const now = new Date();
    let since;

    switch (period) {
      case 'day':
        since = new Date(now.setDate(now.getDate() - 1)).toISOString();
        break;
      case 'week':
        since = new Date(now.setDate(now.getDate() - 7)).toISOString();
        break;
      case 'month':
        since = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
        break;
      case 'all':
        since = null;
        break;
      default:
        throw new Error(`[GameStateStore] Período inválido: ${period}`);
    }

    const history = await this.getGameHistory(gameId, {
      limit: 10000,
      since: since || undefined
    });

    if (history.length === 0) {
      return {
        period,
        gamesPlayed: 0,
        gamesWon: 0,
        winRate: 0,
        totalScore: 0,
        avgScore: 0,
        bestScore: 0,
        totalTime: 0,
        avgTime: 0
      };
    }

    const gamesPlayed = history.length;
    const gamesWon = history.filter(h => h.won).length;
    const scores = history.map(h => h.score).filter(s => s !== null);
    const times = history.map(h => h.time).filter(t => t !== null);

    const totalScore = scores.reduce((a, b) => a + b, 0);
    const totalTime = times.reduce((a, b) => a + b, 0);

    return {
      period,
      gamesPlayed,
      gamesWon,
      winRate: gamesPlayed > 0 ? gamesWon / gamesPlayed : 0,
      totalScore,
      avgScore: scores.length > 0 ? Math.round(totalScore / scores.length) : 0,
      bestScore: scores.length > 0 ? Math.max(...scores) : 0,
      totalTime,
      avgTime: times.length > 0 ? Math.round(totalTime / times.length) : 0
    };
  }

  /**
   * Obtém eventos não sincronizados.
   * Usado internamente pelo SyncManager.
   *
   * @private
   * @param {number} [limit=100] - Máximo de eventos
   * @returns {Promise<Array<Object>>} Eventos pendentes
   */
  async _getUnsyncedEvents(limit = 100) {
    return this._transaction(STORES.ANALYTICS, 'readonly', (store) => {
      const index = store.index('synced');
      const request = index.openCursor(IDBKeyRange.only(false));
      const results = [];

      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor || results.length >= limit) {
            resolve(results);
            return;
          }
          results.push(cursor.value);
          cursor.continue();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Marca eventos como sincronizados.
   * Usado internamente pelo SyncManager.
   *
   * @private
   * @param {Array<number>} ids - IDs dos eventos
   * @returns {Promise<boolean>}
   */
  async _markEventsSynced(ids) {
    return this._transaction(STORES.ANALYTICS, 'readwrite', (store) => {
      ids.forEach(id => {
        const request = store.get(id);
        request.onsuccess = () => {
          const data = request.result;
          if (data) {
            data.synced = true;
            store.put(data);
          }
        };
      });
      return true;
    });
  }

  /**
   * Fecha a conexão com o banco de dados.
   * Útil para testes e cleanup.
   */
  close() {
    if (this._db) {
      this._db.close();
      this._db = null;
      this._initialized = false;
    }
  }

  /**
   * Apaga completamente o banco de dados.
   * ÚTIL APENAS PARA TESTES/DEBUG.
   *
   * @returns {Promise<boolean>}
   */
  async destroy() {
    this.close();

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        console.warn('[GameStateStore] Delete bloqueado - existe conexão aberta');
        resolve(false);
      };
    });
  }
}

/**
 * Instância singleton do GameStateStore.
 * Use esta instância para operações simples.
 *
 * @type {GameStateStore}
 */
export const stateStore = new GameStateStore();

/**
 * Hook para inicialização automática do stateStore.
 * Chame no início da aplicação.
   *
   * @returns {Promise<GameStateStore>} Instância inicializada
   * @example
   * import { initStateStore } from '../shared/state-store.js';
   * const store = await initStateStore();
   */
export async function initStateStore() {
  await stateStore.init();
  return stateStore;
}
