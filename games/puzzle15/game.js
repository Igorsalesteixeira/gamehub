import '../../auth-check.js';
// ===== Puzzle 15 =====
import { supabase } from '../../supabase.js';

const boardEl = document.getElementById('board');
const movesDisplay = document.getElementById('moves-display');
const timerDisplay = document.getElementById('timer-display');
const modalOverlay = document.getElementById('modal-overlay');
const modalMessage = document.getElementById('modal-message');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');

let tiles = [];
let moves = 0;
let timerSeconds = 0;
let timerInterval = null;
let gameStarted = false;
let gameOver = false;
let lastMovedIndex = -1; // índice de destino da peça que acabou de mover
let lastMoveDir = '';    // direção da animação

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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

function init() {
  stopTimer();
  gameStarted = false;
  gameOver = false;
  moves = 0;
  timerSeconds = 0;
  movesDisplay.textContent = '0';
  timerDisplay.textContent = '0:00';
  modalOverlay.classList.remove('show');

  do {
    tiles = shuffle([...Array(15).keys()].map(i => i + 1).concat([0]));
  } while (!isSolvable(tiles) || isWon());

  render();
}

function render() {
  boardEl.innerHTML = '';
  tiles.forEach((val, i) => {
    const tile = document.createElement('div');
    let cls = 'tile' + (val === 0 ? ' empty' : '');
    if (i === lastMovedIndex && lastMoveDir) cls += ' ' + lastMoveDir;
    tile.className = cls;
    if (val !== 0) tile.textContent = val;
    tile.addEventListener('click', () => handleClick(i));
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

  if (!gameStarted) { gameStarted = true; startTimer(); }

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
  render();

  if (isWon()) {
    gameOver = true;
    stopTimer();
    setTimeout(() => {
      modalMessage.textContent = `${moves} movimentos em ${formatTime(timerSeconds)}`;
      modalOverlay.classList.add('show');
      saveGameStat();
    }, 300);
  }
}

function isWon() {
  for (let i = 0; i < 15; i++)
    if (tiles[i] !== i + 1) return false;
  return tiles[15] === 0;
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    timerSeconds++;
    timerDisplay.textContent = formatTime(timerSeconds);
  }, 1000);
}

function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
function formatTime(s) { return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; }

btnNewGame.addEventListener('click', init);
btnPlayAgain.addEventListener('click', init);

async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id, game: 'puzzle15',
      result: 'win', moves: moves, time_seconds: timerSeconds,
    });
  } catch (e) { console.warn('Erro ao salvar stats:', e); }
}

init();
