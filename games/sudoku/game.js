// ===== Sudoku =====
import { supabase } from '../../supabase.js';

const boardEl = document.getElementById('board');
const timerDisplay = document.getElementById('timer-display');
const diffSelect = document.getElementById('difficulty-select');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');
const modalOverlay = document.getElementById('modal-overlay');
const modalMessage = document.getElementById('modal-message');

const REMOVE_COUNT = { easy: 35, medium: 45, hard: 55 };

let solution = [];
let puzzle = [];
let userGrid = [];
let selectedCell = null;
let timerSeconds = 0;
let timerInterval = null;
let gameOver = false;

// ===== Generator =====
function generateSolution() {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillDiagonalBoxes(grid);
  solveSudoku(grid);
  return grid;
}

function fillDiagonalBoxes(grid) {
  for (let box = 0; box < 9; box += 3) {
    const nums = shuffle([1,2,3,4,5,6,7,8,9]);
    let idx = 0;
    for (let r = box; r < box + 3; r++)
      for (let c = box; c < box + 3; c++)
        grid[r][c] = nums[idx++];
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isValid(grid, row, col, num) {
  for (let c = 0; c < 9; c++) if (grid[row][c] === num) return false;
  for (let r = 0; r < 9; r++) if (grid[r][col] === num) return false;
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (grid[r][c] === num) return false;
  return true;
}

function solveSudoku(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        const nums = shuffle([1,2,3,4,5,6,7,8,9]);
        for (const n of nums) {
          if (isValid(grid, r, c, n)) {
            grid[r][c] = n;
            if (solveSudoku(grid)) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function createPuzzle(sol, removeCount) {
  const puz = sol.map(r => [...r]);
  let removed = 0;
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
  );
  for (const [r, c] of positions) {
    if (removed >= removeCount) break;
    puz[r][c] = 0;
    removed++;
  }
  return puz;
}

// ===== Timer =====
function startTimer() {
  if (timerInterval) return;
  timerSeconds = 0;
  timerInterval = setInterval(() => {
    timerSeconds++;
    timerDisplay.textContent = formatTime(timerSeconds);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

// ===== Init =====
function init() {
  stopTimer();
  gameOver = false;
  timerSeconds = 0;
  timerDisplay.textContent = '0:00';
  selectedCell = null;
  modalOverlay.classList.remove('show');

  solution = generateSolution();
  const removeCount = REMOVE_COUNT[diffSelect.value];
  puzzle = createPuzzle(solution, removeCount);
  userGrid = puzzle.map(r => [...r]);

  render();
}

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      const val = userGrid[r][c];
      if (val !== 0) cell.textContent = val;

      if (puzzle[r][c] !== 0) {
        cell.classList.add('given');
      } else {
        cell.classList.add('user');
      }

      // 3x3 borders
      if (c === 2 || c === 5) cell.classList.add('border-right');
      if (r === 2 || r === 5) cell.classList.add('border-bottom');

      // Selection highlight
      if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
        cell.classList.add('selected');
      }

      // Conflict check
      if (val !== 0 && puzzle[r][c] === 0 && val !== solution[r][c]) {
        cell.classList.add('conflict');
      }

      cell.addEventListener('click', () => selectCell(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function selectCell(r, c) {
  if (gameOver) return;
  if (puzzle[r][c] !== 0) return; // can't select given cells
  selectedCell = [r, c];
  if (!timerInterval) startTimer();
  render();
}

function placeNumber(num) {
  if (!selectedCell || gameOver) return;
  const [r, c] = selectedCell;
  if (puzzle[r][c] !== 0) return;

  userGrid[r][c] = num;
  render();

  // Check win
  if (checkComplete()) {
    gameOver = true;
    stopTimer();
    setTimeout(() => {
      modalMessage.textContent = `Tempo: ${formatTime(timerSeconds)}`;
      modalOverlay.classList.add('show');
      saveGameStat('win');
    }, 300);
  }
}

function checkComplete() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (userGrid[r][c] !== solution[r][c]) return false;
  return true;
}

// Numpad
document.querySelectorAll('.num-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    placeNumber(parseInt(btn.dataset.num));
  });
});

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '9') placeNumber(parseInt(e.key));
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') placeNumber(0);
  if (e.key === 'ArrowUp' && selectedCell) selectCell(Math.max(0, selectedCell[0] - 1), selectedCell[1]);
  if (e.key === 'ArrowDown' && selectedCell) selectCell(Math.min(8, selectedCell[0] + 1), selectedCell[1]);
  if (e.key === 'ArrowLeft' && selectedCell) selectCell(selectedCell[0], Math.max(0, selectedCell[1] - 1));
  if (e.key === 'ArrowRight' && selectedCell) selectCell(selectedCell[0], Math.min(8, selectedCell[1] + 1));
});

btnNewGame.addEventListener('click', init);
btnPlayAgain.addEventListener('click', init);
diffSelect.addEventListener('change', init);

async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'sudoku',
      result: result,
      moves: 0,
      time_seconds: timerSeconds,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

init();
