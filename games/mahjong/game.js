import { supabase } from '../../supabase.js';

// ===== TILE TYPES (emoji-based) =====
const TILE_FACES = [
  '🀇','🀈','🀉','🀊','🀋','🀌','🀍','🀎','🀏', // Characters 1-9
  '🀙','🀚','🀛','🀜','🀝','🀞','🀟','🀠','🀡', // Dots 1-9
  '🀀','🀁','🀂','🀃',                              // Winds
  '🀄','🀅','🀆',                                    // Dragons
  '🌸','🌺','🌻','🌼','🎋','🎍','🎑','🎃',        // Flowers/Seasons (unique pairs)
  '🔴','🔵','🟢','🟡',                              // Bonus
];

// ===== LAYOUT: simplified turtle formation =====
// Each entry: [row, col, layer] — we build a pyramid-like layout
function buildLayout() {
  const positions = [];

  // Layer 0: 12x8 base with gaps
  const basePattern = [
    [1,0],[1,1],[1,2],[1,3],[1,4],[1,5],[1,6],[1,7],[1,8],[1,9],[1,10],[1,11],
    [2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[2,7],[2,8],[2,9],[2,10],[2,11],
    [3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],
    [4,1],[4,2],[4,3],[4,4],[4,5],[4,6],[4,7],[4,8],[4,9],[4,10],
    [5,1],[5,2],[5,3],[5,4],[5,5],[5,6],[5,7],[5,8],[5,9],[5,10],
    [6,1],[6,2],[6,3],[6,4],[6,5],[6,6],[6,7],[6,8],[6,9],[6,10],
    [0,4],[0,5],[0,6],[0,7],
    [7,4],[7,5],[7,6],[7,7],
    [3,0],[4,0],[5,0],[6,0],  // left wing
    [3,11],[4,11],[5,11],[6,11], // right wing
  ];
  basePattern.forEach(([r, c]) => positions.push({ r, c, l: 0 }));

  // Layer 1: 8x4 center
  for (let r = 2; r <= 5; r++) {
    for (let c = 3; c <= 8; c++) {
      positions.push({ r, c, l: 1 });
    }
  }

  // Layer 2: 4x2 center
  for (let r = 3; r <= 4; r++) {
    for (let c = 4; c <= 7; c++) {
      positions.push({ r, c, l: 2 });
    }
  }

  // Layer 3: 2x1 top
  positions.push({ r: 3, c: 5, l: 3 });
  positions.push({ r: 3, c: 6, l: 3 });
  positions.push({ r: 4, c: 5, l: 3 });
  positions.push({ r: 4, c: 6, l: 3 });

  // Layer 4: 1 cap
  positions.push({ r: 3, c: 5, l: 4 });
  positions.push({ r: 4, c: 6, l: 4 });

  return positions;
}

// ===== STATE =====
let tiles = [];
let selectedTile = null;
let timerSeconds = 0;
let timerInterval = null;
let startTime = null;
let gameOver = false;
let hintTiles = [];

const boardEl = document.getElementById('mahjong-board');
const tilesLeftEl = document.getElementById('tiles-left');
const timerEl = document.getElementById('timer-display');
const modalEl = document.getElementById('modal');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const modalStats = document.getElementById('modal-stats');

// ===== TILE SIZE (responsive) =====
function getTileSize() {
  const w = window.innerWidth;
  if (w <= 360) return { tw: 26, th: 36 };
  if (w <= 480) return { tw: 32, th: 42 };
  return { tw: 40, th: 52 };
}

// ===== GAME LOGIC =====
function isFree(tile) {
  if (tile.removed) return false;
  // Check if blocked on left AND right
  const leftBlocked = tiles.some(t => !t.removed && t.l === tile.l && t.r === tile.r && t.c === tile.c - 1);
  const rightBlocked = tiles.some(t => !t.removed && t.l === tile.l && t.r === tile.r && t.c === tile.c + 1);
  if (leftBlocked && rightBlocked) return false;

  // Check if tile on top
  const topBlocked = tiles.some(t => !t.removed && t.l === tile.l + 1 &&
    Math.abs(t.r - tile.r) <= 1 && Math.abs(t.c - tile.c) <= 1);
  if (topBlocked) return false;

  return true;
}

function findPairs() {
  const freeTiles = tiles.filter(t => !t.removed && isFree(t));
  const pairs = [];
  for (let i = 0; i < freeTiles.length; i++) {
    for (let j = i + 1; j < freeTiles.length; j++) {
      if (freeTiles[i].face === freeTiles[j].face) {
        pairs.push([freeTiles[i], freeTiles[j]]);
      }
    }
  }
  return pairs;
}

function shuffleTiles() {
  const remaining = tiles.filter(t => !t.removed);
  const faces = remaining.map(t => t.face);
  // Fisher-Yates shuffle
  for (let i = faces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [faces[i], faces[j]] = [faces[j], faces[i]];
  }
  remaining.forEach((t, i) => { t.face = faces[i]; });
  selectedTile = null;
  hintTiles = [];
  renderBoard();
}

// ===== RENDER =====
function renderBoard() {
  const { tw, th } = getTileSize();
  const layerOffset = 4;

  // Calculate board dimensions
  let maxR = 0, maxC = 0;
  tiles.forEach(t => { if (!t.removed) { maxR = Math.max(maxR, t.r); maxC = Math.max(maxC, t.c); } });

  boardEl.style.width = `${(maxC + 1) * (tw + 2) + 30}px`;
  boardEl.style.height = `${(maxR + 1) * (th + 2) + 30}px`;
  boardEl.innerHTML = '';

  // Sort: lower layers first so higher layers render on top
  const sorted = [...tiles].filter(t => !t.removed).sort((a, b) => a.l - b.l);

  sorted.forEach(tile => {
    const el = document.createElement('div');
    el.className = 'mj-tile';
    el.dataset.layer = tile.l;
    el.textContent = tile.face;

    const x = tile.c * (tw + 2) + tile.l * layerOffset;
    const y = tile.r * (th + 2) - tile.l * layerOffset;
    el.style.left = `${x}px`;
    el.style.top = `${y + 15}px`;
    el.style.zIndex = tile.l * 100 + tile.r * 10 + tile.c;
    el.style.width = `${tw}px`;
    el.style.height = `${th}px`;

    const free = isFree(tile);
    if (!free) el.classList.add('blocked');
    if (selectedTile === tile) el.classList.add('selected');
    if (hintTiles.includes(tile)) el.classList.add('hint');

    el.addEventListener('click', () => onTileClick(tile));
    boardEl.appendChild(el);
  });

  const remaining = tiles.filter(t => !t.removed).length;
  tilesLeftEl.textContent = remaining;
}

function onTileClick(tile) {
  if (gameOver || tile.removed || !isFree(tile)) return;
  if (!startTime) startTimer();

  hintTiles = [];

  if (!selectedTile) {
    selectedTile = tile;
    renderBoard();
    return;
  }

  if (selectedTile === tile) {
    selectedTile = null;
    renderBoard();
    return;
  }

  if (selectedTile.face === tile.face) {
    // Match!
    selectedTile.removed = true;
    tile.removed = true;
    selectedTile = null;
    renderBoard();
    checkEndCondition();
  } else {
    selectedTile = tile;
    renderBoard();
  }
}

function checkEndCondition() {
  const remaining = tiles.filter(t => !t.removed).length;
  if (remaining === 0) {
    gameOver = true;
    stopTimer();
    modalIcon.textContent = '🏆';
    modalTitle.textContent = 'Parabens!';
    modalMsg.textContent = 'Voce removeu todas as pecas!';
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    modalStats.textContent = `Tempo: ${m}:${s.toString().padStart(2, '0')}`;
    modalEl.classList.remove('hidden');
    saveStats('win');
    return;
  }

  const pairs = findPairs();
  if (pairs.length === 0) {
    gameOver = true;
    stopTimer();
    modalIcon.textContent = '😔';
    modalTitle.textContent = 'Sem movimentos!';
    modalMsg.textContent = 'Nao ha mais pares disponiveis.';
    modalStats.textContent = `Pecas restantes: ${remaining}`;
    modalEl.classList.remove('hidden');
    saveStats('loss');
  }
}

// ===== HINT =====
function showHint() {
  if (gameOver) return;
  const pairs = findPairs();
  if (pairs.length > 0) {
    hintTiles = pairs[0];
    renderBoard();
    setTimeout(() => { hintTiles = []; renderBoard(); }, 2000);
  }
}

// ===== TIMER =====
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    timerSeconds = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}
function stopTimer() { clearInterval(timerInterval); }

// ===== STATS =====
async function saveStats(result) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('game_stats').insert({
      user_id: user.id, game: 'mahjong', result, moves: 0, time_seconds: timerSeconds
    });
  } catch (e) { console.log('Stats save error:', e); }
}

// ===== INIT =====
function newGame() {
  gameOver = false;
  stopTimer();
  startTime = null;
  timerSeconds = 0;
  timerEl.textContent = '0:00';
  selectedTile = null;
  hintTiles = [];

  const layout = buildLayout();
  // We need pairs, so total tiles must be even. Trim if needed.
  const totalPositions = layout.length;
  const usablePositions = totalPositions % 2 === 0 ? totalPositions : totalPositions - 1;
  const positions = layout.slice(0, usablePositions);

  // Create face pairs
  const numPairs = positions.length / 2;
  const faces = [];
  for (let i = 0; i < numPairs; i++) {
    const face = TILE_FACES[i % TILE_FACES.length];
    faces.push(face, face);
  }
  // Shuffle faces
  for (let i = faces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [faces[i], faces[j]] = [faces[j], faces[i]];
  }

  tiles = positions.map((pos, i) => ({
    id: i, r: pos.r, c: pos.c, l: pos.l, face: faces[i], removed: false
  }));

  tilesLeftEl.textContent = tiles.length;
  renderBoard();
}

// ===== EVENTS =====
document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-modal-new').addEventListener('click', () => { modalEl.classList.add('hidden'); newGame(); });
document.getElementById('btn-hint').addEventListener('click', showHint);
document.getElementById('btn-shuffle').addEventListener('click', shuffleTiles);
window.addEventListener('resize', () => { if (!gameOver) renderBoard(); });

newGame();
