import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameTimer } from '../shared/timer.js';
import { onGameEnd } from '../shared/game-integration.js';

// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

const SIZE = 5;
let grid, moves, level;
const boardEl = document.getElementById('board');
const movesEl = document.getElementById('moves');
const levelEl = document.getElementById('level');
const modal = document.getElementById('modal');
const modalMsg = document.getElementById('modal-msg');

// GameStats e GameTimer
const gameStats = new GameStats('lightsout', { autoSync: true });
const gameTimer = new GameTimer({
  onTick: (time, formatted) => {
    // Timer é mostrado apenas no modal de vitória
  }
});

function init() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  moves = 0;
  gameTimer.reset();
  gameTimer.start();
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
  initAudio();
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
  playSound('click'); // som ao apertar luz
  render();
  if (grid.every(row => row.every(v => !v))) {
    win();
  }
}

async function win() {
  gameTimer.stop();
  const timeSec = gameTimer.getTime();
  launchConfetti();
  playSound('win');
  modalMsg.textContent = `🎉 Nivel ${level} completo!\n${moves} cliques em ${gameTimer.getFormatted()}`;
  modal.style.display = 'flex';

  // Salva estatísticas usando GameStats
  gameStats.recordGame(true, { moves: moves, time: timeSec });
  onGameEnd('lightsout', { won: true, score: moves, time: timeSec * 1000 });
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
