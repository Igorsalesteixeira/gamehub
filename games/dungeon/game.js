/**
 * Dungeon Crawler — Cartoon Theme (Canvas2D)
 * Pure Canvas2D rendering — no PixiJS dependency
 */

import { onGameEnd } from '../shared/game-integration.js';
import { GameStats, GameStorage } from '../shared/game-core.js';

const stats = new GameStats('dungeon');
const storage = new GameStorage('dungeon');

// ── Constants ──
const TILE = 28;
const LIGHT_BASE_RADIUS = 6;
const TILE_FLOOR = 0, TILE_WALL = 1, TILE_DOOR = 2, TILE_STAIRS = 3;

const COLORS = {
  floor: '#C4B098', floorAlt: '#B8A488',
  wall: '#6B5544', wallTop: '#8B7B68',
  door: '#C4B098', stairs: '#FFD54F', stairsGlow: '#FFB300',
  player: '#4CAF50', playerLight: '#81C784', playerDark: '#2E7D32',
  slime: '#66BB6A', bat: '#7E57C2', skeleton: '#BDBDBD', boss: '#E53935',
  potionHP: '#E53935', sword: '#42A5F5', shield: '#FFD54F',
  torch: '#FF8F00', gold: '#FFD54F', bg: '#37474F',
};

function hexDarken(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.floor(r * factor);
  const dg = Math.floor(g * factor);
  const db = Math.floor(b * factor);
  return `rgb(${dr},${dg},${db})`;
}

function hexDarkenAlpha(hex, factor, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)},${alpha})`;
}

// ── State ──
let canvas, ctx;
let mapW, mapH, tiles, explored, rooms;
let player, enemies, items;
let floor = 1, score = 0, kills = 0;
let bestScore = parseInt(localStorage.getItem('dungeon_best') || '0', 10);
let gameRunning = false;
let lightRadius = LIGHT_BASE_RADIUS;
let flickerTime = 0, animating = false, playerDamageFlash = 0;
let visibleSet = new Set();
const particles = [];
const floatingTexts = [];

const DOM = {};

// ── Init ──
function boot() {
  DOM.container = document.getElementById('pixi-container');
  DOM.overlay = document.getElementById('overlay');
  DOM.title = document.getElementById('overlay-title');
  DOM.msg = document.getElementById('overlay-msg');
  DOM.scoreEl = document.getElementById('overlay-score');
  DOM.icon = document.getElementById('overlay-icon');
  DOM.btnStart = document.getElementById('btn-start');
  DOM.btnShare = document.getElementById('btn-share');
  DOM.scoreDisplay = document.getElementById('score-display');
  DOM.bestDisplay = document.getElementById('best-display');
  DOM.bestDisplay.textContent = bestScore;

  // Create Canvas2D
  canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  DOM.container.appendChild(canvas);
  ctx = canvas.getContext('2d');

  resize();
  window.addEventListener('resize', resize);

  setupControls();
  DOM.btnStart.addEventListener('click', startGame);
  DOM.btnShare.addEventListener('click', shareResult);
  showOverlay('start');

  requestAnimationFrame(gameLoop);
}

function resize() {
  const rect = DOM.container.getBoundingClientRect();
  canvas.width = rect.width || window.innerWidth;
  canvas.height = rect.height || (window.innerHeight - 50);
}

function getScale() {
  const minDim = Math.min(canvas.width, canvas.height);
  const visibleTiles = (lightRadius * 2 + 4) * TILE;
  return Math.max(1, minDim / visibleTiles);
}

// ── Overlay ──
function showOverlay(mode) {
  DOM.overlay.classList.remove('hidden');
  if (mode === 'start') {
    DOM.icon.textContent = '⚔️';
    DOM.title.textContent = 'Dungeon Crawler';
    DOM.msg.textContent = 'Explore masmorras na escuridão.\nWASD/Setas para mover.\nClique/Toque para atacar.';
    DOM.scoreEl.textContent = '';
    DOM.btnStart.textContent = 'Explorar';
    DOM.btnShare.style.display = 'none';
  } else {
    DOM.icon.textContent = '💀';
    DOM.title.textContent = 'Você Caiu!';
    DOM.msg.textContent = `Andar ${floor} • ${kills} monstros derrotados`;
    DOM.scoreEl.textContent = `Pontuação: ${score}`;
    DOM.btnStart.textContent = 'Tentar Novamente';
    DOM.btnShare.style.display = 'inline-block';
  }
}

function hideOverlay() { DOM.overlay.classList.add('hidden'); }

// ── Start ──
function startGame() {
  hideOverlay();
  floor = 1; score = 0; kills = 0;
  lightRadius = LIGHT_BASE_RADIUS;
  player = {
    x: 0, y: 0, hp: 10, maxHp: 10, atk: 2, def: 1,
    px: 0, py: 0, moveT: 1, dirX: 0, dirY: 1,
    fromPX: 0, fromPY: 0, toPX: 0, toPY: 0,
  };
  generateFloor();
  gameRunning = true;
  updateHUD();
}

// ── Dungeon Generation ──
function generateFloor() {
  const baseSize = 40 + Math.min(floor * 5, 40);
  mapW = baseSize; mapH = baseSize;
  tiles = new Array(mapW * mapH).fill(TILE_WALL);
  explored = new Array(mapW * mapH).fill(false);
  rooms = []; enemies = []; items = [];

  generateRooms(5 + Math.min(Math.floor(floor * 0.8), 8));
  connectRooms();
  placeStairs();
  placePlayer();
  spawnEnemies();
  spawnItems();
}

function generateRooms(count) {
  let attempts = 0;
  while (rooms.length < count && attempts < 500) {
    attempts++;
    const w = 5 + Math.floor(Math.random() * 8);
    const h = 5 + Math.floor(Math.random() * 8);
    const x = 2 + Math.floor(Math.random() * (mapW - w - 4));
    const y = 2 + Math.floor(Math.random() * (mapH - h - 4));
    let overlap = false;
    for (const r of rooms) {
      if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) { overlap = true; break; }
    }
    if (overlap) continue;
    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
    for (let ry = y; ry < y + h; ry++)
      for (let rx = x; rx < x + w; rx++)
        tiles[ry * mapW + rx] = TILE_FLOOR;
  }
}

function connectRooms() {
  for (let i = 1; i < rooms.length; i++)
    carveCorridor(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
  if (rooms.length > 4)
    carveCorridor(rooms[0].cx, rooms[0].cy, rooms[rooms.length - 1].cx, rooms[rooms.length - 1].cy);
}

function carveCorridor(x1, y1, x2, y2) {
  let x = x1, y = y1;
  while (x !== x2) {
    if (x >= 0 && x < mapW && y >= 0 && y < mapH) {
      tiles[y * mapW + x] = TILE_FLOOR;
      if (y + 1 < mapH) tiles[(y + 1) * mapW + x] = TILE_FLOOR;
    }
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    if (x >= 0 && x < mapW && y >= 0 && y < mapH) {
      tiles[y * mapW + x] = TILE_FLOOR;
      if (x + 1 < mapW) tiles[y * mapW + x + 1] = TILE_FLOOR;
    }
    y += y < y2 ? 1 : -1;
  }
}

function placeStairs() { const r = rooms[rooms.length - 1]; tiles[r.cy * mapW + r.cx] = TILE_STAIRS; }

function placePlayer() {
  const r = rooms[0];
  player.x = r.cx; player.y = r.cy;
  player.px = player.x * TILE; player.py = player.y * TILE;
  player.moveT = 1;
}

// ── Enemies ──
function spawnEnemies() {
  const count = 3 + Math.floor(floor * 1.5);
  for (let i = 0; i < count; i++) {
    const room = rooms[1 + Math.floor(Math.random() * (rooms.length - 1))];
    if (!room) continue;
    const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
    const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
    if (tiles[ey * mapW + ex] !== TILE_FLOOR || (ex === player.x && ey === player.y)) continue;
    const type = Math.random();
    let enemy;
    if (type < 0.35)
      enemy = { x: ex, y: ey, type: 'slime', hp: 3, maxHp: 3, atk: 1, def: 0, color: COLORS.slime, score: 10, speed: 0.3 };
    else if (type < 0.6)
      enemy = { x: ex, y: ey, type: 'bat', hp: 2, maxHp: 2, atk: 1, def: 0, color: COLORS.bat, score: 15, speed: 0.7 };
    else
      enemy = { x: ex, y: ey, type: 'skeleton', hp: 5, maxHp: 5, atk: 2, def: 1, color: COLORS.skeleton, score: 30, speed: 0.5 };
    enemy.hp += Math.floor(floor * 0.3); enemy.maxHp = enemy.hp;
    enemy.atk += Math.floor(floor * 0.2);
    enemies.push(enemy);
  }
  if (floor % 5 === 0) {
    const br = rooms[Math.floor(rooms.length / 2)];
    enemies.push({ x: br.cx, y: br.cy, type: 'boss', hp: 15 + floor * 2, maxHp: 15 + floor * 2,
      atk: 4 + Math.floor(floor * 0.3), def: 2, color: COLORS.boss, score: 100 + floor * 10, speed: 0.6 });
  }
}

// ── Items ──
function spawnItems() {
  const ic = 3 + Math.floor(floor * 0.5);
  for (let i = 0; i < ic; i++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
    const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
    if (tiles[iy * mapW + ix] !== TILE_FLOOR) continue;
    const t = Math.random();
    if (t < 0.35) items.push({ x: ix, y: iy, type: 'potion', color: COLORS.potionHP, effect: 'hp' });
    else if (t < 0.55) items.push({ x: ix, y: iy, type: 'sword', color: COLORS.sword, effect: 'atk' });
    else if (t < 0.7) items.push({ x: ix, y: iy, type: 'shield', color: COLORS.shield, effect: 'def' });
    else items.push({ x: ix, y: iy, type: 'torch', color: COLORS.torch, effect: 'light' });
  }
  for (let i = 0; i < 4 + floor; i++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const gx = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
    const gy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
    if (tiles[gy * mapW + gx] !== TILE_FLOOR) continue;
    items.push({ x: gx, y: gy, type: 'gold', color: COLORS.gold, effect: 'score' });
  }
}

// ══════════════════════════════════════
// RENDERING — Pure Canvas2D
// ══════════════════════════════════════
function render() {
  const W = canvas.width, H = canvas.height;
  const scale = getScale();

  // Clear
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Camera: center on player
  const camX = W / 2 - (player.px + TILE / 2) * scale;
  const camY = H / 2 - (player.py + TILE / 2) * scale;

  ctx.save();
  ctx.translate(camX, camY);
  ctx.scale(scale, scale);

  const pcx = player.x * TILE + TILE / 2;
  const pcy = player.y * TILE + TILE / 2;
  const flicker = Math.sin(flickerTime * 3) * 0.12 + Math.sin(flickerTime * 7.3) * 0.06;
  const lr = (lightRadius + flicker) * TILE;
  const drawRadius = lightRadius + 3;

  visibleSet = new Set();

  // ── TILES ──
  for (let dy = -drawRadius; dy <= drawRadius; dy++) {
    for (let dx = -drawRadius; dx <= drawRadius; dx++) {
      const x = player.x + dx;
      const y = player.y + dy;
      if (x < 0 || x >= mapW || y < 0 || y >= mapH) continue;

      const idx = y * mapW + x;
      const t = tiles[idx];
      const px = x * TILE;
      const py = y * TILE;
      const tileCX = px + TILE / 2;
      const tileCY = py + TILE / 2;
      const dist = Math.sqrt((tileCX - pcx) ** 2 + (tileCY - pcy) ** 2);
      const inLight = dist <= lr;

      if (inLight) { explored[idx] = true; visibleSet.add(idx); }
      if (!inLight && !explored[idx]) continue;

      const brightness = inLight ? Math.max(0.3, 1 - (dist / lr) * 0.7) : 0.15;

      let color;
      if (t === TILE_WALL) color = COLORS.wall;
      else if (t === TILE_FLOOR) color = (x + y) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
      else if (t === TILE_DOOR) color = COLORS.door;
      else if (t === TILE_STAIRS) color = COLORS.stairs;
      else continue;

      ctx.fillStyle = hexDarken(color, brightness);
      ctx.fillRect(px, py, TILE, TILE);

      // Wall top highlight
      if (t === TILE_WALL && inLight && brightness > 0.4) {
        ctx.fillStyle = hexDarkenAlpha(COLORS.wallTop, brightness, 0.5);
        ctx.fillRect(px, py, TILE, 3);
      }

      // Stairs glow
      if (t === TILE_STAIRS && inLight) {
        const glow = 0.15 + Math.sin(flickerTime * 4) * 0.08;
        ctx.fillStyle = `rgba(255,179,0,${glow})`;
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, TILE * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Torch ambient glow
  const glowA = 0.06 + Math.sin(flickerTime * 5) * 0.02;
  ctx.fillStyle = `rgba(139,105,20,${glowA})`;
  ctx.beginPath();
  ctx.arc(pcx, pcy, lr * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // ── ITEMS ──
  for (const item of items) {
    if (!visibleSet.has(item.y * mapW + item.x)) continue;
    const px = item.x * TILE + TILE / 2;
    const py = item.y * TILE + TILE / 2;
    const bob = Math.sin(performance.now() * 0.003 + item.x * 2) * 2;
    const dist = Math.sqrt((px - pcx) ** 2 + (py - pcy) ** 2);
    const bright = Math.max(0.3, 1 - dist / lr);

    if (item.type === 'gold') {
      ctx.fillStyle = hexDarken(COLORS.gold, bright);
      ctx.beginPath();
      ctx.arc(px, py + bob, 5, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = `rgba(255,255,255,${0.3 * bright})`;
      ctx.beginPath();
      ctx.arc(px - 1, py + bob - 1, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = hexDarken(item.color, bright);
      roundRect(ctx, px - 7, py - 7 + bob, 14, 14, 4);
      ctx.fill();
    }
  }

  // ── ENEMIES ──
  for (const e of enemies) {
    if (e.hp <= 0 || !visibleSet.has(e.y * mapW + e.x)) continue;
    const px = e.x * TILE + TILE / 2;
    const py = e.y * TILE + TILE / 2;
    const dist = Math.sqrt((px - pcx) ** 2 + (py - pcy) ** 2);
    const bright = Math.max(0.35, 1 - dist / lr);
    const col = hexDarken(e.color, bright);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(px, py + 12, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (e.type === 'slime') {
      const sq = Math.sin(performance.now() * 0.005) * 1.5;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(px, py + 2 - sq, 11 + sq, 9 - sq, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px - 3, py - 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 3, py - 1, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1B5E20';
      ctx.beginPath(); ctx.arc(px - 3, py - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 3, py - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'bat') {
      const wf = Math.sin(performance.now() * 0.015) * 4;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      // Wings
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(px - 5, py); ctx.lineTo(px - 15, py - 5 + wf); ctx.lineTo(px - 5, py + 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + 5, py); ctx.lineTo(px + 15, py - 5 + wf); ctx.lineTo(px + 5, py + 3); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      // Eyes
      ctx.fillStyle = '#FFEB3B';
      ctx.beginPath(); ctx.arc(px - 2, py - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 2, py - 2, 2, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'skeleton') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(px, py - 4, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(px - 3, py + 2, 6, 10);
      ctx.fillStyle = hexDarkenAlpha('#E53935', bright, 0.9);
      ctx.beginPath(); ctx.arc(px - 3, py - 5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 3, py - 5, 2, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === 'boss') {
      // Aura
      ctx.fillStyle = hexDarkenAlpha(e.color, bright, 0.15);
      ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill();
      // Horns
      ctx.fillStyle = hexDarken('#8D6E63', bright);
      ctx.beginPath(); ctx.moveTo(px - 8, py - 10); ctx.lineTo(px - 12, py - 22); ctx.lineTo(px - 4, py - 10); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + 8, py - 10); ctx.lineTo(px + 12, py - 22); ctx.lineTo(px + 4, py - 10); ctx.closePath(); ctx.fill();
      // Eyes
      ctx.fillStyle = '#FFD54F';
      ctx.beginPath(); ctx.arc(px - 5, py - 3, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 5, py - 3, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(px - 5, py - 3, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 5, py - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    // HP bar
    if (e.hp < e.maxHp) {
      const bw = 22, bh = 4, bx = px - bw / 2, by = py - 20;
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#E53935';
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
    }
  }

  // ── PLAYER ──
  const ppx = player.px + TILE / 2;
  const ppy = player.py + TILE / 2;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(ppx, ppy + 12, 9, 3, 0, 0, Math.PI * 2); ctx.fill();

  // Torch glow
  ctx.fillStyle = 'rgba(255,179,0,0.06)';
  ctx.beginPath(); ctx.arc(ppx, ppy, 20, 0, Math.PI * 2); ctx.fill();

  // Body
  const pc = playerDamageFlash > 0 && playerDamageFlash % 2 === 0 ? '#E53935' : COLORS.player;
  ctx.fillStyle = pc;
  ctx.beginPath(); ctx.arc(ppx, ppy, 11, 0, Math.PI * 2); ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(129,199,132,0.5)';
  ctx.beginPath(); ctx.arc(ppx - 2, ppy - 3, 6, 0, Math.PI * 2); ctx.fill();

  // Belt
  ctx.fillStyle = COLORS.playerDark;
  ctx.fillRect(ppx - 8, ppy + 2, 16, 3);

  // Eyes (follow direction)
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(ppx - 4 + player.dirX * 2, ppy - 3 + player.dirY * 2, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ppx + 4 + player.dirX * 2, ppy - 3 + player.dirY * 2, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1B5E20';
  ctx.beginPath(); ctx.arc(ppx - 4 + player.dirX * 3, ppy - 3 + player.dirY * 3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ppx + 4 + player.dirX * 3, ppy - 3 + player.dirY * 3, 2, 0, Math.PI * 2); ctx.fill();

  // ── PARTICLES ──
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── FLOATING TEXT ──
  ctx.font = '800 14px Nunito';
  ctx.textAlign = 'center';
  for (const ft of floatingTexts) {
    ctx.globalAlpha = ft.life;
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 3;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore(); // End camera transform

  // ── HUD (screen space) ──
  drawHUD();
  drawMinimap();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── HUD ──
function drawHUD() {
  const W = canvas.width;
  ctx.font = '800 13px Nunito';

  // HP bar
  const bx = 14, by = 14, bw = 130, bh = 14;
  ctx.fillStyle = '#5D4037';
  roundRect(ctx, bx - 2, by - 2, bw + 4, bh + 4, 6); ctx.fill();
  ctx.fillStyle = '#3E2723';
  roundRect(ctx, bx, by, bw, bh, 4); ctx.fill();
  const hr = Math.max(0, player.hp / player.maxHp);
  ctx.fillStyle = hr > 0.5 ? '#4CAF50' : hr > 0.25 ? '#FFB300' : '#E53935';
  if (hr > 0) { roundRect(ctx, bx, by, bw * hr, bh, 4); ctx.fill(); }
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  if (hr > 0) { roundRect(ctx, bx + 2, by + 1, Math.max(0, bw * hr - 4), 4, 2); ctx.fill(); }

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#3E2723'; ctx.lineWidth = 2;
  ctx.strokeText(`HP ${player.hp}/${player.maxHp}`, bx + 6, by + 12);
  ctx.fillText(`HP ${player.hp}/${player.maxHp}`, bx + 6, by + 12);

  ctx.font = '800 14px Nunito';
  ctx.fillStyle = '#F5E6D0';
  ctx.strokeText(`ATK:${player.atk}  DEF:${player.def}`, bx, by + bh + 18);
  ctx.fillText(`ATK:${player.atk}  DEF:${player.def}`, bx, by + bh + 18);

  // Floor
  ctx.font = '800 18px Nunito';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD54F';
  ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 3;
  ctx.strokeText(`ANDAR ${floor}`, W / 2, 28);
  ctx.fillText(`ANDAR ${floor}`, W / 2, 28);

  // Score
  ctx.font = '800 15px Nunito';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#F5E6D0';
  ctx.strokeStyle = '#3E2723'; ctx.lineWidth = 2;
  ctx.strokeText(`${score} pts`, W - 14, 28);
  ctx.fillText(`${score} pts`, W - 14, 28);
}

// ── Minimap ──
function drawMinimap() {
  const W = canvas.width, H = canvas.height;
  const ms = 2, mw = mapW * ms, mh = mapH * ms;
  if (mw > 150 || mh > 150) return;
  const mx = W - mw - 14, my = H - mh - 14;

  ctx.fillStyle = '#5D4037';
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 4); ctx.fill();
  ctx.fillStyle = 'rgba(62,39,35,0.85)';
  roundRect(ctx, mx - 2, my - 2, mw + 4, mh + 4, 3); ctx.fill();

  for (let y = 0; y < mapH; y++)
    for (let x = 0; x < mapW; x++) {
      const idx = y * mapW + x;
      if (!explored[idx] || tiles[idx] === TILE_WALL) continue;
      ctx.fillStyle = tiles[idx] === TILE_STAIRS ? '#FFD54F' : 'rgba(196,176,152,0.7)';
      ctx.fillRect(mx + x * ms, my + y * ms, ms, ms);
    }

  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(mx + player.x * ms - 1, my + player.y * ms - 1, ms + 2, ms + 2);

  for (const e of enemies) {
    if (e.hp <= 0 || !explored[e.y * mapW + e.x]) continue;
    ctx.fillStyle = e.color;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(mx + e.x * ms, my + e.y * ms, ms, ms);
    ctx.globalAlpha = 1;
  }
}

function updateHUD() {
  DOM.scoreDisplay.textContent = `Andar ${floor}`;
  DOM.bestDisplay.textContent = bestScore;
}

// ── Movement ──
function tryMove(dx, dy) {
  if (!gameRunning || animating) return;
  player.dirX = dx; player.dirY = dy;
  const nx = player.x + dx, ny = player.y + dy;
  if (nx < 0 || nx >= mapW || ny < 0 || ny >= mapH) return;
  if (tiles[ny * mapW + nx] === TILE_WALL) return;

  const hit = enemies.find(e => e.hp > 0 && e.x === nx && e.y === ny);
  if (hit) { attackEnemy(hit); moveEnemies(); return; }

  player.x = nx; player.y = ny;
  player.moveT = 0; player.fromPX = player.px; player.fromPY = player.py;
  player.toPX = nx * TILE; player.toPY = ny * TILE;
  animating = true;

  pickupItems();
  if (tiles[ny * mapW + nx] === TILE_STAIRS) { nextFloor(); return; }
  moveEnemies();
  updateHUD();
}

// ── Combat ──
function attackEnemy(enemy) {
  const dmg = Math.max(1, player.atk - (enemy.def || 0));
  enemy.hp -= dmg;
  spawnFloatingText(enemy.x * TILE + TILE / 2, enemy.y * TILE, `-${dmg}`, '#E53935');
  if (enemy.hp <= 0) {
    score += enemy.score; kills++;
    spawnDeathParticles(enemy.x * TILE + TILE / 2, enemy.y * TILE + TILE / 2, enemy.color);
    spawnFloatingText(enemy.x * TILE + TILE / 2, enemy.y * TILE - 10, `+${enemy.score}`, '#FFD54F');
  }
  updateHUD();
}

function attackPlayer(enemy) {
  const dmg = Math.max(1, enemy.atk - player.def);
  player.hp -= dmg;
  spawnFloatingText(player.px + TILE / 2, player.py, `-${dmg}`, '#E53935');
  playerDamageFlash = 8;
  if (player.hp <= 0) gameOver();
  updateHUD();
}

function tryAttackAdjacent() {
  if (!gameRunning || animating) return;
  const target = enemies.find(e => e.hp > 0 && e.x === player.x + player.dirX && e.y === player.y + player.dirY);
  if (target) { attackEnemy(target); moveEnemies(); return; }
  for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
    const adj = enemies.find(e => e.hp > 0 && e.x === player.x + dx && e.y === player.y + dy);
    if (adj) { player.dirX = dx; player.dirY = dy; attackEnemy(adj); moveEnemies(); return; }
  }
}

// ── Enemy AI ──
function moveEnemies() {
  for (const e of enemies) {
    if (e.hp <= 0 || Math.random() > e.speed) continue;
    const dist = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);
    let mx = 0, my = 0;
    if (e.type === 'slime') {
      const d = [[0,-1],[0,1],[-1,0],[1,0]][Math.floor(Math.random() * 4)];
      mx = d[0]; my = d[1];
    } else {
      const range = e.type === 'bat' ? lightRadius + 2 : lightRadius + 3;
      if (dist <= range) {
        mx = Math.sign(player.x - e.x); my = Math.sign(player.y - e.y);
        if (Math.random() < 0.5) mx = 0; else my = 0;
      } else {
        const d = [[0,-1],[0,1],[-1,0],[1,0]][Math.floor(Math.random() * 4)];
        mx = d[0]; my = d[1];
      }
    }
    const nx = e.x + mx, ny = e.y + my;
    if (nx < 0 || nx >= mapW || ny < 0 || ny >= mapH) continue;
    if (tiles[ny * mapW + nx] === TILE_WALL) continue;
    if (nx === player.x && ny === player.y) { attackPlayer(e); continue; }
    if (enemies.some(o => o !== e && o.hp > 0 && o.x === nx && o.y === ny)) continue;
    e.x = nx; e.y = ny;
  }
}

// ── Items ──
function pickupItems() {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.x !== player.x || it.y !== player.y) continue;
    switch (it.effect) {
      case 'hp': player.hp = Math.min(player.maxHp, player.hp + 3); spawnFloatingText(player.px + TILE / 2, player.py, '+3 HP', '#E53935'); break;
      case 'atk': player.atk++; spawnFloatingText(player.px + TILE / 2, player.py, '+1 ATK', '#42A5F5'); break;
      case 'def': player.def++; spawnFloatingText(player.px + TILE / 2, player.py, '+1 DEF', '#FFD54F'); break;
      case 'light': lightRadius++; spawnFloatingText(player.px + TILE / 2, player.py, '+1 LUZ', '#FF8F00'); break;
      case 'score': score += 5; spawnFloatingText(player.px + TILE / 2, player.py, '+5', '#FFD54F'); break;
    }
    spawnSparkle(it.x * TILE + TILE / 2, it.y * TILE + TILE / 2, it.color);
    items.splice(i, 1);
  }
}

function nextFloor() {
  floor++; score += 100;
  spawnFloatingText(player.px + TILE / 2, player.py - 20, '+100 ANDAR!', '#FFD54F');
  generateFloor(); updateHUD();
}

function gameOver() {
  gameRunning = false;
  const fs = score + floor * 50; score = fs;
  if (fs > bestScore) { bestScore = fs; localStorage.setItem('dungeon_best', bestScore.toString()); }
  try { onGameEnd('dungeon', { won: false, score: fs }); } catch (e) {}
  DOM.bestDisplay.textContent = bestScore;
  showOverlay('gameover');
}

// ── Particles ──
function spawnDeathParticles(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, size: 2 + Math.random() * 3 });
  }
}
function spawnSparkle(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 2;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 1, color, size: 1.5 + Math.random() * 2 });
  }
}
function spawnFloatingText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 1, vy: -1.5 });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= dt * 2;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const f = floatingTexts[i]; f.y += f.vy; f.life -= dt * 1.5;
    if (f.life <= 0) floatingTexts.splice(i, 1);
  }
}

// ── Controls ──
function setupControls() {
  window.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    switch (e.key) {
      case 'w': case 'W': case 'ArrowUp': tryMove(0, -1); e.preventDefault(); break;
      case 's': case 'S': case 'ArrowDown': tryMove(0, 1); e.preventDefault(); break;
      case 'a': case 'A': case 'ArrowLeft': tryMove(-1, 0); e.preventDefault(); break;
      case 'd': case 'D': case 'ArrowRight': tryMove(1, 0); e.preventDefault(); break;
      case ' ': case 'e': case 'E': tryAttackAdjacent(); e.preventDefault(); break;
    }
  });

  // Click/tap
  document.addEventListener('pointerdown', (e) => {
    if (!gameRunning || animating) return;
    const rect = canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

    const scale = getScale();
    const camX = canvas.width / 2 - (player.px + TILE / 2) * scale;
    const camY = canvas.height / 2 - (player.py + TILE / 2) * scale;
    const wx = (e.clientX - rect.left - camX) / scale;
    const wy = (e.clientY - rect.top - camY) / scale;
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    const dx = tx - player.x, dy = ty - player.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      player.dirX = dx; player.dirY = dy;
      const target = enemies.find(en => en.hp > 0 && en.x === tx && en.y === ty);
      if (target) { attackEnemy(target); moveEnemies(); updateHUD(); }
      else tryMove(dx, dy);
    }
  });

  // D-pad
  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
    const h = (e) => {
      e.preventDefault(); e.stopPropagation();
      switch (btn.dataset.dir) {
        case 'up': tryMove(0, -1); break; case 'down': tryMove(0, 1); break;
        case 'left': tryMove(-1, 0); break; case 'right': tryMove(1, 0); break;
      }
    };
    btn.addEventListener('touchstart', h, { passive: false });
    btn.addEventListener('mousedown', h);
  });

  const ab = document.getElementById('btn-attack');
  if (ab) {
    ab.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); tryAttackAdjacent(); }, { passive: false });
    ab.addEventListener('mousedown', (e) => { e.stopPropagation(); tryAttackAdjacent(); });
  }
}

function shareResult() {
  const text = `⚔️ Dungeon Crawler: Andar ${floor}! ${kills} monstros, ${score} pts!\nJogue: https://gameshub.com.br/games/dungeon/`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

// ── Game Loop ──
let lastTime = 0;
function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (!gameRunning) {
    // Still render even when not running (show last state)
    if (canvas && ctx && player) render();
    return;
  }

  flickerTime += dt;

  // Smooth movement
  if (player.moveT < 1) {
    player.moveT = Math.min(1, player.moveT + dt * 8);
    const t = 1 - (1 - player.moveT) * (1 - player.moveT);
    player.px = player.fromPX + (player.toPX - player.fromPX) * t;
    player.py = player.fromPY + (player.toPY - player.fromPY) * t;
    if (player.moveT >= 1) { player.px = player.toPX; player.py = player.toPY; animating = false; }
  }
  if (isNaN(player.px)) player.px = player.x * TILE;
  if (isNaN(player.py)) player.py = player.y * TILE;
  if (playerDamageFlash > 0) playerDamageFlash--;

  updateParticles(dt);
  render();
}

document.addEventListener('DOMContentLoaded', boot);
