import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic, initAudio } from '../shared/game-design-utils.js';
import { GameStats, BestScoreManager } from '../shared/game-core.js';
import { GameLoop } from '../shared/game-loop.js';
import { InputManager, MobileButtonHandler } from '../shared/input-manager.js';
// =============================================
//  BREAKOUT — game.js (Refatorado com módulos compartilhados)
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
const BALL_RADIUS   = 7;
const BRICK_COLORS  = ['#ff6b6b','#ffa502','#ffd32a','#0be881','#18dcff','#a55eea'];

// ---- Stats e Best Score ----
const stats = new GameStats('breakout');
const bestScoreManager = new BestScoreManager('breakout');

// ---- State ----
let W, H;
let paddleW, paddleX, paddleSpeed;
let ballX, ballY, ballDX, ballDY, ballSpeed;
let bricks = [];
let score = 0;
let lives = 3;
let level = 1;
let running = false;
let wideTimer = 0;

// ---- Power-ups ----
let powerUps = [];
const POWERUP_TYPES = ['wide', 'multi', 'life'];
const POWERUP_COLORS = { wide: '#0be881', multi: '#a55eea', life: '#ff6b6b' };
let extraBalls = [];

// ---- Game Loop ----
const gameLoop = new GameLoop({
  onUpdate: () => {
    if (!running) return;
    update();
  },
  onRender: () => {
    draw();
  }
});

// ---- Input Manager ----
const inputManager = new InputManager({
  keyboardTarget: document,
  mouseTarget: canvas,
  onKeyDown: (e) => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  },
  onMouseMove: (e) => {
    if (!running) return;
    const rect = canvas.getBoundingClientRect();
    const pw = wideTimer > 0 ? paddleW * 1.5 : paddleW;
    paddleX = (e.clientX - rect.left) * (W / rect.width) - pw / 2;
    paddleX = Math.max(0, Math.min(W - pw, paddleX));
  }
});

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
  if (inputManager.isKeyDown('ArrowLeft') || inputManager.isKeyDown('a')) paddleX -= paddleSpeed;
  if (inputManager.isKeyDown('ArrowRight') || inputManager.isKeyDown('d')) paddleX += paddleSpeed;
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
      playSound('move');
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
          playSound('explosion');
          // chance to spawn power-up
          if (Math.random() < 0.15) {
            const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
            powerUps.push({ x: brick.x + brick.w / 2, y: brick.y, type, dy: 2 });
          }
        } else {
          playSound('hit');
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
}

function applyPowerUp(type) {
  if (type === 'wide') {
    wideTimer = 600; // 10 seconds at 60fps
  } else if (type === 'multi') {
    // Add extra balls (max 4 total para evitar lag)
    const maxExtra = 3;
    const toAdd = Math.min(2, maxExtra - extraBalls.length);
    for (let i = 0; i < toAdd; i++) {
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
//  DRAW - TEMA NEON ARCADE
// =============================================
function draw() {
  // Fundo com gradiente escuro
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);

  // Grade de fundo sutil
  ctx.strokeStyle = 'rgba(233, 69, 96, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Bricks com glow
  for (let brick of bricks) {
    if (!brick.alive) continue;

    // Glow externo
    ctx.shadowColor = brick.color;
    ctx.shadowBlur = 8;

    // Bloco com gradiente
    const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
    if (brick.hits > 1) {
      grad.addColorStop(0, '#888');
      grad.addColorStop(1, '#555');
    } else {
      grad.addColorStop(0, brick.color);
      grad.addColorStop(1, shadeColor(brick.color, -20));
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 3);
    ctx.fill();

    // Borda brilhante
    ctx.shadowBlur = 0;
    ctx.strokeStyle = brick.hits > 1 ? '#aaa' : brick.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hit indicator para blocos resistentes
    if (brick.hits > 1) {
      ctx.fillStyle = brick.color;
      ctx.globalAlpha = 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Paddle com glow neon
  const pw = wideTimer > 0 ? paddleW * 1.5 : paddleW;
  ctx.shadowColor = wideTimer > 0 ? '#ffd32a' : '#ff6b6b';
  ctx.shadowBlur = wideTimer > 0 ? 20 : 15;

  const paddleGrad = ctx.createLinearGradient(paddleX, H - 30 - PADDLE_HEIGHT, paddleX, H - 30);
  paddleGrad.addColorStop(0, '#ff6b6b');
  paddleGrad.addColorStop(0.5, '#e94560');
  paddleGrad.addColorStop(1, '#ff4757');
  ctx.fillStyle = paddleGrad;
  ctx.beginPath();
  ctx.roundRect(paddleX, H - 30 - PADDLE_HEIGHT, pw, PADDLE_HEIGHT, 7);
  ctx.fill();

  // Borda do paddle
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffd32a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bola principal com glow forte
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Borda da bola
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffd32a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Extra balls com cor diferente
  ctx.shadowColor = '#18dcff';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#18dcff';
  for (let b of extraBalls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Power-ups com glow e ícones claros
  for (let p of powerUps) {
    // Glow do power-up
    ctx.shadowColor = POWERUP_COLORS[p.type];
    ctx.shadowBlur = 15;

    // Círculo externo
    ctx.fillStyle = POWERUP_COLORS[p.type];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();

    // Círculo interno
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Ícone central
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = p.type === 'wide' ? '<>' : p.type === 'multi' ? '*' : '+';
    ctx.fillText(label, p.x, p.y + 1);
  }
  ctx.shadowBlur = 0;
}

// Helper para escurecer cores
function shadeColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 +
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1);
}

// =============================================
//  CONTROLS
// =============================================
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
new MobileButtonHandler('.ctrl-btn', {
  hapticDuration: 10,
  repeatInterval: 30,
  onPress: (dir) => {
    const pw = wideTimer > 0 ? paddleW * 1.5 : paddleW;
    if (dir === 'left') paddleX -= paddleSpeed * 2;
    if (dir === 'right') paddleX += paddleSpeed * 2;
    paddleX = Math.max(0, Math.min(W - pw, paddleX));
  }
});

// =============================================
//  GAME FLOW
// =============================================
function startGame() {
  initAudio();
  initGame();
  overlay.classList.add('hidden');
  running = true;

  // Reseta e inicia stats
  stats.reset();
  stats.startTimer();

  gameLoop.start();
}

async function gameOver() {
  running = false;
  gameLoop.stop();

  // Atualiza best score
  bestScoreManager.checkAndUpdate(score);

  // Salva stats
  stats.score = score;
  stats.stopTimer();
  await stats.save('end');

  overlayIcon.textContent  = '💥';
  overlayTitle.textContent = 'Game Over!';
  overlayMsg.textContent   = `Nivel alcancado: ${level}`;
  overlayScore.textContent = `Pontuacao: ${score}`;
  btnStart.textContent     = 'Jogar Novamente';
  overlay.classList.remove('hidden');
  playSound('gameover');
}

btnStart.addEventListener('click', startGame);

// =============================================
//  INIT
// =============================================
initGame();
draw();
