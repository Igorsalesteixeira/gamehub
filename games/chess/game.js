import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';
import { MultiplayerManager, GameStats } from '../shared/multiplayer-manager.js';

// ========== DEBUG & VERSION ==========
console.log('[Xadrez] v13 Premium 3D - Inicializando...');
const DEBUG = location.search.includes('debug');
function debug(...args) {
  if (DEBUG) console.log('[Xadrez]', ...args);
}

// ========== CONSTANTS ==========
const EMPTY = 0;
const WP = 1, WN = 2, WB = 3, WR = 4, WQ = 5, WK = 6;
const BP = 7, BN = 8, BB = 9, BR = 10, BQ = 11, BK = 12;

const PIECE_SYMBOLS = {
  [WK]: '\u2654', [WQ]: '\u2655', [WR]: '\u2656', [WB]: '\u2657', [WN]: '\u2658', [WP]: '\u2659',
  [BK]: '\u265A', [BQ]: '\u265B', [BR]: '\u265C', [BB]: '\u265D', [BN]: '\u265E', [BP]: '\u265F',
};

const PIECE_VALUES = { [WP]: 100, [WN]: 320, [WB]: 330, [WR]: 500, [WQ]: 900, [WK]: 20000,
  [BP]: 100, [BN]: 320, [BB]: 330, [BR]: 500, [BQ]: 900, [BK]: 20000 };

function isWhite(p) { return p >= 1 && p <= 6; }
function isBlack(p) { return p >= 7 && p <= 12; }
function pieceColor(p) { return p === 0 ? null : isWhite(p) ? 'w' : 'b'; }
function enemyColor(c) { return c === 'w' ? 'b' : 'w'; }

// ========== MULTIPLAYER STATE ==========
let mp = null;
const gameStats = new GameStats('chess');
let playerColor = null; // 'w' or 'b', null until assigned
let isHost = false;
let opponentConnected = false;
let playerName = '';
let opponentName = '';

// ========== GAME STATE ==========
let board = [];
let turn = 'w'; // 'w' = white, 'b' = black
let selected = null;
let validMoves = [];
let gameOver = false;
let moveCount = 0;
let lastMove = null;
let castleRights = { wk: true, wq: true, bk: true, bq: true };
let enPassantTarget = null; // square index
let timerInterval = null;
let seconds = 0;
let promoResolve = null;
let isProcessing = false; // Flag para prevenir cliques duplos

// ========== DOM ==========
const boardEl = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const timerDisplay = document.getElementById('timer-display');
const btnNewGame = document.getElementById('btn-new-game');
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const btnPlayAgain = document.getElementById('btn-play-again');
const promoModal = document.getElementById('promo-modal');
const promoChoices = document.getElementById('promo-choices');
const multiplayerStatus = document.getElementById('multiplayer-status');
const btnCopyLink = document.getElementById('btn-copy-link');
const btnLeaveRoom = document.getElementById('btn-leave-room');
const startOverlay = document.getElementById('start-overlay');
const btnStart = document.getElementById('btn-start');

// ========== MULTIPLAYER SETUP ==========
async function initMultiplayer() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room');

  if (!roomId) {
    // Single player mode - show create room option
    showSinglePlayerUI();
    return;
  }

  // Initialize MultiplayerManager
  mp = new MultiplayerManager('chess', roomId, {
    tableName: 'chess_rooms',
    useGameSpecificChannel: true
  });

  mp.onConnectionChange = (connected) => {
    console.log('Multiplayer connection:', connected ? 'connected' : 'disconnected');
  };

  mp.onError = (error) => {
    showError(error.message);
  };

  const success = await mp.init();
  if (!success) return;

  // Setup player color
  playerColor = mp.myPlayerNumber === 1 ? 'w' : 'b';
  isHost = mp.isHost;
  playerName = mp.myName;
  opponentName = mp.opponentName;

  // Setup event listeners
  mp.on('move', handleOpponentMove);
  mp.on('player_joined', ({ name }) => {
    opponentConnected = true;
    opponentName = name || 'Oponente';
    updateMultiplayerStatus();

    // Host sends current state to new player
    if (isHost) {
      mp.send('game_state', {
        state: serializeGameState(),
        playerColor: 'b'
      });
    }
  });
  mp.on('game_state', ({ state, playerColor: pc }) => {
    if (!isHost) {
      deserializeGameState(state);
      playerColor = pc;
      renderBoard();
      setTurnIndicator();
    }
  });
  mp.on('resign', () => {
    endGame(playerColor === 'w' ? 'win' : 'loss', 'Oponente desistiu!');
  });
  mp.on('draw_offer', () => {
    showDrawOffer();
  });
  mp.on('draw_accept', () => {
    endGame('draw', 'Empate por acordo!');
  });
  mp.on('game_reset', ({ state }) => {
    if (state) deserializeGameState(state);
    init();
  });

  // Update UI
  showMultiplayerUI();
  updateMultiplayerStatus();
}

// Serialize board to compact string
function serializeBoard() {
  return board.join(',');
}

function deserializeBoard(str) {
  return str.split(',').map(Number);
}

// Serialize move for network
function serializeMove(move, promoPiece = null) {
  return {
    from: move.from,
    to: move.to,
    capture: move.capture || false,
    enPassant: move.enPassant || false,
    castle: move.castle || null,
    double: move.double || false,
    promo: move.promo || false,
    promoPiece: promoPiece
  };
}

// Serialize full game state
function serializeGameState() {
  return {
    board: serializeBoard(),
    turn,
    castleRights,
    enPassantTarget,
    moveCount,
    lastMove
  };
}

function deserializeGameState(state) {
  board = deserializeBoard(state.board);
  turn = state.turn;
  castleRights = state.castleRights;
  enPassantTarget = state.enPassantTarget;
  moveCount = state.moveCount;
  lastMove = state.lastMove;
}

async function broadcastMove(move, promoPiece = null) {
  if (!mp) return;

  const moveData = serializeMove(move, promoPiece);

  await mp.send('move', {
    move: moveData,
    gameState: serializeGameState()
  });

  // Also persist to database
  await mp.updateState(serializeGameState(), { last_move_at: new Date().toISOString() });
}

function handleOpponentMove({ move, gameState }) {
  // Apply opponent's move
  const color = pieceColor(board[move.from]);
  const captured = board[move.to] !== 0 || move.enPassant;

  const moveObj = {
    from: move.from,
    to: move.to,
    capture: move.capture,
    enPassant: move.enPassant,
    castle: move.castle,
    double: move.double,
    promo: move.promo
  };

  const result = applyMove(board, moveObj, castleRights, color);
  board = result.board;
  castleRights = result.castleRights;
  enPassantTarget = result.enPassant;
  lastMove = moveObj;

  // Apply promotion if any
  if (move.promo && move.promoPiece) {
    board[move.to] = move.promoPiece;
  }

  moveCount++;

  // Play sound
  if (captured) playSound('capture');
  else playSound('place');

  // Check game status
  const nextColor = enemyColor(color);
  const status = getGameStatus(nextColor);

  if (status) {
    // Convert status from opponent's perspective
    const myStatus = status === 'win' ? 'loss' : status === 'loss' ? 'win' : 'draw';
    endGame(myStatus);
    return;
  }

  turn = nextColor;
  selected = null;
  validMoves = [];
  setTurnIndicator();
  renderBoard();
}

function showSinglePlayerUI() {
  if (multiplayerStatus) {
    multiplayerStatus.innerHTML = `
      <div class="mp-section">
        <button class="btn btn-secondary" id="btn-create-room">
          Criar Sala Multiplayer
        </button>
      </div>
    `;
    document.getElementById('btn-create-room')?.addEventListener('click', createNewRoom);
  }
}

function showMultiplayerUI() {
  if (!multiplayerStatus) return;

  const roomUrl = `${window.location.origin}${window.location.pathname}?room=${mp.roomId}`;
  const colorText = playerColor === 'w' ? 'Brancas' : 'Pretas';
  const colorClass = playerColor === 'w' ? 'white' : 'black';

  multiplayerStatus.innerHTML = `
    <div class="mp-section">
      <div class="mp-header">
        <span class="mp-badge mp-color-${colorClass}">${colorText}</span>
        <span class="mp-status" id="mp-connection-status">
          ${opponentConnected ? 'Oponente conectado' : 'Aguardando oponente...'}
        </span>
      </div>
      <div class="mp-room-info">
        <input type="text" class="mp-room-url" value="${roomUrl}" readonly id="mp-room-url">
        <button class="btn btn-small" id="btn-copy-link">Copiar Link</button>
      </div>
      <div class="mp-actions">
        <button class="btn btn-small btn-secondary" id="btn-offer-draw">Propor Empate</button>
        <button class="btn btn-small btn-danger" id="btn-resign">Desistir</button>
        <button class="btn btn-small" id="btn-leave-room">Sair</button>
      </div>
    </div>
  `;

  // Attach event listeners
  document.getElementById('btn-copy-link')?.addEventListener('click', copyRoomLink);
  document.getElementById('btn-offer-draw')?.addEventListener('click', offerDraw);
  document.getElementById('btn-resign')?.addEventListener('click', resignGame);
  document.getElementById('btn-leave-room')?.addEventListener('click', leaveRoom);
}

function updateMultiplayerStatus() {
  const statusEl = document.getElementById('mp-connection-status');
  if (statusEl) {
    statusEl.textContent = opponentConnected ? `Oponente: ${opponentName}` : 'Aguardando oponente...';
    statusEl.classList.toggle('connected', opponentConnected);
  }
}

async function createNewRoom() {
  const { generateRoomId } = await import('../shared/multiplayer-manager.js');
  const newRoomId = generateRoomId();
  const newUrl = `${window.location.pathname}?room=${newRoomId}`;
  window.history.pushState({}, '', newUrl);
  await initMultiplayer();
}

function copyRoomLink() {
  const urlInput = document.getElementById('mp-room-url');
  if (urlInput) {
    urlInput.select();
    navigator.clipboard.writeText(urlInput.value);
    showToast('Link copiado!');
  }
}

function offerDraw() {
  if (!mp || !opponentConnected) return;

  mp.send('draw_offer', {});
  showToast('Proposta de empate enviada');
}

function showDrawOffer() {
  if (confirm('Oponente propôs empate. Aceitar?')) {
    mp.send('draw_accept', {});
    endGame('draw', 'Empate por acordo!');
  }
}

function resignGame() {
  if (!confirm('Tem certeza que deseja desistir?')) return;

  if (mp) {
    mp.send('resign', {});
  }

  endGame(playerColor === 'w' ? 'loss' : 'win', 'Você desistiu');
}

async function leaveRoom() {
  if (mp) {
    await mp.leave();
  }

  // Redirect to single player
  window.history.pushState({}, '', window.location.pathname);
  location.reload();
}

function showError(msg) {
  alert(msg);
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ========== BOARD SETUP ==========
function initialBoard() {
  return [
    BR, BN, BB, BQ, BK, BB, BN, BR,
    BP, BP, BP, BP, BP, BP, BP, BP,
    0,  0,  0,  0,  0,  0,  0,  0,
    0,  0,  0,  0,  0,  0,  0,  0,
    0,  0,  0,  0,  0,  0,  0,  0,
    0,  0,  0,  0,  0,  0,  0,  0,
    WP, WP, WP, WP, WP, WP, WP, WP,
    WR, WN, WB, WQ, WK, WB, WN, WR,
  ];
}

function rc(idx) { return [Math.floor(idx / 8), idx % 8]; }
function idx(r, c) { return r * 8 + c; }
function onBoard(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

// ========== MOVE GENERATION ==========
function generateMoves(bd, color, castleR, epTarget, onlyCaptures = false) {
  const moves = [];
  const isAlly = color === 'w' ? isWhite : isBlack;
  const isEnemy = color === 'w' ? isBlack : isWhite;
  const pawnDir = color === 'w' ? -1 : 1;
  const startRow = color === 'w' ? 6 : 1;
  const promoRow = color === 'w' ? 0 : 7;

  for (let i = 0; i < 64; i++) {
    const p = bd[i];
    if (!isAlly(p)) continue;
    const [r, c] = rc(i);
    const pType = color === 'w' ? p : p - 6;

    if (pType === 1) { // Pawn
      // Forward
      if (!onlyCaptures) {
        const fwd = idx(r + pawnDir, c);
        if (onBoard(r + pawnDir, c) && bd[fwd] === 0) {
          moves.push({ from: i, to: fwd, promo: r + pawnDir === promoRow });
          // Double
          if (r === startRow) {
            const fwd2 = idx(r + 2 * pawnDir, c);
            if (bd[fwd2] === 0) moves.push({ from: i, to: fwd2, double: true });
          }
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        const nr = r + pawnDir, nc = c + dc;
        if (!onBoard(nr, nc)) continue;
        const ti = idx(nr, nc);
        if (isEnemy(bd[ti])) {
          moves.push({ from: i, to: ti, capture: true, promo: nr === promoRow });
        }
        if (epTarget === ti) {
          moves.push({ from: i, to: ti, capture: true, enPassant: true });
        }
      }
    } else if (pType === 2) { // Knight
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r+dr, nc = c+dc;
        if (!onBoard(nr, nc)) continue;
        const ti = idx(nr, nc);
        if (isAlly(bd[ti])) continue;
        if (onlyCaptures && !isEnemy(bd[ti])) continue;
        moves.push({ from: i, to: ti, capture: isEnemy(bd[ti]) });
      }
    } else if (pType === 3 || pType === 4 || pType === 5) { // Bishop, Rook, Queen
      const dirs = [];
      if (pType === 3 || pType === 5) dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
      if (pType === 4 || pType === 5) dirs.push([-1,0],[1,0],[0,-1],[0,1]);
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (onBoard(nr, nc)) {
          const ti = idx(nr, nc);
          if (isAlly(bd[ti])) break;
          if (isEnemy(bd[ti])) {
            moves.push({ from: i, to: ti, capture: true });
            break;
          }
          if (!onlyCaptures) moves.push({ from: i, to: ti });
          nr += dr; nc += dc;
        }
      }
    } else if (pType === 6) { // King
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = r+dr, nc = c+dc;
        if (!onBoard(nr, nc)) continue;
        const ti = idx(nr, nc);
        if (isAlly(bd[ti])) continue;
        if (onlyCaptures && !isEnemy(bd[ti])) continue;
        moves.push({ from: i, to: ti, capture: isEnemy(bd[ti]) });
      }
      // Castling
      if (!onlyCaptures) {
        const row = color === 'w' ? 7 : 0;
        if (r === row && c === 4) {
          // Kingside
          const ksKey = color === 'w' ? 'wk' : 'bk';
          if (castleR[ksKey] && bd[idx(row,5)] === 0 && bd[idx(row,6)] === 0 &&
              !isSquareAttacked(bd, idx(row,4), enemyColor(color)) &&
              !isSquareAttacked(bd, idx(row,5), enemyColor(color))) {
            moves.push({ from: i, to: idx(row,6), castle: 'k' });
          }
          // Queenside
          const qsKey = color === 'w' ? 'wq' : 'bq';
          if (castleR[qsKey] && bd[idx(row,3)] === 0 && bd[idx(row,2)] === 0 && bd[idx(row,1)] === 0 &&
              !isSquareAttacked(bd, idx(row,4), enemyColor(color)) &&
              !isSquareAttacked(bd, idx(row,3), enemyColor(color))) {
            moves.push({ from: i, to: idx(row,2), castle: 'q' });
          }
        }
      }
    }
  }
  return moves;
}

function isSquareAttacked(bd, sq, byColor) {
  const attacks = generateMoves(bd, byColor, {wk:false,wq:false,bk:false,bq:false}, null, true);
  return attacks.some(m => m.to === sq);
}

function findKing(bd, color) {
  const k = color === 'w' ? WK : BK;
  return bd.indexOf(k);
}

function isInCheck(bd, color) {
  const kPos = findKing(bd, color);
  if (kPos === -1) return true;
  return isSquareAttacked(bd, kPos, enemyColor(color));
}

function applyMove(bd, move, castleR, color) {
  const newBd = [...bd];
  const newCR = { ...castleR };
  let newEP = null;

  const piece = newBd[move.from];
  newBd[move.to] = piece;
  newBd[move.from] = EMPTY;

  // En passant capture
  if (move.enPassant) {
    const capturedRow = color === 'w' ? rc(move.to)[0] + 1 : rc(move.to)[0] - 1;
    newBd[idx(capturedRow, rc(move.to)[1])] = EMPTY;
  }

  // Double pawn push -> set EP target
  if (move.double) {
    const epRow = color === 'w' ? rc(move.from)[0] - 1 : rc(move.from)[0] + 1;
    newEP = idx(epRow, rc(move.from)[1]);
  }

  // Castling
  if (move.castle) {
    const row = rc(move.from)[0];
    if (move.castle === 'k') {
      newBd[idx(row, 5)] = newBd[idx(row, 7)];
      newBd[idx(row, 7)] = EMPTY;
    } else {
      newBd[idx(row, 3)] = newBd[idx(row, 0)];
      newBd[idx(row, 0)] = EMPTY;
    }
  }

  // Update castle rights
  if (piece === WK) { newCR.wk = false; newCR.wq = false; }
  if (piece === BK) { newCR.bk = false; newCR.bq = false; }
  if (move.from === 63 || move.to === 63) newCR.wk = false;
  if (move.from === 56 || move.to === 56) newCR.wq = false;
  if (move.from === 7 || move.to === 7) newCR.bk = false;
  if (move.from === 0 || move.to === 0) newCR.bq = false;

  return { board: newBd, castleRights: newCR, enPassant: newEP };
}

function getLegalMoves(bd, color, castleR, epTarget) {
  const pseudoMoves = generateMoves(bd, color, castleR, epTarget);
  const legal = [];
  for (const m of pseudoMoves) {
    const result = applyMove(bd, m, castleR, color);
    if (!isInCheck(result.board, color)) {
      legal.push(m);
    }
  }
  return legal;
}

// ========== RENDERING ==========
function renderBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < 64; i++) {
    const [r, c] = rc(i);
    const cell = document.createElement('div');
    cell.className = 'cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
    cell.dataset.idx = i;

    if (board[i] !== EMPTY) {
      const pieceSpan = document.createElement('span');
      pieceSpan.textContent = PIECE_SYMBOLS[board[i]];
      // Aplica animação de chegada apenas na peça que acabou de se mover
      if (lastMove && lastMove.to === i) {
        pieceSpan.className = 'piece-anim';
        cell.classList.add('piece-moved');
      }
      cell.appendChild(pieceSpan);
    }

    // Coordenadas: arquivo (a-h) na linha 7, rank (1-8) na coluna 0
    if (r === 7) {
      const fl = document.createElement('span');
      fl.className = 'coord-file';
      fl.textContent = 'abcdefgh'[c];
      cell.appendChild(fl);
    }
    if (c === 0) {
      const rk = document.createElement('span');
      rk.className = 'coord-rank';
      rk.textContent = 8 - r;
      cell.appendChild(rk);
    }

    if (selected === i) cell.classList.add('selected');
    if (lastMove && (lastMove.from === i || lastMove.to === i)) cell.classList.add('last-move');

    const vm = validMoves.find(m => m.to === i);
    if (vm) {
      cell.classList.add(vm.capture ? 'valid-capture' : 'valid-move');
    }

    // Check highlight
    if (board[i] === WK && isInCheck(board, 'w') && turn === 'w') cell.classList.add('in-check');
    if (board[i] === BK && isInCheck(board, 'b') && turn === 'b') cell.classList.add('in-check');

    cell.addEventListener('click', () => onCellClick(i));
    boardEl.appendChild(cell);
  }
}

function setTurnIndicator() {
  const gameContainer = document.querySelector('.game-container') || document.body;
  turnIndicator.classList.remove('player-turn', 'cpu-turn', 'check', 'waiting');

  if (gameOver) {
    gameContainer.classList.remove('thinking');
    return;
  }

  if (mp?.isMultiplayer) {
    // Multiplayer mode
    const isMyTurn = turn === playerColor;
    const myColorText = playerColor === 'w' ? 'Brancas' : 'Pretas';

    if (isMyTurn) {
      const inCheck = isInCheck(board, playerColor);
      turnIndicator.textContent = inCheck ? 'Xeque! Sua vez' : `Sua vez (${myColorText})`;
      turnIndicator.classList.add(inCheck ? 'check' : 'player-turn');
      gameContainer.classList.remove('thinking');
    } else {
      turnIndicator.textContent = `Vez do oponente`;
      turnIndicator.classList.add('cpu-turn');
      gameContainer.classList.add('thinking');
    }
  } else {
    // Single player mode (vs CPU)
    if (turn === 'w') {
      turnIndicator.textContent = isInCheck(board, 'w') ? 'Xeque! Sua vez' : 'Sua vez (Brancas)';
      turnIndicator.classList.add(isInCheck(board, 'w') ? 'check' : 'player-turn');
      gameContainer.classList.remove('thinking');
    } else {
      turnIndicator.textContent = 'Computador pensando...';
      turnIndicator.classList.add('cpu-turn');
      gameContainer.classList.add('thinking');
    }
  }
}

// ========== PLAYER INPUT ==========
async function onCellClick(i) {
  if (gameOver || isProcessing) return;

  // In multiplayer, only allow moves on your turn with your color
  if (mp?.isMultiplayer) {
    if (turn !== playerColor) return; // Not your turn
    const piece = board[i];
    if (selected === null && piece !== EMPTY) {
      const pieceC = pieceColor(piece);
      if (pieceC !== playerColor) return; // Can't select opponent's pieces
    }
  } else {
    // Single player - only white's turn
    if (turn !== 'w') return;
  }

  initAudio();

  // If clicking a valid move destination
  const move = validMoves.find(m => m.to === i);
  if (move) {
    await executePlayerMove(move);
    return;
  }

  // Select own piece
  const myColor = mp?.isMultiplayer ? playerColor : 'w';
  if ((myColor === 'w' && isWhite(board[i])) || (myColor === 'b' && isBlack(board[i]))) {
    selected = i;
    validMoves = getLegalMoves(board, myColor, castleRights, enPassantTarget).filter(m => m.from === i);
    renderBoard();
  } else {
    selected = null;
    validMoves = [];
    renderBoard();
  }
}

async function executePlayerMove(move) {
  if (isProcessing) return;
  isProcessing = true;
  initAudio();

  // Handle promotion
  const myColor = mp?.isMultiplayer ? playerColor : 'w';
  let promoPiece = null;
  if (move.promo) {
    promoPiece = await showPromoModal(myColor);
  }

  doMove(move, promoPiece);
  moveCount++;

  // Broadcast move in multiplayer
  if (mp?.isMultiplayer) {
    await broadcastMove(move, promoPiece);
  }

  const nextColor = enemyColor(myColor);
  const status = getGameStatus(nextColor);

  if (status) {
    endGame(status);
    isProcessing = false;
    return;
  }

  turn = nextColor;
  selected = null;
  validMoves = [];
  setTurnIndicator();
  renderBoard();

  // CPU turn only in single player
  if (!mp?.isMultiplayer) {
    setTimeout(() => cpuTurn(), 800);
  } else {
    isProcessing = false;
  }
}

// ========== MOVE EXECUTION ==========
function doMove(move, promoPiece) {
  const color = pieceColor(board[move.from]);
  const captured = board[move.to] !== 0 || move.enPassant;
  const result = applyMove(board, move, castleRights, color);
  board = result.board;
  castleRights = result.castleRights;
  enPassantTarget = result.enPassant;
  lastMove = move;

  // Play sound: capture or place
  if (captured) playSound('capture');
  else playSound('place');

  // Promotion
  if (move.promo && promoPiece) {
    board[move.to] = promoPiece;
  }
}

// ========== GAME STATUS ==========
function getGameStatus(forColor) {
  const legal = getLegalMoves(board, forColor, castleRights, enPassantTarget);
  if (legal.length === 0) {
    if (isInCheck(board, forColor)) {
      return forColor === 'w' ? 'loss' : 'win';
    }
    return 'draw'; // stalemate
  }
  // Insufficient material check (K vs K)
  const pieces = board.filter(p => p !== 0);
  if (pieces.length === 2) return 'draw';
  return null;
}

// ========== CPU AI ==========
function cpuTurn() {
  if (gameOver) {
    isProcessing = false;
    return;
  }

  const legal = getLegalMoves(board, 'b', castleRights, enPassantTarget);
  if (legal.length === 0) {
    const status = getGameStatus('b');
    endGame(status || 'draw');
    isProcessing = false;
    return;
  }

  const best = minimax(board, 3, -Infinity, Infinity, true, castleRights, enPassantTarget);

  if (best.move) {
    // CPU promotion: always queen
    let promoPiece = null;
    if (best.move.promo) promoPiece = BQ;
    doMove(best.move, promoPiece);
    moveCount++;
  }

  const status = getGameStatus('w');
  if (status) {
    endGame(status);
    isProcessing = false;
    return;
  }

  turn = 'w';
  selected = null;
  validMoves = [];
  setTurnIndicator();
  renderBoard();
  isProcessing = false;
}

// Piece-square tables (simplified)
const PST_PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50,50,50,50,50,50,50,50,
  10,10,20,30,30,20,10,10,
  5, 5,10,25,25,10, 5, 5,
  0, 0, 0,20,20, 0, 0, 0,
  5,-5,-10, 0, 0,-10,-5, 5,
  5,10,10,-20,-20,10,10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20, 0, 0, 0, 0,-20,-40,
  -30, 0,10,15,15,10, 0,-30,
  -30, 5,15,20,20,15, 5,-30,
  -30, 0,15,20,20,15, 0,-30,
  -30, 5,10,15,15,10, 5,-30,
  -40,-20, 0, 5, 5, 0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_KING = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
];

function getPST(piece, sq) {
  const type = isWhite(piece) ? piece : piece - 6;
  const index = isWhite(piece) ? sq : 63 - sq;
  if (type === 1) return PST_PAWN[index];
  if (type === 2) return PST_KNIGHT[index];
  if (type === 6) return PST_KING[index];
  return 0;
}

function evaluate(bd) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = bd[i];
    if (p === 0) continue;
    const val = PIECE_VALUES[p] + getPST(p, i);
    score += isWhite(p) ? -val : val; // Positive = good for black (CPU)
  }
  return score;
}

function minimax(bd, depth, alpha, beta, maximizing, cr, ep) {
  const color = maximizing ? 'b' : 'w';
  const legal = getLegalMoves(bd, color, cr, ep);

  if (legal.length === 0) {
    if (isInCheck(bd, color)) return { score: maximizing ? -99999 : 99999 };
    return { score: 0 };
  }

  if (depth === 0) return { score: evaluate(bd) };

  // Move ordering: captures first
  legal.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));

  let bestMove = legal[0];

  if (maximizing) {
    let maxEval = -Infinity;
    for (const m of legal) {
      const result = applyMove(bd, m, cr, color);
      if (m.promo) result.board[m.to] = color === 'w' ? WQ : BQ;
      const ev = minimax(result.board, depth - 1, alpha, beta, false, result.castleRights, result.enPassant);
      if (ev.score > maxEval) { maxEval = ev.score; bestMove = m; }
      alpha = Math.max(alpha, ev.score);
      if (beta <= alpha) break;
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (const m of legal) {
      const result = applyMove(bd, m, cr, color);
      if (m.promo) result.board[m.to] = color === 'w' ? WQ : BQ;
      const ev = minimax(result.board, depth - 1, alpha, beta, true, result.castleRights, result.enPassant);
      if (ev.score < minEval) { minEval = ev.score; bestMove = m; }
      beta = Math.min(beta, ev.score);
      if (beta <= alpha) break;
    }
    return { score: minEval, move: bestMove };
  }
}

// ========== PROMOTION MODAL ==========
function showPromoModal(color) {
  return new Promise(resolve => {
    promoChoices.innerHTML = '';
    const pieces = color === 'w'
      ? [{ p: WQ, s: '\u2655' }, { p: WR, s: '\u2656' }, { p: WB, s: '\u2657' }, { p: WN, s: '\u2658' }]
      : [{ p: BQ, s: '\u265B' }, { p: BR, s: '\u265C' }, { p: BB, s: '\u265D' }, { p: BN, s: '\u265E' }];
    for (const { p, s } of pieces) {
      const btn = document.createElement('button');
      btn.className = 'promo-btn';
      btn.textContent = s;
      btn.addEventListener('click', () => {
        promoModal.classList.remove('visible');
        resolve(p);
      });
      promoChoices.appendChild(btn);
    }
    promoModal.classList.add('visible');
  });
}

// ========== END GAME ==========
function endGame(result, customMessage = null) {
  gameOver = true;
  clearInterval(timerInterval);
  selected = null;
  validMoves = [];

  if (customMessage) {
    const icon = result === 'win' ? '\uD83C\uDF89' : result === 'loss' ? '\uD83D\uDE1E' : '\uD83E\uDD1D';
    const title = result === 'win' ? 'Vitória!' : result === 'loss' ? 'Derrota!' : 'Empate!';
    turnIndicator.textContent = customMessage;
    showResult(icon, title, customMessage);
    if (result === 'win') {
      launchConfetti();
      playSound('win');
    }
  } else if (result === 'win') {
    turnIndicator.textContent = mp?.isMultiplayer ? 'Vitória!' : 'Xeque-mate! Você venceu!';
    showResult('\uD83C\uDF89', 'Vitória!', mp?.isMultiplayer ? 'Você venceu!' : 'Parabéns, xeque-mate!');
    launchConfetti();
    playSound('win');
  } else if (result === 'loss') {
    turnIndicator.textContent = mp?.isMultiplayer ? 'Derrota!' : 'Xeque-mate! Você perdeu.';
    showResult('\uD83D\uDE1E', 'Derrota!', mp?.isMultiplayer ? 'Você perdeu!' : 'O computador deu xeque-mate.');
  } else {
    turnIndicator.textContent = 'Empate!';
    showResult('\uD83E\uDD1D', 'Empate!', 'O jogo terminou empatado.');
  }

  renderBoard();
  saveGameStat(result);
}

function showResult(icon, title, msg) {
  modalIcon.textContent = icon;
  modalTitle.textContent = title;
  modalMsg.textContent = msg;
  setTimeout(() => modalOverlay.classList.add('visible'), 500);
}

// ========== TIMER ==========
function startTimer() {
  clearInterval(timerInterval);
  seconds = 0;
  timerDisplay.textContent = '00:00';
  timerInterval = setInterval(() => {
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    timerDisplay.textContent = `${m}:${s}`;
  }, 1000);
}

// ========== INIT ==========
function init() {
  debug('Initializing game...');

  // Verificar elementos essenciais
  if (!boardEl) {
    console.error('[Xadrez] Elemento do tabuleiro não encontrado');
    return;
  }

  board = initialBoard();
  turn = 'w';
  selected = null;
  validMoves = [];
  gameOver = false;
  moveCount = 0;
  lastMove = null;
  castleRights = { wk: true, wq: true, bk: true, bq: true };
  enPassantTarget = null;
  isProcessing = false;
  modalOverlay.classList.remove('visible');
  promoModal.classList.remove('visible');
  renderBoard();
  setTurnIndicator();
  startTimer();

  debug('Game initialized successfully');
}

btnNewGame.addEventListener('click', () => {
  initAudio();
  playSound('click');
  if (mp?.isMultiplayer) {
    // In multiplayer, new game resets the room
    if (confirm('Iniciar novo jogo? Isso reiniciará a partida atual.')) {
      init();
      mp.send('game_reset', { state: serializeGameState() });
    }
  } else {
    init();
  }
});

btnPlayAgain.addEventListener('click', () => {
  initAudio();
  playSound('click');
  init();
});

// Start overlay handler
if (btnStart) {
  btnStart.addEventListener('click', () => {
    debug('Start button clicked');
    initAudio();
    playSound('click');
    if (startOverlay) {
      startOverlay.classList.remove('show');
      startOverlay.style.display = 'none';
    }
    init();
  });
}

modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) init(); });

// Listen for game reset in multiplayer
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    initMultiplayer();
  });
}

// ========== STATS ==========
async function saveGameStat(result) {
  if (mp?.isMultiplayer) return; // Don't save stats for multiplayer games

  await gameStats.save({
    result,
    moves: moveCount,
    timeSeconds: seconds
  });
}

// ========== CLEANUP ==========
window.addEventListener('beforeunload', () => {
  if (mp) mp.cleanup();
});

init();
