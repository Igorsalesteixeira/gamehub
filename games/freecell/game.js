import '../../auth-check.js';
// =============================================
// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }
//  FREECELL — game.js
// =============================================
import { supabase } from '../../supabase.js';

const SUITS  = ['♠','♥','♦','♣'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥','♦']);

// ---- State ----
let state = {
  tableau:     [],   // 8 columns
  cells:       [null, null, null, null], // 4 free cells
  foundations: { '♠':[], '♥':[], '♦':[], '♣':[] },
  history:     [],
  moves:       0,
};

let selected = null; // { source, colIndex?, cellIndex?, suit?, cardIndex? }
let timerInterval  = null;
let secondsElapsed = 0;
let gameStarted    = false;
let timerStarted   = false;

// ---- DOM ----
const movesDisplay = document.getElementById('moves-display');
const timeDisplay  = document.getElementById('time-display');
const winModal     = document.getElementById('win-modal');
const winStats     = document.getElementById('win-stats');

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-win-new').addEventListener('click', () => {
  winModal.classList.remove('show');
  newGame();
});

// =============================================
//  DECK
// =============================================
function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let r = 0; r < 13; r++) {
      deck.push({ rank: r, suit, faceUp: true });
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
  if (gameStarted && !checkWin()) {
    saveGameStat('loss');
  }
  gameStarted = false;
  timerStarted = false;
  selected = null;
  clearInterval(timerInterval);
  secondsElapsed = 0;
  updateTimer();

  const deck = buildDeck();
  // Deal: first 4 columns get 7 cards, last 4 get 6
  const tableau = [];
  let idx = 0;
  for (let c = 0; c < 8; c++) {
    const count = c < 4 ? 7 : 6;
    const col = [];
    for (let i = 0; i < count; i++) {
      col.push({ ...deck[idx++] });
    }
    tableau.push(col);
  }

  state = {
    tableau,
    cells: [null, null, null, null],
    foundations: { '♠':[], '♥':[], '♦':[], '♣':[] },
    history: [],
    moves: 0,
  };

  render();
}

// =============================================
//  TIMER
// =============================================
function startTimer() {
  if (timerStarted) return;
  timerStarted = true;
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
//  CARD DIMENSIONS (responsive)
// =============================================
function getCardDims() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (h < 500) return { w: 46, h: 56, offsetUp: 16 };
  if (w <= 380) return { w: 38, h: 54, offsetUp: 14 };
  if (w <= 580) return { w: 42, h: 60, offsetUp: 16 };
  return { w: 72, h: 100, offsetUp: 22 };
}

// =============================================
//  RENDER
// =============================================
function render() {
  renderCells();
  renderFoundations();
  renderTableau();
  movesDisplay.textContent = state.moves;
  document.getElementById('btn-undo').disabled = state.history.length === 0;
  autoMoveToFoundations();
}

// ---- Free Cells ----
function renderCells() {
  for (let i = 0; i < 4; i++) {
    const cellEl = document.getElementById(`cell${i}`);
    cellEl.innerHTML = '';
    cellEl.classList.remove('drop-target');

    const card = state.cells[i];
    if (card) {
      const el = makeFaceUpCard(card);
      el.style.position = 'absolute';
      el.style.inset = '0';
      el.style.width = '100%';
      el.style.height = '100%';
      el.addEventListener('click', (e) => { e.stopPropagation(); handleCellClick(i); });
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); tryAutoMove(card, 'cell', i); });

      el.draggable = true;
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'cell', cellIndex: i }));
        const emptyImg = document.createElement('canvas');
        emptyImg.width = 1; emptyImg.height = 1;
        e.dataTransfer.setDragImage(emptyImg, 0, 0);
        setTimeout(() => el.classList.add('dragging'), 0);
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));

      initTouchDrag(
        el,
        { source: 'cell', cellIndex: i },
        () => handleCellClick(i),
        () => tryAutoMove(card, 'cell', i)
      );

      if (selected && selected.source === 'cell' && selected.cellIndex === i) {
        el.classList.add('selected');
      }
      cellEl.appendChild(el);
    }
  }
}

// ---- Foundations ----
function renderFoundations() {
  for (const suit of SUITS) {
    const idx = SUITS.indexOf(suit);
    const fEl = document.getElementById(`f${idx}`);
    fEl.innerHTML = '';
    fEl.classList.remove('drop-target');

    const pile = state.foundations[suit];
    if (pile.length > 0) {
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
  }
}

// ---- Tableau ----
function renderTableau() {
  const dims = getCardDims();
  for (let c = 0; c < 8; c++) {
    const colEl = document.getElementById(`col${c}`);
    colEl.innerHTML = '';
    const col = state.tableau[c];

    if (col.length === 0) {
      colEl.classList.add('empty-slot');
      colEl.style.height = dims.h + 'px';
      colEl.style.minHeight = dims.h + 'px';
      continue;
    } else {
      colEl.classList.remove('empty-slot');
      colEl.style.minHeight = '';
    }

    let topPx = 0;
    col.forEach((card, i) => {
      const el = makeFaceUpCard(card);

      if (selected && selected.source === 'tableau' &&
          selected.colIndex === c && i >= selected.cardIndex) {
        el.classList.add('selected');
      }

      el.addEventListener('click', e => {
        e.stopPropagation();
        handleTableauCardClick(c, i);
      });
      el.addEventListener('dblclick', e => {
        e.stopPropagation();
        tryAutoMove(col[i], 'tableau', c, i);
      });

      el.draggable = true;
      el.addEventListener('dragstart', e => {
        if (!canPickFromTableau(c, i)) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'tableau', colIndex: c, cardIndex: i }));
        const emptyImg = document.createElement('canvas');
        emptyImg.width = 1; emptyImg.height = 1;
        e.dataTransfer.setDragImage(emptyImg, 0, 0);
        setTimeout(() => el.classList.add('dragging'), 0);
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));

      initTouchDrag(
        el,
        { source: 'tableau', colIndex: c, cardIndex: i },
        () => handleTableauCardClick(c, i),
        () => tryAutoMove(col[i], 'tableau', c, i)
      );

      el.style.position = 'absolute';
      el.style.top = topPx + 'px';
      el.style.zIndex = i + 1;
      colEl.appendChild(el);

      if (i < col.length - 1) topPx += dims.offsetUp;
    });

    colEl.style.height = (topPx + dims.h) + 'px';
  }
}

// =============================================
//  CARD ELEMENT
// =============================================
function makeFaceUpCard(card) {
  const el = document.createElement('div');
  const isRed = RED_SUITS.has(card.suit);
  el.className = `card face-up ${isRed ? 'red' : 'black'}`;
  const r = RANKS[card.rank];
  el.innerHTML = `
    <div class="card-tl">${r}</div>
    <div class="card-center">${card.suit}</div>
    <div class="card-br">${r}</div>
  `;
  return el;
}

// =============================================
//  TOUCH DRAG + DOUBLE TAP
// =============================================
let touchDrag = null;
const tapTimes = {};

function initTouchDrag(el, dragData, onSingleTap, onDoubleTap) {
  el.addEventListener('touchstart', e => {
    // For tableau, find the real sequence start
    let actualData = dragData;
    if (dragData.source === 'tableau') {
      const seqStart = findSequenceStart(dragData.colIndex, dragData.cardIndex);
      actualData = { ...dragData, cardIndex: seqStart };
      if (!canPickFromTableau(actualData.colIndex, actualData.cardIndex)) return;
    }

    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const rect  = el.getBoundingClientRect();
    const dims  = getCardDims();

    let ghost;
    const stackEls = [];

    if (actualData.source === 'tableau') {
      const stack = state.tableau[actualData.colIndex].slice(actualData.cardIndex);
      const offset = dims.offsetUp;
      const totalH = dims.h + (stack.length - 1) * offset;
      ghost = document.createElement('div');
      ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;opacity:0.85;
        width:${dims.w}px;height:${totalH}px;
        left:${rect.left}px;top:${rect.top}px;transition:none;`;
      stack.forEach((card, idx) => {
        const cardEl = makeFaceUpCard(card);
        cardEl.style.position = 'absolute';
        cardEl.style.top = (idx * offset) + 'px';
        cardEl.style.width = '100%';
        ghost.appendChild(cardEl);
      });
      document.body.appendChild(ghost);
      const colDiv = document.getElementById(`col${actualData.colIndex}`);
      const allCards = Array.from(colDiv.querySelectorAll('.card'));
      allCards.slice(actualData.cardIndex).forEach(c => { c.style.opacity = '0.25'; stackEls.push(c); });
    } else {
      ghost = document.createElement('div');
      ghost.style.cssText = `position:fixed;z-index:9999;pointer-events:none;opacity:0.85;
        width:${dims.w}px;height:${dims.h}px;
        left:${rect.left}px;top:${rect.top}px;transition:none;`;
      const cloneCard = actualData.source === 'cell'
        ? state.cells[actualData.cellIndex]
        : null;
      if (cloneCard) {
        const cardEl = makeFaceUpCard(cloneCard);
        cardEl.style.width = '100%';
        cardEl.style.height = '100%';
        ghost.appendChild(cardEl);
      }
      document.body.appendChild(ghost);
      el.style.opacity = '0.25';
      stackEls.push(el);
    }

    touchDrag = {
      data: actualData, ghost, stackEls,
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
      startX: touch.clientX, startY: touch.clientY,
      moved: false, onSingleTap, onDoubleTap,
    };
  }, { passive: false });
}

document.addEventListener('touchmove', e => {
  if (!touchDrag) return;
  e.preventDefault();
  const touch = e.touches[0];
  const dx = Math.abs(touch.clientX - touchDrag.startX);
  const dy = Math.abs(touch.clientY - touchDrag.startY);
  if (dx > 8 || dy > 8) touchDrag.moved = true;
  if (touchDrag.moved) {
    touchDrag.ghost.style.left = (touch.clientX - touchDrag.offsetX) + 'px';
    touchDrag.ghost.style.top  = (touch.clientY - touchDrag.offsetY) + 'px';
  }
}, { passive: false });

document.addEventListener('touchend', e => {
  if (!touchDrag) return;
  const touch = e.changedTouches[0];
  const { ghost, stackEls, data, moved, onSingleTap, onDoubleTap } = touchDrag;
  const tapKey = data.source + (data.colIndex ?? '') + (data.cellIndex ?? '') + (data.cardIndex ?? '');
  touchDrag = null;
  ghost.remove();
  stackEls.forEach(el => {
    if (!el.isConnected) return;
    el.style.opacity = '';
    el.style.visibility = '';
  });

  if (!moved) {
    const now = Date.now();
    if (tapTimes[tapKey] && now - tapTimes[tapKey] < 400) {
      delete tapTimes[tapKey];
      if (onDoubleTap) onDoubleTap();
    } else {
      tapTimes[tapKey] = now;
      if (onSingleTap) onSingleTap();
    }
    return;
  }

  // Drop target
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  let dropped = false;
  if (target) {
    const colEl  = target.closest('.column');
    const fEl    = target.closest('.foundation');
    const cellEl = target.closest('.free-cell');
    if (colEl)     { dropOnTableau(parseInt(colEl.dataset.col), data); dropped = true; }
    else if (fEl)  { dropOnFoundation(fEl.dataset.suit, data); dropped = true; }
    else if (cellEl){ dropOnCell(parseInt(cellEl.dataset.cell), data); dropped = true; }
  }
  if (!dropped) render();
}, { passive: false });

// =============================================
//  DRAG & DROP — columns, foundations, cells
// =============================================
for (let c = 0; c < 8; c++) {
  const colEl = document.getElementById(`col${c}`);
  colEl.addEventListener('dragover', e => { e.preventDefault(); colEl.classList.add('drop-target'); });
  colEl.addEventListener('dragleave', () => colEl.classList.remove('drop-target'));
  colEl.addEventListener('drop', e => {
    e.preventDefault();
    colEl.classList.remove('drop-target');
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    dropOnTableau(c, JSON.parse(raw));
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
    dropOnFoundation(suit, JSON.parse(raw));
  });
  fEl.addEventListener('click', () => {
    if (selected) dropOnFoundationSelected(suit);
  });
}

for (let i = 0; i < 4; i++) {
  const cellEl = document.getElementById(`cell${i}`);
  cellEl.addEventListener('dragover', e => { e.preventDefault(); cellEl.classList.add('drop-target'); });
  cellEl.addEventListener('dragleave', () => cellEl.classList.remove('drop-target'));
  cellEl.addEventListener('drop', e => {
    e.preventDefault();
    cellEl.classList.remove('drop-target');
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    dropOnCell(i, JSON.parse(raw));
  });
  cellEl.addEventListener('click', () => {
    if (selected && !state.cells[i]) dropOnCellSelected(i);
  });
}

// =============================================
//  FREECELL MOVEMENT RULES
// =============================================

// How many cards can be moved at once
function maxMovable() {
  const emptyCells = state.cells.filter(c => c === null).length;
  const emptyCols  = state.tableau.filter(col => col.length === 0).length;
  // Formula: (1 + empty cells) * 2^(empty columns)
  return (1 + emptyCells) * Math.pow(2, emptyCols);
}

// For moving to an empty column, we can't count that column as empty
function maxMovableToEmpty() {
  const emptyCells = state.cells.filter(c => c === null).length;
  const emptyCols  = state.tableau.filter(col => col.length === 0).length;
  // Subtract 1 from empty cols since destination takes one
  return (1 + emptyCells) * Math.pow(2, Math.max(0, emptyCols - 1));
}

function canPickFromTableau(colIndex, cardIndex) {
  const col = state.tableau[colIndex];
  if (cardIndex >= col.length) return false;
  // Check sequence validity (descending, alternating colors)
  for (let i = cardIndex; i < col.length - 1; i++) {
    const a = col[i], b = col[i + 1];
    if (a.rank !== b.rank + 1) return false;
    if (RED_SUITS.has(a.suit) === RED_SUITS.has(b.suit)) return false;
  }
  // Check if we can move that many cards
  const count = col.length - cardIndex;
  return count <= maxMovable();
}

function canPlaceOnTableau(card, toColIdx) {
  const col = state.tableau[toColIdx];
  if (col.length === 0) return true; // Any card on empty column in Freecell
  const top = col[col.length - 1];
  return card.rank === top.rank - 1 &&
         RED_SUITS.has(card.suit) !== RED_SUITS.has(top.suit);
}

function canPlaceOnFoundation(card, suit) {
  if (card.suit !== suit) return false;
  const pile = state.foundations[suit];
  if (pile.length === 0) return card.rank === 0;
  return card.rank === pile[pile.length - 1].rank + 1;
}

function findSequenceStart(colIndex, cardIndex) {
  const col = state.tableau[colIndex];
  let start = cardIndex;
  while (start > 0) {
    const above = col[start - 1];
    const curr  = col[start];
    if (above.rank !== curr.rank + 1) break;
    if (RED_SUITS.has(above.suit) === RED_SUITS.has(curr.suit)) break;
    start--;
  }
  return start;
}

// =============================================
//  CLICK HANDLERS
// =============================================
function handleTableauCardClick(colIndex, cardIndex) {
  if (selected) {
    const isSelf = selected.source === 'tableau' &&
                   selected.colIndex === colIndex &&
                   selected.cardIndex === cardIndex;
    if (isSelf) {
      selected = null;
      render();
      return;
    }
    // Try to drop on this column
    dropOnTableauSelected(colIndex);
    return;
  }

  // Try to find the real sequence start
  const seqStart = findSequenceStart(colIndex, cardIndex);
  if (!canPickFromTableau(colIndex, seqStart)) return;

  selected = { source: 'tableau', colIndex, cardIndex: seqStart };
  render();
}

function handleCellClick(cellIndex) {
  if (selected) {
    if (selected.source === 'cell' && selected.cellIndex === cellIndex) {
      selected = null;
      render();
      return;
    }
    // Try to drop on this cell
    if (!state.cells[cellIndex]) {
      dropOnCellSelected(cellIndex);
    } else {
      // Select this cell's card instead
      selected = { source: 'cell', cellIndex };
      render();
    }
    return;
  }

  if (!state.cells[cellIndex]) return;
  selected = { source: 'cell', cellIndex };
  render();
}

function handleFoundationClick(suit) {
  if (selected) {
    dropOnFoundationSelected(suit);
    return;
  }
  // Select top of foundation (for moving back)
  const pile = state.foundations[suit];
  if (pile.length === 0) return;
  selected = { source: 'foundation', suit };
  render();
}

// =============================================
//  AUTO MOVE (double click/tap)
// =============================================
function tryAutoMove(card, source, colIndexOrCellIndex, cardIndex) {
  // 1) Try foundation
  const isTop = source === 'cell' ||
    (source === 'tableau' && cardIndex === state.tableau[colIndexOrCellIndex].length - 1);

  if (isTop && canPlaceOnFoundation(card, card.suit)) {
    saveHistory();
    state.foundations[card.suit].push({ ...card });
    if (source === 'cell') {
      state.cells[colIndexOrCellIndex] = null;
    } else if (source === 'tableau') {
      state.tableau[colIndexOrCellIndex].pop();
    }
    state.moves++;
    selected = null;
    render();
    if (checkWin()) showWin();
    return true;
  }

  // 2) Try tableau columns
  if (source === 'tableau') {
    const startIdx = cardIndex !== undefined ? cardIndex : state.tableau[colIndexOrCellIndex].length - 1;
    if (!canPickFromTableau(colIndexOrCellIndex, startIdx)) return false;
    const cards = state.tableau[colIndexOrCellIndex].slice(startIdx);
    const topCard = cards[0];

    // Prefer non-empty columns
    const targets = [];
    for (let c = 0; c < 8; c++) {
      if (c === colIndexOrCellIndex) continue;
      if (canPlaceOnTableau(topCard, c)) {
        // Check if we can move that many cards considering target
        const destEmpty = state.tableau[c].length === 0;
        const moveLimit = destEmpty ? maxMovableToEmpty() : maxMovable();
        if (cards.length <= moveLimit) {
          targets.push({ col: c, hasCards: state.tableau[c].length > 0 });
        }
      }
    }
    targets.sort((a, b) => (b.hasCards ? 1 : 0) - (a.hasCards ? 1 : 0));

    if (targets.length > 0) {
      saveHistory();
      state.tableau[colIndexOrCellIndex].splice(startIdx);
      state.tableau[targets[0].col].push(...cards.map(c => ({ ...c })));
      state.moves++;
      selected = null;
      render();
      return true;
    }
  } else if (source === 'cell') {
    const cellCard = state.cells[colIndexOrCellIndex];
    // Try non-empty columns first
    for (let c = 0; c < 8; c++) {
      if (canPlaceOnTableau(cellCard, c) && state.tableau[c].length > 0) {
        saveHistory();
        state.cells[colIndexOrCellIndex] = null;
        state.tableau[c].push({ ...cellCard });
        state.moves++;
        selected = null;
        render();
        return true;
      }
    }
    // Try empty columns
    for (let c = 0; c < 8; c++) {
      if (canPlaceOnTableau(cellCard, c) && state.tableau[c].length === 0) {
        saveHistory();
        state.cells[colIndexOrCellIndex] = null;
        state.tableau[c].push({ ...cellCard });
        state.moves++;
        selected = null;
        render();
        return true;
      }
    }
  }

  return false;
}

// =============================================
//  AUTO-MOVE SAFE CARDS TO FOUNDATIONS
// =============================================
function autoMoveToFoundations() {
  let moved = true;
  while (moved) {
    moved = false;
    // Check cells
    for (let i = 0; i < 4; i++) {
      const card = state.cells[i];
      if (!card) continue;
      if (isSafeToAutoMove(card)) {
        state.foundations[card.suit].push({ ...card });
        state.cells[i] = null;
        moved = true;
      }
    }
    // Check tableau tops
    for (let c = 0; c < 8; c++) {
      const col = state.tableau[c];
      if (col.length === 0) continue;
      const card = col[col.length - 1];
      if (isSafeToAutoMove(card)) {
        state.foundations[card.suit].push({ ...card });
        col.pop();
        moved = true;
      }
    }
  }
  if (checkWin()) {
    setTimeout(() => showWin(), 300);
  }
}

// A card is safe to auto-move if all cards of the opposite color
// with rank-1 are already on foundations (i.e., no card needs this one as target)
function isSafeToAutoMove(card) {
  if (!canPlaceOnFoundation(card, card.suit)) return false;
  // Aces and 2s are always safe
  if (card.rank <= 1) return true;
  // For higher cards, both opposite-color suits must have rank-2 or more on foundation
  const isRed = RED_SUITS.has(card.suit);
  const oppositeColors = isRed ? ['♠','♣'] : ['♥','♦'];
  for (const oSuit of oppositeColors) {
    const fLen = state.foundations[oSuit].length;
    if (fLen < card.rank - 1) return false;
  }
  return true;
}

// =============================================
//  DROP LOGIC
// =============================================
function dropOnTableau(toCol, data) {
  let card, cards, doMove;

  if (data.source === 'cell') {
    card = state.cells[data.cellIndex];
    if (!card || !canPlaceOnTableau(card, toCol)) return;
    cards = [card];
    doMove = () => { state.cells[data.cellIndex] = null; };
  } else if (data.source === 'tableau') {
    const { colIndex: fromCol, cardIndex: fromCard } = data;
    if (fromCol === toCol) return;
    cards = state.tableau[fromCol].slice(fromCard);
    card = cards[0];
    if (!canPlaceOnTableau(card, toCol)) return;
    // Check move limit
    const destEmpty = state.tableau[toCol].length === 0;
    const moveLimit = destEmpty ? maxMovableToEmpty() : maxMovable();
    if (cards.length > moveLimit) return;
    doMove = () => { state.tableau[fromCol].splice(fromCard); };
  } else if (data.source === 'foundation') {
    const pile = state.foundations[data.suit];
    card = pile[pile.length - 1];
    if (!card || !canPlaceOnTableau(card, toCol)) return;
    cards = [card];
    doMove = () => { pile.pop(); };
  } else return;

  startTimer();
  saveHistory();
  doMove();
  state.tableau[toCol].push(...cards.map(c => ({ ...c })));
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

  if (data.source === 'cell') {
    card = state.cells[data.cellIndex];
    if (!card || !canPlaceOnFoundation(card, suit)) return;
    doMove = () => { state.cells[data.cellIndex] = null; };
  } else if (data.source === 'tableau') {
    const { colIndex, cardIndex } = data;
    // Only top card
    if (cardIndex !== state.tableau[colIndex].length - 1) return;
    card = state.tableau[colIndex][cardIndex];
    if (!canPlaceOnFoundation(card, suit)) return;
    doMove = () => { state.tableau[colIndex].pop(); };
  } else if (data.source === 'foundation') {
    if (data.suit === suit) return;
    const pile = state.foundations[data.suit];
    card = pile[pile.length - 1];
    if (!card || !canPlaceOnFoundation(card, suit)) return;
    doMove = () => { pile.pop(); };
  } else return;

  startTimer();
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

function dropOnCell(cellIndex, data) {
  if (state.cells[cellIndex] !== null) return; // Cell must be empty

  let card, doMove;

  if (data.source === 'tableau') {
    const { colIndex, cardIndex } = data;
    // Only top card to free cell
    if (cardIndex !== state.tableau[colIndex].length - 1) return;
    card = state.tableau[colIndex][cardIndex];
    doMove = () => { state.tableau[colIndex].pop(); };
  } else if (data.source === 'cell') {
    if (data.cellIndex === cellIndex) return;
    card = state.cells[data.cellIndex];
    if (!card) return;
    doMove = () => { state.cells[data.cellIndex] = null; };
  } else if (data.source === 'foundation') {
    const pile = state.foundations[data.suit];
    card = pile[pile.length - 1];
    if (!card) return;
    doMove = () => { pile.pop(); };
  } else return;

  startTimer();
  saveHistory();
  doMove();
  state.cells[cellIndex] = { ...card };
  state.moves++;
  selected = null;
  render();
}

function dropOnCellSelected(cellIndex) {
  if (!selected) return;
  dropOnCell(cellIndex, selected);
}

// =============================================
//  WIN
// =============================================
function checkWin() {
  return SUITS.every(s => state.foundations[s].length === 13);
}

function showWin() {
  clearInterval(timerInterval);
  saveGameStat('win');
  gameStarted = false;
  const m = String(Math.floor(secondsElapsed / 60)).padStart(2,'0');
  const s = String(secondsElapsed % 60).padStart(2,'0');
  winStats.textContent = `${state.moves} movimentos em ${m}:${s}`;
  winModal.classList.add('show');
}

// =============================================
//  UNDO
// =============================================
function saveHistory() {
  gameStarted = true;
  const snap = {
    tableau:     state.tableau.map(col => col.map(c => ({ ...c }))),
    cells:       state.cells.map(c => c ? { ...c } : null),
    foundations: {
      '♠': state.foundations['♠'].map(c => ({ ...c })),
      '♥': state.foundations['♥'].map(c => ({ ...c })),
      '♦': state.foundations['♦'].map(c => ({ ...c })),
      '♣': state.foundations['♣'].map(c => ({ ...c })),
    },
    moves: state.moves,
  };
  state.history.push(snap);
  if (state.history.length > 30) state.history.shift();
}

function undo() {
  if (state.history.length === 0) return;
  const snap = state.history.pop();
  state.tableau     = snap.tableau;
  state.cells       = snap.cells;
  state.foundations  = snap.foundations;
  state.moves       = snap.moves;
  selected = null;
  render();
}

// =============================================
//  STATS — Supabase
// =============================================
async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'freecell',
      result: result,
      moves: state.moves,
      time_seconds: secondsElapsed,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// =============================================
//  INIT
// =============================================
newGame();
