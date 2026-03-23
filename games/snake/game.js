import '../../auth-check.js';
// =============================================
//  COBRINHA — PIXI.JS WebGL EDITION
//  GPU-accelerated rendering, real bloom shader,
//  CRT effect, chromatic aberration, dynamic lighting,
//  thousands of particles at 60fps
// =============================================
import { launchConfetti, playSound, shareOnWhatsApp, initAudio } from '../shared/game-design-utils.js?v=2';
import { GameStats, GameStorage } from '../shared/game-core.js';
import { onGameEnd } from '../shared/game-integration.js';

const PIXI = window.PIXI;

// ---- Config ----
const GRID       = 20;
const BASE_SPEED = 150;
const MIN_SPEED  = 60;

// ---- Stats ----
const stats   = new GameStats('snake');
const storage = new GameStorage('snake');
const getBest = () => storage.get('bestScore', 0);
const setBest = s  => storage.set('bestScore', s);

// ---- DOM ----
let overlay, overlayIcon, overlayTitle, overlayMsg, overlayScore, btnStart, scoreDisplay, bestDisplay;

// ---- PixiJS ----
let app, gameContainer, bloomContainer;
let snakeGraphics, foodGraphics, gridGraphics, trailGraphics, particleContainer, lightContainer;
let crtFilter, bloomFilter;

// ---- State ----
let snake = [], food = null, score = 0, cellSize = 0, canvasSize = 0;
let gameRunning = false, gamePaused = false;
let tickAccum = 0, speed = BASE_SPEED;
let direction = { x: 1, y: 0 }, nextDirection = { x: 1, y: 0 };
let prevSnake = [], lerpT = 0;

// ---- VFX state ----
let particles = [];
let trailPoints = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let eatFlash = 0, comboGlow = 0;
let deathTimer = -1;
let foodOrbiters = [];
let bgStars = [];
let timeElapsed = 0;

// =============================================
//  CRT SHADER (scanlines + curvature + vignette + flicker)
// =============================================
const CRT_FRAG = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform vec2 uResolution;

void main() {
  vec2 uv = vTextureCoord;

  // Barrel distortion (CRT curvature)
  vec2 cc = uv - 0.5;
  float dist = dot(cc, cc) * 0.06;
  uv = uv + cc * dist;

  // Chromatic aberration
  float aberr = 0.0015 + sin(uTime * 2.0) * 0.0003;
  float r = texture2D(uSampler, vec2(uv.x + aberr, uv.y)).r;
  float g = texture2D(uSampler, uv).g;
  float b = texture2D(uSampler, vec2(uv.x - aberr, uv.y)).b;
  vec4 color = vec4(r, g, b, 1.0);

  // Scanlines
  float scanline = sin(uv.y * uResolution.y * 1.5) * 0.04 + 0.96;
  color.rgb *= scanline;

  // Subtle flicker
  float flicker = 1.0 - sin(uTime * 8.0) * 0.008;
  color.rgb *= flicker;

  // Vignette
  float vig = 1.0 - dot(cc * 1.6, cc * 1.6);
  vig = clamp(vig, 0.0, 1.0);
  color.rgb *= vig;

  // Slight green tint for matrix feel
  color.g *= 1.05;

  // Clamp UVs (black outside barrel)
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    color = vec4(0.0);
  }

  gl_FragColor = color;
}
`;

const CRT_VERT = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 projectionMatrix;
varying vec2 vTextureCoord;
void main() {
  gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
  vTextureCoord = aTextureCoord;
}
`;

// =============================================
//  INIT PIXI
// =============================================
function initPixi() {
  const container = document.querySelector('.game-container');
  const canvasEl = document.getElementById('game-canvas');

  // Calculate size
  const rect = container.getBoundingClientRect();
  const maxW = Math.max(rect.width - 16, 100);
  const maxH = Math.max(rect.height - 16, 100);
  const maxCell = Math.floor(Math.min(maxW, maxH) / GRID);
  cellSize = Math.max(maxCell, 10);
  canvasSize = cellSize * GRID;

  // Remove old canvas
  if (canvasEl) canvasEl.style.display = 'none';

  // Remove old glow canvas from previous version
  const oldGlow = container.querySelector('canvas:not(#game-canvas)');
  if (oldGlow && !oldGlow._pixi) oldGlow.remove();

  // Create Pixi app
  app = new PIXI.Application({
    width: canvasSize,
    height: canvasSize,
    backgroundColor: 0x050a05,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  app.view._pixi = true;
  app.view.style.width = canvasSize + 'px';
  app.view.style.height = canvasSize + 'px';
  app.view.style.borderRadius = '0px';

  // Insert Pixi canvas into container (before overlay)
  const overlayEl = container.querySelector('.modal-overlay');
  container.insertBefore(app.view, overlayEl);

  // Create layers
  gameContainer = new PIXI.Container();
  app.stage.addChild(gameContainer);

  // Grid layer
  gridGraphics = new PIXI.Graphics();
  gameContainer.addChild(gridGraphics);

  // Light layer (dynamic lighting)
  lightContainer = new PIXI.Container();
  gameContainer.addChild(lightContainer);

  // Trail layer
  trailGraphics = new PIXI.Graphics();
  gameContainer.addChild(trailGraphics);

  // Food layer
  foodGraphics = new PIXI.Graphics();
  gameContainer.addChild(foodGraphics);

  // Particle layer
  particleContainer = new PIXI.Container();
  gameContainer.addChild(particleContainer);

  // Snake layer
  snakeGraphics = new PIXI.Graphics();
  gameContainer.addChild(snakeGraphics);

  // Apply CRT filter
  try {
    crtFilter = new PIXI.Filter(CRT_VERT, CRT_FRAG, {
      uTime: 0,
      uResolution: [canvasSize, canvasSize],
    });
    app.stage.filters = [crtFilter];
  } catch (e) {
    console.warn('[Snake] CRT shader failed, running without:', e);
  }

  // Init background stars
  initStars();

  // Game loop
  app.ticker.add(gameFrame);
}

// =============================================
//  BACKGROUND STARS (GPU sprites)
// =============================================
function initStars() {
  bgStars = [];
  for (let i = 0; i < 100; i++) {
    const star = new PIXI.Graphics();
    const size = 0.5 + Math.random() * 1.5;
    star.beginFill(0x00fc40, 0.2 + Math.random() * 0.4);
    star.drawCircle(0, 0, size);
    star.endFill();
    star.x = Math.random() * canvasSize;
    star.y = Math.random() * canvasSize;
    star._phase = Math.random() * Math.PI * 2;
    star._baseAlpha = 0.15 + Math.random() * 0.35;
    gameContainer.addChildAt(star, 1); // above grid
    bgStars.push(star);
  }
}

// =============================================
//  FOOD ORBITERS
// =============================================
function initFoodOrbiters() {
  foodOrbiters = [];
  for (let i = 0; i < 6; i++) {
    foodOrbiters.push({
      angle: (Math.PI * 2 / 6) * i,
      radius: 0.5 + Math.random() * 0.4,
      speed: 0.025 + Math.random() * 0.025,
      size: 1.5 + Math.random() * 2,
    });
  }
}

// =============================================
//  PARTICLE SYSTEM (GPU-accelerated)
// =============================================
class GPUParticle {
  constructor(x, y, opts = {}) {
    this.gfx = new PIXI.Graphics();
    this.x = x; this.y = y;
    const angle = opts.angle ?? Math.random() * Math.PI * 2;
    const spd = (opts.speed ?? 3) * (0.5 + Math.random());
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd;
    this.life = 1;
    this.decay = opts.decay ?? (0.012 + Math.random() * 0.02);
    this.size = opts.size ?? (2 + Math.random() * 4);
    this.color = opts.color ?? 0x00fc40;
    this.gravity = opts.gravity ?? 0.06;
    this.friction = opts.friction ?? 0.98;
    this.type = opts.type ?? 'circle';

    this.gfx.x = x;
    this.gfx.y = y;
    particleContainer.addChild(this.gfx);
    this._draw();
  }

  _draw() {
    this.gfx.clear();
    this.gfx.beginFill(this.color, this.life);
    if (this.type === 'circle') {
      this.gfx.drawCircle(0, 0, this.size);
    } else {
      // spark — elongated
      this.gfx.drawEllipse(0, 0, this.size * 2, this.size * 0.5);
    }
    this.gfx.endFill();
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.gfx.x = this.x;
    this.gfx.y = this.y;
    this.gfx.alpha = Math.max(0, this.life);
    this.gfx.scale.set(Math.max(0.1, this.life));

    if (this.type === 'spark') {
      this.gfx.rotation = Math.atan2(this.vy, this.vx);
    }
  }

  destroy() {
    if (this.gfx.parent) this.gfx.parent.removeChild(this.gfx);
    this.gfx.destroy();
  }
}

function emit(x, y, count, opts = {}) {
  for (let i = 0; i < count; i++) {
    particles.push(new GPUParticle(x, y, {
      ...opts,
      angle: opts.angle ?? Math.random() * Math.PI * 2,
    }));
  }
}

function emitRing(x, y, color = 0xff4466) {
  const ring = new PIXI.Graphics();
  ring.x = x; ring.y = y;
  ring._life = 1;
  ring._color = color;
  particleContainer.addChild(ring);
  particles.push({
    isRing: true, gfx: ring, life: 1, decay: 0.025,
    update() {
      this.life -= this.decay;
      this.gfx.clear();
      this.gfx.lineStyle(2 * this.life, this._color, this.life);
      const r = (1 - this.life) * cellSize * 2 + cellSize * 0.5;
      this.gfx.drawCircle(0, 0, r);
      this.gfx.alpha = this.life;
    },
    destroy() {
      if (this.gfx.parent) this.gfx.parent.removeChild(this.gfx);
      this.gfx.destroy();
    },
    _color: color,
  });
}

// =============================================
//  DYNAMIC LIGHT
// =============================================
function createLight(x, y, color, radius, alpha = 0.3) {
  const light = new PIXI.Graphics();
  light.beginFill(color, alpha);
  light.drawCircle(0, 0, radius);
  light.endFill();
  light.x = x;
  light.y = y;
  light.blendMode = PIXI.BLEND_MODES.ADD;
  light.filters = [new PIXI.BlurFilter(radius * 0.6)];
  lightContainer.addChild(light);
  return light;
}

let snakeLight = null;
let foodLight = null;

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
  eatFlash = 0;
  comboGlow = 0;
  deathTimer = -1;
  screenShake = { x: 0, y: 0, intensity: 0 };
  tickAccum = 0;
  lerpT = 0;

  // Clear particles
  particles.forEach(p => p.destroy());
  particles = [];

  // Clear trail
  trailPoints = [];

  // Clear lights
  lightContainer.removeChildren();

  // Create snake light (follows head)
  snakeLight = createLight(mid * cellSize, mid * cellSize, 0x00ff44, cellSize * 4, 0.15);

  spawnFood();
}

function spawnFood() {
  const occ = new Set(snake.map(s => `${s.x},${s.y}`));
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (occ.has(`${pos.x},${pos.y}`));
  food = pos;
  initFoodOrbiters();

  // Food light
  if (foodLight && foodLight.parent) foodLight.parent.removeChild(foodLight);
  foodLight = createLight(food.x * cellSize + cellSize / 2, food.y * cellSize + cellSize / 2, 0xff3355, cellSize * 3, 0.2);
}

function tick() {
  prevSnake = snake.map(s => ({ ...s }));
  lerpT = 0;
  direction = { ...nextDirection };

  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) { triggerDeath(); return; }
  if (snake.some(s => s.x === head.x && s.y === head.y)) { triggerDeath(); return; }

  snake.unshift(head);

  const cs = cellSize;
  trailPoints.push({ x: head.x * cs + cs / 2, y: head.y * cs + cs / 2, life: 1 });
  if (trailPoints.length > 50) trailPoints.shift();

  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreDisplay.textContent = score;
    eatFlash = 1;
    comboGlow = 1;

    const fx = food.x * cs + cs / 2;
    const fy = food.y * cs + cs / 2;

    // Massive particle explosion (GPU handles it!)
    emit(fx, fy, 40, { color: 0xff4466, speed: 5, size: 3, decay: 0.015, gravity: 0.04 });
    emit(fx, fy, 25, { color: 0xffaa00, speed: 4, type: 'spark', size: 4, decay: 0.018 });
    emit(fx, fy, 15, { color: 0xffffff, speed: 3, size: 2, decay: 0.02 });
    emitRing(fx, fy, 0xff6688);
    emitRing(fx, fy, 0xffaa44);

    screenShake.intensity = 8;
    playSound('eat');
    if (navigator.vibrate) navigator.vibrate([20, 10, 15]);
    spawnFood();
  } else {
    snake.pop();
  }
}

function setDirection(dir) {
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

  snake.forEach((seg, i) => {
    const sx = seg.x * cs + cs / 2;
    const sy = seg.y * cs + cs / 2;
    setTimeout(() => {
      emit(sx, sy, 15, {
        color: i === 0 ? 0x00ff55 : 0x00cc44,
        speed: 6, type: i % 2 === 0 ? 'spark' : 'circle',
        size: 4, decay: 0.014, gravity: 0.05,
      });
    }, i * 25);
  });

  screenShake.intensity = 18;
  if (navigator.vibrate) navigator.vibrate([50, 30, 80]);
  setTimeout(gameOver, 900);
}

async function gameOver() {
  gameRunning = false;
  deathTimer = -1;

  stats.recordGame(false, { score });
  onGameEnd('snake', { won: false, score });

  const isNew = score > getBest();
  if (isNew) { setBest(score); launchConfetti(); playSound('win'); }
  else { playSound('gameover'); }
  bestDisplay.textContent = getBest();

  overlayIcon.textContent = '💀';
  overlayTitle.textContent = 'Game Over!';
  overlayMsg.textContent = isNew ? 'Novo Recorde!' : '';
  overlayScore.textContent = `Pontuacao: ${score}`;
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
//  RENDER (PixiJS GPU)
// =============================================
function render(dt) {
  const cs = cellSize;
  const W = canvasSize;
  const t = timeElapsed;
  const interp = Math.min(lerpT, 1);

  // ---- Screen shake ----
  if (screenShake.intensity > 0) {
    gameContainer.x = (Math.random() - 0.5) * screenShake.intensity;
    gameContainer.y = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.intensity *= 0.87;
    if (screenShake.intensity < 0.3) { screenShake.intensity = 0; gameContainer.x = 0; gameContainer.y = 0; }
  }

  // ---- Grid (animated wave) ----
  gridGraphics.clear();
  gridGraphics.lineStyle(0.5, 0x00fc40, 0.06);
  for (let i = 0; i <= GRID; i++) {
    gridGraphics.moveTo(i * cs, 0); gridGraphics.lineTo(i * cs, W);
    gridGraphics.moveTo(0, i * cs); gridGraphics.lineTo(W, i * cs);
  }
  // Grid intersection dots with wave
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const px = i * cs, py = j * cs;
      const dist = Math.sqrt((px - W / 2) ** 2 + (py - W / 2) ** 2);
      const wave = Math.sin(dist * 0.02 - t * 3) * 0.5 + 0.5;
      const alpha = 0.03 + wave * 0.07;
      gridGraphics.beginFill(0x00fc40, alpha);
      gridGraphics.drawCircle(px, py, 1);
      gridGraphics.endFill();
    }
  }

  // ---- Stars twinkle ----
  bgStars.forEach(star => {
    const twinkle = Math.sin(t * 3 + star._phase) * 0.3 + 0.7;
    star.alpha = star._baseAlpha * twinkle;
  });

  // ---- Eat flash ----
  if (eatFlash > 0) {
    app.renderer.background.color = eatFlash > 0.5 ? 0x0a1a0a : 0x050a05;
    eatFlash *= 0.88;
    if (eatFlash < 0.01) { eatFlash = 0; app.renderer.background.color = 0x050a05; }
  }

  // ---- Trail (neon vapor) ----
  trailGraphics.clear();
  trailPoints.forEach(tp => {
    tp.life -= 0.018;
    if (tp.life <= 0) return;
    trailGraphics.beginFill(0x00e038, tp.life * 0.35);
    trailGraphics.drawCircle(tp.x, tp.y, cs * 0.15 * tp.life);
    trailGraphics.endFill();
  });
  trailPoints = trailPoints.filter(tp => tp.life > 0);

  // ---- Food ----
  foodGraphics.clear();
  if (food) {
    const fx = food.x * cs + cs / 2;
    const fy = food.y * cs + cs / 2;
    const pulse = 1 + Math.sin(t * 4) * 0.12;

    // Orbiters
    foodOrbiters.forEach(orb => {
      orb.angle += orb.speed;
      const ox = fx + Math.cos(orb.angle) * cs * orb.radius;
      const oy = fy + Math.sin(orb.angle) * cs * orb.radius;
      foodGraphics.beginFill(0xff6688, 0.6);
      foodGraphics.drawCircle(ox, oy, orb.size);
      foodGraphics.endFill();
    });

    // Aura
    foodGraphics.beginFill(0xff4466, 0.08);
    foodGraphics.drawCircle(fx, fy, cs * 1.3);
    foodGraphics.endFill();

    // Body
    foodGraphics.beginFill(0xff4466);
    foodGraphics.drawCircle(fx, fy, cs * 0.38 * pulse);
    foodGraphics.endFill();

    // Highlight
    foodGraphics.beginFill(0xffffff, 0.45);
    foodGraphics.drawCircle(fx - cs * 0.08, fy - cs * 0.1, cs * 0.12);
    foodGraphics.endFill();

    // Update food light
    if (foodLight) {
      foodLight.x = fx;
      foodLight.y = fy;
      foodLight.alpha = 0.15 + Math.sin(t * 4) * 0.05;
    }
  }

  // ---- Snake ----
  snakeGraphics.clear();
  if (deathTimer < 0) {
    const len = snake.length;

    // Draw connections first (behind segments)
    for (let i = 0; i < len - 1; i++) {
      const curr = snake[i], prev = prevSnake[i] || curr;
      const next = snake[i + 1], prevNext = prevSnake[i + 1] || next;
      const sx = (prev.x + (curr.x - prev.x) * interp) * cs + cs / 2;
      const sy = (prev.y + (curr.y - prev.y) * interp) * cs + cs / 2;
      const nx = (prevNext.x + (next.x - prevNext.x) * interp) * cs + cs / 2;
      const ny = (prevNext.y + (next.y - prevNext.y) * interp) * cs + cs / 2;
      const progress = i / len;
      const alpha = (1 - progress * 0.4) * 0.6;
      const width = cs * (0.7 - progress * 0.15);

      snakeGraphics.lineStyle(width, 0x00cc33, alpha);
      snakeGraphics.moveTo(sx, sy);
      snakeGraphics.lineTo(nx, ny);
    }
    snakeGraphics.lineStyle(0);

    // Draw segments (back to front)
    for (let i = len - 1; i >= 0; i--) {
      const curr = snake[i], prev = prevSnake[i] || curr;
      const sx = (prev.x + (curr.x - prev.x) * interp) * cs + cs / 2;
      const sy = (prev.y + (curr.y - prev.y) * interp) * cs + cs / 2;
      const isHead = i === 0;
      const progress = i / len;
      const segAlpha = 1 - progress * 0.3;
      const segSize = cs * (isHead ? 0.46 : 0.40 - progress * 0.06);

      // Glow aura
      const glowColor = isHead ? 0x00ff55 : 0x00dd44;
      const glowAlpha = segAlpha * (0.1 + comboGlow * 0.15);
      snakeGraphics.beginFill(glowColor, glowAlpha);
      snakeGraphics.drawCircle(sx, sy, segSize + 5 + comboGlow * 8);
      snakeGraphics.endFill();

      // Body
      const bodyColor = isHead ? 0x44ff66 : (comboGlow > 0.3 ? 0x55ff77 : 0x00dd44);
      snakeGraphics.beginFill(bodyColor, segAlpha);
      snakeGraphics.drawCircle(sx, sy, segSize);
      snakeGraphics.endFill();

      // Inner highlight
      snakeGraphics.beginFill(0xffffff, segAlpha * 0.15);
      snakeGraphics.drawCircle(sx - segSize * 0.2, sy - segSize * 0.2, segSize * 0.5);
      snakeGraphics.endFill();

      // Scales pattern (subtle)
      if (!isHead && i % 2 === 0) {
        snakeGraphics.beginFill(0x00ff44, segAlpha * 0.08);
        snakeGraphics.drawCircle(sx, sy, segSize * 0.6);
        snakeGraphics.endFill();
      }

      // Head details
      if (isHead) {
        const dir = direction;
        const eyeOff = cs * 0.16;
        const eyeDX = dir.x * cs * 0.06;
        const eyeDY = dir.y * cs * 0.06;
        let ex1, ey1, ex2, ey2;

        if (dir.x === 1)       { ex1 = eyeOff; ey1 = -eyeOff; ex2 = eyeOff; ey2 = eyeOff; }
        else if (dir.x === -1) { ex1 = -eyeOff; ey1 = -eyeOff; ex2 = -eyeOff; ey2 = eyeOff; }
        else if (dir.y === -1) { ex1 = -eyeOff; ey1 = -eyeOff; ex2 = eyeOff; ey2 = -eyeOff; }
        else                   { ex1 = -eyeOff; ey1 = eyeOff; ex2 = eyeOff; ey2 = eyeOff; }

        // Eye whites (glow)
        snakeGraphics.beginFill(0xffffff, 0.95);
        snakeGraphics.drawCircle(sx + ex1 + eyeDX, sy + ey1 + eyeDY, cs * 0.08);
        snakeGraphics.drawCircle(sx + ex2 + eyeDX, sy + ey2 + eyeDY, cs * 0.08);
        snakeGraphics.endFill();

        // Pupils
        snakeGraphics.beginFill(0x003300);
        snakeGraphics.drawCircle(sx + ex1 + eyeDX * 1.5, sy + ey1 + eyeDY * 1.5, cs * 0.035);
        snakeGraphics.drawCircle(sx + ex2 + eyeDX * 1.5, sy + ey2 + eyeDY * 1.5, cs * 0.035);
        snakeGraphics.endFill();

        // Tongue (flickering)
        if (Math.sin(t * 10) > 0.2) {
          const tongueBase = { x: sx + dir.x * segSize, y: sy + dir.y * segSize };
          const tongueEnd = { x: tongueBase.x + dir.x * cs * 0.35, y: tongueBase.y + dir.y * cs * 0.35 };
          const perpX = dir.y, perpY = -dir.x;
          const forkLen = cs * 0.1;

          snakeGraphics.lineStyle(1.5, 0xff4466, 0.9);
          snakeGraphics.moveTo(tongueBase.x, tongueBase.y);
          snakeGraphics.lineTo(tongueEnd.x, tongueEnd.y);
          // Fork
          snakeGraphics.moveTo(tongueEnd.x, tongueEnd.y);
          snakeGraphics.lineTo(tongueEnd.x + (dir.x + perpX * 0.5) * forkLen, tongueEnd.y + (dir.y + perpY * 0.5) * forkLen);
          snakeGraphics.moveTo(tongueEnd.x, tongueEnd.y);
          snakeGraphics.lineTo(tongueEnd.x + (dir.x - perpX * 0.5) * forkLen, tongueEnd.y + (dir.y - perpY * 0.5) * forkLen);
          snakeGraphics.lineStyle(0);
        }

        // Update snake light position
        if (snakeLight) {
          snakeLight.x = sx;
          snakeLight.y = sy;
          snakeLight.alpha = 0.12 + comboGlow * 0.1;
        }
      }
    }
  }

  // ---- Death dissolve ----
  if (deathTimer >= 0 && deathTimer < 35) {
    const progress = deathTimer / 35;
    snakeGraphics.clear();
    snake.forEach((seg, i) => {
      const delay = i * 0.03;
      const segP = Math.max(0, Math.min((progress - delay) / (1 - delay), 1));
      if (segP >= 1) return;
      const sx = seg.x * cs + cs / 2;
      const sy = seg.y * cs + cs / 2;
      const scatter = segP * cs * 3;
      const angle = (i * 1.7 + progress * 5);
      snakeGraphics.beginFill(0x00cc44, (1 - segP) * 0.7);
      snakeGraphics.drawCircle(
        sx + Math.cos(angle) * scatter,
        sy + Math.sin(angle) * scatter,
        cs * 0.35 * (1 - segP)
      );
      snakeGraphics.endFill();
    });
    deathTimer++;
  }

  // ---- Particles update ----
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    if (p.life <= 0) {
      p.destroy();
      particles.splice(i, 1);
    }
  }

  // ---- Combo glow decay ----
  if (comboGlow > 0) {
    comboGlow *= 0.97;
    if (comboGlow < 0.01) comboGlow = 0;
  }

  // ---- Border glow ----
  gridGraphics.lineStyle(2, 0x00fc40, 0.12 + Math.sin(t * 2) * 0.04);
  gridGraphics.drawRect(0, 0, W, W);

  // ---- Update CRT shader time ----
  if (crtFilter) {
    crtFilter.uniforms.uTime = t;
  }
}

// =============================================
//  GAME LOOP (Pixi ticker)
// =============================================
function gameFrame(delta) {
  const dt = app.ticker.deltaMS;
  timeElapsed += dt * 0.001;

  if (gameRunning && !gamePaused && deathTimer < 0) {
    speed = Math.max(MIN_SPEED, BASE_SPEED - score * 3);
    tickAccum += dt;
    lerpT = Math.min(tickAccum / speed, 1);

    while (tickAccum >= speed) {
      tickAccum -= speed;
      tick();
    }
    lerpT = Math.min(tickAccum / speed, 1);
  }

  render(dt);
}

function startGame() {
  initAudio();
  initGame();
  overlay.classList.add('hidden');
  const btnShare = document.getElementById('btn-share');
  if (btnShare) btnShare.style.display = 'none';
  gameRunning = true;
  gamePaused = false;
  tickAccum = 0;
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
let touchStartX, touchStartY;
const SWIPE = 30;

document.addEventListener('touchstart', e => {
  if (e.target.closest('.ctrl-btn') || e.target.closest('.btn') || e.target.closest('.modal')) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (gameRunning) e.preventDefault();
}, { passive: false });

document.addEventListener('touchend', e => {
  if (!gameRunning || gamePaused || touchStartX == null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;
  if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
  else setDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
  touchStartX = null;
}, { passive: true });

// Mobile buttons
const dirMap = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

// =============================================
//  INIT
// =============================================
function init() {
  overlay      = document.getElementById('overlay');
  overlayIcon  = document.getElementById('overlay-icon');
  overlayTitle = document.getElementById('overlay-title');
  overlayMsg   = document.getElementById('overlay-msg');
  overlayScore = document.getElementById('overlay-score');
  btnStart     = document.getElementById('btn-start');
  scoreDisplay = document.getElementById('score-display');
  bestDisplay  = document.getElementById('best-display');
  bestDisplay.textContent = getBest();

  initPixi();

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

  window.addEventListener('resize', () => {
    // Recalculate and resize pixi
    const container = document.querySelector('.game-container');
    const rect = container.getBoundingClientRect();
    const maxW = Math.max(rect.width - 16, 100);
    const maxH = Math.max(rect.height - 16, 100);
    const maxCell = Math.floor(Math.min(maxW, maxH) / GRID);
    cellSize = Math.max(maxCell, 10);
    canvasSize = cellSize * GRID;
    app.renderer.resize(canvasSize, canvasSize);
    app.view.style.width = canvasSize + 'px';
    app.view.style.height = canvasSize + 'px';
    if (crtFilter) crtFilter.uniforms.uResolution = [canvasSize, canvasSize];
  });

  // Initial render
  initGame();
  render(0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
