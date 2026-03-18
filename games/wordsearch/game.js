import '../../auth-check.js';
// ===== Caça-Palavras =====
import { supabase } from '../../supabase.js';
// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

const CATEGORIES = {
  'Animais': ['GATO','CACHORRO','ELEFANTE','GIRAFA','TIGRE','LEAO','MACACO','COBRA','AGUIA','BALEIA','CAVALO','COELHO','GALINHA','PAPAGAIO','PINGUIM','TARTARUGA','JACARE','LOBO','URSO','RAPOSA','GOLFINHO','CORUJA','PANTERA','CAMELO','TUCANO'],
  'Frutas': ['BANANA','MORANGO','ABACAXI','LARANJA','MELANCIA','MANGA','GOIABA','PESSEGO','CEREJA','AMORA','LIMAO','MAMAO','CAQUI','GRAVIOLA','PITANGA','ACEROLA','COCO','FIGO','AMEIXA','KIWI','PERA','MIRTILO'],
  'Paises': ['BRASIL','PORTUGAL','ESPANHA','FRANCA','ALEMANHA','ITALIA','JAPAO','CHINA','CANADA','MEXICO','ARGENTINA','CHILE','COLOMBIA','PERU','AUSTRALIA','INDIA','RUSSIA','TURQUIA','EGITO','MARROCOS'],
  'Cores': ['VERMELHO','AZUL','VERDE','AMARELO','ROXO','LARANJA','ROSA','BRANCO','PRETO','CINZA','DOURADO','PRATA','VIOLETA','MARROM','BEGE'],
  'Esportes': ['FUTEBOL','BASQUETE','VOLEIBOL','NATACAO','TENIS','HANDEBOL','ATLETISMO','CICLISMO','BOXE','SURFE','KARATE','ESGRIMA','GOLFE','RUGBY','CORRIDA'],
  'Comidas': ['PIZZA','LASANHA','MACARRAO','SALADA','ARROZ','FEIJAO','CARNE','FRANGO','QUEIJO','SOPA','BOLO','PUDIM','TORTA','PASTEL','COXINHA']
};

const GRID_SIZE = 12;
const CELL = 38;
const DIRECTIONS = [
  [0,1],[1,0],[1,1],[1,-1],
  [0,-1],[-1,0],[-1,-1],[-1,1]
];

let grid = [];
let words = [];
let foundWords = new Set();
let selecting = false;
let selStart = null;
let selEnd = null;
let foundLines = [];
let timerInterval = null;
let startTime = 0;

const canvas = document.getElementById('grid-canvas');
const ctx = canvas.getContext('2d');
const wordListEl = document.getElementById('word-list');
const timerEl = document.getElementById('timer-display');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');

function pickWords() {
  const catKeys = Object.keys(CATEGORIES);
  const cat = catKeys[Math.floor(Math.random() * catKeys.length)];
  const pool = [...CATEGORIES[cat]];
  const selected = [];
  while (selected.length < 10 && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    const w = pool.splice(idx, 1)[0];
    if (w.length <= GRID_SIZE) selected.push(w);
  }
  return selected.slice(0, Math.max(8, selected.length));
}

function createEmptyGrid() {
  return Array.from({length: GRID_SIZE}, () => Array(GRID_SIZE).fill(''));
}

function canPlace(grid, word, r, c, dr, dc) {
  for (let i = 0; i < word.length; i++) {
    const nr = r + dr * i, nc = c + dc * i;
    if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) return false;
    if (grid[nr][nc] !== '' && grid[nr][nc] !== word[i]) return false;
  }
  return true;
}

function placeWord(grid, word) {
  const dirs = [...DIRECTIONS].sort(() => Math.random() - 0.5);
  for (let attempt = 0; attempt < 100; attempt++) {
    const dir = dirs[attempt % dirs.length];
    const r = Math.floor(Math.random() * GRID_SIZE);
    const c = Math.floor(Math.random() * GRID_SIZE);
    if (canPlace(grid, word, r, c, dir[0], dir[1])) {
      for (let i = 0; i < word.length; i++) {
        grid[r + dir[0] * i][c + dir[1] * i] = word[i];
      }
      return { r, c, dr: dir[0], dc: dir[1], word };
    }
  }
  return null;
}

function fillRandom(grid) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c] === '') grid[r][c] = letters[Math.floor(Math.random() * 26)];
}

let placedWords = [];

function generatePuzzle() {
  let attempts = 0;
  while (attempts < 20) {
    const g = createEmptyGrid();
    const w = pickWords();
    const sorted = [...w].sort((a, b) => b.length - a.length);
    const placed = [];
    for (const word of sorted) {
      const result = placeWord(g, word);
      if (result) placed.push(result);
    }
    if (placed.length >= 6) {
      fillRandom(g);
      grid = g;
      words = placed.map(p => p.word);
      placedWords = placed;
      return;
    }
    attempts++;
  }
  // fallback
  grid = createEmptyGrid();
  fillRandom(grid);
  words = [];
  placedWords = [];
}

function initCanvas() {
  const size = GRID_SIZE * CELL;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw() {
  const size = GRID_SIZE * CELL;
  ctx.clearRect(0, 0, size, size);

  // Draw found lines
  for (const line of foundLines) {
    drawLine(line.cells, '#4ade80', 0.25);
  }

  // Draw current selection
  if (selecting && selStart && selEnd) {
    const cells = getCellsBetween(selStart, selEnd);
    if (cells.length > 0) drawLine(cells, '#ff6b35', 0.3);
  }

  // Draw letters
  ctx.font = '700 16px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const x = c * CELL + CELL / 2;
      const y = r * CELL + CELL / 2;
      const isInFound = foundLines.some(l => l.cells.some(([cr, cc]) => cr === r && cc === c));
      ctx.fillStyle = isInFound ? '#fff' : '#ccc';
      ctx.fillText(grid[r][c], x, y);
    }
  }
}

function drawLine(cells, color, alpha) {
  if (cells.length === 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = CELL * 0.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const [r0, c0] = cells[0];
  ctx.moveTo(c0 * CELL + CELL/2, r0 * CELL + CELL/2);
  for (let i = 1; i < cells.length; i++) {
    ctx.lineTo(cells[i][1] * CELL + CELL/2, cells[i][0] * CELL + CELL/2);
  }
  ctx.stroke();
  ctx.restore();
}

function getCellsBetween(start, end) {
  const dr = Math.sign(end[0] - start[0]);
  const dc = Math.sign(end[1] - start[1]);
  const lenR = Math.abs(end[0] - start[0]);
  const lenC = Math.abs(end[1] - start[1]);

  // Must be straight line (horizontal, vertical, or diagonal)
  if (lenR !== 0 && lenC !== 0 && lenR !== lenC) return [];

  const len = Math.max(lenR, lenC);
  const cells = [];
  for (let i = 0; i <= len; i++) {
    cells.push([start[0] + dr * i, start[1] + dc * i]);
  }
  return cells;
}

function getGridPos(e) {
  const rect = canvas.getBoundingClientRect();
  let x, y;
  if (e.touches) {
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return null;
  return [r, c];
}

function checkSelection(cells) {
  const selectedWord = cells.map(([r, c]) => grid[r][c]).join('');
  const reversedWord = [...selectedWord].reverse().join('');
  for (const pw of placedWords) {
    if (foundWords.has(pw.word)) continue;
    if (selectedWord === pw.word || reversedWord === pw.word) {
      foundWords.add(pw.word);
      foundLines.push({ cells: [...cells] });
      const li = document.querySelector(`[data-word="${pw.word}"]`);
      if (li) li.classList.add('found');
      if (foundWords.size === words.length) {
        setTimeout(onWin, 300);
      }
      return true;
    }
  }
  return false;
}

// Mouse events
canvas.addEventListener('mousedown', e => {
  const pos = getGridPos(e);
  if (!pos) return;
  selecting = true;
  selStart = pos;
  selEnd = pos;
  draw();
});
canvas.addEventListener('mousemove', e => {
  if (!selecting) return;
  const pos = getGridPos(e);
  if (pos) selEnd = pos;
  draw();
});
canvas.addEventListener('mouseup', () => {
  if (!selecting) return;
  selecting = false;
  if (selStart && selEnd) {
    const cells = getCellsBetween(selStart, selEnd);
    checkSelection(cells);
  }
  selStart = null;
  selEnd = null;
  draw();
});

// Touch events
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const pos = getGridPos(e);
  if (!pos) return;
  selecting = true;
  selStart = pos;
  selEnd = pos;
  draw();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!selecting) return;
  const pos = getGridPos(e);
  if (pos) selEnd = pos;
  draw();
}, { passive: false });
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (!selecting) return;
  selecting = false;
  if (selStart && selEnd) {
    const cells = getCellsBetween(selStart, selEnd);
    checkSelection(cells);
  }
  selStart = null;
  selEnd = null;
  draw();
});

// Timer
function startTimer() {
  startTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(s / 60);
    timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  }, 1000);
}

function getElapsed() {
  return Math.floor((Date.now() - startTime) / 1000);
}

function onWin() {
  clearInterval(timerInterval);
  const t = getElapsed();
  modalTitle.textContent = 'Parabéns!';
  modalMessage.textContent = `Você encontrou todas as ${words.length} palavras em ${Math.floor(t/60)}m ${t%60}s!`;
  modalOverlay.classList.add('active');
  saveGameStat(t);
}

async function saveGameStat(timeSec) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'wordsearch',
      result: 'win',
      moves: words.length,
      time_seconds: timeSec
    });
  } catch (e) { console.error(e); }
}

function renderWordList() {
  wordListEl.innerHTML = '';
  for (const w of words) {
    const li = document.createElement('li');
    li.textContent = w;
    li.dataset.word = w;
    wordListEl.appendChild(li);
  }
}

function newGame() {
  modalOverlay.classList.remove('active');
  foundWords.clear();
  foundLines = [];
  selecting = false;
  selStart = null;
  selEnd = null;
  generatePuzzle();
  initCanvas();
  renderWordList();
  draw();
  startTimer();
}

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-modal-new').addEventListener('click', newGame);

newGame();
