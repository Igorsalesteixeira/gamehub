import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';

const SIZE = 9;
const EMPTY = 0, BLACK = 1, WHITE = 2;
let board, current, captures, lastBoard, consecutivePasses, lastMove;
let isProcessing = false;

// === Multiplayer Detection ===
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
const IS_MULTIPLAYER = !!ROOM_ID;

// === Multiplayer State ===
let myUserId = null;
let myPlayerNumber = null; // 1 = Preto, 2 = Branco
let isMyTurn = true;
let channel = null;
let roomData = null;
let player1Name = 'Jogador 1';
let player2Name = 'Jogador 2';
let gameOver = false;

const boardEl = document.getElementById('board');
const turnEl = document.getElementById('turn');
const blackScoreEl = document.getElementById('black-score');
const whiteScoreEl = document.getElementById('white-score');
const modal = document.getElementById('modal');
const modalMsg = document.getElementById('modal-msg');
const modeIndicator = document.getElementById('mode-indicator');
const connectionStatus = document.getElementById('connection-status');

// ==================== MULTIPLAYER ====================

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

    // Determine player role (Player 1 = Black, Player 2 = White)
    myPlayerNumber = roomData.player1_id === myUserId ? 1 : 2;
    isMyTurn = roomData.turn === myPlayerNumber;

    // Get player names
    player1Name = roomData.player1_name || 'Jogador 1';
    player2Name = roomData.player2_name || 'Jogador 2';

    // Restore game state if exists
    if (roomData.state) {
      const state = roomData.state;
      if (state.board) board = state.board;
      if (state.current) current = state.current;
      if (state.captures) captures = state.captures;
      if (state.lastBoard) lastBoard = state.lastBoard;
      if (state.consecutivePasses !== undefined) consecutivePasses = state.consecutivePasses;
      if (state.lastMove) lastMove = state.lastMove;
      if (state.gameOver !== undefined) gameOver = state.gameOver;
    }

    // Subscribe to realtime
    subscribeToRoom();

    // Update UI
    updateUI();
    render();

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
    .on('broadcast', { event: 'pass' }, ({ payload }) => {
      handleRemotePass(payload);
    })
    .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
      if (payload.playerNumber === 2) {
        player2Name = payload.playerName || 'Jogador 2';
      }
      if (connectionStatus) {
        connectionStatus.textContent = 'Conectado';
        connectionStatus.classList.add('connected');
      }
    })
    .on('broadcast', { event: 'game_reset' }, () => {
      resetGame(false);
    })
    .on('broadcast', { event: 'game_end' }, ({ payload }) => {
      handleRemoteEndGame(payload);
    })
    .subscribe((status) => {
      console.log('Multiplayer status:', status);

      // Notify other player
      channel.send({
        type: 'broadcast',
        event: 'player_joined',
        payload: { playerNumber: myPlayerNumber, playerName: myPlayerNumber === 1 ? player1Name : player2Name }
      });
    });
}

async function handleRemoteMove(payload) {
  if (payload.playerId === myUserId) return;

  const { row, col, captured, board: newBoard, captures: newCaptures, lastBoard: newLastBoard } = payload;

  // Update local state
  board = newBoard;
  captures = newCaptures;
  lastBoard = newLastBoard;
  lastMove = [row, col];
  consecutivePasses = 0;

  // Switch turn
  current = current === BLACK ? WHITE : BLACK;
  isMyTurn = true;

  // Update UI
  updateUI();
  render();

  if (captured > 0) playSound('capture');
  else playSound('place');
}

async function handleRemotePass(payload) {
  if (payload.playerId === myUserId) return;

  consecutivePasses = payload.consecutivePasses;
  lastBoard = payload.lastBoard;
  lastMove = null;

  // Switch turn
  current = current === BLACK ? WHITE : BLACK;
  isMyTurn = true;

  updateUI();
  render();

  // Check if game ended (two consecutive passes)
  if (consecutivePasses >= 2) {
    endGame();
  }
}

async function handleRemoteEndGame(payload) {
  if (payload.playerId === myUserId) return;
  // Game already ended locally or will be calculated the same way
}

async function sendMove(row, col, captured) {
  if (!channel) return;

  // Broadcast to other player
  channel.send({
    type: 'broadcast',
    event: 'move',
    payload: {
      row,
      col,
      captured,
      board,
      captures,
      lastBoard,
      playerId: myUserId
    }
  });

  // Update room state in database
  try {
    const nextTurn = myPlayerNumber === 1 ? 2 : 1;
    await supabase.from('game_rooms').update({
      state: { board, current, captures, lastBoard, consecutivePasses, lastMove, gameOver },
      turn: nextTurn
    }).eq('id', ROOM_ID);
  } catch (e) {
    console.warn('Erro ao salvar estado:', e);
  }
}

async function sendPass() {
  if (!channel) return;

  // Broadcast to other player
  channel.send({
    type: 'broadcast',
    event: 'pass',
    payload: {
      consecutivePasses,
      lastBoard,
      playerId: myUserId
    }
  });

  // Update room state
  try {
    const nextTurn = myPlayerNumber === 1 ? 2 : 1;
    await supabase.from('game_rooms').update({
      state: { board, current, captures, lastBoard, consecutivePasses, lastMove, gameOver },
      turn: nextTurn
    }).eq('id', ROOM_ID);
  } catch (e) {
    console.warn('Erro ao salvar estado:', e);
  }
}

// ==================== GAME LOGIC ====================

function init() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  lastBoard = null;
  current = BLACK;
  captures = { [BLACK]: 0, [WHITE]: 0 };
  consecutivePasses = 0;
  lastMove = null;
  isProcessing = false;
  gameOver = false;
  modal.style.display = 'none';
  updateUI();
  render();
}

function clone(b) { return b.map(r => [...r]); }

function getGroup(b, r, c) {
  const color = b[r][c];
  if (color === EMPTY) return { stones: [], liberties: new Set() };
  const visited = new Set();
  const stones = [];
  const liberties = new Set();
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const key = `${cr},${cc}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (b[cr][cc] === color) {
      stones.push([cr, cc]);
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = cr + dr, nc = cc + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (b[nr][nc] === EMPTY) liberties.add(`${nr},${nc}`);
        else if (b[nr][nc] === color) stack.push([nr, nc]);
      }
    }
  }
  return { stones, liberties };
}

function removeCaptures(b, color) {
  let captured = 0;
  const opponent = color === BLACK ? WHITE : BLACK;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (b[r][c] === opponent) {
        const g = getGroup(b, r, c);
        if (g.liberties.size === 0) {
          g.stones.forEach(([sr, sc]) => { b[sr][sc] = EMPTY; });
          captured += g.stones.length;
        }
      }
    }
  }
  return captured;
}

function isLegal(r, c, color) {
  if (board[r][c] !== EMPTY) return false;
  const testBoard = clone(board);
  testBoard[r][c] = color;
  removeCaptures(testBoard, color);
  // Self-capture check
  const g = getGroup(testBoard, r, c);
  if (g.liberties.size === 0) return false;
  // Ko check
  if (lastBoard && JSON.stringify(testBoard) === JSON.stringify(lastBoard)) return false;
  return true;
}

function playMove(r, c) {
  if (!isLegal(r, c, current)) return false;
  lastBoard = clone(board);
  board[r][c] = current;
  const captured = removeCaptures(board, current);
  captures[current] += captured;
  lastMove = [r, c];
  consecutivePasses = 0;
  current = current === BLACK ? WHITE : BLACK;
  return captured;
}

async function pass() {
  consecutivePasses++;
  lastBoard = clone(board);
  lastMove = null;

  if (IS_MULTIPLAYER) {
    current = current === BLACK ? WHITE : BLACK;
    isMyTurn = false;
    await sendPass();
    updateUI();
    render();

    if (consecutivePasses >= 2) {
      endGame();
    }
  } else {
    // Single player mode
    current = WHITE;
    updateUI();
    render();

    if (consecutivePasses >= 2) {
      endGame();
      return;
    }

    // CPU passes or plays
    setTimeout(() => {
      if (!cpuPlay()) {
        // CPU also passes
        consecutivePasses++;
        current = BLACK;
        updateUI();
        render();

        if (consecutivePasses >= 2) {
          endGame();
        }
      }
    }, 400);
  }
}

function cpuPlay() {
  // Try to find a valid move
  const moves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (isLegal(r, c, WHITE)) {
        // Score the move
        let score = Math.random() * 2;
        score += (4 - Math.abs(r - 4)) * 0.3 + (4 - Math.abs(c - 4)) * 0.3;

        // Check captures
        const testBoard = clone(board);
        testBoard[r][c] = WHITE;
        const caps = removeCaptures(testBoard, WHITE);
        score += caps * 10;

        // Adjacent to own stones
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === WHITE) score += 2;
        }

        moves.push({ r, c, score });
      }
    }
  }

  if (moves.length === 0) return false;

  // Play best move
  moves.sort((a, b) => b.score - a.score);
  const best = moves[0];
  const captured = playMove(best.r, best.c);

  if (captured > 0) playSound('capture');
  else playSound('place');

  current = BLACK;
  updateUI();
  render();
  return true;
}

function countTerritory() {
  const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  let blackTerritory = 0, whiteTerritory = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY || visited[r][c]) continue;
      const stack = [[r, c]];
      const region = [];
      let touchesBlack = false, touchesWhite = false;
      while (stack.length) {
        const [cr, cc] = stack.pop();
        if (cr < 0 || cr >= SIZE || cc < 0 || cc >= SIZE) continue;
        if (visited[cr][cc]) continue;
        if (board[cr][cc] === BLACK) { touchesBlack = true; continue; }
        if (board[cr][cc] === WHITE) { touchesWhite = true; continue; }
        visited[cr][cc] = true;
        region.push([cr, cc]);
        stack.push([cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1]);
      }
      if (touchesBlack && !touchesWhite) blackTerritory += region.length;
      if (touchesWhite && !touchesBlack) whiteTerritory += region.length;
    }
  }
  return { blackTerritory, whiteTerritory };
}

async function endGame() {
  gameOver = true;
  const { blackTerritory, whiteTerritory } = countTerritory();
  const blackTotal = blackTerritory + captures[BLACK];
  const whiteTotal = whiteTerritory + captures[WHITE] + 6.5; // Komi

  let result, msg;
  if (blackTotal > whiteTotal) {
    result = 'win';
    msg = `🏆 Preto vence!\n\nTerritório Preto: ${blackTerritory}\nCapturas Preto: ${captures[BLACK]}\nTotal Preto: ${blackTotal.toFixed(1)} pts\n\nTerritório Branco: ${whiteTerritory}\nCapturas Branco: ${captures[WHITE]}\nKomi: 6.5\nTotal Branco: ${whiteTotal.toFixed(1)} pts`;
  } else {
    result = 'loss';
    msg = `🏆 Branco vence!\n\nTerritório Preto: ${blackTerritory}\nCapturas Preto: ${captures[BLACK]}\nTotal Preto: ${blackTotal.toFixed(1)} pts\n\nTerritório Branco: ${whiteTerritory}\nCapturas Branco: ${captures[WHITE]}\nKomi: 6.5\nTotal Branco: ${whiteTotal.toFixed(1)} pts`;
  }

  modalMsg.textContent = msg;
  modal.style.display = 'flex';

  if (blackTotal > whiteTotal) {
    launchConfetti();
    playSound('win');
  }

  // Multiplayer: save stats
  if (IS_MULTIPLAYER) {
    const myColor = myPlayerNumber === 1 ? BLACK : WHITE;
    const myTotal = myColor === BLACK ? blackTotal : whiteTotal;
    const opponentTotal = myColor === BLACK ? whiteTotal : blackTotal;
    const myResult = myTotal > opponentTotal ? 'win' : 'loss';

    // Broadcast end game
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'game_end',
        payload: { playerId: myUserId, blackTotal, whiteTotal }
      });

      // Update room status
      await supabase.from('game_rooms').update({
        status: 'finished',
        winner: myTotal > opponentTotal ? myUserId : 'opponent'
      }).eq('id', ROOM_ID);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('game_stats').insert({
        user_id: session.user.id,
        game: 'go',
        result: myResult,
        moves: 0,
        time_seconds: 0,
        room_id: ROOM_ID,
        is_multiplayer: true
      });
    }
  } else {
    // Single player stats
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('game_stats').insert({
        user_id: session.user.id,
        game: 'go',
        result: blackTotal > whiteTotal ? 'win' : 'loss',
        moves: 0,
        time_seconds: 0,
        room_id: null,
        is_multiplayer: false
      });
    }
  }
}

function cpuMove() {
  // Simple AI: try captures, then play near existing stones, then random
  let best = null;
  let bestScore = -1;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isLegal(r, c, WHITE)) continue;
      let score = Math.random() * 2;
      // Prefer center
      score += (4 - Math.abs(r - 4)) * 0.3 + (4 - Math.abs(c - 4)) * 0.3;
      // Check captures
      const testBoard = clone(board);
      testBoard[r][c] = WHITE;
      const caps = removeCaptures(testBoard, WHITE);
      score += caps * 10;
      // Adjacent to own stones
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === WHITE) score += 2;
      }
      if (score > bestScore) { bestScore = score; best = [r, c]; }
    }
  }

  if (best) {
    const captured = playMove(best[0], best[1]);
    if (captured > 0) playSound('capture');
    else playSound('place');
    updateUI();
    render();
  } else {
    pass();
  }
  isProcessing = false;
}

async function handleClick(r, c) {
  if (gameOver || isProcessing) return;

  // Multiplayer: check if it's my turn
  if (IS_MULTIPLAYER) {
    const myColor = myPlayerNumber === 1 ? BLACK : WHITE;
    if (current !== myColor || !isMyTurn) return;
  } else {
    // Single player: only allow on player turn (Black)
    if (current !== BLACK) return;
  }

  isProcessing = true;
  initAudio();

  if (!isLegal(r, c, current)) {
    isProcessing = false;
    return;
  }

  const captured = playMove(r, c);

  if (IS_MULTIPLAYER) {
    await sendMove(r, c, captured);
    isMyTurn = false;
    playSound(captured > 0 ? 'capture' : 'place');
    haptic(15);
    updateUI();
    render();
    isProcessing = false;
  } else {
    // Single player
    playSound(captured > 0 ? 'capture' : 'place');
    haptic(15);
    updateUI();
    render();
    setTimeout(() => {
      cpuMove();
    }, 800);
  }
}

function updateUI() {
  const gameContainer = document.getElementById('game-container') || document.body;

  if (IS_MULTIPLAYER) {
    const myColor = myPlayerNumber === 1 ? BLACK : WHITE;
    const opponentName = myPlayerNumber === 1 ? player2Name : player1Name;
    const myName = myPlayerNumber === 1 ? player1Name : player2Name;

    if (current === myColor && isMyTurn) {
      turnEl.textContent = `Sua vez (${myColor === BLACK ? 'Preto' : 'Branco'})`;
      gameContainer.classList.remove('thinking');
    } else {
      turnEl.textContent = `Vez de ${opponentName} (${current === BLACK ? 'Preto' : 'Branco'})...`;
      gameContainer.classList.add('thinking');
    }
  } else {
    // Single player
    if (current === BLACK) {
      turnEl.textContent = 'Sua vez (Preto)';
      gameContainer.classList.remove('thinking');
    } else {
      turnEl.textContent = 'Computador pensando...';
      gameContainer.classList.add('thinking');
    }
  }

  blackScoreEl.textContent = captures[BLACK];
  whiteScoreEl.textContent = captures[WHITE];
}

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (board[r][c] !== EMPTY) {
        const stone = document.createElement('div');
        stone.className = `stone ${board[r][c] === BLACK ? 'black' : 'white'}`;
        if (lastMove && lastMove[0] === r && lastMove[1] === c) stone.classList.add('last');
        cell.appendChild(stone);
      }

      // Only allow clicking if it's a legal move
      const myColor = IS_MULTIPLAYER ? (myPlayerNumber === 1 ? BLACK : WHITE) : BLACK;
      if (!gameOver && (!IS_MULTIPLAYER || isMyTurn) && current === myColor && board[r][c] === EMPTY) {
        cell.classList.add('clickable');
      }

      cell.addEventListener('click', () => handleClick(r, c));
      boardEl.appendChild(cell);
    }
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
      state: { board: null, current: BLACK, captures: { [BLACK]: 0, [WHITE]: 0 }, lastBoard: null, consecutivePasses: 0, lastMove: null, gameOver: false },
      turn: 1,
      status: 'playing',
      winner: null
    }).eq('id', ROOM_ID);
  }
}

// Event listeners
document.getElementById('pass-btn').addEventListener('click', async () => {
  if (gameOver) return;

  if (IS_MULTIPLAYER) {
    const myColor = myPlayerNumber === 1 ? BLACK : WHITE;
    if (current !== myColor || !isMyTurn) return;
  } else {
    if (current !== BLACK) return;
  }

  initAudio();
  playSound('click');
  await pass();
});

document.getElementById('restart').addEventListener('click', () => { initAudio(); playSound('click'); resetGame(true); });
document.getElementById('modal-btn').addEventListener('click', () => { initAudio(); playSound('click'); resetGame(true); });

// Start
initMultiplayer().then(() => {
  init();
});
