import '../../auth-check.js';
// ===== 2048 =====
import { supabase } from '../../supabase.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp } from '../shared/game-design-utils.js';

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
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      score += arr[i];
      if (arr[i] === 2048 && !won) won = true;
      arr[i + 1] = 0;
      i++; // pula o próximo (já consumido)
    }
  }
  arr = arr.filter(v => v !== 0);
  while (arr.length < SIZE) arr.push(0);
  return arr;
}

function move(direction) {
  if (gameOver) return;
  const prevGrid = grid.map(r => [...r]);
  const prev = JSON.stringify(prevGrid);
  const mergedCells = [];

  if (direction === 'left') {
    for (let r = 0; r < SIZE; r++) grid[r] = slide(grid[r]);
  } else if (direction === 'right') {
    for (let r = 0; r < SIZE; r++) grid[r] = slide([...grid[r]].reverse()).reverse();
  } else if (direction === 'up') {
    for (let c = 0; c < SIZE; c++) {
      const result = slide([grid[0][c], grid[1][c], grid[2][c], grid[3][c]]);
      for (let r = 0; r < SIZE; r++) grid[r][c] = result[r];
    }
  } else if (direction === 'down') {
    for (let c = 0; c < SIZE; c++) {
      const result = slide([grid[3][c], grid[2][c], grid[1][c], grid[0][c]]).reverse();
      for (let r = 0; r < SIZE; r++) grid[r][c] = result[r];
    }
  }

  // Detectar células que dobraram (merged): valor novo é o dobro do valor anterior
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== 0 && grid[r][c] !== prevGrid[r][c] && grid[r][c] === prevGrid[r][c] * 2) {
        mergedCells.push([r, c]);
      }
    }
  }

  if (JSON.stringify(grid) !== prev) {
    const newTile = addRandomTile();
    updateScore();
    render(newTile, mergedCells);

    // Game Design: som ao combinar (mais grave) e ao mover
    if (mergedCells.length > 0) {
      playSound('place'); // som mais grave para merge
    } else {
      playSound('move'); // som ao deslizar
    }

    // Game Design: confetes ao atingir 2048
    if (won && !gameOver) {
      launchConfetti();
      playSound('win');
    }

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

// Touch/Swipe - Mobile optimized
let touchStartX = 0, touchStartY = 0;
let touchStartTime = 0;

// Limitar touch ao board (não document inteiro)
boardEl.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
  initAudio();
}, { passive: true });

boardEl.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const dt = Date.now() - touchStartTime;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Mobile: threshold aumentado para 30px, max 500ms para swipe rápido
  if (Math.max(absDx, absDy) < 30 || dt > 500) return;

  // Prevenir scroll durante swipe
  e.preventDefault();

  if (absDx > absDy) {
    move(dx > 0 ? 'right' : 'left');
  } else {
    move(dy > 0 ? 'down' : 'up');
  }

  // Mobile: feedback tátil (vibration) se disponível
  if (navigator.vibrate) {
    navigator.vibrate(15); // 15ms leve
  }
}, { passive: false });

btnNewGame.addEventListener('click', init);
btnPlayAgain.addEventListener('click', init);

// Game Design: botão compartilhar
document.getElementById('btn-share')?.addEventListener('click', () => {
  shareOnWhatsApp(`🔢 Joguei 2048 no Games Hub e fiz ${score} pontos!\n\n🏆 Meu recorde: ${bestScore}\n\n🎮 Jogue você também: https://gameshub.com.br/games/game2048/`);
});

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
