/**
 * Torre Brasil — Tower Defense
 * Canvas 2D, no external dependencies
 */
import { shareOnWhatsApp } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { onGameEnd } from '../shared/game-integration.js';

// ── Constants ──
const COLS = 20;
const ROWS = 14;
const TOWER_TYPES = {
  tucano:   { name: 'Tucano',   cost: 15,  range: 2.5, damage: 8,   speed: 0.12, splash: 0,   slow: 0,   stun: 0,    color1: '#f39c12', color2: '#2c3e50', shape: 'circle' },
  arara:    { name: 'Arara',    cost: 40,  range: 4.0, damage: 18,  speed: 0.06, splash: 0,   slow: 0,   stun: 0,    color1: '#e74c3c', color2: '#3498db', shape: 'diamond' },
  onca:     { name: 'Onça',     cost: 50,  range: 2.5, damage: 14,  speed: 0.16, splash: 0,   slow: 0,   stun: 0,    color1: '#f1c40f', color2: '#2c3e50', shape: 'circle' },
  jacare:   { name: 'Jacaré',   cost: 60,  range: 2.0, damage: 25,  speed: 0.04, splash: 1.2, slow: 0,   stun: 0,    color1: '#27ae60', color2: '#1a5c33', shape: 'rect' },
  capivara: { name: 'Capivara', cost: 45,  range: 2.5, damage: 6,   speed: 0.08, splash: 0,   slow: 0.5, stun: 0,    color1: '#a0522d', color2: '#8b4513', shape: 'circle' },
  sucuri:   { name: 'Sucuri',   cost: 70,  range: 3.0, damage: 10,  speed: 0.02, splash: 0,   slow: 0,   stun: 2000, color1: '#1a5c33', color2: '#0d3318', shape: 'rect' },
};

const UPGRADE_MULT = { damage: 1.5, range: 1.2, speed: 1.25 };
const UPGRADE_COST_MULT = [0, 1.0, 1.8, 3.0]; // cost multiplier per level

const ENEMY_TYPES = {
  normal: { hp: 30, speed: 1.0, reward: 5,  shape: 'circle', color: '#e74c3c', size: 0.3 },
  fast:   { hp: 18, speed: 2.0, reward: 7,  shape: 'triangle', color: '#e67e22', size: 0.25 },
  tank:   { hp: 90, speed: 0.6, reward: 12, shape: 'rect', color: '#8e44ad', size: 0.4 },
  flying: { hp: 25, speed: 1.4, reward: 10, shape: 'diamond', color: '#3498db', size: 0.25 },
  boss:   { hp: 300,speed: 0.5, reward: 50, shape: 'circle', color: '#c0392b', size: 0.55 },
};

// ── Biomes ──
const BIOMES = [
  {
    name: 'Amazônia', bg: '#0a2e0a', pathColor: '#3d1f00', grassColor: '#1a4d1a',
    waypoints: [[0,3],[3,3],[3,7],[7,7],[7,2],[11,2],[11,10],[15,10],[15,5],[19,5]],
  },
  {
    name: 'Cerrado', bg: '#2e2a0a', pathColor: '#5c4a1e', grassColor: '#4a4420',
    waypoints: [[0,7],[4,7],[4,3],[8,3],[8,11],[12,11],[12,4],[16,4],[16,9],[19,9]],
  },
  {
    name: 'Pantanal', bg: '#0a1e2e', pathColor: '#2e4a5c', grassColor: '#153050',
    waypoints: [[0,1],[5,1],[5,6],[2,6],[2,11],[9,11],[9,5],[14,5],[14,12],[19,12]],
  },
  {
    name: 'Mata Atlântica', bg: '#0a2e1a', pathColor: '#2e1f00', grassColor: '#0d3d1d',
    waypoints: [[0,10],[3,10],[3,5],[7,5],[7,12],[11,12],[11,2],[16,2],[16,8],[19,8]],
  },
  {
    name: 'Caatinga', bg: '#2e2210', pathColor: '#6b5230', grassColor: '#4d3a18',
    waypoints: [[0,6],[4,6],[4,2],[9,2],[9,9],[13,9],[13,3],[17,3],[17,11],[19,11]],
  },
];

// ── State ──
let canvas, ctx;
let cellW, cellH;
let grid = [];        // 0 = grass, 1 = path, 2 = tower, 3 = adjacent-to-path
let towers = [];
let enemies = [];
let projectiles = [];
let particles = [];
let currentBiome = 0;
let wave = 0;
let lives = 20;
let coins = 100;
let score = 0;
let towersPlaced = 0;
let selectedTowerType = null;
let selectedTower = null;
let gameRunning = false;
let waveActive = false;
let waveEnemies = [];
let spawnTimer = 0;
let spawnInterval = 0;
let lastTime = 0;
let animFrame = 0;
let pathSegments = []; // pre-computed path for current biome

// DOM refs
const livesEl = document.getElementById('lives-display');
const coinsEl = document.getElementById('coins-display');
const waveEl = document.getElementById('wave-display');
const overlay = document.getElementById('overlay');
const overlayIcon = document.getElementById('overlay-icon');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const btnStart = document.getElementById('btn-start');
const btnShare = document.getElementById('btn-share');
const towerPanel = document.getElementById('tower-panel');
const towerInfo = document.getElementById('tower-info');
const infoName = document.getElementById('info-name');
const infoLevel = document.getElementById('info-level');
const btnUpgrade = document.getElementById('btn-upgrade');
const btnSell = document.getElementById('btn-sell');
const btnCloseInfo = document.getElementById('btn-close-info');

// ── Initialization ──
function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);

  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('touchend', onCanvasTap, { passive: false });

  document.querySelectorAll('.tower-option').forEach(el => {
    el.addEventListener('click', () => selectTowerType(el.dataset.tower));
  });

  btnUpgrade.addEventListener('click', upgradeTower);
  btnSell.addEventListener('click', sellTower);
  btnCloseInfo.addEventListener('click', closeTowerInfo);
  btnStart.addEventListener('click', startGame);
  btnShare.addEventListener('click', () => {
    shareOnWhatsApp(`Joguei Torre Brasil e cheguei na onda ${wave} no bioma ${BIOMES[currentBiome].name} com ${score} pontos! Jogue tambem: https://gameshub.com.br/games/torre/`);
  });

  showOverlay('🏰', 'Torre Brasil', 'Defenda os biomas brasileiros!\nPosicione torres para impedir os invasores.', '', 'Defender!');
}

function resize() {
  const container = canvas.parentElement;
  const panelH = towerPanel.offsetHeight || 50;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight - panelH;
  cellW = canvas.width / COLS;
  cellH = canvas.height / ROWS;
  if (gameRunning) draw();
}

// ── Biome & Grid ──
function buildGrid() {
  const biome = BIOMES[currentBiome];
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  pathSegments = [];

  // Draw path on grid
  const wp = biome.waypoints;
  for (let i = 0; i < wp.length - 1; i++) {
    const [x1, y1] = wp[i];
    const [x2, y2] = wp[i + 1];
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    let cx = x1, cy = y1;
    while (cx !== x2 || cy !== y2) {
      if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) grid[cy][cx] = 1;
      pathSegments.push({ x: cx + 0.5, y: cy + 0.5 });
      if (cx !== x2) cx += dx;
      else if (cy !== y2) cy += dy;
    }
    if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) grid[cy][cx] = 1;
  }
  // Last waypoint
  const last = wp[wp.length - 1];
  pathSegments.push({ x: last[0] + 0.5, y: last[1] + 0.5 });

  // Mark adjacent-to-path cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === 0) {
        const adj = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dr, dc] of adj) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === 1) {
            grid[r][c] = 3; // adjacent to path
            break;
          }
        }
      }
    }
  }
}

// ── Game Control ──
function startGame() {
  overlay.classList.add('hidden');
  lives = 20;
  coins = 100;
  score = 0;
  wave = 0;
  towersPlaced = 0;
  currentBiome = 0;
  towers = [];
  enemies = [];
  projectiles = [];
  particles = [];
  selectedTower = null;
  selectedTowerType = null;
  closeTowerInfo();
  buildGrid();
  updateUI();
  gameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
  startNextWave();
}

function startNextWave() {
  wave++;
  if (wave > 20) {
    // Next biome
    currentBiome++;
    if (currentBiome >= BIOMES.length) {
      endGame(true);
      return;
    }
    wave = 1;
    towers = [];
    enemies = [];
    projectiles = [];
    buildGrid();
    coins += 50; // bonus for biome clear
  }
  updateUI();
  generateWaveEnemies();
  spawnTimer = 0;
  spawnInterval = Math.max(400, 1200 - wave * 30);
  waveActive = true;
}

function generateWaveEnemies() {
  waveEnemies = [];
  const baseCount = 5 + wave * 2;
  const isBoss = wave % 5 === 0;

  for (let i = 0; i < baseCount; i++) {
    const r = Math.random();
    let type;
    if (wave < 3) type = 'normal';
    else if (r < 0.5) type = 'normal';
    else if (r < 0.7) type = 'fast';
    else if (r < 0.85) type = 'tank';
    else type = 'flying';
    waveEnemies.push(type);
  }

  if (isBoss) {
    waveEnemies.push('boss');
  }

  // Scale HP with biome and wave
  const hpMult = 1 + currentBiome * 0.4 + (wave - 1) * 0.08;
  waveEnemies = waveEnemies.map(type => ({ type, hpMult }));
}

function spawnEnemy(info) {
  const def = ENEMY_TYPES[info.type];
  const start = pathSegments[0];
  enemies.push({
    type: info.type,
    x: start.x,
    y: start.y,
    hp: Math.round(def.hp * info.hpMult),
    maxHp: Math.round(def.hp * info.hpMult),
    speed: def.speed,
    baseSpeed: def.speed,
    reward: def.reward,
    pathIndex: 0,
    slowTimer: 0,
    stunTimer: 0,
    dead: false,
    shape: def.shape,
    color: def.color,
    size: def.size,
  });
}

function endGame(won) {
  gameRunning = false;
  const biomeName = BIOMES[Math.min(currentBiome, BIOMES.length - 1)].name;
  if (won) {
    showOverlay('🏆', 'Vitória Total!', `Você defendeu todos os 5 biomas!\nPontuação: ${score}`, `Bioma: ${biomeName} | Ondas: ${wave} | Torres: ${towersPlaced}`, 'Jogar Novamente');
  } else {
    showOverlay('💀', 'Derrota!', `Os invasores passaram!\nPontuação: ${score}`, `Bioma: ${biomeName} | Onda: ${wave}/20 | Torres: ${towersPlaced}`, 'Tentar Novamente');
  }
  btnShare.style.display = 'inline-block';

  try {
    onGameEnd?.({ game: 'torre', score, details: { biome: biomeName, wave, towersPlaced } });
  } catch (e) { /* ignore */ }

  try {
    const stats = new GameStats('torre');
    stats.save({ score, biome: biomeName, wave, towersPlaced });
  } catch (e) { /* ignore */ }
}

function showOverlay(icon, title, msg, scoreText, btnText) {
  overlayIcon.textContent = icon;
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlayScore.textContent = scoreText;
  btnStart.textContent = btnText;
  overlay.classList.remove('hidden');
}

function updateUI() {
  livesEl.textContent = lives;
  coinsEl.textContent = coins;
  waveEl.textContent = `${wave}/20`;
  updateTowerPanel();
}

function updateTowerPanel() {
  document.querySelectorAll('.tower-option').forEach(el => {
    const type = el.dataset.tower;
    const cost = TOWER_TYPES[type].cost;
    if (coins < cost) el.classList.add('disabled');
    else el.classList.remove('disabled');
    if (type === selectedTowerType) el.classList.add('selected');
    else el.classList.remove('selected');
  });
}

// ── Tower Selection & Placement ──
function selectTowerType(type) {
  if (selectedTowerType === type) {
    selectedTowerType = null;
  } else {
    selectedTowerType = type;
  }
  selectedTower = null;
  closeTowerInfo();
  updateTowerPanel();
}

function onCanvasClick(e) {
  if (!gameRunning) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  handleGridClick(mx, my);
}

function onCanvasTap(e) {
  if (!gameRunning) return;
  e.preventDefault();
  const touch = e.changedTouches[0];
  const rect = canvas.getBoundingClientRect();
  const mx = touch.clientX - rect.left;
  const my = touch.clientY - rect.top;
  handleGridClick(mx, my);
}

function handleGridClick(mx, my) {
  const col = Math.floor(mx / cellW);
  const row = Math.floor(my / cellH);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

  // Check if clicked on existing tower
  const existing = towers.find(t => t.col === col && t.row === row);
  if (existing) {
    selectedTower = existing;
    selectedTowerType = null;
    showTowerInfo(existing);
    updateTowerPanel();
    return;
  }

  // Place new tower
  if (selectedTowerType && (grid[row][col] === 0 || grid[row][col] === 3)) {
    const def = TOWER_TYPES[selectedTowerType];
    if (coins >= def.cost) {
      coins -= def.cost;
      grid[row][col] = 2;
      towers.push({
        type: selectedTowerType,
        col, row,
        x: col + 0.5,
        y: row + 0.5,
        level: 1,
        damage: def.damage,
        range: def.range,
        speed: def.speed,
        splash: def.splash,
        slow: def.slow,
        stun: def.stun,
        cooldown: 0,
        totalSpent: def.cost,
        color1: def.color1,
        color2: def.color2,
      });
      towersPlaced++;
      selectedTowerType = null;
      updateUI();
    }
  } else {
    selectedTower = null;
    closeTowerInfo();
  }
}

function showTowerInfo(tower) {
  const def = TOWER_TYPES[tower.type];
  infoName.textContent = def.name;
  infoLevel.textContent = `Nv.${tower.level}`;
  if (tower.level < 3) {
    const upgCost = Math.round(def.cost * UPGRADE_COST_MULT[tower.level + 1]);
    btnUpgrade.textContent = `⬆ Melhorar (${upgCost})`;
    btnUpgrade.style.display = '';
    if (coins < upgCost) btnUpgrade.style.opacity = '0.4';
    else btnUpgrade.style.opacity = '1';
  } else {
    btnUpgrade.style.display = 'none';
  }
  const sellValue = Math.round(tower.totalSpent * 0.6);
  btnSell.textContent = `💰 Vender (${sellValue})`;
  towerInfo.style.display = 'flex';
}

function closeTowerInfo() {
  towerInfo.style.display = 'none';
  selectedTower = null;
}

function upgradeTower() {
  if (!selectedTower || selectedTower.level >= 3) return;
  const def = TOWER_TYPES[selectedTower.type];
  const cost = Math.round(def.cost * UPGRADE_COST_MULT[selectedTower.level + 1]);
  if (coins < cost) return;
  coins -= cost;
  selectedTower.level++;
  selectedTower.totalSpent += cost;
  selectedTower.damage = Math.round(def.damage * Math.pow(UPGRADE_MULT.damage, selectedTower.level - 1));
  selectedTower.range = def.range * Math.pow(UPGRADE_MULT.range, selectedTower.level - 1);
  selectedTower.speed = def.speed * Math.pow(UPGRADE_MULT.speed, selectedTower.level - 1);
  showTowerInfo(selectedTower);
  updateUI();
}

function sellTower() {
  if (!selectedTower) return;
  const sellValue = Math.round(selectedTower.totalSpent * 0.6);
  coins += sellValue;
  grid[selectedTower.row][selectedTower.col] = 3; // restore to adjacent
  towers = towers.filter(t => t !== selectedTower);
  closeTowerInfo();
  updateUI();
}

// ── Game Loop ──
function gameLoop(time) {
  if (!gameRunning) return;
  const dt = Math.min(time - lastTime, 50);
  lastTime = time;
  animFrame++;

  update(dt);
  draw();

  requestAnimationFrame(gameLoop);
}

function update(dt) {
  // Spawn enemies
  if (waveActive && waveEnemies.length > 0) {
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer -= spawnInterval;
      spawnEnemy(waveEnemies.shift());
    }
  }

  // Check wave complete
  if (waveActive && waveEnemies.length === 0 && enemies.length === 0) {
    waveActive = false;
    coins += 10 + wave * 2; // wave bonus
    score += wave * 10;
    updateUI();
    setTimeout(() => {
      if (gameRunning) startNextWave();
    }, 1500);
  }

  // Update enemies
  for (const e of enemies) {
    if (e.dead) continue;

    // Stun
    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
      continue;
    }

    // Slow
    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      e.speed = e.baseSpeed * 0.5;
    } else {
      e.speed = e.baseSpeed;
    }

    // Move along path
    if (e.pathIndex < pathSegments.length) {
      const target = pathSegments[e.pathIndex];
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const moveSpeed = e.speed * dt * 0.003;

      if (dist < moveSpeed) {
        e.x = target.x;
        e.y = target.y;
        e.pathIndex++;
      } else {
        e.x += (dx / dist) * moveSpeed;
        e.y += (dy / dist) * moveSpeed;
      }
    }

    // Reached end
    if (e.pathIndex >= pathSegments.length) {
      e.dead = true;
      lives--;
      if (lives <= 0) {
        lives = 0;
        updateUI();
        endGame(false);
        return;
      }
      updateUI();
    }
  }

  // Tower attacks
  for (const t of towers) {
    if (t.cooldown > 0) {
      t.cooldown -= dt;
      continue;
    }

    // Find target
    let target = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= t.range && dist < bestDist) {
        // Flying enemies: all towers can target them
        bestDist = dist;
        target = e;
      }
    }

    if (target) {
      t.cooldown = 1000 / (t.speed * 10); // convert speed to ms
      // Fire projectile
      projectiles.push({
        x: t.x, y: t.y,
        tx: target.x, ty: target.y,
        target,
        damage: t.damage,
        splash: t.splash,
        slow: t.slow,
        stun: t.stun,
        speed: 0.008,
        color: t.color1,
        alive: true,
      });
    }
  }

  // Update projectiles
  for (const p of projectiles) {
    if (!p.alive) continue;
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    // Update target position
    if (p.target && !p.target.dead) {
      p.tx = p.target.x;
      p.ty = p.target.y;
    }
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveSpeed = p.speed * dt;

    if (dist < moveSpeed + 0.1) {
      p.alive = false;
      // Hit
      if (p.target && !p.target.dead) {
        applyDamage(p.target, p.damage, p);
      }
      // Splash
      if (p.splash > 0) {
        for (const e of enemies) {
          if (e.dead || e === p.target) continue;
          const sd = Math.sqrt((e.x - p.tx) ** 2 + (e.y - p.ty) ** 2);
          if (sd <= p.splash) {
            applyDamage(e, Math.round(p.damage * 0.5), p);
          }
        }
        // Splash particle
        particles.push({ x: p.tx, y: p.ty, radius: p.splash, life: 300, maxLife: 300, color: '#f39c12', type: 'splash' });
      }
    } else {
      p.x += (dx / dist) * moveSpeed;
      p.y += (dy / dist) * moveSpeed;
    }
  }

  // Update particles
  for (const part of particles) {
    part.life -= dt;
  }

  // Cleanup
  enemies = enemies.filter(e => !e.dead);
  projectiles = projectiles.filter(p => p.alive);
  particles = particles.filter(p => p.life > 0);
}

function applyDamage(enemy, damage, proj) {
  enemy.hp -= damage;
  // Apply slow
  if (proj.slow > 0) {
    enemy.slowTimer = 1500;
  }
  // Apply stun
  if (proj.stun > 0) {
    enemy.stunTimer = proj.stun;
  }
  // Death
  if (enemy.hp <= 0) {
    enemy.dead = true;
    coins += enemy.reward;
    score += enemy.reward * 2;
    // Death particles
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: enemy.x + (Math.random() - 0.5) * 0.3,
        y: enemy.y + (Math.random() - 0.5) * 0.3,
        radius: 0.15,
        life: 400,
        maxLife: 400,
        color: enemy.color,
        type: 'fade',
      });
    }
    updateUI();
  }
}

// ── Drawing ──
function draw() {
  const biome = BIOMES[currentBiome];
  ctx.fillStyle = biome.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid(biome);
  drawTowers();
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawSelectedRange();
  drawBiomeLabel(biome);
}

function drawGrid(biome) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * cellW;
      const y = r * cellH;

      if (grid[r][c] === 1) {
        ctx.fillStyle = biome.pathColor;
        ctx.fillRect(x, y, cellW + 1, cellH + 1);
        // Path border
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.strokeRect(x, y, cellW, cellH);
      } else {
        ctx.fillStyle = biome.grassColor;
        ctx.fillRect(x, y, cellW + 1, cellH + 1);
        // Subtle grid
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.strokeRect(x, y, cellW, cellH);
      }

      // Highlight placeable cells when tower selected
      if (selectedTowerType && grid[r][c] === 3) {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.15)';
        ctx.fillRect(x, y, cellW, cellH);
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
      }
      // Also allow placement on empty non-adjacent cells (grid === 0)
      if (selectedTowerType && grid[r][c] === 0) {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.06)';
        ctx.fillRect(x, y, cellW, cellH);
      }
    }
  }
}

function drawTowers() {
  for (const t of towers) {
    const cx = t.x * cellW;
    const cy = t.y * cellH;
    const r = Math.min(cellW, cellH) * 0.35;

    // Base
    ctx.fillStyle = t.color2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.fill();

    // Tower body
    ctx.fillStyle = t.color1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Level indicator
    if (t.level > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(r * 0.8)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.level.toString(), cx, cy);
    }

    // Selected highlight
    if (selectedTower === t) {
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawSelectedRange() {
  if (selectedTower) {
    const cx = selectedTower.x * cellW;
    const cy = selectedTower.y * cellH;
    const rangePx = selectedTower.range * Math.min(cellW, cellH);
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, rangePx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (selectedTowerType) {
    // Show range preview at cursor? - skip for simplicity
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;
    const cx = e.x * cellW;
    const cy = e.y * cellH;
    const sz = e.size * Math.min(cellW, cellH);

    ctx.fillStyle = e.color;

    switch (e.shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(cx, cy, sz, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(cx, cy - sz);
        ctx.lineTo(cx - sz, cy + sz);
        ctx.lineTo(cx + sz, cy + sz);
        ctx.closePath();
        ctx.fill();
        break;
      case 'rect':
        ctx.fillRect(cx - sz, cy - sz, sz * 2, sz * 2);
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(cx, cy - sz);
        ctx.lineTo(cx + sz, cy);
        ctx.lineTo(cx, cy + sz);
        ctx.lineTo(cx - sz, cy);
        ctx.closePath();
        ctx.fill();
        break;
    }

    // Stun indicator
    if (e.stunTimer > 0) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, sz + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Slow indicator
    else if (e.slowTimer > 0) {
      ctx.strokeStyle = '#8b4513';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, sz + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HP bar
    const barW = sz * 2.5;
    const barH = 3;
    const barX = cx - barW / 2;
    const barY = cy - sz - 6;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    const hpRatio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
  }
}

function drawProjectiles() {
  for (const p of projectiles) {
    if (!p.alive) continue;
    const px = p.x * cellW;
    const py = p.y * cellH;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    if (p.type === 'splash') {
      const px = p.x * cellW;
      const py = p.y * cellH;
      const r = p.radius * Math.min(cellW, cellH) * (1 - alpha * 0.5);
      ctx.strokeStyle = `rgba(243, 156, 18, ${alpha * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const px = p.x * cellW;
      const py = p.y * cellH;
      const r = p.radius * Math.min(cellW, cellH) * alpha;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawBiomeLabel(biome) {
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = `bold ${Math.round(cellH * 0.6)}px "Space Grotesk", sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(biome.name, canvas.width - 8, canvas.height - 8);
}

// ── Start ──
init();
