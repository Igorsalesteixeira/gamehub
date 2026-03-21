/**
 * Sistema de Desafios — Games Hub
 *
 * Gerencia desafios entre amigos para jogos multiplayer.
 * Cria salas automaticamente ao aceitar desafios.
 *
 * @module challenge-system
 */

import { supabase } from './supabase.js';
import { generateRoomId } from './games/shared/multiplayer-manager.js';

const MODULE_NAME = '[ChallengeSystem]';

// =============================================
//  Envio e Gerenciamento de Desafios
// =============================================

/**
 * Envia um desafio para um amigo
 * @param {string} friendId - ID do amigo a ser desafiado
 * @param {string} gameType - Tipo do jogo (ex: 'tictactoe', 'chess')
 * @param {Object} options - Opções adicionais
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function sendChallenge(friendId, gameType, options = {}) {
  console.log(MODULE_NAME, 'Enviando desafio:', { friendId, gameType });

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const currentUserId = session.user.id;

    // Verifica se o jogo existe e é multiplayer
    const validGames = ['tictactoe', 'chess', 'checkers', 'connect4', 'reversi',
                        'ludo', 'domino', 'go', 'battleship', 'truco', 'uno',
                        'poker', 'buraco'];

    if (!validGames.includes(gameType)) {
      return { data: null, error: new Error('Jogo não suporta multiplayer') };
    }

    // Verifica se já existe desafio pendente entre os mesmos usuários para o mesmo jogo
    const { data: existingChallenge } = await supabase
      .from('challenges')
      .select('id')
      .eq('challenger_id', currentUserId)
      .eq('challenged_id', friendId)
      .eq('game_type', gameType)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingChallenge) {
      return { data: null, error: new Error('Já existe um desafio pendente para este jogo') };
    }

    // Cria o desafio
    const { data, error } = await supabase
      .from('challenges')
      .insert({
        challenger_id: currentUserId,
        challenged_id: friendId,
        game_type: gameType,
        status: 'pending',
        message: options.message || null
      })
      .select(`
        *,
        challenger:challenger_id (id, username, display_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error(MODULE_NAME, 'Erro ao criar desafio:', error);
      return { data: null, error };
    }

    // Cria notificação para o desafiado
    await createChallengeNotification(friendId, data);

    console.log(MODULE_NAME, 'Desafio criado:', data);
    return { data, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Aceita um desafio e cria a sala de jogo
 * @param {string} challengeId - ID do desafio
 * @returns {Promise<{roomId: string|null, gameUrl: string|null, error: Error|null}>}
 */
export async function acceptChallenge(challengeId) {
  console.log(MODULE_NAME, 'Aceitando desafio:', challengeId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { roomId: null, gameUrl: null, error: new Error('Usuário não autenticado') };
    }

    // Busca o desafio
    const { data: challenge, error: fetchError } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .eq('challenged_id', session.user.id)
      .eq('status', 'pending')
      .single();

    if (fetchError || !challenge) {
      return { roomId: null, gameUrl: null, error: new Error('Desafio não encontrado ou já respondido') };
    }

    // Gera ID da sala
    const roomId = generateRoomId();

    // Atualiza o desafio
    const { error: updateError } = await supabase
      .from('challenges')
      .update({
        status: 'accepted',
        room_id: roomId,
        accepted_at: new Date().toISOString()
      })
      .eq('id', challengeId);

    if (updateError) {
      console.error(MODULE_NAME, 'Erro ao atualizar desafio:', updateError);
      return { roomId: null, gameUrl: null, error: updateError };
    }

    // Cria notificação para quem desafiou
    await createChallengeAcceptedNotification(challenge.challenger_id, session.user.id, challenge.game_type);

    // Constrói URL do jogo
    const gameUrl = buildGameUrl(challenge.game_type, roomId);

    console.log(MODULE_NAME, 'Desafio aceito, sala criada:', roomId);
    return { roomId, gameUrl, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { roomId: null, gameUrl: null, error: e };
  }
}

/**
 * Recusa um desafio
 * @param {string} challengeId - ID do desafio
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function declineChallenge(challengeId) {
  console.log(MODULE_NAME, 'Recusando desafio:', challengeId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: new Error('Usuário não autenticado') };
    }

    const { data: challenge } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .eq('challenged_id', session.user.id)
      .eq('status', 'pending')
      .single();

    if (!challenge) {
      return { success: false, error: new Error('Desafio não encontrado') };
    }

    const { error } = await supabase
      .from('challenges')
      .update({
        status: 'declined',
        declined_at: new Date().toISOString()
      })
      .eq('id', challengeId);

    if (error) {
      console.error(MODULE_NAME, 'Erro ao recusar desafio:', error);
      return { success: false, error };
    }

    // Notifica quem desafiou
    await createChallengeDeclinedNotification(challenge.challenger_id, session.user.id, challenge.game_type);

    console.log(MODULE_NAME, 'Desafio recusado');
    return { success: true, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { success: false, error: e };
  }
}

/**
 * Lista desafios pendentes recebidos
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getPendingChallenges() {
  console.log(MODULE_NAME, 'Buscando desafios pendentes');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const { data, error } = await supabase
      .from('challenges')
      .select(`
        *,
        challenger:challenger_id (id, username, display_name, avatar_url)
      `)
      .eq('challenged_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar desafios:', error);
      return { data: null, error };
    }

    console.log(MODULE_NAME, 'Desafios pendentes:', data?.length || 0);
    return { data: data || [], error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Retorna a contagem de desafios pendentes
 * @returns {Promise<{count: number, error: Error|null}>}
 */
export async function getPendingChallengeCount() {
  console.log(MODULE_NAME, 'Obtendo contagem de desafios pendentes');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { count: 0, error: null };
    }

    const { count, error } = await supabase
      .from('challenges')
      .select('*', { count: 'exact', head: true })
      .eq('challenged_id', session.user.id)
      .eq('status', 'pending');

    if (error) {
      console.error(MODULE_NAME, 'Erro ao contar desafios:', error);
      return { count: 0, error };
    }

    return { count: count || 0, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { count: 0, error: e };
  }
}

/**
 * Lista desafios enviados pendentes
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getSentChallenges() {
  console.log(MODULE_NAME, 'Buscando desafios enviados');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const { data, error } = await supabase
      .from('challenges')
      .select(`
        *,
        challenged:challenged_id (id, username, display_name, avatar_url)
      `)
      .eq('challenger_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar desafios enviados:', error);
      return { data: null, error };
    }

    console.log(MODULE_NAME, 'Desafios enviados:', data?.length || 0);
    return { data: data || [], error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Cancela um desafio enviado
 * @param {string} challengeId - ID do desafio
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function cancelChallenge(challengeId) {
  console.log(MODULE_NAME, 'Cancelando desafio:', challengeId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: new Error('Usuário não autenticado') };
    }

    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', challengeId)
      .eq('challenger_id', session.user.id)
      .eq('status', 'pending');

    if (error) {
      console.error(MODULE_NAME, 'Erro ao cancelar desafio:', error);
      return { success: false, error };
    }

    console.log(MODULE_NAME, 'Desafio cancelado');
    return { success: true, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { success: false, error: e };
  }
}

// =============================================
//  Realtime Subscriptions
// =============================================

/**
 * Inscreve em atualizações de desafios em tempo real
 * @param {string} userId - ID do usuário (opcional)
 * @param {Function} onNewChallenge - Callback para novos desafios
 * @param {Function} onChallengeAccepted - Callback para desafios aceitos
 * @param {Function} onChallengeDeclined - Callback para desafios recusados
 * @returns {Promise<{channel: Object|null, error: Error|null}>}
 */
export async function subscribeToChallenges(
  userId = null,
  onNewChallenge = null,
  onChallengeAccepted = null,
  onChallengeDeclined = null
) {
  console.log(MODULE_NAME, 'Inscrevendo em desafios');

  try {
    let targetUserId = userId;

    if (!targetUserId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { channel: null, error: new Error('Usuário não autenticado') };
      }
      targetUserId = session.user.id;
    }

    const channel = supabase.channel(`challenges:${targetUserId}`);

    // Novos desafios recebidos
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'challenges',
      filter: `challenged_id=eq.${targetUserId}`
    }, (payload) => {
      console.log(MODULE_NAME, 'Novo desafio recebido:', payload.new);
      if (onNewChallenge) onNewChallenge(payload.new);
    });

    // Desafios aceitos (como challenger)
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'challenges',
      filter: `challenger_id=eq.${targetUserId}`
    }, (payload) => {
      if (payload.new.status === 'accepted' && payload.old.status === 'pending') {
        console.log(MODULE_NAME, 'Desafio aceito:', payload.new);
        if (onChallengeAccepted) onChallengeAccepted(payload.new);
      }
      if (payload.new.status === 'declined' && payload.old.status === 'pending') {
        console.log(MODULE_NAME, 'Desafio recusado:', payload.new);
        if (onChallengeDeclined) onChallengeDeclined(payload.new);
      }
    });

    await channel.subscribe();

    console.log(MODULE_NAME, 'Inscrito em desafios com sucesso');
    return { channel, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro ao inscrever:', e);
    return { channel: null, error: e };
  }
}

// =============================================
//  Funções Auxiliares
// =============================================

function buildGameUrl(gameType, roomId) {
  const gamePaths = {
    tictactoe: '/games/tictactoe/',
    chess: '/games/chess/',
    checkers: '/games/checkers/',
    connect4: '/games/connect4/',
    reversi: '/games/reversi/',
    ludo: '/games/ludo/',
    domino: '/games/domino/',
    go: '/games/go/',
    battleship: '/games/battleship/',
    truco: '/games/truco/',
    uno: '/games/uno/',
    poker: '/games/poker/',
    buraco: '/games/buraco/'
  };

  const basePath = gamePaths[gameType] || `/games/${gameType}/`;
  return `${basePath}?room=${roomId}`;
}

async function createChallengeNotification(userId, challenge) {
  try {
    const { data: challenger } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', challenge.challenger_id)
      .single();

    const displayName = challenger?.display_name || challenger?.username || 'Alguém';
    const gameName = getGameDisplayName(challenge.game_type);

    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'challenge_received',
      title: 'Novo desafio!',
      message: `${displayName} desafiou você para uma partida de ${gameName}`,
      data: {
        challenge_id: challenge.id,
        game_type: challenge.game_type,
        challenger_id: challenge.challenger_id
      }
    });
  } catch (e) {
    console.warn(MODULE_NAME, 'Erro ao criar notificação:', e);
  }
}

async function createChallengeAcceptedNotification(userId, accepterId, gameType) {
  try {
    const { data: accepter } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', accepterId)
      .single();

    const displayName = accepter?.display_name || accepter?.username || 'Alguém';
    const gameName = getGameDisplayName(gameType);

    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'challenge_accepted',
      title: 'Desafio aceito!',
      message: `${displayName} aceitou seu desafio de ${gameName}`,
      data: {
        game_type: gameType,
        accepter_id: accepterId
      }
    });
  } catch (e) {
    console.warn(MODULE_NAME, 'Erro ao criar notificação:', e);
  }
}

async function createChallengeDeclinedNotification(userId, declinerId, gameType) {
  try {
    const { data: decliner } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', declinerId)
      .single();

    const displayName = decliner?.display_name || decliner?.username || 'Alguém';
    const gameName = getGameDisplayName(gameType);

    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'challenge_declined',
      title: 'Desafio recusado',
      message: `${displayName} recusou seu desafio de ${gameName}`,
      data: {
        game_type: gameType,
        decliner_id: declinerId
      }
    });
  } catch (e) {
    console.warn(MODULE_NAME, 'Erro ao criar notificação:', e);
  }
}

function getGameDisplayName(gameType) {
  const names = {
    tictactoe: 'Jogo da Velha',
    chess: 'Xadrez',
    checkers: 'Damas',
    connect4: 'Conecte 4',
    reversi: 'Reversi',
    ludo: 'Ludo',
    domino: 'Dominó',
    go: 'Go',
    battleship: 'Batalha Naval',
    truco: 'Truco',
    uno: 'UNO',
    poker: 'Poker',
    buraco: 'Buraco'
  };
  return names[gameType] || gameType;
}

// =============================================
//  Classe ChallengeManager
// =============================================

/**
 * Gerenciador completo de desafios com realtime
 * @class ChallengeManager
 */
export class ChallengeManager {
  constructor() {
    this.channel = null;
    this.listeners = new Map();
    this.userId = null;
  }

  /**
   * Inicializa o gerenciador
   * @returns {Promise<boolean>}
   */
  async init() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      this.userId = session.user.id;
      await this.setupRealtime();
      return true;
    } catch (e) {
      console.error(MODULE_NAME, 'Erro ao inicializar ChallengeManager:', e);
      return false;
    }
  }

  async setupRealtime() {
    const { channel, error } = await subscribeToChallenges(
      this.userId,
      (challenge) => this._notifyListeners('new', challenge),
      (challenge) => this._notifyListeners('accepted', challenge),
      (challenge) => this._notifyListeners('declined', challenge)
    );

    if (error) {
      console.error(MODULE_NAME, 'Erro ao configurar realtime:', error);
      return;
    }

    this.channel = channel;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  _notifyListeners(event, payload) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(payload);
        } catch (e) {
          console.error(MODULE_NAME, 'Erro no listener:', e);
        }
      });
    }
  }

  /**
   * Navega para o jogo do desafio aceito
   * @param {string} challengeId - ID do desafio
   */
  async joinGame(challengeId) {
    const { data: challenge } = await supabase
      .from('challenges')
      .select('game_type, room_id, status')
      .eq('id', challengeId)
      .single();

    if (challenge && challenge.status === 'accepted' && challenge.room_id) {
      const gameUrl = buildGameUrl(challenge.game_type, challenge.room_id);
      window.location.href = gameUrl;
    }
  }

  cleanup() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.listeners.clear();
  }
}
