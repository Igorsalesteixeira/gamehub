import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameTimer } from '../shared/timer.js';
import { supabase } from '../../supabase.js';

// =============================================
//  Batalha Naval — Games Hub
//  Single Player + Multiplayer Online
// =============================================

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

// ===== MULTIPLAYER CONFIG =====
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
const IS_MULTIPLAYER = !!ROOM_ID;

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
const modeSelection   = document.getElementById('mode-selection');
const mpControls      = document.getElementById('mp-controls');
const mpStatus        = document.getElementById('mp-status');
const btnCopyLink     = document.getElementById('btn-copy-link');

// ===== SHARED MODULES =====
const gameStats = new GameStats('battleship', { autoSync: true });
const gameTimer = new GameTimer({
  onTick: (time) => {
    timerDisplay.textContent = gameTimer.getFormatted('MM:SS');
  }
});

// ===== STATE =====
let playerBoard, cpuBoard;
let playerShips, cpuShips;
let orientation = 'H';
let currentShipIdx = 0;
let phase = 'menu'; // menu | placement | battle | ended
let playerTurn = true;
let isProcessing = false;

// CPU AI state (single player)
let cpuMode = 'random';
let cpuHits = [];
let cpuTargets = [];

// Multiplayer state
let mpPlayerId = null;
let mpPlayerNumber = null;
let mpOpponentReady = false;
let mpPlayerReady = false;
let mpSubscription = null;
let mpGameState = null;

// ===== INIT =====
function init() {
  gameTimer.stop().reset();
  timerDisplay.textContent = '00:00';
  phase = IS_MULTIPLAYER ? 'placement' : 'menu';
  orientation = 'H';
  currentShipIdx = 0;
  playerTurn = true;
  isProcessing = false;
  cpuMode = 'random';
  cpuHits = [];
  cpuTargets = [];

  playerBoard = createBoard();
  cpuBoard = createBoard();
  playerShips = SHIPS.map(s => ({ ...s, cells: [], sunk: false }));
  cpuShips = SHIPS.map(s => ({ ...s, cells: [], sunk: false }));

  placementPanel.classList.add('hidden');
  battlePanel.classList.add('hidden');
  modalOverlay.classList.remove('show');
  btnStart.classList.add('hidden');
  btnRotate.textContent = 'Girar (H)';

  playerShipsEl.textContent = '5';
  cpuShipsEl.textContent = '5';

  if (IS_MULTIPLAYER) {
    modeSelection.classList.add('hidden');
    mpControls.classList.remove('hidden');
    initMultiplayer();
  } else {
    modeSelection.classList.remove('hidden');
    mpControls.classList.add('hidden');
    turnIndicator.textContent = 'Escolha o modo de jogo';
  }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// ===== MODE SELECTION =====
document.getElementById('btn-single').addEventListener('click', () => {
  initAudio();
  playSound('click');
  startSinglePlayer();
});

document.getElementById('btn-multi').addEventListener('click', () => {
  initAudio();
  playSound('click');
  startMultiplayerSetup();
});

function startSinglePlayer() {
  modeSelection.classList.add('hidden');
  placementPanel.classList.remove('hidden');
  turnIndicator.textContent = 'Posicione seus navios';
  turnIndicator.classList.remove('enemy-turn');

  buildGrid(placementGrid, 'placement');
  buildHeaders('placement');
  updatePlacementInfo();
  phase = 'placement';
}

function startMultiplayerSetup() {
  const newRoomId = crypto.randomUUID();
  window.location.href = `index.html?room=${newRoomId}`;
}

// ===== MULTIPLAYER FUNCTIONS =====
async function initMultiplayer() {
  turnIndicator.textContent = 'Conectando a sala...';

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Voce precisa estar logado para jogar multiplayer');
    window.location.href = '../../login.html?redirect=' + encodeURIComponent(window.location.href);
    return;
  }

  mpPlayerId = user.id;

  // Check if room exists
  const { data: room, error } = await supabase
    .from('battleship_rooms')
    .select('*')
    .eq('id', ROOM_ID)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching room:', error);
    console.error('Error details:', JSON.stringify(error));
    turnIndicator.textContent = 'Erro ao conectar: ' + (error.message || error.code || 'desconhecido');
    return;
  }

  if (!room) {
    // Create new room as player 1 (host)
    mpPlayerNumber = 1;
    const { error: createError } = await supabase
      .from('battleship_rooms')
      .insert({
        id: ROOM_ID,
        player1_id: mpPlayerId,
        status: 'waiting',
        current_turn: 1,
        player1_board: null,
        player2_board: null,
        player1_shots: [],
        player2_shots: [],
        player1_ready: false,
        player2_ready: false,
        created_at: new Date().toISOString()
      });

    if (createError) {
      console.error('Error creating room:', createError);
      console.error('Create error details:', JSON.stringify(createError));
      turnIndicator.textContent = 'Erro ao criar sala: ' + (createError.message || createError.code || 'desconhecido');
      return;
    }

    mpStatus.textContent = 'Aguardando oponente...';
    mpStatus.classList.add('waiting');
    turnIndicator.textContent = 'Aguardando oponente...';
    placementPanel.classList.remove('hidden');
    buildGrid(placementGrid, 'placement');
    buildHeaders('placement');
    updatePlacementInfo();
  } else if (!room.player2_id && room.player1_id !== mpPlayerId) {
    // Join as player 2
    mpPlayerNumber = 2;
    const { error: updateError } = await supabase
      .from('battleship_rooms')
      .update({
        player2_id: mpPlayerId,
        status: 'placement'
      })
      .eq('id', ROOM_ID);

    if (updateError) {
      console.error('Error joining room:', updateError);
      turnIndicator.textContent = 'Erro ao entrar na sala';
      return;
    }

    mpStatus.textContent = 'Modo Multiplayer';
    mpStatus.classList.remove('waiting');
    turnIndicator.textContent = 'Posicione seus navios';
    placementPanel.classList.remove('hidden');
    buildGrid(placementGrid, 'placement');
    buildHeaders('placement');
    updatePlacementInfo();
  } else if (room.player1_id === mpPlayerId) {
    // Reconnect as player 1
    mpPlayerNumber = 1;
    mpGameState = room;
    restoreGameState(room);
  } else if (room.player2_id === mpPlayerId) {
    // Reconnect as player 2
    mpPlayerNumber = 2;
    mpGameState = room;
    restoreGameState(room);
  } else {
    alert('Sala cheia');
    window.location.href = 'index.html';
    return;
  }

  subscribeToRoom();
}

function restoreGameState(room) {
  if (room.status === 'waiting') {
    mpStatus.textContent = 'Aguardando oponente...';
    mpStatus.classList.add('waiting');
    turnIndicator.textContent = 'Aguardando oponente...';
    placementPanel.classList.remove('hidden');
    buildGrid(placementGrid, 'placement');
    buildHeaders('placement');
    updatePlacementInfo();
  } else if (room.status === 'placement') {
    mpStatus.textContent = 'Modo Multiplayer';
    mpStatus.classList.remove('waiting');
    turnIndicator.textContent = 'Posicione seus navios';
    placementPanel.classList.remove('hidden');
    buildGrid(placementGrid, 'placement');
    buildHeaders('placement');
    updatePlacementInfo();
  } else if (room.status === 'battle') {
    // Restore boards
    const myBoardKey = mpPlayerNumber === 1 ? 'player1_board' : 'player2_board';
    const opponentBoardKey = mpPlayerNumber === 1 ? 'player2_board' : 'player1_board';

    if (room[myBoardKey]) {
      playerBoard = room[myBoardKey];
      restoreShipsFromBoard(playerBoard, playerShips);
    }

    if (room[opponentBoardKey]) {
      cpuBoard = room[opponentBoardKey];
      restoreShipsFromBoard(cpuBoard, cpuShips);
    }

    // Restore shots
    const myShotsKey = mpPlayerNumber === 1 ? 'player1_shots' : 'player2_shots';
    const opponentShotsKey = mpPlayerNumber === 1 ? 'player2_shots' : 'player1_shots';

    // Build battle grids first
    placementPanel.classList.add('hidden');
    battlePanel.classList.remove('hidden');
    buildGrid(playerGrid, 'player');
    buildGrid(enemyGrid, 'enemy');
    buildHeaders('player');
    buildHeaders('enemy');

    if (room[myShotsKey]) {
      applyShotsToBoard(room[myShotsKey], cpuBoard, enemyGrid, false);
    }
    if (room[opponentShotsKey]) {
      applyShotsToBoard(room[opponentShotsKey], playerBoard, playerGrid, true);
    }

    renderPlayerShips();
    phase = 'battle';
    gameTimer.start();
    updateMultiplayerTurn(room.current_turn);
    renderShipStatus();
    updateCounters();
  } else if (room.status === 'ended') {
    showEndGameModal(room.winner === mpPlayerNumber);
  }
}

function restoreShipsFromBoard(board, ships) {
  ships.forEach(s => s.cells = []);
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === 1 && !visited[r][c]) {
        const shipCells = [];
        const queue = [[r, c]];
        visited[r][c] = true;

        while (queue.length > 0) {
          const [cr, cc] = queue.shift();
          shipCells.push([cr, cc]);
          const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          for (const [dr, dc] of dirs) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS &&
                board[nr][nc] === 1 && !visited[nr][nc]) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }

        const size = shipCells.length;
        const ship = ships.find(s => s.size === size && s.cells.length === 0);
        if (ship) ship.cells = shipCells;
      }
    }
  }
}

function applyShotsToBoard(shots, board, grid, isPlayerBoard) {
  if (!shots) return;
  shots.forEach(shot => {
    const { r, c, result } = shot;
    if (result === 'hit') {
      board[r][c] = 3;
      if (grid) {
        const cell = getCell(grid, r, c);
        cell.classList.add('hit');
        cell.textContent = '●';
      }
    } else if (result === 'miss') {
      board[r][c] = 2;
      if (grid) {
        const cell = getCell(grid, r, c);
        cell.classList.add('miss');
        cell.textContent = '•';
      }
    } else if (result === 'sunk') {
      board[r][c] = 3;
      if (grid) {
        const cell = getCell(grid, r, c);
        cell.classList.remove('hit', 'ship');
        cell.classList.add('sunk');
        cell.textContent = '✕';
      }
    }
  });
}

function subscribeToRoom() {
  mpSubscription = supabase
    .channel(`battleship:${ROOM_ID}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'battleship_rooms',
      filter: `id=eq.${ROOM_ID}`
    }, (payload) => {
      handleRoomUpdate(payload.new);
    })
    .subscribe();
}

async function handleRoomUpdate(room) {
  mpGameState = room;
  if (!room) return;

  // Opponent joined
  if (room.status === 'waiting' && mpPlayerNumber === 1 && room.player2_id) {
    mpStatus.textContent = 'Oponente conectado!';
    mpStatus.classList.remove('waiting');
    turnIndicator.textContent = 'Posicione seus navios';
    playSound('click');
  }

  // Both players in placement phase
  if (room.status === 'placement') {
    const opponentReady = mpPlayerNumber === 1 ? room.player2_ready : room.player1_ready;
    if (opponentReady && !mpOpponentReady) {
      mpOpponentReady = true;
      if (mpPlayerReady) {
        startMultiplayerBattle();
      } else {
        turnIndicator.textContent = 'Oponente pronto! Posicione seus navios';
      }
    }
  }

  // Battle phase updates
  if (room.status === 'battle') {
    const opponentShotsKey = mpPlayerNumber === 1 ? 'player2_shots' : 'player1_shots';
    const myShotsKey = mpPlayerNumber === 1 ? 'player1_shots' : 'player2_shots';

    if (room[opponentShotsKey]) {
      applyShotsToBoard(room[opponentShotsKey], playerBoard, playerGrid, true);
    }
    if (room[myShotsKey]) {
      applyShotsToBoard(room[myShotsKey], cpuBoard, enemyGrid, false);
    }

    updateMultiplayerTurn(room.current_turn);

    if (room.status === 'ended' && room.winner) {
      showEndGameModal(room.winner === mpPlayerNumber);
    }

    renderShipStatus();
    updateCounters();
  }

  if (room.status === 'ended' && room.winner) {
    showEndGameModal(room.winner === mpPlayerNumber);
  }
}

function updateMultiplayerTurn(currentTurn) {
  playerTurn = currentTurn === mpPlayerNumber;
  const gameWrapper = document.querySelector('.game-wrapper') || document.body;

  if (playerTurn) {
    turnIndicator.textContent = 'Seu turno — ataque!';
    turnIndicator.classList.remove('enemy-turn');
    gameWrapper.classList.remove('thinking');
    isProcessing = false;
  } else {
    turnIndicator.textContent = 'Turno do oponente...';
    turnIndicator.classList.add('enemy-turn');
    gameWrapper.classList.add('thinking');
    isProcessing = true;
  }
}

async function setPlayerReady() {
  if (!IS_MULTIPLAYER) return;

  mpPlayerReady = true;
  const readyKey = mpPlayerNumber === 1 ? 'player1_ready' : 'player2_ready';
  const boardKey = mpPlayerNumber === 1 ? 'player1_board' : 'player2_board';

  const { error } = await supabase
    .from('battleship_rooms')
    .update({
      [readyKey]: true,
      [boardKey]: playerBoard,
      status: mpOpponentReady ? 'battle' : 'placement'
    })
    .eq('id', ROOM_ID);

  if (error) {
    console.error('Error setting ready:', error);
    return;
  }

  if (mpOpponentReady) {
    startMultiplayerBattle();
  } else {
    turnIndicator.textContent = 'Aguardando oponente...';
    btnStart.classList.add('hidden');
  }
}

async function startMultiplayerBattle() {
  const { data: room } = await supabase
    .from('battleship_rooms')
    .select('*')
    .eq('id', ROOM_ID)
    .single();

  if (!room) return;

  const opponentBoardKey = mpPlayerNumber === 1 ? 'player2_board' : 'player1_board';
  if (room[opponentBoardKey]) {
    cpuBoard = room[opponentBoardKey];
    restoreShipsFromBoard(cpuBoard, cpuShips);
  }

  buildGrid(playerGrid, 'player');
  buildGrid(enemyGrid, 'enemy');
  buildHeaders('player');
  buildHeaders('enemy');
  renderPlayerShips();

  placementPanel.classList.add('hidden');
  battlePanel.classList.remove('hidden');

  phase = 'battle';
  updateMultiplayerTurn(room.current_turn);
  renderShipStatus();
  gameTimer.start();
}

function renderPlayerShips() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (playerBoard[r][c] === 1) {
        getCell(playerGrid, r, c).classList.add('ship');
      }
    }
  }
}

async function sendShot(r, c, result, sunkShip) {
  if (!IS_MULTIPLAYER) return;

  const shotsKey = mpPlayerNumber === 1 ? 'player1_shots' : 'player2_shots';
  const { data: room } = await supabase
    .from('battleship_rooms')
    .select(shotsKey)
    .eq('id', ROOM_ID)
    .single();

  const shots = room[shotsKey] || [];
  shots.push({ r, c, result, timestamp: Date.now() });

  const nextTurn = mpPlayerNumber === 1 ? 2 : 1;
  const updateData = {
    [shotsKey]: shots,
    current_turn: result === 'miss' ? nextTurn : mpPlayerNumber
  };

  const opponentShipsSunk = checkAllShipsSunk(cpuShips, cpuBoard);
  if (opponentShipsSunk) {
    updateData.status = 'ended';
    updateData.winner = mpPlayerNumber;
  }

  await supabase
    .from('battleship_rooms')
    .update(updateData)
    .eq('id', ROOM_ID);
}

function checkAllShipsSunk(ships, board) {
  return ships.every(ship => {
    return ship.cells.every(([r, c]) => board[r][c] === 3);
  });
}

// ===== COPY LINK =====
if (btnCopyLink) {
  btnCopyLink.addEventListener('click', async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      btnCopyLink.textContent = 'Copiado!';
      setTimeout(() => btnCopyLink.textContent = 'Copiar Link', 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });
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
    shipNameEl.textContent = IS_MULTIPLAYER
      ? 'Pronto! Clique em "Pronto para Batalha"'
      : 'Todos os navios posicionados!';
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
  initAudio();
  playSound('place');
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
    if (IS_MULTIPLAYER) {
      btnStart.textContent = 'Pronto para Batalha';
    }
    btnStart.classList.remove('hidden');
  }
}

function randomPlacement(board, ships) {
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
  initAudio();
  playSound('click');
  orientation = orientation === 'H' ? 'V' : 'H';
  btnRotate.textContent = `Girar (${orientation})`;
});

btnRandom.addEventListener('click', () => {
  initAudio();
  playSound('shuffle');
  randomPlacement(playerBoard, playerShips);
  currentShipIdx = SHIPS.length;
  renderPlacementBoard();
  updatePlacementInfo();
  btnStart.classList.remove('hidden');
  if (IS_MULTIPLAYER) {
    btnStart.textContent = 'Pronto para Batalha';
  }
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
btnStart.addEventListener('click', () => {
  initAudio();
  playSound('click');
  if (IS_MULTIPLAYER) {
    setPlayerReady();
  } else {
    startBattle();
  }
});

function startBattle() {
  randomPlacement(cpuBoard, cpuShips);

  buildGrid(playerGrid, 'player');
  buildGrid(enemyGrid, 'enemy');
  buildHeaders('player');
  buildHeaders('enemy');

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
  isProcessing = false;
  turnIndicator.textContent = 'Seu turno — ataque!';
  turnIndicator.classList.remove('enemy-turn');

  renderShipStatus();
  gameTimer.start();
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
async function fireAt(r, c) {
  if (phase !== 'battle' || !playerTurn || isProcessing) return;

  const cell = getCell(enemyGrid, r, c);
  if (cell.classList.contains('hit') || cell.classList.contains('miss') || cell.classList.contains('sunk')) {
    return;
  }

  isProcessing = true;
  initAudio();

  const wasHit = cpuBoard[r][c] === 1;
  let result = 'miss';
  let sunkShip = null;

  if (wasHit) {
    cpuBoard[r][c] = 3;
    cell.classList.add('hit');
    cell.textContent = '●';
    playSound('hit');
    result = 'hit';
    sunkShip = checkSunkAndGetShip(cpuShips, cpuBoard, enemyGrid);
    if (sunkShip) {
      result = 'sunk';
      playSound('explosion');
    }
  } else {
    cpuBoard[r][c] = 2;
    cell.classList.add('miss');
    cell.textContent = '•';
    playSound('move');
  }
  haptic(15);

  updateCounters();

  if (checkWin()) return;

  if (IS_MULTIPLAYER) {
    await sendShot(r, c, result, sunkShip);
  } else {
    playerTurn = false;
    turnIndicator.textContent = 'Computador pensando...';
    turnIndicator.classList.add('enemy-turn');
    const gameWrapper = document.querySelector('.game-wrapper') || document.body;
    gameWrapper.classList.add('thinking');

    setTimeout(cpuTurn, 800);
  }
}

function checkSunkAndGetShip(ships, board, grid) {
  let sunkShip = null;
  ships.forEach(ship => {
    if (ship.sunk) return;
    if (ship.cells.every(([r, c]) => board[r][c] === 3)) {
      ship.sunk = true;
      sunkShip = ship;
      ship.cells.forEach(([r, c]) => {
        const cell = getCell(grid, r, c);
        cell.classList.remove('hit');
        cell.classList.add('sunk');
        cell.textContent = '✕';
      });
    }
  });
  if (sunkShip) renderShipStatus();
  return sunkShip;
}

function cpuTurn() {
  if (phase !== 'battle') return;

  let r, c;

  while (cpuTargets.length > 0) {
    const t = cpuTargets.shift();
    if (playerBoard[t[0]][t[1]] === 0 || playerBoard[t[0]][t[1]] === 1) {
      r = t[0];
      c = t[1];
      break;
    }
  }

  if (r === undefined) {
    cpuMode = 'random';
    let attempts = 0;
    do {
      r = Math.floor(Math.random() * ROWS);
      c = Math.floor(Math.random() * COLS);
      attempts++;
    } while ((playerBoard[r][c] === 2 || playerBoard[r][c] === 3) && attempts < ROWS * COLS);
  }

  const cell = getCell(playerGrid, r, c);
  const wasHit = playerBoard[r][c] === 1;

  if (wasHit) {
    playerBoard[r][c] = 3;
    cell.classList.remove('ship');
    cell.classList.add('hit');
    cell.textContent = '●';

    cpuHits.push([r, c]);
    cpuMode = 'hunt';
    addAdjacentTargets(r, c);

    const sunkShip = checkSunkCpu(playerShips, playerBoard, playerGrid);
    if (sunkShip) {
      playSound('explosion');
      cpuHits = cpuHits.filter(([hr, hc]) =>
        !sunkShip.cells.some(([sr, sc]) => sr === hr && sc === hc)
      );
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
  const gameWrapper = document.querySelector('.game-wrapper') || document.body;
  gameWrapper.classList.remove('thinking');
  isProcessing = false;
}

function addAdjacentTargets(r, c) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  dirs.forEach(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      if (playerBoard[nr][nc] === 0 || playerBoard[nr][nc] === 1) {
        if (!cpuTargets.some(([tr, tc]) => tr === nr && tc === nc)) {
          cpuTargets.push([nr, nc]);
        }
      }
    }
  });
}

// ===== SUNK CHECK =====
function checkSunk(ships, board, grid) {
  let anySunk = false;
  ships.forEach(ship => {
    if (ship.sunk) return;
    if (ship.cells.every(([r, c]) => board[r][c] === 3)) {
      ship.sunk = true;
      anySunk = true;
      ship.cells.forEach(([r, c]) => {
        const cell = getCell(grid, r, c);
        cell.classList.remove('hit');
        cell.classList.add('sunk');
        cell.textContent = '✕';
      });
    }
  });
  if (anySunk) playSound('explosion');
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
    gameTimer.stop();

    const won = cpuLost;
    showEndGameModal(won);

    if (!IS_MULTIPLAYER) {
      gameStats.recordGame(won, { time: gameTimer.getTime() });
    }
    return true;
  }
  return false;
}

function showEndGameModal(won) {
  modalIcon.textContent = won ? '🏆' : '💥';
  modalTitle.textContent = won ? 'Vitoria!' : 'Derrota!';
  modalMsg.textContent = won
    ? `Voce afundou toda a frota inimiga em ${timerDisplay.textContent}!`
    : 'A frota inimiga destruiu todos os seus navios.';
  modalOverlay.classList.add('show');

  turnIndicator.textContent = won ? 'Voce venceu!' : 'Voce perdeu!';

  if (won) {
    launchConfetti();
    playSound('win');
  }
}

// ===== PLAY AGAIN =====
btnPlayAgain.addEventListener('click', () => {
  initAudio();
  playSound('click');
  if (IS_MULTIPLAYER) {
    if (mpSubscription) {
      mpSubscription.unsubscribe();
    }
    const newRoomId = crypto.randomUUID();
    window.location.href = `index.html?room=${newRoomId}`;
  } else {
    init();
  }
});

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
  if (mpSubscription) {
    mpSubscription.unsubscribe();
  }
  gameStats.destroy();
  gameTimer.destroy();
});

// ===== START =====
init();
