import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameTimer } from '../shared/timer.js';
// ===== Jogo da Memoria (Redesigned with pointer events and accessibility) =====
import { supabase } from '../../supabase.js';
import { onGameEnd } from '../shared/game-integration.js';

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

// ---- Stats ----
const stats = new GameStats('memory');

// ---- Timer ----
const gameTimer = new GameTimer({
  onTick: (seconds) => {
    timerDisplay.textContent = formatTime(seconds);
  }
});

// Game state
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let totalPairs = 0;
let moves = 0;
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
  gameTimer.start();
}

function stopTimer() {
  gameTimer.stop();
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
  movesDisplay.textContent = '0';
  timerDisplay.textContent = '0:00';
  victoryModal.classList.add('hidden');

  // Reseta stats
  stats.reset();

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
    card.className = 'memory-card';
    card.dataset.index = i;
    card.dataset.emoji = emoji;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'gridcell');
    card.setAttribute('aria-label', `Carta ${i + 1}, clique para virar`);

    card.innerHTML = `
      <div class="memory-card-inner">
        <div class="memory-card-face memory-card-back"></div>
        <div class="memory-card-face memory-card-front">${emoji}</div>
      </div>
    `;

    // Use pointerdown for better cross-device support (touch and mouse)
    card.addEventListener('pointerdown', onCardPointerDown);
    card.addEventListener('keydown', onCardKeyDown);

    boardEl.appendChild(card);
    cards.push(card);
  });
}

// ===== Card interaction with Pointer Events =====
function onCardPointerDown(e) {
  // Only handle left click / primary touch
  if (e.button && e.button !== 0) return;

  e.preventDefault();
  handleCardFlip(this);
}

function onCardKeyDown(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleCardFlip(this);
  }
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
    initAudio();
  }

  // Flip card
  card.classList.add('flipped');
  card.setAttribute('aria-label', `Carta ${card.dataset.emoji}, virada`);
  flippedCards.push(card);
  playSound('click'); // som ao virar carta

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
    a.setAttribute('aria-label', `Par encontrado: ${a.dataset.emoji}`);
    b.setAttribute('aria-label', `Par encontrado: ${b.dataset.emoji}`);
    flippedCards = [];
    matchedPairs++;
    playSound('win'); // som curto ao acertar par

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
      a.setAttribute('aria-label', `Carta ${parseInt(a.dataset.index) + 1}, clique para virar`);
      b.setAttribute('aria-label', `Carta ${parseInt(b.dataset.index) + 1}, clique para virar`);
      flippedCards = [];
      isLocked = false;
    }, 900);
  }
}

// ===== Victory =====
async function showVictory() {
  const timeSeconds = gameTimer.getTime();
  finalMoves.textContent = moves;
  finalTime.textContent = formatTime(timeSeconds);
  victoryModal.classList.remove('hidden');

  // Mobile: feedback tátil na vitoria (celebracao)
  if (navigator.vibrate) navigator.vibrate([30, 20, 40, 20, 50]);
  launchConfetti();
  playSound('win');

  // Salva stats
  stats.recordGame(true, { score: moves, time: timeSeconds });
  onGameEnd('memory', { won: true, score: moves, time: timeSeconds * 1000 });
  await stats.syncToCloud();
}

// ===== Events =====
btnNewGame.addEventListener('click', initGame);
btnPlayAgain.addEventListener('click', initGame);
difficultySelect.addEventListener('change', initGame);

document.getElementById('btn-share')?.addEventListener('click', () => {
  shareOnWhatsApp(`Completei o Jogo da Memoria no Games Hub! Venha jogar tambem: https://gameshub.com.br/games/memory/`);
});

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