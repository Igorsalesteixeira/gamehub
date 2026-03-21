/**
 * Sistema de Amizades — Games Hub
 *
 * Gerencia solicitações de amizade, lista de amigos, busca de usuários e bloqueio.
 * Usa Supabase Realtime para atualizações em tempo real.
 *
 * @module social
 */

import { supabase } from './supabase.js';

const MODULE_NAME = '[Social]';

// =============================================
//  Funções de Gerenciamento de Amizades
// =============================================

/**
 * Envia uma solicitação de amizade para um usuário
 * @param {string} userId - ID do usuário a ser adicionado como amigo
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function sendFriendRequest(userId) {
  console.log(MODULE_NAME, 'Enviando solicitação para:', userId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error(MODULE_NAME, 'Usuário não autenticado');
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const currentUserId = session.user.id;

    if (currentUserId === userId) {
      return { data: null, error: new Error('Não pode enviar solicitação para si mesmo') };
    }

    // Verifica se já existe uma relação
    const { data: existingRelation } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUserId})`)
      .single();

    if (existingRelation) {
      return { data: null, error: new Error('Já existe uma relação entre esses usuários') };
    }

    // Cria a solicitação
    const { data, error } = await supabase
      .from('friendships')
      .insert({
        user_id: currentUserId,
        friend_id: userId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error(MODULE_NAME, 'Erro ao enviar solicitação:', error);
      return { data: null, error };
    }

    // Cria notificação para o destinatário
    await createFriendRequestNotification(userId, currentUserId);

    console.log(MODULE_NAME, 'Solicitação enviada com sucesso:', data);
    return { data, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Aceita uma solicitação de amizade
 * @param {string} friendshipId - ID da relação de amizade
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function acceptFriendRequest(friendshipId) {
  console.log(MODULE_NAME, 'Aceitando solicitação:', friendshipId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    // Verifica se o usuário é o destinatário da solicitação
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .eq('id', friendshipId)
      .single();

    if (!friendship || friendship.friend_id !== session.user.id) {
      return { data: null, error: new Error('Solicitação não encontrada ou sem permissão') };
    }

    const { data, error } = await supabase
      .from('friendships')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', friendshipId)
      .select()
      .single();

    if (error) {
      console.error(MODULE_NAME, 'Erro ao aceitar solicitação:', error);
      return { data: null, error };
    }

    // Cria notificação para quem enviou
    await createFriendAcceptedNotification(friendship.user_id, session.user.id);

    console.log(MODULE_NAME, 'Solicitação aceita:', data);
    return { data, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Recusa uma solicitação de amizade
 * @param {string} friendshipId - ID da relação de amizade
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function declineFriendRequest(friendshipId) {
  console.log(MODULE_NAME, 'Recusando solicitação:', friendshipId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: new Error('Usuário não autenticado') };
    }

    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .eq('friend_id', session.user.id)
      .eq('status', 'pending');

    if (error) {
      console.error(MODULE_NAME, 'Erro ao recusar solicitação:', error);
      return { success: false, error };
    }

    console.log(MODULE_NAME, 'Solicitação recusada');
    return { success: true, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { success: false, error: e };
  }
}

/**
 * Remove um amigo da lista
 * @param {string} friendId - ID do amigo a ser removido
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function removeFriend(friendId) {
  console.log(MODULE_NAME, 'Removendo amigo:', friendId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: new Error('Usuário não autenticado') };
    }

    const currentUserId = session.user.id;

    // Remove em ambas as direções
    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${friendId},status.eq.accepted),and(user_id.eq.${friendId},friend_id.eq.${currentUserId},status.eq.accepted)`);

    if (error) {
      console.error(MODULE_NAME, 'Erro ao remover amigo:', error);
      return { success: false, error };
    }

    console.log(MODULE_NAME, 'Amigo removido');
    return { success: true, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { success: false, error: e };
  }
}

/**
 * Lista todos os amigos aceitos do usuário atual
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getFriends() {
  console.log(MODULE_NAME, 'Buscando lista de amigos');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const currentUserId = session.user.id;

    // Busca amizades onde o usuário é o requester
    const { data: sentFriends, error: error1 } = await supabase
      .from('friendships')
      .select(`
        id,
        friend_id,
        accepted_at,
        friend:friend_id (id, username, display_name, avatar_url)
      `)
      .eq('user_id', currentUserId)
      .eq('status', 'accepted');

    if (error1) {
      console.error(MODULE_NAME, 'Erro ao buscar amigos:', error1);
      return { data: null, error: error1 };
    }

    // Busca amizades onde o usuário é o recipient
    const { data: receivedFriends, error: error2 } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id,
        accepted_at,
        friend:user_id (id, username, display_name, avatar_url)
      `)
      .eq('friend_id', currentUserId)
      .eq('status', 'accepted');

    if (error2) {
      console.error(MODULE_NAME, 'Erro ao buscar amigos:', error2);
      return { data: null, error: error2 };
    }

    // Combina as listas
    const friends = [
      ...(sentFriends || []).map(f => ({ ...f.friend, friendship_id: f.id, since: f.accepted_at })),
      ...(receivedFriends || []).map(f => ({ ...f.friend, friendship_id: f.id, since: f.accepted_at }))
    ];

    console.log(MODULE_NAME, 'Amigos encontrados:', friends.length);
    return { data: friends, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Lista solicitações de amizade pendentes recebidas
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getPendingRequests() {
  console.log(MODULE_NAME, 'Buscando solicitações pendentes');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id,
        created_at,
        sender:user_id (id, username, display_name, avatar_url)
      `)
      .eq('friend_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar solicitações:', error);
      return { data: null, error };
    }

    const requests = (data || []).map(r => ({
      ...r.sender,
      friendship_id: r.id,
      request_date: r.created_at
    }));

    console.log(MODULE_NAME, 'Solicitações pendentes:', requests.length);
    return { data: requests, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Lista solicitações de amizade enviadas pendentes
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getSentRequests() {
  console.log(MODULE_NAME, 'Buscando solicitações enviadas');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        friend_id,
        created_at,
        recipient:friend_id (id, username, display_name, avatar_url)
      `)
      .eq('user_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar solicitações enviadas:', error);
      return { data: null, error };
    }

    const requests = (data || []).map(r => ({
      ...r.recipient,
      friendship_id: r.id,
      request_date: r.created_at
    }));

    console.log(MODULE_NAME, 'Solicitações enviadas:', requests.length);
    return { data: requests, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Busca usuários por nome ou username
 * @param {string} query - Termo de busca
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function searchUsers(query) {
  console.log(MODULE_NAME, 'Buscando usuários:', query);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    if (!query || query.length < 2) {
      return { data: [], error: null };
    }

    const currentUserId = session.user.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq('id', currentUserId)
      .limit(20);

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar usuários:', error);
      return { data: null, error };
    }

    console.log(MODULE_NAME, 'Usuários encontrados:', data?.length || 0);
    return { data: data || [], error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Verifica se um usuário é amigo do usuário atual
 * @param {string} userId - ID do usuário a verificar
 * @returns {Promise<{isFriend: boolean, status: string|null, error: Error|null}>}
 */
export async function isFriend(userId) {
  console.log(MODULE_NAME, 'Verificando amizade com:', userId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { isFriend: false, status: null, error: new Error('Usuário não autenticado') };
    }

    const currentUserId = session.user.id;

    const { data, error } = await supabase
      .from('friendships')
      .select('status')
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUserId})`)
      .maybeSingle();

    if (error) {
      console.error(MODULE_NAME, 'Erro ao verificar amizade:', error);
      return { isFriend: false, status: null, error };
    }

    return {
      isFriend: data?.status === 'accepted',
      status: data?.status || null,
      error: null
    };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { isFriend: false, status: null, error: e };
  }
}

/**
 * Bloqueia um usuário
 * @param {string} userId - ID do usuário a ser bloqueado
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function blockUser(userId) {
  console.log(MODULE_NAME, 'Bloqueando usuário:', userId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: new Error('Usuário não autenticado') };
    }

    const currentUserId = session.user.id;

    // Remove qualquer amizade existente
    await supabase
      .from('friendships')
      .delete()
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUserId})`);

    // Adiciona à lista de bloqueados
    const { error } = await supabase
      .from('blocked_users')
      .insert({
        user_id: currentUserId,
        blocked_id: userId
      });

    if (error) {
      console.error(MODULE_NAME, 'Erro ao bloquear usuário:', error);
      return { success: false, error };
    }

    console.log(MODULE_NAME, 'Usuário bloqueado');
    return { success: true, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { success: false, error: e };
  }
}

// =============================================
//  Funções Auxiliares de Notificação
// =============================================

async function createFriendRequestNotification(toUserId, fromUserId) {
  try {
    const { data: fromProfile } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', fromUserId)
      .single();

    const displayName = fromProfile?.display_name || fromProfile?.username || 'Alguém';

    await supabase.from('notifications').insert({
      user_id: toUserId,
      type: 'friend_request',
      title: 'Nova solicitação de amizade',
      message: `${displayName} quer ser seu amigo`,
      data: { from_user_id: fromUserId }
    });
  } catch (e) {
    console.warn(MODULE_NAME, 'Erro ao criar notificação:', e);
  }
}

async function createFriendAcceptedNotification(toUserId, fromUserId) {
  try {
    const { data: fromProfile } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', fromUserId)
      .single();

    const displayName = fromProfile?.display_name || fromProfile?.username || 'Alguém';

    await supabase.from('notifications').insert({
      user_id: toUserId,
      type: 'friend_accepted',
      title: 'Solicitação aceita',
      message: `${displayName} aceitou sua solicitação de amizade`,
      data: { from_user_id: fromUserId }
    });
  } catch (e) {
    console.warn(MODULE_NAME, 'Erro ao criar notificação:', e);
  }
}

// =============================================
//  Classe SocialManager (para uso avançado)
// =============================================

/**
 * Gerenciador de amizades com suporte a realtime
 * @class SocialManager
 */
export class SocialManager {
  constructor() {
    this.channel = null;
    this.listeners = new Map();
    this.userId = null;
  }

  /**
   * Inicializa o gerenciador e configura realtime
   * @returns {Promise<boolean>}
   */
  async init() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      this.userId = session.user.id;
      this.setupRealtime();
      return true;
    } catch (e) {
      console.error(MODULE_NAME, 'Erro ao inicializar SocialManager:', e);
      return false;
    }
  }

  setupRealtime() {
    if (!this.userId) return;

    this.channel = supabase.channel(`social:${this.userId}`);

    this.channel
      .on('broadcast', { event: 'friend_request' }, ({ payload }) => {
        this._notifyListeners('friend_request', payload);
      })
      .on('broadcast', { event: 'friend_accepted' }, ({ payload }) => {
        this._notifyListeners('friend_accepted', payload);
      })
      .subscribe();
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

  cleanup() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.listeners.clear();
  }
}
