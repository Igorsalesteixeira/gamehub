import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic, initAudio } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { GameLoop } from '../shared/game-loop.js';
import { InputManager } from '../shared/input-manager.js';
// ===== Pong (Refatorado) =====
import { supabase } from '../../supabase.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');

const W = 500, H = 350;
canvas.width = W;
canvas.height = H;

const PADDLE_W = 10, PADDLE_H = 60;
const BALL_SIZE = 8;
const WIN_SCORE = 5;
// Dificuldade: easy=2.2, normal=3.5, hard=5
const DIFFICULTY_SPEEDS = { easy: 2.2, normal: 3.5, hard: 5.0 };
// Imprecisão da IA: easy=35px, normal=12px, hard=0px
const DIFFICULTY_ERROR  = { easy: 35, normal: 12, hard: 0 };

let player, cpu, ball, playerScore, cpuScore, gameOverState;
let ballTrail = [];
let cpuTargetError = 12;

// ===== STATS =====
const gameStats = new GameStats('pong', { autoSync: true });

function getDifficulty() {
  const sel = document.getElementById('difficulty-select');
  return sel ? sel.value : 'normal';
}

function init() {
  initAudio();
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

  // CPU AI com dificuldade ajustável
  const diff = getDifficulty();
  const cpuSpeed = DIFFICULTY_SPEEDS[diff] ?? 3.5;
  const cpuCenter = cpu.y + PADDLE_H / 2;
  // Target com "erro" baseado na dificuldade (IA se move para posição ligeiramente errada)
  const cpuTarget = ball.y + (ball.vx > 0 ? cpuTargetError : 0);
  if (ball.vx > 0) { // bola vindo em direção à CPU
    if (cpuCenter < cpuTarget - 8) cpu.y += cpuSpeed;
    else if (cpuCenter > cpuTarget + 8) cpu.y -= cpuSpeed;
  } else {
    // Retornar ao centro vagarosamente
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
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  // Center line
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Paddles
  ctx.fillStyle = '#ff6b35';
  ctx.fillRect(player.x, player.y, PADDLE_W, PADDLE_H);
  ctx.fillStyle = '#4dabf7';
  ctx.fillRect(cpu.x, cpu.y, PADDLE_W, PADDLE_H);

  // Ball trail
  ballTrail.forEach((pos, i) => {
    const alpha = (i / ballTrail.length) * 0.35;
    const r = (BALL_SIZE / 2) * ((i + 1) / ballTrail.length);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(pos.x + BALL_SIZE / 2, pos.y + BALL_SIZE / 2, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Ball
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(ball.x + BALL_SIZE / 2, ball.y + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();

  // Scores
  ctx.font = 'bold 48px Nunito';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillText(playerScore, W / 4, 60);
  ctx.fillText(cpuScore, (3 * W) / 4, 60);
}

function endGame(winner) {
  gameOverState = true;
  gameLoop.pause();
  const result = winner === 'player' ? 'win' : 'loss';
  modalTitle.textContent = winner === 'player' ? 'Voce venceu! 🎉' : 'Computador venceu! 😔';
  modalMessage.textContent = `${playerScore} x ${cpuScore}`;
  modalOverlay.classList.add('show');

  // Save stats
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
  // Touch controls for mobile
  const handleMobileMove = (dir) => {
    if (gameOverState) return;
    if (dir === 'up') {
      player.y = Math.max(0, player.y - 5);
    } else {
      player.y = Math.min(H - PADDLE_H, player.y + 5);
    }
  };

  let mobileInterval;
  const startMobile = (dir) => {
    stopMobile();
    mobileInterval = setInterval(() => handleMobileMove(dir), 16);
  };
  const stopMobile = () => { clearInterval(mobileInterval); };

  btnUp.addEventListener('touchstart', (e) => { e.preventDefault(); startMobile('up'); }, { passive: false });
  btnUp.addEventListener('touchend', stopMobile);
  btnUp.addEventListener('mousedown', () => startMobile('up'));
  btnUp.addEventListener('mouseup', stopMobile);

  btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); startMobile('down'); }, { passive: false });
  btnDown.addEventListener('touchend', stopMobile);
  btnDown.addEventListener('mousedown', () => startMobile('down'));
  btnDown.addEventListener('mouseup', stopMobile);
}

// Touch on canvas - move paddle to touch Y
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleY = H / rect.height;
  const touchY = (e.touches[0].clientY - rect.top) * scaleY;
  player.y = Math.max(0, Math.min(H - PADDLE_H, touchY - PADDLE_H / 2));
}, { passive: false });

btnNewGame.addEventListener('click', init);
btnPlayAgain.addEventListener('click', init);

async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id, game: 'pong',
      result: result, moves: 0, time_seconds: 0,
      score: playerScore,
    });
  } catch (e) { console.warn('Erro ao salvar stats:', e); }
}

init();
