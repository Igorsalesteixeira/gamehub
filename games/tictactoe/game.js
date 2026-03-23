import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';
import { MultiplayerManager, GameStats } from '../shared/multiplayer-manager.js';
import { onGameEnd } from '../shared/game-integration.js';

// =============================================
//  Jogo da Velha (Tic-Tac-Toe) - Games Hub
//  Suporta: Single Player (vs CPU) | Multiplayer
// =============================================

const WIN_COMBOS = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6],         // diags
];

// === Game Mode Detection ===
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
const IS_MULTIPLAYER = !!ROOM_ID;

// === Symbols ===
const SYMBOL_X = 'X';
const SYMBOL_O = 'O';

// === State ===
let board = Array(9).fill(null);
let gameOver = false;
let currentPlayer = SYMBOL_X; // X always starts
let mySymbol = SYMBOL_X;      // In multiplayer: assigned by server
let isMyTurn = true;          // In single player: always true for human
let roomData = null;          // Multiplayer room data
let player1Name = 'Jogador 1';
let player2Name = 'Jogador 2';

// === Scores ===
const scores = { player: 0, cpu: 0, draw: 0 };

// === Multiplayer Manager ===
let mp = null;
const gameStats = new GameStats('tictactoe');

// === DOM ===
const cells = document.querySelectorAll('.cell');
const turnIndicator = document.getElementById('turn-indicator');
const scorePlayer = document.getElementById('score-player');
const scoreCpu = document.getElementById('score-cpu');
const scoreDraw = document.getElementById('score-draw');
const btnNewGame = document.getElementById('btn-new-game');
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const btnModalNew = document.getElementById('btn-modal-new');
const modeIndicator = document.getElementById('mode-indicator');

// === Multiplayer Setup ===
async function initMultiplayer() {
  if (!IS_MULTIPLAYER) return;

  // Initialize MultiplayerManager
  mp = new MultiplayerManager('tictactoe', ROOM_ID, {
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

  // Update UI
  if (modeIndicator) {
    modeIndicator.textContent = '👥 Multiplayer';
    modeIndicator.classList.add('multiplayer-mode');
  }

  // Get room data from manager
  roomData = mp.roomData;
  mySymbol = mp.myPlayerNumber === 1 ? SYMBOL_X : SYMBOL_O;
  isMyTurn = roomData?.turn === mp.myPlayerNumber;

  // Get player names
  player1Name = roomData?.player1_name || 'Jogador 1';
  player2Name = roomData?.player2_name || 'Jogador 2';

  // Restore board state if exists
  if (roomData?.state?.board) {
    board = roomData.state.board;
    currentPlayer = roomData.state.currentPlayer || SYMBOL_X;
    renderBoard();
  }

  // Update score labels
  if (scorePlayer) scorePlayer.previousElementSibling.textContent = player1Name;
  if (scoreCpu) scoreCpu.previousElementSibling.textContent = player2Name;

  // Subscribe to events
  mp.on('move', handleRemoteMove);
  mp.on('player_joined', ({ playerNumber, playerName }) => {
    if (playerNumber === 2) {
      player2Name = playerName || 'Jogador 2';
      if (scoreCpu) scoreCpu.previousElementSibling.textContent = player2Name;
    }
  });
  mp.on('game_reset', () => {
    resetGame(false); // Don't broadcast reset
  });

  // Update turn indicator
  updateTurnIndicator();
}

async function handleRemoteMove(payload) {
  // Ignore our own moves
  if (payload.playerId === mp?.myUserId) return;

  // Apply move
  const { index, symbol } = payload;
  board[index] = symbol;
  renderCell(index, symbol);

  // Switch turn
  currentPlayer = currentPlayer === SYMBOL_X ? SYMBOL_O : SYMBOL_X;

  // Check result
  const result = checkResult();
  if (result) {
    endGame(result);
    return;
  }

  // Update turn
  isMyTurn = currentPlayer === mySymbol;
  updateTurnIndicator();

  playSound('move');
  haptic(15);
}

async function sendMove(index, symbol) {
  if (!mp) return;

  // Broadcast to other player
  await mp.send('move', { index, symbol });

  // Update room state in database
  const nextTurn = currentPlayer === SYMBOL_X ? 2 : 1;
  await mp.updateState({ board, currentPlayer }, { turn: nextTurn });
}

// === Single Player (CPU AI) ===
function cpuMove() {
  // 1. Try to win
  const winMove = findBestMove(SYMBOL_O);
  if (winMove !== -1) return winMove;

  // 2. Block player
  const blockMove = findBestMove(SYMBOL_X);
  if (blockMove !== -1) return blockMove;

  // 3. Center
  if (board[4] === null) return 4;

  // 4. Corners
  const corners = [0, 2, 6, 8].filter(i => board[i] === null);
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];

  // 5. Edges
  const edges = [1, 3, 5, 7].filter(i => board[i] === null);
  if (edges.length > 0) return edges[Math.floor(Math.random() * edges.length)];

  return -1;
}

function findBestMove(symbol) {
  for (const combo of WIN_COMBOS) {
    const values = combo.map(i => board[i]);
    const symbolCount = values.filter(v => v === symbol).length;
    const emptyCount = values.filter(v => v === null).length;
    if (symbolCount === 2 && emptyCount === 1) {
      return combo[values.indexOf(null)];
    }
  }
  return -1;
}

// === Core Game Functions ===
function init() {
  board = Array(9).fill(null);
  gameOver = false;
  currentPlayer = SYMBOL_X;
  isMyTurn = IS_MULTIPLAYER ? (mySymbol === SYMBOL_X) : true;

  cells.forEach(cell => {
    cell.textContent = '';
    cell.className = 'cell';
  });

  updateTurnIndicator();
}

function renderBoard() {
  board.forEach((symbol, index) => {
    if (symbol) renderCell(index, symbol);
  });
}

function renderCell(index, symbol) {
  const cell = cells[index];
  cell.textContent = symbol;
  cell.classList.add('taken', symbol.toLowerCase(), 'pop');
}

function updateTurnIndicator() {
  if (gameOver) return;

  turnIndicator.classList.remove('player-turn', 'cpu-turn', 'waiting');

  if (IS_MULTIPLAYER) {
    if (isMyTurn) {
      turnIndicator.textContent = 'Sua vez!';
      turnIndicator.classList.add('player-turn');
    } else {
      turnIndicator.textContent = 'Vez do oponente...';
      turnIndicator.classList.add('cpu-turn');
    }
  } else {
    // Single player
    turnIndicator.textContent = 'Sua vez!';
    turnIndicator.classList.add('player-turn');
  }
}

function makeMove(idx, symbol) {
  board[idx] = symbol;
  renderCell(idx, symbol);
  playSound('move');
  haptic(15);
}

// === Player Move Handler ===
cells.forEach(cell => {
  cell.addEventListener('click', async () => {
    const idx = parseInt(cell.dataset.index);

    // Validation
    if (gameOver || board[idx] !== null) return;
    if (IS_MULTIPLAYER && !isMyTurn) return;

    // Make move
    const myMoveSymbol = IS_MULTIPLAYER ? mySymbol : SYMBOL_X;
    makeMove(idx, myMoveSymbol);

    // Send to opponent if multiplayer
    if (IS_MULTIPLAYER) {
      await sendMove(idx, myMoveSymbol);
      isMyTurn = false;
    }

    // Check result
    const result = checkResult();
    if (result) {
      endGame(result);
      return;
    }

    // Switch turn
    currentPlayer = currentPlayer === SYMBOL_X ? SYMBOL_O : SYMBOL_X;

    // Single player: CPU turn
    if (!IS_MULTIPLAYER) {
      updateTurnIndicator();
      setTimeout(() => {
        if (gameOver) return;
        const cpuIdx = cpuMove();
        if (cpuIdx !== -1) {
          makeMove(cpuIdx, SYMBOL_O);

          const result2 = checkResult();
          if (result2) {
            endGame(result2);
            return;
          }

          currentPlayer = SYMBOL_X;
          updateTurnIndicator();
        }
      }, 400);
    } else {
      // Multiplayer: just update indicator
      updateTurnIndicator();
    }
  });
});

// === Win / Draw Detection ===
function checkResult() {
  for (const combo of WIN_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return { type: 'win', winner: board[a], combo };
    }
  }
  if (board.every(cell => cell !== null)) {
    return { type: 'draw', combo: null };
  }
  return null;
}

// === End Game ===
function endGame(result) {
  gameOver = true;

  if (result.combo) {
    result.combo.forEach(i => cells[i].classList.add('winner'));
  }

  if (IS_MULTIPLAYER) {
    handleMultiplayerEndGame(result);
  } else {
    handleSinglePlayerEndGame(result);
  }
}

function handleSinglePlayerEndGame(result) {
  if (result.type === 'win' && result.winner === SYMBOL_X) {
    scores.player++;
    if (scorePlayer) scorePlayer.textContent = scores.player;
    showModal('🎉', 'Vitoria!', 'Parabens, voce venceu!');
    launchConfetti();
    playSound('win');
  } else if (result.type === 'win' && result.winner === SYMBOL_O) {
    scores.cpu++;
    if (scoreCpu) scoreCpu.textContent = scores.cpu;
    showModal('😞', 'Derrota!', 'O computador venceu desta vez.');
  } else {
    scores.draw++;
    if (scoreDraw) scoreDraw.textContent = scores.draw;
    showModal('🤝', 'Empate!', 'Ninguem venceu desta vez.');
  }

  turnIndicator.textContent = result.type === 'win'
    ? (result.winner === SYMBOL_X ? 'Voce venceu!' : 'Computador venceu!')
    : 'Empate!';
  turnIndicator.classList.remove('player-turn', 'cpu-turn');

  saveGameStat(result.type === 'win' && result.winner === SYMBOL_X ? 'win'
    : result.type === 'win' ? 'loss' : 'draw');
}

function handleMultiplayerEndGame(result) {
  const iWon = result.type === 'win' && result.winner === mySymbol;
  const isDraw = result.type === 'draw';

  if (iWon) {
    showModal('🎉', 'Vitoria!', 'Voce venceu!');
    launchConfetti();
    playSound('win');
  } else if (isDraw) {
    showModal('🤝', 'Empate!', 'Ninguem venceu desta vez.');
  } else {
    showModal('😞', 'Derrota!', 'O oponente venceu.');
  }

  turnIndicator.textContent = iWon ? 'Voce venceu!'
    : isDraw ? 'Empate!'
    : 'Voce perdeu!';
  turnIndicator.classList.remove('player-turn', 'cpu-turn');

  // Update room status and save stats
  if (mp) {
    const resultStr = iWon ? 'win' : isDraw ? 'draw' : 'loss';
    mp.finishGame(iWon ? mp.myUserId : null).then(() => {
      saveGameStat(resultStr);
    });
  }
}

// === Modal ===
function showModal(icon, title, msg) {
  modalIcon.textContent = icon;
  modalTitle.textContent = title;
  modalMsg.textContent = msg;
  setTimeout(() => modalOverlay.classList.add('visible'), 600);
}

function hideModal() {
  modalOverlay.classList.remove('visible');
}

// === New Game ===
async function resetGame(shouldBroadcast = true) {
  init();

  if (IS_MULTIPLAYER && shouldBroadcast && mp) {
    await mp.send('game_reset', {});

    // Reset room state
    await mp.resetRoom({ board: Array(9).fill(null), currentPlayer: SYMBOL_X });
  }
}

btnNewGame.addEventListener('click', () => {
  hideModal();
  resetGame(true);
});

btnModalNew.addEventListener('click', () => {
  hideModal();
  resetGame(true);
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    hideModal();
    resetGame(true);
  }
});

// === Stats ===
async function saveGameStat(result) {
  await gameStats.save({
    result,
    moves: 0,
    timeSeconds: 0,
    roomId: ROOM_ID,
    isMultiplayer: IS_MULTIPLAYER
  });
  onGameEnd('tictactoe', { won: result === 'win', multiplayer: IS_MULTIPLAYER });
}

// === Cleanup ===
window.addEventListener('beforeunload', () => {
  if (mp) mp.cleanup();
});

// === Start ===
initMultiplayer().then(() => {
  init();
});
