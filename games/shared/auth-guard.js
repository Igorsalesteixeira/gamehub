/**
 * Módulo de Guarda de Autenticação
 *
 * Funções utilitárias para gerenciamento de autenticação
 * com Supabase Auth.
 *
 * @module auth-guard
 */

import { supabase } from '../../supabase.js';

/**
 * Aguarda a autenticação estar pronta.
 * Usa polling ao invés de timeout fixo para maior confiabilidade.
 *
 * @param {Object} options - Opções
 * @param {number} [options.interval=100] - Intervalo de polling em ms
 * @param {number} [options.maxAttempts=50] - Máximo de tentativas
 * @returns {Promise<Object>} Sessão ou null
 *
 * @example
 * const session = await waitForAuth();
 * if (session) {
 *   console.log('Usuário logado:', session.user.email);
 * }
 */
export async function waitForAuth(options = {}) {
  const { interval = 100, maxAttempts = 50 } = options;

  return new Promise((resolve) => {
    let attempts = 0;

    const check = async () => {
      attempts++;

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        resolve(session);
        return;
      }

      if (attempts >= maxAttempts) {
        resolve(null);
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Aguarda autenticação ou redireciona.
 *
 * @param {string} [redirectTo='/login.html'] - Página de redirecionamento
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object>} Sessão
 *
 * @example
 * const session = await requireAuth('/games/login.html');
 * // Se não logado, redireciona automaticamente
 */
export async function requireAuth(redirectTo = '/login.html', options = {}) {
  const session = await waitForAuth(options);

  if (!session) {
    // Salva URL atual para retorno
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `${redirectTo}?returnTo=${returnUrl}`;
    return null;
  }

  return session;
}

/**
 * Retorna o usuário atual.
 *
 * @returns {Promise<Object|null>} Usuário ou null
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Retorna a sessão atual.
 *
 * @returns {Promise<Object|null>} Sessão ou null
 */
export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Verifica se usuário está logado.
 *
 * @returns {Promise<boolean>} Se está autenticado
 */
export async function isAuthenticated() {
  const session = await getCurrentSession();
  return session !== null;
}

/**
 * Verifica se usuário tem determinada role.
 *
 * @param {string} role - Role a verificar
 * @returns {Promise<boolean>} Se tem a role
 */
export async function hasRole(role) {
  const user = await getCurrentUser();
  if (!user) return false;

  const roles = user.app_metadata?.roles || [];
  return roles.includes(role);
}

/**
 * Verifica se usuário é admin.
 *
 * @returns {Promise<boolean>} Se é admin
 */
export async function isAdmin() {
  return hasRole('admin');
}

/**
 * Retorna metadados do usuário.
 *
 * @returns {Promise<Object|null>} Metadados
 */
export async function getUserMetadata() {
  const user = await getCurrentUser();
  return user?.user_metadata || null;
}

/**
 * Atualiza metadados do usuário.
 *
 * @param {Object} metadata - Metadados a atualizar
 * @returns {Promise<Object>} Resultado da operação
 */
export async function updateUserMetadata(metadata) {
  const { data, error } = await supabase.auth.updateUser({
    data: metadata
  });

  if (error) throw error;
  return data;
}

/**
 * Faz logout do usuário.
 *
 * @param {Object} options - Opções
 * @param {string} [options.redirectTo] - URL para redirecionar após logout
 * @returns {Promise<void>}
 */
export async function logout(options = {}) {
  await supabase.auth.signOut();

  if (options.redirectTo) {
    window.location.href = options.redirectTo;
  }
}

/**
 * Escuta mudanças de autenticação.
 *
 * @param {Function} callback - Callback(event, session)
 * @returns {Function} Função para cancelar subscription
 *
 * @example
 * const unsubscribe = onAuthChange((event, session) => {
 *   if (event === 'SIGNED_IN') {
 *     console.log('Login:', session.user.email);
 *   }
 * });
 */
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Guarda de rota para proteger páginas.
 * Deve ser chamado no início da página.
 *
 * @param {Object} options - Opções
 * @param {string} [options.redirectTo='/login.html'] - Página de login
 * @param {string[]} [options.allowedRoles] - Roles permitidas
 * @param {Function} [options.onAuth] - Callback quando autenticado
 * @param {Function} [options.onUnauth] - Callback quando não autenticado
 *
 * @example
 * // No início de uma página protegida:
 * authGuard({
 *   allowedRoles: ['admin'],
 *   redirectTo: '/login.html'
 * });
 */
export async function authGuard(options = {}) {
  const {
    redirectTo = '/login.html',
    allowedRoles = [],
    onAuth = null,
    onUnauth = null
  } = options;

  const session = await waitForAuth();

  if (!session) {
    if (onUnauth) {
      onUnauth();
    } else {
      const returnUrl = encodeURIComponent(window.location.pathname);
      window.location.href = `${redirectTo}?returnTo=${returnUrl}`;
    }
    return false;
  }

  // Verifica roles
  if (allowedRoles.length > 0) {
    const userRoles = session.user.app_metadata?.roles || [];
    const hasAllowedRole = allowedRoles.some(r => userRoles.includes(r));

    if (!hasAllowedRole) {
      console.warn('[authGuard] Usuário não tem permissão');
      window.location.href = '/unauthorized.html';
      return false;
    }
  }

  if (onAuth) {
    onAuth(session);
  }

  return true;
}

/**
 * Hook para componentes - retorna estado de auth reativo.
 *
 * @returns {Object} Estado de autenticação
 * @returns {Object|null} returns.user - Usuário atual
 * @returns {boolean} returns.loading - Se está carregando
 * @returns {Function} returns.refresh - Atualiza estado
 *
 * @example
 * const { user, loading, refresh } = useAuth();
 * // user atualiza automaticamente quando auth muda
 */
export function useAuth() {
  const state = {
    user: null,
    loading: true,
    refresh: async () => {
      state.loading = true;
      state.user = await getCurrentUser();
      state.loading = false;
      return state.user;
    }
  };

  // Inicializa
  state.refresh();

  // Escuta mudanças
  onAuthChange(() => {
    state.refresh();
  });

  return state;
}
