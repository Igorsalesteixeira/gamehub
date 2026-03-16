import { supabase } from '../../supabase.js';

// --- Constants ---
const EMPTY = 0, BLACK = 1, WHITE = 2;
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1],
];

// Corner positions (most valuable)
const CORNERS = new Set([0, 7, 56, 63]);
// Squares adjacent to corners (dangerous to take early)
const C_SQUARES = new Set([1, 8, 9, 6, 14, 15, 48, 49, 57, 54, 55, 62]);
// Edge positions (valuable)
const EDGES = new Set();
for (let i = 0; i < 8; i++) {
  EDGES.add(i);       // top
  EDGES.add(56 + i);  // bottom
  EDGES.add(i * 8);   // left
  EDGES.add(i * 8 + 7); // right
}

// --- State ---
let board = [];
let currentPlayer = BLACK;
let gameOver = false;
let consecutivePasses = 0;

// --- DOM ---
const boardEl = document.getElementById('board');
const turnEl = document.getElementById('turn-indicator');
const blackCountEl = document.getElementById('black-count');
const whiteCountEl = document.getElementById('white-count');
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');

// --- Board logic ---
function idx(r, c) { return r * 8 + c; }
function rowCol(i) { return [Math.floor(i / 8), i % 8]; }

function initBoard() {
  board = new Array(64).fill(EMPTY);
  board[idx(3, 3)] = WHITE;
  board[idx(3, 4)] = BLACK;
  board[idx(4, 3)] = BLACK;
  board[idx(4, 4)] = WHITE;
  currentPlayer = BLACK;
  gameOver = false;
  consecutivePasses = 0;
}

function getFlips(b, pos, player) {
  const [r, c] = rowCol(pos);
  if (b[pos] !== EMPTY) return [];
  const opponent = player === BLACK ? WHITE : BLACK;
  const allFlips = [];

  for (const [dr, dc] of DIRS) {
    const flips = [];
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && b[idx(nr, nc)] === opponent) {
      flips.push(idx(nr, nc));
      nr += dr;
      nc += dc;
    }
    if (flips.length > 0 && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && b[idx(nr, nc)] === player) {
      allFlips.push(...flips);
    }
  }
  return allFlips;
}

function getValidMoves(b, player) {
  const moves = [];
  for (let i = 0; i < 64; i++) {
    const flips = getFlips(b, i, player);
    if (flips.length > 0) moves.push({ pos: i, flips });
  }
  return moves;
}

function countPieces(b) {
  let black = 0, white = 0;
  for (const cell of b) {
    if (cell === BLACK) black++;
    else if (cell === WHITE) white++;
  }
  return { black, white };
}

// --- Rendering ---
function render() {
  const counts = countPieces(board);
  blackCountEl.textContent = counts.black;
  whiteCountEl.textContent = counts.white;

  const validMoves = gameOver ? [] : getValidMoves(board, currentPlayer);
  const validSet = new Set(validMoves.map(m => m.pos));

  boardEl.innerHTML = '';
  for (let i = 0; i < 64; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.idx = i;

    if (board[i] !== EMPTY) {
      const piece = document.createElement('div');
      piece.className = 'piece ' + (board[i] === BLACK ? 'black' : 'white');
      cell.appendChild(piece);
    }

    if (currentPlayer === BLACK && validSet.has(i) && !gameOver) {
      cell.classList.add('valid-move');
      cell.addEventListener('click', () => playerMove(i));
    }

    boardEl.appendChild(cell);
  }

  if (!gameOver) {
    if (currentPlayer === BLACK) {
      turnEl.textContent = 'Sua vez (Preto)';
      turnEl.className = 'turn-indicator player-turn';
    } else {
      turnEl.textContent = 'Vez do CPU (Branco)';
      turnEl.className = 'turn-indicator cpu-turn';
    }
  }
}

function animateFlips(flippedPositions, newColor, callback) {
  const cells = boardEl.querySelectorAll('.cell');
  let animCount = 0;
  const total = flippedPositions.length;

  if (total === 0) {
    callback();
    return;
  }

  for (const pos of flippedPositions) {
    const cell = cells[pos];
    const piece = cell.querySelector('.piece');
    if (!piece) { animCount++; continue; }

    piece.classList.add('flipping');

    // Halfway through animation, swap color
    setTimeout(() => {
      piece.classList.remove('black', 'white');
      piece.classList.add(newColor === BLACK ? 'black' : 'white');
    }, 250);

    piece.addEventListener('animationend', () => {
      piece.classList.remove('flipping');
      animCount++;
      if (animCount >= total) callback();
    }, { once: true });
  }
}

// --- Game flow ---
function applyMove(pos, player) {
  const flips = getFlips(board, pos, player);
  board[pos] = player;
  for (const f of flips) {
    board[f] = player;
  }
  return flips;
}

function playerMove(pos) {
  if (gameOver || currentPlayer !== BLACK) return;
  const flips = getFlips(board, pos, BLACK);
  if (flips.length === 0) return;

  // Place piece
  board[pos] = BLACK;
  render();

  // Flip captured pieces with animation
  for (const f of flips) board[f] = BLACK;
  const cells = boardEl.querySelectorAll('.cell');

  // Show flip animation
  for (const f of flips) {
    const piece = cells[f].querySelector('.piece');
    if (piece) {
      piece.classList.add('flipping');
      setTimeout(() => {
        piece.classList.remove('white');
        piece.classList.add('black');
      }, 250);
      piece.addEventListener('animationend', () => {
        piece.classList.remove('flipping');
      }, { once: true });
    }
  }

  // Highlight last move
  cells[pos].classList.add('last-move');

  consecutivePasses = 0;
  const counts = countPieces(board);
  blackCountEl.textContent = counts.black;
  whiteCountEl.textContent = counts.white;

  // Switch to CPU
  currentPlayer = WHITE;
  const cpuMoves = getValidMoves(board, WHITE);
  if (cpuMoves.length === 0) {
    consecutivePasses++;
    if (consecutivePasses >= 2 || countPieces(board).black + countPieces(board).white === 64) {
      endGame();
      return;
    }
    // CPU has no moves, skip back to player
    currentPlayer = BLACK;
    turnEl.textContent = 'CPU sem jogadas! Sua vez';
    const playerMoves = getValidMoves(board, BLACK);
    if (playerMoves.length === 0) {
      endGame();
      return;
    }
    setTimeout(() => render(), 600);
    return;
  }

  turnEl.textContent = 'Vez do CPU (Branco)';
  turnEl.className = 'turn-indicator cpu-turn';

  setTimeout(() => cpuMove(), 600);
}

function cpuMove() {
  if (gameOver) return;
  const moves = getValidMoves(board, WHITE);
  if (moves.length === 0) {
    consecutivePasses++;
    if (consecutivePasses >= 2) {
      endGame();
      return;
    }
    currentPlayer = BLACK;
    const playerMoves = getValidMoves(board, BLACK);
    if (playerMoves.length === 0) {
      endGame();
      return;
    }
    render();
    return;
  }

  consecutivePasses = 0;

  // Greedy AI with positional awareness
  const chosen = chooseCpuMove(moves);

  // Place piece
  board[chosen.pos] = WHITE;
  for (const f of chosen.flips) board[f] = WHITE;

  // Render and animate
  render();
  const cells = boardEl.querySelectorAll('.cell');
  cells[chosen.pos].classList.add('last-move');

  for (const f of chosen.flips) {
    const piece = cells[f].querySelector('.piece');
    if (piece) {
      piece.classList.add('flipping');
      setTimeout(() => {
        piece.classList.remove('black');
        piece.classList.add('white');
      }, 250);
      piece.addEventListener('animationend', () => {
        piece.classList.remove('flipping');
      }, { once: true });
    }
  }

  const counts = countPieces(board);
  blackCountEl.textContent = counts.black;
  whiteCountEl.textContent = counts.white;

  // Check if board is full
  if (counts.black + counts.white === 64) {
    endGame();
    return;
  }

  // Switch to player
  currentPlayer = BLACK;
  const playerMoves = getValidMoves(board, BLACK);
  if (playerMoves.length === 0) {
    consecutivePasses++;
    if (consecutivePasses >= 2) {
      endGame();
      return;
    }
    turnEl.textContent = 'Voce sem jogadas! Vez do CPU';
    currentPlayer = WHITE;
    setTimeout(() => cpuMove(), 800);
    return;
  }

  render();
}

function chooseCpuMove(moves) {
  // Score each move
  let best = null;
  let bestScore = -Infinity;

  for (const move of moves) {
    let score = move.flips.length;

    // Corners are extremely valuable
    if (CORNERS.has(move.pos)) {
      score += 100;
    }
    // Edges are good
    else if (EDGES.has(move.pos) && !C_SQUARES.has(move.pos)) {
      score += 10;
    }
    // C-squares (adjacent to corners) are dangerous unless corner is taken
    else if (C_SQUARES.has(move.pos)) {
      // Check if the adjacent corner is already ours
      const adjacentCorner = getAdjacentCorner(move.pos);
      if (adjacentCorner !== -1 && board[adjacentCorner] === WHITE) {
        score += 5;
      } else {
        score -= 8;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best;
}

function getAdjacentCorner(pos) {
  const cornerMap = {
    1: 0, 8: 0, 9: 0,
    6: 7, 14: 7, 15: 7,
    48: 56, 49: 56, 57: 56,
    54: 63, 55: 63, 62: 63,
  };
  return cornerMap[pos] !== undefined ? cornerMap[pos] : -1;
}

// --- End Game ---
function endGame() {
  gameOver = true;
  const { black, white } = countPieces(board);

  let result, icon, title, msg;
  if (black > white) {
    result = 'win';
    icon = '\u{1F3C6}'; // trophy
    title = 'Voce venceu!';
    msg = `Preto ${black} x ${white} Branco`;
  } else if (white > black) {
    result = 'loss';
    icon = '\u{1F614}'; // pensive
    title = 'CPU venceu!';
    msg = `Preto ${black} x ${white} Branco`;
  } else {
    result = 'draw';
    icon = '\u{1F91D}'; // handshake
    title = 'Empate!';
    msg = `Preto ${black} x ${white} Branco`;
  }

  turnEl.textContent = title;
  turnEl.className = 'turn-indicator';

  modalIcon.textContent = icon;
  modalTitle.textContent = title;
  modalMsg.textContent = msg;
  modalOverlay.classList.remove('hidden');

  saveGameStat(result);
}

// --- Supabase ---
async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'reversi',
      result: result,
      moves: 0,
      time_seconds: 0,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// --- Init ---
function newGame() {
  modalOverlay.classList.add('hidden');
  initBoard();
  render();
}

btnNewGame.addEventListener('click', newGame);
btnPlayAgain.addEventListener('click', newGame);

// Start
newGame();
