// =============================================
//  PAC-MAN — game.js (SIMPLIFICADO)
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

// Ghost settings
const GHOST_COLORS = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852'];
const GHOST_NAMES = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

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
}

function gameWin() {
  running = false;
  overlayTitle.textContent = 'VITORIA!';
  overlayMsg.textContent = 'VOCE COMPLETOU O NIVEL!';
  overlayScore.textContent = `SCORE: ${score}`;
  btnStart.textContent = 'PROXIMO NIVEL';
  overlay.classList.remove('hidden');
  level++;
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
  } else if (tile === P) {
    maze[pacman.y][pacman.x] = E;
    score += 50;
    dotsEaten++;
    activateFrightened();
    updateStats();
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
        // Eat ghost
        ghost.x = 10;
        ghost.y = 10;
        ghost.mode = 'chase';
        score += 200;
        updateStats();
      } else {
        // Lose life
        lives--;
        updateStats();
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

// ---- Drawing ----
function draw() {
  // Clear
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cs = cellSize;

  // Draw maze
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = maze[y][x];
      const px = x * cs;
      const py = y * cs;

      if (tile === W) {
        ctx.fillStyle = '#2121de';
        ctx.fillRect(px, py, cs, cs);
      } else if (tile === D) {
        ctx.fillStyle = '#ffb8ae';
        ctx.beginPath();
        ctx.arc(px + cs/2, py + cs/2, cs/6, 0, Math.PI * 2);
        ctx.fill();
      } else if (tile === P) {
        ctx.fillStyle = '#ffb8ae';
        ctx.beginPath();
        ctx.arc(px + cs/2, py + cs/2, cs/3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw Pac-Man
  drawPacman();

  // Draw ghosts
  ghosts.forEach(drawGhost);
}

function drawPacman() {
  const cs = cellSize;
  const px = pacman.x * cs + cs/2;
  const py = pacman.y * cs + cs/2;
  const radius = cs * 0.4;

  ctx.fillStyle = '#ffff00';
  ctx.beginPath();

  let startAngle = 0;
  let endAngle = Math.PI * 2;

  if (pacman.mouthOpen) {
    const mouthSize = 0.2 * Math.PI;
    if (pacman.dir.x === 1) {
      startAngle = mouthSize;
      endAngle = Math.PI * 2 - mouthSize;
    } else if (pacman.dir.x === -1) {
      startAngle = Math.PI + mouthSize;
      endAngle = Math.PI - mouthSize;
    } else if (pacman.dir.y === -1) {
      startAngle = Math.PI * 1.5 + mouthSize;
      endAngle = Math.PI * 1.5 - mouthSize;
    } else if (pacman.dir.y === 1) {
      startAngle = Math.PI * 0.5 + mouthSize;
      endAngle = Math.PI * 0.5 - mouthSize;
    } else {
      // Default facing right
      startAngle = mouthSize;
      endAngle = Math.PI * 2 - mouthSize;
    }
  }

  ctx.arc(px, py, radius, startAngle, endAngle);
  ctx.lineTo(px, py);
  ctx.fill();
}

function drawGhost(ghost) {
  const cs = cellSize;
  const px = ghost.x * cs;
  const py = ghost.y * cs;
  const w = cs;
  const h = cs;

  // Body color
  ctx.fillStyle = ghost.mode === 'frightened' ? '#2121de' : ghost.color;

  // Ghost shape
  ctx.beginPath();
  ctx.arc(px + w/2, py + h/2, w*0.4, Math.PI, 0);
  ctx.lineTo(px + w*0.9, py + h*0.8);
  // Wavy bottom
  for (let i = 0; i < 3; i++) {
    ctx.lineTo(px + w*(0.9 - i*0.3), py + h*(i % 2 === 0 ? 0.9 : 0.7));
  }
  ctx.lineTo(px + w*0.1, py + h*0.8);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px + w*0.35, py + h*0.35, w*0.12, 0, Math.PI * 2);
  ctx.arc(px + w*0.65, py + h*0.35, w*0.12, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(px + w*0.35 + ghost.dir.x*2, py + h*0.35 + ghost.dir.y*2, w*0.05, 0, Math.PI * 2);
  ctx.arc(px + w*0.65 + ghost.dir.x*2, py + h*0.35 + ghost.dir.y*2, w*0.05, 0, Math.PI * 2);
  ctx.fill();
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
