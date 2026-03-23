/**
 * Sidebar compartilhada — importar em qualquer pagina
 * Uso: import { initSidebar } from './sidebar.js';
 *      initSidebar({ active: 'inicio' });
 */

function getBasePath() {
  const path = window.location.pathname;
  if (path.includes('/games/')) return '../../';
  return './';
}

const SIDEBAR_CSS = `
/* ===== SIDEBAR TOGGLE (hamburger) ===== */
.sidebar-toggle {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 0.5rem;
  z-index: 10;
  border-radius: 8px;
  transition: background 0.2s;
}
.sidebar-toggle:hover {
  background: rgba(255,255,255,0.15);
}
.sidebar-toggle span {
  display: block;
  width: 22px;
  height: 2.5px;
  background: #fff;
  border-radius: 2px;
  transition: transform 0.2s, opacity 0.2s;
}

/* ===== SIDEBAR OVERLAY ===== */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 900;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
.sidebar-overlay.open {
  opacity: 1;
  pointer-events: auto;
}

/* ===== SIDEBAR ===== */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 100vh;
  height: 100dvh;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%);
  z-index: 1000;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 24px rgba(0,0,0,0.4);
  font-family: 'Nunito', sans-serif;
}
.sidebar.open {
  transform: translateX(0);
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1.2rem 1rem 1.2rem 1.2rem;
  background: linear-gradient(135deg, #ff6b35 0%, #e85d2a 100%);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  flex: 1;
}

.sidebar-logo {
  font-size: 1.6rem;
}

.sidebar-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.15);
}

.sidebar-close {
  background: rgba(255,255,255,0.15);
  border: none;
  color: rgba(255,255,255,0.9);
  font-size: 1.3rem;
  cursor: pointer;
  line-height: 1;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}
.sidebar-close:hover {
  background: rgba(255,255,255,0.3);
}

.sidebar-nav {
  flex: 1;
  padding: 0.8rem 0;
  overflow-y: auto;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  margin: 0.1rem 0.5rem;
  color: rgba(255,255,255,0.6);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.9rem;
  transition: background 0.15s, color 0.15s, transform 0.15s;
  border-radius: 10px;
}
.sidebar-link:hover {
  background: rgba(255,107,53,0.12);
  color: #ff8f5e;
  transform: translateX(2px);
}
.sidebar-link.active {
  background: linear-gradient(135deg, rgba(255,107,53,0.2), rgba(255,107,53,0.1));
  color: #ff6b35;
  font-weight: 800;
  border-left: 3px solid #ff6b35;
}

/* Notification Badge */
.sidebar-badge {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  margin-left: auto;
  min-width: 18px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
  animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.sidebar-icon {
  font-size: 1.1rem;
  width: 26px;
  text-align: center;
  flex-shrink: 0;
}

.sidebar-divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 0.5rem 1rem;
}

.sidebar-section-label {
  display: block;
  padding: 0.4rem 1.2rem 0.15rem;
  font-size: 0.68rem;
  font-weight: 800;
  color: rgba(255,255,255,0.25);
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.sidebar-footer {
  padding: 0.8rem 1rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 0.72rem;
  color: rgba(255,255,255,0.2);
  text-align: center;
}
`;

export function initSidebar(options = {}) {
  const base = getBasePath();
  const active = options.active || '';

  function isActive(key) {
    return active === key ? 'active' : '';
  }

  // Inject CSS (only once)
  if (!document.getElementById('sidebar-styles')) {
    const style = document.createElement('style');
    style.id = 'sidebar-styles';
    style.textContent = SIDEBAR_CSS;
    document.head.appendChild(style);
  }

  // Inject overlay
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  document.body.appendChild(overlay);

  // Inject sidebar
  const aside = document.createElement('aside');
  aside.className = 'sidebar';
  aside.id = 'sidebar';
  aside.innerHTML = `
    <div class="sidebar-header">
      <a href="${base}index.html" class="sidebar-brand">
        <span class="sidebar-logo">🎮</span>
        <span class="sidebar-title">Games Hub</span>
      </a>
      <button class="sidebar-close" id="sidebar-close" aria-label="Fechar menu">&times;</button>
    </div>
    <nav class="sidebar-nav">
      <a href="${base}index.html" class="sidebar-link ${isActive('inicio')}">
        <span class="sidebar-icon">🏠</span>
        <span>Inicio</span>
      </a>
      <a href="${base}ranking.html" class="sidebar-link ${isActive('ranking')}">
        <span class="sidebar-icon">🏆</span>
        <span>Ranking Semanal</span>
      </a>
      <a href="${base}profile.html" class="sidebar-link ${isActive('profile')}">
        <span class="sidebar-icon">👤</span>
        <span>Meu Perfil</span>
      </a>
      <a href="${base}multiplayer.html" class="sidebar-link ${isActive('multi')}">
        <span class="sidebar-icon">🎮</span>
        <span>Multijogador</span>
      </a>
      <a href="${base}social.html" class="sidebar-link ${isActive('social')}">
        <span class="sidebar-icon">👥</span>
        <span>Amigos</span>
        <span class="sidebar-badge" id="sidebar-friends-badge" style="display:none">0</span>
      </a>
      <a href="${base}social.html?tab=challenges" class="sidebar-link ${isActive('challenges')}">
        <span class="sidebar-icon">⚔️</span>
        <span>Desafios</span>
        <span class="sidebar-badge" id="sidebar-challenges-badge" style="display:none">0</span>
      </a>
      <a href="${base}desafio-diario.html" class="sidebar-link ${isActive('daily')}">
        <span class="sidebar-icon">🏆</span>
        <span>Desafio Diário</span>
      </a>
      <a href="${base}torneios.html" class="sidebar-link ${isActive('torneios')}">
        <span class="sidebar-icon">🏅</span>
        <span>Torneios</span>
      </a>
      <a href="${base}loja.html" class="sidebar-link ${isActive('loja')}">
        <span class="sidebar-icon">🛒</span>
        <span>Loja</span>
      </a>
      <a href="${base}festa.html" class="sidebar-link ${isActive('festa')}">
        <span class="sidebar-icon">🎉</span>
        <span>Modo Festa</span>
      </a>
      <a href="${base}criar-puzzle.html" class="sidebar-link ${isActive('criar-puzzle')}">
        <span class="sidebar-icon">✏️</span>
        <span>Criar Puzzle</span>
      </a>
      <div class="sidebar-divider"></div>
      <span class="sidebar-section-label">Cartas</span>
      <a href="${base}games/blackjack/index.html" class="sidebar-link ${isActive('blackjack')}"><span class="sidebar-icon">🃏</span><span>Blackjack</span></a>
      <a href="${base}games/buraco/index.html" class="sidebar-link ${isActive('buraco')}"><span class="sidebar-icon">🃏</span><span>Buraco</span></a>
      <a href="${base}games/cacheta/index.html" class="sidebar-link ${isActive('cacheta')}"><span class="sidebar-icon">🃏</span><span>Cacheta</span></a>
      <a href="${base}games/freecell/index.html" class="sidebar-link ${isActive('freecell')}"><span class="sidebar-icon">🂡</span><span>Freecell</span></a>
      <a href="${base}games/solitaire/index.html" class="sidebar-link ${isActive('paciencia')}"><span class="sidebar-icon">🃏</span><span>Paciencia</span></a>
      <a href="${base}games/pyramid/index.html" class="sidebar-link ${isActive('piramide')}"><span class="sidebar-icon">🔺</span><span>Piramide</span></a>
      <a href="${base}games/pife/index.html" class="sidebar-link ${isActive('pife')}"><span class="sidebar-icon">🃏</span><span>Pife</span></a>
      <a href="${base}games/poker/index.html" class="sidebar-link ${isActive('poker')}"><span class="sidebar-icon">🃏</span><span>Poker</span></a>
      <a href="${base}games/spider-solitaire/index.html" class="sidebar-link ${isActive('spider')}"><span class="sidebar-icon">🕷️</span><span>Spider Solitaire</span></a>
      <a href="${base}games/sueca/index.html" class="sidebar-link ${isActive('sueca')}"><span class="sidebar-icon">🃏</span><span>Sueca</span></a>
      <a href="${base}games/truco/index.html" class="sidebar-link ${isActive('truco')}"><span class="sidebar-icon">🂠</span><span>Truco</span></a>
      <a href="${base}games/uno/index.html" class="sidebar-link ${isActive('uno')}"><span class="sidebar-icon">🟥</span><span>Uno</span></a>
      <span class="sidebar-section-label">Puzzle</span>
      <a href="${base}games/game2048/index.html" class="sidebar-link ${isActive('2048')}"><span class="sidebar-icon">🔢</span><span>2048</span></a>
      <a href="${base}games/minesweeper/index.html" class="sidebar-link ${isActive('minesweeper')}"><span class="sidebar-icon">💣</span><span>Campo Minado</span></a>
      <a href="${base}games/lightsout/index.html" class="sidebar-link ${isActive('lightsout')}"><span class="sidebar-icon">💡</span><span>Lights Out</span></a>
      <a href="${base}games/mahjong/index.html" class="sidebar-link ${isActive('mahjong')}"><span class="sidebar-icon">🀄</span><span>Mahjong</span></a>
      <a href="${base}games/memory/index.html" class="sidebar-link ${isActive('memoria')}"><span class="sidebar-icon">🧠</span><span>Memoria</span></a>
      <a href="${base}games/nonogram/index.html" class="sidebar-link ${isActive('nonogram')}"><span class="sidebar-icon">🖼️</span><span>Nonogram</span></a>
      <a href="${base}games/numble/index.html" class="sidebar-link ${isActive('numble')}"><span class="sidebar-icon">🔣</span><span>Numble</span></a>
      <a href="${base}games/puzzle15/index.html" class="sidebar-link ${isActive('puzzle15')}"><span class="sidebar-icon">🧩</span><span>Puzzle 15</span></a>
      <a href="${base}games/sokoban/index.html" class="sidebar-link ${isActive('sokoban')}"><span class="sidebar-icon">📦</span><span>Sokoban</span></a>
      <a href="${base}games/sudoku/index.html" class="sidebar-link ${isActive('sudoku')}"><span class="sidebar-icon">🔢</span><span>Sudoku</span></a>
      <span class="sidebar-section-label">Arcade</span>
      <a href="${base}games/breakout/index.html" class="sidebar-link ${isActive('breakout')}"><span class="sidebar-icon">🧱</span><span>Breakout</span></a>
      <a href="${base}games/bubble-shooter/index.html" class="sidebar-link ${isActive('bubble-shooter')}"><span class="sidebar-icon">🫧</span><span>Bubble Shooter</span></a>
      <a href="${base}games/snake/index.html" class="sidebar-link ${isActive('cobrinha')}"><span class="sidebar-icon">🐍</span><span>Cobrinha</span></a>
      <a href="${base}games/dinorunner/index.html" class="sidebar-link ${isActive('dino')}"><span class="sidebar-icon">🦕</span><span>Dino Runner</span></a>
      <a href="${base}games/flappybird/index.html" class="sidebar-link ${isActive('flappy')}"><span class="sidebar-icon">🐦</span><span>Flappy Bird</span></a>
      <a href="${base}games/pacman/index.html" class="sidebar-link ${isActive('pacman')}"><span class="sidebar-icon">🟡</span><span>Pac-Man</span></a>
      <a href="${base}games/pong/index.html" class="sidebar-link ${isActive('pong')}"><span class="sidebar-icon">🏓</span><span>Pong</span></a>
      <a href="${base}games/spaceinvaders/index.html" class="sidebar-link ${isActive('invaders')}"><span class="sidebar-icon">👾</span><span>Space Invaders</span></a>
      <a href="${base}games/tetris/index.html" class="sidebar-link ${isActive('tetris')}"><span class="sidebar-icon">🧱</span><span>Tetris</span></a>
      <span class="sidebar-section-label">Tabuleiro</span>
      <a href="${base}games/battleship/index.html" class="sidebar-link ${isActive('batalha')}"><span class="sidebar-icon">🚢</span><span>Batalha Naval</span></a>
      <a href="${base}games/connect4/index.html" class="sidebar-link ${isActive('connect4')}"><span class="sidebar-icon">🔴</span><span>Conecte 4</span></a>
      <a href="${base}games/checkers/index.html" class="sidebar-link ${isActive('dama')}"><span class="sidebar-icon">⚫</span><span>Dama</span></a>
      <a href="${base}games/domino/index.html" class="sidebar-link ${isActive('domino')}"><span class="sidebar-icon">🁣</span><span>Dominó</span></a>
      <a href="${base}games/go/index.html" class="sidebar-link ${isActive('go')}"><span class="sidebar-icon">⚫</span><span>Go</span></a>
      <a href="${base}games/tictactoe/index.html" class="sidebar-link ${isActive('velha')}"><span class="sidebar-icon">❌</span><span>Jogo da Velha</span></a>
      <a href="${base}games/ludo/index.html" class="sidebar-link ${isActive('ludo')}"><span class="sidebar-icon">🎲</span><span>Ludo</span></a>
      <a href="${base}games/reversi/index.html" class="sidebar-link ${isActive('reversi')}"><span class="sidebar-icon">⚪</span><span>Reversi</span></a>
      <a href="${base}games/chess/index.html" class="sidebar-link ${isActive('xadrez')}"><span class="sidebar-icon">♟️</span><span>Xadrez</span></a>
      <span class="sidebar-section-label">Palavras</span>
      <a href="${base}games/anagram/index.html" class="sidebar-link ${isActive('anagrama')}"><span class="sidebar-icon">🔀</span><span>Anagrama</span></a>
      <a href="${base}games/wordsearch/index.html" class="sidebar-link ${isActive('cacapalavras')}"><span class="sidebar-icon">🔍</span><span>Caca-Palavras</span></a>
      <a href="${base}games/hangman/index.html" class="sidebar-link ${isActive('forca')}"><span class="sidebar-icon">🔤</span><span>Forca</span></a>
      <a href="${base}games/stopgame/index.html" class="sidebar-link ${isActive('stop')}"><span class="sidebar-icon">✋</span><span>Stop!</span></a>
      <a href="${base}games/termo/index.html" class="sidebar-link ${isActive('termo')}"><span class="sidebar-icon">📝</span><span>Termo</span></a>
      <span class="sidebar-section-label">Casual</span>
      <a href="${base}games/cookieclicker/index.html" class="sidebar-link ${isActive('cookie')}"><span class="sidebar-icon">🍪</span><span>Cookie Clicker</span></a>
      <a href="${base}games/quiz/index.html" class="sidebar-link ${isActive('quiz')}"><span class="sidebar-icon">🧠</span><span>Quiz Battle</span></a>
      <a href="${base}games/sinuca/index.html" class="sidebar-link ${isActive('sinuca')}"><span class="sidebar-icon">🎱</span><span>Sinuca</span></a>
      <div class="sidebar-divider"></div>
      <a href="${base}sobre.html" class="sidebar-link ${isActive('sobre')}">
        <span class="sidebar-icon">ℹ️</span>
        <span>Sobre</span>
      </a>
      <a href="${base}privacidade.html" class="sidebar-link ${isActive('privacidade')}">
        <span class="sidebar-icon">🔒</span>
        <span>Privacidade</span>
      </a>
      <div class="sidebar-divider"></div>
      <a href="${base}doacao.html" class="sidebar-link ${isActive('doacao')}">
        <span class="sidebar-icon">☕</span>
        <span>Apoie o Projeto</span>
      </a>
      <a href="${base}report-bug.html" class="sidebar-link ${isActive('bug')}">
        <span class="sidebar-icon">🐛</span>
        <span>Reportar Bug</span>
      </a>
    </nav>
    <div class="sidebar-footer">
      <span>Games Hub &copy; 2026</span>
    </div>
  `;
  document.body.appendChild(aside);

  // Inject toggle button into header
  let toggleBtn = document.getElementById('sidebar-toggle');
  if (!toggleBtn) {
    const header = document.querySelector('.header, .topbar');
    if (header) {
      toggleBtn = document.createElement('button');
      toggleBtn.className = 'sidebar-toggle';
      toggleBtn.id = 'sidebar-toggle';
      toggleBtn.setAttribute('aria-label', 'Abrir menu');
      toggleBtn.innerHTML = '<span></span><span></span><span></span>';
      header.insertBefore(toggleBtn, header.firstChild);
    }
  }

  // Event listeners
  const closeBtn = document.getElementById('sidebar-close');

  function openSidebar() {
    aside.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    aside.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
  closeBtn.addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  // Fechar com Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aside.classList.contains('open')) {
      closeSidebar();
    }
  });

  // Botao flutuante "Jogar com Amigos" em paginas de jogos
  if (window.location.pathname.includes('/games/')) {
    const gameName = window.location.pathname.split('/games/')[1].split('/')[0];

    // Lista de jogos que suportam multiplayer
    const multiplayerGames = ['truco', 'uno', 'poker', 'buraco', 'chess', 'checkers', 'ludo', 'domino', 'go', 'connect4', 'reversi', 'battleship', 'tictactoe'];

    // So mostra o botao para jogos multiplayer
    if (!multiplayerGames.includes(gameName)) {
      return;
    }

    const friendBtn = document.createElement('a');
    friendBtn.href = base + 'multiplayer.html?game=' + gameName;
    friendBtn.className = 'friend-play-float';
    friendBtn.innerHTML = '🎮 Jogar com Amigos';
    document.body.appendChild(friendBtn);

    const friendStyle = document.createElement('style');
    friendStyle.textContent = `
      .friend-play-float {
        position: fixed;
        top: 80px;
        right: 10px;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        color: #fff;
        border-radius: 999px;
        padding: 0.45rem 0.9rem;
        font-size: 0.75rem;
        font-weight: 800;
        font-family: 'Nunito', sans-serif;
        text-decoration: none;
        box-shadow: 0 4px 14px rgba(124, 58, 237, 0.45);
        z-index: 800;
        transition: transform 0.2s, box-shadow 0.2s;
        white-space: nowrap;
      }
      .friend-play-float:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(124, 58, 237, 0.6);
      }
      /* Desktop: ajusta posicao */
      @media (min-width: 769px) {
        .friend-play-float {
          top: 90px;
          right: 20px;
          padding: 0.55rem 1.1rem;
          font-size: 0.82rem;
        }
      }
    `;
    document.head.appendChild(friendStyle);
  }

  // Widget de doacao PIX na secao de info dos jogos
  const gameInfo = document.querySelector('section.game-info');
  if (gameInfo) {
    const donateEl = document.createElement('div');
    donateEl.className = 'pix-donate-card';
    donateEl.innerHTML = `
      <span class="pix-donate-icon">❤️</span>
      <div class="pix-donate-text">
        <strong>Gostou dos jogos?</strong>
        <span>Ajude a manter o Games Hub gratuito com uma doação via PIX.</span>
      </div>
      <a href="${base}doacao.html" class="pix-donate-btn">Apoiar com PIX</a>
    `;
    gameInfo.appendChild(donateEl);

    const pixStyle = document.createElement('style');
    pixStyle.textContent = `
      .pix-donate-card {
        display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
        margin-top: 1.8rem; padding: 1rem 1.2rem;
        background: linear-gradient(135deg, rgba(255,107,53,0.08), rgba(255,107,53,0.02));
        border: 1.5px solid rgba(255,107,53,0.22); border-radius: 14px;
      }
      .pix-donate-icon { font-size: 1.6rem; flex-shrink: 0; }
      .pix-donate-text { flex: 1; min-width: 160px; }
      .pix-donate-text strong { display: block; font-size: 0.92rem; color: #333; margin-bottom: 0.15rem; font-family: 'Nunito', sans-serif; }
      .pix-donate-text span { font-size: 0.8rem; color: #777; font-family: 'Nunito', sans-serif; }
      .pix-donate-btn {
        display: inline-block; background: #ff6b35; color: #fff; text-decoration: none;
        font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 0.85rem;
        border-radius: 999px; padding: 0.5rem 1.2rem; white-space: nowrap;
        transition: background 0.2s; flex-shrink: 0;
      }
      .pix-donate-btn:hover { background: #e85d2a; }
    `;
    document.head.appendChild(pixStyle);
  }

  // Botao flutuante "Reportar Bug" em paginas de jogos
  if (window.location.pathname.includes('/games/')) {
    const bugBtn = document.createElement('a');
    bugBtn.href = base + 'report-bug.html';
    bugBtn.className = 'bug-report-float';
    bugBtn.innerHTML = '🐛';
    bugBtn.title = 'Reportar Bug';
    document.body.appendChild(bugBtn);

    const bugStyle = document.createElement('style');
    bugStyle.textContent = `
      .bug-report-float {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #ff6b35, #e85d2a);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.4rem;
        text-decoration: none;
        box-shadow: 0 4px 14px rgba(255, 107, 53, 0.4);
        z-index: 800;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .bug-report-float:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(255, 107, 53, 0.5);
      }
    `;
    document.head.appendChild(bugStyle);
  }

  // ===== SOCIAL NOTIFICATIONS BADGE =====
  // Atualiza badges de notificacoes na sidebar
  async function updateSocialBadges() {
    try {
      // Import dinamico do notifications.js
      const { getUnreadCount } = await import(base + 'notifications.js?v=1');
      const { getPendingChallengeCount } = await import(base + 'challenge-system.js?v=1');

      const [notificationsCount, challengesCount] = await Promise.all([
        getUnreadCount(),
        getPendingChallengeCount()
      ]);

      const friendsBadge = document.getElementById('sidebar-friends-badge');
      const challengesBadge = document.getElementById('sidebar-challenges-badge');

      if (friendsBadge && notificationsCount > 0) {
        friendsBadge.textContent = notificationsCount > 99 ? '99+' : notificationsCount;
        friendsBadge.style.display = 'block';
      }

      if (challengesBadge && challengesCount > 0) {
        challengesBadge.textContent = challengesCount > 99 ? '99+' : challengesCount;
        challengesBadge.style.display = 'block';
      }
    } catch (e) {
      // Silently fail if social modules not available
    }
  }

  // Atualiza badges ao iniciar
  updateSocialBadges();

  // Atualiza a cada 30 segundos
  setInterval(updateSocialBadges, 30000);
}
