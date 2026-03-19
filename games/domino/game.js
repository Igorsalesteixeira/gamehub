import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameTimer } from '../shared/timer.js';
import { supabase } from '../../supabase.js';

// ===== CONSTANTS =====
const DOTS = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

// ===== MULTIPLAYER STATE =====
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const isMultiplayer = !!roomId;

let mpState = {
  roomId: roomId,
  playerId: null,
  playerNumber: null, // 1 or 2
  opponentId: null,
  isHost: false,
  gameStarted: false,
  subscription: null,
  syncInProgress: false
};

// ===== GAME STATE =====
let chain = [];        // [{a, b, flipped}] – flipped: b is the exposed left end (or right end depending on position)
let leftEnd = null;   // value at left open end of chain
let rightEnd = null;  // value at right open end of chain
let playerHand = [];
let opponentHand = []; // In MP: opponent's hand (count only)
let aiHand = [];      // In SP: AI hand
let boneyard = [];
let currentTurn = 'player'; // 'player' | 'opponent' | 'ai'
let gameOver = false;
let selectedTile = null;    // index into playerHand
let consecutivePasses = 0;
let playerMoves = 0;
let isProcessing = false; // Flag para prevenir cliques duplos
let gameData = null; // For MP: full game state from DB

// ===== SHARED MODULES =====
const gameStats = new GameStats('domino', { autoSync: true });
const gameTimer = new GameTimer({
  onTick: () => {
    if (!gameOver && gameStartTime) {
      timerDisplay.textContent = `⏱ ${gameTimer.getFormatted('MM:SS')}`;
    }
  }
});

// ===== DOM REFS =====
const chainArea      = document.getElementById('chain-area');
const chainEmpty     = document.getElementById('chain-empty');
const handArea       = document.getElementById('hand-area');
const opponentArea   = document.getElementById('opponent-area');
const leftEndBadge   = document.getElementById('left-end-badge');
const rightEndBadge  = document.getElementById('right-end-badge');
const turnIndicator  = document.getElementById('turn-indicator');
const btnDraw        = document.getElementById('btn-draw');
const btnPass        = document.getElementById('btn-pass');
const btnPlaceLeft   = document.getElementById('btn-place-left');
const btnPlaceRight  = document.getElementById('btn-place-right');
const btnNewGame     = document.getElementById('btn-new-game');
const btnPlayAgain   = document.getElementById('btn-play-again');
const modalOverlay   = document.getElementById('modal-overlay');
const modalIcon      = document.getElementById('modal-icon');
const modalTitle     = document.getElementById('modal-title');
const modalMsg       = document.getElementById('modal-msg');
const modalScore     = document.getElementById('modal-score');
const playerCountEl  = document.getElementById('player-count');
const boneyardTopEl  = document.getElementById('boneyard-count-top');
const opponentCountTopEl = document.getElementById('opponent-count-top');
const aiCountTopEl   = document.getElementById('ai-count-top');
const timerDisplay   = document.getElementById('timer-display');
const scoreVal       = document.getElementById('score-val');
const winsVal        = document.getElementById('wins-val');
const mpStatusEl     = document.getElementById('mp-status');
const opponentLabelEl = document.getElementById('opponent-label');

// Track wins and total score
let wins = 0;
let totalScore = 0;
let gameStartTime = null;

// ===== TILE BUILDING =====
function buildFullSet() {
  const tiles = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ a, b });
    }
  }
  return tiles;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pipTotal(hand) {
  return hand.reduce((s, t) => s + t.a + t.b, 0);
}

// ===== MULTIPLAYER FUNCTIONS =====
async function initMultiplayer() {
  if (!isMultiplayer) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showMpStatus('Erro: Faça login para jogar multiplayer', 'error');
      return;
    }

    mpState.playerId = user.id;

    // Check if room exists
    const { data: room, error } = await supabase
      .from('domino_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching room:', error);
      showMpStatus('Erro ao carregar sala', 'error');
      return;
    }

    if (!room) {
      // Create room as host (player 1)
      mpState.isHost = true;
      mpState.playerNumber = 1;
      await createRoom();
    } else if (room.player2_id === null && room.player1_id !== user.id) {
      // Join as player 2
      mpState.playerNumber = 2;
      mpState.isHost = false;
      await joinRoom(room);
    } else if (room.player1_id === user.id || room.player2_id === user.id) {
      // Reconnecting
      mpState.playerNumber = room.player1_id === user.id ? 1 : 2;
      mpState.isHost = room.player1_id === user.id;
      await reconnectToRoom(room);
    } else {
      showMpStatus('Sala cheia', 'error');
      return;
    }

    // Subscribe to room changes
    subscribeToRoom();

  } catch (err) {
    console.error('MP init error:', err);
    showMpStatus('Erro ao iniciar multiplayer', 'error');
  }
}

async function createRoom() {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('domino_rooms')
    .insert({
      id: roomId,
      player1_id: user.id,
      player1_hand: [],
      player2_hand: [],
      chain: [],
      boneyard: [],
      current_turn: null,
      game_status: 'waiting',
      left_end: null,
      right_end: null,
      consecutive_passes: 0,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error creating room:', error);
    showMpStatus('Erro ao criar sala', 'error');
    return;
  }

  showMpStatus('Sala criada. Aguardando oponente...', 'waiting');
}

async function joinRoom(room) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('domino_rooms')
    .update({
      player2_id: user.id,
      game_status: 'playing',
      current_turn: 'player1'
    })
    .eq('id', roomId);

  if (error) {
    console.error('Error joining room:', error);
    showMpStatus('Erro ao entrar na sala', 'error');
    return;
  }

  mpState.opponentId = room.player1_id;

  // Initialize game - host deals
  if (!mpState.isHost) {
    await initMultiplayerGame();
  }
}

async function reconnectToRoom(room) {
  mpState.opponentId = mpState.playerNumber === 1 ? room.player2_id : room.player1_id;
  gameData = room;

  if (room.game_status === 'playing' || room.game_status === 'finished') {
    await loadGameState(room);
  } else {
    showMpStatus('Aguardando oponente...', 'waiting');
  }
}

async function initMultiplayerGame() {
  // Generate and shuffle tiles
  const allTiles = shuffle(buildFullSet());

  // Deal 7 tiles to each player
  const player1Hand = allTiles.slice(0, 7);
  const player2Hand = allTiles.slice(7, 14);
  const remainingBoneyard = allTiles.slice(14);

  // Determine who goes first (highest double)
  let firstPlayer = 'player1';
  let foundDouble = false;

  for (let d = 6; d >= 0 && !foundDouble; d--) {
    const p1Has = player1Hand.findIndex(t => t.a === d && t.b === d);
    const p2Has = player2Hand.findIndex(t => t.a === d && t.b === d);

    if (p1Has !== -1 || p2Has !== -1) {
      foundDouble = true;
      if (p2Has !== -1) firstPlayer = 'player2';
    }
  }

  // If no doubles, check highest total
  if (!foundDouble) {
    const p1Max = Math.max(...player1Hand.map(t => t.a + t.b));
    const p2Max = Math.max(...player2Hand.map(t => t.a + t.b));
    if (p2Max > p1Max) firstPlayer = 'player2';
  }

  // Update room with initial state
  const { error } = await supabase
    .from('domino_rooms')
    .update({
      player1_hand: player1Hand,
      player2_hand: player2Hand,
      boneyard: remainingBoneyard,
      chain: [],
      current_turn: firstPlayer,
      game_status: 'playing',
      left_end: null,
      right_end: null,
      consecutive_passes: 0,
      started_at: new Date().toISOString()
    })
    .eq('id', roomId);

  if (error) {
    console.error('Error initializing game:', error);
  }
}

function subscribeToRoom() {
  mpState.subscription = supabase
    .channel(`domino_room:${roomId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'domino_rooms',
      filter: `id=eq.${roomId}`
    }, handleRoomUpdate)
    .subscribe();
}

async function handleRoomUpdate(payload) {
  if (mpState.syncInProgress) return;

  const newData = payload.new;
  gameData = newData;

  // Handle game start
  if (newData.game_status === 'playing' && !mpState.gameStarted) {
    mpState.gameStarted = true;
    showMpStatus('Jogo iniciado!', 'playing');
    await loadGameState(newData);
    gameTimer.start();
  }

  // Handle game updates
  if (newData.game_status === 'playing') {
    await syncGameState(newData);
  }

  // Handle game end
  if (newData.game_status === 'finished') {
    handleGameEnd(newData);
  }

  // Handle opponent disconnect
  if (newData.game_status === 'abandoned') {
    showMpStatus('Oponente desconectou', 'error');
    gameOver = true;
  }
}

async function loadGameState(roomData) {
  mpState.gameStarted = true;

  // Load chain
  chain = roomData.chain || [];
  leftEnd = roomData.left_end;
  rightEnd = roomData.right_end;
  consecutivePasses = roomData.consecutive_passes || 0;
  boneyard = roomData.boneyard || [];

  // Load player's hand
  if (mpState.playerNumber === 1) {
    playerHand = roomData.player1_hand || [];
    opponentHand = roomData.player2_hand || [];
  } else {
    playerHand = roomData.player2_hand || [];
    opponentHand = roomData.player1_hand || [];
  }

  // Determine current turn
  const isMyTurn = roomData.current_turn === (mpState.playerNumber === 1 ? 'player1' : 'player2');
  currentTurn = isMyTurn ? 'player' : 'opponent';

  renderAll();
  updateEndBadges();
  updateTopBar();
  setTurnIndicator(isMyTurn ? 'player' : 'opponent');
}

async function syncGameState(roomData) {
  mpState.syncInProgress = true;

  // Update chain
  chain = roomData.chain || [];
  leftEnd = roomData.left_end;
  rightEnd = roomData.right_end;
  consecutivePasses = roomData.consecutive_passes || 0;
  boneyard = roomData.boneyard || [];

  // Update opponent hand count
  if (mpState.playerNumber === 1) {
    opponentHand = roomData.player2_hand || [];
  } else {
    opponentHand = roomData.player1_hand || [];
  }

  // Update turn
  const isMyTurn = roomData.current_turn === (mpState.playerNumber === 1 ? 'player1' : 'player2');
  currentTurn = isMyTurn ? 'player' : 'opponent';

  renderAll();
  updateEndBadges();
  updateTopBar();
  setTurnIndicator(isMyTurn ? 'player' : 'opponent');

  // Check win conditions
  if (roomData.winner) {
    handleGameEnd(roomData);
  }

  mpState.syncInProgress = false;
}

async function updateGameState(updates) {
  if (!isMultiplayer || mpState.syncInProgress) return;

  const { error } = await supabase
    .from('domino_rooms')
    .update(updates)
    .eq('id', roomId);

  if (error) {
    console.error('Error updating game:', error);
  }
}

function showMpStatus(message, type) {
  if (!mpStatusEl) return;
  mpStatusEl.textContent = message;
  mpStatusEl.className = `mp-status ${type}`;
}

// ===== INIT GAME =====
function initGame() {
  if (isMultiplayer) {
    initMultiplayer();
    return;
  }

  // Single player initialization
  gameOver = false;
  selectedTile = null;
  consecutivePasses = 0;
  playerMoves = 0;
  isProcessing = false;
  chain = [];
  leftEnd = null;
  rightEnd = null;

  const all = shuffle(buildFullSet());
  playSound('shuffle');
  playerHand = all.slice(0, 7);
  aiHand = all.slice(7, 14);
  boneyard = all.slice(14);

  // Determine who goes first: player with [6,6], else highest double, else highest tile
  const firstPlayer = determineFirstPlayer();
  currentTurn = firstPlayer;

  gameTimer.reset().start();
  gameStartTime = Date.now();
  renderAll();
  updateEndBadges();
  updateTopBar();

  if (currentTurn === 'ai') {
    setTurnIndicator('ai');
    setTimeout(aiTurn, 1000);
  } else {
    setTurnIndicator('player');
  }
}

function determineFirstPlayer() {
  // Find highest double: check [6,6], [5,5], ... for both players
  for (let d = 6; d >= 0; d--) {
    const pi = playerHand.findIndex(t => t.a === d && t.b === d);
    const ai = aiHand.findIndex(t => t.a === d && t.b === d);
    if (pi !== -1 || ai !== -1) {
      // Player holds this double?
      if (pi !== -1) return 'player';
      return 'ai';
    }
  }
  // No doubles: player with highest single tile goes first
  const playerMax = Math.max(...playerHand.map(t => t.a + t.b));
  const aiMax = Math.max(...aiHand.map(t => t.a + t.b));
  return playerMax >= aiMax ? 'player' : 'ai';
}

// ===== RENDER =====
function renderAll() {
  renderChain();
  renderHand();
  renderOpponentHand();
  renderButtons();
}

function renderChain() {
  if (chain.length === 0) {
    chainEmpty.style.display = '';
    // remove all tiles except chainEmpty
    [...chainArea.children].forEach(el => {
      if (el !== chainEmpty) el.remove();
    });
    return;
  }
  chainEmpty.style.display = 'none';

  // Clear and re-render
  chainArea.innerHTML = '';
  chain.forEach((tile, idx) => {
    const el = createTileEl(tile.a, tile.b, 'chain-tile');
    if (idx === chain.length - 1) el.classList.add('new-tile');
    chainArea.appendChild(el);
  });

  // Auto-scroll to end
  chainArea.parentElement.scrollLeft = chainArea.parentElement.scrollWidth;
}

function renderHand() {
  handArea.innerHTML = '';
  const validLeft  = leftEnd === null ? Array.from({length: playerHand.length}, (_, i) => i)
                                      : playerHand.map((t, i) => canFitEnd(t, leftEnd) ? i : -1).filter(i => i !== -1);
  const validRight = leftEnd === null ? Array.from({length: playerHand.length}, (_, i) => i)
                                      : playerHand.map((t, i) => canFitEnd(t, rightEnd) ? i : -1).filter(i => i !== -1);
  const validSet   = new Set([...validLeft, ...validRight]);

  playerHand.forEach((tile, i) => {
    const el = createTileEl(tile.a, tile.b, 'hand-tile');
    if (i === selectedTile) el.classList.add('selected');
    if (validSet.has(i) && chain.length > 0) el.classList.add('valid-move');
    el.addEventListener('click', () => onTileClick(i));
    handArea.appendChild(el);
  });

  playerCountEl.textContent = playerHand.length;
}

function renderOpponentHand() {
  if (!isMultiplayer) return;

  const opponentAreaEl = document.getElementById('opponent-hand-area');
  if (!opponentAreaEl) return;

  opponentAreaEl.innerHTML = '';
  const opponentCount = isMultiplayer ? opponentHand.length : aiHand.length;

  for (let i = 0; i < opponentCount; i++) {
    const el = createBackTileEl();
    opponentAreaEl.appendChild(el);
  }
}

function renderButtons() {
  if (gameOver || currentTurn !== 'player') {
    btnDraw.classList.add('hidden');
    btnPass.classList.add('hidden');
    btnPlaceLeft.classList.add('hidden');
    btnPlaceRight.classList.add('hidden');
    return;
  }

  const hasValid = playerHasValidMove();

  if (hasValid) {
    btnDraw.classList.add('hidden');
    btnPass.classList.add('hidden');
  } else if (boneyard.length > 0) {
    btnDraw.classList.remove('hidden');
    btnPass.classList.add('hidden');
  } else {
    btnDraw.classList.add('hidden');
    btnPass.classList.remove('hidden');
  }

  // Place buttons: show if a tile is selected and it fits ends
  if (selectedTile !== null) {
    const tile = playerHand[selectedTile];
    const fitsLeft  = leftEnd === null || canFitEnd(tile, leftEnd);
    const fitsRight = leftEnd === null || canFitEnd(tile, rightEnd);

    if (chain.length === 0) {
      // First tile: only one button needed, use right to place
      btnPlaceLeft.classList.add('hidden');
      btnPlaceRight.classList.remove('hidden');
      btnPlaceRight.textContent = 'Colocar ✓';
    } else if (fitsLeft && fitsRight) {
      btnPlaceLeft.classList.remove('hidden');
      btnPlaceRight.classList.remove('hidden');
      btnPlaceRight.textContent = 'Direita ➡';
    } else if (fitsLeft) {
      btnPlaceLeft.classList.remove('hidden');
      btnPlaceRight.classList.add('hidden');
    } else if (fitsRight) {
      btnPlaceLeft.classList.add('hidden');
      btnPlaceRight.classList.remove('hidden');
      btnPlaceRight.textContent = 'Direita ➡';
    } else {
      btnPlaceLeft.classList.add('hidden');
      btnPlaceRight.classList.add('hidden');
    }
  } else {
    btnPlaceLeft.classList.add('hidden');
    btnPlaceRight.classList.add('hidden');
  }
}

function createTileEl(a, b, cls) {
  const el = document.createElement('div');
  el.className = `domino ${cls}`;

  const halfA = createHalf(a);
  const divider = document.createElement('div');
  divider.className = 'divider-h';
  const halfB = createHalf(b);

  el.appendChild(halfA);
  el.appendChild(divider);
  el.appendChild(halfB);
  return el;
}

function createBackTileEl() {
  const el = document.createElement('div');
  el.className = 'domino hand-tile back-tile';

  // Create pattern for back of tile
  const pattern = document.createElement('div');
  pattern.className = 'back-pattern';
  el.appendChild(pattern);

  return el;
}

function createHalf(pips) {
  const half = document.createElement('div');
  half.className = 'half';
  const filled = new Set(DOTS[pips]);
  for (let pos = 0; pos < 9; pos++) {
    const dot = document.createElement('div');
    dot.className = filled.has(pos) ? 'dot' : 'dot hidden-dot';
    half.appendChild(dot);
  }
  return half;
}

function updateEndBadges() {
  if (leftEnd === null) {
    leftEndBadge.textContent  = '— ?';
    rightEndBadge.textContent = '? —';
  } else {
    leftEndBadge.textContent  = `← ${leftEnd}`;
    rightEndBadge.textContent = `${rightEnd} →`;
  }
}

function updateTopBar() {
  boneyardTopEl.textContent = `🁣 ${boneyard.length}`;

  if (isMultiplayer) {
    opponentCountTopEl.textContent = `👤 ${opponentHand.length}`;
    if (opponentLabelEl) opponentLabelEl.textContent = 'Oponente';
  } else {
    aiCountTopEl.textContent = `🤖 ${aiHand.length}`;
    if (opponentLabelEl) opponentLabelEl.textContent = 'IA';
  }

  scoreVal.textContent = totalScore;
  winsVal.textContent = wins;
}

function setTurnIndicator(who, thinking = false) {
  const gameLayout = document.querySelector('.game-layout') || document.body;

  if (isMultiplayer) {
    if (who === 'player') {
      turnIndicator.textContent = 'Sua vez';
      turnIndicator.className = 'turn-indicator';
      gameLayout.classList.remove('thinking');
    } else {
      turnIndicator.textContent = 'Vez do oponente';
      turnIndicator.className = 'turn-indicator ai-turn';
      gameLayout.classList.add('thinking');
    }
  } else {
    if (thinking) {
      turnIndicator.textContent = 'Computador pensando…';
      turnIndicator.className = 'turn-indicator thinking';
      gameLayout.classList.add('thinking');
    } else if (who === 'player') {
      turnIndicator.textContent = 'Sua vez';
      turnIndicator.className = 'turn-indicator';
      gameLayout.classList.remove('thinking');
    } else {
      turnIndicator.textContent = 'Vez da IA';
      turnIndicator.className = 'turn-indicator ai-turn';
      gameLayout.classList.add('thinking');
    }
  }
}

// ===== GAME LOGIC =====
function canFitEnd(tile, endVal) {
  return tile.a === endVal || tile.b === endVal;
}

function playerHasValidMove() {
  if (chain.length === 0) return true; // any tile can start
  return playerHand.some(t => canFitEnd(t, leftEnd) || canFitEnd(t, rightEnd));
}

function aiHasValidMove() {
  if (chain.length === 0) return aiHand.length > 0;
  return aiHand.some(t => canFitEnd(t, leftEnd) || canFitEnd(t, rightEnd));
}

function opponentHasValidMove() {
  if (chain.length === 0) return opponentHand.length > 0;
  return opponentHand.some(t => canFitEnd(t, leftEnd) || canFitEnd(t, rightEnd));
}

/**
 * Place a tile onto the chain.
 * side: 'left' | 'right'
 * Returns false if invalid.
 */
function placeTile(tile, tileIndex, hand, side) {
  if (chain.length === 0) {
    // First tile placed
    chain.push({ a: tile.a, b: tile.b, flipped: false });
    leftEnd  = tile.a;
    rightEnd = tile.b;
  } else if (side === 'left') {
    if (!canFitEnd(tile, leftEnd)) return false;
    // Orient: the side matching leftEnd goes against the chain
    const flipped = tile.b === leftEnd; // if b matches, place a as new end
    chain.unshift({ a: tile.a, b: tile.b, flipped });
    leftEnd = flipped ? tile.a : tile.b;
  } else {
    if (!canFitEnd(tile, rightEnd)) return false;
    const flipped = tile.a === rightEnd; // if a matches, place b as new end
    chain.push({ a: tile.a, b: tile.b, flipped });
    rightEnd = flipped ? tile.b : tile.a;
  }

  hand.splice(tileIndex, 1);
  return true;
}

// ===== PLAYER ACTIONS =====
function onTileClick(idx) {
  if (gameOver || currentTurn !== 'player' || isProcessing) return;
  initAudio();

  const tile = playerHand[idx];

  // If chain is empty, auto-place on click
  if (chain.length === 0) {
    selectedTile = idx;
    doPlayerPlace('right');
    return;
  }

  const fitsLeft  = canFitEnd(tile, leftEnd);
  const fitsRight = canFitEnd(tile, rightEnd);

  if (!fitsLeft && !fitsRight) return; // tile doesn't fit anywhere

  if (fitsLeft && fitsRight) {
    // Need player to choose: select
    selectedTile = idx;
    renderHand();
    renderButtons();
    return;
  }

  // Only fits one end: auto-place
  selectedTile = idx;
  doPlayerPlace(fitsLeft ? 'left' : 'right');
}

async function doPlayerPlace(side) {
  if (selectedTile === null || isProcessing) return;
  isProcessing = true;

  const tile = playerHand[selectedTile];
  const ok = placeTile(tile, selectedTile, playerHand, side);
  if (!ok) {
    isProcessing = false;
    return;
  }

  playerMoves++;
  consecutivePasses = 0;
  selectedTile = null;
  playSound('move');
  haptic(15);

  updateEndBadges();
  updateTopBar();
  renderAll();

  // Multiplayer: sync to server
  if (isMultiplayer) {
    const nextTurn = mpState.playerNumber === 1 ? 'player2' : 'player1';
    await updateGameState({
      chain: chain,
      left_end: leftEnd,
      right_end: rightEnd,
      consecutive_passes: consecutivePasses,
      current_turn: nextTurn,
      [`player${mpState.playerNumber}_hand`]: playerHand
    });

    currentTurn = 'opponent';
    setTurnIndicator('opponent');
    renderButtons();

    // Check win
    if (playerHand.length === 0) {
      await endMultiplayerGame('player');
    }
  } else {
    if (checkWin('player')) return;
    endPlayerTurn();
  }

  isProcessing = false;
}

function endPlayerTurn() {
  currentTurn = isMultiplayer ? 'opponent' : 'ai';
  setTurnIndicator(isMultiplayer ? 'opponent' : 'ai', !isMultiplayer);
  renderButtons();

  if (!isMultiplayer) {
    // Delay mínimo de 800ms para jogadas da IA
    setTimeout(() => {
      aiTurn();
    }, 800);
  }
}

btnPlaceLeft.addEventListener('click', () => doPlayerPlace('left'));
btnPlaceRight.addEventListener('click', () => doPlayerPlace('right'));

btnDraw.addEventListener('click', async () => {
  if (gameOver || currentTurn !== 'player') return;
  if (boneyard.length === 0) return;

  const tile = drawFromBoneyard(playerHand);
  if (tile) {
    playSound('draw');
    haptic(10);
  }

  // Multiplayer: sync
  if (isMultiplayer) {
    await updateGameState({
      boneyard: boneyard,
      [`player${mpState.playerNumber}_hand`]: playerHand
    });
  }

  updateTopBar();
  renderHand();
  renderButtons();

  // If player now has a valid move, let them play; else check again
  if (!playerHasValidMove() && boneyard.length === 0) {
    // Must pass
    btnPass.classList.remove('hidden');
    btnDraw.classList.add('hidden');
  }
});

btnPass.addEventListener('click', async () => {
  if (gameOver || currentTurn !== 'player') return;

  consecutivePasses++;

  if (consecutivePasses >= 2) {
    if (isMultiplayer) {
      await resolveMultiplayerBlocked();
    } else {
      resolveBlocked();
    }
    return;
  }

  selectedTile = null;

  // Multiplayer: sync pass
  if (isMultiplayer) {
    const nextTurn = mpState.playerNumber === 1 ? 'player2' : 'player1';
    await updateGameState({
      consecutive_passes: consecutivePasses,
      current_turn: nextTurn
    });
    currentTurn = 'opponent';
    setTurnIndicator('opponent');
    renderButtons();
  } else {
    endPlayerTurn();
  }
});

btnNewGame.addEventListener('click', () => {
  initAudio();
  playSound('click');
  gameTimer.stop();

  if (isMultiplayer) {
    // Reset multiplayer game
    if (mpState.isHost) {
      initMultiplayerGame();
    }
  } else {
    initGame();
  }
});

btnPlayAgain.addEventListener('click', () => {
  initAudio();
  playSound('click');
  modalOverlay.classList.add('hidden');
  gameTimer.stop();

  if (isMultiplayer) {
    if (mpState.isHost) {
      initMultiplayerGame();
    }
  } else {
    initGame();
  }
});

// ===== DRAW FROM BONEYARD =====
function drawFromBoneyard(hand) {
  if (boneyard.length === 0) return null;
  const tile = boneyard.pop();
  hand.push(tile);
  return tile;
}

// ===== AI TURN =====
function aiTurn() {
  if (gameOver || isMultiplayer) return;

  setTurnIndicator('ai', true);

  setTimeout(() => {
    if (chain.length === 0) {
      // AI places highest value tile as first
      const bestIdx = findBestTileIdx(aiHand);
      placeTile(aiHand[bestIdx], bestIdx, aiHand, 'right');
      consecutivePasses = 0;
    } else if (aiHasValidMove()) {
      // Find best playable tile
      const move = findBestAiMove();
      if (move) {
        placeTile(aiHand[move.idx], move.idx, aiHand, move.side);
        consecutivePasses = 0;
      }
    } else {
      // Draw until valid or empty
      let drew = false;
      while (boneyard.length > 0) {
        const t = drawFromBoneyard(aiHand);
        if (canFitEnd(t, leftEnd) || canFitEnd(t, rightEnd)) {
          drew = true;
          break;
        }
      }

      if (!drew) {
        // Pass
        consecutivePasses++;
        if (consecutivePasses >= 2) {
          updateEndBadges();
          updateTopBar();
          renderAll();
          resolveBlocked();
          return;
        }
      } else {
        // Now play the drawn tile
        const move = findBestAiMove();
        if (move) {
          placeTile(aiHand[move.idx], move.idx, aiHand, move.side);
          consecutivePasses = 0;
        }
      }
    }

    updateEndBadges();
    updateTopBar();
    renderAll();

    if (checkWin('ai')) return;

    currentTurn = 'player';
    setTurnIndicator('player');
    renderButtons();
    isProcessing = false;
  }, 400);
}

function findBestTileIdx(hand) {
  let best = 0;
  let bestVal = -1;
  hand.forEach((t, i) => {
    const val = t.a + t.b;
    if (val > bestVal) { bestVal = val; best = i; }
  });
  return best;
}

function findBestAiMove() {
  let bestMove = null;
  let bestVal  = -1;

  aiHand.forEach((tile, idx) => {
    const fitsLeft  = canFitEnd(tile, leftEnd);
    const fitsRight = canFitEnd(tile, rightEnd);
    const val = tile.a + tile.b;

    if (fitsLeft && val > bestVal) {
      bestVal  = val;
      bestMove = { idx, side: 'left' };
    }
    if (fitsRight && val > bestVal) {
      bestVal  = val;
      bestMove = { idx, side: 'right' };
    }
  });

  return bestMove;
}

// ===== MULTIPLAYER GAME END =====
async function endMultiplayerGame(winner) {
  gameOver = true;
  gameTimer.stop();

  const playerPips = pipTotal(playerHand);
  const opponentPips = pipTotal(opponentHand);
  let score = 0;

  if (winner === 'player') {
    score = opponentPips;
    wins++;
    totalScore += score;

    modalIcon.textContent = '🏆';
    modalTitle.textContent = 'Você venceu!';
    modalMsg.textContent = `Pontuação: ${score} pinos do adversário.`;
    modalScore.textContent = `Total acumulado: ${totalScore} pts`;
    launchConfetti();
    playSound('win');
  } else {
    modalIcon.textContent = '😞';
    modalTitle.textContent = 'Você perdeu!';
    modalMsg.textContent = `Você ainda tinha ${playerPips} pinos.`;
    modalScore.textContent = `Continue treinando!`;
  }

  modalOverlay.classList.remove('hidden');

  // Update server
  await updateGameState({
    game_status: 'finished',
    winner: winner === 'player' ? mpState.playerId : mpState.opponentId,
    final_score: score
  });

  // Save stats using shared module
  if (winner === 'player') {
    gameStats.recordGame(true, { score, time: gameTimer.getTime() });
  }
}

async function resolveMultiplayerBlocked() {
  const playerPips = pipTotal(playerHand);
  const opponentPips = pipTotal(opponentHand);

  let winner;
  if (playerPips < opponentPips) {
    winner = 'player';
  } else if (opponentPips < playerPips) {
    winner = 'opponent';
  } else {
    winner = 'draw';
  }

  await endMultiplayerGame(winner);
}

function handleGameEnd(roomData) {
  if (gameOver) return;
  gameOver = true;
  gameTimer.stop();

  const winnerId = roomData.winner;
  const isPlayerWinner = winnerId === mpState.playerId;
  const playerPips = pipTotal(playerHand);
  const opponentPips = pipTotal(opponentHand);

  if (isPlayerWinner) {
    const score = opponentPips;
    wins++;
    totalScore += score;
    winsVal.textContent = wins;
    scoreVal.textContent = totalScore;

    modalIcon.textContent = '🏆';
    modalTitle.textContent = 'Você venceu!';
    modalMsg.textContent = `Pontuação: ${score} pinos do adversário.`;
    modalScore.textContent = `Total acumulado: ${totalScore} pts`;
    launchConfetti();
    playSound('win');

    // Save stats using shared module
    gameStats.recordGame(true, { score, time: gameTimer.getTime() });
  } else if (winnerId === 'draw') {
    modalIcon.textContent = '🤝';
    modalTitle.textContent = 'Empate!';
    modalMsg.textContent = 'Jogo bloqueado — mesma contagem de pinos.';
    modalScore.textContent = '';
  } else {
    modalIcon.textContent = '😞';
    modalTitle.textContent = 'Você perdeu!';
    modalMsg.textContent = `Você ainda tinha ${playerPips} pinos.`;
    modalScore.textContent = 'Continue treinando!';
  }

  modalOverlay.classList.remove('hidden');
}

// ===== WIN / END =====
function checkWin(who) {
  const hand = who === 'player' ? playerHand : aiHand;
  if (hand.length === 0) {
    const opponentPips = who === 'player' ? pipTotal(aiHand) : pipTotal(playerHand);
    endGame(who, opponentPips);
    return true;
  }
  return false;
}

function resolveBlocked() {
  const playerPips = pipTotal(playerHand);
  const aiPips     = pipTotal(aiHand);

  if (playerPips < aiPips) {
    endGame('player', aiPips - playerPips);
  } else if (aiPips < playerPips) {
    endGame('ai', playerPips - aiPips);
  } else {
    endGame('draw', 0);
  }
}

function endGame(winner, score) {
  gameOver = true;
  gameTimer.stop();
  renderButtons();

  const elapsed = gameTimer.getTime();

  if (winner === 'player') {
    wins++;
    totalScore += score;
    winsVal.textContent  = wins;
    scoreVal.textContent = totalScore;

    modalIcon.textContent  = '🏆';
    modalTitle.textContent = 'Você venceu!';
    modalMsg.textContent   = `Pontuação: ${score} pinos do adversário.`;
    modalScore.textContent = `Total acumulado: ${totalScore} pts`;
    launchConfetti();
    playSound('win');

    // Save stats using shared module
    gameStats.recordGame(true, { score, time: elapsed });
  } else if (winner === 'ai') {
    modalIcon.textContent  = '😞';
    modalTitle.textContent = 'IA venceu!';
    modalMsg.textContent   = `Você ainda tinha ${pipTotal(playerHand)} pinos.`;
    modalScore.textContent = `Continue treinando!`;
  } else {
    modalIcon.textContent  = '🤝';
    modalTitle.textContent = 'Empate!';
    modalMsg.textContent   = `Jogo bloqueado — mesma contagem de pinos.`;
    modalScore.textContent = ``;
  }

  modalOverlay.classList.remove('hidden');
}

// ===== CLEANUP =====
window.addEventListener('beforeunload', async () => {
  if (isMultiplayer && mpState.subscription) {
    await supabase.removeChannel(mpState.subscription);

    // Mark room as abandoned if leaving
    if (gameData && !gameOver) {
      await supabase
        .from('domino_rooms')
        .update({ game_status: 'abandoned' })
        .eq('id', roomId);
    }
  }
  gameStats.destroy();
  gameTimer.destroy();
});

// ===== KICK OFF =====
initGame();
