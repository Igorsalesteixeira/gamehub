import { GameStats, GameStorage } from '../shared/game-core.js';
import { GameLoop } from '../shared/game-loop.js';
import { InputManager } from '../shared/input-manager.js';
import { launchConfetti, initAudio, playSound, haptic } from '../shared/game-design-utils.js';

// ============================================
// TETRIS - Jogo de Blocos
// ============================================

// ---- Constantes ----
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

// Cores das pecas (I, J, L, O, S, T, Z)
const COLORS = {
  I: '#00f0f0', // Cyan
  O: '#f0f000', // Yellow
  T: '#a000f0', // Purple
  S: '#00f000', // Green
  Z: '#f00000', // Red
  J: '#0000f0', // Blue
  L: '#f0a000'  // Orange
};

// ---- Definicao das Pecas (Tetrominos) ----
const PIECES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

// Array para acesso aleatorio
const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const PIECE_COLORS = [COLORS.I, COLORS.O, COLORS.T, COLORS.S, COLORS.Z, COLORS.J, COLORS.L];

// ============================================
// Estado do Jogo
// ============================================
const state = {
  board: [],           // Matriz 10x20
  currentPiece: null,  // Peca atual
  nextPiece: null,     // Proxima peca
  score: 0,
  level: 1,
  lines: 0,
  gameOver: false,
  paused: false,
  dropTimer: 0,
  dropInterval: 1000   // ms entre quedas automaticas
};

// ============================================
// Elementos do DOM
// ============================================
let canvas, ctx, nextCanvas, nextCtx;
let scoreEl, levelEl, linesEl;
let overlay, overlayTitle, overlayMsg, overlayScore, btnStart, btnShare;

// ============================================
// Inicializacao do Jogo
// ============================================
function init() {
  // Obtem elementos do DOM
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  nextCanvas = document.getElementById('next-canvas');
  nextCtx = nextCanvas.getContext('2d');
  scoreEl = document.getElementById('score-display');
  levelEl = document.getElementById('level-display');
  linesEl = document.getElementById('lines-display');
  overlay = document.getElementById('overlay');
  overlayTitle = document.getElementById('overlay-title');
  overlayMsg = document.getElementById('overlay-msg');
  overlayScore = document.getElementById('overlay-score');
  btnStart = document.getElementById('btn-start');
  btnShare = document.getElementById('btn-share');

  // Configura canvas
  canvas.width = COLS * BLOCK_SIZE;
  canvas.height = ROWS * BLOCK_SIZE;
  nextCanvas.width = 4 * BLOCK_SIZE;
  nextCanvas.height = 4 * BLOCK_SIZE;

  // Inicializa audio
  initAudio();

  // Registra event listeners
  setupEventListeners();

  // Mostra tela inicial
  showStartScreen();
}

function setupEventListeners() {
  // Botao de iniciar
  btnStart.addEventListener('click', startGame);

  // Botao de compartilhar
  btnShare.addEventListener('click', () => {
    const text = `Fiz ${state.score} pontos no Tetris! Tente superar meu recorde!`;
    const url = encodeURIComponent(window.location.href);
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + decodeURIComponent(url))}`, '_blank');
  });

  // Controles mobile
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const action = btn.dataset.action;
      handleMobileControl(action);
    });
  });
}

// ============================================
// Criacao de Pecas
// ============================================
function createPiece(type) {
  const shape = PIECES[type];
  const color = COLORS[type];
  const idx = PIECE_TYPES.indexOf(type);

  return {
    shape: shape.map(row => [...row]), // Copia profunda
    color: color,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
    type: type,
    idx: idx
  };
}

function randomPiece() {
  const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  return createPiece(type);
}

// ============================================
// Logica do Jogo
// ============================================
function startGame() {
  // Reseta estado
  state.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  state.score = 0;
  state.level = 1;
  state.lines = 0;
  state.gameOver = false;
  state.paused = false;
  state.dropInterval = 1000;
  state.dropTimer = 0;

  // Cria pecas
  state.currentPiece = randomPiece();
  state.nextPiece = randomPiece();

  // Atualiza UI
  updateUI();
  hideOverlay();

  // Inicia game loop
  gameLoop.start();
}

function gameOver() {
  state.gameOver = true;
  gameLoop.stop();

  // Mostra tela de fim de jogo
  overlayTitle.textContent = 'Fim de Jogo!';
  overlayMsg.textContent = 'Voce perdeu!';
  overlayScore.textContent = `Pontuacao: ${state.score}`;
  overlayScore.style.display = 'block';
  btnStart.textContent = 'Jogar Novamente';
  btnShare.style.display = 'block';
  overlay.classList.add('show');

  playSound('gameover');
  haptic([60, 30, 100]);
}

// ============================================
// Movimentacao
// ============================================
function move(dir) {
  if (state.gameOver || state.paused) return;

  let dx = 0, dy = 0;

  switch (dir) {
    case 'left':
      dx = -1;
      break;
    case 'right':
      dx = 1;
      break;
    case 'down':
      dy = 1;
      break;
  }

  if (!collides(state.currentPiece, dx, dy)) {
    state.currentPiece.x += dx;
    state.currentPiece.y += dy;

    if (dx !== 0) {
      playSound('move');
      haptic(15);
    }

    return true;
  }

  return false;
}

function rotate() {
  if (state.gameOver || state.paused) return;

  const piece = state.currentPiece;
  const shape = piece.shape;

  // Rotaciona 90 graus no sentido horario
  const rotated = shape[0].map((_, c) =>
    shape.map(row => row[c]).reverse()
  );

  // Tenta posicoes: original, wall kick esquerda, wall kick direita
  const kicks = [0, -1, 1, -2, 2];

  for (const kick of kicks) {
    if (!collides({ ...piece, shape: rotated }, kick, 0, rotated)) {
      piece.shape = rotated;
      piece.x += kick;
      playSound('rotate');
      haptic(15);
      return true;
    }
  }

  return false;
}

function drop() {
  if (state.gameOver || state.paused) return;

  // Hard drop (cai ate o fundo)
  while (!collides(state.currentPiece, 0, 1)) {
    state.currentPiece.y++;
  }

  playSound('move');
  haptic(15);
  lockPiece();
}

function softDrop() {
  // Desce uma posicao
  if (!move('down')) {
    lockPiece();
  }
}

function lockPiece() {
  const piece = state.currentPiece;

  // Fixa a peca no tabuleiro
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        const y = piece.y + r;
        const x = piece.x + c;

        // Se nao cabe no tabuleiro, game over
        if (y < 0) {
          gameOver();
          return;
        }

        state.board[y][x] = piece.color;
      }
    }
  }

  playSound('lock');

  // Limpa linhas completas
  clearLines();

  // Nova peca
  state.currentPiece = state.nextPiece;
  state.nextPiece = randomPiece();

  // Verifica colisao imediata (game over)
  if (collides(state.currentPiece, 0, 0)) {
    gameOver();
  }
}

// ============================================
// Deteccao de Colisao
// ============================================
function collides(piece, dx, dy, shape) {
  shape = shape || piece.shape;

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const nx = piece.x + c + dx;
        const ny = piece.y + r + dy;

        // Verifica limites do tabuleiro
        if (nx < 0 || nx >= COLS || ny >= ROWS) {
          return true;
        }

        // Verifica colisao com pecas fixas
        if (ny >= 0 && state.board[ny][nx]) {
          return true;
        }
      }
    }
  }

  return false;
}

// ============================================
// Limpeza de Linhas
// ============================================
function clearLines() {
  let linesCleared = 0;

  for (let r = ROWS - 1; r >= 0; r--) {
    if (state.board[r].every(cell => cell !== 0)) {
      // Remove a linha e adiciona nova no topo
      state.board.splice(r, 1);
      state.board.unshift(Array(COLS).fill(0));
      linesCleared++;
      r++; // Re-verifica a mesma posicao
    }
  }

  if (linesCleared > 0) {
    // Calcula pontos
    const pointsTable = [0, 100, 300, 500, 800];
    const points = (pointsTable[linesCleared] || 800) * state.level;
    state.score += points;
    state.lines += linesCleared;

    // Aumenta nivel a cada 10 linhas
    state.level = Math.floor(state.lines / 10) + 1;

    // Aumenta velocidade
    state.dropInterval = Math.max(100, 1000 - (state.level - 1) * 80);

    updateUI();
    playSound('clear');

    // Vibracao conforme numero de linhas
    if (navigator.vibrate) {
      const pattern = linesCleared === 4 ? [30, 20, 40, 20, 50] :
                      linesCleared === 3 ? [25, 15, 35] :
                      [20, 10, 25];
      navigator.vibrate(pattern);
    }
  }
}

// ============================================
// Renderizacao
// ============================================
function draw() {
  // Limpa canvas principal
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Desenha grade
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }
  }

  // Desenha tabuleiro (pecas fixas)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.board[r][c]) {
        drawBlock(ctx, c, r, state.board[r][c], BLOCK_SIZE);
      }
    }
  }

  // Desenha peca fantasma (ghost piece)
  if (state.currentPiece) {
    drawGhostPiece();
  }

  // Desenha peca atual
  if (state.currentPiece) {
    const piece = state.currentPiece;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          drawBlock(ctx, piece.x + c, piece.y + r, piece.color, BLOCK_SIZE);
        }
      }
    }
  }

  // Desenha proxima peca
  drawNextPiece();

  // Desenha overlay de pausa
  if (state.paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSADO', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
  }
}

function drawBlock(context, x, y, color, size) {
  // Bloco principal
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

  // Brilho superior
  context.fillStyle = 'rgba(255, 255, 255, 0.3)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, size / 4);

  // Sombra inferior
  context.fillStyle = 'rgba(0, 0, 0, 0.2)';
  context.fillRect(x * size + 1, y * size + size * 0.75, size - 2, size / 4 - 1);
}

function drawGhostPiece() {
  const piece = state.currentPiece;
  let ghostY = piece.y;

  // Encontra posicao mais baixa possivel
  while (!collides({ ...piece, y: ghostY + 1 }, 0, 0)) {
    ghostY++;
  }

  // So desenha se for diferente da posicao atual
  if (ghostY !== piece.y) {
    ctx.save();
    ctx.globalAlpha = 0.3;

    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          drawBlock(ctx, piece.x + c, ghostY + r, piece.color, BLOCK_SIZE);
        }
      }
    }

    ctx.restore();
  }
}

function drawNextPiece() {
  // Limpa canvas
  nextCtx.fillStyle = '#1a1a2e';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!state.nextPiece) return;

  const piece = state.nextPiece;
  const blockSize = 25;
  const offsetX = (nextCanvas.width - piece.shape[0].length * blockSize) / 2;
  const offsetY = (nextCanvas.height - piece.shape.length * blockSize) / 2;

  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        const x = offsetX + c * blockSize;
        const y = offsetY + r * blockSize;

        nextCtx.fillStyle = piece.color;
        nextCtx.fillRect(x, y, blockSize - 2, blockSize - 2);

        // Brilho
        nextCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        nextCtx.fillRect(x, y, blockSize - 2, blockSize / 4);
      }
    }
  }
}

// ============================================
// UI e Telas
// ============================================
function updateUI() {
  if (scoreEl) scoreEl.textContent = state.score;
  if (levelEl) levelEl.textContent = state.level;
  if (linesEl) linesEl.textContent = state.lines;
}

function showStartScreen() {
  overlayTitle.textContent = 'Tetris';
  overlayMsg.textContent = 'Use as setas para mover e girar';
  overlayScore.style.display = 'none';
  btnStart.textContent = 'Jogar';
  btnShare.style.display = 'none';
  overlay.classList.add('show');
}

function hideOverlay() {
  overlay.classList.remove('show');
}

function togglePause() {
  if (state.gameOver) return;
  state.paused = !state.paused;
}

function handleMobileControl(action) {
  if (state.gameOver) return;

  switch (action) {
    case 'left':
      move('left');
      break;
    case 'right':
      move('right');
      break;
    case 'down':
      drop();
      break;
    case 'rotate':
      rotate();
      break;
  }
}

// ============================================
// Game Loop
// ============================================
const gameLoop = new GameLoop({
  onUpdate: (dt) => {
    if (state.gameOver || state.paused) return;

    // Controle de queda automatica
    state.dropTimer += dt;
    if (state.dropTimer >= state.dropInterval) {
      state.dropTimer = 0;
      softDrop();
    }
  },
  onRender: () => {
    draw();
  }
});

// ============================================
// Input Manager (Controles)
// ============================================
const inputManager = new InputManager({
  keyboardTarget: document,
  onKeyDown: (e) => {
    if (state.gameOver) return;

    // Pausa
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      togglePause();
      e.preventDefault();
      return;
    }

    if (state.paused) return;

    // Controles de movimento
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        move('left');
        break;

      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        move('right');
        break;

      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        softDrop();
        break;

      case 'ArrowUp':
      case 'w':
      case 'W':
      case 'x':
      case 'X':
        e.preventDefault();
        rotate();
        break;

      case ' ': // Espaco - hard drop
        e.preventDefault();
        drop();
        break;
    }
  }
});

// ============================================
// Inicializacao
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
