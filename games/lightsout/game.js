import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';
// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

const SIZE = 5;
let grid, moves, level, startTime;
const boardEl = document.getElementById('board');
const movesEl = document.getElementById('moves');
const levelEl = document.getElementById('level');
const modal = document.getElementById('modal');
const modalMsg = document.getElementById('modal-msg');

function init() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  moves = 0;
  startTime = Date.now();
  movesEl.textContent = 'Cliques: 0';
  modal.style.display = 'none';

  // Generate solvable puzzle by randomly pressing cells
  const presses = level + 2;
  for (let i = 0; i < presses; i++) {
    const r = Math.floor(Math.random() * SIZE);
    const c = Math.floor(Math.random() * SIZE);
    toggle(r, c, true);
  }
  // Ensure at least one light is on
  if (grid.every(row => row.every(v => !v))) {
    toggle(2, 2, true);
  }
  render();
}

function toggle(r, c, silent) {
  const neighbors = [[r,c],[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
  neighbors.forEach(([nr, nc]) => {
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      grid[nr][nc] = !grid[nr][nc];
    }
  });
  if (!silent) {
    moves++;
    movesEl.textContent = `Cliques: ${moves}`;
  }
}

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = `cell ${grid[r][c] ? 'on' : 'off'}`;
      cell.addEventListener('click', () => handleClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function handleClick(r, c) {
  toggle(r, c);
  render();
  if (grid.every(row => row.every(v => !v))) {
    win();
  }
}

async function win() {
  const timeSec = Math.floor((Date.now() - startTime) / 1000);
  launchConfetti();
  playSound('win');
  modalMsg.textContent = `🎉 Nivel ${level} completo!\n${moves} cliques em ${Math.floor(timeSec/60)}:${(timeSec%60).toString().padStart(2,'0')}`;
  modal.style.display = 'flex';

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('game_stats').insert({
      user_id: session.user.id, game: 'lightsout', result: 'win', moves, time_seconds: timeSec
    });
  }
}

document.getElementById('restart').addEventListener('click', init);
document.getElementById('modal-btn').addEventListener('click', () => {
  level++;
  levelEl.textContent = `Nivel ${level}`;
  init();
});
document.getElementById('btn-share')?.addEventListener('click', () => {
  shareOnWhatsApp(`🎉 Completei o nível ${level} do Lights Out no Games Hub! Venha jogar tambem: https://gameshub.com.br/games/lightsout/`);
});

level = 1;
levelEl.textContent = `Nivel ${level}`;
init();
