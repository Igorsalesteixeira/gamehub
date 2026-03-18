import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, initAudio } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';
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

// === DOM ===
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

// === GAME CONSTANTS ===
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', 'Q', 'J', 'K'];
// Truco Mineiro card strength (higher = stronger)
const STRENGTH = {
  '4♣': 14, '7♥': 13, 'A♠': 12, '7♦': 11,  // manilhas
  '3': 10, '2': 9, 'A': 8, 'K': 7, 'J': 6, 'Q': 5,
  '7': 4, '6': 3, '5': 2, '4': 1
};
const TRUCO_VALUES = [1, 3, 6, 9, 12];

// === STATE ===
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
let firstToPlay = 'player'; // alternates each hand
let isProcessing = false; // Prevent double clicks

function getCardStrength(card) {
  const key = card.value + card.suit;
  if (STRENGTH[key] !== undefined) return STRENGTH[key];
  return STRENGTH[card.value] || 0;
}

// ===== TURN INDICATORS =====
function updateTurnIndicator() {
  const cpuZone = document.querySelector('.cpu-zone');
  const playerZone = document.querySelector('.player-zone');

  if (gameOver) {
    cpuZone?.classList.remove('active-turn');
    playerZone?.classList.remove('active-turn');
    return;
  }

  if (waitingForTrucoResponse) {
    // During truco response, highlight based on who needs to respond
    if (cpuTrucoCalled) {
      cpuZone?.classList.remove('active-turn');
      playerZone?.classList.add('active-turn');
    } else {
      cpuZone?.classList.add('active-turn');
      playerZone?.classList.remove('active-turn');
    }
    return;
  }

  if (playerTurn) {
    cpuZone?.classList.remove('active-turn');
    playerZone?.classList.add('active-turn');
  } else {
    cpuZone?.classList.add('active-turn');
    playerZone?.classList.remove('active-turn');
  }
}

function showCpuThinking() {
  messageEl.innerHTML = 'CPU está pensando <span class="thinking-dots"><span></span><span></span><span></span></span>';
}

function showTrucoIndicator(isCpu) {
  messageEl.innerHTML = `<span class="truco-indicator">${isCpu ? 'CPU pediu TRUCO!' : 'Você pediu TRUCO!'}</span>`;
}

function createDeck() {
  const d = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      d.push({ suit, value });
    }
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

function isRed(suit) { return suit === '♥' || suit === '♦'; }

function createCardEl(card, faceDown = false) {
  if (faceDown) {
    const el = document.createElement('div');
    el.className = 'card-back';
    el.textContent = '?';
    return el;
  }
  const el = document.createElement('div');
  el.className = `card ${isRed(card.suit) ? 'red' : 'black'}`;
  el.innerHTML = `<span class="card-value">${card.value}</span><span class="card-suit">${card.suit}</span>`;
  return el;
}

// === GAME LOGIC ===
function startMatch() {
  playerScore = 0;
  cpuScore = 0;
  gameOver = false;
  firstToPlay = 'player';
  updateScores();
  startHand();
}

function startHand() {
  ensureAudio();
  isProcessing = false;
  deck = shuffle(createDeck());
  playerHand = [deck.pop(), deck.pop(), deck.pop()];
  cpuHand = [deck.pop(), deck.pop(), deck.pop()];
  playSound('deal');
  roundWinsPlayer = 0;
  roundWinsCpu = 0;
  currentRound = 0;
  handValue = 1;
  trucoLevel = 0;
  playerTrucoCalled = false;
  cpuTrucoCalled = false;
  waitingForTrucoResponse = false;

  playerTurn = (firstToPlay === 'player');

  playerPlayedEl.innerHTML = '';
  cpuPlayedEl.innerHTML = '';
  messageEl.textContent = '';

  btnTruco.style.display = '';
  btnTruco.disabled = false;
  btnAccept.style.display = 'none';
  btnDecline.style.display = 'none';
  btnNew.style.display = 'none';

  updateRoundInfo();
  renderHands();
  updateTurnIndicator();

  if (!playerTurn) {
    showCpuThinking();
    setTimeout(() => cpuPlayCard(), 1000);
  } else {
    messageEl.textContent = 'Sua vez! Escolha uma carta.';
  }
}

function renderHands() {
  playerHandEl.innerHTML = '';
  cpuHandEl.innerHTML = '';

  playerHand.forEach((card, i) => {
    const el = createCardEl(card);
    el.addEventListener('click', () => playCard(i));
    el.addEventListener('touchend', (e) => { e.preventDefault(); playCard(i); });
    playerHandEl.appendChild(el);
  });

  cpuHand.forEach(() => {
    cpuHandEl.appendChild(createCardEl(null, true));
  });
}

function updateScores() {
  playerScoreEl.textContent = playerScore;
  cpuScoreEl.textContent = cpuScore;
}

function updateRoundInfo() {
  roundNumEl.textContent = currentRound + 1;
  handValueEl.textContent = TRUCO_VALUES[trucoLevel];
  roundScoreEl.textContent = `Rodadas: Voce ${roundWinsPlayer} x ${roundWinsCpu} CPU`;
}

function playCard(index) {
  if (!playerTurn || waitingForTrucoResponse || gameOver || isProcessing) return;
  if (index < 0 || index >= playerHand.length) return;
  isProcessing = true;
  ensureAudio();

  const card = playerHand.splice(index, 1)[0];
  playerPlayedEl.innerHTML = '';
  const cardEl = createCardEl(card);
  cardEl.classList.add('card-played-enter');
  playerPlayedEl.appendChild(cardEl);

  playerTurn = false;
  updateTurnIndicator();
  renderHands();

  // Check if CPU already played (CPU went first)
  if (cpuPlayedEl.querySelector('.card')) {
    setTimeout(() => resolveRound(card, cpuPlayedEl._card), 800);
  } else {
    // CPU plays after player
    setTimeout(() => {
      showCpuThinking();
      setTimeout(() => {
        cpuPlayCard(card);
        isProcessing = false;
      }, 800);
    }, 600);
  }
}

function cpuPlayCard(playerCard = null) {
  if (cpuHand.length === 0) return;

  // CPU AI: try to win if possible, otherwise play weakest
  let chosenIndex = 0;

  if (playerCard) {
    // CPU plays second - try to beat the player's card
    const playerStr = getCardStrength(playerCard);
    let bestWinIdx = -1;
    let bestWinStr = Infinity;
    let weakestIdx = 0;
    let weakestStr = Infinity;

    cpuHand.forEach((c, i) => {
      const s = getCardStrength(c);
      if (s > playerStr && s < bestWinStr) {
        bestWinIdx = i;
        bestWinStr = s;
      }
      if (s < weakestStr) {
        weakestIdx = i;
        weakestStr = s;
      }
    });

    chosenIndex = bestWinIdx >= 0 ? bestWinIdx : weakestIdx;
  } else {
    // CPU plays first - play strongest
    let bestIdx = 0;
    let bestStr = -1;
    cpuHand.forEach((c, i) => {
      const s = getCardStrength(c);
      if (s > bestStr) { bestStr = s; bestIdx = i; }
    });
    chosenIndex = bestIdx;
  }

  // CPU might call truco
  if (!cpuTrucoCalled && trucoLevel < 4 && Math.random() < 0.2 && cpuHand.length > 1) {
    const avgStr = cpuHand.reduce((s, c) => s + getCardStrength(c), 0) / cpuHand.length;
    if (avgStr > 7) {
      cpuCallTruco();
      return;
    }
  }

  const card = cpuHand.splice(chosenIndex, 1)[0];
  cpuPlayedEl.innerHTML = '';
  cpuPlayedEl._card = card;
  const cardEl = createCardEl(card);
  cardEl.classList.add('card-played-enter');
  cpuPlayedEl.appendChild(cardEl);

  if (playerCard) {
    // Both played, resolve
    setTimeout(() => resolveRound(playerCard, card), 800);
  } else {
    // Wait for player
    playerTurn = true;
    updateTurnIndicator();
    messageEl.textContent = 'Sua vez! Escolha uma carta.';
    renderHands();
  }
}

function resolveRound(playerCard, cpuCard) {
  const pStr = getCardStrength(playerCard);
  const cStr = getCardStrength(cpuCard);

  currentRound++;
  let msg = '';

  if (pStr > cStr) {
    roundWinsPlayer++;
    msg = `Voce venceu a rodada! (${playerCard.value}${playerCard.suit} > ${cpuCard.value}${cpuCard.suit})`;
  } else if (cStr > pStr) {
    roundWinsCpu++;
    msg = `CPU venceu a rodada! (${cpuCard.value}${cpuCard.suit} > ${playerCard.value}${playerCard.suit})`;
  } else {
    msg = `Empate na rodada! (${playerCard.value} = ${cpuCard.value})`;
    // In truco, tie on first round goes to who is "mao"
    if (currentRound === 1) {
      if (firstToPlay === 'player') roundWinsPlayer++;
      else roundWinsCpu++;
    }
  }

  messageEl.textContent = msg;
  updateRoundInfo();

  // Check if hand is decided
  if (roundWinsPlayer >= 2 || roundWinsCpu >= 2 || currentRound >= 3) {
    setTimeout(() => finishHand(), 1500);
    return;
  }

  // Next round: loser plays first, or same order on tie
  setTimeout(() => {
    playerPlayedEl.innerHTML = '';
    cpuPlayedEl.innerHTML = '';
    cpuPlayedEl._card = null;

    let nextPlayerFirst = (pStr >= cStr);
    playerTurn = nextPlayerFirst;

    updateTurnIndicator();
    if (!playerTurn) {
      showCpuThinking();
      setTimeout(() => cpuPlayCard(), 1000);
    } else {
      messageEl.textContent = 'Sua vez! Escolha uma carta.';
    }

    updateRoundInfo();
    renderHands();
  }, 1600);
}

function finishHand() {
  const pts = TRUCO_VALUES[trucoLevel];
  let winner;

  if (roundWinsPlayer > roundWinsCpu) {
    playerScore += pts;
    winner = 'player';
    messageEl.textContent = `Voce ganhou a mao! +${pts} ponto(s)`;
  } else if (roundWinsCpu > roundWinsPlayer) {
    cpuScore += pts;
    winner = 'cpu';
    messageEl.textContent = `CPU ganhou a mao! +${pts} ponto(s)`;
  } else {
    // tie goes to first player ("mao")
    if (firstToPlay === 'player') {
      playerScore += pts;
      winner = 'player';
    } else {
      cpuScore += pts;
      winner = 'cpu';
    }
    messageEl.textContent = `Empate! ${winner === 'player' ? 'Voce' : 'CPU'} leva por ser mao. +${pts}`;
  }

  updateScores();

  // Alternate who starts
  firstToPlay = firstToPlay === 'player' ? 'cpu' : 'player';

  if (playerScore >= 12 || cpuScore >= 12) {
    endMatch();
  } else {
    btnTruco.style.display = 'none';
    btnNew.style.display = '';
  }
}

function endMatch() {
  gameOver = true;
  isProcessing = false;
  const won = playerScore >= 12;
  btnTruco.style.display = 'none';
  btnNew.style.display = 'none';

  modalIcon.textContent = won ? '🏆' : '😢';
  modalTitle.textContent = won ? 'Voce Venceu!' : 'CPU Venceu!';
  modalMessage.textContent = `Placar final: ${playerScore} x ${cpuScore}`;
  modalOverlay.classList.add('active');

  updateTurnIndicator(); // Clear turn indicators

  if (won) {
    launchConfetti();
    playSound('win');
  } else {
    playSound('error');
  }

  saveStats(won ? 'win' : 'loss');
}

async function saveStats(result) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('game_stats').insert({
      user_id: user.id,
      game: 'truco',
      result,
      moves: null,
      time_seconds: null
    });
  } catch (e) { /* ignore */ }
}

// === TRUCO CALLS ===
btnTruco.addEventListener('click', playerCallTruco);

function playerCallTruco() {
  if (waitingForTrucoResponse || gameOver || isProcessing) return;
  if (trucoLevel >= 4) return;

  isProcessing = true;
  trucoLevel++;
  playerTrucoCalled = true;
  waitingForTrucoResponse = true;

  const val = TRUCO_VALUES[trucoLevel];
  showTrucoIndicator(false);
  btnTruco.disabled = true;

  // CPU decides
  setTimeout(() => {
    const avgStr = cpuHand.reduce((s, c) => s + getCardStrength(c), 0) / cpuHand.length;
    const acceptChance = Math.min(0.8, avgStr / 12);

    if (Math.random() < acceptChance) {
      // Accept
      messageEl.textContent = `CPU aceitou! Valor da mao: ${val} pontos`;
      waitingForTrucoResponse = false;
      cpuTrucoCalled = false;
      updateRoundInfo();
      updateTurnIndicator();
      // CPU can now re-truco if level allows
      if (trucoLevel < 4) btnTruco.disabled = false;
    } else {
      // Decline - player wins hand at previous value
      const prevVal = TRUCO_VALUES[Math.max(0, trucoLevel - 1)];
      trucoLevel = Math.max(0, trucoLevel - 1);
      playerScore += prevVal;
      messageEl.textContent = `CPU correu! Voce ganhou ${prevVal} ponto(s)`;
      updateScores();
      waitingForTrucoResponse = false;
      firstToPlay = firstToPlay === 'player' ? 'cpu' : 'player';
      if (playerScore >= 12) {
        endMatch();
      } else {
        btnTruco.style.display = 'none';
        btnNew.style.display = '';
      }
    }
    isProcessing = false;
  }, 1500);
}

function cpuCallTruco() {
  trucoLevel++;
  cpuTrucoCalled = true;
  waitingForTrucoResponse = true;

  const val = TRUCO_VALUES[trucoLevel];
  showTrucoIndicator(true);

  btnTruco.style.display = 'none';
  btnAccept.style.display = '';
  btnDecline.style.display = '';
  playerTurn = false;
  updateTurnIndicator();
}

btnAccept.addEventListener('click', () => {
  if (isProcessing) return;
  waitingForTrucoResponse = false;
  btnAccept.style.display = 'none';
  btnDecline.style.display = 'none';
  btnTruco.style.display = '';
  btnTruco.disabled = trucoLevel >= 4;

  const val = TRUCO_VALUES[trucoLevel];
  messageEl.textContent = `Voce aceitou! Valor da mao: ${val} pontos`;
  updateRoundInfo();

  // Continue with CPU playing its card
  setTimeout(() => {
    cpuPlayActual();
  }, 800);
});

btnDecline.addEventListener('click', () => {
  if (isProcessing) return;
  waitingForTrucoResponse = false;
  btnAccept.style.display = 'none';
  btnDecline.style.display = 'none';

  const prevVal = TRUCO_VALUES[Math.max(0, trucoLevel - 1)];
  trucoLevel = Math.max(0, trucoLevel - 1);
  cpuScore += prevVal;
  messageEl.textContent = `Voce correu! CPU ganhou ${prevVal} ponto(s)`;
  playSound('error');
  updateScores();
  firstToPlay = firstToPlay === 'player' ? 'cpu' : 'player';
  if (cpuScore >= 12) {
    endMatch();
  } else {
    btnTruco.style.display = 'none';
    btnNew.style.display = '';
  }
});

function cpuPlayActual() {
  // Pick strongest card
  let bestIdx = 0;
  let bestStr = -1;
  cpuHand.forEach((c, i) => {
    const s = getCardStrength(c);
    if (s > bestStr) { bestStr = s; bestIdx = i; }
  });

  const card = cpuHand.splice(bestIdx, 1)[0];
  cpuPlayedEl.innerHTML = '';
  cpuPlayedEl._card = card;
  cpuPlayedEl.appendChild(createCardEl(card));

  playerTurn = true;
  messageEl.textContent = 'Sua vez! Escolha uma carta.';
  renderHands();
}

// === NEW HAND / MATCH ===
btnNew.addEventListener('click', () => {
  if (isProcessing) return;
  isProcessing = false;
  btnNew.style.display = 'none';
  startHand();
});

modalBtn.addEventListener('click', () => {
  modalOverlay.classList.remove('active');
  isProcessing = false;
  startMatch();
});

document.getElementById('btn-share')?.addEventListener('click', () => {
  shareOnWhatsApp(`🎉 Ganhei no Truco Mineiro do Games Hub! Venha jogar tambem: https://gameshub.com.br/games/truco/`);
});

// === START ===
startMatch();
