import '../../auth-check.js';
import { supabase } from '../../supabase.js';

// === DOM Elements ===
const dealerHandEl = document.getElementById('dealer-hand');
const playerHandEl = document.getElementById('player-hand');
const dealerScoreEl = document.getElementById('dealer-score');
const playerScoreEl = document.getElementById('player-score');
const balanceEl = document.getElementById('balance-display');
const betDisplayEl = document.getElementById('bet-display');
const betInput = document.getElementById('bet-input');
const betControls = document.getElementById('bet-controls');
const btnHit = document.getElementById('btn-hit');
const btnStand = document.getElementById('btn-stand');
const btnDouble = document.getElementById('btn-double');
const btnNew = document.getElementById('btn-new');
const btnBetMinus = document.getElementById('bet-minus');
const btnBetPlus = document.getElementById('bet-plus');
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalBtn = document.getElementById('modal-btn');

// === Game State ===
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

let deck = [];
let dealerHand = [];
let playerHand = [];
let balance = parseInt(localStorage.getItem('bj_balance')) || 1000;
let currentBet = 10;
let gameActive = false;
let roundOver = false;

// === Initialization ===
updateBalanceDisplay();
betInput.value = currentBet;

// === Deck Functions ===
function createDeck() {
  const d = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      d.push({ suit, value });
    }
  }
  return d;
}

function shuffleDeck(d) {
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function drawCard() {
  if (deck.length === 0) {
    deck = shuffleDeck(createDeck());
  }
  return deck.pop();
}

// === Hand Value ===
function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.value === 'A') {
      aces++;
      total += 11;
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      total += 10;
    } else {
      total += parseInt(card.value);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

function isSoft17(hand) {
  if (handValue(hand) !== 17) return false;
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.value === 'A') { aces++; total += 11; }
    else if (['J', 'Q', 'K'].includes(card.value)) { total += 10; }
    else { total += parseInt(card.value); }
  }
  // If we had to reduce aces to get to 17, it's not soft 17
  let reduced = 0;
  while (total > 21 && reduced < aces) { total -= 10; reduced++; }
  // Soft 17 means at least one ace still counts as 11
  return total === 17 && reduced < aces;
}

// === Card Rendering ===
function isRed(suit) {
  return suit === '♥' || suit === '♦';
}

function createCardEl(card, hidden = false) {
  const el = document.createElement('div');
  el.classList.add('card');

  if (hidden) {
    el.classList.add('card-back');
    return el;
  }

  el.classList.add(isRed(card.suit) ? 'red' : 'black');

  el.innerHTML = `
    <div class="card-top">
      <span>${card.value}</span>
      <span>${card.suit}</span>
    </div>
    <div class="card-center">${card.suit}</div>
    <div class="card-bottom">
      <span>${card.value}</span>
      <span>${card.suit}</span>
    </div>
  `;
  return el;
}

function renderHand(hand, container, hideFirst = false) {
  container.innerHTML = '';
  hand.forEach((card, i) => {
    const el = createCardEl(card, hideFirst && i === 0);
    container.appendChild(el);
  });
}

function updateScores(hideDealer = false) {
  const pv = handValue(playerHand);
  playerScoreEl.textContent = pv;

  if (hideDealer) {
    // Show only visible card value
    const visibleCards = dealerHand.slice(1);
    const visibleVal = handValue(visibleCards);
    dealerScoreEl.textContent = `? + ${visibleVal}`;
  } else {
    dealerScoreEl.textContent = handValue(dealerHand);
  }
}

// === Balance ===
function updateBalanceDisplay() {
  balanceEl.textContent = balance;
  betDisplayEl.textContent = currentBet;
  localStorage.setItem('bj_balance', balance);
}

// === Game Flow ===
function startRound() {
  const bet = parseInt(betInput.value) || 10;
  if (bet < 1) { betInput.value = 1; return; }
  if (bet > balance) {
    betInput.value = balance;
    return;
  }
  currentBet = bet;

  deck = shuffleDeck(createDeck());
  playerHand = [drawCard(), drawCard()];
  dealerHand = [drawCard(), drawCard()];
  gameActive = true;
  roundOver = false;

  renderHand(dealerHand, dealerHandEl, true);
  renderHand(playerHand, playerHandEl);
  updateScores(true);
  updateBalanceDisplay();

  btnHit.disabled = false;
  btnStand.disabled = false;
  btnDouble.disabled = (balance < currentBet * 2) || playerHand.length !== 2 ? true : false;
  btnNew.disabled = true;
  betControls.style.opacity = '0.4';
  betControls.style.pointerEvents = 'none';

  // Check player blackjack immediately
  if (isBlackjack(playerHand)) {
    revealDealer();
    if (isBlackjack(dealerHand)) {
      endRound('draw', 'Empate!', 'Ambos com Blackjack!');
    } else {
      const winnings = Math.floor(currentBet * 1.5);
      balance += winnings;
      endRound('win', 'Blackjack!', `Voce ganhou ${winnings} fichas!`);
    }
  }
}

function hit() {
  if (!gameActive) return;
  if (navigator.vibrate) navigator.vibrate(10);
  playerHand.push(drawCard());
  renderHand(playerHand, playerHandEl);
  updateScores(true);

  // Disable double after first hit
  btnDouble.disabled = true;

  const pv = handValue(playerHand);
  if (pv > 21) {
    revealDealer();
    balance -= currentBet;
    endRound('loss', 'Estourou!', `Voce passou de 21. Perdeu ${currentBet} fichas.`);
  } else if (pv === 21) {
    stand();
  }
}

function stand() {
  if (!gameActive) return;
  if (navigator.vibrate) navigator.vibrate(10);
  gameActive = false;

  revealDealer();
  dealerPlay();
}

function doubleDown() {
  if (!gameActive || playerHand.length !== 2) return;
  if (navigator.vibrate) navigator.vibrate(15);
  currentBet *= 2;
  updateBalanceDisplay();

  playerHand.push(drawCard());
  renderHand(playerHand, playerHandEl);
  updateScores(true);

  const pv = handValue(playerHand);
  if (pv > 21) {
    revealDealer();
    balance -= currentBet;
    endRound('loss', 'Estourou!', `Voce passou de 21. Perdeu ${currentBet} fichas.`);
  } else {
    stand();
  }
}

function revealDealer() {
  renderHand(dealerHand, dealerHandEl, false);
  // Add flip animation to first card
  const firstCard = dealerHandEl.querySelector('.card');
  if (firstCard) firstCard.classList.add('flip');
  updateScores(false);
}

function dealerPlay() {
  function dealerStep() {
    const dv = handValue(dealerHand);
    if (dv < 17 || isSoft17(dealerHand)) {
      dealerHand.push(drawCard());
      renderHand(dealerHand, dealerHandEl);
      updateScores(false);
      setTimeout(dealerStep, 600);
    } else {
      resolveRound();
    }
  }
  setTimeout(dealerStep, 500);
}

function resolveRound() {
  const pv = handValue(playerHand);
  const dv = handValue(dealerHand);

  if (dv > 21) {
    balance += currentBet;
    endRound('win', 'Dealer estourou!', `Dealer passou de 21. Voce ganhou ${currentBet} fichas!`);
  } else if (pv > dv) {
    balance += currentBet;
    endRound('win', 'Voce venceu!', `${pv} contra ${dv}. Ganhou ${currentBet} fichas!`);
  } else if (dv > pv) {
    balance -= currentBet;
    endRound('loss', 'Dealer venceu!', `${dv} contra ${pv}. Perdeu ${currentBet} fichas.`);
  } else {
    endRound('draw', 'Empate!', `Ambos com ${pv}. Aposta devolvida.`);
  }
}

function endRound(result, title, message) {
  gameActive = false;
  roundOver = true;
  // Mobile: haptic feedback baseado no resultado
  if (navigator.vibrate) {
    if (result === 'win' || result === 'blackjack') navigator.vibrate([20, 10, 30]);
    else if (result === 'loss') navigator.vibrate([40, 20, 50]);
    else navigator.vibrate(10); // draw
  }

  btnHit.disabled = true;
  btnStand.disabled = true;
  btnDouble.disabled = true;
  btnNew.disabled = false;
  betControls.style.opacity = '1';
  betControls.style.pointerEvents = 'auto';

  if (balance <= 0) {
    balance = 1000;
    message += ' Saldo resetado para 1000.';
  }
  updateBalanceDisplay();

  // Set modal content
  if (result === 'win') {
    modalIcon.textContent = '🎉';
    modalTitle.style.color = '#2ecc71';
  } else if (result === 'loss') {
    modalIcon.textContent = '😞';
    modalTitle.style.color = '#e74c3c';
  } else {
    modalIcon.textContent = '🤝';
    modalTitle.style.color = '#f39c12';
  }
  modalTitle.textContent = title;
  modalMessage.textContent = message;

  setTimeout(() => {
    modalOverlay.classList.add('active');
  }, 800);

  saveGameStat(result);
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

// === Supabase Stats ===
async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'blackjack',
      result: result,
      moves: 0,
      time_seconds: 0,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// === Event Listeners ===
btnHit.addEventListener('click', hit);
btnStand.addEventListener('click', stand);
btnDouble.addEventListener('click', doubleDown);
btnNew.addEventListener('click', () => {
  closeModal();
  startRound();
});
modalBtn.addEventListener('click', () => {
  closeModal();
  startRound();
});

btnBetMinus.addEventListener('click', () => {
  let v = parseInt(betInput.value) || 10;
  v = Math.max(1, v - 5);
  betInput.value = v;
});
btnBetPlus.addEventListener('click', () => {
  let v = parseInt(betInput.value) || 10;
  v = Math.min(balance, v + 5);
  betInput.value = v;
});

// Close modal on overlay click
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') { if (!btnHit.disabled) hit(); }
  if (e.key === 's' || e.key === 'S') { if (!btnStand.disabled) stand(); }
  if (e.key === 'd' || e.key === 'D') { if (!btnDouble.disabled) doubleDown(); }
  if (e.key === 'n' || e.key === 'N') { if (!btnNew.disabled) { closeModal(); startRound(); } }
  if (e.key === 'Enter' && modalOverlay.classList.contains('active')) { closeModal(); startRound(); }
});

// Start first round
startRound();
