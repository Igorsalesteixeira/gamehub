/**
 * Módulo de Gerenciamento Multiplayer
 *
 * Gerencia canais Supabase Realtime para jogos multiplayer.
 * Suporta broadcast, postgres_changes, reconexão automática e limpeza.
 *
 * @module multiplayer-manager
 */

import { supabase } from '../../supabase.js';

/**
 * Gerenciador de multiplayer via Supabase Realtime.
 * Suporta salas, broadcast, presence e sincronização de estado.
 * @class MultiplayerManager
 */
export class MultiplayerManager {
  /**
   * Cria uma instância de MultiplayerManager.
   *
   * @param {string} gameType - Identificador do jogo (ex: 'tictactoe', 'chess', 'checkers', 'connect4')
   * @param {string} roomId - ID da sala
   * @param {Object} options - Opções adicionais
   * @param {string} [options.tableName='game_rooms'] - Nome da tabela
   * @param {string} [options.channelPrefix='room'] - Prefixo do canal
   * @param {boolean} [options.useGameSpecificChannel=false] - Usar prefixo do jogo no canal
   * @param {boolean} [options.autoReconnect=true] - Reconecta automaticamente
   * @param {number} [options.reconnectDelay=3000] - Delay de reconexão em ms
   * @param {number} [options.maxReconnectAttempts=5] - Máximo de tentativas
   * @param {Function} [options.onConnect] - Callback quando conecta
   * @param {Function} [options.onDisconnect] - Callback quando desconecta
   * @param {Function} [options.onError] - Callback de erro
   */
  constructor(gameType, roomId, options = {}) {
    this.gameType = gameType;
    this.roomId = roomId;
    this.options = {
      tableName: options.tableName || 'game_rooms',
      channelPrefix: options.channelPrefix || 'room',
      useGameSpecificChannel: options.useGameSpecificChannel || false,
    };

    this.channel = null;
    this._dbChannel = null;
    this.myUserId = null;
    this.myPlayerNumber = null;
    this.roomData = null;
    this.isHost = false;
    this.opponentConnected = false;
    this.listeners = new Map();
    this.subscribed = false;

    // Callbacks de estado
    this.onConnectionChange = null;
    this.onError = null;
  }

  // ========== GETTERS ==========

  get isMultiplayer() {
    return !!this.roomId;
  }

  get isConnected() {
    return this.subscribed;
  }

  get opponentName() {
    if (!this.roomData) return 'Oponente';
    return this.myPlayerNumber === 1
      ? (this.roomData.player2_name || 'Jogador 2')
      : (this.roomData.player1_name || 'Jogador 1');
  }

  get myName() {
    if (!this.roomData) return 'Jogador';
    return this.myPlayerNumber === 1
      ? (this.roomData.player1_name || 'Jogador 1')
      : (this.roomData.player2_name || 'Jogador 2');
  }

  // ========== INITIALIZATION ==========

  /**
   * Inicializa o multiplayer: autentica, entra na sala e configura o canal
   * @returns {Promise<boolean>} - true se sucesso, false se falha
   */
  async init() {
    if (!this.roomId) return false;

    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        this._redirectToAuth();
        return false;
      }
      this.myUserId = session.user.id;

      // Join room
      const success = await this.joinRoom();
      if (!success) return false;

      // Setup channel
      this.setupChannel();

      return true;
    } catch (e) {
      console.error('[MultiplayerManager] Init error:', e);
      if (this.onError) this.onError(e);
      return false;
    }
  }

  /**
   * Entra em uma sala existente ou cria uma nova
   * @returns {Promise<boolean>}
   */
  async joinRoom() {
    try {
      const { data, error } = await supabase
        .from(this.options.tableName)
        .select('*')
        .eq(this.options.tableName === 'chess_rooms' ? 'room_id' : 'id', this.roomId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[MultiplayerManager] Error fetching room:', error);
        if (this.onError) this.onError(new Error('Erro ao conectar à sala'));
        return false;
      }

      if (data) {
        // Join existing room
        if (this.options.tableName === 'chess_rooms') {
          // Chess usa estrutura diferente
          return await this._joinChessRoom(data);
        } else {
          return await this._joinStandardRoom(data);
        }
      } else {
        // Create new room
        if (this.options.tableName === 'chess_rooms') {
          return await this._createChessRoom();
        } else {
          return await this._createStandardRoom();
        }
      }
    } catch (e) {
      console.error('[MultiplayerManager] Join room error:', e);
      if (this.onError) this.onError(e);
      return false;
    }
  }

  async _joinStandardRoom(data) {
    this.roomData = data;

    // Determine player role
    if (data.player1_id === this.myUserId) {
      this.myPlayerNumber = 1;
      this.isHost = true;
    } else if (!data.player2_id || data.player2_id === this.myUserId) {
      this.myPlayerNumber = 2;
      this.isHost = false;

      // Update room with player 2
      try {
        await supabase
          .from(this.options.tableName)
          .update({
            player2_id: this.myUserId,
            player2_name: this._getPlayerName(),
            status: 'playing'
          })
          .eq('id', this.roomId);
      } catch (e) {
        console.error('[MultiplayerManager] Error updating room with player 2:', e);
        if (this.onError) this.onError(new Error('Erro ao atualizar sala'));
        return false;
      }
    } else {
      if (this.onError) this.onError(new Error('Sala cheia'));
      return false;
    }

    return true;
  }

  async _joinChessRoom(data) {
    this.roomData = data;

    if (data.player2_id) {
      if (this.onError) this.onError(new Error('Sala cheia'));
      return false;
    }

    // Assign black to second player
    this.myPlayerNumber = 2;
    this.isHost = false;

    // Update room with player 2
    try {
      await supabase
        .from(this.options.tableName)
        .update({
          player2_id: this.myUserId,
          player2_name: this._getPlayerName(),
          status: 'playing'
        })
        .eq('room_id', this.roomId);
    } catch (e) {
      console.error('[MultiplayerManager] Error updating chess room with player 2:', e);
      if (this.onError) this.onError(new Error('Erro ao atualizar sala'));
      return false;
    }

    return true;
  }

  async _createStandardRoom() {
    this.myPlayerNumber = 1;
    this.isHost = true;

    try {
      await supabase.from(this.options.tableName).insert({
        id: this.roomId,
        player1_id: this.myUserId,
        player1_name: this._getPlayerName(),
        status: 'waiting',
        turn: 1,
        game_type: this.gameType
      });
    } catch (e) {
      console.error('[MultiplayerManager] Error creating standard room:', e);
      if (this.onError) this.onError(new Error('Erro ao criar sala'));
      return false;
    }

    return true;
  }

  async _createChessRoom() {
    this.myPlayerNumber = 1;
    this.isHost = true;

    try {
      await supabase.from(this.options.tableName).insert({
        room_id: this.roomId,
        player1_id: this.myUserId,
        player1_name: this._getPlayerName(),
        status: 'waiting',
        game_state: null
      });
    } catch (e) {
      console.error('[MultiplayerManager] Error creating chess room:', e);
      if (this.onError) this.onError(new Error('Erro ao criar sala'));
      return false;
    }

    return true;
  }

  // ========== CHANNEL MANAGEMENT ==========

  setupChannel() {
    const channelName = this.options.useGameSpecificChannel
      ? `${this.gameType}:${this.roomId}`
      : `${this.options.channelPrefix}-${this.roomId}`;

    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });

    // Setup broadcast listeners
    this.listeners.forEach((callback, event) => {
      this.channel.on('broadcast', { event }, ({ payload }) => {
        callback(payload);
      });
    });

    // Subscribe
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.subscribed = true;
        this._notifyPlayerJoined();
        if (this.onConnectionChange) this.onConnectionChange(true);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        this.subscribed = false;
        if (this.onConnectionChange) this.onConnectionChange(false);
      }
    });

    // Listen for database changes (opponent connection)
    if (this.options.tableName === 'chess_rooms') {
      this._dbChannel = supabase
        .channel(`db:${this.options.tableName}:${this.roomId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: this.options.tableName,
          filter: `room_id=eq.${this.roomId}`
        }, (payload) => {
          if (payload.new.status === 'playing' && !this.opponentConnected) {
            this.opponentConnected = true;
            this.roomData = payload.new;
          }
        })
        .subscribe();
    }
  }

  _notifyPlayerJoined() {
    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'player_joined',
      payload: {
        playerNumber: this.myPlayerNumber,
        playerName: this.myName,
        userId: this.myUserId
      }
    });
  }

  // ========== EVENT HANDLING ==========

  /**
   * Registra um listener para um evento de broadcast
   * @param {string} event - Nome do evento (ex: 'move', 'game_reset')
   * @param {Function} callback - Função callback(payload)
   */
  on(event, callback) {
    this.listeners.set(event, callback);

    // Se o canal já existe, adiciona listener
    if (this.channel) {
      this.channel.on('broadcast', { event }, ({ payload }) => {
        callback(payload);
      });
    }
  }

  /**
   * Remove um listener
   * @param {string} event - Nome do evento
   */
  off(event) {
    this.listeners.delete(event);
  }

  /**
   * Envia um evento de broadcast
   * @param {string} event - Nome do evento
   * @param {Object} payload - Dados do evento
   */
  async send(event, payload = {}) {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event,
      payload: { ...payload, playerId: this.myUserId }
    });
  }

  // ========== STATE MANAGEMENT ==========

  /**
   * Atualiza o estado da sala no banco de dados
   * @param {Object} state - Estado do jogo
   * @param {Object} extra - Campos extras (ex: turn, status)
   */
  async updateState(state, extra = {}) {
    if (!this.roomId) return;

    const updateData = {
      state,
      ...extra
    };

    const idField = this.options.tableName === 'chess_rooms' ? 'room_id' : 'id';

    try {
      await supabase
        .from(this.options.tableName)
        .update(updateData)
        .eq(idField, this.roomId);
    } catch (e) {
      console.warn('[MultiplayerManager] Error updating state:', e);
      throw e;
    }
  }

  /**
   * Atualiza o turno no banco de dados
   * @param {number} turnNumber - Número do jogador (1 ou 2)
   */
  async updateTurn(turnNumber) {
    await this.updateState(null, { turn: turnNumber });
  }

  /**
   * Marca o jogo como finalizado
   * @param {string} winnerId - ID do vencedor (ou null para empate)
   */
  async finishGame(winnerId = null) {
    await this.updateState(null, {
      status: 'finished',
      winner: winnerId
    });
  }

  /**
   * Reseta o estado da sala para novo jogo
   * @param {Object} initialState - Estado inicial do jogo
   */
  async resetRoom(initialState = {}) {
    const resetData = {
      state: initialState,
      turn: 1,
      status: 'playing',
      winner: null
    };

    const idField = this.options.tableName === 'chess_rooms' ? 'room_id' : 'id';

    await supabase
      .from(this.options.tableName)
      .update(resetData)
      .eq(idField, this.roomId);
  }

  // ========== UTILITY ==========

  /**
   * Verifica se é o turno do jogador atual
   * @param {number} currentTurn - Turno atual (1 ou 2)
   * @returns {boolean}
   */
  isMyTurn(currentTurn) {
    return currentTurn === this.myPlayerNumber;
  }

  /**
   * Retorna o número do jogador baseado no ID
   * @param {string} userId - ID do usuário
   * @returns {number|null}
   */
  getPlayerNumber(userId) {
    if (!this.roomData) return null;
    if (this.roomData.player1_id === userId) return 1;
    if (this.roomData.player2_id === userId) return 2;
    return null;
  }

  /**
   * Sai da sala e limpa recursos
   */
  async leave() {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }

    if (this._dbChannel) {
      await this._dbChannel.unsubscribe();
      this._dbChannel = null;
    }

    // Se for host, remove a sala
    if (this.isHost && this.roomId) {
      const idField = this.options.tableName === 'chess_rooms' ? 'room_id' : 'id';
      await supabase
        .from(this.options.tableName)
        .delete()
        .eq(idField, this.roomId);
    }

    this.subscribed = false;
    this.listeners.clear();
  }

  /**
   * Limpa recursos ao sair da página
   */
  cleanup() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    if (this._dbChannel) {
      this._dbChannel.unsubscribe();
      this._dbChannel = null;
    }
    this.subscribed = false;
  }

  // ========== PRIVATE HELPERS ==========

  _redirectToAuth() {
    window.location.href = '/auth.html?redirect=' + encodeURIComponent(window.location.href);
  }

  _getPlayerName() {
    return localStorage.getItem(`${this.gameType}_player_name`) || 'Jogador';
  }

  _savePlayerName(name) {
    localStorage.setItem(`${this.gameType}_player_name`, name);
  }
}

// =============================================
//  GameStats — Salvamento unificado de estatísticas
// =============================================

export class GameStats {
  /**
   * @param {string} gameType - Identificador do jogo
   */
  constructor(gameType) {
    this.gameType = gameType;
  }

  /**
   * Salva estatísticas de uma partida
   * @param {Object} stats - Estatísticas da partida
   * @param {string} stats.result - Resultado ('win', 'loss', 'draw')
   * @param {number} stats.moves - Número de movimentos
   * @param {number} stats.timeSeconds - Tempo em segundos
   * @param {string} stats.roomId - ID da sala (opcional)
   * @param {boolean} stats.isMultiplayer - Se é multiplayer
   */
  async save(stats) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.from('game_stats').insert({
        user_id: session.user.id,
        game: this.gameType,
        result: stats.result,
        moves: stats.moves || 0,
        time_seconds: stats.timeSeconds || 0,
        room_id: stats.roomId || null,
        is_multiplayer: stats.isMultiplayer || false
      });
    } catch (e) {
      console.warn('[GameStats] Error saving stats:', e);
    }
  }
}

// =============================================
//  Utility Functions
// =============================================

/**
 * Obtém parâmetros da URL
 * @returns {URLSearchParams}
 */
export function getUrlParams() {
  return new URLSearchParams(window.location.search);
}

/**
 * Gera um ID de sala único
 * @returns {string}
 */
export function generateRoomId() {
  return crypto.randomUUID();
}

/**
 * Cria uma nova sala e redireciona para ela
 * @param {string} gameType - Tipo do jogo
 * @param {string} basePath - Caminho base do jogo (ex: '/games/tictactoe/')
 */
export async function createAndJoinRoom(gameType, basePath) {
  const roomId = generateRoomId();
  const newUrl = `${basePath}?room=${roomId}`;
  window.history.pushState({}, '', newUrl);
  return roomId;
}

/**
 * Cria um manager multiplayer para um jogo.
 * Factory function para criar instâncias MultiplayerManager.
 *
 * @param {string} gameId - ID do jogo
 * @param {string} roomId - ID da sala
 * @param {Object} options - Opções adicionais
 * @returns {MultiplayerManager} Manager configurado
 *
 * @example
 * const mp = createMultiplayer('tictactoe', 'room-123', {
 *   onConnect: () => console.log('Conectado!'),
 *   onMessage: (event, data) => console.log(event, data)
 * });
 * await mp.init();
 */
export function createMultiplayer(gameId, roomId, options = {}) {
  return new MultiplayerManager(gameId, roomId, options);
}

/**
 * Verifica se Realtime está disponível.
 *
 * @returns {boolean} Se está disponível
 */
export function isRealtimeAvailable() {
  return typeof supabase !== 'undefined' && supabase.realtime !== null;
}
