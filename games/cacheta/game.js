import '../../auth-check.js?v=4';
import { supabase } from '../../supabase.js?v=2';
import { initAudio, playSound, launchConfetti, showToast } from '../shared/game-design-utils.js?v=4';
import { GameStats } from '../shared/game-core.js';

// ===== CONSTANTS =====
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VAL = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 };
const HAND_SCORES = {
  'Royal Flush': 100,
  'Straight Flush': 75,
  'Four of a Kind': 50,
  'Full House': 25,
  'Flush': 20,
  'Straight': 15,
  'Three of a Kind': 10,
  'Two Pair': 5,
  'One Pair': 2,
  'High Card': 1
};
const CPU_NAMES = ['Ana 🤖', 'Bob 🤖', 'Carlos 🤖'];

// ===== STATE =====
let deck = [];
let discardPile = [];
let tableCards = []; // 6 cards on table (3 columns x 2 rows)
let players = []; // { name, hand: [], isHuman, score }
let currentPlayerIdx = 0;
let currentRound = 1;
let maxRounds = 3;
let numPlayers = 2;
let selectedHandCard = null;
let selectedTableCard = null;
let gameOver = false;
let session = null;

// GameStats
const gameStats = new GameStats('cacheta', { autoSync: true });

// ===== DECK FUNCTIONS =====
function createDeck() {
  const d = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      d.push({ rank, suit, value: RANK_VAL[rank] });
    }
  }
  return d;
}

function shuffle(d) {
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function isRed(suit) {
  return suit === '♥' || suit === '♦';
}

// ===== HAND EVALUATION (Poker) =====
function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k)
  ];
}

function evalFive(cards) {
  const vals = cards.map(c => c.value).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = new Set(suits).size === 1;
  let isStraight = vals[0] - vals[4] === 4 && new Set(vals).size === 5;
  let straightHigh = vals[0];

  // Ace-low straight (A-5-4-3-2)
  if (!isStraight && vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) {
    isStraight = true;
    straightHigh = 5;
  }

  const cnt = {};
  vals.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
  const groups = Object.entries(cnt).map(([v, c]) => ({ v: +v, c })).sort((a, b) => b.c - a.c || b.v - a.v);
  const [g0, g1] = groups;

  if (isFlush && isStraight) {
    return { rank: straightHigh === 14 ? 9 : 8, name: straightHigh === 14 ? 'Royal Flush' : 'Straight Flush', primary: straightHigh, vals };
  }
  if (g0.c === 4) return { rank: 7, name: 'Four of a Kind', primary: g0.v, kicker: g1?.v, vals };
  if (g0.c === 3 && g1 && g1.c === 2) return { rank: 6, name: 'Full House', primary: g0.v, secondary: g1.v, vals };
  if (isFlush) return { rank: 5, name: 'Flush', primary: vals[0], vals };
  if (isStraight) return { rank: 4, name: 'Straight', primary: straightHigh, vals };
  if (g0.c === 3) return { rank: 3, name: 'Three of a Kind', primary: g0.v, vals };
  if (g0.c === 2 && g1 && g1.c === 2) return { rank: 2, name: 'Two Pair', primary: Math.max(g0.v, g1.v), secondary: Math.min(g0.v, g1.v), vals };
  if (g0.c === 2) return { rank: 1, name: 'One Pair', primary: g0.v, vals };
  return { rank: 0, name: 'High Card', primary: vals[0], vals };
}

function bestHand(hand, table) {
  // Combine hand (3 cards) + table (6 cards) = 9 cards, find best 5
  const all = [...hand, ...table];
  const combos = combinations(all, 5);
  let best = null;
  for (const combo of combos) {
    const ev = evalFive(combo);
    if (!best || compareEval(ev, best) > 0) best = ev;
  }
  return best;
}

function compareEval(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.primary !== b.primary) return a.primary - b.primary;
  if (a.secondary !== undefined && b.secondary !== undefined) return a.secondary - b.secondary;
  for (let i = 0; i < Math.min(a.vals.length, b.vals.length); i++) {
    if (a.vals[i] !== b.vals[i]) return a.vals[i] - b.vals[i];
  }
  return 0;
}

// ===== GAME INITIALIZATION =====
async function init() {
  const { data: { session: s } } = await supabase.auth.getSession();
  session = s;

  setupEventListeners();
}

function setupEventListeners() {
  // Player selection
  document.querySelectorAll('.player-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      numPlayers = parseInt(btn.dataset.players);
      startGame();
    });
  });

  // Game actions
  document.getElementById('btn-draw')?.addEventListener('click', drawFromDeck);
  document.getElementById('btn-discard-draw')?.addEventListener('click', drawFromDiscard);
  document.getElementById('btn-swap')?.addEventListener('click', performSwap);
  document.getElementById('btn-pass')?.addEventListener('click', passTurn);
  document.getElementById('btn-new-game')?.addEventListener('click', resetGame);
  document.getElementById('btn-modal-new')?.addEventListener('click', resetGame);
}

function startGame() {
  initAudio();
  playSound('start');

  // Hide setup, show game
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');

  // Initialize game state
  deck = shuffle(createDeck());
  discardPile = [];
  tableCards = [];
  currentRound = 1;
  gameOver = false;
  selectedHandCard = null;
  selectedTableCard = null;

  // Initialize players
  players = [{
    name: 'Voce',
    hand: [],
    isHuman: true,
    score: 0
  }];

  for (let i = 1; i < numPlayers; i++) {
    players.push({
      name: CPU_NAMES[i - 1],
      hand: [],
      isHuman: false,
      score: 0
    });
  }

  // Deal cards
  // Each player gets 3 cards in hand
  for (let i = 0; i < 3; i++) {
    for (const p of players) {
      p.hand.push(deck.pop());
    }
  }

  // Deal 6 cards to table (3 columns x 2 rows)
  for (let i = 0; i < 6; i++) {
    tableCards.push(deck.pop());
  }

  currentPlayerIdx = 0;
  render();
  showMessage('Rodada 1 - Sua vez! Escolha uma carta da mesa para trocar.');
}

// ===== GAME ACTIONS =====
function selectHandCard(index) {
  if (gameOver) return;
  if (!players[currentPlayerIdx].isHuman) return;

  selectedHandCard = index;
  render();
}

function selectTableCard(index) {
  if (gameOver) return;
  if (!players[currentPlayerIdx].isHuman) return;

  selectedTableCard = index;
  render();
}

function drawFromDeck() {
  if (gameOver) return;
  if (!players[currentPlayerIdx].isHuman) return;
  if (deck.length === 0) {
    showMessage('Monte vazio!');
    return;
  }

  // Draw and discard
  const drawn = deck.pop();
  discardPile.push(drawn);
  playSound('deal');

  showMessage(`Comprou: ${drawn.rank}${drawn.suit} - Descartou automaticamente`);

  // Check if round should end
  checkRoundEnd();
}

function drawFromDiscard() {
  if (gameOver) return;
  if (!players[currentPlayerIdx].isHuman) return;
  if (discardPile.length === 0) {
    showMessage('Nenhuma carta no descarte!');
    return;
  }

  // Can only take from discard if we swap with table
  if (selectedTableCard === null) {
    showMessage('Selecione uma carta da mesa primeiro!');
    return;
  }

  const drawn = discardPile.pop();
  const oldTableCard = tableCards[selectedTableCard];
  tableCards[selectedTableCard] = drawn;
  discardPile.push(oldTableCard);

  playSound('deal');
  selectedTableCard = null;

  showMessage(`Trocou mesa por ${drawn.rank}${drawn.suit} do descarte`);

  checkRoundEnd();
}

function performSwap() {
  if (gameOver) return;
  if (!players[currentPlayerIdx].isHuman) return;
  if (selectedHandCard === null || selectedTableCard === null) {
    showMessage('Selecione uma carta da mao e uma da mesa!');
    return;
  }

  const player = players[currentPlayerIdx];
  const handCard = player.hand[selectedHandCard];
  const tableCard = tableCards[selectedTableCard];

  // Swap
  player.hand[selectedHandCard] = tableCard;
  tableCards[selectedTableCard] = handCard;
  discardPile.push(handCard);

  playSound('move');

  selectedHandCard = null;
  selectedTableCard = null;

  showMessage(`Trocou ${handCard.rank}${handCard.suit} por ${tableCard.rank}${tableCard.suit}`);

  checkRoundEnd();
}

function passTurn() {
  if (gameOver) return;
  if (!players[currentPlayerIdx].isHuman) return;

  showMessage('Passou a vez');
  nextTurn();
}

function nextTurn() {
  currentPlayerIdx = (currentPlayerIdx + 1) % players.length;

  if (currentPlayerIdx === 0) {
    // Completed a full round
    currentRound++;
    if (currentRound > maxRounds) {
      endGame();
      return;
    }
  }

  render();

  if (players[currentPlayerIdx].isHuman) {
    showMessage(`Rodada ${currentRound} - Sua vez!`);
  } else {
    showMessage(`Rodada ${currentRound} - Vez de ${players[currentPlayerIdx].name}`);
    setTimeout(cpuTurn, 1500);
  }
}

function checkRoundEnd() {
  // In cacheta, each player makes one swap per round
  nextTurn();
}

// ===== CPU AI =====
function cpuTurn() {
  if (gameOver) return;
  const cpu = players[currentPlayerIdx];
  if (cpu.isHuman) return;

  // CPU logic: evaluate best swap
  let bestSwap = null;
  let bestImprovement = -1;

  const currentEval = bestHand(cpu.hand, tableCards);
  const currentScore = HAND_SCORES[currentEval.name] || 0;

  // Try each possible swap
  for (let h = 0; h < cpu.hand.length; h++) {
    for (let t = 0; t < tableCards.length; t++) {
      // Simulate swap
      const newHand = [...cpu.hand];
      const newTable = [...tableCards];
      newHand[h] = tableCards[t];
      newTable[t] = cpu.hand[h];

      const newEval = bestHand(newHand, newTable);
      const newScore = HAND_SCORES[newEval.name] || 0;
      const improvement = newScore - currentScore;

      if (improvement > bestImprovement) {
        bestImprovement = improvement;
        bestSwap = { handIdx: h, tableIdx: t };
      }
    }
  }

  // Execute best swap if it improves or randomly
  if (bestSwap && (bestImprovement > 0 || Math.random() < 0.3)) {
    const handCard = cpu.hand[bestSwap.handIdx];
    const tableCard = tableCards[bestSwap.tableIdx];

    cpu.hand[bestSwap.handIdx] = tableCard;
    tableCards[bestSwap.tableIdx] = handCard;
    discardPile.push(handCard);

    showMessage(`${cpu.name} trocou ${handCard.rank}${handCard.suit} por ${tableCard.rank}${tableCard.suit}`);
    playSound('move');
  } else {
    showMessage(`${cpu.name} passou`);
  }

  setTimeout(nextTurn, 1000);
}

// ===== END GAME =====
function endGame() {
  gameOver = true;

  // Evaluate all hands
  for (const p of players) {
    const ev = bestHand(p.hand, tableCards);
    p.score = HAND_SCORES[ev.name] || 0;
    p.handName = ev.name;
    p.handEval = ev;
  }

  // Find winner
  let winner = players[0];
  for (const p of players) {
    if (p.score > winner.score ||
        (p.score === winner.score && compareEval(p.handEval, winner.handEval) > 0)) {
      winner = p;
    }
  }

  const humanWon = winner.isHuman;

  // Save stats
  gameStats.recordGame(humanWon, { score: humanWon ? winner.score : 0 });

  // Show results
  showResults(winner);

  if (humanWon) {
    playSound('win');
    launchConfetti();
  } else {
    playSound('gameover');
  }
}

function showResults(winner) {
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('game-over-screen').classList.remove('hidden');

  const panel = document.getElementById('results-panel');
  let html = `
    <div class="winner-announcement">
      <div class="winner-icon">${winner.isHuman ? '🏆' : '🤖'}</div>
      <h2>${winner.isHuman ? 'Voce venceu!' : `${winner.name} venceu!`}</h2>
      <p class="winner-hand">${winner.handName} - ${winner.score} pontos</p>
    </div>
    <div class="results-list">
  `;

  // Sort by score
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return compareEval(b.handEval, a.handEval);
  });

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const isWinner = p === winner;
    html += `
      <div class="result-row ${isWinner ? 'winner' : ''} ${p.isHuman ? 'human' : ''}">
        <div class="result-rank">#${i + 1}</div>
        <div class="result-info">
          <div class="result-name">${p.name} ${p.isHuman ? '(Voce)' : ''}</div>
          <div class="result-hand">${p.handName}</div>
        </div>
        <div class="result-score">${p.score} pts</div>
      </div>
    `;
  }

  html += '</div>';
  panel.innerHTML = html;
}

function resetGame() {
  document.getElementById('setup-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ===== RENDER =====
function render() {
  renderOpponents();
  renderTable();
  renderPlayer();
  renderDeck();
  updateUI();
}

function renderOpponents() {
  const area = document.getElementById('opponents-area');
  if (!area) return;

  let html = '';
  for (let i = 1; i < players.length; i++) {
    const p = players[i];
    const isActive = i === currentPlayerIdx;
    html += `
      <div class="opponent ${isActive ? 'active' : ''}">
        <div class="opp-name">${p.name}</div>
        <div class="opp-cards">
          ${p.hand.map(() => `<div class="card-small back"></div>`).join('')}
        </div>
        ${isActive ? '<div class="opp-turn">Jogando...</div>' : ''}
      </div>
    `;
  }
  area.innerHTML = html;
}

function renderTable() {
  const slots = document.getElementById('table-slots');
  if (!slots) return;

  let html = '';
  for (let i = 0; i < tableCards.length; i++) {
    const card = tableCards[i];
    const isSelected = i === selectedTableCard;
    const col = Math.floor(i / 2);
    const row = i % 2;

    html += `
      <div class="table-slot ${isSelected ? 'selected' : ''}"
           data-index="${i}"
           onclick="window.selectTableCard(${i})">
        ${cardEl(card, false, 'table-card')}
      </div>
    `;
  }
  slots.innerHTML = html;
}

function renderPlayer() {
  const p = players[0];
  if (!p) return;

  // Hand
  const handEl = document.getElementById('player-hand');
  if (handEl) {
    let html = '';
    for (let i = 0; i < p.hand.length; i++) {
      const card = p.hand[i];
      const isSelected = i === selectedHandCard;
      html += `
        <div class="hand-card-wrapper ${isSelected ? 'selected' : ''}"
             onclick="window.selectHandCard(${i})">
          ${cardEl(card, false, 'player-card')}
        </div>
      `;
    }
    handEl.innerHTML = html;
  }

  // Hand value
  const ev = bestHand(p.hand, tableCards);
  const handValueEl = document.getElementById('player-hand-value');
  if (handValueEl && ev) {
    handValueEl.textContent = `${ev.name} (${HAND_SCORES[ev.name] || 0} pts)`;
  }
}

function renderDeck() {
  const deckCount = document.getElementById('deck-count');
  if (deckCount) {
    deckCount.textContent = deck.length;
  }

  const discardPileEl = document.getElementById('discard-pile');
  if (discardPileEl) {
    if (discardPile.length > 0) {
      const topCard = discardPile[discardPile.length - 1];
      discardPileEl.innerHTML = cardEl(topCard, false, 'discard-card');
    } else {
      discardPileEl.innerHTML = '<div class="discard-placeholder">Descarte</div>';
    }
  }
}

function updateUI() {
  // Round info
  const roundInfo = document.getElementById('round-info');
  if (roundInfo) {
    roundInfo.textContent = `Rodada ${currentRound}/${maxRounds}`;
  }

  const roundDisplay = document.getElementById('round-display');
  if (roundDisplay) {
    roundDisplay.textContent = `Rodada ${currentRound}`;
  }

  // Turn display
  const turnDisplay = document.getElementById('turn-display');
  if (turnDisplay) {
    if (players[currentPlayerIdx]?.isHuman) {
      turnDisplay.textContent = 'Sua vez';
      turnDisplay.className = 'turn-display your-turn';
    } else {
      turnDisplay.textContent = `Vez de ${players[currentPlayerIdx]?.name}`;
      turnDisplay.className = 'turn-display opponent-turn';
    }
  }

  // Player area active state
  const playerArea = document.getElementById('player-area');
  if (playerArea) {
    playerArea.classList.toggle('active-turn', players[currentPlayerIdx]?.isHuman);
  }

  // Button states
  const btnSwap = document.getElementById('btn-swap');
  if (btnSwap) {
    btnSwap.disabled = selectedHandCard === null || selectedTableCard === null;
  }

  const btnDiscardDraw = document.getElementById('btn-discard-draw');
  if (btnDiscardDraw) {
    btnDiscardDraw.disabled = discardPile.length === 0 || selectedTableCard === null;
  }
}

function cardEl(card, hidden = false, classes = '') {
  if (!card || hidden) return `<div class="card back ${classes}"></div>`;
  const red = isRed(card.suit);
  return `<div class="card ${red ? 'red' : ''} ${classes}">
    <span class="card-rank">${card.rank}</span>
    <span class="card-suit">${card.suit}</span>
  </div>`;
}

function showMessage(msg) {
  const el = document.getElementById('message');
  if (el) el.textContent = msg;
}

// Expose functions to window for onclick handlers
window.selectHandCard = selectHandCard;
window.selectTableCard = selectTableCard;

// Initialize
if (typeof window !== 'undefined') {
  window.addEventListener('load', init);
}
