import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, haptic } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameLoop } from '../shared/game-loop.js';
import { InputManager } from '../shared/input-manager.js';
import { supabase } from '../../supabase.js';

// ===== DOM Elements =====
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const bestDisplay = document.getElementById('best-display');
const startOverlay = document.getElementById('start-overlay');
const startMsg = document.getElementById('start-msg');
const scoreDisplay = document.getElementById('score-display');
const pauseBtn = document.getElementById('pause-btn');
const pauseModal = document.getElementById('pause-modal');
const resumeBtn = document.getElementById('resume-btn');
const restartBtnPause = document.getElementById('restart-btn-pause');
const gameOverModal = document.getElementById('game-over-modal');
const finalScore = document.getElementById('final-score');
const newRecordEl = document.getElementById('new-record');

// ===== Canvas Size (Responsive) =====
let W = 400, H = 600;
const GROUND_HEIGHT = 60;

function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();

  // Aspect ratio: 2:3 (width:height)
  const aspectRatio = 2 / 3;

  let newWidth = Math.min(rect.width, 400);
  let newHeight = newWidth / aspectRatio;

  // Limit by container height
  const maxHeight = rect.height - 20;
  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = newHeight * aspectRatio;
  }

  W = Math.floor(newWidth);
  H = Math.floor(newHeight);

  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
}

// ===== Game Constants =====
const GRAVITY = 0.35;
const FLAP = -6.5;
const PIPE_WIDTH = 52;
const PIPE_GAP = 140;
const PIPE_SPEED = 2.2;
const BIRD_SIZE = 26;

// ===== Game State =====
let bird = null;
let pipes = [];
let score = 0;
let bestScore = 0;
let gameState = 'waiting'; // waiting, playing, paused, dead
let wingPhase = 0;
let shakeFrames = 0;
let groundOffset = 0;

// ===== Stats =====
const gameStats = new GameStats('flappybird', { autoSync: true });

// ===== Initialize =====
function init() {
  bird = { x: W * 0.2, y: H / 2, vy: 0, rotation: 0 };
  pipes = [];
  score = 0;
  wingPhase = 0;
  shakeFrames = 0;
  groundOffset = 0;
  gameState = 'waiting';

  // Update UI
  scoreDisplay.textContent = '0';
  startOverlay.classList.remove('hidden');
  startMsg.classList.remove('hidden');
  pauseBtn.classList.add('hidden');
  pauseModal.classList.remove('show');
  gameOverModal.classList.remove('show');

  gameLoop.start();
}

// ===== Flap Action =====
function flap() {
  if (gameState === 'waiting') {
    gameState = 'playing';
    startOverlay.classList.add('hidden');
    startMsg.classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    initAudio();
  }

  if (gameState === 'paused') {
    resumeGame();
    return;
  }

  if (gameState === 'dead') {
    init();
    return;
  }

  if (gameState !== 'playing') return;

  bird.vy = FLAP;
  playSound('jump');
  haptic(15);
}

// ===== Pause/Resume =====
function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  gameLoop.pause();
  pauseModal.classList.add('show');
}

function resumeGame() {
  if (gameState !== 'paused') return;
  gameState = 'playing';
  pauseModal.classList.remove('show');
  gameLoop.start();
}

function restartGame() {
  pauseModal.classList.remove('show');
  gameOverModal.classList.remove('show');
  init();
}

// ===== Pipe Generation =====
function spawnPipe() {
  const minY = 80;
  const maxY = H - GROUND_HEIGHT - PIPE_GAP - 80;
  const topH = minY + Math.random() * (maxY - minY);
  pipes.push({ x: W, topH, scored: false });
}

// ===== Update Game =====
function update(dt) {
  if (gameState !== 'playing') return;

  // Ground animation
  groundOffset = (groundOffset + PIPE_SPEED) % 24;

  // Bird physics
  bird.vy += GRAVITY;
  bird.y += bird.vy;
  bird.rotation = Math.min(bird.vy * 3, 90);

  // Wing animation
  wingPhase += 0.2;
  if (wingPhase > Math.PI * 2) wingPhase -= Math.PI * 2;

  // Spawn pipes
  if (pipes.length === 0 || pipes[pipes.length - 1].x < W - 200) {
    spawnPipe();
  }

  // Update pipes
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= PIPE_SPEED;

    // Score
    if (!pipes[i].scored && pipes[i].x + PIPE_WIDTH < bird.x) {
      pipes[i].scored = true;
      score++;
      scoreDisplay.textContent = score;
      haptic(10);
    }

    // Remove offscreen
    if (pipes[i].x + PIPE_WIDTH < -10) {
      pipes.splice(i, 1);
    }
  }

  // Collision - ground/ceiling
  if (bird.y + BIRD_SIZE > H - GROUND_HEIGHT || bird.y < 0) {
    die();
    return;
  }

  // Collision - pipes
  for (const pipe of pipes) {
    if (bird.x + BIRD_SIZE * 0.7 > pipe.x && bird.x + BIRD_SIZE * 0.3 < pipe.x + PIPE_WIDTH) {
      if (bird.y + BIRD_SIZE * 0.2 < pipe.topH || bird.y + BIRD_SIZE * 0.8 > pipe.topH + PIPE_GAP) {
        die();
        return;
      }
    }
  }
}

// ===== Death =====
function die() {
  gameState = 'dead';
  gameLoop.pause();
  shakeFrames = 10;
  haptic([40, 20, 60]);
  playSound('error');

  // Save stats
  const isNewRecord = score > bestScore;
  gameStats.recordGame(isNewRecord, { score });

  if (isNewRecord) {
    bestScore = score;
    localStorage.setItem('flappy_best', bestScore);
    bestDisplay.textContent = bestScore;
    launchConfetti();
    playSound('win');
  } else {
    playSound('gameover');
  }

  // Show game over
  finalScore.textContent = score;
  newRecordEl.style.display = isNewRecord ? 'block' : 'none';
  pauseBtn.classList.add('hidden');

  setTimeout(() => {
    gameOverModal.classList.add('show');
  }, 300);

  saveGameStat();
}

// ===== Draw =====
function draw() {
  ctx.save();

  // Screen shake
  if (shakeFrames > 0) {
    const intensity = shakeFrames * 0.6;
    ctx.translate(
      (Math.random() - 0.5) * intensity * 2,
      (Math.random() - 0.5) * intensity * 2
    );
    shakeFrames--;
  }

  // Sky gradient
  const skyGradient = ctx.createLinearGradient(0, 0, 0, H);
  skyGradient.addColorStop(0, '#4dc9db');
  skyGradient.addColorStop(0.5, '#70c5ce');
  skyGradient.addColorStop(1, '#87d4df');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, W, H);

  // Clouds (decorative)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  drawCloud(W * 0.15, H * 0.15, 30);
  drawCloud(W * 0.6, H * 0.08, 25);
  drawCloud(W * 0.85, H * 0.22, 20);

  // Pipes
  for (const pipe of pipes) {
    drawPipe(pipe);
  }

  // Ground
  drawGround();

  // Bird
  drawBird();

  ctx.restore();
}

// ===== Draw Cloud =====
function drawCloud(x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
  ctx.arc(x + size * 0.8, y, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

// ===== Draw Pipe =====
function drawPipe(pipe) {
  const bottomY = pipe.topH + PIPE_GAP;
  const bottomH = H - GROUND_HEIGHT - bottomY;

  // Pipe gradient
  const pipeGradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
  pipeGradient.addColorStop(0, '#5db347');
  pipeGradient.addColorStop(0.3, '#73bf2e');
  pipeGradient.addColorStop(0.7, '#73bf2e');
  pipeGradient.addColorStop(1, '#5aa842');

  // Top pipe body
  ctx.fillStyle = pipeGradient;
  ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topH - 20);

  // Top pipe cap
  ctx.fillStyle = '#73bf2e';
  ctx.fillRect(pipe.x - 3, pipe.topH - 20, PIPE_WIDTH + 6, 20);
  ctx.strokeStyle = '#3d7a22';
  ctx.lineWidth = 2;
  ctx.strokeRect(pipe.x - 3, pipe.topH - 20, PIPE_WIDTH + 6, 20);

  // Top pipe highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(pipe.x + 4, 0, 8, pipe.topH - 20);

  // Bottom pipe body
  ctx.fillStyle = pipeGradient;
  ctx.fillRect(pipe.x, bottomY + 20, PIPE_WIDTH, bottomH - 20);

  // Bottom pipe cap
  ctx.fillStyle = '#73bf2e';
  ctx.fillRect(pipe.x - 3, bottomY, PIPE_WIDTH + 6, 20);
  ctx.strokeStyle = '#3d7a22';
  ctx.strokeRect(pipe.x - 3, bottomY, PIPE_WIDTH + 6, 20);

  // Bottom pipe highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(pipe.x + 4, bottomY + 20, 8, bottomH - 20);

  // Top pipe outline
  ctx.strokeStyle = '#3d7a22';
  ctx.lineWidth = 2;
  ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.topH - 20);
}

// ===== Draw Ground =====
function drawGround() {
  // Dirt
  ctx.fillStyle = '#deb887';
  ctx.fillRect(0, H - GROUND_HEIGHT, W, GROUND_HEIGHT);

  // Grass
  const grassGradient = ctx.createLinearGradient(0, H - GROUND_HEIGHT, 0, H - GROUND_HEIGHT + 15);
  grassGradient.addColorStop(0, '#5db347');
  grassGradient.addColorStop(1, '#4a9939');
  ctx.fillStyle = grassGradient;
  ctx.fillRect(0, H - GROUND_HEIGHT, W, 15);

  // Grass detail lines
  ctx.strokeStyle = '#4a9939';
  ctx.lineWidth = 1;
  for (let i = 0; i < W + 24; i += 24) {
    const x = (i - groundOffset) % W;
    ctx.beginPath();
    ctx.moveTo(x, H - GROUND_HEIGHT);
    ctx.lineTo(x + 12, H - GROUND_HEIGHT + 15);
    ctx.stroke();
  }

  // Ground line
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H - GROUND_HEIGHT);
  ctx.lineTo(W, H - GROUND_HEIGHT);
  ctx.stroke();
}

// ===== Draw Bird =====
function drawBird() {
  ctx.save();
  ctx.translate(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2);
  ctx.rotate((bird.rotation * Math.PI) / 180);

  const wingOffset = Math.sin(wingPhase) * 4;

  // Wing (behind body)
  ctx.fillStyle = '#e6a800';
  ctx.beginPath();
  ctx.ellipse(-4, wingOffset, 10, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c48a00';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Body
  const bodyGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, BIRD_SIZE / 2);
  bodyGradient.addColorStop(0, '#ffe066');
  bodyGradient.addColorStop(0.7, '#f9c22e');
  bodyGradient.addColorStop(1, '#e6a800');
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c48a00';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Eye white
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pupil
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(8, -4, 3, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -6, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = '#e85d2a';
  ctx.beginPath();
  ctx.moveTo(BIRD_SIZE / 2 - 4, -2);
  ctx.lineTo(BIRD_SIZE / 2 + 10, 0);
  ctx.lineTo(BIRD_SIZE / 2 - 4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c44a1e';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Belly highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.ellipse(-2, 4, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ===== Game Loop =====
const gameLoop = new GameLoop({
  update,
  render: draw,
  fps: 60
});

// ===== Input Manager =====
const inputManager = new InputManager({
  keyboardTarget: document,
  touchTarget: canvas
});

inputManager.on('tap', () => {
  if (gameState === 'paused') {
    // Don't flap when paused - let modal buttons handle it
    return;
  }
  flap();
});

inputManager.on('keyPress', (key) => {
  if (key === ' ' || key === 'ArrowUp') {
    if (gameState === 'paused') return;
    flap();
  }
  if (key === 'Escape' || key === 'p' || key === 'P') {
    if (gameState === 'playing') {
      pauseGame();
    } else if (gameState === 'paused') {
      resumeGame();
    }
  }
});

// ===== Pause Button Events =====
pauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  pauseGame();
});

resumeBtn.addEventListener('click', resumeGame);
restartBtnPause.addEventListener('click', restartGame);

// ===== Game Over Modal Click =====
gameOverModal.addEventListener('click', () => {
  if (gameState === 'dead') {
    init();
  }
});

// ===== Save Stats =====
async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'flappybird',
      result: 'end',
      moves: score,
      time_seconds: 0,
      score: score,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// ===== Initialize =====
bestScore = parseInt(localStorage.getItem('flappy_best') || '0');
bestDisplay.textContent = bestScore;

// Handle resize
window.addEventListener('resize', () => {
  resizeCanvas();
  if (gameState === 'waiting') {
    // Reset bird position on resize during waiting
    bird.x = W * 0.2;
    bird.y = H / 2;
  }
});

// Initial resize
resizeCanvas();
init();