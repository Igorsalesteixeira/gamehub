// ============================================
// TETRIS - SIMPLIFICADO
// ============================================

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// Cores das pecas
const COLORS = {
  I: '#00f0f0',
  O: '#f0f000',
  T: '#a000f0',
  S: '#00f000',
  Z: '#f00000',
  J: '#0000f0',
  L: '#f0a000'
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

  // Canvas sizes
  canvas.width = COLS * BLOCK_SIZE;
  canvas.height = ROWS * BLOCK_SIZE;
  nextCanvas.width = 4 * BLOCK_SIZE;
  nextCanvas.height = 4 * BLOCK_SIZE;

  // Event listeners
  btnStart.addEventListener('click', startGame);
  document.addEventListener('keydown', handleKeydown);

  // Mobile controls
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleMobileControl(btn.dataset.action);
    });
  });

  showStartScreen();
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

  switch(e.key) {
    case 'ArrowLeft':
    case 'a':
      e.preventDefault();
      movePiece(-1, 0);
      break;
    case 'ArrowRight':
    case 'd':
      e.preventDefault();
      movePiece(1, 0);
      break;
    case 'ArrowDown':
    case 's':
      e.preventDefault();
      movePiece(0, 1);
      break;
    case 'ArrowUp':
    case 'w':
    case 'x':
      e.preventDefault();
      rotatePiece();
      break;
    case ' ':
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
  }
}

// ============================================
// Logica do Jogo
// ============================================
function startGame() {
  state.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
  state.score = 0;
  state.level = 1;
  state.lines = 0;
  state.gameOver = false;
  state.paused = false;
  state.dropInterval = 1000;

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

  // Game over se nao pode spawnar
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

  // Se nao pode mover para baixo, locka a peca
  if (dy > 0) {
    lockPiece();
  }
  return false;
}

function rotatePiece() {
  if (!state.currentPiece) return;

  const piece = state.currentPiece;
  const originalShape = piece.shape;

  // Rotaciona 90 graus
  const rows = piece.shape.length;
  const cols = piece.shape[0].length;
  const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      rotated[x][rows - 1 - y] = piece.shape[y][x];
    }
  }

  piece.shape = rotated;

  // Se rotacao invalida, tenta ajustar
  if (!isValidPosition(piece, piece.x, piece.y)) {
    // Tenta mover para direita
    if (isValidPosition(piece, piece.x + 1, piece.y)) {
      piece.x++;
    }
    // Tenta mover para esquerda
    else if (isValidPosition(piece, piece.x - 1, piece.y)) {
      piece.x--;
    }
    // Volta a rotacao
    else {
      piece.shape = originalShape;
    }
  }
}

function hardDrop() {
  if (!state.currentPiece) return;

  while (movePiece(0, 1)) {
    state.score += 2;
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

  // Adiciona ao board
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const boardY = piece.y + y;
        const boardX = piece.x + x;
        if (boardY >= 0) {
          state.board[boardY][boardX] = piece.color;
        }
      }
    }
  }

  // Verifica linhas completas
  clearLines();

  // Proxima peca
  spawnPiece();
}

function clearLines() {
  let linesCleared = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (state.board[y].every(cell => cell !== 0)) {
      // Remove a linha
      state.board.splice(y, 1);
      state.board.unshift(Array(COLS).fill(0));
      linesCleared++;
      y++; // Verifica a mesma posicao novamente
    }
  }

  if (linesCleared > 0) {
    // Pontuacao
    const points = [0, 100, 300, 500, 800];
    state.score += points[linesCleared] * state.level;
    state.lines += linesCleared;

    // Level up a cada 10 linhas
    state.level = Math.floor(state.lines / 10) + 1;
    state.dropInterval = Math.max(100, 1000 - (state.level - 1) * 100);

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
}

function showStartScreen() {
  overlayTitle.textContent = 'Tetris';
  overlayMsg.textContent = 'Use as setas para jogar';
  overlayScore.textContent = '';
  btnStart.textContent = 'Jogar';
  overlay.classList.remove('hidden');
}

// ============================================
// Game Loop
// ============================================
let lastTime = 0;

function gameLoop(currentTime) {
  if (state.gameOver || state.paused) return;

  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  // Drop automatico
  state.dropTimer += deltaTime;
  if (state.dropTimer >= state.dropInterval) {
    movePiece(0, 1);
    state.dropTimer = 0;
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// ============================================
// Desenho
// ============================================
function draw() {
  // Limpa canvas
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Desenha board
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (state.board[y][x]) {
        drawBlock(ctx, x, y, state.board[y][x]);
      }
    }
  }

  // Desenha peca atual
  if (state.currentPiece) {
    const piece = state.currentPiece;
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          drawBlock(ctx, piece.x + x, piece.y + y, piece.color);
        }
      }
    }

    // Ghost piece (onde vai cair)
    drawGhostPiece();
  }

  // Grid sutil
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.1)';
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
}

function drawBlock(context, x, y, color) {
  const px = x * BLOCK_SIZE;
  const py = y * BLOCK_SIZE;

  // Bloco base
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);

  // Brilho
  context.fillStyle = 'rgba(255, 255, 255, 0.3)';
  context.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, 4);
}

function drawGhostPiece() {
  const piece = state.currentPiece;
  let ghostY = piece.y;

  // Encontra onde a peca vai cair
  while (isValidPosition(piece, piece.x, ghostY + 1)) {
    ghostY++;
  }

  if (ghostY !== piece.y) {
    ctx.strokeStyle = piece.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const px = (piece.x + x) * BLOCK_SIZE + 2;
          const py = (ghostY + y) * BLOCK_SIZE + 2;
          ctx.strokeRect(px, py, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
        }
      }
    }

    ctx.setLineDash([]);
  }
}

function drawNextPiece() {
  nextCtx.fillStyle = '#000';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!state.nextPiece) return;

  const piece = state.nextPiece;
  const blockSize = 20;
  const offsetX = (nextCanvas.width - piece.shape[0].length * blockSize) / 2;
  const offsetY = (nextCanvas.height - piece.shape.length * blockSize) / 2;

  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const px = offsetX + x * blockSize;
        const py = offsetY + y * blockSize;
        nextCtx.fillStyle = piece.color;
        nextCtx.fillRect(px + 1, py + 1, blockSize - 2, blockSize - 2);
      }
    }
  }
}

function updateUI() {
  scoreEl.textContent = state.score;
  levelEl.textContent = state.level;
  linesEl.textContent = state.lines;
}

// Inicia
init();
