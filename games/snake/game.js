import '../../auth-check.js';
// =============================================
//  COBRINHA (Snake) — game.js
// =============================================
import { supabase } from '../../supabase.js';
import { launchConfetti, playSound, shareOnWhatsApp, initAudio } from '../shared/game-design-utils.js?v=2';
import { GameStats, GameStorage } from '../shared/game-core.js';
import { GameLoop } from '../shared/game-loop.js';
import { InputManager, createDirectionalInput } from '../shared/input-manager.js';

// ---- Config ----
const GRID_SIZE  = 20;
const BASE_SPEED = 150;
const MIN_SPEED  = 60;

// ---- DOM Elements (initialized in init) ----
let canvas, ctx, overlay, overlayIcon, overlayTitle, overlayMsg, overlayScore, btnStart, scoreDisplay, bestDisplay;

// ---- Stats e Best Score ----
const stats = new GameStats('snake');
const storage = new GameStorage('snake');

function getBestScore() {
  return storage.get('bestScore', 0);
}

function setBestScore(score) {
  storage.set('bestScore', score);
}

function checkAndUpdateBestScore(currentScore) {
  const best = getBestScore();
  if (currentScore > best) {
    setBestScore(currentScore);
    return true;
  }
  return false;
}

// ---- State ----
let snake     = [];
let food      = null;
let score     = 0;
let cellSize  = 0;
let eatRipple = null;
let headTrail = [];

// ---- Visual Effects State ----
let particles = [];
let scorePopups = [];
let foodPulse = 0;
let isDying = false;
let deathAnimationFrame = 0;

// ---- Directional Input ----
const directionalInput = createDirectionalInput({
  onDirectionChange: (dir) => {
    if (navigator.vibrate) navigator.vibrate(8);
  }
});

// ---- Game Loop ----
let tickAccumulator = 0;
let currentSpeed = BASE_SPEED;

const gameLoop = new GameLoop({
  update: (deltaTime) => {
    currentSpeed = Math.max(MIN_SPEED, BASE_SPEED - score * 3);
    tickAccumulator += deltaTime;

    // Update particles and popups every frame
    particles.forEach(p => p.update());
    scorePopups.forEach(sp => sp.update());
    particles = particles.filter(p => p.life > 0);
    scorePopups = scorePopups.filter(sp => sp.life > 0);

    // Update food pulse animation
    foodPulse += 0.1;

    // Handle death animation
    if (isDying) {
      deathAnimationFrame++;
      if (deathAnimationFrame > 30) {
        isDying = false;
      }
      draw();
      return;
    }

    // Game tick based on speed
    while (tickAccumulator >= currentSpeed) {
      tickAccumulator -= currentSpeed;
      tick();
    }

    // Redraw
    draw();
  },
  fps: 60
});

// =============================================
//  PARTICLE SYSTEM
// =============================================
class Particle {
  constructor(x, y, color, speed = 1, size = 1) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size * (0.5 + Math.random() * 0.5);
    this.life = 1.0;
    this.decay = 0.02 + Math.random() * 0.03;
    const angle = Math.random() * Math.PI * 2;
    const velocity = (Math.random() * 2 + 1) * speed;
    this.vx = Math.cos(angle) * velocity;
    this.vy = Math.sin(angle) * velocity;
    this.gravity = 0.1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.life -= this.decay;
    this.size *= 0.98;
  }

  draw(ctx, cs) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x * cs, this.y * cs, this.size * cs * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ScorePopup {
  constructor(x, y, points) {
    this.x = x;
    this.y = y;
    this.points = points;
    this.life = 1.0;
    this.decay = 0.025;
    this.offsetY = 0;
  }

  update() {
    this.life -= this.decay;
    this.offsetY -= 0.03;
  }

  draw(ctx, cs) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = '#53d769';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#53d769';
    ctx.font = `bold ${cs * 0.6}px Nunito`;
    ctx.textAlign = 'center';
    ctx.fillText(`+${this.points}`, this.x * cs + cs / 2, (this.y + this.offsetY) * cs + cs / 2);
    ctx.restore();
  }
}

function createExplosion(x, y, color, count = 12, speed = 1) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color, speed));
  }
}

function createDeathExplosion(snakeSegments) {
  snakeSegments.forEach((seg, i) => {
    const color = i === 0 ? '#53d769' : `rgba(83, 215, 105, ${1 - (i / snakeSegments.length) * 0.4})`;
    createExplosion(seg.x + 0.5, seg.y + 0.5, color, 8, 1.5);
  });
}

// =============================================
//  CANVAS SIZING
// =============================================
function resizeCanvas() {
  const container = canvas.parentElement;
  if (!container) return;

  const containerRect = container.getBoundingClientRect();
  const maxW = Math.max(containerRect.width - 16, 100);
  const maxH = Math.max(containerRect.height - 16, 100);

  const maxCell = Math.floor(Math.min(maxW, maxH) / GRID_SIZE);
  cellSize = Math.max(maxCell, 10);
  const size = cellSize * GRID_SIZE;

  if (size > 0) {
    canvas.width  = size;
    canvas.height = size;
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';
    draw();
  }
}

function ensureCanvasSize() {
  if (canvas.width === 0 || canvas.height === 0) {
    const minSize = 200;
    canvas.width = minSize;
    canvas.height = minSize;
    canvas.style.width = minSize + 'px';
    canvas.style.height = minSize + 'px';
  }
}

// =============================================
//  GAME LOGIC
// =============================================
function initGame() {
  const mid = Math.floor(GRID_SIZE / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  directionalInput.setDirection({ x: 1, y: 0 });
  score     = 0;
  scoreDisplay.textContent = 0;
  eatRipple = null;
  headTrail = [];
  particles = [];
  scorePopups = [];
  foodPulse = 0;
  isDying = false;
  deathAnimationFrame = 0;
  spawnFood();
}

function spawnFood() {
  const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (occupied.has(`${pos.x},${pos.y}`));
  food = pos;
}

function tick() {
  console.log('[Snake] tick() chamado, direção:', directionalInput.getDirection());
  directionalInput.applyDirection();
  const direction = directionalInput.getDirection();

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    triggerDeath();
    return;
  }

  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    triggerDeath();
    return;
  }

  snake.unshift(head);
  headTrail.push({ x: head.x, y: head.y });
  if (headTrail.length > 5) headTrail.shift();

  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreDisplay.textContent = score;
    eatRipple = { x: food.x, y: food.y, frame: 0 };
    createExplosion(food.x + 0.5, food.y + 0.5, '#e94560', 15, 1.2);
    scorePopups.push(new ScorePopup(food.x, food.y, 1));
    playSound('eat');
    if (navigator.vibrate) navigator.vibrate([20, 10, 15]);
    spawnFood();
  } else {
    snake.pop();
  }
}

function startGame() {
  console.log('[Snake] startGame() chamado');
  initAudio();
  initGame();
  overlay.classList.add('hidden');

  const btnShare = document.getElementById('btn-share');
  if (btnShare) btnShare.style.display = 'none';

  // Reseta o acumulador do game loop
  tickAccumulator = 0;

  gameLoop.start();
  console.log('[Snake] Jogo iniciado! isRunning:', gameLoop.isRunning());
  console.log('[Snake] Direção inicial:', directionalInput.getDirection());
}

function togglePause() {
  const paused = gameLoop.toggle();
  draw();
  return paused;
}

function triggerDeath() {
  if (isDying) return;
  isDying = true;
  deathAnimationFrame = 0;
  createDeathExplosion(snake);
  if (navigator.vibrate) navigator.vibrate([50, 30, 80]);

  setTimeout(() => {
    gameOver();
  }, 600);
}

async function gameOver() {
  isDying = false;
  gameLoop.stop();

  // Registra a partida nas estatísticas
  stats.recordGame(false, { score: score });

  if (navigator.vibrate) navigator.vibrate([50, 30, 80]);

  const isNewRecord = checkAndUpdateBestScore(score);
  bestDisplay.textContent = getBestScore();

  if (isNewRecord) {
    launchConfetti();
    playSound('win');
  } else {
    playSound('gameover');
  }

  overlayIcon.textContent  = '💀';
  overlayTitle.textContent = 'Game Over!';
  overlayMsg.textContent   = '';
  overlayScore.textContent = `Pontuação: ${score} 🍎`;
  btnStart.textContent     = 'Jogar Novamente';

  const btnShare = document.getElementById('btn-share');
  if (btnShare) {
    btnShare.style.display = 'inline-block';
    btnShare.onclick = () => {
      shareOnWhatsApp(`🐍 Joguei Cobrinha no Games Hub e fiz ${score} pontos!\n\n🏆 Meu recorde: ${getBestScore()}\n\n🎮 Jogue você também: https://gameshub.com.br/games/snake/`);
    };
  }

  overlay.classList.remove('hidden');
}

// =============================================
//  DRAW
// =============================================
function draw() {
  const cs = cellSize;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.save();
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 4;
  ctx.shadowColor = 'rgba(100, 200, 255, 0.3)';
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cs, 0); ctx.lineTo(i * cs, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cs); ctx.lineTo(canvas.width, i * cs);
    ctx.stroke();
  }
  ctx.restore();

  // Ripple
  if (eatRipple) {
    const p = eatRipple.frame / 14;
    ctx.save();
    ctx.strokeStyle = `rgba(233, 69, 96, ${(1 - p) * 0.8})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10 * (1 - p);
    ctx.shadowColor = '#e94560';
    ctx.beginPath();
    ctx.arc(eatRipple.x * cs + cs / 2, eatRipple.y * cs + cs / 2, cs * 0.4 * (1 + p * 1.5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    eatRipple.frame++;
    if (eatRipple.frame > 14) eatRipple = null;
  }

  // Trail
  headTrail.forEach((pos, i) => {
    const alpha = ((i + 1) / headTrail.length) * 0.18;
    ctx.save();
    ctx.fillStyle = `rgba(83, 215, 105, ${alpha})`;
    ctx.shadowBlur = 6;
    ctx.shadowColor = `rgba(83, 215, 105, ${alpha * 2})`;
    ctx.beginPath();
    ctx.arc(pos.x * cs + cs / 2, pos.y * cs + cs / 2, cs * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Food
  if (food) {
    const pulseScale = 1 + Math.sin(foodPulse) * 0.15;
    const glowIntensity = 15 + Math.sin(foodPulse * 1.5) * 10;

    ctx.save();
    ctx.translate(food.x * cs + cs / 2, food.y * cs + cs / 2);
    ctx.scale(pulseScale, pulseScale);
    ctx.shadowBlur = glowIntensity;
    ctx.shadowColor = '#e94560';
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.arc(0, 0, cs * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6b7a';
    ctx.beginPath();
    ctx.arc(-cs * 0.1, -cs * 0.1, cs * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(food.x * cs + cs * 0.35, food.y * cs + cs * 0.3, cs * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Particles
  particles.forEach(p => p.draw(ctx, cs));
  scorePopups.forEach(sp => sp.draw(ctx, cs));

  // Snake
  if (!isDying) {
    const direction = directionalInput.getDirection();
    snake.forEach((seg, i) => {
      const isHead = i === 0;
      const radius = cs * 0.42;

      ctx.save();
      const fade = 1 - (i / snake.length) * 0.4;
      ctx.shadowBlur = isHead ? 15 : 8 * fade;
      ctx.shadowColor = isHead ? '#53d769' : `rgba(83, 215, 105, ${fade})`;

      if (isHead) {
        const grd = ctx.createRadialGradient(
          seg.x * cs + cs / 2, seg.y * cs + cs / 2, 0,
          seg.x * cs + cs / 2, seg.y * cs + cs / 2, radius
        );
        grd.addColorStop(0, '#6aff7a');
        grd.addColorStop(0.5, '#53d769');
        grd.addColorStop(1, '#3ba851');
        ctx.fillStyle = grd;
      } else {
        const grd = ctx.createRadialGradient(
          seg.x * cs + cs / 2, seg.y * cs + cs / 2, 0,
          seg.x * cs + cs / 2, seg.y * cs + cs / 2, radius
        );
        const alpha = fade;
        grd.addColorStop(0, `rgba(100, 230, 120, ${alpha})`);
        grd.addColorStop(1, `rgba(83, 215, 105, ${alpha})`);
        ctx.fillStyle = grd;
      }

      const x = seg.x * cs + (cs - radius * 2) / 2;
      const y = seg.y * cs + (cs - radius * 2) / 2;
      const w = radius * 2;
      const r = cs * 0.15;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + w - r);
      ctx.quadraticCurveTo(x + w, y + w, x + w - r, y + w);
      ctx.lineTo(x + r, y + w);
      ctx.quadraticCurveTo(x, y + w, x, y + w - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.fill();
      ctx.restore();

      // Eyes
      if (isHead) {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(255,255,255,0.5)';
        const eyeR = cs * 0.08;
        let ex1, ey1, ex2, ey2;
        if (direction.x === 1)       { ex1 = cs*0.65; ey1 = cs*0.3;  ex2 = cs*0.65; ey2 = cs*0.7; }
        else if (direction.x === -1) { ex1 = cs*0.35; ey1 = cs*0.3;  ex2 = cs*0.35; ey2 = cs*0.7; }
        else if (direction.y === -1) { ex1 = cs*0.3;  ey1 = cs*0.35; ex2 = cs*0.7;  ey2 = cs*0.35; }
        else                         { ex1 = cs*0.3;  ey1 = cs*0.65; ex2 = cs*0.7;  ey2 = cs*0.65; }
        ctx.beginPath();
        ctx.arc(seg.x * cs + ex1, seg.y * cs + ey1, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(seg.x * cs + ex2, seg.y * cs + ey2, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  // Pause overlay
  if (gameLoop.isPaused()) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${cs * 1.2}px Nunito`;
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSADO', canvas.width / 2, canvas.height / 2 - cs * 0.3);
    ctx.font = `${cs * 0.55}px Nunito`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Pressione P para continuar', canvas.width / 2, canvas.height / 2 + cs * 0.7);
    ctx.textAlign = 'left';
  }
}

// =============================================
//  CONTROLS
// =============================================
const keyDirectionMap = {
  'ArrowUp': { x: 0, y: -1 }, 'w': { x: 0, y: -1 }, 'W': { x: 0, y: -1 },
  'ArrowDown': { x: 0, y: 1 }, 's': { x: 0, y: 1 }, 'S': { x: 0, y: 1 },
  'ArrowLeft': { x: -1, y: 0 }, 'a': { x: -1, y: 0 }, 'A': { x: -1, y: 0 },
  'ArrowRight': { x: 1, y: 0 }, 'd': { x: 1, y: 0 }, 'D': { x: 1, y: 0 }
};

document.addEventListener('keydown', e => {
  if (!gameLoop.isRunning()) {
    if (e.key === 'Enter' || e.key === ' ') { startGame(); e.preventDefault(); }
    return;
  }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
  if (gameLoop.isPaused()) return;

  const newDir = keyDirectionMap[e.key];
  if (newDir) {
    const currentDir = directionalInput.getDirection();
    // Previne movimento na direção oposta
    if (currentDir.x !== 0 && newDir.x === -currentDir.x) return;
    if (currentDir.y !== 0 && newDir.y === -currentDir.y) return;
    directionalInput.setDirection(newDir);
    e.preventDefault();
  }
});

// Touch swipe - será inicializado em init()
const SWIPE_THRESHOLD = 30;

// Mobile buttons - mapeamento de direções
const directionMap = {
  'up': { x: 0, y: -1 },
  'down': { x: 0, y: 1 },
  'left': { x: -1, y: 0 },
  'right': { x: 1, y: 0 }
};

document.querySelectorAll('.ctrl-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!gameLoop.isRunning()) return;
    const dir = btn.dataset.dir;
    const newDir = directionMap[dir];
    if (newDir) {
      const currentDir = directionalInput.getDirection();
      // Previne movimento na direção oposta
      if (currentDir.x !== 0 && newDir.x === -currentDir.x) return;
      if (currentDir.y !== 0 && newDir.y === -currentDir.y) return;
      directionalInput.setDirection(newDir);
    }
  });
});

// =============================================
//  INIT
// =============================================
function initDOM() {
  canvas       = document.getElementById('game-canvas');
  ctx          = canvas.getContext('2d');
  overlay      = document.getElementById('overlay');
  overlayIcon  = document.getElementById('overlay-icon');
  overlayTitle = document.getElementById('overlay-title');
  overlayMsg   = document.getElementById('overlay-msg');
  overlayScore = document.getElementById('overlay-score');
  btnStart     = document.getElementById('btn-start');
  scoreDisplay = document.getElementById('score-display');
  bestDisplay  = document.getElementById('best-display');
}

function init() {
  console.log('[Snake] Inicializando...');
  initDOM();
  console.log('[Snake] btnStart:', btnStart);

  // Inicializa touch events no canvas
  if (canvas) {
    canvas.addEventListener('touchstart', e => {
      canvas.dataset.touchStartX = e.touches[0].clientX;
      canvas.dataset.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    canvas.addEventListener('touchmove', e => {
      if (gameLoop.isRunning()) e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      if (!gameLoop.isRunning()) return;
      const startX = parseFloat(canvas.dataset.touchStartX);
      const startY = parseFloat(canvas.dataset.touchStartY);
      if (isNaN(startX) || isNaN(startY)) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

      const swipeMap = {
        'up': { x: 0, y: -1 },
        'down': { x: 0, y: 1 },
        'left': { x: -1, y: 0 },
        'right': { x: 1, y: 0 }
      };

      let dir;
      if (Math.abs(dx) > Math.abs(dy)) {
        dir = dx > 0 ? 'right' : 'left';
      } else {
        dir = dy > 0 ? 'down' : 'up';
      }

      const newDir = swipeMap[dir];
      const currentDir = directionalInput.getDirection();
      // Previne movimento na direção oposta
      if (currentDir.x !== 0 && newDir.x === -currentDir.x) return;
      if (currentDir.y !== 0 && newDir.y === -currentDir.y) return;
      directionalInput.setDirection(newDir);
    }, { passive: true });
  }

  // Inicializa controles mobile
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!gameLoop.isRunning()) return;
      const dir = btn.dataset.dir;
      const newDir = directionMap[dir];
      if (newDir) {
        const currentDir = directionalInput.getDirection();
        // Previne movimento na direção oposta
        if (currentDir.x !== 0 && newDir.x === -currentDir.x) return;
        if (currentDir.y !== 0 && newDir.y === -currentDir.y) return;
        directionalInput.setDirection(newDir);
      }
    });
  });

  if (bestDisplay) bestDisplay.textContent = getBestScore();

  initGame();
  draw();

  if (btnStart) {
    // Remove listeners antigos se existirem
    const newBtn = btnStart.cloneNode(true);
    btnStart.parentNode.replaceChild(newBtn, btnStart);
    btnStart = newBtn;

    btnStart.addEventListener('click', function(e) {
      console.log('[Snake] CLICK no botão!');
      e.preventDefault();
      e.stopPropagation();
      startGame();
    });

    btnStart.addEventListener('touchstart', function(e) {
      console.log('[Snake] TOUCH no botão!');
      e.preventDefault();
      e.stopPropagation();
      startGame();
    }, { passive: false });

    console.log('[Snake] Listeners registrados');
  } else {
    console.error('[Snake] ERRO: btnStart não encontrado!');
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  ensureCanvasSize();
}

// Inicializa quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
