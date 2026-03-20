/**
 * Asset Loader - Sistema de carregamento de assets para o Game Hub
 *
 * Fornece carregamento sob demanda (lazy loading) com cache para
 * imagens, áudio e arquivos JSON. Otimizado para jogos web.
 *
 * @module asset-loader
 * @example
 * const loader = new AssetLoader();
 * const playerSprite = await loader.load('platformer', 'image', 'player.png');
 * const levelData = await loader.load('platformer', 'json', 'level1.json');
 */

/**
 * Tipos de asset suportados
 * @typedef {'image' | 'audio' | 'json'} AssetType
 */

/**
 * Configuração de asset para pré-carregamento
 * @typedef {Object} AssetConfig
 * @property {AssetType} type - Tipo do asset
 * @property {string} name - Nome do arquivo do asset
 */

/**
 * Gerenciador de carregamento de assets com cache.
 * Suporta imagens, áudio e JSON com lazy loading.
 * @class AssetLoader
 */
export class AssetLoader {
  /**
   * Cria uma instância do AssetLoader.
   * Inicializa os caches vazios.
   */
  constructor() {
    /**
     * Cache de assets carregados.
     * Chave: `${gameId}/${type}/${name}`
     * @type {Map<string, HTMLImageElement | Blob | Object>}
     * @private
     */
    this._cache = new Map();

    /**
     * Promessas de carregamento em andamento.
     * Evita carregamentos duplicados simultâneos.
     * @type {Map<string, Promise>}
     * @private
     */
    this._loading = new Map();

    /**
     * Contador de assets carregados por jogo.
     * @type {Map<string, number>}
     * @private
     */
    this._stats = new Map();
  }

  /**
   * Gera a chave de cache para um asset.
   * @private
   * @param {string} gameId - Identificador do jogo
   * @param {AssetType} assetType - Tipo do asset
   * @param {string} assetName - Nome do arquivo
   * @returns {string} Chave formatada
   */
  _getKey(gameId, assetType, assetName) {
    return `${gameId}/${assetType}/${assetName}`;
  }

  /**
   * Constrói o caminho completo para o asset.
   * @private
   * @param {string} gameId - Identificador do jogo
   * @param {AssetType} assetType - Tipo do asset
   * @param {string} assetName - Nome do arquivo
   * @returns {string} URL completa do asset
   */
  _getAssetPath(gameId, assetType, assetName) {
    const basePath = `games/${gameId}/assets`;

    // Organiza por subdiretório baseado no tipo
    switch (assetType) {
      case 'image':
        return `${basePath}/images/${assetName}`;
      case 'audio':
        return `${basePath}/audio/${assetName}`;
      case 'json':
        return `${basePath}/data/${assetName}`;
      default:
        return `${basePath}/${assetName}`;
    }
  }

  /**
   * Carrega uma imagem.
   * @private
   * @param {string} path - Caminho da imagem
   * @returns {Promise<HTMLImageElement>} Promise que resolve com o elemento Image
   */
  _loadImage(path) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${path}`));
      img.onabort = () => reject(new Error(`Carregamento abortado: ${path}`));

      img.src = path;
    });
  }

  /**
   * Carrega um arquivo de áudio como Blob.
   * @private
   * @param {string} path - Caminho do áudio
   * @returns {Promise<Blob>} Promise que resolve com o Blob do áudio
   */
  async _loadAudio(path) {
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(`Falha ao carregar áudio: ${path} (${response.status})`);
    }

    return response.blob();
  }

  /**
   * Carrega um arquivo JSON.
   * @private
   * @param {string} path - Caminho do JSON
   * @returns {Promise<Object>} Promise que resolve com o objeto JSON
   */
  async _loadJson(path) {
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(`Falha ao carregar JSON: ${path} (${response.status})`);
    }

    return response.json();
  }

  /**
   * Carrega um asset específico.
   * Se o asset já estiver em cache, retorna imediatamente.
   * Se um carregamento idêntico estiver em andamento, reutiliza a promessa.
   *
   * @param {string} gameId - Identificador do jogo (ex: 'platformer', 'chess')
   * @param {AssetType} assetType - Tipo do asset ('image', 'audio', 'json')
   * @param {string} assetName - Nome do arquivo (ex: 'player.png', 'level1.json')
   * @returns {Promise<HTMLImageElement | Blob | Object>} Promise que resolve com o asset carregado
   *
   * @example
   * const sprite = await loader.load('platformer', 'image', 'player.png');
   * const sound = await loader.load('platformer', 'audio', 'jump.mp3');
   * const level = await loader.load('platformer', 'json', 'level1.json');
   */
  async load(gameId, assetType, assetName) {
    // Validação de parâmetros
    if (!gameId || typeof gameId !== 'string') {
      throw new Error('[AssetLoader] gameId é obrigatório e deve ser uma string');
    }
    if (!assetType || !['image', 'audio', 'json'].includes(assetType)) {
      throw new Error('[AssetLoader] assetType deve ser "image", "audio" ou "json"');
    }
    if (!assetName || typeof assetName !== 'string') {
      throw new Error('[AssetLoader] assetName é obrigatório e deve ser uma string');
    }

    const key = this._getKey(gameId, assetType, assetName);

    // Verifica cache primeiro
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }

    // Verifica se já está carregando (evita duplicatas)
    if (this._loading.has(key)) {
      return this._loading.get(key);
    }

    // Inicia carregamento
    const path = this._getAssetPath(gameId, assetType, assetName);

    const loadPromise = (async () => {
      try {
        let asset;

        switch (assetType) {
          case 'image':
            asset = await this._loadImage(path);
            break;
          case 'audio':
            asset = await this._loadAudio(path);
            break;
          case 'json':
            asset = await this._loadJson(path);
            break;
        }

        // Armazena no cache
        this._cache.set(key, asset);

        // Atualiza estatísticas
        const currentCount = this._stats.get(gameId) || 0;
        this._stats.set(gameId, currentCount + 1);

        return asset;
      } catch (error) {
        console.error(`[AssetLoader] Erro ao carregar ${key}:`, error);
        throw error;
      } finally {
        // Remove da lista de carregamentos em andamento
        this._loading.delete(key);
      }
    })();

    // Armazena a promessa para reutilização
    this._loading.set(key, loadPromise);

    return loadPromise;
  }

  /**
   * Pré-carrega múltiplos assets em paralelo.
   * Útil para carregar assets essenciais no início do jogo.
   *
   * @param {string} gameId - Identificador do jogo
   * @param {AssetConfig[]} assets - Array de configurações de assets
   * @returns {Promise<Map<string, HTMLImageElement | Blob | Object>>} Promise que resolve com Map de assets carregados
   *
   * @example
   * const assets = await loader.preload('platformer', [
   *   { type: 'image', name: 'player.png' },
   *   { type: 'image', name: 'enemy.png' },
   *   { type: 'audio', name: 'bgm.mp3' },
   *   { type: 'json', name: 'config.json' }
   * ]);
   */
  async preload(gameId, assets) {
    if (!Array.isArray(assets)) {
      throw new Error('[AssetLoader] assets deve ser um array');
    }

    if (assets.length === 0) {
      return new Map();
    }

    const results = new Map();
    const errors = [];

    // Carrega todos em paralelo
    const promises = assets.map(async (config) => {
      try {
        const asset = await this.load(gameId, config.type, config.name);
        const key = this._getKey(gameId, config.type, config.name);
        results.set(key, asset);
        return { success: true, key };
      } catch (error) {
        errors.push({ type: config.type, name: config.name, error: error.message });
        return { success: false, error };
      }
    });

    await Promise.all(promises);

    // Log de resumo
    const successCount = results.size;
    const totalCount = assets.length;

    if (errors.length > 0) {
      console.warn(`[AssetLoader] Pré-carregamento de ${gameId}: ${successCount}/${totalCount} sucessos`);
      console.warn('[AssetLoader] Erros:', errors);
    } else {
      console.log(`[AssetLoader] Pré-carregamento de ${gameId}: ${successCount} assets carregados`);
    }

    return results;
  }

  /**
   * Retorna um asset do cache sem iniciar carregamento.
   * Retorna undefined se o asset não estiver em cache.
   *
   * @param {string} gameId - Identificador do jogo
   * @param {AssetType} assetType - Tipo do asset
   * @param {string} assetName - Nome do arquivo
   * @returns {HTMLImageElement | Blob | Object | undefined} Asset do cache ou undefined
   *
   * @example
   * const sprite = loader.get('platformer', 'image', 'player.png');
   * if (sprite) {
   *   ctx.drawImage(sprite, 0, 0);
   * }
   */
  get(gameId, assetType, assetName) {
    const key = this._getKey(gameId, assetType, assetName);
    return this._cache.get(key);
  }

  /**
   * Verifica se um asset está em cache.
   *
   * @param {string} gameId - Identificador do jogo
   * @param {AssetType} assetType - Tipo do asset
   * @param {string} assetName - Nome do arquivo
   * @returns {boolean} true se o asset estiver em cache
   */
  has(gameId, assetType, assetName) {
    const key = this._getKey(gameId, assetType, assetName);
    return this._cache.has(key);
  }

  /**
   * Verifica se um asset está sendo carregado no momento.
   *
   * @param {string} gameId - Identificador do jogo
   * @param {AssetType} assetType - Tipo do asset
   * @param {string} assetName - Nome do arquivo
   * @returns {boolean} true se o asset estiver sendo carregado
   */
  isLoading(gameId, assetType, assetName) {
    const key = this._getKey(gameId, assetType, assetName);
    return this._loading.has(key);
  }

  /**
   * Limpa o cache de assets de um jogo específico.
   * Libera memória quando o jogo não está mais em uso.
   *
   * @param {string} gameId - Identificador do jogo
   * @returns {number} Quantidade de assets removidos
   *
   * @example
   * loader.clear('platformer'); // Remove todos os assets do platformer
   */
  clear(gameId) {
    const prefix = `${gameId}/`;
    const keysToRemove = [];

    // Encontra todas as chaves do jogo
    for (const key of this._cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    // Remove do cache
    keysToRemove.forEach(key => this._cache.delete(key));

    // Remove também de carregamentos em andamento
    for (const key of this._loading.keys()) {
      if (key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => this._loading.delete(key));

    // Limpa estatísticas
    this._stats.delete(gameId);

    console.log(`[AssetLoader] Cache de ${gameId} limpo: ${keysToRemove.length} assets removidos`);

    return keysToRemove.length;
  }

  /**
   * Limpa todo o cache de assets.
   * Use com cautela - afeta todos os jogos.
   *
   * @returns {number} Quantidade total de assets removidos
   *
   * @example
   * loader.clearAll(); // Limpa todo o cache
   */
  clearAll() {
    const count = this._cache.size;

    this._cache.clear();
    this._loading.clear();
    this._stats.clear();

    console.log(`[AssetLoader] Cache completo limpo: ${count} assets removidos`);

    return count;
  }

  /**
   * Retorna estatísticas de carregamento de um jogo.
   *
   * @param {string} gameId - Identificador do jogo
   * @returns {Object} Estatísticas do jogo
   * @returns {number} returns.cached - Quantidade em cache
   * @returns {number} returns.loading - Quantidade carregando
   * @returns {number} returns.total - Total de assets do jogo
   */
  getStats(gameId) {
    const prefix = `${gameId}/`;
    let cached = 0;
    let loading = 0;

    for (const key of this._cache.keys()) {
      if (key.startsWith(prefix)) cached++;
    }

    for (const key of this._loading.keys()) {
      if (key.startsWith(prefix)) loading++;
    }

    return {
      cached,
      loading,
      total: cached + loading
    };
  }

  /**
   * Retorna estatísticas globais de todos os jogos.
   *
   * @returns {Object} Estatísticas globais
   * @returns {number} returns.totalCached - Total em cache
   * @returns {number} returns.totalLoading - Total carregando
   * @returns {number} returns.totalAssets - Total de assets
   * @returns {string[]} returns.games - Lista de gameIds
   */
  getGlobalStats() {
    const games = new Set();

    for (const key of this._cache.keys()) {
      const gameId = key.split('/')[0];
      games.add(gameId);
    }

    for (const key of this._loading.keys()) {
      const gameId = key.split('/')[0];
      games.add(gameId);
    }

    return {
      totalCached: this._cache.size,
      totalLoading: this._loading.size,
      totalAssets: this._cache.size + this._loading.size,
      games: Array.from(games)
    };
  }
}

/**
 * Cria uma instância singleton do AssetLoader.
 * Útil para compartilhar o mesmo cache em toda a aplicação.
 * @type {AssetLoader}
 */
export const assetLoader = new AssetLoader();

/**
 * Função auxiliar para carregar um asset usando o singleton.
 * @param {string} gameId - Identificador do jogo
 * @param {AssetType} assetType - Tipo do asset
 * @param {string} assetName - Nome do arquivo
 * @returns {Promise<HTMLImageElement | Blob | Object>} Asset carregado
 */
export function loadAsset(gameId, assetType, assetName) {
  return assetLoader.load(gameId, assetType, assetName);
}

/**
 * Função auxiliar para pré-carregar múltiplos assets usando o singleton.
 * @param {string} gameId - Identificador do jogo
 * @param {AssetConfig[]} assets - Array de configurações de assets
 * @returns {Promise<Map<string, HTMLImageElement | Blob | Object>>} Assets carregados
 */
export function preloadAssets(gameId, assets) {
  return assetLoader.preload(gameId, assets);
}
