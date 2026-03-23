import '../../auth-check.js';
// =============================================
//  COBRINHA (Snake) — PREMIUM EDITION
//  Canvas 2D avançado com bloom, interpolação suave,
//  partículas dinâmicas e efeitos neon cinematográficos
// =============================================
import { supabase } from '../../supabase.js';
import { launchConfetti, playSound, shareOnWhatsApp, initAudio } from '../shared/game-design-utils.js?v=2';
import { GameStats, GameStorage } from '../shared/game-core.js';
import { onGameEnd } from '../shared/game-integration.js';

// ---- Config ----
const GRID      = 20;
const BASE_SPEED = 150;
const MIN_SPEED  = 60;

// ---- DOM ----
let canvas, ctx, glowCanvas, glowCtx;
let overlay, overlayIcon, overlayTitle, overlayMsg, overlayScore, btnStart, scoreDisplay, bestDisplay;

// ---- Stats ----
const stats   = new GameStats('snake');
const storage = new GameStorage('snake');
const getBest = () => storage.get('bestScore', 0);
const setBest = s  => storage.set('bestScore', s);

// ---- State ----
let snake = [], food = null, score = 0, cellSize = 0;
let gameRunning = false, gamePaused = false;
let tickAccum = 0, speed = BASE_SPEED;
let direction = { x: 1, y: 0 }, nextDirection = { x: 1, y: 0 };
let lastTime = 0, animFrame = 0;

// ---- Smooth interpolation ----
let prevSnake = [], lerpT = 0;

// ---- Visual state ----
let particles = [];
let bgStars = [];
let foodOrbiters = [];
let trailPoints = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let glowPulse = 0;
let eatFlash = 0;     // screen flash on eat
let comboGlow = 0;    // snake body glow intensity
let deathTimer = -1;
let gridWaveTime = 0;

// =============================================
//  PARTICLE ENGINE
// =============================================
class Particle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    const angle = opts.angle ?? Math.random() * Math.PI * 2;
    const speed = opts.speed ?? (1 + Math.random() * 3);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1;
    this.decay = opts.decay ?? (0.015 + Math.random() * 0.025);
    this.size = opts.size ?? (2 + Math.random() * 4);
    this.color = opts.color ?? '#00fc40';
    this.glow = opts.glow ?? 12;
    this.gravity = opts.gravity ?? 0.08;
    this.friction = opts.friction ?? 0.98;
    this.type = opts.type ?? 'circle'; // circle, spark, ring
  }
  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    if (this.type === 'spark') this.size *= 0.96;
  }
  draw(c) {
    if (this.life <= 0) return;
    c.save();
    c.globalAlpha = Math.max(0, this.life);
    c.shadowBlur = this.glow * this.life;
    c.shadowColor = this.color;
    c.fillStyle = this.color;
    if (this.type === 'ring') {
      c.strokeStyle = this.color;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(this.x, this.y, this.size * (2 - this.life), 0, Math.PI * 2);
      c.stroke();
    } else if (this.type === 'spark') {
      const len = this.size * 2;
      const ang = Math.atan2(this.vy, this.vx);
      c.strokeStyle = this.color;
      c.lineWidth = this.size * 0.5;
      c.beginPath();
      c.moveTo(this.x - Math.cos(ang) * len, this.y - Math.sin(ang) * len);
      c.lineTo(this.x, this.y);
      c.stroke();
    } else {
      c.beginPath();
      c.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
}

function emit(x, y, count, opts = {}) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, {
      ...opts,
      angle: opts.angle ?? Math.random() * Math.PI * 2,
      speed: (opts.speed ?? 2) * (0.5 + Math.random()),
    }));
  }
}

function emitRing(x, y, color, count = 1) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, {
      type: 'ring', color, size: 4, decay: 0.03, gravity: 0, speed: 0, glow: 20,
    }));
  }
}

// =============================================
//  BACKGROUND STARS
// =============================================
function initStars() {
  bgStars = [];
  for (let i = 0; i < 80; i++) {
    bgStars.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 1.5,
      speed: 0.0002 + Math.random() * 0.0005,
      phase: Math.random() * Math.PI * 2,
      brightness: 0.2 + Math.random() * 0.5,
    });
  }
}

// =============================================
//  FOOD ORBITING PARTICLES
// =============================================
function initFoodOrbiters() {
  foodOrbiters = [];
  for (let i = 0; i < 5; i++) {
    foodOrbiters.push({
      angle: (Math.PI * 2 / 5) * i,
      radius: 0.6 + Math.random() * 0.3,
      speed: 0.02 + Math.random() * 0.02,
      size: 1 + Math.random() * 2,
    });
  }
}

// =============================================
//  CANVAS SIZING (dual-canvas for bloom)
// =============================================
function resizeCanvas() {
  const container = canvas.parentElement;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const maxW = Math.max(rect.width - 16, 100);
  const maxH = Math.max(rect.height - 16, 100);
  const maxCell = Math.floor(Math.min(maxW, maxH) / GRID);
  cellSize = Math.max(maxCell, 10);
  const size = cellSize * GRID;

  for (const c of [canvas, glowCanvas]) {
    c.width = size;
    c.height = size;
    c.style.width = size + 'px';
    c.style.height = size + 'px';
  }
}

// =============================================
//  GAME LOGIC
// =============================================
function initGame() {
  const mid = Math.floor(GRID / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  prevSnake = snake.map(s => ({ ...s }));
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  scoreDisplay.textContent = '0';
  particles = [];
  trailPoints = [];
  eatFlash = 0;
  comboGlow = 0;
  deathTimer = -1;
  screenShake = { x: 0, y: 0, intensity: 0 };
  tickAccum = 0;
  lerpT = 0;
  spawnFood();
  initFoodOrbiters();
}

function spawnFood() {
  const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (occupied.has(`${pos.x},${pos.y}`));
  food = pos;
  initFoodOrbiters();
}

function tick() {
  // Save previous positions for interpolation
  prevSnake = snake.map(s => ({ ...s }));
  lerpT = 0;

  // Apply direction
  direction = { ...nextDirection };

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  // Wall collision
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
    triggerDeath();
    return;
  }

  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    triggerDeath();
    return;
  }

  snake.unshift(head);

  // Add trail point (pixel coords)
  const cs = cellSize;
  trailPoints.push({
    x: head.x * cs + cs / 2,
    y: head.y * cs + cs / 2,
    life: 1,
  });
  if (trailPoints.length > 40) trailPoints.shift();

  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreDisplay.textContent = score;
    eatFlash = 1;
    comboGlow = 1;

    // Explosion particles
    const fx = food.x * cs + cs / 2;
    const fy = food.y * cs + cs / 2;
    emit(fx, fy, 25, { color: '#ff4466', speed: 4, glow: 20, size: 3, decay: 0.02 });
    emit(fx, fy, 15, { color: '#ffaa00', speed: 3, type: 'spark', glow: 15, decay: 0.025 });
    emitRing(fx, fy, '#ff6688', 2);

    // Screen shake
    screenShake.intensity = 6;

    playSound('eat');
    if (navigator.vibrate) navigator.vibrate([20, 10, 15]);
    spawnFood();
  } else {
    snake.pop();
  }
}

function setDirection(dir) {
  // Prevent opposite
  if (direction.x !== 0 && dir.x === -direction.x) return;
  if (direction.y !== 0 && dir.y === -direction.y) return;
  nextDirection = dir;
}

// =============================================
//  DEATH
// =============================================
function triggerDeath() {
  deathTimer = 0;
  const cs = cellSize;

  // Explosion for each segment
  snake.forEach((seg, i) => {
    const sx = seg.x * cs + cs / 2;
    const sy = seg.y * cs + cs / 2;
    setTimeout(() => {
      emit(sx, sy, 10, {
        color: i === 0 ? '#00ff55' : '#00cc44',
        speed: 5,
        type: i % 2 === 0 ? 'spark' : 'circle',
        glow: 18,
        decay: 0.018,
      });
    }, i * 30);
  });

  screenShake.intensity = 15;
  if (navigator.vibrate) navigator.vibrate([50, 30, 80]);

  setTimeout(gameOver, 800);
}

async function gameOver() {
  gameRunning = false;
  deathTimer = -1;

  stats.recordGame(false, { score });
  onGameEnd('snake', { won: false, score });

  const isNew = score > getBest();
  if (isNew) {
    setBest(score);
    launchConfetti();
    playSound('win');
  } else {
    playSound('gameover');
  }
  bestDisplay.textContent = getBest();

  overlayIcon.textContent = '💀';
  overlayTitle.textContent = 'Game Over!';
  overlayMsg.textContent = isNew ? 'Novo Recorde!' : '';
  overlayScore.textContent = `Pontuação: ${score}`;
  btnStart.textContent = 'Jogar Novamente';

  const btnShare = document.getElementById('btn-share');
  if (btnShare) {
    btnShare.style.display = 'inline-block';
    btnShare.onclick = () => {
      shareOnWhatsApp(`🐍 Joguei Cobrinha no Games Hub e fiz ${score} pontos!\n\n🏆 Meu recorde: ${getBest()}\n\n🎮 Jogue: https://gameshub.com.br/games/snake/`);
    };
  }
  overlay.classList.remove('hidden');
}

// =============================================
//  DRAW — Premium rendering
// =============================================
function draw(timestamp) {
  const cs = cellSize;
  const W = canvas.width;
  const H = canvas.height;

  // ---- Screen shake decay ----
  if (screenShake.intensity > 0) {
    screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.intensity *= 0.88;
    if (screenShake.intensity < 0.3) screenShake.intensity = 0;
  }

  // ---- Main canvas ----
  ctx.save();
  ctx.translate(screenShake.x, screenShake.y);

  // Background gradient
  const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  bgGrad.addColorStop(0, '#0d140d');
  bgGrad.addColorStop(1, '#050a05');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ---- Animated grid with wave ----
  gridWaveTime += 0.015;
  ctx.save();
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const px = i * cs;
      const py = j * cs;
      const dist = Math.sqrt((px - W / 2) ** 2 + (py - H / 2) ** 2);
      const wave = Math.sin(dist * 0.015 - gridWaveTime * 2) * 0.5 + 0.5;
      const alpha = 0.03 + wave * 0.04;
      ctx.fillStyle = `rgba(0, 252, 64, ${alpha})`;
      ctx.fillRect(px - 0.5, py - 0.5, 1, 1);
    }
  }
  // Grid lines
  ctx.strokeStyle = 'rgba(0, 252, 64, 0.04)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cs, 0);
    ctx.lineTo(i * cs, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cs);
    ctx.lineTo(W, i * cs);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Background stars ----
  const t = timestamp * 0.001;
  bgStars.forEach(star => {
    const twinkle = Math.sin(t * 3 + star.phase) * 0.3 + 0.7;
    const alpha = star.brightness * twinkle;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#00fc40';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#00fc40';
    ctx.beginPath();
    ctx.arc(star.x * W, star.y * H, star.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // ---- Eat flash (full screen) ----
  if (eatFlash > 0) {
    ctx.save();
    ctx.globalAlpha = eatFlash * 0.15;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    eatFlash *= 0.9;
    if (eatFlash < 0.01) eatFlash = 0;
  }

  // ---- Trail (neon vapor) ----
  trailPoints.forEach((tp, i) => {
    tp.life -= 0.02;
    if (tp.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = tp.life * 0.4;
    ctx.shadowBlur = 15 * tp.life;
    ctx.shadowColor = '#00fc40';
    ctx.fillStyle = '#00e038';
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, cs * 0.12 * tp.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  trailPoints = trailPoints.filter(tp => tp.life > 0);

  // ---- Food with orbiting particles ----
  if (food) {
    const fx = food.x * cs + cs / 2;
    const fy = food.y * cs + cs / 2;
    glowPulse += 0.06;
    const pulse = 1 + Math.sin(glowPulse) * 0.15;
    const glowStr = 20 + Math.sin(glowPulse * 1.3) * 10;

    // Orbiting particles
    foodOrbiters.forEach(orb => {
      orb.angle += orb.speed;
      const ox = fx + Math.cos(orb.angle) * cs * orb.radius;
      const oy = fy + Math.sin(orb.angle) * cs * orb.radius;
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ff4466';
      ctx.fillStyle = '#ff6688';
      ctx.beginPath();
      ctx.arc(ox, oy, orb.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Food glow aura
    ctx.save();
    const auraGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, cs * 1.2);
    auraGrad.addColorStop(0, 'rgba(255, 68, 102, 0.15)');
    auraGrad.addColorStop(1, 'rgba(255, 68, 102, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, cs * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Food body
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(pulse, pulse);
    ctx.shadowBlur = glowStr;
    ctx.shadowColor = '#ff3355';
    const foodGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, cs * 0.38);
    foodGrd.addColorStop(0, '#ff8899');
    foodGrd.addColorStop(0.5, '#ff4466');
    foodGrd.addColorStop(1, '#cc2244');
    ctx.fillStyle = foodGrd;
    ctx.beginPath();
    ctx.arc(0, 0, cs * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(-cs * 0.1, -cs * 0.1, cs * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- Snake (smooth interpolated) ----
  if (deathTimer < 0) {
    // Lerp progress (0→1 between ticks)
    const interp = Math.min(lerpT, 1);

    const snakeLen = snake.length;
    for (let i = snakeLen - 1; i >= 0; i--) {
      const curr = snake[i];
      const prev = prevSnake[i] || curr;

      // Interpolate position
      const sx = (prev.x + (curr.x - prev.x) * interp) * cs + cs / 2;
      const sy = (prev.y + (curr.y - prev.y) * interp) * cs + cs / 2;

      const isHead = i === 0;
      const progress = i / snakeLen;
      const segAlpha = 1 - progress * 0.35;
      const segSize = cs * (isHead ? 0.46 : 0.42 - progress * 0.08);

      // Segment glow aura
      ctx.save();
      ctx.globalAlpha = segAlpha * 0.3;
      ctx.shadowBlur = 20 + comboGlow * 30;
      ctx.shadowColor = isHead ? '#00ff55' : '#00cc44';
      ctx.fillStyle = 'transparent';
      ctx.beginPath();
      ctx.arc(sx, sy, segSize + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Connection to next segment
      if (i < snakeLen - 1) {
        const next = snake[i + 1];
        const prevNext = prevSnake[i + 1] || next;
        const nx = (prevNext.x + (next.x - prevNext.x) * interp) * cs + cs / 2;
        const ny = (prevNext.y + (next.y - prevNext.y) * interp) * cs + cs / 2;

        ctx.save();
        ctx.globalAlpha = segAlpha * 0.8;
        ctx.strokeStyle = `rgba(0, 220, 60, ${segAlpha * 0.7})`;
        ctx.lineWidth = segSize * 1.4;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 8 + comboGlow * 15;
        ctx.shadowColor = '#00ff44';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.restore();
      }

      // Segment body (circle with gradient)
      ctx.save();
      ctx.globalAlpha = segAlpha;

      const bodyGrad = ctx.createRadialGradient(sx - segSize * 0.2, sy - segSize * 0.2, 0, sx, sy, segSize);
      if (isHead) {
        bodyGrad.addColorStop(0, '#88ffaa');
        bodyGrad.addColorStop(0.4, '#44ff66');
        bodyGrad.addColorStop(1, '#00cc33');
      } else {
        const r = Math.floor(0 + comboGlow * 60);
        const g = Math.floor(200 - progress * 40 + comboGlow * 55);
        const b = Math.floor(50 - progress * 20);
        bodyGrad.addColorStop(0, `rgb(${r + 60}, ${g + 30}, ${b + 30})`);
        bodyGrad.addColorStop(1, `rgb(${r}, ${g}, ${b})`);
      }
      ctx.fillStyle = bodyGrad;
      ctx.shadowBlur = isHead ? (16 + comboGlow * 25) : (8 + comboGlow * 12);
      ctx.shadowColor = isHead ? '#00ff55' : '#00dd44';
      ctx.beginPath();
      ctx.arc(sx, sy, segSize, 0, Math.PI * 2);
      ctx.fill();

      // Specular on each segment
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + (isHead ? 0.1 : 0)})`;
      ctx.beginPath();
      ctx.arc(sx - segSize * 0.25, sy - segSize * 0.25, segSize * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ---- Head details ----
      if (isHead) {
        // Eyes
        const dir = direction;
        let ex1, ey1, ex2, ey2;
        const eyeOffset = cs * 0.18;
        const eyeDirX = dir.x * cs * 0.08;
        const eyeDirY = dir.y * cs * 0.08;

        if (dir.x === 1)       { ex1 = eyeOffset; ey1 = -eyeOffset; ex2 = eyeOffset; ey2 = eyeOffset; }
        else if (dir.x === -1) { ex1 = -eyeOffset; ey1 = -eyeOffset; ex2 = -eyeOffset; ey2 = eyeOffset; }
        else if (dir.y === -1) { ex1 = -eyeOffset; ey1 = -eyeOffset; ex2 = eyeOffset; ey2 = -eyeOffset; }
        else                   { ex1 = -eyeOffset; ey1 = eyeOffset; ex2 = eyeOffset; ey2 = eyeOffset; }

        // Eye glow
        const eyePulse = Math.sin(t * 4) * 0.2 + 0.8;
        ctx.save();
        ctx.shadowBlur = 10 * eyePulse + comboGlow * 8;
        ctx.shadowColor = 'rgba(255, 255, 200, 0.9)';
        ctx.fillStyle = '#ffffff';
        const eyeR = cs * 0.07;
        ctx.beginPath();
        ctx.arc(sx + ex1 + eyeDirX, sy + ey1 + eyeDirY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + ex2 + eyeDirX, sy + ey2 + eyeDirY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#003300';
        ctx.shadowBlur = 0;
        const pupilR = cs * 0.03;
        ctx.beginPath();
        ctx.arc(sx + ex1 + eyeDirX * 1.5, sy + ey1 + eyeDirY * 1.5, pupilR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + ex2 + eyeDirX * 1.5, sy + ey2 + eyeDirY * 1.5, pupilR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Tongue (flickering)
        if (Math.sin(t * 8) > 0.3) {
          ctx.save();
          ctx.strokeStyle = '#ff4466';
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#ff4466';
          const tongueLen = cs * 0.35;
          const tongueBase = { x: sx + dir.x * segSize, y: sy + dir.y * segSize };
          const tongueEnd = { x: tongueBase.x + dir.x * tongueLen, y: tongueBase.y + dir.y * tongueLen };
          ctx.beginPath();
          ctx.moveTo(tongueBase.x, tongueBase.y);
          ctx.lineTo(tongueEnd.x, tongueEnd.y);
          ctx.stroke();
          // Fork
          const forkLen = cs * 0.1;
          const perpX = dir.y;
          const perpY = -dir.x;
          ctx.beginPath();
          ctx.moveTo(tongueEnd.x, tongueEnd.y);
          ctx.lineTo(tongueEnd.x + (dir.x + perpX * 0.5) * forkLen, tongueEnd.y + (dir.y + perpY * 0.5) * forkLen);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(tongueEnd.x, tongueEnd.y);
          ctx.lineTo(tongueEnd.x + (dir.x - perpX * 0.5) * forkLen, tongueEnd.y + (dir.y - perpY * 0.5) * forkLen);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // ---- Death animation (segments dissolving) ----
  if (deathTimer >= 0) {
    const progress = Math.min(deathTimer / 30, 1);
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    snake.forEach((seg, i) => {
      const delay = i * 0.03;
      const segProgress = Math.max(0, Math.min((progress - delay) / (1 - delay), 1));
      if (segProgress >= 1) return;

      const sx = seg.x * cs + cs / 2;
      const sy = seg.y * cs + cs / 2;
      const scatter = segProgress * cs * 2;
      const angle = Math.random() * Math.PI * 2;

      ctx.save();
      ctx.globalAlpha = (1 - segProgress) * 0.8;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00ff44';
      ctx.fillStyle = '#00cc44';
      ctx.beginPath();
      ctx.arc(
        sx + Math.cos(angle) * scatter,
        sy + Math.sin(angle) * scatter,
        cs * 0.35 * (1 - segProgress),
        0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
    deathTimer++;
  }

  // ---- Particles ----
  particles.forEach(p => { p.update(); p.draw(ctx); });
  particles = particles.filter(p => p.life > 0);

  // ---- Combo glow decay ----
  if (comboGlow > 0) {
    comboGlow *= 0.97;
    if (comboGlow < 0.01) comboGlow = 0;
  }

  // ---- Vignette ----
  const vignetteGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.75);
  vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vignetteGrad;
  ctx.fillRect(0, 0, W, H);

  // ---- Border glow ----
  ctx.save();
  ctx.strokeStyle = `rgba(0, 252, 64, ${0.15 + Math.sin(t * 2) * 0.05})`;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#00fc40';
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.restore();

  ctx.restore(); // end screen shake

  // ---- Pause overlay ----
  if (gamePaused) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.fillStyle = '#00fc40';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#00fc40';
    ctx.font = `bold ${cs * 1.3}px 'VT323', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSADO', W / 2, H / 2 - cs * 0.2);
    ctx.font = `${cs * 0.55}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = 0;
    ctx.fillText('Pressione P para continuar', W / 2, H / 2 + cs * 0.8);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

// =============================================
//  BLOOM PASS (glow canvas overlay)
// =============================================
function drawBloom() {
  // Sample from main canvas, blur, overlay with additive blending
  glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
  glowCtx.filter = 'blur(8px) brightness(1.5)';
  glowCtx.globalAlpha = 0.25;
  glowCtx.drawImage(canvas, 0, 0);
  glowCtx.filter = 'blur(16px) brightness(1.2)';
  glowCtx.globalAlpha = 0.12;
  glowCtx.drawImage(canvas, 0, 0);
  glowCtx.filter = 'none';
  glowCtx.globalAlpha = 1;
}

// =============================================
//  GAME LOOP
// =============================================
function gameFrame(timestamp) {
  if (!gameRunning) return;
  animFrame = requestAnimationFrame(gameFrame);

  if (!lastTime) lastTime = timestamp;
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (!gamePaused && deathTimer < 0) {
    speed = Math.max(MIN_SPEED, BASE_SPEED - score * 3);
    tickAccum += dt;

    // Interpolation factor
    lerpT = Math.min(tickAccum / speed, 1);

    while (tickAccum >= speed) {
      tickAccum -= speed;
      tick();
    }
    // Recalc lerp after tick
    lerpT = Math.min(tickAccum / speed, 1);
  }

  if (deathTimer >= 0) {
    // Still render during death
  }

  draw(timestamp);
  drawBloom();
}

function startGame() {
  initAudio();
  initGame();
  overlay.classList.add('hidden');
  const btnShare = document.getElementById('btn-share');
  if (btnShare) btnShare.style.display = 'none';

  gameRunning = true;
  gamePaused = false;
  lastTime = 0;
  tickAccum = 0;
  animFrame = requestAnimationFrame(gameFrame);
}

function togglePause() {
  gamePaused = !gamePaused;
}

// =============================================
//  CONTROLS
// =============================================
const keyMap = {
  ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
};

document.addEventListener('keydown', e => {
  if (!gameRunning) {
    if (e.key === 'Enter' || e.key === ' ') { startGame(); e.preventDefault(); }
    return;
  }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
  if (gamePaused) return;

  const dir = keyMap[e.key];
  if (dir) { setDirection(dir); e.preventDefault(); }
});

// Touch swipe
const SWIPE = 30;
let touchStartX, touchStartY;

document.addEventListener('touchstart', e => {
  if (e.target.closest('.ctrl-btn') || e.target.closest('.btn') || e.target.closest('.modal')) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (gameRunning) e.preventDefault();
}, { passive: false });

document.addEventListener('touchend', e => {
  if (!gameRunning || gamePaused) return;
  if (touchStartX == null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    setDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
  } else {
    setDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
  }
  touchStartX = null;
}, { passive: true });

// Mobile button controls
const dirMap = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

// =============================================
//  INIT
// =============================================
function init() {
  canvas       = document.getElementById('game-canvas');
  ctx          = canvas.getContext('2d');
  overlay      = document.getElementById('overlay');
  overlayIcon  = document.getElementById('overlay-icon');
  overlayTitle = document.getElementById('overlay-title');
  overlayMsg   = document.getElementById('overlay-msg');
  overlayScore = document.getElementById('overlay-score');
  btnStart     = document.getElementById('btn-start');
  scoreDisplay = document.getElementById('score-display');
  bestDisplay  = document.getElementById('best-display');

  // Create glow canvas (bloom layer)
  glowCanvas = document.createElement('canvas');
  glowCtx = glowCanvas.getContext('2d');
  glowCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;mix-blend-mode:screen;z-index:1;';
  canvas.parentElement.style.position = 'relative';
  canvas.parentElement.appendChild(glowCanvas);

  initStars();
  bestDisplay.textContent = getBest();

  // Mobile controls
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      if (!gameRunning || gamePaused) return;
      const d = dirMap[btn.dataset.dir];
      if (d) setDirection(d);
    });
  });

  // Start button
  const newBtn = btnStart.cloneNode(true);
  btnStart.parentNode.replaceChild(newBtn, btnStart);
  btnStart = newBtn;
  btnStart.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); startGame(); });
  btnStart.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); startGame(); }, { passive: false });

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Initial draw
  initGame();
  draw(0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
