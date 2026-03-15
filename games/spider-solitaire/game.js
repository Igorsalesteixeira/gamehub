// =============================================
//  PACIÊNCIA SPIDER — game.js
// =============================================

// ---- Constants ----
const SUITS_1 = ['♠','♠','♠','♠'];
const SUITS_2 = ['♠','♠','♥','♥'];
const SUITS_4 = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUIT_CLASS = { '♠':'suit-spades', '♥':'suit-hearts', '♦':'suit-diamonds', '♣':'suit-clubs' };

// ---- State ----
let state = {
  columns: [],      // array of 10 arrays of card objects
  stock: [],        // array of 10 groups (each group = 10 cards)
  foundations: [],  // 8 completed sequences
  history: [],      // stack of saved states for undo
  moves: 0,
  suitCount: 1,
};

// Card object: { rank, suit, faceUp }
// rank: index 0..12 (A=0, K=12)

let timerInterval = null;
let secondsElapsed = 0;
let selectedCard = null; // { colIndex, cardIndex }

// ---- DOM refs ----
const tableau    = document.getElementById('tableau');
const stockEl    = document.getElementById('stock');
const stockCount = document.getElementById('stock-count');
const foundationsEl = document.getElementById('foundations');
const movesDisplay  = document.getElementById('moves-display');
const timeDisplay   = document.getElementById('time-display');
const winModal      = document.getElementById('win-modal');
const winStats      = document.getElementById('win-stats');

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-win-new').addEventListener('click', () => { winModal.classList.remove('show'); newGame(); });
stockEl.addEventListener('click', dealFromStock);
document.getElementById('suit-count').addEventListener('change', e => {
  state.suitCount = parseInt(e.target.value);
  newGame();
});

// =============================================
//  BUILD DECK
// =============================================
function buildDeck(suitCount) {
  const suits = suitCount === 1 ? SUITS_1 : suitCount === 2 ? SUITS_2 : SUITS_4;
  let deck = [];
  for (let s = 0; s < 4; s++) {
    for (let r = 0; r < 13; r++) {
      deck.push({ rank: r, suit: suits[s], faceUp: false });
      deck.push({ rank: r, suit: suits[s], faceUp: false });
    }
  }
  return shuffle(deck);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =============================================
//  NEW GAME
// =============================================
function newGame() {
  selectedCard = null;
  clearInterval(timerInterval);
  secondsElapsed = 0;
  updateTimer();

  const suitCount = state.suitCount || 1;
  const deck = buildDeck(suitCount);

  // Deal: columns 0-3 get 6 cards, 4-9 get 5 cards (total 54)
  const columns = [];
  let idx = 0;
  for (let c = 0; c < 10; c++) {
    const count = c < 4 ? 6 : 5;
    const col = [];
    for (let i = 0; i < count; i++) {
      col.push({ ...deck[idx++] });
    }
    col[col.length - 1].faceUp = true;
    columns.push(col);
  }

  // Remaining 50 cards → 5 groups of 10
  const stockGroups = [];
  for (let g = 0; g < 5; g++) {
    const group = [];
    for (let i = 0; i < 10; i++) {
      group.push({ ...deck[idx++] });
    }
    stockGroups.push(group);
  }

  state = {
    columns,
    stock: stockGroups,
    foundations: [],
    history: [],
    moves: 0,
    suitCount,
  };

  startTimer();
  render();
}

// =============================================
//  TIMER
// =============================================
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    secondsElapsed++;
    updateTimer();
  }, 1000);
}

function updateTimer() {
  const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
  const s = String(secondsElapsed % 60).padStart(2, '0');
  timeDisplay.textContent = `⏱ ${m}:${s}`;
}

// =============================================
//  RENDER
// =============================================
function render() {
  renderTableau();
  renderFoundations();
  renderStock();
  movesDisplay.textContent = `Movimentos: ${state.moves}`;
  document.getElementById('btn-undo').disabled = state.history.length === 0;
}

function renderTableau() {
  for (let c = 0; c < 10; c++) {
    const colEl = document.getElementById(`col${c}`);
    colEl.innerHTML = '';
    const col = state.columns[c];
    const OFFSET_DOWN = 28;   // px between face-down cards
    const OFFSET_UP   = 22;   // px between face-up cards (slightly tighter)

    let topPx = 0;
    col.forEach((card, i) => {
      const cardEl = createCardEl(card, c, i);
      cardEl.style.top = topPx + 'px';

      // Calculate offset for next card
      if (i < col.length - 1) {
        topPx += card.faceUp ? OFFSET_UP : OFFSET_DOWN;
      }
      colEl.appendChild(cardEl);
    });

    // Set column height so it doesn't collapse
    const totalH = col.length === 0 ? 100 : topPx + 88;
    colEl.style.height = totalH + 'px';
  }
}

function createCardEl(card, colIndex, cardIndex) {
  const el = document.createElement('div');
  el.classList.add('card');

  if (!card.faceUp) {
    el.classList.add('face-down');
    return el;
  }

  el.classList.add('face-up');
  el.classList.add(SUIT_CLASS[card.suit] || 'suit-spades');
  el.draggable = true;

  const rankStr = RANKS[card.rank];
  el.innerHTML = `
    <div class="card-top">${rankStr}<br>${card.suit}</div>
    <div class="card-center">${card.suit}</div>
    <div class="card-bottom">${rankStr}<br>${card.suit}</div>
  `;

  // Highlight selected
  if (selectedCard && selectedCard.colIndex === colIndex && selectedCard.cardIndex === cardIndex) {
    el.classList.add('selected');
  }

  // Click handler
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    handleCardClick(colIndex, cardIndex);
  });

  // Drag start
  el.addEventListener('dragstart', (e) => {
    // Only allow dragging if it's a valid movable sequence
    if (!canPickUp(colIndex, cardIndex)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', JSON.stringify({ colIndex, cardIndex }));
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => el.classList.add('dragging'), 0);
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
  });

  return el;
}

function renderFoundations() {
  for (let f = 0; f < 8; f++) {
    const fEl = document.getElementById(`f${f}`);
    if (f < state.foundations.length) {
      fEl.classList.add('completed');
      fEl.innerHTML = `<div class="top-card suit-spades">♠<br>K</div>`;
      // Show suit of completed sequence
      const suit = state.foundations[f];
      fEl.innerHTML = `<div class="top-card ${SUIT_CLASS[suit]}">${suit}<br>K</div>`;
    } else {
      fEl.classList.remove('completed');
      fEl.innerHTML = '';
    }
  }
}

function renderStock() {
  const remaining = state.stock.length;
  stockCount.textContent = remaining;
  if (remaining === 0) {
    stockEl.classList.add('empty');
  } else {
    stockEl.classList.remove('empty');
  }
}

// =============================================
//  DRAG & DROP on columns
// =============================================
for (let c = 0; c < 10; c++) {
  const colEl = document.getElementById(`col${c}`);

  colEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    colEl.classList.add('drop-target');
  });

  colEl.addEventListener('dragleave', () => {
    colEl.classList.remove('drop-target');
  });

  colEl.addEventListener('drop', (e) => {
    e.preventDefault();
    colEl.classList.remove('drop-target');
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const { colIndex: fromCol, cardIndex: fromCard } = JSON.parse(data);
    const toCol = parseInt(colEl.dataset.col);
    if (fromCol !== toCol) {
      tryMove(fromCol, fromCard, toCol);
    }
  });

  // Click on empty column to drop selected cards
  colEl.addEventListener('click', () => {
    if (selectedCard && selectedCard.colIndex !== c) {
      tryMove(selectedCard.colIndex, selectedCard.cardIndex, c);
    }
  });
}

// =============================================
//  CLICK TO MOVE
// =============================================
function handleCardClick(colIndex, cardIndex) {
  const col = state.columns[colIndex];
  const card = col[cardIndex];
  if (!card.faceUp) return;

  if (selectedCard === null) {
    // Select this card (if valid sequence to pick up)
    if (canPickUp(colIndex, cardIndex)) {
      selectedCard = { colIndex, cardIndex };
      render();
    }
    return;
  }

  // Same card clicked → deselect
  if (selectedCard.colIndex === colIndex && selectedCard.cardIndex === cardIndex) {
    selectedCard = null;
    render();
    return;
  }

  // Try to move to this column (drop on top card = drop on that column)
  const targetColIndex = colIndex;
  const moved = tryMove(selectedCard.colIndex, selectedCard.cardIndex, targetColIndex);
  if (!moved) {
    // Re-select clicked card instead
    if (canPickUp(colIndex, cardIndex)) {
      selectedCard = { colIndex, cardIndex };
    } else {
      selectedCard = null;
    }
    render();
  }
}

// =============================================
//  GAME LOGIC
// =============================================
function canPickUp(colIndex, cardIndex) {
  const col = state.columns[colIndex];
  // Must be face-up
  if (!col[cardIndex].faceUp) return false;
  // Cards from cardIndex to end must form a descending sequence of same suit
  for (let i = cardIndex; i < col.length - 1; i++) {
    if (!col[i].faceUp || !col[i+1].faceUp) return false;
    if (col[i].rank !== col[i+1].rank + 1) return false;
    if (col[i].suit !== col[i+1].suit) return false;
  }
  return true;
}

function isValidDrop(fromCol, fromCardIdx, toColIdx) {
  const fromCard = state.columns[fromCol][fromCardIdx];
  const toCol = state.columns[toColIdx];
  if (toCol.length === 0) return true; // Can always drop on empty column
  const topCard = toCol[toCol.length - 1];
  if (!topCard.faceUp) return false;
  return fromCard.rank === topCard.rank - 1; // Any suit allowed (spider rule)
}

function tryMove(fromCol, fromCardIdx, toCol) {
  if (!isValidDrop(fromCol, fromCardIdx, toCol)) {
    selectedCard = null;
    render();
    return false;
  }

  saveHistory();

  // Move cards
  const moving = state.columns[fromCol].splice(fromCardIdx);
  state.columns[toCol].push(...moving);

  // Flip top card of source column if face-down
  const srcCol = state.columns[fromCol];
  if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
    srcCol[srcCol.length - 1].faceUp = true;
  }

  state.moves++;
  selectedCard = null;

  // Check for completed sequences
  checkCompletedSequences();

  render();

  if (checkWin()) {
    showWin();
  }
  return true;
}

function checkCompletedSequences() {
  for (let c = 0; c < 10; c++) {
    const col = state.columns[c];
    if (col.length < 13) continue;

    // Check if last 13 cards form K→A same suit
    const start = col.length - 13;
    const suit = col[start].suit;
    let valid = true;

    for (let i = start; i < col.length; i++) {
      const expected_rank = 12 - (i - start); // K=12 down to A=0
      if (!col[i].faceUp || col[i].rank !== expected_rank || col[i].suit !== suit) {
        valid = false;
        break;
      }
    }

    if (valid) {
      state.foundations.push(suit);
      state.columns[c].splice(start, 13);
      // Flip new top card if face-down
      if (col.length > 0 && !col[col.length - 1].faceUp) {
        col[col.length - 1].faceUp = true;
      }
    }
  }
}

function checkWin() {
  return state.foundations.length === 8;
}

// =============================================
//  DEAL FROM STOCK
// =============================================
function dealFromStock() {
  if (state.stock.length === 0) return;
  // Check all columns non-empty (rule: can't deal if any column empty)
  // Actually Spider allows dealing even with empty columns in some variants — we'll allow it
  saveHistory();

  const group = state.stock.pop();
  for (let c = 0; c < 10; c++) {
    group[c].faceUp = true;
    state.columns[c].push(group[c]);
  }

  state.moves++;
  selectedCard = null;

  checkCompletedSequences();
  render();

  if (checkWin()) showWin();
}

// =============================================
//  UNDO
// =============================================
function saveHistory() {
  // Deep clone current state (sans history itself)
  const snap = {
    columns: state.columns.map(col => col.map(c => ({ ...c }))),
    stock:   state.stock.map(g => g.map(c => ({ ...c }))),
    foundations: [...state.foundations],
    moves: state.moves,
  };
  state.history.push(snap);
  if (state.history.length > 20) state.history.shift();
}

function undo() {
  if (state.history.length === 0) return;
  const snap = state.history.pop();
  state.columns     = snap.columns;
  state.stock       = snap.stock;
  state.foundations = snap.foundations;
  state.moves       = snap.moves;
  selectedCard = null;
  render();
}

// =============================================
//  WIN SCREEN
// =============================================
function showWin() {
  clearInterval(timerInterval);
  const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
  const s = String(secondsElapsed % 60).padStart(2, '0');
  winStats.textContent = `${state.moves} movimentos em ${m}:${s}`;
  winModal.classList.add('show');
}

// =============================================
//  INIT
// =============================================
newGame();
