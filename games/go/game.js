import '../../auth-check.js';
import { launchConfetti, playSound, initAudio, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';

const SIZE = 9;
const EMPTY = 0, BLACK = 1, WHITE = 2;
let board, current, captures, lastBoard, consecutivePasses, lastMove;
let isProcessing = false; // Flag para prevenir cliques duplos

const boardEl = document.getElementById('board');
const turnEl = document.getElementById('turn');
const blackScoreEl = document.getElementById('black-score');
const whiteScoreEl = document.getElementById('white-score');
const modal = document.getElementById('modal');
const modalMsg = document.getElementById('modal-msg');

function init() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  lastBoard = null;
  current = BLACK;
  captures = { [BLACK]: 0, [WHITE]: 0 };
  consecutivePasses = 0;
  lastMove = null;
  isProcessing = false;
  modal.style.display = 'none';
  updateUI();
  render();
}

function clone(b) { return b.map(r => [...r]); }

function getGroup(b, r, c) {
  const color = b[r][c];
  if (color === EMPTY) return { stones: [], liberties: new Set() };
  const visited = new Set();
  const stones = [];
  const liberties = new Set();
  const stack = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop();
    const key = `${cr},${cc}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (b[cr][cc] === color) {
      stones.push([cr, cc]);
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = cr + dr, nc = cc + dc;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        if (b[nr][nc] === EMPTY) liberties.add(`${nr},${nc}`);
        else if (b[nr][nc] === color) stack.push([nr, nc]);
      }
    }
  }
  return { stones, liberties };
}

function removeCaptures(b, color) {
  let captured = 0;
  const opponent = color === BLACK ? WHITE : BLACK;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (b[r][c] === opponent) {
        const g = getGroup(b, r, c);
        if (g.liberties.size === 0) {
          g.stones.forEach(([sr, sc]) => { b[sr][sc] = EMPTY; });
          captured += g.stones.length;
        }
      }
    }
  }
  return captured;
}

function isLegal(r, c, color) {
  if (board[r][c] !== EMPTY) return false;
  const testBoard = clone(board);
  testBoard[r][c] = color;
  removeCaptures(testBoard, color);
  // Self-capture check
  const g = getGroup(testBoard, r, c);
  if (g.liberties.size === 0) return false;
  // Ko check
  if (lastBoard && JSON.stringify(testBoard) === JSON.stringify(lastBoard)) return false;
  return true;
}

function playMove(r, c) {
  if (!isLegal(r, c, current)) return false;
  lastBoard = clone(board);
  board[r][c] = current;
  const captured = removeCaptures(board, current);
  if (captured > 0) playSound('capture');
  else playSound('place');
  captures[current] += captured;
  lastMove = [r, c];
  consecutivePasses = 0;
  current = current === BLACK ? WHITE : BLACK;
  return true;
}

function pass() {
  consecutivePasses++;
  lastBoard = clone(board);
  lastMove = null;
  current = current === BLACK ? WHITE : BLACK;
  if (consecutivePasses >= 2) {
    endGame();
    return;
  }
  updateUI();
  if (current === WHITE) setTimeout(cpuMove, 400);
}

function countTerritory() {
  const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  let blackTerritory = 0, whiteTerritory = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY || visited[r][c]) continue;
      const stack = [[r, c]];
      const region = [];
      let touchesBlack = false, touchesWhite = false;
      while (stack.length) {
        const [cr, cc] = stack.pop();
        if (cr < 0 || cr >= SIZE || cc < 0 || cc >= SIZE) continue;
        if (visited[cr][cc]) continue;
        if (board[cr][cc] === BLACK) { touchesBlack = true; continue; }
        if (board[cr][cc] === WHITE) { touchesWhite = true; continue; }
        visited[cr][cc] = true;
        region.push([cr, cc]);
        stack.push([cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1]);
      }
      if (touchesBlack && !touchesWhite) blackTerritory += region.length;
      if (touchesWhite && !touchesBlack) whiteTerritory += region.length;
    }
  }
  return { blackTerritory, whiteTerritory };
}

async function endGame() {
  const { blackTerritory, whiteTerritory } = countTerritory();
  const blackTotal = blackTerritory + captures[BLACK];
  const whiteTotal = whiteTerritory + captures[WHITE] + 6.5; // Komi
  let result, msg;
  if (blackTotal > whiteTotal) {
    result = 'win';
    msg = `🏆 Preto vence!\n\nPreto: ${blackTotal.toFixed(1)} pts\nBranco: ${whiteTotal.toFixed(1)} pts`;
    launchConfetti();
    playSound('win');
  } else {
    result = 'loss';
    msg = `😔 Branco vence!\n\nPreto: ${blackTotal.toFixed(1)} pts\nBranco: ${whiteTotal.toFixed(1)} pts`;
  }
  modalMsg.textContent = msg;
  modal.style.display = 'flex';

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('game_stats').insert({
      user_id: session.user.id, game: 'go', result, moves: 0, time_seconds: 0
    });
  }
}

function cpuMove() {
  // Simple AI: try captures, then play near existing stones, then random
  let best = null;
  let bestScore = -1;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isLegal(r, c, WHITE)) continue;
      let score = Math.random() * 2;
      // Prefer center
      score += (4 - Math.abs(r - 4)) * 0.3 + (4 - Math.abs(c - 4)) * 0.3;
      // Check captures
      const testBoard = clone(board);
      testBoard[r][c] = WHITE;
      const caps = removeCaptures(testBoard, WHITE);
      score += caps * 10;
      // Adjacent to own stones
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === WHITE) score += 2;
      }
      if (score > bestScore) { bestScore = score; best = [r, c]; }
    }
  }

  if (best) {
    playMove(best[0], best[1]);
    updateUI();
    render();
  } else {
    pass();
  }
  isProcessing = false;
}

function handleClick(r, c) {
  if (current !== BLACK || isProcessing) return;
  isProcessing = true;
  initAudio();
  if (!playMove(r, c)) {
    isProcessing = false;
    return;
  }
  playSound('move');
  haptic(15);
  updateUI();
  render();
  // Delay mínimo de 800ms para jogadas da IA
  setTimeout(cpuMove, 800);
}

function updateUI() {
  const gameContainer = document.getElementById('game-container') || document.body;
  if (current === BLACK) {
    turnEl.textContent = 'Sua vez (Preto)';
    gameContainer.classList.remove('thinking');
  } else {
    turnEl.textContent = 'Computador pensando...';
    gameContainer.classList.add('thinking');
  }
  blackScoreEl.textContent = captures[BLACK];
  whiteScoreEl.textContent = captures[WHITE];
}

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (board[r][c] !== EMPTY) {
        const stone = document.createElement('div');
        stone.className = `stone ${board[r][c] === BLACK ? 'black' : 'white'}`;
        if (lastMove && lastMove[0] === r && lastMove[1] === c) stone.classList.add('last');
        cell.appendChild(stone);
      }
      cell.addEventListener('click', () => handleClick(r, c));
      boardEl.appendChild(cell);
    }
  }
}

document.getElementById('pass-btn').addEventListener('click', () => {
  if (current !== BLACK) return;
  initAudio();
  playSound('click');
  consecutivePasses++;
  lastBoard = clone(board);
  lastMove = null;
  current = WHITE;
  updateUI();
  if (consecutivePasses >= 2) { endGame(); return; }
  setTimeout(cpuMove, 400);
});

document.getElementById('restart').addEventListener('click', () => { initAudio(); playSound('click'); init(); });
document.getElementById('modal-btn').addEventListener('click', () => { initAudio(); playSound('click'); init(); });

init();
