/**
 * Toast especializado para conquistas desbloqueadas
 * Exibe overlay animado com icone, nome, descricao e moedas
 *
 * @module achievement-toast
 */

/**
 * Exibe um toast de conquista desbloqueada.
 * @param {Object} achievement - Objeto da conquista { icon, name, desc, coins }
 */
export function showAchievementToast(achievement) {
  // Remove any existing achievement toast
  const existing = document.querySelector('.achievement-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  toast.innerHTML = `
    <div class="achievement-toast-glow"></div>
    <div class="achievement-toast-content">
      <div class="achievement-toast-header">
        <span class="achievement-toast-badge">CONQUISTA</span>
      </div>
      <div class="achievement-toast-body">
        <span class="achievement-toast-icon">${achievement.icon}</span>
        <div class="achievement-toast-info">
          <div class="achievement-toast-name">${achievement.name}</div>
          <div class="achievement-toast-desc">${achievement.desc}</div>
        </div>
      </div>
      <div class="achievement-toast-coins">+${achievement.coins} \u{1FA99} moedas</div>
    </div>
  `;

  document.body.appendChild(toast);

  // Trigger entrance animation
  requestAnimationFrame(() => {
    toast.classList.add('achievement-toast-enter');
  });

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    toast.classList.remove('achievement-toast-enter');
    toast.classList.add('achievement-toast-exit');

    toast.addEventListener('animationend', () => {
      toast.remove();
    }, { once: true });

    // Safety fallback removal
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 600);
  }, 4000);

  // Allow click to dismiss
  toast.addEventListener('click', () => {
    toast.classList.remove('achievement-toast-enter');
    toast.classList.add('achievement-toast-exit');
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 400);
  });
}
