/**
 * NEON BLASTER — Twin-Stick Shooter (Geometry Wars style)
 * PixiJS 7 WebGL GPU-accelerated
 */

import { playSound, initAudio } from '../shared/game-design-utils.js?v=2';

// ── Constants ──
const PLAYER_SPEED = 4.5;
const BULLET_SPEED = 10;
const FIRE_RATE = 100; // ms between shots
const INVINCIBLE_TIME = 2000;
const COMBO_TIMEOUT = 2000;
const MAX_COMBO = 10;
const PARTICLE_LIMIT = 600;
const ENEMY_LIMIT = 80;

// Enemy types
const ET = {
  DRIFTER:  { name: 'drifter',  color: 0x00ff66, points: 10, hp: 1, speed: 1.2, shape: 'diamond' },
  CHASER:   { name: 'chaser',   color: 0xff3355, points: 20, hp: 1, speed: 2.0, shape: 'triangle' },
  SPINNER:  { name: 'spinner',  color: 0xaa44ff, points: 30, hp: 2, speed: 1.8, shape: 'square' },
  SPLITTER: { name: 'splitter', color: 0xff8800, points: 40, hp: 2, speed: 1.5, shape: 'hexagon' },
  SNIPER:   { name: 'sniper',   color: 0xffffff, points: 50, hp: 1, speed: 0.5, shape: 'circle' },
};

// ── State ──
let app, gameW, gameH;
let worldContainer, gridGfx, hudContainer;
let playerGfx, playerX, playerY, playerAngle = 0;
let lives = 3, score = 0, wave = 0, kills = 0, totalKills = 0;
let combo = 0, maxCombo = 0, comboTimer = 0;
let bombs = 1;
let bestScore = parseInt(localStorage.getItem('neonblaster_best') || '0', 10);
let gameRunning = false, gamePaused = false;
let invincible = false, invincibleTimer = 0;
let lastFireTime = 0;
let waveDelay = 0, waveAnnounce = '';
let shakeX = 0, shakeY = 0, shakeMag = 0;

// Collections
let bullets = [];
let enemies = [];
let particles = [];
let enemyBullets = [];
let scorePopups = [];
let hudTexts = {};

// Input
const keys = {};
let mouseX = 0, mouseY = 0, mouseDown = false;
let isMobile = false;
let leftStick = { active: false, dx: 0, dy: 0 };
let rightStick = { active: false, dx: 0, dy: 0 };

// DOM refs
const scoreDisplay = document.getElementById('score-display');
const bestDisplay = document.getElementById('best-display');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayIcon = document.getElementById('overlay-icon');
const overlayScore = document.getElementById('overlay-score');
const btnStart = document.getElementById('btn-start');
const btnShare = document.getElementById('btn-share');

bestDisplay.textContent = bestScore;

// ── PixiJS Setup ──
function initPixi() {
  const container = document.getElementById('pixi-container');
  const rect = container.getBoundingClientRect();
  gameW = Math.floor(rect.width);
  gameH = Math.floor(rect.height);

  app = new PIXI.Application({
    width: gameW,
    height: gameH,
    backgroundColor: 0x050510,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  container.appendChild(app.view);

  worldContainer = new PIXI.Container();
  app.stage.addChild(worldContainer);

  gridGfx = new PIXI.Graphics();
  worldContainer.addChild(gridGfx);

  hudContainer = new PIXI.Container();
  app.stage.addChild(hudContainer);

  drawGrid();
  createHUD();
}

// ── Grid Background ──
function drawGrid() {
  gridGfx.clear();
  const spacing = 50;
  const alpha = 0.08;

  gridGfx.lineStyle(1, 0x00ffff, alpha);
  for (let x = 0; x <= gameW; x += spacing) {
    gridGfx.moveTo(x, 0);
    gridGfx.lineTo(x, gameH);
  }
  for (let y = 0; y <= gameH; y += spacing) {
    gridGfx.moveTo(0, y);
    gridGfx.lineTo(gameW, y);
  }
}

// ── HUD (PixiJS text) ──
function createHUD() {
  hudContainer.removeChildren();

  const styleScore = new PIXI.TextStyle({
    fontFamily: 'VT323', fontSize: 28, fill: '#00ffff',
    dropShadow: true, dropShadowColor: '#00ffff', dropShadowBlur: 8, dropShadowDistance: 0,
  });
  const styleLives = new PIXI.TextStyle({
    fontFamily: 'VT323', fontSize: 24, fill: '#ff3355',
  });
  const styleWave = new PIXI.TextStyle({
    fontFamily: 'VT323', fontSize: 22, fill: '#ffff00',
  });
  const styleCombo = new PIXI.TextStyle({
    fontFamily: 'VT323', fontSize: 36, fill: '#ff00ff',
    dropShadow: true, dropShadowColor: '#ff00ff', dropShadowBlur: 10, dropShadowDistance: 0,
  });
  const styleBomb = new PIXI.TextStyle({
    fontFamily: 'VT323', fontSize: 22, fill: '#ffff00',
  });
  const styleAnnounce = new PIXI.TextStyle({
    fontFamily: 'VT323', fontSize: 64, fill: '#00ffff',
    dropShadow: true, dropShadowColor: '#00ffff', dropShadowBlur: 20, dropShadowDistance: 0,
    stroke: '#003344', strokeThickness: 2,
  });

  hudTexts.score = new PIXI.Text('0', styleScore);
  hudTexts.score.anchor.set(0.5, 0);
  hudTexts.score.position.set(gameW / 2, 8);

  hudTexts.lives = new PIXI.Text('', styleLives);
  hudTexts.lives.position.set(10, 8);

  hudTexts.wave = new PIXI.Text('', styleWave);
  hudTexts.wave.anchor.set(1, 0);
  hudTexts.wave.position.set(gameW - 10, 8);

  hudTexts.combo = new PIXI.Text('', styleCombo);
  hudTexts.combo.anchor.set(0.5, 0.5);
  hudTexts.combo.position.set(gameW / 2, gameH / 2 - 60);
  hudTexts.combo.alpha = 0;

  hudTexts.bomb = new PIXI.Text('', styleBomb);
  hudTexts.bomb.anchor.set(0.5, 1);
  hudTexts.bomb.position.set(gameW / 2, gameH - 10);

  hudTexts.announce = new PIXI.Text('', styleAnnounce);
  hudTexts.announce.anchor.set(0.5, 0.5);
  hudTexts.announce.position.set(gameW / 2, gameH / 2);
  hudTexts.announce.alpha = 0;

  for (const t of Object.values(hudTexts)) hudContainer.addChild(t);
}

function updateHUD() {
  hudTexts.score.text = score.toLocaleString();
  hudTexts.lives.text = '\u2764'.repeat(Math.max(0, lives));
  hudTexts.wave.text = wave > 0 ? `WAVE ${wave}` : '';
  hudTexts.bomb.text = bombs > 0 ? `BOMB: ${bombs} [SPACE]` : '';
  scoreDisplay.textContent = score;
}

// ── Player ──
function createPlayer() {
  if (playerGfx) worldContainer.removeChild(playerGfx);
  playerGfx = new PIXI.Graphics();
  drawPlayerShape(playerGfx);
  playerGfx.blendMode = PIXI.BLEND_MODES.ADD;
  playerX = gameW / 2;
  playerY = gameH / 2;
  worldContainer.addChild(playerGfx);
}

function drawPlayerShape(g) {
  g.clear();
  g.lineStyle(2, 0x00ffff, 1);
  g.beginFill(0x00ffff, 0.15);
  // Arrow/triangle ship pointing right
  g.moveTo(18, 0);
  g.lineTo(-12, -12);
  g.lineTo(-6, 0);
  g.lineTo(-12, 12);
  g.closePath();
  g.endFill();
  // Engine glow
  g.lineStyle(0);
  g.beginFill(0x00ffff, 0.4);
  g.drawCircle(-6, 0, 3);
  g.endFill();
}

// ── Bullets ──
function spawnBullet(x, y, angle) {
  const g = new PIXI.Graphics();
  g.beginFill(0x00ffff, 0.9);
  g.drawCircle(0, 0, 3);
  g.endFill();
  g.blendMode = PIXI.BLEND_MODES.ADD;
  worldContainer.addChild(g);

  bullets.push({
    gfx: g, x, y,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: 120,
  });
}

// ── Enemy Bullets ──
function spawnEnemyBullet(x, y, angle) {
  const g = new PIXI.Graphics();
  g.beginFill(0xff3355, 0.8);
  g.drawCircle(0, 0, 3);
  g.endFill();
  g.blendMode = PIXI.BLEND_MODES.ADD;
  worldContainer.addChild(g);

  enemyBullets.push({
    gfx: g, x, y,
    vx: Math.cos(angle) * 4,
    vy: Math.sin(angle) * 4,
    life: 180,
  });
}

// ── Enemies ──
function drawEnemyShape(g, type) {
  g.clear();
  const c = type.color;
  g.lineStyle(2, c, 1);
  g.beginFill(c, 0.15);

  switch (type.shape) {
    case 'diamond':
      g.moveTo(0, -12); g.lineTo(10, 0); g.lineTo(0, 12); g.lineTo(-10, 0); g.closePath();
      break;
    case 'triangle':
      g.moveTo(12, 0); g.lineTo(-8, -10); g.lineTo(-8, 10); g.closePath();
      break;
    case 'square':
      g.drawRect(-10, -10, 20, 20);
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = Math.cos(a) * 12, py = Math.sin(a) * 12;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      break;
    case 'circle':
      g.drawCircle(0, 0, 10);
      break;
  }
  g.endFill();
}

function spawnEnemy(type, x, y, sizeScale) {
  if (enemies.length >= ENEMY_LIMIT) return;
  sizeScale = sizeScale || 1;

  const g = new PIXI.Graphics();
  drawEnemyShape(g, type);
  if (sizeScale !== 1) g.scale.set(sizeScale);
  g.blendMode = PIXI.BLEND_MODES.ADD;
  worldContainer.addChild(g);

  // Speed and HP scale with waves
  let spd = type.speed;
  let hp = type.hp;
  if (wave > 5) spd *= 1 + (wave - 5) * 0.05;
  if (wave > 10) hp += Math.floor((wave - 10) / 3);

  enemies.push({
    gfx: g, type, x, y,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    speed: spd,
    hp, maxHp: hp,
    angle: Math.random() * Math.PI * 2,
    spinSpeed: (Math.random() - 0.5) * 0.05,
    shootTimer: type === ET.SNIPER ? 60 + Math.random() * 120 : 0,
    sizeScale,
    radius: 12 * sizeScale,
  });
}

function spawnEdge() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  const margin = 30;
  switch (side) {
    case 0: x = -margin; y = Math.random() * gameH; break;
    case 1: x = gameW + margin; y = Math.random() * gameH; break;
    case 2: x = Math.random() * gameW; y = -margin; break;
    case 3: x = Math.random() * gameW; y = gameH + margin; break;
  }
  return { x, y };
}

// ── Waves ──
function startWave() {
  wave++;
  waveDelay = 120; // 2 seconds
  waveAnnounce = `WAVE ${wave}`;
  hudTexts.announce.text = waveAnnounce;
  hudTexts.announce.alpha = 1;
  hudTexts.announce.scale.set(0.5);

  // Bomb refill every 3 waves
  if (wave % 3 === 0) bombs = Math.min(bombs + 1, 3);
}

function spawnWaveEnemies() {
  const count = 4 + wave * 2;
  const types = [];

  if (wave >= 1) types.push(ET.DRIFTER);
  if (wave >= 2) types.push(ET.CHASER);
  if (wave >= 3) types.push(ET.SPINNER);
  if (wave >= 4) types.push(ET.SPLITTER);
  if (wave >= 5) types.push(ET.SNIPER);

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const pos = spawnEdge();

    // Stagger spawns
    setTimeout(() => {
      if (gameRunning) spawnEnemy(type, pos.x, pos.y);
    }, i * 200);
  }
}

// ── Particles ──
function spawnParticles(x, y, color, count, speed) {
  for (let i = 0; i < count && particles.length < PARTICLE_LIMIT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = (0.5 + Math.random() * speed);
    const g = new PIXI.Graphics();
    const size = 1 + Math.random() * 2.5;
    g.beginFill(color, 0.8);
    g.drawCircle(0, 0, size);
    g.endFill();
    g.blendMode = PIXI.BLEND_MODES.ADD;
    worldContainer.addChild(g);

    particles.push({
      gfx: g, x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 30 + Math.random() * 40,
      maxLife: 30 + Math.random() * 40,
    });
  }
}

function spawnScorePopup(x, y, text, color) {
  const style = new PIXI.TextStyle({
    fontFamily: 'VT323', fontSize: 20, fill: color || '#ffff00',
    dropShadow: true, dropShadowColor: color || '#ffff00', dropShadowBlur: 6, dropShadowDistance: 0,
  });
  const t = new PIXI.Text(text, style);
  t.anchor.set(0.5);
  t.position.set(x, y);
  t.blendMode = PIXI.BLEND_MODES.ADD;
  worldContainer.addChild(t);
  scorePopups.push({ gfx: t, x, y, vy: -1.5, life: 50 });
}

// ── Screen Shake ──
function triggerShake(mag) {
  shakeMag = Math.max(shakeMag, mag);
}

// ── Bomb ──
function useBomb() {
  if (bombs <= 0) return;
  bombs--;
  triggerShake(15);

  // Kill all enemies
  for (const e of enemies) {
    spawnParticles(e.x, e.y, e.type.color, 30, 5);
    score += e.type.points;
    kills++;
    totalKills++;
    worldContainer.removeChild(e.gfx);
  }
  enemies = [];

  // Clear enemy bullets
  for (const b of enemyBullets) worldContainer.removeChild(b.gfx);
  enemyBullets = [];

  // Big screen flash
  spawnParticles(gameW / 2, gameH / 2, 0xffffff, 100, 8);
  try { playSound('eat'); } catch(e) {}
}

// ── Collision ──
function dist(x1, y1, x2, y2) {
  const dx = x1 - x2, dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Game Loop ──
function gameLoop(delta) {
  if (!gameRunning) return;

  const dt = Math.min(delta, 3); // cap delta

  // Wave delay / announce
  if (waveDelay > 0) {
    waveDelay -= dt;
    const t = hudTexts.announce;
    if (waveDelay > 60) {
      t.alpha = Math.min(1, t.alpha + 0.05 * dt);
      t.scale.set(Math.min(1.2, t.scale.x + 0.02 * dt));
    } else {
      t.alpha = Math.max(0, t.alpha - 0.025 * dt);
    }
    if (waveDelay <= 0) {
      t.alpha = 0;
      spawnWaveEnemies();
    }
    updateHUD();
  }

  // ── Player movement ──
  let dx = 0, dy = 0;
  if (isMobile) {
    dx = leftStick.dx;
    dy = leftStick.dy;
  } else {
    if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
  }
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag > 0) {
    dx /= mag; dy /= mag;
    playerX += dx * PLAYER_SPEED * dt;
    playerY += dy * PLAYER_SPEED * dt;

    // Trail particles
    if (Math.random() < 0.4) {
      spawnParticles(playerX - dx * 12, playerY - dy * 12, 0x0088aa, 1, 1);
    }
  }

  // Clamp player
  playerX = Math.max(15, Math.min(gameW - 15, playerX));
  playerY = Math.max(15, Math.min(gameH - 15, playerY));

  // Player aim
  if (isMobile) {
    if (rightStick.active && (rightStick.dx !== 0 || rightStick.dy !== 0)) {
      playerAngle = Math.atan2(rightStick.dy, rightStick.dx);
    }
  } else {
    // Mouse aim relative to player position on screen
    const canvasRect = app.view.getBoundingClientRect();
    const scaleX = gameW / canvasRect.width;
    const scaleY = gameH / canvasRect.height;
    const mx = (mouseX - canvasRect.left) * scaleX;
    const my = (mouseY - canvasRect.top) * scaleY;
    playerAngle = Math.atan2(my - playerY, mx - playerX);
  }

  // Update player graphics
  playerGfx.position.set(playerX, playerY);
  playerGfx.rotation = playerAngle;

  // Invincibility flashing
  if (invincible) {
    invincibleTimer -= 16.67 * dt;
    playerGfx.alpha = Math.sin(invincibleTimer * 0.02) > 0 ? 1 : 0.3;
    if (invincibleTimer <= 0) {
      invincible = false;
      playerGfx.alpha = 1;
    }
  }

  // ── Shooting ──
  const now = performance.now();
  const shouldFire = isMobile ? rightStick.active : mouseDown;
  if (shouldFire && now - lastFireTime > FIRE_RATE) {
    lastFireTime = now;
    spawnBullet(
      playerX + Math.cos(playerAngle) * 18,
      playerY + Math.sin(playerAngle) * 18,
      playerAngle
    );
    try { playSound('click'); } catch(e) {}
  }

  // ── Update bullets ──
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    b.gfx.position.set(b.x, b.y);

    if (b.life <= 0 || b.x < -20 || b.x > gameW + 20 || b.y < -20 || b.y > gameH + 20) {
      worldContainer.removeChild(b.gfx);
      bullets.splice(i, 1);
    }
  }

  // ── Update enemy bullets ──
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    b.gfx.position.set(b.x, b.y);

    // Hit player
    if (!invincible && dist(b.x, b.y, playerX, playerY) < 14) {
      hitPlayer();
      worldContainer.removeChild(b.gfx);
      enemyBullets.splice(i, 1);
      continue;
    }

    if (b.life <= 0 || b.x < -20 || b.x > gameW + 20 || b.y < -20 || b.y > gameH + 20) {
      worldContainer.removeChild(b.gfx);
      enemyBullets.splice(i, 1);
    }
  }

  // ── Update enemies ──
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const t = e.type;

    // Movement AI
    if (t === ET.CHASER) {
      const a = Math.atan2(playerY - e.y, playerX - e.x);
      e.vx += Math.cos(a) * 0.08 * dt;
      e.vy += Math.sin(a) * 0.08 * dt;
      const spd = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
      if (spd > e.speed) {
        e.vx = (e.vx / spd) * e.speed;
        e.vy = (e.vy / spd) * e.speed;
      }
    } else if (t === ET.SPINNER) {
      e.angle += e.spinSpeed * dt;
      e.gfx.rotation = e.angle;
      // Bounce off walls
      if (e.x < 10 || e.x > gameW - 10) e.vx *= -1;
      if (e.y < 10 || e.y > gameH - 10) e.vy *= -1;
    } else if (t === ET.SNIPER) {
      // Slow drift, stay near edges
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 90 + Math.random() * 60;
        const a = Math.atan2(playerY - e.y, playerX - e.x);
        spawnEnemyBullet(e.x, e.y, a);
      }
      // Drift towards nearest edge
      const cx = gameW / 2, cy = gameH / 2;
      const toCenterX = cx - e.x, toCenterY = cy - e.y;
      const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
      if (toCenterDist < gameW * 0.3) {
        e.vx -= (toCenterX / toCenterDist) * 0.03;
        e.vy -= (toCenterY / toCenterDist) * 0.03;
      }
    } else if (t === ET.DRIFTER) {
      // Random wander
      e.vx += (Math.random() - 0.5) * 0.1;
      e.vy += (Math.random() - 0.5) * 0.1;
      const spd = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
      if (spd > e.speed) {
        e.vx = (e.vx / spd) * e.speed;
        e.vy = (e.vy / spd) * e.speed;
      }
      // Wrap around
      if (e.x < -20) e.x = gameW + 10;
      if (e.x > gameW + 20) e.x = -10;
      if (e.y < -20) e.y = gameH + 10;
      if (e.y > gameH + 20) e.y = -10;
    } else if (t === ET.SPLITTER) {
      // Slow chase
      const a = Math.atan2(playerY - e.y, playerX - e.x);
      e.vx += Math.cos(a) * 0.04 * dt;
      e.vy += Math.sin(a) * 0.04 * dt;
      const spd = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
      if (spd > e.speed) {
        e.vx = (e.vx / spd) * e.speed;
        e.vy = (e.vy / spd) * e.speed;
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.gfx.position.set(e.x, e.y);

    // Bullet collision
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (dist(b.x, b.y, e.x, e.y) < e.radius + 4) {
        e.hp--;
        worldContainer.removeChild(b.gfx);
        bullets.splice(j, 1);

        // Hit flash
        spawnParticles(b.x, b.y, t.color, 5, 2);

        if (e.hp <= 0) {
          killEnemy(e, i);
          break;
        }
      }
    }

    // Enemy alive — collision with player
    if (enemies[i] && !invincible && dist(e.x, e.y, playerX, playerY) < e.radius + 10) {
      killEnemy(e, i);
      hitPlayer();
    }
  }

  // ── Combo timer ──
  if (combo > 0) {
    comboTimer -= 16.67 * dt;
    if (comboTimer <= 0) {
      combo = 0;
    }
  }
  if (combo > 1) {
    hudTexts.combo.text = `x${combo}`;
    hudTexts.combo.alpha = Math.min(1, hudTexts.combo.alpha + 0.1 * dt);
  } else {
    hudTexts.combo.alpha = Math.max(0, hudTexts.combo.alpha - 0.05 * dt);
  }

  // ── Update particles ──
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt;
    p.gfx.position.set(p.x, p.y);
    p.gfx.alpha = Math.max(0, p.life / p.maxLife);

    if (p.life <= 0) {
      worldContainer.removeChild(p.gfx);
      particles.splice(i, 1);
    }
  }

  // ── Score popups ──
  for (let i = scorePopups.length - 1; i >= 0; i--) {
    const p = scorePopups[i];
    p.y += p.vy * dt;
    p.life -= dt;
    p.gfx.position.set(p.x, p.y);
    p.gfx.alpha = Math.max(0, p.life / 50);

    if (p.life <= 0) {
      worldContainer.removeChild(p.gfx);
      scorePopups.splice(i, 1);
    }
  }

  // ── Screen Shake ──
  if (shakeMag > 0) {
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag;
    shakeMag *= 0.85;
    if (shakeMag < 0.5) { shakeMag = 0; shakeX = 0; shakeY = 0; }
  }
  worldContainer.position.set(shakeX, shakeY);

  // ── Check wave complete ──
  if (wave > 0 && enemies.length === 0 && waveDelay <= 0) {
    startWave();
  }

  // ── Grid glow near player ──
  updateGridGlow();

  updateHUD();
}

function updateGridGlow() {
  // Redraw grid with brightness near player — throttled
  if (Math.random() > 0.1) return;
  gridGfx.clear();
  const spacing = 50;

  for (let x = 0; x <= gameW; x += spacing) {
    for (let y = 0; y <= gameH; y += spacing) {
      const d = dist(x, y, playerX, playerY);
      const brightness = Math.max(0.04, Math.min(0.2, 1 - d / 300) * 0.2);

      gridGfx.lineStyle(1, 0x00ffff, brightness);
      // Vertical segment
      if (y + spacing <= gameH) {
        gridGfx.moveTo(x, y);
        gridGfx.lineTo(x, y + spacing);
      }
      // Horizontal segment
      if (x + spacing <= gameW) {
        gridGfx.moveTo(x, y);
        gridGfx.lineTo(x + spacing, y);
      }
    }
  }
}

function killEnemy(e, idx) {
  const pCount = e.sizeScale < 1 ? 20 : 50;
  spawnParticles(e.x, e.y, e.type.color, pCount, 4);
  triggerShake(4);

  // Combo
  combo = Math.min(combo + 1, MAX_COMBO);
  comboTimer = COMBO_TIMEOUT;
  maxCombo = Math.max(maxCombo, combo);

  const pts = e.type.points * Math.max(1, combo);
  score += pts;
  kills++;
  totalKills++;

  // Bomb every 50 kills
  if (totalKills % 50 === 0) {
    bombs = Math.min(bombs + 1, 3);
    spawnScorePopup(playerX, playerY - 30, '+BOMB!', '#ffff00');
  }

  const comboText = combo > 1 ? ` x${combo}` : '';
  spawnScorePopup(e.x, e.y - 15, `+${pts}${comboText}`, `#${e.type.color.toString(16).padStart(6, '0')}`);

  try { playSound('eat'); } catch(err) {}

  // Splitter: spawn 2 smaller
  if (e.type === ET.SPLITTER && e.sizeScale >= 1) {
    for (let k = 0; k < 2; k++) {
      const offX = (Math.random() - 0.5) * 30;
      const offY = (Math.random() - 0.5) * 30;
      spawnEnemy(ET.SPLITTER, e.x + offX, e.y + offY, 0.6);
    }
  }

  worldContainer.removeChild(e.gfx);
  enemies.splice(idx, 1);

  updateBest();
}

function hitPlayer() {
  if (invincible) return;
  lives--;
  invincible = true;
  invincibleTimer = INVINCIBLE_TIME;
  triggerShake(10);
  spawnParticles(playerX, playerY, 0xff3355, 60, 5);
  combo = 0;
  try { playSound('error'); } catch(e) {}

  if (lives <= 0) {
    gameOver();
  }
}

function updateBest() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('neonblaster_best', String(bestScore));
    bestDisplay.textContent = bestScore;
  }
}

// ── Game Over ──
function gameOver() {
  gameRunning = false;
  spawnParticles(playerX, playerY, 0xffffff, 100, 8);
  spawnParticles(playerX, playerY, 0xff3355, 80, 6);
  triggerShake(20);

  try { playSound('gameover'); } catch(e) {}

  updateBest();

  // Integration
  try {
    import('../shared/game-integration.js').then(m => {
      m.onGameEnd('neonblaster', { won: false, score });
    }).catch(() => {});
  } catch(e) {}

  setTimeout(() => {
    showOverlay('game-over');
  }, 1500);
}

// ── Overlay ──
function showOverlay(mode) {
  overlay.classList.remove('hidden');

  if (mode === 'start') {
    overlayIcon.textContent = '💥';
    overlayTitle.textContent = 'Neon Blaster';
    overlayMsg.textContent = isMobile
      ? 'Joystick esquerdo: mover | Joystick direito: atirar'
      : 'WASD: mover | Mouse: mirar e atirar | Space: bomba';
    overlayScore.textContent = '';
    btnStart.textContent = 'Jogar';
    btnShare.style.display = 'none';
  } else {
    overlayIcon.textContent = '💀';
    overlayTitle.textContent = 'Game Over';
    overlayMsg.textContent = `Wave ${wave} | ${totalKills} kills | Combo max x${maxCombo}`;
    overlayScore.innerHTML = `<span style="color:#00ffff">${score.toLocaleString()}</span> pontos`;
    if (score >= bestScore) {
      overlayScore.innerHTML += '<br><span style="color:#ffff00;font-size:0.9em">NOVO RECORDE!</span>';
    }
    btnStart.textContent = 'Jogar Novamente';
    btnShare.style.display = 'inline-block';
  }
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

// ── Reset ──
function resetGame() {
  // Clear all objects
  for (const b of bullets) worldContainer.removeChild(b.gfx);
  for (const b of enemyBullets) worldContainer.removeChild(b.gfx);
  for (const e of enemies) worldContainer.removeChild(e.gfx);
  for (const p of particles) worldContainer.removeChild(p.gfx);
  for (const p of scorePopups) worldContainer.removeChild(p.gfx);
  bullets = [];
  enemyBullets = [];
  enemies = [];
  particles = [];
  scorePopups = [];

  score = 0;
  lives = 3;
  wave = 0;
  kills = 0;
  totalKills = 0;
  combo = 0;
  maxCombo = 0;
  bombs = 1;
  invincible = false;
  invincibleTimer = 0;
  shakeMag = 0;
  shakeX = 0;
  shakeY = 0;
  waveDelay = 0;

  createPlayer();
  updateHUD();
}

// ── Share ──
function share() {
  const text = `\u{1F4A5} Neon Blaster: ${score.toLocaleString()} pontos! Wave ${wave}, ${totalKills} kills, combo x${maxCombo}!\nJogue: https://gameshub.com.br/games/neonblaster/`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
}

// ── Input Handlers ──
function setupInput() {
  // Keyboard
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' && gameRunning) {
      e.preventDefault();
      useBomb();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Mouse
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouseDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
  });

  // Detect mobile
  isMobile = 'ontouchstart' in window && window.innerWidth < 900;

  if (isMobile) {
    setupMobileControls();
  }
}

function setupMobileControls() {
  const joyLeftEl = document.getElementById('joystick-left');
  const joyRightEl = document.getElementById('joystick-right');
  const bombBtn = document.getElementById('btn-bomb');

  joyLeftEl.style.display = 'block';
  joyRightEl.style.display = 'block';
  bombBtn.style.display = 'block';

  const knobLeft = joyLeftEl.querySelector('.joystick-knob');
  const knobRight = joyRightEl.querySelector('.joystick-knob');
  const baseLeft = joyLeftEl.querySelector('.joystick-base');
  const baseRight = joyRightEl.querySelector('.joystick-base');

  let leftTouchId = null, rightTouchId = null;

  function getJoystickInput(touch, baseEl, knob) {
    const rect = baseEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const maxR = rect.width / 2 - 10;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > maxR) {
      dx = (dx / d) * maxR;
      dy = (dy / d) * maxR;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    return { dx: dx / maxR, dy: dy / maxR };
  }

  function resetKnob(knob) {
    knob.style.transform = 'translate(0px, 0px)';
  }

  joyLeftEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    leftTouchId = t.identifier;
    const r = getJoystickInput(t, baseLeft, knobLeft);
    leftStick.active = true;
    leftStick.dx = r.dx;
    leftStick.dy = r.dy;
  }, { passive: false });

  joyLeftEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === leftTouchId) {
        const r = getJoystickInput(t, baseLeft, knobLeft);
        leftStick.dx = r.dx;
        leftStick.dy = r.dy;
      }
    }
  }, { passive: false });

  joyLeftEl.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === leftTouchId) {
        leftTouchId = null;
        leftStick.active = false;
        leftStick.dx = 0;
        leftStick.dy = 0;
        resetKnob(knobLeft);
      }
    }
  });

  joyRightEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    rightTouchId = t.identifier;
    const r = getJoystickInput(t, baseRight, knobRight);
    rightStick.active = true;
    rightStick.dx = r.dx;
    rightStick.dy = r.dy;
  }, { passive: false });

  joyRightEl.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === rightTouchId) {
        const r = getJoystickInput(t, baseRight, knobRight);
        rightStick.dx = r.dx;
        rightStick.dy = r.dy;
      }
    }
  }, { passive: false });

  joyRightEl.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === rightTouchId) {
        rightTouchId = null;
        rightStick.active = false;
        rightStick.dx = 0;
        rightStick.dy = 0;
        resetKnob(knobRight);
      }
    }
  });

  bombBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning) useBomb();
  }, { passive: false });
}

// ── Resize ──
function handleResize() {
  const container = document.getElementById('pixi-container');
  const rect = container.getBoundingClientRect();
  gameW = Math.floor(rect.width);
  gameH = Math.floor(rect.height);

  if (app && app.renderer) {
    app.renderer.resize(gameW, gameH);
    drawGrid();
    createHUD();
  }
}

// ── Init ──
function init() {
  initPixi();
  setupInput();
  createPlayer();
  updateHUD();
  showOverlay('start');

  app.ticker.add((delta) => gameLoop(delta));

  btnStart.addEventListener('click', () => {
    initAudio();
    hideOverlay();
    resetGame();
    gameRunning = true;
    startWave();
    try { playSound('start'); } catch(e) {}
  });

  btnShare.addEventListener('click', share);

  window.addEventListener('resize', handleResize);

  // Prevent context menu on game area
  document.getElementById('pixi-container').addEventListener('contextmenu', (e) => e.preventDefault());
}

init();
