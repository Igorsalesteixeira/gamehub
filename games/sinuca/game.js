import '../../auth-check.js?v=4';
import { supabase } from '../../supabase.js?v=2';
import { launchConfetti, playSound, initAudio } from '../shared/game-design-utils.js?v=4';

// ===== Sistema de Partículas (Poeira) =====
let particles = [];

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.life = 1.0;
    this.decay = 0.02 + Math.random() * 0.02;
    this.color = color;
    this.size = 2 + Math.random() * 3;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.size *= 0.98;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.life * 0.6;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function createDust(x, y, color = '#8b7355', count = 8) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => p.update());
}

function drawParticles(ctx) {
  particles.forEach(p => p.draw(ctx));
}

// ===== Animação de Bola Caindo na Cacapa =====
let pocketingBalls = [];

class PocketingAnimation {
  constructor(ball, pocketX, pocketY, projectedScale = 1) {
    this.ball = ball;
    this.pocketX = pocketX; // Coordenadas de tela (já projetadas)
    this.pocketY = pocketY;
    this.projectedScale = projectedScale; // Escala da perspectiva na posição da cacapa
    this.scale = 1;
    this.alpha = 1;
    this.offsetY = 0;
  }

  update() {
    this.scale *= 0.95;
    this.offsetY += 2;
    this.alpha -= 0.05;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;

    // Usar coordenadas de tela diretamente (já projetadas)
    const scale = this.projectedScale * this.scale;
    const radius = BALL_RADIUS * scale;

    ctx.translate(this.pocketX, this.pocketY + this.offsetY * scale);
    ctx.scale(scale, scale);

    // Desenhar bola com efeito 3D
    const gradient = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
    gradient.addColorStop(0, lightenColor(this.ball.color, 40));
    gradient.addColorStop(0.5, this.ball.color);
    gradient.addColorStop(1, darkenColor(this.ball.color, 30));

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Brilho
    ctx.beginPath();
    ctx.ellipse(-radius * 0.35, -radius * 0.35, radius * 0.25, radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();

    ctx.restore();
  }
}

function updatePocketingAnimations() {
  pocketingBalls.forEach(p => p.update());
  pocketingBalls = pocketingBalls.filter(p => p.alpha > 0);
}

function drawPocketingAnimations(ctx) {
  pocketingBalls.forEach(p => p.draw(ctx));
}

// ===== Sons da Sinuca =====
const SOUNDS = {
  cueHit: 'cue_hit',
  ballHit: 'ball_hit',
  wallHit: 'wall_hit',
  pocket: 'pocket',
  win: 'win'
};

function playGameSound(soundType) {
  try {
    playSound(soundType);
  } catch (e) {
    // Fallback se o som não existir
    console.log('Sound:', soundType);
  }
}

// ===== Sistema de Placar Elaborado =====
let floatingTexts = [];
let lastPottedBall = null;
let scoreGlow = { player: 0, cpu: 0 };
let displayedScore = { player: 0, cpu: 0 };

class FloatingText {
  constructor(x, y, text, color = '#fff') {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 1.0;
    this.vy = -1.5;
    this.scale = 1;
  }

  update() {
    this.y += this.vy;
    this.life -= 0.02;
    this.vy *= 0.95;
    if (this.life > 0.5) {
      this.scale = 1 + (1 - this.life) * 2;
    } else {
      this.scale = 1.5 - (0.5 - this.life);
    }
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.font = `bold ${16 * this.scale}px Nunito`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

function addFloatingScore(x, y, points, isPlayer) {
  const color = isPlayer ? '#4ade80' : '#f87171';
  const text = `+${points}`;
  floatingTexts.push(new FloatingText(x, y, text, color));
}

function updateFloatingTexts() {
  floatingTexts.forEach(t => t.update());
  floatingTexts = floatingTexts.filter(t => t.life > 0);

  // Atualizar brilho do placar
  scoreGlow.player = Math.max(0, scoreGlow.player - 0.05);
  scoreGlow.cpu = Math.max(0, scoreGlow.cpu - 0.05);

  // Animar contagem de pontos subindo
  if (displayedScore.player < playerScore) {
    displayedScore.player += 0.5;
  } else if (displayedScore.player > playerScore) {
    displayedScore.player = playerScore;
  }
  if (displayedScore.cpu < cpuScore) {
    displayedScore.cpu += 0.5;
  } else if (displayedScore.cpu > cpuScore) {
    displayedScore.cpu = cpuScore;
  }
}

function drawFloatingTexts(ctx) {
  floatingTexts.forEach(t => t.draw(ctx));
}

function drawLastPottedBall(ctx) {
  if (!lastPottedBall) return;

  const x = TABLE_WIDTH - 60;
  const y = TABLE_HEIGHT - 40;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 50, y - 25, 100, 50);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 50, y - 25, 100, 50);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Nunito';
  ctx.textAlign = 'center';
  ctx.fillText('Última bola:', x, y - 12);

  // Desenhar bola em 3D
  const ballY = y + 8;
  const radius = 10;

  // Sombra
  ctx.beginPath();
  ctx.ellipse(x + 2, ballY + 4, radius * 1.2, radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.filter = 'blur(2px)';
  ctx.fill();
  ctx.filter = 'none';

  // Gradiente da bola
  const gradient = ctx.createRadialGradient(x - 3, ballY - 3, 0, x, ballY, radius);
  gradient.addColorStop(0, lightenColor(lastPottedBall.color, 40));
  gradient.addColorStop(0.5, lastPottedBall.color);
  gradient.addColorStop(1, darkenColor(lastPottedBall.color, 30));

  ctx.beginPath();
  ctx.arc(x, ballY, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Brilho
  ctx.beginPath();
  ctx.ellipse(x - 3, ballY - 3, 3, 2, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();

  // Borda
  ctx.beginPath();
  ctx.arc(x, ballY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.restore();
}

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

// ===== Configuração da Mesa 2D Clássica =====
// Mesa profissional de sinuca - vista de topo levemente inclinada
// Proporção 2:1, centralizada no canvas 800x400 com margens de 60px

const TABLE_MARGIN = 60;
const TABLE_PLAYABLE_WIDTH = TABLE_WIDTH - TABLE_MARGIN * 2;   // 680px
const TABLE_PLAYABLE_HEIGHT = TABLE_PLAYABLE_WIDTH / 2;          // 340px (proporção 2:1)
const TABLE_VERTICAL_MARGIN = (TABLE_HEIGHT - TABLE_PLAYABLE_HEIGHT) / 2; // 30px

// Área jogável da mesa (coordenadas diretas no canvas)
const TABLE_3D = {
  x: TABLE_MARGIN,                              // 60px da esquerda
  y: TABLE_VERTICAL_MARGIN,                     // 30px do topo
  width: TABLE_PLAYABLE_WIDTH,                  // 680px
  height: TABLE_PLAYABLE_HEIGHT,                // 340px
  right: TABLE_MARGIN + TABLE_PLAYABLE_WIDTH,   // 740px
  bottom: TABLE_VERTICAL_MARGIN + TABLE_PLAYABLE_HEIGHT // 370px
};

// Função de projeção simplificada - coordenadas diretas, sem perspectiva 3D
function project3D(worldX, worldY, worldZ) {
  // Retorna coordenadas diretas com escala 1 (sem transformação)
  return { x: worldX, y: worldY, scale: 1 };
}

// Função inversa simplificada - coordenadas diretas
function screenToWorld(screenX, screenY) {
  return { x: screenX, y: screenY };
}

// Funções auxiliares de cor
function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

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

    // Colisão com paredes (usando limites da mesa 3D)
    const margin = 25; // Margem interna para as bordas emborrachadas
    let hitWall = false;

    // Limites da mesa em coordenadas do mundo
    const tableLeft = TABLE_3D.x + margin;
    const tableRight = TABLE_3D.x + TABLE_3D.width - margin;
    const tableTop = TABLE_3D.y + margin;
    const tableBottom = TABLE_3D.y + TABLE_3D.height - margin;

    if (this.x - this.radius < tableLeft) {
      this.x = tableLeft + this.radius;
      this.vx *= -WALL_BOUNCE;
      hitWall = true;
    }
    if (this.x + this.radius > tableRight) {
      this.x = tableRight - this.radius;
      this.vx *= -WALL_BOUNCE;
      hitWall = true;
    }
    if (this.y - this.radius < tableTop) {
      this.y = tableTop + this.radius;
      this.vy *= -WALL_BOUNCE;
      hitWall = true;
    }
    if (this.y + this.radius > tableBottom) {
      this.y = tableBottom - this.radius;
      this.vy *= -WALL_BOUNCE;
      hitWall = true;
    }
    // Som de colisão com parede
    if (hitWall && !this.potted && (Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1)) {
      playGameSound(SOUNDS.wallHit);
    }

    // Verificar se caiu no buraco
    this.checkPocket();
  }

  checkPocket() {
    // Posições das caçapas em coordenadas do mundo (mesma lógica do drawPockets3D)
    const pocketRadius = 18;
    const pockets = [
      { x: TABLE_3D.x + 30, y: TABLE_3D.y + 30 },                     // topo-esquerdo
      { x: (TABLE_3D.x + TABLE_3D.x + TABLE_3D.width) / 2, y: TABLE_3D.y + 22 }, // topo-meio
      { x: TABLE_3D.x + TABLE_3D.width - 30, y: TABLE_3D.y + 30 },    // topo-direito
      { x: TABLE_3D.x + 30, y: TABLE_3D.y + TABLE_3D.height - 30 },   // baixo-esquerdo
      { x: (TABLE_3D.x + TABLE_3D.x + TABLE_3D.width) / 2, y: TABLE_3D.y + TABLE_3D.height - 22 }, // baixo-meio
      { x: TABLE_3D.x + TABLE_3D.width - 30, y: TABLE_3D.y + TABLE_3D.height - 30 }   // baixo-direito
    ];

    for (const pocket of pockets) {
      const dx = this.x - pocket.x;
      const dy = this.y - pocket.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Usar raio da cacapa para detecção
      if (dist < pocketRadius) {
        this.potted = true;
        this.vx = 0;
        this.vy = 0;
        playSound('pop');

        // Projetar posição da cacapa para animação
        const pocketProj = project3D(pocket.x, pocket.y, 0);
        pocketingBalls.push(new PocketingAnimation(this, pocketProj.x, pocketProj.y, pocketProj.scale));

        // Som de encaçapar
        playGameSound(SOUNDS.pocket);
        return true;
      }
    }
    return false;
  }

  draw() {
    if (this.potted) return;

    // Calcular posição 3D projetada
    const projected = project3D(this.x, this.y, 0);
    const radius = this.radius * projected.scale;

    // Desenhar bola como esfera 3D (sem sombra dinâmica)
    const gradient = ctx.createRadialGradient(
      projected.x - radius * 0.35, projected.y - radius * 0.35, 0,
      projected.x, projected.y, radius
    );
    gradient.addColorStop(0, lightenColor(this.color, 50));
    gradient.addColorStop(0.4, this.color);
    gradient.addColorStop(1, darkenColor(this.color, 40));

    ctx.beginPath();
    ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Brilho especular
    ctx.beginPath();
    ctx.ellipse(
      projected.x - radius * 0.4,
      projected.y - radius * 0.4,
      radius * 0.28, radius * 0.18,
      -Math.PI / 4, 0, Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();

    // Borda sutil
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Número para bolas coloridas
    if (this.type === 'color' && this.number > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(8, 10 * projected.scale)}px Nunito`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.number, projected.x, projected.y);
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
  particles = [];
  pocketingBalls = [];
  floatingTexts = [];
  lastPottedBall = null;
  scoreGlow = { player: 0, cpu: 0 };
  displayedScore = { player: 0, cpu: 0 };

  updateScoreDisplay();

  // Inicializar medidor de força em 0%
  if (powerFill) {
    powerFill.style.height = '0%';
    powerFill.style.width = '0%';
  }

  // Bola branca (taco) - posição inicial na área 3D
  cueBall = new Ball(TABLE_3D.x + 100, TABLE_3D.y + TABLE_3D.height / 2, BALL_COLORS.white, 'white', 0);
  balls.push(cueBall);

  // Triângulo de bolas vermelhas (15 bolas) - posicionadas na área 3D
  const startX = TABLE_3D.x + TABLE_3D.width - 150;
  const startY = TABLE_3D.y + TABLE_3D.height / 2;
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

  // Bolas coloridas (posições específicas dentro da área 3D)
  const colorBalls = [
    { x: TABLE_3D.x + TABLE_3D.width - 100, y: TABLE_3D.y + 50, color: BALL_COLORS.yellow, points: 2, num: 2 },
    { x: TABLE_3D.x + TABLE_3D.width - 80, y: TABLE_3D.y + TABLE_3D.height - 50, color: BALL_COLORS.green, points: 3, num: 3 },
    { x: TABLE_3D.x + TABLE_3D.width - 200, y: TABLE_3D.y + 40, color: BALL_COLORS.brown, points: 4, num: 4 },
    { x: TABLE_3D.x + TABLE_3D.width / 2 + 50, y: TABLE_3D.y + TABLE_3D.height / 2, color: BALL_COLORS.blue, points: 5, num: 5 },
    { x: TABLE_3D.x + TABLE_3D.width - 250, y: TABLE_3D.y + TABLE_3D.height - 40, color: BALL_COLORS.pink, points: 6, num: 6 },
    { x: TABLE_3D.x + TABLE_3D.width - 300, y: TABLE_3D.y + TABLE_3D.height / 2, color: BALL_COLORS.black, points: 7, num: 7 }
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

        // Som de colisão e partículas
        if (Math.abs(impulse) > 0.5) {
          playSound('click');
          // Adicionar partículas de poeira no ponto de colisão
          const collisionX = b1.x + nx * b1.radius;
          const collisionY = b1.y + ny * b1.radius;
          const dustColor = b1.color === BALL_COLORS.white ? '#d4d4d4' : b1.color;
          createDust(collisionX, collisionY, dustColor, 5);
        }
      }
    }
  }
}

// ===== IA do Computador =====
function makeCPUMove() {
  console.log('[DEBUG] makeCPUMove chamada - gameState:', gameState, 'currentPlayer:', currentPlayer);

  if (gameOver) {
    console.log('[DEBUG] makeCPUMove abortada - game over');
    return;
  }

  // Só executar se for realmente a vez do CPU
  if (currentPlayer !== 'cpu') {
    console.log('[DEBUG] makeCPUMove abortada - não é vez do CPU');
    return;
  }

  // Só executar se estivermos no estado correto
  if (gameState !== 'cpu_turn' && gameState !== 'aiming') {
    console.log('[DEBUG] makeCPUMove abortada - estado incorreto:', gameState);
    return;
  }

  // Garantir que a bola branca esteja disponível
  if (!cueBall || cueBall.potted) {
    if (cueBall) {
      cueBall.potted = false;
      cueBall.x = TABLE_3D.x + 100;
      cueBall.y = TABLE_3D.y + TABLE_3D.height / 2;
      cueBall.vx = 0;
      cueBall.vy = 0;
    }
  }

  gameState = 'shooting';
  currentPlayer = 'cpu';
  console.log('[DEBUG] CPU iniciando jogada - gameState: shooting');

  // Pequeno delay para simular "pensamento" da IA
  setTimeout(() => {
    if (gameOver) {
      console.log('[DEBUG] CPU timeout abortado - game over');
      return;
    }

    console.log('[DEBUG] CPU calculando jogada...');

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
      const powerVariation = (Math.random() - 0.5) * 3;
      const finalPower = Math.max(4, Math.min(MAX_POWER * 0.9, basePower + powerVariation));

      // Aplicar velocidade à bola branca
      cueBall.vx = Math.cos(angle) * finalPower;
      cueBall.vy = Math.sin(angle) * finalPower;

      playGameSound(SOUNDS.cueHit);
      playSound('shoot');
    } else {
      // Não encontrou jogada - taca aleatoriamente em direção às bolas
      const availableBalls = balls.filter(b => !b.potted && b !== cueBall);
      if (availableBalls.length > 0) {
        const randomBall = availableBalls[Math.floor(Math.random() * availableBalls.length)];
        const dx = randomBall.x - cueBall.x;
        const dy = randomBall.y - cueBall.y;
        const angle = Math.atan2(dy, dx);
        const power = 6 + Math.random() * 4;
        cueBall.vx = Math.cos(angle) * power;
        cueBall.vy = Math.sin(angle) * power;
      } else {
        // Sem bolas disponíveis - tiro completamente aleatório
        const angle = Math.random() * Math.PI * 2;
        const power = 5 + Math.random() * 5;
        cueBall.vx = Math.cos(angle) * power;
        cueBall.vy = Math.sin(angle) * power;
      }
      playGameSound(SOUNDS.cueHit);
      playSound('shoot');
    }

    ballsPottedThisTurn = [];
    gameState = 'moving';
    console.log('[DEBUG] CPU finalizou jogada - gameState: moving, velocidade:',
      Math.sqrt(cueBall.vx * cueBall.vx + cueBall.vy * cueBall.vy).toFixed(2));
  }, 500); // 500ms de "pensamento"
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
  // Caçapas em coordenadas do mundo 3D (mesmas usadas em checkPocket)
  const pockets = [
    { x: TABLE_3D.x + 25, y: TABLE_3D.y + 25 },           // topo-esquerdo
    { x: (TABLE_3D.x + TABLE_3D.x + TABLE_3D.width) / 2, y: TABLE_3D.y + 15 }, // topo-meio
    { x: TABLE_3D.x + TABLE_3D.width - 25, y: TABLE_3D.y + 25 },         // topo-direito
    { x: TABLE_3D.x + 25, y: TABLE_3D.y + TABLE_3D.height - 25 },        // baixo-esquerdo
    { x: (TABLE_3D.x + TABLE_3D.x + TABLE_3D.width) / 2, y: TABLE_3D.y + TABLE_3D.height - 15 }, // baixo-meio
    { x: TABLE_3D.x + TABLE_3D.width - 25, y: TABLE_3D.y + TABLE_3D.height - 25 }        // baixo-direito
  ];

  let bestPocket = pockets[0];
  let minDist = Infinity;

  for (const pocket of pockets) {
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
        // Pontuação com animação
        const isPlayer = currentPlayer === 'player';
        if (isPlayer) {
          playerScore += ball.points;
          scoreGlow.player = 1.0;
        } else {
          cpuScore += ball.points;
          scoreGlow.cpu = 1.0;
        }
        // Adicionar texto flutuante de pontos
        addFloatingScore(ball.x, ball.y, ball.points, isPlayer);
        // Registrar última bola encaçapada
        lastPottedBall = { color: ball.color, points: ball.points };
        updateScoreDisplay();
      }
    }
  }

  // Verificar fim do turno
  if (gameState === 'moving' && !anyMoving) {
    console.log('[DEBUG] Bolas pararam - chamando endTurn()');
    endTurn();
  }

  // Verificar fim do jogo
  checkGameEnd();
}

function endTurn() {
  // Guarda para evitar chamadas múltiplas enquanto processa o fim do turno
  if (gameState !== 'moving') {
    console.log('[DEBUG] endTurn ignorada - gameState não é moving:', gameState);
    return;
  }

  console.log('[DEBUG] endTurn iniciada - currentPlayer:', currentPlayer, 'ballsPotted:', ballsPottedThisTurn.length);

  const pottedCount = ballsPottedThisTurn.filter(b => b.type !== 'white').length;
  console.log('[DEBUG] Bolas encaçapadas neste turno (exceto branca):', pottedCount);

  if (pottedCount === 0) {
    // Não encaçapou nada - troca de jogador
    currentPlayer = currentPlayer === 'player' ? 'cpu' : 'player';
    console.log('[DEBUG] Jogador alternado para:', currentPlayer);
  } else {
    console.log('[DEBUG] Jogador continua (encaçapou', pottedCount, 'bola(s)):', currentPlayer);
  }
  // Se encaçapou, continua jogando

  // Reposicionar bola branca se foi encaçapada
  if (cueBall.potted) {
    cueBall.potted = false;
    cueBall.x = TABLE_3D.x + 100;
    cueBall.y = TABLE_3D.y + TABLE_3D.height / 2;
    cueBall.vx = 0;
    cueBall.vy = 0;
    console.log('[DEBUG] Bola branca reposicionada');
  }

  ballsPottedThisTurn = [];

  if (currentPlayer === 'cpu') {
    // Mudar estado imediatamente para evitar chamadas repetidas de endTurn
    gameState = 'cpu_turn';
    console.log('[DEBUG] Agendando jogada do CPU em 800ms');
    setTimeout(makeCPUMove, 800);
  } else {
    gameState = 'aiming';
    console.log('[DEBUG] Turno do jogador - gameState: aiming');
  }
}

function handleFoul(reason) {
  console.log('[DEBUG] handleFoul chamada - reason:', reason, 'currentPlayer:', currentPlayer);

  // Penalidade por faul
  cueBall.potted = false;
  cueBall.x = TABLE_3D.x + 100;
  cueBall.y = TABLE_3D.y + TABLE_3D.height / 2;
  cueBall.vx = 0;
  cueBall.vy = 0;

  // Troca de jogador
  currentPlayer = currentPlayer === 'player' ? 'cpu' : 'player';
  ballsPottedThisTurn = [];

  console.log('[DEBUG] Após foul - novo currentPlayer:', currentPlayer);

  if (currentPlayer === 'cpu') {
    // Mudar estado imediatamente para evitar chamadas repetidas de endTurn/update
    gameState = 'cpu_turn';
    console.log('[DEBUG] Agendando jogada do CPU após foul em 800ms');
    setTimeout(makeCPUMove, 800);
  } else {
    gameState = 'aiming';
    console.log('[DEBUG] Turno do jogador após foul - gameState: aiming');
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
  // Atualizar texto do placar com valores arredondados
  playerScoreEl.textContent = Math.floor(displayedScore.player);
  cpuScoreEl.textContent = Math.floor(displayedScore.cpu);

  // Efeito de brilho no placar quando marca ponto
  if (scoreGlow.player > 0) {
    const intensity = Math.floor(scoreGlow.player * 255);
    playerScoreEl.style.textShadow = `0 0 ${10 + scoreGlow.player * 20}px rgba(74, 222, 128, ${scoreGlow.player})`;
    playerScoreEl.style.color = `rgb(${74 + intensity * 0.5}, ${222}, ${128 + intensity * 0.5})`;
  } else {
    playerScoreEl.style.textShadow = 'none';
    playerScoreEl.style.color = '#4ade80';
  }

  if (scoreGlow.cpu > 0) {
    const intensity = Math.floor(scoreGlow.cpu * 255);
    cpuScoreEl.style.textShadow = `0 0 ${10 + scoreGlow.cpu * 20}px rgba(248, 113, 113, ${scoreGlow.cpu})`;
    cpuScoreEl.style.color = `rgb(${248}, ${113 + intensity * 0.3}, ${113 + intensity * 0.3})`;
  } else {
    cpuScoreEl.style.textShadow = 'none';
    cpuScoreEl.style.color = '#f87171';
  }
}

// ===== Renderização da Mesa 2D Clássica =====
function drawTable3D() {
  // Limpar canvas com fundo escuro
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

  // Dimensões da mesa
  const world = {
    leftX: TABLE_3D.x,
    rightX: TABLE_3D.x + TABLE_3D.width,
    topY: TABLE_3D.y,
    bottomY: TABLE_3D.y + TABLE_3D.height,
    centerX: TABLE_3D.x + TABLE_3D.width / 2,
    centerY: TABLE_3D.y + TABLE_3D.height / 2
  };

  // === 1. BASE DE MADEIRA (estrutura externa) ===
  const woodFrame = 25; // Espessura da moldura de madeira

  // Madeira externa - retângulo arredondado
  ctx.fillStyle = '#4a3728';
  roundRect(ctx, world.leftX - woodFrame, world.topY - woodFrame,
            TABLE_3D.width + woodFrame * 2, TABLE_3D.height + woodFrame * 2, 15);
  ctx.fill();

  // Sombra da base
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 5;

  // Madeira interna (mais clara)
  ctx.fillStyle = '#5c4033';
  roundRect(ctx, world.leftX - 15, world.topY - 15,
            TABLE_3D.width + 30, TABLE_3D.height + 30, 10);
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // === 2. BORDAS EMBORRACHADAS (cushions) ===
  const cushionWidth = 18;
  const cushionColor = '#3d2820';
  const cushionHighlight = '#5a3d2a';

  // Cushion superior
  ctx.fillStyle = cushionColor;
  ctx.fillRect(world.leftX, world.topY, TABLE_3D.width, cushionWidth);
  // Destaque do cushion
  ctx.fillStyle = cushionHighlight;
  ctx.fillRect(world.leftX + cushionWidth, world.topY + 2,
               TABLE_3D.width - cushionWidth * 2, 3);

  // Cushion inferior
  ctx.fillStyle = cushionColor;
  ctx.fillRect(world.leftX, world.bottomY - cushionWidth, TABLE_3D.width, cushionWidth);
  // Destaque do cushion
  ctx.fillStyle = cushionHighlight;
  ctx.fillRect(world.leftX + cushionWidth, world.bottomY - cushionWidth + 2,
               TABLE_3D.width - cushionWidth * 2, 3);

  // Cushion esquerdo
  ctx.fillStyle = cushionColor;
  ctx.fillRect(world.leftX, world.topY, cushionWidth, TABLE_3D.height);
  // Destaque
  ctx.fillStyle = cushionHighlight;
  ctx.fillRect(world.leftX + 2, world.topY + cushionWidth, 3,
               TABLE_3D.height - cushionWidth * 2);

  // Cushion direito
  ctx.fillStyle = cushionColor;
  ctx.fillRect(world.rightX - cushionWidth, world.topY, cushionWidth, TABLE_3D.height);
  // Destaque
  ctx.fillStyle = cushionHighlight;
  ctx.fillRect(world.rightX - cushionWidth + 2, world.topY + cushionWidth, 3,
               TABLE_3D.height - cushionWidth * 2);

  // === 3. FELTRO VERDE (área jogável) ===
  const feltX = world.leftX + cushionWidth;
  const feltY = world.topY + cushionWidth;
  const feltW = TABLE_3D.width - cushionWidth * 2;
  const feltH = TABLE_3D.height - cushionWidth * 2;

  // Gradiente do feltro verde
  const feltGradient = ctx.createLinearGradient(feltX, feltY, feltX, feltY + feltH);
  feltGradient.addColorStop(0, '#1e5945');
  feltGradient.addColorStop(0.5, '#256f52');
  feltGradient.addColorStop(1, '#1e5945');

  ctx.fillStyle = feltGradient;
  ctx.fillRect(feltX, feltY, feltW, feltH);

  // Textura sutil do feltro (linhas cruzadas)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i < feltW; i += 20) {
    ctx.beginPath();
    ctx.moveTo(feltX + i, feltY);
    ctx.lineTo(feltX + i, feltY + feltH);
    ctx.stroke();
  }
  for (let i = 0; i < feltH; i += 20) {
    ctx.beginPath();
    ctx.moveTo(feltX, feltY + i);
    ctx.lineTo(feltX + feltW, feltY + i);
    ctx.stroke();
  }

  // === 4. MARCAÇÕES DA MESA ===
  // Linha de partida (head string)
  const headStringX = feltX + 100;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(headStringX, feltY + 5);
  ctx.lineTo(headStringX, feltY + feltH - 5);
  ctx.stroke();

  // Semicírculo da cabeça (D)
  ctx.beginPath();
  ctx.arc(headStringX, feltY + feltH / 2, 50, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // Marcação do meio
  const midX = feltX + feltW / 2;
  ctx.beginPath();
  ctx.moveTo(midX, feltY);
  ctx.lineTo(midX, feltY + feltH);
  ctx.stroke();

  // Marcações de ponto no meio
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < 5; i++) {
    const y = feltY + feltH / 2 - 40 + i * 20;
    ctx.beginPath();
    ctx.arc(midX, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // === 5. CAÇAPAS ===
  drawPockets3D(ctx, world);
}

// Função auxiliar para desenhar retângulo arredondado
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawPockets3D(ctx, world) {
  const pocketRadius = 20;

  // Posições das 6 caçapas (3 em cima, 3 embaixo)
  const pockets = [
    { x: world.leftX + 30, y: world.topY + 30 },                     // topo-esquerdo
    { x: (world.leftX + world.rightX) / 2, y: world.topY + 22 },     // topo-meio
    { x: world.rightX - 30, y: world.topY + 30 },                    // topo-direito
    { x: world.leftX + 30, y: world.bottomY - 30 },                  // baixo-esquerdo
    { x: (world.leftX + world.rightX) / 2, y: world.bottomY - 22 },  // baixo-meio
    { x: world.rightX - 30, y: world.bottomY - 30 }                  // baixo-direito
  ];

  // Desenhar caçapas circulares pretas com sombra
  for (const pocket of pockets) {
    // Sombra externa da caçapa
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(pocket.x + 2, pocket.y + 2, pocketRadius, 0, Math.PI * 2);
    ctx.fill();

    // Fundo preto da caçapa
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, pocketRadius, 0, Math.PI * 2);
    ctx.fill();

    // Borda da caçapa (tom mais claro)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, pocketRadius - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Profundidade interna (gradiente)
    const pocketGrad = ctx.createRadialGradient(
      pocket.x - 5, pocket.y - 5, 0,
      pocket.x, pocket.y, pocketRadius
    );
    pocketGrad.addColorStop(0, '#1a1a1a');
    pocketGrad.addColorStop(1, '#000000');

    ctx.fillStyle = pocketGrad;
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, pocketRadius - 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Retornar posições para uso na detecção de colisão
  return pockets.map(pocket => ({
    x: pocket.x,
    y: pocket.y,
    radius: pocketRadius,
    scale: 1
  }));
}

function draw() {
  // Desenhar mesa em perspectiva 3D
  drawTable3D();

  // Desenhar bolas em ordem Y (bolas mais distantes primeiro para correto z-ordering)
  const sortedBalls = balls.filter(b => !b.potted).sort((a, b) => a.y - b.y);
  for (const ball of sortedBalls) {
    ball.draw();
  }

  // Desenhar mira (apenas para jogador)
  if (gameState === 'aiming' && currentPlayer === 'player' && aimStart && aimCurrent) {
    drawAimLine3D();
  }

  // Indicador de vez
  ctx.font = 'bold 16px Nunito';
  ctx.textAlign = 'left';
  ctx.fillStyle = currentPlayer === 'player' ? '#4ade80' : '#f87171';
  ctx.fillText(currentPlayer === 'player' ? 'Sua vez' : 'Vez do computador', 40, 40);
}

function drawAimLine3D() {
  const dx = aimStart.x - aimCurrent.x;
  const dy = aimStart.y - aimCurrent.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // Calcular força
  power = Math.min(dist / 10, MAX_POWER);

  // Projetar posição da bola branca
  const cueBallProj = project3D(cueBall.x, cueBall.y, 0);

  // Desenhar taco 3D
  const cueLength = 120 + power * 5; // Comprimento do taco aumenta com a força
  const cueWidth = 4 * cueBallProj.scale; // Largura proporcional à escala 3D

  // Posição do taco (oposta à direção da mira)
  const cueDistance = 30 * cueBallProj.scale; // Distância da bola
  const cueStartX = cueBallProj.x - Math.cos(angle) * cueDistance;
  const cueStartY = cueBallProj.y - Math.sin(angle) * cueDistance;

  // Ponta do taco (próxima à bola)
  const tipX = cueStartX + Math.cos(angle) * cueLength;
  const tipY = cueStartY + Math.sin(angle) * cueLength;

  // Desenhar sombra do taco
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  const shadowOffset = 3 * cueBallProj.scale;
  ctx.ellipse(cueStartX + shadowOffset, cueStartY + shadowOffset + 10 * cueBallProj.scale, cueLength * 0.5, cueWidth * 0.5, angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Corpo do taco (gradiente de madeira)
  const cueGradient = ctx.createLinearGradient(
    cueStartX - Math.sin(angle) * cueWidth,
    cueStartY + Math.cos(angle) * cueWidth,
    cueStartX + Math.sin(angle) * cueWidth,
    cueStartY - Math.cos(angle) * cueWidth
  );
  cueGradient.addColorStop(0, '#d4a574'); // Madeiro claro
  cueGradient.addColorStop(0.5, '#8b6239'); // Madeiro médio
  cueGradient.addColorStop(1, '#5c3d1e'); // Madeiro escuro

  // Desenhar taco como um retângulo arredondado
  ctx.save();
  ctx.translate(cueStartX, cueStartY);
  ctx.rotate(angle);

  // Corpo do taco
  ctx.fillStyle = cueGradient;
  ctx.beginPath();
  ctx.roundRect(0, -cueWidth / 2, cueLength, cueWidth, cueWidth / 2);
  ctx.fill();

  // Ponta do taco (couro)
  ctx.fillStyle = '#2a1810';
  ctx.beginPath();
  ctx.roundRect(cueLength - 8 * cueBallProj.scale, -cueWidth / 2, 8 * cueBallProj.scale, cueWidth, cueWidth / 4);
  ctx.fill();

  // Detalhe dourado na parte de trás
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(5 * cueBallProj.scale, -cueWidth / 2, 15 * cueBallProj.scale, cueWidth);

  ctx.restore();

  // Linha de mira (subtle)
  const lineLength = 60;
  const lineEndX = cueBallProj.x + Math.cos(angle) * lineLength;
  const lineEndY = cueBallProj.y + Math.sin(angle) * lineLength;

  ctx.beginPath();
  ctx.moveTo(cueBallProj.x, cueBallProj.y);
  ctx.lineTo(lineEndX, lineEndY);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + power / MAX_POWER * 0.3})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Círculo de força no final da linha
  ctx.beginPath();
  ctx.arc(lineEndX, lineEndY, 3 + power / 4, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + power / MAX_POWER * 0.4})`;
  ctx.fill();

  // Atualizar barra de força
  const powerPercent = (power / MAX_POWER) * 100;
  // Atualizar height (desktop - vertical) e width (mobile - horizontal)
  powerFill.style.height = `${powerPercent}%`;
  powerFill.style.width = `${powerPercent}%`;

  // Cores: verde (0-40%), amarelo (40-70%), vermelho (70-100%)
  if (powerPercent > 70) {
    powerFill.style.background = '#ef4444';
  } else if (powerPercent > 40) {
    powerFill.style.background = '#fbbf24';
  } else {
    powerFill.style.background = '#22c55e';
  }
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

  // Projetar posição da bola branca para coordenadas de tela
  const cueBallProj = project3D(cueBall.x, cueBall.y, 0);

  const dx = pos.x - cueBallProj.x;
  const dy = pos.y - cueBallProj.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Só inicia mira se clicar perto da bola branca (na tela)
  if (dist < BALL_RADIUS * 4 * cueBallProj.scale) {
    aimStart = { x: cueBall.x, y: cueBall.y };
    // Converter posição do mouse para coordenadas do mundo
    aimCurrent = screenToWorld(pos.x, pos.y);
  }
}

function handleMove(evt) {
  if (!aimStart || gameState !== 'aiming') return;
  evt.preventDefault();
  const pos = getMousePos(evt);
  aimCurrent = screenToWorld(pos.x, pos.y);
}

function handleEnd(evt) {
  if (!aimStart || gameState !== 'aiming') return;
  evt.preventDefault();

  // Recalcular power baseado na distância atual do arrasto
  const dx = aimStart.x - aimCurrent.x;
  const dy = aimStart.y - aimCurrent.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Calcular força baseada na distância (mesma fórmula de drawAimLine3D)
  power = Math.min(dist / 10, MAX_POWER);

  // Atualizar medidor de força
  const powerPercent = (power / MAX_POWER) * 100;
  powerFill.style.height = `${powerPercent}%`;
  powerFill.style.width = `${powerPercent}%`;

  if (powerPercent > 70) {
    powerFill.style.background = '#ef4444';
  } else if (powerPercent > 40) {
    powerFill.style.background = '#fbbf24';
  } else {
    powerFill.style.background = '#22c55e';
  }

  if (power > 1) {
    const angle = Math.atan2(dy, dx);

    // Aplicar velocidade à bola branca
    cueBall.vx = Math.cos(angle) * power;
    cueBall.vy = Math.sin(angle) * power;

    // Som de tacada
    playGameSound(SOUNDS.cueHit);
    playSound('shoot');

    ballsPottedThisTurn = [];
    gameState = 'moving';
  }

  aimStart = null;
  aimCurrent = null;
  power = 0;
  powerFill.style.height = '0%';
  powerFill.style.width = '0%';
}

// Event Listeners
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('mouseup', handleEnd);

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
  updateParticles();
  updatePocketingAnimations();
  updateFloatingTexts();
  draw();
  drawParticles(ctx);
  drawPocketingAnimations(ctx);
  drawFloatingTexts(ctx);
  drawLastPottedBall(ctx);
  requestAnimationFrame(gameLoop);
}

// Iniciar
init();
gameLoop();
