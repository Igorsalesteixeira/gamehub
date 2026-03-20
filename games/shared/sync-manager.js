/**
 * Sync Manager - Sincronização Offline-First
 *
 * Gerencia fila de operações pendentes e sincronização automática
 * com o Supabase quando online.
 *
 * @module sync-manager
 * @example
 * import { SyncManager } from '../shared/sync-manager.js';
 * const sync = new SyncManager();
 * await sync.init();
 * sync.queue('update_stats', { gameId: 'solitaire', score: 100 });
 */

import { supabase } from '../../supabase.js';
import { stateStore } from './state-store.js';

/**
 * Status da conexão
 * @readonly
 * @enum {string}
 */
export const SYNC_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  SYNCING: 'syncing',
  ERROR: 'error'
};

/**
 * Tipos de operações suportadas
 * @readonly
 * @enum {string}
 */
export const OPERATION_TYPES = {
  UPDATE_STATS: 'update_stats',
  SAVE_GAME: 'save_game',
  LOG_EVENT: 'log_event',
  RECORD_RESULT: 'record_result'
};

/**
 * Gerenciador de sincronização offline-first.
 * Mantém fila de operações pendentes e sincroniza automaticamente.
 *
 * @class SyncManager
 * @example
 * const sync = new SyncManager({ autoSync: true, syncInterval: 30000 });
 * await sync.init();
 *
 * // Adicionar à fila
 * sync.queue('update_stats', { gameId: 'solitaire', updates: { score: 1000 } });
 *
 * // Verificar status
 * sync.onStatusChange((status) => {
 *   if (status === 'online') showOnlineIndicator();
 * });
 */
export class SyncManager {
  /**
   * Cria uma instância do SyncManager.
   *
   * @param {Object} [options={}] - Opções de configuração
   * @param {boolean} [options.autoSync=true] - Sincroniza automaticamente
   * @param {number} [options.syncInterval=60000] - Intervalo de sync em ms
   * @param {number} [options.maxRetries=3] - Máximo de tentativas por operação
   * @param {boolean} [options.batchOperations=true] - Agrupa operações em batch
   */
  constructor(options = {}) {
    this.options = {
      autoSync: true,
      syncInterval: 60000,
      maxRetries: 3,
      batchOperations: true,
      ...options
    };

    /** @private @type {Array<Object>} */
    this._queue = [];
    /** @private @type {SYNC_STATUS} */
    this._status = navigator.onLine ? SYNC_STATUS.ONLINE : SYNC_STATUS.OFFLINE;
    /** @private @type {boolean} */
    this._initialized = false;
    /** @private @type {number|null} */
    this._syncTimer = null;
    /** @private @type {Set<Function>} */
    this._statusListeners = new Set();
    /** @private @type {Set<Function>} */
    this._syncListeners = new Set();
    /** @private @type {boolean} */
    this._isProcessing = false;

    this._handleOnline = this._handleOnline.bind(this);
    this._handleOffline = this._handleOffline.bind(this);
  }

  /**
   * Inicializa o SyncManager.
   * Carrega fila pendente e configura listeners.
   *
   * @returns {Promise<boolean>} True se inicializado com sucesso
   */
  async init() {
    if (this._initialized) return true;

    // Carrega fila do localStorage
    this._loadQueue();

    // Configura listeners de conectividade
    window.addEventListener('online', this._handleOnline);
    window.addEventListener('offline', this._handleOffline);

    // Inicia sync automático
    if (this.options.autoSync) {
      this._startAutoSync();
    }

    // Tenta sincronizar imediatamente se online
    if (navigator.onLine && this._queue.length > 0) {
      this.sync();
    }

    this._initialized = true;
    return true;
  }

  /**
   * Retorna status atual da conexão.
   * @returns {SYNC_STATUS}
   */
  get status() {
    return this._status;
  }

  /**
   * Retorna quantidade de operações pendentes.
   * @returns {number}
   */
  get pendingCount() {
    return this._queue.length;
  }

  /**
   * Retorna se está processando sincronização.
   * @returns {boolean}
   */
  get isSyncing() {
    return this._status === SYNC_STATUS.SYNCING;
  }

  /**
   * Atualiza o status interno e notifica listeners.
   * @private
   * @param {SYNC_STATUS} newStatus
   */
  _setStatus(newStatus) {
    if (this._status === newStatus) return;

    this._status = newStatus;
    this._notifyStatusChange(newStatus);
  }

  /**
   * Notifica listeners de mudança de status.
   * @private
   * @param {SYNC_STATUS} status
   */
  _notifyStatusChange(status) {
    this._statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (e) {
        console.error('[SyncManager] Erro em status listener:', e);
      }
    });
  }

  /**
   * Notifica listeners após sincronização.
   * @private
   * @param {Object} result
   */
  _notifySyncComplete(result) {
    this._syncListeners.forEach(listener => {
      try {
        listener(result);
      } catch (e) {
        console.error('[SyncManager] Erro em sync listener:', e);
      }
    });
  }

  /**
   * Handler para evento online.
   * @private
   */
  _handleOnline() {
    this._setStatus(SYNC_STATUS.ONLINE);
    if (this._queue.length > 0) {
      this.sync();
    }
  }

  /**
   * Handler para evento offline.
   * @private
   */
  _handleOffline() {
    this._setStatus(SYNC_STATUS.OFFLINE);
  }

  /**
   * Carrega fila do localStorage.
   * @private
   */
  _loadQueue() {
    try {
      const saved = localStorage.getItem('gamehub_sync_queue');
      if (saved) {
        this._queue = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[SyncManager] Erro ao carregar fila:', e);
      this._queue = [];
    }
  }

  /**
   * Persiste fila no localStorage.
   * @private
   */
  _saveQueue() {
    try {
      localStorage.setItem('gamehub_sync_queue', JSON.stringify(this._queue));
    } catch (e) {
      console.warn('[SyncManager] Erro ao salvar fila:', e);
    }
  }

  /**
   * Inicia sincronização automática.
   * @private
   */
  _startAutoSync() {
    if (this._syncTimer) return;

    this._syncTimer = setInterval(() => {
      if (navigator.onLine && this._queue.length > 0 && !this._isProcessing) {
        this.sync();
      }
    }, this.options.syncInterval);
  }

  /**
   * Para sincronização automática.
   */
  stopAutoSync() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  }

  /**
   * Adiciona uma operação à fila de sincronização.
   *
   * @param {string} type - Tipo da operação
   * @param {Object} data - Dados da operação
   * @param {Object} [options={}] - Opções
   * @param {boolean} [options.immediate=false] - Tenta sincronizar imediatamente
   * @returns {string} ID da operação
   *
   * @example
   * sync.queue('update_stats', {
   *   gameId: 'solitaire',
   *   updates: { gamesPlayed: 1, highScore: 5000 }
   * });
   */
  queue(type, data, options = {}) {
    const operation = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      createdAt: new Date().toISOString(),
      retries: 0
    };

    this._queue.push(operation);
    this._saveQueue();

    if (options.immediate && navigator.onLine) {
      this.sync();
    }

    return operation.id;
  }

  /**
   * Remove operação da fila.
   * @private
   * @param {string} operationId
   */
  _removeFromQueue(operationId) {
    this._queue = this._queue.filter(op => op.id !== operationId);
    this._saveQueue();
  }

  /**
   * Incrementa retry de operação falha.
   * @private
   * @param {Object} operation
   */
  _incrementRetry(operation) {
    operation.retries++;
    if (operation.retries >= this.options.maxRetries) {
      console.warn(`[SyncManager] Operação ${operation.id} excedeu tentativas`);
      this._removeFromQueue(operation.id);
    } else {
      this._saveQueue();
    }
  }

  /**
   * Executa sincronização com Supabase.
   * Processa fila de operações pendentes.
   *
   * @returns {Promise<Object>} Resultado da sincronização
   * @example
   * const result = await sync.sync();
   * // { success: true, processed: 5, failed: 0, errors: [] }
   */
  async sync() {
    if (this._isProcessing) {
      return { success: false, reason: 'already_syncing' };
    }

    if (!navigator.onLine) {
      this._setStatus(SYNC_STATUS.OFFLINE);
      return { success: false, reason: 'offline' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, reason: 'not_authenticated' };
    }

    this._isProcessing = true;
    this._setStatus(SYNC_STATUS.SYNCING);

    const result = {
      success: false,
      processed: 0,
      failed: 0,
      errors: []
    };

    // Agrupa operações por tipo para processamento em batch
    const operations = [...this._queue];
    const grouped = this._groupOperations(operations);

    try {
      // Processa atualizações de estatísticas em batch
      if (grouped.stats.length > 0) {
        await this._syncStatsBatch(grouped.stats, user.id, result);
      }

      // Processa outros tipos individualmente
      for (const op of grouped.others) {
        await this._processOperation(op, user.id, result);
      }

      // Sincroniza eventos do state store
      await this._syncAnalytics(user.id, result);

      result.success = result.failed === 0;

      if (result.success) {
        this._setStatus(SYNC_STATUS.ONLINE);
      } else if (result.failed > 0) {
        this._setStatus(SYNC_STATUS.ERROR);
      }
    } catch (e) {
      console.error('[SyncManager] Erro durante sync:', e);
      result.success = false;
      result.errors.push(e.message);
      this._setStatus(SYNC_STATUS.ERROR);
    } finally {
      this._isProcessing = false;
      this._notifySyncComplete(result);
    }

    return result;
  }

  /**
   * Agrupa operações por tipo.
   * @private
   * @param {Array<Object>} operations
   * @returns {Object}
   */
  _groupOperations(operations) {
    const stats = [];
    const others = [];

    for (const op of operations) {
      if (op.type === OPERATION_TYPES.UPDATE_STATS) {
        stats.push(op);
      } else {
        others.push(op);
      }
    }

    return { stats, others };
  }

  /**
   * Sincroniza estatísticas em batch.
   * @private
   * @param {Array<Object>} operations
   * @param {string} userId
   * @param {Object} result
   */
  async _syncStatsBatch(operations, userId, result) {
    // Agrupa por gameId
    const byGame = {};
    for (const op of operations) {
      const { gameId, updates } = op.data;
      if (!byGame[gameId]) {
        byGame[gameId] = { gameId, updates: {} };
      }
      // Mescla updates
      Object.assign(byGame[gameId].updates, updates);
    }

    // Processa cada jogo
    for (const { gameId, updates } of Object.values(byGame)) {
      try {
        // Busca stats atuais
        const { data: existing } = await supabase
          .from('game_stats')
          .select('stats')
          .eq('user_id', userId)
          .eq('game_id', gameId)
          .single();

        const currentStats = existing?.stats || {
          gamesPlayed: 0,
          gamesWon: 0,
          highScore: 0,
          totalScore: 0,
          totalTime: 0
        };

        // Aplica updates
        const newStats = { ...currentStats };
        for (const [key, value] of Object.entries(updates)) {
          if (typeof value === 'number' && typeof newStats[key] === 'number') {
            newStats[key] += value; // Incrementa
          } else {
            newStats[key] = value; // Substitui
          }
        }
        newStats.lastPlayed = new Date().toISOString();

        // Salva no Supabase
        const { error } = await supabase
          .from('game_stats')
          .upsert({
            user_id: userId,
            game_id: gameId,
            stats: newStats,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,game_id' });

        if (error) throw error;

        // Remove operações processadas
        operations
          .filter(op => op.data.gameId === gameId)
          .forEach(op => this._removeFromQueue(op.id));

        result.processed++;
      } catch (e) {
        console.error(`[SyncManager] Erro ao sync stats ${gameId}:`, e);
        result.failed++;
        result.errors.push(`stats_${gameId}: ${e.message}`);

        operations
          .filter(op => op.data.gameId === gameId)
          .forEach(op => this._incrementRetry(op));
      }
    }
  }

  /**
   * Processa operação individual.
   * @private
   * @param {Object} operation
   * @param {string} userId
   * @param {Object} result
   */
  async _processOperation(operation, userId, result) {
    try {
      switch (operation.type) {
        case OPERATION_TYPES.SAVE_GAME:
          await this._syncSaveGame(operation, userId);
          break;
        case OPERATION_TYPES.LOG_EVENT:
          await this._syncLogEvent(operation, userId);
          break;
        case OPERATION_TYPES.RECORD_RESULT:
          await this._syncRecordResult(operation, userId);
          break;
        default:
          console.warn(`[SyncManager] Tipo desconhecido: ${operation.type}`);
      }

      this._removeFromQueue(operation.id);
      result.processed++;
    } catch (e) {
      console.error(`[SyncManager] Erro em ${operation.type}:`, e);
      result.failed++;
      result.errors.push(`${operation.type}: ${e.message}`);
      this._incrementRetry(operation);
    }
  }

  /**
   * Sincroniza save de jogo.
   * @private
   * @param {Object} operation
   * @param {string} userId
   */
  async _syncSaveGame(operation, userId) {
    const { gameId, slot, state } = operation.data;

    const { error } = await supabase
      .from('game_saves')
      .upsert({
        user_id: userId,
        game_id: gameId,
        slot,
        state,
        saved_at: new Date().toISOString()
      }, { onConflict: 'user_id,game_id,slot' });

    if (error) throw error;
  }

  /**
   * Sincroniza evento de log.
   * @private
   * @param {Object} operation
   * @param {string} userId
   */
  async _syncLogEvent(operation, userId) {
    const { gameId, event, data } = operation.data;

    const { error } = await supabase
      .from('game_events')
      .insert({
        user_id: userId,
        game_id: gameId,
        event,
        data,
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  /**
   * Sincroniza resultado de partida.
   * @private
   * @param {Object} operation
   * @param {string} userId
   */
  async _syncRecordResult(operation, userId) {
    const { gameId, won, score, time, extra } = operation.data;

    const { error } = await supabase
      .from('game_results')
      .insert({
        user_id: userId,
        game_id: gameId,
        won,
        score,
        time,
        extra,
        played_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  /**
   * Sincroniza analytics do state store.
   * @private
   * @param {string} userId
   * @param {Object} result
   */
  async _syncAnalytics(userId, result) {
    try {
      // Obtém eventos não sincronizados
      const events = await stateStore._getUnsyncedEvents(100);

      if (events.length === 0) return;

      // Insere no Supabase
      const { error } = await supabase
        .from('game_events')
        .insert(events.map(e => ({
          user_id: userId,
          game_id: e.gameId,
          event: e.event,
          data: e.data,
          created_at: e.timestamp
        })));

      if (error) throw error;

      // Marca como sincronizados
      await stateStore._markEventsSynced(events.map(e => e.id));

      result.processed += events.length;
    } catch (e) {
      console.error('[SyncManager] Erro ao sync analytics:', e);
      result.errors.push(`analytics: ${e.message}`);
    }
  }

  /**
   * Registra listener para mudanças de status.
   *
   * @param {Function} listener - Callback(status)
   * @returns {Function} Função para remover listener
   *
   * @example
   * const remove = sync.onStatusChange((status) => {
   *   console.log('Status:', status);
   * });
   * // remove() quando não precisar mais
   */
  onStatusChange(listener) {
    this._statusListeners.add(listener);
    return () => this._statusListeners.delete(listener);
  }

  /**
   * Registra listener para eventos de sync.
   *
   * @param {Function} listener - Callback(result)
   * @returns {Function} Função para remover listener
   */
  onSyncComplete(listener) {
    this._syncListeners.add(listener);
    return () => this._syncListeners.delete(listener);
  }

  /**
   * Força sincronização imediata.
   * Alias para sync().
   * @returns {Promise<Object>}
   */
  forceSync() {
    return this.sync();
  }

  /**
   * Limpa fila de operações.
   * @param {boolean} [syncedOnly=false] - Se true, remove apenas sincronizados
   * @returns {number} Quantidade removida
   */
  clearQueue(syncedOnly = false) {
    if (syncedOnly) {
      const before = this._queue.length;
      this._queue = this._queue.filter(op => op.retries >= this.options.maxRetries);
      this._saveQueue();
      return before - this._queue.length;
    } else {
      const count = this._queue.length;
      this._queue = [];
      this._saveQueue();
      return count;
    }
  }

  /**
   * Obtém cópia da fila atual.
   * @returns {Array<Object>}
   */
  getQueue() {
    return [...this._queue];
  }

  /**
   * Destroi a instância, limpando timers e listeners.
   */
  destroy() {
    this.stopAutoSync();
    window.removeEventListener('online', this._handleOnline);
    window.removeEventListener('offline', this._handleOffline);
    this._statusListeners.clear();
    this._syncListeners.clear();
    this._initialized = false;
  }
}

/**
 * Instância singleton do SyncManager.
 * @type {SyncManager}
 */
export const syncManager = new SyncManager();

/**
 * Inicializa o syncManager singleton.
 * @returns {Promise<SyncManager>}
 * @example
 * import { initSyncManager } from '../shared/sync-manager.js';
 * const sync = await initSyncManager();
 */
export async function initSyncManager() {
  await syncManager.init();
  return syncManager;
}

/**
 * Queue helper - Adiciona operação à fila do singleton.
 * @param {string} type
 * @param {Object} data
 * @param {Object} [options]
 * @returns {string}
 * @example
 * import { queue } from '../shared/sync-manager.js';
 * queue('update_stats', { gameId: 'solitaire', updates: { score: 100 } });
 */
export function queue(type, data, options) {
  return syncManager.queue(type, data, options);
}

/**
 * Sync helper - Força sync do singleton.
 * @returns {Promise<Object>}
 */
export function forceSync() {
  return syncManager.sync();
}

/**
 * Status helper - Retorna status do singleton.
 * @returns {SYNC_STATUS}
 */
export function getStatus() {
  return syncManager.status;
}
