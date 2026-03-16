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
        <span class="sidebar-title">Game Hub</span>
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
      <div class="sidebar-divider"></div>
      <span class="sidebar-section-label">Jogos</span>
      <a href="${base}games/solitaire/index.html" class="sidebar-link ${isActive('paciencia')}">
        <span class="sidebar-icon">🃏</span>
        <span>Paciencia</span>
      </a>
      <a href="${base}games/snake/index.html" class="sidebar-link ${isActive('cobrinha')}">
        <span class="sidebar-icon">🐍</span>
        <span>Cobrinha</span>
      </a>
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
    </nav>
    <div class="sidebar-footer">
      <span>Game Hub &copy; 2025</span>
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
}
