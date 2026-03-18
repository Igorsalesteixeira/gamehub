import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
// ===== Dino Runner =====
import { supabase } from '../../supabase.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const bestDisplay = document.getElementById('best-display');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const overlayIcon = document.getElementById('overlay-icon');
const btnStart = document.getElementById('btn-start');

const W = 800, H = 300;
canvas.width = W;
canvas.height = H;

// ===== CONSTANTES =====
const GROUND_Y = H - 40;
const DINO_W = 40, DINO_H = 50;
const DINO_DUCK_H = 28;
const DINO_X = 60;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const INITIAL_SPEED = 5;
const MAX_SPEED = 14;
const SPEED_INCREMENT = 0.001;

// ===== ESTADO =====
let dino, obstacles, clouds, score, bestScore, speed, gameState, animId, frameCount;
let isDucking = false;
let paused = false;
let shakeFrames = 0;      // screen shake ao morrer
let obstaclesCrossed = 0; // contador para combo
let comboPopup = null;    // { text, x, y, alpha, frame }

bestScore = parseInt(localStorage.getItem('dino_best') || '0');
bestDisplay.textContent = bestScore;

// ===== CLASSES =====
function createDino() {
  return {
    x: DINO_X,
    y: GROUND_Y - DINO_H,
    w: DINO_W,
    h: DINO_H,
    vy: 0,
    grounded: true,
    legFrame: 0
  };
}

function createCactus(x) {
  const types = [
    { w: 16, h: 35 },
    { w: 24, h: 45 },
    { w: 14, h: 28 },
    { w: 30, h: 40 },
    { w: 20, h: 50 },
  ];
  const t = types[Math.floor(Math.random() * types.length)];
  return { x, y: GROUND_Y - t.h, w: t.w, h: t.h, type: 'cactus' };
}

function createPterodactyl(x) {
  const flyH = GROUND_Y - 70 - Math.random() * 50;
  return { x, y: flyH, w: 40, h: 24, type: 'ptero', wingFrame: 0 };
}

function createCloud() {
  return {
    x: W + Math.random() * 200,
    y: 20 + Math.random() * 80,
    w: 60 + Math.random() * 40,
    speed: 0.5 + Math.random() * 0.5
  };
}

// ===== INIT =====
function init() {
  dino = createDino();
  obstacles = [];
  clouds = [];
  score = 0;
  speed = INITIAL_SPEED;
  frameCount = 0;
  isDucking = false;
  shakeFrames = 0;
  obstaclesCrossed = 0;
  comboPopup = null;
  scoreDisplay.textContent = '0';

  // Nuvens iniciais
  for (let i = 0; i < 3; i++) {
    const c = createCloud();
    c.x = Math.random() * W;
    clouds.push(c);
  }

  gameState = 'waiting';
  showOverlay('Dino Runner', 'Espaco/Toque para pular\nSeta baixo para abaixar', '', 'Jogar');
}

function showOverlay(title, msg, scoreTxt, btnTxt) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlayScore.textContent = scoreTxt;
  btnStart.textContent = btnTxt;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function startGame() {
  hideOverlay();
  gameState = 'playing';
  if (animId) cancelAnimationFrame(animId);
  loop();
}

// ===== UPDATE =====
function update() {
  if (gameState !== 'playing') return;

  frameCount++;
  score = Math.floor(frameCount / 3);
  scoreDisplay.textContent = score;

  // Velocidade aumenta
  speed = Math.min(MAX_SPEED, INITIAL_SPEED + frameCount * SPEED_INCREMENT);

  // Dino physics
  if (isDucking && dino.grounded) {
    dino.h = DINO_DUCK_H;
    dino.y = GROUND_Y - DINO_DUCK_H;
  } else if (!isDucking && dino.grounded) {
    dino.h = DINO_H;
    dino.y = GROUND_Y - DINO_H;
  }

  if (!dino.grounded) {
    dino.vy += GRAVITY;
    dino.y += dino.vy;
    if (dino.y >= GROUND_Y - dino.h) {
      dino.y = GROUND_Y - dino.h;
      dino.vy = 0;
      dino.grounded = true;
    }
  }

  dino.legFrame++;

  // Spawn obstacles
  const minDist = 250 + Math.random() * 200;
  const lastObs = obstacles[obstacles.length - 1];
  if (!lastObs || lastObs.x < W - minDist) {
    if (score > 100 && Math.random() < 0.2) {
      obstacles.push(createPterodactyl(W + 50));
    } else {
      obstacles.push(createCactus(W + 50));
      // Chance de grupo duplo
      if (Math.random() < 0.3) {
        obstacles.push(createCactus(W + 50 + 25));
      }
    }
  }

  // Move obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= speed;
    if (obstacles[i].type === 'ptero') {
      obstacles[i].wingFrame++;
    }
    // Detecta obstáculo ultrapassado para combo
    if (!obstacles[i].passed && obstacles[i].x + obstacles[i].w < dino.x) {
      obstacles[i].passed = true;
      obstaclesCrossed++;
      if (obstaclesCrossed > 0 && obstaclesCrossed % 5 === 0) {
        comboPopup = { text: `🔥 ${obstaclesCrossed} seguidos!`, x: W / 2, y: H / 2 - 40, alpha: 1, frame: 0 };
      }
    }
    if (obstacles[i].x + obstacles[i].w < -20) {
      obstacles.splice(i, 1);
    }
  }

  // Spawn/move clouds
  if (Math.random() < 0.005) clouds.push(createCloud());
  for (let i = clouds.length - 1; i >= 0; i--) {
    clouds[i].x -= clouds[i].speed;
    if (clouds[i].x + clouds[i].w < -10) clouds.splice(i, 1);
  }

  // Collision (com margem de tolerancia)
  const margin = 6;
  const dx = dino.x + margin;
  const dy = dino.y + margin;
  const dw = dino.w - margin * 2;
  const dh = dino.h - margin * 2;

  for (const obs of obstacles) {
    const ox = obs.x + 2;
    const oy = obs.y + 2;
    const ow = obs.w - 4;
    const oh = obs.h - 4;

    if (dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy) {
      die();
      return;
    }
  }
}

function die() {
  gameState = 'dead';
  shakeFrames = 14;
  obstaclesCrossed = 0;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('dino_best', bestScore);
    bestDisplay.textContent = bestScore;
    launchConfetti();
    playSound('win');
  }
  saveGameStat();
  showOverlay('Fim de Jogo!', `Pontos: ${score}`, score === bestScore ? 'Novo recorde!' : `Melhor: ${bestScore}`, 'Jogar Novamente');
  overlayIcon.textContent = '\u{1F4A5}';
}

// ===== DRAW =====
function draw() {
  ctx.save();
  // Screen shake ao morrer
  if (shakeFrames > 0) {
    const intensity = shakeFrames * 0.4;
    ctx.translate((Math.random() - 0.5) * intensity * 2, (Math.random() - 0.5) * intensity);
    shakeFrames--;
  }

  // Ceu
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a3e');
  grad.addColorStop(1, '#0f3460');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Estrelas (efeito noturno)
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 20; i++) {
    const sx = (i * 137 + frameCount * 0.1) % W;
    const sy = (i * 89) % (GROUND_Y - 40);
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }

  // Nuvens
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (const c of clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x + c.w / 2, c.y, c.w / 2, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(c.x + c.w * 0.3, c.y - 5, c.w * 0.3, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Chao
  ctx.fillStyle = '#2d5a27';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = '#3a7d32';
  ctx.fillRect(0, GROUND_Y, W, 3);

  // Linhas do chao (decoracao que se move)
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < 20; i++) {
    const gx = ((i * 60) - (frameCount * speed * 0.5) % (W + 60) + W) % (W + 60) - 30;
    ctx.fillRect(gx, GROUND_Y + 8, 20, 2);
  }

  // Obstaculos
  for (const obs of obstacles) {
    if (obs.type === 'cactus') {
      drawCactus(obs);
    } else {
      drawPtero(obs);
    }
  }

  // Dino
  drawDino();

  // Score no canvas
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 18px Nunito';
  ctx.textAlign = 'right';
  ctx.fillText(`${String(score).padStart(5, '0')}`, W - 15, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '14px Nunito';
  ctx.fillText(`HI ${String(bestScore).padStart(5, '0')}`, W - 15, 50);
  ctx.textAlign = 'left';

  // Flash a cada 100 pontos
  if (score > 0 && score % 100 === 0 && frameCount % 3 < 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, W, H);
  }

  // Combo popup flutuante
  if (comboPopup) {
    comboPopup.frame++;
    comboPopup.y -= 0.8;
    comboPopup.alpha = Math.max(0, 1 - comboPopup.frame / 55);
    ctx.save();
    ctx.globalAlpha = comboPopup.alpha;
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 22px Nunito';
    ctx.textAlign = 'center';
    ctx.fillText(comboPopup.text, comboPopup.x, comboPopup.y);
    ctx.textAlign = 'left';
    ctx.restore();
    if (comboPopup.frame > 55) comboPopup = null;
  }

  ctx.restore(); // fecha o save do screen shake

  // Pausa overlay
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Nunito';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSADO', W / 2, H / 2 - 10);
    ctx.font = '14px Nunito';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Pressione P para continuar', W / 2, H / 2 + 20);
    ctx.textAlign = 'left';
  }
}

function drawDino() {
  const d = dino;
  const ducking = isDucking && d.grounded;
  const legCycle = Math.floor(d.legFrame / 6) % 2;

  ctx.fillStyle = '#4ade80';

  if (ducking) {
    // Corpo abaixado (mais largo e baixo)
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(d.x, d.y + 4, d.w + 10, d.h - 8);
    // Cabeca
    ctx.fillRect(d.x + d.w, d.y, 16, 14);
    // Olho
    ctx.fillStyle = '#fff';
    ctx.fillRect(d.x + d.w + 8, d.y + 3, 5, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(d.x + d.w + 10, d.y + 4, 3, 3);
    // Pernas curtas
    ctx.fillStyle = '#4ade80';
    if (legCycle === 0) {
      ctx.fillRect(d.x + 6, d.y + d.h - 4, 8, 8);
      ctx.fillRect(d.x + 24, d.y + d.h - 4, 8, 8);
    } else {
      ctx.fillRect(d.x + 10, d.y + d.h - 4, 8, 8);
      ctx.fillRect(d.x + 28, d.y + d.h - 4, 8, 8);
    }
  } else {
    // Corpo
    ctx.fillRect(d.x + 5, d.y + 16, d.w - 10, d.h - 28);
    // Peito mais largo
    ctx.fillRect(d.x, d.y + 20, d.w, d.h - 36);
    // Cabeca
    ctx.fillRect(d.x + 8, d.y, 28, 20);
    // Olho
    ctx.fillStyle = '#fff';
    ctx.fillRect(d.x + 26, d.y + 4, 6, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(d.x + 28, d.y + 5, 4, 4);

    // Bracinhos
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(d.x + d.w - 4, d.y + 22, 8, 4);

    // Cauda
    ctx.fillRect(d.x - 6, d.y + 18, 10, 6);

    // Pernas
    if (d.grounded) {
      if (legCycle === 0) {
        ctx.fillRect(d.x + 6, d.y + d.h - 12, 8, 14);
        ctx.fillRect(d.x + 22, d.y + d.h - 8, 8, 10);
      } else {
        ctx.fillRect(d.x + 6, d.y + d.h - 8, 8, 10);
        ctx.fillRect(d.x + 22, d.y + d.h - 12, 8, 14);
      }
    } else {
      // No ar — pernas juntas
      ctx.fillRect(d.x + 8, d.y + d.h - 10, 8, 12);
      ctx.fillRect(d.x + 20, d.y + d.h - 10, 8, 12);
    }
  }
}

function drawCactus(obs) {
  ctx.fillStyle = '#22c55e';
  // Tronco
  ctx.fillRect(obs.x + obs.w / 2 - 4, obs.y, 8, obs.h);
  // Bracos do cacto
  if (obs.w > 20) {
    ctx.fillRect(obs.x, obs.y + obs.h * 0.3, obs.w, 6);
    ctx.fillRect(obs.x, obs.y + obs.h * 0.3 - 10, 6, 12);
    ctx.fillRect(obs.x + obs.w - 6, obs.y + obs.h * 0.3 - 10, 6, 12);
  }
  // Topo
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(obs.x + obs.w / 2 - 5, obs.y, 10, 4);
}

function drawPtero(obs) {
  const wingUp = Math.floor(obs.wingFrame / 10) % 2 === 0;
  ctx.fillStyle = '#c084fc';
  // Corpo
  ctx.fillRect(obs.x + 5, obs.y + 8, obs.w - 10, 10);
  // Cabeca
  ctx.fillRect(obs.x + obs.w - 8, obs.y + 6, 12, 8);
  // Bico
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(obs.x + obs.w + 2, obs.y + 8, 6, 4);
  // Asas
  ctx.fillStyle = '#a855f7';
  if (wingUp) {
    ctx.fillRect(obs.x + 8, obs.y - 6, obs.w - 16, 8);
  } else {
    ctx.fillRect(obs.x + 8, obs.y + 16, obs.w - 16, 8);
  }
  // Olho
  ctx.fillStyle = '#fff';
  ctx.fillRect(obs.x + obs.w - 4, obs.y + 8, 3, 3);
}

function loop() {
  if (!paused) update();
  draw();
  animId = requestAnimationFrame(loop);
}

// ===== INPUT =====
function jump() {
  if (gameState === 'dead') return;
  if (gameState === 'waiting') {
    startGame();
    return;
  }
  if (dino.grounded) {
    dino.vy = JUMP_FORCE;
    dino.grounded = false;
    isDucking = false;
    dino.h = DINO_H;
  }
}

function duckStart() {
  if (gameState !== 'playing') return;
  isDucking = true;
  // Se no ar, descer mais rapido
  if (!dino.grounded) {
    dino.vy += 4;
  }
}

function duckEnd() {
  isDucking = false;
  if (dino.grounded) {
    dino.h = DINO_H;
    dino.y = GROUND_Y - DINO_H;
  }
}

// Teclado
document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (gameState === 'playing') { paused = !paused; e.preventDefault(); return; }
  }
  if (paused) return;
  if (e.key === ' ' || e.key === 'ArrowUp') {
    e.preventDefault();
    jump();
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    duckStart();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowDown') {
    duckEnd();
  }
});

// Canvas touch/click — pulo
canvas.addEventListener('click', (e) => {
  jump();
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  jump();
}, { passive: false });

// Botao overlay
btnStart.addEventListener('click', (e) => {
  e.stopPropagation();
  if (gameState === 'waiting') {
    startGame();
  } else if (gameState === 'dead') {
    overlayIcon.textContent = '\u{1F995}';
    init();
    startGame();
  }
});

// Mobile buttons
const mobileControls = document.getElementById('mobile-controls');
mobileControls.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const action = e.target.dataset.action;
  if (action === 'jump') jump();
  if (action === 'duck') duckStart();
}, { passive: false });

mobileControls.addEventListener('touchend', (e) => {
  e.preventDefault();
  const action = e.target.dataset.action;
  if (action === 'duck') duckEnd();
}, { passive: false });

mobileControls.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (action === 'jump') jump();
});

// ===== SUPABASE STATS =====
async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'dinorunner',
      result: 'end',
      moves: score,
      time_seconds: 0,
      score: score,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// ===== START =====
init();
loop();
