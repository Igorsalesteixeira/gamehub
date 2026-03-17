// ===== 2048 =====
import { supabase } from '../../supabase.js';

const SIZE = 4;
const boardEl = document.getElementById('board');
const scoreDisplay = document.getElementById('score-display');
const scoreMain = document.getElementById('score-main');
const bestScoreEl = document.getElementById('best-score');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');

let grid = [];
let score = 0;
let bestScore = parseInt(localStorage.getItem('2048_best') || '0');
let gameOver = false;
let won = false;

function init() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  score = 0;
  gameOver = false;
  won = false;
  updateScore();
  bestScoreEl.textContent = bestScore;
  modalOverlay.classList.remove('show');
  addRandomTile();
  addRandomTile();
  render();
}

function addRandomTile() {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === 0) empty.push([r, c]);
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return [r, c];
}

function render(newTile, mergedCells) {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const val = grid[r][c];
      if (val > 0) {
        cell.textContent = val;
        cell.dataset.value = val;
        if (newTile && newTile[0] === r && newTile[1] === c) cell.classList.add('new');
        if (mergedCells && mergedCells.some(m => m[0] === r && m[1] === c)) cell.classList.add('merged');
      }
      boardEl.appendChild(cell);
    }
  }
}

function updateScore() {
  scoreDisplay.textContent = score;
  scoreMain.textContent = score;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('2048_best', bestScore);
    bestScoreEl.textContent = bestScore;
  }
}

function slide(row) {
  let arr = row.filter(v => v !== 0);
  const merged = [];
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      score += arr[i];
      arr[i + 1] = 0;
      merged.push(arr[i]);
      if (arr[i] === 2048 && !won) won = true;
    }
  }
  arr = arr.filter(v => v !== 0);
  while (arr.length < SIZE) arr.push(0);
  return { result: arr, merged };
}

function move(direction) {
  if (gameOver) return;
  const prev = JSON.stringify(grid);
  const mergedCells = [];

  if (direction === 'left') {
    for (let r = 0; r < SIZE; r++) {
      const { result, merged } = slide(grid[r]);
      grid[r] = result;
    }
  } else if (direction === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const { result } = slide([...grid[r]].reverse());
      grid[r] = result.reverse();
    }
  } else if (direction === 'up') {
    for (let c = 0; c < SIZE; c++) {
      const col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]];
      const { result } = slide(col);
      for (let r = 0; r < SIZE; r++) grid[r][c] = result[r];
    }
  } else if (direction === 'down') {
    for (let c = 0; c < SIZE; c++) {
      const col = [grid[3][c], grid[2][c], grid[1][c], grid[0][c]];
      const { result } = slide(col);
      const rev = result.reverse();
      for (let r = 0; r < SIZE; r++) grid[r][c] = rev[r];
    }
  }

  if (JSON.stringify(grid) !== prev) {
    const newTile = addRandomTile();
    updateScore();
    render(newTile, mergedCells);

    if (!canMove()) {
      gameOver = true;
      setTimeout(() => {
        modalTitle.textContent = won ? 'Parabens! 🎉' : 'Fim de Jogo!';
        modalMessage.textContent = `Pontuacao: ${score}`;
        modalOverlay.classList.add('show');
        saveGameStat();
      }, 300);
    }
  }
}

function canMove() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
    }
  return false;
}

// Keyboard
document.addEventListener('keydown', (e) => {
  const map = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
    A: 'left', D: 'right', W: 'up', S: 'down',
  };
  if (map[e.key]) {
    e.preventDefault();
    move(map[e.key]);
  }
});

// Touch/Swipe
let touchStartX = 0, touchStartY = 0;
document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (Math.max(absDx, absDy) < 30) return;

  if (absDx > absDy) {
    move(dx > 0 ? 'right' : 'left');
  } else {
    move(dy > 0 ? 'down' : 'up');
  }
});

btnNewGame.addEventListener('click', init);
btnPlayAgain.addEventListener('click', init);

async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'game2048',
      result: 'end',
      moves: score,
      time_seconds: 0,
      score: score,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

init();
