import '../../auth-check.js';
// =============================================
//  PAC-MAN — game.js
// =============================================
import { supabase } from '../../supabase.js';
// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

// ---- Constants ----
const TILE_SIZE = 20;
const COLS = 21;
const ROWS = 21;
const TICK_MS = 150; // ms per game tick

// Tile types
const W = 1; // wall
const D = 2; // dot
const P = 3; // power pellet
const E = 0; // empty
const G = 4; // ghost house (empty, no dot)

// ---- Maze layout (21x21) ----
// prettier-ignore
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
const bestDisplay  = document.getElementById('best-display');

// ---- Game state ----
let maze = [];
let pacman = { x: 10, y: 16, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, mouthAngle: 0, mouthOpen: true };
let ghosts = [];
let score = 0;
let lives = 3;
let level = 1;
let bestScore = parseInt(localStorage.getItem('pacman_best') || '0');
let totalDots = 0;
let dotsEaten = 0;
let running = false;
let paused = false;
let gameLoop = null;
let tickCount = 0;
let frightenedTimer = 0;
let cellSize = 0;

// Ghost modes
const MODE_SCATTER = 'scatter';
const MODE_CHASE = 'chase';
const MODE_FRIGHTENED = 'frightened';
const MODE_EATEN = 'eaten';

const GHOST_COLORS = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852']; // red, pink, cyan, orange
const GHOST_NAMES  = ['Blinky', 'Pinky', 'Inky', 'Clyde'];
const SCATTER_CORNERS = [
  { x: COLS - 2, y: 1 },   // top-right
  { x: 1, y: 1 },          // top-left
  { x: COLS - 2, y: ROWS - 2 }, // bottom-right
  { x: 1, y: ROWS - 2 },  // bottom-left
];

bestDisplay.textContent = bestScore;

// =============================================
//  CANVAS SIZING
// =============================================
function resizeCanvas() {
  const container = canvas.parentElement;
  const maxW = container.clientWidth - 16;
  const maxH = container.clientHeight - 16;
  const cellW = Math.floor(maxW / COLS);
  const cellH = Math.floor(maxH / (ROWS + 1)); // +1 for extra height
  cellSize = Math.max(Math.min(cellW, cellH), 8);
  canvas.width  = cellSize * COLS;
  canvas.height = cellSize * (ROWS + 1);
  canvas.style.width  = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
  draw();
}

window.addEventListener('resize', resizeCanvas);

// =============================================
//  MAZE SETUP
// =============================================
function buildMaze() {
  maze = MAZE_TEMPLATE.map(row => [...row]);
  totalDots = 0;
  dotsEaten = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (maze[r][c] === D || maze[r][c] === P) totalDots++;
    }
  }
}

// =============================================
//  GHOST SETUP
// =============================================
function createGhosts() {
  ghosts = [
    { x: 10, y: 9,  color: GHOST_COLORS[0], mode: MODE_SCATTER, dir: { x: 0, y: -1 }, idx: 0, releaseTimer: 0 },
    { x: 9,  y: 10, color: GHOST_COLORS[1], mode: MODE_SCATTER, dir: { x: 0, y: -1 }, idx: 1, releaseTimer: 30 },
    { x: 10, y: 10, color: GHOST_COLORS[2], mode: MODE_SCATTER, dir: { x: 0, y: -1 }, idx: 2, releaseTimer: 60 },
    { x: 11, y: 10, color: GHOST_COLORS[3], mode: MODE_SCATTER, dir: { x: 0, y: -1 }, idx: 3, releaseTimer: 90 },
  ];
}

// =============================================
//  INIT GAME
// =============================================
function initGame() {
  buildMaze();
  createGhosts();
  pacman = { x: 10, y: 16, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, mouthAngle: 0, mouthOpen: true };
  score = 0;
  lives = 3;
  level = 1;
  dotsEaten = 0;
  tickCount = 0;
  frightenedTimer = 0;
  scoreDisplay.textContent = 0;
  livesDisplay.textContent = 3;
}

function resetPositions() {
  pacman.x = 10;
  pacman.y = 16;
  pacman.dir = { x: 0, y: 0 };
  pacman.nextDir = { x: 0, y: 0 };
  createGhosts();
  frightenedTimer = 0;
}

// =============================================
//  MOVEMENT HELPERS
// =============================================
function isWalkable(x, y) {
  // Tunnel wrapping
  if (y >= 0 && y < ROWS && (x < 0 || x >= COLS)) return true;
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  const tile = maze[y][x];
  return tile !== W;
}

function isWalkableForGhost(x, y, ghost) {
  if (y >= 0 && y < ROWS && (x < 0 || x >= COLS)) return true;
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  const tile = maze[y][x];
  if (tile === W) return false;
  // ghosts can enter ghost house only when in eaten mode or still releasing
  if (tile === G && ghost.mode !== MODE_EATEN && ghost.releaseTimer <= 0) {
    // allow if ghost is inside the house already
    const inHouse = ghost.y >= 9 && ghost.y <= 11 && ghost.x >= 8 && ghost.x <= 12;
    if (!inHouse) return false;
  }
  return true;
}

function wrapX(x) {
  if (x < 0) return COLS - 1;
  if (x >= COLS) return 0;
  return x;
}

function distance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// =============================================
//  GHOST AI
// =============================================
function getGhostTarget(ghost) {
  if (ghost.mode === MODE_SCATTER) {
    return SCATTER_CORNERS[ghost.idx];
  }
  if (ghost.mode === MODE_FRIGHTENED) {
    // Random valid direction - target is random
    return { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  }
  if (ghost.mode === MODE_EATEN) {
    return { x: 10, y: 9 }; // ghost house entrance
  }
  // CHASE mode - different per ghost
  switch (ghost.idx) {
    case 0: // Blinky - chase pac-man directly
      return { x: pacman.x, y: pacman.y };
    case 1: // Pinky - target 4 tiles ahead of pac-man
      return { x: pacman.x + pacman.dir.x * 4, y: pacman.y + pacman.dir.y * 4 };
    case 2: // Inky - complex targeting
      return { x: pacman.x + pacman.dir.x * 2, y: pacman.y + pacman.dir.y * 2 };
    case 3: // Clyde - chase if far, scatter if close
      if (distance(ghost.x, ghost.y, pacman.x, pacman.y) > 8) {
        return { x: pacman.x, y: pacman.y };
      }
      return SCATTER_CORNERS[ghost.idx];
    default:
      return { x: pacman.x, y: pacman.y };
  }
}

function moveGhost(ghost) {
  if (ghost.releaseTimer > 0) {
    ghost.releaseTimer--;
    return;
  }

  const target = getGhostTarget(ghost);
  const dirs = [
    { x: 0, y: -1 }, // up
    { x: 0, y: 1 },  // down
    { x: -1, y: 0 }, // left
    { x: 1, y: 0 },  // right
  ];

  // Can't reverse direction (except when mode changes, handled elsewhere)
  const reverse = { x: -ghost.dir.x, y: -ghost.dir.y };

  let bestDir = null;
  let bestDist = Infinity;

  for (const d of dirs) {
    // No reversing
    if (d.x === reverse.x && d.y === reverse.y) continue;

    const nx = wrapX(ghost.x + d.x);
    const ny = ghost.y + d.y;

    if (!isWalkableForGhost(nx, ny, ghost)) continue;

    const dist = distance(nx, ny, target.x, target.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestDir = d;
    }
  }

  if (!bestDir) {
    // Stuck - try reverse
    const nx = wrapX(ghost.x + reverse.x);
    const ny = ghost.y + reverse.y;
    if (isWalkableForGhost(nx, ny, ghost)) {
      bestDir = reverse;
    } else {
      return; // truly stuck
    }
  }

  ghost.dir = bestDir;
  ghost.x = wrapX(ghost.x + bestDir.x);
  ghost.y = ghost.y + bestDir.y;

  // If eaten ghost reached home, respawn
  if (ghost.mode === MODE_EATEN && ghost.x === 10 && ghost.y === 9) {
    ghost.mode = MODE_SCATTER;
    ghost.y = 10;
  }
}

// =============================================
//  GAME TICK
// =============================================
function tick() {
  tickCount++;

  // Toggle scatter/chase every ~7 seconds (about 47 ticks)
  if (frightenedTimer <= 0) {
    const cyclePos = tickCount % 94;
    const newMode = cyclePos < 47 ? MODE_SCATTER : MODE_CHASE;
    for (const g of ghosts) {
      if (g.mode !== MODE_FRIGHTENED && g.mode !== MODE_EATEN) {
        g.mode = newMode;
      }
    }
  }

  // Frightened timer
  if (frightenedTimer > 0) {
    frightenedTimer--;
    if (frightenedTimer === 0) {
      for (const g of ghosts) {
        if (g.mode === MODE_FRIGHTENED) {
          g.mode = MODE_SCATTER;
        }
      }
    }
  }

  // Move pac-man
  movePacman();

  // Mouth animation
  pacman.mouthAngle += pacman.mouthOpen ? 0.15 : -0.15;
  if (pacman.mouthAngle >= 0.8) pacman.mouthOpen = false;
  if (pacman.mouthAngle <= 0.05) pacman.mouthOpen = true;

  // Check dot/pellet
  const tile = maze[pacman.y]?.[pacman.x];
  if (tile === D) {
    maze[pacman.y][pacman.x] = E;
    score += 10;
    dotsEaten++;
  } else if (tile === P) {
    maze[pacman.y][pacman.x] = E;
    score += 50;
    dotsEaten++;
    activateFrightened();
  }

  scoreDisplay.textContent = score;

  // Check win
  if (dotsEaten >= totalDots) {
    levelUp();
    return;
  }

  // Move ghosts (every tick for faster ghosts at higher levels, skip some for slow)
  const ghostSpeed = level >= 3 ? 1 : (tickCount % 2 === 0 ? 1 : 0);
  if (ghostSpeed || level >= 2) {
    for (const g of ghosts) {
      // Eaten ghosts move faster
      if (g.mode === MODE_EATEN) {
        moveGhost(g);
        moveGhost(g); // double speed
      } else {
        moveGhost(g);
      }
    }
  }

  // Check ghost collisions
  checkGhostCollisions();

  draw();
}

function movePacman() {
  // Try next direction first
  const nx = wrapX(pacman.x + pacman.nextDir.x);
  const ny = pacman.y + pacman.nextDir.y;
  if (isWalkable(nx, ny) && maze[ny]?.[nx] !== undefined && maze[ny][nx] !== W) {
    pacman.dir = { ...pacman.nextDir };
  } else if (pacman.nextDir.x !== 0 || pacman.nextDir.y !== 0) {
    // Check if tunnel
    if (ny >= 0 && ny < ROWS && (nx < 0 || nx >= COLS)) {
      pacman.dir = { ...pacman.nextDir };
    }
  }

  const fx = wrapX(pacman.x + pacman.dir.x);
  const fy = pacman.y + pacman.dir.y;

  if (isWalkable(fx, fy)) {
    // Check tile is not wall
    if (fy >= 0 && fy < ROWS && fx >= 0 && fx < COLS && maze[fy][fx] === W) return;
    // Don't enter ghost house
    if (fy >= 0 && fy < ROWS && fx >= 0 && fx < COLS && maze[fy][fx] === G) return;
    pacman.x = fx;
    pacman.y = fy;
  }
}

function activateFrightened() {
  frightenedTimer = Math.round(8000 / TICK_MS); // ~8 seconds
  for (const g of ghosts) {
    if (g.mode !== MODE_EATEN) {
      g.mode = MODE_FRIGHTENED;
      // Reverse direction
      g.dir = { x: -g.dir.x, y: -g.dir.y };
    }
  }
}

function checkGhostCollisions() {
  for (const g of ghosts) {
    if (g.releaseTimer > 0) continue;
    if (g.x === pacman.x && g.y === pacman.y) {
      if (g.mode === MODE_FRIGHTENED) {
        // Eat ghost
        g.mode = MODE_EATEN;
        score += 200;
        scoreDisplay.textContent = score;
      } else if (g.mode !== MODE_EATEN) {
        // Pac-man dies
        lives--;
        livesDisplay.textContent = lives;
        if (lives <= 0) {
          gameOver();
        } else {
          resetPositions();
        }
        return;
      }
    }
  }
}

function levelUp() {
  level++;
  buildMaze();
  resetPositions();
  // Brief pause effect handled by continuing the loop
}

// =============================================
//  START / GAME OVER
// =============================================
function startGame() {
  initGame();
  overlay.classList.add('hidden');
  running = true;
  paused = false;
  gameLoop = setInterval(() => { if (!paused) tick(); }, TICK_MS);
}

function gameOver() {
  running = false;
  clearInterval(gameLoop);

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('pacman_best', String(bestScore));
    bestDisplay.textContent = bestScore;
  }

  saveGameStat();

  overlayIcon.textContent  = '💀';
  overlayTitle.textContent = 'Game Over!';
  overlayMsg.textContent   = `Nivel ${level}`;
  overlayScore.textContent = `Pontuacao: ${score} ⭐`;
  btnStart.textContent     = 'Jogar Novamente';
  overlay.classList.remove('hidden');
}

// =============================================
//  DRAW
// =============================================
function draw() {
  const cs = cellSize;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw maze
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = maze[r][c];
      const x = c * cs;
      const y = r * cs;

      if (tile === W) {
        ctx.fillStyle = '#1a1aff';
        ctx.fillRect(x, y, cs, cs);
        // Inner border effect
        ctx.fillStyle = '#0000aa';
        ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
        ctx.fillStyle = '#2222cc';
        ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
      } else if (tile === D) {
        // Small dot
        ctx.fillStyle = '#ffcc66';
        ctx.beginPath();
        ctx.arc(x + cs / 2, y + cs / 2, cs * 0.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === P) {
        // Power pellet (pulsing)
        const pulse = 0.2 + Math.sin(tickCount * 0.3) * 0.08;
        ctx.fillStyle = '#ffcc66';
        ctx.beginPath();
        ctx.arc(x + cs / 2, y + cs / 2, cs * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw Pac-Man
  drawPacman();

  // Draw ghosts
  for (const g of ghosts) {
    if (g.releaseTimer > 0 && g.releaseTimer > 10) continue; // don't draw until almost released
    drawGhost(g);
  }

  // Draw lives indicator at the bottom
  const lifeY = ROWS * cs + 2;
  for (let i = 0; i < lives; i++) {
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(cs + i * cs * 1.5, lifeY + cs / 2, cs * 0.35, 0.2 * Math.PI, 1.8 * Math.PI);
    ctx.lineTo(cs + i * cs * 1.5, lifeY + cs / 2);
    ctx.fill();
  }

  // Level display
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.max(cs * 0.6, 10)}px Nunito, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(`Nivel ${level}`, COLS * cs - 4, lifeY + cs * 0.7);
  ctx.textAlign = 'left';

  // Pausa overlay
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffe082';
    ctx.font = `bold ${cs * 1.6}px Nunito`;
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSADO', canvas.width / 2, canvas.height / 2 - cs * 0.5);
    ctx.font = `${cs * 0.65}px Nunito`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Pressione P para continuar', canvas.width / 2, canvas.height / 2 + cs * 0.8);
    ctx.textAlign = 'left';
  }
}

function drawPacman() {
  const cs = cellSize;
  const cx = pacman.x * cs + cs / 2;
  const cy = pacman.y * cs + cs / 2;
  const r = cs * 0.42;
  const mouth = pacman.mouthAngle;

  // Direction angle
  let angle = 0;
  if (pacman.dir.x === 1)       angle = 0;
  else if (pacman.dir.x === -1) angle = Math.PI;
  else if (pacman.dir.y === -1) angle = -Math.PI / 2;
  else if (pacman.dir.y === 1)  angle = Math.PI / 2;

  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, angle + mouth, angle + Math.PI * 2 - mouth);
  ctx.closePath();
  ctx.fill();
}

function drawGhost(g) {
  const cs = cellSize;
  const cx = g.x * cs + cs / 2;
  const cy = g.y * cs + cs / 2;
  const r = cs * 0.42;

  let color = g.color;
  if (g.mode === MODE_FRIGHTENED) {
    // Blink white near end of frightened
    if (frightenedTimer < 15 && tickCount % 4 < 2) {
      color = '#ffffff';
    } else {
      color = '#2020ff';
    }
  } else if (g.mode === MODE_EATEN) {
    // Just eyes
    drawGhostEyes(cx, cy, cs, g);
    return;
  }

  // Ghost body (rounded top, wavy bottom)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.2, r, Math.PI, 0); // top semicircle
  // Right side down
  ctx.lineTo(cx + r, cy + r * 0.8);
  // Wavy bottom
  const waves = 3;
  const waveW = (r * 2) / waves;
  for (let i = 0; i < waves; i++) {
    const wx = cx + r - i * waveW;
    const wy = cy + r * 0.8;
    ctx.quadraticCurveTo(wx - waveW * 0.25, wy + r * 0.3, wx - waveW * 0.5, wy);
    ctx.quadraticCurveTo(wx - waveW * 0.75, wy - r * 0.3, wx - waveW, wy);
  }
  ctx.closePath();
  ctx.fill();

  // Eyes
  if (g.mode !== MODE_FRIGHTENED) {
    drawGhostEyes(cx, cy, cs, g);
  } else {
    // Frightened face - simple
    ctx.fillStyle = '#fff';
    const eyeR = cs * 0.06;
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.2, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + r * 0.3, cy - r * 0.2, eyeR, 0, Math.PI * 2);
    ctx.fill();
    // Squiggly mouth
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.35, cy + r * 0.2);
    for (let i = 0; i < 4; i++) {
      const sx = cx - r * 0.35 + i * r * 0.23;
      ctx.lineTo(sx + r * 0.1, cy + r * (i % 2 === 0 ? 0.35 : 0.1));
    }
    ctx.stroke();
  }
}

function drawGhostEyes(cx, cy, cs, g) {
  const r = cs * 0.42;
  const eyeR = cs * 0.1;
  const pupilR = cs * 0.05;

  // Direction offset for pupils
  let px = 0, py = 0;
  if (g.dir.x === 1)       px = pupilR;
  else if (g.dir.x === -1) px = -pupilR;
  if (g.dir.y === 1)       py = pupilR;
  else if (g.dir.y === -1) py = -pupilR;

  // Left eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.25, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#00f';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3 + px, cy - r * 0.25 + py, pupilR, 0, Math.PI * 2);
  ctx.fill();

  // Right eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx + r * 0.3, cy - r * 0.25, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#00f';
  ctx.beginPath();
  ctx.arc(cx + r * 0.3 + px, cy - r * 0.25 + py, pupilR, 0, Math.PI * 2);
  ctx.fill();
}

// =============================================
//  CONTROLS — Keyboard
// =============================================
document.addEventListener('keydown', e => {
  if (!running) {
    if (e.key === 'Enter' || e.key === ' ') { startGame(); e.preventDefault(); }
    return;
  }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    paused = !paused; e.preventDefault(); draw(); return;
  }
  if (paused) return;
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': pacman.nextDir = { x: 0, y: -1 }; break;
    case 'ArrowDown':  case 's': case 'S': pacman.nextDir = { x: 0, y: 1 };  break;
    case 'ArrowLeft':  case 'a': case 'A': pacman.nextDir = { x: -1, y: 0 }; break;
    case 'ArrowRight': case 'd': case 'D': pacman.nextDir = { x: 1, y: 0 };  break;
  }
  e.preventDefault();
});

// =============================================
//  CONTROLS — Touch swipe
// =============================================
let touchStart = null;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: false });

canvas.addEventListener('touchmove', e => { e.preventDefault(); }, { passive: false });

canvas.addEventListener('touchend', e => {
  if (!touchStart || !running) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    pacman.nextDir = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
  } else {
    pacman.nextDir = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  }
}, { passive: false });

// =============================================
//  CONTROLS — Mobile buttons
// =============================================
document.querySelectorAll('.ctrl-btn').forEach(btn => {
  const handler = () => {
    if (!running) return;
    const dir = btn.dataset.dir;
    switch (dir) {
      case 'up':    pacman.nextDir = { x: 0, y: -1 }; break;
      case 'down':  pacman.nextDir = { x: 0, y: 1 };  break;
      case 'left':  pacman.nextDir = { x: -1, y: 0 }; break;
      case 'right': pacman.nextDir = { x: 1, y: 0 };  break;
    }
  };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', e => { e.preventDefault(); handler(); }, { passive: false });
});

// =============================================
//  START BUTTON
// =============================================
btnStart.addEventListener('click', startGame);

// =============================================
//  STATS — Supabase
// =============================================
async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'pacman',
      result: 'end',
      moves: score,
      time_seconds: 0,
      score: score,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// =============================================
//  INIT
// =============================================
buildMaze();
resizeCanvas();
draw();
