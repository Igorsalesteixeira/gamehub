import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
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

// ===== CONFIG =====
const MAX_ATTEMPTS = 6;
const EQUATION_LENGTH = 8;

// ===== STATE =====
let targetEquation = '';
let currentRow = 0;
let currentCol = 0;
let grid = [];
let gameOver = false;
let keyStates = {}; // char -> 'correct' | 'present' | 'absent'

// ===== DOM =====
const boardEl = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const attemptEl = document.getElementById('attempt-display');
const modalEl = document.getElementById('modal');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const modalStats = document.getElementById('modal-stats');

// GameStats - Numble não usa timer, apenas tentativas
const gameStats = new GameStats('numble', { autoSync: true });

// ===== EQUATION GENERATION =====
function generateEquation() {
  // Generate equations of format: "A op B = C" that are exactly 8 chars
  const ops = ['+', '-', '*'];
  let attempts = 0;

  while (attempts < 1000) {
    attempts++;
    const op = ops[Math.floor(getRNG() * ops.length)];
    let a, b, result;

    if (op === '+') {
      a = Math.floor(getRNG() * 90) + 1;
      b = Math.floor(getRNG() * 90) + 1;
      result = a + b;
    } else if (op === '-') {
      a = Math.floor(getRNG() * 90) + 10;
      b = Math.floor(getRNG() * (a - 1)) + 1;
      result = a - b;
    } else {
      a = Math.floor(getRNG() * 20) + 2;
      b = Math.floor(getRNG() * 20) + 2;
      result = a * b;
    }

    const eq = `${a}${op}${b}=${result}`;
    if (eq.length === EQUATION_LENGTH) {
      return eq;
    }
  }
  // Fallback (garantidamente 8 chars e matematicamente correto)
  return '15+20=35';
}

function isValidEquation(str) {
  if (str.length !== EQUATION_LENGTH) return false;
  const eqIndex = str.indexOf('=');
  if (eqIndex === -1 || eqIndex === 0 || eqIndex === str.length - 1) return false;

  const left = str.substring(0, eqIndex);
  const right = str.substring(eqIndex + 1);

  // Validate left side is a math expression
  if (!/^[\d+\-*]+$/.test(left)) return false;
  if (!/^\d+$/.test(right)) return false;

  try {
    const leftVal = Function('"use strict"; return (' + left + ')')();
    const rightVal = parseInt(right, 10);
    return leftVal === rightVal;
  } catch {
    return false;
  }
}

// ===== RENDER =====
function renderBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < MAX_ATTEMPTS; r++) {
    const row = document.createElement('div');
    row.className = 'numble-row';
    for (let c = 0; c < EQUATION_LENGTH; c++) {
      const cell = document.createElement('div');
      cell.className = 'numble-cell';
      if (grid[r] && grid[r][c]) {
        cell.textContent = grid[r][c].char;
        if (grid[r][c].state) {
          cell.classList.add(grid[r][c].state);
        } else if (grid[r][c].char) {
          cell.classList.add('filled');
        }
      }
      if (r === currentRow && c === currentCol && !gameOver) {
        cell.classList.add('active');
      }
      row.appendChild(cell);
    }
    boardEl.appendChild(row);
  }
  attemptEl.textContent = `${Math.min(currentRow + 1, MAX_ATTEMPTS)}/${MAX_ATTEMPTS}`;
}

function renderKeyboard() {
  keyboardEl.innerHTML = '';
  const rows = [
    ['1', '2', '3', '4', '5'],
    ['6', '7', '8', '9', '0'],
    ['ENTER', '+', '-', '*', '=', 'DEL']
  ];

  rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';
    row.forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'kb-key';
      if (key === 'ENTER' || key === 'DEL') btn.classList.add('wide');
      btn.textContent = key === 'DEL' ? '⌫' : key === 'ENTER' ? 'ENTER' : key;
      btn.dataset.key = key;

      if (keyStates[key]) btn.classList.add(keyStates[key]);

      btn.addEventListener('click', () => handleInput(key));
      rowEl.appendChild(btn);
    });
    keyboardEl.appendChild(rowEl);
  });
}

// ===== INPUT =====
function handleInput(key) {
  if (gameOver) return;

  if (key === 'DEL') {
    if (currentCol > 0) {
      currentCol--;
      grid[currentRow][currentCol] = { char: '', state: null };
      renderBoard();
    }
    return;
  }

  if (key === 'ENTER') {
    submitGuess();
    return;
  }

  if (currentCol < EQUATION_LENGTH) {
    if (!grid[currentRow]) grid[currentRow] = [];
    grid[currentRow][currentCol] = { char: key, state: null };
    currentCol++;
    playSound('type'); // som ao digitar
    renderBoard();
  }
}

function submitGuess() {
  if (currentCol < EQUATION_LENGTH) {
    shakeRow();
    return;
  }

  const guess = grid[currentRow].map(c => c.char).join('');

  if (!isValidEquation(guess)) {
    shakeRow();
    return;
  }

  playSound('place'); // som ao confirmar

  // Check each character
  const targetChars = targetEquation.split('');
  const guessChars = guess.split('');
  const states = Array(EQUATION_LENGTH).fill('absent');
  const targetUsed = Array(EQUATION_LENGTH).fill(false);

  // First pass: correct positions
  for (let i = 0; i < EQUATION_LENGTH; i++) {
    if (guessChars[i] === targetChars[i]) {
      states[i] = 'correct';
      targetUsed[i] = true;
    }
  }

  // Second pass: present but wrong position
  for (let i = 0; i < EQUATION_LENGTH; i++) {
    if (states[i] === 'correct') continue;
    for (let j = 0; j < EQUATION_LENGTH; j++) {
      if (!targetUsed[j] && guessChars[i] === targetChars[j]) {
        states[i] = 'present';
        targetUsed[j] = true;
        break;
      }
    }
  }

  // Apply states with delay for animation
  for (let i = 0; i < EQUATION_LENGTH; i++) {
    grid[currentRow][i].state = states[i];
    // Update keyboard state
    const char = guessChars[i];
    if (states[i] === 'correct') keyStates[char] = 'correct';
    else if (states[i] === 'present' && keyStates[char] !== 'correct') keyStates[char] = 'present';
    else if (!keyStates[char]) keyStates[char] = 'absent';
  }

  renderBoard();
  renderKeyboard();

  // Check win
  if (guess === targetEquation) {
    gameOver = true;
    launchConfetti();
    playSound('win');
    setTimeout(() => {
      modalIcon.textContent = '🏆';
      modalTitle.textContent = 'Parabens!';
      modalMsg.textContent = `Voce acertou a equacao em ${currentRow + 1} tentativa(s)!`;
      modalStats.textContent = `Resposta: ${targetEquation}`;
      modalEl.classList.remove('hidden');
      saveStats('win', currentRow + 1);
      if (dailySeed) {
        import('../shared/daily-challenge.js').then(m => {
          m.dailyChallenge.recordResult({ won: true, attempts: currentRow + 1 });
        });
      }
    }, 500);
    return;
  }

  currentRow++;
  currentCol = 0;

  if (currentRow >= MAX_ATTEMPTS) {
    gameOver = true;
    setTimeout(() => {
      modalIcon.textContent = '😔';
      modalTitle.textContent = 'Que pena!';
      modalMsg.textContent = 'Voce nao acertou a equacao.';
      modalStats.textContent = `Resposta: ${targetEquation}`;
      modalEl.classList.remove('hidden');
      saveStats('loss', MAX_ATTEMPTS);
      if (dailySeed) {
        import('../shared/daily-challenge.js').then(m => {
          m.dailyChallenge.recordResult({ won: false, attempts: MAX_ATTEMPTS });
        });
      }
    }, 500);
  }
}

function shakeRow() {
  const rows = boardEl.querySelectorAll('.numble-row');
  if (rows[currentRow]) {
    rows[currentRow].style.animation = 'shake 0.4s ease';
    setTimeout(() => { rows[currentRow].style.animation = ''; }, 400);
  }
}

// ===== KEYBOARD EVENTS =====
document.addEventListener('keydown', (e) => {
  if (gameOver) return;
  const key = e.key;
  if (key === 'Enter') handleInput('ENTER');
  else if (key === 'Backspace') handleInput('DEL');
  else if (/^[0-9+\-*=]$/.test(key)) handleInput(key);
});

// ===== STATS =====
async function saveStats(result, moves) {
  gameStats.recordGame(result === 'win', { moves: moves });
  onGameEnd('numble', { won: result === 'win', score: moves });
}

// ===== INIT =====
function newGame() {
  gameOver = false;
  currentRow = 0;
  currentCol = 0;
  keyStates = {};
  grid = [];
  for (let r = 0; r < MAX_ATTEMPTS; r++) {
    grid[r] = [];
    for (let c = 0; c < EQUATION_LENGTH; c++) {
      grid[r][c] = { char: '', state: null };
    }
  }
  // Reset daily RNG for deterministic generation
  if (dailySeed) {
    dailyRNG = seededRNG(parseInt(dailySeed, 10) || 0);
  }
  targetEquation = generateEquation();
  initAudio();
  renderBoard();
  renderKeyboard();
}

document.getElementById('btn-modal-new').addEventListener('click', () => {
  if (dailySeed) return;
  modalEl.classList.add('hidden');
  newGame();
});

// Disable new game button in daily mode
if (dailySeed) {
  const btnModalNew = document.getElementById('btn-modal-new');
  if (btnModalNew) {
    btnModalNew.disabled = true;
    btnModalNew.style.opacity = '0.5';
    btnModalNew.style.cursor = 'not-allowed';
    btnModalNew.title = 'Desafio diário: apenas uma tentativa';
  }
}
document.getElementById('btn-share')?.addEventListener('click', () => {
  shareOnWhatsApp(`🎉 Acertei a equação no Numble do Games Hub! Venha jogar tambem: https://gameshub.com.br/games/numble/`);
});

newGame();
