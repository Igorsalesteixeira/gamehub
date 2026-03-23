/**
 * Dungeon Neon — Roguelike with Dynamic Lighting (PixiJS 7 WebGL)
 * REWRITE: Iluminação direta nos tiles (sem RenderTexture/MULTIPLY)
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
  // Bright base colors for direct rendering (no MULTIPLY overlay)
  floor: 0x4a4a7e,
  floorAlt: 0x424274,
  wall: 0x6a6a9a,
  wallTop: 0x8888bb,
  wallLine: 0x9999cc,
  door: 0x8888aa,
  stairs: 0xffcc00,
  stairsGlow: 0xffaa00,
  player: 0xaa66ff,
  playerGlow: 0xcc88ff,
  slime: 0x33ff66,
  bat: 0xaa66ff,
  skeleton: 0xddddee,
  boss: 0xff3344,
  potionHP: 0xff3344,
  sword: 0x00ccff,
  shield: 0xffcc00,
  torch: 0xff8800,
  gold: 0xffdd44,
  darkness: 0x050510,
};

// ── Helpers ──
function darkenColor(hex, factor) {
  const r = ((hex >> 16) & 0xff) * factor;
  const g = ((hex >> 8) & 0xff) * factor;
  const b = (hex & 0xff) * factor;
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

function tintColor(hex, factor, warmth) {
  let r = ((hex >> 16) & 0xff) * factor;
  let g = ((hex >> 8) & 0xff) * factor;
  let b = (hex & 0xff) * factor;
  // Warm torch tint
  r = Math.min(255, r * (1 + warmth * 0.2));
  g = Math.min(255, g * (1 + warmth * 0.05));
  b = Math.max(0, b * (1 - warmth * 0.15));
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

// ── State ──
let app, worldContainer, fogGfx, hudContainer, minimapGfx;
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

// Visibility cache (updated each frame)
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

  // Wait one frame to ensure layout is computed
  requestAnimationFrame(() => {
    const rect = DOM.container.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || (window.innerHeight - 50);

    app = new PIXI.Application({
      width: w,
      height: h,
      backgroundColor: COLORS.darkness,
      antialias: false,
      resolution: 1, // Force resolution 1 to avoid coordinate mismatches
      autoDensity: false,
    });
    DOM.container.appendChild(app.view);

    // Style canvas to fill container
    app.view.style.width = '100%';
    app.view.style.height = '100%';

    worldContainer = new PIXI.Container();
    fogGfx = new PIXI.Graphics(); // Fog of war overlay (inside worldContainer)
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
    DOM.title.textContent = 'Dungeon Neon';
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
  fogGfx = new PIXI.Graphics();
  particleContainer = new PIXI.Container();

  worldContainer.addChild(tileGfx);
  worldContainer.addChild(entityGfx);
  worldContainer.addChild(particleContainer);
  worldContainer.addChild(fogGfx); // Fog on top of everything in world
}

// ── Draw visible tiles with lighting baked in ──
function drawVisibleWorld() {
  tileGfx.clear();

  // Use player grid position for visibility (avoids px/py mismatch during animation)
  const playerCX = player.x * TILE + TILE / 2;
  const playerCY = player.y * TILE + TILE / 2;
  const flicker = Math.sin(flickerTime * 3) * 0.15 + Math.sin(flickerTime * 7.3) * 0.08;
  const lr = (lightRadius + flicker) * TILE;
  const lrSq = lr * lr;

  // Mark tiles within light radius as visible+explored (simple distance check)
  visibleSet = new Set();
  const ptx = player.x;
  const pty = player.y;
  const tileRadius = lightRadius + 2;
  for (let dy = -tileRadius; dy <= tileRadius; dy++) {
    for (let dx = -tileRadius; dx <= tileRadius; dx++) {
      const tx = ptx + dx;
      const ty = pty + dy;
      if (tx < 0 || tx >= mapW || ty < 0 || ty >= mapH) continue;
      const tileCX = tx * TILE + TILE / 2;
      const tileCY = ty * TILE + TILE / 2;
      const distSq = (tileCX - playerCX) ** 2 + (tileCY - playerCY) ** 2;
      if (distSq <= lrSq) {
        const idx = ty * mapW + tx;
        visibleSet.add(idx);
        explored[idx] = true;
      }
    }
  }

  // Draw tiles in camera viewport
  const sw = app.screen.width;
  const sh = app.screen.height;
  const camX = -worldContainer.x / worldScale;
  const camY = -worldContainer.y / worldScale;
  const viewW = sw / worldScale;
  const viewH = sh / worldScale;

  const startTX = Math.max(0, Math.floor(camX / TILE) - 1);
  const startTY = Math.max(0, Math.floor(camY / TILE) - 1);
  const endTX = Math.min(mapW, Math.ceil((camX + viewW) / TILE) + 1);
  const endTY = Math.min(mapH, Math.ceil((camY + viewH) / TILE) + 1);

  for (let y = startTY; y < endTY; y++) {
    for (let x = startTX; x < endTX; x++) {
      const idx = y * mapW + x;
      const t = tiles[idx];
      const px = x * TILE;
      const py = y * TILE;

      const isVisible = visibleSet.has(idx);
      const isExplored = explored[idx];

      if (!isVisible && !isExplored) continue;

      // Calculate brightness
      let brightness;
      let warmth = 0;
      if (isVisible) {
        const tileCX = px + TILE / 2;
        const tileCY = py + TILE / 2;
        const dist = Math.sqrt((tileCX - playerCX) ** 2 + (tileCY - playerCY) ** 2);
        brightness = Math.max(0.15, 1 - (dist / lr));
        warmth = Math.max(0, 1 - dist / (lr * 0.5));
      } else {
        brightness = 0.12;
      }

      if (t === TILE_WALL) {
        tileGfx.beginFill(tintColor(COLORS.wall, brightness, warmth));
        tileGfx.drawRect(px, py, TILE, TILE);
        tileGfx.endFill();

        if (isVisible && brightness > 0.3) {
          tileGfx.lineStyle(1, tintColor(COLORS.wallLine, brightness * 0.6, warmth), 0.3);
          tileGfx.moveTo(px, py + TILE / 2);
          tileGfx.lineTo(px + TILE, py + TILE / 2);
          if ((x + y) % 2 === 0) {
            tileGfx.moveTo(px + TILE / 2, py);
            tileGfx.lineTo(px + TILE / 2, py + TILE / 2);
          } else {
            tileGfx.moveTo(px + TILE / 2, py + TILE / 2);
            tileGfx.lineTo(px + TILE / 2, py + TILE);
          }
          tileGfx.lineStyle(0);
          tileGfx.beginFill(tintColor(COLORS.wallTop, brightness, warmth), 0.3);
          tileGfx.drawRect(px, py, TILE, 3);
          tileGfx.endFill();
        }
      } else if (t === TILE_FLOOR) {
        const c = (x + y) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
        tileGfx.beginFill(tintColor(c, brightness, warmth));
        tileGfx.drawRect(px, py, TILE, TILE);
        tileGfx.endFill();
      } else if (t === TILE_DOOR) {
        tileGfx.beginFill(tintColor(COLORS.door, brightness, warmth));
        tileGfx.drawRect(px, py, TILE, TILE);
        tileGfx.endFill();
      } else if (t === TILE_STAIRS) {
        tileGfx.beginFill(tintColor(COLORS.floor, brightness, warmth));
        tileGfx.drawRect(px, py, TILE, TILE);
        tileGfx.endFill();
        if (isVisible) {
          tileGfx.beginFill(tintColor(COLORS.stairs, brightness, warmth), 0.8);
          tileGfx.drawRect(px + 4, py + 4, TILE - 8, TILE - 8);
          tileGfx.endFill();
          tileGfx.lineStyle(2, tintColor(COLORS.stairsGlow, brightness, warmth), 0.6);
          for (let s = 0; s < 3; s++) {
            const sy = py + 8 + s * 6;
            tileGfx.moveTo(px + 8, sy);
            tileGfx.lineTo(px + TILE - 8, sy);
          }
          tileGfx.lineStyle(0);
        }
      }
    }
  }

  // Warm torch glow around player
  if (gameRunning) {
    const glowAlpha = 0.12 + Math.sin(flickerTime * 5) * 0.04;
    tileGfx.beginFill(0x664422, glowAlpha);
    tileGfx.drawCircle(playerCX, playerCY, lr * 0.5);
    tileGfx.endFill();
    tileGfx.beginFill(0x886633, glowAlpha * 0.5);
    tileGfx.drawCircle(playerCX, playerCY, lr * 0.25);
    tileGfx.endFill();
  }
}

// ── Draw Entities (only visible ones) ──
function drawEntities() {
  entityGfx.clear();

  const cx = player.x * TILE + TILE / 2;
  const cy = player.y * TILE + TILE / 2;
  const flicker = Math.sin(flickerTime * 3) * 0.15 + Math.sin(flickerTime * 7.3) * 0.08;
  const lr = (lightRadius + flicker) * TILE;

  // Items (only visible)
  for (const item of items) {
    const idx = item.y * mapW + item.x;
    if (!visibleSet.has(idx)) continue;

    const px = item.x * TILE + TILE / 2;
    const py = item.y * TILE + TILE / 2;
    const glow = Math.sin(performance.now() * 0.004 + item.x * 3) * 0.3 + 0.7;

    // Calculate brightness for this item
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    const bright = Math.max(0.2, 1 - dist / lr);

    entityGfx.beginFill(darkenColor(item.color, bright), glow);
    if (item.type === 'gold') {
      entityGfx.drawCircle(px, py, 4);
    } else {
      entityGfx.drawRoundedRect(px - 6, py - 6, 12, 12, 3);
    }
    entityGfx.endFill();
    entityGfx.lineStyle(1, darkenColor(item.color, bright), glow * 0.4);
    entityGfx.drawCircle(px, py, 10);
    entityGfx.lineStyle(0);
  }

  // Enemies (only visible)
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const idx = e.y * mapW + e.x;
    if (!visibleSet.has(idx)) continue;

    const px = e.x * TILE + TILE / 2;
    const py = e.y * TILE + TILE / 2;
    const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    const bright = Math.max(0.3, 1 - dist / lr);
    const col = darkenColor(e.color, bright);

    entityGfx.beginFill(col, 0.9);
    if (e.type === 'slime') {
      entityGfx.drawEllipse(px, py + 2, 10, 8);
    } else if (e.type === 'bat') {
      entityGfx.drawCircle(px, py, 6);
      entityGfx.endFill();
      entityGfx.beginFill(col, 0.6);
      entityGfx.moveTo(px - 6, py);
      entityGfx.lineTo(px - 14, py - 6);
      entityGfx.lineTo(px - 4, py + 2);
      entityGfx.closePath();
      entityGfx.endFill();
      entityGfx.beginFill(col, 0.6);
      entityGfx.moveTo(px + 6, py);
      entityGfx.lineTo(px + 14, py - 6);
      entityGfx.lineTo(px + 4, py + 2);
      entityGfx.closePath();
      entityGfx.endFill();
    } else if (e.type === 'skeleton') {
      entityGfx.drawCircle(px, py - 3, 7);
      entityGfx.drawRect(px - 3, py + 2, 6, 10);
      entityGfx.beginFill(darkenColor(0xff0000, bright), 0.8);
      entityGfx.drawCircle(px - 3, py - 4, 2);
      entityGfx.drawCircle(px + 3, py - 4, 2);
    } else if (e.type === 'boss') {
      entityGfx.drawCircle(px, py, 13);
      entityGfx.beginFill(darkenColor(0xff0000, bright), 0.5);
      entityGfx.drawCircle(px, py, 16);
      entityGfx.beginFill(col);
      entityGfx.moveTo(px - 8, py - 10);
      entityGfx.lineTo(px - 12, py - 20);
      entityGfx.lineTo(px - 4, py - 10);
      entityGfx.closePath();
      entityGfx.endFill();
      entityGfx.beginFill(col);
      entityGfx.moveTo(px + 8, py - 10);
      entityGfx.lineTo(px + 12, py - 20);
      entityGfx.lineTo(px + 4, py - 10);
      entityGfx.closePath();
      entityGfx.endFill();
      entityGfx.beginFill(darkenColor(0xffcc00, bright));
      entityGfx.drawCircle(px - 5, py - 3, 3);
      entityGfx.drawCircle(px + 5, py - 3, 3);
    }
    entityGfx.endFill();

    // HP bar
    if (e.hp < e.maxHp) {
      const barW = 20;
      const barH = 3;
      const bx = px - barW / 2;
      const by = py - 18;
      entityGfx.beginFill(0x330000);
      entityGfx.drawRect(bx, by, barW, barH);
      entityGfx.endFill();
      entityGfx.beginFill(0xff3344);
      entityGfx.drawRect(bx, by, barW * (e.hp / e.maxHp), barH);
      entityGfx.endFill();
    }
  }

  // Player
  const ppx = player.px + TILE / 2;
  const ppy = player.py + TILE / 2;

  // Player glow
  entityGfx.beginFill(COLORS.playerGlow, 0.15);
  entityGfx.drawCircle(ppx, ppy, 18);
  entityGfx.endFill();

  // Player body
  const playerColor = playerDamageFlash > 0 && playerDamageFlash % 2 === 0 ? 0xff0000 : COLORS.player;
  entityGfx.beginFill(playerColor);
  entityGfx.drawCircle(ppx, ppy, 10);
  entityGfx.endFill();

  // Player inner
  entityGfx.beginFill(0xddbbff);
  entityGfx.drawCircle(ppx, ppy, 5);
  entityGfx.endFill();

  // Direction indicator
  entityGfx.beginFill(0xffffff, 0.9);
  entityGfx.drawCircle(ppx + player.dirX * 7, ppy + player.dirY * 7, 3);
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

  // HP bar
  const hpBarW = 120;
  const hpBarH = 12;
  const hpX = 12;
  const hpY = 12;

  const hpBg = new PIXI.Graphics();
  hpBg.beginFill(0x330000, 0.8);
  hpBg.drawRoundedRect(hpX, hpY, hpBarW, hpBarH, 4);
  hpBg.endFill();
  hpBg.beginFill(0xff3344);
  hpBg.drawRoundedRect(hpX, hpY, hpBarW * Math.max(0, player.hp / player.maxHp), hpBarH, 4);
  hpBg.endFill();
  hpBg.lineStyle(1, 0x553333, 0.5);
  hpBg.drawRoundedRect(hpX, hpY, hpBarW, hpBarH, 4);
  hpBg.lineStyle(0);
  hudContainer.addChild(hpBg);

  const hpText = new PIXI.Text(`HP ${player.hp}/${player.maxHp}`, {
    fontFamily: 'VT323',
    fontSize: 14,
    fill: 0xffffff,
  });
  hpText.x = hpX + 4;
  hpText.y = hpY - 1;
  hudContainer.addChild(hpText);

  const statsText = new PIXI.Text(`ATK:${player.atk}  DEF:${player.def}`, {
    fontFamily: 'VT323',
    fontSize: 16,
    fill: 0x00ccff,
  });
  statsText.x = hpX;
  statsText.y = hpY + hpBarH + 6;
  hudContainer.addChild(statsText);

  const floorText = new PIXI.Text(`ANDAR ${floor}`, {
    fontFamily: 'VT323',
    fontSize: 20,
    fill: 0xffcc00,
  });
  floorText.anchor.set(0.5, 0);
  floorText.x = sw / 2;
  floorText.y = 10;
  hudContainer.addChild(floorText);

  const scoreText = new PIXI.Text(`${score} pts`, {
    fontFamily: 'VT323',
    fontSize: 16,
    fill: 0xaa66ff,
  });
  scoreText.anchor.set(1, 0);
  scoreText.x = sw - 12;
  scoreText.y = 10;
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

  minimapGfx.beginFill(0x000000, 0.6);
  minimapGfx.drawRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);
  minimapGfx.endFill();

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const idx = y * mapW + x;
      if (!explored[idx]) continue;
      const t = tiles[idx];
      if (t === TILE_WALL) continue;
      const c = t === TILE_STAIRS ? 0xffcc00 : 0x333355;
      minimapGfx.beginFill(c);
      minimapGfx.drawRect(mmX + x * mmScale, mmY + y * mmScale, mmScale, mmScale);
      minimapGfx.endFill();
    }
  }

  // Player dot
  minimapGfx.beginFill(0xaa66ff);
  minimapGfx.drawRect(mmX + player.x * mmScale - 1, mmY + player.y * mmScale - 1, mmScale + 2, mmScale + 2);
  minimapGfx.endFill();

  // Enemy dots (only visible ones)
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

  // Check enemy collision — attack instead
  const enemyHit = enemies.find(e => e.hp > 0 && e.x === nx && e.y === ny);
  if (enemyHit) {
    attackEnemy(enemyHit);
    moveEnemies();
    return;
  }

  // Move
  player.x = nx;
  player.y = ny;
  animatePlayerTo(nx * TILE, ny * TILE);

  // Check items
  pickupItems();

  // Check stairs
  if (t === TILE_STAIRS) {
    nextFloor();
    return;
  }

  // Enemies move
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
  spawnFloatingText(enemy.x * TILE + TILE / 2, enemy.y * TILE, `-${dmg}`, 0xff3344);

  if (enemy.hp <= 0) {
    score += enemy.score;
    kills++;
    spawnDeathParticles(enemy.x * TILE + TILE / 2, enemy.y * TILE + TILE / 2, enemy.color);
    spawnFloatingText(enemy.x * TILE + TILE / 2, enemy.y * TILE - 10, `+${enemy.score}`, 0xffcc00);
  }
  updateHUD();
}

function attackPlayer(enemy) {
  const dmg = Math.max(1, enemy.atk - player.def);
  player.hp -= dmg;
  spawnFloatingText(player.px + TILE / 2, player.py, `-${dmg}`, 0xff0000);
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
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
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
          spawnFloatingText(player.px + TILE / 2, player.py, '+3 HP', 0xff3344);
          break;
        case 'atk':
          player.atk += 1;
          spawnFloatingText(player.px + TILE / 2, player.py, '+1 ATK', 0x00ccff);
          break;
        case 'def':
          player.def += 1;
          spawnFloatingText(player.px + TILE / 2, player.py, '+1 DEF', 0xffcc00);
          break;
        case 'light':
          lightRadius += 1;
          spawnFloatingText(player.px + TILE / 2, player.py, '+1 LUZ', 0xff8800);
          recalcWorldScale();
          break;
        case 'score':
          score += 5;
          spawnFloatingText(player.px + TILE / 2, player.py, '+5', 0xffdd44);
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
  spawnFloatingText(player.px + TILE / 2, player.py - 20, '+100 ANDAR!', 0xffcc00);
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
      fontFamily: 'VT323',
      fontSize: 16,
      fill: ft.color,
      stroke: 0x000000,
      strokeThickness: 2,
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

    // World coordinates (accounting for scale)
    const wx = (mx - worldContainer.x) / worldScale;
    const wy = (my - worldContainer.y) / worldScale;
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);

    // Check if adjacent to player
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
  const text = `⚔️ Dungeon Neon: Cheguei ao andar ${floor}! ${kills} monstros derrotados, ${score} pontos!\nJogue: https://gameshub.com.br/games/dungeon/`;
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
  // Guard against NaN propagation
  if (isNaN(player.px)) player.px = player.x * TILE;
  if (isNaN(player.py)) player.py = player.y * TILE;

  // Damage flash
  if (playerDamageFlash > 0) playerDamageFlash--;

  updateParticles(dt);
  updateCamera(false);

  // Draw world with inline visibility computation
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
