/**
 * Persistência de Estado
 *
 * Wrapper para localStorage com namespace automático por jogo,
 * suporte a múltiplos slots e gerenciamento de saves.
 *
 * @module skills/save-state
 * @example
 * import { SaveState } from '../shared/skills/save-state/index.js';
 *
 * const saves = new SaveState('solitaire');
 *
 * // Salvar estado
 * saves.save('slot1', { board: [...], score: 100 });
 *
 * // Carregar estado
 * const state = saves.load('slot1');
 *
 * // Listar saves
 * const slots = saves.list();
 */

/**
 * Wrapper para localStorage com namespace por jogo.
 * @class SaveState
 */
export class SaveState {
  /**
   * Cria uma instância de SaveState.
   *
   * @param {string} gameId - Identificador único do jogo
   * @param {Object} options - Opções de configuração
   * @param {string} [options.prefix='gamehub_save'] - Prefixo para chaves
   * @param {boolean} [options.compress=false] - Se deve comprimir dados (JSON)
   * @param {number} [options.maxSlots=10] - Máximo de slots permitidos
   */
  constructor(gameId, options = {}) {
    if (!gameId || typeof gameId !== 'string') {
      throw new Error('[SaveState] gameId é obrigatório e deve ser uma string');
    }

    this.gameId = gameId;
    this.options = {
      prefix: options.prefix || 'gamehub_save',
      compress: options.compress || false,
      maxSlots: options.maxSlots || 10
    };

    this._namespace = `${this.options.prefix}_${gameId}`;
    this._metadataKey = `${this._namespace}_metadata`;
  }

  /**
   * Gera chave completa com namespace.
   * @private
   * @param {string} slot - Nome do slot
   * @returns {string} Chave completa
   */
  _key(slot) {
    return `${this._namespace}_${slot}`;
  }

  /**
   * Salva estado em um slot.
   *
   * @param {string} slot - Nome do slot (ex: 'slot1', 'autosave')
   * @param {Object} state - Estado a salvar
   * @param {Object} [metadata] - Metadados adicionais
   * @returns {boolean} Sucesso da operação
   *
   * @example
   * saves.save('slot1', { level: 5, health: 100 }, { levelName: 'Fase 1' });
   */
  save(slot, state, metadata = {}) {
    if (!slot || typeof slot !== 'string') {
      console.error('[SaveState] slot é obrigatório');
      return false;
    }

    if (state === undefined || state === null) {
      console.error('[SaveState] state não pode ser null/undefined');
      return false;
    }

    try {
      const saveData = {
        state: JSON.parse(JSON.stringify(state)), // Deep clone
        savedAt: new Date().toISOString(),
        version: 1,
        metadata: {
          ...metadata,
          size: JSON.stringify(state).length
        }
      };

      const data = JSON.stringify(saveData);
      localStorage.setItem(this._key(slot), data);

      // Atualiza metadata global
      this._updateMetadata(slot, saveData);

      return true;
    } catch (e) {
      console.error(`[SaveState:${this.gameId}] Erro ao salvar ${slot}:`, e);
      return false;
    }
  }

  /**
   * Carrega estado de um slot.
   *
   * @param {string} slot - Nome do slot
   * @returns {Object|null} Estado carregado ou null
   *
   * @example
   * const state = saves.load('slot1');
   * if (state) {
   *   console.log(state.level);
   * }
   */
  load(slot) {
    if (!slot) return null;

    try {
      const data = localStorage.getItem(this._key(slot));
      if (!data) return null;

      const parsed = JSON.parse(data);
      return parsed.state || null;
    } catch (e) {
      console.error(`[SaveState:${this.gameId}] Erro ao carregar ${slot}:`, e);
      return null;
    }
  }

  /**
   * Carrega estado completo incluindo metadados.
   *
   * @param {string} slot - Nome do slot
   * @returns {Object|null} Objeto completo do save ou null
   */
  loadFull(slot) {
    if (!slot) return null;

    try {
      const data = localStorage.getItem(this._key(slot));
      if (!data) return null;

      return JSON.parse(data);
    } catch (e) {
      console.error(`[SaveState:${this.gameId}] Erro ao carregar ${slot}:`, e);
      return null;
    }
  }

  /**
   * Lista todos os slots disponíveis.
   *
   * @param {Object} options - Opções de filtro
   * @param {boolean} [options.includeEmpty=false] - Incluir slots vazios
   * @returns {Array<Object>} Lista de slots com metadados
   *
   * @example
   * const slots = saves.list();
   * slots.forEach(slot => console.log(slot.slot, slot.savedAt));
   */
  list(options = {}) {
    const slots = [];
    const prefix = this._key('');

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;

      // Pula chaves de metadata
      if (key === this._metadataKey) continue;

      const slot = key.slice(prefix.length);

      try {
        const data = this.loadFull(slot);
        if (data) {
          slots.push({
            slot,
            savedAt: data.savedAt,
            version: data.version,
            metadata: data.metadata
          });
        }
      } catch (e) {
        // Ignora saves corrompidos
      }
    }

    // Ordena por data (mais recente primeiro)
    return slots.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  }

  /**
   * Deleta um slot específico.
   *
   * @param {string} slot - Nome do slot
   * @returns {boolean} Se removeu com sucesso
   *
   * @example
   * saves.delete('slot1');
   */
  delete(slot) {
    if (!slot) return false;

    try {
      localStorage.removeItem(this._key(slot));
      this._removeFromMetadata(slot);
      return true;
    } catch (e) {
      console.error(`[SaveState:${this.gameId}] Erro ao deletar ${slot}:`, e);
      return false;
    }
  }

  /**
   * Verifica se um slot existe.
   *
   * @param {string} slot - Nome do slot
   * @returns {boolean}
   */
  exists(slot) {
    if (!slot) return false;
    return localStorage.getItem(this._key(slot)) !== null;
  }

  /**
   * Retorna informações de um slot.
   *
   * @param {string} slot - Nome do slot
   * @returns {Object|null}
   */
  info(slot) {
    return this.loadFull(slot);
  }

  /**
   * Copia um slot para outro.
   *
   * @param {string} fromSlot - Slot origem
   * @param {string} toSlot - Slot destino
   * @returns {boolean} Sucesso
   */
  copy(fromSlot, toSlot) {
    const data = this.loadFull(fromSlot);
    if (!data) return false;

    return this.save(toSlot, data.state, data.metadata);
  }

  /**
   * Renomeia um slot.
   *
   * @param {string} oldSlot - Nome atual
   * @param {string} newSlot - Novo nome
   * @returns {boolean} Sucesso
   */
  rename(oldSlot, newSlot) {
    if (!this.exists(oldSlot) || this.exists(newSlot)) {
      return false;
    }

    const data = this.loadFull(oldSlot);
    if (!data) return false;

    const saved = this.save(newSlot, data.state, data.metadata);
    if (saved) {
      this.delete(oldSlot);
    }
    return saved;
  }

  /**
   * Limpa todos os saves deste jogo.
   *
   * @param {Object} options - Opções
   * @param {boolean} [options.confirm=false] - Requer confirção explícita
   * @returns {number} Quantidade de slots removidos
   */
  clear(options = {}) {
    if (options.confirm !== true) {
      console.warn('[SaveState] Use clear({ confirm: true }) para confirmar');
      return 0;
    }

    const slots = this.list();
    let count = 0;

    slots.forEach(({ slot }) => {
      if (this.delete(slot)) {
        count++;
      }
    });

    // Limpa metadata
    localStorage.removeItem(this._metadataKey);

    return count;
  }

  /**
   * Retorna quantidade de saves.
   * @returns {number}
   */
  count() {
    return this.list().length;
  }

  /**
   * Verifica se há saves disponíveis.
   * @returns {boolean}
   */
  hasSaves() {
    return this.count() > 0;
  }

  /**
   * Retorna o slot mais recente.
   * @returns {Object|null}
   */
  getMostRecent() {
    const slots = this.list();
    return slots.length > 0 ? slots[0] : null;
  }

  /**
   * Exporta todos os saves para JSON.
   * @returns {string} JSON com todos os saves
   */
  export() {
    const data = {
      gameId: this.gameId,
      exportedAt: new Date().toISOString(),
      saves: {}
    };

    const slots = this.list();
    slots.forEach(({ slot }) => {
      data.saves[slot] = this.loadFull(slot);
    });

    return JSON.stringify(data, null, 2);
  }

  /**
   * Importa saves de JSON.
   *
   * @param {string} json - JSON com saves
   * @param {Object} options - Opções
   * @param {boolean} [options.overwrite=false] - Sobrescreve saves existentes
   * @returns {number} Quantidade de saves importados
   */
  import(json, options = {}) {
    try {
      const data = JSON.parse(json);
      if (!data.saves || typeof data.saves !== 'object') {
        throw new Error('Formato inválido');
      }

      let count = 0;
      Object.entries(data.saves).forEach(([slot, saveData]) => {
        if (this.exists(slot) && !options.overwrite) {
          return;
        }

        if (this.save(slot, saveData.state, saveData.metadata)) {
          count++;
        }
      });

      return count;
    } catch (e) {
      console.error('[SaveState] Erro ao importar:', e);
      return 0;
    }
  }

  /**
   * Atualiza metadata global.
   * @private
   */
  _updateMetadata(slot, saveData) {
    try {
      const metadata = this._loadMetadata();
      metadata.slots = metadata.slots || {};
      metadata.slots[slot] = {
        savedAt: saveData.savedAt,
        version: saveData.version
      };
      metadata.lastSave = saveData.savedAt;
      localStorage.setItem(this._metadataKey, JSON.stringify(metadata));
    } catch (e) {
      // Ignora erro de metadata
    }
  }

  /**
   * Remove slot do metadata.
   * @private
   */
  _removeFromMetadata(slot) {
    try {
      const metadata = this._loadMetadata();
      if (metadata.slots) {
        delete metadata.slots[slot];
      }
      localStorage.setItem(this._metadataKey, JSON.stringify(metadata));
    } catch (e) {
      // Ignora erro
    }
  }

  /**
   * Carrega metadata global.
   * @private
   */
  _loadMetadata() {
    try {
      const data = localStorage.getItem(this._metadataKey);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Retorna espaço usado em bytes.
   * @returns {number}
   */
  getSize() {
    let size = 0;
    const prefix = this._key('');

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this._namespace)) {
        size += localStorage.getItem(key).length * 2; // UTF-16
      }
    }

    return size;
  }

  /**
   * Retorna espaço usado em formato legível.
   * @returns {string}
   */
  getSizeFormatted() {
    const bytes = this.getSize();
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

/**
 * Cria um SaveState para um jogo específico.
 *
 * @param {string} gameId - ID do jogo
 * @param {Object} options - Opções
 * @returns {SaveState} Instância configurada
 * @example
 * const saves = createSaveState('chess', { maxSlots: 5 });
 */
export function createSaveState(gameId, options = {}) {
  return new SaveState(gameId, options);
}

/**
 * Limpa todos os saves de todos os jogos.
 * Use com cuidado!
 *
 * @param {Object} options - Opções
 * @param {boolean} [options.confirm=false] - Requer confirmação
 * @param {string} [options.prefix='gamehub_save'] - Prefixo a limpar
 * @returns {number} Quantidade de itens removidos
 */
export function clearAllSaves(options = {}) {
  if (options.confirm !== true) {
    console.warn('[SaveState] Use clearAllSaves({ confirm: true }) para confirmar');
    return 0;
  }

  const prefix = options.prefix || 'gamehub_save';
  const keysToRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
  return keysToRemove.length;
}
