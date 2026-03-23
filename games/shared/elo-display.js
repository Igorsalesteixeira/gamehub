/**
 * ELO Display — Game Hub
 * Componente visual para mostrar resultado de rating ELO após partidas multiplayer.
 */

export function showEloResult(result) {
  // result = { oldRating, newRating, change, oldDivision, newDivision, promoted }
  const overlay = document.createElement('div');
  overlay.className = 'elo-result-overlay';

  const changeClass = result.change >= 0 ? 'positive' : 'negative';
  const changeSign = result.change >= 0 ? '+' : '';

  let promotionHtml = '';
  if (result.promoted) {
    promotionHtml = `
      <div class="elo-promotion">
        <span class="elo-promotion-icon">${result.newDivision.icon}</span>
        <span>Promovido para ${result.newDivision.name}!</span>
      </div>`;
  }

  overlay.innerHTML = `
    <div class="elo-result-card">
      <div class="elo-result-division">${result.newDivision.icon} ${result.newDivision.name}</div>
      <div class="elo-result-rating">${result.newRating}</div>
      <div class="elo-result-change ${changeClass}">${changeSign}${result.change}</div>
      ${promotionHtml}
      <button class="elo-result-close">OK</button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  overlay.querySelector('.elo-result-close').addEventListener('click', () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 300);
  });

  // Auto close after 5s
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
    }
  }, 5000);
}
