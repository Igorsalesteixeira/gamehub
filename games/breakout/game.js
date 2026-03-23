import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic, initAudio } from '../shared/game-design-utils.js';
import { GameStats, BestScoreManager } from '../shared/game-core.js';
import { GameLoop } from '../shared/game-loop.js';
import { InputManager, MobileButtonHandler } from '../shared/input-manager.js';
import { onGameEnd } from '../shared/game-integration.js';
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
const BRICK_COLORS  = ['#F44336','#FF9800','#FFEB3B','#4CAF50','#2196F3','#9C27B0'];

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
const POWERUP_COLORS = { wide: '#4CAF50', multi: '#9C27B0', life: '#F44336' };
let extraBalls = [];

// ---- Game Loop ----
const gameLoop = new GameLoop({
  update: () => {
    if (!running) return;
    update();
  },
  render: () => {
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
  particles = [];
  ballTrail = [];
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
      // Paddle hit sparks
      emitParticles(b.x, b.y + BALL_RADIUS, 3, {
        color: '#FFD54F', type: 'spark', speed: 2, size: 2,
        gravity: 0.05, decay: 0.04, angle: -Math.PI / 2 + (Math.random() - 0.5) * 1.5,
      });
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
          emitBrickDestroy(brick);
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
//  PARTICLE SYSTEM — Cartoon VFX
// =============================================
let particles = [];
let ballTrail = [];
let frameCount = 0;

class CartoonParticle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    const angle = opts.angle ?? Math.random() * Math.PI * 2;
    const spd = (opts.speed ?? 3) * (0.5 + Math.random());
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd;
    this.life = 1;
    this.decay = opts.decay ?? (0.02 + Math.random() * 0.02);
    this.size = opts.size ?? (3 + Math.random() * 4);
    this.color = opts.color ?? '#FFD54F';
    this.gravity = opts.gravity ?? 0.1;
    this.friction = opts.friction ?? 0.96;
    this.type = opts.type ?? 'star'; // 'star', 'chunk', 'circle', 'spark'
    this.rot = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.2;
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.rot += this.rotSpeed;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.globalAlpha = Math.max(0, this.life);
    const s = this.size * Math.max(0.2, this.life);

    if (this.type === 'star') {
      drawStar(ctx, 0, 0, 4, s, s * 0.4, this.color);
    } else if (this.type === 'chunk') {
      // Brick chunk
      ctx.fillStyle = this.color;
      ctx.strokeStyle = shadeColor(this.color, -40);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-s / 2, -s / 2, s, s * 0.7, 2);
      ctx.fill();
      ctx.stroke();
    } else if (this.type === 'spark') {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function emitParticles(x, y, count, opts = {}) {
  for (let i = 0; i < count; i++) {
    particles.push(new CartoonParticle(x, y, {
      ...opts,
      angle: opts.angle ?? Math.random() * Math.PI * 2,
    }));
  }
}

function emitBrickDestroy(brick) {
  const cx = brick.x + brick.w / 2;
  const cy = brick.y + brick.h / 2;
  // Brick chunks
  emitParticles(cx, cy, 4, {
    color: brick.color,
    type: 'chunk',
    speed: 3,
    size: 5 + Math.random() * 3,
    gravity: 0.15,
    decay: 0.018,
  });
  // Stars
  emitParticles(cx, cy, 3, {
    color: '#FFD54F',
    type: 'star',
    speed: 2.5,
    size: 4,
    gravity: 0.05,
    decay: 0.025,
  });
  // Sparks
  emitParticles(cx, cy, 5, {
    color: '#FFFFFF',
    type: 'spark',
    speed: 4,
    size: 2,
    gravity: 0.08,
    decay: 0.04,
  });
}

function drawStar(ctx, x, y, points, outerR, innerR, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = shadeColor(color, -30);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// =============================================
//  DRAW — TEMA DEMOLICAO CARTOON
// =============================================
function draw() {
  frameCount++;

  // ---- Sky background gradient ----
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#87CEEB');
  skyGrad.addColorStop(0.6, '#5BA3D9');
  skyGrad.addColorStop(1, '#4A90C4');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // ---- Cartoon clouds ----
  drawCloud(ctx, W * 0.15, 18, 28);
  drawCloud(ctx, W * 0.55, 12, 22);
  drawCloud(ctx, W * 0.85, 22, 20);

  // ---- Ground area (below paddle) ----
  const groundY = H - 18;
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
  groundGrad.addColorStop(0, '#8D6E63');
  groundGrad.addColorStop(0.5, '#6D4C41');
  groundGrad.addColorStop(1, '#5D4037');
  ctx.fillStyle = groundGrad;
  ctx.beginPath();
  ctx.roundRect(0, groundY, W, H - groundY, 0);
  ctx.fill();
  // Ground top line
  ctx.strokeStyle = '#4E342E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();

  // ---- Bricks — Lego/construction blocks cartoon ----
  for (let brick of bricks) {
    if (!brick.alive) continue;
    drawCartoonBrick(ctx, brick);
  }

  // ---- Paddle — wooden plank cartoon ----
  const pw = wideTimer > 0 ? paddleW * 1.5 : paddleW;
  drawCartoonPaddle(ctx, paddleX, H - 30 - PADDLE_HEIGHT, pw, PADDLE_HEIGHT);

  // ---- Ball shadow on ground ----
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(ballX, groundY + 2, BALL_RADIUS * 1.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- Ball trail ----
  ballTrail.push({ x: ballX, y: ballY });
  if (ballTrail.length > 6) ballTrail.shift();
  for (let i = 0; i < ballTrail.length - 1; i++) {
    const t = ballTrail[i];
    const alpha = (i / ballTrail.length) * 0.25;
    const size = BALL_RADIUS * (i / ballTrail.length) * 0.6;
    ctx.fillStyle = `rgba(200,200,200,${alpha})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Main ball — shiny cartoon ----
  drawCartoonBall(ctx, ballX, ballY, BALL_RADIUS, '#E0E0E0', '#BDBDBD', '#424242');

  // ---- Extra balls ----
  for (let b of extraBalls) {
    drawCartoonBall(ctx, b.x, b.y, BALL_RADIUS, '#81D4FA', '#4FC3F7', '#01579B');
  }

  // ---- Power-ups — cartoon icons with outlines ----
  for (let p of powerUps) {
    drawCartoonPowerUp(ctx, p);
  }

  // ---- Update & draw particles ----
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw(ctx);
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
}

// ---- Draw helpers ----

function drawCloud(ctx, x, y, size) {
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
  ctx.arc(x - size * 0.5, y + size * 0.1, size * 0.45, 0, Math.PI * 2);
  ctx.arc(x + size * 0.5, y + size * 0.1, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x - size * 0.25, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
  ctx.arc(x + size * 0.2, y - size * 0.15, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawCartoonBrick(ctx, brick) {
  const { x, y, w, h, color, hits } = brick;
  const r = 4; // corner radius

  // Shadow under brick
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w, h, r);
  ctx.fill();

  // Main brick body — gradient
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  if (hits > 1) {
    // Reinforced brick — metallic look
    grad.addColorStop(0, '#BDBDBD');
    grad.addColorStop(0.3, '#9E9E9E');
    grad.addColorStop(1, '#757575');
  } else {
    grad.addColorStop(0, shadeColor(color, 25));
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, shadeColor(color, -20));
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  // Thick dark outline
  ctx.strokeStyle = hits > 1 ? '#424242' : shadeColor(color, -50);
  ctx.lineWidth = 3;
  ctx.stroke();

  // 3D highlight on top — white shine
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 1.5, w - 6, h * 0.35, [r, r, 0, 0]);
  ctx.fill();

  // Small specular dot
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(x + 6, y + 4, 2, 0, Math.PI * 2);
  ctx.fill();

  // Lego-style nubs on top
  const nubCount = Math.max(2, Math.floor(w / 18));
  const nubSpacing = w / (nubCount + 1);
  for (let i = 1; i <= nubCount; i++) {
    const nx = x + i * nubSpacing;
    const ny = y + 1;
    // Nub shadow
    ctx.fillStyle = hits > 1 ? 'rgba(0,0,0,0.2)' : shadeColor(color, -30);
    ctx.beginPath();
    ctx.arc(nx, ny + 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Nub body
    ctx.fillStyle = hits > 1 ? '#BDBDBD' : shadeColor(color, 15);
    ctx.beginPath();
    ctx.arc(nx, ny, 3, 0, Math.PI * 2);
    ctx.fill();
    // Nub outline
    ctx.strokeStyle = hits > 1 ? '#616161' : shadeColor(color, -40);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Nub highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(nx - 0.5, ny - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Reinforced brick X mark
  if (hits > 1) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + w - 4, y + h - 4);
    ctx.moveTo(x + w - 4, y + 4);
    ctx.lineTo(x + 4, y + h - 4);
    ctx.stroke();
    // Tint with original color
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawCartoonPaddle(ctx, px, py, pw, ph) {
  const r = 8;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(px + 2, py + 3, pw, ph, r);
  ctx.fill();

  // Main body — wood gradient
  const grad = ctx.createLinearGradient(px, py, px, py + ph);
  grad.addColorStop(0, '#D7A86E');
  grad.addColorStop(0.3, '#C49B5E');
  grad.addColorStop(0.7, '#A1887F');
  grad.addColorStop(1, '#8D6E63');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, r);
  ctx.fill();

  // Wood grain lines
  ctx.strokeStyle = 'rgba(93,64,55,0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const gy = py + 3 + i * (ph / 4);
    ctx.beginPath();
    ctx.moveTo(px + 5, gy);
    ctx.quadraticCurveTo(px + pw / 2, gy + (i % 2 === 0 ? 1.5 : -1.5), px + pw - 5, gy);
    ctx.stroke();
  }

  // Thick dark outline
  ctx.strokeStyle = '#4E342E';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, r);
  ctx.stroke();

  // Top highlight (specular shine)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.roundRect(px + 4, py + 1.5, pw - 8, ph * 0.3, [r, r, 0, 0]);
  ctx.fill();

  // Metal bolts on edges
  const boltR = 3;
  [px + 8, px + pw - 8].forEach(bx => {
    ctx.fillStyle = '#9E9E9E';
    ctx.strokeStyle = '#616161';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, py + ph / 2, boltR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(bx - 0.5, py + ph / 2 - 1, 1, 0, Math.PI * 2);
    ctx.fill();
  });

  // Wide power-up glow effect
  if (wideTimer > 0) {
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4 + Math.sin(frameCount * 0.1) * 0.2;
    ctx.beginPath();
    ctx.roundRect(px - 2, py - 2, pw + 4, ph + 4, r + 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawCartoonBall(ctx, bx, by, radius, lightColor, mainColor, outlineColor) {
  // Cartoon ball with 3D shading
  const grad = ctx.createRadialGradient(
    bx - radius * 0.3, by - radius * 0.3, radius * 0.1,
    bx, by, radius
  );
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(0.4, lightColor);
  grad.addColorStop(0.8, mainColor);
  grad.addColorStop(1, shadeColor(mainColor, -25));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(bx, by, radius, 0, Math.PI * 2);
  ctx.fill();

  // Thick outline
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Specular highlight
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(bx - radius * 0.25, by - radius * 0.25, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawCartoonPowerUp(ctx, p) {
  const r = 13;
  const bobY = Math.sin(frameCount * 0.08 + p.x) * 3;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(p.x + 1, p.y + bobY + 2, r, 0, Math.PI * 2);
  ctx.fill();

  // Outer circle — gradient
  const grad = ctx.createRadialGradient(
    p.x - 3, p.y + bobY - 3, 2,
    p.x, p.y + bobY, r
  );
  grad.addColorStop(0, shadeColor(POWERUP_COLORS[p.type], 40));
  grad.addColorStop(0.7, POWERUP_COLORS[p.type]);
  grad.addColorStop(1, shadeColor(POWERUP_COLORS[p.type], -30));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bobY, r, 0, Math.PI * 2);
  ctx.fill();

  // Thick outline
  ctx.strokeStyle = shadeColor(POWERUP_COLORS[p.type], -50);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(p.x - 3, p.y + bobY - 4, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Icon
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.font = 'bold 12px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = p.type === 'wide' ? '<<>>' : p.type === 'multi' ? 'x3' : '+1';
  ctx.strokeText(label, p.x, p.y + bobY + 1);
  ctx.fillText(label, p.x, p.y + bobY + 1);
}

// Helper para escurecer/clarear cores
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
  onGameEnd('breakout', { won: false, score });
}

btnStart.addEventListener('click', startGame);

// =============================================
//  INIT
// =============================================
initGame();
draw();
