import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';
import { MultiplayerManager, GameStats } from '../shared/multiplayer-manager.js';

// ===== Jogo de Dama (Checkers) - Dama Brasileira =====
// Player = 'player' (pecas escuras, baixo), CPU = 'cpu' (pecas vermelhas, cima)
// Multiplayer: Jogador 1 = 'player' (pecas escuras), Jogador 2 = 'cpu' (pecas vermelhas)

const BOARD_SIZE = 8;
const PLAYER = 'player';
const CPU = 'cpu';

// === Deteccao de Multiplayer ===
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
const IS_MULTIPLAYER = !!ROOM_ID;

// ==================== ESTADO DO JOGO ====================
let board = []; // Array 8x8: null | { owner, king }
let selectedPiece = null; // { row, col }
let validMoves = []; // [{ row, col, captures: [{row,col}] }]
let currentTurn = PLAYER;
let gameOver = false;
let lastMove = null; // { from: {row,col}, to: {row,col} }
let multiCaptureActive = false;
let timerSeconds = 0;
let timerInterval = null;
let timerStarted = false;
let isProcessing = false; // Flag para prevenir cliques duplos durante animacao

// === Variaveis para navegacao por teclado ===
let focusedCell = null; // { row, col } - celula com foco do teclado
let keyboardMode = false; // Se esta usando navegacao por teclado

// Melhoria #2: deteccao de empate
let movesWithoutCapture = 0;
const DRAW_LIMIT = 40;

// Melhoria #3: contador de jogadas
let moveCount = 0;

// Melhoria #9: historico para desfazer
let boardHistory = []; // Array de estados salvos

// Melhoria #10: rastreamento de animacao
let animMoved = null;   // {row, col} — peca que acabou de chegar
let animCaptured = []; // Array de {row, col} — pecas sendo capturadas

// === Estado do Multiplayer ===
let mp = null;
const gameStats = new GameStats('checkers');
let myUserId = null;
let myPlayerNumber = null; // 1 ou 2
let isMyTurn = true;
let roomData = null;
let player1Name = 'Jogador 1';
let player2Name = 'Jogador 2';
let opponentDisconnected = false;

// ==================== REFERENCIAS DOM ====================
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
const modeIndicator = document.getElementById('mode-indicator');
const connectionStatus = document.getElementById('connection-status');

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

// ==================== MULTIPLAYER ====================

async function initMultiplayer() {
  if (!IS_MULTIPLAYER) return;

  // Initialize MultiplayerManager
  mp = new MultiplayerManager('checkers', ROOM_ID, {
    tableName: 'game_rooms'
  });

  mp.onConnectionChange = (connected) => {
    console.log('Multiplayer connection:', connected ? 'connected' : 'disconnected');
  };

  mp.onError = (error) => {
    alert(error.message);
    window.location.href = '/multiplayer.html';
  };

  const success = await mp.init();
  if (!success) return;

  myUserId = mp.myUserId;
  myPlayerNumber = mp.myPlayerNumber;
  isMyTurn = roomData?.turn === myPlayerNumber;
  roomData = mp.roomData;

  // Update UI
  if (modeIndicator) {
    modeIndicator.textContent = '👥 Multiplayer';
    modeIndicator.classList.add('multiplayer-mode');
  }
  if (difficultySelect) difficultySelect.style.display = 'none';

  // Get player names
  player1Name = roomData?.player1_name || 'Jogador 1';
  player2Name = roomData?.player2_name || 'Jogador 2';

  // Restore game state if exists
  if (roomData?.state) {
    const state = roomData.state;
    if (state.board) board = state.board;
    if (state.currentTurn) currentTurn = state.currentTurn;
    if (state.movesWithoutCapture !== undefined) movesWithoutCapture = state.movesWithoutCapture;
    if (state.moveCount !== undefined) moveCount = state.moveCount;
    if (state.lastMove) lastMove = state.lastMove;
  }

  // Subscribe to events
  mp.on('move', handleRemoteMove);
  mp.on('player_joined', ({ playerNumber, playerName }) => {
    if (playerNumber === 2) {
      player2Name = playerName || 'Jogador 2';
    }
    if (connectionStatus) {
      connectionStatus.textContent = 'Conectado';
      connectionStatus.classList.add('connected');
    }
  });
  mp.on('game_reset', () => {
    resetGame(false);
  });

  // Update UI
  updateTurnIndicator();
  updateCounts();
  render();
}

async function handleRemoteMove(payload) {
  if (payload.playerId === mp?.myUserId) return;

  // Apply move
  const { from, to, captures, promoted, chain } = payload;

  // Execute the move on board
  const piece = board[from.row][from.col];
  if (!piece) return;

  // Track captures for animation
  animCaptured = captures || [];

  // Remove captured pieces
  for (const cap of animCaptured) {
    board[cap.row][cap.col] = null;
  }

  // Move piece
  board[to.row][to.col] = piece;
  board[from.row][from.col] = null;

  // Handle promotion
  if (promoted) {
    piece.king = true;
    animMoved = { row: to.row, col: to.col, isPromotion: true };
    playSound('levelup');
  } else {
    animMoved = { row: to.row, col: to.col };
  }

  // Update last move
  lastMove = { from, to };

  // Update counters
  if (captures && captures.length > 0) {
    movesWithoutCapture = 0;
    playSound('capture');
  } else {
    movesWithoutCapture++;
    playSound('move');
  }

  moveCount++;

  // Switch turn
  currentTurn = currentTurn === PLAYER ? CPU : PLAYER;
  isMyTurn = currentTurn === (myPlayerNumber === 1 ? PLAYER : CPU);

  // Update UI
  updateCounts();
  updateTurnIndicator();
  render();

  // Check game over
  checkGameOver();
}

async function sendMove(from, to, captures, promoted, chain) {
  if (!mp) return;

  // Broadcast to other player
  await mp.send('move', { from, to, captures, promoted, chain });

  // Update room state in database
  const nextTurn = myPlayerNumber === 1 ? 2 : 1;
  await mp.updateState(
    { board, currentTurn, movesWithoutCapture, moveCount, lastMove },
    { turn: nextTurn }
  );
}

// ==================== INICIALIZACAO ====================
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
  isProcessing = false;
  focusedCell = null;
  keyboardMode = false;
  stopTimer();
  timerStarted = false;
  timerSeconds = 0;
  if (timerDisplay) timerDisplay.textContent = '00:00';
  modalOverlay.classList.add('hidden');
  updateUndoButton();

  // Limpa cache de elementos para recriar na proxima renderizacao
  cellElements = [];
  pieceElements = [];

  render();
  updateTurnIndicator();
  updateCounts();

  // No multiplayer, determina se e a vez do jogador
  if (IS_MULTIPLAYER) {
    isMyTurn = currentTurn === (myPlayerNumber === 1 ? PLAYER : CPU);
  }
}

// ==================== RENDERIZACAO ====================

// Cache de elementos DOM para renderizacao otimizada
let cellElements = []; // Array 2D de elementos de celula
let pieceElements = []; // Array 2D de elementos de peca (ou null)

// Funcao de renderizacao otimizada - atualiza apenas elementos que mudaram
function render() {
  // Calcula informacoes de captura forcada antes de construir o DOM
  const allMoves = currentTurn === PLAYER ? getAllMoves(PLAYER, board) : [];
  const hasForced = allMoves.length > 0 && allMoves[0].chain[0].captures.length > 0;

  // Se o tabuleiro ainda nao foi criado, cria tudo
  if (cellElements.length === 0) {
    boardEl.innerHTML = '';
    cellElements = [];
    pieceElements = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      cellElements[r] = [];
      pieceElements[r] = [];

      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Casa ${String.fromCharCode(97 + c)}${8 - r}`);

        // Eventos de click
        cell.addEventListener('click', () => onCellClick(r, c));
        cell.addEventListener('touchend', (e) => {
          e.preventDefault();
          onCellClick(r, c);
        });

        // Eventos de teclado para acessibilidade
        cell.addEventListener('keydown', (e) => handleKeyboardNavigation(e, r, c));
        cell.addEventListener('focus', () => onFocusCell(r, c));
        cell.addEventListener('blur', () => onBlurCell(r, c));

        boardEl.appendChild(cell);
        cellElements[r][c] = cell;
        pieceElements[r][c] = null;
      }
    }
  }

  // Atualiza cada celula
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      updateCell(r, c, allMoves, hasForced);
    }
  }

  // Limpa estado de animacao apos render para que o proximo render seja limpo
  animMoved = null;
  animCaptured = [];
}

// Atualiza uma unica celula (renderizacao incremental)
function updateCell(r, c, allMoves, hasForced) {
  const cell = cellElements[r][c];
  if (!cell) return;

  // Remove classes antigas
  cell.classList.remove('last-from', 'last-to', 'valid-move', 'valid-capture', 'focused');

  // Destaque do ultimo movimento
  if (lastMove) {
    if (lastMove.from.row === r && lastMove.from.col === c) cell.classList.add('last-from');
    if (lastMove.to.row === r && lastMove.to.col === c) cell.classList.add('last-to');
  }

  // Destaque de movimentos validos
  const moveMatch = validMoves.find(m => m.row === r && m.col === c);
  if (moveMatch) {
    if (moveMatch.captures && moveMatch.captures.length > 0) {
      cell.classList.add('valid-capture');
    } else {
      cell.classList.add('valid-move');
    }
  }

  // Celula com foco do teclado
  if (focusedCell && focusedCell.row === r && focusedCell.col === c) {
    cell.classList.add('focused');
  }

  // Atualiza ou cria peca
  const piece = board[r][c];
  const existingPiece = pieceElements[r][c];

  if (piece) {
    // Se nao existe elemento de peca, cria
    if (!existingPiece) {
      const pieceEl = document.createElement('div');
      pieceEl.className = 'piece ' + piece.owner;
      cell.appendChild(pieceEl);
      pieceElements[r][c] = pieceEl;
    }

    const pieceEl = pieceElements[r][c];

    // Atualiza classes da peca
    pieceEl.className = 'piece ' + piece.owner;
    if (piece.king) pieceEl.classList.add('king');
    if (selectedPiece && selectedPiece.row === r && selectedPiece.col === c) {
      pieceEl.classList.add('selected');
    }

    // Destaque de captura obrigatoria
    if (!gameOver && hasForced && piece.owner === PLAYER) {
      const canCapture = allMoves.some(m => m.from.row === r && m.from.col === c);
      if (canCapture) {
        pieceEl.classList.add('must-capture');
        showTutorialHint();
      }
    }

    // Animacao de aparecimento + flash de promocao
    if (animMoved && animMoved.row === r && animMoved.col === c) {
      pieceEl.classList.add('appear');
      if (animMoved.isPromotion) {
        pieceEl.classList.add('king-promoted');
      }
    }

    // Animacao de peca capturada
    const isCaptured = animCaptured.some(cap => cap.row === r && cap.col === c);
    if (isCaptured) {
      pieceEl.classList.add('captured-anim');
    }
  } else {
    // Remove peca se existir mas nao deveria
    if (existingPiece) {
      existingPiece.remove();
      pieceElements[r][c] = null;
    }
  }
}

// ==================== NAVEGACAO POR TECLADO ====================

// Manipula navegacao por teclado
function handleKeyboardNavigation(e, r, c) {
  const key = e.key;

  // Teclas de setas para navegar
  if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
    e.preventDefault();
    keyboardMode = true;

    let newRow = r;
    let newCol = c;

    if (key === 'ArrowUp') newRow = Math.max(0, r - 1);
    else if (key === 'ArrowDown') newRow = Math.min(BOARD_SIZE - 1, r + 1);
    else if (key === 'ArrowLeft') newCol = Math.max(0, c - 1);
    else if (key === 'ArrowRight') newCol = Math.min(BOARD_SIZE - 1, c + 1);

    // Foca a nova celula
    const newCell = cellElements[newRow]?.[newCol];
    if (newCell) {
      newCell.focus();
    }
  }

  // Enter ou Espaco para selecionar/mover
  if (key === 'Enter' || key === ' ') {
    e.preventDefault();
    onCellClick(r, c);
  }

  // Tab para navegar apenas entre pecas do jogador
  if (key === 'Tab') {
    e.preventDefault();
    keyboardMode = true;

    // Encontra a proxima peca do jogador atual
    const playerPieces = [];
    for (let pr = 0; pr < BOARD_SIZE; pr++) {
      for (let pc = 0; pc < BOARD_SIZE; pc++) {
        const p = board[pr][pc];
        if (p && p.owner === PLAYER) {
          playerPieces.push({ row: pr, col: pc });
        }
      }
    }

    if (playerPieces.length > 0) {
      // Encontra indice atual
      let currentIndex = -1;
      if (focusedCell) {
        currentIndex = playerPieces.findIndex(p => p.row === focusedCell.row && p.col === focusedCell.col);
      }

      // Proxima peca
      const nextIndex = (currentIndex + 1) % playerPieces.length;
      const nextPiece = playerPieces[nextIndex];
      const nextCell = cellElements[nextPiece.row]?.[nextPiece.col];
      if (nextCell) {
        nextCell.focus();
      }
    }
  }

  // Escape para deselecionar
  if (key === 'Escape') {
    e.preventDefault();
    selectedPiece = null;
    validMoves = [];
    render();
  }
}

// Quando uma celula recebe foco
function onFocusCell(r, c) {
  focusedCell = { row: r, col: c };
}

// Quando uma celula perde foco
function onBlurCell(r, c) {
  // Mantem focusedCell ate que outra celula receba foco
}

function updateTurnIndicator() {
  const gameContainer = document.querySelector('.game-wrapper') || document.body;

  if (gameOver) {
    turnIndicator.textContent = 'Fim de jogo';
    turnIndicator.className = 'turn-indicator';
    gameContainer.classList.remove('thinking');
    return;
  }

  // Multiplayer mode
  if (IS_MULTIPLAYER) {
    const myRole = myPlayerNumber === 1 ? PLAYER : CPU;
    const opponentName = myPlayerNumber === 1 ? player2Name : player1Name;

    if (currentTurn === myRole) {
      turnIndicator.textContent = 'Sua vez!';
      turnIndicator.className = 'turn-indicator player-turn';
      gameContainer.classList.remove('thinking');
    } else {
      turnIndicator.textContent = `Vez de ${opponentName}...`;
      turnIndicator.className = 'turn-indicator cpu-turn';
      gameContainer.classList.add('thinking');
    }
    return;
  }

  // Single player mode
  // Draw warning
  if (movesWithoutCapture >= 30 && currentTurn === PLAYER) {
    const remaining = DRAW_LIMIT - movesWithoutCapture;
    turnIndicator.textContent = `⚠️ Empate em ${remaining} movimento${remaining !== 1 ? 's' : ''}`;
    turnIndicator.className = 'turn-indicator draw-warning';
    gameContainer.classList.remove('thinking');
    return;
  }

  if (currentTurn === PLAYER) {
    turnIndicator.textContent = 'Sua vez';
    turnIndicator.className = 'turn-indicator player-turn';
    gameContainer.classList.remove('thinking');
  } else {
    turnIndicator.textContent = 'Computador pensando...';
    turnIndicator.className = 'turn-indicator cpu-turn';
    gameContainer.classList.add('thinking');
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

// ==================== LOGICA DE MOVIMENTOS ====================

// Melhoria #1: Damas voadoras (flying kings)
function getMovesForPiece(r, c, boardState) {
  const piece = boardState[r][c];
  if (!piece) return { simple: [], captures: [] };
  const simple = [], captures = [];
  const allDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];

  if (!piece.king) {
    // Peca comum: move 1 casa para frente, captura em todas as direcoes
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
    // Dama voadora: desliza qualquer distancia
    for (const [dr,dc] of allDirs) {
      let nr = r+dr, nc = c+dc;
      let foundEnemy = null;
      while (nr>=0&&nr<BOARD_SIZE&&nc>=0&&nc<BOARD_SIZE) {
        const cell = boardState[nr][nc];
        if (!cell) {
          if (foundEnemy) captures.push({row:nr,col:nc,captures:[foundEnemy]});
          else simple.push({row:nr,col:nc,captures:[]});
        } else if (cell.owner !== piece.owner) {
          if (foundEnemy) break; // segundo inimigo na mesma direcao — para
          foundEnemy = {row:nr,col:nc};
        } else {
          break; // peca propria
        }
        nr+=dr; nc+=dc;
      }
    }
  }
  return {simple, captures};
}

// Obtem todas as cadeias de captura a partir de (r,c) usando DFS
function getCaptureChains(r, c, boardState, piece) {
  const { captures } = getMovesForPiece(r, c, boardState);
  if (captures.length === 0) return [];

  const chains = [];
  for (const cap of captures) {
    const newBoard = cloneBoard(boardState);
    newBoard[cap.row][cap.col] = { ...piece };
    newBoard[r][c] = null;
    newBoard[cap.captures[0].row][cap.captures[0].col] = null;

    // Verifica promocao
    let promoted = false;
    if (!piece.king) {
      if ((piece.owner === PLAYER && cap.row === 0) || (piece.owner === CPU && cap.row === BOARD_SIZE - 1)) {
        newBoard[cap.row][cap.col].king = true;
        promoted = true;
      }
    }

    // Na Dama Brasileira, a promocao encerra a multi-captura
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

// Obtem todos os movimentos validos para um jogador, aplicando captura obrigatoria
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

  // Captura obrigatoria: se existem capturas, deve capturar
  if (allCaptures.length > 0) {
    // Regra brasileira: deve fazer a maior cadeia de captura
    const maxLen = Math.max(...allCaptures.map(m => m.chain.length));
    return allCaptures.filter(m => m.chain.length === maxLen);
  }
  return allSimple;
}

// Obtem destinos validos para uma peca especifica (para destaque na UI)
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

// ==================== DESFAZER (Melhoria #9) ====================

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

// ==================== MANIPULADOR DE CLIQUE ====================

function onCellClick(r, c) {
  if (gameOver || isProcessing) return;

  // Multiplayer: check if it's my turn
  if (IS_MULTIPLAYER) {
    const myRole = myPlayerNumber === 1 ? PLAYER : CPU;
    if (currentTurn !== myRole) return;
  } else {
    // Single player: only allow on player turn
    if (currentTurn !== PLAYER) return;
  }

  initAudio();

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
  if (isProcessing) return;
  isProcessing = true;

  // Salva historico antes de executar (Melhoria #9) - apenas no single player
  if (!IS_MULTIPLAYER) {
    saveHistory();
  }

  const chain = moveTarget.fullChain;
  moveCount++; // Melhoria #3

  // Determina o dono baseado no multiplayer ou single player
  const owner = IS_MULTIPLAYER ? (myPlayerNumber === 1 ? PLAYER : CPU) : PLAYER;

  executeMoveChain(fromR, fromC, chain, owner, () => {
    selectedPiece = null;
    validMoves = [];
    multiCaptureActive = false;
    updateCounts();

    // Melhoria #2: deteccao de empate (contado dentro de executeMoveChain)
    if (movesWithoutCapture >= DRAW_LIMIT) {
      isProcessing = false;
      endGame('draw');
      return;
    }

    if (checkGameOver()) {
      isProcessing = false;
      return;
    }

    // Troca de turno
    currentTurn = currentTurn === PLAYER ? CPU : PLAYER;

    // Multiplayer: envia movimento para o oponente
    if (IS_MULTIPLAYER) {
      const lastStep = chain[chain.length - 1];
      const captures = chain.reduce((caps, step) => [...caps, ...(step.captures || [])], []);
      const promoted = !board[fromR][fromC]?.king && (
        (owner === PLAYER && lastStep.row === 0) ||
        (owner === CPU && lastStep.row === BOARD_SIZE - 1)
      );

      sendMove(
        { row: fromR, col: fromC },
        { row: lastStep.row, col: lastStep.col },
        captures,
        promoted,
        chain
      );

      isMyTurn = false;
      updateUndoButton();
      updateTurnIndicator();
      render();
      isProcessing = false;
      return;
    }

    // Single player: turno da CPU
    updateUndoButton();
    updateTurnIndicator();
    render();

    // Atraso minimo de 800ms para jogadas da IA
    setTimeout(() => {
      cpuTurn();
    }, 800);
  });
}

function executeMoveChain(fromR, fromC, chain, owner, callback, stepIndex = 0) {
  if (stepIndex === 0) {
    // Conta capturas em toda a cadeia para rastreamento de empate (Melhoria #2)
    const totalCaptures = chain.reduce((sum, step) => sum + step.captures.length, 0);
    if (totalCaptures > 0) {
      movesWithoutCapture = 0;
      // Som de captura
      playSound('capture');
      // 2D Games: Screen shake para feedback de impacto
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

  // Rastreia pecas capturadas para animacao (Melhoria #10)
  animCaptured = step.captures.map(cap => ({ row: cap.row, col: cap.col }));

  // Remove pecas capturadas
  for (const cap of step.captures) {
    board[cap.row][cap.col] = null;
  }

  // Move a peca
  board[step.row][step.col] = piece;
  board[fromR][fromC] = null;

  // Verifica promocao
  let promoted = false;
  if (!piece.king) {
    if ((piece.owner === PLAYER && step.row === 0) || (piece.owner === CPU && step.row === BOARD_SIZE - 1)) {
      piece.king = true;
      promoted = true;
    }
  }

  if (promoted) {
    playSound('levelup');
    // 2D Games: Feedback visual para promocao a dama
    animMoved = { row: step.row, col: step.col, isPromotion: true };
  }

  lastMove = { from: { row: fromR, col: fromC }, to: { row: step.row, col: step.col } };
  animMoved = { row: step.row, col: step.col }; // Melhoria #10

  updateCounts();
  render();

  if (stepIndex < chain.length - 1) {
    setTimeout(() => {
      executeMoveChain(step.row, step.col, chain, owner, callback, stepIndex + 1);
    }, 300);
  } else {
    // Movimento da CPU completo - atualiza UI
    updateUndoButton();
    callback();
  }
}

// ==================== IA DA CPU ====================

function cpuTurn() {
  if (gameOver) {
    isProcessing = false;
    return;
  }

  const moves = getAllMoves(CPU, board);
  if (moves.length === 0) {
    endGame(PLAYER);
    isProcessing = false;
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

    // Melhoria #2: verificacao de empate apos movimento da CPU
    if (movesWithoutCapture >= DRAW_LIMIT) {
      endGame('draw');
      isProcessing = false;
      return;
    }

    if (checkGameOver()) {
      isProcessing = false;
      return;
    }

    currentTurn = PLAYER;
    updateUndoButton();
    updateTurnIndicator();
    render();
    isProcessing = false;
  });
}

// Melhoria #4: Facil — movimento aleatorio
function cpuTurnEasy(moves) {
  return moves[Math.floor(Math.random() * moves.length)];
}

// Melhoria #4: Medio — pontuacao gananciosa existente
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

// Melhoria #8: IA Minimax (Dificil)

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

  // Multiplayer end game
  if (IS_MULTIPLAYER) {
    handleMultiplayerEndGame(winner);
    return;
  }

  // Single player end game
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
    launchConfetti();
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

function handleMultiplayerEndGame(winner) {
  const myRole = myPlayerNumber === 1 ? PLAYER : CPU;
  const iWon = winner === myRole;
  const isDraw = winner === 'draw';

  if (iWon) {
    modalIcon.innerHTML = '&#127942;';
    modalTitle.textContent = 'Voce venceu!';
    modalTitle.style.color = '#4caf50';
    modalMsg.textContent = 'Parabens! Voce venceu a partida!';
    launchConfetti();
    playSound('win');
  } else if (isDraw) {
    modalIcon.innerHTML = '&#129309;';
    modalTitle.textContent = 'Empate!';
    modalTitle.style.color = '#ff9800';
    modalMsg.textContent = 'Nenhum jogador conseguiu vencer (40 movimentos sem captura).';
  } else {
    modalIcon.innerHTML = '&#128546;';
    modalTitle.textContent = 'Voce perdeu!';
    modalTitle.style.color = '#e94560';
    modalMsg.textContent = 'O oponente venceu desta vez. Tente novamente!';
    playSound('lose');
  }

  modalOverlay.classList.remove('hidden');

  // Update room status and save stats
  if (mp) {
    const result = iWon ? 'win' : isDraw ? 'draw' : 'loss';
    mp.finishGame(iWon ? mp.myUserId : null).then(() => {
      saveGameStat(result);
    });
  }
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
  await gameStats.save({
    result,
    moves: moveCount,
    timeSeconds: timerSeconds,
    roomId: ROOM_ID,
    isMultiplayer: IS_MULTIPLAYER
  });
}

// ==================== EVENTS ====================

async function resetGame(shouldBroadcast = true) {
  initGame();

  if (IS_MULTIPLAYER && shouldBroadcast && mp) {
    await mp.send('game_reset', {});

    // Reset room state
    await mp.resetRoom({ board: null, currentTurn: PLAYER, movesWithoutCapture: 0, moveCount: 0, lastMove: null });
  }
}

btnNewGame.addEventListener('click', () => { initAudio(); playSound('click'); resetGame(true); });
btnPlayAgain.addEventListener('click', () => { initAudio(); playSound('click'); resetGame(true); });
if (btnUndo) btnUndo.addEventListener('click', undoMove);

// ==================== CLEANUP ====================
window.addEventListener('beforeunload', () => {
  if (mp) mp.cleanup();
});

// ==================== START ====================
initMultiplayer().then(() => {
  initGame();
});
