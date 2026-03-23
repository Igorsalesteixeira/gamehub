/**
 * Gravity Pulse — Puzzle Gravitacional com PixiJS 7 WebGL
 * Controle campos de gravidade para guiar particulas ate o portal!
 */

import { onGameEnd } from '../shared/game-integration.js';
import { GameStats, GameStorage } from '../shared/game-core.js';
import { playSound, initAudio, shareOnWhatsApp, launchConfetti } from '../shared/game-design-utils.js?v=2';

const stats = new GameStats('gravity');
const storage = new GameStorage('gravity');

// ── Constants ──
const G_CONST = 800;           // gravitational constant
const PARTICLE_SPEED = 2.2;    // initial emission speed
const PARTICLE_RADIUS = 5;
const TRAIL_LENGTH = 22;
const WELL_RADIUS = 22;
const PORTAL_RADIUS = 35;
const SOURCE_RADIUS = 18;
const EMIT_INTERVAL = 100;     // ms between particle emissions
const MAX_PARTICLES = 150;
const ABSORPTION_DIST = 32;
const WALL_BOUNCE = 0.6;
const LONG_PRESS_MS = 500;

// ── Colors ──
const COL = {
  bg: 0x050515,
  particle: 0x4488ff,
  particleGlow: 0x6699ff,
  attractor: 0x4488ff,
  attractorField: 0x2255aa,
  repulsor: 0xff4466,
  repulsorField: 0xaa2244,
  portal: 0xaa44ff,
  portalGlow: 0x8822cc,
  source: 0x44ff88,
  sourceGlow: 0x22aa55,
  wall: 0x334466,
  wallBorder: 0x556688,
  star: 0xffdd44,
  starEmpty: 0x333355,
  hud: 0xccddff,
  hudDim: 0x667799,
  wellDot: 0x4488ff,
  wellDotEmpty: 0x222244,
  blackhole: 0xff2200,
};

// ── Level Data ──
// Each level: { source:{x,y,angle}, target:{x,y}, walls:[], maxWells, threshold, repulsorsAllowed, blackholes:[], movingWalls:[], multiTargets:[], rotatingBarriers:[] }
// Coordinates as fractions of canvas (0-1)
const LEVELS = [
  // Level 1: Simple left to right
  { source:{x:0.1,y:0.5,angle:0}, target:{x:0.9,y:0.5}, walls:[], maxWells:2, threshold:0.5, particleCount:30, repulsorsAllowed:false },
  // Level 2: Top to bottom with wall
  { source:{x:0.5,y:0.08,angle:Math.PI/2}, target:{x:0.5,y:0.92}, walls:[{x:0.2,y:0.5,w:0.6,h:0.03}], maxWells:2, threshold:0.5, particleCount:30, repulsorsAllowed:false },
  // Level 3: Left to right with maze
  { source:{x:0.08,y:0.5,angle:0}, target:{x:0.92,y:0.5}, walls:[{x:0.35,y:0.1,w:0.03,h:0.5},{x:0.65,y:0.4,w:0.03,h:0.5}], maxWells:3, threshold:0.5, particleCount:35, repulsorsAllowed:false },
  // Level 4: Introduce repulsors
  { source:{x:0.1,y:0.1,angle:Math.PI/4}, target:{x:0.9,y:0.9}, walls:[{x:0.3,y:0.3,w:0.4,h:0.03},{x:0.3,y:0.65,w:0.4,h:0.03}], maxWells:3, threshold:0.5, particleCount:35, repulsorsAllowed:true },
  // Level 5: Tunnel
  { source:{x:0.08,y:0.5,angle:0}, target:{x:0.92,y:0.5}, walls:[{x:0.0,y:0.35,w:0.7,h:0.03},{x:0.3,y:0.62,w:0.7,h:0.03}], maxWells:3, threshold:0.5, particleCount:40, repulsorsAllowed:true },
  // Level 6: Zigzag
  { source:{x:0.08,y:0.15,angle:0}, target:{x:0.92,y:0.85}, walls:[{x:0.25,y:0.0,w:0.03,h:0.55},{x:0.5,y:0.45,w:0.03,h:0.55},{x:0.75,y:0.0,w:0.03,h:0.55}], maxWells:4, threshold:0.45, particleCount:40, repulsorsAllowed:true },
  // Level 7: Multiple walls scattered
  { source:{x:0.5,y:0.08,angle:Math.PI/2}, target:{x:0.5,y:0.92}, walls:[{x:0.15,y:0.3,w:0.25,h:0.03},{x:0.6,y:0.3,w:0.25,h:0.03},{x:0.3,y:0.55,w:0.4,h:0.03},{x:0.1,y:0.75,w:0.3,h:0.03},{x:0.6,y:0.75,w:0.3,h:0.03}], maxWells:4, threshold:0.45, particleCount:40, repulsorsAllowed:true },
  // Level 8: Corner to corner
  { source:{x:0.08,y:0.92,angle:-Math.PI/4}, target:{x:0.92,y:0.08}, walls:[{x:0.2,y:0.2,w:0.3,h:0.03},{x:0.5,y:0.5,w:0.03,h:0.3},{x:0.5,y:0.5,w:0.3,h:0.03}], maxWells:3, threshold:0.45, particleCount:40, repulsorsAllowed:true },
  // Level 9: Box maze
  { source:{x:0.08,y:0.5,angle:0}, target:{x:0.92,y:0.5}, walls:[{x:0.3,y:0.25,w:0.03,h:0.5},{x:0.3,y:0.25,w:0.2,h:0.03},{x:0.3,y:0.72,w:0.2,h:0.03},{x:0.55,y:0.15,w:0.03,h:0.35},{x:0.55,y:0.55,w:0.03,h:0.35},{x:0.7,y:0.3,w:0.03,h:0.4}], maxWells:4, threshold:0.4, particleCount:45, repulsorsAllowed:true },
  // Level 10: Spiral hint
  { source:{x:0.5,y:0.08,angle:Math.PI/2}, target:{x:0.5,y:0.5}, walls:[{x:0.25,y:0.3,w:0.5,h:0.03},{x:0.25,y:0.3,w:0.03,h:0.25},{x:0.72,y:0.3,w:0.03,h:0.45},{x:0.25,y:0.72,w:0.5,h:0.03}], maxWells:4, threshold:0.4, particleCount:45, repulsorsAllowed:true },
  // Level 11: Narrow passage
  { source:{x:0.08,y:0.5,angle:0}, target:{x:0.92,y:0.5}, walls:[{x:0.45,y:0.0,w:0.03,h:0.4},{x:0.45,y:0.6,w:0.03,h:0.4},{x:0.55,y:0.0,w:0.03,h:0.4},{x:0.55,y:0.6,w:0.03,h:0.4}], maxWells:2, threshold:0.4, particleCount:45, repulsorsAllowed:true },
  // Level 12: U-turn
  { source:{x:0.15,y:0.15,angle:Math.PI/2}, target:{x:0.15,y:0.85}, walls:[{x:0.0,y:0.5,w:0.6,h:0.03}], maxWells:3, threshold:0.4, particleCount:45, repulsorsAllowed:true },
  // Level 13: Multiple barriers
  { source:{x:0.08,y:0.5,angle:0}, target:{x:0.92,y:0.5}, walls:[{x:0.2,y:0.15,w:0.03,h:0.3},{x:0.2,y:0.55,w:0.03,h:0.3},{x:0.4,y:0.25,w:0.03,h:0.5},{x:0.6,y:0.15,w:0.03,h:0.3},{x:0.6,y:0.55,w:0.03,h:0.3},{x:0.8,y:0.25,w:0.03,h:0.5}], maxWells:5, threshold:0.35, particleCount:50, repulsorsAllowed:true },
  // Level 14: Blackhole introduced
  { source:{x:0.08,y:0.5,angle:0}, target:{x:0.92,y:0.5}, walls:[{x:0.3,y:0.3,w:0.03,h:0.4}], maxWells:3, threshold:0.4, particleCount:50, repulsorsAllowed:true, blackholes:[{x:0.5,y:0.5}] },
  // Level 15: Two blackholes
  { source:{x:0.5,y:0.08,angle:Math.PI/2}, target:{x:0.5,y:0.92}, walls:[{x:0.2,y:0.4,w:0.25,h:0.03},{x:0.55,y:0.6,w:0.25,h:0.03}], maxWells:4, threshold:0.35, particleCount:50, repulsorsAllowed:true, blackholes:[{x:0.35,y:0.55},{x:0.65,y:0.45}] },
  // Level 16: Multi target
  { source:{x:0.5,y:0.08,angle:Math.PI/2}, target:{x:0.2,y:0.9}, walls:[{x:0.35,y:0.5,w:0.3,h:0.03}], maxWells:4, threshold:0.35, particleCount:50, repulsorsAllowed:true, multiTargets:[{x:0.8,y:0.9}] },
  // Level 17: Complex maze + blackhole
  { source:{x:0.08,y:0.08,angle:Math.PI/4}, target:{x:0.92,y:0.92}, walls:[{x:0.25,y:0.0,w:0.03,h:0.5},{x:0.5,y:0.3,w:0.03,h:0.7},{x:0.75,y:0.0,w:0.03,h:0.5},{x:0.25,y:0.7,w:0.28,h:0.03}], maxWells:4, threshold:0.3, particleCount:50, repulsorsAllowed:true, blackholes:[{x:0.62,y:0.15}] },
  // Level 18: Tight corridors + multi target
  { source:{x:0.08,y:0.5,angle:0}, target:{x:0.92,y:0.2}, walls:[{x:0.3,y:0.0,w:0.03,h:0.7},{x:0.5,y:0.3,w:0.03,h:0.7},{x:0.7,y:0.0,w:0.03,h:0.7}], maxWells:5, threshold:0.3, particleCount:55, repulsorsAllowed:true, multiTargets:[{x:0.92,y:0.8}] },
  // Level 19: Gauntlet
  { source:{x:0.08,y:0.5,angle:0}, target:{x:0.92,y:0.5}, walls:[{x:0.2,y:0.2,w:0.03,h:0.25},{x:0.2,y:0.55,w:0.03,h:0.25},{x:0.35,y:0.3,w:0.03,h:0.4},{x:0.5,y:0.15,w:0.03,h:0.3},{x:0.5,y:0.55,w:0.03,h:0.3},{x:0.65,y:0.3,w:0.03,h:0.4},{x:0.8,y:0.2,w:0.03,h:0.25},{x:0.8,y:0.55,w:0.03,h:0.25}], maxWells:5, threshold:0.25, particleCount:55, repulsorsAllowed:true, blackholes:[{x:0.42,y:0.5},{x:0.58,y:0.5}] },
  // Level 20: Ultimate
  { source:{x:0.08,y:0.5,angle:0}, target:{x:0.92,y:0.5}, walls:[{x:0.2,y:0.1,w:0.03,h:0.35},{x:0.2,y:0.55,w:0.03,h:0.35},{x:0.4,y:0.2,w:0.03,h:0.6},{x:0.6,y:0.1,w:0.03,h:0.35},{x:0.6,y:0.55,w:0.03,h:0.35},{x:0.8,y:0.2,w:0.03,h:0.6}], maxWells:5, threshold:0.25, particleCount:60, repulsorsAllowed:true, blackholes:[{x:0.3,y:0.5},{x:0.7,y:0.5}], multiTargets:[{x:0.92,y:0.2},{x:0.92,y:0.8}] },
];

// ── State ──
let app, W, H;
let currentLevel = 0;
let phase = 'menu'; // menu | placement | simulation | complete | sandbox
let wells = [];
let particles = [];
let totalEmitted = 0;
let totalCollected = 0;
let emitTimer = 0;
let levelStars = {}; // {levelIndex: stars}
let sandboxUnlocked = false;
let longPressTimer = null;
let longPressPos = null;
let draggingWell = null;
let dragOffset = { x: 0, y: 0 };
let levelObstacles = [];
let levelSource = null;
let levelTargets = [];
let levelBlackholes = [];
let starfield = [];
let breathPhase = 0;

// ── PixiJS layers ──
let bgLayer, wallLayer, fieldLayer, trailLayer, particleLayer, wellLayer, portalLayer, hudLayer, sourceLayer;

// ── DOM ──
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayIcon = document.getElementById('overlay-icon');
const overlayScore = document.getElementById('overlay-score');
const btnStart = document.getElementById('btn-start');
const btnShare = document.getElementById('btn-share');
const scoreDisplay = document.getElementById('score-display');
const bestDisplay = document.getElementById('best-display');
const gameControls = document.getElementById('game-controls');
const btnPlay = document.getElementById('btn-play');
const btnReset = document.getElementById('btn-reset');

// ── Init ──
async function init() {
  initAudio();
  loadProgress();
  updateScoreDisplay();

  app = new PIXI.Application({
    resizeTo: document.getElementById('pixi-container'),
    backgroundColor: COL.bg,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  document.getElementById('pixi-container').appendChild(app.view);

  W = app.screen.width;
  H = app.screen.height;

  // Create layers
  bgLayer = new PIXI.Container();
  wallLayer = new PIXI.Container();
  fieldLayer = new PIXI.Container();
  trailLayer = new PIXI.Container();
  particleLayer = new PIXI.Container();
  wellLayer = new PIXI.Container();
  portalLayer = new PIXI.Container();
  sourceLayer = new PIXI.Container();
  hudLayer = new PIXI.Container();
  hudLayer.eventMode = 'static';

  app.stage.addChild(bgLayer, wallLayer, fieldLayer, trailLayer, particleLayer, wellLayer, portalLayer, sourceLayer, hudLayer);

  // PixiJS 7: enable event system on stage for HUD button clicks
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  createStarfield();
  setupInput();
  showMenu();

  app.ticker.add(gameLoop);

  window.addEventListener('resize', onResize);
}

function onResize() {
  W = app.screen.width;
  H = app.screen.height;
  createStarfield();
  if (phase === 'placement' || phase === 'simulation') {
    buildLevel(currentLevel);
  }
}

// ── Starfield ──
function createStarfield() {
  bgLayer.removeChildren();
  starfield = [];
  const count = Math.floor((W * H) / 3000);
  const gfx = new PIXI.Graphics();
  for (let i = 0; i < count; i++) {
    const s = { x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.5 + 0.3, brightness: Math.random() };
    starfield.push(s);
    const alpha = 0.2 + s.brightness * 0.6;
    gfx.beginFill(0xffffff, alpha);
    gfx.drawCircle(s.x, s.y, s.r);
    gfx.endFill();
  }
  bgLayer.addChild(gfx);
}

// ── Progress ──
function loadProgress() {
  try {
    const saved = localStorage.getItem('gravity_progress');
    if (saved) {
      const data = JSON.parse(saved);
      levelStars = data.levelStars || {};
      sandboxUnlocked = data.sandboxUnlocked || false;
    }
  } catch (e) { /* ignore */ }
}

function saveProgress() {
  try {
    localStorage.setItem('gravity_progress', JSON.stringify({ levelStars, sandboxUnlocked }));
  } catch (e) { /* ignore */ }
}

function getTotalStars() {
  return Object.values(levelStars).reduce((a, b) => a + b, 0);
}

function getBestStars() {
  try {
    return parseInt(localStorage.getItem('gravity_best') || '0', 10);
  } catch (e) { return 0; }
}

function saveBest(stars) {
  const prev = getBestStars();
  if (stars > prev) {
    localStorage.setItem('gravity_best', stars.toString());
  }
}

function updateScoreDisplay() {
  const total = getTotalStars();
  scoreDisplay.textContent = total;
  bestDisplay.textContent = Math.max(total, getBestStars());
}

// ── Menu ──
function showMenu() {
  phase = 'menu';
  overlay.classList.remove('hidden');
  overlayIcon.textContent = '🌀';
  overlayTitle.textContent = 'Gravity Pulse';
  overlayMsg.textContent = 'Clique no espaço para criar campos de gravidade.\nGuie as partículas verdes até o portal roxo!';
  overlayScore.textContent = '';
  btnStart.textContent = 'Jogar';
  btnShare.style.display = 'none';
  gameControls.style.display = 'none';
  clearGame();
}

function showLevelComplete(stars, pct) {
  phase = 'complete';
  overlay.classList.remove('hidden');
  gameControls.style.display = 'none';
  overlayIcon.textContent = stars >= 3 ? '⭐' : stars >= 2 ? '🌟' : '✨';
  overlayTitle.textContent = `Nível ${currentLevel + 1} Completo!`;
  const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
  overlayMsg.textContent = `${Math.round(pct * 100)}% coletadas`;
  overlayScore.textContent = starStr;

  if (currentLevel < LEVELS.length - 1) {
    btnStart.textContent = 'Próximo Nível';
  } else {
    btnStart.textContent = 'Modo Sandbox';
    overlayMsg.textContent = `Parabéns! Todos os níveis completos!\n${Math.round(pct * 100)}% coletadas`;
  }
  btnShare.style.display = 'inline-block';

  try { playSound('win'); } catch(e) {}
  try { if (stars >= 3) launchConfetti(); } catch(e) {}
}

function showLevelFail() {
  phase = 'complete';
  overlay.classList.remove('hidden');
  gameControls.style.display = 'none';
  overlayIcon.textContent = '💫';
  overlayTitle.textContent = `Nível ${currentLevel + 1}`;
  const pct = totalEmitted > 0 ? totalCollected / totalEmitted : 0;
  overlayMsg.textContent = `${Math.round(pct * 100)}% coletadas — precisa de ${Math.round(LEVELS[currentLevel].threshold * 100)}%`;
  overlayScore.textContent = 'Tente novamente!';
  btnStart.textContent = 'Tentar de Novo';
  btnShare.style.display = 'none';
  try { playSound('gameover'); } catch(e) {}
}

// ── Button handlers ──
btnStart.addEventListener('click', () => {
  initAudio();
  overlay.classList.add('hidden');

  if (phase === 'menu' || phase === 'complete') {
    if (btnStart.textContent === 'Modo Sandbox') {
      startSandbox();
    } else if (btnStart.textContent === 'Tentar de Novo') {
      startLevel(currentLevel);
    } else if (btnStart.textContent === 'Próximo Nível') {
      startLevel(currentLevel + 1);
    } else {
      startLevel(0);
    }
  }
});

// DOM play/reset buttons (reliable, no PixiJS event issues)
btnPlay.addEventListener('click', () => {
  if (phase === 'placement') {
    startSimulation();
    btnPlay.style.display = 'none';
    btnReset.style.display = 'inline-block';
  }
});

btnReset.addEventListener('click', () => {
  if (phase === 'simulation' || phase === 'placement') {
    resetLevel();
    btnPlay.style.display = 'inline-block';
    btnReset.style.display = 'none';
  }
});

btnShare.addEventListener('click', () => {
  const total = getTotalStars();
  const text = `🌀 Gravity Pulse: ${total}/60 estrelas! Level ${currentLevel + 1} alcançado!\nJogue: https://gameshub.com.br/games/gravity/`;
  try { shareOnWhatsApp(text); } catch(e) {
    if (navigator.share) navigator.share({ text });
  }
});

// ── Level setup ──
function clearGame() {
  wells = [];
  particles = [];
  totalEmitted = 0;
  totalCollected = 0;
  emitTimer = 0;
  levelObstacles = [];
  levelTargets = [];
  levelBlackholes = [];
  levelSource = null;
  draggingWell = null;

  wallLayer.removeChildren();
  fieldLayer.removeChildren();
  trailLayer.removeChildren();
  particleLayer.removeChildren();
  wellLayer.removeChildren();
  portalLayer.removeChildren();
  sourceLayer.removeChildren();
  hudLayer.removeChildren();
}

function startLevel(idx) {
  currentLevel = Math.min(idx, LEVELS.length - 1);
  clearGame();
  buildLevel(currentLevel);
  phase = 'placement';
  // Show DOM controls
  gameControls.style.display = 'flex';
  btnPlay.style.display = 'inline-block';
  btnReset.style.display = 'none';
  buildHUD();
}

function startSandbox() {
  sandboxUnlocked = true;
  saveProgress();
  clearGame();
  phase = 'sandbox';

  // Sandbox: free play with source in center
  levelSource = { x: W / 2, y: H * 0.2, angle: Math.PI / 2 };
  levelTargets = [];
  levelObstacles = [];
  levelBlackholes = [];

  drawSource();
  buildHUD();
}

function buildLevel(idx) {
  clearGame();
  const lvl = LEVELS[idx];

  // Convert fractional coords to pixel
  levelSource = {
    x: lvl.source.x * W,
    y: lvl.source.y * H,
    angle: lvl.source.angle
  };

  levelTargets = [{ x: lvl.target.x * W, y: lvl.target.y * H }];
  if (lvl.multiTargets) {
    for (const t of lvl.multiTargets) {
      levelTargets.push({ x: t.x * W, y: t.y * H });
    }
  }

  levelObstacles = (lvl.walls || []).map(w => ({
    x: w.x * W, y: w.y * H, w: w.w * W, h: w.h * H
  }));

  levelBlackholes = (lvl.blackholes || []).map(b => ({
    x: b.x * W, y: b.y * H
  }));

  drawWalls();
  drawPortals();
  drawBlackholes();
  drawSource();
}

// ── Drawing ──
function drawWalls() {
  const gfx = new PIXI.Graphics();
  for (const w of levelObstacles) {
    gfx.beginFill(COL.wall, 0.8);
    gfx.lineStyle(1, COL.wallBorder, 0.6);
    gfx.drawRoundedRect(w.x, w.y, w.w, w.h, 3);
    gfx.endFill();
  }
  wallLayer.addChild(gfx);
}

function drawPortals() {
  for (const t of levelTargets) {
    const container = new PIXI.Container();
    container.x = t.x;
    container.y = t.y;

    // Large outer glow
    const glow = new PIXI.Graphics();
    glow.beginFill(COL.portalGlow, 0.12);
    glow.drawCircle(0, 0, PORTAL_RADIUS * 3);
    glow.endFill();
    glow.beginFill(COL.portal, 0.08);
    glow.drawCircle(0, 0, PORTAL_RADIUS * 2.2);
    glow.endFill();
    container.addChild(glow);

    // Bright rings
    for (let i = 4; i >= 0; i--) {
      const ring = new PIXI.Graphics();
      ring.lineStyle(2.5, COL.portal, 0.35 + i * 0.12);
      ring.drawCircle(0, 0, PORTAL_RADIUS - i * 5);
      container.addChild(ring);
    }

    // Bright core
    const core = new PIXI.Graphics();
    core.beginFill(COL.portal, 0.7);
    core.drawCircle(0, 0, 12);
    core.endFill();
    core.beginFill(0xddaaff, 0.5);
    core.drawCircle(0, 0, 6);
    core.endFill();
    container.addChild(core);

    // "PORTAL" label
    const label = new PIXI.Text('PORTAL', {
      fontFamily: 'VT323',
      fontSize: 14,
      fill: COL.portal,
    });
    label.anchor.set(0.5);
    label.y = -PORTAL_RADIUS - 14;
    container.addChild(label);

    t._container = container;
    portalLayer.addChild(container);
  }
}

function drawBlackholes() {
  for (const b of levelBlackholes) {
    const container = new PIXI.Container();
    container.x = b.x;
    container.y = b.y;

    const glow = new PIXI.Graphics();
    glow.beginFill(COL.blackhole, 0.1);
    glow.drawCircle(0, 0, 30);
    glow.endFill();
    container.addChild(glow);

    const core = new PIXI.Graphics();
    core.beginFill(0x000000, 1);
    core.lineStyle(2, COL.blackhole, 0.7);
    core.drawCircle(0, 0, 12);
    core.endFill();
    container.addChild(core);

    b._container = container;
    portalLayer.addChild(container);
  }
}

function drawSource() {
  const gfx = new PIXI.Graphics();

  // Outer glow
  gfx.beginFill(COL.sourceGlow, 0.1);
  gfx.drawCircle(levelSource.x, levelSource.y, SOURCE_RADIUS * 2.5);
  gfx.endFill();

  // Body
  gfx.beginFill(COL.source, 0.7);
  gfx.drawCircle(levelSource.x, levelSource.y, SOURCE_RADIUS);
  gfx.endFill();
  gfx.lineStyle(2, COL.sourceGlow, 0.9);
  gfx.drawCircle(levelSource.x, levelSource.y, SOURCE_RADIUS);

  // Arrow showing direction (bigger, more visible)
  const arrowLen = SOURCE_RADIUS + 18;
  const ax = levelSource.x + Math.cos(levelSource.angle) * arrowLen;
  const ay = levelSource.y + Math.sin(levelSource.angle) * arrowLen;
  gfx.lineStyle(3, COL.sourceGlow, 0.9);
  gfx.moveTo(levelSource.x + Math.cos(levelSource.angle) * SOURCE_RADIUS, levelSource.y + Math.sin(levelSource.angle) * SOURCE_RADIUS);
  gfx.lineTo(ax, ay);

  // Arrowhead
  const headLen = 8;
  const headAngle = 0.5;
  gfx.moveTo(ax, ay);
  gfx.lineTo(ax - Math.cos(levelSource.angle - headAngle) * headLen, ay - Math.sin(levelSource.angle - headAngle) * headLen);
  gfx.moveTo(ax, ay);
  gfx.lineTo(ax - Math.cos(levelSource.angle + headAngle) * headLen, ay - Math.sin(levelSource.angle + headAngle) * headLen);

  sourceLayer.addChild(gfx);

  // "FONTE" label
  const label = new PIXI.Text('FONTE', {
    fontFamily: 'VT323',
    fontSize: 14,
    fill: COL.source,
  });
  label.anchor.set(0.5);
  label.x = levelSource.x;
  label.y = levelSource.y - SOURCE_RADIUS - 14;
  sourceLayer.addChild(label);
}

// ── Input ──
function setupInput() {
  const view = app.view;

  // Prevent context menu
  view.addEventListener('contextmenu', e => e.preventDefault());

  // Desktop mouse
  view.addEventListener('mousedown', e => {
    const pos = getCanvasPos(e);
    if (e.button === 2) {
      // Right click: repulsor
      handlePlaceWell(pos, true);
    } else if (e.button === 0) {
      // Left click: check if dragging existing well
      const well = findWellAt(pos);
      if (well) {
        draggingWell = well;
        dragOffset.x = well.x - pos.x;
        dragOffset.y = well.y - pos.y;
      } else {
        handlePlaceWell(pos, false);
      }
    }
  });

  view.addEventListener('mousemove', e => {
    if (draggingWell && phase === 'placement') {
      const pos = getCanvasPos(e);
      draggingWell.x = pos.x + dragOffset.x;
      draggingWell.y = pos.y + dragOffset.y;
    }
  });

  view.addEventListener('mouseup', () => {
    draggingWell = null;
  });

  // Touch
  view.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getCanvasPos(touch);

    const well = findWellAt(pos);
    if (well) {
      draggingWell = well;
      dragOffset.x = well.x - pos.x;
      dragOffset.y = well.y - pos.y;
      return;
    }

    longPressPos = pos;
    longPressTimer = setTimeout(() => {
      // Long press: repulsor
      handlePlaceWell(pos, true);
      longPressTimer = null;
      longPressPos = null;
    }, LONG_PRESS_MS);
  }, { passive: false });

  view.addEventListener('touchmove', e => {
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getCanvasPos(touch);

    if (longPressTimer && longPressPos) {
      const dx = pos.x - longPressPos.x;
      const dy = pos.y - longPressPos.y;
      if (dx * dx + dy * dy > 100) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    if (draggingWell && (phase === 'placement' || phase === 'sandbox')) {
      draggingWell.x = pos.x + dragOffset.x;
      draggingWell.y = pos.y + dragOffset.y;
    }
  }, { passive: false });

  view.addEventListener('touchend', e => {
    e.preventDefault();
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      const pos = longPressPos;
      longPressTimer = null;
      longPressPos = null;
      if (pos) handlePlaceWell(pos, false);
    }
    draggingWell = null;
  }, { passive: false });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (phase === 'placement') startSimulation();
      else if (phase === 'simulation') resetLevel();
    }
    if (e.code === 'KeyR') {
      if (phase === 'placement' || phase === 'simulation') resetLevel();
    }
    if (e.code === 'KeyZ' && phase === 'placement') {
      // Undo last well
      if (wells.length > 0) wells.pop();
    }
  });

  // Scroll for sandbox mass adjust
  view.addEventListener('wheel', e => {
    if (phase !== 'sandbox') return;
    const pos = getCanvasPos(e);
    const well = findWellAt(pos);
    if (well) {
      e.preventDefault();
      well.mass = Math.max(0.3, Math.min(5, well.mass + (e.deltaY > 0 ? -0.2 : 0.2)));
    }
  }, { passive: false });
}

function getCanvasPos(e) {
  const rect = app.view.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function findWellAt(pos) {
  for (const w of wells) {
    const dx = w.x - pos.x;
    const dy = w.y - pos.y;
    if (dx * dx + dy * dy < (WELL_RADIUS + 10) * (WELL_RADIUS + 10)) return w;
  }
  return null;
}

function handlePlaceWell(pos, isRepulsor) {
  if (phase === 'placement') {
    const lvl = LEVELS[currentLevel];
    if (!isRepulsor || lvl.repulsorsAllowed) {
      if (wells.length < lvl.maxWells) {
        // Check not on source/target/wall
        if (!isOnObstacle(pos) && !isOnSource(pos) && !isOnTarget(pos)) {
          wells.push({ x: pos.x, y: pos.y, mass: 1, repulsor: isRepulsor });
        }
      }
    }
  } else if (phase === 'sandbox') {
    if (!isOnSource(pos)) {
      wells.push({ x: pos.x, y: pos.y, mass: 1, repulsor: isRepulsor });
    }
  }
}

function isOnObstacle(pos) {
  for (const w of levelObstacles) {
    if (pos.x >= w.x - 5 && pos.x <= w.x + w.w + 5 && pos.y >= w.y - 5 && pos.y <= w.y + w.h + 5) return true;
  }
  return false;
}

function isOnSource(pos) {
  if (!levelSource) return false;
  const dx = pos.x - levelSource.x;
  const dy = pos.y - levelSource.y;
  return dx * dx + dy * dy < (SOURCE_RADIUS + 10) * (SOURCE_RADIUS + 10);
}

function isOnTarget(pos) {
  for (const t of levelTargets) {
    const dx = pos.x - t.x;
    const dy = pos.y - t.y;
    if (dx * dx + dy * dy < (PORTAL_RADIUS + 5) * (PORTAL_RADIUS + 5)) return true;
  }
  return false;
}

// ── Simulation ──
function startSimulation() {
  phase = 'simulation';
  totalEmitted = 0;
  totalCollected = 0;
  particles = [];
  emitTimer = 0;
  // Sync DOM buttons
  btnPlay.style.display = 'none';
  btnReset.style.display = 'inline-block';
}

function resetLevel() {
  particles = [];
  totalEmitted = 0;
  totalCollected = 0;
  emitTimer = 0;
  wells = [];
  phase = 'placement';
  trailLayer.removeChildren();
  particleLayer.removeChildren();
  // Sync DOM buttons
  btnPlay.style.display = 'inline-block';
  btnReset.style.display = 'none';
}

function emitParticle() {
  if (!levelSource) return;
  const spread = 0.3;
  const angle = levelSource.angle + (Math.random() - 0.5) * spread;
  const p = {
    x: levelSource.x + Math.cos(levelSource.angle) * SOURCE_RADIUS,
    y: levelSource.y + Math.sin(levelSource.angle) * SOURCE_RADIUS,
    vx: Math.cos(angle) * PARTICLE_SPEED,
    vy: Math.sin(angle) * PARTICLE_SPEED,
    trail: [],
    alive: true,
    age: 0
  };
  particles.push(p);
  totalEmitted++;
}

function updatePhysics(dt) {
  for (const p of particles) {
    if (!p.alive) continue;
    p.age++;

    // Gravity from wells
    let ax = 0, ay = 0;
    for (const w of wells) {
      const dx = w.x - p.x;
      const dy = w.y - p.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      if (dist < 5) continue;
      const force = G_CONST * w.mass / Math.max(distSq, 400);
      const dir = w.repulsor ? -1 : 1;
      ax += (dx / dist) * force * dir;
      ay += (dy / dist) * force * dir;
    }

    // Blackholes: strong attraction + destruction
    for (const b of levelBlackholes) {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);
      if (dist < 15) {
        p.alive = false;
        break;
      }
      const force = G_CONST * 3 / Math.max(distSq, 200);
      ax += (dx / dist) * force;
      ay += (dy / dist) * force;
    }
    if (!p.alive) continue;

    p.vx += ax * dt;
    p.vy += ay * dt;

    // Clamp max speed
    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (spd > 12) {
      p.vx = (p.vx / spd) * 12;
      p.vy = (p.vy / spd) * 12;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Trail
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > TRAIL_LENGTH) p.trail.shift();

    // Wall collision
    for (const wall of levelObstacles) {
      if (p.x >= wall.x && p.x <= wall.x + wall.w && p.y >= wall.y && p.y <= wall.y + wall.h) {
        // Find closest edge
        const dLeft = p.x - wall.x;
        const dRight = wall.x + wall.w - p.x;
        const dTop = p.y - wall.y;
        const dBottom = wall.y + wall.h - p.y;
        const minD = Math.min(dLeft, dRight, dTop, dBottom);

        if (minD === dLeft) { p.x = wall.x - 1; p.vx = -Math.abs(p.vx) * WALL_BOUNCE; }
        else if (minD === dRight) { p.x = wall.x + wall.w + 1; p.vx = Math.abs(p.vx) * WALL_BOUNCE; }
        else if (minD === dTop) { p.y = wall.y - 1; p.vy = -Math.abs(p.vy) * WALL_BOUNCE; }
        else { p.y = wall.y + wall.h + 1; p.vy = Math.abs(p.vy) * WALL_BOUNCE; }
      }
    }

    // Screen bounds: bounce off edges
    const margin = PARTICLE_RADIUS;
    if (p.x < margin) { p.x = margin; p.vx = Math.abs(p.vx) * WALL_BOUNCE; }
    if (p.x > W - margin) { p.x = W - margin; p.vx = -Math.abs(p.vx) * WALL_BOUNCE; }
    if (p.y < margin) { p.y = margin; p.vy = Math.abs(p.vy) * WALL_BOUNCE; }
    if (p.y > H - margin) { p.y = H - margin; p.vy = -Math.abs(p.vy) * WALL_BOUNCE; }

    // Portal check
    for (const t of levelTargets) {
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      if (dx * dx + dy * dy < ABSORPTION_DIST * ABSORPTION_DIST) {
        p.alive = false;
        totalCollected++;
        try { playSound('eat'); } catch(e) {}
        break;
      }
    }
  }

  // Remove dead particles (keep for rendering this frame)
  particles = particles.filter(p => p.alive);
}

// ── Game Loop ──
function gameLoop(ticker) {
  const dt = Math.min(ticker.deltaTime, 3);
  breathPhase += 0.02;

  if (phase === 'simulation') {
    const lvl = LEVELS[currentLevel];
    const maxParticles = lvl ? lvl.particleCount : 50;

    // Emit particles
    emitTimer += ticker.deltaMS;
    while (emitTimer >= EMIT_INTERVAL && totalEmitted < maxParticles && particles.length < MAX_PARTICLES) {
      emitParticle();
      emitTimer -= EMIT_INTERVAL;
    }

    updatePhysics(dt);

    // Check level end
    if (totalEmitted >= maxParticles && particles.length === 0) {
      finishLevel();
    }
  } else if (phase === 'sandbox') {
    // Continuous emission
    emitTimer += ticker.deltaMS;
    while (emitTimer >= EMIT_INTERVAL && particles.length < MAX_PARTICLES) {
      emitParticle();
      emitTimer -= EMIT_INTERVAL;
    }
    updatePhysics(dt);
    // Score: particles on screen for 10s
    totalCollected = particles.filter(p => p.age > 600).length;
  }

  render(dt);
}

function finishLevel() {
  const lvl = LEVELS[currentLevel];
  const pct = totalEmitted > 0 ? totalCollected / totalEmitted : 0;

  if (pct >= lvl.threshold) {
    let stars = 1;
    if (pct >= 0.7) stars = 2;
    if (pct >= 0.9) stars = 3;

    const prev = levelStars[currentLevel] || 0;
    if (stars > prev) levelStars[currentLevel] = stars;
    saveProgress();

    const total = getTotalStars();
    saveBest(total);
    updateScoreDisplay();

    if (currentLevel >= 4) sandboxUnlocked = true;

    showLevelComplete(stars, pct);
    try { onGameEnd('gravity', { won: true, score: total }); } catch(e) {}
  } else {
    showLevelFail();
    try { onGameEnd('gravity', { won: false, score: getTotalStars() }); } catch(e) {}
  }
}

// ── Render ──
function render(dt) {
  // Clear dynamic layers
  fieldLayer.removeChildren();
  trailLayer.removeChildren();
  particleLayer.removeChildren();
  wellLayer.removeChildren();
  hudLayer.removeChildren();
  portalLayer.removeChildren();
  sourceLayer.removeChildren();

  // Redraw static elements
  if (levelSource) drawSource();
  drawPortals();
  drawBlackholes();

  // Animate portals
  for (const t of levelTargets) {
    if (t._container) {
      t._container.rotation += 0.015 * dt;
      const scale = 1 + Math.sin(breathPhase * 2) * 0.05;
      t._container.scale.set(scale);
    }
  }

  // Animate blackholes
  for (const b of levelBlackholes) {
    if (b._container) {
      b._container.rotation -= 0.03 * dt;
    }
  }

  // Draw gravity fields
  const fieldGfx = new PIXI.Graphics();
  for (const w of wells) {
    const col = w.repulsor ? COL.repulsorField : COL.attractorField;
    const pulse = 1 + Math.sin(breathPhase * 3) * 0.15;

    for (let i = 4; i >= 0; i--) {
      const r = (WELL_RADIUS + i * 15) * pulse;
      const alpha = 0.08 - i * 0.015;
      fieldGfx.lineStyle(1.5, col, Math.max(0.01, alpha));
      fieldGfx.drawCircle(w.x, w.y, r);
    }
  }
  fieldLayer.addChild(fieldGfx);

  // Draw wells
  const wellGfx = new PIXI.Graphics();
  for (const w of wells) {
    const col = w.repulsor ? COL.repulsor : COL.attractor;
    const glowCol = w.repulsor ? COL.repulsorField : COL.attractorField;

    // Glow
    wellGfx.beginFill(glowCol, 0.15);
    wellGfx.drawCircle(w.x, w.y, WELL_RADIUS * 1.5);
    wellGfx.endFill();

    // Body
    const bodyPulse = 1 + Math.sin(breathPhase * 4) * 0.1;
    wellGfx.beginFill(col, 0.7);
    wellGfx.lineStyle(2, col, 0.9);
    wellGfx.drawCircle(w.x, w.y, WELL_RADIUS * 0.6 * bodyPulse);
    wellGfx.endFill();

    // Mass indicator (sandbox)
    if (phase === 'sandbox' && w.mass !== 1) {
      wellGfx.lineStyle(1, col, 0.5);
      wellGfx.drawCircle(w.x, w.y, WELL_RADIUS * 0.6 * w.mass);
    }

    // + or - sign
    wellGfx.lineStyle(2, 0xffffff, 0.8);
    wellGfx.moveTo(w.x - 5, w.y);
    wellGfx.lineTo(w.x + 5, w.y);
    if (!w.repulsor) {
      wellGfx.moveTo(w.x, w.y - 5);
      wellGfx.lineTo(w.x, w.y + 5);
    }
  }
  wellLayer.addChild(wellGfx);

  // Draw field lines between wells
  if (wells.length > 1) {
    const lineGfx = new PIXI.Graphics();
    for (let i = 0; i < wells.length; i++) {
      for (let j = i + 1; j < wells.length; j++) {
        const a = wells[i], b = wells[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 300) {
          const alpha = Math.max(0.02, 0.12 * (1 - dist / 300));
          lineGfx.lineStyle(1, 0x4466aa, alpha);
          // Curved line
          const mx = (a.x + b.x) / 2 + (dy * 0.15 * Math.sin(breathPhase));
          const my = (a.y + b.y) / 2 - (dx * 0.15 * Math.sin(breathPhase));
          lineGfx.moveTo(a.x, a.y);
          lineGfx.quadraticCurveTo(mx, my, b.x, b.y);
        }
      }
    }
    fieldLayer.addChild(lineGfx);
  }

  // Draw trails
  const trailGfx = new PIXI.Graphics();
  for (const p of particles) {
    if (p.trail.length < 2) continue;
    for (let i = 1; i < p.trail.length; i++) {
      const alpha = (i / p.trail.length) * 0.5;
      const width = (i / p.trail.length) * 2.5;
      trailGfx.lineStyle(width, COL.particle, alpha);
      trailGfx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
      trailGfx.lineTo(p.trail[i].x, p.trail[i].y);
    }
  }
  trailLayer.addChild(trailGfx);

  // Draw particles
  const partGfx = new PIXI.Graphics();
  for (const p of particles) {
    // Glow
    partGfx.beginFill(COL.particleGlow, 0.2);
    partGfx.drawCircle(p.x, p.y, PARTICLE_RADIUS * 3);
    partGfx.endFill();

    // Core
    partGfx.beginFill(COL.particle, 0.9);
    partGfx.drawCircle(p.x, p.y, PARTICLE_RADIUS);
    partGfx.endFill();

    // Bright center
    partGfx.beginFill(0xffffff, 0.6);
    partGfx.drawCircle(p.x, p.y, PARTICLE_RADIUS * 0.4);
    partGfx.endFill();
  }
  particleLayer.addChild(partGfx);

  // HUD
  buildHUD();
}

function buildHUD() {
  hudLayer.removeChildren();

  const margin = 10;
  const isMobile = W < 600;

  if (phase === 'placement' || phase === 'simulation') {
    const lvl = LEVELS[currentLevel];

    // Level text
    const levelText = new PIXI.Text(`NÍVEL ${currentLevel + 1}`, {
      fontFamily: 'VT323',
      fontSize: isMobile ? 18 : 24,
      fill: COL.hud,
      align: 'center'
    });
    levelText.anchor.set(0.5, 0);
    levelText.x = W / 2;
    levelText.y = margin;
    hudLayer.addChild(levelText);

    // Well dots
    const dotStartX = W / 2 - (lvl.maxWells * 14) / 2;
    for (let i = 0; i < lvl.maxWells; i++) {
      const dot = new PIXI.Graphics();
      const filled = i < wells.length;
      const col = filled ? (wells[i].repulsor ? COL.repulsor : COL.wellDot) : COL.wellDotEmpty;
      dot.beginFill(col, filled ? 0.9 : 0.3);
      dot.drawCircle(dotStartX + i * 14 + 7, margin + (isMobile ? 22 : 30), 4);
      dot.endFill();
      hudLayer.addChild(dot);
    }

    // Particle counter (during simulation)
    if (phase === 'simulation') {
      const countText = new PIXI.Text(`${totalCollected}/${totalEmitted}`, {
        fontFamily: 'VT323',
        fontSize: isMobile ? 16 : 20,
        fill: COL.hud
      });
      countText.anchor.set(0.5, 0);
      countText.x = W / 2;
      countText.y = margin + (isMobile ? 36 : 48);
      hudLayer.addChild(countText);
    }

    // Instruction text (buttons are now DOM elements)
    if (phase === 'placement') {
      const instrText = new PIXI.Text(
        isMobile ? 'Toque para criar gravidade → depois LANÇAR' : 'Clique = criar gravidade | Direito = repulsor | Espaço = lançar',
        { fontFamily: 'Space Grotesk', fontSize: isMobile ? 11 : 13, fill: COL.hudDim }
      );
      instrText.anchor.set(0.5, 1);
      instrText.x = W / 2;
      instrText.y = H - (isMobile ? 55 : 65);
      hudLayer.addChild(instrText);

      // Arrow from source to target showing particle path
      if (levelSource && levelTargets.length > 0) {
        const arrowGfx = new PIXI.Graphics();
        const t = levelTargets[0];
        arrowGfx.lineStyle(2, COL.portal, 0.2 + Math.sin(breathPhase) * 0.1);
        // Dashed line from source to target
        const dx = t.x - levelSource.x;
        const dy = t.y - levelSource.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.floor(dist / 20);
        for (let i = 0; i < steps; i += 2) {
          const frac1 = i / steps;
          const frac2 = Math.min((i + 1) / steps, 1);
          arrowGfx.moveTo(levelSource.x + dx * frac1, levelSource.y + dy * frac1);
          arrowGfx.lineTo(levelSource.x + dx * frac2, levelSource.y + dy * frac2);
        }
        hudLayer.addChild(arrowGfx);
      }
    }

  } else if (phase === 'sandbox') {
    const titleText = new PIXI.Text('SANDBOX', {
      fontFamily: 'VT323',
      fontSize: isMobile ? 20 : 28,
      fill: COL.hud
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = W / 2;
    titleText.y = margin;
    hudLayer.addChild(titleText);

    const orbitText = new PIXI.Text(`Orbitando: ${totalCollected}`, {
      fontFamily: 'VT323',
      fontSize: isMobile ? 16 : 20,
      fill: COL.hud
    });
    orbitText.anchor.set(0.5, 0);
    orbitText.x = W / 2;
    orbitText.y = margin + (isMobile ? 22 : 32);
    hudLayer.addChild(orbitText);

    // Clear button
    const btnY = H - (isMobile ? 45 : 55);
    drawHUDButton(W / 2 - 50, btnY, 100, isMobile ? 32 : 38, 'LIMPAR', COL.repulsor, () => {
      wells = [];
      particles = [];
      totalEmitted = 0;
      totalCollected = 0;
    });

    // Back button
    drawHUDButton(margin, btnY, 80, isMobile ? 32 : 38, '← VOLTAR', COL.hudDim, () => showMenu());

    const instrText = new PIXI.Text(
      isMobile ? 'Toque = atrator | Segure = repulsor' : 'Clique = atrator | Direito = repulsor | Scroll = massa',
      { fontFamily: 'Space Grotesk', fontSize: isMobile ? 10 : 12, fill: COL.hudDim }
    );
    instrText.anchor.set(0.5, 1);
    instrText.x = W / 2;
    instrText.y = btnY - 6;
    hudLayer.addChild(instrText);
  }
}

function drawHUDButton(x, y, w, h, label, color, onClick) {
  const btn = new PIXI.Container();
  btn.x = x;
  btn.y = y;
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.hitArea = new PIXI.Rectangle(0, 0, w, h);

  const bg = new PIXI.Graphics();
  bg.beginFill(color, 0.2);
  bg.lineStyle(1.5, color, 0.7);
  bg.drawRoundedRect(0, 0, w, h, 6);
  bg.endFill();
  btn.addChild(bg);

  const text = new PIXI.Text(label, {
    fontFamily: 'VT323',
    fontSize: 16,
    fill: 0xffffff
  });
  text.anchor.set(0.5);
  text.x = w / 2;
  text.y = h / 2;
  btn.addChild(text);

  btn.on('pointerdown', onClick);
  hudLayer.addChild(btn);
}

// ── Start ──
init();
