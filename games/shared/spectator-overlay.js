export function createSpectatorOverlay(room) {
  // Create banner at top of page
  const banner = document.createElement('div');
  banner.className = 'spectator-banner';
  banner.innerHTML = `
    <div class="spectator-info">
      <span class="spectator-live-dot"></span>
      <span class="spectator-label">ASSISTINDO AO VIVO</span>
      <span class="spectator-players">${room.player1_name || 'Jogador 1'} vs ${room.player2_name || 'Jogador 2'}</span>
    </div>
    <div class="spectator-count">
      <span class="spectator-eye">👁️</span>
      <span id="spectator-count-num">1</span>
    </div>
  `;

  document.body.prepend(banner);

  // Disable all interactive elements (buttons, inputs)
  document.querySelectorAll('button, input, [draggable]').forEach(el => {
    if (!el.closest('.spectator-banner') && !el.closest('.topbar')) {
      el.disabled = true;
      el.style.pointerEvents = 'none';
    }
  });

  return banner;
}

export function updateSpectatorCount(count) {
  const el = document.getElementById('spectator-count-num');
  if (el) el.textContent = count;
}
