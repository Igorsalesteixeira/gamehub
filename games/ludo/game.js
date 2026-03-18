import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';

// =============================================
//  LUDO — Complete Brazilian rules implementation
// =============================================

// ---- Board geometry ----
const CELL = 30;   // px per cell (15x15 grid → 450px canvas)
const CANVAS_SIZE = 450;

// Main path — 52 cells — [col, row]
const PATH = [
  [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],    // 0-5
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],          // 6-11
  [0,7],                                         // 12
  [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],          // 13-18
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],          // 19-24
  [7,0],                                         // 25
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],          // 26-31
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],     // 32-37
  [14,7],                                        // 38
  [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],     // 39-44
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],     // 45-50
  [7,14],                                        // 51
];

// Home columns (final stretch) — 6 cells each, index 0 = entry, 5 = just before center
const HOME_COL = [
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],  // red
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],       // blue
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],  // green
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],       // yellow
];

// Starting positions in home base (before entering game)
const HOME_BASE = [
  [[1,10],[3,10],[1,12],[3,12]], // red
  [[11,1],[13,1],[11,3],[13,3]], // blue
  [[11,10],[13,10],[11,12],[13,12]], // green
  [[1,1],[3,1],[1,3],[3,3]],    // yellow
];

// Where each color enters the PATH
const COLOR_START = [0, 13, 26, 39];

// Safe squares on PATH (absolute indices)
const SAFE_ABS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Color definitions
const COLORS = ['red','blue','green','yellow'];
const COLOR_HEX   = ['#e53935','#1e88e5','#43a047','#fdd835'];
const COLOR_LIGHT = ['#ffcdd2','#bbdefb','#c8e6c9','#fff9c4'];
const COLOR_DARK  = ['#b71c1c','#1565c0','#2e7d32','#f9a825'];
const TOKEN_LETTERS = ['V','B','V','A']; // Vermelho, Azul, Verde, Amarelo

// Dice face unicode chars
const DICE_FACES = ['', '\u2680','\u2681','\u2682','\u2683','\u2684','\u2685'];

// ---- Game state ----
let pieces;        // pieces[ci][ti] = { pos } where pos: -1=base, 0-51=path, 52-57=home col, >=58=finished
let currentPlayer; // 0=red(human), 1-3=AI
let diceValue;
let rolled;        // has the current player rolled this turn?
let gameOver;
let finishOrder;   // order of players finishing
let totalMoves;
let startTime;
let timerInterval;
let animQueue = []; // animation queue
let animating = false;
let highlightedPieces; // Set of ti indices valid to move this turn

// ---- DOM ----
const canvas    = document.getElementById('ludo-canvas');
const ctx       = canvas.getContext('2d');
const btnRoll   = document.getElementById('btn-roll');
const btnNew    = document.getElementById('btn-new-game');
const diceEl    = document.getElementById('dice-display');
const turnMsg   = document.getElementById('turn-msg');
const timerEl   = document.getElementById('timer-display');
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon    = document.getElementById('modal-icon');
const modalTitle   = document.getElementById('modal-title');
const modalMsg     = document.getElementById('modal-msg');
const modalStats   = document.getElementById('modal-stats');
const btnPlayAgain = document.getElementById('btn-play-again');

// ---- Init ----
function initGame() {
  pieces = Array.from({length: 4}, (_, ci) =>
    Array.from({length: 4}, () => ({ pos: -1 }))
  );
  currentPlayer = 0;
  diceValue = 0;
  rolled = false;
  gameOver = false;
  finishOrder = [];
  totalMoves = 0;
  highlightedPieces = new Set();
  startTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);

  updateTimer();
  updateScores();
  setActiveChip(0);
  updateTurnMsg();
  btnRoll.disabled = false;
  modalOverlay.classList.add('hidden');
  drawBoard();
}

function updateTimer() {
  if (gameOver) return;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2,'0');
  const s = String(elapsed % 60).padStart(2,'0');
  timerEl.textContent = m + ':' + s;
}

// ---- Geometry helpers ----
function getGrid(ci, pos) {
  if (pos < 0) return null; // in base
  if (pos >= 58) return [7, 7]; // finished (center)
  if (pos >= 52) return HOME_COL[ci][pos - 52];
  return PATH[(COLOR_START[ci] + pos) % 52];
}

function isSafePos(ci, pos) {
  if (pos < 0) return true; // base is safe
  if (pos >= 52) return true; // home col is safe
  return SAFE_ABS.has((COLOR_START[ci] + pos) % 52);
}

function gridToCanvas(col, row) {
  return [col * CELL + CELL / 2, row * CELL + CELL / 2];
}

// ---- Move validation ----
function validMoves(ci, dice) {
  const moves = [];
  for (let ti = 0; ti < 4; ti++) {
    const pos = pieces[ci][ti].pos;

    if (pos >= 58) continue; // already finished

    if (pos === -1) {
      // in base — need 6 to come out
      if (dice === 6) moves.push(ti);
      continue;
    }

    const newPos = pos + dice;

    // In home col (pos 52-57): can't overshoot beyond 58
    if (pos >= 52) {
      if (newPos <= 58) moves.push(ti);
      continue;
    }

    // On main path: entering home col
    // When pos + dice would cross 52 it enters home col
    // max reachable in home col = 52 + 5 = 57, but 58 = center
    if (newPos > 51) {
      // entering home col
      const homeIdx = newPos - 52; // 0-6
      if (homeIdx <= 6) moves.push(ti); // 6 = 58 = center, valid
    } else {
      moves.push(ti);
    }
  }
  return moves;
}

function computeNewPos(ci, ti, dice) {
  const pos = pieces[ci][ti].pos;
  if (pos === -1) return 0; // comes out at start
  return pos + dice;
}

// ---- Board drawing ----
function drawBoard() {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Draw base background grid
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      ctx.fillStyle = getCellBg(c, r);
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      // subtle grid line
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  // Draw home base inner squares with circles
  drawHomeBaseInner();

  // Highlight PATH cells
  drawPathCells();

  // Draw HOME_COL cells
  drawHomeColCells();

  // Draw center star
  drawCenter();

  // Draw pieces
  drawAllPieces();
}

function getCellBg(c, r) {
  // Quadrant coloring
  if (r >= 9 && r <= 14 && c >= 0 && c <= 5) return COLOR_LIGHT[0]; // red quadrant
  if (r >= 0 && r <= 5  && c >= 9 && c <= 14) return COLOR_LIGHT[1]; // blue quadrant
  if (r >= 9 && r <= 14 && c >= 9 && c <= 14) return COLOR_LIGHT[2]; // green quadrant
  if (r >= 0 && r <= 5  && c >= 0 && c <= 5)  return COLOR_LIGHT[3]; // yellow quadrant

  // Center cross — path area
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return '#fff'; // center zone

  return '#e8e8e8'; // default cross cells
}

function drawPathCells() {
  for (let i = 0; i < PATH.length; i++) {
    const [c, r] = PATH[i];
    const isSafe = SAFE_ABS.has(i);

    ctx.fillStyle = isSafe ? '#fffde7' : '#ffffff';
    ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
    ctx.strokeStyle = isSafe ? '#f9a825' : '#bdbdbd';
    ctx.lineWidth = isSafe ? 1.5 : 0.8;
    ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);

    if (isSafe) {
      // Draw star
      ctx.font = `${CELL * 0.55}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f9a825';
      ctx.fillText('\u2B50', c * CELL + CELL / 2, r * CELL + CELL / 2);
    }
  }
}

function drawHomeColCells() {
  for (let ci = 0; ci < 4; ci++) {
    for (let hi = 0; hi < 6; hi++) {
      const [c, r] = HOME_COL[ci][hi];
      ctx.fillStyle = COLOR_LIGHT[ci];
      ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      ctx.strokeStyle = COLOR_HEX[ci];
      ctx.lineWidth = 0.8;
      ctx.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
    }
  }
}

function drawHomeBaseInner() {
  // Each quadrant has a 4x4 inner area with rounded corners and circular token spots
  const quadrants = [
    { ci: 0, startC: 0, startR: 9  }, // red
    { ci: 1, startC: 9, startR: 0  }, // blue
    { ci: 2, startC: 9, startR: 9  }, // green
    { ci: 3, startC: 0, startR: 0  }, // yellow
  ];

  for (const { ci, startC, startR } of quadrants) {
    // Inner white box
    const pad = 4;
    const sz = 6 * CELL - pad * 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    roundRect(ctx, startC * CELL + pad, startR * CELL + pad, sz, sz, 10);
    ctx.fill();

    // Color border
    ctx.strokeStyle = COLOR_HEX[ci];
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Four token slots
    for (let ti = 0; ti < 4; ti++) {
      const [bc, br] = HOME_BASE[ci][ti];
      const cx = bc * CELL + CELL;
      const cy = br * CELL + CELL;
      const r = CELL * 0.72;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_LIGHT[ci];
      ctx.fill();
      ctx.strokeStyle = COLOR_HEX[ci];
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function drawCenter() {
  const cx = 7;
  const cy = 7;
  const x = cx * CELL;
  const y = cy * CELL;
  const s = CELL;

  // 4 triangles pointing inward from each direction
  const triangles = [
    // top (blue/green color)
    { color: COLOR_HEX[1], points: [[x, y], [x+s, y], [x+s/2, y+s/2]] },
    // right (green)
    { color: COLOR_HEX[2], points: [[x+s, y], [x+s, y+s], [x+s/2, y+s/2]] },
    // bottom (red)
    { color: COLOR_HEX[0], points: [[x+s, y+s], [x, y+s], [x+s/2, y+s/2]] },
    // left (yellow)
    { color: COLOR_HEX[3], points: [[x, y+s], [x, y], [x+s/2, y+s/2]] },
  ];

  for (const { color, points } of triangles) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    ctx.lineTo(points[1][0], points[1][1]);
    ctx.lineTo(points[2][0], points[2][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Center circle
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s / 2, s * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Star in center
  ctx.font = `${s * 0.5}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#888';
  ctx.fillText('\u2B50', x + s / 2, y + s / 2);
}

function drawAllPieces() {
  // Group pieces by grid cell to handle stacking
  const cellMap = {};

  for (let ci = 0; ci < 4; ci++) {
    for (let ti = 0; ti < 4; ti++) {
      const pos = pieces[ci][ti].pos;
      if (pos >= 58) continue; // finished pieces shown at center but handled separately

      let gridPos;
      if (pos === -1) {
        gridPos = HOME_BASE[ci][ti];
      } else {
        gridPos = getGrid(ci, pos);
      }

      if (!gridPos) continue;
      const key = gridPos[0] + ',' + gridPos[1];
      if (!cellMap[key]) cellMap[key] = [];
      cellMap[key].push({ ci, ti, pos, gridPos });
    }
  }

  // Draw finished pieces stacked at center
  const finishedByCi = [0,1,2,3].map(ci =>
    pieces[ci].filter(p => p.pos >= 58).length
  );

  // Draw regular pieces
  for (const key of Object.keys(cellMap)) {
    const list = cellMap[key];
    drawPiecesAtCell(list);
  }

  // Draw finished pieces at center
  drawFinishedAtCenter(finishedByCi);

  // Draw highlight rings on valid pieces
  if (!rolled || currentPlayer !== 0) return;
  for (const ti of highlightedPieces) {
    const pos = pieces[0][ti].pos;
    let gridPos;
    if (pos === -1) {
      gridPos = HOME_BASE[0][ti];
    } else {
      gridPos = getGrid(0, pos);
    }
    if (!gridPos) continue;
    const [cx, cy] = gridToCanvas(gridPos[0], gridPos[1]);
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.42, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff176';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pulse effect
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.48, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,241,118,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawPiecesAtCell(list) {
  const n = list.length;
  const { gridPos } = list[0];
  const baseCx = gridPos[0] * CELL + CELL / 2;
  const baseCy = gridPos[1] * CELL + CELL / 2;
  const r = CELL * 0.36;

  // Offsets for stacking multiple pieces
  const offsets = [
    [[0, 0]],
    [[-5, -5], [5, 5]],
    [[-5, -5], [5, -5], [0, 6]],
    [[-5, -5], [5, -5], [-5, 5], [5, 5]],
  ];
  const offs = offsets[Math.min(n, 4) - 1];

  for (let i = 0; i < list.length; i++) {
    const { ci, ti } = list[i];
    const [ox, oy] = offs[i] || [0, 0];
    drawPiece(baseCx + ox, baseCy + oy, r, ci, ti);
  }
}

function drawFinishedAtCenter(counts) {
  // Show small indicators near center for finished pieces
  const centerX = 7 * CELL + CELL / 2;
  const centerY = 7 * CELL + CELL / 2;
  const positions = [
    [centerX - 7, centerY + 7],  // red
    [centerX + 7, centerY - 7],  // blue
    [centerX + 7, centerY + 7],  // green
    [centerX - 7, centerY - 7],  // yellow
  ];
  for (let ci = 0; ci < 4; ci++) {
    if (counts[ci] === 0) continue;
    const [cx, cy] = positions[ci];
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_HEX[ci];
    ctx.fill();
    if (counts[ci] > 1) {
      ctx.font = 'bold 7px Nunito, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(counts[ci], cx, cy);
    }
  }
}

function drawPiece(cx, cy, r, ci, ti) {
  // Shadow
  ctx.beginPath();
  ctx.arc(cx + 1, cy + 2, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  // Piece body
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  grad.addColorStop(0, lightenColor(COLOR_HEX[ci], 40));
  grad.addColorStop(1, COLOR_DARK[ci]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = COLOR_DARK[ci];
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Highlight glare
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();

  // Label
  ctx.font = `bold ${Math.max(8, r * 0.7)}px Nunito, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(ti + 1, cx, cy + 0.5);
}

function lightenColor(hex, amount) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

// ---- UI helpers ----
function updateScores() {
  for (let ci = 0; ci < 4; ci++) {
    const done = pieces[ci].filter(p => p.pos >= 58).length;
    document.getElementById(`score-${ci}`).textContent = done + '/4';
  }
}

function setActiveChip(ci) {
  document.querySelectorAll('.player-chip').forEach((el, i) => {
    el.classList.toggle('active', i === ci);
  });
}

function updateTurnMsg(msg) {
  if (msg !== undefined) {
    turnMsg.textContent = msg;
    return;
  }
  if (currentPlayer === 0) {
    if (!rolled) {
      turnMsg.textContent = 'Sua vez — role o dado!';
    } else if (highlightedPieces.size === 0) {
      turnMsg.textContent = 'Nenhum movimento possível.';
    } else {
      turnMsg.textContent = `Você rolou ${diceValue} — clique em uma peça!`;
    }
  } else {
    const names = ['','Azul','Verde','Amarelo'];
    turnMsg.textContent = `Vez do ${names[currentPlayer]}...`;
  }
}

// ---- Dice ----
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function showDice(val) {
  diceEl.textContent = DICE_FACES[val];
  diceEl.classList.remove('rolling');
  void diceEl.offsetWidth; // reflow
  diceEl.classList.add('rolling');
  setTimeout(() => diceEl.classList.remove('rolling'), 500);
}

// ---- Game logic ----
function startTurn(ci) {
  currentPlayer = ci;
  rolled = false;
  highlightedPieces = new Set();
  setActiveChip(ci);
  updateTurnMsg();

  if (ci === 0) {
    btnRoll.disabled = false;
  } else {
    btnRoll.disabled = true;
    setTimeout(() => doAITurn(ci), 700);
  }
}

function handleRoll() {
  if (rolled || gameOver || currentPlayer !== 0) return;
  initAudio();
  btnRoll.disabled = true;
  rolled = true;
  diceValue = rollDice();
  showDice(diceValue);
  totalMoves++;

  const moves = validMoves(0, diceValue);
  highlightedPieces = new Set(moves);

  if (moves.length === 0) {
    updateTurnMsg(`Você rolou ${diceValue} — sem movimentos. Próximo turno.`);
    drawBoard();
    setTimeout(() => nextTurn(0, diceValue, false), 1200);
    return;
  }

  if (moves.length === 1) {
    // Auto-move single valid piece after brief delay
    updateTurnMsg(`Você rolou ${diceValue} — movendo automaticamente!`);
    drawBoard();
    setTimeout(() => movePiece(0, moves[0]), 600);
    return;
  }

  updateTurnMsg();
  drawBoard();
}

function handleCanvasClick(e) {
  if (!rolled || gameOver || currentPlayer !== 0 || highlightedPieces.size === 0) return;
  initAudio();

  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_SIZE / rect.width;
  const scaleY = CANVAS_SIZE / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  // Find which piece was clicked
  for (const ti of highlightedPieces) {
    const pos = pieces[0][ti].pos;
    let gridPos;
    if (pos === -1) {
      gridPos = HOME_BASE[0][ti];
    } else {
      gridPos = getGrid(0, pos);
    }
    if (!gridPos) continue;
    const [cx, cy] = gridToCanvas(gridPos[0], gridPos[1]);
    const dist = Math.hypot(mx - cx, my - cy);
    if (dist <= CELL * 0.5) {
      movePiece(0, ti);
      return;
    }
  }
}

function movePiece(ci, ti) {
  highlightedPieces = new Set();
  btnRoll.disabled = true;
  rolled = false;
  playSound('move');
  haptic(15);

  const newPos = computeNewPos(ci, ti, diceValue);
  pieces[ci][ti].pos = newPos;

  // Check capture
  let captured = false;
  if (newPos < 52 && newPos >= 0) {
    const newAbsPath = (COLOR_START[ci] + newPos) % 52;
    for (let oci = 0; oci < 4; oci++) {
      if (oci === ci) continue;
      for (let oti = 0; oti < 4; oti++) {
        const op = pieces[oci][oti].pos;
        if (op < 0 || op >= 52) continue;
        const opAbs = (COLOR_START[oci] + op) % 52;
        if (opAbs === newAbsPath && !SAFE_ABS.has(newAbsPath)) {
          pieces[oci][oti].pos = -1;
          captured = true;
          if (ci === 0) updateTurnMsg(`Captura! Peça ${COLORS[oci]} voltou para a base!`);
        }
      }
    }
  }

  updateScores();
  drawBoard();

  // Check if finished
  if (newPos >= 58) {
    finishOrder.push(ci);
    if (ci === 0) updateTurnMsg('Uma peça chegou ao centro!');
    if (checkWin(ci)) return;
  }

  // Extra turn only on rolling 6
  const extraTurn = diceValue === 6;
  if (ci === 0) {
    updateTurnMsg(extraTurn ? 'Tirou 6 — jogue novamente!' : '');
  }
  setTimeout(() => nextTurn(ci, diceValue, extraTurn), 400);
}

function nextTurn(ci, dice, extraTurn) {
  if (gameOver) return;
  if (extraTurn) {
    startTurn(ci);
  } else {
    const nextCi = getNextPlayer(ci);
    startTurn(nextCi);
  }
}

function getNextPlayer(ci) {
  // Skip finished players
  let next = (ci + 1) % 4;
  let tries = 0;
  while (tries < 4) {
    if (pieces[next].some(p => p.pos < 58)) return next;
    next = (next + 1) % 4;
    tries++;
  }
  return (ci + 1) % 4;
}

function checkWin(ci) {
  if (pieces[ci].every(p => p.pos >= 58)) {
    // First player to get all 4 tokens to center wins the game
    endGame(ci === 0);
    return true;
  }
  return false;
}

function endGame(humanWon) {
  gameOver = true;
  clearInterval(timerInterval);
  btnRoll.disabled = true;

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const finishPos = finishOrder.indexOf(0) + 1;
  const pos = humanWon ? 1 : (finishPos > 0 ? finishPos : 4);

  modalIcon.textContent = humanWon ? '🏆' : '😔';
  modalTitle.textContent = humanWon ? 'Você Venceu!' : 'Fim de Jogo';
  modalMsg.textContent = humanWon
    ? 'Parabéns! Todas as suas peças chegaram ao centro!'
    : 'O computador ganhou desta vez. Tente novamente!';

  const m = String(Math.floor(elapsed / 60)).padStart(2,'0');
  const s = String(elapsed % 60).padStart(2,'0');
  modalStats.innerHTML = `Posição: ${pos}º lugar &nbsp;|&nbsp; Tempo: ${m}:${s} &nbsp;|&nbsp; Jogadas: ${totalMoves}`;

  modalOverlay.classList.remove('hidden');

  if (humanWon) {
    launchConfetti();
    playSound('win');
  }
  saveStats(pos, totalMoves, elapsed);
}

async function saveStats(finishPosition, moves, elapsed) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('game_stats').insert({
      user_id: user.id,
      game: 'ludo',
      result: finishPosition === 1 ? 'win' : 'loss',
      score: finishPosition,
      moves: moves,
      time_seconds: elapsed,
    });
  } catch (err) {
    console.warn('Erro ao salvar stats:', err);
  }
}

// ---- AI ----
function doAITurn(ci) {
  if (gameOver) return;

  const dice = rollDice();
  diceValue = dice;
  showDice(dice);
  totalMoves++;

  setTimeout(() => {
    const moves = validMoves(ci, dice);

    if (moves.length === 0) {
      updateTurnMsg(`${['','Azul','Verde','Amarelo'][ci]} rolou ${dice} — sem movimentos.`);
      setTimeout(() => nextTurn(ci, dice, false), 900);
      return;
    }

    const chosen = aiChooseMove(ci, dice, moves);
    updateTurnMsg(`${['','Azul','Verde','Amarelo'][ci]} rolou ${dice}.`);
    setTimeout(() => movePiece(ci, chosen), 600);
  }, 500);
}

function aiChooseMove(ci, dice, moves) {
  // Score each candidate move
  let best = -Infinity;
  let bestTi = moves[0];

  for (const ti of moves) {
    let score = 0;
    const pos = pieces[ci][ti].pos;
    const newPos = computeNewPos(ci, ti, dice);

    // 1. Finish a token
    if (newPos >= 58) {
      score += 1000;
    }

    // 2. Capture opponent
    if (newPos < 52 && newPos >= 0) {
      const newAbsPath = (COLOR_START[ci] + newPos) % 52;
      if (!SAFE_ABS.has(newAbsPath)) {
        for (let oci = 0; oci < 4; oci++) {
          if (oci === ci) continue;
          for (let oti = 0; oti < 4; oti++) {
            const op = pieces[oci][oti].pos;
            if (op < 0 || op >= 52) continue;
            const opAbs = (COLOR_START[oci] + op) % 52;
            if (opAbs === newAbsPath) score += 500;
          }
        }
      }
    }

    // 3. Advance most progressed piece
    score += newPos * 3;

    // 4. Bring piece out of base
    if (pos === -1) score += 200;

    // 5. Small random tiebreaker
    score += Math.random() * 10;

    if (score > best) {
      best = score;
      bestTi = ti;
    }
  }

  return bestTi;
}

// ---- Events ----
btnRoll.addEventListener('click', handleRoll);
canvas.addEventListener('click', handleCanvasClick);
btnNew.addEventListener('click', () => { initAudio(); playSound('click'); initGame(); });
btnPlayAgain.addEventListener('click', () => { initAudio(); playSound('click'); initGame(); });

// ---- Start ----
initGame();
