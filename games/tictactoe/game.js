import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';

// === State ===
const PLAYER = 'X';
const CPU = 'O';
const WIN_COMBOS = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6],         // diags
];

let board = Array(9).fill(null);
let gameOver = false;
let scores = { player: 0, cpu: 0, draw: 0 };

// === DOM ===
const cells = document.querySelectorAll('.cell');
const turnIndicator = document.getElementById('turn-indicator');
const scorePlayer = document.getElementById('score-player');
const scoreCpu = document.getElementById('score-cpu');
const scoreDraw = document.getElementById('score-draw');
const btnNewGame = document.getElementById('btn-new-game');
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const btnModalNew = document.getElementById('btn-modal-new');

// === Init ===
function init() {
  board = Array(9).fill(null);
  gameOver = false;
  cells.forEach(cell => {
    cell.textContent = '';
    cell.className = 'cell';
  });
  setTurn('player');
}

function setTurn(who) {
  turnIndicator.classList.remove('player-turn', 'cpu-turn');
  if (who === 'player') {
    turnIndicator.textContent = 'Sua vez!';
    turnIndicator.classList.add('player-turn');
  } else {
    turnIndicator.textContent = 'Vez do computador...';
    turnIndicator.classList.add('cpu-turn');
  }
}

// === Player Move ===
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    const idx = parseInt(cell.dataset.index);
    if (gameOver || board[idx] !== null) return;

    makeMove(idx, PLAYER);

    const result = checkResult();
    if (result) {
      endGame(result);
      return;
    }

    setTurn('cpu');
    // Small delay for CPU "thinking"
    setTimeout(() => {
      if (gameOver) return;
      const cpuIdx = cpuMove();
      makeMove(cpuIdx, CPU);

      const result2 = checkResult();
      if (result2) {
        endGame(result2);
        return;
      }
      setTurn('player');
    }, 400);
  });
});

function makeMove(idx, symbol) {
  board[idx] = symbol;
  const cell = cells[idx];
  cell.textContent = symbol;
  cell.classList.add('taken', symbol.toLowerCase(), 'pop');
  playSound('move');
  haptic(15);
}

// === CPU AI ===
function cpuMove() {
  // 1. Try to win
  const winMove = findBestMove(CPU);
  if (winMove !== -1) return winMove;

  // 2. Block player
  const blockMove = findBestMove(PLAYER);
  if (blockMove !== -1) return blockMove;

  // 3. Center
  if (board[4] === null) return 4;

  // 4. Corners
  const corners = [0, 2, 6, 8].filter(i => board[i] === null);
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];

  // 5. Edges
  const edges = [1, 3, 5, 7].filter(i => board[i] === null);
  if (edges.length > 0) return edges[Math.floor(Math.random() * edges.length)];

  return -1;
}

function findBestMove(symbol) {
  for (const combo of WIN_COMBOS) {
    const values = combo.map(i => board[i]);
    const symbolCount = values.filter(v => v === symbol).length;
    const emptyCount = values.filter(v => v === null).length;
    if (symbolCount === 2 && emptyCount === 1) {
      return combo[values.indexOf(null)];
    }
  }
  return -1;
}

// === Win / Draw Detection ===
function checkResult() {
  for (const combo of WIN_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return { type: board[a] === PLAYER ? 'win' : 'loss', combo };
    }
  }
  if (board.every(cell => cell !== null)) {
    return { type: 'draw', combo: null };
  }
  return null;
}

// === End Game ===
function endGame(result) {
  gameOver = true;

  if (result.combo) {
    result.combo.forEach(i => cells[i].classList.add('winner'));
  }

  if (result.type === 'win') {
    scores.player++;
    scorePlayer.textContent = scores.player;
    showModal('🎉', 'Vitoria!', 'Parabens, voce venceu!');
    launchConfetti();
    playSound('win');
  } else if (result.type === 'loss') {
    scores.cpu++;
    scoreCpu.textContent = scores.cpu;
    showModal('😞', 'Derrota!', 'O computador venceu desta vez.');
  } else {
    scores.draw++;
    scoreDraw.textContent = scores.draw;
    showModal('🤝', 'Empate!', 'Ninguem venceu desta vez.');
  }

  turnIndicator.textContent = result.type === 'win' ? 'Voce venceu!' :
    result.type === 'loss' ? 'Computador venceu!' : 'Empate!';
  turnIndicator.classList.remove('player-turn', 'cpu-turn');

  saveGameStat(result.type);
}

// === Modal ===
function showModal(icon, title, msg) {
  modalIcon.textContent = icon;
  modalTitle.textContent = title;
  modalMsg.textContent = msg;
  setTimeout(() => modalOverlay.classList.add('visible'), 600);
}

function hideModal() {
  modalOverlay.classList.remove('visible');
}

// === New Game ===
btnNewGame.addEventListener('click', () => {
  hideModal();
  init();
});

btnModalNew.addEventListener('click', () => {
  hideModal();
  init();
});

// Close modal on backdrop click
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    hideModal();
    init();
  }
});

// === Supabase Stats ===
async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'tictactoe',
      result: result, // 'win', 'loss', 'draw'
      moves: 0,
      time_seconds: 0,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// === Start ===
init();
