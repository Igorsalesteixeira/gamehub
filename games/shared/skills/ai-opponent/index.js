/**
 * AdaptiveAI - Sistema de IA Adaptativa com Instinct-Based Learning
 *
 * Implementa aprendizado baseado em padrões de comportamento do jogador
 * com scoring de confiança para predição de movimentos.
 *
 * @module games/shared/skills/ai-opponent
 * @version 1.0.0
 */

/**
 * Representa um movimento registrado no histórico
 * @typedef {Object} MoveRecord
 * @property {Object} move - Dados do movimento
 * @property {Object} context - Contexto em que o movimento foi feito
 * @property {number} timestamp - Timestamp do movimento
 */

/**
 * Resultado de uma predição
 * @typedef {Object} PredictionResult
 * @property {Object|null} move - Movimento predito ou null
 * @property {number} confidence - Nível de confiança (0-1)
 * @property {string|null} pattern - Tipo de padrão detectado
 */

/**
 * Estatísticas de padrões analisados
 * @typedef {Object} PatternStats
 * @property {Object} frequencies - Mapa de frequências de movimentos
 * @property {Object} preferences - Preferências detectadas (direção, posição)
 * @property {number} totalMoves - Total de movimentos analisados
 * @property {number} confidenceScore - Score de confiança calculado
 */

/**
 * Classe AdaptiveAI - IA adaptativa com aprendizado de padrões
 *
 * @example
 * const ai = new AdaptiveAI('chess');
 * ai.recordMove('user123', { from: 'e2', to: 'e4' }, { turn: 1 });
 * const prediction = ai.predictNextMove('user123', { turn: 2 });
 * // { move: { from: 'd7', to: 'd5' }, confidence: 0.6, pattern: 'mirror' }
 */
export class AdaptiveAI {
  /**
   * Número mínimo de movimentos para análise
   * @type {number}
   * @constant
   */
  static MIN_MOVES_FOR_ANALYSIS = 3;

  /**
   * Número de movimentos recentes para análise de frequência
   * @type {number}
   * @constant
   */
  static RECENT_MOVES_WINDOW = 10;

  /**
   * Limiar mínimo de confiança para predições
   * @type {number}
   * @constant
   */
  static MIN_CONFIDENCE_THRESHOLD = 0.15;

  /**
   * Fator de decaimento para pesos de movimentos antigos
   * @type {number}
   * @constant
   */
  static DECAY_FACTOR = 0.95;

  /**
   * Cria uma instância do AdaptiveAI
   *
   * @param {string} gameType - Tipo do jogo (ex: 'chess', 'checkers', 'go')
   * @param {Object} [options={}] - Opções de configuração
   * @param {number} [options.initialConfidence=0.5] - Confiança inicial
   * @param {number} [options.learningRate=0.1] - Taxa de aprendizado
   * @param {number} [options.maxHistorySize=100] - Tamanho máximo do histórico por jogador
   */
  constructor(gameType, options = {}) {
    /** @type {string} */
    this.gameType = gameType;

    /** @type {number} */
    this.initialConfidence = options.initialConfidence ?? 0.5;

    /** @type {number} */
    this.learningRate = options.learningRate ?? 0.1;

    /** @type {number} */
    this.maxHistorySize = options.maxHistorySize ?? 100;

    /**
     * Mapa de histórico de movimentos: chave -> array de movimentos
     * @type {Map<string, MoveRecord[]>}
     * @private
     */
    this._moveHistory = new Map();

    /**
     * Mapa de confiança por jogador
     * @type {Map<string, number>}
     * @private
     */
    this._confidenceMap = new Map();

    /**
     * Mapa de estatísticas de padrões por jogador
     * @type {Map<string, PatternStats>}
     * @private
     */
    this._patternStats = new Map();

    /**
     * Contador de vitórias/derrotas para ajuste de dificuldade
     * @type {Map<string, {wins: number, losses: number, total: number}>}
     * @private
     */
    this._winStats = new Map();
  }

  /**
   * Gera a chave única para armazenamento dos dados do jogador
   *
   * @param {string} playerId - ID do jogador
   * @returns {string} Chave no formato `${playerId}_${gameType}`
   * @private
   */
  _getKey(playerId) {
    return `${playerId}_${this.gameType}`;
  }

  /**
   * Registra um movimento do jogador no histórico
   *
   * @param {string} playerId - ID único do jogador
   * @param {Object} move - Dados do movimento (ex: { from: 'e2', to: 'e4' })
   * @param {Object} [context={}] - Contexto do movimento (ex: { turn: 1, boardState: [...] })
   * @returns {AdaptiveAI} Retorna a instância para encadeamento
   */
  recordMove(playerId, move, context = {}) {
    const key = this._getKey(playerId);

    if (!this._moveHistory.has(key)) {
      this._moveHistory.set(key, []);
      this._confidenceMap.set(key, this.initialConfidence);
    }

    const history = this._moveHistory.get(key);

    /** @type {MoveRecord} */
    const record = {
      move: { ...move },
      context: { ...context },
      timestamp: Date.now()
    };

    history.push(record);

    // Limita o tamanho do histórico
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // Atualiza estatísticas de padrões
    this._updatePatternStats(playerId, record);

    return this;
  }

  /**
   * Atualiza as estatísticas de padrões após registrar um movimento
   *
   * @param {string} playerId - ID do jogador
   * @param {MoveRecord} record - Registro do movimento
   * @private
   */
  _updatePatternStats(playerId, record) {
    const key = this._getKey(playerId);
    const history = this._moveHistory.get(key);

    /** @type {PatternStats} */
    const stats = {
      frequencies: {},
      preferences: {
        sideBias: { left: 0, right: 0, center: 0 },
        directionBias: { forward: 0, backward: 0, lateral: 0 },
        aggression: 0.5
      },
      totalMoves: history.length,
      confidenceScore: this._calculateConfidence(history.length)
    };

    // Analisa frequências de movimentos similares
    const moveSignature = this._getMoveSignature(record.move);
    const recentMoves = history.slice(-AdaptiveAI.RECENT_MOVES_WINDOW);

    recentMoves.forEach((m, index) => {
      const sig = this._getMoveSignature(m.move);
      const weight = Math.pow(AdaptiveAI.DECAY_FACTOR, recentMoves.length - index - 1);

      stats.frequencies[sig] = (stats.frequencies[sig] || 0) + weight;
    });

    // Detecta preferências de lado (direita/esquerda)
    stats.preferences.sideBias = this._analyzeSideBias(recentMoves);

    // Detecta preferência de direção
    stats.preferences.directionBias = this._analyzeDirectionBias(recentMoves);

    // Calcula nível de agressividade
    stats.preferences.aggression = this._analyzeAggression(recentMoves);

    this._patternStats.set(key, stats);

    // Atualiza confiança baseada na quantidade de dados
    const currentConfidence = this._confidenceMap.get(key) || this.initialConfidence;
    const dataConfidence = this._calculateConfidence(history.length);
    const blendedConfidence = (currentConfidence * 0.7) + (dataConfidence * 0.3);
    this._confidenceMap.set(key, Math.min(0.9, Math.max(0.1, blendedConfidence)));
  }

  /**
   * Gera uma assinatura única para o movimento
   *
   * @param {Object} move - Dados do movimento
   * @returns {string} Assinatura do movimento
   * @private
   */
  _getMoveSignature(move) {
    if (typeof move === 'string') {
      return move;
    }

    // Se tém propriedades from/to (como em xadrez)
    if (move.from && move.to) {
      return `${move.from}->${move.to}`;
    }

    // Se tém propriedade position (como em jogos de tabuleiro)
    if (move.position !== undefined) {
      return `pos:${move.position}`;
    }

    // Se tém propriedade row/col
    if (move.row !== undefined && move.col !== undefined) {
      return `r${move.row}c${move.col}`;
    }

    // Fallback: serializa o objeto ordenado
    const keys = Object.keys(move).sort();
    return keys.map(k => `${k}:${move[k]}`).join(',');
  }

  /**
   * Analisa viés de lateralidade (esquerda/direita/centro)
   *
   * @param {MoveRecord[]} moves - Array de movimentos
   * @returns {Object} Contagem de preferências
   * @private
   */
  _analyzeSideBias(moves) {
    const bias = { left: 0, right: 0, center: 0 };

    moves.forEach(m => {
      const pos = this._extractPosition(m.move);
      if (pos) {
        if (pos.x < 0.33) bias.left++;
        else if (pos.x > 0.66) bias.right++;
        else bias.center++;
      }
    });

    return bias;
  }

  /**
   * Analisa viés de direção
   *
   * @param {MoveRecord[]} moves - Array de movimentos
   * @returns {Object} Contagem de direções
   * @private
   */
  _analyzeDirectionBias(moves) {
    const bias = { forward: 0, backward: 0, lateral: 0 };

    moves.forEach(m => {
      const pos = this._extractPosition(m.move);
      if (pos && pos.dy !== undefined) {
        if (pos.dy < -0.1) bias.forward++;
        else if (pos.dy > 0.1) bias.backward++;
        else bias.lateral++;
      }
    });

    return bias;
  }

  /**
   * Analisa nível de agressividade do jogador
   *
   * @param {MoveRecord[]} moves - Array de movimentos
   * @returns {number} Nível de agressividade (0-1)
   * @private
   */
  _analyzeAggression(moves) {
    if (moves.length === 0) return 0.5;

    let aggressiveMoves = 0;

    moves.forEach(m => {
      // Movimentos que avançam para o campo adversário ou capturam
      const pos = this._extractPosition(m.move);
      if (pos) {
        if (pos.dy < -0.2 || m.move.capture || m.move.aggressive) {
          aggressiveMoves++;
        }
      }
    });

    return aggressiveMoves / moves.length;
  }

  /**
   * Extrai posição normalizada de um movimento
   *
   * @param {Object} move - Dados do movimento
   * @returns {Object|null} Posição normalizada {x, y, dx, dy}
   * @private
   */
  _extractPosition(move) {
    if (!move) return null;

    // Para movimentos com from/to (xadrez, damas)
    if (move.from && move.to) {
      const from = this._parsePosition(move.from);
      const to = this._parsePosition(move.to);

      if (from && to) {
        return {
          x: to.x,
          y: to.y,
          dx: to.x - from.x,
          dy: to.y - from.y
        };
      }
    }

    // Para movimentos com position numérica
    if (typeof move.position === 'number') {
      const normalized = move.position / (move.maxPositions || 64);
      return { x: normalized % 1, y: Math.floor(normalized) / 8, dx: 0, dy: 0 };
    }

    // Para movimentos com row/col
    if (move.row !== undefined && move.col !== undefined) {
      return {
        x: move.col / 7,
        y: move.row / 7,
        dx: 0,
        dy: 0
      };
    }

    return null;
  }

  /**
   * Parse de posição em notação (ex: 'e4' -> {x, y})
   *
   * @param {string|number} pos - Posição em notação ou número
   * @returns {Object|null} Posição normalizada {x, y}
   * @private
   */
  _parsePosition(pos) {
    if (typeof pos === 'number') {
      return { x: (pos % 8) / 7, y: Math.floor(pos / 8) / 7 };
    }

    if (typeof pos === 'string') {
      // Notação algébrica (xadrez: 'e4', 'a1')
      const match = pos.match(/^([a-h])([1-8])$/i);
      if (match) {
        const col = match[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
        const row = parseInt(match[2]) - 1;
        return { x: col / 7, y: row / 7 };
      }
    }

    return null;
  }

  /**
   * Calcula o nível de confiança baseado na quantidade de dados
   *
   * @param {number} moveCount - Número de movimentos registrados
   * @returns {number} Nível de confiança (0-1)
   * @private
   */
  _calculateConfidence(moveCount) {
    if (moveCount < AdaptiveAI.MIN_MOVES_FOR_ANALYSIS) {
      return 0.1;
    }

    // Função sigmoide para mapear quantidade -> confiança
    const minMoves = AdaptiveAI.MIN_MOVES_FOR_ANALYSIS;
    const optimalMoves = 30;

    if (moveCount >= optimalMoves) {
      return 0.9;
    }

    const ratio = (moveCount - minMoves) / (optimalMoves - minMoves);
    return 0.1 + (0.8 * (ratio * ratio)); // Quadrático para crescimento mais rápido no início
  }

  /**
   * Analisa os padrões de um jogador específico
   *
   * @param {string} playerId - ID do jogador
   * @returns {PatternStats|null} Estatísticas de padrões ou null se não houver dados
   */
  analyzePatterns(playerId) {
    const key = this._getKey(playerId);

    if (!this._patternStats.has(key)) {
      return null;
    }

    return { ...this._patternStats.get(key) };
  }

  /**
   * Prediz o próximo movimento do jogador baseado em padrões históricos
   *
   * @param {string} playerId - ID do jogador
   * @param {Object} [context={}] - Contexto atual do jogo
   * @returns {PredictionResult} Predição com movimento e confiança
   */
  predictNextMove(playerId, context = {}) {
    const key = this._getKey(playerId);

    if (!this._moveHistory.has(key)) {
      return { move: null, confidence: 0, pattern: null };
    }

    const history = this._moveHistory.get(key);

    if (history.length < AdaptiveAI.MIN_MOVES_FOR_ANALYSIS) {
      return { move: null, confidence: 0, pattern: 'insufficient_data' };
    }

    const stats = this._patternStats.get(key);
    const recentMoves = history.slice(-AdaptiveAI.RECENT_MOVES_WINDOW);

    // Encontra o movimento mais frequente nos dados recentes
    let bestMove = null;
    let bestFrequency = 0;
    let patternType = 'frequency';

    // Analisa frequências
    for (const [signature, freq] of Object.entries(stats.frequencies)) {
      if (freq > bestFrequency) {
        bestFrequency = freq;
        bestMove = this._signatureToMove(signature);
      }
    }

    // Se temos contexto, tenta encontrar padrões contextuais
    if (context && Object.keys(context).length > 0) {
      const contextualPrediction = this._predictFromContext(playerId, context, recentMoves);
      if (contextualPrediction && contextualPrediction.confidence > bestFrequency / recentMoves.length) {
        return contextualPrediction;
      }
    }

    // Calcula confiança baseada na frequência relativa
    const frequencyConfidence = bestFrequency / recentMoves.length;
    const storedConfidence = this._confidenceMap.get(key) || this.initialConfidence;
    const finalConfidence = Math.min(frequencyConfidence, storedConfidence);

    // Se a confiança for muito baixa, retorna null
    if (finalConfidence < AdaptiveAI.MIN_CONFIDENCE_THRESHOLD) {
      return { move: null, confidence: finalConfidence, pattern: 'low_confidence' };
    }

    // Detecta tipo de padrão específico
    if (stats.preferences.sideBias.right > stats.preferences.sideBias.left * 1.5) {
      patternType = 'right_bias';
    } else if (stats.preferences.sideBias.left > stats.preferences.sideBias.right * 1.5) {
      patternType = 'left_bias';
    } else if (stats.preferences.aggression > 0.7) {
      patternType = 'aggressive';
    } else if (stats.preferences.aggression < 0.3) {
      patternType = 'defensive';
    }

    return {
      move: bestMove,
      confidence: finalConfidence,
      pattern: patternType
    };
  }

  /**
   * Tenta predizer baseado no contexto atual
   *
   * @param {string} playerId - ID do jogador
   * @param {Object} context - Contexto atual
   * @param {MoveRecord[]} recentMoves - Movimentos recentes
   * @returns {PredictionResult|null} Predição contextual ou null
   * @private
   */
  _predictFromContext(playerId, context, recentMoves) {
    // Procura por movimentos similares no mesmo contexto
    const similarContextMoves = recentMoves.filter(m => {
      const ctx = m.context;
      if (!ctx) return false;

      // Compara turno/estágio do jogo
      if (context.turn && ctx.turn) {
        return Math.abs(context.turn - ctx.turn) <= 2;
      }

      // Compara fase do jogo
      if (context.phase && ctx.phase) {
        return context.phase === ctx.phase;
      }

      return false;
    });

    if (similarContextMoves.length === 0) {
      return null;
    }

    // Agrupa movimentos similares
    const moveCounts = {};
    similarContextMoves.forEach(m => {
      const sig = this._getMoveSignature(m.move);
      moveCounts[sig] = (moveCounts[sig] || 0) + 1;
    });

    // Encontra o mais frequente
    let bestSig = null;
    let bestCount = 0;

    for (const [sig, count] of Object.entries(moveCounts)) {
      if (count > bestCount) {
        bestCount = count;
        bestSig = sig;
      }
    }

    if (bestSig) {
      const confidence = bestCount / similarContextMoves.length;
      return {
        move: this._signatureToMove(bestSig),
        confidence: confidence * 0.9, // Penalidade por ser contextual
        pattern: 'contextual'
      };
    }

    return null;
  }

  /**
   * Converte uma assinatura de movimento de volta para objeto
   *
   * @param {string} signature - Assinatura do movimento
   * @returns {Object} Objeto de movimento
   * @private
   */
  _signatureToMove(signature) {
    // Tenta parse de from->to
    const arrowMatch = signature.match(/^(.+)->(.+)$/);
    if (arrowMatch) {
      return { from: arrowMatch[1], to: arrowMatch[2] };
    }

    // Tenta parse de pos:N
    const posMatch = signature.match(/^pos:(.+)$/);
    if (posMatch) {
      return { position: parseInt(posMatch[1]) };
    }

    // Tenta parse de rNcN
    const rcMatch = signature.match(/^r(\d+)c(\d+)$/);
    if (rcMatch) {
      return { row: parseInt(rcMatch[1]), col: parseInt(rcMatch[2]) };
    }

    // Retorna como string simples
    return { move: signature };
  }

  /**
   * Ajusta a dificuldade da IA baseado na taxa de vitória do jogador
   *
   * @param {number} playerWinRate - Taxa de vitória do jogador (0-1)
   * @param {string} [playerId] - ID opcional do jogador para ajuste individual
   * @returns {number} Nova confiança da IA
   */
  adjustDifficulty(playerWinRate, playerId = null) {
    let targetKey = null;

    if (playerId) {
      targetKey = this._getKey(playerId);
    }

    const adjustConfidence = (key) => {
      const currentConfidence = this._confidenceMap.get(key) || this.initialConfidence;
      let adjustment = 0;

      if (playerWinRate > 0.7) {
        // Jogador vence muito - aumenta dificuldade
        adjustment = this.learningRate * 1.5;
      } else if (playerWinRate > 0.5) {
        // Jogador vence mais que perde - aumenta levemente
        adjustment = this.learningRate * 0.5;
      } else if (playerWinRate < 0.3) {
        // Jogador perde muito - diminui dificuldade
        adjustment = -this.learningRate * 1.5;
      } else if (playerWinRate < 0.5) {
        // Jogador perde mais que vence - diminui levemente
        adjustment = -this.learningRate * 0.5;
      }

      const newConfidence = Math.max(0.1, Math.min(0.9, currentConfidence + adjustment));
      this._confidenceMap.set(key, newConfidence);

      return newConfidence;
    };

    if (targetKey) {
      return adjustConfidence(targetKey);
    } else {
      // Ajusta para todos os jogadores
      let avgConfidence = 0;
      let count = 0;

      for (const key of this._confidenceMap.keys()) {
        avgConfidence += adjustConfidence(key);
        count++;
      }

      return count > 0 ? avgConfidence / count : this.initialConfidence;
    }
  }

  /**
   * Retorna o nível de confiança atual para um jogador
   *
   * @param {string} playerId - ID do jogador
   * @returns {number} Nível de confiança (0-1)
   */
  getConfidence(playerId) {
    const key = this._getKey(playerId);
    return this._confidenceMap.get(key) || this.initialConfidence;
  }

  /**
   * Registra resultado de uma partida para ajuste de dificuldade
   *
   * @param {string} playerId - ID do jogador
   * @param {boolean} playerWon - Se o jogador venceu
   * @returns {AdaptiveAI} Retorna a instância para encadeamento
   */
  recordResult(playerId, playerWon) {
    const key = this._getKey(playerId);

    if (!this._winStats.has(key)) {
      this._winStats.set(key, { wins: 0, losses: 0, total: 0 });
    }

    const stats = this._winStats.get(key);

    if (playerWon) {
      stats.wins++;
    } else {
      stats.losses++;
    }
    stats.total++;

    // Calcula win rate e ajusta dificuldade
    const winRate = stats.wins / stats.total;
    this.adjustDifficulty(winRate, playerId);

    return this;
  }

  /**
   * Reseta todos os dados de um jogador
   *
   * @param {string} playerId - ID do jogador
   * @returns {boolean} True se havia dados para remover
   */
  reset(playerId) {
    const key = this._getKey(playerId);
    const hadData = this._moveHistory.has(key);

    this._moveHistory.delete(key);
    this._confidenceMap.delete(key);
    this._patternStats.delete(key);
    this._winStats.delete(key);

    return hadData;
  }

  /**
   * Reseta todos os dados de todos os jogadores
   *
   * @returns {AdaptiveAI} Retorna a instância para encadeamento
   */
  resetAll() {
    this._moveHistory.clear();
    this._confidenceMap.clear();
    this._patternStats.clear();
    this._winStats.clear();

    return this;
  }

  /**
   * Exporta todos os dados para persistência
   *
   * @returns {Object} Objeto com todos os dados serializáveis
   */
  exportData() {
    const data = {
      gameType: this.gameType,
      initialConfidence: this.initialConfidence,
      learningRate: this.learningRate,
      maxHistorySize: this.maxHistorySize,
      players: {}
    };

    // Coleta todas as chaves únicas
    const allKeys = new Set([
      ...this._moveHistory.keys(),
      ...this._confidenceMap.keys(),
      ...this._patternStats.keys(),
      ...this._winStats.keys()
    ]);

    for (const key of allKeys) {
      const playerId = key.replace(`_${this.gameType}`, '');

      data.players[playerId] = {
        history: this._moveHistory.get(key) || [],
        confidence: this._confidenceMap.get(key) || this.initialConfidence,
        stats: this._patternStats.get(key) || null,
        winStats: this._winStats.get(key) || { wins: 0, losses: 0, total: 0 }
      };
    }

    return data;
  }

  /**
   * Importa dados previamente exportados
   *
   * @param {Object} data - Dados exportados
   * @returns {boolean} True se a importação foi bem-sucedida
   */
  importData(data) {
    try {
      if (!data || typeof data !== 'object') {
        return false;
      }

      // Validação básica
      if (data.gameType && data.gameType !== this.gameType) {
        console.warn(`AdaptiveAI: GameType mismatch - expected ${this.gameType}, got ${data.gameType}`);
        // Continua mesmo assim, pois pode ser importação de backup
      }

      // Restaura configurações
      if (data.initialConfidence !== undefined) {
        this.initialConfidence = data.initialConfidence;
      }
      if (data.learningRate !== undefined) {
        this.learningRate = data.learningRate;
      }
      if (data.maxHistorySize !== undefined) {
        this.maxHistorySize = data.maxHistorySize;
      }

      // Restaura dados dos jogadores
      if (data.players && typeof data.players === 'object') {
        for (const [playerId, playerData] of Object.entries(data.players)) {
          const key = this._getKey(playerId);

          if (playerData.history && Array.isArray(playerData.history)) {
            this._moveHistory.set(key, playerData.history);
          }

          if (playerData.confidence !== undefined) {
            this._confidenceMap.set(key, playerData.confidence);
          }

          if (playerData.stats) {
            this._patternStats.set(key, playerData.stats);
          }

          if (playerData.winStats) {
            this._winStats.set(key, playerData.winStats);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('AdaptiveAI: Error importing data:', error);
      return false;
    }
  }

  /**
   * Retorna estatísticas gerais do sistema
   *
   * @returns {Object} Estatísticas do sistema
   */
  getSystemStats() {
    const playerCount = this._moveHistory.size;
    const totalMoves = Array.from(this._moveHistory.values())
      .reduce((sum, history) => sum + history.length, 0);

    const avgConfidence = Array.from(this._confidenceMap.values())
      .reduce((sum, conf) => sum + conf, 0) / (this._confidenceMap.size || 1);

    return {
      gameType: this.gameType,
      registeredPlayers: playerCount,
      totalMovesRecorded: totalMoves,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      avgMovesPerPlayer: playerCount > 0 ? Math.round(totalMoves / playerCount) : 0
    };
  }
}

/**
 * Factory function para criar instâncias de AdaptiveAI
 *
 * @param {string} gameType - Tipo do jogo
 * @param {Object} [options={}] - Opções de configuração
 * @returns {AdaptiveAI} Nova instância de AdaptiveAI
 */
export function createAdaptiveAI(gameType, options = {}) {
  return new AdaptiveAI(gameType, options);
}

export default AdaptiveAI;
