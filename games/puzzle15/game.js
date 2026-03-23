import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameTimer } from '../shared/timer.js';
import { onGameEnd } from '../shared/game-integration.js';

// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

// Daily challenge support
const dailySeed = new URLSearchParams(window.location.search).get('daily');
let dailyRNG = null;

function seededRNG(seed) {
  let s = seed;
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getRNG() {
  return dailyRNG ? dailyRNG() : Math.random();
}

const boardEl = document.getElementById('board');
const movesDisplay = document.getElementById('moves-display');
const timerDisplay = document.getElementById('timer-display');
const modalOverlay = document.getElementById('modal-overlay');
const modalMessage = document.getElementById('modal-message');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');

let tiles = [];
let moves = 0;
let gameStarted = false;
let gameOver = false;
let lastMovedIndex = -1; // índice de destino da peça que acabou de mover
let lastMoveDir = '';    // direção da animação
let selectedIndex = -1;  // índice selecionado para navegação por teclado

// GameStats e GameTimer
const gameStats = new GameStats('puzzle15', { autoSync: true });
const gameTimer = new GameTimer({
  onTick: (time, formatted) => {
    timerDisplay.textContent = formatted;
  }
});

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(getRNG() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isSolvable(arr) {
  let inversions = 0;
  const flat = arr.filter(v => v !== 0);
  for (let i = 0; i < flat.length; i++)
    for (let j = i + 1; j < flat.length; j++)
      if (flat[i] > flat[j]) inversions++;
  const emptyRow = Math.floor(arr.indexOf(0) / 4);
  // For 4x4: solvable if (inversions + row of blank from bottom) is even
  return (inversions + (3 - emptyRow)) % 2 === 0;
}

// Retorna índices adjacentes ao espaço vazio (peças movíveis)
function getMovableIndices() {
  const emptyIndex = tiles.indexOf(0);
  const row = Math.floor(emptyIndex / 4);
  const col = emptyIndex % 4;
  const movable = [];

  if (row > 0) movable.push(emptyIndex - 4); // cima
  if (row < 3) movable.push(emptyIndex + 4); // baixo
  if (col > 0) movable.push(emptyIndex - 1); // esquerda
  if (col < 3) movable.push(emptyIndex + 1); // direita

  return movable;
}

function init() {
  gameTimer.stop();
  gameTimer.reset();
  gameStarted = false;
  gameOver = false;
  moves = 0;
  selectedIndex = -1;
  movesDisplay.textContent = '0';
  timerDisplay.textContent = '0:00';
  modalOverlay.classList.remove('show');

  // Reset daily RNG for deterministic shuffle
  if (dailySeed) {
    dailyRNG = seededRNG(parseInt(dailySeed, 10) || 0);
  }

  do {
    tiles = shuffle([...Array(15).keys()].map(i => i + 1).concat([0]));
  } while (!isSolvable(tiles) || isWon());

  render();
}

function render() {
  boardEl.innerHTML = '';
  const movableIndices = getMovableIndices();

  tiles.forEach((val, i) => {
    const tile = document.createElement('div');
    let cls = 'tile' + (val === 0 ? ' empty' : '');
    if (i === lastMovedIndex && lastMoveDir) cls += ' ' + lastMoveDir;
    if (movableIndices.includes(i) && val !== 0) cls += ' movable';
    tile.className = cls;

    if (val !== 0) {
      tile.textContent = val;
      // Acessibilidade: aria-label para cada peça
      tile.setAttribute('aria-label', `Peça ${val}`);
      tile.setAttribute('role', 'button');
      tile.setAttribute('tabindex', '0');
    } else {
      tile.setAttribute('aria-label', 'Espaço vazio');
      tile.setAttribute('tabindex', '-1');
    }

    // Índice para navegação por teclado
    tile.dataset.index = i;

    tile.addEventListener('click', () => handleClick(i));
    tile.addEventListener('keydown', (e) => handleKeydown(e, i));

    boardEl.appendChild(tile);
  });

  lastMovedIndex = -1;
  lastMoveDir = '';
}

function handleClick(index) {
  if (gameOver) return;
  if (tiles[index] === 0) return;

  const emptyIndex = tiles.indexOf(0);
  const row = Math.floor(index / 4), col = index % 4;
  const eRow = Math.floor(emptyIndex / 4), eCol = emptyIndex % 4;

  // Adjacent?
  const isAdjacent = (Math.abs(row - eRow) + Math.abs(col - eCol)) === 1;
  if (!isAdjacent) return;

  if (!gameStarted) { gameStarted = true; gameTimer.start(); initAudio(); }

  // Calcular direção da animação (tile vai do index para emptyIndex)
  if (row < eRow) lastMoveDir = 'slide-up';
  else if (row > eRow) lastMoveDir = 'slide-down';
  else if (col < eCol) lastMoveDir = 'slide-left';
  else lastMoveDir = 'slide-right';
  lastMovedIndex = emptyIndex; // o tile vai parar no emptyIndex

  // Swap
  [tiles[index], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[index]];
  moves++;
  movesDisplay.textContent = moves;
  playSound('move'); // som ao mover peça
  haptic(10);
  render();

  if (isWon()) {
    gameOver = true;
    gameTimer.stop();
    launchConfetti();
    playSound('win');
    setTimeout(() => {
      modalMessage.textContent = `${moves} movimentos em ${gameTimer.getFormatted()}`;
      modalOverlay.classList.add('show');
      saveGameStat();
      if (dailySeed) {
        import('../shared/daily-challenge.js').then(m => {
          m.dailyChallenge.recordResult({ won: true, time: gameTimer.getTime() * 1000, score: moves });
        });
      }
    }, 300);
  }
}

// Navegação por teclado
function handleKeydown(e, index) {
  if (gameOver) return;
  if (tiles[index] === 0) return;

  const emptyIndex = tiles.indexOf(0);
  const row = Math.floor(index / 4);
  const col = index % 4;

  let targetIndex = -1;

  // Seta aperta para mover a peça na direção do espaço vazio
  switch (e.key) {
    case 'ArrowUp':
      if (row < 3 && tiles[index + 4] === 0) targetIndex = index;
      else if (row > 0 && tiles[index - 4] === 0) targetIndex = index;
      break;
    case 'ArrowDown':
      if (row > 0 && tiles[index - 4] === 0) targetIndex = index;
      else if (row < 3 && tiles[index + 4] === 0) targetIndex = index;
      break;
    case 'ArrowLeft':
      if (col < 3 && tiles[index + 1] === 0) targetIndex = index;
      else if (col > 0 && tiles[index - 1] === 0) targetIndex = index;
      break;
    case 'ArrowRight':
      if (col > 0 && tiles[index - 1] === 0) targetIndex = index;
      else if (col < 3 && tiles[index + 1] === 0) targetIndex = index;
      break;
    case 'Enter':
    case ' ':
      // Enter ou Space: move a peça se for adjacente ao espaço vazio
      const eRow = Math.floor(emptyIndex / 4);
      const eCol = emptyIndex % 4;
      const isAdjacent = (Math.abs(row - eRow) + Math.abs(col - eCol)) === 1;
      if (isAdjacent) targetIndex = index;
      break;
  }

  if (targetIndex !== -1) {
    e.preventDefault();
    handleClick(targetIndex);
  }
}

// Navegação global por setas no tabuleiro
document.addEventListener('keydown', (e) => {
  if (gameOver) return;

  const emptyIndex = tiles.indexOf(0);
  const row = Math.floor(emptyIndex / 4);
  const col = emptyIndex % 4;

  let targetIndex = -1;

  // Mover a peça que está na direção oposta à seta
  switch (e.key) {
    case 'ArrowUp':
      if (row < 3) targetIndex = emptyIndex + 4; // peça abaixo sobe
      break;
    case 'ArrowDown':
      if (row > 0) targetIndex = emptyIndex - 4; // peça acima desce
      break;
    case 'ArrowLeft':
      if (col < 3) targetIndex = emptyIndex + 1; // peça à direita move esquerda
      break;
    case 'ArrowRight':
      if (col > 0) targetIndex = emptyIndex - 1; // peça à esquerda move direita
      break;
  }

  if (targetIndex !== -1 && tiles[targetIndex] !== 0) {
    e.preventDefault();
    handleClick(targetIndex);
    // Foco na peça que acabou de mover
    const tileEl = boardEl.children[emptyIndex]; // emptyIndex agora tem a peça
    if (tileEl) tileEl.focus();
  }
});

function isWon() {
  for (let i = 0; i < 15; i++)
    if (tiles[i] !== i + 1) return false;
  return tiles[15] === 0;
}

btnNewGame.addEventListener('click', () => {
  if (dailySeed) return;
  init();
});
btnPlayAgain.addEventListener('click', () => {
  if (dailySeed) return;
  init();
});

// Disable buttons in daily mode
if (dailySeed) {
  [btnNewGame, btnPlayAgain].forEach(btn => {
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = 'Desafio diário: apenas uma tentativa';
    }
  });
}

document.getElementById('btn-share')?.addEventListener('click', () => {
  shareOnWhatsApp(`🎉 Completei o Puzzle 15 no Games Hub! Venha jogar também: https://gameshub.com.br/games/puzzle15/`);
});

async function saveGameStat() {
  gameStats.recordGame(true, { moves: moves, time: gameTimer.getTime() });
  onGameEnd('puzzle15', { won: true, score: moves, time: gameTimer.getTime() * 1000 });
}

init();