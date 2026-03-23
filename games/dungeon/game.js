/**
 * Dungeon Neon — Roguelike with Dynamic Lighting (PixiJS 7 WebGL)
 */

import { onGameEnd } from '../shared/game-integration.js';
import { GameStats, GameStorage } from '../shared/game-core.js';

const stats = new GameStats('dungeon');
const storage = new GameStorage('dungeon');

// ── Constants ──
const TILE = 32;
const LIGHT_BASE_RADIUS = 6;
const FOG_DIM = 0.15;

const TILE_FLOOR = 0;
const TILE_WALL = 1;
const TILE_DOOR = 2;
const TILE_STAIRS = 3;

const COLORS = {
  floor: 0x1a1a2e,
  floorAlt: 0x16162a,
  wall: 0x2a2a44,
  wallTop: 0x3a3a55,
  wallLine: 0x444466,
  door: 0x555577,
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
  darkness: 0x000008,
};

// ── State ──
let app, worldContainer, lightingLayer, hudContainer, minimapGfx;
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
let pendingEnemyMove = false;

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

  const rect = DOM.container.getBoundingClientRect();
  app = new PIXI.Application({
    width: rect.width,
    height: rect.height,
    backgroundColor: COLORS.darkness,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  DOM.container.appendChild(app.view);

  worldContainer = new PIXI.Container();
  lightingLayer = new PIXI.Graphics();
  hudContainer = new PIXI.Container();
  minimapGfx = new PIXI.Graphics();

  app.stage.addChild(worldContainer);
  app.stage.addChild(lightingLayer);
  app.stage.addChild(hudContainer);
  app.stage.addChild(minimapGfx);

  app.ticker.add(gameLoop);

  // Resize
  const resize = () => {
    const r = DOM.container.getBoundingClientRect();
    app.renderer.resize(r.width, r.height);
  };
  window.addEventListener('resize', resize);

  // Controls
  setupControls();

  // Start button
  DOM.btnStart.addEventListener('click', startGame);
  DOM.btnShare.addEventListener('click', shareResult);

  showOverlay('start');
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
  updateLighting();
  updateMinimap();
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
  // Extra connections for loops
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
      // widen corridor
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
  const sx = lastRoom.cx;
  const sy = lastRoom.cy;
  tiles[sy * mapW + sx] = TILE_STAIRS;
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
    // Scale with floor
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

// ── Build World Sprites ──
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

  drawTiles();
}

function drawTiles() {
  tileGfx.clear();
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const t = tiles[y * mapW + x];
      const px = x * TILE;
      const py = y * TILE;

      if (t === TILE_WALL) {
        tileGfx.beginFill(COLORS.wall);
        tileGfx.drawRect(px, py, TILE, TILE);
        tileGfx.endFill();
        // Brick lines
        tileGfx.lineStyle(1, COLORS.wallLine, 0.3);
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
        // Top highlight
        tileGfx.beginFill(COLORS.wallTop, 0.3);
        tileGfx.drawRect(px, py, TILE, 3);
        tileGfx.endFill();
      } else if (t === TILE_FLOOR) {
        const c = (x + y) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
        tileGfx.beginFill(c);
        tileGfx.drawRect(px, py, TILE, TILE);
        tileGfx.endFill();
      } else if (t === TILE_DOOR) {
        tileGfx.beginFill(COLORS.door);
        tileGfx.drawRect(px, py, TILE, TILE);
        tileGfx.endFill();
      } else if (t === TILE_STAIRS) {
        tileGfx.beginFill(COLORS.floor);
        tileGfx.drawRect(px, py, TILE, TILE);
        tileGfx.endFill();
        tileGfx.beginFill(COLORS.stairs, 0.8);
        tileGfx.drawRect(px + 4, py + 4, TILE - 8, TILE - 8);
        tileGfx.endFill();
        // Stair lines
        tileGfx.lineStyle(2, COLORS.stairsGlow, 0.6);
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

// ── Draw Entities ──
function drawEntities() {
  entityGfx.clear();

  // Items
  for (const item of items) {
    const px = item.x * TILE + TILE / 2;
    const py = item.y * TILE + TILE / 2;
    const glow = Math.sin(performance.now() * 0.004 + item.x * 3) * 0.3 + 0.7;

    entityGfx.beginFill(item.color, glow);
    if (item.type === 'gold') {
      entityGfx.drawCircle(px, py, 4);
    } else {
      entityGfx.drawRoundedRect(px - 6, py - 6, 12, 12, 3);
    }
    entityGfx.endFill();
    // Glow ring
    entityGfx.lineStyle(1, item.color, glow * 0.4);
    entityGfx.drawCircle(px, py, 10);
    entityGfx.lineStyle(0);
  }

  // Enemies
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const px = e.x * TILE + TILE / 2;
    const py = e.y * TILE + TILE / 2;

    // Body
    entityGfx.beginFill(e.color, 0.9);
    if (e.type === 'slime') {
      entityGfx.drawEllipse(px, py + 2, 10, 8);
    } else if (e.type === 'bat') {
      // Wings
      entityGfx.drawCircle(px, py, 6);
      entityGfx.endFill();
      entityGfx.beginFill(e.color, 0.6);
      entityGfx.moveTo(px - 6, py);
      entityGfx.lineTo(px - 14, py - 6);
      entityGfx.lineTo(px - 4, py + 2);
      entityGfx.closePath();
      entityGfx.endFill();
      entityGfx.beginFill(e.color, 0.6);
      entityGfx.moveTo(px + 6, py);
      entityGfx.lineTo(px + 14, py - 6);
      entityGfx.lineTo(px + 4, py + 2);
      entityGfx.closePath();
      entityGfx.endFill();
    } else if (e.type === 'skeleton') {
      entityGfx.drawCircle(px, py - 3, 7);
      entityGfx.drawRect(px - 3, py + 2, 6, 10);
      // Eyes
      entityGfx.beginFill(0xff0000, 0.8);
      entityGfx.drawCircle(px - 3, py - 4, 2);
      entityGfx.drawCircle(px + 3, py - 4, 2);
    } else if (e.type === 'boss') {
      entityGfx.drawCircle(px, py, 13);
      entityGfx.beginFill(0xff0000, 0.5);
      entityGfx.drawCircle(px, py, 16);
      // Horns
      entityGfx.beginFill(e.color);
      entityGfx.moveTo(px - 8, py - 10);
      entityGfx.lineTo(px - 12, py - 20);
      entityGfx.lineTo(px - 4, py - 10);
      entityGfx.closePath();
      entityGfx.endFill();
      entityGfx.beginFill(e.color);
      entityGfx.moveTo(px + 8, py - 10);
      entityGfx.lineTo(px + 12, py - 20);
      entityGfx.lineTo(px + 4, py - 10);
      entityGfx.closePath();
      entityGfx.endFill();
      // Eyes
      entityGfx.beginFill(0xffcc00);
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
  entityGfx.beginFill(COLORS.player);
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

// ── Dynamic Lighting ──
function updateLighting() {
  lightingLayer.clear();

  const sw = app.screen.width;
  const sh = app.screen.height;
  const camX = -worldContainer.x;
  const camY = -worldContainer.y;

  // Player center in world coordinates
  const cx = player.px + TILE / 2;
  const cy = player.py + TILE / 2;
  const flicker = Math.sin(flickerTime * 3) * 0.15 + Math.sin(flickerTime * 7.3) * 0.08;
  const lr = (lightRadius + flicker) * TILE;

  // Screen-space player position
  const screenPX = cx - camX;
  const screenPY = cy - camY;

  // Determine visible tiles range (only process on-screen tiles)
  const startTX = Math.max(0, Math.floor(camX / TILE) - 1);
  const startTY = Math.max(0, Math.floor(camY / TILE) - 1);
  const endTX = Math.min(mapW, Math.ceil((camX + sw) / TILE) + 1);
  const endTY = Math.min(mapH, Math.ceil((camY + sh) / TILE) + 1);

  // Raycast to determine visible tiles
  const visibleSet = new Set();
  const rayCount = 150;

  for (let r = 0; r < rayCount; r++) {
    const angle = (r / rayCount) * Math.PI * 2;
    const rdx = Math.cos(angle);
    const rdy = Math.sin(angle);

    for (let dist = 0; dist < lr; dist += 1.5) {
      const wx = cx + rdx * dist;
      const wy = cy + rdy * dist;
      const tx = Math.floor(wx / TILE);
      const ty = Math.floor(wy / TILE);

      if (tx < 0 || tx >= mapW || ty < 0 || ty >= mapH) break;

      const idx = ty * mapW + tx;
      visibleSet.add(idx);
      explored[idx] = true;

      // Walls block light but are themselves visible
      if (tiles[idx] === TILE_WALL) break;
    }
  }

  // Draw per-tile darkness for on-screen tiles
  for (let ty = startTY; ty < endTY; ty++) {
    for (let tx = startTX; tx < endTX; tx++) {
      const idx = ty * mapW + tx;
      const sx = tx * TILE - camX;
      const sy = ty * TILE - camY;

      if (visibleSet.has(idx)) {
        // Tile is lit — apply partial darkness based on distance
        const tileCX = tx * TILE + TILE / 2;
        const tileCY = ty * TILE + TILE / 2;
        const dist = Math.sqrt((tileCX - cx) ** 2 + (tileCY - cy) ** 2);
        const brightness = Math.max(0, 1 - (dist / lr));
        // brightness 1 = fully lit (no overlay), 0 = fully dark
        const darkness = 1 - brightness;
        if (darkness > 0.03) {
          lightingLayer.beginFill(COLORS.darkness, darkness * 0.88);
          lightingLayer.drawRect(sx - 0.5, sy - 0.5, TILE + 1, TILE + 1);
          lightingLayer.endFill();
        }
      } else if (explored[idx]) {
        // Explored but not in current light — dim fog of war
        lightingLayer.beginFill(COLORS.darkness, 0.8);
        lightingLayer.drawRect(sx - 0.5, sy - 0.5, TILE + 1, TILE + 1);
        lightingLayer.endFill();
      } else {
        // Never explored — completely black
        lightingLayer.beginFill(COLORS.darkness, 1);
        lightingLayer.drawRect(sx - 0.5, sy - 0.5, TILE + 1, TILE + 1);
        lightingLayer.endFill();
      }
    }
  }

  // Also fill edges beyond the map with darkness
  // Left
  if (startTX > 0 || camX < 0) {
    lightingLayer.beginFill(COLORS.darkness, 1);
    lightingLayer.drawRect(-camX - sw, -camY - sh, sw + camX, sh * 3);
    lightingLayer.endFill();
  }

  // Torch glow circle (warm light in center)
  const glowAlpha = 0.08 + Math.sin(flickerTime * 5) * 0.03;
  lightingLayer.beginFill(COLORS.torch, glowAlpha);
  lightingLayer.drawCircle(screenPX, screenPY, lr * 0.35);
  lightingLayer.endFill();

  // Inner bright glow
  lightingLayer.beginFill(0xffcc88, 0.04);
  lightingLayer.drawCircle(screenPX, screenPY, lr * 0.15);
  lightingLayer.endFill();
}

// ── Camera ──
function updateCamera(instant) {
  const sw = app.screen.width;
  const sh = app.screen.height;
  const targetX = -(player.px + TILE / 2) + sw / 2;
  const targetY = -(player.py + TILE / 2) + sh / 2;

  if (instant) {
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

  // HP text
  const hpText = new PIXI.Text(`HP ${player.hp}/${player.maxHp}`, {
    fontFamily: 'VT323',
    fontSize: 14,
    fill: 0xffffff,
  });
  hpText.x = hpX + 4;
  hpText.y = hpY - 1;
  hudContainer.addChild(hpText);

  // Stats
  const statsText = new PIXI.Text(`ATK:${player.atk}  DEF:${player.def}`, {
    fontFamily: 'VT323',
    fontSize: 16,
    fill: 0x00ccff,
  });
  statsText.x = hpX;
  statsText.y = hpY + hpBarH + 6;
  hudContainer.addChild(statsText);

  // Floor center
  const floorText = new PIXI.Text(`ANDAR ${floor}`, {
    fontFamily: 'VT323',
    fontSize: 20,
    fill: 0xffcc00,
  });
  floorText.anchor.set(0.5, 0);
  floorText.x = sw / 2;
  floorText.y = 10;
  hudContainer.addChild(floorText);

  // Score
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

  // Clamp minimap size
  if (mmW > 150 || mmH > 150) return; // Too big, skip

  // Background
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

let playerDamageFlash = 0;

function tryAttackAdjacent() {
  if (!gameRunning || animating) return;
  const tx = player.x + player.dirX;
  const ty = player.y + player.dirY;
  const target = enemies.find(e => e.hp > 0 && e.x === tx && e.y === ty);
  if (target) {
    attackEnemy(target);
    moveEnemies();
  } else {
    // Try any adjacent
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

    // Skip movement randomly based on speed
    if (Math.random() > e.speed) continue;

    let mx = 0, my = 0;

    if (e.type === 'slime') {
      // Random movement
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      const d = dirs[Math.floor(Math.random() * 4)];
      mx = d[0]; my = d[1];
    } else if (e.type === 'bat') {
      // Chase player when close
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
      // Chase player when in range
      if (dist <= lightRadius + 3) {
        mx = Math.sign(player.x - e.x);
        my = Math.sign(player.y - e.y);
        if (Math.random() < 0.5) mx = 0; else my = 0;
      } else {
        // Patrol
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        const d = dirs[Math.floor(Math.random() * 4)];
        mx = d[0]; my = d[1];
      }
    }

    const nx = e.x + mx;
    const ny = e.y + my;

    if (nx < 0 || nx >= mapW || ny < 0 || ny >= mapH) continue;
    if (tiles[ny * mapW + nx] === TILE_WALL) continue;

    // Check collision with player
    if (nx === player.x && ny === player.y) {
      attackPlayer(e);
      continue;
    }

    // Check collision with other enemies
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
  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt * 2;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Floating texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy;
    ft.life -= dt * 1.5;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }
}

function drawParticles() {
  // Remove old particle sprites
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

  // Floating texts
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

  // Click/tap to attack
  app.view.addEventListener('pointerdown', (e) => {
    if (!gameRunning || animating) return;
    const rect = app.view.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (app.screen.width / rect.width);
    const my = (e.clientY - rect.top) * (app.screen.height / rect.height);

    // World coordinates
    const wx = mx - worldContainer.x;
    const wy = my - worldContainer.y;
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
        // Move to clicked tile
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

  // Damage flash
  if (playerDamageFlash > 0) playerDamageFlash--;

  updateParticles(dt);
  updateCamera(false);
  drawEntities();
  drawParticles();
  updateLighting();
  updateMinimap();
  drawHUD();
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', boot);
