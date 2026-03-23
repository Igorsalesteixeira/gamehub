import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { MultiplayerManager } from '../shared/multiplayer-manager.js';
import { supabase } from '../../supabase.js';
import { onGameEnd } from '../shared/game-integration.js';

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

// --- Multiplayer Detection ---
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
const IS_MULTIPLAYER = !!ROOM_ID;

// --- Shared Modules ---
const gameStats = new GameStats('reversi', { autoSync: true });
let mpManager = null;

// --- State ---
let board = [];
let currentPlayer = BLACK;
let gameOver = false;
let consecutivePasses = 0;
let isProcessing = false;
let myColor = BLACK;      // In multiplayer: BLACK for player1, WHITE for player2
let isMyTurn = true;      // In multiplayer: depends on turn
let roomData = null;        // Multiplayer room data
let myUserId = null;        // Current user ID
let player1Name = 'Jogador 1';
let player2Name = 'Jogador 2';

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
const modeIndicator = document.getElementById('mode-indicator');

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
  isProcessing = false;
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

// --- Multiplayer Setup ---
async function initMultiplayer() {
  if (!IS_MULTIPLAYER) return;

  // Get current user
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/auth.html?redirect=' + encodeURIComponent(window.location.href);
    return;
  }
  myUserId = session.user.id;

  // Update UI
  if (modeIndicator) {
    modeIndicator.textContent = '👥 Multiplayer';
    modeIndicator.classList.add('multiplayer-mode');
  }

  // Initialize multiplayer manager
  mpManager = new MultiplayerManager('reversi', ROOM_ID, {
    tableName: 'game_rooms',
    onConnect: () => console.log('[Reversi] Connected to multiplayer'),
    onDisconnect: () => console.log('[Reversi] Disconnected from multiplayer'),
    onError: (err) => console.error('[Reversi] Multiplayer error:', err)
  });

  // Join room and get initial state
  const success = await mpManager.init();
  if (!success) return;

  // Determine player role - player1 is BLACK, player2 is WHITE
  roomData = mpManager.roomData;
  const isPlayer1 = roomData.player1_id === myUserId;
  myColor = isPlayer1 ? BLACK : WHITE;
  isMyTurn = roomData.turn === (isPlayer1 ? 1 : 2);

  // Get player names
  player1Name = roomData.player1_name || 'Jogador 1';
  player2Name = roomData.player2_name || 'Jogador 2';

  // Restore board state if exists
  if (roomData.state && roomData.state.board) {
    board = roomData.state.board;
    currentPlayer = roomData.state.currentPlayer || BLACK;
    gameOver = roomData.state.gameOver || false;
    consecutivePasses = roomData.state.consecutivePasses || 0;
    render();
  }

  // Subscribe to realtime changes
  subscribeToRoom();

  // Update turn indicator
  updateTurnIndicator();
}

function subscribeToRoom() {
  if (!mpManager) return;

  // Handle move events
  mpManager.on('move', (payload) => {
    handleRemoteMove(payload);
  });

  // Handle pass events
  mpManager.on('pass_turn', (payload) => {
    handleRemotePass(payload);
  });

  // Handle game reset
  mpManager.on('game_reset', () => {
    resetGame(false);
  });

  // Handle player joined
  mpManager.on('player_joined', (payload) => {
    if (payload.playerNumber === 2) {
      player2Name = payload.playerName || 'Jogador 2';
    }
  });
}

async function handleRemoteMove(payload) {
  // Ignore our own moves
  if (payload.playerId === myUserId) return;

  isProcessing = true;

  // Apply move
  const { pos, flips, player } = payload;
  board[pos] = player;
  for (const f of flips) board[f] = player;

  // Render with animation
  render();
  const cells = boardEl.querySelectorAll('.cell');
  cells[pos].classList.add('last-move');

  // Animate flips
  for (const f of flips) {
    const piece = cells[f].querySelector('.piece');
    if (piece) {
      piece.classList.add('flipping');
      setTimeout(() => {
        piece.classList.remove('black', 'white');
        piece.classList.add(player === BLACK ? 'black' : 'white');
      }, 250);
      piece.addEventListener('animationend', () => {
        piece.classList.remove('flipping');
      }, { once: true });
    }
  }

  // Update counts
  const counts = countPieces(board);
  blackCountEl.textContent = counts.black;
  whiteCountEl.textContent = counts.white;

  // Switch turn
  currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
  consecutivePasses = 0;

  // Update turn
  const isPlayer1 = roomData.player1_id === myUserId;
  isMyTurn = currentPlayer === (isPlayer1 ? BLACK : WHITE);
  updateTurnIndicator();

  playSound('place');
  haptic(15);
  isProcessing = false;
}

async function handleRemotePass(payload) {
  // Ignore our own passes
  if (payload.playerId === myUserId) return;

  consecutivePasses = payload.consecutivePasses;
  currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;

  // Update turn
  const isPlayer1 = roomData.player1_id === myUserId;
  isMyTurn = currentPlayer === (isPlayer1 ? BLACK : WHITE);
  updateTurnIndicator();

  // Check if game over due to double pass
  if (consecutivePasses >= 2) {
    setTimeout(() => endGame(), 600);
    return;
  }

  // Check if current player has moves
  const validMoves = getValidMoves(board, currentPlayer);
  if (validMoves.length === 0) {
    // Auto-pass if no moves
    setTimeout(() => handlePass(), 500);
  }
}

async function sendMove(pos, flips, player) {
  if (!mpManager) return;

  // Check if this move ends the game
  const counts = countPieces(board);
  const isBoardFull = counts.black + counts.white === 64;
  const nextPlayer = player === BLACK ? WHITE : BLACK;
  const nextMoves = getValidMoves(board, nextPlayer);
  const willEndGame = isBoardFull || (nextMoves.length === 0 && getValidMoves(board, player).length === 0);

  // Broadcast to other player
  await mpManager.send('move', { pos, flips, player, gameOver: willEndGame });

  // Update room state in database
  const nextTurn = currentPlayer === BLACK ? 2 : 1;
  await mpManager.updateState(
    { board, currentPlayer, gameOver: willEndGame, consecutivePasses },
    { turn: nextTurn }
  );
}

async function sendPass() {
  if (!mpManager) return;

  // Broadcast pass
  await mpManager.send('pass_turn', { consecutivePasses });

  // Update room state
  const nextTurn = currentPlayer === BLACK ? 2 : 1;
  await mpManager.updateState(
    { board, currentPlayer, gameOver: false, consecutivePasses },
    { turn: nextTurn }
  );
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
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `Celula ${Math.floor(i/8)+1},${i%8+1}`);

    if (board[i] !== EMPTY) {
      const piece = document.createElement('div');
      piece.className = 'piece ' + (board[i] === BLACK ? 'black' : 'white');
      piece.setAttribute('aria-label', board[i] === BLACK ? 'Peca preta' : 'Peca branca');
      cell.appendChild(piece);
    }

    // Show valid moves for current player
    if (!gameOver && validSet.has(i)) {
      // In multiplayer, only show valid moves for my color
      if (!IS_MULTIPLAYER || currentPlayer === myColor) {
        cell.classList.add('valid-move');
        cell.setAttribute('aria-label', `Jogada valida em ${Math.floor(i/8)+1},${i%8+1}`);
        cell.addEventListener('click', () => handleCellClick(i));
        // Touch support for mobile
        cell.addEventListener('touchstart', (e) => {
          e.preventDefault();
          handleCellClick(i);
        }, { passive: false });
      }
    }

    boardEl.appendChild(cell);
  }
}

function updateTurnIndicator() {
  if (gameOver) return;

  const gameWrapper = document.querySelector('.game-wrapper') || document.body;
  turnEl.classList.remove('player-turn', 'cpu-turn', 'waiting');
  gameWrapper.classList.remove('thinking');

  if (IS_MULTIPLAYER) {
    if (isMyTurn) {
      turnEl.textContent = 'Sua vez!';
      turnEl.classList.add('player-turn');
    } else {
      turnEl.textContent = 'Vez do oponente...';
      turnEl.classList.add('cpu-turn');
      gameWrapper.classList.add('thinking');
    }
  } else {
    // Single player
    if (currentPlayer === BLACK) {
      turnEl.textContent = 'Sua vez (Preto)';
      turnEl.classList.add('player-turn');
    } else {
      turnEl.textContent = 'Computador pensando...';
      turnEl.classList.add('cpu-turn');
      gameWrapper.classList.add('thinking');
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

function handleCellClick(pos) {
  if (IS_MULTIPLAYER) {
    handleMultiplayerMove(pos);
  } else {
    handleSinglePlayerMove(pos);
  }
}

function handleMultiplayerMove(pos) {
  if (gameOver || isProcessing) return;
  if (!isMyTurn) return;

  const flips = getFlips(board, pos, myColor);
  if (flips.length === 0) return;

  isProcessing = true;
  initAudio();

  // Place piece
  board[pos] = myColor;
  playSound('place');
  render();

  // Flip captured pieces with animation
  for (const f of flips) board[f] = myColor;
  const cells = boardEl.querySelectorAll('.cell');

  // Show flip animation
  for (const f of flips) {
    const piece = cells[f].querySelector('.piece');
    if (piece) {
      piece.classList.add('flipping');
      setTimeout(() => {
        piece.classList.remove('white', 'black');
        piece.classList.add(myColor === BLACK ? 'black' : 'white');
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

  // Send move to opponent
  sendMove(pos, flips, myColor);

  // Switch turn
  currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
  isMyTurn = false;

  // Check if board is full
  if (counts.black + counts.white === 64) {
    setTimeout(() => endGame(), 800);
    isProcessing = false;
    return;
  }

  // Check if opponent has valid moves
  const opponentMoves = getValidMoves(board, currentPlayer);
  if (opponentMoves.length === 0) {
    consecutivePasses++;
    if (consecutivePasses >= 2) {
      setTimeout(() => endGame(), 800);
      isProcessing = false;
      return;
    }
    // Opponent has no moves, check if we have moves
    const myMoves = getValidMoves(board, myColor);
    if (myMoves.length === 0) {
      setTimeout(() => endGame(), 800);
      isProcessing = false;
      return;
    }
    // Pass back to us
    turnEl.textContent = 'Oponente sem jogadas! Sua vez';
    currentPlayer = myColor;
    isMyTurn = true;
    setTimeout(() => render(), 600);
  }

  updateTurnIndicator();
  isProcessing = false;
}

function handleSinglePlayerMove(pos) {
  if (gameOver || currentPlayer !== BLACK || isProcessing) return;
  isProcessing = true;
  initAudio();
  const flips = getFlips(board, pos, BLACK);
  if (flips.length === 0) {
    isProcessing = false;
    return;
  }

  // Place piece
  board[pos] = BLACK;
  playSound('place');
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

function handlePass() {
  if (IS_MULTIPLAYER) {
    consecutivePasses++;
    if (consecutivePasses >= 2) {
      endGame();
      return;
    }

    // Send pass to opponent
    sendPass();

    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    isMyTurn = false;
    updateTurnIndicator();
  }
}

function cpuMove() {
  if (gameOver) {
    isProcessing = false;
    return;
  }
  const moves = getValidMoves(board, WHITE);
  if (moves.length === 0) {
    consecutivePasses++;
    if (consecutivePasses >= 2) {
      endGame();
      isProcessing = false;
      return;
    }
    currentPlayer = BLACK;
    const playerMoves = getValidMoves(board, BLACK);
    if (playerMoves.length === 0) {
      endGame();
      isProcessing = false;
      return;
    }
    turnEl.textContent = 'CPU sem jogadas! Sua vez';
    turnEl.className = 'turn-indicator player-turn';
    const gameWrapper = document.querySelector('.game-wrapper') || document.body;
    gameWrapper.classList.remove('thinking');
    setTimeout(() => render(), 800);
    isProcessing = false;
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
    isProcessing = false;
    return;
  }

  // Switch to player
  currentPlayer = BLACK;
  const playerMoves = getValidMoves(board, BLACK);
  if (playerMoves.length === 0) {
    consecutivePasses++;
    if (consecutivePasses >= 2) {
      endGame();
      isProcessing = false;
      return;
    }
    turnEl.textContent = 'Voce sem jogadas! Vez do CPU';
    currentPlayer = WHITE;
    setTimeout(() => cpuMove(), 800);
    return;
  }

  render();
  isProcessing = false;
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

  if (IS_MULTIPLAYER) {
    // Multiplayer end game
    const iWon = (myColor === BLACK && black > white) || (myColor === WHITE && white > black);
    const isDraw = black === white;

    if (iWon) {
      result = 'win';
      icon = '🏆';
      title = 'Você venceu!';
      msg = `Preto ${black} x ${white} Branco`;
      launchConfetti();
      playSound('win');
    } else if (isDraw) {
      result = 'draw';
      icon = '🤝';
      title = 'Empate!';
      msg = `Preto ${black} x ${white} Branco`;
    } else {
      result = 'loss';
      icon = '😔';
      title = 'Você perdeu!';
      msg = `Preto ${black} x ${white} Branco`;
    }

    // Update room status
    if (ROOM_ID) {
      const isPlayer1 = roomData.player1_id === myUserId;
      if (mpManager) {
        mpManager.finishGame(iWon ? myUserId : (isDraw ? null : 'opponent'));
      }
    }
  } else {
    // Single player end game
    if (black > white) {
      result = 'win';
      icon = '🏆';
      title = 'Você venceu!';
      msg = `Preto ${black} x ${white} Branco`;
      launchConfetti();
      playSound('win');
    } else if (white > black) {
      result = 'loss';
      icon = '😔';
      title = 'CPU venceu!';
      msg = `Preto ${black} x ${white} Branco`;
    } else {
      result = 'draw';
      icon = '🤝';
      title = 'Empate!';
      msg = `Preto ${black} x ${white} Branco`;
    }
  }

  // Save stats using shared module
  gameStats.recordGame(result === 'win', { score: Math.max(black, white) });
  onGameEnd('reversi', { won: result === 'win', score: Math.max(black, white) });

  turnEl.textContent = title;
  turnEl.className = 'turn-indicator';

  modalIcon.textContent = icon;
  modalTitle.textContent = title;
  modalMsg.textContent = msg;
  modalOverlay.classList.add('show');
  modalOverlay.setAttribute('aria-hidden', 'false');
}

// --- Init ---
function resetGame(shouldBroadcast = true) {
  modalOverlay.classList.remove('show');
  modalOverlay.setAttribute('aria-hidden', 'true');
  initBoard();
  render();
  updateTurnIndicator();

  if (IS_MULTIPLAYER && shouldBroadcast && mpManager) {
    mpManager.send('game_reset', {});

    // Reset room state
    mpManager.resetRoom({
      board: new Array(64).fill(EMPTY),
      currentPlayer: BLACK,
      gameOver: false,
      consecutivePasses: 0
    });

    // Reset local multiplayer state
    const isPlayer1 = roomData.player1_id === myUserId;
    myColor = isPlayer1 ? BLACK : WHITE;
    isMyTurn = isPlayer1;
    currentPlayer = BLACK;
    updateTurnIndicator();
  }
}

function newGame() {
  resetGame(true);
}

btnNewGame.addEventListener('click', () => { initAudio(); playSound('click'); newGame(); });
btnPlayAgain.addEventListener('click', () => { initAudio(); playSound('click'); newGame(); });

// Cleanup
window.addEventListener('beforeunload', () => {
  if (mpManager) {
    mpManager.cleanup();
  }
  gameStats.destroy();
});

// Start
initMultiplayer().then(() => {
  initBoard();
  render();
  updateTurnIndicator();
});
