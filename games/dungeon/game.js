/**
 * Dungeon Crawler — Cartoon Theme (PixiJS 7)
 * Single-Graphics rendering: tiles + entities on ONE Graphics object
 */

import { onGameEnd } from '../shared/game-integration.js';
import { GameStats, GameStorage } from '../shared/game-core.js';

const stats = new GameStats('dungeon');
const storage = new GameStorage('dungeon');

// ── Constants ──
const TILE = 32;
const LIGHT_BASE_RADIUS = 6;

const TILE_FLOOR = 0;
const TILE_WALL = 1;
const TILE_DOOR = 2;
const TILE_STAIRS = 3;

const COLORS = {
  floor:      0xC4B098,
  floorAlt:   0xB8A488,
  wall:       0x7D6650,
  wallTop:    0xD4C0A8,
  door:       0xC4B098,
  stairs:     0xFFD54F,
  stairsGlow: 0xFFB300,
  player:     0x4CAF50,
  playerLight:0x81C784,
  playerDark: 0x388E3C,
  slime:      0x66BB6A,
  bat:        0x7E57C2,
  skeleton:   0xBDBDBD,
  boss:       0xE53935,
  potionHP:   0xE53935,
  sword:      0x42A5F5,
  shield:     0xFFD54F,
  torch:      0xFF8F00,
  gold:       0xFFD54F,
  bg:         0x37474F,
};

function darkenColor(hex, factor) {
  const r = Math.min(255, Math.floor(((hex >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((hex >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((hex & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

// ── State ──
let app, worldContainer, hudContainer, minimapGfx;
let mapW, mapH, tiles, explored, rooms;
let player, enemies, items;
let floor = 1, score = 0, kills = 0;
let bestScore = parseInt(localStorage.getItem('dungeon_best') || '0', 10);
let gameRunning = false;
let lightRadius = LIGHT_BASE_RADIUS;
let flickerTime = 0, animating = false, playerDamageFlash = 0, worldScale = 1;
let visibleSet = new Set();

// SINGLE Graphics for all world rendering (tiles + entities)
let gfx;
let particleContainer;
const particles = [];
const floatingTexts = [];

const DOM = {
  container: null, overlay: null, title: null, msg: null,
  scoreEl: null, icon: null, btnStart: null, btnShare: null,
  scoreDisplay: null, bestDisplay: null, mobileControls: null,
};

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
  DOM.mobileControls = document.getElementById('mobile-controls');
  DOM.bestDisplay.textContent = bestScore;

  requestAnimationFrame(() => {
    const rect = DOM.container.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || (window.innerHeight - 50);

    app = new PIXI.Application({
      width: w, height: h,
      backgroundColor: COLORS.bg,
      antialias: false,
      resolution: 1,
      autoDensity: false,
    });
    DOM.container.appendChild(app.view);
    app.view.style.width = '100%';
    app.view.style.height = '100%';

    worldContainer = new PIXI.Container();
    hudContainer = new PIXI.Container();
    minimapGfx = new PIXI.Graphics();

    app.stage.addChild(worldContainer);
    app.stage.addChild(hudContainer);
    app.stage.addChild(minimapGfx);

    app.ticker.add(gameLoop);
    recalcWorldScale();

    window.addEventListener('resize', () => {
      const r = DOM.container.getBoundingClientRect();
      app.renderer.resize(r.width || window.innerWidth, r.height || (window.innerHeight - 50));
      recalcWorldScale();
    });

    setupControls();
    DOM.btnStart.addEventListener('click', startGame);
    DOM.btnShare.addEventListener('click', shareResult);
    showOverlay('start');
  });
}

function recalcWorldScale() {
  const minDim = Math.min(app.screen.width, app.screen.height);
  const visibleTiles = (lightRadius * 2 + 4) * TILE;
  worldScale = Math.max(1, minDim / visibleTiles);
  worldContainer.scale.set(worldScale);
}

// ── Overlay ──
function showOverlay(mode) {
  DOM.overlay.classList.remove('hidden');
  if (mode === 'start') {
    DOM.icon.textContent = '⚔️';
    DOM.title.textContent = 'Dungeon Crawler';
    DOM.msg.textContent = 'Explore masmorras na escuridão.\nWASD/Setas para mover.\nClique/Toque para atacar inimigos adjacentes.';
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
  recalcWorldScale();
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
  buildWorld();
  updateCamera(true);
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

function placeStairs() {
  const r = rooms[rooms.length - 1];
  tiles[r.cy * mapW + r.cx] = TILE_STAIRS;
}

function placePlayer() {
  const r = rooms[0];
  player.x = r.cx; player.y = r.cy;
  player.px = player.x * TILE; player.py = player.y * TILE;
  player.moveT = 1;
}

// ── Enemies ──
function spawnEnemies() {
  const isBossFloor = floor % 5 === 0;
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
  if (isBossFloor) {
    const br = rooms[Math.floor(rooms.length / 2)];
    enemies.push({ x: br.cx, y: br.cy, type: 'boss', hp: 15 + floor * 2, maxHp: 15 + floor * 2,
      atk: 4 + Math.floor(floor * 0.3), def: 2, color: COLORS.boss, score: 100 + floor * 10, speed: 0.6 });
  }
}

// ── Items ──
function spawnItems() {
  const ic = 3 + Math.floor(floor * 0.5);
  const gc = 4 + floor;
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
  for (let i = 0; i < gc; i++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const gx = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
    const gy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
    if (tiles[gy * mapW + gx] !== TILE_FLOOR) continue;
    items.push({ x: gx, y: gy, type: 'gold', color: COLORS.gold, effect: 'score' });
  }
}

// ── Build World ──
function buildWorld() {
  worldContainer.removeChildren();
  // Single Graphics for tiles + entities
  gfx = new PIXI.Graphics();
  particleContainer = new PIXI.Container();
  worldContainer.addChild(gfx);
  worldContainer.addChild(particleContainer);
}

// ══════════════════════════════════════════════════
// SINGLE DRAW FUNCTION: tiles + entities on ONE gfx
// ══════════════════════════════════════════════════
function drawWorld() {
  gfx.clear();

  const pcx = player.x * TILE + TILE / 2;
  const pcy = player.y * TILE + TILE / 2;
  const flicker = Math.sin(flickerTime * 3) * 0.12 + Math.sin(flickerTime * 7.3) * 0.06;
  const lr = (lightRadius + flicker) * TILE;
  const drawRadius = lightRadius + 3;

  // ── PHASE 1: TILES ──
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

      gfx.beginFill(darkenColor(color, brightness), 1);
      gfx.drawRect(px, py, TILE, TILE);
      gfx.endFill();

      if (t === TILE_WALL && inLight && brightness > 0.4) {
        gfx.beginFill(darkenColor(COLORS.wallTop, brightness), 0.5);
        gfx.drawRect(px, py, TILE, 3);
        gfx.endFill();
      }
    }
  }

  // ── PHASE 2: ITEMS ──
  for (const item of items) {
    if (!visibleSet.has(item.y * mapW + item.x)) continue;
    const px = item.x * TILE + TILE / 2;
    const py = item.y * TILE + TILE / 2;
    const bob = Math.sin(performance.now() * 0.003 + item.x * 2) * 2;
    const dist = Math.sqrt((px - pcx) ** 2 + (py - pcy) ** 2);
    const bright = Math.max(0.3, 1 - dist / lr);

    if (item.type === 'gold') {
      gfx.beginFill(darkenColor(COLORS.gold, bright), 1);
      gfx.drawCircle(px, py + bob, 5);
      gfx.endFill();
    } else {
      gfx.beginFill(darkenColor(item.color, bright), 1);
      gfx.drawRoundedRect(px - 7, py - 7 + bob, 14, 14, 4);
      gfx.endFill();
    }
  }

  // ── PHASE 3: ENEMIES ──
  for (const e of enemies) {
    if (e.hp <= 0 || !visibleSet.has(e.y * mapW + e.x)) continue;
    const px = e.x * TILE + TILE / 2;
    const py = e.y * TILE + TILE / 2;
    const dist = Math.sqrt((px - pcx) ** 2 + (py - pcy) ** 2);
    const bright = Math.max(0.35, 1 - dist / lr);
    const col = darkenColor(e.color, bright);

    gfx.beginFill(0x000000, 0.2);
    gfx.drawEllipse(px, py + 12, 8, 3);
    gfx.endFill();

    if (e.type === 'slime') {
      const sq = Math.sin(performance.now() * 0.005) * 1.5;
      gfx.beginFill(col, 1);
      gfx.drawEllipse(px, py + 2 - sq, 11 + sq, 9 - sq);
      gfx.endFill();
      gfx.beginFill(0xFFFFFF, 1);
      gfx.drawCircle(px - 3, py - 1, 3);
      gfx.drawCircle(px + 3, py - 1, 3);
      gfx.endFill();
      gfx.beginFill(0x1B5E20, 1);
      gfx.drawCircle(px - 3, py - 1, 1.5);
      gfx.drawCircle(px + 3, py - 1, 1.5);
      gfx.endFill();
    } else if (e.type === 'bat') {
      const wf = Math.sin(performance.now() * 0.015) * 4;
      gfx.beginFill(col, 1);
      gfx.drawCircle(px, py, 6);
      gfx.endFill();
      gfx.beginFill(col, 0.8);
      gfx.moveTo(px - 5, py); gfx.lineTo(px - 15, py - 5 + wf); gfx.lineTo(px - 5, py + 3); gfx.closePath();
      gfx.endFill();
      gfx.beginFill(col, 0.8);
      gfx.moveTo(px + 5, py); gfx.lineTo(px + 15, py - 5 + wf); gfx.lineTo(px + 5, py + 3); gfx.closePath();
      gfx.endFill();
      gfx.beginFill(0xFFEB3B, 1);
      gfx.drawCircle(px - 2, py - 2, 2);
      gfx.drawCircle(px + 2, py - 2, 2);
      gfx.endFill();
    } else if (e.type === 'skeleton') {
      gfx.beginFill(col, 1);
      gfx.drawCircle(px, py - 4, 7);
      gfx.drawRect(px - 3, py + 2, 6, 10);
      gfx.endFill();
      gfx.beginFill(darkenColor(0xE53935, bright), 0.9);
      gfx.drawCircle(px - 3, py - 5, 2);
      gfx.drawCircle(px + 3, py - 5, 2);
      gfx.endFill();
    } else if (e.type === 'boss') {
      gfx.beginFill(col, 0.15);
      gfx.drawCircle(px, py, 18);
      gfx.endFill();
      gfx.beginFill(col, 1);
      gfx.drawCircle(px, py, 13);
      gfx.endFill();
      gfx.beginFill(darkenColor(0x8D6E63, bright), 1);
      gfx.moveTo(px - 8, py - 10); gfx.lineTo(px - 12, py - 22); gfx.lineTo(px - 4, py - 10); gfx.closePath();
      gfx.endFill();
      gfx.beginFill(darkenColor(0x8D6E63, bright), 1);
      gfx.moveTo(px + 8, py - 10); gfx.lineTo(px + 12, py - 22); gfx.lineTo(px + 4, py - 10); gfx.closePath();
      gfx.endFill();
      gfx.beginFill(0xFFD54F, 1);
      gfx.drawCircle(px - 5, py - 3, 3.5);
      gfx.drawCircle(px + 5, py - 3, 3.5);
      gfx.endFill();
    }

    if (e.hp < e.maxHp) {
      const bw = 22, bh = 4, bx = px - bw / 2, by = py - 20;
      gfx.beginFill(0x3E2723, 1); gfx.drawRect(bx, by, bw, bh); gfx.endFill();
      gfx.beginFill(0xE53935, 1); gfx.drawRect(bx, by, bw * (e.hp / e.maxHp), bh); gfx.endFill();
    }
  }

  // ── PHASE 4: PLAYER ──
  const ppx = player.px + TILE / 2;
  const ppy = player.py + TILE / 2;

  gfx.beginFill(0x000000, 0.2);
  gfx.drawEllipse(ppx, ppy + 12, 9, 3);
  gfx.endFill();

  gfx.beginFill(0xFFB300, 0.06);
  gfx.drawCircle(ppx, ppy, 20);
  gfx.endFill();

  const pc = playerDamageFlash > 0 && playerDamageFlash % 2 === 0 ? 0xE53935 : COLORS.player;
  gfx.beginFill(pc, 1);
  gfx.drawCircle(ppx, ppy, 11);
  gfx.endFill();

  gfx.beginFill(COLORS.playerLight, 0.5);
  gfx.drawCircle(ppx - 2, ppy - 3, 6);
  gfx.endFill();

  gfx.beginFill(COLORS.playerDark, 1);
  gfx.drawRect(ppx - 8, ppy + 2, 16, 3);
  gfx.endFill();

  gfx.beginFill(0xFFFFFF, 1);
  gfx.drawCircle(ppx - 4 + player.dirX * 2, ppy - 3 + player.dirY * 2, 3.5);
  gfx.drawCircle(ppx + 4 + player.dirX * 2, ppy - 3 + player.dirY * 2, 3.5);
  gfx.endFill();
  gfx.beginFill(0x1B5E20, 1);
  gfx.drawCircle(ppx - 4 + player.dirX * 3, ppy - 3 + player.dirY * 3, 2);
  gfx.drawCircle(ppx + 4 + player.dirX * 3, ppy - 3 + player.dirY * 3, 2);
  gfx.endFill();
}

// ── Camera ──
function updateCamera(instant) {
  const sw = app.screen.width, sh = app.screen.height;
  const px = isNaN(player.px) ? player.x * TILE : player.px;
  const py = isNaN(player.py) ? player.y * TILE : player.py;
  const tx = -(px + TILE / 2) * worldScale + sw / 2;
  const ty = -(py + TILE / 2) * worldScale + sh / 2;
  if (instant || isNaN(worldContainer.x)) {
    worldContainer.x = tx; worldContainer.y = ty;
  } else {
    worldContainer.x += (tx - worldContainer.x) * 0.15;
    worldContainer.y += (ty - worldContainer.y) * 0.15;
  }
}

// ── HUD ──
function drawHUD() {
  hudContainer.removeChildren();
  const sw = app.screen.width;
  const ts = { fontFamily: 'Nunito', fontWeight: '800' };

  const hpBg = new PIXI.Graphics();
  const bw = 130, bh = 14, bx = 14, by = 14;
  hpBg.beginFill(0x5D4037, 1); hpBg.drawRoundedRect(bx - 2, by - 2, bw + 4, bh + 4, 6); hpBg.endFill();
  hpBg.beginFill(0x3E2723, 0.9); hpBg.drawRoundedRect(bx, by, bw, bh, 4); hpBg.endFill();
  const hr = Math.max(0, player.hp / player.maxHp);
  hpBg.beginFill(hr > 0.5 ? 0x4CAF50 : hr > 0.25 ? 0xFFB300 : 0xE53935, 1);
  hpBg.drawRoundedRect(bx, by, bw * hr, bh, 4); hpBg.endFill();
  hudContainer.addChild(hpBg);

  const hpT = new PIXI.Text(`HP ${player.hp}/${player.maxHp}`, { ...ts, fontSize: 13, fill: 0xFFFFFF, stroke: 0x3E2723, strokeThickness: 2 });
  hpT.x = bx + 6; hpT.y = by; hudContainer.addChild(hpT);

  const stT = new PIXI.Text(`ATK:${player.atk}  DEF:${player.def}`, { ...ts, fontSize: 14, fill: 0xF5E6D0, stroke: 0x3E2723, strokeThickness: 2 });
  stT.x = bx; stT.y = by + bh + 8; hudContainer.addChild(stT);

  const flT = new PIXI.Text(`ANDAR ${floor}`, { ...ts, fontSize: 18, fill: 0xFFD54F, stroke: 0x5D4037, strokeThickness: 3 });
  flT.anchor.set(0.5, 0); flT.x = sw / 2; flT.y = 12; hudContainer.addChild(flT);

  const scT = new PIXI.Text(`${score} pts`, { ...ts, fontSize: 15, fill: 0xF5E6D0, stroke: 0x3E2723, strokeThickness: 2 });
  scT.anchor.set(1, 0); scT.x = sw - 14; scT.y = 12; hudContainer.addChild(scT);
}

function updateHUD() {
  DOM.scoreDisplay.textContent = `Andar ${floor}`;
  DOM.bestDisplay.textContent = bestScore;
  drawHUD();
}

// ── Minimap ──
function updateMinimap() {
  minimapGfx.clear();
  const sw = app.screen.width, sh = app.screen.height;
  const ms = 2, mw = mapW * ms, mh = mapH * ms;
  const mx = sw - mw - 10, my = sh - mh - 10;
  if (mw > 150 || mh > 150) return;

  minimapGfx.beginFill(0x5D4037, 1); minimapGfx.drawRoundedRect(mx - 4, my - 4, mw + 8, mh + 8, 4); minimapGfx.endFill();
  minimapGfx.beginFill(0x3E2723, 0.85); minimapGfx.drawRoundedRect(mx - 2, my - 2, mw + 4, mh + 4, 3); minimapGfx.endFill();

  for (let y = 0; y < mapH; y++)
    for (let x = 0; x < mapW; x++) {
      const idx = y * mapW + x;
      if (!explored[idx] || tiles[idx] === TILE_WALL) continue;
      minimapGfx.beginFill(tiles[idx] === TILE_STAIRS ? 0xFFD54F : 0xC4B098, 0.7);
      minimapGfx.drawRect(mx + x * ms, my + y * ms, ms, ms);
      minimapGfx.endFill();
    }

  minimapGfx.beginFill(0x4CAF50, 1);
  minimapGfx.drawRect(mx + player.x * ms - 1, my + player.y * ms - 1, ms + 2, ms + 2);
  minimapGfx.endFill();

  for (const e of enemies) {
    if (e.hp <= 0 || !explored[e.y * mapW + e.x]) continue;
    minimapGfx.beginFill(e.color, 0.8);
    minimapGfx.drawRect(mx + e.x * ms, my + e.y * ms, ms, ms);
    minimapGfx.endFill();
  }
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
  animatePlayerTo(nx * TILE, ny * TILE);
  pickupItems();
  if (tiles[ny * mapW + nx] === TILE_STAIRS) { nextFloor(); return; }
  moveEnemies();
  updateHUD();
}

function animatePlayerTo(tx, ty) {
  player.moveT = 0;
  player.fromPX = player.px; player.fromPY = player.py;
  player.toPX = tx; player.toPY = ty;
  animating = true;
}

// ── Combat ──
function attackEnemy(enemy) {
  const dmg = Math.max(1, player.atk - (enemy.def || 0));
  enemy.hp -= dmg;
  spawnFloatingText(enemy.x * TILE + TILE / 2, enemy.y * TILE, `-${dmg}`, 0xE53935);
  if (enemy.hp <= 0) {
    score += enemy.score; kills++;
    spawnDeathParticles(enemy.x * TILE + TILE / 2, enemy.y * TILE + TILE / 2, enemy.color);
    spawnFloatingText(enemy.x * TILE + TILE / 2, enemy.y * TILE - 10, `+${enemy.score}`, 0xFFD54F);
  }
  updateHUD();
}

function attackPlayer(enemy) {
  const dmg = Math.max(1, enemy.atk - player.def);
  player.hp -= dmg;
  spawnFloatingText(player.px + TILE / 2, player.py, `-${dmg}`, 0xE53935);
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
    if (e.hp <= 0) continue;
    if (Math.random() > e.speed) continue;
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
      case 'hp': player.hp = Math.min(player.maxHp, player.hp + 3); spawnFloatingText(player.px + TILE / 2, player.py, '+3 HP', 0xE53935); break;
      case 'atk': player.atk++; spawnFloatingText(player.px + TILE / 2, player.py, '+1 ATK', 0x42A5F5); break;
      case 'def': player.def++; spawnFloatingText(player.px + TILE / 2, player.py, '+1 DEF', 0xFFD54F); break;
      case 'light': lightRadius++; spawnFloatingText(player.px + TILE / 2, player.py, '+1 LUZ', 0xFF8F00); recalcWorldScale(); break;
      case 'score': score += 5; spawnFloatingText(player.px + TILE / 2, player.py, '+5', 0xFFD54F); break;
    }
    spawnSparkle(it.x * TILE + TILE / 2, it.y * TILE + TILE / 2, it.color);
    items.splice(i, 1);
  }
}

function nextFloor() {
  floor++; score += 100;
  spawnFloatingText(player.px + TILE / 2, player.py - 20, '+100 ANDAR!', 0xFFD54F);
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

function drawParticles() {
  while (particleContainer.children.length > 0) particleContainer.removeChildAt(0);
  const pg = new PIXI.Graphics();
  for (const p of particles) {
    pg.beginFill(p.color, p.life); pg.drawCircle(p.x, p.y, p.size * p.life); pg.endFill();
  }
  particleContainer.addChild(pg);
  for (const ft of floatingTexts) {
    const t = new PIXI.Text(ft.text, { fontFamily: 'Nunito', fontWeight: '800', fontSize: 15, fill: ft.color, stroke: 0x3E2723, strokeThickness: 3 });
    t.anchor.set(0.5); t.x = ft.x; t.y = ft.y; t.alpha = ft.life;
    particleContainer.addChild(t);
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

  app.view.addEventListener('pointerdown', (e) => {
    if (!gameRunning || animating) return;
    const rect = app.view.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (app.screen.width / rect.width);
    const my = (e.clientY - rect.top) * (app.screen.height / rect.height);
    const wx = (mx - worldContainer.x) / worldScale;
    const wy = (my - worldContainer.y) / worldScale;
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    const dx = tx - player.x, dy = ty - player.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      player.dirX = dx; player.dirY = dy;
      const target = enemies.find(en => en.hp > 0 && en.x === tx && en.y === ty);
      if (target) { attackEnemy(target); moveEnemies(); updateHUD(); }
      else tryMove(dx, dy);
    }
  });

  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
    const h = (e) => {
      e.preventDefault();
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
    ab.addEventListener('touchstart', (e) => { e.preventDefault(); tryAttackAdjacent(); }, { passive: false });
    ab.addEventListener('mousedown', () => tryAttackAdjacent());
  }
}

function shareResult() {
  const text = `⚔️ Dungeon Crawler: Andar ${floor}! ${kills} monstros, ${score} pts!\nJogue: https://gameshub.com.br/games/dungeon/`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

// ── Game Loop ──
function gameLoop(ticker) {
  if (!gameRunning) return;
  const dt = ticker.deltaTime / 60;
  flickerTime += dt;

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
  updateCamera(false);

  visibleSet = new Set();
  drawWorld();        // Single function: tiles + entities on ONE Graphics
  drawParticles();
  updateMinimap();
  drawHUD();
}

document.addEventListener('DOMContentLoaded', boot);
