// ===== Pong =====
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
const CPU_SPEED = 3.5;

let player, cpu, ball, playerScore, cpuScore, gameOver, animId;
let keysDown = {};

function init() {
  player = { x: 15, y: H / 2 - PADDLE_H / 2 };
  cpu = { x: W - 15 - PADDLE_W, y: H / 2 - PADDLE_H / 2 };
  playerScore = 0;
  cpuScore = 0;
  gameOver = false;
  modalOverlay.classList.remove('show');
  resetBall();
  if (animId) cancelAnimationFrame(animId);
  loop();
}

function resetBall() {
  ball = {
    x: W / 2,
    y: H / 2,
    vx: (Math.random() > 0.5 ? 1 : -1) * 4,
    vy: (Math.random() - 0.5) * 4,
  };
}

function update() {
  if (gameOver) return;

  // Player movement (keyboard)
  if (keysDown['ArrowUp'] || keysDown['w'] || keysDown['W']) {
    player.y = Math.max(0, player.y - 5);
  }
  if (keysDown['ArrowDown'] || keysDown['s'] || keysDown['S']) {
    player.y = Math.min(H - PADDLE_H, player.y + 5);
  }

  // CPU AI
  const cpuCenter = cpu.y + PADDLE_H / 2;
  if (ball.vx > 0) { // ball coming towards CPU
    if (cpuCenter < ball.y - 10) cpu.y += CPU_SPEED;
    else if (cpuCenter > ball.y + 10) cpu.y -= CPU_SPEED;
  } else {
    // Return to center slowly
    if (cpuCenter < H / 2 - 20) cpu.y += CPU_SPEED * 0.5;
    else if (cpuCenter > H / 2 + 20) cpu.y -= CPU_SPEED * 0.5;
  }
  cpu.y = Math.max(0, Math.min(H - PADDLE_H, cpu.y));

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
  }

  // Paddle collision - CPU
  if (ball.x + BALL_SIZE >= cpu.x && ball.x + BALL_SIZE <= cpu.x + PADDLE_W &&
      ball.y + BALL_SIZE >= cpu.y && ball.y <= cpu.y + PADDLE_H) {
    ball.vx = -Math.abs(ball.vx) * 1.05;
    ball.vy += (ball.y - (cpu.y + PADDLE_H / 2)) * 0.15;
    ball.x = cpu.x - BALL_SIZE;
  }

  // Speed cap
  const maxSpeed = 10;
  ball.vx = Math.max(-maxSpeed, Math.min(maxSpeed, ball.vx));
  ball.vy = Math.max(-maxSpeed, Math.min(maxSpeed, ball.vy));

  // Score
  if (ball.x < -20) {
    cpuScore++;
    if (cpuScore >= WIN_SCORE) endGame('cpu');
    else resetBall();
  }
  if (ball.x > W + 20) {
    playerScore++;
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
  gameOver = true;
  const result = winner === 'player' ? 'win' : 'loss';
  modalTitle.textContent = winner === 'player' ? 'Voce venceu! 🎉' : 'Computador venceu! 😔';
  modalMessage.textContent = `${playerScore} x ${cpuScore}`;
  modalOverlay.classList.add('show');
  saveGameStat(result);
}

function loop() {
  update();
  draw();
  animId = requestAnimationFrame(loop);
}

// Keyboard
document.addEventListener('keydown', (e) => { keysDown[e.key] = true; });
document.addEventListener('keyup', (e) => { keysDown[e.key] = false; });

// Mobile controls
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');

let mobileInterval;
function startMobile(dir) {
  stopMobile();
  mobileInterval = setInterval(() => {
    if (dir === 'up') player.y = Math.max(0, player.y - 5);
    else player.y = Math.min(H - PADDLE_H, player.y + 5);
  }, 16);
}
function stopMobile() { clearInterval(mobileInterval); }

btnUp.addEventListener('touchstart', (e) => { e.preventDefault(); startMobile('up'); }, { passive: false });
btnUp.addEventListener('touchend', stopMobile);
btnUp.addEventListener('mousedown', () => startMobile('up'));
btnUp.addEventListener('mouseup', stopMobile);

btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); startMobile('down'); }, { passive: false });
btnDown.addEventListener('touchend', stopMobile);
btnDown.addEventListener('mousedown', () => startMobile('down'));
btnDown.addEventListener('mouseup', stopMobile);

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
    });
  } catch (e) { console.warn('Erro ao salvar stats:', e); }
}

init();
