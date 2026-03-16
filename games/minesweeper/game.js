import { supabase } from '../../supabase.js';

// ===== CONFIG =====
const DIFFICULTIES = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 },
};

// ===== STATE =====
let difficulty = 'easy';
let rows, cols, totalMines;
let board = [];       // 2D array: { mine, revealed, flagged, adjacentMines }
let gameStarted = false;
let gameOver = false;
let firstClick = true;
let timerSeconds = 0;
let timerInterval = null;
let flagMode = false;
let flagCount = 0;
let revealedCount = 0;
let longPressTimer = null;

// ===== DOM =====
const boardEl = document.getElementById('board');
const mineCounterEl = document.getElementById('mine-counter');
const timerEl = document.getElementById('timer-display');
const modalEl = document.getElementById('modal');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const modalStats = document.getElementById('modal-stats');
const btnNew = document.getElementById('btn-new');
const btnModalNew = document.getElementById('btn-modal-new');
const btnFlag = document.getElementById('btn-flag');
const diffBtns = document.querySelectorAll('.diff-btn');

// ===== INIT =====
function init() {
  const config = DIFFICULTIES[difficulty];
  rows = config.rows;
  cols = config.cols;
  totalMines = config.mines;

  board = [];
  gameStarted = false;
  gameOver = false;
  firstClick = true;
  flagCount = 0;
  revealedCount = 0;
  timerSeconds = 0;
  clearInterval(timerInterval);
  timerInterval = null;

  updateMineCounter();
  timerEl.textContent = '0';
  modalEl.classList.add('hidden');

  createBoard();
  renderBoard();
}

// ===== BOARD CREATION =====
function createBoard() {
  board = [];
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = {
        mine: false,
        revealed: false,
        flagged: false,
        adjacentMines: 0,
      };
    }
  }
}

function placeMines(safeRow, safeCol) {
  // Create safe zone around first click (3x3)
  const safeSet = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeRow + dr;
      const nc = safeCol + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        safeSet.add(`${nr},${nc}`);
      }
    }
  }

  let placed = 0;
  while (placed < totalMines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (!board[r][c].mine && !safeSet.has(`${r},${c}`)) {
      board[r][c].mine = true;
      placed++;
    }
  }

  // Calculate adjacent mines
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      forEachNeighbor(r, c, (nr, nc) => {
        if (board[nr][nc].mine) count++;
      });
      board[r][c].adjacentMines = count;
    }
  }
}

function forEachNeighbor(r, c, callback) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        callback(nr, nc);
      }
    }
  }
}

// ===== RENDER =====
function renderBoard() {
  boardEl.innerHTML = '';

  // Calculate cell size based on screen
  const maxW = window.innerWidth - 16;
  const maxH = window.innerHeight - 160;
  const cellFromW = Math.floor((maxW - cols) / cols);
  const cellFromH = Math.floor((maxH - rows) / rows);
  let cellSize = Math.min(cellFromW, cellFromH, 36);
  cellSize = Math.max(cellSize, 18);

  const fontSize = Math.max(cellSize * 0.5, 10);

  boardEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  boardEl.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      const el = document.createElement('div');
      el.className = 'cell';
      el.style.width = cellSize + 'px';
      el.style.height = cellSize + 'px';
      el.style.fontSize = fontSize + 'px';
      el.dataset.row = r;
      el.dataset.col = c;

      if (cell.revealed) {
        el.classList.add('revealed');
        if (cell.mine) {
          el.textContent = '\u{1F4A3}';
          if (cell.hitMine) el.classList.add('mine-hit');
          else el.classList.add('mine-shown');
        } else if (cell.adjacentMines > 0) {
          el.textContent = cell.adjacentMines;
          el.dataset.num = cell.adjacentMines;
        }
      } else if (cell.flagged) {
        el.classList.add('flagged');
        el.textContent = '\u{1F6A9}';
        if (gameOver && !cell.mine) {
          el.classList.add('wrong-flag');
          el.textContent = '\u274C';
        }
      } else {
        el.classList.add('unrevealed');
      }

      // Events
      el.addEventListener('click', (e) => handleClick(r, c, e));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleFlag(r, c);
      });

      // Long press for mobile flag
      el.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
          toggleFlag(r, c);
          longPressTimer = null;
        }, 400);
      }, { passive: true });

      el.addEventListener('touchend', () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      });

      el.addEventListener('touchmove', () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      });

      boardEl.appendChild(el);
    }
  }
}

// ===== GAME LOGIC =====
function handleClick(r, c, e) {
  if (gameOver) return;
  const cell = board[r][c];
  if (cell.revealed) return;

  if (flagMode) {
    toggleFlag(r, c);
    return;
  }

  if (cell.flagged) return;

  if (firstClick) {
    firstClick = false;
    placeMines(r, c);
    startTimer();
  }

  if (cell.mine) {
    // Game over - loss
    cell.hitMine = true;
    revealAllMines();
    gameOver = true;
    clearInterval(timerInterval);
    renderBoard();
    showModal(false);
    saveGameStat('loss');
    return;
  }

  reveal(r, c);
  renderBoard();

  if (checkWin()) {
    gameOver = true;
    clearInterval(timerInterval);
    showModal(true);
    saveGameStat('win');
  }
}

function reveal(r, c) {
  const cell = board[r][c];
  if (cell.revealed || cell.flagged || cell.mine) return;

  cell.revealed = true;
  revealedCount++;

  // Flood fill if no adjacent mines
  if (cell.adjacentMines === 0) {
    forEachNeighbor(r, c, (nr, nc) => {
      reveal(nr, nc);
    });
  }
}

function toggleFlag(r, c) {
  if (gameOver) return;
  const cell = board[r][c];
  if (cell.revealed) return;

  if (cell.flagged) {
    cell.flagged = false;
    flagCount--;
  } else {
    cell.flagged = true;
    flagCount++;
  }

  updateMineCounter();
  renderBoard();
}

function revealAllMines() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) {
        board[r][c].revealed = true;
      }
    }
  }
}

function checkWin() {
  const totalCells = rows * cols;
  return revealedCount === totalCells - totalMines;
}

// ===== TIMER =====
function startTimer() {
  timerSeconds = 0;
  timerEl.textContent = '0';
  timerInterval = setInterval(() => {
    timerSeconds++;
    timerEl.textContent = timerSeconds;
  }, 1000);
}

// ===== UI UPDATES =====
function updateMineCounter() {
  mineCounterEl.textContent = totalMines - flagCount;
}

function showModal(won) {
  modalEl.classList.remove('hidden');
  if (won) {
    modalIcon.textContent = '\u{1F3C6}';
    modalTitle.textContent = 'Vitoria!';
    modalTitle.style.color = '#4ade80';
    modalMsg.textContent = 'Voce encontrou todas as celulas seguras!';
    modalStats.textContent = `Tempo: ${timerSeconds}s`;
  } else {
    modalIcon.textContent = '\u{1F4A5}';
    modalTitle.textContent = 'Boom!';
    modalTitle.style.color = '#e94560';
    modalMsg.textContent = 'Voce pisou em uma mina!';
    modalStats.textContent = `Tempo: ${timerSeconds}s`;
  }
}

// ===== SUPABASE =====
async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'minesweeper',
      result: result,
      moves: 0,
      time_seconds: timerSeconds,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// ===== EVENT LISTENERS =====
btnNew.addEventListener('click', init);
btnModalNew.addEventListener('click', init);

btnFlag.addEventListener('click', () => {
  flagMode = !flagMode;
  btnFlag.classList.toggle('active', flagMode);
});

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
    init();
  });
});

// Prevent context menu on board
boardEl.addEventListener('contextmenu', e => e.preventDefault());

// Resize handler
window.addEventListener('resize', () => {
  if (!gameOver || firstClick) renderBoard();
});

// ===== START =====
init();
