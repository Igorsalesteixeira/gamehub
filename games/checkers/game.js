import '../../auth-check.js';
// Jogo de Dama (Checkers) - Dama Brasileira
// Player = 'player' (dark pieces, bottom), CPU = 'cpu' (orange pieces, top)
import { supabase } from '../../supabase.js';

const BOARD_SIZE = 8;
const PLAYER = 'player';
const CPU = 'cpu';

// ==================== STATE ====================
let board = []; // 8x8 array: null | { owner, king }
let selectedPiece = null; // { row, col }
let validMoves = []; // [{ row, col, captures: [{row,col}] }]
let currentTurn = PLAYER;
let gameOver = false;
let lastMove = null; // { from: {row,col}, to: {row,col} }
let multiCaptureActive = false;
let timerSeconds = 0;
let timerInterval = null;
let timerStarted = false;

// Improvement #2: draw detection
let movesWithoutCapture = 0;
const DRAW_LIMIT = 40;

// Improvement #3: move counter
let moveCount = 0;

// Improvement #9: undo history
let boardHistory = []; // Array of saved states

// Improvement #10: animation tracking
let animMoved = null;   // {row, col} — piece that just arrived
let animCaptured = []; // Array of {row, col} — pieces being captured

// ==================== DOM REFS ====================
const boardEl = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const playerCountEl = document.getElementById('player-count');
const cpuCountEl = document.getElementById('cpu-count');
const btnNewGame = document.getElementById('btn-new-game');
const timerDisplay = document.getElementById('timer-display');
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnUndo = document.getElementById('btn-undo');
const difficultySelect = document.getElementById('difficulty-select');
const tutorialHint = document.getElementById('tutorial-hint');
const hintClose = document.getElementById('hint-close');

let currentDifficulty = difficultySelect ? difficultySelect.value : 'medium';
if (difficultySelect) {
  difficultySelect.addEventListener('change', () => {
    currentDifficulty = difficultySelect.value;
  });
}

// Tutorial hint logic (Game Design - Early Wins)
let hintShown = false;
if (hintClose) {
  hintClose.addEventListener('click', () => {
    if (tutorialHint) tutorialHint.classList.add('hidden');
    localStorage.setItem('checkers_hint_closed', 'true');
  });
}
function showTutorialHint() {
  if (hintShown || localStorage.getItem('checkers_hint_closed')) return;
  if (tutorialHint) tutorialHint.classList.remove('hidden');
  hintShown = true;
}
function hideTutorialHint() {
  if (tutorialHint) tutorialHint.classList.add('hidden');
}

// ==================== SOUND (Improvement #5 + Web Games - Audio Resilience) ====================
let audioCtx = null;
let audioResumed = false;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Web Games: Resume context if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended' && !audioResumed) {
    audioCtx.resume().then(() => { audioResumed = true; }).catch(() => {});
  }
  return audioCtx;
}
function playSound(type) {
  try {
    const ctx = getAudio();
    // Ensure audio context is running
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'select')  { osc.frequency.setValueAtTime(440,now); gain.gain.setValueAtTime(0.08,now); gain.gain.exponentialRampToValueAtTime(0.001,now+0.12); osc.type='sine'; }
    if (type === 'move')    { osc.frequency.setValueAtTime(330,now); osc.frequency.linearRampToValueAtTime(440,now+0.08); gain.gain.setValueAtTime(0.07,now); gain.gain.exponentialRampToValueAtTime(0.001,now+0.12); osc.type='triangle'; }
    if (type === 'capture') { osc.frequency.setValueAtTime(220,now); osc.frequency.linearRampToValueAtTime(110,now+0.15); gain.gain.setValueAtTime(0.15,now); gain.gain.exponentialRampToValueAtTime(0.001,now+0.2); osc.type='sawtooth'; }
    if (type === 'king')    { osc.frequency.setValueAtTime(523,now); osc.frequency.linearRampToValueAtTime(784,now+0.2); gain.gain.setValueAtTime(0.1,now); gain.gain.exponentialRampToValueAtTime(0.001,now+0.4); osc.type='sine'; }
    if (type === 'win')     { osc.frequency.setValueAtTime(523,now); osc.frequency.linearRampToValueAtTime(659,now+0.1); osc.frequency.linearRampToValueAtTime(784,now+0.2); gain.gain.setValueAtTime(0.12,now); gain.gain.exponentialRampToValueAtTime(0.001,now+0.5); osc.type='sine'; }
    if (type === 'lose')    { osc.frequency.setValueAtTime(330,now); osc.frequency.linearRampToValueAtTime(220,now+0.3); gain.gain.setValueAtTime(0.1,now); gain.gain.exponentialRampToValueAtTime(0.001,now+0.4); osc.type='triangle'; }
    osc.start(now); osc.stop(now+0.5);
  } catch(e) {}
}

// ==================== INIT ====================
function initGame() {
  board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      board[r][c] = null;
      if ((r + c) % 2 === 1) {
        if (r < 3) {
          board[r][c] = { owner: CPU, king: false };
        } else if (r > 4) {
          board[r][c] = { owner: PLAYER, king: false };
        }
      }
    }
  }
  selectedPiece = null;
  validMoves = [];
  currentTurn = PLAYER;
  gameOver = false;
  lastMove = null;
  multiCaptureActive = false;
  movesWithoutCapture = 0;
  moveCount = 0;
  boardHistory = [];
  animMoved = null;
  animCaptured = [];
  stopTimer();
  timerStarted = false;
  timerSeconds = 0;
  if (timerDisplay) timerDisplay.textContent = '00:00';
  modalOverlay.classList.add('hidden');
  updateUndoButton();
  render();
  updateTurnIndicator();
  updateCounts();
}

// ==================== RENDER ====================
function render() {
  // Compute forced-capture info before building DOM
  const allMoves = currentTurn === PLAYER ? getAllMoves(PLAYER, board) : [];
  const hasForced = allMoves.length > 0 && allMoves[0].chain[0].captures.length > 0;

  boardEl.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Last move highlights
      if (lastMove) {
        if (lastMove.from.row === r && lastMove.from.col === c) cell.classList.add('last-from');
        if (lastMove.to.row === r && lastMove.to.col === c) cell.classList.add('last-to');
      }

      // Valid move highlights
      const moveMatch = validMoves.find(m => m.row === r && m.col === c);
      if (moveMatch) {
        if (moveMatch.captures && moveMatch.captures.length > 0) {
          cell.classList.add('valid-capture');
        } else {
          cell.classList.add('valid-move');
        }
      }

      // Piece
      const piece = board[r][c];
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = 'piece ' + piece.owner;
        if (piece.king) pieceEl.classList.add('king');
        if (selectedPiece && selectedPiece.row === r && selectedPiece.col === c) {
          pieceEl.classList.add('selected');
        }

        // Improvement #7: must-capture highlight
        if (!gameOver && hasForced && piece.owner === PLAYER) {
          const canCapture = allMoves.some(m => m.from.row === r && m.from.col === c);
          if (canCapture) {
            pieceEl.classList.add('must-capture');
            // Game Design: Show tutorial hint for new players
            showTutorialHint();
          }
        }

        // Improvement #10: appear animation + king promotion flash
        if (animMoved && animMoved.row === r && animMoved.col === c) {
          pieceEl.classList.add('appear');
          if (animMoved.isPromotion) {
            pieceEl.classList.add('king-promoted');
          }
        }

        // Animation for captured pieces (fading out)
        const isCaptured = animCaptured.some(cap => cap.row === r && cap.col === c);
        if (isCaptured) {
          pieceEl.classList.add('captured-anim');
        }

        cell.appendChild(pieceEl);
      }

      // Click handler
      cell.addEventListener('click', () => onCellClick(r, c));
      cell.addEventListener('touchend', (e) => {
        e.preventDefault();
        onCellClick(r, c);
      });

      boardEl.appendChild(cell);
    }
  }

  // Clear animation state after render so next render is clean
  animMoved = null;
  animCaptured = [];
}

function updateTurnIndicator() {
  if (gameOver) {
    turnIndicator.textContent = 'Fim de jogo';
    turnIndicator.className = 'turn-indicator';
    return;
  }

  // Draw warning
  if (movesWithoutCapture >= 30 && currentTurn === PLAYER) {
    const remaining = DRAW_LIMIT - movesWithoutCapture;
    turnIndicator.textContent = `⚠️ Empate em ${remaining} movimento${remaining !== 1 ? 's' : ''}`;
    turnIndicator.className = 'turn-indicator draw-warning';
    return;
  }

  if (currentTurn === PLAYER) {
    turnIndicator.textContent = 'Sua vez';
    turnIndicator.className = 'turn-indicator player-turn';
  } else {
    turnIndicator.textContent = 'Vez do computador...';
    turnIndicator.className = 'turn-indicator cpu-turn';
  }
}

function updateCounts() {
  let pCount = 0, cCount = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]) {
        if (board[r][c].owner === PLAYER) pCount++;
        else cCount++;
      }
    }
  }
  playerCountEl.textContent = pCount;
  cpuCountEl.textContent = cCount;
}

function updateUndoButton() {
  if (btnUndo) {
    btnUndo.disabled = boardHistory.length === 0 || gameOver || currentTurn !== PLAYER;
  }
}

// ==================== MOVE LOGIC ====================

// Improvement #1: Flying kings
function getMovesForPiece(r, c, boardState) {
  const piece = boardState[r][c];
  if (!piece) return { simple: [], captures: [] };
  const simple = [], captures = [];
  const allDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];

  if (!piece.king) {
    // Regular piece: 1-step forward, 1-jump capture in all directions
    const moveDirs = piece.owner === PLAYER ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
    for (const [dr,dc] of allDirs) {
      const nr = r+dr, nc = c+dc;
      if (nr<0||nr>=BOARD_SIZE||nc<0||nc>=BOARD_SIZE) continue;
      if (!boardState[nr][nc]) {
        if (moveDirs.some(d => d[0]===dr && d[1]===dc)) simple.push({row:nr,col:nc,captures:[]});
      } else if (boardState[nr][nc].owner !== piece.owner) {
        const jr = nr+dr, jc = nc+dc;
        if (jr>=0&&jr<BOARD_SIZE&&jc>=0&&jc<BOARD_SIZE&&!boardState[jr][jc])
          captures.push({row:jr,col:jc,captures:[{row:nr,col:nc}]});
      }
    }
  } else {
    // Flying king: slide any distance
    for (const [dr,dc] of allDirs) {
      let nr = r+dr, nc = c+dc;
      let foundEnemy = null;
      while (nr>=0&&nr<BOARD_SIZE&&nc>=0&&nc<BOARD_SIZE) {
        const cell = boardState[nr][nc];
        if (!cell) {
          if (foundEnemy) captures.push({row:nr,col:nc,captures:[foundEnemy]});
          else simple.push({row:nr,col:nc,captures:[]});
        } else if (cell.owner !== piece.owner) {
          if (foundEnemy) break; // second enemy in same ray — stop
          foundEnemy = {row:nr,col:nc};
        } else {
          break; // own piece
        }
        nr+=dr; nc+=dc;
      }
    }
  }
  return {simple, captures};
}

// Get all capture chains starting from (r,c) using DFS
function getCaptureChains(r, c, boardState, piece) {
  const { captures } = getMovesForPiece(r, c, boardState);
  if (captures.length === 0) return [];

  const chains = [];
  for (const cap of captures) {
    const newBoard = cloneBoard(boardState);
    newBoard[cap.row][cap.col] = { ...piece };
    newBoard[r][c] = null;
    newBoard[cap.captures[0].row][cap.captures[0].col] = null;

    // Check promotion
    let promoted = false;
    if (!piece.king) {
      if ((piece.owner === PLAYER && cap.row === 0) || (piece.owner === CPU && cap.row === BOARD_SIZE - 1)) {
        newBoard[cap.row][cap.col].king = true;
        promoted = true;
      }
    }

    // In Brazilian Draughts, promotion stops the multi-capture
    if (promoted) {
      chains.push([{ row: cap.row, col: cap.col, captures: [...cap.captures] }]);
      continue;
    }

    const subChains = getCaptureChains(cap.row, cap.col, newBoard, newBoard[cap.row][cap.col]);
    if (subChains.length === 0) {
      chains.push([{ row: cap.row, col: cap.col, captures: [...cap.captures] }]);
    } else {
      for (const sub of subChains) {
        chains.push([{ row: cap.row, col: cap.col, captures: [...cap.captures] }, ...sub]);
      }
    }
  }
  return chains;
}

function cloneBoard(b) {
  return b.map(row => row.map(cell => cell ? { ...cell } : null));
}

// Get all valid moves for a player, enforcing mandatory capture
function getAllMoves(owner, boardState) {
  const allCaptures = [];
  const allSimple = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!boardState[r][c] || boardState[r][c].owner !== owner) continue;
      const chains = getCaptureChains(r, c, boardState, boardState[r][c]);
      if (chains.length > 0) {
        for (const chain of chains) {
          allCaptures.push({ from: { row: r, col: c }, chain });
        }
      } else {
        const { simple } = getMovesForPiece(r, c, boardState);
        for (const m of simple) {
          allSimple.push({ from: { row: r, col: c }, chain: [m] });
        }
      }
    }
  }

  // Mandatory capture: if captures exist, must capture
  if (allCaptures.length > 0) {
    // Brazilian rule: must take the longest capture chain
    const maxLen = Math.max(...allCaptures.map(m => m.chain.length));
    return allCaptures.filter(m => m.chain.length === maxLen);
  }
  return allSimple;
}

// Get valid destinations for a specific piece (for UI highlighting)
function getValidMovesForPiece(r, c) {
  const piece = board[r][c];
  if (!piece || piece.owner !== currentTurn) return [];

  const allMoves = getAllMoves(currentTurn, board);
  const forPiece = allMoves.filter(m => m.from.row === r && m.from.col === c);

  return forPiece.map(m => ({
    row: m.chain[0].row,
    col: m.chain[0].col,
    captures: m.chain[0].captures,
    fullChain: m.chain
  }));
}

// ==================== UNDO (Improvement #9) ====================

function saveHistory() {
  const snapshot = {
    board: cloneBoard(board),
    turn: currentTurn,
    movesWithoutCapture,
    moveCount,
    lastMove: lastMove ? { from: { ...lastMove.from }, to: { ...lastMove.to } } : null,
  };
  boardHistory.push(snapshot);
  if (boardHistory.length > 10) boardHistory.shift();
}

function undoMove() {
  if (boardHistory.length === 0 || gameOver || currentTurn !== PLAYER) return;
  const snap = boardHistory.pop();
  board = snap.board;
  currentTurn = snap.turn;
  movesWithoutCapture = snap.movesWithoutCapture;
  moveCount = snap.moveCount;
  lastMove = snap.lastMove;
  selectedPiece = null;
  validMoves = [];
  multiCaptureActive = false;
  animMoved = null;
  animCaptured = [];
  updateUndoButton();
  render();
  updateTurnIndicator();
  updateCounts();
}

// ==================== CLICK HANDLER ====================

function onCellClick(r, c) {
  if (gameOver || currentTurn !== PLAYER) return;

  // Start timer on first player action
  if (!timerStarted) {
    timerStarted = true;
    startTimer();
  }

  // If clicking on a valid move destination
  const moveTarget = validMoves.find(m => m.row === r && m.col === c);
  if (moveTarget) {
    executePlayerMove(selectedPiece.row, selectedPiece.col, moveTarget);
    return;
  }

  // If clicking on own piece, select it
  const piece = board[r][c];
  if (piece && piece.owner === PLAYER && !multiCaptureActive) {
    const moves = getValidMovesForPiece(r, c);
    if (moves.length > 0) {
      selectedPiece = { row: r, col: c };
      validMoves = moves;
      playSound('select');
      render();
    } else {
      selectedPiece = null;
      validMoves = [];
      render();
    }
    return;
  }

  // Clicking on empty/enemy: deselect
  if (!multiCaptureActive) {
    selectedPiece = null;
    validMoves = [];
    render();
  }
}

function executePlayerMove(fromR, fromC, moveTarget) {
  // Save history before executing (Improvement #9)
  saveHistory();

  const chain = moveTarget.fullChain;
  moveCount++; // Improvement #3

  executeMoveChain(fromR, fromC, chain, PLAYER, () => {
    selectedPiece = null;
    validMoves = [];
    multiCaptureActive = false;
    updateCounts();

    // Improvement #2: draw detection (counted inside executeMoveChain)
    if (movesWithoutCapture >= DRAW_LIMIT) {
      endGame('draw');
      return;
    }

    if (checkGameOver()) return;

    currentTurn = CPU;
    updateUndoButton();
    updateTurnIndicator();
    render();

    setTimeout(() => {
      cpuTurn();
    }, 500);
  });
}

function executeMoveChain(fromR, fromC, chain, owner, callback, stepIndex = 0) {
  if (stepIndex === 0) {
    // Count captures across whole chain for draw tracking (Improvement #2)
    const totalCaptures = chain.reduce((sum, step) => sum + step.captures.length, 0);
    if (totalCaptures > 0) {
      movesWithoutCapture = 0;
      // Play capture sound
      playSound('capture');
      // 2D Games: Screen shake for impact feedback
      const boardContainer = document.querySelector('.board-container');
      if (boardContainer) {
        boardContainer.classList.add('capturing');
        setTimeout(() => boardContainer.classList.remove('capturing'), 200);
      }
    } else {
      movesWithoutCapture++;
      playSound('move');
    }
  }

  if (stepIndex >= chain.length) {
    callback();
    return;
  }

  const step = chain[stepIndex];
  const piece = board[fromR][fromC];

  // Track captured pieces for animation (Improvement #10)
  animCaptured = step.captures.map(cap => ({ row: cap.row, col: cap.col }));

  // Remove captured pieces
  for (const cap of step.captures) {
    board[cap.row][cap.col] = null;
  }

  // Move piece
  board[step.row][step.col] = piece;
  board[fromR][fromC] = null;

  // Check promotion
  let promoted = false;
  if (!piece.king) {
    if ((piece.owner === PLAYER && step.row === 0) || (piece.owner === CPU && step.row === BOARD_SIZE - 1)) {
      piece.king = true;
      promoted = true;
    }
  }

  if (promoted) {
    playSound('king');
    // 2D Games: Visual feedback for king promotion
    animMoved = { row: step.row, col: step.col, isPromotion: true };
  }

  lastMove = { from: { row: fromR, col: fromC }, to: { row: step.row, col: step.col } };
  animMoved = { row: step.row, col: step.col }; // Improvement #10

  updateCounts();
  render();

  if (stepIndex < chain.length - 1) {
    setTimeout(() => {
      executeMoveChain(step.row, step.col, chain, owner, callback, stepIndex + 1);
    }, 300);
  } else {
    // After CPU move, save history so player can undo
    if (owner === CPU) {
      saveHistory();
      updateUndoButton();
    }
    callback();
  }
}

// ==================== CPU AI ====================

function cpuTurn() {
  if (gameOver) return;

  const moves = getAllMoves(CPU, board);
  if (moves.length === 0) {
    endGame(PLAYER);
    return;
  }

  let chosen;
  if (currentDifficulty === 'easy') {
    chosen = cpuTurnEasy(moves);
  } else if (currentDifficulty === 'hard') {
    chosen = cpuTurnHard(moves);
  } else {
    chosen = cpuTurnMedium(moves);
  }

  executeMoveChain(chosen.from.row, chosen.from.col, chosen.chain, CPU, () => {
    selectedPiece = null;
    validMoves = [];
    updateCounts();

    // Improvement #2: draw check after CPU move
    if (movesWithoutCapture >= DRAW_LIMIT) {
      endGame('draw');
      return;
    }

    if (checkGameOver()) return;

    currentTurn = PLAYER;
    updateUndoButton();
    updateTurnIndicator();
    render();
  });
}

// Improvement #4: Easy — random move
function cpuTurnEasy(moves) {
  return moves[Math.floor(Math.random() * moves.length)];
}

// Improvement #4: Medium — existing greedy scoring
function cpuTurnMedium(moves) {
  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of moves) {
    let score = 0;
    const chain = move.chain;
    const from = move.from;

    let totalCaptures = 0;
    for (const step of chain) totalCaptures += step.captures.length;
    score += totalCaptures * 100;

    const dest = chain[chain.length - 1];
    score += dest.row * 3;

    const centerDist = Math.abs(dest.col - 3.5);
    score += (4 - centerDist) * 2;

    const piece = board[from.row][from.col];
    if (!piece.king && dest.row === BOARD_SIZE - 1) score += 50;
    if (dest.col === 0 || dest.col === BOARD_SIZE - 1) score += 1;

    const simBoard = cloneBoard(board);
    simBoard[from.row][from.col] = null;
    for (const step of chain) {
      for (const cap of step.captures) simBoard[cap.row][cap.col] = null;
    }
    simBoard[dest.row][dest.col] = { ...piece };
    if (!piece.king && dest.row === BOARD_SIZE - 1) simBoard[dest.row][dest.col].king = true;

    const opponentMoves = getAllMoves(PLAYER, simBoard);
    const opponentCaptures = opponentMoves.filter(m => m.chain[0].captures.length > 0);
    if (opponentCaptures.length > 0) {
      for (const om of opponentCaptures) {
        for (const step of om.chain) {
          for (const cap of step.captures) {
            if (cap.row === dest.row && cap.col === dest.col) score -= 60;
          }
        }
      }
    }

    if (piece.king) score += 5;
    score += Math.random() * 8;

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// Improvement #8: Minimax AI (Hard)

function evalBoard(b) {
  let score = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = b[r][c];
      if (!piece) continue;
      const isCenter = (c >= 2 && c <= 5);
      if (piece.owner === CPU) {
        score += piece.king ? 20 : 10;
        score += r * 1; // further down (closer to promotion) = better for CPU
        if (isCenter) score += 0.5;
        if (piece.king && isCenter) score += 2;
      } else {
        score -= piece.king ? 20 : 10;
        score -= (BOARD_SIZE - 1 - r) * 1; // further up (closer to promotion) = better for player
        if (isCenter) score -= 0.5;
        if (piece.king && isCenter) score -= 2;
      }
    }
  }
  return score;
}

function applyMove(boardState, move, owner) {
  const nb = cloneBoard(boardState);
  let fr = move.from.row, fc = move.from.col;
  const piece = nb[fr][fc];
  for (const step of move.chain) {
    for (const cap of step.captures) nb[cap.row][cap.col] = null;
    nb[step.row][step.col] = { ...piece };
    nb[fr][fc] = null;
    if (!piece.king) {
      if ((owner === PLAYER && step.row === 0) || (owner === CPU && step.row === BOARD_SIZE - 1)) {
        nb[step.row][step.col].king = true;
      }
    }
    fr = step.row; fc = step.col;
  }
  return nb;
}

function minimaxScore(boardState, depth, alpha, beta, isMaximizing) {
  const cpuMoves = getAllMoves(CPU, boardState);
  const plrMoves = getAllMoves(PLAYER, boardState);
  if (cpuMoves.length === 0) return -1000;
  if (plrMoves.length === 0) return 1000;
  if (depth === 0) return evalBoard(boardState);

  if (isMaximizing) {
    let best = -Infinity;
    for (const move of cpuMoves) {
      const nb = applyMove(boardState, move, CPU);
      best = Math.max(best, minimaxScore(nb, depth-1, alpha, beta, false));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of plrMoves) {
      const nb = applyMove(boardState, move, PLAYER);
      best = Math.min(best, minimaxScore(nb, depth-1, alpha, beta, true));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function cpuTurnHard(moves) {
  const DEPTH = 4;
  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    const nb = applyMove(board, move, CPU);
    const score = minimaxScore(nb, DEPTH - 1, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

// ==================== GAME OVER ====================

function checkGameOver() {
  let playerPieces = 0, cpuPieces = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c]) {
        if (board[r][c].owner === PLAYER) playerPieces++;
        else cpuPieces++;
      }
    }
  }

  if (playerPieces === 0) { endGame(CPU); return true; }
  if (cpuPieces === 0) { endGame(PLAYER); return true; }

  const nextPlayer = currentTurn === PLAYER ? CPU : PLAYER;
  const nextMoves = getAllMoves(nextPlayer, board);
  if (nextMoves.length === 0) {
    endGame(currentTurn === PLAYER ? PLAYER : CPU);
    return true;
  }

  return false;
}

function endGame(winner) {
  gameOver = true;
  stopTimer();
  updateTurnIndicator();
  updateUndoButton();

  // Determine result string: winner can be PLAYER, CPU, or 'draw'
  let result;
  if (winner === PLAYER) result = 'win';
  else if (winner === CPU) result = 'loss';
  else result = 'draw';

  saveGameStat(result);

  if (winner === PLAYER) {
    modalIcon.innerHTML = '&#127942;';
    modalTitle.textContent = 'Voce venceu!';
    modalTitle.style.color = '#4caf50';
    modalMsg.textContent = 'Parabens! Voce derrotou o computador!';
    playSound('win');
  } else if (winner === CPU) {
    modalIcon.innerHTML = '&#128546;';
    modalTitle.textContent = 'Voce perdeu!';
    modalTitle.style.color = '#e94560';
    modalMsg.textContent = 'O computador venceu desta vez. Tente novamente!';
    playSound('lose');
  } else {
    modalIcon.innerHTML = '&#129309;';
    modalTitle.textContent = 'Empate!';
    modalTitle.style.color = '#ff9800';
    modalMsg.textContent = 'Nenhum jogador conseguiu vencer (40 movimentos sem captura).';
  }

  modalOverlay.classList.remove('hidden');
}

// ==================== TIMER ====================

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    timerSeconds++;
    if (timerDisplay) {
      const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
      const s = (timerSeconds % 60).toString().padStart(2, '0');
      timerDisplay.textContent = `${m}:${s}`;
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// Improvement #6: Pause timer on tab switch
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopTimer();
  } else if (timerStarted && !gameOver) {
    startTimer();
  }
});

// ==================== STATS — Supabase ====================

async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'checkers',
      result,
      moves: moveCount,
      time_seconds: timerSeconds,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// ==================== EVENTS ====================

btnNewGame.addEventListener('click', initGame);
btnPlayAgain.addEventListener('click', initGame);
if (btnUndo) btnUndo.addEventListener('click', undoMove);

// ==================== START ====================
initGame();
