import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, initAudio } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';

function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

let audioInitialized = false;
function ensureAudio() {
  if (!audioInitialized) {
    initAudio();
    audioInitialized = true;
  }
}

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');
const isMultiplayer = !!roomId;
let playerId = null;
let playerNumber = null;
let opponentId = null;
let gameChannel = null;
let isHost = false;

const playerHandEl = document.getElementById('player-hand');
const cpuHandEl = document.getElementById('cpu-hand');
const playerPlayedEl = document.getElementById('player-played');
const cpuPlayedEl = document.getElementById('cpu-played');
const playerScoreEl = document.getElementById('player-score');
const cpuScoreEl = document.getElementById('cpu-score');
const roundNumEl = document.getElementById('round-num');
const handValueEl = document.getElementById('hand-value');
const roundScoreEl = document.getElementById('round-score-display');
const messageEl = document.getElementById('message');
const btnTruco = document.getElementById('btn-truco');
const btnAccept = document.getElementById('btn-accept');
const btnDecline = document.getElementById('btn-decline');
const btnNew = document.getElementById('btn-new');
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalBtn = document.getElementById('modal-btn');

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', 'Q', 'J', 'K'];
const STRENGTH = {
  '4♣': 14, '7♥': 13, 'A♠': 12, '7♦': 11,
  '3': 10, '2': 9, 'A': 8, 'K': 7, 'J': 6, 'Q': 5,
  '7': 4, '6': 3, '5': 2, '4': 1
};
const TRUCO_VALUES = [1, 3, 6, 9, 12];

let deck = [];
let playerHand = [];
let cpuHand = [];
let playerScore = 0;
let cpuScore = 0;
let roundWinsPlayer = 0;
let roundWinsCpu = 0;
let currentRound = 0;
let handValue = 1;
let trucoLevel = 0;
let playerTrucoCalled = false;
let cpuTrucoCalled = false;
let waitingForTrucoResponse = false;
let gameOver = false;
let playerTurn = true;
let firstToPlay = 'player';
let isProcessing = false;
let waitingForOpponent = false;

function getCardStrength(card) {
  const key = card.value + card.suit;
  if (STRENGTH[key] !== undefined) return STRENGTH[key];
  return STRENGTH[card.value] || 0;
}


async function initMultiplayer() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    messageEl.textContent = 'Faça login para jogar multiplayer';
    setTimeout(() => window.location.href = '../../login.html', 2000);
    return false;
  }
  playerId = user.id;
  const { data: room } = await supabase.from('truco_rooms').select('*').eq('id', roomId).single();
  if (!room) {
    isHost = true;
    playerNumber = 1;
    const { error } = await supabase.from('truco_rooms').insert({
      id: roomId, player1_id: playerId, status: 'waiting', game_state: null
    });
    if (error) { messageEl.textContent = 'Erro ao criar sala'; return false; }
    waitingForOpponent = true;
  } else {
    if (room.player2_id) { messageEl.textContent = 'Sala cheia!'; return false; }
    if (room.player1_id === playerId) { playerNumber = 1; isHost = true; }
    else { playerNumber = 2; await supabase.from('truco_rooms').update({ player2_id: playerId, status: 'playing' }).eq('id', roomId); }
  }
  setupRealtime();
  updateMultiplayerUI();
  return true;
}

function setupRealtime() {
  gameChannel = supabase.channel('truco:' + roomId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'truco_rooms', filter: 'id=eq.' + roomId }, handleGameUpdate)
    .subscribe();
}

function handleGameUpdate(payload) {
  const room = payload.new;
  if (!room) return;
  opponentId = (playerNumber === 1) ? room.player2_id : room.player1_id;
  if (room.game_state) syncGameState(room.game_state);
  if (room.status === 'playing' && waitingForOpponent) {
    waitingForOpponent = false;
    messageEl.textContent = 'Oponente conectado! Iniciando...';
    if (isHost) setTimeout(() => startMultiplayerHand(), 1000);
  }
  if (room.status === 'finished') gameOver = true;
}

async function broadcastGameState() {
  if (!isMultiplayer) return;
  const state = {
    player1Hand: playerNumber === 1 ? playerHand : null,
    player2Hand: playerNumber === 2 ? playerHand : null,
    player1Score: playerNumber === 1 ? playerScore : cpuScore,
    player2Score: playerNumber === 2 ? playerScore : cpuScore,
    roundWinsPlayer1: playerNumber === 1 ? roundWinsPlayer : roundWinsCpu,
    roundWinsPlayer2: playerNumber === 2 ? roundWinsPlayer : roundWinsCpu,
    currentRound, handValue, trucoLevel, playerTrucoCalled, cpuTrucoCalled,
    waitingForTrucoResponse, gameOver, firstToPlay, playerTurn,
    tableCards: {
      player1: playerNumber === 1 ? (playerPlayedEl._card || null) : (cpuPlayedEl._card || null),
      player2: playerNumber === 2 ? (playerPlayedEl._card || null) : (cpuPlayedEl._card || null)
    },
    lastAction: Date.now()
  };
  await supabase.from('truco_rooms').update({ game_state: state }).eq('id', roomId);
}

function syncGameState(state) {
  if (!state) return;
  if (playerNumber === 1) {
    playerScore = state.player1Score || 0;
    cpuScore = state.player2Score || 0;
    roundWinsPlayer = state.roundWinsPlayer1 || 0;
    roundWinsCpu = state.roundWinsPlayer2 || 0;
    if (state.player1Hand) playerHand = state.player1Hand;
  } else {
    playerScore = state.player2Score || 0;
    cpuScore = state.player1Score || 0;
    roundWinsPlayer = state.roundWinsPlayer2 || 0;
    roundWinsCpu = state.roundWinsPlayer1 || 0;
    if (state.player2Hand) playerHand = state.player2Hand;
  }
  currentRound = state.currentRound || 0;
  handValue = state.handValue || 1;
  trucoLevel = state.trucoLevel || 0;
  playerTrucoCalled = state.playerTrucoCalled || false;
  cpuTrucoCalled = state.cpuTrucoCalled || false;
  waitingForTrucoResponse = state.waitingForTrucoResponse || false;
  gameOver = state.gameOver || false;
  firstToPlay = state.firstToPlay || 'player';
  playerTurn = state.playerTurn || false;
  if (state.tableCards) {
    if (playerNumber === 1) {
      if (state.tableCards.player1) { playerPlayedEl.innerHTML = ''; playerPlayedEl._card = state.tableCards.player1; playerPlayedEl.appendChild(createCardEl(state.tableCards.player1)); }
      if (state.tableCards.player2) { cpuPlayedEl.innerHTML = ''; cpuPlayedEl._card = state.tableCards.player2; cpuPlayedEl.appendChild(createCardEl(state.tableCards.player2)); }
    } else {
      if (state.tableCards.player2) { playerPlayedEl.innerHTML = ''; playerPlayedEl._card = state.tableCards.player2; playerPlayedEl.appendChild(createCardEl(state.tableCards.player2)); }
      if (state.tableCards.player1) { cpuPlayedEl.innerHTML = ''; cpuPlayedEl._card = state.tableCards.player1; cpuPlayedEl.appendChild(createCardEl(state.tableCards.player1)); }
    }
  }
  updateScores();
  updateRoundInfo();
  renderHands();
  updateTurnIndicator();
  if (waitingForTrucoResponse) {
    if ((playerNumber === 1 && cpuTrucoCalled) || (playerNumber === 2 && playerTrucoCalled)) {
      btnTruco.style.display = 'none'; btnAccept.style.display = ''; btnDecline.style.display = '';
    } else {
      btnTruco.style.display = ''; btnTruco.disabled = true; btnAccept.style.display = 'none'; btnDecline.style.display = 'none';
    }
  } else {
    btnTruco.style.display = ''; btnTruco.disabled = trucoLevel >= 4 || !playerTurn; btnAccept.style.display = 'none'; btnDecline.style.display = 'none';
  }
}

function updateMultiplayerUI() {
  const cpuZoneLabel = document.querySelector('.cpu-zone .zone-label');
  const opponentZoneLabel = document.getElementById('opponent-zone-label');
  const opponentPlayedLabel = document.getElementById('opponent-played-label');
  const opponentLabel = document.getElementById('opponent-label');
  if (cpuZoneLabel) cpuZoneLabel.textContent = 'Oponente';
  if (opponentZoneLabel) opponentZoneLabel.textContent = 'Oponente';
  if (opponentPlayedLabel) opponentPlayedLabel.textContent = 'Oponente jogou';
  if (opponentLabel) opponentLabel.innerHTML = 'Oponente: <strong id="cpu-score">' + cpuScore + '</strong>';
  if (waitingForOpponent) {
    messageEl.innerHTML = '<div>Aguardando oponente...</div><div style="font-size: 0.8rem; margin-top: 0.5rem;">Compartilhe: <code style="background: rgba(255,255,255,0.2); padding: 0.2rem 0.5rem; border-radius: 4px;">' + window.location.origin + '/games/truco/?room=' + roomId + '</code></div>';
  }
}

async function startMultiplayerHand() {
  ensureAudio();
  isProcessing = false;
  deck = shuffle(createDeck());
  if (isHost) {
    const p1Hand = [deck.pop(), deck.pop(), deck.pop()];
    const p2Hand = [deck.pop(), deck.pop(), deck.pop()];
    await supabase.from('truco_rooms').update({
      game_state: {
        player1Hand: p1Hand, player2Hand: p2Hand, player1Score: playerScore, player2Score: cpuScore,
        roundWinsPlayer1: 0, roundWinsPlayer2: 0, currentRound: 0, handValue: 1, trucoLevel: 0,
        playerTrucoCalled: false, cpuTrucoCalled: false, waitingForTrucoResponse: false, gameOver: false,
        firstToPlay: firstToPlay, playerTurn: firstToPlay === 'player', tableCards: { player1: null, player2: null }
      }
    }).eq('id', roomId);
    playerHand = p1Hand;
  } else {
    messageEl.textContent = 'Aguardando distribuicao das cartas...';
    return;
  }
  roundWinsPlayer = 0; roundWinsCpu = 0; currentRound = 0; handValue = 1; trucoLevel = 0;
  playerTrucoCalled = false; cpuTrucoCalled = false; waitingForTrucoResponse = false;
  playerTurn = (firstToPlay === 'player');
  playerPlayedEl.innerHTML = ''; cpuPlayedEl.innerHTML = ''; cpuPlayedEl._card = null;
  messageEl.textContent = playerTurn ? 'Sua vez! Escolha uma carta.' : 'Vez do oponente...';
  btnTruco.style.display = ''; btnTruco.disabled = false; btnAccept.style.display = 'none'; btnDecline.style.display = 'none'; btnNew.style.display = 'none';
  updateRoundInfo(); renderHands(); updateTurnIndicator(); playSound('deal');
}

function updateTurnIndicator() {
  const cpuZone = document.querySelector('.cpu-zone');
  const playerZone = document.querySelector('.player-zone');
  if (gameOver) { cpuZone?.classList.remove('active-turn'); playerZone?.classList.remove('active-turn'); return; }
  if (waitingForTrucoResponse) {
    if (cpuTrucoCalled) { cpuZone?.classList.remove('active-turn'); playerZone?.classList.add('active-turn'); }
    else { cpuZone?.classList.add('active-turn'); playerZone?.classList.remove('active-turn'); }
    return;
  }
  if (playerTurn) { cpuZone?.classList.remove('active-turn'); playerZone?.classList.add('active-turn'); }
  else { cpuZone?.classList.add('active-turn'); playerZone?.classList.remove('active-turn'); }
}

function showCpuThinking() {
  messageEl.innerHTML = isMultiplayer ? 'Aguardando oponente...' : 'CPU esta pensando <span class="thinking-dots"><span></span><span></span><span></span></span>';
}

function showTrucoIndicator(isCpu) {
  messageEl.innerHTML = '<span class="truco-indicator">' + (isCpu ? 'Oponente pediu TRUCO!' : 'Voce pediu TRUCO!') + '</span>';
}

function createDeck() {
  const d = [];
  for (const suit of SUITS) { for (const value of VALUES) { d.push({ suit, value }); } }
  return d;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

function isRed(suit) { return suit === '♥' || suit === '♦'; }

function createCardEl(card, faceDown = false) {
  if (faceDown) { const el = document.createElement('div'); el.className = 'card-back'; el.textContent = '?'; return el; }
  const el = document.createElement('div');
  el.className = 'card ' + (isRed(card.suit) ? 'red' : 'black');
  el.innerHTML = '<span class="card-value">' + card.value + '</span><span class="card-suit">' + card.suit + '</span>';
  return el;
}

function startMatch() {
  playerScore = 0; cpuScore = 0; gameOver = false; firstToPlay = 'player';
  updateScores(); startHand();
}

function startHand() {
  if (isMultiplayer) { startMultiplayerHand(); return; }
  ensureAudio(); isProcessing = false;
  deck = shuffle(createDeck());
  playerHand = [deck.pop(), deck.pop(), deck.pop()];
  cpuHand = [deck.pop(), deck.pop(), deck.pop()];
  playSound('deal');
  roundWinsPlayer = 0; roundWinsCpu = 0; currentRound = 0; handValue = 1; trucoLevel = 0;
  playerTrucoCalled = false; cpuTrucoCalled = false; waitingForTrucoResponse = false;
  playerTurn = (firstToPlay === 'player');
  playerPlayedEl.innerHTML = ''; cpuPlayedEl.innerHTML = ''; cpuPlayedEl._card = null; messageEl.textContent = '';
  btnTruco.style.display = ''; btnTruco.disabled = false; btnAccept.style.display = 'none'; btnDecline.style.display = 'none'; btnNew.style.display = 'none';
  updateRoundInfo(); renderHands(); updateTurnIndicator();
  if (!playerTurn) { showCpuThinking(); setTimeout(() => cpuPlayCard(), 1000); }
  else { messageEl.textContent = 'Sua vez! Escolha uma carta.'; }
}

function renderHands() {
  playerHandEl.innerHTML = ''; cpuHandEl.innerHTML = '';
  playerHand.forEach((card, i) => {
    const el = createCardEl(card);
    el.addEventListener('click', () => playCard(i));
    el.addEventListener('touchend', (e) => { e.preventDefault(); playCard(i); });
    playerHandEl.appendChild(el);
  });
  const opponentCardCount = isMultiplayer ? 3 : cpuHand.length;
  for (let i = 0; i < opponentCardCount; i++) { cpuHandEl.appendChild(createCardEl(null, true)); }
}

function updateScores() { playerScoreEl.textContent = playerScore; cpuScoreEl.textContent = cpuScore; }

function updateRoundInfo() {
  roundNumEl.textContent = currentRound + 1;
  handValueEl.textContent = TRUCO_VALUES[trucoLevel];
  roundScoreEl.textContent = 'Rodadas: Voce ' + roundWinsPlayer + ' x ' + roundWinsCpu + ' ' + (isMultiplayer ? 'Oponente' : 'CPU');
}

async function playCard(index) {
  if (!playerTurn || waitingForTrucoResponse || gameOver || isProcessing) return;
  if (index < 0 || index >= playerHand.length) return;
  isProcessing = true; ensureAudio();
  const card = playerHand.splice(index, 1)[0];
  playerPlayedEl.innerHTML = '';
  const cardEl = createCardEl(card);
  cardEl.classList.add('card-played-enter');
  playerPlayedEl.appendChild(cardEl);
  playerPlayedEl._card = card;
  playerTurn = false; updateTurnIndicator(); renderHands();
  if (isMultiplayer) { await broadcastGameState(); messageEl.textContent = 'Aguardando oponente...'; isProcessing = false; return; }
  if (cpuPlayedEl.querySelector('.card')) { setTimeout(() => resolveRound(card, cpuPlayedEl._card), 800); }
  else { setTimeout(() => { showCpuThinking(); setTimeout(() => { cpuPlayCard(card); isProcessing = false; }, 800); }, 600); }
}

function cpuPlayCard(playerCard = null) {
  if (cpuHand.length === 0) return;
  let chosenIndex = 0;
  if (playerCard) {
    const playerStr = getCardStrength(playerCard);
    let bestWinIdx = -1, bestWinStr = Infinity, weakestIdx = 0, weakestStr = Infinity;
    cpuHand.forEach((c, i) => {
      const s = getCardStrength(c);
      if (s > playerStr && s < bestWinStr) { bestWinIdx = i; bestWinStr = s; }
      if (s < weakestStr) { weakestIdx = i; weakestStr = s; }
    });
    chosenIndex = bestWinIdx >= 0 ? bestWinIdx : weakestIdx;
  } else {
    let bestIdx = 0, bestStr = -1;
    cpuHand.forEach((c, i) => { const s = getCardStrength(c); if (s > bestStr) { bestStr = s; bestIdx = i; } });
    chosenIndex = bestIdx;
  }
  if (!cpuTrucoCalled && trucoLevel < 4 && Math.random() < 0.2 && cpuHand.length > 1) {
    const avgStr = cpuHand.reduce((s, c) => s + getCardStrength(c), 0) / cpuHand.length;
    if (avgStr > 7) { cpuCallTruco(); return; }
  }
  const card = cpuHand.splice(chosenIndex, 1)[0];
  cpuPlayedEl.innerHTML = ''; cpuPlayedEl._card = card;
  const cardEl = createCardEl(card);
  cardEl.classList.add('card-played-enter');
  cpuPlayedEl.appendChild(cardEl);
  if (playerCard) { setTimeout(() => resolveRound(playerCard, card), 800); }
  else { playerTurn = true; updateTurnIndicator(); messageEl.textContent = 'Sua vez! Escolha uma carta.'; renderHands(); }
}

async function resolveRound(playerCard, cpuCard) {
  const pStr = getCardStrength(playerCard);
  const cStr = getCardStrength(cpuCard);
  currentRound++;
  let msg = '';
  if (pStr > cStr) {
    roundWinsPlayer++;
    msg = 'Voce venceu a rodada! (' + playerCard.value + playerCard.suit + ' > ' + cpuCard.value + cpuCard.suit + ')';
  } else if (cStr > pStr) {
    roundWinsCpu++;
    msg = (isMultiplayer ? 'Oponente' : 'CPU') + ' venceu a rodada! (' + cpuCard.value + cpuCard.suit + ' > ' + playerCard.value + playerCard.suit + ')';
  } else {
    msg = 'Empate na rodada! (' + playerCard.value + ' = ' + cpuCard.value + ')';
    if (currentRound === 1) { if (firstToPlay === 'player') roundWinsPlayer++; else roundWinsCpu++; }
  }
  messageEl.textContent = msg; updateRoundInfo();
  if (isMultiplayer) await broadcastGameState();
  if (roundWinsPlayer >= 2 || roundWinsCpu >= 2 || currentRound >= 3) { setTimeout(() => finishHand(), 1500); return; }
  setTimeout(() => {
    playerPlayedEl.innerHTML = ''; cpuPlayedEl.innerHTML = ''; cpuPlayedEl._card = null;
    let nextPlayerFirst = (pStr >= cStr);
    playerTurn = nextPlayerFirst;
    updateTurnIndicator();
    if (!playerTurn) { if (isMultiplayer) messageEl.textContent = 'Vez do oponente...'; else { showCpuThinking(); setTimeout(() => cpuPlayCard(), 1000); } }
    else { messageEl.textContent = 'Sua vez! Escolha uma carta.'; }
    updateRoundInfo(); renderHands();
  }, 1600);
}

async function finishHand() {
  const pts = TRUCO_VALUES[trucoLevel];
  let winner;
  if (roundWinsPlayer > roundWinsCpu) {
    playerScore += pts; winner = 'player';
    messageEl.textContent = 'Voce ganhou a mao! +' + pts + ' ponto(s)';
  } else if (roundWinsCpu > roundWinsPlayer) {
    cpuScore += pts; winner = 'cpu';
    messageEl.textContent = (isMultiplayer ? 'Oponente' : 'CPU') + ' ganhou a mao! +' + pts + ' ponto(s)';
  } else {
    if (firstToPlay === 'player') { playerScore += pts; winner = 'player'; }
    else { cpuScore += pts; winner = 'cpu'; }
    messageEl.textContent = 'Empate! ' + (winner === 'player' ? 'Voce' : (isMultiplayer ? 'Oponente' : 'CPU')) + ' leva por ser mao. +' + pts;
  }
  updateScores();
  firstToPlay = firstToPlay === 'player' ? 'cpu' : 'player';
  if (isMultiplayer) await broadcastGameState();
  if (playerScore >= 12 || cpuScore >= 12) { endMatch(); }
  else { btnTruco.style.display = 'none'; btnNew.style.display = ''; }
}

function endMatch() {
  gameOver = true; isProcessing = false;
  const won = playerScore >= 12;
  btnTruco.style.display = 'none'; btnNew.style.display = 'none';
  modalIcon.textContent = won ? '🏆' : '😢';
  modalTitle.textContent = won ? 'Voce Venceu!' : (isMultiplayer ? 'Oponente Venceu!' : 'CPU Venceu!');
  modalMessage.textContent = 'Placar final: ' + playerScore + ' x ' + cpuScore;
  modalOverlay.classList.add('active');
  updateTurnIndicator();
  if (won) { launchConfetti(); playSound('win'); }
  else { playSound('error'); }
  if (!isMultiplayer) saveStats(won ? 'win' : 'loss');
  if (isMultiplayer && gameChannel) { supabase.from('truco_rooms').update({ status: 'finished' }).eq('id', roomId); }
}

async function saveStats(result) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('game_stats').insert({ user_id: user.id, game: 'truco', result, moves: null, time_seconds: null });
  } catch (e) { }
}

btnTruco.addEventListener('click', playerCallTruco);

async function playerCallTruco() {
  if (waitingForTrucoResponse || gameOver || isProcessing) return;
  if (trucoLevel >= 4) return;
  isProcessing = true;
  trucoLevel++; playerTrucoCalled = true; waitingForTrucoResponse = true;
  const val = TRUCO_VALUES[trucoLevel];
  showTrucoIndicator(false); btnTruco.disabled = true;
  if (isMultiplayer) { await broadcastGameState(); messageEl.textContent = 'Aguardando resposta do oponente...'; isProcessing = false; return; }
  setTimeout(() => {
    const avgStr = cpuHand.reduce((s, c) => s + getCardStrength(c), 0) / cpuHand.length;
    const acceptChance = Math.min(0.8, avgStr / 12);
    if (Math.random() < acceptChance) {
      messageEl.textContent = 'CPU aceitou! Valor da mao: ' + val + ' pontos';
      waitingForTrucoResponse = false; cpuTrucoCalled = false;
      updateRoundInfo(); updateTurnIndicator();
      if (trucoLevel < 4) btnTruco.disabled = false;
    } else {
      const prevVal = TRUCO_VALUES[Math.max(0, trucoLevel - 1)];
      trucoLevel = Math.max(0, trucoLevel - 1);
      playerScore += prevVal;
      messageEl.textContent = 'CPU correu! Voce ganhou ' + prevVal + ' ponto(s)';
      updateScores(); waitingForTrucoResponse = false;
      firstToPlay = firstToPlay === 'player' ? 'cpu' : 'player';
      if (playerScore >= 12) { endMatch(); }
      else { btnTruco.style.display = 'none'; btnNew.style.display = ''; }
    }
    isProcessing = false;
  }, 1500);
}

function cpuCallTruco() {
  trucoLevel++; cpuTrucoCalled = true; waitingForTrucoResponse = true;
  const val = TRUCO_VALUES[trucoLevel];
  showTrucoIndicator(true);
  btnTruco.style.display = 'none'; btnAccept.style.display = ''; btnDecline.style.display = '';
  playerTurn = false; updateTurnIndicator();
}

btnAccept.addEventListener('click', async () => {
  if (isProcessing) return;
  waitingForTrucoResponse = false;
  btnAccept.style.display = 'none'; btnDecline.style.display = 'none'; btnTruco.style.display = ''; btnTruco.disabled = trucoLevel >= 4;
  const val = TRUCO_VALUES[trucoLevel];
  messageEl.textContent = 'Voce aceitou! Valor da mao: ' + val + ' pontos';
  updateRoundInfo();
  if (isMultiplayer) { await broadcastGameState(); return; }
  setTimeout(() => { cpuPlayActual(); }, 800);
});

btnDecline.addEventListener('click', async () => {
  if (isProcessing) return;
  waitingForTrucoResponse = false;
  btnAccept.style.display = 'none'; btnDecline.style.display = 'none';
  const prevVal = TRUCO_VALUES[Math.max(0, trucoLevel - 1)];
  trucoLevel = Math.max(0, trucoLevel - 1);
  cpuScore += prevVal;
  messageEl.textContent = 'Voce correu! ' + (isMultiplayer ? 'Oponente' : 'CPU') + ' ganhou ' + prevVal + ' ponto(s)';
  playSound('error'); updateScores();
  firstToPlay = firstToPlay === 'player' ? 'cpu' : 'player';
  if (isMultiplayer) await broadcastGameState();
  if (cpuScore >= 12) { endMatch(); }
  else { btnTruco.style.display = 'none'; btnNew.style.display = ''; }
});

function cpuPlayActual() {
  let bestIdx = 0, bestStr = -1;
  cpuHand.forEach((c, i) => { const s = getCardStrength(c); if (s > bestStr) { bestStr = s; bestIdx = i; } });
  const card = cpuHand.splice(bestIdx, 1)[0];
  cpuPlayedEl.innerHTML = ''; cpuPlayedEl._card = card; cpuPlayedEl.appendChild(createCardEl(card));
  playerTurn = true; messageEl.textContent = 'Sua vez! Escolha uma carta.'; renderHands();
}

btnNew.addEventListener('click', () => { if (isProcessing) return; isProcessing = false; btnNew.style.display = 'none'; startHand(); });

modalBtn.addEventListener('click', () => {
  modalOverlay.classList.remove('active'); isProcessing = false;
  if (isMultiplayer) {
    playerScore = 0; cpuScore = 0; firstToPlay = 'player';
    supabase.from('truco_rooms').update({ status: 'playing', game_state: null }).eq('id', roomId).then(() => { startMatch(); });
  } else { startMatch(); }
});

document.getElementById('btn-share')?.addEventListener('click', () => {
  if (isMultiplayer) { shareOnWhatsApp('Venha jogar Truco comigo! Sala: ' + window.location.origin + '/games/truco/?room=' + roomId); }
  else { shareOnWhatsApp('Ganhei no Truco Mineiro do Games Hub! Venha jogar tambem: https://gameshub.com.br/games/truco/'); }
});

if (isMultiplayer) {
  initMultiplayer().then(success => { if (success) { messageEl.textContent = 'Conectado a sala. Aguardando...'; } });
} else { startMatch(); }

window.addEventListener('beforeunload', () => {
  if (gameChannel) gameChannel.unsubscribe();
  if (isMultiplayer && playerId) {
    supabase.from('truco_rooms').select('*').eq('id', roomId).single().then(({ data }) => {
      if (data) {
        const updates = {};
        if (data.player1_id === playerId) updates.player1_id = null;
        if (data.player2_id === playerId) updates.player2_id = null;
        if (Object.keys(updates).length > 0) supabase.from('truco_rooms').update(updates).eq('id', roomId);
      }
    });
  }
});
