// =============================================
//  PAC-MAN — Redesign 3.0 "Arcade Cartoon Colorido"
//  Canvas 2D — Chunky cartoon style with thick outlines
// =============================================

// ---- Constants ----
const TILE_SIZE = 20;
const COLS = 21;
const ROWS = 21;
const TICK_MS = 150;

// Tile types
const W = 1; // wall
const D = 2; // dot
const P = 3; // power pellet
const E = 0; // empty
const G = 4; // ghost house

// ---- Maze layout (21x21) ----
const MAZE_TEMPLATE = [
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  [W,D,D,D,D,D,D,D,D,D,W,D,D,D,D,D,D,D,D,D,W],
  [W,D,W,W,D,W,W,W,D,D,W,D,D,W,W,W,D,W,W,D,W],
  [W,P,W,W,D,W,W,W,D,D,W,D,D,W,W,W,D,W,W,P,W],
  [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
  [W,D,W,W,D,W,D,W,W,W,W,W,W,W,D,W,D,W,W,D,W],
  [W,D,D,D,D,W,D,D,D,D,W,D,D,D,D,W,D,D,D,D,W],
  [W,W,W,W,D,W,W,W,D,D,W,D,D,W,W,W,D,W,W,W,W],
  [E,E,E,W,D,W,D,D,D,D,D,D,D,D,D,W,D,W,E,E,E],
  [W,W,W,W,D,W,D,W,W,G,G,G,W,W,D,W,D,W,W,W,W],
  [E,E,E,E,D,D,D,W,G,G,G,G,G,W,D,D,D,E,E,E,E],
  [W,W,W,W,D,W,D,W,W,W,W,W,W,W,D,W,D,W,W,W,W],
  [E,E,E,W,D,W,D,D,D,D,D,D,D,D,D,W,D,W,E,E,E],
  [W,W,W,W,D,W,D,W,W,W,W,W,W,W,D,W,D,W,W,W,W],
  [W,D,D,D,D,D,D,D,D,D,W,D,D,D,D,D,D,D,D,D,W],
  [W,D,W,W,D,W,W,W,D,D,W,D,D,W,W,W,D,W,W,D,W],
  [W,P,D,W,D,D,D,D,D,D,D,D,D,D,D,D,D,W,D,P,W],
  [W,W,D,W,D,W,D,W,W,W,W,W,W,W,D,W,D,W,D,W,W],
  [W,D,D,D,D,W,D,D,D,D,W,D,D,D,D,W,D,D,D,D,W],
  [W,D,W,W,W,W,W,W,D,D,W,D,D,W,W,W,W,W,W,D,W],
  [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
  [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
];

// ---- Color Palette ----
const PAL = {
  bg:         '#0A1235',
  wallFill:   '#1565C0',
  wallLight:  '#42A5F5',
  wallDark:   '#0D47A1',
  wallOutline:'#0A1235',
  dot:        '#FFB74D',
  dotShine:   '#FFF9C4',
  powerPellet:'#FFEB3B',
  powerGlow:  '#FFF176',
  pacman:     '#FFD600',
  pacLight:   '#FFEE58',
  pacDark:    '#F9A825',
  pacOutline: '#E65100',
  pacCheek:   '#FF8A80',
  pacEyeWhite:'#FFFFFF',
  pacPupil:   '#1A237E',
  ghostRed:   '#FF1744',
  ghostPink:  '#FF80AB',
  ghostCyan:  '#00E5FF',
  ghostOrange:'#FF9100',
  ghostFright:'#283593',
  ghostFrightLight: '#5C6BC0',
  ghostEyeWhite: '#FFFFFF',
  ghostPupil: '#1A237E',
  ghostHouse: '#1A237E',
  textWhite:  '#FFFFFF',
  starYellow: '#FFD54F',
};

// Ghost colors array matching the order
const GHOST_COLORS_CARTOON = [PAL.ghostRed, PAL.ghostPink, PAL.ghostCyan, PAL.ghostOrange];
const GHOST_OUTLINE_COLORS = ['#B71C1C', '#C2185B', '#006064', '#E65100'];

// ---- DOM Elements ----
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const btnStart = document.getElementById('btn-start');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');
const bestDisplay = document.getElementById('best-display');

// ---- Game State ----
let maze = [];
let pacman = { x: 10, y: 16, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, mouthOpen: true };
let ghosts = [];
let score = 0;
let lives = 3;
let level = 1;
let totalDots = 0;
let dotsEaten = 0;
let running = false;
let paused = false;
let tickCount = 0;
let frightenedTimer = 0;
let cellSize = 20;
let lastTick = 0;

// VFX state
let particles = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let powerPelletPulse = 0;
let pacMouthAngle = 0;
let pacMouthDir = 1;

// Ghost settings
const GHOST_COLORS = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852'];
const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

// ---- Particle System ----
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
    this.color = opts.color ?? PAL.starYellow;
    this.gravity = opts.gravity ?? 0.08;
    this.friction = opts.friction ?? 0.97;
    this.type = opts.type ?? 'star';
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
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    const s = this.size * Math.max(0.1, this.life);

    if (this.type === 'star') {
      drawStar(ctx, 0, 0, 4, s, s * 0.4, this.color);
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

function emit(x, y, count, opts = {}) {
  for (let i = 0; i < count; i++) {
    particles.push(new CartoonParticle(x, y, {
      ...opts,
      angle: opts.angle ?? Math.random() * Math.PI * 2,
    }));
  }
}

// ---- Initialization ----
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Keyboard controls
  document.addEventListener('keydown', handleKeydown);

  // Touch controls
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const dir = btn.dataset.dir;
      if (dir) setDirection(dir);
    });
    btn.addEventListener('click', (e) => {
      const dir = btn.dataset.dir;
      if (dir) setDirection(dir);
    });
  });

  // Start button
  btnStart.addEventListener('click', startGame);

  // Load high score
  const saved = localStorage.getItem('pacman-highscore');
  if (saved) bestDisplay.textContent = saved;

  // Initial draw
  resetGame();
  draw();
}

function resizeCanvas() {
  const container = canvas.parentElement;
  if (!container) return;

  const maxSize = Math.min(container.clientWidth - 32, container.clientHeight - 32, 420);
  cellSize = Math.max(Math.floor(maxSize / COLS), 8); // min 8px
  canvas.width = cellSize * COLS;
  canvas.height = cellSize * ROWS;
}

function resetGame() {
  // Copy maze template
  maze = MAZE_TEMPLATE.map(row => [...row]);

  // Count dots
  totalDots = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (maze[y][x] === D || maze[y][x] === P) totalDots++;
    }
  }
  dotsEaten = 0;

  // Reset Pac-Man
  pacman = { x: 10, y: 16, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, mouthOpen: true };

  // Reset ghosts
  ghosts = [
    { x: 10, y: 8, dir: { x: 0, y: -1 }, color: GHOST_COLORS[0], name: GHOST_NAMES[0], mode: 'chase' },
    { x: 9, y: 10, dir: { x: 0, y: 0 }, color: GHOST_COLORS[1], name: GHOST_NAMES[1], mode: 'chase' },
    { x: 10, y: 10, dir: { x: 0, y: 0 }, color: GHOST_COLORS[2], name: GHOST_NAMES[2], mode: 'chase' },
    { x: 11, y: 10, dir: { x: 0, y: 0 }, color: GHOST_COLORS[3], name: GHOST_NAMES[3], mode: 'chase' }
  ];

  score = 0;
  lives = 3;
  level = 1;
  frightenedTimer = 0;
  particles = [];
  screenShake = { x: 0, y: 0, intensity: 0 };
  updateStats();
}

function startGame() {
  console.log('[Pac-Man] Starting game...');
  overlay.classList.add('hidden');
  running = true;
  paused = false;
  resetGame();
  resizeCanvas();
  lastTick = performance.now();
  console.log('[Pac-Man] Game started, requesting animation frame');
  requestAnimationFrame(gameLoop);
}

function gameOver() {
  running = false;
  overlayTitle.textContent = 'GAME OVER';
  overlayMsg.textContent = 'FIM DE JOGO!';
  overlayScore.textContent = `SCORE: ${score}`;
  btnStart.textContent = 'JOGAR NOVAMENTE';
  overlay.classList.remove('hidden');

  // Save high score
  const currentBest = parseInt(bestDisplay.textContent) || 0;
  if (score > currentBest) {
    localStorage.setItem('pacman-highscore', score);
    bestDisplay.textContent = score;
  }
  import('../shared/game-integration.js').then(m => m.onGameEnd('pacman', { won: false, score }));
}

function gameWin() {
  running = false;
  overlayTitle.textContent = 'VITORIA!';
  overlayMsg.textContent = 'VOCE COMPLETOU O NIVEL!';
  overlayScore.textContent = `SCORE: ${score}`;
  btnStart.textContent = 'PROXIMO NIVEL';
  overlay.classList.remove('hidden');
  level++;
  import('../shared/game-integration.js').then(m => m.onGameEnd('pacman', { won: true, score }));
}

// ---- Game Loop ----
function gameLoop(now) {
  if (!running) {
    console.log('[Pac-Man] Game loop stopped - not running');
    return;
  }

  const delta = now - lastTick;

  if (delta >= TICK_MS) {
    lastTick = now;
    tick();
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function tick() {
  tickCount++;
  pacman.mouthOpen = !pacman.mouthOpen;

  // Update frightened timer
  if (frightenedTimer > 0) {
    frightenedTimer--;
    if (frightenedTimer === 0) {
      ghosts.forEach(g => g.mode = 'chase');
    }
  }

  // Try to change direction
  if (pacman.nextDir.x !== 0 || pacman.nextDir.y !== 0) {
    if (canMove(pacman.x + pacman.nextDir.x, pacman.y + pacman.nextDir.y)) {
      pacman.dir = { ...pacman.nextDir };
      pacman.nextDir = { x: 0, y: 0 };
    }
  }

  // Move Pac-Man
  const newX = pacman.x + pacman.dir.x;
  const newY = pacman.y + pacman.dir.y;

  if (canMove(newX, newY)) {
    pacman.x = newX;
    pacman.y = newY;
  }

  // Tunnel effect
  if (pacman.x < 0) pacman.x = COLS - 1;
  if (pacman.x >= COLS) pacman.x = 0;

  // Eat dot
  const tile = maze[pacman.y][pacman.x];
  if (tile === D) {
    maze[pacman.y][pacman.x] = E;
    score += 10;
    dotsEaten++;
    updateStats();
    // Dot eat particles
    const cs = cellSize;
    emit(pacman.x * cs + cs / 2, pacman.y * cs + cs / 2, 3, {
      color: PAL.dot, speed: 2, size: 2, decay: 0.04, gravity: 0.05, type: 'circle'
    });
  } else if (tile === P) {
    maze[pacman.y][pacman.x] = E;
    score += 50;
    dotsEaten++;
    activateFrightened();
    updateStats();
    // Power pellet eat particles
    const cs = cellSize;
    emit(pacman.x * cs + cs / 2, pacman.y * cs + cs / 2, 8, {
      color: PAL.starYellow, speed: 4, size: 5, decay: 0.02, gravity: 0.06, type: 'star'
    });
    emit(pacman.x * cs + cs / 2, pacman.y * cs + cs / 2, 5, {
      color: '#FFFFFF', speed: 3, size: 3, decay: 0.025, gravity: 0.05, type: 'circle'
    });
    screenShake.intensity = 4;
  }

  // Check win
  if (dotsEaten >= totalDots) {
    gameWin();
    return;
  }

  // Move ghosts
  moveGhosts();

  // Check collision with ghosts
  checkCollisions();

  // Update VFX
  powerPelletPulse += 0.15;

  // Screen shake decay
  if (screenShake.intensity > 0) {
    screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.intensity *= 0.85;
    if (screenShake.intensity < 0.2) {
      screenShake.intensity = 0;
      screenShake.x = 0;
      screenShake.y = 0;
    }
  }
}

function activateFrightened() {
  frightenedTimer = 50; // ticks
  ghosts.forEach(g => g.mode = 'frightened');
}

function moveGhosts() {
  ghosts.forEach(ghost => {
    // Simple AI: move towards Pac-Man or random when frightened
    let possibleMoves = [];
    const dirs = [{x:0,y:-1}, {x:0,y:1}, {x:-1,y:0}, {x:1,y:0}];

    dirs.forEach(d => {
      const nx = ghost.x + d.x;
      const ny = ghost.y + d.y;
      if (canMove(nx, ny)) {
        possibleMoves.push(d);
      }
    });

    if (possibleMoves.length > 0) {
      let chosen;
      if (ghost.mode === 'frightened') {
        // Random movement when frightened
        chosen = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      } else {
        // Chase Pac-Man
        let bestDist = Infinity;
        possibleMoves.forEach(m => {
          const nx = ghost.x + m.x;
          const ny = ghost.y + m.y;
          const dist = Math.abs(nx - pacman.x) + Math.abs(ny - pacman.y);
          if (dist < bestDist) {
            bestDist = dist;
            chosen = m;
          }
        });
      }

      if (chosen) {
        ghost.dir = chosen;
        ghost.x += chosen.x;
        ghost.y += chosen.y;
      }
    }

    // Tunnel for ghosts
    if (ghost.x < 0) ghost.x = COLS - 1;
    if (ghost.x >= COLS) ghost.x = 0;
  });
}

function checkCollisions() {
  ghosts.forEach(ghost => {
    if (Math.abs(ghost.x - pacman.x) < 1 && Math.abs(ghost.y - pacman.y) < 1) {
      if (ghost.mode === 'frightened') {
        // Eat ghost — particles!
        const cs = cellSize;
        emit(ghost.x * cs + cs / 2, ghost.y * cs + cs / 2, 12, {
          color: PAL.ghostFright, speed: 5, size: 4, decay: 0.02, gravity: 0.04, type: 'star'
        });
        emit(ghost.x * cs + cs / 2, ghost.y * cs + cs / 2, 8, {
          color: '#FFFFFF', speed: 3, size: 3, decay: 0.03, gravity: 0.06, type: 'circle'
        });
        screenShake.intensity = 5;

        ghost.x = 10;
        ghost.y = 10;
        ghost.mode = 'chase';
        score += 200;
        updateStats();
      } else {
        // Lose life
        lives--;
        updateStats();

        // Death particles
        const cs = cellSize;
        emit(pacman.x * cs + cs / 2, pacman.y * cs + cs / 2, 15, {
          color: PAL.pacman, speed: 4, size: 4, decay: 0.015, gravity: 0.05, type: 'star'
        });
        screenShake.intensity = 8;

        if (lives <= 0) {
          gameOver();
        } else {
          // Reset positions
          pacman.x = 10;
          pacman.y = 16;
          pacman.dir = { x: 0, y: 0 };
          ghosts.forEach((g, i) => {
            g.x = 9 + i;
            g.y = 8 + (i > 0 ? 2 : 0);
          });
        }
      }
    }
  });
}

function canMove(x, y) {
  if (y < 0 || y >= ROWS) return false;
  if (x < 0 || x >= COLS) {
    // Allow tunnel
    return true;
  }
  return maze[y][x] !== W;
}

// =============================================
//  DRAWING — Cartoon Arcade Style
// =============================================
function draw() {
  const cs = cellSize;
  const cw = canvas.width;
  const ch = canvas.height;

  ctx.save();

  // Apply screen shake
  if (screenShake.intensity > 0) {
    ctx.translate(screenShake.x, screenShake.y);
  }

  // Clear with dark blue background
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(-5, -5, cw + 10, ch + 10);

  // Draw maze
  drawMaze(cs);

  // Draw dots & power pellets
  drawDots(cs);

  // Draw Pac-Man
  drawPacman(cs);

  // Draw ghosts
  ghosts.forEach((g, i) => drawGhost(g, i, cs));

  // Draw particles
  updateAndDrawParticles();

  ctx.restore();
}

// =============================================
//  MAZE — Rounded chunky walls with outlines
// =============================================
function drawMaze(cs) {
  // Pre-calculate wall neighbors for rounded edges
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = maze[y][x];
      if (tile === W) {
        drawWallTile(x, y, cs);
      } else if (tile === G) {
        // Ghost house: subtle darker area
        const px = x * cs;
        const py = y * cs;
        ctx.fillStyle = PAL.ghostHouse;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(px, py, cs, cs);
        ctx.globalAlpha = 1;
      }
    }
  }
}

function isWall(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  return MAZE_TEMPLATE[y][x] === W;
}

function drawWallTile(x, y, cs) {
  const px = x * cs;
  const py = y * cs;
  const pad = cs * 0.08;
  const r = cs * 0.35; // corner rounding

  // Check neighbors
  const up = isWall(x, y - 1);
  const down = isWall(x, y + 1);
  const left = isWall(x - 1, y);
  const right = isWall(x + 1, y);

  // Dark outline layer (slightly bigger)
  ctx.fillStyle = PAL.wallOutline;
  ctx.fillRect(px, py, cs, cs);

  // Main wall fill with inset
  const inset = 1.5;
  ctx.fillStyle = PAL.wallDark;
  ctx.fillRect(px + inset, py + inset, cs - inset * 2, cs - inset * 2);

  // Lighter top/left for 3D effect
  const grad = ctx.createLinearGradient(px, py, px + cs, py + cs);
  grad.addColorStop(0, PAL.wallLight);
  grad.addColorStop(0.4, PAL.wallFill);
  grad.addColorStop(1, PAL.wallDark);
  ctx.fillStyle = grad;
  ctx.fillRect(px + inset + 1, py + inset + 1, cs - inset * 2 - 2, cs - inset * 2 - 2);

  // Specular highlight on top edge
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(px + inset + 2, py + inset + 1, cs - inset * 2 - 4, cs * 0.2);

  // Connect to neighbors (fill gaps between tiles with same color)
  ctx.fillStyle = PAL.wallFill;
  if (right) ctx.fillRect(px + cs - inset, py + inset + 1, inset * 2, cs - inset * 2 - 2);
  if (down) ctx.fillRect(px + inset + 1, py + cs - inset, cs - inset * 2 - 2, inset * 2);
}

// =============================================
//  DOTS & POWER PELLETS — 3D shiny spheres
// =============================================
function drawDots(cs) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = maze[y][x];
      const px = x * cs + cs / 2;
      const py = y * cs + cs / 2;

      if (tile === D) {
        drawDot(px, py, cs);
      } else if (tile === P) {
        drawPowerPellet(px, py, cs);
      }
    }
  }
}

function drawDot(cx, cy, cs) {
  const r = cs * 0.15;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(cx + 1, cy + 1, r, 0, Math.PI * 2);
  ctx.fill();

  // Dark outline
  ctx.fillStyle = '#E65100';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
  ctx.fill();

  // Dot body
  ctx.fillStyle = PAL.dot;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight
  ctx.fillStyle = PAL.dotShine;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPowerPellet(cx, cy, cs) {
  const pulse = Math.sin(powerPelletPulse) * 0.15 + 1;
  const r = cs * 0.32 * pulse;

  // Glow effect
  ctx.fillStyle = PAL.powerGlow;
  ctx.globalAlpha = 0.15 + Math.sin(powerPelletPulse) * 0.1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(cx + 1, cy + 1, r, 0, Math.PI * 2);
  ctx.fill();

  // Outline
  ctx.fillStyle = '#F57F17';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = PAL.powerPellet;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Inner highlight gradient
  const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Specular dot
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// =============================================
//  PAC-MAN — Big chunky cartoon character
// =============================================
function drawPacman(cs) {
  const px = pacman.x * cs + cs / 2;
  const py = pacman.y * cs + cs / 2;
  const radius = cs * 0.46;

  // Smooth mouth animation
  const mouthAngle = pacman.mouthOpen ? 0.25 * Math.PI : 0.05 * Math.PI;

  // Determine rotation based on direction
  let rotation = 0;
  if (pacman.dir.x === 1) rotation = 0;
  else if (pacman.dir.x === -1) rotation = Math.PI;
  else if (pacman.dir.y === -1) rotation = -Math.PI / 2;
  else if (pacman.dir.y === 1) rotation = Math.PI / 2;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rotation);

  // Shadow on ground
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.save();
  ctx.rotate(-rotation); // un-rotate for shadow
  ctx.beginPath();
  ctx.ellipse(2, radius * 0.6, radius * 0.7, radius * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Dark outline
  ctx.fillStyle = PAL.pacOutline;
  ctx.beginPath();
  ctx.arc(0, 0, radius + 3, mouthAngle, Math.PI * 2 - mouthAngle);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  // Body - gradient for 3D
  const bodyGrad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, 0, 0, 0, radius);
  bodyGrad.addColorStop(0, PAL.pacLight);
  bodyGrad.addColorStop(0.6, PAL.pacman);
  bodyGrad.addColorStop(1, PAL.pacDark);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, mouthAngle, Math.PI * 2 - mouthAngle);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  // Specular shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-radius * 0.15, -radius * 0.3, radius * 0.35, radius * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  const eyeX = radius * 0.1;
  const eyeY = -radius * 0.35;
  const eyeR = radius * 0.2;

  // Eye white
  ctx.fillStyle = PAL.pacEyeWhite;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Eye outline
  ctx.strokeStyle = PAL.pacOutline;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pupil
  ctx.fillStyle = PAL.pacPupil;
  ctx.beginPath();
  ctx.arc(eyeX + eyeR * 0.2, eyeY, eyeR * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Pupil shine
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(eyeX + eyeR * 0.35, eyeY - eyeR * 0.2, eyeR * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Cheek (rosy)
  ctx.fillStyle = PAL.pacCheek;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(radius * 0.15, radius * 0.15, radius * 0.18, radius * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // When powered up — fierce expression
  if (frightenedTimer > 0) {
    // Angry eyebrow
    ctx.strokeStyle = PAL.pacOutline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(eyeX - eyeR * 0.8, eyeY - eyeR * 1.2);
    ctx.lineTo(eyeX + eyeR * 0.8, eyeY - eyeR * 0.6);
    ctx.stroke();

    // Fiercer pupil
    ctx.fillStyle = '#FF1744';
    ctx.beginPath();
    ctx.arc(eyeX + eyeR * 0.2, eyeY, eyeR * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// =============================================
//  GHOSTS — Cartoon with expressive eyes
// =============================================
function drawGhost(ghost, index, cs) {
  const px = ghost.x * cs + cs / 2;
  const py = ghost.y * cs + cs / 2;
  const w = cs * 0.9;
  const h = cs * 0.95;
  const isFrightened = ghost.mode === 'frightened';

  ctx.save();
  ctx.translate(px, py);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(2, h * 0.45, w * 0.4, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ghost body shape
  const bodyColor = isFrightened ? PAL.ghostFright : GHOST_COLORS_CARTOON[index];
  const outlineColor = isFrightened ? '#1A237E' : GHOST_OUTLINE_COLORS[index];
  const lightColor = isFrightened ? PAL.ghostFrightLight : lightenColor(bodyColor, 30);

  // Dark outline body
  drawGhostShape(0, 0, w + 5, h + 3, outlineColor);

  // Main body
  drawGhostShape(0, 0, w, h, bodyColor);

  // Lighter top for 3D effect
  ctx.fillStyle = lightColor;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.15, w * 0.35, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Specular shine
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, -h * 0.2, w * 0.15, h * 0.12, -0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  if (isFrightened) {
    drawFrightenedFace(w, h);
  } else {
    drawGhostEyes(ghost, w, h);
  }

  ctx.restore();
}

function drawGhostShape(cx, cy, w, h, color) {
  const topRadius = w * 0.48;
  const baseY = cy + h * 0.25;
  const topY = cy - h * 0.2;

  ctx.fillStyle = color;
  ctx.beginPath();

  // Dome top
  ctx.arc(cx, topY, topRadius, Math.PI, 0);

  // Right side
  ctx.lineTo(cx + topRadius, baseY);

  // Wavy bottom (3 waves)
  const waveCount = 3;
  const waveW = (topRadius * 2) / waveCount;
  const waveH = h * 0.12;

  for (let i = 0; i < waveCount; i++) {
    const startX = cx + topRadius - i * waveW;
    const endX = startX - waveW;
    const midX = (startX + endX) / 2;
    ctx.quadraticCurveTo(midX, baseY + waveH, endX, baseY);
  }

  // Left side
  ctx.lineTo(cx - topRadius, topY);
  ctx.closePath();
  ctx.fill();
}

function drawGhostEyes(ghost, w, h) {
  const eyeSpacing = w * 0.22;
  const eyeY = -h * 0.1;
  const eyeW = w * 0.17;
  const eyeH = w * 0.2;

  // Direction offset for pupils
  const pupilDx = ghost.dir.x * eyeW * 0.3;
  const pupilDy = ghost.dir.y * eyeH * 0.3;

  // Left eye
  drawCartoonEye(-eyeSpacing, eyeY, eyeW, eyeH, pupilDx, pupilDy);
  // Right eye
  drawCartoonEye(eyeSpacing, eyeY, eyeW, eyeH, pupilDx, pupilDy);
}

function drawCartoonEye(ex, ey, w, h, pupilDx, pupilDy) {
  // Eye outline
  ctx.fillStyle = '#1A237E';
  ctx.beginPath();
  ctx.ellipse(ex, ey, w + 1.5, h + 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye white
  ctx.fillStyle = PAL.ghostEyeWhite;
  ctx.beginPath();
  ctx.ellipse(ex, ey, w, h, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupil
  ctx.fillStyle = PAL.ghostPupil;
  ctx.beginPath();
  ctx.ellipse(ex + pupilDx, ey + pupilDy, w * 0.5, h * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupil shine
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(ex + pupilDx + w * 0.15, ey + pupilDy - h * 0.15, w * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawFrightenedFace(w, h) {
  const eyeY = -h * 0.12;
  const eyeSpacing = w * 0.18;
  const eyeR = w * 0.08;

  // Frightened eyes (small, round, scared)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-eyeSpacing, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(eyeSpacing, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Pupils (tiny, looking up/sideways)
  ctx.fillStyle = '#0D47A1';
  ctx.beginPath();
  ctx.arc(-eyeSpacing, eyeY - eyeR * 0.3, eyeR * 0.5, 0, Math.PI * 2);
  ctx.arc(eyeSpacing, eyeY - eyeR * 0.3, eyeR * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Wavy scared mouth
  const mouthY = h * 0.08;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const mouthW = w * 0.35;
  ctx.moveTo(-mouthW, mouthY);
  for (let i = 0; i <= 4; i++) {
    const mx = -mouthW + (mouthW * 2) * (i / 4);
    const my = mouthY + (i % 2 === 0 ? -2 : 2);
    ctx.lineTo(mx, my);
  }
  ctx.stroke();

  // Blinking timer warning (last 15 ticks flash white)
  if (frightenedTimer > 0 && frightenedTimer < 15 && tickCount % 4 < 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    drawGhostShape(0, 0, w, h * 0.95, 'rgba(255,255,255,0.25)');
  }
}

// =============================================
//  PARTICLES
// =============================================
function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    p.draw(ctx);
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// =============================================
//  UTILITY
// =============================================
function lightenColor(hex, amount) {
  // Simple color lightening
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, r + amount);
  const ng = Math.min(255, g + amount);
  const nb = Math.min(255, b + amount);
  return `rgb(${nr},${ng},${nb})`;
}

// ---- Input ----
function handleKeydown(e) {
  if (!running) return;

  switch(e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      e.preventDefault();
      setDirection('up');
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      e.preventDefault();
      setDirection('down');
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      e.preventDefault();
      setDirection('left');
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      e.preventDefault();
      setDirection('right');
      break;
  }
}

function setDirection(dir) {
  const dirs = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  if (dirs[dir]) {
    pacman.nextDir = dirs[dir];
  }
}

function updateStats() {
  scoreDisplay.textContent = score;
  livesDisplay.textContent = lives;
}

// Start
init();
