// =============================================
//  COMBINA 3 — Joias do Brasil  (game.js)
// =============================================

// ---- Shared imports (safe fail) ----
let onGameEnd = null;
try {
  const mod = await import('../shared/game-integration.js');
  onGameEnd = mod.onGameEnd;
} catch (_) { /* shared module may not exist */ }

// ---- DOM ----
const canvas       = document.getElementById('game-canvas');
const ctx          = canvas.getContext('2d');
const overlay      = document.getElementById('overlay');
const overlayIcon  = document.getElementById('overlay-icon');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg   = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const btnStart     = document.getElementById('btn-start');
const btnShare     = document.getElementById('btn-share');
const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');
const movesDisplay = document.getElementById('moves-display');

// ---- Constants ----
const COLS = 8, ROWS = 8;
const GEM_TYPES = 6;
const ANIM_SWAP = 180;     // ms
const ANIM_FALL = 120;     // ms per cell
const ANIM_MATCH = 300;    // ms
const PARTICLE_LIFE = 600; // ms

// Gem definitions: name, colors, drawFn
const GEMS = [
  { name: 'Ametista',         c1: '#a855f7', c2: '#7c3aed', c3: '#581c87' },
  { name: 'Agua-marinha',     c1: '#22d3ee', c2: '#0891b2', c3: '#164e63' },
  { name: 'Esmeralda',        c1: '#34d399', c2: '#059669', c3: '#064e3b' },
  { name: 'Topazio Imperial', c1: '#fbbf24', c2: '#d97706', c3: '#78350f' },
  { name: 'Turmalina',        c1: '#2dd4bf', c2: '#0d9488', c3: '#134e4a' },
  { name: 'Diamante',         c1: '#f0f0ff', c2: '#a5b4fc', c3: '#6366f1' },
];

// Special gem types
const SPECIAL = { NONE: 0, LIGHTNING: 1, BOMB: 2, RAINBOW: 3 };

// Blocker types
const BLOCKER = { NONE: 0, ICE: 1, STONE: 2 };

// 27 Brazilian states as levels
const STATES = [
  'Acre','Alagoas','Amapa','Amazonas','Bahia','Ceara','Distrito Federal',
  'Espirito Santo','Goias','Maranhao','Mato Grosso','Mato Grosso do Sul',
  'Minas Gerais','Para','Paraiba','Parana','Pernambuco','Piaui',
  'Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondonia',
  'Roraima','Santa Catarina','Sao Paulo','Sergipe','Tocantins'
];

// ---- Canvas sizing ----
let cellSize = 0, boardX = 0, boardY = 0, CW = 0, CH = 0;
let headerH = 60; // space for level info at top of canvas

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const maxW = Math.min(window.innerWidth - 16, 500);
  const maxH = window.innerHeight - 80;
  cellSize = Math.floor(Math.min((maxW) / COLS, (maxH - headerH - 20) / ROWS));
  if (cellSize < 30) cellSize = 30;
  CW = cellSize * COLS + 20;
  CH = cellSize * ROWS + headerH + 30;
  boardX = (CW - cellSize * COLS) / 2;
  boardY = headerH + 10;
  canvas.width = CW * dpr;
  canvas.height = CH * dpr;
  canvas.style.width = CW + 'px';
  canvas.style.height = CH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);

// ---- Game State ----
let board = [];       // board[r][c] = { type, special, blocker }
let score = 0;
let moves = 0;
let totalCascades = 0;
let currentLevel = 0;
let maxUnlocked = 0;
let gameRunning = false;
let animating = false;
let selected = null;  // {r, c}
let showingLevelSelect = false;

// Animation state
let swapAnim = null;
let fallAnims = [];
let matchAnim = null;
let particles = [];
let comboTexts = [];
let screenShake = { x: 0, y: 0, time: 0 };
let cascadeMultiplier = 1;
let hoverCell = null;
let dragStart = null;
let dragCurrent = null;

// Level objectives
let levelObj = null;
// { type: 'score'|'collect'|'clear', target: number, gemType?: number, current: number }

// ---- Load / Save progress ----
function loadProgress() {
  try {
    const d = JSON.parse(localStorage.getItem('combina3_progress'));
    if (d) { maxUnlocked = d.maxUnlocked || 0; }
  } catch (_) {}
}
function saveProgress() {
  localStorage.setItem('combina3_progress', JSON.stringify({ maxUnlocked }));
}

// ---- Level Generation ----
function generateLevel(lvl) {
  const lvlData = {};
  const difficulty = lvl; // 0..26

  // Determine objective type
  if (difficulty % 3 === 0) {
    lvlData.type = 'score';
    lvlData.target = 2000 + difficulty * 500;
    lvlData.gemType = -1;
  } else if (difficulty % 3 === 1) {
    lvlData.type = 'collect';
    lvlData.gemType = difficulty % GEM_TYPES;
    lvlData.target = 15 + Math.floor(difficulty * 1.5);
  } else {
    lvlData.type = 'clear';
    lvlData.target = 5 + Math.floor(difficulty * 0.8);
    lvlData.gemType = -1;
  }
  lvlData.current = 0;

  // Build board
  const b = [];
  for (let r = 0; r < ROWS; r++) {
    b[r] = [];
    for (let c = 0; c < COLS; c++) {
      let type;
      // Avoid initial matches of 3
      do {
        type = Math.floor(Math.random() * GEM_TYPES);
      } while (
        (c >= 2 && b[r][c-1].type === type && b[r][c-2].type === type) ||
        (r >= 2 && b[r-1][c].type === type && b[r-2][c].type === type)
      );
      let blocker = BLOCKER.NONE;
      // Add blockers for 'clear' levels
      if (lvlData.type === 'clear') {
        const chance = 0.06 + difficulty * 0.008;
        if (Math.random() < chance) {
          blocker = difficulty > 15 ? BLOCKER.STONE : BLOCKER.ICE;
          lvlData.current = 0; // will count them
        }
      }
      b[r][c] = { type, special: SPECIAL.NONE, blocker };
    }
  }

  // Count actual blockers for clear objectives
  if (lvlData.type === 'clear') {
    let count = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (b[r][c].blocker !== BLOCKER.NONE) count++;
    if (count < 3) {
      // ensure minimum blockers
      let needed = lvlData.target;
      if (needed > ROWS * COLS / 3) needed = Math.floor(ROWS * COLS / 3);
      lvlData.target = needed;
      while (count < needed) {
        const rr = Math.floor(Math.random() * ROWS);
        const cc = Math.floor(Math.random() * COLS);
        if (b[rr][cc].blocker === BLOCKER.NONE) {
          b[rr][cc].blocker = difficulty > 15 ? BLOCKER.STONE : BLOCKER.ICE;
          count++;
        }
      }
    } else {
      lvlData.target = count;
    }
  }

  return { board: b, objective: lvlData };
}

// ---- Drawing helpers ----
function drawGem(x, y, size, type, special, alpha = 1) {
  const gem = GEMS[type];
  const r = size * 0.38;
  const cx = x + size / 2;
  const cy = y + size / 2;

  ctx.globalAlpha = alpha;
  ctx.save();

  // Radial gradient base
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  grad.addColorStop(0, gem.c1);
  grad.addColorStop(0.7, gem.c2);
  grad.addColorStop(1, gem.c3);

  ctx.fillStyle = grad;
  ctx.strokeStyle = gem.c1;
  ctx.lineWidth = 1.5;

  switch (type) {
    case 0: // Ametista - circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Inner glow
      const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.6);
      ig.addColorStop(0, 'rgba(255,255,255,0.4)');
      ig.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.15, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 1: // Agua-marinha - diamond
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.7, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r * 0.7, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.7);
      ctx.lineTo(cx + r * 0.3, cy - r * 0.1);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx - r * 0.3, cy - r * 0.1);
      ctx.closePath();
      ctx.fill();
      break;

    case 2: // Esmeralda - hexagon
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Highlight facet
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + r * 0.6 * Math.cos(angle);
        const py = cy + r * 0.6 * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;

    case 3: // Topazio Imperial - star
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const dist = i % 2 === 0 ? r : r * 0.45;
        const px = cx + dist * Math.cos(angle);
        const py = cy + dist * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;

    case 4: // Turmalina - triangle
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.87, cy + r * 0.5);
      ctx.lineTo(cx - r * 0.87, cy + r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Inner triangle highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      const ir = r * 0.45;
      ctx.moveTo(cx, cy - ir);
      ctx.lineTo(cx + ir * 0.87, cy + ir * 0.5);
      ctx.lineTo(cx - ir * 0.87, cy + ir * 0.5);
      ctx.closePath();
      ctx.fill();
      break;

    case 5: // Diamante - octagon + shimmer
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i - Math.PI / 8;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Rainbow shimmer
      const shimmer = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      shimmer.addColorStop(0, 'rgba(255,100,100,0.2)');
      shimmer.addColorStop(0.3, 'rgba(100,255,100,0.2)');
      shimmer.addColorStop(0.6, 'rgba(100,100,255,0.2)');
      shimmer.addColorStop(1, 'rgba(255,255,100,0.2)');
      ctx.fillStyle = shimmer;
      ctx.fill();
      break;
  }

  // Special gem indicators
  if (special === SPECIAL.LIGHTNING) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - r * 0.6);
    ctx.lineTo(cx + 2, cy - 2);
    ctx.lineTo(cx - 2, cy + 1);
    ctx.lineTo(cx + 3, cy + r * 0.6);
    ctx.stroke();
  } else if (special === SPECIAL.BOMB) {
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    // Fuse lines
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.35 * Math.cos(a), cy + r * 0.35 * Math.sin(a));
      ctx.lineTo(cx + r * 0.65 * Math.cos(a), cy + r * 0.65 * Math.sin(a));
      ctx.stroke();
    }
  } else if (special === SPECIAL.RAINBOW) {
    ctx.lineWidth = 2;
    const colors = ['#f00', '#ff0', '#0f0', '#0ff', '#00f', '#f0f'];
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = colors[i];
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.7, (Math.PI / 3) * i, (Math.PI / 3) * (i + 1));
      ctx.stroke();
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBlocker(x, y, size, blockerType) {
  const cx = x + size / 2, cy = y + size / 2, r = size * 0.44;
  ctx.save();
  if (blockerType === BLOCKER.ICE) {
    ctx.fillStyle = 'rgba(180, 220, 255, 0.35)';
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, size - 6, size - 6, 6);
    ctx.fill();
    ctx.stroke();
    // Crack lines
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy - r * 0.3);
    ctx.lineTo(cx + r * 0.2, cy + r * 0.1);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.4);
    ctx.stroke();
  } else if (blockerType === BLOCKER.STONE) {
    ctx.fillStyle = 'rgba(100, 100, 110, 0.85)';
    ctx.strokeStyle = 'rgba(140, 140, 150, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, size - 4, size - 4, 4);
    ctx.fill();
    ctx.stroke();
    // Stone texture
    ctx.fillStyle = 'rgba(80, 80, 90, 0.5)';
    ctx.fillRect(x + size * 0.2, y + size * 0.3, size * 0.3, size * 0.15);
    ctx.fillRect(x + size * 0.5, y + size * 0.55, size * 0.25, size * 0.12);
  }
  ctx.restore();
}

function drawBoard() {
  // Background
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, CW, CH);

  // Apply screen shake
  ctx.save();
  if (screenShake.time > 0) {
    ctx.translate(screenShake.x, screenShake.y);
  }

  // Grid background
  ctx.fillStyle = '#161628';
  ctx.beginPath();
  ctx.roundRect(boardX - 4, boardY - 4, cellSize * COLS + 8, cellSize * ROWS + 8, 10);
  ctx.fill();

  // Grid lines
  ctx.strokeStyle = 'rgba(100, 100, 160, 0.15)';
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(boardX, boardY + r * cellSize);
    ctx.lineTo(boardX + COLS * cellSize, boardY + r * cellSize);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(boardX + c * cellSize, boardY);
    ctx.lineTo(boardX + c * cellSize, boardY + ROWS * cellSize);
    ctx.stroke();
  }

  // Draw gems
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (!cell || cell.type < 0) continue;

      // Skip gems being animated
      if (swapAnim && ((swapAnim.r1 === r && swapAnim.c1 === c) ||
                        (swapAnim.r2 === r && swapAnim.c2 === c))) continue;
      if (fallAnims.some(fa => fa.toR === r && fa.col === c && fa.progress < 1)) continue;
      if (matchAnim && matchAnim.cells.some(m => m[0] === r && m[1] === c)) {
        // Draw shrinking
        const t = matchAnim.progress;
        const scale = 1 - t;
        const gx = boardX + c * cellSize;
        const gy = boardY + r * cellSize;
        ctx.save();
        ctx.translate(gx + cellSize / 2, gy + cellSize / 2);
        ctx.scale(scale, scale);
        ctx.translate(-cellSize / 2, -cellSize / 2);
        drawGem(0, 0, cellSize, cell.type, cell.special, 1 - t * 0.5);
        if (cell.blocker) drawBlocker(0, 0, cellSize, cell.blocker);
        ctx.restore();
        continue;
      }

      const gx = boardX + c * cellSize;
      const gy = boardY + r * cellSize;

      // Selected highlight
      if (selected && selected.r === r && selected.c === c) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
        ctx.fillRect(gx, gy, cellSize, cellSize);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.strokeRect(gx + 1, gy + 1, cellSize - 2, cellSize - 2);
      }

      // Hover highlight
      if (hoverCell && hoverCell.r === r && hoverCell.c === c && !selected) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
        ctx.fillRect(gx, gy, cellSize, cellSize);
      }

      drawGem(gx, gy, cellSize, cell.type, cell.special);
      if (cell.blocker) drawBlocker(gx, gy, cellSize, cell.blocker);
    }
  }

  // Draw swap animation
  if (swapAnim) {
    const t = easeInOutQuad(swapAnim.progress);
    const x1 = boardX + lerp(swapAnim.c1, swapAnim.c2, t) * cellSize;
    const y1 = boardY + lerp(swapAnim.r1, swapAnim.r2, t) * cellSize;
    const x2 = boardX + lerp(swapAnim.c2, swapAnim.c1, t) * cellSize;
    const y2 = boardY + lerp(swapAnim.r2, swapAnim.r1, t) * cellSize;
    const cell1 = board[swapAnim.r1][swapAnim.c1];
    const cell2 = board[swapAnim.r2][swapAnim.c2];
    if (cell1 && cell1.type >= 0) drawGem(x1, y1, cellSize, cell1.type, cell1.special);
    if (cell2 && cell2.type >= 0) drawGem(x2, y2, cellSize, cell2.type, cell2.special);
  }

  // Draw fall animations
  for (const fa of fallAnims) {
    if (fa.progress >= 1) continue;
    const t = easeOutBounce(fa.progress);
    const yy = boardY + lerp(fa.fromR, fa.toR, t) * cellSize;
    const xx = boardX + fa.col * cellSize;
    if (fa.cell && fa.cell.type >= 0) {
      drawGem(xx, yy, cellSize, fa.cell.type, fa.cell.special);
    }
  }

  // Draw particles
  for (const p of particles) {
    const life = 1 - p.age / p.maxAge;
    ctx.globalAlpha = life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * life, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Draw combo texts
  for (const ct of comboTexts) {
    const life = 1 - ct.age / ct.maxAge;
    ctx.globalAlpha = life;
    ctx.fillStyle = ct.color;
    ctx.font = `bold ${ct.size}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(ct.text, ct.x, ct.y - ct.age * 0.05);
    ctx.globalAlpha = 1;
  }

  ctx.restore(); // screen shake

  // Draw header info
  drawHeader();
}

function drawHeader() {
  if (showingLevelSelect) return;
  if (!levelObj) return;

  ctx.fillStyle = '#a855f7';
  ctx.font = "bold 13px 'Space Grotesk', sans-serif";
  ctx.textAlign = 'left';
  ctx.fillText(STATES[currentLevel] || `Fase ${currentLevel + 1}`, boardX, 20);

  ctx.fillStyle = '#8888aa';
  ctx.font = "12px 'Space Grotesk', sans-serif";
  let objText = '';
  if (levelObj.type === 'score') {
    objText = `Meta: ${levelObj.current}/${levelObj.target} pts`;
  } else if (levelObj.type === 'collect') {
    objText = `Coletar ${GEMS[levelObj.gemType].name}: ${levelObj.current}/${levelObj.target}`;
  } else if (levelObj.type === 'clear') {
    objText = `Bloqueadores: ${levelObj.current}/${levelObj.target}`;
  }
  ctx.fillText(objText, boardX, 38);

  // Progress bar
  const barW = cellSize * COLS;
  const barH = 6;
  const barY = 46;
  const progress = Math.min(1, levelObj.current / levelObj.target);
  ctx.fillStyle = '#1e1e32';
  ctx.beginPath();
  ctx.roundRect(boardX, barY, barW, barH, 3);
  ctx.fill();
  const gradBar = ctx.createLinearGradient(boardX, 0, boardX + barW * progress, 0);
  gradBar.addColorStop(0, '#a855f7');
  gradBar.addColorStop(1, '#06b6d4');
  ctx.fillStyle = gradBar;
  ctx.beginPath();
  ctx.roundRect(boardX, barY, barW * progress, barH, 3);
  ctx.fill();
}

// ---- Level Select ----
function drawLevelSelect() {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, CW, CH);

  ctx.fillStyle = '#a855f7';
  ctx.font = "bold 16px 'Press Start 2P', monospace";
  ctx.textAlign = 'center';
  ctx.fillText('Escolha a Fase', CW / 2, 36);

  const cols = 5;
  const pad = 8;
  const btnSize = Math.min(50, (CW - pad * (cols + 1)) / cols);
  const startY = 60;

  for (let i = 0; i < 27; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * (btnSize + pad) + (CW - cols * (btnSize + pad) + pad) / 2;
    const y = startY + row * (btnSize + pad + 14);
    const unlocked = i <= maxUnlocked;

    // Button bg
    if (unlocked) {
      ctx.fillStyle = i === currentLevel ? '#7c3aed' : '#1e1e32';
      ctx.strokeStyle = '#a855f7';
    } else {
      ctx.fillStyle = '#111';
      ctx.strokeStyle = '#333';
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, btnSize, btnSize, 8);
    ctx.fill();
    ctx.stroke();

    // Number
    ctx.fillStyle = unlocked ? '#fff' : '#555';
    ctx.font = "bold 14px 'VT323', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x + btnSize / 2, y + btnSize / 2 - 4);

    // State name (abbreviated)
    if (unlocked) {
      ctx.fillStyle = '#8888aa';
      ctx.font = "8px 'Space Grotesk', sans-serif";
      const abbr = STATES[i].substring(0, 5);
      ctx.fillText(abbr, x + btnSize / 2, y + btnSize - 4);
    }

    // Lock icon
    if (!unlocked) {
      ctx.fillStyle = '#555';
      ctx.font = '16px sans-serif';
      ctx.fillText('\u{1f512}', x + btnSize / 2, y + btnSize / 2 + 2);
    }
  }
  ctx.textBaseline = 'alphabetic';
}

function handleLevelSelectClick(mx, my) {
  const cols = 5;
  const pad = 8;
  const btnSize = Math.min(50, (CW - pad * (cols + 1)) / cols);
  const startY = 60;

  for (let i = 0; i < 27; i++) {
    if (i > maxUnlocked) continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * (btnSize + pad) + (CW - cols * (btnSize + pad) + pad) / 2;
    const y = startY + row * (btnSize + pad + 14);
    if (mx >= x && mx <= x + btnSize && my >= y && my <= y + btnSize) {
      currentLevel = i;
      startLevel(currentLevel);
      return;
    }
  }
}

// ---- Core Game Logic ----
function startLevel(lvl) {
  showingLevelSelect = false;
  const { board: b, objective } = generateLevel(lvl);
  board = b;
  levelObj = objective;
  score = 0;
  moves = 0;
  totalCascades = 0;
  cascadeMultiplier = 1;
  selected = null;
  animating = false;
  swapAnim = null;
  fallAnims = [];
  matchAnim = null;
  particles = [];
  comboTexts = [];
  screenShake = { x: 0, y: 0, time: 0 };
  gameRunning = true;

  if (levelObj.type === 'score') levelObj.current = 0;

  updateDisplays();
  overlay.classList.add('hidden');
}

function updateDisplays() {
  scoreDisplay.textContent = score;
  levelDisplay.textContent = currentLevel + 1;
  movesDisplay.textContent = moves;
}

function findMatches() {
  const matched = new Set();

  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 2; c++) {
      const t = board[r][c]?.type;
      if (t == null || t < 0) continue;
      let len = 1;
      while (c + len < COLS && board[r][c + len]?.type === t) len++;
      if (len >= 3) {
        for (let i = 0; i < len; i++) matched.add(`${r},${c + i}`);
      }
      if (len > 1) c += len - 2;
    }
  }

  // Vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 2; r++) {
      const t = board[r][c]?.type;
      if (t == null || t < 0) continue;
      let len = 1;
      while (r + len < ROWS && board[r + len][c]?.type === t) len++;
      if (len >= 3) {
        for (let i = 0; i < len; i++) matched.add(`${r + i},${c}`);
      }
      if (len > 1) r += len - 2;
    }
  }

  return [...matched].map(s => s.split(',').map(Number));
}

function detectSpecials(matches) {
  // Group matches into connected components per type
  const cells = new Set(matches.map(m => `${m[0]},${m[1]}`));
  const specials = [];

  // Check for 5+ in a line -> RAINBOW
  // Check for 4 in a line -> LIGHTNING
  // Check for L/T shape -> BOMB

  // Horizontal lines
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      if (!cells.has(`${r},${c}`)) { c++; continue; }
      const t = board[r][c].type;
      let len = 0;
      while (c + len < COLS && cells.has(`${r},${c + len}`) && board[r][c + len]?.type === t) len++;
      if (len >= 5) {
        specials.push({ r, c: c + Math.floor(len / 2), type: SPECIAL.RAINBOW, gemType: t });
      } else if (len === 4) {
        specials.push({ r, c: c + 1, type: SPECIAL.LIGHTNING, gemType: t });
      }
      c += len;
    }
  }

  // Vertical lines
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      if (!cells.has(`${r},${c}`)) { r++; continue; }
      const t = board[r][c].type;
      let len = 0;
      while (r + len < ROWS && cells.has(`${r + len},${c}`) && board[r + len][c]?.type === t) len++;
      if (len >= 5) {
        specials.push({ r: r + Math.floor(len / 2), c, type: SPECIAL.RAINBOW, gemType: t });
      } else if (len === 4) {
        specials.push({ r: r + 1, c, type: SPECIAL.LIGHTNING, gemType: t });
      }
      r += len;
    }
  }

  // L/T detection: cells that appear in both horizontal and vertical matches
  for (const key of cells) {
    const [mr, mc] = key.split(',').map(Number);
    const t = board[mr][mc]?.type;
    if (t == null || t < 0) continue;
    // Check if part of both H and V match
    let hLen = 1, vLen = 1;
    let cl = mc - 1;
    while (cl >= 0 && cells.has(`${mr},${cl}`) && board[mr][cl]?.type === t) { hLen++; cl--; }
    let cr = mc + 1;
    while (cr < COLS && cells.has(`${mr},${cr}`) && board[mr][cr]?.type === t) { hLen++; cr++; }
    let ru = mr - 1;
    while (ru >= 0 && cells.has(`${ru},${mc}`) && board[ru][mc]?.type === t) { vLen++; ru--; }
    let rd = mr + 1;
    while (rd < ROWS && cells.has(`${rd},${mc}`) && board[rd][mc]?.type === t) { vLen++; rd++; }
    if (hLen >= 3 && vLen >= 3) {
      // This is an L or T intersection
      if (!specials.some(s => s.r === mr && s.c === mc)) {
        specials.push({ r: mr, c: mc, type: SPECIAL.BOMB, gemType: t });
      }
    }
  }

  return specials;
}

function triggerSpecial(r, c, special, gemType) {
  const extraCells = [];
  if (special === SPECIAL.LIGHTNING) {
    // Clear entire row or column (random)
    if (Math.random() < 0.5) {
      for (let cc = 0; cc < COLS; cc++) extraCells.push([r, cc]);
    } else {
      for (let rr = 0; rr < ROWS; rr++) extraCells.push([rr, c]);
    }
    addScreenShake(6);
  } else if (special === SPECIAL.BOMB) {
    // 3x3 area
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) extraCells.push([nr, nc]);
      }
    }
    addScreenShake(8);
  } else if (special === SPECIAL.RAINBOW) {
    // Clear all gems of a specific type (use the swapped-with gem type, or random)
    const targetType = gemType >= 0 ? gemType : Math.floor(Math.random() * GEM_TYPES);
    for (let rr = 0; rr < ROWS; rr++) {
      for (let cc = 0; cc < COLS; cc++) {
        if (board[rr][cc] && board[rr][cc].type === targetType) extraCells.push([rr, cc]);
      }
    }
    addScreenShake(10);
  }
  return extraCells;
}

function processMatches(matchedCells) {
  const specials = detectSpecials(matchedCells);
  let allCells = [...matchedCells];

  // Trigger existing specials on matched cells
  for (const [r, c] of matchedCells) {
    const cell = board[r][c];
    if (cell && cell.special !== SPECIAL.NONE) {
      const extra = triggerSpecial(r, c, cell.special, cell.type);
      for (const e of extra) {
        if (!allCells.some(a => a[0] === e[0] && a[1] === e[1])) {
          allCells.push(e);
        }
      }
    }
  }

  // Calculate score
  const baseScore = allCells.length <= 3 ? 100 : allCells.length === 4 ? 250 : 500;
  const earned = Math.floor(baseScore * cascadeMultiplier);
  score += earned;

  // Update objective
  if (levelObj.type === 'score') {
    levelObj.current = score;
  } else if (levelObj.type === 'collect') {
    for (const [r, c] of allCells) {
      if (board[r][c] && board[r][c].type === levelObj.gemType) levelObj.current++;
    }
  }

  // Spawn particles
  for (const [r, c] of allCells) {
    const cell = board[r][c];
    if (!cell) continue;
    const px = boardX + c * cellSize + cellSize / 2;
    const py = boardY + r * cellSize + cellSize / 2;
    const color = cell.type >= 0 ? GEMS[cell.type].c1 : '#fff';
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: px, y: py,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2,
        size: 3 + Math.random() * 3,
        color,
        age: 0, maxAge: PARTICLE_LIFE + Math.random() * 200
      });
    }

    // Handle blockers
    if (cell.blocker !== BLOCKER.NONE) {
      if (cell.blocker === BLOCKER.STONE) {
        cell.blocker = BLOCKER.ICE; // stone -> ice first
        // Don't remove the gem, just downgrade blocker
        // Remove from allCells so gem stays
        continue;
      } else {
        cell.blocker = BLOCKER.NONE;
        if (levelObj.type === 'clear') levelObj.current++;
      }
    }
  }

  // Create specials before removing
  for (const s of specials) {
    if (board[s.r][s.c]) {
      board[s.r][s.c] = { type: s.gemType, special: s.type, blocker: BLOCKER.NONE };
      // Remove this cell from the "to-clear" list so the special gem persists
      allCells = allCells.filter(a => !(a[0] === s.r && a[1] === s.c));
    }
  }

  // Remove matched gems (but not blocker-only downgrades)
  for (const [r, c] of allCells) {
    if (board[r][c] && board[r][c].blocker === BLOCKER.NONE) {
      board[r][c] = null;
    }
  }

  // Combo text
  if (cascadeMultiplier > 1) {
    comboTexts.push({
      text: `x${cascadeMultiplier} COMBO! +${earned}`,
      x: CW / 2,
      y: boardY + cellSize * ROWS / 2,
      size: 18 + cascadeMultiplier * 2,
      color: cascadeMultiplier >= 4 ? '#fbbf24' : '#a855f7',
      age: 0, maxAge: 1200
    });
  } else if (earned >= 250) {
    comboTexts.push({
      text: `+${earned}`,
      x: CW / 2,
      y: boardY + cellSize * ROWS / 2,
      size: 20,
      color: '#06b6d4',
      age: 0, maxAge: 800
    });
  }

  return allCells;
}

function applyGravity() {
  const falls = [];
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    // Move existing gems down
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c] !== null) {
        if (r !== writeRow) {
          falls.push({ col: c, fromR: r, toR: writeRow, cell: board[r][c] });
          board[writeRow][c] = board[r][c];
          board[r][c] = null;
        }
        writeRow--;
      }
    }
    // Fill empty cells at top with new gems
    for (let r = writeRow; r >= 0; r--) {
      const newType = Math.floor(Math.random() * GEM_TYPES);
      const cell = { type: newType, special: SPECIAL.NONE, blocker: BLOCKER.NONE };
      board[r][c] = cell;
      falls.push({ col: c, fromR: r - (writeRow - r + 1), toR: r, cell });
    }
  }
  return falls;
}

function isAdjacent(r1, c1, r2, c2) {
  return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
}

function hasValidMoves() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Try swap right
      if (c + 1 < COLS) {
        swapCells(r, c, r, c + 1);
        if (findMatches().length > 0) { swapCells(r, c, r, c + 1); return true; }
        swapCells(r, c, r, c + 1);
      }
      // Try swap down
      if (r + 1 < ROWS) {
        swapCells(r, c, r + 1, c);
        if (findMatches().length > 0) { swapCells(r, c, r + 1, c); return true; }
        swapCells(r, c, r + 1, c);
      }
    }
  }
  return false;
}

function swapCells(r1, c1, r2, c2) {
  const tmp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = tmp;
}

function checkLevelComplete() {
  if (!levelObj) return false;
  return levelObj.current >= levelObj.target;
}

function shuffleBoard() {
  // Flatten, shuffle, redistribute
  const gems = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) gems.push(board[r][c]);

  for (let i = gems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gems[i], gems[j]] = [gems[j], gems[i]];
  }

  let idx = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      board[r][c] = gems[idx++] || { type: Math.floor(Math.random() * GEM_TYPES), special: SPECIAL.NONE, blocker: BLOCKER.NONE };

  comboTexts.push({
    text: 'Embaralhando...',
    x: CW / 2, y: CH / 2,
    size: 20, color: '#fbbf24',
    age: 0, maxAge: 1500
  });
}

// ---- Animation helpers ----
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function easeOutBounce(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

function addScreenShake(intensity) {
  screenShake.time = 300;
  screenShake.intensity = intensity;
}

// ---- Swap + Cascade Pipeline ----
async function doSwap(r1, c1, r2, c2) {
  if (animating) return;
  animating = true;
  moves++;
  updateDisplays();

  // Animate swap
  swapAnim = { r1, c1, r2, c2, progress: 0 };
  await animate(ANIM_SWAP, t => { swapAnim.progress = t; });
  swapAnim = null;

  // Actually swap in data
  swapCells(r1, c1, r2, c2);

  // Check for matches
  let matches = findMatches();
  if (matches.length === 0) {
    // Swap back
    swapAnim = { r1: r2, c1: c2, r2: r1, c2: c1, progress: 0 };
    await animate(ANIM_SWAP, t => { swapAnim.progress = t; });
    swapAnim = null;
    swapCells(r1, c1, r2, c2);
    moves--; // don't count invalid moves
    updateDisplays();
    animating = false;
    return;
  }

  // Cascade loop
  cascadeMultiplier = 1;
  while (matches.length > 0) {
    // Match animation
    matchAnim = { cells: matches, progress: 0 };
    await animate(ANIM_MATCH, t => { matchAnim.progress = t; });
    matchAnim = null;

    processMatches(matches);
    updateDisplays();

    // Apply gravity
    const falls = applyGravity();
    if (falls.length > 0) {
      fallAnims = falls.map(f => ({ ...f, progress: 0 }));
      const maxDist = Math.max(...falls.map(f => Math.abs(f.toR - f.fromR)));
      await animate(ANIM_FALL * maxDist, t => {
        for (const fa of fallAnims) fa.progress = Math.min(1, t * (maxDist / Math.max(1, Math.abs(fa.toR - fa.fromR))));
      });
      fallAnims = [];
    }

    cascadeMultiplier++;
    totalCascades++;
    matches = findMatches();
  }

  // Check level complete
  if (checkLevelComplete()) {
    gameRunning = false;
    await sleep(500);
    levelComplete();
  } else if (!hasValidMoves()) {
    shuffleBoard();
    // Recheck after shuffle
    let m = findMatches();
    while (m.length > 0) {
      processMatches(m);
      applyGravity();
      m = findMatches();
    }
  }

  animating = false;
}

function animate(duration, updateFn) {
  return new Promise(resolve => {
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      updateFn(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---- Level Complete / Game Over ----
function levelComplete() {
  if (currentLevel >= maxUnlocked) {
    maxUnlocked = Math.min(26, currentLevel + 1);
    saveProgress();
  }

  overlayIcon.textContent = '\u{1f389}';
  overlayTitle.textContent = `${STATES[currentLevel]} Conquistado!`;
  overlayMsg.textContent = currentLevel < 26
    ? `Parabens! Proximo: ${STATES[currentLevel + 1]}`
    : 'Voce conquistou todos os estados do Brasil!';
  overlayScore.textContent = `${score} pts | ${moves} movimentos`;
  btnStart.textContent = currentLevel < 26 ? 'Proxima Fase' : 'Jogar Novamente';
  btnShare.style.display = 'inline-block';
  overlay.classList.remove('hidden');

  // Callback
  if (onGameEnd) {
    onGameEnd({ game: 'combina3', score, details: { level: currentLevel + 1, moves, cascades: totalCascades } });
  }
  window.onGameEnd?.({ game: 'combina3', score, details: { level: currentLevel + 1, moves, cascades: totalCascades } });
}

// ---- Input Handling ----
function getCellFromPos(px, py) {
  const c = Math.floor((px - boardX) / cellSize);
  const r = Math.floor((py - boardY) / cellSize);
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return { r, c };
  return null;
}

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CW / rect.width;
  const scaleY = CH / rect.height;
  let clientX, clientY;
  if (e.touches) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function handleClick(cell) {
  if (!gameRunning || animating) return;

  if (showingLevelSelect) return; // handled separately

  if (!selected) {
    selected = cell;
  } else {
    if (selected.r === cell.r && selected.c === cell.c) {
      selected = null;
    } else if (isAdjacent(selected.r, selected.c, cell.r, cell.c)) {
      doSwap(selected.r, selected.c, cell.r, cell.c);
      selected = null;
    } else {
      selected = cell;
    }
  }
}

// Mouse events
canvas.addEventListener('mousedown', e => {
  const pos = getCanvasPos(e);
  if (showingLevelSelect) {
    handleLevelSelectClick(pos.x, pos.y);
    return;
  }
  const cell = getCellFromPos(pos.x, pos.y);
  if (cell) {
    dragStart = { ...cell, px: pos.x, py: pos.y };
  }
});

canvas.addEventListener('mousemove', e => {
  const pos = getCanvasPos(e);
  hoverCell = getCellFromPos(pos.x, pos.y);
  if (dragStart) dragCurrent = pos;
});

canvas.addEventListener('mouseup', e => {
  const pos = getCanvasPos(e);
  if (dragStart && dragCurrent) {
    const dx = dragCurrent.x - dragStart.px;
    const dy = dragCurrent.y - dragStart.py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > cellSize * 0.3) {
      // Determine drag direction
      let dr = 0, dc = 0;
      if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1;
      else dr = dy > 0 ? 1 : -1;
      const tr = dragStart.r + dr, tc = dragStart.c + dc;
      if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS) {
        selected = null;
        doSwap(dragStart.r, dragStart.c, tr, tc);
      }
      dragStart = null;
      dragCurrent = null;
      return;
    }
  }
  dragStart = null;
  dragCurrent = null;
  const cell = getCellFromPos(pos.x, pos.y);
  if (cell) handleClick(cell);
});

canvas.addEventListener('mouseleave', () => {
  hoverCell = null;
  dragStart = null;
  dragCurrent = null;
});

// Touch events
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const pos = getCanvasPos(e);
  if (showingLevelSelect) {
    handleLevelSelectClick(pos.x, pos.y);
    return;
  }
  const cell = getCellFromPos(pos.x, pos.y);
  if (cell) {
    dragStart = { ...cell, px: pos.x, py: pos.y };
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (dragStart) {
    dragCurrent = getCanvasPos(e);
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (dragStart && dragCurrent) {
    const dx = dragCurrent.x - dragStart.px;
    const dy = dragCurrent.y - dragStart.py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > cellSize * 0.3) {
      let dr = 0, dc = 0;
      if (Math.abs(dx) > Math.abs(dy)) dc = dx > 0 ? 1 : -1;
      else dr = dy > 0 ? 1 : -1;
      const tr = dragStart.r + dr, tc = dragStart.c + dc;
      if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS) {
        selected = null;
        doSwap(dragStart.r, dragStart.c, tr, tc);
      }
      dragStart = null;
      dragCurrent = null;
      return;
    }
  }

  // Tap
  if (dragStart) {
    const cell = { r: dragStart.r, c: dragStart.c };
    handleClick(cell);
  }
  dragStart = null;
  dragCurrent = null;
});

// ---- Button Events ----
btnStart.addEventListener('click', () => {
  if (!gameRunning && !showingLevelSelect) {
    if (overlayTitle.textContent.includes('Conquistado') || overlayTitle.textContent.includes('Combina 3')) {
      if (currentLevel < 26 && overlayTitle.textContent.includes('Conquistado')) {
        currentLevel++;
      }
      startLevel(currentLevel);
    } else {
      showingLevelSelect = true;
      overlay.classList.add('hidden');
    }
  } else {
    startLevel(currentLevel);
  }
});

btnShare.addEventListener('click', () => {
  const text = `Completei a fase ${currentLevel + 1} (${STATES[currentLevel]}) no Combina 3 com ${score} pontos! Jogue tambem: https://gameshub.com.br/games/combina3/`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
});

// ---- Main Loop ----
let lastTime = 0;

function gameLoop(time) {
  const dt = time - lastTime;
  lastTime = time;

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // gravity
    if (p.age >= p.maxAge) particles.splice(i, 1);
  }

  // Update combo texts
  for (let i = comboTexts.length - 1; i >= 0; i--) {
    comboTexts[i].age += dt;
    if (comboTexts[i].age >= comboTexts[i].maxAge) comboTexts.splice(i, 1);
  }

  // Update screen shake
  if (screenShake.time > 0) {
    screenShake.time -= dt;
    const intensity = screenShake.intensity * (screenShake.time / 300);
    screenShake.x = (Math.random() - 0.5) * intensity;
    screenShake.y = (Math.random() - 0.5) * intensity;
    if (screenShake.time <= 0) {
      screenShake.x = 0;
      screenShake.y = 0;
    }
  }

  // Draw
  if (showingLevelSelect) {
    drawLevelSelect();
  } else {
    drawBoard();
  }

  requestAnimationFrame(gameLoop);
}

// ---- Init ----
loadProgress();
resize();

// Show initial modal
overlayTitle.textContent = 'Combina 3';
overlayMsg.textContent = 'Combine joias brasileiras e conquiste todos os 27 estados!';
overlayScore.textContent = '';
btnStart.textContent = 'Jogar';
btnShare.style.display = 'none';
overlay.classList.remove('hidden');

requestAnimationFrame(gameLoop);
