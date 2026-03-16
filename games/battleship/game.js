// =============================================
//  Batalha Naval — Games Hub
// =============================================
import { supabase } from '../../supabase.js';

const ROWS = 10;
const COLS = 10;
const ROW_LABELS = ['A','B','C','D','E','F','G','H','I','J'];
const COL_LABELS = ['1','2','3','4','5','6','7','8','9','10'];

const SHIPS = [
  { name: 'Porta-avioes', size: 5 },
  { name: 'Encouracado',  size: 4 },
  { name: 'Cruzador',     size: 3 },
  { name: 'Submarino',    size: 3 },
  { name: 'Destroyer',    size: 2 },
];

// ===== DOM =====
const turnIndicator   = document.getElementById('turn-indicator');
const placementPanel  = document.getElementById('placement-panel');
const battlePanel     = document.getElementById('battle-panel');
const placementGrid   = document.getElementById('placement-grid');
const playerGrid      = document.getElementById('player-grid');
const enemyGrid       = document.getElementById('enemy-grid');
const shipNameEl      = document.getElementById('placement-ship-name');
const btnRotate       = document.getElementById('btn-rotate');
const btnRandom       = document.getElementById('btn-random');
const btnStart        = document.getElementById('btn-start');
const btnPlayAgain    = document.getElementById('btn-play-again');
const modalOverlay    = document.getElementById('modal-overlay');
const modalIcon       = document.getElementById('modal-icon');
const modalTitle      = document.getElementById('modal-title');
const modalMsg        = document.getElementById('modal-msg');
const shipStatusEl    = document.getElementById('ship-status');
const playerShipsEl   = document.getElementById('player-ships');
const cpuShipsEl      = document.getElementById('cpu-ships');
const timerDisplay    = document.getElementById('timer-display');

// ===== STATE =====
let playerBoard, cpuBoard;
let playerShips, cpuShips;
let orientation = 'H'; // H or V
let currentShipIdx = 0;
let phase = 'placement'; // placement | battle | ended
let playerTurn = true;
let timerInterval = null;
let seconds = 0;

// CPU AI state
let cpuMode = 'random'; // random | hunt
let cpuHits = [];        // hits not yet sunk
let cpuTargets = [];     // queue of cells to try next

// ===== INIT =====
function init() {
  stopTimer();
  seconds = 0;
  updateTimer();
  phase = 'placement';
  orientation = 'H';
  currentShipIdx = 0;
  playerTurn = true;
  cpuMode = 'random';
  cpuHits = [];
  cpuTargets = [];

  playerBoard = createBoard();
  cpuBoard = createBoard();
  playerShips = SHIPS.map(s => ({ ...s, cells: [], sunk: false }));
  cpuShips = SHIPS.map(s => ({ ...s, cells: [], sunk: false }));

  placementPanel.classList.remove('hidden');
  battlePanel.classList.add('hidden');
  modalOverlay.classList.add('hidden');
  btnStart.classList.add('hidden');
  btnRotate.textContent = 'Girar (H)';
  turnIndicator.textContent = 'Posicione seus navios';
  turnIndicator.classList.remove('enemy-turn');

  playerShipsEl.textContent = '5';
  cpuShipsEl.textContent = '5';

  buildGrid(placementGrid, 'placement');
  buildHeaders('placement');
  updatePlacementInfo();
}

function createBoard() {
  // 0=empty, 1=ship, 2=miss, 3=hit
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// ===== GRID BUILDERS =====
function buildHeaders(prefix) {
  const colH = document.getElementById(`${prefix}-col-headers`);
  const rowH = document.getElementById(`${prefix}-row-headers`);
  colH.innerHTML = '';
  rowH.innerHTML = '';
  COL_LABELS.forEach(c => {
    const s = document.createElement('span');
    s.textContent = c;
    colH.appendChild(s);
  });
  ROW_LABELS.forEach(r => {
    const s = document.createElement('span');
    s.textContent = r;
    rowH.appendChild(s);
  });
}

function buildGrid(container, type) {
  container.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (type === 'placement') {
        cell.addEventListener('click', () => placeShip(r, c));
        cell.addEventListener('mouseenter', () => previewShip(r, c));
        cell.addEventListener('mouseleave', clearPreview);
      } else if (type === 'enemy') {
        cell.addEventListener('click', () => fireAt(r, c));
      }

      container.appendChild(cell);
    }
  }
}

function getCell(grid, r, c) {
  return grid.children[r * COLS + c];
}

// ===== PLACEMENT =====
function updatePlacementInfo() {
  if (currentShipIdx < SHIPS.length) {
    const s = SHIPS[currentShipIdx];
    shipNameEl.textContent = `${s.name} (${s.size} casas)`;
  } else {
    shipNameEl.textContent = 'Todos os navios posicionados!';
  }
}

function getShipCells(r, c, size, dir) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    const nr = dir === 'V' ? r + i : r;
    const nc = dir === 'H' ? c + i : c;
    cells.push([nr, nc]);
  }
  return cells;
}

function canPlace(board, cells) {
  return cells.every(([r, c]) =>
    r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === 0
  );
}

function previewShip(r, c) {
  if (currentShipIdx >= SHIPS.length) return;
  clearPreview();
  const cells = getShipCells(r, c, SHIPS[currentShipIdx].size, orientation);
  const valid = canPlace(playerBoard, cells);
  cells.forEach(([nr, nc]) => {
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      const el = getCell(placementGrid, nr, nc);
      el.classList.add(valid ? 'preview' : 'preview-invalid');
    }
  });
}

function clearPreview() {
  placementGrid.querySelectorAll('.preview, .preview-invalid').forEach(el => {
    el.classList.remove('preview', 'preview-invalid');
  });
}

function placeShip(r, c) {
  if (currentShipIdx >= SHIPS.length) return;
  const ship = playerShips[currentShipIdx];
  const cells = getShipCells(r, c, ship.size, orientation);
  if (!canPlace(playerBoard, cells)) return;

  cells.forEach(([nr, nc]) => {
    playerBoard[nr][nc] = 1;
    getCell(placementGrid, nr, nc).classList.add('ship');
  });
  ship.cells = cells;
  currentShipIdx++;
  updatePlacementInfo();

  if (currentShipIdx >= SHIPS.length) {
    btnStart.classList.remove('hidden');
  }
}

function randomPlacement(board, ships) {
  // Reset board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      board[r][c] = 0;

  ships.forEach(ship => {
    let placed = false;
    while (!placed) {
      const dir = Math.random() < 0.5 ? 'H' : 'V';
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      const cells = getShipCells(r, c, ship.size, dir);
      if (canPlace(board, cells)) {
        cells.forEach(([nr, nc]) => { board[nr][nc] = 1; });
        ship.cells = cells;
        placed = true;
      }
    }
  });
}

btnRotate.addEventListener('click', () => {
  orientation = orientation === 'H' ? 'V' : 'H';
  btnRotate.textContent = `Girar (${orientation})`;
});

btnRandom.addEventListener('click', () => {
  randomPlacement(playerBoard, playerShips);
  currentShipIdx = SHIPS.length;
  renderPlacementBoard();
  updatePlacementInfo();
  btnStart.classList.remove('hidden');
});

function renderPlacementBoard() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const el = getCell(placementGrid, r, c);
      el.className = 'cell';
      if (playerBoard[r][c] === 1) el.classList.add('ship');
    }
  }
}

// ===== START BATTLE =====
btnStart.addEventListener('click', startBattle);

function startBattle() {
  // Place CPU ships
  randomPlacement(cpuBoard, cpuShips);

  // Build battle grids
  buildGrid(playerGrid, 'player');
  buildGrid(enemyGrid, 'enemy');
  buildHeaders('player');
  buildHeaders('enemy');

  // Show player ships on player grid
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (playerBoard[r][c] === 1) {
        getCell(playerGrid, r, c).classList.add('ship');
      }
    }
  }

  placementPanel.classList.add('hidden');
  battlePanel.classList.remove('hidden');

  phase = 'battle';
  playerTurn = true;
  turnIndicator.textContent = 'Seu turno — ataque!';
  turnIndicator.classList.remove('enemy-turn');

  renderShipStatus();
  startTimer();
}

// ===== TIMER =====
function startTimer() {
  seconds = 0;
  updateTimer();
  timerInterval = setInterval(() => { seconds++; updateTimer(); }, 1000);
}
function stopTimer() { clearInterval(timerInterval); }
function updateTimer() {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  timerDisplay.textContent = `${m}:${s}`;
}

// ===== SHIP STATUS =====
function renderShipStatus() {
  shipStatusEl.innerHTML = '';
  playerShips.forEach(s => {
    shipStatusEl.appendChild(createShipCard(s, 'player-card'));
  });
  cpuShips.forEach(s => {
    shipStatusEl.appendChild(createShipCard(s, 'enemy-card'));
  });
}

function createShipCard(ship, cls) {
  const card = document.createElement('div');
  card.className = `ship-card ${cls}${ship.sunk ? ' sunk-card' : ''}`;
  const dots = document.createElement('div');
  dots.className = 'ship-dots';
  for (let i = 0; i < ship.size; i++) {
    const d = document.createElement('div');
    d.className = 'ship-dot';
    dots.appendChild(d);
  }
  card.appendChild(dots);
  const label = document.createElement('span');
  label.textContent = ship.name;
  card.appendChild(label);
  return card;
}

// ===== FIRING =====
function fireAt(r, c) {
  if (phase !== 'battle' || !playerTurn) return;
  const cell = getCell(enemyGrid, r, c);
  if (cell.classList.contains('hit') || cell.classList.contains('miss') || cell.classList.contains('sunk')) return;

  playerTurn = false;

  if (cpuBoard[r][c] === 1) {
    cpuBoard[r][c] = 3; // hit
    cell.classList.add('hit');
    cell.textContent = '●';
    checkSunk(cpuShips, cpuBoard, enemyGrid);
  } else {
    cpuBoard[r][c] = 2; // miss
    cell.classList.add('miss');
    cell.textContent = '•';
  }

  updateCounters();

  if (checkWin()) return;

  turnIndicator.textContent = 'Turno do inimigo...';
  turnIndicator.classList.add('enemy-turn');

  setTimeout(cpuTurn, 600);
}

function cpuTurn() {
  if (phase !== 'battle') return;

  let r, c;

  // Try targets from hunt mode first
  while (cpuTargets.length > 0) {
    const t = cpuTargets.shift();
    if (playerBoard[t[0]][t[1]] === 0 || playerBoard[t[0]][t[1]] === 1) {
      r = t[0];
      c = t[1];
      break;
    }
  }

  // Random if no valid target
  if (r === undefined) {
    cpuMode = 'random';
    do {
      r = Math.floor(Math.random() * ROWS);
      c = Math.floor(Math.random() * COLS);
    } while (playerBoard[r][c] === 2 || playerBoard[r][c] === 3);
  }

  const cell = getCell(playerGrid, r, c);

  if (playerBoard[r][c] === 1) {
    playerBoard[r][c] = 3;
    cell.classList.remove('ship');
    cell.classList.add('hit');
    cell.textContent = '●';

    cpuHits.push([r, c]);
    cpuMode = 'hunt';
    addAdjacentTargets(r, c);

    // Check if a ship was sunk => remove those hits and clear targets for that ship
    const sunkShip = checkSunkCpu(playerShips, playerBoard, playerGrid);
    if (sunkShip) {
      // Remove sunk ship cells from cpuHits
      cpuHits = cpuHits.filter(([hr, hc]) =>
        !sunkShip.cells.some(([sr, sc]) => sr === hr && sc === hc)
      );
      // If no more hits pending, go back to random
      if (cpuHits.length === 0) {
        cpuMode = 'random';
        cpuTargets = [];
      }
    }
  } else {
    playerBoard[r][c] = 2;
    cell.classList.add('miss');
    cell.textContent = '•';
  }

  updateCounters();

  if (checkWin()) return;

  playerTurn = true;
  turnIndicator.textContent = 'Seu turno — ataque!';
  turnIndicator.classList.remove('enemy-turn');
}

function addAdjacentTargets(r, c) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  dirs.forEach(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      if (playerBoard[nr][nc] === 0 || playerBoard[nr][nc] === 1) {
        // Avoid duplicates
        if (!cpuTargets.some(([tr, tc]) => tr === nr && tc === nc)) {
          cpuTargets.push([nr, nc]);
        }
      }
    }
  });
}

// ===== SUNK CHECK =====
function checkSunk(ships, board, grid) {
  ships.forEach(ship => {
    if (ship.sunk) return;
    if (ship.cells.every(([r, c]) => board[r][c] === 3)) {
      ship.sunk = true;
      ship.cells.forEach(([r, c]) => {
        const cell = getCell(grid, r, c);
        cell.classList.remove('hit');
        cell.classList.add('sunk');
        cell.textContent = '✕';
      });
    }
  });
  renderShipStatus();
}

function checkSunkCpu(ships, board, grid) {
  let sunkShip = null;
  ships.forEach(ship => {
    if (ship.sunk) return;
    if (ship.cells.every(([r, c]) => board[r][c] === 3)) {
      ship.sunk = true;
      sunkShip = ship;
      ship.cells.forEach(([r, c]) => {
        const cell = getCell(grid, r, c);
        cell.classList.remove('hit', 'ship');
        cell.classList.add('sunk');
        cell.textContent = '✕';
      });
    }
  });
  renderShipStatus();
  return sunkShip;
}

function updateCounters() {
  playerShipsEl.textContent = playerShips.filter(s => !s.sunk).length;
  cpuShipsEl.textContent = cpuShips.filter(s => !s.sunk).length;
}

// ===== WIN CHECK =====
function checkWin() {
  const playerLost = playerShips.every(s => s.sunk);
  const cpuLost = cpuShips.every(s => s.sunk);

  if (playerLost || cpuLost) {
    phase = 'ended';
    stopTimer();

    const won = cpuLost;
    modalIcon.textContent = won ? '🏆' : '💥';
    modalTitle.textContent = won ? 'Vitoria!' : 'Derrota!';
    modalMsg.textContent = won
      ? `Voce afundou toda a frota inimiga em ${timerDisplay.textContent}!`
      : 'A frota inimiga destruiu todos os seus navios.';
    modalOverlay.classList.remove('hidden');

    turnIndicator.textContent = won ? 'Voce venceu!' : 'Voce perdeu!';

    saveStats(won ? 'win' : 'loss');
    return true;
  }
  return false;
}

// ===== STATS =====
async function saveStats(result) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('game_stats').insert({
      user_id: user.id,
      game: 'battleship',
      result,
      duration_seconds: seconds,
    });
  } catch (e) {
    console.warn('Stats save failed:', e);
  }
}

// ===== PLAY AGAIN =====
btnPlayAgain.addEventListener('click', () => {
  init();
});

// ===== START =====
init();
