import '../../auth-check.js';
// Jogo de Dama (Checkers) - Dama Brasileira
// Player = 'player' (dark pieces, bottom), CPU = 'cpu' (orange pieces, top)
import { supabase } from '../../supabase.js';

const BOARD_SIZE = 8;
const PLAYER = 'player';
const CPU = 'cpu';

// State
let board = []; // 8x8 array: null | { owner, king }
let selectedPiece = null; // { row, col }
let validMoves = []; // [{ row, col, captures: [{row,col}] }]
let currentTurn = PLAYER;
let gameOver = false;
let lastMove = null; // { from: {row,col}, to: {row,col} }
let multiCaptureActive = false; // true during a multi-capture sequence
let timerSeconds = 0;
let timerInterval = null;
let timerStarted = false;

// DOM refs
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

// ==================== INIT ====================
function initGame() {
  board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      board[r][c] = null;
      // Dark squares only (where (r+c) is odd)
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
  stopTimer();
  timerStarted = false;
  timerSeconds = 0;
  if (timerDisplay) timerDisplay.textContent = '00:00';
  modalOverlay.classList.add('hidden');
  render();
  updateTurnIndicator();
  updateCounts();
}

// ==================== RENDER ====================
function render() {
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
}

function updateTurnIndicator() {
  if (gameOver) {
    turnIndicator.textContent = 'Fim de jogo';
    turnIndicator.className = 'turn-indicator';
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

// ==================== MOVE LOGIC ====================

function getMovesForPiece(r, c, boardState) {
  const piece = boardState[r][c];
  if (!piece) return { simple: [], captures: [] };

  const dirs = [];
  if (piece.owner === PLAYER || piece.king) {
    dirs.push([-1, -1], [-1, 1]); // up
  }
  if (piece.owner === CPU || piece.king) {
    dirs.push([1, -1], [1, 1]); // down
  }

  const simple = [];
  const captures = [];

  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;

    if (!boardState[nr][nc]) {
      // Simple move
      simple.push({ row: nr, col: nc, captures: [] });
    } else if (boardState[nr][nc].owner !== piece.owner) {
      // Potential capture
      const jr = nr + dr;
      const jc = nc + dc;
      if (jr >= 0 && jr < BOARD_SIZE && jc >= 0 && jc < BOARD_SIZE && !boardState[jr][jc]) {
        captures.push({ row: jr, col: jc, captures: [{ row: nr, col: nc }] });
      }
    }
  }

  return { simple, captures };
}

// Get all capture chains starting from (r,c) using DFS
function getCaptureChains(r, c, boardState, piece) {
  const { captures } = getMovesForPiece(r, c, boardState);
  if (captures.length === 0) return [];

  const chains = [];
  for (const cap of captures) {
    // Simulate capture
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

    // Continue capturing from new position
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

  // Return first step destinations
  return forPiece.map(m => ({
    row: m.chain[0].row,
    col: m.chain[0].col,
    captures: m.chain[0].captures,
    fullChain: m.chain
  }));
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
      render();
    } else {
      // Piece has no valid moves; check if there are forced captures elsewhere
      selectedPiece = null;
      validMoves = [];
      render();
    }
    return;
  }

  // Clicking on empty/enemy: deselect (only if no multi-capture active)
  if (!multiCaptureActive) {
    selectedPiece = null;
    validMoves = [];
    render();
  }
}

function executePlayerMove(fromR, fromC, moveTarget) {
  const chain = moveTarget.fullChain;
  executeMoveChain(fromR, fromC, chain, () => {
    selectedPiece = null;
    validMoves = [];
    multiCaptureActive = false;
    updateCounts();

    if (checkGameOver()) return;

    currentTurn = CPU;
    updateTurnIndicator();
    render();

    // CPU plays after a delay
    setTimeout(() => {
      cpuTurn();
    }, 500);
  });
}

function executeMoveChain(fromR, fromC, chain, callback, stepIndex = 0) {
  if (stepIndex >= chain.length) {
    callback();
    return;
  }

  const step = chain[stepIndex];
  const piece = board[fromR][fromC];

  // Remove captured pieces
  for (const cap of step.captures) {
    board[cap.row][cap.col] = null;
  }

  // Move piece
  board[step.row][step.col] = piece;
  board[fromR][fromC] = null;

  // Check promotion
  if (!piece.king) {
    if ((piece.owner === PLAYER && step.row === 0) || (piece.owner === CPU && step.row === BOARD_SIZE - 1)) {
      piece.king = true;
    }
  }

  lastMove = { from: { row: fromR, col: fromC }, to: { row: step.row, col: step.col } };
  updateCounts();
  render();

  if (stepIndex < chain.length - 1) {
    // Multi-step capture: animate each step with delay
    setTimeout(() => {
      executeMoveChain(step.row, step.col, chain, callback, stepIndex + 1);
    }, 300);
  } else {
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

  // Score each move
  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of moves) {
    let score = 0;
    const chain = move.chain;
    const from = move.from;

    // Count total captures
    let totalCaptures = 0;
    for (const step of chain) {
      totalCaptures += step.captures.length;
    }
    score += totalCaptures * 100;

    // Destination (final position in chain)
    const dest = chain[chain.length - 1];

    // Prefer advancing pieces (higher row = closer to promotion for CPU)
    score += dest.row * 3;

    // Prefer center columns
    const centerDist = Math.abs(dest.col - 3.5);
    score += (4 - centerDist) * 2;

    // Check if piece becomes king
    const piece = board[from.row][from.col];
    if (!piece.king && dest.row === BOARD_SIZE - 1) {
      score += 50;
    }

    // Avoid edges slightly less (can't be captured from both sides on edges though)
    if (dest.col === 0 || dest.col === BOARD_SIZE - 1) {
      score += 1; // Edges are somewhat safe
    }

    // Penalize if landing next to a player piece that can capture us
    // Simple check: is there a player piece that could jump over us?
    const simBoard = cloneBoard(board);
    // Simulate the move
    simBoard[from.row][from.col] = null;
    for (const step of chain) {
      for (const cap of step.captures) {
        simBoard[cap.row][cap.col] = null;
      }
    }
    simBoard[dest.row][dest.col] = { ...piece };
    if (!piece.king && dest.row === BOARD_SIZE - 1) simBoard[dest.row][dest.col].king = true;

    // Check if opponent can capture after this move
    const opponentMoves = getAllMoves(PLAYER, simBoard);
    const opponentCaptures = opponentMoves.filter(m => m.chain[0].captures.length > 0);
    if (opponentCaptures.length > 0) {
      // Check if our piece specifically is at risk
      for (const om of opponentCaptures) {
        for (const step of om.chain) {
          for (const cap of step.captures) {
            if (cap.row === dest.row && cap.col === dest.col) {
              score -= 60;
            }
          }
        }
      }
    }

    // Kings are more valuable to keep safe
    if (piece.king) {
      score += 5;
    }

    // Add some randomness to avoid predictability
    score += Math.random() * 8;

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];

  executeMoveChain(chosen.from.row, chosen.from.col, chosen.chain, () => {
    selectedPiece = null;
    validMoves = [];
    updateCounts();

    if (checkGameOver()) return;

    currentTurn = PLAYER;
    updateTurnIndicator();
    render();
  });
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

  // Check if current player can move
  const nextPlayer = currentTurn === PLAYER ? CPU : PLAYER;
  const nextMoves = getAllMoves(nextPlayer, board);
  if (nextMoves.length === 0) {
    // The next player is blocked
    endGame(currentTurn === PLAYER ? PLAYER : CPU);
    return true;
  }

  // Also check if current turn player has no moves (edge case)
  // This would be handled by the player/CPU turn logic already
  return false;
}

function endGame(winner) {
  gameOver = true;
  stopTimer();
  updateTurnIndicator();
  const result = winner === PLAYER ? 'win' : winner === CPU ? 'loss' : 'draw';
  saveGameStat(result);

  if (winner === PLAYER) {
    modalIcon.innerHTML = '&#127942;';
    modalTitle.textContent = 'Voce venceu!';
    modalTitle.style.color = '#4caf50';
    modalMsg.textContent = 'Parabens! Voce derrotou o computador!';
  } else if (winner === CPU) {
    modalIcon.innerHTML = '&#128546;';
    modalTitle.textContent = 'Voce perdeu!';
    modalTitle.style.color = '#e94560';
    modalMsg.textContent = 'O computador venceu desta vez. Tente novamente!';
  } else {
    modalIcon.innerHTML = '&#129309;';
    modalTitle.textContent = 'Empate!';
    modalTitle.style.color = '#ff9800';
    modalMsg.textContent = 'Nenhum jogador conseguiu vencer.';
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

// ==================== STATS — Supabase ====================

async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'checkers',
      result,
      moves: 0,
      time_seconds: timerSeconds,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// ==================== EVENTS ====================

btnNewGame.addEventListener('click', initGame);
btnPlayAgain.addEventListener('click', initGame);

// ==================== START ====================
initGame();
