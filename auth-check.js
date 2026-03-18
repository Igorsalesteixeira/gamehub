// auth-check.js — importado por todos os jogos
// Se não houver sessão ativa, redireciona para a tela de login
import { supabase } from './supabase.js';

// Função para redirecionar para a página de auth
function redirectToAuth() {
  // Caminho absoluto para auth.html na raiz
  window.location.href = window.location.origin + '/auth.html';
}

async function checkAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Erro Supabase:', error);
      redirectToAuth();
      return;
    }
    if (!session) {
      console.log('Usuário não autenticado, redirecionando...');
      redirectToAuth();
    }
  } catch (err) {
    console.error('Erro ao verificar autenticação:', err);
    redirectToAuth();
  }
}

checkAuth();
