import '../../auth-check.js?v=4';
import { supabase } from '../../supabase.js?v=2';
import { launchConfetti, playSound, initAudio } from '../shared/game-design-utils.js?v=4';

// ===== Sinuca (Bilhar) =====
// Fisica de colisao circular, atrito e IA

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const btnNewGame = document.getElementById('btn-new-game');
const btnPlayAgain = document.getElementById('btn-play-again');
const playerScoreEl = document.getElementById('player-score');
const cpuScoreEl = document.getElementById('cpu-score');
const powerFill = document.getElementById('power-fill');

// Dimensões da mesa (proporção 2:1)
const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 400;
canvas.width = TABLE_WIDTH;
canvas.height = TABLE_HEIGHT;

// Configurações
const BALL_RADIUS = 10;
const POCKET_RADIUS = 18;
const FRICTION = 0.985;
const MIN_VELOCITY = 0.15;
const MAX_POWER = 15;
const WALL_BOUNCE = 0.8;

// Cores das bolas
const BALL_COLORS = {
  white: '#f5f5f5',
  red: '#dc2626',
  yellow: '#fbbf24',
  green: '#22c55e',
  brown: '#92400e',
  blue: '#3b82f6',
  pink: '#ec4899',
  black: '#1f2937',
  orange: '#f97316'
};

// Posições dos buracos (6 buracos: 4 cantos + 2 meios)
const POCKETS = [
  { x: 20, y: 20 },           // topo-esquerdo
  { x: TABLE_WIDTH / 2, y: 15 }, // topo-meio
  { x: TABLE_WIDTH - 20, y: 20 }, // topo-direito
  { x: 20, y: TABLE_HEIGHT - 20 }, // baixo-esquerdo
  { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - 15 }, // baixo-meio
  { x: TABLE_WIDTH - 20, y: TABLE_HEIGHT - 20 }  // baixo-direito
];

// Estado do jogo
let balls = [];
let playerScore = 0;
let cpuScore = 0;
let currentPlayer = 'player'; // 'player' ou 'cpu'
let gameState = 'aiming'; // 'aiming', 'shooting', 'moving', 'gameover'
let cueBall = null;
let aimStart = null;
let aimCurrent = null;
let power = 0;
let ballsPottedThisTurn = [];
let gameOver = false;

// ===== Classe Bola =====
class Ball {
  constructor(x, y, color, type, points = 1) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = BALL_RADIUS;
    this.color = color;
    this.type = type; // 'white', 'red', 'color'
    this.points = points;
    this.potted = false;
    this.number = 0;
  }

  update() {
    if (this.potted) return;

    // Aplicar velocidade
    this.x += this.vx;
    this.y += this.vy;

    // Atrito
    this.vx *= FRICTION;
    this.vy *= FRICTION;

    // Parar se velocidade for muito pequena
    if (Math.abs(this.vx) < MIN_VELOCITY) this.vx = 0;
    if (Math.abs(this.vy) < MIN_VELOCITY) this.vy = 0;

    // Colisão com paredes
    const margin = 30;
    if (this.x - this.radius < margin) {
      this.x = margin + this.radius;
      this.vx *= -WALL_BOUNCE;
    }
    if (this.x + this.radius > TABLE_WIDTH - margin) {
      this.x = TABLE_WIDTH - margin - this.radius;
      this.vx *= -WALL_BOUNCE;
    }
    if (this.y - this.radius < margin) {
      this.y = margin + this.radius;
      this.vy *= -WALL_BOUNCE;
    }
    if (this.y + this.radius > TABLE_HEIGHT - margin) {
      this.y = TABLE_HEIGHT - margin - this.radius;
      this.vy *= -WALL_BOUNCE;
    }

    // Verificar se caiu no buraco
    this.checkPocket();
  }

  checkPocket() {
    for (const pocket of POCKETS) {
      const dx = this.x - pocket.x;
      const dy = this.y - pocket.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < POCKET_RADIUS - 2) {
        this.potted = true;
        this.vx = 0;
        this.vy = 0;
        playSound('pop');
        return true;
      }
    }
    return false;
  }

  draw() {
    if (this.potted) return;

    // Sombra
    ctx.beginPath();
    ctx.arc(this.x + 2, this.y + 2, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Bola
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();

    // Brilho
    ctx.beginPath();
    ctx.arc(this.x - 3, this.y - 3, this.radius / 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();

    // Contorno
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Número para bolas coloridas
    if (this.type === 'color' && this.number > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Nunito';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.number, this.x, this.y);
    }
  }

  isMoving() {
    return Math.abs(this.vx) > MIN_VELOCITY || Math.abs(this.vy) > MIN_VELOCITY;
  }
}

// ===== Inicialização =====
function init() {
  initAudio();
  balls = [];
  playerScore = 0;
  cpuScore = 0;
  currentPlayer = 'player';
  gameState = 'aiming';
  gameOver = false;
  ballsPottedThisTurn = [];
  aimStart = null;
  aimCurrent = null;
  power = 0;

  updateScoreDisplay();

  // Bola branca (taco)
  cueBall = new Ball(150, TABLE_HEIGHT / 2, BALL_COLORS.white, 'white', 0);
  balls.push(cueBall);

  // Triângulo de bolas vermelhas (15 bolas)
  const startX = TABLE_WIDTH - 200;
  const startY = TABLE_HEIGHT / 2;
  let row = 0;
  let col = 0;
  let count = 0;

  for (let i = 0; i < 15; i++) {
    const x = startX + col * (BALL_RADIUS * 2 + 2);
    const y = startY + (row - col / 2) * (BALL_RADIUS * 2 * 0.866) + (col % 2) * (BALL_RADIUS * 0.5);
    const ball = new Ball(x, y, BALL_COLORS.red, 'red', 1);
    balls.push(ball);

    row++;
    if (row > col) {
      col++;
      row = 0;
    }
  }

  // Bolas coloridas (posições específicas)
  const colorBalls = [
    { x: TABLE_WIDTH - 150, y: 80, color: BALL_COLORS.yellow, points: 2, num: 2 },
    { x: TABLE_WIDTH - 100, y: TABLE_HEIGHT - 80, color: BALL_COLORS.green, points: 3, num: 3 },
    { x: TABLE_WIDTH - 250, y: 60, color: BALL_COLORS.brown, points: 4, num: 4 },
    { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, color: BALL_COLORS.blue, points: 5, num: 5 },
    { x: TABLE_WIDTH - 300, y: TABLE_HEIGHT - 60, color: BALL_COLORS.pink, points: 6, num: 6 },
    { x: TABLE_WIDTH - 350, y: TABLE_HEIGHT / 2, color: BALL_COLORS.black, points: 7, num: 7 }
  ];

  for (const cb of colorBalls) {
    const ball = new Ball(cb.x, cb.y, cb.color, 'color', cb.points);
    ball.number = cb.num;
    balls.push(ball);
  }

  modalOverlay.classList.remove('show');
  playSound('start');
}

// ===== Física de Colisão =====
function checkBallCollisions() {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const b1 = balls[i];
      const b2 = balls[j];

      if (b1.potted || b2.potted) continue;

      const dx = b2.x - b1.x;
      const dy = b2.y - b1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < b1.radius + b2.radius) {
        // Colisão detectada - resolver sobreposição
        const overlap = (b1.radius + b2.radius - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;

        b1.x -= nx * overlap;
        b1.y -= ny * overlap;
        b2.x += nx * overlap;
        b2.y += ny * overlap;

        // Troca de velocidades (colisão elástica)
        const dvx = b2.vx - b1.vx;
        const dvy = b2.vy - b1.vy;
        const dvDotN = dvx * nx + dvy * ny;

        if (dvDotN > 0) continue;

        const impulse = dvDotN;
        b1.vx += impulse * nx;
        b1.vy += impulse * ny;
        b2.vx -= impulse * nx;
        b2.vy -= impulse * ny;

        // Som de colisão suave
        if (Math.abs(impulse) > 0.5) {
          playSound('click');
        }
      }
    }
  }
}

// ===== IA do Computador =====
function makeCPUMove() {
  if (gameOver) return;

  gameState = 'shooting';
  currentPlayer = 'cpu';

  // Encontrar a melhor jogada
  const targetBall = findBestTarget();

  if (targetBall) {
    // Calcular ângulo para o buraco mais próximo
    const pocket = findBestPocket(targetBall);
    const aimPoint = calculateAimPoint(targetBall, pocket);

    // Calcular ângulo e força
    const dx = aimPoint.x - cueBall.x;
    const dy = aimPoint.y - cueBall.y;
    const angle = Math.atan2(dy, dx);

    // Força baseada na distância (com variação aleatória para não ser perfeito)
    const dist = Math.sqrt(dx * dx + dy * dy);
    const basePower = Math.min(MAX_POWER * 0.8, dist / 30);
    const powerVariation = (Math.random() - 0.5) * 2;
    const finalPower = Math.max(3, Math.min(MAX_POWER, basePower + powerVariation));

    // Aplicar velocidade
    cueBall.vx = Math.cos(angle) * finalPower;
    cueBall.vy = Math.sin(angle) * finalPower;

    playSound('shoot');
  } else {
    // Não encontrou jogada - taca aleatoriamente
    const angle = Math.random() * Math.PI * 2;
    const power = 5 + Math.random() * 5;
    cueBall.vx = Math.cos(angle) * power;
    cueBall.vy = Math.sin(angle) * power;
    playSound('shoot');
  }

  ballsPottedThisTurn = [];
  gameState = 'moving';
}

function findBestTarget() {
  // Procurar bolas não encaçapadas (preferência por vermelhas)
  const availableBalls = balls.filter(b => !b.potted && b !== cueBall);
  const redBalls = availableBalls.filter(b => b.type === 'red');
  const colorBalls = availableBalls.filter(b => b.type === 'color');

  // Tentar primeiro as vermelhas
  for (const ball of redBalls) {
    if (hasClearPath(cueBall, ball)) {
      return ball;
    }
  }

  // Depois as coloridas
  for (const ball of colorBalls) {
    if (hasClearPath(cueBall, ball)) {
      return ball;
    }
  }

  // Se não encontrou caminho limpo, retorna qualquer uma
  return availableBalls[0];
}

function hasClearPath(fromBall, toBall) {
  const dx = toBall.x - fromBall.x;
  const dy = toBall.y - fromBall.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Verificar se há bolas no caminho
  for (const ball of balls) {
    if (ball === fromBall || ball === toBall || ball.potted) continue;

    // Verificar se a bola está na linha entre from e to
    const ballDist = pointToLineDistance(ball.x, ball.y, fromBall.x, fromBall.y, toBall.x, toBall.y);
    if (ballDist < BALL_RADIUS * 2) {
      return false;
    }
  }

  return true;
}

function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function findBestPocket(ball) {
  let bestPocket = POCKETS[0];
  let minDist = Infinity;

  for (const pocket of POCKETS) {
    const dx = pocket.x - ball.x;
    const dy = pocket.y - ball.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < minDist) {
      minDist = dist;
      bestPocket = pocket;
    }
  }

  return bestPocket;
}

function calculateAimPoint(targetBall, pocket) {
  // Calcular ponto de contato na bola alvo
  const dx = pocket.x - targetBall.x;
  const dy = pocket.y - targetBall.y;
  const angle = Math.atan2(dy, dx);

  return {
    x: targetBall.x - Math.cos(angle) * (BALL_RADIUS * 2),
    y: targetBall.y - Math.sin(angle) * (BALL_RADIUS * 2)
  };
}

// ===== Atualização do Jogo =====
function update() {
  if (gameOver) return;

  // Atualizar bolas
  let anyMoving = false;
  for (const ball of balls) {
    ball.update();
    if (ball.isMoving()) {
      anyMoving = true;
    }
  }

  // Verificar colisões
  checkBallCollisions();

  // Processar bolas encaçapadas
  const pottedBalls = balls.filter(b => b.potted && !ballsPottedThisTurn.includes(b));
  if (pottedBalls.length > 0) {
    for (const ball of pottedBalls) {
      ballsPottedThisTurn.push(ball);

      if (ball.type === 'white') {
        // Faul - bola branca encaçapada
        handleFoul('white');
        return;
      } else {
        // Pontuação
        if (currentPlayer === 'player') {
          playerScore += ball.points;
        } else {
          cpuScore += ball.points;
        }
        updateScoreDisplay();
      }
    }
  }

  // Verificar fim do turno
  if (gameState === 'moving' && !anyMoving) {
    endTurn();
  }

  // Verificar fim do jogo
  checkGameEnd();
}

function endTurn() {
  const pottedCount = ballsPottedThisTurn.filter(b => b.type !== 'white').length;

  if (pottedCount === 0) {
    // Não encaçapou nada - troca de jogador
    currentPlayer = currentPlayer === 'player' ? 'cpu' : 'player';
  }
  // Se encaçapou, continua jogando

  // Reposicionar bola branca se foi encaçapada
  if (cueBall.potted) {
    cueBall.potted = false;
    cueBall.x = 150;
    cueBall.y = TABLE_HEIGHT / 2;
    cueBall.vx = 0;
    cueBall.vy = 0;
  }

  ballsPottedThisTurn = [];

  if (currentPlayer === 'cpu') {
    gameState = 'shooting';
    setTimeout(makeCPUMove, 1000);
  } else {
    gameState = 'aiming';
  }
}

function handleFoul(reason) {
  // Penalidade por faul
  cueBall.potted = false;
  cueBall.x = 150;
  cueBall.y = TABLE_HEIGHT / 2;
  cueBall.vx = 0;
  cueBall.vy = 0;

  // Troca de jogador
  currentPlayer = currentPlayer === 'player' ? 'cpu' : 'player';
  ballsPottedThisTurn = [];

  if (currentPlayer === 'cpu') {
    gameState = 'shooting';
    setTimeout(makeCPUMove, 1000);
  } else {
    gameState = 'aiming';
  }
}

function checkGameEnd() {
  // Verificar se todas as bolas foram encaçapadas
  const remainingBalls = balls.filter(b => !b.potted && b !== cueBall);

  if (remainingBalls.length === 0 || playerScore >= 50 || cpuScore >= 50) {
    endGame();
  }
}

function endGame() {
  gameOver = true;
  gameState = 'gameover';

  const winner = playerScore > cpuScore ? 'player' : playerScore < cpuScore ? 'cpu' : 'tie';

  if (winner === 'player') {
    modalTitle.textContent = 'Voce venceu! 🎉';
    modalMessage.textContent = `Parabens! Placar: ${playerScore} x ${cpuScore}`;
    launchConfetti();
    playSound('win');
    saveGameStat('win');
  } else if (winner === 'cpu') {
    modalTitle.textContent = 'Computador venceu! 😔';
    modalMessage.textContent = `Placar: ${playerScore} x ${cpuScore}`;
    playSound('gameover');
    saveGameStat('loss');
  } else {
    modalTitle.textContent = 'Empate! 🤝';
    modalMessage.textContent = `Placar: ${playerScore} x ${cpuScore}`;
  }

  modalOverlay.classList.add('show');
}

function updateScoreDisplay() {
  playerScoreEl.textContent = playerScore;
  cpuScoreEl.textContent = cpuScore;
}

// ===== Renderização =====
function draw() {
  // Limpar canvas
  ctx.fillStyle = '#1a472a';
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

  // Borda da mesa
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = 20;
  ctx.strokeRect(10, 10, TABLE_WIDTH - 20, TABLE_HEIGHT - 20);

  // Área de jogo
  ctx.fillStyle = '#2d5a27';
  ctx.fillRect(30, 30, TABLE_WIDTH - 60, TABLE_HEIGHT - 60);

  // Linha de partida (semicírculo)
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(150, TABLE_HEIGHT / 2, 100, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Linha vertical
  ctx.beginPath();
  ctx.moveTo(150, 30);
  ctx.lineTo(150, TABLE_HEIGHT - 30);
  ctx.stroke();

  // Buracos
  for (const pocket of POCKETS) {
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0f0f';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Bolas
  for (const ball of balls) {
    ball.draw();
  }

  // Desenhar mira (apenas para jogador)
  if (gameState === 'aiming' && currentPlayer === 'player' && aimStart && aimCurrent) {
    drawAimLine();
  }

  // Indicador de vez
  ctx.font = 'bold 16px Nunito';
  ctx.textAlign = 'left';
  ctx.fillStyle = currentPlayer === 'player' ? '#4ade80' : '#f87171';
  ctx.fillText(currentPlayer === 'player' ? 'Sua vez' : 'Vez do computador', 40, 60);
}

function drawAimLine() {
  const dx = aimStart.x - aimCurrent.x;
  const dy = aimStart.y - aimCurrent.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // Calcular força
  power = Math.min(dist / 10, MAX_POWER);

  // Linha de mira
  const lineLength = 100 + power * 20;
  const endX = cueBall.x + Math.cos(angle) * lineLength;
  const endY = cueBall.y + Math.sin(angle) * lineLength;

  ctx.beginPath();
  ctx.moveTo(cueBall.x, cueBall.y);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + power / MAX_POWER * 0.5})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Atualizar barra de força
  const powerPercent = (power / MAX_POWER) * 100;
  powerFill.style.width = `${powerPercent}%`;
  powerFill.style.background = powerPercent > 70 ? '#ef4444' : powerPercent > 40 ? '#fbbf24' : '#22c55e';
}

// ===== Input Handling =====
function getMousePos(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function handleStart(evt) {
  if (gameState !== 'aiming' || currentPlayer !== 'player') return;
  evt.preventDefault();

  const pos = getMousePos(evt);
  const dx = pos.x - cueBall.x;
  const dy = pos.y - cueBall.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Só inicia mira se clicar perto da bola branca
  if (dist < BALL_RADIUS * 4) {
    aimStart = { x: cueBall.x, y: cueBall.y };
    aimCurrent = pos;
  }
}

function handleMove(evt) {
  if (!aimStart || gameState !== 'aiming') return;
  evt.preventDefault();
  aimCurrent = getMousePos(evt);
}

function handleEnd(evt) {
  if (!aimStart || gameState !== 'aiming') return;
  evt.preventDefault();

  if (power > 1) {
    const dx = aimStart.x - aimCurrent.x;
    const dy = aimStart.y - aimCurrent.y;
    const angle = Math.atan2(dy, dx);

    // Aplicar velocidade à bola branca
    cueBall.vx = Math.cos(angle) * power;
    cueBall.vy = Math.sin(angle) * power;

    playSound('shoot');

    ballsPottedThisTurn = [];
    gameState = 'moving';
  }

  aimStart = null;
  aimCurrent = null;
  power = 0;
  powerFill.style.width = '0%';
}

// Event Listeners
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);
canvas.addEventListener('mouseleave', handleEnd);

canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleEnd, { passive: false });

btnNewGame.addEventListener('click', init);
btnPlayAgain.addEventListener('click', init);

// Salvar estatísticas
async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'sinuca',
      result: result,
      moves: 0,
      time_seconds: 0,
      score: playerScore
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// Game Loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Iniciar
init();
gameLoop();
