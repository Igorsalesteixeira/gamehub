import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameTimer } from '../shared/timer.js';
import { onGameEnd } from '../shared/game-integration.js';

// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

// Daily challenge support
const dailySeed = new URLSearchParams(window.location.search).get('daily');
let dailyRNG = null;

function seededRNG(seed) {
  let s = seed;
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getRNG() {
  return dailyRNG ? dailyRNG() : Math.random();
}

// ===== STATE =====
let gridSize = 5;
let solution = [];
let playerGrid = [];
let gameOver = false;
let longPressTimer = null;

// ===== DOM =====
const boardEl = document.getElementById('nonogram-board');
const timerEl = document.getElementById('timer-display');
const modalEl = document.getElementById('modal');
const modalMsg = document.getElementById('modal-msg');
const modalStats = document.getElementById('modal-stats');
const diffBtns = document.querySelectorAll('.diff-btn');

// GameStats e GameTimer
const gameStats = new GameStats('nonogram', { autoSync: true });
const gameTimer = new GameTimer({
  onTick: (time, formatted) => {
    timerEl.textContent = formatted;
  }
});

// ===== CLUE GENERATION =====
function getClues(line) {
  const clues = [];
  let count = 0;
  for (const cell of line) {
    if (cell === 1) { count++; }
    else { if (count > 0) clues.push(count); count = 0; }
  }
  if (count > 0) clues.push(count);
  return clues.length > 0 ? clues : [0];
}

function getRowClues() {
  return solution.map(row => getClues(row));
}

function getColClues() {
  const clues = [];
  for (let c = 0; c < gridSize; c++) {
    const col = solution.map(row => row[c]);
    clues.push(getClues(col));
  }
  return clues;
}

// ===== PUZZLE GENERATION =====
function generatePuzzle() {
  solution = [];
  for (let r = 0; r < gridSize; r++) {
    const row = [];
    for (let c = 0; c < gridSize; c++) {
      row.push(getRNG() < 0.5 ? 1 : 0);
    }
    solution.push(row);
  }
  // Ensure at least one filled cell per row and column
  for (let r = 0; r < gridSize; r++) {
    if (!solution[r].includes(1)) solution[r][Math.floor(getRNG() * gridSize)] = 1;
  }
  for (let c = 0; c < gridSize; c++) {
    const col = solution.map(row => row[c]);
    if (!col.includes(1)) solution[Math.floor(getRNG() * gridSize)][c] = 1;
  }
}

// ===== RENDER =====
function render() {
  const rowClues = getRowClues();
  const colClues = getColClues();
  const maxRowClueLen = Math.max(...rowClues.map(c => c.length));
  const maxColClueLen = Math.max(...colClues.map(c => c.length));

  const totalCols = maxRowClueLen + gridSize;
  const totalRows = maxColClueLen + gridSize;

  boardEl.style.gridTemplateColumns = `repeat(${maxRowClueLen}, minmax(20px, auto)) repeat(${gridSize}, 1fr)`;
  boardEl.style.gridTemplateRows = `repeat(${maxColClueLen}, minmax(20px, auto)) repeat(${gridSize}, 1fr)`;
  boardEl.innerHTML = '';

  // Corner cells
  for (let r = 0; r < maxColClueLen; r++) {
    for (let c = 0; c < maxRowClueLen; c++) {
      const cell = document.createElement('div');
      cell.className = 'clue-cell corner';
      boardEl.appendChild(cell);
    }
    // Column clues
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement('div');
      cell.className = 'clue-cell col-clue';
      cell.dataset.col = c;
      const clue = colClues[c];
      const offset = maxColClueLen - clue.length;
      if (r >= offset) {
        cell.textContent = clue[r - offset];
      }
      boardEl.appendChild(cell);
    }
  }

  // Row clues + game cells
  for (let r = 0; r < gridSize; r++) {
    const clue = rowClues[r];
    const offset = maxRowClueLen - clue.length;
    for (let c = 0; c < maxRowClueLen; c++) {
      const cell = document.createElement('div');
      cell.className = 'clue-cell row-clue';
      cell.dataset.row = r;
      if (c >= offset) {
        cell.textContent = clue[c - offset];
      }
      boardEl.appendChild(cell);
    }
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement('div');
      cell.className = 'game-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      if (playerGrid[r][c] === 1) cell.classList.add('filled');
      else if (playerGrid[r][c] === 2) { cell.classList.add('marked'); cell.textContent = 'X'; }

      // Left click = fill
      cell.addEventListener('click', (e) => {
        e.preventDefault();
        if (gameOver) return;
        toggleFill(r, c);
      });
      // Right click = mark X
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (gameOver) return;
        toggleMark(r, c);
      });
      // Long press = mark X on mobile
      cell.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
          e.preventDefault();
          toggleMark(r, c);
          longPressTimer = -1; // flag that long press fired
        }, 400);
      }, { passive: true });
      cell.addEventListener('touchend', (e) => {
        if (longPressTimer === -1) {
          e.preventDefault();
          longPressTimer = null;
          return;
        }
        clearTimeout(longPressTimer);
        longPressTimer = null;
      });
      cell.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      });

      boardEl.appendChild(cell);
    }
  }
}

function toggleFill(r, c) {
  if (!gameTimer.isRunning() && !gameTimer.getTime()) gameTimer.start();
  if (playerGrid[r][c] === 1) playerGrid[r][c] = 0;
  else { playerGrid[r][c] = 1; }
  playSound('place'); // som ao marcar célula
  render();
  checkWin();
}

function toggleMark(r, c) {
  if (!gameTimer.isRunning() && !gameTimer.getTime()) gameTimer.start();
  if (playerGrid[r][c] === 2) playerGrid[r][c] = 0;
  else playerGrid[r][c] = 2;
  playSound('click'); // som ao marcar X
  render();
}

// ===== WIN CHECK =====
function checkWin() {
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const filled = playerGrid[r][c] === 1;
      const shouldBeFilled = solution[r][c] === 1;
      if (filled !== shouldBeFilled) return;
    }
  }
  // Win!
  gameOver = true;
  gameTimer.stop();
  launchConfetti();
  playSound('win');
  modalMsg.textContent = `Voce completou o nonogram ${gridSize}x${gridSize}!`;
  modalStats.textContent = `Tempo: ${gameTimer.getFormatted()}`;
  modalEl.classList.remove('hidden');
  saveStats();
  if (dailySeed) {
    import('../shared/daily-challenge.js').then(m => {
      m.dailyChallenge.recordResult({ won: true, time: gameTimer.getTime() * 1000 });
    });
  }
}

// ===== STATS =====
async function saveStats() {
  gameStats.recordGame(true, { time: gameTimer.getTime() });
  onGameEnd('nonogram', { won: true, time: gameTimer.getTime() * 1000 });
}

// ===== INIT =====
function newGame() {
  gameOver = false;
  gameTimer.stop();
  gameTimer.reset();
  timerEl.textContent = '0:00';
  playerGrid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
  // Reset daily RNG for deterministic generation each time
  if (dailySeed) {
    dailyRNG = seededRNG(parseInt(dailySeed, 10) || 0);
  }
  generatePuzzle();
  render();
}

// ===== EVENTS =====
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gridSize = parseInt(btn.dataset.size);
    newGame();
  });
});

document.getElementById('btn-new').addEventListener('click', () => {
  if (dailySeed) return;
  newGame();
});
document.getElementById('btn-modal-new').addEventListener('click', () => {
  if (dailySeed) return;
  modalEl.classList.add('hidden');
  newGame();
});
document.getElementById('btn-share')?.addEventListener('click', () => {
  shareOnWhatsApp(`🎉 Completei o Nonogram no Games Hub! Venha jogar tambem: https://gameshub.com.br/games/nonogram/`);
});

// Disable buttons in daily mode
if (dailySeed) {
  const btnNew = document.getElementById('btn-new');
  const btnModalNew = document.getElementById('btn-modal-new');
  [btnNew, btnModalNew].forEach(btn => {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = 'Desafio diário: apenas uma tentativa';
    }
  });
  diffBtns.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  });
}

newGame();
