import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';
import { MultiplayerManager, GameStats } from '../shared/multiplayer-manager.js';

const ROWS = 6, COLS = 7;
let board, currentPlayer, gameOver;
let lastDrop = null;
let isProcessing = false;
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const modal = document.getElementById('modal');
const modalMsg = document.getElementById('modal-msg');
const modalIcon = document.getElementById('modal-icon');
const turnIndicator = document.getElementById('turn-indicator');
const modeIndicator = document.getElementById('mode-indicator');

// Score tracking
let scores = { player: 0, cpu: 0, draw: 0 };
const scorePlayerEl = document.getElementById('score-player');
const scoreCpuEl = document.getElementById('score-cpu');
const scoreDrawEl = document.getElementById('score-draw');
const playerScoreEl = document.getElementById('player-score');
const cpuScoreEl = document.getElementById('cpu-score');

// === Multiplayer Setup ===
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
const IS_MULTIPLAYER = !!ROOM_ID;

// === Multiplayer Manager ===
let mp = null;
const gameStats = new GameStats('connect4');
let myPlayerNumber = 1; // 1 = red, 2 = yellow
let isMyTurn = true;
let player1Name = 'Jogador 1';
let player2Name = 'Jogador 2';

function init() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  currentPlayer = 1;
  gameOver = false;
  lastDrop = null;
  isProcessing = false;
  modal.classList.remove('show');
  modal.style.display = 'none';

  if (IS_MULTIPLAYER) {
    isMyTurn = myPlayerNumber === currentPlayer;
    updateTurnIndicator();
    updateScoreboardActive();
  } else {
    updateTurnIndicator();
    updateScoreboardActive();
  }

  render();
}

function updateTurnIndicator() {
  if (gameOver) {
    turnIndicator.textContent = 'Fim de jogo!';
    turnIndicator.className = 'turn-indicator';
    return;
  }

  if (IS_MULTIPLAYER) {
    const isMyPiece = currentPlayer === myPlayerNumber;
    if (isMyTurn) {
      turnIndicator.innerHTML = '<span class="piece-icon"></span> Sua vez!';
      turnIndicator.className = 'turn-indicator player-turn';
    } else {
      const opponentName = myPlayerNumber === 1 ? player2Name : player1Name;
      turnIndicator.innerHTML = `<span class="piece-icon"></span> Aguardando ${opponentName}...`;
      turnIndicator.className = 'turn-indicator opponent-turn waiting';
    }
  } else {
    if (currentPlayer === 1) {
      turnIndicator.innerHTML = '<span class="piece-icon"></span> Sua vez!';
      turnIndicator.className = 'turn-indicator player-turn';
    } else {
      turnIndicator.textContent = 'CPU pensando...';
      turnIndicator.className = 'turn-indicator cpu-turn';
    }
  }
}

function updateScoreboardActive() {
  playerScoreEl.classList.toggle('active', currentPlayer === 1 && !gameOver);
  cpuScoreEl.classList.toggle('active', currentPlayer === 2 && !gameOver);
}

function updateScores(result) {
  if (result === 'win') {
    scores.player++;
    scorePlayerEl.textContent = scores.player;
  } else if (result === 'loss') {
    scores.cpu++;
    scoreCpuEl.textContent = scores.cpu;
  } else if (result === 'draw') {
    scores.draw++;
    scoreDrawEl.textContent = scores.draw;
  }
}

// === Multiplayer Functions ===
async function initMultiplayer() {
  if (!IS_MULTIPLAYER) return;

  mp = new MultiplayerManager('connect4', ROOM_ID, {
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

  if (modeIndicator) {
    modeIndicator.textContent = 'Multiplayer';
    modeIndicator.classList.add('multiplayer-mode');
  }

  myPlayerNumber = mp.myPlayerNumber;
  player1Name = mp.roomData?.player1_name || 'Jogador 1';
  player2Name = mp.roomData?.player2_name || 'Jogador 2';

  // Update score labels for multiplayer
  const playerLabel = document.querySelector('#player-score .score-label');
  const cpuLabel = document.querySelector('#cpu-score .score-label');
  if (playerLabel) {
    playerLabel.innerHTML = `<span class="piece-icon"></span> ${myPlayerNumber === 1 ? 'Voce' : player1Name}`;
  }
  if (cpuLabel) {
    cpuLabel.innerHTML = `<span class="piece-icon"></span> ${myPlayerNumber === 2 ? 'Voce' : player2Name}`;
  }

  if (mp.roomData?.state?.board) {
    board = mp.roomData.state.board;
    currentPlayer = mp.roomData.state.currentPlayer || 1;
    lastDrop = mp.roomData.state.lastDrop || null;
    isMyTurn = currentPlayer === myPlayerNumber;
    render();
  }

  mp.on('move', handleRemoteMove);
  mp.on('player_joined', ({ playerNumber, playerName }) => {
    if (playerNumber === 2) {
      player2Name = playerName || 'Jogador 2';
    }
  });
  mp.on('game_reset', () => {
    resetGame(false);
  });

  updateTurnIndicator();
  updateScoreboardActive();
}

async function handleRemoteMove(payload) {
  if (payload.playerId === mp?.myUserId) return;

  const { col, player } = payload;
  const row = drop(col, player);
  if (row === -1) return;

  render();

  const win = checkWin(player);
  if (win) {
    endGame(player === myPlayerNumber ? 'win' : 'loss', win);
    return;
  }
  if (isFull()) {
    endGame('draw');
    return;
  }

  currentPlayer = currentPlayer === 1 ? 2 : 1;
  isMyTurn = currentPlayer === myPlayerNumber;
  updateTurnIndicator();
  updateScoreboardActive();

  playSound('place');
  haptic(15);
}

async function sendMove(col, player) {
  if (!mp) return;

  await mp.send('move', { col, player });

  const nextTurn = currentPlayer === 1 ? 2 : 1;
  await mp.updateState({ board, currentPlayer, lastDrop }, { turn: nextTurn });
}

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', `Coluna ${c + 1}, Linha ${ROWS - r}`);
      cell.setAttribute('tabindex', '0');

      if (board[r][c] === 1) cell.classList.add('red');
      if (board[r][c] === 2) cell.classList.add('yellow');

      if (lastDrop && lastDrop.row === r && lastDrop.col === c) {
        cell.style.setProperty('--rows', r + 1);
        cell.classList.add('dropping');
      }

      cell.addEventListener('click', () => handleClick(c));
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(c);
        }
      });
      cell.addEventListener('mouseenter', () => highlightCol(c, true));
      cell.addEventListener('mouseleave', () => highlightCol(c, false));
      cell.dataset.row = r;
      cell.dataset.col = c;
      boardEl.appendChild(cell);
    }
  }
}

function highlightCol(col, on) {
  if (gameOver) return;
  if (IS_MULTIPLAYER && !isMyTurn) return;
  if (!IS_MULTIPLAYER && currentPlayer !== 1) return;

  boardEl.querySelectorAll('[data-col="' + col + '"]').forEach(el => {
    el.classList.toggle('col-hover', on && !el.classList.contains('red') && !el.classList.contains('yellow'));
  });
}

function getAvailableRow(col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

function drop(col, player) {
  const row = getAvailableRow(col);
  if (row === -1) return -1;
  board[row][col] = player;
  lastDrop = { row, col };
  playSound('place');
  haptic(15);
  return row;
}

function checkWin(player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of dirs) {
        let cells = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

function isFull() {
  return board[0].every(c => c !== 0);
}

function handleClick(col) {
  if (gameOver || isProcessing) return;

  if (IS_MULTIPLAYER && !isMyTurn) return;
  if (!IS_MULTIPLAYER && currentPlayer !== 1) return;

  isProcessing = true;
  initAudio();

  const player = IS_MULTIPLAYER ? myPlayerNumber : 1;
  const row = drop(col, player);
  if (row === -1) {
    isProcessing = false;
    return;
  }

  if (IS_MULTIPLAYER) {
    sendMove(col, player);
  }

  render();

  const win = checkWin(player);
  if (win) { endGame(player === myPlayerNumber ? 'win' : 'loss', win); return; }
  if (isFull()) { endGame('draw'); return; }

  currentPlayer = currentPlayer === 1 ? 2 : 1;

  if (IS_MULTIPLAYER) {
    isMyTurn = false;
    updateTurnIndicator();
    updateScoreboardActive();
    isProcessing = false;
  } else {
    updateTurnIndicator();
    updateScoreboardActive();
    const gameContainer = document.getElementById('game-container') || document.body;
    gameContainer.classList.add('thinking');
    setTimeout(cpuMove, 800);
  }
}

function cpuMove() {
  let bestCol = -1;

  // 1. Can CPU win?
  for (let c = 0; c < COLS; c++) {
    const r = getAvailableRow(c);
    if (r === -1) continue;
    board[r][c] = 2;
    if (checkWin(2)) { board[r][c] = 0; bestCol = c; break; }
    board[r][c] = 0;
  }

  // 2. Block player win
  if (bestCol === -1) {
    for (let c = 0; c < COLS; c++) {
      const r = getAvailableRow(c);
      if (r === -1) continue;
      board[r][c] = 1;
      if (checkWin(1)) { board[r][c] = 0; bestCol = c; break; }
      board[r][c] = 0;
    }
  }

  // 3. Prefer center columns
  if (bestCol === -1) {
    const order = [3, 2, 4, 1, 5, 0, 6];
    for (const c of order) {
      if (getAvailableRow(c) !== -1) { bestCol = c; break; }
    }
  }

  drop(bestCol, 2);
  render();

  const win = checkWin(2);
  if (win) { endGame('loss', win); return; }
  if (isFull()) { endGame('draw'); return; }

  currentPlayer = 1;
  updateTurnIndicator();
  updateScoreboardActive();
  const gameContainer = document.getElementById('game-container') || document.body;
  gameContainer.classList.remove('thinking');
  isProcessing = false;
}

async function endGame(result, winCells) {
  gameOver = true;
  playerScoreEl.classList.remove('active');
  cpuScoreEl.classList.remove('active');

  if (winCells) {
    winCells.forEach(([r, c]) => {
      const idx = r * COLS + c;
      boardEl.children[idx].classList.add('win');
    });
  }

  let msg, icon;
  if (IS_MULTIPLAYER) {
    const iWon = result === 'win';
    if (iWon) {
      msg = 'Voce venceu!';
      icon = '🏆';
    } else if (result === 'draw') {
      msg = 'Empate!';
      icon = '🤝';
    } else {
      msg = 'Voce perdeu!';
      icon = '😔';
    }

    if (mp && iWon) {
      await mp.finishGame(mp.myUserId);
    }
  } else {
    const msgs = { win: 'Voce venceu!', loss: 'CPU venceu!', draw: 'Empate!' };
    const icons = { win: '🏆', loss: '😔', draw: '🤝' };
    msg = msgs[result];
    icon = icons[result];
  }

  updateScores(result);
  modalIcon.textContent = icon;
  modalMsg.textContent = msg;

  setTimeout(() => {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }, 600);

  if (result === 'win') {
    launchConfetti();
    playSound('win');
  }

  await gameStats.save({
    result,
    moves: 0,
    timeSeconds: 0,
    roomId: ROOM_ID,
    isMultiplayer: IS_MULTIPLAYER
  });
}

async function resetGame(shouldBroadcast = true) {
  init();

  if (IS_MULTIPLAYER && shouldBroadcast && mp) {
    await mp.send('game_reset', {});
    await mp.resetRoom({ board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)), currentPlayer: 1, lastDrop: null });
  }
}

document.getElementById('restart').addEventListener('click', () => {
  initAudio();
  playSound('click');
  resetGame(true);
});

document.getElementById('modal-btn').addEventListener('click', () => {
  initAudio();
  playSound('click');
  modal.classList.remove('show');
  modal.style.display = 'none';
  resetGame(true);
});

// Close modal on backdrop click
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    resetGame(true);
  }
});

// Cleanup
window.addEventListener('beforeunload', () => {
  if (mp) mp.cleanup();
});

// Initialize multiplayer then start game
initMultiplayer().then(() => {
  init();
});