import '../../auth-check.js?v=4';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js?v=4';
import { GameStats } from '../shared/game-core.js?v=4';
import { GameLoop } from '../shared/game-loop.js?v=4';
import { InputManager } from '../shared/input-manager.js?v=4';
import { ParticleSystem } from '../shared/skills/particle-system/index.js?v=1';
import { shake, pulse } from '../shared/skills/animation-system/index.js?v=1';
import { onGameEnd } from '../shared/game-integration.js';
// =============================================
//  Space Invaders — "Batalha Espacial Cartoon"
//  Redesign 3.0: chunky cartoon com contornos grossos
// =============================================
import { supabase } from '../../supabase.js?v=2';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const overlayIcon = document.getElementById('overlay-icon');
const btnStart = document.getElementById('btn-start');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');
const waveDisplay = document.getElementById('wave-display');

// ===== SIZING =====
const BASE_W = 480;
const BASE_H = 640;
let scale = 1;

// ===== SISTEMA DE PARTICULAS =====
let particleSystem = null;

function resize() {
  const container = canvas.parentElement;
  const maxW = container.clientWidth - 16;
  const maxH = container.clientHeight - 16;
  scale = Math.min(maxW / BASE_W, maxH / BASE_H);
  canvas.width = Math.floor(BASE_W * scale);
  canvas.height = Math.floor(BASE_H * scale);

  if (!particleSystem && canvas) {
    particleSystem = new ParticleSystem(canvas, { autoResize: false });
  }
}
window.addEventListener('resize', resize);
resize();

// ===== GAME STATE =====
let state = 'idle'; // idle | playing | gameover
let paused = false;
let score = 0;
let lives = 3;
let wave = 1;

// Player
const PLAYER_W = 40;
const PLAYER_H = 16;
let playerX = BASE_W / 2;
const playerY = BASE_H - 30;
const playerSpeed = 4;

// Input (mobile)
let mobileLeft = false;
let mobileRight = false;
let mobileShoot = false;

// Bullets
let playerBullets = [];
let alienBullets = [];
const BULLET_SPEED = 6;
const ALIEN_BULLET_SPEED = 3;
const PLAYER_SHOOT_CD = 250; // ms
let lastShotTime = 0;

// Aliens
const ALIEN_COLS = 8;
const ALIEN_ROWS = 5;
const ALIEN_W = 28;
const ALIEN_H = 20;
const ALIEN_PAD_X = 10;
const ALIEN_PAD_Y = 10;
let aliens = [];
let alienDir = 1;
let alienBaseSpeed = 0.5;
let alienSpeed = alienBaseSpeed;
let alienMoveTimer = 0;
let alienMoveInterval = 40;
let alienShootTimer = 0;
let alienShootInterval = 90;

// Explosions
let explosions = [];

// ===== ANIMATION STATE =====
let frameCount = 0;
let alienAnimFrame = 0; // 0 or 1 for alien wiggle
let alienAnimTimer = 0;

// Background stars (pre-generated)
const bgStars = [];
for (let i = 0; i < 80; i++) {
  bgStars.push({
    x: Math.random() * BASE_W,
    y: Math.random() * BASE_H,
    size: 1 + Math.random() * 2.5,
    twinkleSpeed: 0.02 + Math.random() * 0.04,
    twinkleOffset: Math.random() * Math.PI * 2,
    color: Math.random() < 0.3 ? '#FFD54F' : Math.random() < 0.5 ? '#00E5FF' : '#FFFFFF',
  });
}

// Distant planets
const bgPlanets = [
  { x: BASE_W * 0.15, y: BASE_H * 0.12, r: 18, color1: '#6A1B9A', color2: '#4A148C', ring: true },
  { x: BASE_W * 0.82, y: BASE_H * 0.25, r: 10, color1: '#E65100', color2: '#BF360C', ring: false },
  { x: BASE_W * 0.55, y: BASE_H * 0.06, r: 7, color1: '#00838F', color2: '#006064', ring: false },
];

// ===== STATS =====
const gameStats = new GameStats('spaceinvaders', { autoSync: true });

// ===== ALIEN COLORS (cartoon) =====
const ALIEN_BODY_COLORS = ['#76FF03', '#E040FB', '#FF9100'];
const ALIEN_DARK_COLORS = ['#558B2F', '#7B1FA2', '#E65100'];
const ALIEN_LIGHT_COLORS = ['#B2FF59', '#EA80FC', '#FFAB40'];
const ALIEN_EYE_COLORS = ['#FFFFFF', '#FFFFFF', '#FFFFFF'];
const ALIEN_PUPIL_COLORS = ['#1B5E20', '#4A148C', '#BF360C'];
const ALIEN_POINTS = [30, 20, 10];

function getAlienType(row) {
  if (row <= 1) return 0;
  if (row <= 3) return 1;
  return 2;
}

// ===== INIT ALIENS =====
function initAliens() {
  aliens = [];
  const gridW = ALIEN_COLS * (ALIEN_W + ALIEN_PAD_X) - ALIEN_PAD_X;
  const startX = (BASE_W - gridW) / 2;
  const startY = 50;

  for (let r = 0; r < ALIEN_ROWS; r++) {
    for (let c = 0; c < ALIEN_COLS; c++) {
      aliens.push({
        x: startX + c * (ALIEN_W + ALIEN_PAD_X),
        y: startY + r * (ALIEN_H + ALIEN_PAD_Y),
        row: r,
        col: c,
        alive: true,
        type: getAlienType(r),
        hitFlash: 0,
      });
    }
  }
}

// ===== START / RESET =====
function startGame() {
  initAudio();
  score = 0;
  lives = 3;
  wave = 1;
  playerX = BASE_W / 2;
  playerBullets = [];
  alienBullets = [];
  explosions = [];
  alienDir = 1;
  alienBaseSpeed = 0.5;
  alienSpeed = alienBaseSpeed;
  alienMoveTimer = 0;
  alienMoveInterval = 40;
  alienShootInterval = 90;
  alienShootTimer = 0;
  frameCount = 0;
  initAliens();
  updateHUD();
  state = 'playing';
  paused = false;
  overlay.classList.add('hidden');
  gameLoop.start();
}

function nextWave() {
  wave++;
  playerBullets = [];
  alienBullets = [];
  alienDir = 1;
  alienBaseSpeed = Math.min(alienBaseSpeed + 0.2, 2.5);
  alienSpeed = alienBaseSpeed;
  alienMoveInterval = Math.max(alienMoveInterval - 4, 12);
  alienShootInterval = Math.max(alienShootInterval - 8, 30);
  alienMoveTimer = 0;
  alienShootTimer = 0;
  initAliens();
  updateHUD();
}

function updateHUD() {
  scoreDisplay.textContent = score;
  livesDisplay.textContent = lives;
  waveDisplay.textContent = wave;
}

// =============================================
//  CARTOON DRAWING FUNCTIONS
// =============================================

// Helper: draw rounded rect
function roundRect(x, y, w, h, r) {
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

// Helper: cartoon outline + fill
function fillAndStroke(fillColor, strokeColor, lineW) {
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineW;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

// ===== DRAW BACKGROUND =====
function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;

  // Deep space gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#0B0E2D');
  bgGrad.addColorStop(0.4, '#0D1138');
  bgGrad.addColorStop(0.7, '#121640');
  bgGrad.addColorStop(1, '#0B0E2D');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Nebula glow
  ctx.save();
  ctx.globalAlpha = 0.08;
  const neb1 = ctx.createRadialGradient(w * 0.2, h * 0.3, 0, w * 0.2, h * 0.3, w * 0.4);
  neb1.addColorStop(0, '#9C27B0');
  neb1.addColorStop(1, 'transparent');
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, w, h);

  const neb2 = ctx.createRadialGradient(w * 0.8, h * 0.7, 0, w * 0.8, h * 0.7, w * 0.35);
  neb2.addColorStop(0, '#00838F');
  neb2.addColorStop(1, 'transparent');
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Distant planets
  for (const p of bgPlanets) {
    const px = p.x * scale;
    const py = p.y * scale;
    const pr = p.r * scale;

    ctx.save();
    ctx.globalAlpha = 0.35;

    // Planet body
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    const pGrad = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
    pGrad.addColorStop(0, p.color1);
    pGrad.addColorStop(1, p.color2);
    ctx.fillStyle = pGrad;
    ctx.fill();

    // Planet ring
    if (p.ring) {
      ctx.beginPath();
      ctx.ellipse(px, py, pr * 1.8, pr * 0.4, -0.3, 0, Math.PI * 2);
      ctx.strokeStyle = p.color1;
      ctx.lineWidth = 2 * scale;
      ctx.globalAlpha = 0.25;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Twinkling stars
  for (const star of bgStars) {
    const sx = star.x * scale;
    const sy = star.y * scale;
    const alpha = 0.3 + 0.7 * Math.abs(Math.sin(frameCount * star.twinkleSpeed + star.twinkleOffset));

    ctx.save();
    ctx.globalAlpha = alpha;

    // Star glow
    if (star.size > 2) {
      ctx.beginPath();
      ctx.arc(sx, sy, star.size * scale * 2, 0, Math.PI * 2);
      ctx.fillStyle = star.color;
      ctx.globalAlpha = alpha * 0.15;
      ctx.fill();
      ctx.globalAlpha = alpha;
    }

    // Star core
    ctx.beginPath();
    ctx.arc(sx, sy, star.size * scale * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = star.color;
    ctx.fill();

    // Cross sparkle for bigger stars
    if (star.size > 2) {
      ctx.strokeStyle = star.color;
      ctx.lineWidth = 0.5 * scale;
      ctx.globalAlpha = alpha * 0.5;
      const len = star.size * scale;
      ctx.beginPath();
      ctx.moveTo(sx - len, sy);
      ctx.lineTo(sx + len, sy);
      ctx.moveTo(sx, sy - len);
      ctx.lineTo(sx, sy + len);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ===== DRAW BORDER FRAME =====
function drawBorderFrame() {
  const s = scale;
  const w = canvas.width;
  const h = canvas.height;
  const bw = 6 * s; // border width

  ctx.save();

  // Metallic border panels (top, bottom, left, right)
  const metalGrad = ctx.createLinearGradient(0, 0, 0, bw);
  metalGrad.addColorStop(0, '#3D4480');
  metalGrad.addColorStop(0.5, '#232866');
  metalGrad.addColorStop(1, '#1A1F4E');

  ctx.fillStyle = metalGrad;
  // Top
  ctx.fillRect(0, 0, w, bw);
  // Bottom
  ctx.fillRect(0, h - bw, w, bw);
  // Left
  ctx.fillRect(0, 0, bw, h);
  // Right
  ctx.fillRect(w - bw, 0, bw, h);

  // LED dots on border
  ctx.fillStyle = '#00E5FF';
  const ledSpacing = 30 * s;
  const ledR = 1.5 * s;
  const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.05);

  ctx.globalAlpha = 0.3 + pulse * 0.4;
  // Top LEDs
  for (let lx = ledSpacing; lx < w - ledSpacing; lx += ledSpacing) {
    ctx.beginPath();
    ctx.arc(lx, bw * 0.5, ledR, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bottom LEDs
  for (let lx = ledSpacing; lx < w - ledSpacing; lx += ledSpacing) {
    ctx.beginPath();
    ctx.arc(lx, h - bw * 0.5, ledR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ===== DRAW PLAYER (Cartoon Spaceship) =====
function drawPlayer() {
  const s = scale;
  const x = playerX * s;
  const y = playerY * s;
  const w = PLAYER_W * s;
  const h = PLAYER_H * s;
  const outW = 3 * s;

  ctx.save();

  // Shadow under ship
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.8, w * 0.5, 4 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
  ctx.fill();

  // Thruster flames (animated)
  const flameH = (8 + Math.sin(frameCount * 0.5) * 4) * s;
  const flameW = 6 * s;

  // Left thruster
  ctx.beginPath();
  ctx.moveTo(x - w * 0.25 - flameW / 2, y + h * 0.3);
  ctx.lineTo(x - w * 0.25, y + h * 0.3 + flameH);
  ctx.lineTo(x - w * 0.25 + flameW / 2, y + h * 0.3);
  ctx.closePath();
  const flameGrad1 = ctx.createLinearGradient(0, y + h * 0.3, 0, y + h * 0.3 + flameH);
  flameGrad1.addColorStop(0, '#FFD54F');
  flameGrad1.addColorStop(0.4, '#FF6D00');
  flameGrad1.addColorStop(1, 'rgba(255, 50, 0, 0)');
  ctx.fillStyle = flameGrad1;
  ctx.fill();

  // Right thruster
  ctx.beginPath();
  ctx.moveTo(x + w * 0.25 - flameW / 2, y + h * 0.3);
  ctx.lineTo(x + w * 0.25, y + h * 0.3 + flameH);
  ctx.lineTo(x + w * 0.25 + flameW / 2, y + h * 0.3);
  ctx.closePath();
  ctx.fillStyle = flameGrad1;
  ctx.fill();

  // Center thruster (bigger)
  const cFlameH = (12 + Math.sin(frameCount * 0.6 + 1) * 5) * s;
  ctx.beginPath();
  ctx.moveTo(x - flameW * 0.6, y + h * 0.3);
  ctx.lineTo(x, y + h * 0.3 + cFlameH);
  ctx.lineTo(x + flameW * 0.6, y + h * 0.3);
  ctx.closePath();
  const flameGrad2 = ctx.createLinearGradient(0, y + h * 0.3, 0, y + h * 0.3 + cFlameH);
  flameGrad2.addColorStop(0, '#FFFFFF');
  flameGrad2.addColorStop(0.2, '#00E5FF');
  flameGrad2.addColorStop(0.6, '#FF6D00');
  flameGrad2.addColorStop(1, 'rgba(255, 50, 0, 0)');
  ctx.fillStyle = flameGrad2;
  ctx.fill();

  // Main body (chunky rounded ship)
  ctx.beginPath();
  // Ship hull
  ctx.moveTo(x - w * 0.45, y + h * 0.3);
  ctx.lineTo(x - w * 0.35, y - h * 0.3);
  ctx.lineTo(x - w * 0.1, y - h * 0.6);
  ctx.lineTo(x, y - h * 1.0);
  ctx.lineTo(x + w * 0.1, y - h * 0.6);
  ctx.lineTo(x + w * 0.35, y - h * 0.3);
  ctx.lineTo(x + w * 0.45, y + h * 0.3);
  ctx.closePath();

  // Fill with gradient
  const shipGrad = ctx.createLinearGradient(x - w * 0.5, y, x + w * 0.5, y);
  shipGrad.addColorStop(0, '#1565C0');
  shipGrad.addColorStop(0.3, '#42A5F5');
  shipGrad.addColorStop(0.5, '#64B5F6');
  shipGrad.addColorStop(0.7, '#42A5F5');
  shipGrad.addColorStop(1, '#1565C0');
  fillAndStroke(shipGrad, '#0D47A1', outW);

  // Wings
  // Left wing
  ctx.beginPath();
  ctx.moveTo(x - w * 0.35, y - h * 0.1);
  ctx.lineTo(x - w * 0.7, y + h * 0.5);
  ctx.lineTo(x - w * 0.6, y + h * 0.5);
  ctx.lineTo(x - w * 0.35, y + h * 0.15);
  ctx.closePath();
  fillAndStroke('#1E88E5', '#0D47A1', outW * 0.8);

  // Right wing
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y - h * 0.1);
  ctx.lineTo(x + w * 0.7, y + h * 0.5);
  ctx.lineTo(x + w * 0.6, y + h * 0.5);
  ctx.lineTo(x + w * 0.35, y + h * 0.15);
  ctx.closePath();
  fillAndStroke('#1E88E5', '#0D47A1', outW * 0.8);

  // Wing tips glow
  ctx.beginPath();
  ctx.arc(x - w * 0.65, y + h * 0.5, 3 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#00E5FF';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.65, y + h * 0.5, 3 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#00E5FF';
  ctx.fill();

  // Cockpit (cartoon bubble)
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.25, 7 * s, 6 * s, 0, 0, Math.PI * 2);
  const cockpitGrad = ctx.createRadialGradient(x - 2 * s, y - h * 0.3, 0, x, y - h * 0.25, 7 * s);
  cockpitGrad.addColorStop(0, '#B3E5FC');
  cockpitGrad.addColorStop(0.5, '#4FC3F7');
  cockpitGrad.addColorStop(1, '#0288D1');
  fillAndStroke(cockpitGrad, '#01579B', 2 * s);

  // Cockpit shine
  ctx.beginPath();
  ctx.ellipse(x - 2 * s, y - h * 0.35, 3 * s, 2 * s, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();

  // Cannon tip
  ctx.beginPath();
  ctx.moveTo(x - 2.5 * s, y - h * 0.8);
  ctx.lineTo(x, y - h * 1.3);
  ctx.lineTo(x + 2.5 * s, y - h * 0.8);
  ctx.closePath();
  fillAndStroke('#90CAF9', '#0D47A1', outW * 0.7);

  // Body highlight
  ctx.beginPath();
  ctx.moveTo(x - w * 0.1, y - h * 0.5);
  ctx.lineTo(x - w * 0.05, y + h * 0.1);
  ctx.lineTo(x + w * 0.05, y + h * 0.1);
  ctx.lineTo(x + w * 0.1, y - h * 0.5);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fill();

  ctx.restore();
}

// ===== DRAW ALIEN (Cartoon Monster) =====
function drawAlien(a) {
  const s = scale;
  const cx = (a.x + ALIEN_W / 2) * s;
  const cy = (a.y + ALIEN_H / 2) * s;
  const w = ALIEN_W * s;
  const h = ALIEN_H * s;
  const outW = 2.5 * s;
  const type = a.type;
  const wiggle = alienAnimFrame ? 1 : -1;

  ctx.save();

  // Shadow under alien
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.6, w * 0.35, 3 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fill();

  if (type === 0) {
    // TYPE 0: Green Bug alien — antenna + round body
    const bodyColor = ALIEN_BODY_COLORS[0];
    const darkColor = ALIEN_DARK_COLORS[0];
    const lightColor = ALIEN_LIGHT_COLORS[0];

    // Antennae
    const antY = cy - h * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, cy - h * 0.35);
    ctx.quadraticCurveTo(cx - w * 0.3, antY - 5 * s, cx - w * 0.25, antY);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Antenna ball
    ctx.beginPath();
    ctx.arc(cx - w * 0.25, antY, 3 * s, 0, Math.PI * 2);
    fillAndStroke(lightColor, darkColor, 1.5 * s);

    ctx.beginPath();
    ctx.moveTo(cx + w * 0.15, cy - h * 0.35);
    ctx.quadraticCurveTo(cx + w * 0.3, antY - 5 * s, cx + w * 0.25, antY);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + w * 0.25, antY, 3 * s, 0, Math.PI * 2);
    fillAndStroke(lightColor, darkColor, 1.5 * s);

    // Main body (rounded blob)
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.42, h * 0.45, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(cx - 3 * s, cy - 3 * s, 0, cx, cy, w * 0.42);
    bodyGrad.addColorStop(0, lightColor);
    bodyGrad.addColorStop(1, bodyColor);
    fillAndStroke(bodyGrad, darkColor, outW);

    // Belly
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.1, w * 0.25, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = lightColor;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Little legs (wiggle)
    const legOff = wiggle * 2 * s;
    for (let lx = -1; lx <= 1; lx += 2) {
      ctx.beginPath();
      ctx.moveTo(cx + lx * w * 0.2, cy + h * 0.35);
      ctx.lineTo(cx + lx * w * 0.3, cy + h * 0.55 + legOff * lx);
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 2.5 * s;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

  } else if (type === 1) {
    // TYPE 1: Purple Tentacle alien
    const bodyColor = ALIEN_BODY_COLORS[1];
    const darkColor = ALIEN_DARK_COLORS[1];
    const lightColor = ALIEN_LIGHT_COLORS[1];

    // Tentacles (wiggling)
    const tentOff = wiggle * 2.5 * s;
    for (let t = -1.5; t <= 1.5; t += 1) {
      ctx.beginPath();
      ctx.moveTo(cx + t * w * 0.15, cy + h * 0.25);
      ctx.quadraticCurveTo(
        cx + t * w * 0.2 + tentOff * (t > 0 ? 1 : -1),
        cy + h * 0.5,
        cx + t * w * 0.15,
        cy + h * 0.65
      );
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 2 * s;
      ctx.stroke();
    }

    // Main body (dome-shaped)
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.4, cy + h * 0.2);
    ctx.quadraticCurveTo(cx - w * 0.42, cy - h * 0.35, cx, cy - h * 0.45);
    ctx.quadraticCurveTo(cx + w * 0.42, cy - h * 0.35, cx + w * 0.4, cy + h * 0.2);
    ctx.lineTo(cx - w * 0.4, cy + h * 0.2);
    ctx.closePath();
    const bodyGrad = ctx.createRadialGradient(cx - 2 * s, cy - 4 * s, 0, cx, cy, w * 0.4);
    bodyGrad.addColorStop(0, lightColor);
    bodyGrad.addColorStop(1, bodyColor);
    fillAndStroke(bodyGrad, darkColor, outW);

    // Spots
    ctx.beginPath();
    ctx.arc(cx - w * 0.12, cy - h * 0.1, 2.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = darkColor;
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + w * 0.18, cy, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

  } else {
    // TYPE 2: Orange Crab alien
    const bodyColor = ALIEN_BODY_COLORS[2];
    const darkColor = ALIEN_DARK_COLORS[2];
    const lightColor = ALIEN_LIGHT_COLORS[2];

    // Claws (wiggle)
    const clawOff = wiggle * 3 * s;
    // Left claw
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.35, cy);
    ctx.lineTo(cx - w * 0.55, cy - h * 0.1 + clawOff);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Claw pincer
    ctx.beginPath();
    ctx.arc(cx - w * 0.55, cy - h * 0.1 + clawOff, 4 * s, 0, Math.PI * 2);
    fillAndStroke(bodyColor, darkColor, 2 * s);

    // Right claw
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.35, cy);
    ctx.lineTo(cx + w * 0.55, cy - h * 0.1 - clawOff);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + w * 0.55, cy - h * 0.1 - clawOff, 4 * s, 0, Math.PI * 2);
    fillAndStroke(bodyColor, darkColor, 2 * s);

    // Main body (wide oval)
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.38, h * 0.4, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(cx - 2 * s, cy - 3 * s, 0, cx, cy, w * 0.38);
    bodyGrad.addColorStop(0, lightColor);
    bodyGrad.addColorStop(1, bodyColor);
    fillAndStroke(bodyGrad, darkColor, outW);

    // Little legs
    for (let lx = -1; lx <= 1; lx += 2) {
      ctx.beginPath();
      ctx.moveTo(cx + lx * w * 0.15, cy + h * 0.35);
      ctx.lineTo(cx + lx * w * 0.25, cy + h * 0.6);
      ctx.moveTo(cx + lx * w * 0.25, cy + h * 0.35);
      ctx.lineTo(cx + lx * w * 0.32, cy + h * 0.55);
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 2 * s;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  // ---- EYES (all types) ----
  const eyeW = 5 * s;
  const eyeH = 5.5 * s;
  const eyeY = cy - h * 0.1;
  const eyeSpacing = w * 0.16;
  const pupilColor = ALIEN_PUPIL_COLORS[type];

  // Left eye
  ctx.beginPath();
  ctx.ellipse(cx - eyeSpacing, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
  fillAndStroke('#FFFFFF', ALIEN_DARK_COLORS[type], 1.5 * s);
  // Pupil
  ctx.beginPath();
  ctx.arc(cx - eyeSpacing + 1 * s, eyeY + 1 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fillStyle = pupilColor;
  ctx.fill();
  // Eye shine
  ctx.beginPath();
  ctx.arc(cx - eyeSpacing - 1 * s, eyeY - 1.5 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();

  // Right eye
  ctx.beginPath();
  ctx.ellipse(cx + eyeSpacing, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
  fillAndStroke('#FFFFFF', ALIEN_DARK_COLORS[type], 1.5 * s);
  ctx.beginPath();
  ctx.arc(cx + eyeSpacing + 1 * s, eyeY + 1 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fillStyle = pupilColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + eyeSpacing - 1 * s, eyeY - 1.5 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();

  // Mouth (small)
  ctx.beginPath();
  if (type === 1) {
    // Open mouth for tentacle alien
    ctx.ellipse(cx, cy + h * 0.12, 3 * s, 2 * s, 0, 0, Math.PI);
    fillAndStroke(ALIEN_DARK_COLORS[type], ALIEN_DARK_COLORS[type], 1 * s);
  } else {
    // Smile for others
    ctx.arc(cx, cy + h * 0.05, 4 * s, 0.15, Math.PI - 0.15, false);
    ctx.strokeStyle = ALIEN_DARK_COLORS[type];
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Specular highlight on body
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.08, cy - h * 0.22, 3 * s, 2 * s, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fill();

  ctx.restore();
}

// ===== DRAW BULLET (Cartoon Laser) =====
function drawBullet(b, isPlayer = false) {
  const s = scale;
  const bx = b.x * s;
  const by = b.y * s;

  ctx.save();

  if (isPlayer) {
    // Player laser — cyan glow beam
    const laserW = 4 * s;
    const laserH = 12 * s;

    // Glow
    ctx.beginPath();
    ctx.ellipse(bx, by, laserW * 2, laserH * 1.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.fill();

    // Outer beam
    roundRect(bx - laserW / 2, by - laserH / 2, laserW, laserH, 3 * s);
    fillAndStroke('#00E5FF', '#0097A7', 2 * s);

    // Inner bright core
    roundRect(bx - laserW * 0.25, by - laserH * 0.4, laserW * 0.5, laserH * 0.8, 2 * s);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Tip sparkle
    ctx.beginPath();
    ctx.arc(bx, by - laserH / 2, 2.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

  } else {
    // Alien laser — red/orange energy ball
    const ballR = 4 * s;

    // Glow
    ctx.beginPath();
    ctx.arc(bx, by, ballR * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 50, 50, 0.12)';
    ctx.fill();

    // Main ball
    ctx.beginPath();
    ctx.arc(bx, by, ballR, 0, Math.PI * 2);
    const ballGrad = ctx.createRadialGradient(bx - 1 * s, by - 1 * s, 0, bx, by, ballR);
    ballGrad.addColorStop(0, '#FFD54F');
    ballGrad.addColorStop(0.5, '#FF5252');
    ballGrad.addColorStop(1, '#D32F2F');
    fillAndStroke(ballGrad, '#B71C1C', 2 * s);

    // Shine
    ctx.beginPath();
    ctx.arc(bx - 1.5 * s, by - 1.5 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();

    // Trail
    ctx.beginPath();
    ctx.moveTo(bx - 2 * s, by - ballR);
    ctx.lineTo(bx, by - ballR - 6 * s);
    ctx.lineTo(bx + 2 * s, by - ballR);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 82, 82, 0.3)';
    ctx.fill();
  }

  ctx.restore();
}

// ===== DRAW EXPLOSIONS (Cartoon) =====
function drawExplosions() {
  const s = scale;
  for (const ex of explosions) {
    const progress = 1 - ex.life / ex.maxLife;
    const alpha = 1 - progress;
    const size = (12 + progress * 20) * s;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer ring
    ctx.beginPath();
    ctx.arc(ex.x * s, ex.y * s, size, 0, Math.PI * 2);
    ctx.strokeStyle = '#FF6D00';
    ctx.lineWidth = 3 * s * alpha;
    ctx.stroke();

    // Inner flash
    ctx.beginPath();
    ctx.arc(ex.x * s, ex.y * s, size * 0.6, 0, Math.PI * 2);
    const exGrad = ctx.createRadialGradient(ex.x * s, ex.y * s, 0, ex.x * s, ex.y * s, size * 0.6);
    exGrad.addColorStop(0, '#FFFFFF');
    exGrad.addColorStop(0.3, '#FFD54F');
    exGrad.addColorStop(1, 'rgba(255, 109, 0, 0)');
    ctx.fillStyle = exGrad;
    ctx.fill();

    // Star sparks
    const sparkCount = 6;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + progress * 2;
      const dist = size * (0.8 + progress * 0.5);
      const sx = ex.x * s + Math.cos(angle) * dist;
      const sy = ex.y * s + Math.sin(angle) * dist;
      const sparkSize = 3 * s * alpha;

      // 4-point star
      ctx.beginPath();
      ctx.moveTo(sx, sy - sparkSize);
      ctx.lineTo(sx + sparkSize * 0.3, sy);
      ctx.lineTo(sx, sy + sparkSize);
      ctx.lineTo(sx - sparkSize * 0.3, sy);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#FFD54F' : '#FF6D00';
      ctx.fill();
    }

    ctx.restore();
  }
}

// ===== DRAW LIVES INDICATOR (mini ships) =====
function drawLivesIndicator() {
  const s = scale;
  const startX = 15 * s;
  const y = (BASE_H - 10) * s;
  const miniSize = 6 * s;

  for (let i = 0; i < lives; i++) {
    const mx = startX + i * (miniSize * 3);
    ctx.beginPath();
    ctx.moveTo(mx - miniSize, y);
    ctx.lineTo(mx, y - miniSize * 1.5);
    ctx.lineTo(mx + miniSize, y);
    ctx.closePath();
    fillAndStroke('#42A5F5', '#0D47A1', 1.5 * s);
  }
}

// ===== UPDATE =====
function update(dt) {
  if (state !== 'playing' || paused) return;

  frameCount++;

  // Alien animation frame toggle
  alienAnimTimer++;
  if (alienAnimTimer >= 15) {
    alienAnimTimer = 0;
    alienAnimFrame = 1 - alienAnimFrame;
  }

  // Player movement
  let dx = 0;
  const keys = inputManager._keys;
  if (keys.get('ArrowLeft') || keys.get('a') || keys.get('A') || mobileLeft) dx -= playerSpeed;
  if (keys.get('ArrowRight') || keys.get('d') || keys.get('D') || mobileRight) dx += playerSpeed;

  // Particulas de fumaca ao mover
  if (dx !== 0 && particleSystem && Math.random() < 0.3) {
    particleSystem.emit({
      x: playerX * scale,
      y: (playerY + PLAYER_H / 2) * scale,
      count: 2,
      type: 'smoke',
      color: ['rgba(0, 229, 255, 0.5)', 'rgba(100, 100, 100, 0.3)'],
      speed: 1,
      spread: 60,
      life: 0.6
    });
  }

  playerX += dx;
  playerX = Math.max(PLAYER_W / 2 + 4, Math.min(BASE_W - PLAYER_W / 2 - 4, playerX));

  // Player shoot
  const now = performance.now();
  if ((keys.get(' ') || keys.get('ArrowUp') || mobileShoot) && now - lastShotTime > PLAYER_SHOOT_CD) {
    lastShotTime = now;
    playerBullets.push({ x: playerX, y: playerY - PLAYER_H / 2 - 8 });
    playSound('shoot');
  }

  // Player bullets
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    playerBullets[i].y -= BULLET_SPEED;
    if (playerBullets[i].y < 0) {
      playerBullets.splice(i, 1);
    }
  }

  // Alien movement
  alienMoveTimer++;
  if (alienMoveTimer >= alienMoveInterval) {
    alienMoveTimer = 0;
    let edgeHit = false;
    for (const a of aliens) {
      if (!a.alive) continue;
      if ((alienDir > 0 && a.x + ALIEN_W + alienSpeed > BASE_W - 5) ||
          (alienDir < 0 && a.x - alienSpeed < 5)) {
        edgeHit = true;
        break;
      }
    }

    if (edgeHit) {
      alienDir *= -1;
      for (const a of aliens) {
        if (a.alive) a.y += 12;
      }
    } else {
      for (const a of aliens) {
        if (a.alive) a.x += alienSpeed * alienDir * 8;
      }
    }
  }

  // Alien shooting
  alienShootTimer++;
  if (alienShootTimer >= alienShootInterval) {
    alienShootTimer = 0;
    const bottomAliens = [];
    for (let c = 0; c < ALIEN_COLS; c++) {
      let bottom = null;
      for (const a of aliens) {
        if (a.alive && a.col === c) {
          if (!bottom || a.row > bottom.row) bottom = a;
        }
      }
      if (bottom) bottomAliens.push(bottom);
    }
    if (bottomAliens.length > 0) {
      const shooter = bottomAliens[Math.floor(Math.random() * bottomAliens.length)];
      alienBullets.push({
        x: shooter.x + ALIEN_W / 2,
        y: shooter.y + ALIEN_H,
      });
    }
  }

  // Alien bullets
  for (let i = alienBullets.length - 1; i >= 0; i--) {
    alienBullets[i].y += ALIEN_BULLET_SPEED;
    if (alienBullets[i].y > BASE_H) {
      alienBullets.splice(i, 1);
    }
  }

  // Collision: player bullets vs aliens
  for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
    const b = playerBullets[bi];
    for (const a of aliens) {
      if (!a.alive) continue;
      if (b.x > a.x && b.x < a.x + ALIEN_W &&
          b.y > a.y && b.y < a.y + ALIEN_H) {
        a.alive = false;
        playerBullets.splice(bi, 1);
        score += ALIEN_POINTS[a.type];

        // Explosao de particulas ao matar alien
        if (particleSystem) {
          particleSystem.emit({
            x: (a.x + ALIEN_W / 2) * scale,
            y: (a.y + ALIEN_H / 2) * scale,
            count: 15,
            type: 'explosion',
            color: [ALIEN_BODY_COLORS[a.type], '#ffffff', '#FFD54F'],
            speed: 5,
            spread: 360,
            life: 0.8
          });
        }

        explosions.push({
          x: a.x + ALIEN_W / 2,
          y: a.y + ALIEN_H / 2,
          life: 15,
          maxLife: 15,
        });
        playSound('explosion');
        updateHUD();

        const aliveCount = aliens.filter(al => al.alive).length;
        if (aliveCount > 0) {
          const ratio = 1 - (aliveCount / (ALIEN_ROWS * ALIEN_COLS));
          alienSpeed = alienBaseSpeed + ratio * 2.5;
          alienMoveInterval = Math.max(
            Math.floor(40 - ratio * 28 - (wave - 1) * 3),
            6
          );
        }
        break;
      }
    }
  }

  // Collision: alien bullets vs player
  for (let i = alienBullets.length - 1; i >= 0; i--) {
    const b = alienBullets[i];
    if (b.x > playerX - PLAYER_W / 2 && b.x < playerX + PLAYER_W / 2 &&
        b.y > playerY - PLAYER_H / 2 && b.y < playerY + PLAYER_H / 2 + 8) {
      alienBullets.splice(i, 1);
      lives--;
      updateHUD();

      // Screen shake quando nave e atingida
      shake(document.body, { intensity: lives <= 1 ? 'high' : 'medium', duration: 400 });

      // Explosao de particulas na nave
      if (particleSystem) {
        particleSystem.emit({
          x: playerX * scale,
          y: playerY * scale,
          count: 20,
          type: 'fire',
          color: ['#00E5FF', '#ffffff', '#FF6D00', '#FFD54F'],
          speed: 6,
          spread: 360,
          life: 1.0
        });
      }

      explosions.push({
        x: playerX,
        y: playerY,
        life: 20,
        maxLife: 20,
      });
      if (lives <= 0) {
        gameOver();
        return;
      }
    }
  }

  // Collision: aliens reaching player row
  for (const a of aliens) {
    if (a.alive && a.y + ALIEN_H >= playerY - PLAYER_H) {
      gameOver();
      return;
    }
  }

  // Check wave clear
  const aliveCount = aliens.filter(a => a.alive).length;
  if (aliveCount === 0) {
    nextWave();
  }

  // Update explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].life--;
    if (explosions[i].life <= 0) explosions.splice(i, 1);
  }
}

async function gameOver() {
  state = 'gameover';
  gameLoop.pause();
  overlayIcon.innerHTML = '&#128128;';
  overlayTitle.textContent = 'Fim de Jogo';
  overlayMsg.textContent = `Onda ${wave} alcancada`;
  overlayScore.textContent = `Pontuacao: ${score}`;
  btnStart.textContent = 'Jogar de Novo';
  overlay.classList.remove('hidden');
  playSound('gameover');

  // Save stats
  gameStats.recordGame(false, { score });
  onGameEnd('spaceinvaders', { won: false, score });

  // Save to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('game_stats').insert({
        user_id: user.id,
        game: 'spaceinvaders',
        result: 'end',
        moves: 0,
        time_seconds: 0,
        score: score,
      });
    }
  } catch (e) {
    // silent
  }
}

// ===== RENDER =====
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  drawBackground();

  // Border frame
  drawBorderFrame();

  if (state !== 'playing') {
    return;
  }

  // Aliens
  for (const a of aliens) {
    if (a.alive) drawAlien(a);
  }

  // Player
  drawPlayer();

  // Player bullets
  for (const b of playerBullets) {
    drawBullet(b, true);
  }

  // Alien bullets
  for (const b of alienBullets) {
    drawBullet(b, false);
  }

  // Explosions
  drawExplosions();

  // Lives indicator
  drawLivesIndicator();

  // Atualiza sistema de particulas
  if (particleSystem) {
    particleSystem.update(false);
  }

  // Pausa overlay
  if (paused) {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = 'rgba(11, 14, 45, 0.7)';
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    // Paused text with cartoon style
    ctx.font = 'bold 36px Nunito';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    // Text outline
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 6;
    ctx.strokeText('PAUSADO', BASE_W / 2, BASE_H / 2 - 10);
    // Text fill
    ctx.fillStyle = '#00E5FF';
    ctx.fillText('PAUSADO', BASE_W / 2, BASE_H / 2 - 10);
    // Subtitle
    ctx.font = '600 16px Nunito';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Pressione P para continuar', BASE_W / 2, BASE_H / 2 + 25);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

// ===== GAME LOOP =====
const gameLoop = new GameLoop({
  update,
  render,
  fps: 60
});

// ===== INPUT MANAGER =====
const inputManager = new InputManager({
  keyboardTarget: document,
  preventDefault: true
});

// Prevent default browser behavior for game keys
document.addEventListener('keydown', (e) => {
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
});

// Pause toggle
inputManager.on('keyDown', (key) => {
  if ((key === 'p' || key === 'P' || key === 'Escape') && state === 'playing') {
    paused = !paused;
  }
  if (state !== 'playing' && (key === ' ' || key === 'Enter')) {
    startGame();
  }
});

// ===== INPUT: MOBILE BUTTONS =====
const ctrlBtns = document.querySelectorAll('.ctrl-btn');
ctrlBtns.forEach(btn => {
  const dir = btn.dataset.dir;

  const onDown = (e) => {
    e.preventDefault();
    if (dir === 'left') mobileLeft = true;
    else if (dir === 'right') mobileRight = true;
    else if (dir === 'shoot') mobileShoot = true;
  };
  const onUp = (e) => {
    e.preventDefault();
    if (dir === 'left') mobileLeft = false;
    else if (dir === 'right') mobileRight = false;
    else if (dir === 'shoot') mobileShoot = false;
  };

  btn.addEventListener('touchstart', onDown, { passive: false });
  btn.addEventListener('touchend', onUp, { passive: false });
  btn.addEventListener('touchcancel', onUp, { passive: false });
  btn.addEventListener('mousedown', onDown);
  btn.addEventListener('mouseup', onUp);
  btn.addEventListener('mouseleave', onUp);
});

// ===== START BUTTON =====
btnStart.addEventListener('click', () => {
  btnStart.blur();
  startGame();
});

// ===== INIT =====
render();
