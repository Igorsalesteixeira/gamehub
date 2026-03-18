import '../../auth-check.js';
// =============================================
//  COBRINHA (Snake) — game.js
// =============================================
import { supabase } from '../../supabase.js';
import { launchConfetti, playSound, shareOnWhatsApp, initAudio } from '../shared/game-design-utils.js?v=2';

// ---- Config ----
const GRID_SIZE  = 20; // cells
const BASE_SPEED = 150; // ms per tick (decreases as score grows)
const MIN_SPEED  = 60;

// ---- DOM ----
const canvas      = document.getElementById('game-canvas');
const ctx         = canvas.getContext('2d');
const overlay     = document.getElementById('overlay');
const overlayIcon = document.getElementById('overlay-icon');
const overlayTitle= document.getElementById('overlay-title');
const overlayMsg  = document.getElementById('overlay-msg');
const overlayScore= document.getElementById('overlay-score');
const btnStart    = document.getElementById('btn-start');
const scoreDisplay= document.getElementById('score-display');
const bestDisplay = document.getElementById('best-display');

// ---- State ----
let snake     = [];
let food      = null;
let direction = { x: 1, y: 0 };
let nextDir   = { x: 1, y: 0 };
let score     = 0;
let bestScore = parseInt(localStorage.getItem('snake_best') || '0');
let gameLoop  = null;
let running   = false;
let paused    = false;
let cellSize  = 0;
let eatRipple = null;   // animação de ondulação ao comer
let headTrail = [];     // rastro de posições recentes da cabeça

bestDisplay.textContent = bestScore;

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

  // Only update if size changed and is valid
  if (size > 0) {
    canvas.width  = size;
    canvas.height = size;
    canvas.style.width  = size + 'px';
    canvas.style.height = size + 'px';
    draw();
  }
}

// Ensure canvas has minimum size on init
function ensureCanvasSize() {
  if (canvas.width === 0 || canvas.height === 0) {
    const minSize = 200;
    canvas.width = minSize;
    canvas.height = minSize;
    canvas.style.width = minSize + 'px';
    canvas.style.height = minSize + 'px';
  }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
ensureCanvasSize();

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
  direction = { x: 1, y: 0 };
  nextDir   = { x: 1, y: 0 };
  score     = 0;
  scoreDisplay.textContent = 0;
  eatRipple = null;
  headTrail = [];
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
  direction = { ...nextDir };
  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  // Wall collision
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
    gameOver();
    return;
  }

  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  // Trail de movimento: guarda as últimas 5 posições da cabeça
  headTrail.push({ x: head.x, y: head.y });
  if (headTrail.length > 5) headTrail.shift();

  // Eat food
  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreDisplay.textContent = score;
    eatRipple = { x: food.x, y: food.y, frame: 0 }; // dispara animação
    // Game Design: som ao comer
    playSound('eat');
    // Mobile: feedback tátil ao comer (vibration)
    if (navigator.vibrate) navigator.vibrate([20, 10, 15]);
    spawnFood();
  } else {
    snake.pop();
  }

  draw();
}

function getSpeed() {
  return Math.max(MIN_SPEED, BASE_SPEED - score * 3);
}

function startGame() {
  initAudio();
  initGame();
  overlay.classList.add('hidden');
  // Game Design: esconder botão compartilhar ao iniciar
  const btnShare = document.getElementById('btn-share');
  if (btnShare) btnShare.style.display = 'none';
  running = true;
  paused = false;
  scheduleNext();
}

function scheduleNext() {
  if (!running) return;
  gameLoop = setTimeout(() => {
    if (!paused) tick();
    scheduleNext();
  }, getSpeed());
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  draw();
}

function gameOver() {
  running = false;
  clearTimeout(gameLoop);

  // Mobile: feedback tátil no game over (padrão de derrota)
  if (navigator.vibrate) navigator.vibrate([50, 30, 80]);

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('snake_best', String(bestScore));
    bestDisplay.textContent = bestScore;
    // Game Design: confetes ao bater recorde
    launchConfetti();
    playSound('win');
  } else {
    playSound('gameover');
  }

  saveGameStat();

  overlayIcon.textContent  = '💀';
  overlayTitle.textContent = 'Game Over!';
  overlayMsg.textContent   = '';
  overlayScore.textContent = `Pontuação: ${score} 🍎`;
  btnStart.textContent     = 'Jogar Novamente';

  // Game Design: mostrar botão compartilhar
  const btnShare = document.getElementById('btn-share');
  if (btnShare) {
    btnShare.style.display = 'inline-block';
    btnShare.onclick = () => {
      shareOnWhatsApp(`🐍 Joguei Cobrinha no Games Hub e fiz ${score} pontos!\n\n🏆 Meu recorde: ${bestScore}\n\n🎮 Jogue você também: https://gameshub.com.br/games/snake/`);
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

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cs, 0); ctx.lineTo(i * cs, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cs); ctx.lineTo(canvas.width, i * cs);
    ctx.stroke();
  }

  // Ripple ao comer
  if (eatRipple) {
    const p = eatRipple.frame / 14;
    ctx.save();
    ctx.strokeStyle = `rgba(233, 69, 96, ${(1 - p) * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(eatRipple.x * cs + cs / 2, eatRipple.y * cs + cs / 2, cs * 0.4 * (1 + p * 1.5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    eatRipple.frame++;
    if (eatRipple.frame > 14) eatRipple = null;
  }

  // Trail de movimento (rastro da cabeça)
  headTrail.forEach((pos, i) => {
    const alpha = ((i + 1) / headTrail.length) * 0.18;
    ctx.fillStyle = `rgba(83, 215, 105, ${alpha})`;
    ctx.beginPath();
    ctx.arc(pos.x * cs + cs / 2, pos.y * cs + cs / 2, cs * 0.28, 0, Math.PI * 2);
    ctx.fill();
  });

  // Food
  if (food) {
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.arc(food.x * cs + cs / 2, food.y * cs + cs / 2, cs * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Apple shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(food.x * cs + cs * 0.38, food.y * cs + cs * 0.35, cs * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Snake
  snake.forEach((seg, i) => {
    const isHead = i === 0;
    const radius = cs * 0.42;

    if (isHead) {
      // Head gradient
      const grd = ctx.createRadialGradient(
        seg.x * cs + cs / 2, seg.y * cs + cs / 2, 0,
        seg.x * cs + cs / 2, seg.y * cs + cs / 2, radius
      );
      grd.addColorStop(0, '#53d769');
      grd.addColorStop(1, '#3ba851');
      ctx.fillStyle = grd;
    } else {
      const fade = 1 - (i / snake.length) * 0.4;
      ctx.fillStyle = `rgba(83, 215, 105, ${fade})`;
    }

    // Rounded rectangle for each segment
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

    // Eyes on head
    if (isHead) {
      ctx.fillStyle = '#fff';
      const eyeR = cs * 0.08;
      const eyeOff = cs * 0.15;
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
    }
  });

  // Pausa overlay
  if (paused) {
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
//  CONTROLS — Keyboard
// =============================================
document.addEventListener('keydown', e => {
  if (!running) {
    if (e.key === 'Enter' || e.key === ' ') { startGame(); e.preventDefault(); }
    return;
  }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
  if (paused) return;
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': if (direction.y !== 1)  nextDir = { x: 0, y:-1 }; break;
    case 'ArrowDown':  case 's': case 'S': if (direction.y !== -1) nextDir = { x: 0, y: 1 }; break;
    case 'ArrowLeft':  case 'a': case 'A': if (direction.x !== 1)  nextDir = { x:-1, y: 0 }; break;
    case 'ArrowRight': case 'd': case 'D': if (direction.x !== -1) nextDir = { x: 1, y: 0 }; break;
  }
  e.preventDefault();
});

// =============================================
//  CONTROLS — Touch swipe (Mobile optimized)
// =============================================
let touchStart = null;
const SWIPE_THRESHOLD = 30; // Mobile: aumentado de 15px para 30px

canvas.addEventListener('touchstart', e => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

canvas.addEventListener('touchmove', e => {
  // Mobile: só previne scroll se o jogo estiver rodando
  if (running) e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  if (!touchStart || !running) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && direction.x !== -1) nextDir = { x: 1, y: 0 };
    else if (dx < 0 && direction.x !== 1) nextDir = { x: -1, y: 0 };
  } else {
    if (dy > 0 && direction.y !== -1) nextDir = { x: 0, y: 1 };
    else if (dy < 0 && direction.y !== 1) nextDir = { x: 0, y: -1 };
  }

  // Mobile: feedback tátil ao mudar direção
  if (navigator.vibrate) navigator.vibrate(8);
}, { passive: true });

// =============================================
//  CONTROLS — Mobile buttons (with haptic feedback)
// =============================================
document.querySelectorAll('.ctrl-btn').forEach(btn => {
  const handler = () => {
    if (!running) return;
    const dir = btn.dataset.dir;
    switch (dir) {
      case 'up':    if (direction.y !== 1)  nextDir = { x: 0, y:-1 }; break;
      case 'down':  if (direction.y !== -1) nextDir = { x: 0, y: 1 }; break;
      case 'left':  if (direction.x !== 1)  nextDir = { x:-1, y: 0 }; break;
      case 'right': if (direction.x !== -1) nextDir = { x: 1, y: 0 }; break;
    }
    // Mobile: feedback tátil nos botões
    if (navigator.vibrate) navigator.vibrate(10);
  };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchstart', e => { e.preventDefault(); handler(); }, { passive: false });
});

// =============================================
//  START BUTTON (registrado na função init)
// =============================================

// =============================================
//  STATS — Supabase
// =============================================
async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'snake',
      result: 'loss', // snake always ends in loss
      moves: score,
      time_seconds: 0,
      score: score,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// =============================================
//  INIT
// =============================================
function init() {
  console.log('[Snake] Inicializando jogo...');

  // Re-seleciona elementos DOM que podem não ter sido carregados
  const btnStartLocal = document.getElementById('btn-start');
  console.log('[Snake] Botão encontrado:', btnStartLocal);

  initGame();
  draw();

  // Registra event listener do botão com debug
  if (btnStartLocal) {
    btnStartLocal.addEventListener('click', (e) => {
      console.log('[Snake] Botão Jogar clicado!');
      e.preventDefault();
      startGame();
    });
    // Touch para iOS
    btnStartLocal.addEventListener('touchstart', (e) => {
      console.log('[Snake] Botão Jogar tocado!');
      e.preventDefault();
      startGame();
    }, { passive: false });
    console.log('[Snake] Event listeners registrados no botão');
  } else {
    console.error('[Snake] ERRO: Botão #btn-start não encontrado no DOM!');
  }
}

// Aguarda DOM estar pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
