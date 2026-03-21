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

    // Busca todas as amizades aceitas
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id, updated_at')
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
      .eq('status', 'accepted');

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar amigos:', error);
      return { data: null, error };
    }

    if (!friendships || friendships.length === 0) {
      return { data: [], error: null };
    }

    // Extrai IDs dos amigos
    const friendIds = friendships.map(f =>
      f.user_id === currentUserId ? f.friend_id : f.user_id
    );

    // Busca perfis dos amigos
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', friendIds);

    if (profilesError) {
      console.error(MODULE_NAME, 'Erro ao buscar perfis:', profilesError);
    }

    // Cria mapa de perfis
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // Combina dados
    const friends = friendships.map(f => {
      const friendId = f.user_id === currentUserId ? f.friend_id : f.user_id;
      const profile = profileMap.get(friendId) || {};
      return {
        id: friendId,
        friendship_id: f.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        since: f.updated_at
      };
    });

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

    // Busca solicitações pendentes recebidas
    const { data: requests, error } = await supabase
      .from('friendships')
      .select('id, user_id, created_at')
      .eq('friend_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar solicitações:', error);
      return { data: null, error };
    }

    if (!requests || requests.length === 0) {
      return { data: [], error: null };
    }

    // Busca perfis dos remetentes
    const senderIds = requests.map(r => r.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', senderIds);

    if (profilesError) {
      console.error(MODULE_NAME, 'Erro ao buscar perfis:', profilesError);
    }

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const result = requests.map(r => {
      const profile = profileMap.get(r.user_id) || {};
      return {
        id: r.user_id,
        friendship_id: r.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        request_date: r.created_at
      };
    });

    console.log(MODULE_NAME, 'Solicitações pendentes:', result.length);
    return { data: result, error: null };
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

    const { data: requests, error } = await supabase
      .from('friendships')
      .select('id, friend_id, created_at')
      .eq('user_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar solicitações enviadas:', error);
      return { data: null, error };
    }

    if (!requests || requests.length === 0) {
      return { data: [], error: null };
    }

    // Busca perfis dos destinatários
    const recipientIds = requests.map(r => r.friend_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', recipientIds);

    if (profilesError) {
      console.error(MODULE_NAME, 'Erro ao buscar perfis:', profilesError);
    }

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const result = requests.map(r => {
      const profile = profileMap.get(r.friend_id) || {};
      return {
        id: r.friend_id,
        friendship_id: r.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        request_date: r.created_at
      };
    });

    console.log(MODULE_NAME, 'Solicitações enviadas:', result.length);
    return { data: result, error: null };
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
//  Funções de Perfil Público
// =============================================

/**
 * Busca perfil de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function getUserProfile(userId) {
  console.log(MODULE_NAME, 'Buscando perfil:', userId);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, created_at, level, xp')
      .eq('id', userId)
      .single();

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar perfil:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Verifica status de amizade entre usuários
 * @param {string} userId - ID do usuário a verificar
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function checkFriendshipStatus(userId) {
  console.log(MODULE_NAME, 'Verificando amizade:', userId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const currentUserId = session.user.id;

    // Verifica se é o próprio usuário
    if (currentUserId === userId) {
      return { data: { is_friend: false, is_self: true, status: null }, error: null };
    }

    // Busca relação de amizade
    const { data, error } = await supabase
      .from('friendships')
      .select('id, status, user_id, friend_id')
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUserId})`)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error(MODULE_NAME, 'Erro ao verificar amizade:', error);
      return { data: null, error };
    }

    if (!data) {
      return { data: { is_friend: false, is_self: false, status: null, id: null }, error: null };
    }

    const isFriend = data.status === 'accepted';
    const isPending = data.status === 'pending';

    return {
      data: {
        is_friend: isFriend,
        is_self: false,
        status: data.status,
        is_pending: isPending,
        id: data.id,
        initiated_by_me: data.user_id === currentUserId
      },
      error: null
    };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Busca estatísticas de jogos do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export async function getUserStats(userId) {
  console.log(MODULE_NAME, 'Buscando estatísticas:', userId);

  try {
    // Total de partidas
    const { count: totalGames, error: totalError } = await supabase
      .from('user_activity')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (totalError) {
      console.error(MODULE_NAME, 'Erro ao buscar estatísticas:', totalError);
      return { data: null, error: totalError };
    }

    // Vitórias
    const { count: wins, error: winsError } = await supabase
      .from('user_activity')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('result', 'win');

    if (winsError) {
      console.error(MODULE_NAME, 'Erro ao buscar vitórias:', winsError);
    }

    // Jogos favoritos
    const { data: favoriteGames, error: favError } = await supabase
      .from('user_activity')
      .select('game_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    const gameCounts = {};
    (favoriteGames || []).forEach(g => {
      gameCounts[g.game_type] = (gameCounts[g.game_type] || 0) + 1;
    });

    const topGames = Object.entries(gameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([game, count]) => ({ game, count }));

    return {
      data: {
        total_games: totalGames || 0,
        wins: wins || 0,
        win_rate: totalGames ? Math.round((wins / totalGames) * 100) : 0,
        favorite_games: topGames
      },
      error: null
    };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Busca jogos em comum entre usuários
 * @param {string} userId - ID do outro usuário
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getCommonGames(userId) {
  console.log(MODULE_NAME, 'Buscando jogos em comum');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const currentUserId = session.user.id;

    // Busca jogos do usuário atual
    const { data: myGames } = await supabase
      .from('user_activity')
      .select('game_type')
      .eq('user_id', currentUserId);

    // Busca jogos do outro usuário
    const { data: theirGames } = await supabase
      .from('user_activity')
      .select('game_type')
      .eq('user_id', userId);

    const myGameTypes = new Set((myGames || []).map(g => g.game_type));
    const theirGameTypes = new Set((theirGames || []).map(g => g.game_type));

    // Encontra interseção
    const common = [...myGameTypes].filter(g => theirGameTypes.has(g));

    return { data: common, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Busca atividade recente do usuário
 * @param {string} userId - ID do usuário
 * @param {number} limit - Limite de resultados
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getUserActivity(userId, limit = 10) {
  console.log(MODULE_NAME, 'Buscando atividade:', userId);

  try {
    const { data, error } = await supabase
      .from('user_activity')
      .select('id, game_type, result, score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar atividade:', error);
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

// =============================================
//  Funções de Sugestões e Realtime
// =============================================

/**
 * Busca sugestões de amigos baseado em jogos em comum
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getFriendSuggestions() {
  console.log(MODULE_NAME, 'Buscando sugestões de amigos');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const currentUserId = session.user.id;

    // Busca amigos atuais para excluir
    const { data: friends } = await supabase
      .from('friendships')
      .select('friend_id, user_id')
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
      .eq('status', 'accepted');

    const friendIds = (friends || []).map(f =>
      f.user_id === currentUserId ? f.friend_id : f.user_id
    );

    // Busca solicitações pendentes para excluir
    const { data: pending } = await supabase
      .from('friendships')
      .select('friend_id, user_id')
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
      .eq('status', 'pending');

    const pendingIds = (pending || []).map(p =>
      p.user_id === currentUserId ? p.friend_id : p.user_id
    );

    const excludeIds = [currentUserId, ...friendIds, ...pendingIds];

    // Busca usuários que jogaram os mesmos jogos
    const { data: activityMatches } = await supabase
      .from('user_activity')
      .select('user_id, game_type')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(10);

    const userGames = activityMatches?.map(a => a.game_type) || [];

    if (userGames.length === 0) {
      // Se não tem jogos, retorna usuários aleatórios
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .limit(4);

      return { data: data || [], error };
    }

    // Busca usuários com jogos em comum
    const { data, error } = await supabase
      .from('user_activity')
      .select('user_id, profiles(username, display_name)')
      .in('game_type', [...new Set(userGames)])
      .not('user_id', 'in', `(${excludeIds.join(',')})`)
      .limit(20);

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar sugestões:', error);
      return { data: null, error };
    }

    // Agrupa e conta jogos em comum
    const userMap = new Map();
    (data || []).forEach(activity => {
      const userId = activity.user_id;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: userId,
          username: activity.profiles?.username,
          display_name: activity.profiles?.display_name,
          common_games: 0
        });
      }
      userMap.get(userId).common_games++;
    });

    return { data: Array.from(userMap.values()).slice(0, 4), error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Inscreve em atualizações de amigos em tempo real
 * @param {Function} callback - Função chamada quando houver atualização
 * @returns {Object} Objeto com método unsubscribe
 */
export function subscribeToFriendUpdates(callback) {
  console.log(MODULE_NAME, 'Inscrevendo em atualizações de amigos');

  const channel = supabase.channel('friendships');

  channel
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'friendships'
    }, (payload) => {
      console.log(MODULE_NAME, 'Atualização de amizade:', payload);
      if (callback) {
        callback(payload);
      }
    })
    .subscribe();

  return {
    unsubscribe: () => {
      channel.unsubscribe();
    }
  };
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
