// =============================================
//  COBRINHA (Snake) — game.js
// =============================================
import { supabase } from '../../supabase.js';

// ---- Config ----
const GRID_SIZE  = 20; // cells
const BASE_SPEED = 150; // ms per tick (decreases as score grows)
const MIN_SPEED  = 60;

// ---- DOM ----
const canvas      = document.getElementById('game-canvas');
const ctx         = canvas.getContext('2d');
const overlay     = document.getElementById('overlay');
const overlayIcon = document.getElementById('overlay-icon');
const overlayTitle= document.getElementById('overlay-title');
const overlayMsg  = document.getElementById('overlay-msg');
const overlayScore= document.getElementById('overlay-score');
const btnStart    = document.getElementById('btn-start');
const scoreDisplay= document.getElementById('score-display');
const bestDisplay = document.getElementById('best-display');

// ---- State ----
let snake     = [];
let food      = null;
let direction = { x: 1, y: 0 };
let nextDir   = { x: 1, y: 0 };
let score     = 0;
let bestScore = parseInt(localStorage.getItem('snake_best') || '0');
let gameLoop  = null;
let running   = false;
let cellSize  = 0;

bestDisplay.textContent = bestScore;

// =============================================
//  CANVAS SIZING
// =============================================
function resizeCanvas() {
  const container = canvas.parentElement;
  const maxW = container.clientWidth - 16;
  const maxH = container.clientHeight - 16;
  const maxCell = Math.floor(Math.min(maxW, maxH) / GRID_SIZE);
  cellSize = Math.max(maxCell, 10);
  const size = cellSize * GRID_SIZE;
  canvas.width  = size;
  canvas.height = size;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';
  draw();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// =============================================
//  GAME LOGIC
// =============================================
function initGame() {
  const mid = Math.floor(GRID_SIZE / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  direction = { x: 1, y: 0 };
  nextDir   = { x: 1, y: 0 };
  score     = 0;
  scoreDisplay.textContent = 0;
  spawnFood();
}

function spawnFood() {
  const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (occupied.has(`${pos.x},${pos.y}`));
  food = pos;
}

function tick() {
  direction = { ...nextDir };
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  // Wall collision
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    gameOver();
    return;
  }

  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  // Eat food
  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreDisplay.textContent = score;
    spawnFood();
  } else {
    snake.pop();
  }

  draw();
}

function getSpeed() {
  return Math.max(MIN_SPEED, BASE_SPEED - score * 3);
}

function startGame() {
  initGame();
  overlay.classList.add('hidden');
  running = true;
  scheduleNext();
}

function scheduleNext() {
  if (!running) return;
  gameLoop = setTimeout(() => {
    tick();
    scheduleNext();
  }, getSpeed());
}

function gameOver() {
  running = false;
  clearTimeout(gameLoop);

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('snake_best', String(bestScore));
    bestDisplay.textContent = bestScore;
  }

  saveGameStat();

  overlayIcon.textContent  = '💀';
  overlayTitle.textContent = 'Game Over!';
  overlayMsg.textContent   = '';
  overlayScore.textContent = `Pontuação: ${score} 🍎`;
  btnStart.textContent     = 'Jogar Novamente';
  overlay.classList.remove('hidden');
}

// =============================================
//  DRAW
// =============================================
function draw() {
  const cs = cellSize;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cs, 0); ctx.lineTo(i * cs, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cs); ctx.lineTo(canvas.width, i * cs);
    ctx.stroke();
  }

  // Food
  if (food) {
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.arc(food.x * cs + cs / 2, food.y * cs + cs / 2, cs * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Apple shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(food.x * cs + cs * 0.38, food.y * cs + cs * 0.35, cs * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Snake
  snake.forEach((seg, i) => {
    const isHead = i === 0;
    const radius = cs * 0.42;

    if (isHead) {
      // Head gradient
      const grd = ctx.createRadialGradient(
        seg.x * cs + cs / 2, seg.y * cs + cs / 2, 0,
        seg.x * cs + cs / 2, seg.y * cs + cs / 2, radius
      );
      grd.addColorStop(0, '#53d769');
      grd.addColorStop(1, '#3ba851');
      ctx.fillStyle = grd;
    } else {
      const fade = 1 - (i / snake.length) * 0.4;
      ctx.fillStyle = `rgba(83, 215, 105, ${fade})`;
    }

    // Rounded rectangle for each segment
    const x = seg.x * cs + (cs - radius * 2) / 2;
    const y = seg.y * cs + (cs - radius * 2) / 2;
    const w = radius * 2;
    const r = cs * 0.15;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + w - r);
    ctx.quadraticCurveTo(x + w, y + w, x + w - r, y + w);
    ctx.lineTo(x + r, y + w);
    ctx.quadraticCurveTo(x, y + w, x, y + w - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();

    // Eyes on head
    if (isHead) {
      ctx.fillStyle = '#fff';
      const eyeR = cs * 0.08;
      const eyeOff = cs * 0.15;
      let ex1, ey1, ex2, ey2;
      if (direction.x === 1)       { ex1 = cs*0.65; ey1 = cs*0.3;  ex2 = cs*0.65; ey2 = cs*0.7; }
      else if (direction.x === -1) { ex1 = cs*0.35; ey1 = cs*0.3;  ex2 = cs*0.35; ey2 = cs*0.7; }
      else if (direction.y === -1) { ex1 = cs*0.3;  ey1 = cs*0.35; ex2 = cs*0.7;  ey2 = cs*0.35; }
      else                         { ex1 = cs*0.3;  ey1 = cs*0.65; ex2 = cs*0.7;  ey2 = cs*0.65; }
      ctx.beginPath();
      ctx.arc(seg.x * cs + ex1, seg.y * cs + ey1, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(seg.x * cs + ex2, seg.y * cs + ey2, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// =============================================
//  CONTROLS — Keyboard
// =============================================
document.addEventListener('keydown', e => {
  if (!running) {
    if (e.key === 'Enter' || e.key === ' ') { startGame(); e.preventDefault(); }
    return;
  }
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': if (direction.y !== 1)  nextDir = { x: 0, y:-1 }; break;
    case 'ArrowDown':  case 's': case 'S': if (direction.y !== -1) nextDir = { x: 0, y: 1 }; break;
    case 'ArrowLeft':  case 'a': case 'A': if (direction.x !== 1)  nextDir = { x:-1, y: 0 }; break;
    case 'ArrowRight': case 'd': case 'D': if (direction.x !== -1) nextDir = { x: 1, y: 0 }; break;
  }
  e.preventDefault();
});

// =============================================
//  CONTROLS — Touch swipe
// =============================================
let touchStart = null;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: false });

canvas.addEventListener('touchmove', e => { e.preventDefault(); }, { passive: false });

canvas.addEventListener('touchend', e => {
  if (!touchStart || !running) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return; // tap, not swipe

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && direction.x !== -1) nextDir = { x: 1, y: 0 };
    else if (dx < 0 && direction.x !== 1) nextDir = { x: -1, y: 0 };
  } else {
    if (dy > 0 && direction.y !== -1) nextDir = { x: 0, y: 1 };
    else if (dy < 0 && direction.y !== 1) nextDir = { x: 0, y: -1 };
  }
}, { passive: false });

// =============================================
//  CONTROLS — Mobile buttons
// =============================================
document.querySelectorAll('.ctrl-btn').forEach(btn => {
  const handler = () => {
    if (!running) return;
    const dir = btn.dataset.dir;
    switch (dir) {
      case 'up':    if (direction.y !== 1)  nextDir = { x: 0, y:-1 }; break;
      case 'down':  if (direction.y !== -1) nextDir = { x: 0, y: 1 }; break;
      case 'left':  if (direction.x !== 1)  nextDir = { x:-1, y: 0 }; break;
      case 'right': if (direction.x !== -1) nextDir = { x: 1, y: 0 }; break;
    }
  };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', e => { e.preventDefault(); handler(); }, { passive: false });
});

// =============================================
//  START BUTTON
// =============================================
btnStart.addEventListener('click', startGame);

// =============================================
//  STATS — Supabase
// =============================================
async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'snake',
      result: 'loss', // snake always ends in loss
      moves: score,
      time_seconds: 0,
      score: score,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// =============================================
//  INIT
// =============================================
initGame();
draw();
