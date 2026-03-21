/**
 * Toast Notification System
 * Sistema de notificacoes toast para o Games Hub
 * Suporte a success, error, info
 * Auto-dismiss apos 3 segundos com animacao suave
 */

(function() {
  'use strict';

  // Container unico para toasts
  let toastContainer = null;

  /**
   * Cria o container de toasts se nao existir
   */
  function getOrCreateContainer() {
    if (toastContainer) return toastContainer;

    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.setAttribute('role', 'region');
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-label', 'Notificacoes');
    toastContainer.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);

    return toastContainer;
  }

  /**
   * Cria um elemento toast
   * @param {string} message - Mensagem a exibir
   * @param {string} type - Tipo: success, error, info
   * @returns {HTMLElement} Elemento toast
   */
  function createToastElement(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.style.cssText = `
      padding: 1rem 1.25rem;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 600;
      color: #fff;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      transform: translateX(100%);
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
      pointer-events: auto;
      min-width: 280px;
      max-width: 400px;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    `;

    // Cores por tipo
    const colors = {
      success: { bg: 'linear-gradient(135deg, #28a745, #20c997)', icon: '✓' },
      error: { bg: 'linear-gradient(135deg, #dc3545, #e85d2a)', icon: '✕' },
      info: { bg: 'linear-gradient(135deg, #0066cc, #00a8e8)', icon: 'ℹ' }
    };

    const style = colors[type] || colors.info;
    toast.style.background = style.bg;

    toast.innerHTML = `
      <span style="font-size: 1.2rem; flex-shrink: 0;">${style.icon}</span>
      <span style="flex: 1;">${message}</span>
      <button class="toast-close" aria-label="Fechar notificacao" style="
        background: none;
        border: none;
        color: rgba(255,255,255,0.8);
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: color 0.2s, background-color 0.2s;
      ">×</button>
    `;

    return toast;
  }

  /**
   * Mostra um toast
   * @param {string} message - Mensagem a exibir
   * @param {string} type - Tipo: success, error, info
   * @param {number} duration - Duracao em ms (padrao: 3000)
   */
  function show(message, type = 'info', duration = 3000) {
    const container = getOrCreateContainer();
    const toast = createToastElement(message, type);

    container.appendChild(toast);

    // Forcar reflow para garantir animacao
    toast.offsetHeight;

    // Animar entrada
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    });

    // Botao de fechar
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => dismiss(toast));

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => dismiss(toast), duration);
    }

    return toast;
  }

  /**
   * Remove um toast com animacao
   * @param {HTMLElement} toast - Elemento toast a remover
   */
  function dismiss(toast) {
    if (!toast || toast.classList.contains('dismissing')) return;

    toast.classList.add('dismissing');
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  // API publica
  const Toast = {
    success: (message, duration) => show(message, 'success', duration),
    error: (message, duration) => show(message, 'error', duration),
    info: (message, duration) => show(message, 'info', duration),
    show: show,
    dismiss: dismiss
  };

  // Expor globalmente
  window.Toast = Toast;
})();
