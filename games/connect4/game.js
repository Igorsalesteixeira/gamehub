import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';

const ROWS = 6, COLS = 7;
let board, currentPlayer, gameOver;
let lastDrop = null; // { row, col } da última jogada para animação
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const modal = document.getElementById('modal');
const modalMsg = document.getElementById('modal-msg');

function init() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  currentPlayer = 1;
  gameOver = false;
  lastDrop = null;
  statusEl.textContent = 'Sua vez! Clique em uma coluna.';
  modal.style.display = 'none';
  render();
}

function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (board[r][c] === 1) cell.classList.add('red');
      if (board[r][c] === 2) cell.classList.add('yellow');

      // Animação de queda para a peça recém colocada
      if (lastDrop && lastDrop.row === r && lastDrop.col === c) {
        cell.style.setProperty('--rows', r + 1);
        cell.classList.add('dropping');
      }

      cell.addEventListener('click', () => handleClick(c));
      cell.addEventListener('mouseenter', () => highlightCol(c, true));
      cell.addEventListener('mouseleave', () => highlightCol(c, false));
      cell.dataset.row = r;
      cell.dataset.col = c;
      boardEl.appendChild(cell);
    }
  }
}

function highlightCol(col, on) {
  if (gameOver || currentPlayer !== 1) return;
  boardEl.querySelectorAll('[data-col="' + col + '"]').forEach(el => {
    el.classList.toggle('col-hover', on && !el.classList.contains('red') && !el.classList.contains('yellow'));
  });
}

function getAvailableRow(col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

function drop(col, player) {
  const row = getAvailableRow(col);
  if (row === -1) return -1;
  board[row][col] = player;
  lastDrop = { row, col };
  playSound('move');
  haptic(15);
  return row;
}

function checkWin(player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of dirs) {
        let cells = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

function isFull() {
  return board[0].every(c => c !== 0);
}

function handleClick(col) {
  if (gameOver || currentPlayer !== 1) return;
  const row = drop(col, 1);
  if (row === -1) return;
  render();

  const win = checkWin(1);
  if (win) { endGame('win', win); return; }
  if (isFull()) { endGame('draw'); return; }

  currentPlayer = 2;
  statusEl.textContent = 'CPU pensando...';
  setTimeout(cpuMove, 500);
}

function cpuMove() {
  // AI: check win, block, prefer center
  let bestCol = -1;

  // 1. Can CPU win?
  for (let c = 0; c < COLS; c++) {
    const r = getAvailableRow(c);
    if (r === -1) continue;
    board[r][c] = 2;
    if (checkWin(2)) { board[r][c] = 0; bestCol = c; break; }
    board[r][c] = 0;
  }

  // 2. Block player win
  if (bestCol === -1) {
    for (let c = 0; c < COLS; c++) {
      const r = getAvailableRow(c);
      if (r === -1) continue;
      board[r][c] = 1;
      if (checkWin(1)) { board[r][c] = 0; bestCol = c; break; }
      board[r][c] = 0;
    }
  }

  // 3. Prefer center columns
  if (bestCol === -1) {
    const order = [3, 2, 4, 1, 5, 0, 6];
    for (const c of order) {
      if (getAvailableRow(c) !== -1) { bestCol = c; break; }
    }
  }

  drop(bestCol, 2);
  render();

  const win = checkWin(2);
  if (win) { endGame('loss', win); return; }
  if (isFull()) { endGame('draw'); return; }

  currentPlayer = 1;
  statusEl.textContent = 'Sua vez! Clique em uma coluna.';
}

async function endGame(result, winCells) {
  gameOver = true;
  if (winCells) {
    winCells.forEach(([r, c]) => {
      const idx = r * COLS + c;
      boardEl.children[idx].classList.add('win');
    });
  }

  const msgs = { win: '🏆 Você venceu!', loss: '😔 CPU venceu!', draw: '🤝 Empate!' };
  modalMsg.textContent = msgs[result];
  setTimeout(() => { modal.style.display = 'flex'; }, 600);

  if (result === 'win') {
    launchConfetti();
    playSound('win');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'connect4',
      result: result,
      moves: 0,
      time_seconds: 0
    });
  }
}

document.getElementById('restart').addEventListener('click', init);
document.getElementById('modal-btn').addEventListener('click', init);

init();
