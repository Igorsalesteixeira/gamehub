// ============================================
// TETRIS — Redesign 3.0 "Blocos de Doce Cartoon"
// Chunky candy blocks, thick outlines, 3D highlights
// ============================================

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// Candy colors — vibrant with light/dark variants
const COLORS = {
  I: { base: '#00E5FF', light: '#80F0FF', dark: '#009DB3', outline: '#006070', shine: '#FFFFFF' },
  O: { base: '#FFD600', light: '#FFE866', dark: '#C7A600', outline: '#8A7300', shine: '#FFFFFF' },
  T: { base: '#AA00FF', light: '#CC66FF', dark: '#7700B3', outline: '#4A0070', shine: '#FFFFFF' },
  S: { base: '#76FF03', light: '#A8FF60', dark: '#52B202', outline: '#2D6600', shine: '#FFFFFF' },
  Z: { base: '#FF1744', light: '#FF6680', dark: '#B3102F', outline: '#7A0A20', shine: '#FFFFFF' },
  J: { base: '#2979FF', light: '#6DA3FF', dark: '#1C54B3', outline: '#103270', shine: '#FFFFFF' },
  L: { base: '#FF9100', light: '#FFB54D', dark: '#B36500', outline: '#7A4400', shine: '#FFFFFF' }
};

// Formas das pecas
const PIECES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// Estado do jogo
const state = {
  board: [],
  boardTypes: [],  // track piece types for color lookup
  currentPiece: null,
  nextPiece: null,
  score: 0,
  level: 1,
  lines: 0,
  gameOver: false,
  paused: false,
  dropTimer: 0,
  dropInterval: 1000
};

// VFX state
let particles = [];
let lineClearFlash = 0;
let lineClearRows = [];
let screenShake = { x: 0, y: 0, intensity: 0 };
let timeElapsed = 0;

// DOM
let canvas, ctx, nextCanvas, nextCtx;
let scoreEl, levelEl, linesEl;
let overlay, overlayTitle, overlayMsg, overlayScore, btnStart;

// ============================================
// Inicializacao
// ============================================
function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  nextCanvas = document.getElementById('next-canvas');
  nextCtx = nextCanvas.getContext('2d');
  scoreEl = document.getElementById('score');
  levelEl = document.getElementById('level');
  linesEl = document.getElementById('lines');
  overlay = document.getElementById('overlay');
  overlayTitle = document.getElementById('overlay-title');
  overlayMsg = document.getElementById('overlay-msg');
  overlayScore = document.getElementById('overlay-score');
  btnStart = document.getElementById('btn-start');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  btnStart.addEventListener('click', startGame);
  document.addEventListener('keydown', handleKeydown);

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleMobileControl(btn.dataset.action);
    });
  });

  showStartScreen();
}

function resizeCanvas() {
  const isMobile = window.innerWidth <= 600;

  if (isMobile) {
    const maxWidth = Math.min(280, window.innerWidth * 0.9);
    const maxHeight = Math.min(480, window.innerHeight - 200);
    const blockSize = Math.min(maxWidth / COLS, maxHeight / ROWS);
    const finalWidth = blockSize * COLS;
    const finalHeight = blockSize * ROWS;

    canvas.style.width = finalWidth + 'px';
    canvas.style.height = finalHeight + 'px';
    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
  } else {
    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
    canvas.style.width = '';
    canvas.style.height = '';
  }

  nextCanvas.width = 4 * BLOCK_SIZE;
  nextCanvas.height = 4 * BLOCK_SIZE;
}

// ============================================
// Criacao de Pecas
// ============================================
function createPiece(type) {
  const shape = PIECES[type];
  return {
    shape: shape.map(row => [...row]),
    color: COLORS[type],
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
    type: type
  };
}

function randomPiece() {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  return createPiece(type);
}

// ============================================
// Controles
// ============================================
function handleKeydown(e) {
  if (state.gameOver || state.paused) return;

  const key = e.key.toLowerCase();

  switch(key) {
    case 'arrowleft':
    case 'a':
      e.preventDefault();
      movePiece(-1, 0);
      break;
    case 'arrowright':
    case 'd':
      e.preventDefault();
      movePiece(1, 0);
      break;
    case 'arrowdown':
    case 's':
      e.preventDefault();
      movePiece(0, 1);
      break;
    case 'arrowup':
    case 'w':
    case 'x':
      e.preventDefault();
      rotatePiece();
      break;
    case ' ':
    case 'spacebar':
      e.preventDefault();
      hardDrop();
      break;
    case 'p':
      togglePause();
      break;
  }
}

function handleMobileControl(action) {
  if (state.gameOver || state.paused) return;

  switch(action) {
    case 'left': movePiece(-1, 0); break;
    case 'right': movePiece(1, 0); break;
    case 'down': movePiece(0, 1); break;
    case 'rotate': rotatePiece(); break;
    case 'drop': hardDrop(); break;
  }
}

// ============================================
// Logica do Jogo
// ============================================
function startGame() {
  state.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
  state.boardTypes = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
  state.score = 0;
  state.level = 1;
  state.lines = 0;
  state.gameOver = false;
  state.paused = false;
  state.dropInterval = 1000;

  particles = [];
  lineClearFlash = 0;
  lineClearRows = [];
  screenShake = { x: 0, y: 0, intensity: 0 };

  state.nextPiece = randomPiece();
  spawnPiece();

  updateUI();
  overlay.classList.add('hidden');

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function spawnPiece() {
  state.currentPiece = state.nextPiece;
  state.nextPiece = randomPiece();
  drawNextPiece();

  if (!isValidPosition(state.currentPiece, state.currentPiece.x, state.currentPiece.y)) {
    gameOver();
  }
}

function movePiece(dx, dy) {
  if (!state.currentPiece) return;

  const newX = state.currentPiece.x + dx;
  const newY = state.currentPiece.y + dy;

  if (isValidPosition(state.currentPiece, newX, newY)) {
    state.currentPiece.x = newX;
    state.currentPiece.y = newY;
    return true;
  }

  if (dy > 0) {
    lockPiece();
  }
  return false;
}

function rotatePiece() {
  if (!state.currentPiece) return;

  const piece = state.currentPiece;
  const originalShape = piece.shape;

  const rows = piece.shape.length;
  const cols = piece.shape[0].length;
  const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      rotated[x][rows - 1 - y] = piece.shape[y][x];
    }
  }

  piece.shape = rotated;

  if (!isValidPosition(piece, piece.x, piece.y)) {
    if (isValidPosition(piece, piece.x + 1, piece.y)) {
      piece.x++;
    } else if (isValidPosition(piece, piece.x - 1, piece.y)) {
      piece.x--;
    } else {
      piece.shape = originalShape;
    }
  }
}

function hardDrop() {
  if (!state.currentPiece) return;

  let dropDist = 0;
  while (movePiece(0, 1)) {
    state.score += 2;
    dropDist++;
  }

  // Hard drop VFX
  if (dropDist > 2) {
    screenShake.intensity = Math.min(dropDist * 0.8, 4);
    const piece = state.currentPiece || { x: 5, y: 18, type: 'I' };
    for (let i = 0; i < 6; i++) {
      particles.push(createParticle(
        (piece.x + Math.random() * 3) * BLOCK_SIZE,
        piece.y * BLOCK_SIZE,
        'star'
      ));
    }
  }

  updateUI();
}

function isValidPosition(piece, x, y) {
  for (let py = 0; py < piece.shape.length; py++) {
    for (let px = 0; px < piece.shape[py].length; px++) {
      if (piece.shape[py][px]) {
        const newX = x + px;
        const newY = y + py;

        if (newX < 0 || newX >= COLS || newY >= ROWS) {
          return false;
        }
        if (newY >= 0 && state.board[newY][newX]) {
          return false;
        }
      }
    }
  }
  return true;
}

function lockPiece() {
  const piece = state.currentPiece;

  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const boardY = piece.y + y;
        const boardX = piece.x + x;
        if (boardY >= 0) {
          state.board[boardY][boardX] = piece.type;
          state.boardTypes[boardY][boardX] = piece.type;
        }
      }
    }
  }

  // Lock VFX — small dust particles
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const px = (piece.x + x) * BLOCK_SIZE + BLOCK_SIZE / 2;
        const py = (piece.y + y) * BLOCK_SIZE + BLOCK_SIZE;
        particles.push(createParticle(px, py, 'dust'));
      }
    }
  }

  clearLines();
  spawnPiece();
}

function clearLines() {
  let linesCleared = 0;
  const clearedRowIndices = [];

  for (let y = ROWS - 1; y >= 0; y--) {
    if (state.board[y].every(cell => cell !== 0)) {
      // Emit line clear particles
      for (let x = 0; x < COLS; x++) {
        const px = x * BLOCK_SIZE + BLOCK_SIZE / 2;
        const py = y * BLOCK_SIZE + BLOCK_SIZE / 2;
        for (let i = 0; i < 3; i++) {
          particles.push(createParticle(px, py, 'star'));
        }
        particles.push(createParticle(px, py, 'candy'));
      }

      clearedRowIndices.push(y);
      state.board.splice(y, 1);
      state.board.unshift(Array(COLS).fill(0));
      state.boardTypes.splice(y, 1);
      state.boardTypes.unshift(Array(COLS).fill(null));
      linesCleared++;
      y++;
    }
  }

  if (linesCleared > 0) {
    const points = [0, 100, 300, 500, 800];
    state.score += points[linesCleared] * state.level;
    state.lines += linesCleared;

    state.level = Math.floor(state.lines / 10) + 1;
    state.dropInterval = Math.max(100, 1000 - (state.level - 1) * 100);

    // Line clear VFX
    lineClearFlash = 1;
    lineClearRows = clearedRowIndices;
    screenShake.intensity = linesCleared * 2;

    if (navigator.vibrate) navigator.vibrate([15, 10, 15]);

    updateUI();
  }
}

function togglePause() {
  state.paused = !state.paused;
  if (state.paused) {
    overlayTitle.textContent = 'Pausado';
    overlayMsg.textContent = 'Clique para continuar';
    overlayScore.textContent = '';
    btnStart.textContent = 'Continuar';
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function gameOver() {
  state.gameOver = true;
  overlayTitle.textContent = 'Game Over';
  overlayMsg.textContent = 'Fim de jogo!';
  overlayScore.textContent = `Score: ${state.score}`;
  btnStart.textContent = 'Jogar Novamente';
  overlay.classList.remove('hidden');
  import('../shared/game-integration.js').then(m => m.onGameEnd('tetris', { won: false, score: state.score }));
}

function showStartScreen() {
  overlayTitle.textContent = 'Tetris';
  overlayMsg.textContent = 'Use as setas para jogar';
  overlayScore.textContent = '';
  btnStart.textContent = 'Jogar';
  overlay.classList.remove('hidden');
}

// ============================================
// Particle System
// ============================================
function createParticle(x, y, type) {
  const angle = Math.random() * Math.PI * 2;
  const speed = type === 'dust' ? (1 + Math.random() * 2) : (2 + Math.random() * 4);
  const colors = ['#FF4081', '#FFD54F', '#00E5FF', '#76FF03', '#AA00FF', '#FF9100', '#2979FF'];

  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - (type === 'star' ? 2 : 0),
    life: 1,
    decay: type === 'dust' ? 0.04 : 0.02,
    size: type === 'dust' ? (2 + Math.random() * 2) : (3 + Math.random() * 5),
    color: colors[Math.floor(Math.random() * colors.length)],
    gravity: type === 'dust' ? 0.02 : 0.08,
    friction: 0.97,
    type: type,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.15
  };
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vx *= p.friction;
    p.vy *= p.friction;
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    p.rotation += p.rotSpeed;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    const s = p.size * p.life;

    if (p.type === 'star') {
      drawStar(ctx, 0, 0, 4, s, s * 0.4, p.color);
    } else if (p.type === 'candy') {
      // Small candy circle with outline
      ctx.fillStyle = '#1A0533';
      ctx.beginPath();
      ctx.arc(0, 0, s + 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fill();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(-s * 0.25, -s * 0.25, s * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Dust
      ctx.fillStyle = p.color;
      ctx.globalAlpha *= 0.6;
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

// ============================================
// Game Loop
// ============================================
let lastTime = 0;

function gameLoop(currentTime) {
  if (state.gameOver || state.paused) return;

  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  state.dropTimer += deltaTime;
  if (state.dropTimer >= state.dropInterval) {
    movePiece(0, 1);
    state.dropTimer = 0;
  }

  timeElapsed += deltaTime * 0.001;

  // Update VFX
  updateParticles(deltaTime);

  if (lineClearFlash > 0) {
    lineClearFlash -= deltaTime * 0.003;
    if (lineClearFlash < 0) lineClearFlash = 0;
  }

  if (screenShake.intensity > 0) {
    screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
    screenShake.intensity *= 0.9;
    if (screenShake.intensity < 0.2) {
      screenShake.intensity = 0;
      screenShake.x = 0;
      screenShake.y = 0;
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// ============================================
// Desenho — CANDY CARTOON
// ============================================
function draw() {
  ctx.save();
  ctx.translate(screenShake.x, screenShake.y);

  // Background — dark candy gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#0D0520');
  bgGrad.addColorStop(0.5, '#120828');
  bgGrad.addColorStop(1, '#0D0520');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid — subtle candy grid
  drawGrid();

  // Desenha board
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (state.board[y][x]) {
        const type = state.board[y][x];
        drawCandyBlock(ctx, x, y, COLORS[type], BLOCK_SIZE);
      }
    }
  }

  // Ghost piece
  if (state.currentPiece) {
    drawGhostPiece();
  }

  // Desenha peca atual
  if (state.currentPiece) {
    const piece = state.currentPiece;
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          drawCandyBlock(ctx, piece.x + x, piece.y + y, piece.color, BLOCK_SIZE);
        }
      }
    }
  }

  // Line clear flash
  if (lineClearFlash > 0) {
    ctx.fillStyle = `rgba(255, 213, 79, ${lineClearFlash * 0.3})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Particles
  drawParticles();

  ctx.restore();
}

function drawGrid() {
  // Subtle grid lines
  ctx.strokeStyle = 'rgba(124, 77, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK_SIZE, 0);
    ctx.lineTo(x * BLOCK_SIZE, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK_SIZE);
    ctx.lineTo(canvas.width, y * BLOCK_SIZE);
    ctx.stroke();
  }

  // Grid dot accents at intersections
  ctx.fillStyle = 'rgba(255, 64, 129, 0.04)';
  for (let x = 0; x <= COLS; x++) {
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.arc(x * BLOCK_SIZE, y * BLOCK_SIZE, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================
// DRAW CANDY BLOCK — chunky 3D with outline
// ============================================
function drawCandyBlock(context, gridX, gridY, colors, size) {
  const px = gridX * size;
  const py = gridY * size;
  const s = size;
  const pad = 1;   // gap between blocks
  const r = 4;     // corner radius
  const outW = 3;  // outline width

  // Shadow under block
  context.fillStyle = 'rgba(0, 0, 0, 0.25)';
  roundRect(context, px + pad + 2, py + pad + 2, s - pad * 2, s - pad * 2, r);
  context.fill();

  // Dark outline
  context.fillStyle = colors.outline;
  roundRect(context, px + pad - outW/2, py + pad - outW/2, s - pad * 2 + outW, s - pad * 2 + outW, r + 1);
  context.fill();

  // Main body — gradient
  const bodyGrad = context.createLinearGradient(px, py, px, py + s);
  bodyGrad.addColorStop(0, colors.light);
  bodyGrad.addColorStop(0.4, colors.base);
  bodyGrad.addColorStop(1, colors.dark);
  context.fillStyle = bodyGrad;
  roundRect(context, px + pad + 1, py + pad + 1, s - pad * 2 - 2, s - pad * 2 - 2, r);
  context.fill();

  // Inner highlight border (top-left light edge)
  const hlGrad = context.createLinearGradient(px, py, px + s * 0.5, py + s * 0.5);
  hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = hlGrad;
  roundRect(context, px + pad + 2, py + pad + 2, s - pad * 2 - 4, (s - pad * 2 - 4) * 0.45, r - 1);
  context.fill();

  // Specular shine — circular highlight top-left
  const shineX = px + s * 0.3;
  const shineY = py + s * 0.28;
  const shineR = s * 0.18;
  const shineGrad = context.createRadialGradient(shineX, shineY, 0, shineX, shineY, shineR);
  shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
  shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = shineGrad;
  context.beginPath();
  context.arc(shineX, shineY, shineR, 0, Math.PI * 2);
  context.fill();

  // Small bright dot (specular)
  context.fillStyle = 'rgba(255, 255, 255, 0.8)';
  context.beginPath();
  context.arc(px + s * 0.27, py + s * 0.24, s * 0.06, 0, Math.PI * 2);
  context.fill();

  // Bottom edge dark line (depth)
  context.fillStyle = 'rgba(0, 0, 0, 0.15)';
  roundRect(context, px + pad + 3, py + s - pad - 6, s - pad * 2 - 6, 4, 2);
  context.fill();
}

// Rounded rectangle helper
function roundRect(ctx, x, y, w, h, r) {
  if (w < 0 || h < 0) return;
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

// ============================================
// Ghost Piece — transparent candy with dashed outline
// ============================================
function drawGhostPiece() {
  const piece = state.currentPiece;
  let ghostY = piece.y;

  while (isValidPosition(piece, piece.x, ghostY + 1)) {
    ghostY++;
  }

  if (ghostY !== piece.y) {
    const colors = piece.color;

    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const px = (piece.x + x) * BLOCK_SIZE;
          const py = (ghostY + y) * BLOCK_SIZE;
          const s = BLOCK_SIZE;
          const pad = 2;

          // Ghost fill — very transparent
          ctx.fillStyle = colors.base;
          ctx.globalAlpha = 0.12;
          roundRect(ctx, px + pad, py + pad, s - pad * 2, s - pad * 2, 4);
          ctx.fill();
          ctx.globalAlpha = 1;

          // Dashed outline
          ctx.strokeStyle = colors.base;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.5;
          ctx.setLineDash([4, 4]);
          roundRect(ctx, px + pad, py + pad, s - pad * 2, s - pad * 2, 4);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
}

// ============================================
// Next Piece Preview — candy style
// ============================================
function drawNextPiece() {
  const w = nextCanvas.width;
  const h = nextCanvas.height;

  // Background
  const bgGrad = nextCtx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#150A2E');
  bgGrad.addColorStop(1, '#0D0520');
  nextCtx.fillStyle = bgGrad;
  nextCtx.fillRect(0, 0, w, h);

  if (!state.nextPiece) return;

  const piece = state.nextPiece;
  const blockSize = 22;
  const offsetX = (w - piece.shape[0].length * blockSize) / 2;
  const offsetY = (h - piece.shape.length * blockSize) / 2;

  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const bx = offsetX + x * blockSize;
        const by = offsetY + y * blockSize;

        // Same candy style, smaller
        drawCandyBlockAbsolute(nextCtx, bx, by, piece.color, blockSize);
      }
    }
  }
}

// Draw candy block at absolute position (for next piece preview)
function drawCandyBlockAbsolute(context, px, py, colors, size) {
  const s = size;
  const pad = 1;
  const r = 3;
  const outW = 2;

  // Shadow
  context.fillStyle = 'rgba(0, 0, 0, 0.25)';
  roundRect(context, px + pad + 1, py + pad + 1, s - pad * 2, s - pad * 2, r);
  context.fill();

  // Outline
  context.fillStyle = colors.outline;
  roundRect(context, px + pad - outW/2, py + pad - outW/2, s - pad * 2 + outW, s - pad * 2 + outW, r + 1);
  context.fill();

  // Body gradient
  const bodyGrad = context.createLinearGradient(px, py, px, py + s);
  bodyGrad.addColorStop(0, colors.light);
  bodyGrad.addColorStop(0.4, colors.base);
  bodyGrad.addColorStop(1, colors.dark);
  context.fillStyle = bodyGrad;
  roundRect(context, px + pad + 1, py + pad + 1, s - pad * 2 - 2, s - pad * 2 - 2, r);
  context.fill();

  // Highlight
  const hlGrad = context.createLinearGradient(px, py, px + s * 0.5, py + s * 0.5);
  hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = hlGrad;
  roundRect(context, px + pad + 2, py + pad + 2, s - pad * 2 - 4, (s - pad * 2 - 4) * 0.4, r - 1);
  context.fill();

  // Specular
  context.fillStyle = 'rgba(255, 255, 255, 0.6)';
  context.beginPath();
  context.arc(px + s * 0.3, py + s * 0.25, s * 0.08, 0, Math.PI * 2);
  context.fill();
}

function updateUI() {
  scoreEl.textContent = state.score;
  levelEl.textContent = state.level;
  linesEl.textContent = state.lines;
}

// Inicia
init();
