import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { ParticlePool, Trail, FloatingText } from '../shared/game-2d-utils.js';
// =============================================
//  BUBBLE SHOOTER — game.js
// =============================================
import { supabase } from '../../supabase.js';

// ---- DOM ----
const canvas       = document.getElementById('game-canvas');
const ctx          = canvas.getContext('2d');
const overlay      = document.getElementById('overlay');
const overlayIcon  = document.getElementById('overlay-icon');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg   = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const btnStart     = document.getElementById('btn-start');
const scoreDisplay = document.getElementById('score-display');
const shotsDisplay = document.getElementById('shots-display');

// ---- Constants ----
const COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#9c27b0', '#ff6d00'];
const R      = 18;          // bubble radius
const COL_W  = R * 2;       // 36px column width
const ROW_H  = R * 1.8;     // ~32px row height
const COLS   = 10;
const INIT_ROWS    = 8;
const SHOTS_PER_ROW = 5;    // new row every N shots
const GAME_OVER_ROW = 13;   // if bubbles reach this visual row index, game over

// Canvas logical size (CSS max-width handles scaling)
const CW = 360;
const CH = 600;

// ---- State ----
let grid          = [];   // grid[row][col] = color | null
let shooter       = null; // { color }
let nextBubble    = null; // { color }
let flyingBubble  = null; // { x, y, dx, dy, color }
let aimAngle      = Math.PI / 2; // radians from positive-x axis (90° = up)
let score         = 0;
let shotsFired    = 0;
let shotsUntilNewRow = SHOTS_PER_ROW;
let gameRunning   = false;
let gameOver      = false;
let won           = false;
let startTime     = 0;
let animFrameId   = null;

// Pop animations
let popParticles  = []; // { x, y, color, r, alpha, vx, vy }
let floatParticles = []; // same but green tint

// 2D Effects
const particles = new ParticlePool(200);
const bubbleTrail = new Trail(12);
const floatingTexts = new FloatingText();

// Shooter base position
const SHOOTER_X = CW / 2;
const SHOOTER_Y = CH - 30;

// =============================================
//  CANVAS SETUP
// =============================================
function setupCanvas() {
  canvas.width  = CW;
  canvas.height = CH;
  // CSS will scale it to fit the container
  canvas.style.maxWidth  = '100%';
  canvas.style.maxHeight = '100%';
  canvas.style.width     = 'auto';
  canvas.style.height    = 'auto';
}

// =============================================
//  GRID HELPERS
// =============================================
function bubbleX(col, row) {
  const offset = (row % 2 === 1) ? R : 0;
  return R + col * COL_W + offset;
}

function bubbleY(row) {
  return R + row * ROW_H;
}

function nearestGridSlot(px, py) {
  // Find the grid slot closest to (px, py) that is empty
  let bestDist = Infinity;
  let bestRow = -1, bestCol = -1;

  const rowMax = Math.ceil((SHOOTER_Y - R) / ROW_H) + 1;
  for (let r = 0; r < rowMax; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r] && grid[r][c] !== null) continue; // occupied
      const gx = bubbleX(c, r);
      const gy = bubbleY(r);
      const d = Math.hypot(px - gx, py - gy);
      if (d < bestDist) {
        bestDist = d;
        bestRow = r;
        bestCol = c;
      }
    }
  }
  return { row: bestRow, col: bestCol };
}

function ensureRow(r) {
  while (grid.length <= r) grid.push(new Array(COLS).fill(null));
}

function initGrid() {
  grid = [];
  for (let r = 0; r < INIT_ROWS; r++) {
    ensureRow(r);
    for (let c = 0; c < COLS; c++) {
      // Odd rows have one fewer bubble on the right end for the offset hex layout
      const maxC = (r % 2 === 1) ? COLS - 1 : COLS;
      if (c < maxC) {
        grid[r][c] = COLORS[Math.floor(Math.random() * COLORS.length)];
      }
    }
  }
}

function getColorsOnGrid() {
  const colors = new Set();
  for (const row of grid) {
    if (!row) continue;
    for (const c of row) {
      if (c) colors.add(c);
    }
  }
  return [...colors];
}

function randomColor() {
  const present = getColorsOnGrid();
  if (present.length === 0) return COLORS[Math.floor(Math.random() * COLORS.length)];
  return present[Math.floor(Math.random() * present.length)];
}

function countBubbles() {
  let n = 0;
  for (const row of grid) {
    if (!row) continue;
    for (const c of row) { if (c) n++; }
  }
  return n;
}

// =============================================
//  BFS — FLOOD FILL FOR MATCHING COLOR
// =============================================
function neighbors(row, col) {
  const nbrs = [];
  // Hex grid neighbors depend on whether row is even or odd
  if (row % 2 === 0) {
    // Even row
    nbrs.push([row-1, col-1], [row-1, col]);
    nbrs.push([row,   col-1], [row,   col+1]);
    nbrs.push([row+1, col-1], [row+1, col]);
  } else {
    // Odd row
    nbrs.push([row-1, col], [row-1, col+1]);
    nbrs.push([row,   col-1], [row,   col+1]);
    nbrs.push([row+1, col], [row+1, col+1]);
  }
  return nbrs.filter(([r, c]) => r >= 0 && c >= 0 && c < COLS && grid[r] && grid[r][c] !== null);
}

function findConnectedSameColor(startRow, startCol) {
  const color = grid[startRow][startCol];
  const visited = new Set();
  const queue = [[startRow, startCol]];
  const key = (r, c) => r * 100 + c;
  visited.add(key(startRow, startCol));

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    for (const [nr, nc] of neighbors(r, c)) {
      const k = key(nr, nc);
      if (!visited.has(k) && grid[nr] && grid[nr][nc] === color) {
        visited.add(k);
        queue.push([nr, nc]);
      }
    }
  }
  return [...visited].map(k => [Math.floor(k / 100), k % 100]);
}

// =============================================
//  FLOATING BUBBLES (not connected to top row)
// =============================================
function findFloating() {
  // BFS from all top-row bubbles; anything not reached is floating
  const visited = new Set();
  const key = (r, c) => r * 100 + c;
  const queue = [];

  // Seed from row 0
  if (grid[0]) {
    for (let c = 0; c < COLS; c++) {
      if (grid[0][c]) {
        visited.add(key(0, c));
        queue.push([0, c]);
      }
    }
  }

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    for (const [nr, nc] of neighbors(r, c)) {
      const k = key(nr, nc);
      if (!visited.has(k) && grid[nr] && grid[nr][nc]) {
        visited.add(k);
        queue.push([nr, nc]);
      }
    }
  }

  // Collect all bubbles NOT in visited
  const floating = [];
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r]) continue;
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] && !visited.has(key(r, c))) {
        floating.push([r, c]);
      }
    }
  }
  return floating;
}

// =============================================
//  SPAWN POP PARTICLES
// =============================================
function spawnPopParticles(x, y, color, isFloat) {
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
    const speed = 1.5 + Math.random() * 2;
    popParticles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: isFloat ? '#69f0ae' : color,
      r: R * 0.7,
      alpha: 1,
    });
  }
}

// =============================================
//  POP BUBBLES — process match after landing
// =============================================
function processPop(row, col) {
  const matched = findConnectedSameColor(row, col);
  if (matched.length < 3) return 0;

  playSound('pop');

  let pts = 0;
  let centerX = 0, centerY = 0;
  for (const [r, c] of matched) {
    const bx = bubbleX(c, r);
    const by = bubbleY(r);
    spawnPopParticles(bx, by, grid[r][c], false);
    // Particle burst
    particles.spawnBurst(bx, by, 8, {
      colors: [grid[r][c], '#fff'],
      speed: 3,
      life: 25
    });
    centerX += bx;
    centerY += by;
    grid[r][c] = null;
    pts += 10;
  }

  // Floating text for combo
  if (matched.length >= 3) {
    centerX /= matched.length;
    centerY /= matched.length;
    floatingTexts.add(centerX, centerY - 20, `+${pts}`, {
      color: '#69f0ae',
      vy: -1.2,
      life: 35
    });
  }

  // Now find floating bubbles
  const floating = findFloating();
  for (const [r, c] of floating) {
    spawnPopParticles(bubbleX(c, r), bubbleY(r), grid[r][c], true);
    // Particle burst for floating bubbles
    particles.spawnBurst(bubbleX(c, r), bubbleY(r), 6, {
      colors: ['#69f0ae', grid[r][c]],
      speed: 4,
      life: 30
    });
    grid[r][c] = null;
    pts += 5;
  }

  return pts;
}

// =============================================
//  ADD NEW ROW AT TOP (push existing down)
// =============================================
function addNewRow() {
  // Insert a new row at index 0; shift everything down
  const newRow = [];
  for (let c = 0; c < COLS; c++) {
    const maxC = (0 % 2 === 1) ? COLS - 1 : COLS; // new row will be row 0 = even
    newRow.push(c < maxC ? COLORS[Math.floor(Math.random() * COLORS.length)] : null);
  }
  grid.unshift(newRow);
}

// =============================================
//  CHECK GAME OVER (bubbles too low)
// =============================================
function checkGameOver() {
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r]) continue;
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c]) {
        const y = bubbleY(r);
        if (y + R >= SHOOTER_Y - 20) return true;
      }
    }
  }
  return false;
}

// =============================================
//  CHECK WIN (grid empty)
// =============================================
function checkWin() {
  return countBubbles() === 0;
}

// =============================================
//  SHOOT — attach bubble to grid after flight
// =============================================
function landBubble(bx, by, color) {
  // Find best empty slot near landing position
  const { row, col } = nearestGridSlot(bx, by);

  if (row < 0 || col < 0) {
    // Fallback: just place at top
    ensureRow(0);
    for (let c = 0; c < COLS; c++) {
      if (!grid[0][c]) { grid[0][c] = color; break; }
    }
    return;
  }

  ensureRow(row);
  grid[row][col] = color;

  const gained = processPop(row, col);
  score += gained;
  scoreDisplay.textContent = score;

  // Shot counting
  shotsFired++;
  shotsDisplay.textContent = shotsFired;
  shotsUntilNewRow--;

  if (shotsUntilNewRow <= 0) {
    addNewRow();
    shotsUntilNewRow = SHOTS_PER_ROW;
  }

  if (checkWin()) {
    triggerWin();
  } else if (checkGameOver()) {
    triggerGameOver();
  } else {
    // Prepare next shot
    shooter    = nextBubble;
    nextBubble = { color: randomColor() };
    flyingBubble = null;
  }
}

// =============================================
//  SHOOT ACTION
// =============================================
function shootBubble() {
  if (flyingBubble || !gameRunning) return;

  playSound('shoot');

  const speed = 10;
  const dx = Math.cos(aimAngle) * speed;
  const dy = -Math.sin(aimAngle) * speed; // canvas Y is inverted

  flyingBubble = {
    x: SHOOTER_X,
    y: SHOOTER_Y,
    dx,
    dy,
    color: shooter.color,
  };
}

// =============================================
//  GAME OVER / WIN
// =============================================
async function triggerWin() {
  gameRunning = false;
  won = true;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);

  overlayIcon.textContent  = '🎉';
  overlayTitle.textContent = 'Você Venceu!';
  overlayMsg.textContent   = 'Incrível! Você limpou todas as bolhas!';
  overlayScore.textContent = `Pontuação: ${score} | Tiros: ${shotsFired} | Tempo: ${elapsed}s`;
  btnStart.textContent     = 'Jogar Novamente';
  overlay.classList.remove('hidden');
  launchConfetti();
  playSound('win');

  // Save stats to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('game_stats').insert({
        user_id:      user.id,
        game:         'bubble-shooter',
        result:       'win',
        score:        score,
        moves:        shotsFired,
        time_seconds: elapsed,
      });
    }
  } catch (e) {
    // silently ignore stats errors
  }
}

function triggerGameOver() {
  gameRunning = false;
  gameOver    = true;

  overlayIcon.textContent  = '💥';
  overlayTitle.textContent = 'Fim de Jogo!';
  overlayMsg.textContent   = 'As bolhas chegaram ao atirador!';
  overlayScore.textContent = `Pontuação: ${score} | Tiros: ${shotsFired}`;
  btnStart.textContent     = 'Tentar Novamente';
  overlay.classList.remove('hidden');
  playSound('gameover');
}

// =============================================
//  NEW GAME
// =============================================
function newGame() {
  initAudio();
  score        = 0;
  shotsFired   = 0;
  shotsUntilNewRow = SHOTS_PER_ROW;
  gameOver     = false;
  won          = false;
  gameRunning  = true;
  flyingBubble = null;
  popParticles = [];
  floatParticles = [];
  particles.clear();
  bubbleTrail.clear();
  floatingTexts.clear();
  startTime    = Date.now();

  scoreDisplay.textContent = '0';
  shotsDisplay.textContent = '0';

  initGrid();
  shooter    = { color: randomColor() };
  nextBubble = { color: randomColor() };

  overlay.classList.add('hidden');

  if (animFrameId) cancelAnimationFrame(animFrameId);
  loop();
}

// =============================================
//  DRAWING HELPERS
// =============================================
function drawBubble(x, y, color, radius) {
  ctx.save();

  // Shadow / glow
  ctx.shadowColor = color;
  ctx.shadowBlur  = 8;

  // Main fill
  const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
  grad.addColorStop(0, lighten(color, 60));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, darken(color, 40));

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Specular highlight
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(x - radius * 0.28, y - radius * 0.28, radius * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();

  ctx.restore();
}

function lighten(hex, amount) {
  return adjustColor(hex, amount);
}
function darken(hex, amount) {
  return adjustColor(hex, -amount);
}
function adjustColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function drawGrid() {
  for (let row = 0; row < grid.length; row++) {
    if (!grid[row]) continue;
    for (let col = 0; col < COLS; col++) {
      const color = grid[row][col];
      if (!color) continue;
      drawBubble(bubbleX(col, row), bubbleY(row), color, R);
    }
  }
}

function drawShooter() {
  const x = SHOOTER_X;
  const y = SHOOTER_Y;

  // Draw shooter bubble (current)
  if (shooter) drawBubble(x, y, shooter.color, R);

  // Draw arrow/barrel indicating aim direction
  const bLen = 40;
  const bx = x + Math.cos(aimAngle) * bLen;
  const by = y - Math.sin(aimAngle) * bLen;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.restore();
}

function drawAimLine() {
  // Draw dotted aim line bouncing off walls
  ctx.save();
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  let ax = SHOOTER_X;
  let ay = SHOOTER_Y;
  let adx = Math.cos(aimAngle);
  let ady = -Math.sin(aimAngle); // canvas Y inverted

  ctx.beginPath();
  ctx.moveTo(ax, ay);

  let totalLen = 0;
  const maxLen = CH * 1.5;
  const step   = 6;

  while (totalLen < maxLen) {
    ax += adx * step;
    ay += ady * step;
    totalLen += step;

    // Bounce off walls
    if (ax - R < 0) { ax = R; adx = Math.abs(adx); }
    if (ax + R > CW) { ax = CW - R; adx = -Math.abs(adx); }

    // Stop if hitting a bubble in the grid
    let hit = false;
    for (let row = 0; row < grid.length; row++) {
      if (!grid[row]) continue;
      for (let col = 0; col < COLS; col++) {
        if (!grid[row][col]) continue;
        const d = Math.hypot(ax - bubbleX(col, row), ay - bubbleY(row));
        if (d < R * 2) { hit = true; break; }
      }
      if (hit) break;
    }
    if (hit || ay < R) break;

    ctx.lineTo(ax, ay);
  }

  ctx.stroke();
  ctx.restore();
}

function drawNextBubble() {
  if (!nextBubble) return;
  const x = 40;
  const y = CH - 30;

  ctx.save();
  ctx.font = '600 11px Nunito, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'center';
  ctx.fillText('próx', x, y - R - 6);
  ctx.restore();

  drawBubble(x, y, nextBubble.color, R * 0.75);
}

function drawShotsCounter() {
  // Show "next row in N shots" indicator on canvas
  const barX = CW - 15;
  const barY = CH - 100;
  const barH = 80;
  const fraction = shotsUntilNewRow / SHOTS_PER_ROW;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(barX, barY + barH);
  ctx.lineTo(barX, barY);
  ctx.stroke();

  // Fill
  const fillH = barH * fraction;
  const grad = ctx.createLinearGradient(0, barY + barH - fillH, 0, barY + barH);
  grad.addColorStop(0, '#e53935');
  grad.addColorStop(1, '#fdd835');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(barX, barY + barH);
  ctx.lineTo(barX, barY + barH - fillH);
  ctx.stroke();

  ctx.font = '600 10px Nunito, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('↓', barX, barY - 4);

  ctx.restore();
}

function drawGameOverLine() {
  const lineY = SHOOTER_Y - 24;
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = 'rgba(229,57,53,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(CW, lineY);
  ctx.stroke();
  ctx.restore();
}

function drawFlyingBubble() {
  if (!flyingBubble) return;
  drawBubble(flyingBubble.x, flyingBubble.y, flyingBubble.color, R);
}

function drawParticles() {
  for (const p of popParticles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(1, p.color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawScore() {
  ctx.save();
  ctx.font = '700 14px Nunito, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 8, 22);
  ctx.restore();
}

// =============================================
//  UPDATE FLYING BUBBLE
// =============================================
function updateFlyingBubble() {
  if (!flyingBubble) return;

  // Add trail point
  bubbleTrail.addPoint(flyingBubble.x, flyingBubble.y, {
    color: flyingBubble.color,
    size: R * 0.6,
    life: 10
  });

  flyingBubble.x += flyingBubble.dx;
  flyingBubble.y += flyingBubble.dy;

  // Bounce off walls
  if (flyingBubble.x - R < 0) {
    flyingBubble.x = R;
    flyingBubble.dx = Math.abs(flyingBubble.dx);
  }
  if (flyingBubble.x + R > CW) {
    flyingBubble.x = CW - R;
    flyingBubble.dx = -Math.abs(flyingBubble.dx);
  }

  // Hit the top ceiling
  if (flyingBubble.y - R <= 0) {
    flyingBubble.y = R;
    landBubble(flyingBubble.x, flyingBubble.y, flyingBubble.color);
    return;
  }

  // Collision with grid bubbles
  for (let row = 0; row < grid.length; row++) {
    if (!grid[row]) continue;
    for (let col = 0; col < COLS; col++) {
      if (!grid[row][col]) continue;
      const gx = bubbleX(col, row);
      const gy = bubbleY(row);
      const d  = Math.hypot(flyingBubble.x - gx, flyingBubble.y - gy);
      if (d < R * 1.9) {
        landBubble(flyingBubble.x, flyingBubble.y, flyingBubble.color);
        return;
      }
    }
  }
}

// =============================================
//  UPDATE PARTICLES
// =============================================
function updateParticles() {
  for (const p of popParticles) {
    p.x     += p.vx;
    p.y     += p.vy;
    p.vy    += 0.12; // gravity
    p.r     *= 0.93;
    p.alpha *= 0.90;
  }
  popParticles = popParticles.filter(p => p.alpha > 0.05 && p.r > 1);
}

// =============================================
//  AIM ANGLE FROM POINTER POSITION
// =============================================
function updateAimFromPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CW / rect.width;
  const scaleY = CH / rect.height;
  const cx = (clientX - rect.left) * scaleX;
  const cy = (clientY - rect.top) * scaleY;

  let angle = Math.atan2(SHOOTER_Y - cy, cx - SHOOTER_X);
  // Clamp to 10° – 170° from horizontal (avoid shooting down)
  const minAngle = (10 * Math.PI) / 180;
  const maxAngle = (170 * Math.PI) / 180;
  angle = Math.max(minAngle, Math.min(maxAngle, angle));
  aimAngle = angle;
}

// =============================================
//  MAIN LOOP
// =============================================
function loop() {
  ctx.clearRect(0, 0, CW, CH);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#0a0a1e');
  bg.addColorStop(1, '#0f0f2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  if (!gameRunning) {
    // Still draw effects
    particles.update();
    particles.draw(ctx);
    floatingTexts.update();
    floatingTexts.draw(ctx);
    animFrameId = requestAnimationFrame(loop);
    return;
  }

  // Update 2D effects
  particles.update();
  bubbleTrail.update();
  floatingTexts.update();

  updateFlyingBubble();
  updateParticles();

  drawGameOverLine();
  drawGrid();
  drawAimLine();
  drawShooter();
  drawFlyingBubble();
  drawNextBubble();
  drawShotsCounter();
  drawParticles();

  // Draw 2D effects
  bubbleTrail.draw(ctx);
  particles.draw(ctx);
  floatingTexts.draw(ctx);

  animFrameId = requestAnimationFrame(loop);
}

// =============================================
//  INPUT EVENTS
// =============================================
// Mouse move — aim
canvas.addEventListener('mousemove', (e) => {
  if (!gameRunning || flyingBubble) return;
  updateAimFromPoint(e.clientX, e.clientY);
});

// Mouse click — shoot
canvas.addEventListener('click', (e) => {
  if (!gameRunning) return;
  if (flyingBubble) return;
  updateAimFromPoint(e.clientX, e.clientY);
  shootBubble();
});

// Touch move — aim
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!gameRunning || flyingBubble) return;
  const t = e.touches[0];
  updateAimFromPoint(t.clientX, t.clientY);
}, { passive: false });

// Touch end — shoot
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!gameRunning) return;
  if (flyingBubble) return;
  if (e.changedTouches.length > 0) {
    const t = e.changedTouches[0];
    updateAimFromPoint(t.clientX, t.clientY);
  }
  shootBubble();
}, { passive: false });

// Touch start — start aiming
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!gameRunning) return;
  const t = e.touches[0];
  updateAimFromPoint(t.clientX, t.clientY);
}, { passive: false });

// Keyboard — space to shoot, left/right to adjust aim
document.addEventListener('keydown', (e) => {
  if (!gameRunning) return;
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    shootBubble();
  }
  if (e.code === 'ArrowLeft') {
    aimAngle = Math.min((170 * Math.PI) / 180, aimAngle + 0.05);
  }
  if (e.code === 'ArrowRight') {
    aimAngle = Math.max((10 * Math.PI) / 180, aimAngle - 0.05);
  }
});

// =============================================
//  START BUTTON
// =============================================
btnStart.addEventListener('click', () => {
  newGame();
});

// =============================================
//  INIT
// =============================================
setupCanvas();

// Draw idle state (background only)
animFrameId = requestAnimationFrame(loop);
