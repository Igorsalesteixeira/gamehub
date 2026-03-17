// auth-check.js — importado por todos os jogos
// Se não houver sessão ativa, redireciona para a tela de login
import { supabase } from './supabase.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // Usa import.meta.url para resolver o caminho correto independente
  // de onde o jogo está na estrutura de pastas
  window.location.href = new URL('./auth.html', import.meta.url).href;
}
