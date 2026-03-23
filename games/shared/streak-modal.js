/**
 * Streak Modal - Shows daily streak progress
 */
import { streakManager, STREAK_REWARDS } from './streak-manager.js';

export function showStreakModal(result) {
  // Don't show if not a new day
  if (!result.isNewDay) return;

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'streak-modal-overlay';

  const milestones = Object.keys(STREAK_REWARDS).map(Number).sort((a, b) => a - b);
  const nextMilestone = milestones.find(m => m > result.streakDay) || milestones[milestones.length - 1];

  const isMilestone = STREAK_REWARDS[result.streakDay] !== undefined;

  overlay.innerHTML = `
    <div class="streak-modal">
      <div class="streak-modal-icon">${result.streakBroken ? '\u{1F622}' : (isMilestone ? '\u{1F3C6}' : '\u{1F525}')}</div>
      <h2 class="streak-modal-title">
        ${result.streakBroken ? 'Streak perdida...' : (isMilestone ? 'Marco alcançado!' : 'Streak mantida!')}
      </h2>
      <div class="streak-modal-count">${result.streakDay}</div>
      <p class="streak-modal-label">${result.streakDay === 1 ? 'dia' : 'dias consecutivos'}</p>
      <div class="streak-modal-reward">+${result.reward} \u{1FA99}</div>
      ${!isMilestone ? `<p class="streak-modal-next">Próximo marco: ${nextMilestone} dias (+${STREAK_REWARDS[nextMilestone]} \u{1FA99})</p>` : ''}
      <button class="streak-modal-btn" id="streak-modal-close">Jogar!</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('show'));

  // Close handlers
  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 300);
  };

  overlay.querySelector('#streak-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
