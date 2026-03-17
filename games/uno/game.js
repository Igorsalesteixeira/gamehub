import '../../auth-check.js';
import { supabase } from '../../supabase.js';

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
let hands = [[], [], [], []]; // 0=player, 1-3=CPU
let currentPlayer = 0;
let direction = 1; // 1=clockwise, -1=counter
let currentColor = '';
let gameActive = false;
let mustDraw = 0; // accumulated draw2/draw4
let calledUno = false;
let pendingWildCard = null;
let moveCount = 0;

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

// === RENDER ===
function render() {
  // Player hand
  playerHandEl.innerHTML = '';
  hands[0].forEach((card, i) => {
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

  // Opponents
  for (let i = 1; i <= 3; i++) {
    const countEl = document.getElementById(`opp-count-${i}`);
    const cardsEl = document.getElementById(`opp-cards-${i}`);
    const oppEl = document.getElementById(`opponent-${i}`);

    countEl.textContent = hands[i].length;
    cardsEl.innerHTML = '';
    const show = Math.min(hands[i].length, 10);
    for (let j = 0; j < show; j++) {
      const back = document.createElement('div');
      back.className = 'opp-card-back';
      cardsEl.appendChild(back);
    }

    oppEl.classList.toggle('active-turn', currentPlayer === i && gameActive);
  }

  // Direction
  directionEl.textContent = direction === 1 ? '→' : '←';

  // UNO badge
  unoBadge.style.display = (hands[0].length === 1 && calledUno) ? '' : 'none';

  // Draw button
  btnDraw.disabled = currentPlayer !== 0 || !gameActive;
  btnUno.style.display = (hands[0].length === 2 && currentPlayer === 0 && gameActive) ? '' : 'none';
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
  if (currentPlayer !== 0 || !gameActive) return;
  const card = hands[0][index];
  if (!canPlay(card)) {
    messageEl.textContent = 'Carta invalida! Jogue uma carta compativel.';
    return;
  }

  // UNO check - must call UNO before playing second-to-last card
  if (hands[0].length === 2 && !calledUno) {
    // Penalty: draw 2 cards
    messageEl.textContent = 'Voce esqueceu de gritar UNO! +2 cartas de penalidade.';
    hands[0].push(drawCard());
    hands[0].push(drawCard());
    render();
    return;
  }

  hands[0].splice(index, 1);
  moveCount++;

  if (card.type === 'wild') {
    pendingWildCard = card;
    showColorPicker();
    return;
  }

  playCardEffect(card, 0);
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
      playCardEffect(pendingWildCard, 0);
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
  if (hands[player].length === 0) {
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
  render();

  if (gameActive && currentPlayer !== 0) {
    setTimeout(() => cpuTurn(), 700);
  }
}

function advancePlayer() {
  currentPlayer = (currentPlayer + direction + 4) % 4;
}

function getPlayerName(p) {
  return p === 0 ? 'Voce' : `CPU ${p}`;
}

// === CPU AI ===
function cpuTurn() {
  if (!gameActive || currentPlayer === 0) return;

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
        }, 500);
        render();
        return;
      }
    }
    advancePlayer();
    render();
    if (currentPlayer !== 0) {
      setTimeout(() => cpuTurn(), 500);
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

  cpuPlayIndex(bestIdx);
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

  messageEl.textContent = `CPU ${player} jogou ${getCardLabel(card)}`;
  playCardEffect(card, player);
}

// === DRAW BUTTON ===
btnDraw.addEventListener('click', () => {
  if (currentPlayer !== 0 || !gameActive) return;
  const c = drawCard();
  if (c) {
    hands[0].push(c);
    messageEl.textContent = 'Voce comprou uma carta.';

    // Can play the drawn card?
    if (canPlay(c)) {
      messageEl.textContent = 'Voce comprou uma carta. Pode joga-la se quiser!';
      render();
      return;
    }
  }
  advancePlayer();
  calledUno = false;
  render();
  if (currentPlayer !== 0) {
    setTimeout(() => cpuTurn(), 500);
  }
});

// === UNO BUTTON ===
btnUno.addEventListener('click', () => {
  calledUno = true;
  messageEl.textContent = 'Voce gritou UNO!';
  btnUno.style.display = 'none';
  render();
});

// === END GAME ===
function endGame(winner) {
  gameActive = false;
  const won = winner === 0;

  modalIcon.textContent = won ? '🏆' : '😢';
  modalTitle.textContent = won ? 'Voce Venceu!' : `CPU ${winner} Venceu!`;
  modalMessage.textContent = won
    ? `Parabens! Voce se livrou de todas as cartas em ${moveCount} jogadas!`
    : `CPU ${winner} ficou sem cartas primeiro.`;
  modalOverlay.classList.add('active');

  btnDraw.disabled = true;
  btnNew.style.display = '';

  saveStats(won ? 'win' : 'loss');
}

async function saveStats(result) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('game_stats').insert({
      user_id: user.id,
      game: 'uno',
      result,
      moves: moveCount,
      time_seconds: null
    });
  } catch (e) { /* ignore */ }
}

// === START GAME ===
function startGame() {
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
  startGame();
});

btnNew.addEventListener('click', () => {
  btnNew.style.display = 'none';
  startGame();
});

drawPileEl.addEventListener('click', () => {
  if (currentPlayer === 0 && gameActive) btnDraw.click();
});

// === INIT ===
startGame();
