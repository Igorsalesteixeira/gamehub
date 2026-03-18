import '../../auth-check.js';
// ===== Jogo da Memoria =====
import { supabase } from '../../supabase.js';

const EMOJIS = [
  '🐶','🐱','🐸','🦊','🐼','🐨','🦁','🐯',
  '🐮','🐷','🐵','🦄','🐙','🦋','🐢','🦀',
  '🐳','🐺','🦉','🐝'
];

const DIFFICULTY = {
  easy:   { cols: 4, rows: 3, pairs: 6 },
  medium: { cols: 4, rows: 4, pairs: 8 },
  hard:   { cols: 6, rows: 4, pairs: 12 }
};

// DOM elements
const boardEl        = document.getElementById('board');
const movesDisplay   = document.getElementById('moves-display');
const timerDisplay   = document.getElementById('timer-display');
const difficultySelect = document.getElementById('difficulty-select');
const btnNewGame     = document.getElementById('btn-new-game');
const victoryModal   = document.getElementById('victory-modal');
const finalMoves     = document.getElementById('final-moves');
const finalTime      = document.getElementById('final-time');
const btnPlayAgain   = document.getElementById('btn-play-again');

// Game state
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let totalPairs = 0;
let moves = 0;
let timerSeconds = 0;
let timerInterval = null;
let isLocked = false; // prevent clicks during flip-back animation
let gameStarted = false;

// ===== Shuffle (Fisher-Yates) =====
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== Timer =====
function startTimer() {
  if (timerInterval) return;
  timerSeconds = 0;
  timerInterval = setInterval(() => {
    timerSeconds++;
    timerDisplay.textContent = formatTime(timerSeconds);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ===== Card sizing =====
function calcCardSize(cols, rows) {
  const container = document.querySelector('.game-container');
  const style = getComputedStyle(container);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const availW = container.clientWidth - padX;
  const availH = container.clientHeight - padY;
  const gap = cols <= 4 ? 8 : 6;
  const maxCardW = (availW - gap * (cols + 1)) / cols;
  const maxCardH = (availH - gap * (rows + 1)) / rows;
  const cardSize = Math.floor(Math.min(maxCardW, maxCardH, 120));
  return Math.max(cardSize, 48);
}

// ===== Init Game =====
function initGame() {
  const diff = DIFFICULTY[difficultySelect.value];
  const { cols, rows, pairs } = diff;
  totalPairs = pairs;

  // Reset state
  stopTimer();
  gameStarted = false;
  isLocked = false;
  flippedCards = [];
  matchedPairs = 0;
  moves = 0;
  timerSeconds = 0;
  movesDisplay.textContent = '0';
  timerDisplay.textContent = '0:00';
  victoryModal.classList.add('hidden');

  // Pick emojis and create pairs
  const picked = shuffle([...EMOJIS]).slice(0, pairs);
  const deck = shuffle([...picked, ...picked]);

  // Set grid
  boardEl.setAttribute('data-cols', cols);
  const cardSize = calcCardSize(cols, rows);
  boardEl.style.gridTemplateColumns = `repeat(${cols}, ${cardSize}px)`;
  boardEl.style.gridTemplateRows = `repeat(${rows}, ${cardSize}px)`;

  // Build cards
  boardEl.innerHTML = '';
  cards = [];

  deck.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.index = i;
    card.dataset.emoji = emoji;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back"></div>
        <div class="card-face card-front">${emoji}</div>
      </div>
    `;

    card.addEventListener('click', onCardClick);
    card.addEventListener('touchend', onCardTouch);

    boardEl.appendChild(card);
    cards.push(card);
  });
}

// ===== Card interaction =====
function onCardTouch(e) {
  // Prevent ghost click on touch devices
  e.preventDefault();
  handleCardFlip(this);
}

function onCardClick(e) {
  // On touch devices, touchend already handled it
  if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
  handleCardFlip(this);
}

function handleCardFlip(card) {
  if (isLocked) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;
  if (flippedCards.length >= 2) return;

  // Start timer on first interaction
  if (!gameStarted) {
    gameStarted = true;
    startTimer();
  }

  // Flip card
  card.classList.add('flipped');
  flippedCards.push(card);
  // Mobile: feedback tátil ao virar carta
  if (navigator.vibrate) navigator.vibrate(10);

  if (flippedCards.length === 2) {
    moves++;
    movesDisplay.textContent = moves;
    checkMatch();
  }
}

function checkMatch() {
  const [a, b] = flippedCards;
  const match = a.dataset.emoji === b.dataset.emoji;

  if (match) {
    a.classList.add('matched');
    b.classList.add('matched');
    flippedCards = [];
    matchedPairs++;
    // Mobile: feedback tátil ao fazer match (sucesso)
    if (navigator.vibrate) navigator.vibrate([15, 8, 25]);

    if (matchedPairs === totalPairs) {
      stopTimer();
      setTimeout(showVictory, 600);
    }
  } else {
    isLocked = true;
    setTimeout(() => {
      a.classList.remove('flipped');
      b.classList.remove('flipped');
      flippedCards = [];
      isLocked = false;
    }, 900);
  }
}

// ===== Victory =====
function showVictory() {
  finalMoves.textContent = moves;
  finalTime.textContent = formatTime(timerSeconds);
  victoryModal.classList.remove('hidden');
  // Mobile: feedback tátil na vitória (celebração)
  if (navigator.vibrate) navigator.vibrate([30, 20, 40, 20, 50]);
  saveGameStat();
}

// ===== Stats — Supabase =====
async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'memory',
      result: 'win',
      moves: moves,
      time_seconds: timerSeconds,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// ===== Events =====
btnNewGame.addEventListener('click', initGame);
btnPlayAgain.addEventListener('click', initGame);
difficultySelect.addEventListener('change', initGame);

// Recalc card sizes on resize
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const diff = DIFFICULTY[difficultySelect.value];
    const cardSize = calcCardSize(diff.cols, diff.rows);
    boardEl.style.gridTemplateColumns = `repeat(${diff.cols}, ${cardSize}px)`;
    boardEl.style.gridTemplateRows = `repeat(${diff.rows}, ${cardSize}px)`;
  }, 150);
});

// Start
initGame();
