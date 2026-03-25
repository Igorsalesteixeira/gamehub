'use strict';
// ============================================================
// asset-loader.js — Revolução Gráfica: 0x72 + PixelCrawler + NinjaAdventure
// Carrega PNGs, corta spritesheets, cache de frames
// ============================================================

// --- Image cache ---
const IMAGES = {};
const AUDIO_CACHE = {};
let assetsLoaded = false;
let assetsTotal = 0;
let assetsCount = 0;

// --- Sprite frame size (source) ---
const SRC_TILE = 16; // 0x72 tiles são 16x16, escalados 2x para TILE=32

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

function getFrame(img, col, row, fw, fh, margin) {
  margin = margin || 0;
  const sx = col * (fw + margin);
  const sy = row * (fh + margin);
  return { img, sx, sy, sw: fw, sh: fh };
}

// Extrai frame de spritesheet horizontal (row=0, frame index)
function getHorizFrame(img, frameIndex, fw, fh) {
  return { img, sx: frameIndex * fw, sy: 0, sw: fw, sh: fh };
}

function drawFrame(ctx, frame, dx, dy, dw, dh) {
  if (!frame || !frame.img) return false;
  dw = dw || TILE;
  dh = dh || TILE;
  ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
  return true;
}

// ============================================================
// 0x72 DUNGEON TILESET II — TILES
// Full atlas: 512x512 px
// Individual frames: 16x16 (floors, walls, items)
// ============================================================

// 0x72 usa frames individuais — mapeamos por nome de arquivo
const TILE_FRAME_CACHE = {};

function get0x72Frame(baseName) {
  if (TILE_FRAME_CACHE[baseName]) return TILE_FRAME_CACHE[baseName];
  const img = IMAGES['0x72_' + baseName];
  if (!img) return null;
  const frame = { img, sx: 0, sy: 0, sw: img.width, sh: img.height };
  TILE_FRAME_CACHE[baseName] = frame;
  return frame;
}

// Alias de compatibilidade — getDungeonTile agora usa 0x72 frames
function getDungeonTile(tileKey) {
  // Mapear os antigos tile keys para novos nomes 0x72
  const OLD_TO_NEW = {
    floorStone1: 'floor_1', floorStone2: 'floor_2', floorStone3: 'floor_3',
    floorDark1: 'floor_4', floorDark2: 'floor_5',
    floorBrick1: 'floor_6', floorBrick2: 'floor_7',
    wallTop: 'wall_top_mid', wallMid: 'wall_mid',
    wallLeft: 'wall_left', wallRight: 'wall_right',
    wallCornerTL: 'wall_top_left', wallCornerTR: 'wall_top_right',
    stairsDown: 'floor_stairs',
    spikes: 'floor_spikes_anim_f0',
    torch1: 'wall_fountain_mid_red_anim_f0',
    barrel: 'crate', chest: 'chest_full_open_anim_f0',
    chestOpen: 'chest_empty_open_anim_f2',
    doorClosed: 'doors_leaf_closed', doorOpen: 'doors_leaf_open',
  };
  const mapped = OLD_TO_NEW[tileKey] || tileKey;
  return get0x72Frame(mapped);
}

// ============================================================
// PIXEL CRAWLER — PLAYER CHARACTER
// Horizontal spritesheets: 64x64 frames
// Directions: Down, Side, Up (Side = both left & right, flip horizontally)
// Animations: Idle(4f), Walk(6f), Run(6f), Slice(8f), Hit(4f), Death(8f)
// ============================================================

const PC_FRAME_SIZE = 64; // cada frame do Pixel Crawler

// Mapeamento de animações do player
const PC_PLAYER_ANIMS = {
  idle:   { prefix: 'Idle',  frames: 4 },
  walk:   { prefix: 'Walk',  frames: 6 },
  run:    { prefix: 'Run',   frames: 6 },
  attack: { prefix: 'Slice', frames: 8 },
  hit:    { prefix: 'Hit',   frames: 4 },
  death:  { prefix: 'Death', frames: 8 },
  pierce: { prefix: 'Pierce', frames: 8 },
};

// Direções do PC: Down, Side, Up
const PC_DIR_SUFFIX = { down: 'Down', left: 'Side', right: 'Side', up: 'Up' };

function getPlayerFrame(anim, dir, frameIndex) {
  const a = PC_PLAYER_ANIMS[anim] || PC_PLAYER_ANIMS.idle;
  const dirStr = (typeof dir === 'string') ? dir : ['down','left','right','up'][dir] || 'down';
  const suffix = PC_DIR_SUFFIX[dirStr] || 'Down';
  const key = `pc_player_${a.prefix}_${suffix}`;
  const img = IMAGES[key];
  if (!img) return null;

  const fi = (frameIndex || 0) % a.frames;
  const frame = { img, sx: fi * PC_FRAME_SIZE, sy: 0, sw: PC_FRAME_SIZE, sh: PC_FRAME_SIZE };
  // Side sprites são espelhados para 'left'
  if (dirStr === 'left') frame.flipX = true;
  return frame;
}

// Override drawFrame para suportar flipX
const _origDrawFrame = drawFrame;
function drawFrameEx(ctx, frame, dx, dy, dw, dh) {
  if (!frame || !frame.img) return false;
  dw = dw || TILE;
  dh = dh || TILE;
  if (frame.flipX) {
    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, dx, dy, dw, dh);
  }
  return true;
}

// ============================================================
// 0x72 ENEMIES — Individual frames (idle + run animations)
// Standard heroes: 16x28, Big enemies: 32x36, Small: 16x16
// ============================================================

const ENEMY_SPRITE_MAP = {
  // 0x72 enemies: individual frame files, idle + run (4 frames each)
  // Small enemies (16x16)
  slime:        { pack: '0x72', base: 'goblin',       w: 16, h: 16, idleFrames: 4, runFrames: 4 },
  rato:         { pack: '0x72', base: 'tiny_zombie',   w: 16, h: 16, idleFrames: 4, runFrames: 4 },
  morcego:      { pack: '0x72', base: 'imp',           w: 16, h: 16, idleFrames: 4, runFrames: 4 },
  aranha:       { pack: '0x72', base: 'muddy',         w: 16, h: 16, idleFrames: 4, runFrames: 4 },
  lobo:         { pack: '0x72', base: 'wogol',         w: 16, h: 24, idleFrames: 4, runFrames: 4 },
  goblin:       { pack: '0x72', base: 'goblin',        w: 16, h: 16, idleFrames: 4, runFrames: 4 },
  gobArqueiro:  { pack: '0x72', base: 'masked_orc',    w: 16, h: 20, idleFrames: 4, runFrames: 4 },
  esqSoldado:   { pack: '0x72', base: 'skelet',        w: 16, h: 16, idleFrames: 4, runFrames: 4 },
  kobold:       { pack: '0x72', base: 'swampy',        w: 16, h: 16, idleFrames: 4, runFrames: 4 },
  centopeia:    { pack: '0x72', base: 'slug',          w: 16, h: 16, idleFrames: 4, runFrames: 0 },

  // B2 enemies
  zumbi:        { pack: '0x72', base: 'zombie',        w: 16, h: 16, idleFrames: 4, runFrames: 0 },
  fantasma:     { pack: '0x72', base: 'angel',         w: 16, h: 16, idleFrames: 4, runFrames: 4 },
  necromante:   { pack: '0x72', base: 'necromancer',   w: 16, h: 20, idleFrames: 4, runFrames: 0 },
  vampiroMenor: { pack: '0x72', base: 'chort',         w: 16, h: 24, idleFrames: 4, runFrames: 4 },
  esqArqueiro:  { pack: '0x72', base: 'skelet',        w: 16, h: 16, idleFrames: 4, runFrames: 4 },
  esqGuerreiro: { pack: '0x72', base: 'ice_zombie',    w: 16, h: 16, idleFrames: 4, runFrames: 0 },

  // B3+ enemies
  golemPedra:   { pack: '0x72', base: 'orc_warrior',   w: 16, h: 20, idleFrames: 4, runFrames: 4 },
  cultista:     { pack: '0x72', base: 'orc_shaman',    w: 16, h: 20, idleFrames: 4, runFrames: 4 },
  mimic:        { pack: '0x72', base: 'slug',          w: 16, h: 16, idleFrames: 4, runFrames: 0 },

  // Mini-bosses — larger enemies
  aranhaRainha: { pack: '0x72', base: 'big_zombie',    w: 32, h: 36, idleFrames: 4, runFrames: 4 },
  lichMenor:    { pack: '0x72', base: 'ogre',          w: 32, h: 36, idleFrames: 4, runFrames: 4 },
  golemArcano:  { pack: '0x72', base: 'big_demon',     w: 32, h: 36, idleFrames: 4, runFrames: 4 },
  dragaoMenor:  { pack: '0x72', base: 'big_zombie',    w: 32, h: 36, idleFrames: 4, runFrames: 4 },
  guardaReal:   { pack: '0x72', base: 'ogre',          w: 32, h: 36, idleFrames: 4, runFrames: 4 },

  // Bosses — Ninja Adventure sprites (muito maiores)
  thornax:      { pack: 'na', boss: 'GiantBamboo',     frameSize: 62, idleFrames: 6 },
  morvena:      { pack: 'na', boss: 'GiantSpirit',     frameSize: 50, idleFrames: 5 },
  azaroth:      { pack: 'na', boss: 'DemonCyclop',     frameSize: 50, idleFrames: 5 },
  ignaroth:     { pack: 'na', boss: 'GiantFlam',       frameSize: 50, idleFrames: 5 },
  nahgord:      { pack: 'na', boss: 'TenguRed',        frameSize: 82, idleFrames: 6 },
};

function getEnemyFrame(enemyId, frameIndex, dir) {
  const mapping = ENEMY_SPRITE_MAP[enemyId];
  if (!mapping) return null;

  // Ninja Adventure bosses — horizontal spritesheet
  if (mapping.pack === 'na') {
    const img = IMAGES['boss_' + mapping.boss + '_Idle'];
    if (!img) return null;
    const fi = (frameIndex || 0) % mapping.idleFrames;
    return { img, sx: fi * mapping.frameSize, sy: 0, sw: mapping.frameSize, sh: mapping.frameSize };
  }

  // 0x72 enemies — individual frame PNGs
  const isMoving = dir !== undefined && dir !== null;
  const animType = isMoving && mapping.runFrames > 0 ? 'run' : 'idle';
  const maxFrames = animType === 'run' ? mapping.runFrames : mapping.idleFrames;
  const fi = (frameIndex || 0) % maxFrames;
  const key = `0x72_${mapping.base}_${animType}_anim_f${fi}`;
  const img = IMAGES[key];
  if (!img) {
    // Fallback: tentar idle f0
    const fallback = IMAGES[`0x72_${mapping.base}_idle_anim_f0`];
    if (!fallback) return null;
    return { img: fallback, sx: 0, sy: 0, sw: fallback.width, sh: fallback.height };
  }
  return { img, sx: 0, sy: 0, sw: img.width, sh: img.height };
}

// ============================================================
// NPC SPRITE MAPPING — 0x72 heroes
// knight_m/elf_f/wizzard_m: 16x28 frames, idle(4f) + run(4f)
// ============================================================

const NPC_SPRITE_MAP = {
  selene:   { base: 'elf_f',     w: 16, h: 28 },
  lira:     { base: 'wizzard_m', w: 16, h: 28 },
  bron:     { base: 'knight_m',  w: 16, h: 28 },
  kaelith:  { base: 'dwarf_m',   w: 16, h: 28 },
};

function getNPCFrame(npcId, dir, frameIndex) {
  const mapping = NPC_SPRITE_MAP[npcId];
  if (!mapping) return null;
  const fi = (frameIndex || 0) % 4;
  const key = `0x72_${mapping.base}_idle_anim_f${fi}`;
  const img = IMAGES[key];
  if (!img) return null;
  return { img, sx: 0, sy: 0, sw: img.width, sh: img.height };
}

// ============================================================
// PLAYER CLASS → SPRITE MAPPING (Pixel Crawler)
// Todas as classes usam o mesmo Body_A mas com cores diferentes via tinting
// ============================================================

const CLASS_SPRITE_MAP = {
  guerreiro: 'pc_player',
  mago:      'pc_player',
  arqueiro:  'pc_player',
  assassino: 'pc_player',
  '':        'pc_player',
};

function getPlayerSpriteKey() {
  return 'pc_player';
}

// Compatibility: getCharFrame for old code that may still call it
function getCharFrame(imgKey, anim, dir, frameIndex) {
  // Redirect to new player frame system
  return getPlayerFrame(anim, dir, frameIndex);
}

function facingToDir(facing) {
  if (typeof facing === 'number') return Math.min(3, Math.max(0, facing));
  switch (facing) {
    case 'down': return 0;
    case 'left': return 1;
    case 'right': return 2;
    case 'up': return 3;
    default: return 0;
  }
}

// ============================================================
// ITEM ICONS — 0x72 individual frame files
// ============================================================

function getItemIcon(item) {
  if (!item) return null;

  // Armas
  if (item.slot === 'weapon') {
    const cls = item.cls || '';
    if (cls === 'guerreiro') return get0x72Frame('weapon_regular_sword');
    if (cls === 'mago') return get0x72Frame('weapon_red_magic_staff');
    if (cls === 'arqueiro') return get0x72Frame('weapon_bow');
    if (cls === 'assassino') return get0x72Frame('weapon_knife');
    return get0x72Frame('weapon_regular_sword');
  }

  if (item.slot === 'head') return get0x72Frame('weapon_knight_sword');
  if (item.slot === 'secondary') return get0x72Frame('weapon_big_hammer');
  if (item.slot === 'body') return get0x72Frame('weapon_golden_sword');
  if (item.slot === 'feet') return get0x72Frame('weapon_katana');

  // Consumables
  if (item.id === 'pocaoHP' || item.id === 'pocaoHPG') return get0x72Frame('flask_big_red');
  if (item.id === 'pocaoMana') return get0x72Frame('flask_big_blue');
  if (item.id === 'pocaoStamina') return get0x72Frame('flask_big_yellow');
  if (item.id === 'antidoto') return get0x72Frame('flask_big_green');
  if (item.id === 'bomba') return get0x72Frame('bomb_f0');
  if (item.id === 'pergaminho') return get0x72Frame('flask_red');

  // Generic
  return get0x72Frame('coin_anim_f0');
}

// Compatibility aliases
function getIconFrame(iconKey) {
  // Map old icon keys to 0x72 frames
  const MAP = {
    swordIron: 'weapon_regular_sword', swordSteel: 'weapon_knight_sword',
    swordGold: 'weapon_golden_sword', swordBlue: 'weapon_anime_sword',
    swordPurple: 'weapon_lavish_sword', swordRuby: 'weapon_red_gem_sword',
    staffWood: 'weapon_green_magic_staff', staffBlue: 'weapon_red_magic_staff',
    staffRed: 'weapon_red_magic_staff', staffPurple: 'weapon_red_magic_staff',
    bowWood: 'weapon_bow', bowIron: 'weapon_bow_2', bowGold: 'weapon_bow_2',
    shieldWood: 'weapon_big_hammer', shieldIron: 'weapon_mace', shieldGold: 'weapon_waraxe',
    helmetLeather: 'weapon_katana', helmetIron: 'weapon_saw_sword', helmetGold: 'weapon_golden_sword',
    potionRed: 'flask_big_red', potionBlue: 'flask_big_blue',
    potionGreen: 'flask_big_green', potionYellow: 'flask_big_yellow',
    potionPurple: 'flask_red',
    gemRed: 'flask_red', gemBlue: 'flask_blue', gemGreen: 'flask_green',
    ringGold: 'coin_anim_f0', ringGem: 'coin_anim_f0',
    amulet1: 'coin_anim_f0', amulet2: 'coin_anim_f0',
    coin1: 'coin_anim_f0', coinStack: 'coin_anim_f0',
    scroll1: 'flask_yellow', book1: 'flask_yellow',
    keyBronze: 'coin_anim_f0', keyGold: 'coin_anim_f0',
  };
  return get0x72Frame(MAP[iconKey] || 'coin_anim_f0');
}

// Kenney compatibility stub
function getKenneyTile(tileKey) {
  return getDungeonTile(tileKey);
}

// Slime compatibility
function getSlimeFrame(frameIndex) {
  return getEnemyFrame('slime', frameIndex);
}

// ============================================================
// BIOME TILES — Uses 0x72 floor variants
// ============================================================

const BIOME_TILES = {
  B1: { floor: 'floor_1', floorAlt: 'floor_2', wall: 'wall_top_mid', wallFace: 'wall_mid',
        wallLeft: 'wall_top_left', wallRight: 'wall_top_right', wallEdgeL: 'wall_left', wallEdgeR: 'wall_right' },
  B2: { floor: 'floor_3', floorAlt: 'floor_4', wall: 'wall_top_mid', wallFace: 'wall_mid',
        wallLeft: 'wall_top_left', wallRight: 'wall_top_right', wallEdgeL: 'wall_left', wallEdgeR: 'wall_right' },
  B3: { floor: 'floor_5', floorAlt: 'floor_6', wall: 'wall_top_mid', wallFace: 'wall_mid',
        wallLeft: 'wall_top_left', wallRight: 'wall_top_right', wallEdgeL: 'wall_left', wallEdgeR: 'wall_right' },
  B4: { floor: 'floor_7', floorAlt: 'floor_8', wall: 'wall_top_mid', wallFace: 'wall_mid',
        wallLeft: 'wall_top_left', wallRight: 'wall_top_right', wallEdgeL: 'wall_left', wallEdgeR: 'wall_right' },
  B5: { floor: 'floor_4', floorAlt: 'floor_5', wall: 'wall_top_mid', wallFace: 'wall_mid',
        wallLeft: 'wall_top_left', wallRight: 'wall_top_right', wallEdgeL: 'wall_left', wallEdgeR: 'wall_right' },
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
// AUDIO LOADING (unchanged)
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
  const NEW = 'assets/new/';
  const BASE = 'assets/';

  // --- 0x72 TILE FRAMES (individual PNGs) ---
  const tileFrameNames = [
    // Floors
    'floor_1', 'floor_2', 'floor_3', 'floor_4', 'floor_5', 'floor_6', 'floor_7', 'floor_8',
    'floor_stairs', 'floor_ladder', 'hole',
    'floor_spikes_anim_f0', 'floor_spikes_anim_f1', 'floor_spikes_anim_f2', 'floor_spikes_anim_f3',
    // Walls
    'wall_left', 'wall_mid', 'wall_right',
    'wall_top_left', 'wall_top_mid', 'wall_top_right',
    'wall_edge_bottom_left', 'wall_edge_bottom_right',
    'wall_edge_mid_left', 'wall_edge_mid_right',
    'wall_edge_top_left', 'wall_edge_top_right',
    'wall_edge_left', 'wall_edge_right',
    'wall_outer_front_left', 'wall_outer_front_right',
    'wall_outer_mid_left', 'wall_outer_mid_right',
    'wall_outer_top_left', 'wall_outer_top_right',
    // Doors
    'doors_frame_left', 'doors_frame_right', 'doors_frame_top',
    'doors_leaf_closed', 'doors_leaf_open',
    // Decorations
    'wall_fountain_mid_red_anim_f0', 'wall_fountain_mid_red_anim_f1', 'wall_fountain_mid_red_anim_f2',
    'wall_fountain_mid_blue_anim_f0', 'wall_fountain_mid_blue_anim_f1', 'wall_fountain_mid_blue_anim_f2',
    'wall_banner_blue', 'wall_banner_red', 'wall_banner_green', 'wall_banner_yellow',
    'wall_goo', 'wall_goo_base',
    'wall_hole_1', 'wall_hole_2',
    'column', 'column_wall',
    // Interactive
    'button_red_up', 'button_red_down', 'button_blue_up', 'button_blue_down',
    'lever_left', 'lever_right',
  ];
  const tilePromises = tileFrameNames.map(name =>
    loadImage('0x72_' + name, NEW + 'tiles/' + name + '.png')
  );

  // --- 0x72 ENEMY FRAMES ---
  const enemyTypes = [
    { base: 'goblin',       anims: ['idle', 'run'] },
    { base: 'tiny_zombie',  anims: ['idle', 'run'] },
    { base: 'imp',          anims: ['idle', 'run'] },
    { base: 'muddy',        anims: ['idle'] },
    { base: 'wogol',        anims: ['idle', 'run'] },
    { base: 'masked_orc',   anims: ['idle', 'run'] },
    { base: 'skelet',       anims: ['idle', 'run'] },
    { base: 'swampy',       anims: ['idle'] },
    { base: 'slug',         anims: ['idle'] },
    { base: 'zombie',       anims: ['idle'] },
    { base: 'angel',        anims: ['idle', 'run'] },
    { base: 'necromancer',  anims: ['idle'] },
    { base: 'chort',        anims: ['idle', 'run'] },
    { base: 'ice_zombie',   anims: ['idle'] },
    { base: 'orc_warrior',  anims: ['idle', 'run'] },
    { base: 'orc_shaman',   anims: ['idle', 'run'] },
    { base: 'big_demon',    anims: ['idle', 'run'] },
    { base: 'big_zombie',   anims: ['idle', 'run'] },
    { base: 'ogre',         anims: ['idle', 'run'] },
  ];
  const enemyPromises = [];
  for (const et of enemyTypes) {
    for (const anim of et.anims) {
      for (let f = 0; f < 4; f++) {
        enemyPromises.push(
          loadImage(`0x72_${et.base}_${anim}_anim_f${f}`, NEW + `enemies/${et.base}_${anim}_anim_f${f}.png`)
        );
      }
    }
  }

  // --- 0x72 HERO FRAMES (for NPCs) ---
  const heroTypes = ['knight_m', 'elf_f', 'wizzard_m', 'dwarf_m', 'lizard_m'];
  const heroPromises = [];
  for (const hero of heroTypes) {
    for (const anim of ['idle', 'run']) {
      for (let f = 0; f < 4; f++) {
        heroPromises.push(
          loadImage(`0x72_${hero}_${anim}_anim_f${f}`, NEW + `characters/${hero}_${anim}_anim_f${f}.png`)
        );
      }
    }
    // hit frame (1 only)
    heroPromises.push(
      loadImage(`0x72_${hero}_hit_anim_f0`, NEW + `characters/${hero}_hit_anim_f0.png`)
    );
  }

  // --- 0x72 ITEM FRAMES ---
  const itemNames = [
    'flask_red', 'flask_blue', 'flask_green', 'flask_yellow',
    'flask_big_red', 'flask_big_blue', 'flask_big_green', 'flask_big_yellow',
    'coin_anim_f0', 'coin_anim_f1', 'coin_anim_f2', 'coin_anim_f3',
    'chest_empty_open_anim_f0', 'chest_empty_open_anim_f1', 'chest_empty_open_anim_f2',
    'chest_full_open_anim_f0', 'chest_full_open_anim_f1', 'chest_full_open_anim_f2',
    'chest_mimic_open_anim_f0', 'chest_mimic_open_anim_f1', 'chest_mimic_open_anim_f2',
    'crate', 'skull', 'bomb_f0', 'bomb_f1', 'bomb_f2',
    'weapon_regular_sword', 'weapon_knight_sword', 'weapon_golden_sword',
    'weapon_anime_sword', 'weapon_lavish_sword', 'weapon_red_gem_sword',
    'weapon_bow', 'weapon_bow_2', 'weapon_knife', 'weapon_katana',
    'weapon_big_hammer', 'weapon_mace', 'weapon_waraxe', 'weapon_spear',
    'weapon_red_magic_staff', 'weapon_green_magic_staff',
    'weapon_saw_sword', 'weapon_duel_sword', 'weapon_axe',
    'ui_heart_full', 'ui_heart_half', 'ui_heart_empty',
  ];
  const itemPromises = itemNames.map(name =>
    loadImage('0x72_' + name, NEW + 'items/' + name + '.png')
  );

  // --- PIXEL CRAWLER PLAYER ---
  const pcDirs = ['Down', 'Side', 'Up'];
  const pcAnims = ['Idle', 'Walk', 'Run', 'Slice', 'Hit', 'Death', 'Pierce'];
  const pcPromises = [];
  for (const dir of pcDirs) {
    for (const anim of pcAnims) {
      pcPromises.push(
        loadImage(`pc_player_${anim}_${dir}`, NEW + `characters/player/${anim}_${dir}-Sheet.png`)
      );
    }
  }

  // --- NINJA ADVENTURE BOSS SPRITES ---
  const bossMap = {
    GiantBamboo: ['Idle', 'Attack', 'Walk'],
    GiantSpirit: ['Idle', 'Walk'],
    DemonCyclop: ['Idle', 'Hit'],
    GiantFlam: ['Idle', 'Walk'],
    TenguRed: ['Idle', 'Walk', 'Attack'],
  };
  const bossPromises = [];
  for (const [boss, anims] of Object.entries(bossMap)) {
    for (const anim of anims) {
      bossPromises.push(
        loadImage(`boss_${boss}_${anim}`, NEW + `bosses/${boss}/${anim}.png`)
      );
    }
  }

  // --- KEEP EXISTING AUDIO ---
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
    ...tilePromises,
    ...enemyPromises,
    ...heroPromises,
    ...itemPromises,
    ...pcPromises,
    ...bossPromises,
    ...sfxPromises,
    ...rpgSfxPromises,
    ...musicPromises,
  ]);

  assetsLoaded = true;
  console.log(`[Assets] ${assetsCount}/${assetsTotal} carregados`);
}
