import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic, initAudio } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameLoop } from '../shared/game-loop.js';
import { InputManager } from '../shared/input-manager.js';
import { supabase } from '../../supabase.js';
import { onGameEnd } from '../shared/game-integration.js';

// =============================================
//  PONG — Redesign 3.0 "Ping Pong Cartoon Esportivo"
//  Chunky cartoon paddles, ping pong table, bold outlines
// =============================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');

// Dimensoes base do jogo
const BASE_W = 500;
const BASE_H = 350;
const PADDLE_W = 12;
const PADDLE_H = 60;
const BALL_SIZE = 10;
const WIN_SCORE = 5;

// Dificuldade
const DIFFICULTY_SPEEDS = { easy: 2.2, normal: 3.5, hard: 5.0 };
const DIFFICULTY_ERROR = { easy: 35, normal: 12, hard: 0 };

// ---- Cartoon Colors ----
const C = {
  // Table
  tableGreen:    '#2E7D32',
  tableLight:    '#388E3C',
  tableDark:     '#1B5E20',
  tableLine:     '#FFFFFF',
  // Wood border
  woodLight:     '#A1887F',
  wood:          '#8D6E63',
  woodDark:      '#5D4037',
  woodDarker:    '#3E2723',
  // Net
  netWhite:      '#FFFFFF',
  netGray:       '#E0E0E0',
  netPole:       '#9E9E9E',
  // Player paddle (blue)
  p1Body:        '#1565C0',
  p1Light:       '#1E88E5',
  p1Dark:        '#0D47A1',
  p1Handle:      '#8D6E63',
  p1HandleDark:  '#5D4037',
  // CPU paddle (red)
  p2Body:        '#D32F2F',
  p2Light:       '#EF5350',
  p2Dark:        '#B71C1C',
  p2Handle:      '#8D6E63',
  p2HandleDark:  '#5D4037',
  // Ball
  ballMain:      '#FF8A65',
  ballLight:     '#FFAB91',
  ballDark:      '#E64A19',
  ballShine:     '#FFFFFF',
  // Outline
  outline:       '#2C2C2C',
  outlineLight:  '#4E342E',
  // Score
  scoreP1:       '#1E88E5',
  scoreP2:       '#EF5350',
  scoreShadow:   'rgba(0,0,0,0.2)',
  // Particles
  starYellow:    '#FFD54F',
  starWhite:     '#FFFFFF',
  sparkOrange:   '#FF9800',
  confettiBlue:  '#42A5F5',
  confettiRed:   '#EF5350',
  confettiGreen: '#66BB6A',
  confettiYellow:'#FFEE58',
};

let player, cpu, ball, playerScore, cpuScore, gameOverState;
let ballTrail = [];
let cpuTargetError = 12;
let scale = 1;
let W = BASE_W;
let H = BASE_H;

// ---- VFX state ----
let particles = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let hitFlash = 0;          // white flash on paddle hit
let scoreFlashTimer = 0;   // flash on score
let scoreFlashSide = '';   // 'left' or 'right'
let ballSquash = { sx: 1, sy: 1 }; // squash & stretch

// ===== STATS =====
const gameStats = new GameStats('pong', { autoSync: true });

function getDifficulty() {
  const sel = document.getElementById('difficulty-select');
  return sel ? sel.value : 'normal';
}

// ===== RESPONSIVE CANVAS =====
function resizeCanvas() {
  const maxWidth = Math.min(500, window.innerWidth - 16);
  const maxHeight = window.innerHeight - 200;
  const ratio = BASE_W / BASE_H;
  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  scale = width / BASE_W;
  W = BASE_W;
  H = BASE_H;

  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function init() {
  initAudio();
  resizeCanvas();

  player = { x: 15, y: H / 2 - PADDLE_H / 2 };
  cpu = { x: W - 15 - PADDLE_W, y: H / 2 - PADDLE_H / 2 };
  playerScore = 0;
  cpuScore = 0;
  gameOverState = false;
  ballTrail = [];
  particles = [];
  screenShake = { x: 0, y: 0, intensity: 0 };
  hitFlash = 0;
  scoreFlashTimer = 0;
  ballSquash = { sx: 1, sy: 1 };
  cpuTargetError = DIFFICULTY_ERROR[getDifficulty()] ?? 12;
  modalOverlay.classList.remove('show');
  resetBall();
  gameLoop.start();
}

function resetBall() {
  ball = {
    x: W / 2,
    y: H / 2,
    vx: (Math.random() > 0.5 ? 1 : -1) * 4,
    vy: (Math.random() - 0.5) * 4,
  };
  ballTrail = [];
  ballSquash = { sx: 1, sy: 1 };
}

// =============================================
//  PARTICLE SYSTEM (cartoon stars & sparkles)
// =============================================
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
    this.color = opts.color ?? C.starYellow;
    this.gravity = opts.gravity ?? 0.06;
    this.friction = opts.friction ?? 0.97;
    this.type = opts.type ?? 'star'; // 'star', 'circle', 'confetti'
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.2;
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.rotation += this.rotSpeed;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    const s = this.size * Math.max(0.2, this.life);

    if (this.type === 'star') {
      drawStar(ctx, 0, 0, 4, s, s * 0.4, this.color);
    } else if (this.type === 'confetti') {
      ctx.fillStyle = this.color;
      ctx.fillRect(-s * 0.6, -s * 0.25, s * 1.2, s * 0.5);
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawStar(ctx, cx, cy, points, outerR, innerR, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function emitParticles(x, y, count, opts = {}) {
  for (let i = 0; i < count; i++) {
    particles.push(new CartoonParticle(x, y, {
      ...opts,
      angle: opts.angle ?? Math.random() * Math.PI * 2,
    }));
  }
}

function emitHitParticles(x, y) {
  // Stars
  emitParticles(x, y, 5, {
    type: 'star', speed: 2.5, size: 4,
    color: C.starYellow, gravity: 0.04, decay: 0.03,
  });
  // Small circles
  emitParticles(x, y, 3, {
    type: 'circle', speed: 2, size: 2.5,
    color: C.starWhite, gravity: 0.03, decay: 0.04,
  });
}

function emitScoreParticles(x, y) {
  const colors = [C.confettiBlue, C.confettiRed, C.confettiGreen, C.confettiYellow, C.starYellow];
  for (let i = 0; i < 15; i++) {
    emitParticles(x, y, 1, {
      type: Math.random() > 0.5 ? 'confetti' : 'star',
      speed: 4 + Math.random() * 3,
      size: 3 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: 0.1,
      decay: 0.015,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// =============================================
//  UPDATE (game logic — unchanged)
// =============================================
function update(dt) {
  if (gameOverState) return;

  // Player movement (keyboard)
  const keys = inputManager._keys;
  if (keys.get('ArrowUp') || keys.get('w') || keys.get('W')) {
    player.y = Math.max(0, player.y - 5);
  }
  if (keys.get('ArrowDown') || keys.get('s') || keys.get('S')) {
    player.y = Math.min(H - PADDLE_H, player.y + 5);
  }

  // CPU AI com dificuldade ajustavel
  const diff = getDifficulty();
  const cpuSpeed = DIFFICULTY_SPEEDS[diff] ?? 3.5;
  const cpuCenter = cpu.y + PADDLE_H / 2;
  const cpuTarget = ball.y + (ball.vx > 0 ? cpuTargetError : 0);

  if (ball.vx > 0) {
    if (cpuCenter < cpuTarget - 8) cpu.y += cpuSpeed;
    else if (cpuCenter > cpuTarget + 8) cpu.y -= cpuSpeed;
  } else {
    if (cpuCenter < H / 2 - 20) cpu.y += cpuSpeed * 0.5;
    else if (cpuCenter > H / 2 + 20) cpu.y -= cpuSpeed * 0.5;
  }
  cpu.y = Math.max(0, Math.min(H - PADDLE_H, cpu.y));

  // Atualizar trail da bola
  ballTrail.push({ x: ball.x, y: ball.y });
  if (ballTrail.length > 8) ballTrail.shift();

  // Ball movement
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall bounce (top/bottom)
  if (ball.y <= 0 || ball.y >= H - BALL_SIZE) {
    ball.vy *= -1;
    ball.y = Math.max(0, Math.min(H - BALL_SIZE, ball.y));
    // Small bounce particles
    emitParticles(ball.x + BALL_SIZE / 2, ball.y <= 1 ? 2 : H - 2, 3, {
      type: 'circle', speed: 1.5, size: 2, color: C.starWhite,
      gravity: ball.y <= 1 ? 0.05 : -0.05, decay: 0.04,
    });
  }

  // Paddle collision - player
  if (ball.x <= player.x + PADDLE_W && ball.x >= player.x &&
      ball.y + BALL_SIZE >= player.y && ball.y <= player.y + PADDLE_H) {
    ball.vx = Math.abs(ball.vx) * 1.05;
    ball.vy += (ball.y - (player.y + PADDLE_H / 2)) * 0.15;
    ball.x = player.x + PADDLE_W;
    playSound('move');
    haptic(15);
    // VFX
    emitHitParticles(player.x + PADDLE_W, ball.y + BALL_SIZE / 2);
    screenShake.intensity = 3;
    hitFlash = 6;
    ballSquash = { sx: 0.6, sy: 1.4 };
  }

  // Paddle collision - CPU
  if (ball.x + BALL_SIZE >= cpu.x && ball.x + BALL_SIZE <= cpu.x + PADDLE_W &&
      ball.y + BALL_SIZE >= cpu.y && ball.y <= cpu.y + PADDLE_H) {
    ball.vx = -Math.abs(ball.vx) * 1.05;
    ball.vy += (ball.y - (cpu.y + PADDLE_H / 2)) * 0.15;
    ball.x = cpu.x - BALL_SIZE;
    playSound('move');
    // VFX
    emitHitParticles(cpu.x, ball.y + BALL_SIZE / 2);
    screenShake.intensity = 3;
    hitFlash = 6;
    ballSquash = { sx: 0.6, sy: 1.4 };
  }

  // Speed cap
  const maxSpeed = 10;
  ball.vx = Math.max(-maxSpeed, Math.min(maxSpeed, ball.vx));
  ball.vy = Math.max(-maxSpeed, Math.min(maxSpeed, ball.vy));

  // Score
  if (ball.x < -20) {
    cpuScore++;
    playSound('click');
    scoreFlashTimer = 20;
    scoreFlashSide = 'right';
    emitScoreParticles(W * 0.75, 50);
    if (cpuScore >= WIN_SCORE) endGame('cpu');
    else resetBall();
  }
  if (ball.x > W + 20) {
    playerScore++;
    playSound('click');
    scoreFlashTimer = 20;
    scoreFlashSide = 'left';
    emitScoreParticles(W * 0.25, 50);
    if (playerScore >= WIN_SCORE) endGame('player');
    else resetBall();
  }

  // VFX updates
  // Screen shake decay
  if (screenShake.intensity > 0) {
    screenShake.x = (Math.random() - 0.5) * screenShake.intensity * 2;
    screenShake.y = (Math.random() - 0.5) * screenShake.intensity * 2;
    screenShake.intensity *= 0.8;
    if (screenShake.intensity < 0.2) {
      screenShake.intensity = 0;
      screenShake.x = 0;
      screenShake.y = 0;
    }
  }

  // Hit flash decay
  if (hitFlash > 0) hitFlash--;
  if (scoreFlashTimer > 0) scoreFlashTimer--;

  // Ball squash recovery
  ballSquash.sx += (1 - ballSquash.sx) * 0.15;
  ballSquash.sy += (1 - ballSquash.sy) * 0.15;

  // Particles
  updateParticles();
}

// =============================================
//  DRAW — Full cartoon rendering
// =============================================

function drawTableBackground() {
  // Main green felt
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#348537');
  grad.addColorStop(0.5, C.tableGreen);
  grad.addColorStop(1, '#2A6B2E');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle texture lines (horizontal)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Table border lines (white edges like real ping pong table)
  ctx.strokeStyle = C.tableLine;
  ctx.lineWidth = 2.5;
  // Top line
  ctx.beginPath();
  ctx.moveTo(4, 4);
  ctx.lineTo(W - 4, 4);
  ctx.stroke();
  // Bottom line
  ctx.beginPath();
  ctx.moveTo(4, H - 4);
  ctx.lineTo(W - 4, H - 4);
  ctx.stroke();
  // Left end line
  ctx.beginPath();
  ctx.moveTo(4, 4);
  ctx.lineTo(4, H - 4);
  ctx.stroke();
  // Right end line
  ctx.beginPath();
  ctx.moveTo(W - 4, 4);
  ctx.lineTo(W - 4, H - 4);
  ctx.stroke();
}

function drawNet() {
  const cx = W / 2;

  // Net pole shadows
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(cx - 2, -2, 4, 6);
  ctx.fillRect(cx - 2, H - 4, 4, 6);

  // Net posts (top & bottom)
  ctx.fillStyle = C.netPole;
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 2;
  // Top post
  ctx.beginPath();
  ctx.roundRect(cx - 3, 0, 6, 8, 2);
  ctx.fill();
  ctx.stroke();
  // Bottom post
  ctx.beginPath();
  ctx.roundRect(cx - 3, H - 8, 6, 8, 2);
  ctx.fill();
  ctx.stroke();

  // Net mesh — dashed vertical line with cross hatches
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  // Main vertical line
  ctx.beginPath();
  ctx.moveTo(cx, 8);
  ctx.lineTo(cx, H - 8);
  ctx.stroke();

  // Cross hatches
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.8;
  for (let y = 12; y < H - 8; y += 10) {
    ctx.beginPath();
    ctx.moveTo(cx - 4, y);
    ctx.lineTo(cx + 4, y);
    ctx.stroke();
  }

  // Top rope of net
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 5, 8);
  ctx.quadraticCurveTo(cx, 10, cx + 5, 8);
  ctx.stroke();
}

function drawCartoonPaddle(x, y, isPlayer) {
  const w = PADDLE_W;
  const h = PADDLE_H;
  const bodyColor = isPlayer ? C.p1Body : C.p2Body;
  const lightColor = isPlayer ? C.p1Light : C.p2Light;
  const darkColor = isPlayer ? C.p1Dark : C.p2Dark;
  const handleColor = isPlayer ? C.p1Handle : C.p2Handle;
  const handleDark = isPlayer ? C.p1HandleDark : C.p2HandleDark;

  ctx.save();

  // Shadow under paddle
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 3, w, h, 4);
  ctx.fill();

  // Handle (bottom/top extension)
  const handleH = 10;
  const handleW = w * 0.5;
  const handleX = x + (w - handleW) / 2;
  const handleY = isPlayer ? y + h : y - handleH;

  // Handle shadow
  ctx.fillStyle = handleDark;
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(handleX - 0.5, handleY - 0.5, handleW + 1, handleH + 1, 2);
  ctx.fill();

  // Handle body
  const handleGrad = ctx.createLinearGradient(handleX, handleY, handleX + handleW, handleY);
  handleGrad.addColorStop(0, handleColor);
  handleGrad.addColorStop(0.5, C.woodLight);
  handleGrad.addColorStop(1, handleColor);
  ctx.fillStyle = handleGrad;
  ctx.beginPath();
  ctx.roundRect(handleX, handleY, handleW, handleH, 2);
  ctx.fill();
  ctx.stroke();

  // Paddle body — gradient with 3D look
  const bodyGrad = ctx.createLinearGradient(x, y, x + w, y);
  bodyGrad.addColorStop(0, lightColor);
  bodyGrad.addColorStop(0.4, bodyColor);
  bodyGrad.addColorStop(1, darkColor);
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fill();
  ctx.stroke();

  // Top highlight
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h * 0.3, [3, 3, 0, 0]);
  ctx.fill();

  // Side highlight line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 5);
  ctx.lineTo(x + 2, y + h - 5);
  ctx.stroke();

  ctx.restore();
}

function drawCartoonBall(bx, by) {
  const r = BALL_SIZE / 2;
  const cx = bx + r;
  const cy = by + r;

  ctx.save();

  // Apply squash & stretch
  ctx.translate(cx, cy);
  ctx.scale(ballSquash.sx, ballSquash.sy);
  ctx.translate(-cx, -cy);

  // Shadow on the floor
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx + 1.5, cy + r + 2, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ball body outline
  ctx.fillStyle = C.outline;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.fill();

  // Ball body gradient
  const ballGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r + 0.5);
  ballGrad.addColorStop(0, C.ballLight);
  ballGrad.addColorStop(0.6, C.ballMain);
  ballGrad.addColorStop(1, C.ballDark);
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.35, r * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Small secondary highlight
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(cx + r * 0.2, cy + r * 0.15, r * 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBallTrail() {
  if (ballTrail.length < 2) return;

  // Speed-based trail opacity
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  const trailAlpha = Math.min(1, speed / 8) * 0.4;

  ballTrail.forEach((pos, i) => {
    if (i === ballTrail.length - 1) return; // skip current position
    const t = i / ballTrail.length;
    const alpha = t * trailAlpha;
    const r = (BALL_SIZE / 2) * t * 0.8;

    ctx.fillStyle = `rgba(255, 138, 101, ${alpha})`;
    ctx.beginPath();
    ctx.arc(pos.x + BALL_SIZE / 2, pos.y + BALL_SIZE / 2, r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawScoreboard() {
  ctx.save();

  // Score background panels
  const panelW = 60;
  const panelH = 36;
  const panelY = 12;

  // Player score panel
  const p1x = W / 4 - panelW / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.roundRect(p1x + 1, panelY + 1, panelW, panelH, 8);
  ctx.fill();

  ctx.fillStyle = 'rgba(21, 101, 192, 0.3)';
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(p1x, panelY, panelW, panelH, 8);
  ctx.fill();
  ctx.stroke();

  // CPU score panel
  const p2x = (3 * W) / 4 - panelW / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.roundRect(p2x + 1, panelY + 1, panelW, panelH, 8);
  ctx.fill();

  ctx.fillStyle = 'rgba(211, 47, 47, 0.3)';
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(p2x, panelY, panelW, panelH, 8);
  ctx.fill();
  ctx.stroke();

  // Score flash effect
  if (scoreFlashTimer > 0) {
    const flashAlpha = scoreFlashTimer / 20 * 0.4;
    const flashX = scoreFlashSide === 'left' ? p1x : p2x;
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.beginPath();
    ctx.roundRect(flashX, panelY, panelW, panelH, 8);
    ctx.fill();
  }

  // Score numbers
  ctx.font = 'bold 24px Nunito';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Player score
  ctx.fillStyle = C.scoreShadow;
  ctx.fillText(playerScore, W / 4 + 1, panelY + panelH / 2 + 2);
  ctx.fillStyle = C.scoreP1;
  ctx.fillText(playerScore, W / 4, panelY + panelH / 2);

  // CPU score
  ctx.fillStyle = C.scoreShadow;
  ctx.fillText(cpuScore, (3 * W) / 4 + 1, panelY + panelH / 2 + 2);
  ctx.fillStyle = C.scoreP2;
  ctx.fillText(cpuScore, (3 * W) / 4, panelY + panelH / 2);

  // Labels
  ctx.font = 'bold 9px Nunito';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('VOCE', W / 4, panelY - 4);
  ctx.fillText('CPU', (3 * W) / 4, panelY - 4);

  // "VS" in center
  ctx.font = 'bold 11px Nunito';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('VS', W / 2, panelY + panelH / 2);

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    p.draw(ctx);
  }
}

function drawHitFlash() {
  if (hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${hitFlash / 20})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function draw() {
  ctx.save();

  // Apply screen shake
  ctx.translate(screenShake.x, screenShake.y);

  // ---- Background & table ----
  drawTableBackground();

  // ---- Net ----
  drawNet();

  // ---- Ball trail ----
  drawBallTrail();

  // ---- Ball ----
  drawCartoonBall(ball.x, ball.y);

  // ---- Paddles ----
  drawCartoonPaddle(player.x, player.y, true);
  drawCartoonPaddle(cpu.x, cpu.y, false);

  // ---- Scoreboard ----
  drawScoreboard();

  // ---- Particles ----
  drawParticles();

  // ---- Hit flash overlay ----
  drawHitFlash();

  ctx.restore();
}

function endGame(winner) {
  gameOverState = true;
  gameLoop.pause();
  const result = winner === 'player' ? 'win' : 'loss';
  modalTitle.textContent = winner === 'player' ? 'Voce venceu!' : 'Computador venceu!';
  modalMessage.textContent = `${playerScore} x ${cpuScore}`;
  modalOverlay.classList.add('show');

  gameStats.recordGame(winner === 'player', { score: playerScore });
  onGameEnd('pong', { won: winner === 'player', score: playerScore });

  saveGameStat(result);
  if (winner === 'player') {
    launchConfetti();
    playSound('win');
  }
}

// ===== GAME LOOP =====
const gameLoop = new GameLoop({
  update,
  render: draw,
  fps: 60
});

// ===== INPUT MANAGER =====
const inputManager = new InputManager({
  keyboardTarget: document
});

// Mobile controls
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');

if (btnUp && btnDown) {
  const handleMobileMove = (dir) => {
    if (gameOverState) return;
    if (dir === 'up') {
      player.y = Math.max(0, player.y - 8);
    } else {
      player.y = Math.min(H - PADDLE_H, player.y + 8);
    }
  };

  let mobileInterval;
  const startMobile = (dir) => {
    stopMobile();
    handleMobileMove(dir);
    mobileInterval = setInterval(() => handleMobileMove(dir), 16);
  };
  const stopMobile = () => { clearInterval(mobileInterval); };

  btnUp.addEventListener('touchstart', (e) => { e.preventDefault(); startMobile('up'); }, { passive: false });
  btnUp.addEventListener('touchend', stopMobile);
  btnUp.addEventListener('mousedown', () => startMobile('up'));
  btnUp.addEventListener('mouseup', stopMobile);
  btnUp.addEventListener('mouseleave', stopMobile);

  btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); startMobile('down'); }, { passive: false });
  btnDown.addEventListener('touchend', stopMobile);
  btnDown.addEventListener('mousedown', () => startMobile('down'));
  btnDown.addEventListener('mouseup', stopMobile);
  btnDown.addEventListener('mouseleave', stopMobile);
}

// Touch on canvas - move paddle to touch Y
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleY = H / rect.height;
  const touchY = (e.touches[0].clientY - rect.top) * scaleY;
  player.y = Math.max(0, Math.min(H - PADDLE_H, touchY - PADDLE_H / 2));
}, { passive: false });

// Mouse control - follow mouse Y
canvas.addEventListener('mousemove', (e) => {
  if (gameOverState) return;
  const rect = canvas.getBoundingClientRect();
  const scaleY = H / rect.height;
  const mouseY = (e.clientY - rect.top) * scaleY;
  player.y = Math.max(0, Math.min(H - PADDLE_H, mouseY - PADDLE_H / 2));
});

btnNewGame.addEventListener('click', init);
btnPlayAgain.addEventListener('click', init);

// Resize handler
window.addEventListener('resize', () => {
  resizeCanvas();
});

async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'pong',
      result: result,
      moves: 0,
      time_seconds: 0,
      score: playerScore,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

init();
