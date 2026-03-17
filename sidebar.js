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
      <div class="sidebar-divider"></div>
      <span class="sidebar-section-label">Cartas</span>
      <a href="${base}games/solitaire/index.html" class="sidebar-link ${isActive('paciencia')}"><span class="sidebar-icon">🃏</span><span>Paciencia</span></a>
      <a href="${base}games/freecell/index.html" class="sidebar-link ${isActive('freecell')}"><span class="sidebar-icon">🂡</span><span>Freecell</span></a>
      <a href="${base}games/spider-solitaire/index.html" class="sidebar-link ${isActive('spider')}"><span class="sidebar-icon">🕷️</span><span>Spider Solitaire</span></a>
      <a href="${base}games/blackjack/index.html" class="sidebar-link ${isActive('blackjack')}"><span class="sidebar-icon">🃏</span><span>Blackjack</span></a>
      <a href="${base}games/truco/index.html" class="sidebar-link ${isActive('truco')}"><span class="sidebar-icon">🂠</span><span>Truco</span></a>
      <a href="${base}games/uno/index.html" class="sidebar-link ${isActive('uno')}"><span class="sidebar-icon">🟥</span><span>Uno</span></a>
      <a href="${base}games/pyramid/index.html" class="sidebar-link ${isActive('piramide')}"><span class="sidebar-icon">🔺</span><span>Piramide</span></a>
      <span class="sidebar-section-label">Puzzle</span>
      <a href="${base}games/memory/index.html" class="sidebar-link ${isActive('memoria')}"><span class="sidebar-icon">🧠</span><span>Memoria</span></a>
      <a href="${base}games/minesweeper/index.html" class="sidebar-link ${isActive('minesweeper')}"><span class="sidebar-icon">💣</span><span>Campo Minado</span></a>
      <a href="${base}games/game2048/index.html" class="sidebar-link ${isActive('2048')}"><span class="sidebar-icon">🔢</span><span>2048</span></a>
      <a href="${base}games/sudoku/index.html" class="sidebar-link ${isActive('sudoku')}"><span class="sidebar-icon">🔢</span><span>Sudoku</span></a>
      <a href="${base}games/puzzle15/index.html" class="sidebar-link ${isActive('puzzle15')}"><span class="sidebar-icon">🧩</span><span>Puzzle 15</span></a>
      <a href="${base}games/nonogram/index.html" class="sidebar-link ${isActive('nonogram')}"><span class="sidebar-icon">🖼️</span><span>Nonogram</span></a>
      <a href="${base}games/mahjong/index.html" class="sidebar-link ${isActive('mahjong')}"><span class="sidebar-icon">🀄</span><span>Mahjong</span></a>
      <a href="${base}games/numble/index.html" class="sidebar-link ${isActive('numble')}"><span class="sidebar-icon">🔣</span><span>Numble</span></a>
      <a href="${base}games/lightsout/index.html" class="sidebar-link ${isActive('lightsout')}"><span class="sidebar-icon">💡</span><span>Lights Out</span></a>
      <a href="${base}games/sokoban/index.html" class="sidebar-link ${isActive('sokoban')}"><span class="sidebar-icon">📦</span><span>Sokoban</span></a>
      <span class="sidebar-section-label">Arcade</span>
      <a href="${base}games/snake/index.html" class="sidebar-link ${isActive('cobrinha')}"><span class="sidebar-icon">🐍</span><span>Cobrinha</span></a>
      <a href="${base}games/tetris/index.html" class="sidebar-link ${isActive('tetris')}"><span class="sidebar-icon">🧱</span><span>Tetris</span></a>
      <a href="${base}games/flappybird/index.html" class="sidebar-link ${isActive('flappy')}"><span class="sidebar-icon">🐦</span><span>Flappy Bird</span></a>
      <a href="${base}games/pong/index.html" class="sidebar-link ${isActive('pong')}"><span class="sidebar-icon">🏓</span><span>Pong</span></a>
      <a href="${base}games/breakout/index.html" class="sidebar-link ${isActive('breakout')}"><span class="sidebar-icon">🧱</span><span>Breakout</span></a>
      <a href="${base}games/dinorunner/index.html" class="sidebar-link ${isActive('dino')}"><span class="sidebar-icon">🦕</span><span>Dino Runner</span></a>
      <a href="${base}games/spaceinvaders/index.html" class="sidebar-link ${isActive('invaders')}"><span class="sidebar-icon">👾</span><span>Space Invaders</span></a>
      <a href="${base}games/pacman/index.html" class="sidebar-link ${isActive('pacman')}"><span class="sidebar-icon">🟡</span><span>Pac-Man</span></a>
      <span class="sidebar-section-label">Tabuleiro</span>
      <a href="${base}games/checkers/index.html" class="sidebar-link ${isActive('dama')}"><span class="sidebar-icon">⚫</span><span>Dama</span></a>
      <a href="${base}games/tictactoe/index.html" class="sidebar-link ${isActive('velha')}"><span class="sidebar-icon">❌</span><span>Jogo da Velha</span></a>
      <a href="${base}games/reversi/index.html" class="sidebar-link ${isActive('reversi')}"><span class="sidebar-icon">⚪</span><span>Reversi</span></a>
      <a href="${base}games/chess/index.html" class="sidebar-link ${isActive('xadrez')}"><span class="sidebar-icon">♟️</span><span>Xadrez</span></a>
      <a href="${base}games/battleship/index.html" class="sidebar-link ${isActive('batalha')}"><span class="sidebar-icon">🚢</span><span>Batalha Naval</span></a>
      <a href="${base}games/connect4/index.html" class="sidebar-link ${isActive('connect4')}"><span class="sidebar-icon">🔴</span><span>Conecte 4</span></a>
      <a href="${base}games/go/index.html" class="sidebar-link ${isActive('go')}"><span class="sidebar-icon">⚫</span><span>Go</span></a>
      <span class="sidebar-section-label">Palavras</span>
      <a href="${base}games/termo/index.html" class="sidebar-link ${isActive('termo')}"><span class="sidebar-icon">📝</span><span>Termo</span></a>
      <a href="${base}games/hangman/index.html" class="sidebar-link ${isActive('forca')}"><span class="sidebar-icon">🔤</span><span>Forca</span></a>
      <a href="${base}games/wordsearch/index.html" class="sidebar-link ${isActive('cacapalavras')}"><span class="sidebar-icon">🔍</span><span>Caca-Palavras</span></a>
      <a href="${base}games/anagram/index.html" class="sidebar-link ${isActive('anagrama')}"><span class="sidebar-icon">🔀</span><span>Anagrama</span></a>
      <a href="${base}games/stopgame/index.html" class="sidebar-link ${isActive('stop')}"><span class="sidebar-icon">✋</span><span>Stop!</span></a>
      <span class="sidebar-section-label">Casual</span>
      <a href="${base}games/cookieclicker/index.html" class="sidebar-link ${isActive('cookie')}"><span class="sidebar-icon">🍪</span><span>Cookie Clicker</span></a>
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
      <span>Games Hub &copy; 2025</span>
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

    const friendBtn = document.createElement('a');
    friendBtn.href = base + 'multiplayer.html?game=' + gameName;
    friendBtn.className = 'friend-play-float';
    friendBtn.innerHTML = '🎮 Jogar com Amigos';
    document.body.appendChild(friendBtn);

    const friendStyle = document.createElement('style');
    friendStyle.textContent = `
      .friend-play-float {
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        color: #fff;
        border-radius: 999px;
        padding: 0.55rem 1.1rem;
        font-size: 0.82rem;
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
    `;
    document.head.appendChild(friendStyle);
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
}
