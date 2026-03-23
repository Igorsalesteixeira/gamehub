import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameTimer } from '../shared/timer.js';
// ===== Sudoku Zen v12 - Refatorado =====
import { supabase } from '../../supabase.js';
import { onGameEnd } from '../shared/game-integration.js';

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

// Debug mode
console.log('[Sudoku] v12 Zen - Inicializando...');
const DEBUG = location.search.includes('debug');
function debug(...args) {
  if (DEBUG) console.log('[Sudoku]', ...args);
}

// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

// Elementos DOM
const boardEl = document.getElementById('board');
const timerDisplay = document.getElementById('timer-display');
const diffSelect = document.getElementById('difficulty-select');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnUndo = document.getElementById('btn-undo');
const btnNotes = document.getElementById('btn-notes');
const modalOverlay = document.getElementById('modal-overlay');
const modalMessage = document.getElementById('modal-message');
const modalStats = document.getElementById('modal-stats');
const hintText = document.getElementById('hint-text');

const REMOVE_COUNT = { easy: 35, medium: 45, hard: 55 };
const STORAGE_KEY = 'sudoku-save';

// Estado do jogo
let solution = [];
let puzzle = [];
let userGrid = [];
let notes = []; // notes[row][col] = Set of numbers
let selectedCell = null;
let gameOver = false;
let notesMode = false;
let undoStack = [];
let redoStack = [];
let lastRenderedCells = new Map(); // Para otimizacao de render

// Stats
const stats = new GameStats('sudoku');

// Timer
const gameTimer = new GameTimer({
  onTick: (seconds) => {
    timerDisplay.textContent = formatTime(seconds);
    saveGame();
  }
});

// ===== Generator =====
function generateSolution() {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillDiagonalBoxes(grid);
  solveSudoku(grid);
  return grid;
}

function fillDiagonalBoxes(grid) {
  for (let box = 0; box < 9; box += 3) {
    const nums = shuffle([1,2,3,4,5,6,7,8,9]);
    let idx = 0;
    for (let r = box; r < box + 3; r++)
      for (let c = box; c < box + 3; c++)
        grid[r][c] = nums[idx++];
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(getRNG() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isValid(grid, row, col, num) {
  for (let c = 0; c < 9; c++) if (grid[row][c] === num) return false;
  for (let r = 0; r < 9; r++) if (grid[r][col] === num) return false;
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (grid[r][c] === num) return false;
  return true;
}

function solveSudoku(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        const nums = shuffle([1,2,3,4,5,6,7,8,9]);
        for (const n of nums) {
          if (isValid(grid, r, c, n)) {
            grid[r][c] = n;
            if (solveSudoku(grid)) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function createPuzzle(sol, removeCount) {
  const puz = sol.map(r => [...r]);
  let removed = 0;
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
  );
  for (const [r, c] of positions) {
    if (removed >= removeCount) break;
    puz[r][c] = 0;
    removed++;
  }
  return puz;
}

// ===== Timer =====
function startTimer() {
  gameTimer.start();
}

function stopTimer() {
  gameTimer.stop();
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

// ===== Save/Load =====
function saveGame() {
  if (gameOver) return;
  try {
    const state = {
      difficulty: diffSelect.value,
      puzzle,
      userGrid,
      notes: notes.map(row => row.map(cell => Array.from(cell))),
      selectedCell,
      notesMode,
      time: gameTimer.getTime()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    debug('Game saved');
  } catch (e) {
    debug('Error saving game:', e);
  }
}

function loadGame() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;

    const state = JSON.parse(saved);
    if (!state.puzzle || !state.userGrid) return false;

    // Restaurar estado
    diffSelect.value = state.difficulty || 'medium';
    puzzle = state.puzzle;
    userGrid = state.userGrid;
    notes = state.notes ? state.notes.map(row => row.map(cell => new Set(cell))) : createEmptyNotes();
    selectedCell = null; // Sempre resetar selecao
    notesMode = state.notesMode || false;

    // Gerar solucao para o puzzle
    solution = generateSolution();
    const removeCount = REMOVE_COUNT[state.difficulty] || 45;

    // Verificar se o tempo salvo e valido
    if (state.time && state.time > 0) {
      gameTimer.reset();
      timerDisplay.textContent = formatTime(state.time);
    }

    debug('Game loaded from save');
    return true;
  } catch (e) {
    debug('Error loading game:', e);
    return false;
  }
}

function clearSave() {
  localStorage.removeItem(STORAGE_KEY);
}

// ===== Inicializacao =====
function createEmptyNotes() {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set())
  );
}

function init() {
  debug('Initializing game...');

  if (!boardEl || !timerDisplay) {
    console.error('[Sudoku] Elementos essenciais nao encontrados');
    return;
  }

  stopTimer();
  gameOver = false;
  gameTimer.reset();
  timerDisplay.textContent = '0:00';
  selectedCell = null;
  undoStack = [];
  redoStack = [];
  lastRenderedCells.clear();
  modalOverlay.classList.remove('show');
  updateHintText();
  updateNotesButton();

  // Daily mode: always generate fresh with seeded RNG
  if (dailySeed) {
    dailyRNG = seededRNG(parseInt(dailySeed, 10) || 0);
    stats.reset();
    solution = generateSolution();
    const removeCount = REMOVE_COUNT[diffSelect.value];
    puzzle = createPuzzle(solution, removeCount);
    userGrid = puzzle.map(r => [...r]);
    notes = createEmptyNotes();
  } else if (loadGame()) {
    // Tentar carregar jogo salvo primeiro
    debug('Restored saved game');
  } else {
    // Criar novo jogo
    stats.reset();
    solution = generateSolution();
    const removeCount = REMOVE_COUNT[diffSelect.value];
    puzzle = createPuzzle(solution, removeCount);
    userGrid = puzzle.map(r => [...r]);
    notes = createEmptyNotes();
  }

  render();
  debug('Game initialized:', { difficulty: diffSelect.value });
}

// ===== Renderizacao Otimizada =====
function getCellKey(r, c) {
  return `${r}-${c}`;
}

function render() {
  // Primeira renderizacao - criar estrutura
  if (!boardEl.hasChildNodes()) {
    boardEl.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = createCellElement(r, c);
        boardEl.appendChild(cell);
        lastRenderedCells.set(getCellKey(r, c), { value: 0, notes: new Set() });
      }
    }
  }

  // Atualizar apenas celulas modificadas
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      updateCell(r, c);
    }
  }
}

function createCellElement(r, c) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.dataset.row = r;
  cell.dataset.col = c;

  // Bordas 3x3
  if (c === 2 || c === 5) cell.classList.add('border-right');
  if (r === 2 || r === 5) cell.classList.add('border-bottom');

  cell.addEventListener('click', () => selectCell(r, c));
  return cell;
}

function updateCell(r, c) {
  const key = getCellKey(r, c);
  const cell = boardEl.children[r * 9 + c];
  const value = userGrid[r][c];
  const cellNotes = notes[r][c];

  // Verificar se precisa atualizar
  const lastState = lastRenderedCells.get(key);
  const needsUpdate = !lastState ||
    lastState.value !== value ||
    !setsEqual(lastState.notes, cellNotes);

  if (!needsUpdate) return;

  // Atualizar estado
  lastRenderedCells.set(key, { value, notes: new Set(cellNotes) });

  // Limpar classes
  cell.classList.remove('given', 'user', 'selected', 'same-num', 'conflict', 'notes-mode');

  // Limpar conteudo
  cell.innerHTML = '';

  // Classe base
  if (puzzle[r][c] !== 0) {
    cell.classList.add('given');
    cell.textContent = value;
  } else {
    cell.classList.add('user');

    if (value !== 0) {
      cell.textContent = value;
    } else if (cellNotes.size > 0) {
      // Modo notas - mostrar grid 3x3
      cell.classList.add('notes-mode');
      const notesDiv = document.createElement('div');
      notesDiv.className = 'notes-grid';
      for (let n = 1; n <= 9; n++) {
        const noteSpan = document.createElement('span');
        noteSpan.className = 'note-num';
        noteSpan.textContent = cellNotes.has(n) ? n : '';
        notesDiv.appendChild(noteSpan);
      }
      cell.appendChild(notesDiv);
    }
  }

  // Selecao
  if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
    cell.classList.add('selected');
  }

  // Destacar mesmo numero
  if (selectedCell && value !== 0 && value === userGrid[selectedCell[0]][selectedCell[1]]) {
    cell.classList.add('same-num');
  }

  // Conflito
  if (value !== 0 && puzzle[r][c] === 0 && value !== solution[r][c]) {
    cell.classList.add('conflict');
  }
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

function selectCell(r, c) {
  if (gameOver) return;
  if (puzzle[r][c] !== 0) return; // nao pode selecionar celulas dadas

  selectedCell = [r, c];
  if (!gameTimer.isRunning()) {
    startTimer();
  }
  initAudio();
  haptic(5);
  render();
  updateHintText();
}

// ===== Acoes do Usuario =====
function pushUndo(action) {
  undoStack.push(action);
  redoStack = []; // Limpar redo apos nova acao
}

function undo() {
  if (undoStack.length === 0) return;

  const action = undoStack.pop();
  const { type, row, col, oldValue, oldNotes } = action;

  if (type === 'value') {
    userGrid[row][col] = oldValue;
    notes[row][col] = oldNotes ? new Set(oldNotes) : new Set();
  } else if (type === 'note') {
    notes[row][col] = new Set(oldNotes);
  }

  redoStack.push(action);
  render();
  playSound('place');
  haptic(10);
  debug('Undo:', action);
}

function toggleNotesMode() {
  notesMode = !notesMode;
  updateNotesButton();
  updateHintText();
  haptic(5);
}

function updateNotesButton() {
  if (btnNotes) {
    btnNotes.classList.toggle('active', notesMode);
  }
}

function updateHintText() {
  if (!hintText) return;

  if (notesMode) {
    hintText.textContent = 'Modo Lapis ativo - toque para adicionar/remover candidatos';
    hintText.classList.add('notes-active');
  } else if (selectedCell) {
    hintText.textContent = 'Celula selecionada - toque em um numero';
    hintText.classList.remove('notes-active');
  } else {
    hintText.textContent = 'Toque em uma celula e depois em um numero';
    hintText.classList.remove('notes-active');
  }
}

async function placeNumber(num) {
  if (!selectedCell || gameOver) return;
  const [r, c] = selectedCell;
  if (puzzle[r][c] !== 0) return;

  initAudio();

  if (notesMode && num !== 0) {
    // Modo notas - toggle do numero
    const oldNotes = new Set(notes[r][c]);

    if (notes[r][c].has(num)) {
      notes[r][c].delete(num);
    } else {
      notes[r][c].add(num);
    }

    pushUndo({ type: 'note', row: r, col: c, oldNotes });
    playSound('place');
    haptic(5);
  } else {
    // Modo normal - colocar numero
    const oldValue = userGrid[r][c];
    const oldNotes = new Set(notes[r][c]);

    pushUndo({ type: 'value', row: r, col: c, oldValue, oldNotes });

    userGrid[r][c] = num;
    notes[r][c].clear(); // Limpar notas ao colocar numero

    playSound('place');
    haptic(10);
  }

  render();
  saveGame();

  // Check win
  if (checkComplete()) {
    gameOver = true;
    stopTimer();
    clearSave();
    const timeSeconds = gameTimer.getTime();
    launchConfetti();
    playSound('win');
    setTimeout(() => {
      modalMessage.textContent = `Tempo: ${formatTime(timeSeconds)}`;
      if (modalStats) {
        modalStats.textContent = `Dificuldade: ${diffSelect.options[diffSelect.selectedIndex].text}`;
      }
      modalOverlay.classList.add('show');
      stats.recordGame(true, { time: timeSeconds });
      onGameEnd('sudoku', { won: true, time: timeSeconds * 1000 });
      stats.syncToCloud();
      if (dailySeed) {
        import('../shared/daily-challenge.js').then(m => {
          m.dailyChallenge.recordResult({ won: true, time: timeSeconds * 1000 });
        });
      }
    }, 300);
  }
}

function checkComplete() {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (userGrid[r][c] !== solution[r][c]) return false;
  return true;
}

// ===== Contagem de Numeros =====
function countNumbers() {
  const counts = {};
  for (let n = 1; n <= 9; n++) {
    counts[n] = 0;
  }
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = userGrid[r][c];
      if (val !== 0) {
        counts[val]++;
      }
    }
  }
  return counts;
}

function updateNumpad() {
  const counts = countNumbers();
  document.querySelectorAll('.num-btn').forEach(btn => {
    const num = parseInt(btn.dataset.num);
    if (num >= 1 && num <= 9) {
      btn.classList.toggle('used', counts[num] >= 9);
    }
  });
}

// ===== Event Listeners =====
document.querySelectorAll('.num-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    placeNumber(parseInt(btn.dataset.num));
  });
});

// Keyboard
document.addEventListener('keydown', (e) => {
  // Numeros
  if (e.key >= '1' && e.key <= '9') {
    placeNumber(parseInt(e.key));
    return;
  }

  // Apagar
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    placeNumber(0);
    return;
  }

  // Undo (Ctrl+Z)
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
    return;
  }

  // Toggle notas (N)
  if (e.key === 'n' || e.key === 'N') {
    toggleNotesMode();
    return;
  }

  // Navegacao com setas
  if (selectedCell) {
    let [r, c] = selectedCell;
    if (e.key === 'ArrowUp') selectCell(Math.max(0, r - 1), c);
    if (e.key === 'ArrowDown') selectCell(Math.min(8, r + 1), c);
    if (e.key === 'ArrowLeft') selectCell(r, Math.max(0, c - 1));
    if (e.key === 'ArrowRight') selectCell(r, Math.min(8, c + 1));
  }
});

// Botoes
if (btnNewGame) {
  btnNewGame.addEventListener('click', () => {
    if (dailySeed) return;
    clearSave();
    init();
  });
}

if (btnPlayAgain) {
  btnPlayAgain.addEventListener('click', () => {
    if (dailySeed) return;
    clearSave();
    init();
  });
}

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
  if (diffSelect) {
    diffSelect.disabled = true;
    diffSelect.title = 'Desafio diário: dificuldade fixa';
  }
}

if (btnUndo) {
  btnUndo.addEventListener('click', undo);
}

if (btnNotes) {
  btnNotes.addEventListener('click', toggleNotesMode);
}

if (diffSelect) {
  diffSelect.addEventListener('change', () => {
    clearSave();
    init();
  });
}

const btnShare = document.getElementById('btn-share');
if (btnShare) {
  btnShare.addEventListener('click', () => {
    shareOnWhatsApp(`Completei o Sudoku no Games Hub! Venha jogar tambem: https://gameshub.com.br/games/sudoku/`);
  });
}

// Fechar modal ao clicar fora
if (modalOverlay) {
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove('show');
    }
  });
}

// ===== Iniciar =====
init();