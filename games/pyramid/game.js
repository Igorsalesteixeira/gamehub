import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';
// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const VALUES = {A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13};

let pyramid, stock, waste, selected, moves, timerInterval, seconds;

function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s, value: VALUES[r] });
  // Fisher-Yates shuffle (distribuição uniforme)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function isRed(suit) { return suit === '♥' || suit === '♦'; }

function init() {
  const deck = createDeck();
  pyramid = [];
  let idx = 0;
  for (let row = 0; row < 7; row++) {
    pyramid[row] = [];
    for (let col = 0; col <= row; col++) {
      pyramid[row][col] = { ...deck[idx++], removed: false };
    }
  }
  stock = deck.slice(28);
  waste = [];
  selected = null;
  moves = 0;
  seconds = 0;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds++;
    document.getElementById('time-display').textContent = `${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}`;
  }, 1000);
  document.getElementById('moves-display').textContent = '0';
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('message').textContent = '';
  render();
}

function isExposed(row, col) {
  if (row === 6) return true;
  const next = pyramid[row + 1];
  return next[col].removed && next[col + 1].removed;
}

function render() {
  const pyEl = document.getElementById('pyramid');
  pyEl.innerHTML = '';
  for (let row = 0; row < 7; row++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'pyramid-row';
    rowEl.style.paddingLeft = `${(6 - row) * 25}px`;
    for (let col = 0; col <= row; col++) {
      const card = pyramid[row][col];
      const el = document.createElement('div');
      if (card.removed) {
        el.className = 'card empty';
      } else {
        const exposed = isExposed(row, col);
        el.className = `card ${exposed ? 'exposed' : 'blocked'} ${isRed(card.suit) ? 'red' : 'black'}`;
        if (selected && selected.type === 'pyramid' && selected.row === row && selected.col === col) {
          el.classList.add('selected');
        }
        el.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit">${card.suit}</span>`;
        if (exposed) {
          if (card.value === 13) {
            el.addEventListener('click', () => removeKing(row, col));
          } else {
            el.addEventListener('click', () => selectCard('pyramid', row, col, card));
          }
        }
      }
      rowEl.appendChild(el);
    }
    pyEl.appendChild(rowEl);
  }

  // Stock
  const stockEl = document.getElementById('stock-pile');
  stockEl.innerHTML = stock.length > 0
    ? `<div class="card-back">🂠</div><div class="pile-label">Monte (${stock.length})</div>`
    : `<div class="card empty-pile"></div><div class="pile-label">Vazio</div>`;
  stockEl.onclick = drawCard;

  // Waste
  const wasteEl = document.getElementById('waste-pile');
  if (waste.length > 0) {
    const top = waste[waste.length - 1];
    const wSelected = selected && selected.type === 'waste';
    wasteEl.innerHTML = `<div class="card exposed ${isRed(top.suit) ? 'red' : 'black'} ${wSelected ? 'selected' : ''}">
      <span class="card-rank">${top.rank}</span><span class="card-suit">${top.suit}</span>
    </div><div class="pile-label">Descarte</div>`;
    if (top.value === 13) {
      wasteEl.onclick = () => { waste.pop(); moves++; document.getElementById('moves-display').textContent = moves; render(); checkWin(); };
    } else {
      wasteEl.onclick = () => selectCard('waste', 0, 0, top);
    }
  } else {
    wasteEl.innerHTML = `<div class="card empty-pile"></div><div class="pile-label">Descarte</div>`;
    wasteEl.onclick = null;
  }
}

function drawCard() {
  if (stock.length === 0) return;
  waste.push(stock.pop());
  selected = null;
  moves++;
  document.getElementById('moves-display').textContent = moves;
  render();
}

function removeKing(row, col) {
  pyramid[row][col].removed = true;
  selected = null;
  moves++;
  document.getElementById('moves-display').textContent = moves;
  render();
  checkWin();
}

function selectCard(type, row, col, card) {
  if (!selected) {
    selected = { type, row, col, card };
    render();
    return;
  }

  if (selected.card.value + card.value === 13) {
    // Match!
    if (selected.type === 'pyramid') {
      pyramid[selected.row][selected.col].removed = true;
    } else {
      waste.pop();
    }
    if (type === 'pyramid') {
      pyramid[row][col].removed = true;
    } else {
      waste.pop();
    }
    moves++;
    document.getElementById('moves-display').textContent = moves;
    selected = null;
    render();
    checkWin();
  } else {
    selected = { type, row, col, card };
    render();
  }
}

function checkWin() {
  const allRemoved = pyramid.every(row => row.every(c => c.removed));
  if (allRemoved) {
    clearInterval(timerInterval);
    launchConfetti();
    playSound('win');
    showModal('🏆 Você venceu!', `Parabens! Completou em ${moves} movimentos e ${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}`, 'win');
  }
}

async function showModal(title, message, result) {
  document.getElementById('modal-icon').textContent = result === 'win' ? '🏆' : '😔';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').textContent = message;
  document.getElementById('modal-overlay').style.display = 'flex';

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('game_stats').insert({
      user_id: session.user.id, game: 'pyramid', result, moves, time_seconds: seconds,
      score: moves,
    });
  }
}

document.getElementById('btn-new').addEventListener('click', init);
document.getElementById('modal-btn').addEventListener('click', init);

document.getElementById('btn-share')?.addEventListener('click', () => {
  shareOnWhatsApp(`🎉 Completei a Paciência Pirâmide no Games Hub! Venha jogar tambem: https://gameshub.com.br/games/pyramid/`);
});

init();
