import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic, initAudio } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameLoop } from '../shared/game-loop.js';
import { InputManager } from '../shared/input-manager.js';
// ===== Dino Runner — Redesign 3.0 "Dino Aventura Cartoon" =====
import { supabase } from '../../supabase.js';
import { onGameEnd } from '../shared/game-integration.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const bestDisplay = document.getElementById('best-display');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const overlayIcon = document.getElementById('overlay-icon');
const btnStart = document.getElementById('btn-start');

const W = 800, H = 300;
canvas.width = W;
canvas.height = H;

// ===== CONSTANTES =====
const GROUND_Y = H - 40;
const DINO_W = 40, DINO_H = 50;
const DINO_DUCK_H = 28;
const DINO_X = 60;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const INITIAL_SPEED = 5;
const MAX_SPEED = 14;
const SPEED_INCREMENT = 0.001;

// ===== CARTOON COLORS =====
const C = {
  // Sky
  skyTop:     '#4FC3F7',
  skyBot:     '#B3E5FC',
  // Ground
  groundDark: '#6D4C41',
  groundMid:  '#8D6E63',
  groundLight:'#A1887F',
  grassDark:  '#388E3C',
  grassLight: '#66BB6A',
  grassBright:'#A5D6A7',
  // Dino
  dinoBody:   '#4CAF50',
  dinoLight:  '#66BB6A',
  dinoDark:   '#2E7D32',
  dinoOutline:'#1B5E20',
  dinoBelly:  '#81C784',
  dinoCheek:  '#FF8A80',
  eyeWhite:   '#FFFFFF',
  eyePupil:   '#1B5E20',
  // Cactus
  cactusBody: '#4CAF50',
  cactusLight:'#66BB6A',
  cactusDark: '#2E7D32',
  cactusOutline:'#1B5E20',
  cactusSpine:'#FFF9C4',
  // Ptero
  pteroBody:  '#7E57C2',
  pteroLight: '#B39DDB',
  pteroDark:  '#4527A0',
  pteroOutline:'#311B92',
  pteroBeak:  '#FF9800',
  // Clouds
  cloudWhite: '#FFFFFF',
  cloudShadow:'#E1F5FE',
  // Sun
  sunYellow:  '#FFEE58',
  sunOrange:  '#FFD54F',
  // Mountains
  mtFar:      '#90CAF9',
  mtMid:      '#64B5F6',
  mtNear:     '#42A5F5',
  mtSnow:     '#FFFFFF',
  // Decorations
  flowerPink: '#F48FB1',
  flowerYellow:'#FFF176',
  flowerWhite:'#FFFFFF',
  petalCenter:'#FFC107',
};

// ===== ESTADO =====
let dino, obstacles, clouds, score, bestScore, speed, gameState, frameCount;
let isDucking = false;
let paused = false;
let shakeFrames = 0;
let obstaclesCrossed = 0;
let comboPopup = null;

// Decorations
let mountains = [];
let groundDetails = [];
let flowers = [];
let particles = [];

bestScore = parseInt(localStorage.getItem('dino_best') || '0');
bestDisplay.textContent = bestScore;

// ===== STATS =====
const gameStats = new GameStats('dinorunner', { autoSync: true });

// ===== CLASSES =====
function createDino() {
  return {
    x: DINO_X,
    y: GROUND_Y - DINO_H,
    w: DINO_W,
    h: DINO_H,
    vy: 0,
    grounded: true,
    legFrame: 0
  };
}

function createCactus(x) {
  const types = [
    { w: 16, h: 35 },
    { w: 24, h: 45 },
    { w: 14, h: 28 },
    { w: 30, h: 40 },
    { w: 20, h: 50 },
  ];
  const t = types[Math.floor(Math.random() * types.length)];
  return { x, y: GROUND_Y - t.h, w: t.w, h: t.h, type: 'cactus' };
}

function createPterodactyl(x) {
  const flyH = GROUND_Y - 70 - Math.random() * 50;
  return { x, y: flyH, w: 40, h: 24, type: 'ptero', wingFrame: 0 };
}

function createCloud() {
  return {
    x: W + Math.random() * 200,
    y: 20 + Math.random() * 80,
    w: 60 + Math.random() * 40,
    speed: 0.5 + Math.random() * 0.5
  };
}

// Generate background decorations
function generateDecorations() {
  mountains = [];
  for (let i = 0; i < 6; i++) {
    mountains.push({
      x: i * 180 + Math.random() * 60,
      w: 120 + Math.random() * 100,
      h: 40 + Math.random() * 60,
      layer: Math.floor(Math.random() * 3),
    });
  }
  groundDetails = [];
  for (let i = 0; i < 30; i++) {
    groundDetails.push({
      x: Math.random() * W,
      type: Math.random() < 0.5 ? 'pebble' : 'grass',
      size: 2 + Math.random() * 4,
    });
  }
  flowers = [];
  for (let i = 0; i < 8; i++) {
    flowers.push({
      x: Math.random() * W,
      color: [C.flowerPink, C.flowerYellow, C.flowerWhite][Math.floor(Math.random() * 3)],
      size: 3 + Math.random() * 3,
    });
  }
}

// ===== PARTICLES =====
function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 4 - 1,
      size: 2 + Math.random() * 4,
      color: color || C.sunOrange,
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
      rotation: Math.random() * Math.PI * 2,
    });
  }
}

function spawnJumpDust() {
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: dino.x + dino.w / 2 + (Math.random() - 0.5) * 10,
      y: GROUND_Y,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 2,
      size: 3 + Math.random() * 4,
      color: C.groundMid,
      life: 0.8,
      decay: 0.03,
      rotation: 0,
    });
  }
}

// ===== INIT =====
function init() {
  dino = createDino();
  obstacles = [];
  clouds = [];
  score = 0;
  speed = INITIAL_SPEED;
  frameCount = 0;
  isDucking = false;
  shakeFrames = 0;
  obstaclesCrossed = 0;
  comboPopup = null;
  particles = [];
  scoreDisplay.textContent = '0';

  generateDecorations();

  // Nuvens iniciais
  for (let i = 0; i < 3; i++) {
    const c = createCloud();
    c.x = Math.random() * W;
    clouds.push(c);
  }

  gameState = 'waiting';
  showOverlay('Dino Runner', 'Espaco/Toque para pular\nSeta baixo para abaixar', '', 'Jogar');
}

function showOverlay(title, msg, scoreTxt, btnTxt) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlayScore.textContent = scoreTxt;
  btnStart.textContent = btnTxt;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function startGame() {
  initAudio();
  hideOverlay();
  gameState = 'playing';
  gameLoop.start();
}

// ===== UPDATE =====
function update(dt) {
  if (gameState !== 'playing' || paused) return;

  frameCount++;
  score = Math.floor(frameCount / 3);
  scoreDisplay.textContent = score;

  // Velocidade aumenta
  speed = Math.min(MAX_SPEED, INITIAL_SPEED + frameCount * SPEED_INCREMENT);

  // Dino physics
  if (isDucking && dino.grounded) {
    dino.h = DINO_DUCK_H;
    dino.y = GROUND_Y - DINO_DUCK_H;
  } else if (!isDucking && dino.grounded) {
    dino.h = DINO_H;
    dino.y = GROUND_Y - DINO_H;
  }

  const wasGrounded = dino.grounded;

  if (!dino.grounded) {
    dino.vy += GRAVITY;
    dino.y += dino.vy;
    if (dino.y >= GROUND_Y - dino.h) {
      dino.y = GROUND_Y - dino.h;
      dino.vy = 0;
      dino.grounded = true;
      // Landing dust
      spawnJumpDust();
    }
  }

  dino.legFrame++;

  // Spawn obstacles
  const minDist = 250 + Math.random() * 200;
  const lastObs = obstacles[obstacles.length - 1];
  if (!lastObs || lastObs.x < W - minDist) {
    if (score > 100 && Math.random() < 0.2) {
      obstacles.push(createPterodactyl(W + 50));
    } else {
      obstacles.push(createCactus(W + 50));
      // Chance de grupo duplo
      if (Math.random() < 0.3) {
        obstacles.push(createCactus(W + 50 + 25));
      }
    }
  }

  // Move obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= speed;
    if (obstacles[i].type === 'ptero') {
      obstacles[i].wingFrame++;
    }
    // Detecta obstaculo ultrapassado para combo
    if (!obstacles[i].passed && obstacles[i].x + obstacles[i].w < dino.x) {
      obstacles[i].passed = true;
      obstaclesCrossed++;
      // Star particles when passing obstacle
      spawnParticles(dino.x + dino.w, dino.y + dino.h / 2, 3, C.sunOrange);
      if (obstaclesCrossed > 0 && obstaclesCrossed % 5 === 0) {
        comboPopup = { text: `${obstaclesCrossed} seguidos!`, x: W / 2, y: H / 2 - 40, alpha: 1, frame: 0 };
        spawnParticles(W / 2, H / 2, 8, C.sunYellow);
      }
    }
    if (obstacles[i].x + obstacles[i].w < -20) {
      obstacles.splice(i, 1);
    }
  }

  // Spawn/move clouds
  if (Math.random() < 0.005) clouds.push(createCloud());
  for (let i = clouds.length - 1; i >= 0; i--) {
    clouds[i].x -= clouds[i].speed;
    if (clouds[i].x + clouds[i].w < -10) clouds.splice(i, 1);
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Move ground details
  for (const g of groundDetails) {
    g.x -= speed * 0.3;
    if (g.x < -10) g.x = W + Math.random() * 50;
  }
  for (const f of flowers) {
    f.x -= speed * 0.3;
    if (f.x < -10) f.x = W + Math.random() * 50;
  }

  // Move mountains (parallax)
  for (const m of mountains) {
    const parallax = m.layer === 0 ? 0.1 : m.layer === 1 ? 0.2 : 0.3;
    m.x -= speed * parallax;
    if (m.x + m.w < -20) m.x = W + Math.random() * 100;
  }

  // Collision (com margem de tolerancia)
  const margin = 6;
  const dx = dino.x + margin;
  const dy = dino.y + margin;
  const dw = dino.w - margin * 2;
  const dh = dino.h - margin * 2;

  for (const obs of obstacles) {
    const ox = obs.x + 2;
    const oy = obs.y + 2;
    const ow = obs.w - 4;
    const oh = obs.h - 4;

    if (dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy) {
      die();
      return;
    }
  }
}

function die() {
  gameState = 'dead';
  gameLoop.pause();
  shakeFrames = 14;
  obstaclesCrossed = 0;

  // Death particles
  spawnParticles(dino.x + dino.w / 2, dino.y + dino.h / 2, 12, '#FF5252');

  // Save stats
  const isNewRecord = score > bestScore;
  gameStats.recordGame(isNewRecord, { score });
  onGameEnd('dinorunner', { won: false, score });

  if (isNewRecord) {
    bestScore = score;
    localStorage.setItem('dino_best', bestScore);
    bestDisplay.textContent = bestScore;
    launchConfetti();
    playSound('win');
  } else {
    playSound('gameover');
  }
  saveGameStat();
  showOverlay('Fim de Jogo!', `Pontos: ${score}`, score === bestScore ? 'Novo recorde!' : `Melhor: ${bestScore}`, 'Jogar Novamente');
  overlayIcon.textContent = '\u{1F4A5}';
}

// ===== HELPER: roundedRect =====
function roundedRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
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

// ===== DRAW =====
function draw() {
  ctx.save();
  // Screen shake ao morrer
  if (shakeFrames > 0) {
    const intensity = shakeFrames * 0.5;
    ctx.translate((Math.random() - 0.5) * intensity * 2, (Math.random() - 0.5) * intensity);
    shakeFrames--;
  }

  // === SKY (cartoon gradient) ===
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, C.skyTop);
  skyGrad.addColorStop(1, C.skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // === SUN ===
  drawSun();

  // === MOUNTAINS (parallax layers) ===
  drawMountains();

  // === CLOUDS (cartoon fluffy) ===
  for (const c of clouds) {
    drawCartoonCloud(c);
  }

  // === GROUND ===
  drawGround();

  // === FLOWERS ===
  for (const f of flowers) {
    drawFlower(f);
  }

  // === OBSTACLES ===
  for (const obs of obstacles) {
    if (obs.type === 'cactus') {
      drawCactus(obs);
    } else {
      drawPtero(obs);
    }
  }

  // === DINO ===
  drawDino();

  // === PARTICLES ===
  drawParticles();

  // === SCORE (cartoon style) ===
  drawScore();

  // Flash a cada 100 pontos
  if (score > 0 && score % 100 === 0 && frameCount % 3 < 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, W, H);
  }

  // Combo popup
  if (comboPopup) {
    comboPopup.frame++;
    comboPopup.y -= 0.8;
    comboPopup.alpha = Math.max(0, 1 - comboPopup.frame / 55);
    ctx.save();
    ctx.globalAlpha = comboPopup.alpha;
    // Star icon + text
    ctx.font = 'bold 24px Nunito';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.dinoOutline;
    ctx.strokeText(comboPopup.text, comboPopup.x, comboPopup.y);
    ctx.fillStyle = C.sunOrange;
    ctx.fillText(comboPopup.text, comboPopup.x, comboPopup.y);
    ctx.textAlign = 'left';
    ctx.restore();
    if (comboPopup.frame > 55) comboPopup = null;
  }

  ctx.restore(); // fecha o save do screen shake

  // Pausa overlay
  if (paused) {
    ctx.fillStyle = 'rgba(135, 206, 235, 0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.dinoOutline;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Nunito';
    ctx.textAlign = 'center';
    ctx.strokeText('PAUSADO', W / 2, H / 2 - 10);
    ctx.fillText('PAUSADO', W / 2, H / 2 - 10);
    ctx.font = '16px Nunito';
    ctx.fillStyle = '#5D4037';
    ctx.lineWidth = 0;
    ctx.fillText('Pressione P para continuar', W / 2, H / 2 + 20);
    ctx.textAlign = 'left';
  }
}

// ===== SUN =====
function drawSun() {
  const sx = W - 80, sy = 45, sr = 28;
  // Glow
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 2.5);
  glow.addColorStop(0, 'rgba(255, 235, 59, 0.3)');
  glow.addColorStop(1, 'rgba(255, 235, 59, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);

  // Rays
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(frameCount * 0.003);
  for (let i = 0; i < 12; i++) {
    ctx.save();
    ctx.rotate((Math.PI * 2 / 12) * i);
    ctx.fillStyle = 'rgba(255, 235, 59, 0.3)';
    ctx.beginPath();
    ctx.moveTo(-3, -sr - 4);
    ctx.lineTo(0, -sr - 16);
    ctx.lineTo(3, -sr - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Sun body outline
  ctx.beginPath();
  ctx.arc(sx, sy, sr + 3, 0, Math.PI * 2);
  ctx.fillStyle = '#F57F17';
  ctx.fill();
  // Sun body
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fillStyle = C.sunYellow;
  ctx.fill();
  // Highlight
  ctx.beginPath();
  ctx.arc(sx - 6, sy - 8, sr * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();
  // Cute face
  // Eyes
  ctx.fillStyle = '#F57F17';
  ctx.beginPath();
  ctx.arc(sx - 7, sy - 2, 3, 0, Math.PI * 2);
  ctx.arc(sx + 7, sy - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  // Smile
  ctx.beginPath();
  ctx.arc(sx, sy + 4, 8, 0.1, Math.PI - 0.1);
  ctx.strokeStyle = '#F57F17';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Cheeks
  ctx.fillStyle = 'rgba(255, 138, 128, 0.4)';
  ctx.beginPath();
  ctx.ellipse(sx - 14, sy + 4, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(sx + 14, sy + 4, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ===== MOUNTAINS =====
function drawMountains() {
  const colors = [C.mtFar, C.mtMid, C.mtNear];
  // Sort by layer for proper depth
  const sorted = [...mountains].sort((a, b) => a.layer - b.layer);
  for (const m of sorted) {
    const col = colors[m.layer];
    // Outline
    ctx.beginPath();
    ctx.moveTo(m.x - 4, GROUND_Y + 2);
    ctx.lineTo(m.x + m.w / 2, GROUND_Y - m.h - 4);
    ctx.lineTo(m.x + m.w + 4, GROUND_Y + 2);
    ctx.closePath();
    ctx.fillStyle = '#1565C0';
    ctx.fill();
    // Body
    ctx.beginPath();
    ctx.moveTo(m.x, GROUND_Y);
    ctx.lineTo(m.x + m.w / 2, GROUND_Y - m.h);
    ctx.lineTo(m.x + m.w, GROUND_Y);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    // Snow cap
    if (m.h > 50) {
      ctx.beginPath();
      const peakX = m.x + m.w / 2;
      const peakY = GROUND_Y - m.h;
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - m.w * 0.12, peakY + m.h * 0.2);
      ctx.lineTo(peakX + m.w * 0.12, peakY + m.h * 0.2);
      ctx.closePath();
      ctx.fillStyle = C.mtSnow;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Highlight on left side
    ctx.beginPath();
    ctx.moveTo(m.x + m.w * 0.15, GROUND_Y);
    ctx.lineTo(m.x + m.w / 2, GROUND_Y - m.h);
    ctx.lineTo(m.x + m.w * 0.35, GROUND_Y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
  }
}

// ===== CLOUDS =====
function drawCartoonCloud(c) {
  const cx = c.x + c.w / 2;
  const cy = c.y;
  const rMain = c.w * 0.25;
  // Shadow
  ctx.fillStyle = C.cloudShadow;
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 4, rMain * 1.2, rMain * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main body
  ctx.fillStyle = C.cloudWhite;
  ctx.beginPath();
  ctx.arc(cx, cy, rMain, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - rMain * 0.7, cy + 2, rMain * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + rMain * 0.6, cy + 2, rMain * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - rMain * 0.3, cy - rMain * 0.3, rMain * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + rMain * 0.2, cy - rMain * 0.25, rMain * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(cx - rMain * 0.2, cy - rMain * 0.4, rMain * 0.35, rMain * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Outline
  ctx.strokeStyle = 'rgba(100, 181, 246, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, rMain + 1, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
}

// ===== GROUND =====
function drawGround() {
  // Dark ground base
  ctx.fillStyle = C.groundDark;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Brown layers
  ctx.fillStyle = C.groundMid;
  ctx.fillRect(0, GROUND_Y + 6, W, H - GROUND_Y - 6);

  ctx.fillStyle = C.groundLight;
  ctx.fillRect(0, GROUND_Y + 16, W, H - GROUND_Y - 16);

  // Grass on top — thick cartoon strip
  // Outline
  ctx.fillStyle = C.grassDark;
  ctx.fillRect(0, GROUND_Y - 3, W, 9);
  // Light grass
  ctx.fillStyle = C.grassLight;
  ctx.fillRect(0, GROUND_Y - 2, W, 6);

  // Grass tufts
  for (let i = 0; i < 40; i++) {
    const gx = ((i * 25) - (frameCount * speed * 0.5) % (W + 50) + W) % (W + 50) - 25;
    const gh = 4 + Math.sin(i * 1.7) * 3;
    ctx.fillStyle = i % 3 === 0 ? C.grassBright : C.grassLight;
    ctx.beginPath();
    ctx.moveTo(gx, GROUND_Y - 2);
    ctx.lineTo(gx + 2, GROUND_Y - 2 - gh);
    ctx.lineTo(gx + 4, GROUND_Y - 2);
    ctx.closePath();
    ctx.fill();
  }

  // Pebbles
  for (const g of groundDetails) {
    if (g.type === 'pebble') {
      ctx.fillStyle = '#A1887F';
      ctx.beginPath();
      ctx.ellipse(g.x, GROUND_Y + 10 + g.size, g.size, g.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(g.x - 1, GROUND_Y + 9 + g.size, g.size * 0.4, g.size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ===== FLOWERS =====
function drawFlower(f) {
  const fx = f.x;
  const fy = GROUND_Y - 2;
  // Stem
  ctx.strokeStyle = C.grassDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx, fy - f.size * 2.5);
  ctx.stroke();
  // Petals
  const ps = f.size;
  ctx.fillStyle = f.color;
  for (let p = 0; p < 5; p++) {
    const a = (Math.PI * 2 / 5) * p - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(fx + Math.cos(a) * ps, fy - f.size * 2.5 + Math.sin(a) * ps, ps * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Center
  ctx.fillStyle = C.petalCenter;
  ctx.beginPath();
  ctx.arc(fx, fy - f.size * 2.5, ps * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

// ===== CACTUS (cartoon) =====
function drawCactus(obs) {
  const x = obs.x, y = obs.y, w = obs.w, h = obs.h;

  // === Outline shadow ===
  ctx.fillStyle = C.cactusOutline;
  roundedRect(x + w / 2 - 6, y - 2, 12, h + 4, 5);
  ctx.fill();

  // === Main trunk ===
  ctx.fillStyle = C.cactusBody;
  roundedRect(x + w / 2 - 5, y, 10, h, 4);
  ctx.fill();

  // === Highlight ===
  ctx.fillStyle = C.cactusLight;
  roundedRect(x + w / 2 - 3, y + 2, 4, h - 4, 3);
  ctx.fill();

  // === Arms (for wider cacti) ===
  if (w > 20) {
    // Left arm outline
    ctx.fillStyle = C.cactusOutline;
    roundedRect(x - 2, y + h * 0.25, w / 2 + 2, 10, 4);
    ctx.fill();
    roundedRect(x - 2, y + h * 0.15, 10, 16, 4);
    ctx.fill();
    // Left arm fill
    ctx.fillStyle = C.cactusBody;
    roundedRect(x, y + h * 0.27, w / 2, 7, 3);
    ctx.fill();
    roundedRect(x, y + h * 0.17, 7, 13, 3);
    ctx.fill();

    // Right arm outline
    ctx.fillStyle = C.cactusOutline;
    roundedRect(x + w / 2 - 2, y + h * 0.35, w / 2 + 4, 10, 4);
    ctx.fill();
    roundedRect(x + w - 6, y + h * 0.25, 10, 16, 4);
    ctx.fill();
    // Right arm fill
    ctx.fillStyle = C.cactusBody;
    roundedRect(x + w / 2, y + h * 0.37, w / 2, 7, 3);
    ctx.fill();
    roundedRect(x + w - 4, y + h * 0.27, 7, 13, 3);
    ctx.fill();

    // Highlight on arms
    ctx.fillStyle = C.cactusLight;
    ctx.fillRect(x + 2, y + h * 0.29, 3, 4);
    ctx.fillRect(x + w - 2, y + h * 0.29, 3, 4);
  }

  // === Top crown outline + fill ===
  ctx.fillStyle = C.cactusOutline;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.cactusDark;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + 2, 5, 0, Math.PI * 2);
  ctx.fill();

  // === Spines ===
  ctx.strokeStyle = C.cactusSpine;
  ctx.lineWidth = 1;
  const spineCount = Math.floor(h / 10);
  for (let i = 0; i < spineCount; i++) {
    const sy = y + 6 + i * (h / spineCount);
    // Left spines
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 5, sy);
    ctx.lineTo(x + w / 2 - 9, sy - 2);
    ctx.stroke();
    // Right spines
    ctx.beginPath();
    ctx.moveTo(x + w / 2 + 5, sy);
    ctx.lineTo(x + w / 2 + 9, sy - 2);
    ctx.stroke();
  }
}

// ===== PTERODACTYL (cartoon) =====
function drawPtero(obs) {
  const wingUp = Math.floor(obs.wingFrame / 10) % 2 === 0;
  const x = obs.x, y = obs.y, w = obs.w, h = obs.h;

  // === Body outline ===
  ctx.fillStyle = C.pteroOutline;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2 + 1, w * 0.35 + 3, h * 0.35 + 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // === Body ===
  ctx.fillStyle = C.pteroBody;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w * 0.35, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // === Highlight ===
  ctx.fillStyle = C.pteroLight;
  ctx.beginPath();
  ctx.ellipse(x + w / 2 - 2, y + h / 2 - 3, w * 0.2, h * 0.18, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // === Head outline ===
  ctx.fillStyle = C.pteroOutline;
  ctx.beginPath();
  ctx.arc(x + w - 4, y + h * 0.35, 9, 0, Math.PI * 2);
  ctx.fill();
  // === Head ===
  ctx.fillStyle = C.pteroBody;
  ctx.beginPath();
  ctx.arc(x + w - 4, y + h * 0.35, 7, 0, Math.PI * 2);
  ctx.fill();

  // === Crest ===
  ctx.fillStyle = C.pteroDark;
  ctx.beginPath();
  ctx.moveTo(x + w - 2, y + h * 0.35 - 7);
  ctx.lineTo(x + w + 6, y + h * 0.35 - 12);
  ctx.lineTo(x + w + 2, y + h * 0.35 - 4);
  ctx.closePath();
  ctx.fill();

  // === Beak outline ===
  ctx.fillStyle = C.pteroOutline;
  ctx.beginPath();
  ctx.moveTo(x + w + 3, y + h * 0.3);
  ctx.lineTo(x + w + 14, y + h * 0.35);
  ctx.lineTo(x + w + 3, y + h * 0.45);
  ctx.closePath();
  ctx.fill();
  // === Beak ===
  ctx.fillStyle = C.pteroBeak;
  ctx.beginPath();
  ctx.moveTo(x + w + 4, y + h * 0.32);
  ctx.lineTo(x + w + 12, y + h * 0.36);
  ctx.lineTo(x + w + 4, y + h * 0.43);
  ctx.closePath();
  ctx.fill();

  // === Eye ===
  ctx.fillStyle = C.eyeWhite;
  ctx.beginPath();
  ctx.arc(x + w - 1, y + h * 0.3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.eyePupil;
  ctx.beginPath();
  ctx.arc(x + w, y + h * 0.3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Eye shine
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x + w - 1.5, y + h * 0.27, 1, 0, Math.PI * 2);
  ctx.fill();

  // === Wings (cartoon with outline) ===
  if (wingUp) {
    // Wing outline
    ctx.fillStyle = C.pteroOutline;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + h * 0.4);
    ctx.quadraticCurveTo(x + w * 0.3, y - 14, x + w * 0.6, y + h * 0.3);
    ctx.lineTo(x + w * 0.6, y + h * 0.45);
    ctx.quadraticCurveTo(x + w * 0.3, y - 8, x + 6, y + h * 0.5);
    ctx.closePath();
    ctx.fill();
    // Wing fill
    ctx.fillStyle = C.pteroLight;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h * 0.42);
    ctx.quadraticCurveTo(x + w * 0.3, y - 10, x + w * 0.55, y + h * 0.33);
    ctx.lineTo(x + w * 0.55, y + h * 0.42);
    ctx.quadraticCurveTo(x + w * 0.3, y - 5, x + 8, y + h * 0.48);
    ctx.closePath();
    ctx.fill();
  } else {
    // Wing outline
    ctx.fillStyle = C.pteroOutline;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + h * 0.5);
    ctx.quadraticCurveTo(x + w * 0.3, y + h + 14, x + w * 0.6, y + h * 0.6);
    ctx.lineTo(x + w * 0.6, y + h * 0.45);
    ctx.quadraticCurveTo(x + w * 0.3, y + h + 8, x + 6, y + h * 0.4);
    ctx.closePath();
    ctx.fill();
    // Wing fill
    ctx.fillStyle = C.pteroLight;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h * 0.48);
    ctx.quadraticCurveTo(x + w * 0.3, y + h + 10, x + w * 0.55, y + h * 0.58);
    ctx.lineTo(x + w * 0.55, y + h * 0.47);
    ctx.quadraticCurveTo(x + w * 0.3, y + h + 5, x + 8, y + h * 0.42);
    ctx.closePath();
    ctx.fill();
  }
}

// ===== DINO (cartoon chunky) =====
function drawDino() {
  const d = dino;
  const ducking = isDucking && d.grounded;
  const legCycle = Math.floor(d.legFrame / 6) % 2;
  const isDead = gameState === 'dead';

  if (ducking) {
    drawDinoDucking(d, legCycle, isDead);
  } else {
    drawDinoStanding(d, legCycle, isDead);
  }
}

function drawDinoStanding(d, legCycle, isDead) {
  const x = d.x, y = d.y;

  // === TAIL (outline + fill) ===
  ctx.fillStyle = C.dinoOutline;
  ctx.beginPath();
  ctx.moveTo(x - 2, y + 18);
  ctx.quadraticCurveTo(x - 14, y + 12, x - 12, y + 22);
  ctx.quadraticCurveTo(x - 10, y + 28, x + 2, y + 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.dinoBody;
  ctx.beginPath();
  ctx.moveTo(x, y + 19);
  ctx.quadraticCurveTo(x - 11, y + 14, x - 9, y + 22);
  ctx.quadraticCurveTo(x - 8, y + 27, x + 2, y + 25);
  ctx.closePath();
  ctx.fill();

  // === LEGS (outline + fill) ===
  if (d.grounded) {
    const legOffA = legCycle === 0 ? 0 : 4;
    const legOffB = legCycle === 0 ? 4 : 0;
    // Back leg
    drawLeg(x + 6, y + d.h - 12 + legOffA, 10, 14 - legOffA);
    // Front leg
    drawLeg(x + 22, y + d.h - 12 + legOffB, 10, 14 - legOffB);
  } else {
    // In air — tucked
    drawLeg(x + 8, y + d.h - 10, 9, 12);
    drawLeg(x + 20, y + d.h - 10, 9, 12);
  }

  // === BODY (outline + fill) ===
  // Outline
  ctx.fillStyle = C.dinoOutline;
  roundedRect(x - 2, y + 14, d.w + 4, d.h - 24, 10);
  ctx.fill();
  // Body fill
  ctx.fillStyle = C.dinoBody;
  roundedRect(x, y + 16, d.w, d.h - 26, 8);
  ctx.fill();
  // Belly
  ctx.fillStyle = C.dinoBelly;
  roundedRect(x + 8, y + 22, d.w - 16, d.h - 36, 6);
  ctx.fill();
  // 3D Highlight
  ctx.fillStyle = C.dinoLight;
  roundedRect(x + 2, y + 17, d.w * 0.4, d.h - 30, 6);
  ctx.fill();

  // === ARM ===
  ctx.fillStyle = C.dinoOutline;
  roundedRect(x + d.w - 5, y + 22, 12, 6, 3);
  ctx.fill();
  ctx.fillStyle = C.dinoBody;
  roundedRect(x + d.w - 4, y + 23, 10, 4, 2);
  ctx.fill();

  // === HEAD (outline + fill) ===
  // Outline
  ctx.fillStyle = C.dinoOutline;
  roundedRect(x + 4, y - 3, 34, 24, 10);
  ctx.fill();
  // Head fill
  ctx.fillStyle = C.dinoBody;
  roundedRect(x + 6, y - 1, 30, 20, 8);
  ctx.fill();
  // Head highlight
  ctx.fillStyle = C.dinoLight;
  roundedRect(x + 8, y, 14, 10, 5);
  ctx.fill();

  // === EYE ===
  if (isDead) {
    // Dead X_X eyes
    ctx.strokeStyle = C.dinoOutline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 25, y + 3);
    ctx.lineTo(x + 31, y + 9);
    ctx.moveTo(x + 31, y + 3);
    ctx.lineTo(x + 25, y + 9);
    ctx.stroke();
  } else {
    // Big expressive eye
    // Eye white
    ctx.fillStyle = C.eyeWhite;
    ctx.beginPath();
    ctx.ellipse(x + 28, y + 6, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye outline
    ctx.strokeStyle = C.dinoOutline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + 28, y + 6, 6, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Pupil (looks forward)
    ctx.fillStyle = C.eyePupil;
    ctx.beginPath();
    ctx.ellipse(x + 30, y + 6, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + 27, y + 3.5, 2, 0, Math.PI * 2);
    ctx.fill();

    // Determined look when jumping
    if (!d.grounded) {
      ctx.strokeStyle = C.dinoOutline;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 22, y + 1);
      ctx.lineTo(x + 34, y - 1);
      ctx.stroke();
    }
  }

  // === CHEEK ===
  if (!isDead) {
    ctx.fillStyle = C.dinoCheek;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(x + 20, y + 12, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // === MOUTH ===
  if (isDead) {
    // Frown
    ctx.strokeStyle = C.dinoOutline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 30, y + 18, 5, Math.PI + 0.3, -0.3);
    ctx.stroke();
  } else {
    // Smile
    ctx.strokeStyle = C.dinoOutline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + 30, y + 12, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  // === BACK SPIKES ===
  ctx.fillStyle = C.dinoDark;
  for (let i = 0; i < 4; i++) {
    const sx = x + 4 + i * 7;
    const sy = y + 14 - Math.sin(i * 0.8) * 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 3, sy - 6 - i);
    ctx.lineTo(sx + 6, sy);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDinoDucking(d, legCycle, isDead) {
  const x = d.x, y = d.y;

  // === TAIL ===
  ctx.fillStyle = C.dinoOutline;
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 6);
  ctx.quadraticCurveTo(x - 16, y + 2, x - 12, y + 10);
  ctx.quadraticCurveTo(x - 8, y + 16, x, y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.dinoBody;
  ctx.beginPath();
  ctx.moveTo(x - 2, y + 7);
  ctx.quadraticCurveTo(x - 13, y + 4, x - 10, y + 10);
  ctx.quadraticCurveTo(x - 7, y + 15, x, y + 13);
  ctx.closePath();
  ctx.fill();

  // === LEGS ===
  if (legCycle === 0) {
    drawLeg(x + 6, y + d.h - 4, 9, 8);
    drawLeg(x + 28, y + d.h - 4, 9, 8);
  } else {
    drawLeg(x + 10, y + d.h - 4, 9, 8);
    drawLeg(x + 32, y + d.h - 4, 9, 8);
  }

  // === BODY (wider, flatter) ===
  ctx.fillStyle = C.dinoOutline;
  roundedRect(x - 3, y + 2, d.w + 16, d.h - 4, 8);
  ctx.fill();
  ctx.fillStyle = C.dinoBody;
  roundedRect(x - 1, y + 4, d.w + 12, d.h - 8, 6);
  ctx.fill();
  ctx.fillStyle = C.dinoBelly;
  roundedRect(x + 6, y + 8, d.w, d.h - 16, 4);
  ctx.fill();
  ctx.fillStyle = C.dinoLight;
  roundedRect(x, y + 5, (d.w + 12) * 0.4, d.h - 12, 5);
  ctx.fill();

  // === HEAD ===
  ctx.fillStyle = C.dinoOutline;
  roundedRect(x + d.w + 4, y - 3, 20, 17, 7);
  ctx.fill();
  ctx.fillStyle = C.dinoBody;
  roundedRect(x + d.w + 6, y - 1, 16, 13, 5);
  ctx.fill();
  ctx.fillStyle = C.dinoLight;
  roundedRect(x + d.w + 7, y, 8, 6, 3);
  ctx.fill();

  // Eye
  if (isDead) {
    ctx.strokeStyle = C.dinoOutline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + d.w + 12, y + 1);
    ctx.lineTo(x + d.w + 17, y + 6);
    ctx.moveTo(x + d.w + 17, y + 1);
    ctx.lineTo(x + d.w + 12, y + 6);
    ctx.stroke();
  } else {
    ctx.fillStyle = C.eyeWhite;
    ctx.beginPath();
    ctx.ellipse(x + d.w + 15, y + 4, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.dinoOutline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x + d.w + 15, y + 4, 4, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = C.eyePupil;
    ctx.beginPath();
    ctx.ellipse(x + d.w + 16, y + 4, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + d.w + 14, y + 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Determined brow
    ctx.strokeStyle = C.dinoOutline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + d.w + 11, y);
    ctx.lineTo(x + d.w + 19, y - 1);
    ctx.stroke();
  }

  // Back spikes (flatter)
  ctx.fillStyle = C.dinoDark;
  for (let i = 0; i < 3; i++) {
    const sx = x + 2 + i * 10;
    ctx.beginPath();
    ctx.moveTo(sx, y + 3);
    ctx.lineTo(sx + 3, y - 3);
    ctx.lineTo(sx + 6, y + 3);
    ctx.closePath();
    ctx.fill();
  }
}

function drawLeg(x, y, w, h) {
  // Outline
  ctx.fillStyle = C.dinoOutline;
  roundedRect(x - 1, y - 1, w + 2, h + 2, 4);
  ctx.fill();
  // Fill
  ctx.fillStyle = C.dinoBody;
  roundedRect(x, y, w, h, 3);
  ctx.fill();
  // Foot highlight
  ctx.fillStyle = C.dinoDark;
  roundedRect(x, y + h - 4, w, 4, 2);
  ctx.fill();
}

// ===== PARTICLES =====
function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    // Star shape
    ctx.fillStyle = p.color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
      const r = p.size;
      const ri = p.size * 0.4;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      const a2 = a + Math.PI / 5;
      ctx.lineTo(Math.cos(a2) * ri, Math.sin(a2) * ri);
    }
    ctx.closePath();
    ctx.fill();
    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

// ===== SCORE =====
function drawScore() {
  // Score badge background
  const scoreText = String(score).padStart(5, '0');
  const hiText = `HI ${String(bestScore).padStart(5, '0')}`;

  ctx.textAlign = 'right';

  // Main score — cartoon outlined
  ctx.font = 'bold 20px Nunito';
  ctx.lineWidth = 4;
  ctx.strokeStyle = C.dinoOutline;
  ctx.strokeText(scoreText, W - 15, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(scoreText, W - 15, 28);

  // HI score
  ctx.font = 'bold 14px Nunito';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.strokeText(hiText, W - 15, 48);
  ctx.fillStyle = C.sunOrange;
  ctx.fillText(hiText, W - 15, 48);

  ctx.textAlign = 'left';
}

// ===== GAME LOOP =====
const gameLoop = new GameLoop({
  update,
  render: draw,
  fps: 60
});

// ===== INPUT =====
function jump() {
  if (gameState === 'dead') return;
  if (gameState === 'waiting') {
    startGame();
    return;
  }
  if (dino.grounded) {
    dino.vy = JUMP_FORCE;
    dino.grounded = false;
    isDucking = false;
    dino.h = DINO_H;
    playSound('jump');
    spawnJumpDust();
  }
}

function duckStart() {
  if (gameState !== 'playing') return;
  isDucking = true;
  // Se no ar, descer mais rapido
  if (!dino.grounded) {
    dino.vy += 4;
  }
}

function duckEnd() {
  isDucking = false;
  if (dino.grounded) {
    dino.h = DINO_H;
    dino.y = GROUND_Y - DINO_H;
  }
}

// Input Manager
const inputManager = new InputManager({ keyboardTarget: document });

inputManager.on('keyDown', (key) => {
  if (key === 'p' || key === 'P' || key === 'Escape') {
    if (gameState === 'playing') {
      paused = !paused;
    }
    return;
  }
  if (paused) return;
  if (key === ' ' || key === 'ArrowUp') {
    jump();
  }
  if (key === 'ArrowDown') {
    duckStart();
  }
});

inputManager.on('keyUp', (key) => {
  if (key === 'ArrowDown') {
    duckEnd();
  }
});

// Canvas touch/click — pulo
canvas.addEventListener('click', (e) => {
  jump();
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  jump();
}, { passive: false });

// Botao overlay
btnStart.addEventListener('click', (e) => {
  e.stopPropagation();
  if (gameState === 'waiting') {
    startGame();
  } else if (gameState === 'dead') {
    overlayIcon.textContent = '\u{1F995}';
    init();
    startGame();
  }
});

// Mobile controls
const mobileControls = document.getElementById('mobile-controls');
if (mobileControls) {
  mobileControls.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const action = e.target.dataset.action;
    if (action === 'jump') jump();
    if (action === 'duck') duckStart();
  }, { passive: false });

  mobileControls.addEventListener('touchend', (e) => {
    e.preventDefault();
    const action = e.target.dataset.action;
    if (action === 'duck') duckEnd();
  }, { passive: false });

  mobileControls.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'jump') jump();
  });
}

// ===== SUPABASE STATS =====
async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'dinorunner',
      result: 'end',
      moves: score,
      time_seconds: 0,
      score: score,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// ===== START =====
init();
