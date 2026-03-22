import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic, initAudio } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameLoop } from '../shared/game-loop.js';
import { InputManager } from '../shared/input-manager.js';
import { supabase } from '../../supabase.js';

// ===== Pong (Redesigned) =====

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');

// Dimensoes base do jogo
const BASE_W = 500;
const BASE_H = 350;
const PADDLE_W = 10;
const PADDLE_H = 60;
const BALL_SIZE = 8;
const WIN_SCORE = 5;

// Dificuldade
const DIFFICULTY_SPEEDS = { easy: 2.2, normal: 3.5, hard: 5.0 };
const DIFFICULTY_ERROR = { easy: 35, normal: 12, hard: 0 };

// Cores neon
const COLORS = {
  bg: '#111118',
  centerLine: '#333',
  playerPaddle: '#ff6b35',
  cpuPaddle: '#4dabf7',
  ball: '#ffffff',
  playerScore: 'rgba(255, 107, 53, 0.6)',
  cpuScore: 'rgba(77, 171, 247, 0.6)',
  glowOrange: 'rgba(255, 107, 53, 0.4)',
  glowCyan: 'rgba(77, 171, 247, 0.4)'
};

let player, cpu, ball, playerScore, cpuScore, gameOverState;
let ballTrail = [];
let cpuTargetError = 12;
let scale = 1;
let W = BASE_W;
let H = BASE_H;

// ===== STATS =====
const gameStats = new GameStats('pong', { autoSync: true });

function getDifficulty() {
  const sel = document.getElementById('difficulty-select');
  return sel ? sel.value : 'normal';
}

// ===== RESPONSIVE CANVAS =====
function resizeCanvas() {
  const container = document.querySelector('.game-container');
  const maxWidth = Math.min(500, window.innerWidth - 16);
  const maxHeight = window.innerHeight - 200; // Espaco para header e controles

  // Manter proporcao
  const ratio = BASE_W / BASE_H;
  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  scale = width / BASE_W;
  W = BASE_W;
  H = BASE_H;

  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function init() {
  initAudio();
  resizeCanvas();

  player = { x: 15, y: H / 2 - PADDLE_H / 2 };
  cpu = { x: W - 15 - PADDLE_W, y: H / 2 - PADDLE_H / 2 };
  playerScore = 0;
  cpuScore = 0;
  gameOverState = false;
  ballTrail = [];
  cpuTargetError = DIFFICULTY_ERROR[getDifficulty()] ?? 12;
  modalOverlay.classList.remove('show');
  resetBall();
  gameLoop.start();
}

function resetBall() {
  ball = {
    x: W / 2,
    y: H / 2,
    vx: (Math.random() > 0.5 ? 1 : -1) * 4,
    vy: (Math.random() - 0.5) * 4,
  };
}

function update(dt) {
  if (gameOverState) return;

  // Player movement (keyboard)
  const keys = inputManager._keys;
  if (keys.get('ArrowUp') || keys.get('w') || keys.get('W')) {
    player.y = Math.max(0, player.y - 5);
  }
  if (keys.get('ArrowDown') || keys.get('s') || keys.get('S')) {
    player.y = Math.min(H - PADDLE_H, player.y + 5);
  }

  // CPU AI com dificuldade ajustavel
  const diff = getDifficulty();
  const cpuSpeed = DIFFICULTY_SPEEDS[diff] ?? 3.5;
  const cpuCenter = cpu.y + PADDLE_H / 2;
  const cpuTarget = ball.y + (ball.vx > 0 ? cpuTargetError : 0);

  if (ball.vx > 0) {
    if (cpuCenter < cpuTarget - 8) cpu.y += cpuSpeed;
    else if (cpuCenter > cpuTarget + 8) cpu.y -= cpuSpeed;
  } else {
    if (cpuCenter < H / 2 - 20) cpu.y += cpuSpeed * 0.5;
    else if (cpuCenter > H / 2 + 20) cpu.y -= cpuSpeed * 0.5;
  }
  cpu.y = Math.max(0, Math.min(H - PADDLE_H, cpu.y));

  // Atualizar trail da bola
  ballTrail.push({ x: ball.x, y: ball.y });
  if (ballTrail.length > 7) ballTrail.shift();

  // Ball movement
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall bounce (top/bottom)
  if (ball.y <= 0 || ball.y >= H - BALL_SIZE) {
    ball.vy *= -1;
    ball.y = Math.max(0, Math.min(H - BALL_SIZE, ball.y));
  }

  // Paddle collision - player
  if (ball.x <= player.x + PADDLE_W && ball.x >= player.x &&
      ball.y + BALL_SIZE >= player.y && ball.y <= player.y + PADDLE_H) {
    ball.vx = Math.abs(ball.vx) * 1.05;
    ball.vy += (ball.y - (player.y + PADDLE_H / 2)) * 0.15;
    ball.x = player.x + PADDLE_W;
    playSound('move');
    haptic(15);
  }

  // Paddle collision - CPU
  if (ball.x + BALL_SIZE >= cpu.x && ball.x + BALL_SIZE <= cpu.x + PADDLE_W &&
      ball.y + BALL_SIZE >= cpu.y && ball.y <= cpu.y + PADDLE_H) {
    ball.vx = -Math.abs(ball.vx) * 1.05;
    ball.vy += (ball.y - (cpu.y + PADDLE_H / 2)) * 0.15;
    ball.x = cpu.x - BALL_SIZE;
    playSound('move');
  }

  // Speed cap
  const maxSpeed = 10;
  ball.vx = Math.max(-maxSpeed, Math.min(maxSpeed, ball.vx));
  ball.vy = Math.max(-maxSpeed, Math.min(maxSpeed, ball.vy));

  // Score
  if (ball.x < -20) {
    cpuScore++;
    playSound('click');
    if (cpuScore >= WIN_SCORE) endGame('cpu');
    else resetBall();
  }
  if (ball.x > W + 20) {
    playerScore++;
    playSound('click');
    if (playerScore >= WIN_SCORE) endGame('player');
    else resetBall();
  }
}

function draw() {
  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Center line
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = COLORS.centerLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Player paddle com glow
  ctx.shadowColor = COLORS.glowOrange;
  ctx.shadowBlur = 15;
  ctx.fillStyle = COLORS.playerPaddle;
  ctx.fillRect(player.x, player.y, PADDLE_W, PADDLE_H);

  // CPU paddle com glow
  ctx.shadowColor = COLORS.glowCyan;
  ctx.fillStyle = COLORS.cpuPaddle;
  ctx.fillRect(cpu.x, cpu.y, PADDLE_W, PADDLE_H);

  ctx.shadowBlur = 0;

  // Ball trail
  ballTrail.forEach((pos, i) => {
    const alpha = (i / ballTrail.length) * 0.4;
    const r = (BALL_SIZE / 2) * ((i + 1) / ballTrail.length);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(pos.x + BALL_SIZE / 2, pos.y + BALL_SIZE / 2, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Ball com glow
  ctx.shadowColor = 'rgba(255,255,255,0.6)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = COLORS.ball;
  ctx.beginPath();
  ctx.arc(ball.x + BALL_SIZE / 2, ball.y + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Scores com melhor contraste
  ctx.font = 'bold 48px Nunito';
  ctx.textAlign = 'center';

  // Player score (laranja)
  ctx.fillStyle = COLORS.playerScore;
  ctx.fillText(playerScore, W / 4, 60);

  // CPU score (ciano)
  ctx.fillStyle = COLORS.cpuScore;
  ctx.fillText(cpuScore, (3 * W) / 4, 60);
}

function endGame(winner) {
  gameOverState = true;
  gameLoop.pause();
  const result = winner === 'player' ? 'win' : 'loss';
  modalTitle.textContent = winner === 'player' ? 'Voce venceu!' : 'Computador venceu!';
  modalMessage.textContent = `${playerScore} x ${cpuScore}`;
  modalOverlay.classList.add('show');

  gameStats.recordGame(winner === 'player', { score: playerScore });

  saveGameStat(result);
  if (winner === 'player') {
    launchConfetti();
    playSound('win');
  }
}

// ===== GAME LOOP =====
const gameLoop = new GameLoop({
  update,
  render: draw,
  fps: 60
});

// ===== INPUT MANAGER =====
const inputManager = new InputManager({
  keyboardTarget: document
});

// Mobile controls
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');

if (btnUp && btnDown) {
  const handleMobileMove = (dir) => {
    if (gameOverState) return;
    if (dir === 'up') {
      player.y = Math.max(0, player.y - 8);
    } else {
      player.y = Math.min(H - PADDLE_H, player.y + 8);
    }
  };

  let mobileInterval;
  const startMobile = (dir) => {
    stopMobile();
    handleMobileMove(dir);
    mobileInterval = setInterval(() => handleMobileMove(dir), 16);
  };
  const stopMobile = () => { clearInterval(mobileInterval); };

  btnUp.addEventListener('touchstart', (e) => { e.preventDefault(); startMobile('up'); }, { passive: false });
  btnUp.addEventListener('touchend', stopMobile);
  btnUp.addEventListener('mousedown', () => startMobile('up'));
  btnUp.addEventListener('mouseup', stopMobile);
  btnUp.addEventListener('mouseleave', stopMobile);

  btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); startMobile('down'); }, { passive: false });
  btnDown.addEventListener('touchend', stopMobile);
  btnDown.addEventListener('mousedown', () => startMobile('down'));
  btnDown.addEventListener('mouseup', stopMobile);
  btnDown.addEventListener('mouseleave', stopMobile);
}

// Touch on canvas - move paddle to touch Y
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleY = H / rect.height;
  const touchY = (e.touches[0].clientY - rect.top) * scaleY;
  player.y = Math.max(0, Math.min(H - PADDLE_H, touchY - PADDLE_H / 2));
}, { passive: false });

// Mouse control - follow mouse Y
canvas.addEventListener('mousemove', (e) => {
  if (gameOverState) return;
  const rect = canvas.getBoundingClientRect();
  const scaleY = H / rect.height;
  const mouseY = (e.clientY - rect.top) * scaleY;
  player.y = Math.max(0, Math.min(H - PADDLE_H, mouseY - PADDLE_H / 2));
});

btnNewGame.addEventListener('click', init);
btnPlayAgain.addEventListener('click', init);

// Resize handler
window.addEventListener('resize', () => {
  resizeCanvas();
});

async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'pong',
      result: result,
      moves: 0,
      time_seconds: 0,
      score: playerScore,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

init();