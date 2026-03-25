'use strict';
// ============================================================
// asset-loader.js — Carrega PNGs, corta spritesheets, cache
// GDD §ASSETS: assets/*.png → Image() → ctx.drawImage()
// ============================================================

// --- Image cache ---
const IMAGES = {};
const AUDIO_CACHE = {};
let assetsLoaded = false;
let assetsTotal = 0;
let assetsCount = 0;

// --- Sprite frame size (source) ---
const SRC_TILE = 16; // sprites são 16x16, escalados 2x para TILE=32

// ============================================================
// IMAGE LOADING
// ============================================================

function loadImage(key, src) {
  return new Promise((resolve, reject) => {
    assetsTotal++;
    const img = new Image();
    img.onload = () => {
      IMAGES[key] = img;
      assetsCount++;
      updateLoadBar();
      resolve(img);
    };
    img.onerror = () => {
      console.warn(`[Asset] Falha ao carregar: ${src}`);
      assetsCount++;
      updateLoadBar();
      resolve(null); // não bloqueia — fallback procedural
    };
    img.src = src;
  });
}

function updateLoadBar() {
  const bar = document.getElementById('loadBar');
  const text = document.getElementById('loadText');
  if (bar) bar.style.width = (assetsCount / Math.max(assetsTotal, 1) * 100) + '%';
  if (text) text.textContent = `Carregando assets... ${assetsCount}/${assetsTotal}`;
}

// ============================================================
// SPRITESHEET FRAME EXTRACTION
// ============================================================

// Extrai frame de spritesheet com margem
function getFrame(img, col, row, fw, fh, margin) {
  margin = margin || 0;
  const sx = col * (fw + margin);
  const sy = row * (fh + margin);
  return { img, sx, sy, sw: fw, sh: fh };
}

// Desenha frame escalado para TILE (32x32) ou tamanho custom
function drawFrame(ctx, frame, dx, dy, dw, dh) {
  if (!frame || !frame.img) return false;
  dw = dw || TILE;
  dh = dh || TILE;
  ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
  return true;
}

// ============================================================
// PUNY CHARACTER SPRITE SYSTEM
// Spritesheet: 768x256 = 48 cols × 16 rows (16x16 frames)
// Layout (Puny Characters standard):
//   Row 0-1:  Idle (down, left, right, up) — 6 frames each
//   Row 2-3:  Walk (down, left, right, up) — 6 frames each
//   Row 4-5:  Sword attack (down, left, right, up) — 6 frames each
//   Row 6-7:  Bow attack / Stave attack
//   Row 8-9:  Hurt / Death
//   etc.
// Direções: 0=down, 1=left, 2=right, 3=up
// ============================================================

const CHAR_FRAME_W = 32;
const CHAR_FRAME_H = 32;
const CHAR_COLS = 24; // 768 / 32

// Mapeamento de animações para o spritesheet Puny Characters
// Layout REAL: 768×256 = 24 cols × 8 rows de 32×32 frames
// Cada DIREÇÃO = 2 rows. Animações em blocos horizontais de 6 frames.
// Rows 0-1: Down, Rows 2-3: Left, Rows 4-5: Right, Rows 6-7: Up
// Row par (0,2,4,6): Idle(0-5), Walk(6-11), Attack(12-17), Bow(18-23)
// Row ímpar (1,3,5,7): Hurt(0-5), Death(6-11), Cast(12-17), Special(18-23)

const CHAR_DIR_ROW = { down: 0, left: 2, right: 4, up: 6 };
const CHAR_ANIM_COL = {
  idle:   { col: 0,  frames: 6, rowOff: 0 },
  walk:   { col: 6,  frames: 6, rowOff: 0 },
  attack: { col: 12, frames: 6, rowOff: 0 },
  bow:    { col: 18, frames: 6, rowOff: 0 },
  hurt:   { col: 0,  frames: 6, rowOff: 1 },
  death:  { col: 6,  frames: 6, rowOff: 1 },
};

// Converte facing do jogo (0-3 ou string) para index de direção
function facingToDir(facing) {
  if (typeof facing === 'number') {
    // 0=down, 1=left, 2=right, 3=up
    return Math.min(3, Math.max(0, facing));
  }
  switch (facing) {
    case 'down': return 0;
    case 'left': return 1;
    case 'right': return 2;
    case 'up': return 3;
    default: return 0;
  }
}

// Retorna frame de animação para um character sprite
function getCharFrame(imgKey, anim, dir, frameIndex) {
  const img = IMAGES[imgKey];
  if (!img) return null;
  const a = CHAR_ANIM_COL[anim] || CHAR_ANIM_COL.idle;
  const dirStr = (typeof dir === 'string') ? dir : ['down','left','right','up'][dir] || 'down';
  const row = (CHAR_DIR_ROW[dirStr] || 0) + (a.rowOff || 0);
  const col = a.col + (frameIndex % a.frames);
  return getFrame(img, col, row, CHAR_FRAME_W, CHAR_FRAME_H, 0);
}

// ============================================================
// SLIME SPRITE
// Slime.png: 480x32 = 15 cols × 1 row (32x32)
// ============================================================

function getSlimeFrame(frameIndex) {
  const img = IMAGES['slime'];
  if (!img) return null;
  const col = frameIndex % 15;
  return getFrame(img, col, 0, 32, 32, 0);
}

// ============================================================
// DUNGEON TILESET
// punyworld-dungeon-tileset.png: 416x320
// 16x16 tiles com 1px margem
// ============================================================

const DUNGEON_TILE_SIZE = 16;
const DUNGEON_MARGIN = 1;
const DUNGEON_COLS = Math.floor(416 / (DUNGEON_TILE_SIZE + DUNGEON_MARGIN));

// Tile indices mapeados visualmente do spritesheet:
const TILE_MAP = {
  // Floors
  floorStone1:    { col: 0, row: 6 },
  floorStone2:    { col: 1, row: 6 },
  floorStone3:    { col: 2, row: 6 },
  floorDark1:     { col: 0, row: 7 },
  floorDark2:     { col: 1, row: 7 },
  floorBrick1:    { col: 3, row: 6 },
  floorBrick2:    { col: 4, row: 6 },

  // Walls
  wallTop:        { col: 0, row: 0 },
  wallMid:        { col: 0, row: 1 },
  wallLeft:       { col: 2, row: 0 },
  wallRight:      { col: 3, row: 0 },
  wallCornerTL:   { col: 4, row: 0 },
  wallCornerTR:   { col: 5, row: 0 },
  wallCornerBL:   { col: 4, row: 1 },
  wallCornerBR:   { col: 5, row: 1 },

  // Doors
  doorClosed:     { col: 7, row: 3 },
  doorOpen:       { col: 8, row: 3 },

  // Stairs
  stairsDown:     { col: 9, row: 3 },

  // Decorations
  torch1:         { col: 16, row: 0 },
  torch2:         { col: 16, row: 1 },
  barrel:         { col: 22, row: 14 },
  crate:          { col: 23, row: 14 },
  chest:          { col: 21, row: 14 },
  chestOpen:      { col: 21, row: 15 },

  // Hazards
  spikes:         { col: 10, row: 6 },
  lava1:          { col: 0, row: 3 },
  lava2:          { col: 1, row: 3 },
  water1:         { col: 0, row: 4 },
  water2:         { col: 1, row: 4 },
};

function getDungeonTile(tileKey) {
  const t = TILE_MAP[tileKey];
  if (!t) return null;
  const img = IMAGES['dungeonTileset'];
  if (!img) return null;
  return getFrame(img, t.col, t.row, DUNGEON_TILE_SIZE, DUNGEON_TILE_SIZE, DUNGEON_MARGIN);
}

// ============================================================
// KENNEY ROGUELIKE TILESET
// roguelikeSheet_transparent.png: 968x526
// 16x16 tiles com 1px margem = 57 cols × 31 rows
// ============================================================

const KENNEY_COLS = 57;

// Mapeamento visual de tiles úteis do Kenney
const KENNEY_MAP = {
  // Floor tiles (rows 0-3)
  floorWood1:     { col: 0, row: 0 },
  floorWood2:     { col: 1, row: 0 },
  floorStone1:    { col: 3, row: 0 },
  floorStone2:    { col: 4, row: 0 },
  floorGrass1:    { col: 6, row: 0 },
  floorDirt1:     { col: 8, row: 0 },

  // Wall tiles
  wallBrick1:     { col: 16, row: 0 },
  wallBrick2:     { col: 17, row: 0 },
  wallStone1:     { col: 18, row: 0 },

  // Items
  coinGold:       { col: 43, row: 18 },
  coinSilver:     { col: 44, row: 18 },
  potionRed:      { col: 44, row: 22 },
  potionBlue:     { col: 45, row: 22 },
  potionGreen:    { col: 46, row: 22 },
  keyGold:        { col: 47, row: 22 },
  scrollItem:     { col: 48, row: 22 },
  gemRed:         { col: 43, row: 19 },
  gemBlue:        { col: 44, row: 19 },

  // Weapons
  sword1:         { col: 43, row: 24 },
  sword2:         { col: 44, row: 24 },
  axe1:           { col: 45, row: 24 },
  bow1:           { col: 46, row: 24 },
  staff1:         { col: 47, row: 24 },
  dagger1:        { col: 48, row: 24 },

  // Armor
  helmet1:        { col: 43, row: 25 },
  shield1:        { col: 44, row: 25 },
  chestplate1:    { col: 45, row: 25 },
  boots1:         { col: 46, row: 25 },

  // Furniture
  tablewood:      { col: 32, row: 5 },
  chair1:         { col: 33, row: 5 },
};

function getKenneyTile(tileKey) {
  const t = KENNEY_MAP[tileKey];
  if (!t) return null;
  const img = IMAGES['kenneySheet'];
  if (!img) return null;
  return getFrame(img, t.col, t.row, 16, 16, 1);
}

// ============================================================
// ICON PACK (Kyrise 16x16)
// spritesheet_16x16.png: 256x304 = 16 cols × 19 rows (16x16, no margin)
// ============================================================

const ICON_COLS = 16;

// Mapeamento de ícones por categoria
const ICON_MAP = {
  // Swords (row 0)
  swordIron:      { col: 0, row: 0 },
  swordSteel:     { col: 1, row: 0 },
  swordGold:      { col: 2, row: 0 },
  swordRuby:      { col: 3, row: 0 },
  swordBlue:      { col: 4, row: 0 },
  swordGreen:     { col: 5, row: 0 },
  swordPurple:    { col: 6, row: 0 },

  // Staffs (row 1)
  staffWood:      { col: 0, row: 1 },
  staffBlue:      { col: 1, row: 1 },
  staffRed:       { col: 2, row: 1 },
  staffGreen:     { col: 3, row: 1 },
  staffPurple:    { col: 4, row: 1 },

  // Bows (row 2)
  bowWood:        { col: 0, row: 2 },
  bowIron:        { col: 1, row: 2 },
  bowGold:        { col: 2, row: 2 },

  // Shields (row 3)
  shieldWood:     { col: 0, row: 3 },
  shieldIron:     { col: 1, row: 3 },
  shieldGold:     { col: 2, row: 3 },

  // Helmets (row 4)
  helmetLeather:  { col: 0, row: 4 },
  helmetIron:     { col: 1, row: 4 },
  helmetGold:     { col: 2, row: 4 },

  // Potions (row 5)
  potionRed:      { col: 0, row: 5 },
  potionBlue:     { col: 1, row: 5 },
  potionGreen:    { col: 2, row: 5 },
  potionYellow:   { col: 3, row: 5 },
  potionPurple:   { col: 4, row: 5 },

  // Gems (row 7)
  gemRed:         { col: 0, row: 7 },
  gemBlue:        { col: 1, row: 7 },
  gemGreen:       { col: 2, row: 7 },
  gemPurple:      { col: 3, row: 7 },
  gemYellow:      { col: 4, row: 7 },

  // Rings/Amulets (row 9)
  ringGold:       { col: 0, row: 9 },
  ringGem:        { col: 1, row: 9 },
  amulet1:        { col: 2, row: 9 },
  amulet2:        { col: 3, row: 9 },

  // Keys (row 11)
  keyBronze:      { col: 0, row: 11 },
  keyGold:        { col: 1, row: 11 },

  // Scrolls / Books (row 12)
  scroll1:        { col: 0, row: 12 },
  book1:          { col: 1, row: 12 },

  // Coins (row 13)
  coin1:          { col: 0, row: 13 },
  coinStack:      { col: 1, row: 13 },
  ingot:          { col: 2, row: 13 },
};

function getIconFrame(iconKey) {
  const t = ICON_MAP[iconKey];
  if (!t) return null;
  const img = IMAGES['iconSheet'];
  if (!img) return null;
  return getFrame(img, t.col, t.row, 16, 16, 0);
}

// ============================================================
// RPG ENEMIES SPRITESHEET
// rpg_enemies.png: 240x192
// Mixed sizes — mapped manually from visual inspection
// Row heights vary. Each enemy type ~16x16 with some 16x24
// ============================================================

const ENEMY_SPRITE_MAP = {
  // Mapeamento de enemy.def.id → posição no spritesheet ou character sheet
  // Puny Character sheets: 32×32 frames. rpgEnemies: 16×16 frames.
  slime:        { sheet: 'slime', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  rato:         { sheet: 'rpgEnemies', col: 0, row: 4, w: 16, h: 16, frames: 3 },
  morcego:      { sheet: 'rpgEnemies', col: 4, row: 0, w: 16, h: 16, frames: 3 },
  aranha:       { sheet: 'rpgEnemies', col: 3, row: 3, w: 16, h: 16, frames: 2 },
  lobo:         { sheet: 'rpgEnemies', col: 0, row: 2, w: 16, h: 16, frames: 3 },
  goblin:       { sheet: 'orcPeonRed', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  gobArqueiro:  { sheet: 'orcPeonCyan', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  esqSoldado:   { sheet: 'rpgEnemies', col: 0, row: 3, w: 16, h: 16, frames: 3 },
  kobold:       { sheet: 'rpgEnemies', col: 3, row: 4, w: 16, h: 16, frames: 3 },
  centopeia:    { sheet: 'rpgEnemies', col: 0, row: 1, w: 16, h: 16, frames: 3 },

  // B2 humanoids — use soldier/warrior variants
  zumbi:        { sheet: 'rpgEnemies', col: 0, row: 5, w: 16, h: 16, frames: 3 },
  fantasma:     { sheet: 'rpgEnemies', col: 7, row: 0, w: 16, h: 16, frames: 2 },
  necromante:   { sheet: 'mageRed', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  vampiroMenor: { sheet: 'mageCyan', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  esqArqueiro:  { sheet: 'rpgEnemies', col: 3, row: 3, w: 16, h: 16, frames: 3 },
  esqGuerreiro: { sheet: 'rpgEnemies', col: 0, row: 3, w: 16, h: 16, frames: 3 },

  // B3+
  golemPedra:   { sheet: 'rpgEnemies', col: 7, row: 3, w: 16, h: 16, frames: 2 },
  cultista:     { sheet: 'mageRed', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  mimic:        { sheet: 'rpgEnemies', col: 5, row: 4, w: 16, h: 16, frames: 2 },

  // Bosses — usam Warrior/Soldier com escala maior
  thornax:      { sheet: 'warriorRed', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  morvena:      { sheet: 'mageRed', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  azaroth:      { sheet: 'mageCyan', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  ignaroth:     { sheet: 'soldierRed', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  nahgord:      { sheet: 'archerPurple', col: 0, row: 0, w: 32, h: 32, frames: 6 },

  // Mini-bosses
  aranhaRainha: { sheet: 'rpgEnemies', col: 3, row: 3, w: 16, h: 16, frames: 2 },
  lichMenor:    { sheet: 'mageRed', col: 0, row: 0, w: 32, h: 32, frames: 6 },
  golemArcano:  { sheet: 'rpgEnemies', col: 7, row: 3, w: 16, h: 16, frames: 2 },
  dragaoMenor:  { sheet: 'rpgEnemies', col: 7, row: 1, w: 16, h: 16, frames: 2 },
  guardaReal:   { sheet: 'soldierYellow', col: 0, row: 0, w: 32, h: 32, frames: 6 },
};

function getEnemyFrame(enemyId, frameIndex, dir) {
  const mapping = ENEMY_SPRITE_MAP[enemyId];
  if (!mapping) return null;

  const img = IMAGES[mapping.sheet];
  if (!img) return null;

  if (mapping.sheet === 'slime') {
    return getSlimeFrame(frameIndex);
  }

  // Para character sheets (768x256), usar layout correto:
  // Rows por direção (0=down,2=left,4=right,6=up), cols por animação
  if (['orcPeonRed', 'orcPeonCyan', 'orcGrunt', 'mageRed', 'mageCyan',
       'warriorRed', 'warriorBlue', 'soldierRed', 'soldierBlue',
       'soldierYellow', 'archerGreen', 'archerPurple',
       'humanSoldierRed', 'humanSoldierCyan'].includes(mapping.sheet)) {
    const dirStr = (typeof dir === 'string') ? dir : ['down','left','right','up'][facingToDir(dir || 0)] || 'down';
    const row = CHAR_DIR_ROW[dirStr] || 0;
    const col = (mapping.col || 0) + ((frameIndex || 0) % mapping.frames);
    return getFrame(img, col, row, mapping.w, mapping.h, 0);
  }

  // Para rpgEnemies (sheet simples)
  const col = mapping.col + ((frameIndex || 0) % mapping.frames);
  return getFrame(img, col, mapping.row, mapping.w, mapping.h, 0);
}

// ============================================================
// ITEM ICON MAPPING
// Mapeia slot + tier para ícone
// ============================================================

function getItemIcon(item) {
  if (!item) return null;
  const tier = item.tier || 0;

  // Armas
  if (item.slot === 'weapon') {
    const cls = item.cls || '';
    if (cls === 'guerreiro') return getIconFrame(tier >= 3 ? 'swordGold' : tier >= 1 ? 'swordSteel' : 'swordIron');
    if (cls === 'mago') return getIconFrame(tier >= 3 ? 'staffPurple' : tier >= 1 ? 'staffBlue' : 'staffWood');
    if (cls === 'arqueiro') return getIconFrame(tier >= 3 ? 'bowGold' : tier >= 1 ? 'bowIron' : 'bowWood');
    if (cls === 'assassino') return getIconFrame(tier >= 3 ? 'swordPurple' : tier >= 1 ? 'swordBlue' : 'swordIron');
    return getIconFrame('swordIron');
  }

  if (item.slot === 'head') return getIconFrame(tier >= 3 ? 'helmetGold' : tier >= 1 ? 'helmetIron' : 'helmetLeather');
  if (item.slot === 'secondary') return getIconFrame(tier >= 3 ? 'shieldGold' : tier >= 1 ? 'shieldIron' : 'shieldWood');
  if (item.slot === 'body') return getIconFrame(tier >= 3 ? 'helmetGold' : 'helmetIron');
  if (item.slot === 'feet') return getIconFrame('helmetLeather');

  if (item.type === 'ring') return getIconFrame('ringGem');
  if (item.type === 'amulet') return getIconFrame('amulet1');

  // Consumíveis
  if (item.id === 'pocaoHP' || item.id === 'pocaoHPG') return getIconFrame('potionRed');
  if (item.id === 'pocaoMana') return getIconFrame('potionBlue');
  if (item.id === 'pocaoStamina') return getIconFrame('potionYellow');
  if (item.id === 'antidoto') return getIconFrame('potionGreen');
  if (item.id === 'bomba') return getIconFrame('gemRed');
  if (item.id === 'pergaminho') return getIconFrame('scroll1');

  return getIconFrame('coin1');
}

// ============================================================
// NPC SPRITE MAPPING
// ============================================================

const NPC_SPRITE_MAP = {
  selene:   'mageCyan',
  lira:     'archerPurple',
  bron:     'warriorRed',
  kaelith:  'archerGreen',
};

function getNPCFrame(npcId, dir, frameIndex) {
  const sheetKey = NPC_SPRITE_MAP[npcId];
  if (!sheetKey) return null;
  const img = IMAGES[sheetKey];
  if (!img) return null;
  const dirStr = (typeof dir === 'string') ? dir : ['down','left','right','up'][facingToDir(dir || 0)] || 'down';
  const row = CHAR_DIR_ROW[dirStr] || 0;
  const col = (frameIndex || 0) % 6; // idle animation (cols 0-5)
  return getFrame(img, col, row, CHAR_FRAME_W, CHAR_FRAME_H, 0);
}

// ============================================================
// PLAYER CLASS → SPRITE MAPPING
// ============================================================

const CLASS_SPRITE_MAP = {
  guerreiro: 'warriorBlue',
  mago:      'mageCyan',
  arqueiro:  'archerGreen',
  assassino: 'archerPurple',
  '':        'characterBase', // sem classe
};

function getPlayerSpriteKey() {
  if (typeof player !== 'undefined' && player.cls) {
    return CLASS_SPRITE_MAP[player.cls] || 'characterBase';
  }
  return 'characterBase';
}

// ============================================================
// AUDIO LOADING
// ============================================================

function loadAudio(key, src, options) {
  options = options || {};
  return new Promise((resolve) => {
    assetsTotal++;
    const audio = new Audio();
    audio.preload = 'auto';
    if (options.loop) audio.loop = true;
    if (options.volume !== undefined) audio.volume = options.volume;
    audio.oncanplaythrough = () => {
      AUDIO_CACHE[key] = audio;
      assetsCount++;
      updateLoadBar();
      resolve(audio);
    };
    audio.onerror = () => {
      console.warn(`[Audio] Falha ao carregar: ${src}`);
      assetsCount++;
      updateLoadBar();
      resolve(null);
    };
    audio.src = src;
  });
}

function playMusic(key) {
  // Para música atual
  Object.values(AUDIO_CACHE).forEach(a => {
    if (a && a.loop) { a.pause(); a.currentTime = 0; }
  });
  const audio = AUDIO_CACHE[key];
  if (audio) {
    audio.currentTime = 0;
    audio.volume = (typeof musicVolume !== 'undefined') ? musicVolume : 0.4;
    audio.play().catch(() => {});
  }
}

function playSfxReal(key) {
  const audio = AUDIO_CACHE[key];
  if (!audio) return;
  const clone = audio.cloneNode();
  clone.volume = (typeof sfxVolume !== 'undefined') ? sfxVolume : 0.8;
  clone.play().catch(() => {});
}

// ============================================================
// BIOME → TILESET THEME MAPPING
// ============================================================

const BIOME_TILES = {
  B1: { floor: 'floorStone1', floorAlt: 'floorStone2', wall: 'wallTop', wallFace: 'wallMid' },
  B2: { floor: 'floorDark1',  floorAlt: 'floorDark2',  wall: 'wallTop', wallFace: 'wallMid' },
  B3: { floor: 'floorBrick1', floorAlt: 'floorBrick2', wall: 'wallTop', wallFace: 'wallMid' },
  B4: { floor: 'floorStone3', floorAlt: 'floorStone1', wall: 'wallTop', wallFace: 'wallMid' },
  B5: { floor: 'floorDark1',  floorAlt: 'floorDark2',  wall: 'wallTop', wallFace: 'wallMid' },
};

function getBiomeTiles() {
  const floor = typeof currentFloor !== 'undefined' ? currentFloor : 1;
  if (floor <= 5) return BIOME_TILES.B1;
  if (floor <= 10) return BIOME_TILES.B2;
  if (floor <= 15) return BIOME_TILES.B3;
  if (floor <= 20) return BIOME_TILES.B4;
  return BIOME_TILES.B5;
}

// ============================================================
// MUSIC MAPPING POR BIOMA
// ============================================================

const BIOME_MUSIC_REAL = {
  B1: 'musicDungeon',
  B2: 'musicSpooky',
  B3: 'musicGreatMission',
  B4: 'musicDoomed',
  B5: 'musicWakingDevil',
  boss: 'musicBattle',
  menu: 'musicMenu',
  victory: 'musicFlags',
};

function playBiomeMusic() {
  const floor = typeof currentFloor !== 'undefined' ? currentFloor : 1;
  // Boss floors
  if ([5, 10, 15, 20, 25].includes(floor)) {
    playMusic(BIOME_MUSIC_REAL.boss);
    return;
  }
  let key;
  if (floor <= 5) key = BIOME_MUSIC_REAL.B1;
  else if (floor <= 10) key = BIOME_MUSIC_REAL.B2;
  else if (floor <= 15) key = BIOME_MUSIC_REAL.B3;
  else if (floor <= 20) key = BIOME_MUSIC_REAL.B4;
  else key = BIOME_MUSIC_REAL.B5;
  playMusic(key);
}

// ============================================================
// MASTER LOAD — Carrega todos os assets
// ============================================================

async function loadAllAssets() {
  const BASE = 'assets/';

  // Character sprites
  const charPromises = [
    loadImage('characterBase', BASE + 'characters/Puny-Characters/Character-Base.png'),
    loadImage('warriorBlue', BASE + 'characters/Puny-Characters/Warrior-Blue.png'),
    loadImage('warriorRed', BASE + 'characters/Puny-Characters/Warrior-Red.png'),
    loadImage('soldierBlue', BASE + 'characters/Puny-Characters/Soldier-Blue.png'),
    loadImage('soldierRed', BASE + 'characters/Puny-Characters/Soldier-Red.png'),
    loadImage('soldierYellow', BASE + 'characters/Puny-Characters/Soldier-Yellow.png'),
    loadImage('archerGreen', BASE + 'characters/Puny-Characters/Archer-Green.png'),
    loadImage('archerPurple', BASE + 'characters/Puny-Characters/Archer-Purple.png'),
    loadImage('mageCyan', BASE + 'characters/Puny-Characters/Mage-Cyan.png'),
    loadImage('mageRed', BASE + 'characters/Puny-Characters/Mage-Red.png'),
    loadImage('orcGrunt', BASE + 'characters/Puny-Characters/Orc-Grunt.png'),
    loadImage('orcPeonRed', BASE + 'characters/Puny-Characters/Orc-Peon-Red.png'),
    loadImage('orcPeonCyan', BASE + 'characters/Puny-Characters/Orc-Peon-Cyan.png'),
    loadImage('orcSoldierRed', BASE + 'characters/Puny-Characters/Orc-Soldier-Red.png'),
    loadImage('orcSoldierCyan', BASE + 'characters/Puny-Characters/Orc-Soldier-Cyan.png'),
    loadImage('humanSoldierRed', BASE + 'characters/Puny-Characters/Human-Soldier-Red.png'),
    loadImage('humanSoldierCyan', BASE + 'characters/Puny-Characters/Human-Soldier-Cyan.png'),
    loadImage('humanWorkerRed', BASE + 'characters/Puny-Characters/Human-Worker-Red.png'),
    loadImage('humanWorkerCyan', BASE + 'characters/Puny-Characters/Human-Worker-Cyan.png'),
    loadImage('slime', BASE + 'characters/Puny-Characters/Slime.png'),
  ];

  // Tilesets
  const tilePromises = [
    loadImage('dungeonTileset', BASE + 'dungeon/PUNY_DUNGEON_v1/punyworld-dungeon-tileset.png'),
    loadImage('overworldTileset', BASE + 'dungeon/punyworld-overworld-tileset.png'),
    loadImage('dungeonTilesAlt', BASE + 'dungeon/dungeon_tiles.png'),
    loadImage('kenneySheet', BASE + 'kenney/Spritesheet/roguelikeSheet_transparent.png'),
    loadImage('zeldaCave', BASE + 'zelda/gfx/cave.png'),
    loadImage('zeldaOverworld', BASE + 'zelda/gfx/Overworld.png'),
    loadImage('zeldaObjects', BASE + 'zelda/gfx/objects.png'),
    loadImage('zeldaInner', BASE + 'zelda/gfx/Inner.png'),
    loadImage('zeldaChar', BASE + 'zelda/gfx/character.png'),
  ];

  // Enemies & Icons
  const miscPromises = [
    loadImage('rpgEnemies', BASE + 'enemies/rpg_enemies.png'),
    loadImage('iconSheet', BASE + "icons/Kyrise's 16x16 RPG Icon Pack - V1.2/spritesheet/spritesheet_16x16.png"),
  ];

  // Sound effects (Kenney OGG) — nomes exatos do pack
  const sfxDir = BASE + 'sounds/kenney/OGG/';
  const sfxFiles = [
    'bookClose', 'bookFlip1', 'bookOpen',
    'chop', 'cloth1', 'cloth2', 'cloth3',
    'doorClose_1', 'doorClose_2', 'doorOpen_1', 'doorOpen_2',
    'drawKnife1', 'drawKnife2', 'drawKnife3',
    'handleCoins', 'handleCoins2',
    'handleSmallLeather', 'handleSmallLeather2',
    'knifeSlice', 'knifeSlice2',
    'metalClick', 'metalLatch',
    'metalPot1', 'metalPot2', 'metalPot3',
  ];
  const sfxPromises = sfxFiles.map(f => loadAudio('sfx_' + f, sfxDir + f + '.ogg'));

  // RPG Sound Pack (WAV) — caminhos exatos
  const rpgSfxDir = BASE + 'sounds/rpg_pack/RPG Sound Pack/';
  const rpgSfxFiles = [
    { key: 'sfx_hit', path: 'battle/swing.wav' },
    { key: 'sfx_swing2', path: 'battle/swing2.wav' },
    { key: 'sfx_spell', path: 'battle/spell.wav' },
    { key: 'sfx_swordDraw', path: 'battle/sword-unsheathe.wav' },
    { key: 'sfx_coin1', path: 'inventory/coin.wav' },
    { key: 'sfx_coin2', path: 'inventory/coin2.wav' },
    { key: 'sfx_bottle', path: 'inventory/bottle.wav' },
    { key: 'sfx_armorLight', path: 'inventory/armor-light.wav' },
    { key: 'sfx_menuOpen', path: 'interface/interface1.wav' },
    { key: 'sfx_menuClose', path: 'interface/interface2.wav' },
    { key: 'sfx_menuSelect', path: 'interface/interface3.wav' },
    { key: 'sfx_menuCursor', path: 'interface/interface4.wav' },
    { key: 'sfx_door', path: 'world/door.wav' },
    { key: 'sfx_slime', path: 'NPC/slime/slime1.wav' },
    { key: 'sfx_monster', path: 'NPC/gutteral beast/mnstr1.wav' },
  ];
  const rpgSfxPromises = rpgSfxFiles.map(f => loadAudio(f.key, rpgSfxDir + f.path));

  // Music
  const musicDir = BASE + 'music/';
  const musicPromises = [
    loadAudio('musicDungeon', musicDir + 'dungeon_ambient.ogg', { loop: true, volume: 0.4 }),
    loadAudio('musicSpooky', musicDir + 'spooky_dungeon.ogg', { loop: true, volume: 0.4 }),
    loadAudio('musicBattle', musicDir + 'battle_rpg_theme.mp3', { loop: true, volume: 0.4 }),
    loadAudio('musicDoomed', musicDir + 'Alexander Ehlers - Free Music Pack/Alexander Ehlers - Doomed.mp3', { loop: true, volume: 0.4 }),
    loadAudio('musicWakingDevil', musicDir + 'Alexander Ehlers - Free Music Pack/Alexander Ehlers - Waking the devil.mp3', { loop: true, volume: 0.4 }),
    loadAudio('musicGreatMission', musicDir + 'Alexander Ehlers - Free Music Pack/Alexander Ehlers - Great mission.mp3', { loop: true, volume: 0.4 }),
    loadAudio('musicFlags', musicDir + 'Alexander Ehlers - Free Music Pack/Alexander Ehlers - Flags.mp3', { loop: true, volume: 0.3 }),
    loadAudio('musicMenu', musicDir + 'fantasy_menu.mp3', { loop: true, volume: 0.4 }),
    loadAudio('musicHardDungeon', musicDir + 'hard_dungeon.mp3', { loop: true, volume: 0.4 }),
  ];

  // Carrega tudo em paralelo
  await Promise.all([
    ...charPromises,
    ...tilePromises,
    ...miscPromises,
    ...sfxPromises,
    ...rpgSfxPromises,
    ...musicPromises,
  ]);

  assetsLoaded = true;
  console.log(`[Assets] ${assetsCount}/${assetsTotal} carregados`);
}
