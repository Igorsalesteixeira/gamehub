import '../../auth-check.js';
// =============================================
//  COBRINHA — Redesign 3.0 v2 "Cartoon Garden"
//  Nível Poki: cobra chunky, contornos grossos, tudo bold
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
let eatBump = 0;
let eatBumpPos = 0;
let deathTimer = -1;
let timeElapsed = 0;
let foodSpawnScale = 0;
let snakeExpression = 'normal'; // 'normal', 'happy', 'dead'
let expressionTimer = 0;

// ---- Decoration positions ----
let decorations = [];

// ---- Colors ----
const C = {
  bgOuter:    0x4CAF50,
  bgInner1:   0xE8D5B7,
  bgInner2:   0xDEC9A8,
  // Board border — thick brown/red like Poki
  borderOuter:0x8B4513,  // saddle brown
  borderMid:  0xA0522D,  // sienna
  borderInner:0x5D9E3C,  // green inner padding
  borderGlow: 0x6DBF4A,  // lighter green edge
  // Snake — chunky cartoon
  snakeBody:  0x4CAF50,
  snakeLight: 0x66BB6A,
  snakeDark:  0x2E7D32,  // dark outline
  snakeOutline: 0x1B5E20, // very dark outline stroke
  snakeBelly: 0x81C784,
  eyeWhite:   0xFFFFFF,
  eyePupil:   0x1B5E20,
  cheek:      0xFF8A80,
  tongue:     0xE53935,
  // Apple
  apple:      0xE53935,
  appleLight: 0xEF5350,
  appleDark:  0xC62828,
  appleOutline:0x8B0000,
  appleShine: 0xFFFFFF,
  leaf:       0x4CAF50,
  leafDark:   0x2E7D32,
  stem:       0x5D4037,
  // Particles & Deco
  starYellow: 0xFFD54F,
  particle:   0xFFD54F,
  decoLeaf:   0x66BB6A,
  decoLeafDark:0x388E3C,
  decoBush:   0x43A047,
  decoBushDark:0x2E7D32,
  flower:     0xFFFFFF,
  flowerCenter:0xFFD54F,
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
  // Reserve more space for thick border + decorations
  const PADDING = 5; // cells of padding around board
  const maxCell = Math.floor(Math.min(maxW, maxH) / (GRID + PADDING));
  cellSize = Math.max(maxCell, 10);
  canvasSize = cellSize * GRID;

  if (canvasEl) canvasEl.style.display = 'none';
  const oldGlow = container.querySelector('canvas:not(#game-canvas)');
  if (oldGlow && !oldGlow._pixi) oldGlow.remove();

  const totalSize = canvasSize + cellSize * PADDING;

  app = new PIXI.Application({
    width: totalSize,
    height: totalSize,
    backgroundColor: C.bgOuter,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  app.view._pixi = true;
  app.view.style.width = totalSize + 'px';
  app.view.style.height = totalSize + 'px';
  app.view.style.borderRadius = '20px';

  const overlayEl = container.querySelector('.modal-overlay');
  container.insertBefore(app.view, overlayEl);

  const off = cellSize * PADDING / 2;
  gameContainer = new PIXI.Container();
  gameContainer.x = off;
  gameContainer.y = off;
  app.stage.addChild(gameContainer);

  // Layers
  bgGraphics = new PIXI.Graphics();
  gameContainer.addChild(bgGraphics);

  decoContainer = new PIXI.Container();
  app.stage.addChild(decoContainer);

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
//  DECORATIONS (detailed leaves, bushes, flowers)
// =============================================
function generateDecorations() {
  decoContainer.removeChildren();
  decorations = [];

  const off = gameContainer.x;
  const W = canvasSize;
  const cs = cellSize;
  const border = cs * 1.2; // border thickness

  const positions = [];
  // Top edge
  for (let i = 0; i < 10; i++) positions.push({ x: off + Math.random() * W, y: off - border * 0.3 + Math.random() * border * 0.8 });
  // Bottom edge
  for (let i = 0; i < 10; i++) positions.push({ x: off + Math.random() * W, y: off + W - border * 0.3 + Math.random() * border * 0.8 });
  // Left edge
  for (let i = 0; i < 6; i++) positions.push({ x: off - border * 0.3 + Math.random() * border * 0.8, y: off + Math.random() * W });
  // Right edge
  for (let i = 0; i < 6; i++) positions.push({ x: off + W - border * 0.3 + Math.random() * border * 0.8, y: off + Math.random() * W });

  positions.forEach(pos => {
    const g = new PIXI.Graphics();
    const type = Math.random();
    if (type < 0.35) {
      // Bush - cluster with outline
      const size = cs * (0.5 + Math.random() * 0.5);
      // Dark outline
      g.beginFill(C.decoBushDark);
      g.drawCircle(0, 0, size + 2);
      g.drawCircle(-size * 0.35, -size * 0.15, size * 0.75);
      g.drawCircle(size * 0.3, -size * 0.1, size * 0.65);
      g.endFill();
      // Light fill
      g.beginFill(C.decoBush);
      g.drawCircle(0, 0, size);
      g.endFill();
      g.beginFill(C.decoLeaf);
      g.drawCircle(-size * 0.35, -size * 0.15, size * 0.65);
      g.drawCircle(size * 0.3, -size * 0.1, size * 0.55);
      g.endFill();
      // Highlight
      g.beginFill(0xFFFFFF, 0.12);
      g.drawCircle(-size * 0.2, -size * 0.3, size * 0.35);
      g.endFill();
    } else if (type < 0.6) {
      // Detailed leaf with outline
      const leafSize = cs * (0.4 + Math.random() * 0.3);
      const angle = Math.random() * Math.PI * 2;
      // outline
      g.beginFill(C.decoLeafDark);
      g.drawEllipse(0, 0, leafSize + 1.5, leafSize * 0.45 + 1.5);
      g.endFill();
      g.beginFill(C.decoLeaf);
      g.drawEllipse(0, 0, leafSize, leafSize * 0.45);
      g.endFill();
      // Leaf vein
      g.lineStyle(1, C.decoLeafDark, 0.3);
      g.moveTo(-leafSize * 0.7, 0);
      g.lineTo(leafSize * 0.7, 0);
      g.lineStyle(0);
      g.rotation = angle;
    } else if (type < 0.8) {
      // Flower with outline
      const r = cs * 0.22;
      // Petal outlines
      g.beginFill(C.decoLeafDark, 0.3);
      for (let p = 0; p < 5; p++) {
        const angle = (p / 5) * Math.PI * 2;
        g.drawCircle(Math.cos(angle) * r, Math.sin(angle) * r, r * 0.65);
      }
      g.endFill();
      // Petals
      g.beginFill(C.flower, 0.95);
      for (let p = 0; p < 5; p++) {
        const angle = (p / 5) * Math.PI * 2;
        g.drawCircle(Math.cos(angle) * r, Math.sin(angle) * r, r * 0.55);
      }
      g.endFill();
      // Center
      g.beginFill(C.flowerCenter);
      g.drawCircle(0, 0, r * 0.5);
      g.endFill();
    } else {
      // Small sparkle/star
      const s = cs * 0.12;
      g.beginFill(C.flowerCenter, 0.6);
      drawStarShape(g, 0, 0, 4, s, s * 0.4);
      g.endFill();
    }
    g.x = pos.x;
    g.y = pos.y;
    g.alpha = 0.9;
    decoContainer.addChild(g);
    decorations.push(g);
  });
}

function drawStarShape(g, x, y, points, outerR, innerR) {
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
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
    this.type = opts.type ?? 'star';
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
      this.gfx.beginFill(this.color, this.life);
      drawStarShape(this.gfx, 0, 0, 4, this.size, this.size * 0.4);
      this.gfx.endFill();
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
//  GAME LOGIC (unchanged)
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
  foodSpawnScale = 0;
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

    emit(fx, fy, 8, { color: C.starYellow, speed: 4, size: 5, decay: 0.02, gravity: 0.06, type: 'star' });
    emit(fx, fy, 5, { color: 0xFFFFFF, speed: 3, size: 3, decay: 0.025, gravity: 0.05, type: 'circle' });

    eatBump = 1;
    eatBumpPos = 0;
    snakeExpression = 'happy';
    expressionTimer = 0.5;
    screenShake.intensity = 3;
    playSound('eat');
    if (navigator.vibrate) navigator.vibrate([15]);

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
//  DEATH
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

  // Screen shake
  const off = gameContainer._baseX || gameContainer.x;
  if (!gameContainer._baseX) gameContainer._baseX = gameContainer.x;
  if (!gameContainer._baseY) gameContainer._baseY = gameContainer.y;
  if (screenShake.intensity > 0) {
    gameContainer.x = gameContainer._baseX + (Math.random() - 0.5) * screenShake.intensity;
    gameContainer.y = gameContainer._baseY + (Math.random() - 0.5) * screenShake.intensity;
    screenShake.intensity *= 0.88;
    if (screenShake.intensity < 0.2) {
      screenShake.intensity = 0;
      gameContainer.x = gameContainer._baseX;
      gameContainer.y = gameContainer._baseY;
    }
  }

  drawBackground(cs, W);
  drawFood(cs, t);
  drawSnake(cs, W, t, interp);

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    if (p.life <= 0) { p.destroy(); particles.splice(i, 1); }
  }

  // Expression timer
  if (expressionTimer > 0) {
    expressionTimer -= dt * 0.001;
    if (expressionTimer <= 0) snakeExpression = 'normal';
  }

  // Eat bump decay
  if (eatBump > 0) {
    eatBump *= 0.92;
    eatBumpPos += dt * 0.008;
    if (eatBump < 0.01) eatBump = 0;
  }

  // Food spawn animation
  if (foodSpawnScale < 1) {
    foodSpawnScale = Math.min(1, foodSpawnScale + dt * 0.006);
  }

  // Ambient leaves
  if (Math.random() < 0.005) {
    const lx = Math.random() * W;
    emit(lx, -10, 1, { color: C.decoLeaf, speed: 0.5, size: 4, decay: 0.003, gravity: 0.02, friction: 0.999, type: 'leaf' });
  }
}

// =============================================
//  DRAW BACKGROUND — thick border like Poki
// =============================================
function drawBackground(cs, W) {
  bgGraphics.clear();

  const bw = cs * 0.8; // border width

  // Outer shadow
  bgGraphics.beginFill(0x000000, 0.12);
  bgGraphics.drawRoundedRect(-bw + 4, -bw + 4, W + bw * 2, W + bw * 2, 20);
  bgGraphics.endFill();

  // Outer brown border (thick)
  bgGraphics.beginFill(C.borderOuter);
  bgGraphics.drawRoundedRect(-bw, -bw, W + bw * 2, W + bw * 2, 18);
  bgGraphics.endFill();

  // Mid brown (lighter)
  bgGraphics.beginFill(C.borderMid);
  bgGraphics.drawRoundedRect(-bw + 3, -bw + 3, W + bw * 2 - 6, W + bw * 2 - 6, 16);
  bgGraphics.endFill();

  // Inner green padding
  bgGraphics.beginFill(C.borderInner);
  bgGraphics.drawRoundedRect(-bw * 0.35, -bw * 0.35, W + bw * 0.7, W + bw * 0.7, 10);
  bgGraphics.endFill();

  // Green edge highlight
  bgGraphics.beginFill(C.borderGlow, 0.5);
  bgGraphics.drawRoundedRect(-bw * 0.2, -bw * 0.2, W + bw * 0.4, W + bw * 0.4, 8);
  bgGraphics.endFill();

  // Board background (beige)
  bgGraphics.beginFill(C.bgInner1);
  bgGraphics.drawRoundedRect(0, 0, W, W, 4);
  bgGraphics.endFill();

  // Checkerboard
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if ((x + y) % 2 === 0) {
        bgGraphics.beginFill(C.bgInner2, 0.5);
        bgGraphics.drawRect(x * cs, y * cs, cs, cs);
        bgGraphics.endFill();
      }
    }
  }

  // Subtle inner shadow on board edges
  bgGraphics.beginFill(0x000000, 0.04);
  bgGraphics.drawRect(0, 0, W, cs * 0.3);
  bgGraphics.drawRect(0, 0, cs * 0.3, W);
  bgGraphics.endFill();
}

// =============================================
//  DRAW FOOD — big chunky apple with outline
// =============================================
function drawFood(cs, t) {
  foodGraphics.clear();
  if (!food) return;

  const fx = food.x * cs + cs / 2;
  const fy = food.y * cs + cs / 2;
  const bounce = Math.sin(t * 2) * 1.5;

  const popScale = foodSpawnScale < 1 ? easeOutBack(foodSpawnScale) : 1;
  const r = cs * 0.44 * popScale; // bigger apple

  const by = fy + bounce * 0.3;

  // Shadow on ground
  foodGraphics.beginFill(0x000000, 0.1);
  foodGraphics.drawEllipse(fx, fy + r * 0.8, r * 0.7, r * 0.2);
  foodGraphics.endFill();

  // Dark outline
  foodGraphics.beginFill(C.appleOutline);
  foodGraphics.drawCircle(fx, by, r + 2.5);
  foodGraphics.endFill();

  // Apple body
  foodGraphics.beginFill(C.apple);
  foodGraphics.drawCircle(fx, by, r);
  foodGraphics.endFill();

  // Darker bottom half
  foodGraphics.beginFill(C.appleDark, 0.3);
  foodGraphics.drawEllipse(fx, by + r * 0.2, r * 0.85, r * 0.6);
  foodGraphics.endFill();

  // Highlight (3D)
  foodGraphics.beginFill(C.appleLight, 0.5);
  foodGraphics.drawEllipse(fx - r * 0.2, by - r * 0.25, r * 0.55, r * 0.45);
  foodGraphics.endFill();

  // Specular shine
  foodGraphics.beginFill(C.appleShine, 0.8);
  foodGraphics.drawCircle(fx - r * 0.25, by - r * 0.35, r * 0.2);
  foodGraphics.endFill();

  // Stem (thicker)
  foodGraphics.lineStyle(cs * 0.08, C.stem);
  foodGraphics.moveTo(fx, by - r);
  foodGraphics.bezierCurveTo(fx + cs * 0.02, by - r - cs * 0.1, fx + cs * 0.06, by - r - cs * 0.18, fx + cs * 0.04, by - r - cs * 0.2);
  foodGraphics.lineStyle(0);

  // Leaf (bigger, with outline)
  const leafX = fx + cs * 0.06;
  const leafY = by - r - cs * 0.08;
  // Leaf outline
  foodGraphics.beginFill(C.leafDark);
  foodGraphics.moveTo(leafX, leafY);
  foodGraphics.bezierCurveTo(
    leafX + cs * 0.22, leafY - cs * 0.16,
    leafX + cs * 0.3, leafY + cs * 0.06,
    leafX + cs * 0.06, leafY + cs * 0.12
  );
  foodGraphics.endFill();
  // Leaf fill
  foodGraphics.beginFill(C.leaf);
  foodGraphics.moveTo(leafX + 1, leafY + 1);
  foodGraphics.bezierCurveTo(
    leafX + cs * 0.2, leafY - cs * 0.12,
    leafX + cs * 0.26, leafY + cs * 0.06,
    leafX + cs * 0.06, leafY + cs * 0.1
  );
  foodGraphics.endFill();
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// =============================================
//  DRAW SNAKE — CHUNKY with thick outlines
// =============================================
function drawSnake(cs, W, t, interp) {
  snakeGraphics.clear();

  if (deathTimer >= 0) {
    drawSnakeDeath(cs, t);
    return;
  }

  const len = snake.length;
  if (len === 0) return;

  // Interpolated positions
  const positions = [];
  for (let i = 0; i < len; i++) {
    const curr = snake[i], prev = prevSnake[i] || curr;
    const sx = (prev.x + (curr.x - prev.x) * interp) * cs + cs / 2;
    const sy = (prev.y + (curr.y - prev.y) * interp) * cs + cs / 2;
    positions.push({ x: sx, y: sy });
  }

  // --- BODY OUTLINE (dark stroke around entire snake) ---
  // Draw thick dark outline first, then lighter body on top
  const outlineExtra = 3.5;

  // Shadow under entire snake
  for (let i = len - 1; i >= 0; i--) {
    const p = positions[i];
    const progress = i / len;
    const segSize = getSegSize(cs, i, len) + getBump(i, len);
    snakeGraphics.beginFill(0x000000, 0.1);
    snakeGraphics.drawCircle(p.x + 2, p.y + 3, segSize + 1);
    snakeGraphics.endFill();
  }

  // Dark outline connections between segments
  for (let i = 0; i < len - 1; i++) {
    const p1 = positions[i];
    const p2 = positions[i + 1];
    const width = getSegWidth(cs, i, len) + getBump(i, len) * 2;
    snakeGraphics.lineStyle(width + outlineExtra * 2, C.snakeOutline, 1);
    snakeGraphics.moveTo(p1.x, p1.y);
    snakeGraphics.lineTo(p2.x, p2.y);
  }
  snakeGraphics.lineStyle(0);

  // Dark outline circles
  for (let i = len - 1; i >= 0; i--) {
    const p = positions[i];
    const segSize = getSegSize(cs, i, len) + getBump(i, len);
    snakeGraphics.beginFill(C.snakeOutline);
    snakeGraphics.drawCircle(p.x, p.y, segSize + outlineExtra);
    snakeGraphics.endFill();
  }

  // --- BODY FILL (green) ---
  // Connections
  for (let i = 0; i < len - 1; i++) {
    const p1 = positions[i];
    const p2 = positions[i + 1];
    const width = getSegWidth(cs, i, len) + getBump(i, len) * 2;
    snakeGraphics.lineStyle(width, C.snakeBody, 1);
    snakeGraphics.moveTo(p1.x, p1.y);
    snakeGraphics.lineTo(p2.x, p2.y);
  }
  snakeGraphics.lineStyle(0);

  // Body segments (green circles) - back to front
  for (let i = len - 1; i >= 1; i--) {
    const p = positions[i];
    const segSize = getSegSize(cs, i, len) + getBump(i, len);

    // Main body
    snakeGraphics.beginFill(C.snakeBody);
    snakeGraphics.drawCircle(p.x, p.y, segSize);
    snakeGraphics.endFill();

    // Belly highlight
    snakeGraphics.beginFill(C.snakeBelly, 0.35);
    snakeGraphics.drawEllipse(p.x, p.y + segSize * 0.15, segSize * 0.55, segSize * 0.4);
    snakeGraphics.endFill();

    // Top highlight (volume)
    snakeGraphics.beginFill(C.snakeLight, 0.35);
    snakeGraphics.drawCircle(p.x - segSize * 0.15, p.y - segSize * 0.2, segSize * 0.4);
    snakeGraphics.endFill();

    // Pattern spots
    if (i % 4 === 0) {
      snakeGraphics.beginFill(C.snakeDark, 0.15);
      snakeGraphics.drawCircle(p.x, p.y, segSize * 0.5);
      snakeGraphics.endFill();
    }
  }

  // ---- HEAD ----
  drawSnakeHead(positions[0], cs, t);
}

function getSegSize(cs, i, len) {
  if (i === 0) return cs * 0.55; // BIGGER head
  const progress = i / len;
  return cs * (0.42 - progress * 0.1); // thicker body
}

function getSegWidth(cs, i, len) {
  const progress = i / len;
  return cs * (0.78 - progress * 0.2); // thicker connections
}

function getBump(i, len) {
  if (eatBump <= 0) return 0;
  const dist = Math.abs(i - eatBumpPos * len);
  return Math.max(0, eatBump * (1 - dist * 0.3)) * cellSize * 0.12;
}

// =============================================
//  DRAW SNAKE HEAD — BIG with HUGE eyes
// =============================================
function drawSnakeHead(headPos, cs, t) {
  const hx = headPos.x;
  const hy = headPos.y;
  const dir = direction;
  const headSize = cs * 0.55; // much bigger head

  // Head outline
  const stretchX = 1 + Math.abs(dir.x) * 0.15;
  const stretchY = 1 + Math.abs(dir.y) * 0.15;
  const hdx = dir.x * cs * 0.06;
  const hdy = dir.y * cs * 0.06;

  // Dark outline
  snakeGraphics.beginFill(C.snakeOutline);
  snakeGraphics.drawEllipse(hx + hdx, hy + hdy, (headSize + 3.5) * stretchX, (headSize + 3.5) * stretchY);
  snakeGraphics.endFill();

  // Head fill
  snakeGraphics.beginFill(C.snakeBody);
  snakeGraphics.drawEllipse(hx + hdx, hy + hdy, headSize * stretchX, headSize * stretchY);
  snakeGraphics.endFill();

  // Top highlight (volume/3D)
  snakeGraphics.beginFill(C.snakeLight, 0.45);
  snakeGraphics.drawEllipse(hx + hdx - headSize * 0.15, hy + hdy - headSize * 0.25, headSize * 0.55, headSize * 0.4);
  snakeGraphics.endFill();

  // ---- EYES (BIG!) ----
  const eyeOff = cs * 0.22;    // further apart
  const eyeSize = cs * 0.2;    // MUCH bigger
  const pupilSize = cs * 0.11; // bigger pupils
  let ex1, ey1, ex2, ey2;

  if (dir.x === 1)       { ex1 = eyeOff * 0.6; ey1 = -eyeOff * 0.75; ex2 = eyeOff * 0.6; ey2 = eyeOff * 0.75; }
  else if (dir.x === -1) { ex1 = -eyeOff * 0.6; ey1 = -eyeOff * 0.75; ex2 = -eyeOff * 0.6; ey2 = eyeOff * 0.75; }
  else if (dir.y === -1) { ex1 = -eyeOff * 0.75; ey1 = -eyeOff * 0.6; ex2 = eyeOff * 0.75; ey2 = -eyeOff * 0.6; }
  else                   { ex1 = -eyeOff * 0.75; ey1 = eyeOff * 0.6; ex2 = eyeOff * 0.75; ey2 = eyeOff * 0.6; }

  // Push eyes forward in direction of movement
  const eyeFwd = cs * 0.12;
  ex1 += dir.x * eyeFwd; ey1 += dir.y * eyeFwd;
  ex2 += dir.x * eyeFwd; ey2 += dir.y * eyeFwd;

  if (snakeExpression === 'dead') {
    // X_X eyes
    const xSize = eyeSize * 0.8;
    snakeGraphics.lineStyle(3, C.snakeOutline);
    snakeGraphics.moveTo(hx + ex1 - xSize, hy + ey1 - xSize);
    snakeGraphics.lineTo(hx + ex1 + xSize, hy + ey1 + xSize);
    snakeGraphics.moveTo(hx + ex1 + xSize, hy + ey1 - xSize);
    snakeGraphics.lineTo(hx + ex1 - xSize, hy + ey1 + xSize);
    snakeGraphics.moveTo(hx + ex2 - xSize, hy + ey2 - xSize);
    snakeGraphics.lineTo(hx + ex2 + xSize, hy + ey2 + xSize);
    snakeGraphics.moveTo(hx + ex2 + xSize, hy + ey2 - xSize);
    snakeGraphics.lineTo(hx + ex2 - xSize, hy + ey2 + xSize);
    snakeGraphics.lineStyle(0);
  } else if (snakeExpression === 'happy') {
    // ^_^ happy arcs
    snakeGraphics.lineStyle(3, C.snakeOutline);
    snakeGraphics.arc(hx + ex1, hy + ey1 + eyeSize * 0.3, eyeSize * 0.7, Math.PI, 0);
    snakeGraphics.arc(hx + ex2, hy + ey2 + eyeSize * 0.3, eyeSize * 0.7, Math.PI, 0);
    snakeGraphics.lineStyle(0);

    // Blush cheeks (bigger)
    snakeGraphics.beginFill(C.cheek, 0.4);
    const cheekDir = dir.y !== 0 ? { x: 1, y: 0 } : { x: 0, y: 1 };
    snakeGraphics.drawCircle(hx + cheekDir.x * eyeOff * 1.4 + dir.x * cs * 0.05, hy + cheekDir.y * eyeOff * 1.4 + dir.y * cs * 0.05, cs * 0.1);
    snakeGraphics.drawCircle(hx - cheekDir.x * eyeOff * 1.4 + dir.x * cs * 0.05, hy - cheekDir.y * eyeOff * 1.4 + dir.y * cs * 0.05, cs * 0.1);
    snakeGraphics.endFill();
  } else {
    // Normal big eyes
    // Eye outline
    snakeGraphics.beginFill(C.snakeOutline);
    snakeGraphics.drawCircle(hx + ex1, hy + ey1, eyeSize + 2);
    snakeGraphics.drawCircle(hx + ex2, hy + ey2, eyeSize + 2);
    snakeGraphics.endFill();

    // Eye whites
    snakeGraphics.beginFill(C.eyeWhite);
    snakeGraphics.drawCircle(hx + ex1, hy + ey1, eyeSize);
    snakeGraphics.drawCircle(hx + ex2, hy + ey2, eyeSize);
    snakeGraphics.endFill();

    // Pupils (look in direction)
    const pupilDX = dir.x * pupilSize * 0.35;
    const pupilDY = dir.y * pupilSize * 0.35;
    snakeGraphics.beginFill(C.eyePupil);
    snakeGraphics.drawCircle(hx + ex1 + pupilDX, hy + ey1 + pupilDY, pupilSize);
    snakeGraphics.drawCircle(hx + ex2 + pupilDX, hy + ey2 + pupilDY, pupilSize);
    snakeGraphics.endFill();

    // Eye shine (big specular)
    snakeGraphics.beginFill(0xFFFFFF, 0.9);
    snakeGraphics.drawCircle(hx + ex1 - pupilSize * 0.3, hy + ey1 - pupilSize * 0.35, pupilSize * 0.45);
    snakeGraphics.drawCircle(hx + ex2 - pupilSize * 0.3, hy + ey2 - pupilSize * 0.35, pupilSize * 0.45);
    snakeGraphics.endFill();

    // Subtle cheeks
    snakeGraphics.beginFill(C.cheek, 0.2);
    const cheekDir = dir.y !== 0 ? { x: 1, y: 0 } : { x: 0, y: 1 };
    snakeGraphics.drawCircle(hx + cheekDir.x * eyeOff * 1.3, hy + cheekDir.y * eyeOff * 1.3 + dir.y * cs * 0.03, cs * 0.08);
    snakeGraphics.drawCircle(hx - cheekDir.x * eyeOff * 1.3, hy - cheekDir.y * eyeOff * 1.3 + dir.y * cs * 0.03, cs * 0.08);
    snakeGraphics.endFill();
  }

  // ---- TONGUE ----
  if (snakeExpression === 'normal' && Math.sin(t * 8) > 0.3) {
    const tongueBase = { x: hx + dir.x * headSize * 0.95, y: hy + dir.y * headSize * 0.95 };
    const tongueLen = cs * 0.3;
    const tongueEnd = { x: tongueBase.x + dir.x * tongueLen, y: tongueBase.y + dir.y * tongueLen };
    const perpX = dir.y, perpY = -dir.x;
    const forkLen = cs * 0.1;

    snakeGraphics.lineStyle(2, C.tongue, 0.9);
    snakeGraphics.moveTo(tongueBase.x, tongueBase.y);
    snakeGraphics.lineTo(tongueEnd.x, tongueEnd.y);
    snakeGraphics.moveTo(tongueEnd.x, tongueEnd.y);
    snakeGraphics.lineTo(tongueEnd.x + (dir.x + perpX * 0.6) * forkLen, tongueEnd.y + (dir.y + perpY * 0.6) * forkLen);
    snakeGraphics.moveTo(tongueEnd.x, tongueEnd.y);
    snakeGraphics.lineTo(tongueEnd.x + (dir.x - perpX * 0.6) * forkLen, tongueEnd.y + (dir.y - perpY * 0.6) * forkLen);
    snakeGraphics.lineStyle(0);
  }

  // ---- Smile ----
  if (snakeExpression === 'normal') {
    const smileOff = headSize * 0.35;
    snakeGraphics.lineStyle(2, C.snakeDark, 0.4);
    snakeGraphics.arc(
      hx + dir.x * smileOff * 0.5,
      hy + dir.y * smileOff * 0.5,
      cs * 0.12,
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

  for (let i = 0; i < len; i++) {
    const seg = snake[i];
    const sx = seg.x * cs + cs / 2;
    const sy = seg.y * cs + cs / 2;
    const segSize = getSegSize(cs, i, len);

    const fadeAlpha = Math.max(0, 1 - progress * 1.5 + i * 0.02);
    if (fadeAlpha <= 0) continue;

    const wobbleX = Math.sin(t * 15 + i * 2) * progress * cs * 0.3;
    const wobbleY = Math.cos(t * 12 + i * 3) * progress * cs * 0.2;

    // Outline
    snakeGraphics.beginFill(C.snakeOutline, fadeAlpha * 0.5);
    snakeGraphics.drawCircle(sx + wobbleX, sy + wobbleY, segSize * (1 - progress * 0.5) + 3);
    snakeGraphics.endFill();

    snakeGraphics.beginFill(C.snakeBody, fadeAlpha);
    snakeGraphics.drawCircle(sx + wobbleX, sy + wobbleY, segSize * (1 - progress * 0.5));
    snakeGraphics.endFill();

    // Stars above head
    if (i === 0 && progress < 0.8) {
      for (let s = 0; s < 3; s++) {
        const starAngle = t * 5 + s * (Math.PI * 2 / 3);
        const starR = cs * 0.55;
        const starX = sx + Math.cos(starAngle) * starR;
        const starY = sy - cs * 0.5 + Math.sin(starAngle * 0.5) * cs * 0.1;

        snakeGraphics.beginFill(C.starYellow, fadeAlpha * 0.8);
        drawStarShape(snakeGraphics, starX, starY, 4, cs * 0.1, cs * 0.05);
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
    const PADDING = 5;
    const maxCell = Math.floor(Math.min(maxW, maxH) / (GRID + PADDING));
    cellSize = Math.max(maxCell, 10);
    canvasSize = cellSize * GRID;
    const totalSize = canvasSize + cellSize * PADDING;
    app.renderer.resize(totalSize, totalSize);
    app.view.style.width = totalSize + 'px';
    app.view.style.height = totalSize + 'px';
    const off = cellSize * PADDING / 2;
    gameContainer.x = off;
    gameContainer.y = off;
    gameContainer._baseX = off;
    gameContainer._baseY = off;
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
