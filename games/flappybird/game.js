import '../../auth-check.js';
// ===== Flappy Bird =====
import { supabase } from '../../supabase.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const bestDisplay = document.getElementById('best-display');
const startMsg = document.getElementById('start-msg');

const W = 400, H = 600;
canvas.width = W;
canvas.height = H;

const GRAVITY = 0.4;
const FLAP = -7;
const PIPE_WIDTH = 52;
const PIPE_GAP = 150;
const PIPE_SPEED = 2.5;
const BIRD_SIZE = 24;

let bird, pipes, score, bestScore, gameState, animId;
let wingPhase = 0;   // 0..1 ciclo da animação de asa
let shakeFrames = 0; // frames restantes de screen shake

bestScore = parseInt(localStorage.getItem('flappy_best') || '0');
bestDisplay.textContent = bestScore;

function init() {
  bird = { x: 80, y: H / 2, vy: 0, rotation: 0 };
  pipes = [];
  score = 0;
  gameState = 'waiting'; // waiting, playing, dead
  wingPhase = 0;
  shakeFrames = 0;
  startMsg.classList.remove('hidden');
  if (animId) cancelAnimationFrame(animId);
  loop();
}

function flap() {
  if (gameState === 'waiting') {
    gameState = 'playing';
    startMsg.classList.add('hidden');
  }
  if (gameState === 'dead') {
    init();
    return;
  }
  bird.vy = FLAP;
}

function spawnPipe() {
  const minY = 80;
  const maxY = H - PIPE_GAP - 80;
  const topH = minY + Math.random() * (maxY - minY);
  pipes.push({ x: W, topH, scored: false });
}

function update() {
  if (gameState !== 'playing') return;

  // Bird physics
  bird.vy += GRAVITY;
  bird.y += bird.vy;
  bird.rotation = Math.min(bird.vy * 3, 90);

  // Pipes
  if (pipes.length === 0 || pipes[pipes.length - 1].x < W - 200) {
    spawnPipe();
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= PIPE_SPEED;

    // Score
    if (!pipes[i].scored && pipes[i].x + PIPE_WIDTH < bird.x) {
      pipes[i].scored = true;
      score++;
    }

    // Remove offscreen
    if (pipes[i].x + PIPE_WIDTH < -10) {
      pipes.splice(i, 1);
    }
  }

  // Collision
  if (bird.y + BIRD_SIZE > H - 50 || bird.y < 0) {
    die();
    return;
  }

  for (const pipe of pipes) {
    if (bird.x + BIRD_SIZE > pipe.x && bird.x < pipe.x + PIPE_WIDTH) {
      if (bird.y < pipe.topH || bird.y + BIRD_SIZE > pipe.topH + PIPE_GAP) {
        die();
        return;
      }
    }
  }
}

function die() {
  gameState = 'dead';
  shakeFrames = 12; // screen shake por 12 frames
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('flappy_best', bestScore);
    bestDisplay.textContent = bestScore;
  }
  saveGameStat();
}

function draw() {
  // Screen shake ao morrer
  ctx.save();
  if (shakeFrames > 0) {
    const intensity = shakeFrames * 0.5;
    ctx.translate(
      (Math.random() - 0.5) * intensity * 2,
      (Math.random() - 0.5) * intensity * 2
    );
    shakeFrames--;
  }

  // Atualiza fase da asa
  if (gameState === 'playing') {
    wingPhase += 0.18;
    if (wingPhase > Math.PI * 2) wingPhase -= Math.PI * 2;
  }

  // Sky
  ctx.fillStyle = '#70c5ce';
  ctx.fillRect(0, 0, W, H);

  // Ground
  ctx.fillStyle = '#ded895';
  ctx.fillRect(0, H - 50, W, 50);
  ctx.fillStyle = '#8bc34a';
  ctx.fillRect(0, H - 50, W, 8);

  // Pipes
  for (const pipe of pipes) {
    // Top pipe
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topH);
    ctx.fillStyle = '#388e3c';
    ctx.fillRect(pipe.x - 3, pipe.topH - 20, PIPE_WIDTH + 6, 20);

    // Bottom pipe
    const botY = pipe.topH + PIPE_GAP;
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(pipe.x, botY, PIPE_WIDTH, H - botY - 50);
    ctx.fillStyle = '#388e3c';
    ctx.fillRect(pipe.x - 3, botY, PIPE_WIDTH + 6, 20);
  }

  // Bird
  ctx.save();
  ctx.translate(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2);
  ctx.rotate((bird.rotation * Math.PI) / 180);

  // Asa animada (bate quando sobe, descansa quando cai)
  const wingY = Math.sin(wingPhase) * 5; // oscilação vertical da asa
  ctx.fillStyle = '#e6a800';
  ctx.save();
  ctx.translate(-3, 2 + wingY);
  ctx.scale(1, 0.4 + Math.abs(Math.sin(wingPhase)) * 0.3);
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Corpo
  ctx.fillStyle = '#f9c22e';
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();
  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(7, -4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Beak
  ctx.fillStyle = '#e85d2a';
  ctx.beginPath();
  ctx.moveTo(BIRD_SIZE / 2 - 2, -2);
  ctx.lineTo(BIRD_SIZE / 2 + 8, 2);
  ctx.lineTo(BIRD_SIZE / 2 - 2, 5);
  ctx.fill();
  ctx.restore();

  // Score
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px Nunito';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 4;
  ctx.fillText(score, W / 2, 60);
  ctx.shadowBlur = 0;

  // Game over overlay
  if (gameState === 'dead') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Nunito';
    ctx.fillText('Fim de Jogo!', W / 2, H / 2 - 30);
    ctx.font = 'bold 22px Nunito';
    ctx.fillText(`Pontos: ${score}`, W / 2, H / 2 + 10);
    ctx.font = '16px Nunito';
    ctx.fillText('Toque para jogar novamente', W / 2, H / 2 + 50);
  }

  ctx.restore(); // fecha o save do screen shake
}

function loop() {
  update();
  draw();
  animId = requestAnimationFrame(loop);
}

// Input
canvas.addEventListener('click', flap);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, { passive: false });
document.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); }
});

async function saveGameStat() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id, game: 'flappybird',
      result: 'end', moves: score, time_seconds: 0,
      score: score,
    });
  } catch (e) { console.warn('Erro ao salvar stats:', e); }
}

init();
