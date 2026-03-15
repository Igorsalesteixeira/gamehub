// =============================================
//  PACIÊNCIA (Klondike Solitaire) — game.js
// =============================================

const SUITS  = ['♠','♥','♦','♣'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS   = new Set(['♥','♦']);
const SUIT_SYMBOL = { '♠':'♠','♥':'♥','♦':'♦','♣':'♣' };

// ---- State ----
let state = {
  tableau:     [],   // 7 columns, each array of { rank, suit, faceUp }
  stock:       [],   // remaining deck
  waste:       [],   // flipped cards (top = last element)
  foundations: { '♠':[], '♥':[], '♦':[], '♣':[] },
  history:     [],
  moves:       0,
  drawCount:   1,
};

// Selected card: { source, colIndex?, suit?, cardIndex? }
// source: 'tableau' | 'waste' | 'foundation'
let selected = null;

let timerInterval  = null;
let secondsElapsed = 0;

// ---- DOM ----
const stockEl       = document.getElementById('stock');
const wasteEl       = document.getElementById('waste');
const movesDisplay  = document.getElementById('moves-display');
const timeDisplay   = document.getElementById('time-display');
const winModal      = document.getElementById('win-modal');
const winStats      = document.getElementById('win-stats');

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-win-new').addEventListener('click', () => {
  winModal.classList.remove('show');
  newGame();
});
document.getElementById('draw-count').addEventListener('change', e => {
  state.drawCount = parseInt(e.target.value);
  newGame();
});

// =============================================
//  DECK
// =============================================
function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let r = 0; r < 13; r++) {
      deck.push({ rank: r, suit, faceUp: false });
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
  selected = null;
  clearInterval(timerInterval);
  secondsElapsed = 0;
  updateTimer();

  const drawCount = state.drawCount || 1;
  const deck = buildDeck();
  let idx = 0;

  // Deal tableau: col i gets i+1 cards, last is face-up
  const tableau = [];
  for (let c = 0; c < 7; c++) {
    const col = [];
    for (let i = 0; i <= c; i++) {
      col.push({ ...deck[idx++] });
    }
    col[col.length - 1].faceUp = true;
    tableau.push(col);
  }

  state = {
    tableau,
    stock:   deck.slice(idx).map(c => ({ ...c })),
    waste:   [],
    foundations: { '♠':[], '♥':[], '♦':[], '♣':[] },
    history: [],
    moves:   0,
    drawCount,
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
  const m = String(Math.floor(secondsElapsed / 60)).padStart(2,'0');
  const s = String(secondsElapsed % 60).padStart(2,'0');
  timeDisplay.textContent = `⏱ ${m}:${s}`;
}

// =============================================
//  RENDER
// =============================================
function render() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
  movesDisplay.textContent = `Movimentos: ${state.moves}`;
  document.getElementById('btn-undo').disabled = state.history.length === 0;
}

// ---- Stock ----
function renderStock() {
  if (state.stock.length === 0) {
    stockEl.classList.add('empty');
  } else {
    stockEl.classList.remove('empty');
  }
}

// ---- Waste ----
function renderWaste() {
  wasteEl.innerHTML = '';
  if (state.waste.length === 0) return;

  // Show up to 3 fanned cards when draw=3, else just top
  const show = state.drawCount === 3
    ? state.waste.slice(-3)
    : [state.waste[state.waste.length - 1]];

  show.forEach((card, i) => {
    const isTop = i === show.length - 1;
    const el = makeFaceUpCard(card);
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = (i * 18) + 'px';
    el.style.zIndex = i + 1;
    if (isTop) {
      el.addEventListener('click', () => handleWasteClick());
      if (selected && selected.source === 'waste') el.classList.add('selected');
    } else {
      el.style.pointerEvents = 'none';
    }
    // Drag
    if (isTop) {
      el.draggable = true;
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'waste' }));
        setTimeout(() => el.classList.add('dragging'), 0);
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
    }
    wasteEl.appendChild(el);
  });

  // Adjust waste width for fanned view
  wasteEl.style.width = (72 + (show.length - 1) * 18) + 'px';
}

// ---- Foundations ----
function renderFoundations() {
  for (const suit of SUITS) {
    const idx = SUITS.indexOf(suit);
    const fEl = document.getElementById(`f${idx}`);
    fEl.innerHTML = '';

    const pile = state.foundations[suit];
    if (pile.length === 0) {
      // show placeholder symbol via CSS ::before
    } else {
      const topCard = pile[pile.length - 1];
      const el = makeFaceUpCard(topCard);
      el.style.position = 'absolute';
      el.style.inset = '0';
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => handleFoundationClick(suit));
      fEl.appendChild(el);
    }

    if (selected && selected.source === 'foundation' && selected.suit === suit) {
      fEl.classList.add('drop-target');
    }
  }
}

// ---- Tableau ----
function renderTableau() {
  for (let c = 0; c < 7; c++) {
    const colEl = document.getElementById(`col${c}`);
    colEl.innerHTML = '';
    const col = state.tableau[c];

    if (col.length === 0) {
      colEl.classList.add('empty-slot');
      colEl.style.height = '100px';
      return;
    } else {
      colEl.classList.remove('empty-slot');
    }

    const OFFSET_DOWN = 20;
    const OFFSET_UP   = 24;
    let topPx = 0;

    col.forEach((card, i) => {
      const isLast = i === col.length - 1;
      let el;

      if (!card.faceUp) {
        el = document.createElement('div');
        el.className = 'card face-down';
      } else {
        el = makeFaceUpCard(card);

        // Selected highlight
        if (selected && selected.source === 'tableau' &&
            selected.colIndex === c && selected.cardIndex === i) {
          el.classList.add('selected');
        }

        el.addEventListener('click', e => {
          e.stopPropagation();
          handleTableauCardClick(c, i);
        });

        el.draggable = true;
        el.addEventListener('dragstart', e => {
          if (!canPickFromTableau(c, i)) { e.preventDefault(); return; }
          e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'tableau', colIndex: c, cardIndex: i }));
          setTimeout(() => el.classList.add('dragging'), 0);
        });
        el.addEventListener('dragend', () => el.classList.remove('dragging'));
      }

      el.style.position = 'absolute';
      el.style.top = topPx + 'px';
      el.style.zIndex = i + 1;
      colEl.appendChild(el);

      if (!isLast) topPx += card.faceUp ? OFFSET_UP : OFFSET_DOWN;
    });

    colEl.style.height = (topPx + 100) + 'px';
  }
}

// =============================================
//  DRAG & DROP — columns & foundations
// =============================================
for (let c = 0; c < 7; c++) {
  const colEl = document.getElementById(`col${c}`);
  colEl.addEventListener('dragover', e => { e.preventDefault(); colEl.classList.add('drop-target'); });
  colEl.addEventListener('dragleave', () => colEl.classList.remove('drop-target'));
  colEl.addEventListener('drop', e => {
    e.preventDefault();
    colEl.classList.remove('drop-target');
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const data = JSON.parse(raw);
    dropOnTableau(c, data);
  });
  colEl.addEventListener('click', () => {
    if (selected) dropOnTableauSelected(c);
  });
}

for (const suit of SUITS) {
  const idx = SUITS.indexOf(suit);
  const fEl = document.getElementById(`f${idx}`);
  fEl.addEventListener('dragover', e => { e.preventDefault(); fEl.classList.add('drop-target'); });
  fEl.addEventListener('dragleave', () => fEl.classList.remove('drop-target'));
  fEl.addEventListener('drop', e => {
    e.preventDefault();
    fEl.classList.remove('drop-target');
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    const data = JSON.parse(raw);
    dropOnFoundation(suit, data);
  });
  fEl.addEventListener('click', () => {
    if (selected) dropOnFoundationSelected(suit);
  });
}

// =============================================
//  CARD ELEMENT
// =============================================
function makeFaceUpCard(card) {
  const el = document.createElement('div');
  const isRed = RED_SUITS.has(card.suit);
  el.className = `card face-up ${isRed ? 'red' : 'black'}`;
  el.style.width  = '72px';
  el.style.height = '100px';
  const r = RANKS[card.rank];
  el.innerHTML = `
    <div class="card-tl">${r}<br>${card.suit}</div>
    <div class="card-center">${card.suit}</div>
    <div class="card-br">${r}<br>${card.suit}</div>
  `;
  return el;
}

// =============================================
//  CLICK HANDLERS
// =============================================
stockEl.addEventListener('click', drawFromStock);

function drawFromStock() {
  if (state.stock.length === 0) {
    // Recycle waste → stock
    if (state.waste.length === 0) return;
    saveHistory();
    state.stock = [...state.waste].reverse().map(c => ({ ...c, faceUp: false }));
    state.waste = [];
    state.moves++;
    render();
    return;
  }
  saveHistory();
  const count = Math.min(state.drawCount, state.stock.length);
  for (let i = 0; i < count; i++) {
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
  }
  state.moves++;
  selected = null;
  render();
}

function handleWasteClick() {
  if (state.waste.length === 0) return;
  if (selected && selected.source === 'waste') {
    selected = null;
    render();
    return;
  }
  // Try auto-move to foundation first
  const topCard = state.waste[state.waste.length - 1];
  if (tryAutoToFoundation(topCard, 'waste')) return;
  // Otherwise select it
  selected = { source: 'waste' };
  render();
}

function handleTableauCardClick(colIndex, cardIndex) {
  const card = state.tableau[colIndex][cardIndex];
  if (!card.faceUp) return;

  // If something selected, try to move onto this column
  if (selected) {
    const isSelf = selected.source === 'tableau' &&
                   selected.colIndex === colIndex &&
                   selected.cardIndex === cardIndex;
    if (isSelf) {
      selected = null;
      render();
      return;
    }
    // Drop on this column (effectively drop on top card of col)
    dropOnTableauSelected(colIndex);
    return;
  }

  // Try auto-move single card to foundation
  const isLast = cardIndex === state.tableau[colIndex].length - 1;
  if (isLast && tryAutoToFoundation(card, 'tableau', colIndex)) return;

  // Select
  if (canPickFromTableau(colIndex, cardIndex)) {
    selected = { source: 'tableau', colIndex, cardIndex };
    render();
  }
}

function handleFoundationClick(suit) {
  if (selected && selected.source === 'foundation' && selected.suit === suit) {
    selected = null;
    render();
    return;
  }
  // Select top of foundation (for moving back to tableau)
  const pile = state.foundations[suit];
  if (pile.length === 0) return;
  selected = { source: 'foundation', suit };
  render();
}

// =============================================
//  AUTO MOVE TO FOUNDATION
// =============================================
function tryAutoToFoundation(card, source, colIndex) {
  const pile = state.foundations[card.suit];
  if (!canPlaceOnFoundation(card, card.suit)) return false;
  saveHistory();
  pile.push({ ...card });
  if (source === 'waste') {
    state.waste.pop();
  } else if (source === 'tableau') {
    state.tableau[colIndex].pop();
    flipTopCard(colIndex);
  }
  state.moves++;
  selected = null;
  render();
  if (checkWin()) showWin();
  return true;
}

// =============================================
//  DROP LOGIC
// =============================================
function dropOnTableau(toCol, data) {
  let card, cards, doMove;

  if (data.source === 'waste') {
    card = state.waste[state.waste.length - 1];
    if (!canPlaceOnTableau(card, toCol)) return;
    doMove = () => {
      state.waste.pop();
    };
    cards = [card];
  } else if (data.source === 'tableau') {
    const { colIndex: fromCol, cardIndex: fromCard } = data;
    if (fromCol === toCol) return;
    cards = state.tableau[fromCol].slice(fromCard);
    card = cards[0];
    if (!canPlaceOnTableau(card, toCol)) return;
    doMove = () => {
      state.tableau[fromCol].splice(fromCard);
      flipTopCard(fromCol);
    };
  } else if (data.source === 'foundation') {
    const { suit } = data;
    const pile = state.foundations[suit];
    card = pile[pile.length - 1];
    if (!canPlaceOnTableau(card, toCol)) return;
    doMove = () => { pile.pop(); };
    cards = [card];
  } else return;

  saveHistory();
  doMove();
  state.tableau[toCol].push(...cards.map(c => ({ ...c, faceUp: true })));
  state.moves++;
  selected = null;
  render();
}

function dropOnTableauSelected(toCol) {
  if (!selected) return;
  dropOnTableau(toCol, selected);
}

function dropOnFoundation(suit, data) {
  let card, doMove;

  if (data.source === 'waste') {
    card = state.waste[state.waste.length - 1];
    if (!canPlaceOnFoundation(card, suit)) return;
    doMove = () => state.waste.pop();
  } else if (data.source === 'tableau') {
    const { colIndex, cardIndex } = data;
    // Only allow moving single (top) card to foundation
    if (cardIndex !== state.tableau[colIndex].length - 1) return;
    card = state.tableau[colIndex][cardIndex];
    if (!canPlaceOnFoundation(card, suit)) return;
    doMove = () => {
      state.tableau[colIndex].pop();
      flipTopCard(colIndex);
    };
  } else if (data.source === 'foundation') {
    // Move between foundations (only if same suit, top card)
    const srcSuit = data.suit;
    if (srcSuit === suit) return;
    const pile = state.foundations[srcSuit];
    card = pile[pile.length - 1];
    if (!canPlaceOnFoundation(card, suit)) return;
    doMove = () => pile.pop();
  } else return;

  saveHistory();
  doMove();
  state.foundations[suit].push({ ...card });
  state.moves++;
  selected = null;
  render();
  if (checkWin()) showWin();
}

function dropOnFoundationSelected(suit) {
  if (!selected) return;
  dropOnFoundation(suit, selected);
}

// =============================================
//  RULES
// =============================================
function canPickFromTableau(colIndex, cardIndex) {
  const col = state.tableau[colIndex];
  if (!col[cardIndex].faceUp) return false;
  // All cards from cardIndex down must be face-up and form a valid sequence
  for (let i = cardIndex; i < col.length - 1; i++) {
    const a = col[i], b = col[i + 1];
    if (!a.faceUp || !b.faceUp) return false;
    if (a.rank !== b.rank + 1) return false;
    if (RED_SUITS.has(a.suit) === RED_SUITS.has(b.suit)) return false; // must alternate colors
  }
  return true;
}

function canPlaceOnTableau(card, toColIdx) {
  const col = state.tableau[toColIdx];
  if (col.length === 0) return card.rank === 12; // only King on empty
  const top = col[col.length - 1];
  if (!top.faceUp) return false;
  // Must be one less and alternate color
  return card.rank === top.rank - 1 &&
         RED_SUITS.has(card.suit) !== RED_SUITS.has(top.suit);
}

function canPlaceOnFoundation(card, suit) {
  if (card.suit !== suit) return false;
  const pile = state.foundations[suit];
  if (pile.length === 0) return card.rank === 0; // Ace starts
  return card.rank === pile[pile.length - 1].rank + 1;
}

function flipTopCard(colIndex) {
  const col = state.tableau[colIndex];
  if (col.length > 0 && !col[col.length - 1].faceUp) {
    col[col.length - 1].faceUp = true;
  }
}

// =============================================
//  WIN
// =============================================
function checkWin() {
  return SUITS.every(s => state.foundations[s].length === 13);
}

function showWin() {
  clearInterval(timerInterval);
  const m = String(Math.floor(secondsElapsed / 60)).padStart(2,'0');
  const s = String(secondsElapsed % 60).padStart(2,'0');
  winStats.textContent = `${state.moves} movimentos em ${m}:${s}`;
  winModal.classList.add('show');
}

// =============================================
//  UNDO
// =============================================
function saveHistory() {
  const snap = {
    tableau:     state.tableau.map(col => col.map(c => ({ ...c }))),
    stock:       state.stock.map(c => ({ ...c })),
    waste:       state.waste.map(c => ({ ...c })),
    foundations: {
      '♠': [...state.foundations['♠']],
      '♥': [...state.foundations['♥']],
      '♦': [...state.foundations['♦']],
      '♣': [...state.foundations['♣']],
    },
    moves: state.moves,
  };
  state.history.push(snap);
  if (state.history.length > 20) state.history.shift();
}

function undo() {
  if (state.history.length === 0) return;
  const snap = state.history.pop();
  state.tableau     = snap.tableau;
  state.stock       = snap.stock;
  state.waste       = snap.waste;
  state.foundations = snap.foundations;
  state.moves       = snap.moves;
  selected = null;
  render();
}

// =============================================
//  INIT
// =============================================
newGame();
