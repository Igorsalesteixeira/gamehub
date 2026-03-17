// =============================================
//  BREAKOUT — game.js
// =============================================
import { supabase } from '../../supabase.js';

// ---- DOM ----
const canvas       = document.getElementById('game-canvas');
const ctx          = canvas.getContext('2d');
const overlay      = document.getElementById('overlay');
const overlayIcon  = document.getElementById('overlay-icon');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg   = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const btnStart     = document.getElementById('btn-start');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');
const levelDisplay = document.getElementById('level-display');

// ---- Config ----
const BRICK_ROWS    = 6;
const BRICK_COLS    = 10;
const BRICK_PAD     = 4;
const BRICK_HEIGHT  = 18;
const PADDLE_HEIGHT = 14;
const BALL_RADIUS   = 6;
const BRICK_COLORS  = ['#e94560','#ff6b6b','#ffa502','#ffd32a','#0be881','#18dcff'];

// ---- State ----
let W, H;
let paddleW, paddleX, paddleSpeed;
let ballX, ballY, ballDX, ballDY, ballSpeed;
let bricks = [];
let score = 0;
let lives = 3;
let level = 1;
let running = false;
let animFrame = null;
let bestScore = parseInt(localStorage.getItem('breakout_best') || '0');
let keysDown = {};
let startTime = 0;

// ---- Power-ups ----
let powerUps = [];
const POWERUP_TYPES = ['wide', 'multi', 'life'];
const POWERUP_COLORS = { wide: '#0be881', multi: '#18dcff', life: '#ff6b6b' };
let extraBalls = [];
let wideTimer = 0;

// =============================================
//  CANVAS SIZING
// =============================================
function resizeCanvas() {
  const container = canvas.parentElement;
  const maxW = container.clientWidth - 16;
  const maxH = container.clientHeight - 16;
  W = Math.min(maxW, 600);
  H = Math.min(maxH, Math.floor(W * 1.2));
  if (H > maxH) { H = maxH; W = Math.min(maxW, Math.floor(H / 1.2)); }
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  paddleW = Math.max(W * 0.15, 60);
  paddleSpeed = W * 0.012;
}

window.addEventListener('resize', () => { resizeCanvas(); });
resizeCanvas();

// =============================================
//  BRICK SETUP
// =============================================
function createBricks() {
  bricks = [];
  const brickW = (W - BRICK_PAD * (BRICK_COLS + 1)) / BRICK_COLS;
  const rows = BRICK_ROWS + Math.floor(level / 2);
  for (let r = 0; r < rows && r < 10; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: BRICK_PAD + c * (brickW + BRICK_PAD),
        y: 40 + r * (BRICK_HEIGHT + BRICK_PAD),
        w: brickW,
        h: BRICK_HEIGHT,
        color: BRICK_COLORS[r % BRICK_COLORS.length],
        points: (BRICK_ROWS - (r % BRICK_ROWS)) * 10,
        alive: true,
        hits: r < 2 && level > 2 ? 2 : 1, // top rows need 2 hits at level 3+
      });
    }
  }
}

// =============================================
//  INIT
// =============================================
function initGame() {
  score = 0;
  lives = 3;
  level = 1;
  scoreDisplay.textContent = 0;
  livesDisplay.textContent = 3;
  levelDisplay.textContent = 1;
  powerUps = [];
  extraBalls = [];
  wideTimer = 0;
  resetBall();
  createBricks();
}

function resetBall() {
  paddleX = W / 2 - paddleW / 2;
  ballSpeed = 3 + level * 0.5;
  ballX = W / 2;
  ballY = H - 50;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
  ballDX = Math.cos(angle) * ballSpeed;
  ballDY = Math.sin(angle) * ballSpeed;
  extraBalls = [];
}

function nextLevel() {
  level++;
  levelDisplay.textContent = level;
  powerUps = [];
  extraBalls = [];
  wideTimer = 0;
  resetBall();
  createBricks();
}

// =============================================
//  GAME LOOP
// =============================================
function update() {
  if (!running) return;

  // Paddle movement via keyboard
  if (keysDown['ArrowLeft'] || keysDown['a']) paddleX -= paddleSpeed;
  if (keysDown['ArrowRight'] || keysDown['d']) paddleX += paddleSpeed;
  const pw = wideTimer > 0 ? paddleW * 1.5 : paddleW;
  paddleX = Math.max(0, Math.min(W - pw, paddleX));

  if (wideTimer > 0) wideTimer--;

  // Update all balls
  const allBalls = [{ x: ballX, y: ballY, dx: ballDX, dy: ballDY, main: true }, ...extraBalls];

  for (let b of allBalls) {
    b.x += b.dx;
    b.y += b.dy;

    // Wall bounces
    if (b.x - BALL_RADIUS <= 0) { b.x = BALL_RADIUS; b.dx = Math.abs(b.dx); }
    if (b.x + BALL_RADIUS >= W) { b.x = W - BALL_RADIUS; b.dx = -Math.abs(b.dx); }
    if (b.y - BALL_RADIUS <= 0) { b.y = BALL_RADIUS; b.dy = Math.abs(b.dy); }

    // Paddle collision
    if (b.dy > 0 && b.y + BALL_RADIUS >= H - 30 - PADDLE_HEIGHT &&
        b.y + BALL_RADIUS <= H - 30 &&
        b.x >= paddleX && b.x <= paddleX + pw) {
      const hit = (b.x - paddleX) / pw;
      const angle = -Math.PI * (0.15 + hit * 0.7);
      const spd = Math.sqrt(b.dx * b.dx + b.dy * b.dy);
      b.dx = Math.cos(angle) * spd;
      b.dy = Math.sin(angle) * spd;
      b.y = H - 30 - PADDLE_HEIGHT - BALL_RADIUS;
    }

    // Brick collision
    for (let brick of bricks) {
      if (!brick.alive) continue;
      if (b.x + BALL_RADIUS > brick.x && b.x - BALL_RADIUS < brick.x + brick.w &&
          b.y + BALL_RADIUS > brick.y && b.y - BALL_RADIUS < brick.y + brick.h) {
        brick.hits--;
        if (brick.hits <= 0) {
          brick.alive = false;
          score += brick.points;
          scoreDisplay.textContent = score;
          // chance to spawn power-up
          if (Math.random() < 0.15) {
            const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
            powerUps.push({ x: brick.x + brick.w / 2, y: brick.y, type, dy: 2 });
          }
        }
        // Bounce ball
        const overlapX = Math.min(b.x + BALL_RADIUS - brick.x, brick.x + brick.w - (b.x - BALL_RADIUS));
        const overlapY = Math.min(b.y + BALL_RADIUS - brick.y, brick.y + brick.h - (b.y - BALL_RADIUS));
        if (overlapX < overlapY) b.dx = -b.dx;
        else b.dy = -b.dy;
        break;
      }
    }

    // Ball lost
    if (b.y - BALL_RADIUS > H) {
      if (b.main) {
        b.lost = true;
      } else {
        b.lost = true;
      }
    }
  }

  // Update main ball
  if (allBalls[0].lost) {
    lives--;
    livesDisplay.textContent = lives;
    if (lives <= 0) {
      gameOver();
      return;
    }
    resetBall();
  } else {
    ballX = allBalls[0].x;
    ballY = allBalls[0].y;
    ballDX = allBalls[0].dx;
    ballDY = allBalls[0].dy;
  }

  // Update extra balls
  extraBalls = allBalls.slice(1).filter(b => !b.lost);
  for (let b of extraBalls) {
    // already updated in the loop above
  }

  // Power-ups fall
  for (let p of powerUps) {
    p.y += p.dy;
    if (p.y >= H - 30 - PADDLE_HEIGHT && p.y <= H - 30 && p.x >= paddleX && p.x <= paddleX + pw) {
      applyPowerUp(p.type);
      p.collected = true;
    }
    if (p.y > H) p.collected = true;
  }
  powerUps = powerUps.filter(p => !p.collected);

  // Check level clear
  if (bricks.every(b => !b.alive)) {
    nextLevel();
  }

  draw();
  animFrame = requestAnimationFrame(update);
}

function applyPowerUp(type) {
  if (type === 'wide') {
    wideTimer = 600; // 10 seconds at 60fps
  } else if (type === 'multi') {
    // Add 2 extra balls
    for (let i = 0; i < 2; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      extraBalls.push({
        x: ballX, y: ballY,
        dx: Math.cos(angle) * ballSpeed,
        dy: Math.sin(angle) * ballSpeed,
        main: false
      });
    }
  } else if (type === 'life') {
    lives++;
    livesDisplay.textContent = lives;
  }
}

// =============================================
//  DRAW
// =============================================
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Bricks
  for (let brick of bricks) {
    if (!brick.alive) continue;
    ctx.fillStyle = brick.color;
    if (brick.hits > 1) ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 4);
    ctx.fill();
    if (brick.hits > 1) {
      ctx.fillStyle = brick.color;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Paddle
  const pw = wideTimer > 0 ? paddleW * 1.5 : paddleW;
  const grad = ctx.createLinearGradient(paddleX, 0, paddleX + pw, 0);
  grad.addColorStop(0, '#e94560');
  grad.addColorStop(1, '#ff6b6b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(paddleX, H - 30 - PADDLE_HEIGHT, pw, PADDLE_HEIGHT, 7);
  ctx.fill();

  // Ball
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Extra balls
  ctx.fillStyle = '#18dcff';
  for (let b of extraBalls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Power-ups
  for (let p of powerUps) {
    ctx.fillStyle = POWERUP_COLORS[p.type];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 10px Nunito';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = p.type === 'wide' ? 'W' : p.type === 'multi' ? 'M' : '+';
    ctx.fillText(label, p.x, p.y);
  }
}

// =============================================
//  CONTROLS
// =============================================
document.addEventListener('keydown', e => {
  keysDown[e.key] = true;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', e => { keysDown[e.key] = false; });

// Mouse
canvas.addEventListener('mousemove', e => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const pw = wideTimer > 0 ? paddleW * 1.5 : paddleW;
  paddleX = (e.clientX - rect.left) * (W / rect.width) - pw / 2;
  paddleX = Math.max(0, Math.min(W - pw, paddleX));
});

// Touch on canvas
canvas.addEventListener('touchmove', e => {
  if (!running) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const pw = wideTimer > 0 ? paddleW * 1.5 : paddleW;
  paddleX = (e.touches[0].clientX - rect.left) * (W / rect.width) - pw / 2;
  paddleX = Math.max(0, Math.min(W - pw, paddleX));
}, { passive: false });

// Mobile buttons
document.querySelectorAll('.ctrl-btn').forEach(btn => {
  let interval;
  const dir = btn.dataset.dir;
  const move = () => {
    const pw = wideTimer > 0 ? paddleW * 1.5 : paddleW;
    if (dir === 'left') paddleX -= paddleSpeed * 2;
    if (dir === 'right') paddleX += paddleSpeed * 2;
    paddleX = Math.max(0, Math.min(W - pw, paddleX));
  };
  btn.addEventListener('touchstart', e => { e.preventDefault(); move(); interval = setInterval(move, 30); });
  btn.addEventListener('touchend', () => clearInterval(interval));
  btn.addEventListener('mousedown', () => { move(); interval = setInterval(move, 30); });
  btn.addEventListener('mouseup', () => clearInterval(interval));
  btn.addEventListener('mouseleave', () => clearInterval(interval));
});

// =============================================
//  GAME FLOW
// =============================================
function startGame() {
  initGame();
  overlay.classList.add('hidden');
  running = true;
  startTime = Date.now();
  animFrame = requestAnimationFrame(update);
}

function gameOver() {
  running = false;
  cancelAnimationFrame(animFrame);

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('breakout_best', String(bestScore));
  }

  saveGameStat();

  overlayIcon.textContent  = '💥';
  overlayTitle.textContent = 'Game Over!';
  overlayMsg.textContent   = `Nivel alcancado: ${level}`;
  overlayScore.textContent = `Pontuacao: ${score}`;
  btnStart.textContent     = 'Jogar Novamente';
  overlay.classList.remove('hidden');
}

btnStart.addEventListener('click', startGame);

async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'breakout',
      result: 'end',
      moves: score,
      time_seconds: elapsed,
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
