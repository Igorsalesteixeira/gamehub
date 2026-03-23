import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, haptic } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameLoop } from '../shared/game-loop.js';
import { InputManager } from '../shared/input-manager.js';
import { supabase } from '../../supabase.js';
import { onGameEnd } from '../shared/game-integration.js';

// ===== DOM Elements =====
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const bestDisplay = document.getElementById('best-display');
const startOverlay = document.getElementById('start-overlay');
const startMsg = document.getElementById('start-msg');
const scoreDisplay = document.getElementById('score-display');
const pauseBtn = document.getElementById('pause-btn');
const pauseModal = document.getElementById('pause-modal');
const resumeBtn = document.getElementById('resume-btn');
const restartBtnPause = document.getElementById('restart-btn-pause');
const gameOverModal = document.getElementById('game-over-modal');
const finalScore = document.getElementById('final-score');
const newRecordEl = document.getElementById('new-record');

// ===== Canvas Size (Responsive) =====
let W = 400, H = 600;
const GROUND_HEIGHT = 60;

function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();

  // Aspect ratio: 2:3 (width:height)
  const aspectRatio = 2 / 3;

  let newWidth = Math.min(rect.width, 400);
  let newHeight = newWidth / aspectRatio;

  // Limit by container height
  const maxHeight = rect.height - 20;
  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = newHeight * aspectRatio;
  }

  W = Math.floor(newWidth);
  H = Math.floor(newHeight);

  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
}

// ===== Game Constants =====
const GRAVITY = 0.35;
const FLAP = -6.5;
const PIPE_WIDTH = 52;
const PIPE_GAP = 140;
const PIPE_SPEED = 2.2;
const BIRD_SIZE = 26;

// ===== Game State =====
let bird = null;
let pipes = [];
let score = 0;
let bestScore = 0;
let gameState = 'waiting'; // waiting, playing, paused, dead
let wingPhase = 0;
let shakeFrames = 0;
let groundOffset = 0;

// ===== Cartoon VFX State =====
let particles = [];
let clouds = [];
let frameCount = 0;
let scorePop = 0;
let deathFlash = 0;

// ===== Stats =====
const gameStats = new GameStats('flappybird', { autoSync: true });

// ===== Cloud System =====
function initClouds() {
  clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * W * 1.5,
      y: 20 + Math.random() * (H * 0.35),
      size: 20 + Math.random() * 35,
      speed: 0.2 + Math.random() * 0.4,
      opacity: 0.4 + Math.random() * 0.3,
      layer: i < 3 ? 0 : 1  // parallax layers
    });
  }
}

// ===== Particle System =====
class CartoonParticle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    const angle = opts.angle ?? Math.random() * Math.PI * 2;
    const spd = (opts.speed ?? 3) * (0.5 + Math.random());
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd;
    this.life = 1;
    this.decay = opts.decay ?? (0.015 + Math.random() * 0.02);
    this.size = opts.size ?? (3 + Math.random() * 4);
    this.color = opts.color ?? '#FFD54F';
    this.gravity = opts.gravity ?? 0.08;
    this.friction = opts.friction ?? 0.97;
    this.type = opts.type ?? 'star'; // 'star', 'feather', 'circle'
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.15;
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
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = Math.max(0, this.life);
    const s = this.size * Math.max(0.2, this.life);

    if (this.type === 'star') {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      drawStar(ctx, 0, 0, 4, s, s * 0.4);
      ctx.fill();
      ctx.stroke();
    } else if (this.type === 'feather') {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.5, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // feather vein
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.moveTo(-s * 1.2, 0);
      ctx.lineTo(s * 1.2, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
    }

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

function drawStar(ctx, cx, cy, points, outerR, innerR) {
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
}

// ===== Initialize =====
function init() {
  bird = { x: W * 0.2, y: H / 2, vy: 0, rotation: 0 };
  pipes = [];
  score = 0;
  wingPhase = 0;
  shakeFrames = 0;
  groundOffset = 0;
  particles = [];
  scorePop = 0;
  deathFlash = 0;
  frameCount = 0;

  initClouds();

  // Update UI
  scoreDisplay.textContent = '0';
  startOverlay.classList.remove('hidden');
  startMsg.classList.remove('hidden');
  pauseBtn.classList.add('hidden');
  pauseModal.classList.remove('show');
  gameOverModal.classList.remove('show');

  gameLoop.start();
}

// ===== Flap Action =====
function flap() {
  if (gameState === 'waiting') {
    gameState = 'playing';
    startOverlay.classList.add('hidden');
    startMsg.classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    initAudio();
  }

  if (gameState === 'paused') {
    resumeGame();
    return;
  }

  if (gameState === 'dead') {
    init();
    return;
  }

  if (gameState !== 'playing') return;

  bird.vy = FLAP;
  playSound('jump');
  haptic(15);

  // Wing flap particles
  const bx = bird.x + BIRD_SIZE / 2;
  const by = bird.y + BIRD_SIZE / 2;
  emitParticles(bx - 8, by, 2, {
    type: 'circle',
    color: '#FFF9C4',
    size: 2,
    speed: 1.5,
    decay: 0.04,
    gravity: 0.02
  });
}

// ===== Pause/Resume =====
function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  gameLoop.pause();
  pauseModal.classList.add('show');
}

function resumeGame() {
  if (gameState !== 'paused') return;
  gameState = 'playing';
  pauseModal.classList.remove('show');
  gameLoop.start();
}

function restartGame() {
  pauseModal.classList.remove('show');
  gameOverModal.classList.remove('show');
  init();
}

// ===== Pipe Generation =====
function spawnPipe() {
  const minY = 80;
  const maxY = H - GROUND_HEIGHT - PIPE_GAP - 80;
  const topH = minY + Math.random() * (maxY - minY);
  pipes.push({ x: W, topH, scored: false });
}

// ===== Update Game =====
function update(dt) {
  frameCount++;

  // Update particles always (even when dead for death particles)
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].life <= 0) {
      particles.splice(i, 1);
    }
  }

  // Score pop decay
  if (scorePop > 0) scorePop *= 0.9;

  // Death flash decay
  if (deathFlash > 0) deathFlash *= 0.85;

  // Update clouds always
  for (const cloud of clouds) {
    cloud.x -= cloud.speed * (gameState === 'playing' ? 1 : 0.3);
    if (cloud.x + cloud.size * 2 < 0) {
      cloud.x = W + cloud.size;
      cloud.y = 20 + Math.random() * (H * 0.35);
    }
  }

  if (gameState !== 'playing') return;

  // Ground animation
  groundOffset = (groundOffset + PIPE_SPEED) % 24;

  // Bird physics
  bird.vy += GRAVITY;
  bird.y += bird.vy;
  bird.rotation = Math.min(bird.vy * 3, 90);

  // Wing animation
  wingPhase += 0.2;
  if (wingPhase > Math.PI * 2) wingPhase -= Math.PI * 2;

  // Spawn pipes
  if (pipes.length === 0 || pipes[pipes.length - 1].x < W - 200) {
    spawnPipe();
  }

  // Update pipes
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= PIPE_SPEED;

    // Score
    if (!pipes[i].scored && pipes[i].x + PIPE_WIDTH < bird.x) {
      pipes[i].scored = true;
      score++;
      scoreDisplay.textContent = score;
      scorePop = 1;
      haptic(10);

      // Score celebration particles - stars!
      const cx = bird.x + BIRD_SIZE;
      const cy = bird.y;
      emitParticles(cx, cy, 5, {
        type: 'star',
        color: '#FFD54F',
        size: 4,
        speed: 2.5,
        decay: 0.025,
        gravity: 0.05
      });
      emitParticles(cx, cy, 3, {
        type: 'star',
        color: '#FFC107',
        size: 3,
        speed: 2,
        decay: 0.03,
        gravity: 0.04
      });
    }

    // Remove offscreen
    if (pipes[i].x + PIPE_WIDTH < -10) {
      pipes.splice(i, 1);
    }
  }

  // Collision - ground/ceiling
  if (bird.y + BIRD_SIZE > H - GROUND_HEIGHT || bird.y < 0) {
    die();
    return;
  }

  // Collision - pipes
  for (const pipe of pipes) {
    if (bird.x + BIRD_SIZE * 0.7 > pipe.x && bird.x + BIRD_SIZE * 0.3 < pipe.x + PIPE_WIDTH) {
      if (bird.y + BIRD_SIZE * 0.2 < pipe.topH || bird.y + BIRD_SIZE * 0.8 > pipe.topH + PIPE_GAP) {
        die();
        return;
      }
    }
  }
}

// ===== Death =====
function die() {
  gameState = 'dead';
  gameLoop.pause();
  shakeFrames = 12;
  deathFlash = 1;
  haptic([40, 20, 60]);
  playSound('error');

  // Death feather particles
  const bx = bird.x + BIRD_SIZE / 2;
  const by = bird.y + BIRD_SIZE / 2;
  const featherColors = ['#FFF9C4', '#FFE082', '#FFCC80', '#FFFFFF'];
  for (let i = 0; i < 8; i++) {
    emitParticles(bx, by, 1, {
      type: 'feather',
      color: featherColors[Math.floor(Math.random() * featherColors.length)],
      size: 3 + Math.random() * 3,
      speed: 3 + Math.random() * 2,
      decay: 0.01 + Math.random() * 0.01,
      gravity: 0.12,
      friction: 0.96
    });
  }
  // Death stars
  emitParticles(bx, by, 5, {
    type: 'star',
    color: '#FFEB3B',
    size: 5,
    speed: 3,
    decay: 0.02,
    gravity: 0.06
  });

  // Save stats
  const isNewRecord = score > bestScore;
  gameStats.recordGame(isNewRecord, { score });
  onGameEnd('flappybird', { won: false, score });

  if (isNewRecord) {
    bestScore = score;
    localStorage.setItem('flappy_best', bestScore);
    bestDisplay.textContent = bestScore;
    launchConfetti();
    playSound('win');
  } else {
    playSound('gameover');
  }

  // Show game over
  finalScore.textContent = score;
  newRecordEl.style.display = isNewRecord ? 'block' : 'none';
  pauseBtn.classList.add('hidden');

  setTimeout(() => {
    gameOverModal.classList.add('show');
  }, 300);

  saveGameStat();
}

// =============================================
//  DRAW — Full Cartoon Render
// =============================================
function draw() {
  ctx.save();

  // Screen shake
  if (shakeFrames > 0) {
    const intensity = shakeFrames * 0.8;
    ctx.translate(
      (Math.random() - 0.5) * intensity * 2,
      (Math.random() - 0.5) * intensity * 2
    );
    shakeFrames--;
  }

  // ---- SKY ----
  drawSky();

  // ---- SUN ----
  drawSun();

  // ---- CLOUDS (back layer) ----
  drawClouds(0);

  // ---- PIPES ----
  for (const pipe of pipes) {
    drawPipe(pipe);
  }

  // ---- CLOUDS (front layer) ----
  drawClouds(1);

  // ---- PARTICLES (behind bird) ----
  for (const p of particles) {
    p.draw(ctx);
  }

  // ---- BIRD ----
  drawBird();

  // ---- GROUND ----
  drawGround();

  // ---- DEATH FLASH ----
  if (deathFlash > 0.01) {
    ctx.fillStyle = `rgba(255, 255, 255, ${deathFlash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}

// ===== Draw Sky =====
function drawSky() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H - GROUND_HEIGHT);
  skyGrad.addColorStop(0, '#4FC3F7');
  skyGrad.addColorStop(0.3, '#81D4FA');
  skyGrad.addColorStop(0.6, '#B3E5FC');
  skyGrad.addColorStop(1, '#87CEEB');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);
}

// ===== Draw Sun =====
function drawSun() {
  const sx = W * 0.85;
  const sy = H * 0.08;
  const sunSize = 28;

  // Sun glow
  const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sunSize * 3);
  glowGrad.addColorStop(0, 'rgba(255, 235, 59, 0.4)');
  glowGrad.addColorStop(0.5, 'rgba(255, 235, 59, 0.1)');
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(sx - sunSize * 3, sy - sunSize * 3, sunSize * 6, sunSize * 6);

  // Sun rays (rotating)
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(frameCount * 0.005);
  ctx.strokeStyle = 'rgba(255, 235, 59, 0.3)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * (sunSize + 4), Math.sin(angle) * (sunSize + 4));
    ctx.lineTo(Math.cos(angle) * (sunSize + 14), Math.sin(angle) * (sunSize + 14));
    ctx.stroke();
  }
  ctx.restore();

  // Sun body
  ctx.fillStyle = '#FFEB3B';
  ctx.strokeStyle = '#F9A825';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sx, sy, sunSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Sun highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(sx - 6, sy - 8, sunSize * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Sun face - cute smile
  ctx.strokeStyle = '#F57F17';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  // Eyes
  ctx.fillStyle = '#F57F17';
  ctx.beginPath();
  ctx.arc(sx - 7, sy - 3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + 7, sy - 3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Smile
  ctx.beginPath();
  ctx.arc(sx, sy + 2, 8, 0.1, Math.PI - 0.1);
  ctx.stroke();
  // Cheeks
  ctx.fillStyle = 'rgba(255, 138, 101, 0.4)';
  ctx.beginPath();
  ctx.arc(sx - 14, sy + 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + 14, sy + 2, 5, 0, Math.PI * 2);
  ctx.fill();
}

// ===== Draw Clouds =====
function drawClouds(layer) {
  for (const cloud of clouds) {
    if (cloud.layer !== layer) continue;
    ctx.globalAlpha = cloud.opacity;
    drawCartoonCloud(cloud.x, cloud.y, cloud.size);
    ctx.globalAlpha = 1;
  }
}

function drawCartoonCloud(x, y, size) {
  // Cloud shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
  drawCloudShape(x + 2, y + 3, size);

  // Cloud outline
  ctx.fillStyle = 'rgba(200, 220, 240, 0.6)';
  drawCloudShape(x, y, size + 2);

  // Cloud body
  ctx.fillStyle = '#FFFFFF';
  drawCloudShape(x, y, size);

  // Cloud highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(x - size * 0.1, y - size * 0.2, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloudShape(x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x - size * 0.35, y + size * 0.05, size * 0.38, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y + size * 0.02, size * 0.42, 0, Math.PI * 2);
  ctx.arc(x + size * 0.15, y - size * 0.2, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

// ===== Draw Pipe (Chunky Cartoon) =====
function drawPipe(pipe) {
  const bottomY = pipe.topH + PIPE_GAP;
  const bottomH = H - GROUND_HEIGHT - bottomY;
  const pw = PIPE_WIDTH;
  const capH = 24;
  const capOverhang = 5;

  // ---- TOP PIPE ----
  // Body outline
  ctx.fillStyle = '#1B5E20';
  roundRect(ctx, pipe.x - 1, -2, pw + 2, pipe.topH - capH + 4, 0);
  ctx.fill();

  // Body gradient
  const topBodyGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + pw, 0);
  topBodyGrad.addColorStop(0, '#388E3C');
  topBodyGrad.addColorStop(0.2, '#4CAF50');
  topBodyGrad.addColorStop(0.5, '#66BB6A');
  topBodyGrad.addColorStop(0.8, '#4CAF50');
  topBodyGrad.addColorStop(1, '#2E7D32');
  ctx.fillStyle = topBodyGrad;
  ctx.fillRect(pipe.x, 0, pw, pipe.topH - capH);

  // Body highlight stripe
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(pipe.x + 6, 0, 8, pipe.topH - capH);

  // Body shadow stripe
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(pipe.x + pw - 10, 0, 6, pipe.topH - capH);

  // Cap outline
  ctx.fillStyle = '#1B5E20';
  roundRect(ctx, pipe.x - capOverhang - 2, pipe.topH - capH - 2, pw + capOverhang * 2 + 4, capH + 4, 4);
  ctx.fill();

  // Cap body
  const capGrad = ctx.createLinearGradient(pipe.x - capOverhang, 0, pipe.x + pw + capOverhang, 0);
  capGrad.addColorStop(0, '#388E3C');
  capGrad.addColorStop(0.15, '#4CAF50');
  capGrad.addColorStop(0.4, '#81C784');
  capGrad.addColorStop(0.6, '#66BB6A');
  capGrad.addColorStop(0.85, '#4CAF50');
  capGrad.addColorStop(1, '#2E7D32');
  ctx.fillStyle = capGrad;
  roundRect(ctx, pipe.x - capOverhang, pipe.topH - capH, pw + capOverhang * 2, capH, 3);
  ctx.fill();

  // Cap highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  roundRect(ctx, pipe.x - capOverhang + 3, pipe.topH - capH + 2, pw + capOverhang * 2 - 20, capH * 0.4, 2);
  ctx.fill();

  // Cap outline stroke
  ctx.strokeStyle = '#1B5E20';
  ctx.lineWidth = 3;
  roundRect(ctx, pipe.x - capOverhang, pipe.topH - capH, pw + capOverhang * 2, capH, 3);
  ctx.stroke();

  // Body outline stroke
  ctx.strokeStyle = '#1B5E20';
  ctx.lineWidth = 3;
  ctx.strokeRect(pipe.x, 0, pw, pipe.topH - capH);

  // ---- BOTTOM PIPE ----
  // Body outline
  ctx.fillStyle = '#1B5E20';
  roundRect(ctx, pipe.x - 1, bottomY + capH - 2, pw + 2, bottomH - capH + 4, 0);
  ctx.fill();

  // Body gradient
  ctx.fillStyle = topBodyGrad;
  ctx.fillRect(pipe.x, bottomY + capH, pw, bottomH - capH);

  // Body highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(pipe.x + 6, bottomY + capH, 8, bottomH - capH);

  // Body shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(pipe.x + pw - 10, bottomY + capH, 6, bottomH - capH);

  // Cap outline
  ctx.fillStyle = '#1B5E20';
  roundRect(ctx, pipe.x - capOverhang - 2, bottomY - 2, pw + capOverhang * 2 + 4, capH + 4, 4);
  ctx.fill();

  // Cap body
  ctx.fillStyle = capGrad;
  roundRect(ctx, pipe.x - capOverhang, bottomY, pw + capOverhang * 2, capH, 3);
  ctx.fill();

  // Cap highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  roundRect(ctx, pipe.x - capOverhang + 3, bottomY + 2, pw + capOverhang * 2 - 20, capH * 0.4, 2);
  ctx.fill();

  // Cap outline stroke
  ctx.strokeStyle = '#1B5E20';
  ctx.lineWidth = 3;
  roundRect(ctx, pipe.x - capOverhang, bottomY, pw + capOverhang * 2, capH, 3);
  ctx.stroke();

  // Body outline stroke
  ctx.strokeStyle = '#1B5E20';
  ctx.lineWidth = 3;
  ctx.strokeRect(pipe.x, bottomY + capH, pw, bottomH - capH);
}

// Helper: rounded rectangle path
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ===== Draw Ground (Chunky Cartoon) =====
function drawGround() {
  const gy = H - GROUND_HEIGHT;

  // Ground shadow at top
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, gy - 3, W, 6);

  // Dirt body
  const dirtGrad = ctx.createLinearGradient(0, gy, 0, H);
  dirtGrad.addColorStop(0, '#A1887F');
  dirtGrad.addColorStop(0.3, '#8D6E63');
  dirtGrad.addColorStop(1, '#5D4037');
  ctx.fillStyle = dirtGrad;
  ctx.fillRect(0, gy, W, GROUND_HEIGHT);

  // Dirt dots/texture
  ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
  for (let i = 0; i < 25; i++) {
    const dx = (i * 37 + groundOffset * 2) % (W + 20) - 10;
    const dy = gy + 25 + Math.sin(i * 2.3) * 12;
    ctx.beginPath();
    ctx.arc(dx, dy, 2 + Math.sin(i) * 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grass layer
  const grassGrad = ctx.createLinearGradient(0, gy, 0, gy + 18);
  grassGrad.addColorStop(0, '#66BB6A');
  grassGrad.addColorStop(0.5, '#4CAF50');
  grassGrad.addColorStop(1, '#388E3C');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, gy, W, 18);

  // Grass blades
  ctx.fillStyle = '#81C784';
  for (let i = 0; i < W + 24; i += 12) {
    const x = ((i - groundOffset * 1.5) % (W + 24));
    ctx.beginPath();
    ctx.moveTo(x - 4, gy + 18);
    ctx.lineTo(x, gy - 3);
    ctx.lineTo(x + 4, gy + 18);
    ctx.fill();
  }
  ctx.fillStyle = '#43A047';
  for (let i = 6; i < W + 24; i += 12) {
    const x = ((i - groundOffset * 1.2) % (W + 24));
    ctx.beginPath();
    ctx.moveTo(x - 3, gy + 18);
    ctx.lineTo(x, gy + 1);
    ctx.lineTo(x + 3, gy + 18);
    ctx.fill();
  }

  // Small flowers on grass
  for (let i = 0; i < 6; i++) {
    const fx = ((i * 73 + 20 - groundOffset * 0.8) % (W + 30)) - 15;
    const fy = gy + 3;
    // Stem
    ctx.strokeStyle = '#388E3C';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx, fy + 12);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    // Petals
    const petalColors = ['#FF8A80', '#FF80AB', '#FFAB91', '#FFE082', '#B39DDB'];
    ctx.fillStyle = petalColors[i % petalColors.length];
    const ps = 3;
    for (let p = 0; p < 5; p++) {
      const angle = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(angle) * ps, fy + Math.sin(angle) * ps, ps * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Center
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(fx, fy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground top border (thick cartoon line)
  ctx.strokeStyle = '#2E7D32';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(W, gy);
  ctx.stroke();
}

// ===== Draw Bird (Chunky Cartoon) =====
function drawBird() {
  ctx.save();
  ctx.translate(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2);

  // Squash & stretch based on velocity
  let scaleX = 1;
  let scaleY = 1;
  if (gameState === 'playing') {
    if (bird.vy < -3) {
      // Going up - stretch vertically
      scaleX = 0.9;
      scaleY = 1.15;
    } else if (bird.vy > 3) {
      // Going down - squash
      scaleX = 1.1;
      scaleY = 0.9;
    }
  }

  const rot = (bird.rotation * Math.PI) / 180;
  ctx.rotate(rot);
  ctx.scale(scaleX, scaleY);

  const wingOffset = Math.sin(wingPhase) * 5;
  const r = BIRD_SIZE / 2;

  // ---- Shadow under bird ----
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.beginPath();
  ctx.ellipse(2, r + 4, r * 0.7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- Tail feathers ----
  ctx.fillStyle = '#E6A800';
  ctx.strokeStyle = '#C48A00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r + 2, -3);
  ctx.lineTo(-r - 10, -6);
  ctx.lineTo(-r - 8, 0);
  ctx.lineTo(-r - 11, 4);
  ctx.lineTo(-r + 2, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ---- Wing (behind body) ----
  ctx.fillStyle = '#F9A825';
  ctx.strokeStyle = '#C48A00';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(-5, wingOffset + 2, 12, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Wing highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.ellipse(-5, wingOffset - 1, 7, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // ---- Body outline (thick!) ----
  ctx.fillStyle = '#C48A00';
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
  ctx.fill();

  // ---- Body gradient ----
  const bodyGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, r);
  bodyGrad.addColorStop(0, '#FFE082');
  bodyGrad.addColorStop(0.5, '#FFC107');
  bodyGrad.addColorStop(1, '#F9A825');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // ---- Body specular highlight ----
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-4, -6, r * 0.5, r * 0.35, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // ---- Belly ----
  ctx.fillStyle = '#FFF9C4';
  ctx.strokeStyle = 'rgba(194, 138, 0, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(-1, 5, r * 0.6, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ---- Cheeks (blush) ----
  ctx.fillStyle = 'rgba(255, 138, 101, 0.45)';
  ctx.beginPath();
  ctx.arc(-4, 4, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(10, 3, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // ---- Eye (HUGE, expressive) ----
  const eyeX = 6;
  const eyeY = -5;
  const eyeR = 8;

  // Eye outline
  ctx.fillStyle = '#3E2723';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeR + 2, 0, Math.PI * 2);
  ctx.fill();

  // Eye white
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  if (gameState === 'dead') {
    // X_X eyes
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    // X
    ctx.beginPath();
    ctx.moveTo(eyeX - 4, eyeY - 4);
    ctx.lineTo(eyeX + 4, eyeY + 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeX + 4, eyeY - 4);
    ctx.lineTo(eyeX - 4, eyeY + 4);
    ctx.stroke();
  } else {
    // Pupil - looks in direction of velocity
    const pupilOffsetY = Math.min(Math.max(bird.vy * 0.3, -2), 2);
    const pupilX = eyeX + 1.5;
    const pupilY = eyeY + pupilOffsetY;

    // Pupil
    ctx.fillStyle = '#1B5E20';
    ctx.beginPath();
    ctx.arc(pupilX, pupilY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Inner pupil
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(pupilX + 0.5, pupilY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine (specular)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(eyeX - 1, eyeY - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + 3, eyeY + 1, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrow - expressive
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    if (bird.vy < -2) {
      // Going up - determined look
      ctx.beginPath();
      ctx.moveTo(eyeX - 7, eyeY - 10);
      ctx.lineTo(eyeX + 5, eyeY - 12);
      ctx.stroke();
    } else if (bird.vy > 4) {
      // Falling fast - worried look
      ctx.beginPath();
      ctx.moveTo(eyeX - 5, eyeY - 13);
      ctx.lineTo(eyeX + 6, eyeY - 9);
      ctx.stroke();
    } else {
      // Normal
      ctx.beginPath();
      ctx.moveTo(eyeX - 6, eyeY - 11);
      ctx.lineTo(eyeX + 5, eyeY - 11);
      ctx.stroke();
    }
  }

  // ---- Beak (chunky triangle) ----
  ctx.fillStyle = '#FF5722';
  ctx.strokeStyle = '#BF360C';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(r - 2, -3);
  ctx.lineTo(r + 14, 1);
  ctx.lineTo(r - 2, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Beak highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(r, -1);
  ctx.lineTo(r + 8, 0);
  ctx.lineTo(r, 2);
  ctx.closePath();
  ctx.fill();

  // Beak nostril
  ctx.fillStyle = '#BF360C';
  ctx.beginPath();
  ctx.arc(r + 5, 0, 1, 0, Math.PI * 2);
  ctx.fill();

  // ---- Mouth line when dead ----
  if (gameState === 'dead') {
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r - 4, 8);
    ctx.quadraticCurveTo(r + 2, 6, r + 6, 9);
    ctx.stroke();
  }

  ctx.restore();
}

// ===== Game Loop =====
const gameLoop = new GameLoop({
  update,
  render: draw,
  fps: 60
});

// ===== Input Manager =====
const inputManager = new InputManager({
  keyboardTarget: document,
  touchTarget: canvas
});

inputManager.on('tap', () => {
  if (gameState === 'paused') {
    // Don't flap when paused - let modal buttons handle it
    return;
  }
  flap();
});

inputManager.on('keyPress', (key) => {
  if (key === ' ' || key === 'ArrowUp') {
    if (gameState === 'paused') return;
    flap();
  }
  if (key === 'Escape' || key === 'p' || key === 'P') {
    if (gameState === 'playing') {
      pauseGame();
    } else if (gameState === 'paused') {
      resumeGame();
    }
  }
});

// ===== Pause Button Events =====
pauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  pauseGame();
});

resumeBtn.addEventListener('click', resumeGame);
restartBtnPause.addEventListener('click', restartGame);

// ===== Game Over Modal Click =====
gameOverModal.addEventListener('click', () => {
  if (gameState === 'dead') {
    init();
  }
});

// ===== Save Stats =====
async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'flappybird',
      result: 'end',
      moves: score,
      time_seconds: 0,
      score: score,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// ===== Initialize =====
bestScore = parseInt(localStorage.getItem('flappy_best') || '0');
bestDisplay.textContent = bestScore;

// Handle resize
window.addEventListener('resize', () => {
  resizeCanvas();
  if (gameState === 'waiting') {
    // Reset bird position on resize during waiting
    bird.x = W * 0.2;
    bird.y = H / 2;
  }
  initClouds();
});

// Initial resize
resizeCanvas();
init();
