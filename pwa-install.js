/**
 * PWA Install Prompt Component
 * Detecta quando o app pode ser instalado e mostra um banner discreto
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'pwa-install-prompt';
  const DEBUG = location.hostname === 'localhost' || location.search.includes('debug=pwa');

  let deferredPrompt = null;
  let isInstalled = false;
  let promptElement = null;

  // Verifica se o app já está instalado
  function checkInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
      isInstalled = true;
      log('App já está instalado (standalone mode)');
      return true;
    }
    return false;
  }

  // Verifica preferência salva no localStorage
  function getSavedPreference() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const data = JSON.parse(saved);
      const now = Date.now();
      const daysSinceDismissed = (now - data.timestamp) / (1000 * 60 * 60 * 24);

      // Se o usuário dispensou, respeitar por 7 dias
      if (data.dismissed && daysSinceDismissed < 7) {
        log('Prompt dispensado recentemente');
        return 'dismissed';
      }

      // Se o usuário já instalou
      if (data.installed) {
        return 'installed';
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  function savePreference(state) {
    try {
      const data = {
        state: state,
        timestamp: Date.now(),
        dismissed: state === 'dismissed',
        installed: state === 'installed'
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      log('Preferência salva:', state);
    } catch (e) {
      log('Erro ao salvar preferência:', e);
    }
  }

  function log(...args) {
    if (DEBUG) {
      console.log('[PWA Install]', ...args);
    }
  }

  // Cria o elemento do banner
  function createPromptElement() {
    const container = document.createElement('div');
    container.id = 'pwa-install-prompt';
    container.className = 'pwa-install-prompt';
    container.innerHTML = `
      <div class="pwa-install-content">
        <div class="pwa-install-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="url(#pwa-gradient)"/>
            <path d="M16 8L18.5 13.5H24.5L19.5 17.5L22 23L16 19L10 23L12.5 17.5L7.5 13.5H13.5L16 8Z" fill="white"/>
            <defs>
              <linearGradient id="pwa-gradient" x1="0" y1="0" x2="32" y2="32">
                <stop stop-color="#ff6b35"/>
                <stop offset="1" stop-color="#e85d2a"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="pwa-install-text">
          <div class="pwa-install-title">Games Hub</div>
          <div class="pwa-install-subtitle">Instale o app para acesso rápido</div>
        </div>
        <div class="pwa-install-actions">
          <button class="pwa-install-btn" id="pwa-install-btn">Instalar</button>
          <button class="pwa-install-dismiss" id="pwa-install-dismiss" aria-label="Dispensar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3L8 8M8 8L3 13M8 8L13 3M8 8L13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Estilos inline para evitar FOUC
    const styles = document.createElement('style');
    styles.textContent = `
      .pwa-install-prompt {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 9999;
        background: linear-gradient(135deg, rgba(26, 26, 46, 0.98), rgba(22, 33, 62, 0.98));
        backdrop-filter: blur(10px);
        border-top: 1px solid rgba(255, 107, 53, 0.3);
        box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
        transform: translateY(100%);
        opacity: 0;
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        font-family: 'Nunito', system-ui, -apple-system, sans-serif;
      }

      .pwa-install-prompt.show {
        transform: translateY(0);
        opacity: 1;
      }

      .pwa-install-content {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        max-width: 600px;
        margin: 0 auto;
      }

      .pwa-install-icon {
        flex-shrink: 0;
      }

      .pwa-install-icon svg {
        display: block;
        filter: drop-shadow(0 2px 4px rgba(255, 107, 53, 0.3));
      }

      .pwa-install-text {
        flex: 1;
        min-width: 0;
      }

      .pwa-install-title {
        color: #fff;
        font-weight: 700;
        font-size: 0.95rem;
        line-height: 1.3;
      }

      .pwa-install-subtitle {
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.8rem;
        line-height: 1.3;
      }

      .pwa-install-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .pwa-install-btn {
        background: linear-gradient(135deg, #ff6b35, #e85d2a);
        color: #fff;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        font-family: inherit;
      }

      .pwa-install-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
      }

      .pwa-install-btn:active {
        transform: translateY(0);
      }

      .pwa-install-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .pwa-install-dismiss {
        background: rgba(255, 255, 255, 0.08);
        border: none;
        color: rgba(255, 255, 255, 0.6);
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .pwa-install-dismiss:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
      }

      .pwa-install-dismiss svg {
        flex-shrink: 0;
      }

      /* Animação de pulso quando aparece */
      @keyframes pwa-pulse {
        0%, 100% { box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4); }
        50% { box-shadow: 0 -4px 32px rgba(255, 107, 53, 0.3); }
      }

      .pwa-install-prompt.show {
        animation: pwa-pulse 2s ease-in-out;
      }

      /* Responsivo */
      @media (max-width: 480px) {
        .pwa-install-content {
          padding: 10px 12px;
          gap: 10px;
        }

        .pwa-install-icon svg {
          width: 28px;
          height: 28px;
        }

        .pwa-install-title {
          font-size: 0.9rem;
        }

        .pwa-install-subtitle {
          font-size: 0.75rem;
        }

        .pwa-install-btn {
          padding: 7px 12px;
          font-size: 0.8rem;
        }

        .pwa-install-dismiss {
          width: 28px;
          height: 28px;
        }
      }

      /* Ajuste quando o footer tem padding */
      body:has(.pwa-install-prompt.show) .footer {
        padding-bottom: 80px;
      }

      @media (max-width: 480px) {
        body:has(.pwa-install-prompt.show) .footer {
          padding-bottom: 70px;
        }
      }
    `;

    document.head.appendChild(styles);
    document.body.appendChild(container);

    return container;
  }

  // Mostra o banner de instalação
  function showPrompt() {
    if (isInstalled || !deferredPrompt) {
      log('Não pode mostrar prompt: instalado ou sem deferredPrompt');
      return;
    }

    const preference = getSavedPreference();
    if (preference === 'dismissed') {
      log('Prompt foi dispensado recentemente');
      return;
    }

    if (!promptElement) {
      promptElement = createPromptElement();
    }

    // Adiciona event listeners
    const installBtn = promptElement.querySelector('#pwa-install-btn');
    const dismissBtn = promptElement.querySelector('#pwa-install-dismiss');

    installBtn.addEventListener('click', handleInstall);
    dismissBtn.addEventListener('click', handleDismiss);

    // Mostra com animação
    requestAnimationFrame(() => {
      promptElement.classList.add('show');
      log('Banner exibido');
    });

    // Evento para analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_prompt_shown');
    }
  }

  // Esconde o banner
  function hidePrompt() {
    if (promptElement) {
      promptElement.classList.remove('show');
      log('Banner ocultado');
    }
  }

  // Handler de instalação
  async function handleInstall() {
    if (!deferredPrompt) return;

    const btn = promptElement.querySelector('#pwa-install-btn');
    btn.disabled = true;
    btn.textContent = 'Instalando...';

    log('Iniciando instalação...');
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;

    log('Resultado da instalação:', outcome);

    if (outcome === 'accepted') {
      savePreference('installed');
      hidePrompt();

      if (typeof gtag !== 'undefined') {
        gtag('event', 'pwa_installed');
      }
    } else {
      btn.disabled = false;
      btn.textContent = 'Instalar';

      if (typeof gtag !== 'undefined') {
        gtag('event', 'pwa_install_declined');
      }
    }
  }

  // Handler de dismiss
  function handleDismiss() {
    savePreference('dismissed');
    hidePrompt();

    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_prompt_dismissed');
    }
    log('Usuário dispensou o prompt');
  }

  // Inicialização
  function init() {
    if (checkInstalled()) return;

    // Captura o evento beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      log('Evento beforeinstallprompt capturado');
      e.preventDefault();
      deferredPrompt = e;

      // Pequeno delay para não interromper o carregamento
      setTimeout(() => {
        showPrompt();
      }, 2000);
    });

    // Detecta quando o app é instalado
    window.addEventListener('appinstalled', () => {
      log('App instalado com sucesso');
      savePreference('installed');
      hidePrompt();
      deferredPrompt = null;
      isInstalled = true;

      if (typeof gtag !== 'undefined') {
        gtag('event', 'pwa_appinstalled_event');
      }
    });

    // Log inicial
    log('PWA Install Prompt inicializado');
    log('Preferência salva:', getSavedPreference());
  }

  // Inicia quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API pública
  window.PWAInstall = {
    show: showPrompt,
    hide: hidePrompt,
    get isInstallable() { return !!deferredPrompt; },
    get isInstalled() { return isInstalled; },
    clearPreference: () => {
      localStorage.removeItem(STORAGE_KEY);
      log('Preferência limpa');
    }
  };
})();
