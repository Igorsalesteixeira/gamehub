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
  movesDisplay.textContent = state.moves;
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

  const dims = getCardDims();
  // Empilha 2 cartas: a anterior fica escondida atrás da do topo
  const show = state.waste.slice(-2);

  show.forEach((card, i) => {
    const isTop = i === show.length - 1;
    const el = makeFaceUpCard(card);
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.zIndex = i + 1;

    if (!isTop) {
      el.style.pointerEvents = 'none';
      wasteEl.appendChild(el);
      return;
    }

    // Eventos só na carta de cima
    el.addEventListener('click', () => handleWasteClick());
    el.addEventListener('dblclick', () => {
      const top = state.waste[state.waste.length - 1];
      if (top) tryAutoMove(top, 'waste');
    });
    if (selected && selected.source === 'waste') el.classList.add('selected');

    const topCard = state.waste[state.waste.length - 1];
    initTouchDrag(
      el,
      { source: 'waste' },
      () => handleWasteClick(),
      () => { if (topCard) tryAutoMove(topCard, 'waste'); }
    );
    el.draggable = true;
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ source: 'waste' }));
      setTimeout(() => el.classList.add('dragging'), 0);
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    wasteEl.appendChild(el);
  });

  wasteEl.style.width = dims.w + 'px';
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

    const dims = getCardDims();

    if (col.length === 0) {
      colEl.classList.add('empty-slot');
      colEl.style.height = dims.h + 'px';
      colEl.style.minHeight = dims.h + 'px';
      continue;
    } else {
      colEl.classList.remove('empty-slot');
      colEl.style.minHeight = '';
    }

    const OFFSET_DOWN = dims.offsetDown;
    const OFFSET_UP   = dims.offsetUp;
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

        const isLast = i === col.length - 1;

        // Desktop: clique simples e duplo clique
        el.addEventListener('click', e => {
          e.stopPropagation();
          handleTableauCardClick(c, i);
        });
        el.addEventListener('dblclick', e => {
          e.stopPropagation();
          tryAutoMove(col[i], 'tableau', c, i);
        });

        // Touch drag (iOS) com duplo toque
        initTouchDrag(
          el,
          { source: 'tableau', colIndex: c, cardIndex: i },
          () => handleTableauCardClick(c, i),
          () => tryAutoMove(col[i], 'tableau', c, i)
        );

        // Mouse drag (desktop)
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

    colEl.style.height = (topPx + dims.h) + 'px';
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
//  TOUCH DRAG (iOS / Android) + DOUBLE TAP
// =============================================
let touchDrag  = null;
const tapTimes = {};
function getCardDims() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (h < 500) return { w: 50, h: 60, fanOff: 14, offsetUp: 14, offsetDown: 10 }; // landscape
  if (w <= 380) return { w: 44, h: 62, fanOff: 13, offsetUp: 15, offsetDown: 10 };
  if (w <= 580) return { w: 50, h: 70, fanOff: 16, offsetUp: 18, offsetDown: 12 };
  return { w: 72, h: 100, fanOff: 18, offsetUp: 24, offsetDown: 20 };
}

const CARD_OFFSET = () => getCardDims().offsetUp;

function buildStackGhost(dragData, rect) {
  if (dragData.source !== 'tableau') {
    const g = document.createElement('div');
    g.style.cssText = `position:fixed;z-index:9999;pointer-events:none;opacity:1;
      width:${rect.width}px;height:${rect.height}px;
      left:${rect.left}px;top:${rect.top}px;transition:none;`;
    return g;
  }
  const stack = state.tableau[dragData.colIndex].slice(dragData.cardIndex);
  const offset = CARD_OFFSET();
  const totalH = rect.height + (stack.length - 1) * offset;
  const g = document.createElement('div');
  g.style.cssText = `position:fixed;z-index:9999;pointer-events:none;opacity:0.85;
    width:${rect.width}px;height:${totalH}px;
    left:${rect.left}px;top:${rect.top}px;transition:none;`;
  stack.forEach((card, idx) => {
    const cardEl = makeFaceUpCard(card);
    cardEl.style.position = 'absolute';
    cardEl.style.top = (idx * offset) + 'px';
    cardEl.style.width = '100%';
    g.appendChild(cardEl);
  });
  return g;
}

// Sobe na coluna para encontrar o início real da sequência válida
function findSequenceStart(colIndex, cardIndex) {
  const col = state.tableau[colIndex];
  let start = cardIndex;
  while (start > 0) {
    const above = col[start - 1];
    const curr  = col[start];
    if (!above.faceUp || !curr.faceUp) break;
    if (above.rank !== curr.rank + 1) break;
    if (RED_SUITS.has(above.suit) === RED_SUITS.has(curr.suit)) break;
    start--;
  }
  return start;
}

function initTouchDrag(el, dragData, onSingleTap, onDoubleTap) {
  el.addEventListener('touchstart', e => {
    // Expande para o início real da sequência (resolve o problema do 5-4-3)
    let actualData = dragData;
    if (dragData.source === 'tableau') {
      const seqStart = findSequenceStart(dragData.colIndex, dragData.cardIndex);
      actualData = { ...dragData, cardIndex: seqStart };
    }
    if (actualData.source === 'tableau' && !canPickFromTableau(actualData.colIndex, actualData.cardIndex)) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    const rect  = el.getBoundingClientRect();

    const ghost = buildStackGhost(actualData, rect);
    if (actualData.source !== 'tableau') {
      ghost.appendChild(el.cloneNode(true));
    }
    document.body.appendChild(ghost);

    // Escurece todas as cartas da pilha sendo movida
    const stackEls = [];
    if (actualData.source === 'tableau') {
      const colDiv = document.getElementById(`col${actualData.colIndex}`);
      const allCards = Array.from(colDiv.querySelectorAll('.card'));
      allCards.slice(actualData.cardIndex).forEach(c => { c.style.opacity = '0.25'; stackEls.push(c); });
    } else {
      el.style.visibility = 'hidden';
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
  const tapKey = data.source + (data.colIndex ?? '') + (data.cardIndex ?? '');
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

  // Drag — find drop target
  const target = document.elementFromPoint(touch.clientX, touch.clientY);
  let dropped = false;
  if (target) {
    const colEl = target.closest('.column');
    const fEl   = target.closest('.foundation');
    if (colEl)    { dropOnTableau(parseInt(colEl.dataset.col), data); dropped = true; }
    else if (fEl) { dropOnFoundation(fEl.dataset.suit, data); dropped = true; }
  }
  if (!dropped) render(); // restaura visual se o drop foi inválido
}, { passive: false });

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
//  CLICK HANDLERS
// =============================================
stockEl.addEventListener('click', drawFromStock);
stockEl.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); drawFromStock(); });

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
//  AUTO MOVE (duplo clique/toque)
//  Tenta: 1) fundação, 2) coluna do tableau
// =============================================
function tryAutoMove(card, source, colIndex, cardIndex) {
  // 1) Tenta fundação (só carta do topo)
  const isTop = source === 'waste' ||
    (source === 'tableau' && cardIndex === state.tableau[colIndex].length - 1);
  if (isTop && canPlaceOnFoundation(card, card.suit)) {
    saveHistory();
    state.foundations[card.suit].push({ ...card });
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

  // 2) Tenta mover para uma coluna válida do tableau
  if (source === 'tableau') {
    // Pega a sequência inteira a partir do cardIndex
    const startIdx = cardIndex !== undefined ? cardIndex : state.tableau[colIndex].length - 1;
    const cards = state.tableau[colIndex].slice(startIdx);
    const topCard = cards[0];
    if (!canPickFromTableau(colIndex, startIdx)) return false;

    // Prioriza colunas com cartas (não vazias) para não desperdiçar espaços
    const targets = [];
    for (let c = 0; c < 7; c++) {
      if (c === colIndex) continue;
      if (canPlaceOnTableau(topCard, c)) {
        targets.push({ col: c, hasCards: state.tableau[c].length > 0 });
      }
    }
    // Ordena: colunas com cartas primeiro
    targets.sort((a, b) => (b.hasCards ? 1 : 0) - (a.hasCards ? 1 : 0));

    if (targets.length > 0) {
      saveHistory();
      state.tableau[colIndex].splice(startIdx);
      flipTopCard(colIndex);
      state.tableau[targets[0].col].push(...cards.map(c => ({ ...c, faceUp: true })));
      state.moves++;
      selected = null;
      render();
      return true;
    }
  } else if (source === 'waste') {
    // Tenta mover a carta do descarte para alguma coluna
    const wasteCard = state.waste[state.waste.length - 1];
    for (let c = 0; c < 7; c++) {
      if (canPlaceOnTableau(wasteCard, c) && state.tableau[c].length > 0) {
        saveHistory();
        state.waste.pop();
        state.tableau[c].push({ ...wasteCard, faceUp: true });
        state.moves++;
        selected = null;
        render();
        return true;
      }
    }
    // Se só tem colunas vazias e é um Rei
    for (let c = 0; c < 7; c++) {
      if (canPlaceOnTableau(wasteCard, c)) {
        saveHistory();
        state.waste.pop();
        state.tableau[c].push({ ...wasteCard, faceUp: true });
        state.moves++;
        selected = null;
        render();
        return true;
      }
    }
  }

  return false;
}

// Mantém compatibilidade — alias antigo
function tryAutoToFoundation(card, source, colIndex) {
  return tryAutoMove(card, source, colIndex);
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
