/**
 * Dungeon Crawler — Cartoon Theme (PixiJS 7 WebGL)
 * Rewrite from scratch: warm stone palette, Nunito font, cartoon entities
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

// Cartoon stone dungeon palette
const COLORS = {
  floor:      0x8D7B6A,   // warm stone
  floorAlt:   0x7D6B5A,   // stone alt
  wall:       0x5D4E42,   // dark brown stone
  wallTop:    0x9E8E7E,   // wall highlight
  wallLine:   0xA89888,   // wall edge
  door:       0x8D7B6A,   // door same as floor
  stairs:     0xFFD54F,   // golden stairs
  stairsGlow: 0xFFB300,   // stairs accent
  player:     0x4CAF50,   // green cartoon
  playerLight:0x66BB6A,   // lighter green
  playerDark: 0x388E3C,   // darker green
  slime:      0x66BB6A,   // green slime
  bat:        0x7E57C2,   // purple bat
  skeleton:   0xBDBDBD,   // gray bones
  boss:       0xE53935,   // red boss
  potionHP:   0xE53935,   // red potion
  sword:      0x42A5F5,   // blue sword
  shield:     0xFFD54F,   // gold shield
  torch:      0xFF8F00,   // orange torch
  gold:       0xFFD54F,   // gold coin
  darkness:   0x2C3E3A,   // dark stone background
  fog:        0x37474F,   // fog color (matches CSS --bg)
};

// ── Helpers ──
function darkenColor(hex, factor) {
  const r = ((hex >> 16) & 0xff) * factor;
  const g = ((hex >> 8) & 0xff) * factor;
  const b = (hex & 0xff) * factor;
  return (Math.floor(Math.min(255, r)) << 16) | (Math.floor(Math.min(255, g)) << 8) | Math.floor(Math.min(255, b));
}

function lerpColor(c1, c2, t) {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  const r = Math.floor(r1 + (r2 - r1) * t);
  const g = Math.floor(g1 + (g2 - g1) * t);
  const b = Math.floor(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

// ── State ──
let app, worldContainer, hudContainer, minimapGfx;
let mapW, mapH, tiles, explored, rooms;
let player, enemies, items;
let floor = 1;
let score = 0;
let kills = 0;
let bestScore = parseInt(localStorage.getItem('dungeon_best') || '0', 10);
let gameRunning = false;
let lightRadius = LIGHT_BASE_RADIUS;
let flickerTime = 0;
let animating = false;
let playerDamageFlash = 0;
let worldScale = 1;

let visibleSet = new Set();

const DOM = {
  container: null,
  overlay: null,
  title: null,
  msg: null,
  scoreEl: null,
  icon: null,
  btnStart: null,
  btnShare: null,
  scoreDisplay: null,
  bestDisplay: null,
  mobileControls: null,
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
      width: w,
      height: h,
      backgroundColor: COLORS.fog,
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

    const resize = () => {
      const r = DOM.container.getBoundingClientRect();
      const rw = r.width || window.innerWidth;
      const rh = r.height || (window.innerHeight - 50);
      app.renderer.resize(rw, rh);
      recalcWorldScale();
    };
    window.addEventListener('resize', resize);

    setupControls();
    DOM.btnStart.addEventListener('click', startGame);
    DOM.btnShare.addEventListener('click', shareResult);
    showOverlay('start');
  });
}

function recalcWorldScale() {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const minDim = Math.min(sw, sh);
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

function hideOverlay() {
  DOM.overlay.classList.add('hidden');
}

// ── Start / Restart ──
function startGame() {
  hideOverlay();
  floor = 1;
  score = 0;
  kills = 0;
  lightRadius = LIGHT_BASE_RADIUS;
  player = {
    x: 0, y: 0,
    hp: 10, maxHp: 10,
    atk: 2, def: 1,
    px: 0, py: 0,
    moveT: 1,
    dirX: 0, dirY: 1,
    fromPX: 0, fromPY: 0,
    toPX: 0, toPY: 0,
  };
  recalcWorldScale();
  generateFloor();
  gameRunning = true;
  updateHUD();
}

// ── Dungeon Generation (BSP-like) ──
function generateFloor() {
  const baseSize = 40 + Math.min(floor * 5, 40);
  mapW = baseSize;
  mapH = baseSize;
  tiles = new Array(mapW * mapH).fill(TILE_WALL);
  explored = new Array(mapW * mapH).fill(false);
  rooms = [];
  enemies = [];
  items = [];

  const roomCount = 5 + Math.min(Math.floor(floor * 0.8), 8);
  generateRooms(roomCount);
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
      if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;

    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        tiles[ry * mapW + rx] = TILE_FLOOR;
      }
    }
  }
}

function connectRooms() {
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    carveCorridor(a.cx, a.cy, b.cx, b.cy);
  }
  if (rooms.length > 4) {
    const a = rooms[0];
    const b = rooms[rooms.length - 1];
    carveCorridor(a.cx, a.cy, b.cx, b.cy);
  }
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
  const lastRoom = rooms[rooms.length - 1];
  tiles[lastRoom.cy * mapW + lastRoom.cx] = TILE_STAIRS;
}

function placePlayer() {
  const firstRoom = rooms[0];
  player.x = firstRoom.cx;
  player.y = firstRoom.cy;
  player.px = player.x * TILE;
  player.py = player.y * TILE;
  player.moveT = 1;
}

// ── Enemies ──
function spawnEnemies() {
  const isBossFloor = floor % 5 === 0;
  const enemyCount = 3 + Math.floor(floor * 1.5);

  for (let i = 0; i < enemyCount; i++) {
    const room = rooms[1 + Math.floor(Math.random() * (rooms.length - 1))];
    if (!room) continue;
    const ex = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
    const ey = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
    if (tiles[ey * mapW + ex] !== TILE_FLOOR) continue;
    if (ex === player.x && ey === player.y) continue;

    const type = Math.random();
    let enemy;
    if (type < 0.35) {
      enemy = { x: ex, y: ey, type: 'slime', hp: 3, maxHp: 3, atk: 1, def: 0, color: COLORS.slime, score: 10, speed: 0.3 };
    } else if (type < 0.6) {
      enemy = { x: ex, y: ey, type: 'bat', hp: 2, maxHp: 2, atk: 1, def: 0, color: COLORS.bat, score: 15, speed: 0.7 };
    } else {
      enemy = { x: ex, y: ey, type: 'skeleton', hp: 5, maxHp: 5, atk: 2, def: 1, color: COLORS.skeleton, score: 30, speed: 0.5 };
    }
    enemy.hp += Math.floor(floor * 0.3);
    enemy.maxHp = enemy.hp;
    enemy.atk += Math.floor(floor * 0.2);
    enemies.push(enemy);
  }

  if (isBossFloor) {
    const bossRoom = rooms[Math.floor(rooms.length / 2)];
    enemies.push({
      x: bossRoom.cx, y: bossRoom.cy,
      type: 'boss', hp: 15 + floor * 2, maxHp: 15 + floor * 2,
      atk: 4 + Math.floor(floor * 0.3), def: 2,
      color: COLORS.boss, score: 100 + floor * 10, speed: 0.6,
    });
  }
}

// ── Items ──
function spawnItems() {
  const itemCount = 3 + Math.floor(floor * 0.5);
  const goldCount = 4 + floor;

  for (let i = 0; i < itemCount; i++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const ix = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
    const iy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
    if (tiles[iy * mapW + ix] !== TILE_FLOOR) continue;

    const t = Math.random();
    let item;
    if (t < 0.35) {
      item = { x: ix, y: iy, type: 'potion', color: COLORS.potionHP, label: '❤️', effect: 'hp' };
    } else if (t < 0.55) {
      item = { x: ix, y: iy, type: 'sword', color: COLORS.sword, label: '🗡️', effect: 'atk' };
    } else if (t < 0.7) {
      item = { x: ix, y: iy, type: 'shield', color: COLORS.shield, label: '🛡️', effect: 'def' };
    } else {
      item = { x: ix, y: iy, type: 'torch', color: COLORS.torch, label: '🔥', effect: 'light' };
    }
    items.push(item);
  }

  for (let i = 0; i < goldCount; i++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const gx = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
    const gy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
    if (tiles[gy * mapW + gx] !== TILE_FLOOR) continue;
    items.push({ x: gx, y: gy, type: 'gold', color: COLORS.gold, label: '●', effect: 'score' });
  }
}

// ── Build World Container ──
let tileGfx, entityGfx, particleContainer;
const particles = [];
const floatingTexts = [];

function buildWorld() {
  worldContainer.removeChildren();
  tileGfx = new PIXI.Graphics();
  entityGfx = new PIXI.Graphics();
  particleContainer = new PIXI.Container();

  worldContainer.addChild(tileGfx);
  worldContainer.addChild(entityGfx);
  worldContainer.addChild(particleContainer);
}

// ── Draw Tiles ──
function drawVisibleWorld() {
  tileGfx.clear();

  const pcx = player.x * TILE + TILE / 2;
  const pcy = player.y * TILE + TILE / 2;
  const flicker = Math.sin(flickerTime * 3) * 0.12 + Math.sin(flickerTime * 7.3) * 0.06;
  const lr = (lightRadius + flicker) * TILE;

  const drawRadius = lightRadius + 3;
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

      if (inLight) {
        explored[idx] = true;
        visibleSet.add(idx);
      }

      if (!inLight && !explored[idx]) continue;

      // Brightness: warm torch-like falloff
      const brightness = inLight ? Math.max(0.25, 1 - (dist / lr) * 0.75) : 0.12;

      let color;
      if (t === TILE_WALL) {
        color = COLORS.wall;
      } else if (t === TILE_FLOOR) {
        color = (x + y) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
      } else if (t === TILE_DOOR) {
        color = COLORS.door;
      } else if (t === TILE_STAIRS) {
        color = COLORS.stairs;
      } else {
        continue;
      }

      tileGfx.beginFill(darkenColor(color, brightness));
      tileGfx.drawRect(px, py, TILE, TILE);
      tileGfx.endFill();

      // Wall top edge highlight (3D cartoon effect)
      if (t === TILE_WALL && inLight && brightness > 0.35) {
        tileGfx.beginFill(darkenColor(COLORS.wallTop, brightness), 0.4);
        tileGfx.drawRect(px, py, TILE, 3);
        tileGfx.endFill();
        // Bottom shadow
        tileGfx.beginFill(0x000000, 0.15);
        tileGfx.drawRect(px, py + TILE - 2, TILE, 2);
        tileGfx.endFill();
      }

      // Stairs golden glow
      if (t === TILE_STAIRS && inLight) {
        const glowPulse = 0.2 + Math.sin(flickerTime * 4) * 0.1;
        tileGfx.beginFill(COLORS.stairsGlow, glowPulse);
        tileGfx.drawCircle(px + TILE / 2, py + TILE / 2, TILE * 0.8);
        tileGfx.endFill();
      }
    }
  }

  // Warm torch ambient glow around player
  if (gameRunning) {
    const glowAlpha = 0.08 + Math.sin(flickerTime * 5) * 0.02;
    tileGfx.beginFill(0x8B6914, glowAlpha);
    tileGfx.drawCircle(pcx, pcy, lr * 0.5);
    tileGfx.endFill();
  }
}

// ── Draw Entities ──
function drawEntities() {
  entityGfx.clear();

  const cx = player.x * TILE + TILE / 2;
  const cy = player.y * TILE + TILE / 2;
  const flicker = Math.sin(flickerTime * 3) * 0.12 + Math.sin(flickerTime * 7.3) * 0.06;
  const lr = (lightRadius + flicker) * TILE;

  // Items
  for (const item of items) {
    const idx = item.y * mapW + item.x;
    if (!visibleSet.has(idx)) continue;

    const px = item.x * TILE + TILE / 2;
    const py = item.y * TILE + TILE / 2;
    const bob = Math.sin(performance.now() * 0.003 + item.x * 2) * 2;

    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    const bright = Math.max(0.3, 1 - dist / lr);

    if (item.type === 'gold') {
      // Gold coin - cartoon circle with highlight
      entityGfx.beginFill(darkenColor(COLORS.gold, bright));
      entityGfx.drawCircle(px, py + bob, 5);
      entityGfx.endFill();
      entityGfx.beginFill(0xFFFFFF, 0.3 * bright);
      entityGfx.drawCircle(px - 1, py + bob - 1, 2);
      entityGfx.endFill();
    } else {
      // Item - rounded rect with glow
      const col = darkenColor(item.color, bright);
      entityGfx.beginFill(col);
      entityGfx.drawRoundedRect(px - 7, py - 7 + bob, 14, 14, 4);
      entityGfx.endFill();
      // Highlight
      entityGfx.beginFill(0xFFFFFF, 0.25 * bright);
      entityGfx.drawRoundedRect(px - 5, py - 6 + bob, 6, 4, 2);
      entityGfx.endFill();
      // Shadow under item
      entityGfx.beginFill(0x000000, 0.15);
      entityGfx.drawEllipse(px, py + 9, 6, 2);
      entityGfx.endFill();
    }
  }

  // Enemies
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const idx = e.y * mapW + e.x;
    if (!visibleSet.has(idx)) continue;

    const px = e.x * TILE + TILE / 2;
    const py = e.y * TILE + TILE / 2;
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    const bright = Math.max(0.35, 1 - dist / lr);
    const col = darkenColor(e.color, bright);

    // Shadow under enemy
    entityGfx.beginFill(0x000000, 0.2);
    entityGfx.drawEllipse(px, py + 12, 8, 3);
    entityGfx.endFill();

    if (e.type === 'slime') {
      // Cartoon slime blob with bounce
      const squish = Math.sin(performance.now() * 0.005) * 1.5;
      entityGfx.beginFill(col);
      entityGfx.drawEllipse(px, py + 2 - squish, 11 + squish, 9 - squish);
      entityGfx.endFill();
      // Highlight
      entityGfx.beginFill(0xFFFFFF, 0.3 * bright);
      entityGfx.drawEllipse(px - 3, py - 3 - squish, 4, 3);
      entityGfx.endFill();
      // Eyes
      entityGfx.beginFill(0xFFFFFF);
      entityGfx.drawCircle(px - 3, py - 1, 3);
      entityGfx.drawCircle(px + 3, py - 1, 3);
      entityGfx.endFill();
      entityGfx.beginFill(0x1B5E20);
      entityGfx.drawCircle(px - 3, py - 1, 1.5);
      entityGfx.drawCircle(px + 3, py - 1, 1.5);
      entityGfx.endFill();
    } else if (e.type === 'bat') {
      // Cartoon bat with flapping wings
      const wingFlap = Math.sin(performance.now() * 0.015) * 4;
      // Body
      entityGfx.beginFill(col);
      entityGfx.drawCircle(px, py, 6);
      entityGfx.endFill();
      // Wings
      entityGfx.beginFill(col, 0.8);
      entityGfx.moveTo(px - 5, py);
      entityGfx.lineTo(px - 15, py - 5 + wingFlap);
      entityGfx.lineTo(px - 10, py - 1 + wingFlap * 0.5);
      entityGfx.lineTo(px - 5, py + 3);
      entityGfx.closePath();
      entityGfx.endFill();
      entityGfx.beginFill(col, 0.8);
      entityGfx.moveTo(px + 5, py);
      entityGfx.lineTo(px + 15, py - 5 + wingFlap);
      entityGfx.lineTo(px + 10, py - 1 + wingFlap * 0.5);
      entityGfx.lineTo(px + 5, py + 3);
      entityGfx.closePath();
      entityGfx.endFill();
      // Eyes
      entityGfx.beginFill(0xFFEB3B);
      entityGfx.drawCircle(px - 2, py - 2, 2);
      entityGfx.drawCircle(px + 2, py - 2, 2);
      entityGfx.endFill();
      entityGfx.beginFill(0x000000);
      entityGfx.drawCircle(px - 2, py - 2, 1);
      entityGfx.drawCircle(px + 2, py - 2, 1);
      entityGfx.endFill();
    } else if (e.type === 'skeleton') {
      // Cartoon skeleton
      entityGfx.beginFill(col);
      entityGfx.drawCircle(px, py - 4, 7);  // skull
      entityGfx.drawRect(px - 3, py + 2, 6, 10); // body
      entityGfx.endFill();
      // Eye sockets
      entityGfx.beginFill(0x424242);
      entityGfx.drawCircle(px - 3, py - 5, 2.5);
      entityGfx.drawCircle(px + 3, py - 5, 2.5);
      entityGfx.endFill();
      // Red eye glow
      entityGfx.beginFill(darkenColor(0xE53935, bright), 0.9);
      entityGfx.drawCircle(px - 3, py - 5, 1.5);
      entityGfx.drawCircle(px + 3, py - 5, 1.5);
      entityGfx.endFill();
    } else if (e.type === 'boss') {
      // Boss - big mean cartoon monster
      const pulse = Math.sin(performance.now() * 0.003) * 1;
      // Aura
      entityGfx.beginFill(darkenColor(0xE53935, bright), 0.15);
      entityGfx.drawCircle(px, py, 18 + pulse);
      entityGfx.endFill();
      // Body
      entityGfx.beginFill(col);
      entityGfx.drawCircle(px, py, 13);
      entityGfx.endFill();
      // Horns
      entityGfx.beginFill(darkenColor(0x8D6E63, bright));
      entityGfx.moveTo(px - 8, py - 10);
      entityGfx.lineTo(px - 12, py - 22);
      entityGfx.lineTo(px - 4, py - 10);
      entityGfx.closePath();
      entityGfx.endFill();
      entityGfx.beginFill(darkenColor(0x8D6E63, bright));
      entityGfx.moveTo(px + 8, py - 10);
      entityGfx.lineTo(px + 12, py - 22);
      entityGfx.lineTo(px + 4, py - 10);
      entityGfx.closePath();
      entityGfx.endFill();
      // Eyes
      entityGfx.beginFill(0xFFD54F);
      entityGfx.drawCircle(px - 5, py - 3, 3.5);
      entityGfx.drawCircle(px + 5, py - 3, 3.5);
      entityGfx.endFill();
      entityGfx.beginFill(0x000000);
      entityGfx.drawCircle(px - 5, py - 3, 1.5);
      entityGfx.drawCircle(px + 5, py - 3, 1.5);
      entityGfx.endFill();
      // Mouth
      entityGfx.lineStyle(2, darkenColor(0x8D0000, bright));
      entityGfx.moveTo(px - 5, py + 5);
      entityGfx.lineTo(px - 3, py + 8);
      entityGfx.lineTo(px + 3, py + 8);
      entityGfx.lineTo(px + 5, py + 5);
      entityGfx.lineStyle(0);
    }

    // HP bar (cartoon style with border)
    if (e.hp < e.maxHp) {
      const barW = 22;
      const barH = 4;
      const bx = px - barW / 2;
      const by = py - 20;
      // Background
      entityGfx.beginFill(0x5D4037);
      entityGfx.drawRoundedRect(bx - 1, by - 1, barW + 2, barH + 2, 2);
      entityGfx.endFill();
      entityGfx.beginFill(0x3E2723);
      entityGfx.drawRoundedRect(bx, by, barW, barH, 1);
      entityGfx.endFill();
      // HP fill
      entityGfx.beginFill(0xE53935);
      entityGfx.drawRoundedRect(bx, by, barW * (e.hp / e.maxHp), barH, 1);
      entityGfx.endFill();
    }
  }

  // Player
  const ppx = player.px + TILE / 2;
  const ppy = player.py + TILE / 2;

  // Player shadow
  entityGfx.beginFill(0x000000, 0.2);
  entityGfx.drawEllipse(ppx, ppy + 12, 9, 3);
  entityGfx.endFill();

  // Player torch glow (subtle warm circle)
  entityGfx.beginFill(0xFFB300, 0.06);
  entityGfx.drawCircle(ppx, ppy, 20);
  entityGfx.endFill();

  // Player body (cartoon adventurer)
  const playerColor = playerDamageFlash > 0 && playerDamageFlash % 2 === 0 ? 0xE53935 : COLORS.player;
  entityGfx.beginFill(playerColor);
  entityGfx.drawCircle(ppx, ppy, 11);
  entityGfx.endFill();

  // Body highlight
  entityGfx.beginFill(COLORS.playerLight, 0.5);
  entityGfx.drawCircle(ppx - 2, ppy - 3, 6);
  entityGfx.endFill();

  // Belt/equator line
  entityGfx.beginFill(COLORS.playerDark);
  entityGfx.drawRect(ppx - 8, ppy + 2, 16, 3);
  entityGfx.endFill();

  // Eyes
  entityGfx.beginFill(0xFFFFFF);
  entityGfx.drawCircle(ppx - 4 + player.dirX * 2, ppy - 3 + player.dirY * 2, 3.5);
  entityGfx.drawCircle(ppx + 4 + player.dirX * 2, ppy - 3 + player.dirY * 2, 3.5);
  entityGfx.endFill();
  entityGfx.beginFill(0x1B5E20);
  entityGfx.drawCircle(ppx - 4 + player.dirX * 3, ppy - 3 + player.dirY * 3, 2);
  entityGfx.drawCircle(ppx + 4 + player.dirX * 3, ppy - 3 + player.dirY * 3, 2);
  entityGfx.endFill();
}

// ── Camera ──
function updateCamera(instant) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const px = isNaN(player.px) ? player.x * TILE : player.px;
  const py = isNaN(player.py) ? player.y * TILE : player.py;
  const targetX = -(px + TILE / 2) * worldScale + sw / 2;
  const targetY = -(py + TILE / 2) * worldScale + sh / 2;

  if (instant || isNaN(worldContainer.x)) {
    worldContainer.x = targetX;
    worldContainer.y = targetY;
  } else {
    worldContainer.x += (targetX - worldContainer.x) * 0.15;
    worldContainer.y += (targetY - worldContainer.y) * 0.15;
  }
}

// ── HUD ──
function drawHUD() {
  hudContainer.removeChildren();

  const sw = app.screen.width;
  const textStyle = { fontFamily: 'Nunito', fontWeight: '800' };

  // HP bar with cartoon border
  const hpBarW = 130;
  const hpBarH = 14;
  const hpX = 14;
  const hpY = 14;

  const hpBg = new PIXI.Graphics();
  // Border (brown)
  hpBg.beginFill(0x5D4037);
  hpBg.drawRoundedRect(hpX - 2, hpY - 2, hpBarW + 4, hpBarH + 4, 6);
  hpBg.endFill();
  // Background (dark)
  hpBg.beginFill(0x3E2723, 0.9);
  hpBg.drawRoundedRect(hpX, hpY, hpBarW, hpBarH, 4);
  hpBg.endFill();
  // HP fill (red → green gradient effect via single color)
  const hpRatio = Math.max(0, player.hp / player.maxHp);
  const hpColor = hpRatio > 0.5 ? 0x4CAF50 : hpRatio > 0.25 ? 0xFFB300 : 0xE53935;
  hpBg.beginFill(hpColor);
  hpBg.drawRoundedRect(hpX, hpY, hpBarW * hpRatio, hpBarH, 4);
  hpBg.endFill();
  // Highlight on HP bar
  hpBg.beginFill(0xFFFFFF, 0.2);
  hpBg.drawRoundedRect(hpX + 2, hpY + 1, hpBarW * hpRatio - 4, 4, 2);
  hpBg.endFill();
  hudContainer.addChild(hpBg);

  const hpText = new PIXI.Text(`HP ${player.hp}/${player.maxHp}`, {
    ...textStyle,
    fontSize: 13,
    fill: 0xFFFFFF,
    stroke: 0x3E2723,
    strokeThickness: 2,
  });
  hpText.x = hpX + 6;
  hpText.y = hpY;
  hudContainer.addChild(hpText);

  const statsText = new PIXI.Text(`ATK:${player.atk}  DEF:${player.def}`, {
    ...textStyle,
    fontSize: 14,
    fill: 0xF5E6D0,
    stroke: 0x3E2723,
    strokeThickness: 2,
  });
  statsText.x = hpX;
  statsText.y = hpY + hpBarH + 8;
  hudContainer.addChild(statsText);

  const floorText = new PIXI.Text(`ANDAR ${floor}`, {
    ...textStyle,
    fontSize: 18,
    fill: 0xFFD54F,
    stroke: 0x5D4037,
    strokeThickness: 3,
  });
  floorText.anchor.set(0.5, 0);
  floorText.x = sw / 2;
  floorText.y = 12;
  hudContainer.addChild(floorText);

  const scoreText = new PIXI.Text(`${score} pts`, {
    ...textStyle,
    fontSize: 15,
    fill: 0xF5E6D0,
    stroke: 0x3E2723,
    strokeThickness: 2,
  });
  scoreText.anchor.set(1, 0);
  scoreText.x = sw - 14;
  scoreText.y = 12;
  hudContainer.addChild(scoreText);
}

function updateHUD() {
  DOM.scoreDisplay.textContent = `Andar ${floor}`;
  DOM.bestDisplay.textContent = bestScore;
  drawHUD();
}

// ── Minimap ──
function updateMinimap() {
  minimapGfx.clear();
  const sw = app.screen.width;
  const sh = app.screen.height;
  const mmScale = 2;
  const mmW = mapW * mmScale;
  const mmH = mapH * mmScale;
  const mmX = sw - mmW - 10;
  const mmY = sh - mmH - 10;

  if (mmW > 150 || mmH > 150) return;

  // Minimap background with border
  minimapGfx.beginFill(0x5D4037);
  minimapGfx.drawRoundedRect(mmX - 4, mmY - 4, mmW + 8, mmH + 8, 4);
  minimapGfx.endFill();
  minimapGfx.beginFill(0x3E2723, 0.85);
  minimapGfx.drawRoundedRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4, 3);
  minimapGfx.endFill();

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const idx = y * mapW + x;
      if (!explored[idx]) continue;
      const t = tiles[idx];
      if (t === TILE_WALL) continue;
      const c = t === TILE_STAIRS ? 0xFFD54F : 0x8D7B6A;
      minimapGfx.beginFill(c, 0.7);
      minimapGfx.drawRect(mmX + x * mmScale, mmY + y * mmScale, mmScale, mmScale);
      minimapGfx.endFill();
    }
  }

  // Player dot (green)
  minimapGfx.beginFill(0x4CAF50);
  minimapGfx.drawRect(mmX + player.x * mmScale - 1, mmY + player.y * mmScale - 1, mmScale + 2, mmScale + 2);
  minimapGfx.endFill();

  // Enemy dots
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const idx = e.y * mapW + e.x;
    if (!explored[idx]) continue;
    minimapGfx.beginFill(e.color, 0.8);
    minimapGfx.drawRect(mmX + e.x * mmScale, mmY + e.y * mmScale, mmScale, mmScale);
    minimapGfx.endFill();
  }
}

// ── Player Movement ──
function tryMove(dx, dy) {
  if (!gameRunning || animating) return;

  player.dirX = dx;
  player.dirY = dy;

  const nx = player.x + dx;
  const ny = player.y + dy;

  if (nx < 0 || nx >= mapW || ny < 0 || ny >= mapH) return;

  const t = tiles[ny * mapW + nx];
  if (t === TILE_WALL) return;

  const enemyHit = enemies.find(e => e.hp > 0 && e.x === nx && e.y === ny);
  if (enemyHit) {
    attackEnemy(enemyHit);
    moveEnemies();
    return;
  }

  player.x = nx;
  player.y = ny;
  animatePlayerTo(nx * TILE, ny * TILE);

  pickupItems();

  if (t === TILE_STAIRS) {
    nextFloor();
    return;
  }

  moveEnemies();
  updateHUD();
}

function animatePlayerTo(tx, ty) {
  player.moveT = 0;
  player.fromPX = player.px;
  player.fromPY = player.py;
  player.toPX = tx;
  player.toPY = ty;
  animating = true;
}

// ── Combat ──
function attackEnemy(enemy) {
  const dmg = Math.max(1, player.atk - (enemy.def || 0));
  enemy.hp -= dmg;
  spawnFloatingText(enemy.x * TILE + TILE / 2, enemy.y * TILE, `-${dmg}`, 0xE53935);

  if (enemy.hp <= 0) {
    score += enemy.score;
    kills++;
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

  if (player.hp <= 0) {
    gameOver();
  }
  updateHUD();
}

function tryAttackAdjacent() {
  if (!gameRunning || animating) return;
  const tx = player.x + player.dirX;
  const ty = player.y + player.dirY;
  const target = enemies.find(e => e.hp > 0 && e.x === tx && e.y === ty);
  if (target) {
    attackEnemy(target);
    moveEnemies();
  } else {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const adj = enemies.find(e => e.hp > 0 && e.x === player.x + dx && e.y === player.y + dy);
      if (adj) {
        player.dirX = dx;
        player.dirY = dy;
        attackEnemy(adj);
        moveEnemies();
        return;
      }
    }
  }
}

// ── Enemy AI ──
function moveEnemies() {
  for (const e of enemies) {
    if (e.hp <= 0) continue;

    const dist = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);

    if (Math.random() > e.speed) continue;

    let mx = 0, my = 0;

    if (e.type === 'slime') {
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      const d = dirs[Math.floor(Math.random() * 4)];
      mx = d[0]; my = d[1];
    } else if (e.type === 'bat') {
      if (dist <= lightRadius + 2) {
        mx = Math.sign(player.x - e.x);
        my = Math.sign(player.y - e.y);
        if (Math.random() < 0.5) mx = 0; else my = 0;
      } else {
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        const d = dirs[Math.floor(Math.random() * 4)];
        mx = d[0]; my = d[1];
      }
    } else if (e.type === 'skeleton' || e.type === 'boss') {
      if (dist <= lightRadius + 3) {
        mx = Math.sign(player.x - e.x);
        my = Math.sign(player.y - e.y);
        if (Math.random() < 0.5) mx = 0; else my = 0;
      } else {
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        const d = dirs[Math.floor(Math.random() * 4)];
        mx = d[0]; my = d[1];
      }
    }

    const nx = e.x + mx;
    const ny = e.y + my;

    if (nx < 0 || nx >= mapW || ny < 0 || ny >= mapH) continue;
    if (tiles[ny * mapW + nx] === TILE_WALL) continue;

    if (nx === player.x && ny === player.y) {
      attackPlayer(e);
      continue;
    }

    if (enemies.some(o => o !== e && o.hp > 0 && o.x === nx && o.y === ny)) continue;

    e.x = nx;
    e.y = ny;
  }
}

// ── Items ──
function pickupItems() {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.x === player.x && item.y === player.y) {
      switch (item.effect) {
        case 'hp':
          player.hp = Math.min(player.maxHp, player.hp + 3);
          spawnFloatingText(player.px + TILE / 2, player.py, '+3 HP', 0xE53935);
          break;
        case 'atk':
          player.atk += 1;
          spawnFloatingText(player.px + TILE / 2, player.py, '+1 ATK', 0x42A5F5);
          break;
        case 'def':
          player.def += 1;
          spawnFloatingText(player.px + TILE / 2, player.py, '+1 DEF', 0xFFD54F);
          break;
        case 'light':
          lightRadius += 1;
          spawnFloatingText(player.px + TILE / 2, player.py, '+1 LUZ', 0xFF8F00);
          recalcWorldScale();
          break;
        case 'score':
          score += 5;
          spawnFloatingText(player.px + TILE / 2, player.py, '+5', 0xFFD54F);
          break;
      }
      spawnSparkle(item.x * TILE + TILE / 2, item.y * TILE + TILE / 2, item.color);
      items.splice(i, 1);
    }
  }
}

// ── Next Floor ──
function nextFloor() {
  floor++;
  score += 100;
  spawnFloatingText(player.px + TILE / 2, player.py - 20, '+100 ANDAR!', 0xFFD54F);
  generateFloor();
  updateHUD();
}

// ── Game Over ──
function gameOver() {
  gameRunning = false;
  const finalScore = score + floor * 50;
  score = finalScore;

  if (finalScore > bestScore) {
    bestScore = finalScore;
    localStorage.setItem('dungeon_best', bestScore.toString());
  }

  try {
    onGameEnd('dungeon', { won: false, score: finalScore });
  } catch (e) { /* integration optional */ }

  DOM.bestDisplay.textContent = bestScore;
  showOverlay('gameover');
}

// ── Particles ──
function spawnDeathParticles(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function spawnSparkle(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 1,
      color,
      size: 1.5 + Math.random() * 2,
    });
  }
}

function spawnFloatingText(x, y, text, color) {
  floatingTexts.push({
    x, y, text, color,
    life: 1,
    vy: -1.5,
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt * 2;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.life -= dt * 1.5;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

function drawParticles() {
  while (particleContainer.children.length > 0) {
    particleContainer.removeChildAt(0);
  }

  const g = new PIXI.Graphics();
  for (const p of particles) {
    g.beginFill(p.color, p.life);
    g.drawCircle(p.x, p.y, p.size * p.life);
    g.endFill();
  }
  particleContainer.addChild(g);

  for (const ft of floatingTexts) {
    const t = new PIXI.Text(ft.text, {
      fontFamily: 'Nunito',
      fontWeight: '800',
      fontSize: 15,
      fill: ft.color,
      stroke: 0x3E2723,
      strokeThickness: 3,
    });
    t.anchor.set(0.5);
    t.x = ft.x;
    t.y = ft.y;
    t.alpha = ft.life;
    particleContainer.addChild(t);
  }
}

// ── Controls ──
const keys = {};

function setupControls() {
  window.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    keys[e.key] = true;

    switch (e.key) {
      case 'w': case 'W': case 'ArrowUp':    tryMove(0, -1); e.preventDefault(); break;
      case 's': case 'S': case 'ArrowDown':   tryMove(0, 1); e.preventDefault(); break;
      case 'a': case 'A': case 'ArrowLeft':   tryMove(-1, 0); e.preventDefault(); break;
      case 'd': case 'D': case 'ArrowRight':  tryMove(1, 0); e.preventDefault(); break;
      case ' ': case 'e': case 'E': tryAttackAdjacent(); e.preventDefault(); break;
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  // Click/tap to move or attack
  app.view.addEventListener('pointerdown', (e) => {
    if (!gameRunning || animating) return;
    const rect = app.view.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (app.screen.width / rect.width);
    const my = (e.clientY - rect.top) * (app.screen.height / rect.height);

    const wx = (mx - worldContainer.x) / worldScale;
    const wy = (my - worldContainer.y) / worldScale;
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);

    const dx = tx - player.x;
    const dy = ty - player.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      player.dirX = dx;
      player.dirY = dy;
      const target = enemies.find(en => en.hp > 0 && en.x === tx && en.y === ty);
      if (target) {
        attackEnemy(target);
        moveEnemies();
        updateHUD();
      } else {
        tryMove(dx, dy);
      }
    }
  });

  // Mobile D-pad
  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
    const handler = (e) => {
      e.preventDefault();
      const dir = btn.dataset.dir;
      switch (dir) {
        case 'up':    tryMove(0, -1); break;
        case 'down':  tryMove(0, 1); break;
        case 'left':  tryMove(-1, 0); break;
        case 'right': tryMove(1, 0); break;
      }
    };
    btn.addEventListener('touchstart', handler, { passive: false });
    btn.addEventListener('mousedown', handler);
  });

  // Attack button
  const atkBtn = document.getElementById('btn-attack');
  if (atkBtn) {
    atkBtn.addEventListener('touchstart', (e) => { e.preventDefault(); tryAttackAdjacent(); }, { passive: false });
    atkBtn.addEventListener('mousedown', () => tryAttackAdjacent());
  }
}

// ── Share ──
function shareResult() {
  const text = `⚔️ Dungeon Crawler: Cheguei ao andar ${floor}! ${kills} monstros derrotados, ${score} pontos!\nJogue: https://gameshub.com.br/games/dungeon/`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// ── Game Loop ──
function gameLoop(ticker) {
  if (!gameRunning) return;

  const dt = ticker.deltaTime / 60;
  flickerTime += dt;

  // Smooth player movement
  if (player.moveT < 1) {
    player.moveT = Math.min(1, player.moveT + dt * 8);
    const t = easeOut(player.moveT);
    player.px = player.fromPX + (player.toPX - player.fromPX) * t;
    player.py = player.fromPY + (player.toPY - player.fromPY) * t;
    if (player.moveT >= 1) {
      player.px = player.toPX;
      player.py = player.toPY;
      animating = false;
    }
  }

  // Guard against NaN
  if (isNaN(player.px)) player.px = player.x * TILE;
  if (isNaN(player.py)) player.py = player.y * TILE;

  if (playerDamageFlash > 0) playerDamageFlash--;

  updateParticles(dt);
  updateCamera(false);

  visibleSet = new Set();
  drawVisibleWorld();
  drawEntities();
  drawParticles();
  updateMinimap();
  drawHUD();
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', boot);
