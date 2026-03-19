import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp } from '../shared/game-design-utils.js';
// =============================================
//  SOKOBAN — game.js
// =============================================
import { supabase } from '../../supabase.js';
// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

// =============================================
//  LEVELS (10 niveis classicos)
//  Legenda: # = parede, . = alvo, @ = jogador
//           $ = caixa, + = jogador em alvo
//           * = caixa em alvo, espaco = chao
//           - = vazio (fora do mapa)
// =============================================
const LEVELS = [
  // Nivel 1 — Simples intro
  [
    '------',
    '-####-',
    '-#.@#-',
    '-#$ #-',
    '-# .#-',
    '-# $#-',
    '-####-',
    '------',
  ],
  // Nivel 2
  [
    '--#####--',
    '--# . #--',
    '--# $ #--',
    '### $.###',
    '#  $@ . #',
    '#   #   #',
    '#########',
  ],
  // Nivel 3
  [
    '####--',
    '#  ###',
    '# $$ #',
    '#. . #',
    '# @  #',
    '######',
  ],
  // Nivel 4
  [
    '--####-',
    '###  #-',
    '#  $ #-',
    '#.#$ #-',
    '#. @ #-',
    '######-',
  ],
  // Nivel 5
  [
    '#####--',
    '#   ##-',
    '# $  #-',
    '##$ .#-',
    '-#  .#-',
    '-# @ #-',
    '-#####-',
  ],
  // Nivel 6
  [
    '---####',
    '####  #',
    '#  $  #',
    '# #$# #',
    '#. .@.#',
    '# $ # #',
    '#  $  #',
    '####..#',
    '---####',
  ],
  // Nivel 7
  [
    '-######-',
    '##    #-',
    '#  ## ##',
    '# $.$.@#',
    '# $.$.##',
    '###  #--',
    '--####--',
  ],
  // Nivel 8
  [
    '---#####',
    '---#   #',
    '---# $ #',
    '####.# #',
    '#  .$ @#',
    '# #.$ ##',
    '#   ###-',
    '#####---',
  ],
  // Nivel 9
  [
    '#######-',
    '#  .  ##',
    '# #$.$ #',
    '#   .# #',
    '###$ @ #',
    '--#  ###',
    '--####--',
  ],
  // Nivel 10
  [
    '--######-',
    '--#    #-',
    '###$$# #-',
    '# . .  ##',
    '# #$$ @ #',
    '# ...#  #',
    '####  ###',
    '---####--',
  ],
];

// Tile codes
const VOID   = 0;
const WALL   = 1;
const FLOOR  = 2;
const TARGET = 3;

// ---- DOM ----
const boardEl      = document.getElementById('board');
const overlay      = document.getElementById('overlay');
const overlayIcon  = document.getElementById('overlay-icon');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg   = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const btnStart     = document.getElementById('btn-start');
const btnUndo      = document.getElementById('btn-undo');
const btnRestart   = document.getElementById('btn-restart');
const levelDisplay = document.getElementById('level-display');
const movesDisplay = document.getElementById('moves-display');

// ---- State ----
let currentLevel = parseInt(localStorage.getItem('sokoban_level') || '0');
let grid     = [];  // 2D array of tile codes
let boxes    = [];  // [{r, c}, ...]
let player   = { r: 0, c: 0 };
let targets  = [];  // [{r, c}, ...]
let moves    = 0;
let history  = [];  // for undo: [{player, boxes, moves}]
let rows     = 0;
let cols     = 0;
let playing  = false;

// =============================================
//  PARSE LEVEL
// =============================================
function parseLevel(lvlIndex) {
  const raw = LEVELS[lvlIndex];
  rows = raw.length;
  cols = Math.max(...raw.map(r => r.length));

  grid    = [];
  boxes   = [];
  targets = [];
  player  = { r: 0, c: 0 };

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const ch = (raw[r][c] || '-');
      switch (ch) {
        case '#':
          grid[r][c] = WALL;
          break;
        case '.':
          grid[r][c] = TARGET;
          targets.push({ r, c });
          break;
        case '@':
          grid[r][c] = FLOOR;
          player = { r, c };
          break;
        case '$':
          grid[r][c] = FLOOR;
          boxes.push({ r, c });
          break;
        case '+': // player on target
          grid[r][c] = TARGET;
          player = { r, c };
          targets.push({ r, c });
          break;
        case '*': // box on target
          grid[r][c] = TARGET;
          boxes.push({ r, c });
          targets.push({ r, c });
          break;
        case ' ':
          grid[r][c] = FLOOR;
          break;
        case '-':
        default:
          grid[r][c] = VOID;
          break;
      }
    }
  }

  moves   = 0;
  history = [];
}

// =============================================
//  RENDER
// =============================================
function render() {
  // Calculate cell size based on available space
  const container = boardEl.parentElement;
  const maxW = container.clientWidth - 16;
  const maxH = container.clientHeight - 16;
  const cellW = Math.floor(maxW / cols);
  const cellH = Math.floor(maxH / rows);
  const cellSize = Math.min(cellW, cellH, 52);

  boardEl.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
  boardEl.style.gridTemplateRows    = `repeat(${rows}, ${cellSize}px)`;

  // Update font size based on cell size
  boardEl.style.fontSize = `${Math.max(cellSize * 0.6, 14)}px`;

  boardEl.innerHTML = '';

  const boxSet = new Set(boxes.map(b => `${b.r},${b.c}`));
  const targetSet = new Set(targets.map(t => `${t.r},${t.c}`));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.width  = cellSize + 'px';
      cell.style.height = cellSize + 'px';

      const tile    = grid[r][c];
      const isBox   = boxSet.has(`${r},${c}`);
      const isTarget= targetSet.has(`${r},${c}`);
      const isPlayer= (player.r === r && player.c === c);

      if (tile === VOID) {
        cell.classList.add('cell-void');
      } else if (tile === WALL) {
        cell.classList.add('cell-wall');
        cell.textContent = '🧱';
      } else if (isPlayer) {
        cell.classList.add(isTarget ? 'cell-player-on-target' : 'cell-player');
        cell.textContent = '🧑';
      } else if (isBox && isTarget) {
        cell.classList.add('cell-box-on-target');
        cell.textContent = '✅';
      } else if (isBox) {
        cell.classList.add('cell-box');
        cell.textContent = '📦';
      } else if (isTarget) {
        cell.classList.add('cell-target');
      } else {
        cell.classList.add('cell-floor');
      }

      boardEl.appendChild(cell);
    }
  }

  movesDisplay.textContent = moves;
  levelDisplay.textContent = currentLevel + 1;
}

// =============================================
//  GAME LOGIC
// =============================================
function tryMove(dr, dc) {
  if (!playing) return;

  const nr = player.r + dr;
  const nc = player.c + dc;

  // Out of bounds or wall
  if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
  if (grid[nr][nc] === WALL || grid[nr][nc] === VOID) return;

  const boxIdx = boxes.findIndex(b => b.r === nr && b.c === nc);

  if (boxIdx !== -1) {
    // There's a box — try to push it
    const br = nr + dr;
    const bc = nc + dc;

    // Can't push out of bounds, into wall, void, or another box
    if (br < 0 || br >= rows || bc < 0 || bc >= cols) return;
    if (grid[br][bc] === WALL || grid[br][bc] === VOID) return;
    if (boxes.some(b => b.r === br && b.c === bc)) return;

    // Save state for undo
    history.push({
      player: { ...player },
      boxes: boxes.map(b => ({ ...b })),
      moves: moves,
    });

    // Push box
    boxes[boxIdx] = { r: br, c: bc };
    player = { r: nr, c: nc };
    moves++;
    playSound('place'); // som ao empurrar caixa

    render();
    checkWin();
  } else {
    // Empty space — just move
    history.push({
      player: { ...player },
      boxes: boxes.map(b => ({ ...b })),
      moves: moves,
    });

    player = { r: nr, c: nc };
    moves++;
    playSound('move'); // som ao andar

    render();
  }
}

function checkWin() {
  const targetSet = new Set(targets.map(t => `${t.r},${t.c}`));
  const allOnTarget = boxes.every(b => targetSet.has(`${b.r},${b.c}`));

  if (!allOnTarget) return;

  playing = false;
  launchConfetti();
  playSound('win');
  saveGameStat();

  if (currentLevel < LEVELS.length - 1) {
    // Next level
    overlayIcon.textContent  = '🎉';
    overlayTitle.textContent = 'Nivel Completo!';
    overlayMsg.textContent   = `Nivel ${currentLevel + 1} finalizado!`;
    overlayScore.textContent = `Movimentos: ${moves}`;
    btnStart.textContent     = 'Proximo Nivel';
    currentLevel++;
    localStorage.setItem('sokoban_level', String(currentLevel));
  } else {
    // All levels complete
    overlayIcon.textContent  = '🏆';
    overlayTitle.textContent = 'Parabens!';
    overlayMsg.textContent   = 'Voce completou todos os niveis!';
    overlayScore.textContent = `Movimentos: ${moves}`;
    btnStart.textContent     = 'Jogar Novamente';
    currentLevel = 0;
    localStorage.setItem('sokoban_level', '0');
  }

  overlay.classList.remove('hidden');
}

function undo() {
  if (!playing || history.length === 0) return;
  const state = history.pop();
  player = state.player;
  boxes  = state.boxes;
  moves  = state.moves;
  render();
}

function restartLevel() {
  parseLevel(currentLevel);
  render();
  playing = true;
  overlay.classList.add('hidden');
}

function startLevel() {
  parseLevel(currentLevel);
  render();
  playing = true;
  overlay.classList.add('hidden');
  initAudio();
}

// =============================================
//  CONTROLS — Keyboard
// =============================================
document.addEventListener('keydown', e => {
  if (!playing) {
    if (e.key === 'Enter' || e.key === ' ') { startLevel(); e.preventDefault(); }
    return;
  }

  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': tryMove(-1, 0); break;
    case 'ArrowDown':  case 's': case 'S': tryMove(1,  0); break;
    case 'ArrowLeft':  case 'a': case 'A': tryMove(0, -1); break;
    case 'ArrowRight': case 'd': case 'D': tryMove(0,  1); break;
    case 'z': case 'Z': undo(); break;
  }
  e.preventDefault();
});

// =============================================
//  CONTROLS — Touch swipe
// =============================================
let touchStart = null;
document.addEventListener('touchstart', e => {
  // Don't capture touches on buttons
  if (e.target.closest('button') || e.target.closest('a')) return;
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!touchStart || !playing) return;
  if (e.target.closest('button') || e.target.closest('a')) return;

  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;

  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; // tap, not swipe

  if (Math.abs(dx) > Math.abs(dy)) {
    tryMove(0, dx > 0 ? 1 : -1);
  } else {
    tryMove(dy > 0 ? 1 : -1, 0);
  }
}, { passive: true });

// =============================================
//  CONTROLS — Mobile buttons
// =============================================
document.querySelectorAll('.ctrl-btn').forEach(btn => {
  const handler = () => {
    if (!playing) return;
    switch (btn.dataset.dir) {
      case 'up':    tryMove(-1, 0); break;
      case 'down':  tryMove(1,  0); break;
      case 'left':  tryMove(0, -1); break;
      case 'right': tryMove(0,  1); break;
    }
  };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', e => { e.preventDefault(); handler(); }, { passive: false });
});

// =============================================
//  BUTTONS
// =============================================
btnStart.addEventListener('click', startLevel);
btnUndo.addEventListener('click', undo);
btnRestart.addEventListener('click', restartLevel);
document.getElementById('btn-share')?.addEventListener('click', () => {
  shareOnWhatsApp(`🎉 Completei o nível ${currentLevel + 1} do Sokoban no Games Hub! Venha jogar tambem: https://gameshub.com.br/games/sokoban/`);
});

// =============================================
//  RESIZE
// =============================================
window.addEventListener('resize', () => {
  if (playing) render();
});

// =============================================
//  STATS — Supabase
// =============================================
async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'sokoban',
      result: 'win',
      moves: moves,
      time_seconds: 0,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// =============================================
//  INIT
// =============================================
parseLevel(currentLevel);
render();
