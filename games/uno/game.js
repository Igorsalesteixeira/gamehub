import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, initAudio } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';
import { GameStats } from '../shared/game-core.js';

// === GameStats ===
const gameStats = new GameStats('uno', { autoSync: true });

// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

// Initialize audio on first user interaction
let audioInitialized = false;
function ensureAudio() {
  if (!audioInitialized) {
    initAudio();
    audioInitialized = true;
  }
}

// === MULTIPLAYER STATE ===
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const isMultiplayer = !!roomId;
let playerId = null; // 0 or 1 in multiplayer
let opponentId = null; // 1 or 0 in multiplayer
let multiplayerChannel = null;
let isHost = false;
let playerName = '';
let opponentName = '';
let opponentConnected = false;

// === DOM ===
const playerHandEl = document.getElementById('player-hand');
const discardPileEl = document.getElementById('discard-pile');
const drawPileEl = document.getElementById('draw-pile');
const directionEl = document.getElementById('direction-display');
const messageEl = document.getElementById('message');
const btnDraw = document.getElementById('btn-draw');
const btnUno = document.getElementById('btn-uno');
const btnNew = document.getElementById('btn-new');
const unoBadge = document.getElementById('uno-badge');
const colorPickerOverlay = document.getElementById('color-picker-overlay');
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalBtn = document.getElementById('modal-btn');

// === CONSTANTS ===
const COLORS = ['red', 'blue', 'green', 'yellow'];
const NUMBERS = ['0','1','2','3','4','5','6','7','8','9'];
const SPECIALS = ['skip', 'reverse', 'draw2'];
const SPECIAL_LABELS = { skip: '⊘', reverse: '⟳', draw2: '+2', wild: '★', wild4: '+4' };

// === STATE ===
let drawPile = [];
let discardPile = [];
let hands = [[], [], [], []]; // 0=player, 1-3=CPU (or 0=host, 1=guest in 2-player MP)
let currentPlayer = 0;
let direction = 1; // 1=clockwise, -1=counter
let currentColor = '';
let gameActive = false;
let mustDraw = 0; // accumulated draw2/draw4
let calledUno = false;
let pendingWildCard = null;
let moveCount = 0;
let isProcessing = false;

// === DECK ===
function createDeck() {
  const d = [];
  for (const color of COLORS) {
    // One 0 per color
    d.push({ color, value: '0', type: 'number' });
    // Two of each 1-9
    for (let n = 1; n <= 9; n++) {
      d.push({ color, value: String(n), type: 'number' });
      d.push({ color, value: String(n), type: 'number' });
    }
    // Two of each special
    for (const sp of SPECIALS) {
      d.push({ color, value: sp, type: 'special' });
      d.push({ color, value: sp, type: 'special' });
    }
  }
  // 4 wilds, 4 wild draw fours
  for (let i = 0; i < 4; i++) {
    d.push({ color: 'wild', value: 'wild', type: 'wild' });
    d.push({ color: 'wild', value: 'wild4', type: 'wild' });
  }
  return d;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawCard() {
  if (drawPile.length === 0) {
    // Reshuffle discard into draw
    const top = discardPile.pop();
    drawPile = shuffle(discardPile);
    discardPile = [top];
    // Reset wild colors
    drawPile.forEach(c => { if (c.type === 'wild') c.color = 'wild'; });
  }
  return drawPile.pop() || null;
}

// === CARD DISPLAY ===
function getCardDisplay(card) {
  if (card.type === 'number') return card.value;
  return SPECIAL_LABELS[card.value] || card.value;
}

function getCardLabel(card) {
  const labels = {
    skip: 'Bloqueio', reverse: 'Reverter', draw2: 'Compre 2',
    wild: 'Coringa', wild4: 'Coringa +4'
  };
  if (card.type === 'number') return card.value;
  return labels[card.value] || card.value;
}

function createUnoCardEl(card, clickable = false) {
  const el = document.createElement('div');
  const displayColor = card.type === 'wild' && card.color === 'wild' ? 'wild' : card.color;
  el.className = `uno-card color-${displayColor}`;
  el.innerHTML = `<span class="card-value">${getCardDisplay(card)}</span><span class="card-label">${getCardLabel(card)}</span>`;
  if (clickable) {
    el.style.cursor = 'pointer';
  }
  return el;
}

function createCardBackEl() {
  const el = document.createElement('div');
  el.className = 'opp-card-back';
  return el;
}

// === RENDER ===
function render() {
  // Player hand - only show own cards
  playerHandEl.innerHTML = '';
  const myHand = isMultiplayer ? hands[playerId] : hands[0];
  myHand.forEach((card, i) => {
    const el = createUnoCardEl(card, true);
    el.addEventListener('click', () => playerPlayCard(i));
    el.addEventListener('touchend', (e) => { e.preventDefault(); playerPlayCard(i); });
    playerHandEl.appendChild(el);
  });

  // Discard pile
  const topDiscard = discardPile[discardPile.length - 1];
  if (topDiscard) {
    discardPileEl.innerHTML = '';
    const dCard = createUnoCardEl(topDiscard);
    discardPileEl.appendChild(dCard);
    const label = document.createElement('div');
    label.className = 'pile-label';
    label.textContent = 'Descarte';
    discardPileEl.appendChild(label);
  }

  if (isMultiplayer) {
    // Multiplayer: show opponent (only 1 opponent)
    renderMultiplayerOpponent();
  } else {
    // Single player: show 3 CPU opponents
    renderSinglePlayerOpponents();
  }

  // Direction
  directionEl.textContent = direction === 1 ? '→' : '←';

  // UNO badge
  const myCards = isMultiplayer ? hands[playerId] : hands[0];
  unoBadge.style.display = (myCards.length === 1 && calledUno) ? '' : 'none';

  // Draw button - only enable on my turn
  const myTurn = isMultiplayer ? (currentPlayer === playerId) : (currentPlayer === 0);
  btnDraw.disabled = !myTurn || !gameActive;
  btnUno.style.display = (myCards.length === 2 && myTurn && gameActive) ? '' : 'none';
}

function renderSinglePlayerOpponents() {
  for (let i = 1; i <= 3; i++) {
    const countEl = document.getElementById(`opp-count-${i}`);
    const cardsEl = document.getElementById(`opp-cards-${i}`);
    const oppEl = document.getElementById(`opponent-${i}`);

    countEl.textContent = hands[i].length;
    cardsEl.innerHTML = '';
    const show = Math.min(hands[i].length, 10);
    for (let j = 0; j < show; j++) {
      cardsEl.appendChild(createCardBackEl());
    }

    oppEl.classList.toggle('active-turn', currentPlayer === i && gameActive);
  }

  // Player section turn indicator
  const playerSection = document.querySelector('.player-section');
  const isPlayerTurn = currentPlayer === 0 && gameActive;
  playerSection?.classList.toggle('active-turn', isPlayerTurn);
  playerSection?.classList.toggle('disabled', !isPlayerTurn);
}

function renderMultiplayerOpponent() {
  // Update opponent display
  const oppCountEl = document.getElementById('opp-count-1');
  const oppCardsEl = document.getElementById('opp-cards-1');
  const oppEl = document.getElementById('opponent-1');
  const oppNameEl = document.querySelector('#opponent-1 .opp-name');

  if (oppNameEl) oppNameEl.textContent = opponentName || 'Oponente';
  if (oppCountEl) oppCountEl.textContent = hands[opponentId]?.length || 0;
  if (oppCardsEl) {
    oppCardsEl.innerHTML = '';
    const cardCount = hands[opponentId]?.length || 0;
    const show = Math.min(cardCount, 10);
    for (let j = 0; j < show; j++) {
      oppCardsEl.appendChild(createCardBackEl());
    }
  }

  if (oppEl) {
    oppEl.classList.toggle('active-turn', currentPlayer === opponentId && gameActive);
  }

  // Player section turn indicator
  const playerSection = document.querySelector('.player-section');
  const isPlayerTurn = currentPlayer === playerId && gameActive;
  playerSection?.classList.toggle('active-turn', isPlayerTurn);
  playerSection?.classList.toggle('disabled', !isPlayerTurn);

  // Update connection status
  updateConnectionStatus();
}

function updateConnectionStatus() {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) {
    if (opponentConnected) {
      statusEl.textContent = '🟢 Oponente conectado';
      statusEl.className = 'connection-status connected';
    } else {
      statusEl.textContent = '🔴 Aguardando oponente...';
      statusEl.className = 'connection-status waiting';
    }
  }
}

// === GAME LOGIC ===
function canPlay(card) {
  const top = discardPile[discardPile.length - 1];
  if (card.type === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === top.value) return true;
  return false;
}

function hasPlayableCard(hand) {
  return hand.some(c => canPlay(c));
}

function playerPlayCard(index) {
  const myId = isMultiplayer ? playerId : 0;
  if (currentPlayer !== myId || !gameActive || isProcessing) return;

  isProcessing = true;
  ensureAudio();

  const myHand = isMultiplayer ? hands[playerId] : hands[0];
  const card = myHand[index];

  if (!canPlay(card)) {
    messageEl.textContent = 'Carta invalida! Jogue uma carta compativel.';
    playSound('error');
    isProcessing = false;
    return;
  }

  // UNO check - must call UNO before playing second-to-last card
  if (myHand.length === 2 && !calledUno) {
    messageEl.textContent = 'Voce esqueceu de gritar UNO! +2 cartas de penalidade.';
    const c1 = drawCard();
    const c2 = drawCard();
    if (c1) myHand.push(c1);
    if (c2) myHand.push(c2);
    isProcessing = false;
    render();
    return;
  }

  myHand.splice(index, 1);
  moveCount++;

  if (card.type === 'wild') {
    pendingWildCard = card;
    showColorPicker();
    return;
  }

  playCardEffect(card, myId);
}

function showColorPicker() {
  colorPickerOverlay.style.display = 'flex';
  const btns = colorPickerOverlay.querySelectorAll('.color-btn');
  btns.forEach(btn => {
    btn.onclick = () => {
      const color = btn.dataset.color;
      colorPickerOverlay.style.display = 'none';
      pendingWildCard.color = color;
      currentColor = color;

      // In multiplayer, sync color choice
      if (isMultiplayer) {
        broadcastMove({
          type: 'wild_color',
          color: color,
          card: pendingWildCard
        });
      }

      playCardEffect(pendingWildCard, isMultiplayer ? playerId : 0);
      pendingWildCard = null;
    };
  });
  // Fechar ao clicar fora do painel
  colorPickerOverlay.onclick = (e) => {
    if (e.target === colorPickerOverlay) {
      colorPickerOverlay.style.display = 'none';
      pendingWildCard = null;
    }
  };
}

function playCardEffect(card, player) {
  discardPile.push(card);
  currentColor = card.color;

  // Check win
  const playerHand = isMultiplayer ? hands[player] : hands[player];
  if (playerHand.length === 0) {
    endGame(player);
    return;
  }

  // Apply effects
  if (card.value === 'skip') {
    advancePlayer();
    messageEl.textContent = `${getPlayerName(currentPlayer)} foi bloqueado!`;
    advancePlayer();
  } else if (card.value === 'reverse') {
    direction *= -1;
    if (direction === 1) messageEl.textContent = 'Direcao: horario →';
    else messageEl.textContent = 'Direcao: anti-horario ←';
    advancePlayer();
  } else if (card.value === 'draw2') {
    advancePlayer();
    const target = currentPlayer;
    messageEl.textContent = `${getPlayerName(target)} compra 2 cartas!`;
    for (let i = 0; i < 2; i++) {
      const c = drawCard();
      if (c) hands[target].push(c);
    }
    advancePlayer();
  } else if (card.value === 'wild4') {
    advancePlayer();
    const target = currentPlayer;
    messageEl.textContent = `${getPlayerName(target)} compra 4 cartas!`;
    for (let i = 0; i < 4; i++) {
      const c = drawCard();
      if (c) hands[target].push(c);
    }
    advancePlayer();
  } else {
    advancePlayer();
    if (card.type !== 'wild') {
      messageEl.textContent = `Vez de ${getPlayerName(currentPlayer)}`;
    }
  }

  calledUno = false;
  isProcessing = false;
  render();

  // Broadcast move in multiplayer
  if (isMultiplayer && gameActive) {
    broadcastMove({
      type: 'play_card',
      card: card,
      player: player,
      currentPlayer: currentPlayer,
      direction: direction,
      currentColor: currentColor,
      hands: hands.map(h => h.length), // Only send card counts
      drawPileCount: drawPile.length,
      discardPile: discardPile
    });
  }

  // CPU turn in single player
  if (!isMultiplayer && gameActive && currentPlayer !== 0) {
    setTimeout(() => cpuTurn(), 900);
  }
}

function advancePlayer() {
  const numPlayers = isMultiplayer ? 2 : 4;
  currentPlayer = (currentPlayer + direction + numPlayers) % numPlayers;
}

function getPlayerName(p) {
  if (isMultiplayer) {
    return p === playerId ? 'Voce' : (opponentName || 'Oponente');
  }
  return p === 0 ? 'Voce' : `CPU ${p}`;
}

// === CPU AI (Single Player Only) ===
function showCpuThinking() {
  messageEl.innerHTML = `CPU ${currentPlayer} está pensando <span class="thinking-dots"><span></span><span></span><span></span></span>`;
}

function cpuTurn() {
  if (!gameActive || currentPlayer === 0 || isMultiplayer) return;

  showCpuThinking();

  setTimeout(() => {
    cpuTurnActual();
  }, 800);
}

function cpuTurnActual() {
  if (!gameActive || currentPlayer === 0 || isMultiplayer) return;

  const hand = hands[currentPlayer];
  const playable = [];
  hand.forEach((c, i) => { if (canPlay(c)) playable.push(i); });

  if (playable.length === 0) {
    // Draw a card
    const c = drawCard();
    if (c) {
      hand.push(c);
      messageEl.textContent = `CPU ${currentPlayer} comprou uma carta.`;
      // Try to play the drawn card
      if (canPlay(c)) {
        const idx = hand.length - 1;
        setTimeout(() => {
          cpuPlayIndex(idx);
        }, 700);
        render();
        return;
      }
    }
    advancePlayer();
    calledUno = false;
    isProcessing = false;
    render();
    if (currentPlayer !== 0) {
      setTimeout(() => cpuTurn(), 800);
    } else {
      messageEl.textContent = 'Sua vez!';
    }
    return;
  }

  // Pick best card: prefer specials, matching color, then wild last
  let bestIdx = playable[0];
  let bestScore = -1;

  for (const idx of playable) {
    const c = hand[idx];
    let score = 0;
    if (c.value === 'wild4') score = 50;
    else if (c.value === 'wild') score = 40;
    else if (c.value === 'draw2') score = 30;
    else if (c.value === 'skip') score = 25;
    else if (c.value === 'reverse') score = 20;
    else if (c.color === currentColor) score = 10 + parseInt(c.value || '0');
    else score = 5;

    // Prefer not using wilds if there are colored cards
    if (c.type === 'wild' && playable.some(pi => hand[pi].type !== 'wild')) {
      score -= 35;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  setTimeout(() => {
    cpuPlayIndex(bestIdx);
  }, 600);
}

function cpuPlayIndex(index) {
  const player = currentPlayer;
  const card = hands[player].splice(index, 1)[0];

  // CPU UNO call
  if (hands[player].length === 1) {
    messageEl.textContent = `CPU ${player} gritou UNO!`;
  }

  // Wild color choice
  if (card.type === 'wild') {
    // Pick most frequent color in hand
    const colorCount = { red: 0, blue: 0, green: 0, yellow: 0 };
    hands[player].forEach(c => {
      if (c.color in colorCount) colorCount[c.color]++;
    });
    let bestColor = 'red';
    let bestCount = -1;
    for (const [col, cnt] of Object.entries(colorCount)) {
      if (cnt > bestCount) { bestCount = cnt; bestColor = col; }
    }
    card.color = bestColor;
    currentColor = bestColor;
  }

  // Show special card message with effect
  if (card.type === 'special' || card.type === 'wild') {
    messageEl.innerHTML = `<span style="color: #ffd54f; font-weight: 800;">CPU ${player} jogou ${getCardLabel(card)}!</span>`;
  } else {
    messageEl.textContent = `CPU ${player} jogou ${getCardLabel(card)}`;
  }

  playCardEffect(card, player);
}

// === MULTIPLAYER FUNCTIONS ===
async function initMultiplayer() {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    messageEl.textContent = 'Faca login para jogar multiplayer.';
    setTimeout(() => {
      window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    }, 2000);
    return;
  }

  playerName = user.user_metadata?.name || user.email?.split('@')[0] || 'Jogador';

  // Check if room exists
  const { data: room, error } = await supabase
    .from('uno_rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking room:', error);
    messageEl.textContent = 'Erro ao conectar a sala.';
    return;
  }

  if (!room) {
    // Create room as host
    isHost = true;
    playerId = 0;
    opponentId = 1;

    const { error: createError } = await supabase
      .from('uno_rooms')
      .insert({
        id: roomId,
        host_id: user.id,
        host_name: playerName,
        status: 'waiting',
        game_state: null
      });

    if (createError) {
      console.error('Error creating room:', createError);
      messageEl.textContent = 'Erro ao criar sala.';
      return;
    }
  } else {
    // Join existing room
    if (room.guest_id && room.guest_id !== user.id) {
      messageEl.textContent = 'Sala cheia!';
      return;
    }

    isHost = false;
    playerId = 1;
    opponentId = 0;
    opponentName = room.host_name;

    // Update room with guest info
    await supabase
      .from('uno_rooms')
      .update({
        guest_id: user.id,
        guest_name: playerName,
        status: 'playing'
      })
      .eq('id', roomId);
  }

  // Setup realtime subscription
  setupMultiplayerChannel();

  // Update UI for multiplayer
  updateMultiplayerUI();

  // Start game if host, wait if guest
  if (isHost) {
    messageEl.textContent = 'Aguardando oponente...';
    // Wait for opponent to join
    waitForOpponent();
  } else {
    messageEl.textContent = 'Conectado! Aguardando inicio...';
    // Load game state from host
    loadGameState();
  }
}

function setupMultiplayerChannel() {
  multiplayerChannel = supabase
    .channel(`uno:${roomId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'uno_rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      handleRoomUpdate(payload.new);
    })
    .subscribe();
}

function handleRoomUpdate(room) {
  if (!room) return;

  // Update opponent info
  if (isHost && room.guest_name) {
    opponentName = room.guest_name;
    opponentConnected = true;
  } else if (!isHost) {
    opponentName = room.host_name;
    opponentConnected = true;
  }

  // Update game state
  if (room.game_state) {
    const state = room.game_state;

    // Only update if it's from the other player or initial state
    if (state.player !== playerId) {
      drawPile = state.drawPile || drawPile;
      discardPile = state.discardPile || discardPile;
      hands = state.hands || hands;
      currentPlayer = state.currentPlayer !== undefined ? state.currentPlayer : currentPlayer;
      direction = state.direction !== undefined ? state.direction : direction;
      currentColor = state.currentColor || currentColor;
      gameActive = state.gameActive !== undefined ? state.gameActive : gameActive;

      render();

      // Check for game end
      if (state.winner !== undefined) {
        endGame(state.winner);
      }
    }
  }

  // Update status
  if (room.status === 'playing' && !gameActive && isHost) {
    startMultiplayerGame();
  }

  updateConnectionStatus();
}

async function waitForOpponent() {
  const checkInterval = setInterval(async () => {
    const { data: room } = await supabase
      .from('uno_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (room?.guest_id) {
      clearInterval(checkInterval);
      opponentName = room.guest_name;
      opponentConnected = true;
      await supabase
        .from('uno_rooms')
        .update({ status: 'playing' })
        .eq('id', roomId);
      startMultiplayerGame();
    }
  }, 1000);
}

async function loadGameState() {
  const { data: room } = await supabase
    .from('uno_rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (room?.game_state) {
    handleRoomUpdate(room);
  }
}

function startMultiplayerGame() {
  // Initialize game state
  drawPile = shuffle(createDeck());
  discardPile = [];
  hands = [[], []]; // Only 2 players in multiplayer
  currentPlayer = 0;
  direction = 1;
  gameActive = true;
  calledUno = false;
  moveCount = 0;

  // Deal 7 cards each
  for (let round = 0; round < 7; round++) {
    for (let p = 0; p < 2; p++) {
      hands[p].push(drawCard());
    }
  }

  // First discard - must be a number card
  let firstCard;
  do {
    firstCard = drawCard();
    if (firstCard.type !== 'number') {
      drawPile.unshift(firstCard);
      shuffle(drawPile);
    }
  } while (firstCard.type !== 'number');

  discardPile.push(firstCard);
  currentColor = firstCard.color;

  // Save initial state
  saveGameState();

  messageEl.textContent = isHost ? 'Sua vez!' : 'Vez do oponente';
  render();
}

async function saveGameState() {
  const state = {
    drawPile,
    discardPile,
    hands,
    currentPlayer,
    direction,
    currentColor,
    gameActive,
    player: playerId
  };

  await supabase
    .from('uno_rooms')
    .update({ game_state: state })
    .eq('id', roomId);
}

async function broadcastMove(move) {
  // Merge move with current state and save
  const state = {
    drawPile,
    discardPile,
    hands,
    currentPlayer,
    direction,
    currentColor,
    gameActive,
    player: playerId,
    lastMove: move
  };

  await supabase
    .from('uno_rooms')
    .update({ game_state: state })
    .eq('id', roomId);
}

function updateMultiplayerUI() {
  // Hide CPU opponents in multiplayer
  const opp2 = document.getElementById('opponent-2');
  const opp3 = document.getElementById('opponent-3');
  if (opp2) opp2.style.display = 'none';
  if (opp3) opp3.style.display = 'none';

  // Update opponent 1 label
  const opp1Name = document.querySelector('#opponent-1 .opp-name');
  if (opp1Name) opp1Name.textContent = opponentName || 'Oponente';

  // Add connection status indicator
  const topbar = document.querySelector('.topbar');
  if (topbar && !document.getElementById('connection-status')) {
    const statusEl = document.createElement('div');
    statusEl.id = 'connection-status';
    statusEl.className = 'connection-status waiting';
    statusEl.textContent = '🔴 Aguardando oponente...';
    topbar.appendChild(statusEl);
  }
}

// === DRAW BUTTON ===
btnDraw.addEventListener('click', () => {
  const myId = isMultiplayer ? playerId : 0;
  if (currentPlayer !== myId || !gameActive || isProcessing) return;

  isProcessing = true;
  ensureAudio();

  const myHand = isMultiplayer ? hands[playerId] : hands[0];
  const c = drawCard();
  if (c) {
    myHand.push(c);
    playSound('deal');
    messageEl.textContent = 'Voce comprou uma carta.';

    // Broadcast draw in multiplayer
    if (isMultiplayer) {
      broadcastMove({
        type: 'draw',
        player: playerId,
        hands: hands.map(h => h.length),
        drawPileCount: drawPile.length
      });
    }

    // Can play the drawn card?
    if (canPlay(c)) {
      messageEl.textContent = 'Voce comprou uma carta. Pode joga-la se quiser!';
      isProcessing = false;
      render();
      return;
    }
  }

  advancePlayer();
  calledUno = false;
  isProcessing = false;
  render();

  if (isMultiplayer) {
    broadcastMove({
      type: 'turn_end',
      player: playerId,
      currentPlayer: currentPlayer
    });
  } else if (currentPlayer !== 0) {
    setTimeout(() => cpuTurn(), 700);
  }
});

// === UNO BUTTON ===
btnUno.addEventListener('click', () => {
  if (isProcessing) return;
  calledUno = true;
  messageEl.textContent = 'Voce gritou UNO!';
  btnUno.style.display = 'none';

  if (isMultiplayer) {
    broadcastMove({
      type: 'uno_call',
      player: playerId
    });
  }

  render();
});

// === END GAME ===
function endGame(winner) {
  gameActive = false;
  const myId = isMultiplayer ? playerId : 0;
  const won = winner === myId;

  if (isMultiplayer) {
    modalIcon.textContent = won ? '🏆' : '😢';
    modalTitle.textContent = won ? 'Voce Venceu!' : `${opponentName || 'Oponente'} Venceu!`;
    modalMessage.textContent = won
      ? 'Parabens! Voce venceu o jogo!'
      : 'O oponente ficou sem cartas primeiro.';

    // Broadcast win
    broadcastMove({
      type: 'game_end',
      winner: winner
    });
  } else {
    modalIcon.textContent = won ? '🏆' : '😢';
    modalTitle.textContent = won ? 'Voce Venceu!' : `CPU ${winner} Venceu!`;
    modalMessage.textContent = won
      ? `Parabens! Voce se livrou de todas as cartas em ${moveCount} jogadas!`
      : `CPU ${winner} ficou sem cartas primeiro.`;
  }

  modalOverlay.classList.add('active');

  if (won) {
    launchConfetti();
    playSound('win');
  } else {
    playSound('error');
  }

  btnDraw.disabled = true;
  btnNew.style.display = '';

  // Save stats using GameStats (single player only)
  if (!isMultiplayer) {
    gameStats.recordGame(won, { score: moveCount });
  }
}

// === START GAME ===
function startGame() {
  if (isMultiplayer) return; // Multiplayer starts differently

  ensureAudio();
  isProcessing = false;
  drawPile = shuffle(createDeck());
  discardPile = [];
  hands = [[], [], [], []];
  currentPlayer = 0;
  direction = 1;
  gameActive = true;
  calledUno = false;
  pendingWildCard = null;
  moveCount = 0;

  // Deal 7 cards each
  for (let round = 0; round < 7; round++) {
    for (let p = 0; p < 4; p++) {
      hands[p].push(drawCard());
      playSound('deal');
    }
  }

  // First discard - must be a number card
  let firstCard;
  do {
    firstCard = drawCard();
    if (firstCard.type !== 'number') {
      drawPile.unshift(firstCard);
      shuffle(drawPile);
    }
  } while (firstCard.type !== 'number');

  discardPile.push(firstCard);
  currentColor = firstCard.color;

  btnNew.style.display = 'none';
  messageEl.textContent = 'Sua vez! Jogue uma carta.';
  render();
}

// === EVENTS ===
modalBtn.addEventListener('click', () => {
  modalOverlay.classList.remove('active');
  if (isMultiplayer) {
    // Return to lobby or refresh
    window.location.href = '/games/uno/';
  } else {
    startGame();
  }
});

document.getElementById('btn-share')?.addEventListener('click', () => {
  if (isMultiplayer) {
    shareOnWhatsApp(`🎉 Ganhei no Uno multiplayer do Games Hub! Jogue tambem: https://gameshub.com.br/games/uno/?room=${roomId}`);
  } else {
    shareOnWhatsApp(`🎉 Ganhei no Uno do Games Hub! Venha jogar tambem: https://gameshub.com.br/games/uno/`);
  }
});

btnNew.addEventListener('click', () => {
  btnNew.style.display = 'none';
  if (isMultiplayer) {
    // Restart multiplayer game
    if (isHost) {
      startMultiplayerGame();
    }
  } else {
    startGame();
  }
});

drawPileEl.addEventListener('click', () => {
  const myId = isMultiplayer ? playerId : 0;
  if (currentPlayer === myId && gameActive) btnDraw.click();
});

// === INIT ===
if (isMultiplayer) {
  initMultiplayer();
} else {
  startGame();
}
