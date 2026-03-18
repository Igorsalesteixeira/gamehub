// auth-check.js — importado por todos os jogos
// Se não houver sessão ativa, redireciona para a tela de login
import { supabase } from './supabase.js';

// Função para redirecionar para a página de auth
function redirectToAuth() {
  // Caminho absoluto para auth.html na raiz
  window.location.href = window.location.origin + '/auth.html';
}

// Aguarda um momento para o Supabase inicializar
async function checkAuth() {
  // Aguarda 500ms para garantir que o Supabase inicializou
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[auth-check] Erro Supabase:', error);
      redirectToAuth();
      return;
    }
    if (!session) {
      console.log('[auth-check] Usuário não autenticado, redirecionando...');
      redirectToAuth();
    } else {
      console.log('[auth-check] Usuário autenticado:', session.user.email);
    }
  } catch (err) {
    console.error('[auth-check] Erro ao verificar autenticação:', err);
    redirectToAuth();
  }
}

checkAuth();
