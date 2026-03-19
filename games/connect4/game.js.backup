import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';

const ROWS = 6, COLS = 7;
let board, currentPlayer, gameOver;
let lastDrop = null; // { row, col } da última jogada para animação
let isProcessing = false; // Flag para prevenir cliques duplos
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const modal = document.getElementById('modal');
const modalMsg = document.getElementById('modal-msg');

// === Multiplayer Setup ===
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
const IS_MULTIPLAYER = !!ROOM_ID;

let channel = null;
let myUserId = null;
let myPlayerNumber = 1; // 1 = red, 2 = yellow
let isMyTurn = true;
let roomData = null;
let player1Name = 'Jogador 1';
let player2Name = 'Jogador 2';

function init() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  currentPlayer = 1;
  gameOver = false;
  lastDrop = null;
  isProcessing = false;
  modal.style.display = 'none';

  if (IS_MULTIPLAYER) {
    isMyTurn = myPlayerNumber === currentPlayer;
    updateStatus();
  } else {
    statusEl.textContent = 'Sua vez! Clique em uma coluna.';
  }

  render();
}

// === Multiplayer Functions ===
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
  const modeIndicator = document.getElementById('mode-indicator');
  if (modeIndicator) {
    modeIndicator.textContent = '👥 Multiplayer';
    modeIndicator.classList.add('multiplayer-mode');
  }

  // Join room
  await joinRoom();
}

async function joinRoom() {
  try {
    // Get room data
    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', ROOM_ID)
      .single();

    if (error || !data) {
      alert('Sala não encontrada!');
      window.location.href = '/multiplayer.html';
      return;
    }

    roomData = data;

    // Determine player role
    myPlayerNumber = data.player1_id === myUserId ? 1 : 2;
    isMyTurn = data.turn === myPlayerNumber;

    // Get player names
    player1Name = data.player1_name || 'Jogador 1';
    player2Name = data.player2_name || 'Jogador 2';

    // Restore board state if exists
    if (data.state && data.state.board) {
      board = data.state.board;
      currentPlayer = data.state.currentPlayer || 1;
      lastDrop = data.state.lastDrop || null;
      isMyTurn = currentPlayer === myPlayerNumber;
      render();
    }

    // Subscribe to realtime changes
    subscribeToRoom();

    // Update turn indicator
    updateStatus();

  } catch (e) {
    console.error('Erro ao entrar na sala:', e);
    alert('Erro ao conectar à sala.');
  }
}

function subscribeToRoom() {
  channel = supabase.channel(`room-${ROOM_ID}`);

  channel
    .on('broadcast', { event: 'move' }, ({ payload }) => {
      handleRemoteMove(payload);
    })
    .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
      if (payload.playerNumber === 2) {
        player2Name = payload.playerName || 'Jogador 2';
      }
    })
    .on('broadcast', { event: 'game_reset' }, () => {
      resetGame(false);
    })
    .subscribe((status) => {
      console.log('Multiplayer status:', status);

      // Notify other player we're here
      channel.send({
        type: 'broadcast',
        event: 'player_joined',
        payload: { playerNumber: myPlayerNumber, playerName: myPlayerNumber === 1 ? player1Name : player2Name }
      });
    });
}

async function handleRemoteMove(payload) {
  // Ignore our own moves
  if (payload.playerId === myUserId) return;

  // Apply move
  const { col, player } = payload;
  const row = drop(col, player);
  if (row === -1) return;

  render();

  // Check result
  const win = checkWin(player);
  if (win) {
    endGame(player === myPlayerNumber ? 'win' : 'loss', win);
    return;
  }
  if (isFull()) {
    endGame('draw');
    return;
  }

  // Switch turn
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  isMyTurn = currentPlayer === myPlayerNumber;
  updateStatus();

  playSound('place');
  haptic(15);
}

async function sendMove(col, player) {
  if (!channel) return;

  // Broadcast to other player
  channel.send({
    type: 'broadcast',
    event: 'move',
    payload: { col, player, playerId: myUserId }
  });

  // Update room state in database
  try {
    const nextTurn = currentPlayer === 1 ? 2 : 1;
    await supabase.from('game_rooms').update({
      state: { board, currentPlayer, lastDrop },
      turn: nextTurn
    }).eq('id', ROOM_ID);
  } catch (e) {
    console.warn('Erro ao salvar estado:', e);
  }
}

function updateStatus() {
  if (gameOver) return;

  if (IS_MULTIPLAYER) {
    const currentPlayerName = currentPlayer === 1 ? player1Name : player2Name;
    if (isMyTurn) {
      statusEl.textContent = 'Sua vez! Clique em uma coluna.';
      statusEl.classList.remove('waiting');
    } else {
      statusEl.textContent = `Aguardando ${currentPlayerName}...`;
      statusEl.classList.add('waiting');
    }
  } else {
    statusEl.textContent = currentPlayer === 1 ? 'Sua vez! Clique em uma coluna.' : 'Computador pensando...';
  }
}

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (board[r][c] === 1) cell.classList.add('red');
      if (board[r][c] === 2) cell.classList.add('yellow');

      // Animação de queda para a peça recém colocada
      if (lastDrop && lastDrop.row === r && lastDrop.col === c) {
        cell.style.setProperty('--rows', r + 1);
        cell.classList.add('dropping');
      }

      cell.addEventListener('click', () => handleClick(c));
      cell.addEventListener('mouseenter', () => highlightCol(c, true));
      cell.addEventListener('mouseleave', () => highlightCol(c, false));
      cell.dataset.row = r;
      cell.dataset.col = c;
      boardEl.appendChild(cell);
    }
  }
}

function highlightCol(col, on) {
  // In multiplayer, only highlight on my turn
  // In single player, only highlight when it's player 1's turn
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

  // Multiplayer: check if it's my turn
  if (IS_MULTIPLAYER && !isMyTurn) return;

  // Single player: only player 1 can click
  if (!IS_MULTIPLAYER && currentPlayer !== 1) return;

  isProcessing = true;
  initAudio();

  const player = IS_MULTIPLAYER ? myPlayerNumber : 1;
  const row = drop(col, player);
  if (row === -1) {
    isProcessing = false;
    return;
  }

  // Send move in multiplayer
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
    updateStatus();
    isProcessing = false;
  } else {
    statusEl.textContent = 'Computador pensando...';
    const gameContainer = document.getElementById('game-container') || document.body;
    gameContainer.classList.add('thinking');
    // Delay mínimo de 800ms para jogadas da IA
    setTimeout(cpuMove, 800);
  }
}

function cpuMove() {
  // AI: check win, block, prefer center
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
  statusEl.textContent = 'Sua vez! Clique em uma coluna.';
  const gameContainer = document.getElementById('game-container') || document.body;
  gameContainer.classList.remove('thinking');
  isProcessing = false;
}

async function endGame(result, winCells) {
  gameOver = true;
  if (winCells) {
    winCells.forEach(([r, c]) => {
      const idx = r * COLS + c;
      boardEl.children[idx].classList.add('win');
    });
  }

  let msg;
  if (IS_MULTIPLAYER) {
    const iWon = result === 'win';
    msg = iWon ? '🏆 Você venceu!' : result === 'draw' ? '🤝 Empate!' : '😔 Você perdeu!';

    // Update room status
    if (ROOM_ID && iWon) {
      await supabase.from('game_rooms').update({
        status: 'finished',
        winner: myUserId
      }).eq('id', ROOM_ID);
    }
  } else {
    const msgs = { win: '🏆 Você venceu!', loss: '😔 CPU venceu!', draw: '🤝 Empate!' };
    msg = msgs[result];
  }

  modalMsg.textContent = msg;
  setTimeout(() => { modal.style.display = 'flex'; }, 600);

  if (result === 'win') {
    launchConfetti();
    playSound('win');
  }

  // Save stats
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'connect4',
      result: result,
      moves: 0,
      time_seconds: 0,
      room_id: ROOM_ID,
      is_multiplayer: IS_MULTIPLAYER
    });
  }
}

async function resetGame(shouldBroadcast = true) {
  init();

  if (IS_MULTIPLAYER && shouldBroadcast && channel) {
    channel.send({
      type: 'broadcast',
      event: 'game_reset',
      payload: {}
    });

    // Reset room state
    await supabase.from('game_rooms').update({
      state: { board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)), currentPlayer: 1, lastDrop: null },
      turn: 1,
      status: 'playing',
      winner: null
    }).eq('id', ROOM_ID);
  }
}

document.getElementById('restart').addEventListener('click', () => { initAudio(); playSound('click'); resetGame(true); });
document.getElementById('modal-btn').addEventListener('click', () => { initAudio(); playSound('click'); resetGame(true); });

// Initialize multiplayer then start game
initMultiplayer().then(() => {
  init();
});
