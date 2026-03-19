
import '../../auth-check.js';
import { initAudio, playSound } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';
import { GameStats } from '../shared/game-core.js';

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

// === GameStats ===
const gameStats = new GameStats('pife', { autoSync: true });

// ===== CONSTANTS =====
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUE = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
const CPU_NAMES = ['Ana 🤖', 'Bob 🤖', 'Cris 🤖'];

// ===== STATE =====
let deck = [];
let discardPile = [];
let players = []; // { name, hand: [], sequences: [], isHuman, hasBatted }
let currentPlayerIdx = 0;
let gamePhase = 'setup'; // setup, playing, finalRound, ended
let numPlayers = 2;
let selectedCard = null;
let mustDiscard = false;
let lastRoundStarter = -1;
let gameOver = false;

// ===== DECK FUNCTIONS =====
function createDeck() {
  const d = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      d.push({ rank, suit, value: RANK_VALUE[rank], id: `${rank}${suit}` });
    }
  }
  return d;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function isRed(suit) {
  return suit === '♥' || suit === '♦';
}

// ===== GAME LOGIC =====
function initGame(playerCount) {
  ensureAudio();
  numPlayers = playerCount;
  gameOver = false;
  gamePhase = 'playing';
  currentPlayerIdx = 0;
  lastRoundStarter = -1;
  selectedCard = null;
  mustDiscard = false;

  // Create deck and shuffle
  deck = shuffle(createDeck());
  discardPile = [];

  // Initialize players
  players = [];
  players.push({
    name: 'Voce',
    hand: [],
    sequences: [],
    isHuman: true,
    hasBatted: false,
    points: 0
  });

  for (let i = 1; i < numPlayers; i++) {
    players.push({
      name: CPU_NAMES[i - 1],
      hand: [],
      sequences: [],
      isHuman: false,
      hasBatted: false,
      points: 0
    });
  }

  // Deal 9 cards to each player
  for (let i = 0; i < numPlayers; i++) {
    for (let j = 0; j < 9; j++) {
      players[i].hand.push(deck.pop());
    }
    sortHand(players[i].hand);
  }

  // Place first card on discard pile
  discardPile.push(deck.pop());

  render();
  showMessage('Sua vez! Compre do monte ou do descarte.');
}

function sortHand(hand) {
  hand.sort((a, b) => {
    // Sort by suit first, then by value
    const suitOrder = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    if (suitOrder !== 0) return suitOrder;
    return a.value - b.value;
  });
}

// ===== SEQUENCE VALIDATION =====
function isValidSequence(cards) {
  if (cards.length !== 3) return false;

  // Check for trinca (same rank, different suits)
  const sameRank = cards.every(c => c.rank === cards[0].rank);
  const differentSuits = new Set(cards.map(c => c.suit)).size === 3;
  if (sameRank && differentSuits) return true;

  // Check for sequence (same suit, consecutive values)
  const sameSuit = cards.every(c => c.suit === cards[0].suit);
  if (sameSuit) {
    const values = cards.map(c => c.value).sort((a, b) => a - b);
    // Check consecutive: values[1] - values[0] === 1 && values[2] - values[1] === 1
    if (values[1] - values[0] === 1 && values[2] - values[1] === 1) return true;
    // Special case: Q-K-A is not valid in Pife (A is only low)
  }

  return false;
}

function findSequences(hand) {
  const sequences = [];
  const used = new Set();

  // Try all combinations of 3 cards
  for (let i = 0; i < hand.length; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < hand.length; j++) {
      if (used.has(j)) continue;
      for (let k = j + 1; k < hand.length; k++) {
        if (used.has(k)) continue;

        const combo = [hand[i], hand[j], hand[k]];
        if (isValidSequence(combo)) {
          sequences.push(combo);
          used.add(i);
          used.add(j);
          used.add(k);
        }
      }
    }
  }

  return sequences;
}

function canBat(player) {
  const sequences = findSequences(player.hand);
  return sequences.length === 3;
}

function calculateDeadwood(hand) {
  // Find best sequences to minimize deadwood
  const sequences = findSequences(hand);
  const usedCards = new Set();

  for (const seq of sequences) {
    for (const card of seq) {
      usedCards.add(card.id);
    }
  }

  const deadwood = hand.filter(c => !usedCards.has(c.id));
  return deadwood.reduce((sum, c) => sum + Math.min(c.value, 10), 0); // Face cards = 10
}

// ===== GAME ACTIONS =====
function drawFromDeck() {
  if (mustDiscard || gameOver) return;
  if (deck.length === 0) {
    // Reshuffle discard pile except top card
    const topCard = discardPile.pop();
    deck = shuffle([...discardPile]);
    discardPile = [topCard];
  }

  const card = deck.pop();
  players[currentPlayerIdx].hand.push(card);
  sortHand(players[currentPlayerIdx].hand);
  mustDiscard = true;
  playSound('deal');
  haptic(20);
  render();
  showMessage('Escolha uma carta para descartar');
}

function drawFromDiscard() {
  if (mustDiscard || gameOver || discardPile.length === 0) return;

  const card = discardPile.pop();
  players[currentPlayerIdx].hand.push(card);
  sortHand(players[currentPlayerIdx].hand);
  mustDiscard = true;
  playSound('deal');
  haptic(20);
  render();
  showMessage('Escolha uma carta para descartar');
}

function discardCard(cardIdx) {
  const player = players[currentPlayerIdx];
  if (cardIdx < 0 || cardIdx >= player.hand.length) return;

  const card = player.hand.splice(cardIdx, 1)[0];
  discardPile.push(card);
  mustDiscard = false;
  selectedCard = null;
  playSound('card');
  haptic(15);

  // Check if player can bat
  if (canBat(player) && !player.hasBatted) {
    document.getElementById('btn-declare').disabled = false;
  }

  // Move to next player
  nextTurn();
}

function declareBat() {
  const player = players[currentPlayerIdx];
  if (!canBat(player)) return;

  player.hasBatted = true;
  lastRoundStarter = currentPlayerIdx;
  gamePhase = 'finalRound';
  playSound('win');
  haptic(50);

  showMessage(`${player.name} bateu! Ultima rodada!`);

  // If human batted, proceed to final round
  if (player.isHuman) {
    nextTurn();
  }
}

function nextTurn() {
  render();

  // Check if final round completed
  if (gamePhase === 'finalRound') {
    // Check if we've gone full circle
    const nextIdx = (currentPlayerIdx + 1) % numPlayers;
    if (nextIdx === lastRoundStarter) {
      endGame();
      return;
    }
  }

  currentPlayerIdx = (currentPlayerIdx + 1) % numPlayers;

  if (players[currentPlayerIdx].isHuman) {
    showMessage('Sua vez! Compre do monte ou do descarte.');
    render();
  } else {
    setTimeout(cpuTurn, 1000);
  }
}

// ===== CPU AI =====
function cpuTurn() {
  if (gameOver) return;

  const player = players[currentPlayerIdx];
  showMessage(`${player.name} esta pensando...`);

  setTimeout(() => {
    // Decide whether to draw from deck or discard
    const topDiscard = discardPile[discardPile.length - 1];
    const wouldHelp = wouldCardHelp(player.hand, topDiscard);

    if (wouldHelp && Math.random() > 0.3) {
      // Take from discard
      player.hand.push(discardPile.pop());
      showMessage(`${player.name} pegou do descarte`);
    } else {
      // Take from deck
      if (deck.length === 0) {
        const topCard = discardPile.pop();
        deck = shuffle([...discardPile]);
        discardPile = [topCard];
      }
      player.hand.push(deck.pop());
      showMessage(`${player.name} comprou do monte`);
    }

    sortHand(player.hand);
    mustDiscard = true;
    playSound('deal');
    render();

    setTimeout(() => cpuDiscard(player), 800);
  }, 1000);
}

function wouldCardHelp(hand, card) {
  // Simulate adding card and check if it improves sequences
  const testHand = [...hand, card];
  const sequences = findSequences(testHand);
  return sequences.length > findSequences(hand).length;
}

function cpuDiscard(player) {
  // Find the card that is least useful
  let bestDiscardIdx = 0;
  let minValue = Infinity;

  for (let i = 0; i < player.hand.length; i++) {
    const testHand = player.hand.filter((_, idx) => idx !== i);
    const sequences = findSequences(testHand);
    const deadwood = calculateDeadwood(testHand);

    // Prefer keeping cards that form sequences
    const card = player.hand[i];
    const cardValue = card.value + (isPartOfSequence(player.hand, card) ? -20 : 0);

    if (cardValue < minValue) {
      minValue = cardValue;
      bestDiscardIdx = i;
    }
  }

  // Check if CPU can bat
  if (canBat(player) && !player.hasBatted && Math.random() > 0.2) {
    declareBat();
    return;
  }

  const discarded = player.hand.splice(bestDiscardIdx, 1)[0];
  discardPile.push(discarded);
  mustDiscard = false;
  playSound('card');
  showMessage(`${player.name} descartou ${discarded.rank}${discarded.suit}`);
  render();
  nextTurn();
}

function isPartOfSequence(hand, card) {
  // Check if card is part of any potential sequence
  for (const c of hand) {
    if (c === card) continue;
    // Check for trinca potential
    if (c.rank === card.rank && c.suit !== card.suit) return true;
    // Check for sequence potential
    if (c.suit === card.suit && Math.abs(c.value - card.value) <= 2) return true;
  }
  return false;
}

// ===== END GAME =====
function endGame() {
  gameOver = true;
  gamePhase = 'ended';

  // Calculate scores
  let winner = null;
  let minPoints = Infinity;

  for (const player of players) {
    if (player.hasBatted) {
      // Player who batted has 0 points
      player.points = 0;
      winner = player;
    } else {
      player.points = calculateDeadwood(player.hand);
      if (player.points < minPoints) {
        minPoints = player.points;
      }
    }
  }

  // If someone batted, they win
  // Otherwise, lowest deadwood wins
  if (!winner) {
    for (const player of players) {
      if (player.points === minPoints) {
        winner = player;
        break;
      }
    }
  }

  const humanWon = winner?.isHuman || false;

  // Save stats
  gameStats.recordGame(humanWon, { score: humanWon ? 0 : players[0].points });

  // Show results
  let resultsHtml = '<div class="results-list">';
  for (const player of players) {
    const isWinner = player === winner;
    resultsHtml += `
      <div class="result-row ${isWinner ? 'winner' : ''} ${player.isHuman ? 'human' : ''}">
        <span class="result-name">${player.name} ${isWinner ? '👑' : ''}</span>
        <span class="result-points">${player.points} pts</span>
      </div>
    `;
  }
  resultsHtml += '</div>';

  document.getElementById('modal-icon').textContent = humanWon ? '🏆' : '😔';
  document.getElementById('modal-title').textContent = humanWon ? 'Voce venceu!' : `${winner.name} venceu!`;
  document.getElementById('modal-body').innerHTML = resultsHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');

  if (humanWon) playSound('win');
}

// ===== RENDER =====
function cardEl(card, hidden = false, classes = '', clickable = false) {
  if (!card) return `<div class="card placeholder ${classes}"></div>`;
  if (hidden) return `<div class="card back ${classes}"></div>`;

  const red = isRed(card.suit) ? 'red' : '';
  const clickAttr = clickable ? `data-card-id="${card.id}"` : '';
  return `<div class="card ${red} ${classes}" ${clickAttr}>${card.rank}${card.suit}</div>`;
}

function render() {
  // Render opponents
  const opponentsRow = document.getElementById('opponents-row');
  opponentsRow.innerHTML = '';

  for (let i = 1; i < players.length; i++) {
    const p = players[i];
    const isActive = i === currentPlayerIdx;
    const cardCount = p.hand.length;

    opponentsRow.innerHTML += `
      <div class="opponent ${isActive ? 'active-turn' : ''} ${p.hasBatted ? 'has-batted' : ''}">
        <div class="opp-name">${p.name} ${p.hasBatted ? '👑' : ''}</div>
        <div class="opp-cards">
          ${Array(cardCount).fill('<div class="card back small"></div>').join('')}
        </div>
        <div class="opp-count">${cardCount} cartas</div>
      </div>
    `;
  }

  // Render table area
  const deckPile = document.getElementById('deck-pile');
  const discardPileEl = document.getElementById('discard-pile');

  // Deck
  const canDrawDeck = players[currentPlayerIdx]?.isHuman && !mustDiscard && !gameOver && deck.length > 0;
  deckPile.innerHTML = `
    <div class="card back deck-card ${canDrawDeck ? 'clickable' : ''}" id="deck-card" title="Comprar do monte">
      ${deck.length > 0 ? `<span class="deck-count">${deck.length}</span>` : ''}
    </div>
    <span class="pile-label">Monte</span>
  `;

  // Discard pile
  const topDiscard = discardPile[discardPile.length - 1];
  const canDrawDiscard = players[currentPlayerIdx]?.isHuman && !mustDiscard && !gameOver && topDiscard;
  discardPileEl.innerHTML = `
    ${topDiscard ? cardEl(topDiscard, false, canDrawDiscard ? 'clickable' : '') : '<div class="card placeholder"></div>'}
    <span class="pile-label">Descarte</span>
  `;

  // Render player hand
  const playerHand = document.getElementById('player-hand');
  const human = players[0];
  playerHand.innerHTML = '';

  for (let i = 0; i < human.hand.length; i++) {
    const card = human.hand[i];
    const isSelected = selectedCard === i;
    const canSelect = mustDiscard && !gameOver;
    playerHand.innerHTML += cardEl(card, false, `${isSelected ? 'selected' : ''} ${canSelect ? 'clickable' : ''}`, true);
  }

  // Render player sequences
  const sequencesEl = document.getElementById('player-sequences');
  const sequences = findSequences(human.hand);
  if (sequences.length > 0) {
    sequencesEl.innerHTML = sequences.map(seq => `
      <div class="sequence">
        ${seq.map(c => cardEl(c)).join('')}
      </div>
    `).join('');
  } else {
    sequencesEl.innerHTML = '';
  }

  // Update player status
  const statusEl = document.getElementById('player-status');
  if (human.hasBatted) {
    statusEl.textContent = '👑 Bateu!';
  } else if (canBat(human)) {
    statusEl.textContent = '✓ Pronto para bater!';
  } else {
    statusEl.textContent = `${sequences.length}/3 sequencias`;
  }

  // Update action buttons
  document.getElementById('btn-declare').disabled = !canBat(human) || human.hasBatted || mustDiscard || gameOver;

  // Highlight active player
  document.getElementById('player-area').classList.toggle('active-turn', currentPlayerIdx === 0 && !gameOver);
}

function showMessage(msg) {
  const el = document.getElementById('message');
  if (el) el.textContent = msg;
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
  // Player count selector
  document.querySelectorAll('.player-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.player-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      numPlayers = parseInt(btn.dataset.players);
    });
  });

  // Start game
  document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('config-panel').classList.add('hidden');
    document.getElementById('game-area').classList.remove('hidden');
    initGame(numPlayers);
  });

  // Deck click
  document.getElementById('deck-pile').addEventListener('click', (e) => {
    if (e.target.closest('#deck-card')) {
      drawFromDeck();
    }
  });

  // Discard pile click
  document.getElementById('discard-pile').addEventListener('click', (e) => {
    if (e.target.closest('.card') && !e.target.closest('.placeholder')) {
      drawFromDiscard();
    }
  });

  // Player hand click
  document.getElementById('player-hand').addEventListener('click', (e) => {
    const cardEl = e.target.closest('.card');
    if (!cardEl || !mustDiscard) return;

    const cardId = cardEl.dataset.cardId;
    const human = players[0];
    const cardIdx = human.hand.findIndex(c => c.id === cardId);

    if (cardIdx >= 0) {
      // Remove previous selection
      document.querySelectorAll('.card.selected').forEach(el => el.classList.remove('selected'));

      if (selectedCard === cardIdx) {
        // Discard this card
        discardCard(cardIdx);
      } else {
        // Select this card
        selectedCard = cardIdx;
        cardEl.classList.add('selected');
        showMessage('Clique novamente para descartar');
      }
    }
  });

  // Sort button
  document.getElementById('btn-sort').addEventListener('click', () => {
    const human = players[0];
    sortHand(human.hand);
    playSound('card');
    render();
  });

  // Declare button
  document.getElementById('btn-declare').addEventListener('click', () => {
    declareBat();
  });

  // New game button
  document.getElementById('btn-new').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('config-panel').classList.remove('hidden');
    document.getElementById('game-area').classList.add('hidden');
    showMessage('');
  });

  // Modal new game button
  document.getElementById('btn-modal-new').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('config-panel').classList.remove('hidden');
    document.getElementById('game-area').classList.add('hidden');
    showMessage('');
  });
});
