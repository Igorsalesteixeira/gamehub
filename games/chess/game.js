import '../../auth-check.js';
import { supabase } from '../../supabase.js';
// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

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

// ========== STATE ==========
let board = [];
let turn = 'w'; // player = white
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
  turnIndicator.classList.remove('player-turn', 'cpu-turn', 'check');
  if (gameOver) return;
  if (turn === 'w') {
    turnIndicator.textContent = isInCheck(board, 'w') ? 'Xeque! Sua vez' : 'Sua vez (Brancas)';
    turnIndicator.classList.add(isInCheck(board, 'w') ? 'check' : 'player-turn');
  } else {
    turnIndicator.textContent = 'Pensando...';
    turnIndicator.classList.add('cpu-turn');
  }
}

// ========== PLAYER INPUT ==========
async function onCellClick(i) {
  if (gameOver || turn !== 'w') return;

  // If clicking a valid move destination
  const move = validMoves.find(m => m.to === i);
  if (move) {
    await executePlayerMove(move);
    return;
  }

  // Select own piece
  if (isWhite(board[i])) {
    selected = i;
    validMoves = getLegalMoves(board, 'w', castleRights, enPassantTarget).filter(m => m.from === i);
    renderBoard();
  } else {
    selected = null;
    validMoves = [];
    renderBoard();
  }
}

async function executePlayerMove(move) {
  // Handle promotion
  let promoPiece = null;
  if (move.promo) {
    promoPiece = await showPromoModal('w');
  }

  doMove(move, promoPiece);
  moveCount++;

  const status = getGameStatus('b');
  if (status) { endGame(status); return; }

  turn = 'b';
  selected = null;
  validMoves = [];
  setTurnIndicator();
  renderBoard();

  setTimeout(() => cpuTurn(), 300);
}

// ========== MOVE EXECUTION ==========
function doMove(move, promoPiece) {
  const color = pieceColor(board[move.from]);
  const result = applyMove(board, move, castleRights, color);
  board = result.board;
  castleRights = result.castleRights;
  enPassantTarget = result.enPassant;
  lastMove = move;

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
  if (gameOver) return;

  const legal = getLegalMoves(board, 'b', castleRights, enPassantTarget);
  if (legal.length === 0) {
    const status = getGameStatus('b');
    endGame(status || 'draw');
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
  if (status) { endGame(status); return; }

  turn = 'w';
  selected = null;
  validMoves = [];
  setTurnIndicator();
  renderBoard();
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
function endGame(result) {
  gameOver = true;
  clearInterval(timerInterval);
  selected = null;
  validMoves = [];

  if (result === 'win') {
    turnIndicator.textContent = 'Xeque-mate! Voce venceu!';
    showResult('\uD83C\uDF89', 'Vitoria!', 'Parabens, xeque-mate!');
  } else if (result === 'loss') {
    turnIndicator.textContent = 'Xeque-mate! Voce perdeu.';
    showResult('\uD83D\uDE1E', 'Derrota!', 'O computador deu xeque-mate.');
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
  board = initialBoard();
  turn = 'w';
  selected = null;
  validMoves = [];
  gameOver = false;
  moveCount = 0;
  lastMove = null;
  castleRights = { wk: true, wq: true, bk: true, bq: true };
  enPassantTarget = null;
  modalOverlay.classList.remove('visible');
  promoModal.classList.remove('visible');
  renderBoard();
  setTurnIndicator();
  startTimer();
}

btnNewGame.addEventListener('click', init);
btnPlayAgain.addEventListener('click', init);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) init(); });

// ========== SUPABASE ==========
async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'chess',
      result,
      moves: moveCount,
      time_seconds: seconds,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

init();
