import '../../auth-check.js';
// =============================================
//  COBRINHA — Redesign 3.0 "Cartoon Garden"
//  Estilo Poki: cobra fofa, maçã cartoon, cenário verde
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
let app, gameContainer;
let bgGraphics, snakeGraphics, foodGraphics, particleContainer, decoContainer;

// ---- State ----
let snake = [], food = null, score = 0, cellSize = 0, canvasSize = 0;
let gameRunning = false, gamePaused = false;
let tickAccum = 0, speed = BASE_SPEED;
let direction = { x: 1, y: 0 }, nextDirection = { x: 1, y: 0 };
let prevSnake = [], lerpT = 0;

// ---- VFX state ----
let particles = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let eatBump = 0; // bump traveling through snake body when eating
let eatBumpPos = 0;
let deathTimer = -1;
let timeElapsed = 0;
let foodSpawnScale = 0; // for pop-in animation
let snakeExpression = 'normal'; // 'normal', 'happy', 'dead'
let expressionTimer = 0;

// ---- Decoration positions (generated once per game) ----
let decorations = [];

// ---- Colors ----
const C = {
  bgOuter:    0x4CAF50,
  bgInner1:   0xE8D5B7,
  bgInner2:   0xDEC9A8,
  border:     0x3E8E41,
  borderDark: 0x2E7D32,
  snakeBody:  0x4CAF50,
  snakeLight: 0x66BB6A,
  snakeDark:  0x388E3C,
  snakeBelly: 0x81C784,
  eyeWhite:   0xFFFFFF,
  eyePupil:   0x1B5E20,
  cheek:      0xFF8A80,
  tongue:     0xE53935,
  apple:      0xE53935,
  appleLight: 0xEF5350,
  appleDark:  0xC62828,
  appleShine: 0xFFFFFF,
  leaf:       0x4CAF50,
  leafDark:   0x388E3C,
  stem:       0x5D4037,
  starYellow: 0xFFD54F,
  particle:   0xFFD54F,
  decoLeaf:   0x66BB6A,
  decoBush:   0x43A047,
};

// =============================================
//  INIT PIXI
// =============================================
function initPixi() {
  const container = document.querySelector('.game-container');
  const canvasEl = document.getElementById('game-canvas');

  const rect = container.getBoundingClientRect();
  const maxW = Math.max(rect.width - 16, 100);
  const maxH = Math.max(rect.height - 16, 100);
  const maxCell = Math.floor(Math.min(maxW, maxH) / GRID);
  cellSize = Math.max(maxCell, 10);
  canvasSize = cellSize * GRID;

  if (canvasEl) canvasEl.style.display = 'none';
  const oldGlow = container.querySelector('canvas:not(#game-canvas)');
  if (oldGlow && !oldGlow._pixi) oldGlow.remove();

  app = new PIXI.Application({
    width: canvasSize + cellSize * 4, // extra space for decorations
    height: canvasSize + cellSize * 4,
    backgroundColor: C.bgOuter,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  app.view._pixi = true;
  const totalSize = canvasSize + cellSize * 4;
  app.view.style.width = totalSize + 'px';
  app.view.style.height = totalSize + 'px';
  app.view.style.borderRadius = '16px';

  const overlayEl = container.querySelector('.modal-overlay');
  container.insertBefore(app.view, overlayEl);

  gameContainer = new PIXI.Container();
  gameContainer.x = cellSize * 2;
  gameContainer.y = cellSize * 2;
  app.stage.addChild(gameContainer);

  // Layers
  bgGraphics = new PIXI.Graphics();
  gameContainer.addChild(bgGraphics);

  decoContainer = new PIXI.Container();
  app.stage.addChild(decoContainer); // decorations outside game area

  foodGraphics = new PIXI.Graphics();
  gameContainer.addChild(foodGraphics);

  snakeGraphics = new PIXI.Graphics();
  gameContainer.addChild(snakeGraphics);

  particleContainer = new PIXI.Container();
  gameContainer.addChild(particleContainer);

  generateDecorations();
  app.ticker.add(gameFrame);
}

// =============================================
//  DECORATIONS (leaves, bushes around board)
// =============================================
function generateDecorations() {
  decoContainer.removeChildren();
  decorations = [];

  const offset = cellSize * 2; // gameContainer offset
  const W = canvasSize;
  const cs = cellSize;

  // Place bushes and leaves around the board edges
  const positions = [];
  // Top edge
  for (let i = 0; i < 8; i++) positions.push({ x: offset + Math.random() * W, y: offset - cs * 0.5 + Math.random() * cs, side: 'top' });
  // Bottom edge
  for (let i = 0; i < 8; i++) positions.push({ x: offset + Math.random() * W, y: offset + W - cs * 0.5 + Math.random() * cs, side: 'bottom' });
  // Left edge
  for (let i = 0; i < 5; i++) positions.push({ x: offset - cs * 0.5 + Math.random() * cs, y: offset + Math.random() * W, side: 'left' });
  // Right edge
  for (let i = 0; i < 5; i++) positions.push({ x: offset + W - cs * 0.5 + Math.random() * cs, y: offset + Math.random() * W, side: 'right' });

  positions.forEach(pos => {
    const g = new PIXI.Graphics();
    const type = Math.random();
    if (type < 0.4) {
      // Bush - cluster of circles
      const size = cs * (0.6 + Math.random() * 0.4);
      g.beginFill(C.decoBush);
      g.drawCircle(0, 0, size);
      g.endFill();
      g.beginFill(C.decoLeaf);
      g.drawCircle(-size * 0.3, -size * 0.2, size * 0.7);
      g.drawCircle(size * 0.3, -size * 0.1, size * 0.6);
      g.endFill();
    } else if (type < 0.7) {
      // Leaf
      drawLeafDecoration(g, 0, 0, cs * 0.5, Math.random() * Math.PI * 2);
    } else {
      // Small flower
      const r = cs * 0.2;
      g.beginFill(0xFFFFFF, 0.9);
      for (let p = 0; p < 5; p++) {
        const angle = (p / 5) * Math.PI * 2;
        g.drawCircle(Math.cos(angle) * r, Math.sin(angle) * r, r * 0.6);
      }
      g.endFill();
      g.beginFill(C.starYellow);
      g.drawCircle(0, 0, r * 0.5);
      g.endFill();
    }
    g.x = pos.x;
    g.y = pos.y;
    g.alpha = 0.85;
    decoContainer.addChild(g);
    decorations.push(g);
  });
}

function drawLeafDecoration(g, x, y, size, angle) {
  g.beginFill(C.decoLeaf);
  // Simple leaf shape using ellipse rotated
  g.drawEllipse(x, y, size, size * 0.4);
  g.endFill();
  g.rotation = angle;
}

// =============================================
//  PARTICLE SYSTEM (cartoon stars & leaves)
// =============================================
class CartoonParticle {
  constructor(x, y, opts = {}) {
    this.gfx = new PIXI.Graphics();
    this.x = x; this.y = y;
    const angle = opts.angle ?? Math.random() * Math.PI * 2;
    const spd = (opts.speed ?? 3) * (0.5 + Math.random());
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd;
    this.life = 1;
    this.decay = opts.decay ?? (0.015 + Math.random() * 0.02);
    this.size = opts.size ?? (3 + Math.random() * 4);
    this.color = opts.color ?? C.starYellow;
    this.gravity = opts.gravity ?? 0.08;
    this.friction = opts.friction ?? 0.97;
    this.type = opts.type ?? 'star'; // 'star', 'circle', 'leaf'
    this.rotSpeed = (Math.random() - 0.5) * 0.2;
    this.rot = Math.random() * Math.PI * 2;

    this.gfx.x = x;
    this.gfx.y = y;
    particleContainer.addChild(this.gfx);
    this._draw();
  }

  _draw() {
    this.gfx.clear();
    if (this.type === 'star') {
      this._drawStar();
    } else if (this.type === 'leaf') {
      this.gfx.beginFill(C.decoLeaf, this.life);
      this.gfx.drawEllipse(0, 0, this.size, this.size * 0.4);
      this.gfx.endFill();
    } else {
      this.gfx.beginFill(this.color, this.life);
      this.gfx.drawCircle(0, 0, this.size);
      this.gfx.endFill();
    }
  }

  _drawStar() {
    const s = this.size;
    const pts = 4;
    this.gfx.beginFill(this.color, this.life);
    this.gfx.moveTo(0, -s);
    for (let i = 0; i < pts; i++) {
      const a1 = ((i * 2 + 1) / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i * 2 + 2) / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
      this.gfx.lineTo(Math.cos(a1) * s * 0.4, Math.sin(a1) * s * 0.4);
      this.gfx.lineTo(Math.cos(a2) * s, Math.sin(a2) * s);
    }
    this.gfx.closePath();
    this.gfx.endFill();
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.rot += this.rotSpeed;
    this.gfx.x = this.x;
    this.gfx.y = this.y;
    this.gfx.alpha = Math.max(0, this.life);
    this.gfx.scale.set(Math.max(0.1, this.life));
    this.gfx.rotation = this.rot;
  }

  destroy() {
    if (this.gfx.parent) this.gfx.parent.removeChild(this.gfx);
    this.gfx.destroy();
  }
}

function emit(x, y, count, opts = {}) {
  for (let i = 0; i < count; i++) {
    particles.push(new CartoonParticle(x, y, {
      ...opts,
      angle: opts.angle ?? Math.random() * Math.PI * 2,
    }));
  }
}

// =============================================
//  GAME LOGIC (unchanged from original)
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
  eatBump = 0;
  eatBumpPos = 0;
  deathTimer = -1;
  screenShake = { x: 0, y: 0, intensity: 0 };
  tickAccum = 0;
  lerpT = 0;
  snakeExpression = 'normal';
  expressionTimer = 0;
  foodSpawnScale = 0;

  particles.forEach(p => p.destroy());
  particles = [];

  spawnFood();
}

function spawnFood() {
  const occ = new Set(snake.map(s => `${s.x},${s.y}`));
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (occ.has(`${pos.x},${pos.y}`));
  food = pos;
  foodSpawnScale = 0; // triggers pop-in animation
}

function tick() {
  prevSnake = snake.map(s => ({ ...s }));
  lerpT = 0;
  direction = { ...nextDirection };

  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) { triggerDeath(); return; }
  if (snake.some(s => s.x === head.x && s.y === head.y)) { triggerDeath(); return; }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreDisplay.textContent = score;

    const cs = cellSize;
    const fx = food.x * cs + cs / 2;
    const fy = food.y * cs + cs / 2;

    // Cartoon star particles
    emit(fx, fy, 8, { color: C.starYellow, speed: 4, size: 5, decay: 0.02, gravity: 0.06, type: 'star' });
    emit(fx, fy, 5, { color: 0xFFFFFF, speed: 3, size: 3, decay: 0.025, gravity: 0.05, type: 'circle' });

    // Eat bump effect
    eatBump = 1;
    eatBumpPos = 0;

    // Happy expression
    snakeExpression = 'happy';
    expressionTimer = 0.5;

    screenShake.intensity = 3; // subtle shake
    playSound('eat');
    if (navigator.vibrate) navigator.vibrate([15]);

    // Milestone celebration
    if (score % 10 === 0) {
      emit(fx, fy, 20, { color: C.starYellow, speed: 6, size: 6, decay: 0.012, gravity: 0.04, type: 'star' });
      emit(fx, fy, 10, { color: C.apple, speed: 5, size: 4, decay: 0.015, gravity: 0.05, type: 'circle' });
      launchConfetti();
    }

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
//  DEATH (cartoon style)
// =============================================
function triggerDeath() {
  deathTimer = 0;
  snakeExpression = 'dead';
  screenShake.intensity = 6;
  if (navigator.vibrate) navigator.vibrate([30, 20, 40]);
  setTimeout(gameOver, 1200);
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
//  RENDER
// =============================================
function render(dt) {
  const cs = cellSize;
  const W = canvasSize;
  const t = timeElapsed;
  const interp = Math.min(lerpT, 1);

  // ---- Screen shake ----
  if (screenShake.intensity > 0) {
    gameContainer.x = cellSize * 2 + (Math.random() - 0.5) * screenShake.intensity;
    gameContainer.y = cellSize * 2 + (Math.random() - 0.5) * screenShake.intensity;
    screenShake.intensity *= 0.88;
    if (screenShake.intensity < 0.2) {
      screenShake.intensity = 0;
      gameContainer.x = cellSize * 2;
      gameContainer.y = cellSize * 2;
    }
  }

  // ---- Background ----
  drawBackground(cs, W);

  // ---- Food (apple) ----
  drawFood(cs, t);

  // ---- Snake ----
  drawSnake(cs, W, t, interp);

  // ---- Particles ----
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    if (p.life <= 0) {
      p.destroy();
      particles.splice(i, 1);
    }
  }

  // ---- Expression timer ----
  if (expressionTimer > 0) {
    expressionTimer -= dt * 0.001;
    if (expressionTimer <= 0) snakeExpression = 'normal';
  }

  // ---- Eat bump decay ----
  if (eatBump > 0) {
    eatBump *= 0.92;
    eatBumpPos += dt * 0.008;
    if (eatBump < 0.01) eatBump = 0;
  }

  // ---- Food spawn animation ----
  if (foodSpawnScale < 1) {
    foodSpawnScale = Math.min(1, foodSpawnScale + dt * 0.006);
  }

  // ---- Ambient leaves (occasional) ----
  if (Math.random() < 0.005) {
    const lx = Math.random() * W;
    emit(lx, -10, 1, { color: C.decoLeaf, speed: 0.5, size: 4, decay: 0.003, gravity: 0.02, friction: 0.999, type: 'leaf' });
  }
}

// =============================================
//  DRAW BACKGROUND
// =============================================
function drawBackground(cs, W) {
  bgGraphics.clear();

  // Board shadow
  bgGraphics.beginFill(0x2E7D32, 0.3);
  bgGraphics.drawRoundedRect(4, 4, W, W, 8);
  bgGraphics.endFill();

  // Board border (thick rounded)
  bgGraphics.beginFill(C.borderDark);
  bgGraphics.drawRoundedRect(-4, -4, W + 8, W + 8, 12);
  bgGraphics.endFill();

  bgGraphics.beginFill(C.border);
  bgGraphics.drawRoundedRect(-2, -2, W + 4, W + 4, 10);
  bgGraphics.endFill();

  // Board background
  bgGraphics.beginFill(C.bgInner1);
  bgGraphics.drawRoundedRect(0, 0, W, W, 6);
  bgGraphics.endFill();

  // Checkerboard pattern (subtle)
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if ((x + y) % 2 === 0) {
        bgGraphics.beginFill(C.bgInner2, 0.5);
        bgGraphics.drawRect(x * cs, y * cs, cs, cs);
        bgGraphics.endFill();
      }
    }
  }
}

// =============================================
//  DRAW FOOD (APPLE)
// =============================================
function drawFood(cs, t) {
  foodGraphics.clear();
  if (!food) return;

  const fx = food.x * cs + cs / 2;
  const fy = food.y * cs + cs / 2;
  const wobble = Math.sin(t * 3) * 0.05;
  const bounce = Math.sin(t * 2) * 2;

  // Pop-in scale
  const popScale = foodSpawnScale < 1
    ? easeOutBack(foodSpawnScale)
    : 1;
  const r = cs * 0.38 * popScale;

  // Apple body
  foodGraphics.beginFill(C.apple);
  foodGraphics.drawCircle(fx, fy + bounce * 0.3, r);
  foodGraphics.endFill();

  // Apple highlight (3D effect)
  foodGraphics.beginFill(C.appleLight, 0.5);
  foodGraphics.drawEllipse(fx - r * 0.2, fy - r * 0.2 + bounce * 0.3, r * 0.5, r * 0.4);
  foodGraphics.endFill();

  // Apple shine (white specular)
  foodGraphics.beginFill(C.appleShine, 0.7);
  foodGraphics.drawCircle(fx - r * 0.25, fy - r * 0.3 + bounce * 0.3, r * 0.18);
  foodGraphics.endFill();

  // Stem
  foodGraphics.lineStyle(cs * 0.06, C.stem);
  foodGraphics.moveTo(fx, fy - r + bounce * 0.3);
  foodGraphics.lineTo(fx + cs * 0.03, fy - r - cs * 0.15 + bounce * 0.3);
  foodGraphics.lineStyle(0);

  // Leaf on top
  const leafX = fx + cs * 0.06;
  const leafY = fy - r - cs * 0.08 + bounce * 0.3;
  foodGraphics.beginFill(C.leaf);
  foodGraphics.moveTo(leafX, leafY);
  foodGraphics.bezierCurveTo(
    leafX + cs * 0.15, leafY - cs * 0.1,
    leafX + cs * 0.2, leafY + cs * 0.05,
    leafX + cs * 0.05, leafY + cs * 0.08
  );
  foodGraphics.endFill();
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// =============================================
//  DRAW SNAKE
// =============================================
function drawSnake(cs, W, t, interp) {
  snakeGraphics.clear();

  if (deathTimer >= 0) {
    drawSnakeDeath(cs, t);
    return;
  }

  const len = snake.length;
  if (len === 0) return;

  // Calculate interpolated positions
  const positions = [];
  for (let i = 0; i < len; i++) {
    const curr = snake[i], prev = prevSnake[i] || curr;
    const sx = (prev.x + (curr.x - prev.x) * interp) * cs + cs / 2;
    const sy = (prev.y + (curr.y - prev.y) * interp) * cs + cs / 2;
    positions.push({ x: sx, y: sy });
  }

  // Draw body shadow
  snakeGraphics.beginFill(0x2E7D32, 0.2);
  for (let i = len - 1; i >= 1; i--) {
    const p = positions[i];
    const progress = i / len;
    const segSize = cs * (0.38 - progress * 0.08);
    // Eat bump
    let bump = 0;
    if (eatBump > 0) {
      const dist = Math.abs(i - eatBumpPos * len);
      bump = Math.max(0, eatBump * (1 - dist * 0.3)) * cs * 0.1;
    }
    snakeGraphics.drawCircle(p.x + 2, p.y + 3, segSize + bump);
  }
  snakeGraphics.endFill();

  // Draw body connections (thick rounded line between segments)
  for (let i = 0; i < len - 1; i++) {
    const p1 = positions[i];
    const p2 = positions[i + 1];
    const progress = i / len;
    const width = cs * (0.65 - progress * 0.15);

    let bump = 0;
    if (eatBump > 0) {
      const dist = Math.abs(i - eatBumpPos * len);
      bump = Math.max(0, eatBump * (1 - dist * 0.3)) * cs * 0.15;
    }

    snakeGraphics.lineStyle(width + bump, C.snakeBody, 1);
    snakeGraphics.moveTo(p1.x, p1.y);
    snakeGraphics.lineTo(p2.x, p2.y);
  }
  snakeGraphics.lineStyle(0);

  // Draw body segments (circles) - back to front
  for (let i = len - 1; i >= 1; i--) {
    const p = positions[i];
    const progress = i / len;
    const segSize = cs * (0.35 - progress * 0.06);

    let bump = 0;
    if (eatBump > 0) {
      const dist = Math.abs(i - eatBumpPos * len);
      bump = Math.max(0, eatBump * (1 - dist * 0.3)) * cs * 0.1;
    }

    // Main body
    snakeGraphics.beginFill(C.snakeBody);
    snakeGraphics.drawCircle(p.x, p.y, segSize + bump);
    snakeGraphics.endFill();

    // Belly highlight (lighter stripe)
    snakeGraphics.beginFill(C.snakeBelly, 0.3);
    snakeGraphics.drawEllipse(p.x, p.y + segSize * 0.15, segSize * 0.5, segSize * 0.35);
    snakeGraphics.endFill();

    // Top highlight (3D volume)
    snakeGraphics.beginFill(C.snakeLight, 0.3);
    snakeGraphics.drawCircle(p.x - segSize * 0.15, p.y - segSize * 0.2, segSize * 0.35);
    snakeGraphics.endFill();

    // Dark pattern spots (every other)
    if (i % 3 === 0) {
      snakeGraphics.beginFill(C.snakeDark, 0.15);
      snakeGraphics.drawCircle(p.x, p.y, segSize * 0.6);
      snakeGraphics.endFill();
    }
  }

  // ---- HEAD ----
  drawSnakeHead(positions[0], cs, t);
}

function drawSnakeHead(headPos, cs, t) {
  const hx = headPos.x;
  const hy = headPos.y;
  const dir = direction;
  const headSize = cs * 0.44;

  // Head shadow
  snakeGraphics.beginFill(0x2E7D32, 0.2);
  snakeGraphics.drawCircle(hx + 2, hy + 3, headSize);
  snakeGraphics.endFill();

  // Head shape (slightly oval in direction of movement)
  const stretchX = 1 + Math.abs(dir.x) * 0.12;
  const stretchY = 1 + Math.abs(dir.y) * 0.12;

  snakeGraphics.beginFill(C.snakeBody);
  snakeGraphics.drawEllipse(hx + dir.x * cs * 0.05, hy + dir.y * cs * 0.05, headSize * stretchX, headSize * stretchY);
  snakeGraphics.endFill();

  // Top highlight
  snakeGraphics.beginFill(C.snakeLight, 0.4);
  snakeGraphics.drawEllipse(hx - headSize * 0.15, hy - headSize * 0.2, headSize * 0.5, headSize * 0.4);
  snakeGraphics.endFill();

  // ---- EYES ----
  const eyeOff = cs * 0.17;
  const eyeForward = cs * 0.08;
  let ex1, ey1, ex2, ey2;

  if (dir.x === 1)       { ex1 = eyeOff; ey1 = -eyeOff * 0.7; ex2 = eyeOff; ey2 = eyeOff * 0.7; }
  else if (dir.x === -1) { ex1 = -eyeOff; ey1 = -eyeOff * 0.7; ex2 = -eyeOff; ey2 = eyeOff * 0.7; }
  else if (dir.y === -1) { ex1 = -eyeOff * 0.7; ey1 = -eyeOff; ex2 = eyeOff * 0.7; ey2 = -eyeOff; }
  else                   { ex1 = -eyeOff * 0.7; ey1 = eyeOff; ex2 = eyeOff * 0.7; ey2 = eyeOff; }

  const eyeSize = cs * 0.14;
  const pupilSize = cs * 0.07;

  if (snakeExpression === 'dead') {
    // X_X eyes
    const xSize = eyeSize * 0.7;
    snakeGraphics.lineStyle(2, C.eyePupil);
    // Eye 1 - X
    snakeGraphics.moveTo(hx + ex1 - xSize, hy + ey1 - xSize);
    snakeGraphics.lineTo(hx + ex1 + xSize, hy + ey1 + xSize);
    snakeGraphics.moveTo(hx + ex1 + xSize, hy + ey1 - xSize);
    snakeGraphics.lineTo(hx + ex1 - xSize, hy + ey1 + xSize);
    // Eye 2 - X
    snakeGraphics.moveTo(hx + ex2 - xSize, hy + ey2 - xSize);
    snakeGraphics.lineTo(hx + ex2 + xSize, hy + ey2 + xSize);
    snakeGraphics.moveTo(hx + ex2 + xSize, hy + ey2 - xSize);
    snakeGraphics.lineTo(hx + ex2 - xSize, hy + ey2 + xSize);
    snakeGraphics.lineStyle(0);
  } else if (snakeExpression === 'happy') {
    // ^_^ eyes (happy arcs)
    snakeGraphics.lineStyle(2.5, C.eyePupil);
    // Eye 1 - arc
    snakeGraphics.arc(hx + ex1, hy + ey1 + eyeSize * 0.3, eyeSize * 0.6, Math.PI, 0);
    // Eye 2 - arc
    snakeGraphics.arc(hx + ex2, hy + ey2 + eyeSize * 0.3, eyeSize * 0.6, Math.PI, 0);
    snakeGraphics.lineStyle(0);

    // Blush cheeks
    snakeGraphics.beginFill(C.cheek, 0.35);
    const cheekOff = dir.y !== 0 ? { x: eyeOff * 1.5, y: 0 } : { x: 0, y: eyeOff * 1.5 };
    snakeGraphics.drawCircle(hx + cheekOff.x * 0.5, hy + cheekOff.y * 0.5 + cs * 0.05, cs * 0.08);
    snakeGraphics.drawCircle(hx - cheekOff.x * 0.5, hy - cheekOff.y * 0.5 + cs * 0.05, cs * 0.08);
    snakeGraphics.endFill();
  } else {
    // Normal eyes - big white circles with pupils
    // Eye whites
    snakeGraphics.beginFill(C.eyeWhite);
    snakeGraphics.drawCircle(hx + ex1, hy + ey1, eyeSize);
    snakeGraphics.drawCircle(hx + ex2, hy + ey2, eyeSize);
    snakeGraphics.endFill();

    // Pupils (look in direction of movement)
    const pupilDX = dir.x * pupilSize * 0.4;
    const pupilDY = dir.y * pupilSize * 0.4;
    snakeGraphics.beginFill(C.eyePupil);
    snakeGraphics.drawCircle(hx + ex1 + pupilDX, hy + ey1 + pupilDY, pupilSize);
    snakeGraphics.drawCircle(hx + ex2 + pupilDX, hy + ey2 + pupilDY, pupilSize);
    snakeGraphics.endFill();

    // Eye shine
    snakeGraphics.beginFill(0xFFFFFF, 0.8);
    snakeGraphics.drawCircle(hx + ex1 - pupilSize * 0.3, hy + ey1 - pupilSize * 0.3, pupilSize * 0.35);
    snakeGraphics.drawCircle(hx + ex2 - pupilSize * 0.3, hy + ey2 - pupilSize * 0.3, pupilSize * 0.35);
    snakeGraphics.endFill();

    // Subtle cheeks
    snakeGraphics.beginFill(C.cheek, 0.15);
    if (dir.y !== 0) {
      snakeGraphics.drawCircle(hx - eyeOff * 1.2, hy + dir.y * cs * 0.02, cs * 0.07);
      snakeGraphics.drawCircle(hx + eyeOff * 1.2, hy + dir.y * cs * 0.02, cs * 0.07);
    } else {
      snakeGraphics.drawCircle(hx + dir.x * cs * 0.02, hy - eyeOff * 1.2, cs * 0.07);
      snakeGraphics.drawCircle(hx + dir.x * cs * 0.02, hy + eyeOff * 1.2, cs * 0.07);
    }
    snakeGraphics.endFill();
  }

  // ---- TONGUE ----
  if (snakeExpression === 'normal' && Math.sin(t * 8) > 0.3) {
    const tongueBase = { x: hx + dir.x * headSize * 0.9, y: hy + dir.y * headSize * 0.9 };
    const tongueLen = cs * 0.25;
    const tongueEnd = { x: tongueBase.x + dir.x * tongueLen, y: tongueBase.y + dir.y * tongueLen };
    const perpX = dir.y, perpY = -dir.x;
    const forkLen = cs * 0.08;

    snakeGraphics.lineStyle(1.5, C.tongue, 0.9);
    snakeGraphics.moveTo(tongueBase.x, tongueBase.y);
    snakeGraphics.lineTo(tongueEnd.x, tongueEnd.y);
    snakeGraphics.moveTo(tongueEnd.x, tongueEnd.y);
    snakeGraphics.lineTo(tongueEnd.x + (dir.x + perpX * 0.6) * forkLen, tongueEnd.y + (dir.y + perpY * 0.6) * forkLen);
    snakeGraphics.moveTo(tongueEnd.x, tongueEnd.y);
    snakeGraphics.lineTo(tongueEnd.x + (dir.x - perpX * 0.6) * forkLen, tongueEnd.y + (dir.y - perpY * 0.6) * forkLen);
    snakeGraphics.lineStyle(0);
  }

  // ---- Smile (subtle) ----
  if (snakeExpression === 'normal') {
    const smileOff = headSize * 0.3;
    snakeGraphics.lineStyle(1.5, C.snakeDark, 0.3);
    snakeGraphics.arc(
      hx + dir.x * smileOff * 0.5,
      hy + dir.y * smileOff * 0.5,
      cs * 0.1,
      dir.x === 1 ? 0 : dir.x === -1 ? Math.PI : dir.y === 1 ? Math.PI / 2 : -Math.PI / 2,
      dir.x === 1 ? Math.PI : dir.x === -1 ? 0 : dir.y === 1 ? -Math.PI / 2 : Math.PI / 2,
      dir.x === 1 || dir.y === -1
    );
    snakeGraphics.lineStyle(0);
  }
}

function drawSnakeDeath(cs, t) {
  if (deathTimer >= 40) return;

  const progress = deathTimer / 40;
  const len = snake.length;

  // Snake fades and flattens
  for (let i = 0; i < len; i++) {
    const seg = snake[i];
    const sx = seg.x * cs + cs / 2;
    const sy = seg.y * cs + cs / 2;
    const segSize = cs * (i === 0 ? 0.44 : 0.35 - (i / len) * 0.06);

    const fadeAlpha = Math.max(0, 1 - progress * 1.5 + i * 0.02);
    if (fadeAlpha <= 0) continue;

    // Body wobbles
    const wobbleX = Math.sin(t * 15 + i * 2) * progress * cs * 0.3;
    const wobbleY = Math.cos(t * 12 + i * 3) * progress * cs * 0.2;

    snakeGraphics.beginFill(C.snakeBody, fadeAlpha);
    snakeGraphics.drawCircle(sx + wobbleX, sy + wobbleY, segSize * (1 - progress * 0.5));
    snakeGraphics.endFill();

    // Stars above head on death
    if (i === 0 && progress < 0.8) {
      for (let s = 0; s < 3; s++) {
        const starAngle = t * 5 + s * (Math.PI * 2 / 3);
        const starR = cs * 0.5;
        const starX = sx + Math.cos(starAngle) * starR;
        const starY = sy - cs * 0.4 + Math.sin(starAngle * 0.5) * cs * 0.1;

        snakeGraphics.beginFill(C.starYellow, fadeAlpha * 0.8);
        snakeGraphics.drawStar(starX, starY, 4, cs * 0.08, cs * 0.04);
        snakeGraphics.endFill();
      }
    }
  }

  deathTimer++;
}

// =============================================
//  GAME LOOP
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

  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      if (!gameRunning || gamePaused) return;
      const d = dirMap[btn.dataset.dir];
      if (d) setDirection(d);
    });
  });

  const newBtn = btnStart.cloneNode(true);
  btnStart.parentNode.replaceChild(newBtn, btnStart);
  btnStart = newBtn;
  btnStart.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); startGame(); });
  btnStart.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); startGame(); }, { passive: false });

  window.addEventListener('resize', () => {
    const container = document.querySelector('.game-container');
    const rect = container.getBoundingClientRect();
    const maxW = Math.max(rect.width - 16, 100);
    const maxH = Math.max(rect.height - 16, 100);
    const maxCell = Math.floor(Math.min(maxW, maxH) / GRID);
    cellSize = Math.max(maxCell, 10);
    canvasSize = cellSize * GRID;
    const totalSize = canvasSize + cellSize * 4;
    app.renderer.resize(totalSize, totalSize);
    app.view.style.width = totalSize + 'px';
    app.view.style.height = totalSize + 'px';
    gameContainer.x = cellSize * 2;
    gameContainer.y = cellSize * 2;
    generateDecorations();
  });

  initGame();
  render(0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
