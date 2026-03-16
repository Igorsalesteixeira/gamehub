import { supabase } from '../../supabase.js';

// ===== STATE =====
let gridSize = 5;
let solution = [];
let playerGrid = [];
let timerSeconds = 0;
let timerInterval = null;
let gameOver = false;
let startTime = null;
let longPressTimer = null;

// ===== DOM =====
const boardEl = document.getElementById('nonogram-board');
const timerEl = document.getElementById('timer-display');
const modalEl = document.getElementById('modal');
const modalMsg = document.getElementById('modal-msg');
const modalStats = document.getElementById('modal-stats');
const diffBtns = document.querySelectorAll('.diff-btn');

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
      row.push(Math.random() < 0.5 ? 1 : 0);
    }
    solution.push(row);
  }
  // Ensure at least one filled cell per row and column
  for (let r = 0; r < gridSize; r++) {
    if (!solution[r].includes(1)) solution[r][Math.floor(Math.random() * gridSize)] = 1;
  }
  for (let c = 0; c < gridSize; c++) {
    const col = solution.map(row => row[c]);
    if (!col.includes(1)) solution[Math.floor(Math.random() * gridSize)][c] = 1;
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
  if (!startTime) startTimer();
  if (playerGrid[r][c] === 1) playerGrid[r][c] = 0;
  else { playerGrid[r][c] = 1; }
  render();
  checkWin();
}

function toggleMark(r, c) {
  if (!startTime) startTimer();
  if (playerGrid[r][c] === 2) playerGrid[r][c] = 0;
  else playerGrid[r][c] = 2;
  render();
}

// ===== TIMER =====
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    timerSeconds = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
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
  stopTimer();
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  modalMsg.textContent = `Voce completou o nonogram ${gridSize}x${gridSize}!`;
  modalStats.textContent = `Tempo: ${m}:${s.toString().padStart(2, '0')}`;
  modalEl.classList.remove('hidden');
  saveStats();
}

// ===== STATS =====
async function saveStats() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('game_stats').insert({
      user_id: user.id,
      game: 'nonogram',
      result: 'win',
      moves: 0,
      time_seconds: timerSeconds
    });
  } catch (e) { console.log('Stats save error:', e); }
}

// ===== INIT =====
function newGame() {
  gameOver = false;
  stopTimer();
  startTime = null;
  timerSeconds = 0;
  timerEl.textContent = '0:00';
  playerGrid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
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

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-modal-new').addEventListener('click', () => {
  modalEl.classList.add('hidden');
  newGame();
});

newGame();
