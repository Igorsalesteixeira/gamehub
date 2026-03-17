// =============================================
//  Space Invaders — Games Hub
// =============================================
import { supabase } from '../../supabase.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const overlayIcon = document.getElementById('overlay-icon');
const btnStart = document.getElementById('btn-start');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');
const waveDisplay = document.getElementById('wave-display');

// ===== SIZING =====
const BASE_W = 480;
const BASE_H = 640;
let scale = 1;

function resize() {
  const container = canvas.parentElement;
  const maxW = container.clientWidth - 16;
  const maxH = container.clientHeight - 16;
  scale = Math.min(maxW / BASE_W, maxH / BASE_H, 1.5);
  canvas.width = Math.floor(BASE_W * scale);
  canvas.height = Math.floor(BASE_H * scale);
}
window.addEventListener('resize', resize);
resize();

// ===== GAME STATE =====
let state = 'idle'; // idle | playing | gameover
let paused = false;
let score = 0;
let lives = 3;
let wave = 1;

// Player
const PLAYER_W = 40;
const PLAYER_H = 16;
let playerX = BASE_W / 2;
const playerY = BASE_H - 30;
const playerSpeed = 4;

// Input
const keys = {};
let mobileLeft = false;
let mobileRight = false;
let mobileShoot = false;
let lastMobileShot = 0;

// Bullets
let playerBullets = [];
let alienBullets = [];
const BULLET_SPEED = 6;
const ALIEN_BULLET_SPEED = 3;
const PLAYER_SHOOT_CD = 250; // ms
let lastShotTime = 0;

// Aliens
const ALIEN_COLS = 8;
const ALIEN_ROWS = 5;
const ALIEN_W = 28;
const ALIEN_H = 20;
const ALIEN_PAD_X = 10;
const ALIEN_PAD_Y = 10;
let aliens = [];
let alienDir = 1; // 1=right, -1=left
let alienBaseSpeed = 0.5;
let alienSpeed = alienBaseSpeed;
let alienMoveTimer = 0;
let alienMoveInterval = 40; // frames between moves
let alienShootTimer = 0;
let alienShootInterval = 90; // frames

// Explosions
let explosions = [];

// ===== ALIEN PIXEL ART PATTERNS =====
// Each pattern is a grid of 0/1 (7 wide x 5 tall)
const ALIEN_PATTERNS = [
  // Type 0 — top rows (30 pts) — squid
  [
    [0,0,0,1,0,0,0],
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,1,0,1,0,1,1],
    [0,1,1,1,1,1,0],
  ],
  // Type 1 — middle rows (20 pts) — crab
  [
    [0,1,0,0,0,1,0],
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,0,1,1,1,0,1],
    [1,0,1,0,1,0,1],
  ],
  // Type 2 — bottom rows (10 pts) — octopus
  [
    [0,0,1,1,1,0,0],
    [0,1,1,1,1,1,0],
    [1,1,1,1,1,1,1],
    [1,0,1,0,1,0,1],
    [0,1,0,0,0,1,0],
  ],
];

const ALIEN_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77'];
const ALIEN_POINTS = [30, 20, 10];

function getAlienType(row) {
  if (row <= 1) return 0;
  if (row <= 3) return 1;
  return 2;
}

// ===== INIT ALIENS =====
function initAliens() {
  aliens = [];
  const gridW = ALIEN_COLS * (ALIEN_W + ALIEN_PAD_X) - ALIEN_PAD_X;
  const startX = (BASE_W - gridW) / 2;
  const startY = 50;

  for (let r = 0; r < ALIEN_ROWS; r++) {
    for (let c = 0; c < ALIEN_COLS; c++) {
      aliens.push({
        x: startX + c * (ALIEN_W + ALIEN_PAD_X),
        y: startY + r * (ALIEN_H + ALIEN_PAD_Y),
        row: r,
        col: c,
        alive: true,
        type: getAlienType(r),
      });
    });
  }
}

// ===== START / RESET =====
function startGame() {
  score = 0;
  lives = 3;
  wave = 1;
  playerX = BASE_W / 2;
  playerBullets = [];
  alienBullets = [];
  explosions = [];
  alienDir = 1;
  alienBaseSpeed = 0.5;
  alienSpeed = alienBaseSpeed;
  alienMoveTimer = 0;
  alienMoveInterval = 40;
  alienShootInterval = 90;
  alienShootTimer = 0;
  initAliens();
  updateHUD();
  state = 'playing';
  overlay.classList.add('hidden');
}

function nextWave() {
  wave++;
  playerBullets = [];
  alienBullets = [];
  alienDir = 1;
  alienBaseSpeed = Math.min(alienBaseSpeed + 0.2, 2.5);
  alienSpeed = alienBaseSpeed;
  alienMoveInterval = Math.max(alienMoveInterval - 4, 12);
  alienShootInterval = Math.max(alienShootInterval - 8, 30);
  alienMoveTimer = 0;
  alienShootTimer = 0;
  initAliens();
  updateHUD();
}

function updateHUD() {
  scoreDisplay.textContent = score;
  livesDisplay.textContent = lives;
  waveDisplay.textContent = wave;
}

// ===== DRAWING =====
function drawPlayer() {
  const s = scale;
  const x = playerX * s;
  const y = playerY * s;
  const w = PLAYER_W * s;
  const h = PLAYER_H * s;

  ctx.fillStyle = '#4fc3f7';
  // Body
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  // Cannon
  ctx.fillRect(x - 3 * s, y - h / 2 - 8 * s, 6 * s, 8 * s);
  // Wings
  ctx.fillStyle = '#29b6f6';
  ctx.fillRect(x - w / 2 - 4 * s, y, 4 * s, h / 2);
  ctx.fillRect(x + w / 2, y, 4 * s, h / 2);
}

function drawAlien(a) {
  const s = scale;
  const pattern = ALIEN_PATTERNS[a.type];
  const color = ALIEN_COLORS[a.type];
  const pixW = (ALIEN_W / 7) * s;
  const pixH = (ALIEN_H / 5) * s;

  ctx.fillStyle = color;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 7; c++) {
      if (pattern[r][c]) {
        ctx.fillRect(
          (a.x + c * (ALIEN_W / 7)) * s,
          (a.y + r * (ALIEN_H / 5)) * s,
          Math.ceil(pixW),
          Math.ceil(pixH)
        );
      }
    }
  }
}

function drawBullet(b, color) {
  const s = scale;
  ctx.fillStyle = color;
  ctx.fillRect(b.x * s - 2 * s, b.y * s - 4 * s, 4 * s, 8 * s);
}

function drawExplosions() {
  const s = scale;
  for (const ex of explosions) {
    const alpha = ex.life / ex.maxLife;
    ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
    const size = (10 + (1 - alpha) * 15) * s;
    ctx.fillRect(ex.x * s - size / 2, ex.y * s - size / 2, size, size);

    ctx.fillStyle = `rgba(255, 100, 50, ${alpha * 0.6})`;
    const size2 = size * 1.4;
    ctx.fillRect(ex.x * s - size2 / 2, ex.y * s - size2 / 2, size2, size2);
  }
}

function drawStars() {
  // Simple static stars based on canvas size
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  const seed = 12345;
  for (let i = 0; i < 60; i++) {
    const px = ((seed * (i + 1) * 7) % canvas.width);
    const py = ((seed * (i + 1) * 13) % canvas.height);
    const sz = (i % 3 === 0) ? 2 : 1;
    ctx.fillRect(px, py, sz, sz);
  }
}

// ===== UPDATE =====
function update() {
  if (state !== 'playing' || paused) return;

  // Player movement
  let dx = 0;
  if (keys['ArrowLeft'] || keys['a'] || mobileLeft) dx -= playerSpeed;
  if (keys['ArrowRight'] || keys['d'] || mobileRight) dx += playerSpeed;
  playerX += dx;
  playerX = Math.max(PLAYER_W / 2 + 4, Math.min(BASE_W - PLAYER_W / 2 - 4, playerX));

  // Player shoot
  const now = performance.now();
  if ((keys[' '] || keys['ArrowUp'] || mobileShoot) && now - lastShotTime > PLAYER_SHOOT_CD) {
    lastShotTime = now;
    playerBullets.push({ x: playerX, y: playerY - PLAYER_H / 2 - 8 });
  }

  // Player bullets
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    playerBullets[i].y -= BULLET_SPEED;
    if (playerBullets[i].y < 0) {
      playerBullets.splice(i, 1);
    }
  }

  // Alien movement
  alienMoveTimer++;
  if (alienMoveTimer >= alienMoveInterval) {
    alienMoveTimer = 0;
    let edgeHit = false;
    for (const a of aliens) {
      if (!a.alive) continue;
      if ((alienDir > 0 && a.x + ALIEN_W + alienSpeed > BASE_W - 5) ||
          (alienDir < 0 && a.x - alienSpeed < 5)) {
        edgeHit = true;
        break;
      }
    }

    if (edgeHit) {
      alienDir *= -1;
      for (const a of aliens) {
        if (a.alive) a.y += 12;
      }
    } else {
      for (const a of aliens) {
        if (a.alive) a.x += alienSpeed * alienDir * 8;
      }
    }
  }

  // Alien shooting
  alienShootTimer++;
  if (alienShootTimer >= alienShootInterval) {
    alienShootTimer = 0;
    // Find bottom-most alive alien in each column
    const bottomAliens = [];
    for (let c = 0; c < ALIEN_COLS; c++) {
      let bottom = null;
      for (const a of aliens) {
        if (a.alive && a.col === c) {
          if (!bottom || a.row > bottom.row) bottom = a;
        }
      }
      if (bottom) bottomAliens.push(bottom);
    }
    if (bottomAliens.length > 0) {
      const shooter = bottomAliens[Math.floor(Math.random() * bottomAliens.length)];
      alienBullets.push({
        x: shooter.x + ALIEN_W / 2,
        y: shooter.y + ALIEN_H,
      });
    }
  }

  // Alien bullets
  for (let i = alienBullets.length - 1; i >= 0; i--) {
    alienBullets[i].y += ALIEN_BULLET_SPEED;
    if (alienBullets[i].y > BASE_H) {
      alienBullets.splice(i, 1);
    }
  }

  // Collision: player bullets vs aliens
  for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
    const b = playerBullets[bi];
    for (const a of aliens) {
      if (!a.alive) continue;
      if (b.x > a.x && b.x < a.x + ALIEN_W &&
          b.y > a.y && b.y < a.y + ALIEN_H) {
        a.alive = false;
        playerBullets.splice(bi, 1);
        score += ALIEN_POINTS[a.type];
        explosions.push({
          x: a.x + ALIEN_W / 2,
          y: a.y + ALIEN_H / 2,
          life: 15,
          maxLife: 15,
        });
        updateHUD();

        // Speed up as fewer aliens remain
        const aliveCount = aliens.filter(al => al.alive).length;
        if (aliveCount > 0) {
          const ratio = 1 - (aliveCount / (ALIEN_ROWS * ALIEN_COLS));
          alienSpeed = alienBaseSpeed + ratio * 2.5;
          alienMoveInterval = Math.max(
            Math.floor(40 - ratio * 28 - (wave - 1) * 3),
            6
          );
        }
        break;
      }
    }
  }

  // Collision: alien bullets vs player
  for (let i = alienBullets.length - 1; i >= 0; i--) {
    const b = alienBullets[i];
    if (b.x > playerX - PLAYER_W / 2 && b.x < playerX + PLAYER_W / 2 &&
        b.y > playerY - PLAYER_H / 2 && b.y < playerY + PLAYER_H / 2 + 8) {
      alienBullets.splice(i, 1);
      lives--;
      updateHUD();
      explosions.push({
        x: playerX,
        y: playerY,
        life: 20,
        maxLife: 20,
      });
      if (lives <= 0) {
        gameOver();
        return;
      }
    }
  }

  // Collision: aliens reaching player row
  for (const a of aliens) {
    if (a.alive && a.y + ALIEN_H >= playerY - PLAYER_H) {
      gameOver();
      return;
    }
  }

  // Check wave clear
  const aliveCount = aliens.filter(a => a.alive).length;
  if (aliveCount === 0) {
    nextWave();
  }

  // Update explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].life--;
    if (explosions[i].life <= 0) explosions.splice(i, 1);
  }
}

async function gameOver() {
  state = 'gameover';
  overlayIcon.innerHTML = '&#128128;';
  overlayTitle.textContent = 'Fim de Jogo';
  overlayMsg.textContent = `Onda ${wave} alcancada`;
  overlayScore.textContent = `Pontuacao: ${score}`;
  btnStart.textContent = 'Jogar de Novo';
  overlay.classList.remove('hidden');

  // Save stats to Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('game_stats').insert({
        user_id: user.id,
        game: 'spaceinvaders',
        result: 'end',
        moves: score,
        score: score,
      });
    }
  } catch (e) {
    // silent
  }
}

// ===== RENDER =====
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars();

  if (state !== 'playing') return;

  // Aliens
  for (const a of aliens) {
    if (a.alive) drawAlien(a);
  }

  // Player
  drawPlayer();

  // Player bullets
  for (const b of playerBullets) {
    drawBullet(b, '#4fc3f7');
  }

  // Alien bullets
  for (const b of alienBullets) {
    drawBullet(b, '#ff5252');
  }

  // Explosions
  drawExplosions();

  // Pausa overlay
  if (paused) {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, BASE_W, BASE_H);
    ctx.fillStyle = '#4fc3f7';
    ctx.font = 'bold 32px Nunito';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSADO', BASE_W / 2, BASE_H / 2 - 15);
    ctx.font = '16px Nunito';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Pressione P para continuar', BASE_W / 2, BASE_H / 2 + 20);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

// ===== GAME LOOP =====
function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

// ===== INPUT: KEYBOARD =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (state === 'playing') { paused = !paused; e.preventDefault(); return; }
  }
  keys[e.key] = true;
  if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
  }
});
document.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// ===== INPUT: MOBILE BUTTONS =====
const ctrlBtns = document.querySelectorAll('.ctrl-btn');
ctrlBtns.forEach(btn => {
  const dir = btn.dataset.dir;

  const onDown = (e) => {
    e.preventDefault();
    if (dir === 'left') mobileLeft = true;
    else if (dir === 'right') mobileRight = true;
    else if (dir === 'shoot') mobileShoot = true;
  };
  const onUp = (e) => {
    e.preventDefault();
    if (dir === 'left') mobileLeft = false;
    else if (dir === 'right') mobileRight = false;
    else if (dir === 'shoot') mobileShoot = false;
  };

  btn.addEventListener('touchstart', onDown, { passive: false });
  btn.addEventListener('touchend', onUp, { passive: false });
  btn.addEventListener('touchcancel', onUp, { passive: false });
  btn.addEventListener('mousedown', onDown);
  btn.addEventListener('mouseup', onUp);
  btn.addEventListener('mouseleave', onUp);
});

// ===== START BUTTON =====
btnStart.addEventListener('click', () => {
  startGame();
});

// Allow spacebar/Enter to start
document.addEventListener('keydown', (e) => {
  if (state !== 'playing' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    startGame();
  }
});

// ===== INIT =====
gameLoop();
