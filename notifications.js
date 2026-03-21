/**
 * Sistema de Notificações — Games Hub
 *
 * Gerencia notificações em tempo real, badge de contador e toasts.
 * Usa Supabase Realtime para atualizações instantâneas.
 *
 * @module notifications
 */

import { supabase } from './supabase.js';

const MODULE_NAME = '[Notifications]';

// =============================================
//  Estado Interno
// =============================================

let notificationChannel = null;
let badgeElement = null;
let toastContainer = null;
let currentUserId = null;
let unreadCount = 0;
const notificationCallbacks = new Set();

// =============================================
//  Inscrição Realtime
// =============================================

/**
 * Inscreve o usuário em notificações em tempo real
 * @param {string} userId - ID do usuário (opcional, usa sessão atual se não fornecido)
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function subscribeToNotifications(userId = null) {
  console.log(MODULE_NAME, 'Inscrevendo em notificações');

  try {
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: new Error('Usuário não autenticado') };
      }
      currentUserId = session.user.id;
    } else {
      currentUserId = userId;
    }

    // Remove inscrição anterior se existir
    if (notificationChannel) {
      await notificationChannel.unsubscribe();
    }

    // Configura canal realtime
    notificationChannel = supabase.channel(`notifications:${currentUserId}`);

    notificationChannel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUserId}`
      }, (payload) => {
        console.log(MODULE_NAME, 'Nova notificação recebida:', payload.new);
        handleNewNotification(payload.new);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUserId}`
      }, (payload) => {
        console.log(MODULE_NAME, 'Notificação atualizada:', payload.new);
        if (payload.new.read && !payload.old.read) {
          updateBadge(unreadCount - 1);
        }
      })
      .subscribe((status) => {
        console.log(MODULE_NAME, 'Status da inscrição:', status);
      });

    // Atualiza contagem inicial
    await updateUnreadCount();

    console.log(MODULE_NAME, 'Inscrito com sucesso');
    return { success: true, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro ao inscrever:', e);
    return { success: false, error: e };
  }
}

/**
 * Cancela inscrição em notificações
 */
export async function unsubscribeFromNotifications() {
  console.log(MODULE_NAME, 'Cancelando inscrição');

  if (notificationChannel) {
    await notificationChannel.unsubscribe();
    notificationChannel = null;
  }
  currentUserId = null;
  notificationCallbacks.clear();
}

// =============================================
//  Gerenciamento de Notificações
// =============================================

/**
 * Busca notificações não lidas do usuário
 * @param {number} limit - Limite de notificações (padrão: 50)
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getUnreadNotifications(limit = 50) {
  console.log(MODULE_NAME, 'Buscando notificações não lidas');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: new Error('Usuário não autenticado') };
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(MODULE_NAME, 'Erro ao buscar notificações:', error);
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { data: null, error: e };
  }
}

/**
 * Marca uma notificação como lida
 * @param {string} notificationId - ID da notificação
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function markAsRead(notificationId) {
  console.log(MODULE_NAME, 'Marcando como lida:', notificationId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: new Error('Usuário não autenticado') };
    }

    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', session.user.id);

    if (error) {
      console.error(MODULE_NAME, 'Erro ao marcar como lida:', error);
      return { success: false, error };
    }

    // Atualiza contador
    await updateUnreadCount();

    return { success: true, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { success: false, error: e };
  }
}

/**
 * Marca todas as notificações como lidas
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function markAllAsRead() {
  console.log(MODULE_NAME, 'Marcando todas como lidas');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: new Error('Usuário não autenticado') };
    }

    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', session.user.id)
      .eq('read', false);

    if (error) {
      console.error(MODULE_NAME, 'Erro ao marcar todas como lidas:', error);
      return { success: false, error };
    }

    updateBadge(0);

    return { success: true, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { success: false, error: e };
  }
}

/**
 * Deleta uma notificação
 * @param {string} notificationId - ID da notificação
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function deleteNotification(notificationId) {
  console.log(MODULE_NAME, 'Deletando notificação:', notificationId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: new Error('Usuário não autenticado') };
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', session.user.id);

    if (error) {
      console.error(MODULE_NAME, 'Erro ao deletar notificação:', error);
      return { success: false, error };
    }

    // Atualiza contador
    await updateUnreadCount();

    return { success: true, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { success: false, error: e };
  }
}

/**
 * Retorna a contagem de notificações não lidas
 * @returns {Promise<{count: number, error: Error|null}>}
 */
export async function getUnreadCount() {
  console.log(MODULE_NAME, 'Obtendo contagem de não lidas');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { count: 0, error: null };
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('read', false);

    if (error) {
      console.error(MODULE_NAME, 'Erro ao contar notificações:', error);
      return { count: 0, error };
    }

    unreadCount = count || 0;
    return { count: unreadCount, error: null };
  } catch (e) {
    console.error(MODULE_NAME, 'Erro inesperado:', e);
    return { count: 0, error: e };
  }
}

// =============================================
//  Interface Visual (UI)
// =============================================

/**
 * Configura o elemento de badge para atualizações automáticas
 * @param {string|HTMLElement} element - Seletor ou elemento do badge
 */
export function setupBadge(element) {
  if (typeof element === 'string') {
    badgeElement = document.querySelector(element);
  } else {
    badgeElement = element;
  }

  if (badgeElement) {
    updateBadge(unreadCount);
  }
}

/**
 * Atualiza o badge com o número de notificações
 * @param {number} count - Número de notificações
 */
export function updateBadge(count) {
  unreadCount = count;

  if (!badgeElement) {
    // Tenta encontrar badge padrão
    badgeElement = document.querySelector('.notification-badge, [data-notification-badge]');
  }

  if (badgeElement) {
    if (count > 0) {
      badgeElement.textContent = count > 99 ? '99+' : count;
      badgeElement.style.display = 'flex';
      badgeElement.classList.add('has-notifications');
    } else {
      badgeElement.textContent = '';
      badgeElement.style.display = 'none';
      badgeElement.classList.remove('has-notifications');
    }
  }

  // Dispara evento customizado
  window.dispatchEvent(new CustomEvent('notifications:count', {
    detail: { count }
  }));
}

/**
 * Exibe um toast na tela
 * @param {Object} notification - Dados da notificação
 * @param {Object} options - Opções de exibição
 */
export function showToast(notification, options = {}) {
  const {
    duration = 5000,
    position = 'top-right',
    closable = true
  } = options;

  // Cria container se não existir
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'notification-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  // Cria o toast
  const toast = document.createElement('div');
  toast.className = 'notification-toast';
  toast.style.cssText = `
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-left: 4px solid #ff6b35;
    border-radius: 12px;
    padding: 16px 20px;
    min-width: 300px;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    color: #fff;
    font-family: 'Nunito', sans-serif;
    pointer-events: auto;
    animation: slideInToast 0.3s ease-out;
    cursor: pointer;
  `;

  const title = document.createElement('div');
  title.style.cssText = 'font-weight: 700; font-size: 0.95rem; margin-bottom: 4px;';
  title.textContent = notification.title || 'Nova notificação';

  const message = document.createElement('div');
  message.style.cssText = 'font-size: 0.85rem; color: rgba(255,255,255,0.8);';
  message.textContent = notification.message || '';

  const time = document.createElement('div');
  time.style.cssText = 'font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-top: 8px;';
  time.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  toast.appendChild(title);
  toast.appendChild(message);
  toast.appendChild(time);

  // Botão fechar
  if (closable) {
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 12px;
      background: none;
      border: none;
      color: rgba(255,255,255,0.6);
      font-size: 1.4rem;
      cursor: pointer;
      line-height: 1;
    `;
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      removeToast(toast);
    };
    toast.style.position = 'relative';
    toast.appendChild(closeBtn);
  }

  // Click na notificação
  toast.addEventListener('click', () => {
    if (notification.id) {
      markAsRead(notification.id);
    }
    removeToast(toast);

    // Callback customizado
    notificationCallbacks.forEach(cb => {
      try {
        cb(notification);
      } catch (e) {
        console.error(MODULE_NAME, 'Erro no callback:', e);
      }
    });
  });

  toastContainer.appendChild(toast);

  // Auto-remove
  if (duration > 0) {
    setTimeout(() => removeToast(toast), duration);
  }
}

/**
 * Adiciona um callback para cliques em notificações
 * @param {Function} callback - Função a ser chamada
 */
export function onNotificationClick(callback) {
  notificationCallbacks.add(callback);
}

/**
 * Remove um callback de notificação
 * @param {Function} callback - Função a ser removida
 */
export function offNotificationClick(callback) {
  notificationCallbacks.delete(callback);
}

// =============================================
//  Funções Internas
// =============================================

function handleNewNotification(notification) {
  // Atualiza badge
  updateBadge(unreadCount + 1);

  // Mostra toast
  showToast(notification);

  // Toca som se permitido
  if (Notification.permission === 'granted') {
    try {
      new Audio('/sounds/notification.mp3').play().catch(() => {});
    } catch (e) {
      // Ignora erro de áudio
    }
  }

  // Dispara evento customizado
  window.dispatchEvent(new CustomEvent('notification:received', {
    detail: notification
  }));
}

async function updateUnreadCount() {
  const { count } = await getUnreadCount();
  updateBadge(count);
}

function removeToast(toast) {
  toast.style.animation = 'fadeOutToast 0.2s ease-in forwards';
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 200);
}

// Adiciona estilos de animação
if (!document.getElementById('notification-toast-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-toast-styles';
  style.textContent = `
    @keyframes slideInToast {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes fadeOutToast {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }
  `;
  document.head.appendChild(style);
}

// =============================================
//  Classe NotificationManager
// =============================================

/**
 * Gerenciador completo de notificações
 * @class NotificationManager
 */
export class NotificationManager {
  constructor() {
    this.initialized = false;
    this.notifications = [];
  }

  /**
   * Inicializa o gerenciador
   * @returns {Promise<boolean>}
   */
  async init() {
    if (this.initialized) return true;

    const result = await subscribeToNotifications();
    if (result.success) {
      this.initialized = true;
      // Carrega notificações iniciais
      const { data } = await getUnreadNotifications();
      this.notifications = data || [];
    }
    return result.success;
  }

  /**
   * Retorna notificações em cache
   * @returns {Array}
   */
  getCachedNotifications() {
    return [...this.notifications];
  }

  /**
   * Recarrega notificações do servidor
   */
  async refresh() {
    const { data } = await getUnreadNotifications();
    this.notifications = data || [];
    return this.notifications;
  }

  /**
   * Limpa recursos
   */
  async destroy() {
    await unsubscribeFromNotifications();
    this.initialized = false;
    this.notifications = [];
  }
}
