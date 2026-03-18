import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic, initAudio } from '../shared/game-design-utils.js';
// ===== Tetris =====
import { supabase } from '../../supabase.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');
const linesDisplay = document.getElementById('lines-display');
const modalOverlay = document.getElementById('modal-overlay');
const modalMessage = document.getElementById('modal-message');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');

const COLS = 10, ROWS = 20, BLOCK = 24;
canvas.width = COLS * BLOCK;
canvas.height = ROWS * BLOCK;
nextCanvas.width = 4 * 20;
nextCanvas.height = 4 * 20;

const COLORS = ['#00f0f0','#0000f0','#f0a000','#f0f000','#00f000','#a000f0','#f00000'];

const SHAPES = [
  [[1,1,1,1]],                   // I
  [[1,0,0],[1,1,1]],             // J
  [[0,0,1],[1,1,1]],             // L
  [[1,1],[1,1]],                 // O
  [[0,1,1],[1,1,0]],             // S
  [[0,1,0],[1,1,1]],             // T
  [[1,1,0],[0,1,1]],             // Z
];

let board, current, next, score, level, lines, dropInterval, dropTimer, gameOver, paused, animId;

function createPiece(shapeIdx) {
  const shape = SHAPES[shapeIdx];
  return {
    shape: shape.map(r => [...r]),
    color: COLORS[shapeIdx],
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
    idx: shapeIdx,
  };
}

function randomPiece() {
  return createPiece(Math.floor(Math.random() * SHAPES.length));
}

function init() {
  initAudio();
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  score = 0; level = 1; lines = 0;
  dropInterval = 1000; dropTimer = 0;
  gameOver = false;
  paused = false;
  modalOverlay.classList.remove('show');
  current = randomPiece();
  next = randomPiece();
  updateUI();
  if (animId) cancelAnimationFrame(animId);
  let lastTime = 0;
  function loop(time) {
    const dt = time - lastTime;
    lastTime = time;
    if (!gameOver) {
      if (!paused) {
        dropTimer += dt;
        if (dropTimer >= dropInterval) {
          dropTimer = 0;
          moveDown();
        }
      }
      draw();
      animId = requestAnimationFrame(loop);
    }
  }
  animId = requestAnimationFrame(loop);
}

function draw() {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
    }
  }

  // Board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) drawBlock(ctx, c, r, board[r][c], BLOCK);

  // Ghost piece (silhueta de destino)
  if (current) {
    const ghostY = getGhostY();
    if (ghostY !== current.y) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawBlock(ctx, current.x + c, ghostY + r, current.color, BLOCK);
      ctx.restore();
    }
  }

  // Current piece
  if (current) {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, current.y + r, current.color, BLOCK);
  }

  // Next piece
  nextCtx.fillStyle = '#1a1a2e';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (next) {
    const ox = Math.floor((4 - next.shape[0].length) / 2);
    const oy = Math.floor((4 - next.shape.length) / 2);
    for (let r = 0; r < next.shape.length; r++)
      for (let c = 0; c < next.shape[r].length; c++)
        if (next.shape[r][c])
          drawBlock(nextCtx, ox + c, oy + r, next.color, 20);
  }

  // Pausa overlay
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Nunito';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSADO', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '14px Nunito';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Pressione P para continuar', canvas.width / 2, canvas.height / 2 + 20);
    ctx.textAlign = 'left';
  }
}

function drawBlock(context, x, y, color, size) {
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.15)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 3);
}

function getGhostY() {
  let ghostY = current.y;
  while (!collides({ ...current, y: ghostY + 1 }, 0, 0)) ghostY++;
  return ghostY;
}

function collides(piece, dx, dy, shape) {
  shape = shape || piece.shape;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        const nx = piece.x + c + dx;
        const ny = piece.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
  return false;
}

function lock() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c]) {
        const y = current.y + r;
        if (y < 0) { endGame(); return; }
        board[y][current.x + c] = current.color;
      }
  playSound('lock');
  clearLines();
  current = next;
  next = randomPiece();
  if (collides(current, 0, 0)) endGame();
}

function clearLines() {
  let cleared = 0;
  const clearedRows = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell !== null)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      clearedRows.push(r);
      cleared++;
      r++;
    }
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    const linePoints = (points[cleared] || 800) * level;
    score += linePoints;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 80);
    updateUI();
    playSound('clear');
    // Mobile: feedback tátil ao limpar linhas (mais intenso = mais linhas)
    if (navigator.vibrate) {
      const pattern = cleared === 4 ? [30, 20, 40, 20, 50] : cleared === 3 ? [25, 15, 35] : [20, 10, 25];
      navigator.vibrate(pattern);
    }
  }
}

function moveDown() {
  if (!collides(current, 0, 1)) {
    current.y++;
  } else {
    lock();
  }
}

function moveLeft() { if (!collides(current, -1, 0)) { current.x--; playSound('move'); haptic(15); } }
function moveRight() { if (!collides(current, 1, 0)) { current.x++; playSound('move'); haptic(15); } }

function rotate() {
  const shape = current.shape;
  const rotated = shape[0].map((_, c) => shape.map(row => row[c]).reverse());
  if (!collides(current, 0, 0, rotated)) {
    current.shape = rotated;
    playSound('rotate');
    haptic(15);
  } else if (!collides(current, -1, 0, rotated)) {
    current.x--;
    current.shape = rotated;
    playSound('rotate');
    haptic(15);
  } else if (!collides(current, 1, 0, rotated)) {
    current.x++;
    current.shape = rotated;
    playSound('rotate');
    haptic(15);
  }
}

function hardDrop() {
  while (!collides(current, 0, 1)) current.y++;
  playSound('move');
  haptic(15);
  lock();
}

function endGame() {
  gameOver = true;
  draw();
  modalMessage.textContent = `Pontuacao: ${score}`;
  modalOverlay.classList.add('show');
  saveGameStat();
  // Mobile: feedback tátil no game over
  if (navigator.vibrate) navigator.vibrate([60, 30, 100]);
  playSound('gameover');
}

function updateUI() {
  scoreDisplay.textContent = score;
  levelDisplay.textContent = level;
  linesDisplay.textContent = lines;
}

// Keyboard
document.addEventListener('keydown', (e) => {
  if (gameOver) return;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (!gameOver) { paused = !paused; e.preventDefault(); return; }
  }
  if (paused) return;
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); moveLeft(); break;
    case 'ArrowRight': case 'd': case 'D': e.preventDefault(); moveRight(); break;
    case 'ArrowDown': case 's': case 'S': e.preventDefault(); moveDown(); break;
    case 'ArrowUp': case 'w': case 'W': e.preventDefault(); rotate(); break;
    case ' ': e.preventDefault(); hardDrop(); break;
  }
});

// Mobile controls (with haptic feedback)
function setupMobileButton(btnId, action) {
  const btn = document.getElementById(btnId);
  const handler = () => {
    if (!gameOver && !paused) {
      action();
      // Mobile: feedback tátil nos botões
      if (navigator.vibrate) navigator.vibrate(12);
    }
  };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', e => { e.preventDefault(); handler(); }, { passive: false });
}

setupMobileButton('btn-left', moveLeft);
setupMobileButton('btn-right', moveRight);
setupMobileButton('btn-down', hardDrop);
setupMobileButton('btn-rotate', rotate);

btnNewGame.addEventListener('click', init);
btnPlayAgain.addEventListener('click', init);

async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id, game: 'tetris',
      result: 'end', moves: score, time_seconds: 0,
      score: score,
    });
  } catch (e) { console.warn('Erro ao salvar stats:', e); }
}

init();
