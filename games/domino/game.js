import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';

// ===== CONSTANTS =====
const DOTS = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

// ===== STATE =====
let chain = [];        // [{a, b, flipped}] – flipped: b is the exposed left end (or right end depending on position)
let leftEnd = null;   // value at left open end of chain
let rightEnd = null;  // value at right open end of chain
let playerHand = [];
let aiHand = [];
let boneyard = [];
let currentTurn = 'player'; // 'player' | 'ai'
let gameOver = false;
let selectedTile = null;    // index into playerHand
let consecutivePasses = 0;
let playerMoves = 0;
let gameStartTime = null;
let timerInterval = null;
let wins = 0;
let totalScore = 0;

// ===== DOM REFS =====
const chainArea      = document.getElementById('chain-area');
const chainEmpty     = document.getElementById('chain-empty');
const handArea       = document.getElementById('hand-area');
const leftEndBadge   = document.getElementById('left-end-badge');
const rightEndBadge  = document.getElementById('right-end-badge');
const turnIndicator  = document.getElementById('turn-indicator');
const btnDraw        = document.getElementById('btn-draw');
const btnPass        = document.getElementById('btn-pass');
const btnPlaceLeft   = document.getElementById('btn-place-left');
const btnPlaceRight  = document.getElementById('btn-place-right');
const btnNewGame     = document.getElementById('btn-new-game');
const btnPlayAgain   = document.getElementById('btn-play-again');
const modalOverlay   = document.getElementById('modal-overlay');
const modalIcon      = document.getElementById('modal-icon');
const modalTitle     = document.getElementById('modal-title');
const modalMsg       = document.getElementById('modal-msg');
const modalScore     = document.getElementById('modal-score');
const playerCountEl  = document.getElementById('player-count');
const boneyardTopEl  = document.getElementById('boneyard-count-top');
const aiCountTopEl   = document.getElementById('ai-count-top');
const timerDisplay   = document.getElementById('timer-display');
const scoreVal       = document.getElementById('score-val');
const winsVal        = document.getElementById('wins-val');

// ===== TILE BUILDING =====
function buildFullSet() {
  const tiles = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ a, b });
    }
  }
  return tiles;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pipTotal(hand) {
  return hand.reduce((s, t) => s + t.a + t.b, 0);
}

// ===== INIT GAME =====
function initGame() {
  gameOver = false;
  selectedTile = null;
  consecutivePasses = 0;
  playerMoves = 0;
  chain = [];
  leftEnd = null;
  rightEnd = null;

  const all = shuffle(buildFullSet());
  playerHand = all.slice(0, 7);
  aiHand = all.slice(7, 14);
  boneyard = all.slice(14);

  // Determine who goes first: player with [6,6], else highest double, else highest tile
  const firstPlayer = determineFirstPlayer();
  currentTurn = firstPlayer;

  startTimer();
  renderAll();
  updateEndBadges();
  updateTopBar();

  if (currentTurn === 'ai') {
    setTurnIndicator('ai');
    setTimeout(aiTurn, 1000);
  } else {
    setTurnIndicator('player');
  }
}

function determineFirstPlayer() {
  // Find highest double: check [6,6], [5,5], ... for both players
  for (let d = 6; d >= 0; d--) {
    const pi = playerHand.findIndex(t => t.a === d && t.b === d);
    const ai = aiHand.findIndex(t => t.a === d && t.b === d);
    if (pi !== -1 || ai !== -1) {
      // Player holds this double?
      if (pi !== -1) return 'player';
      return 'ai';
    }
  }
  // No doubles: player with highest single tile goes first
  const playerMax = Math.max(...playerHand.map(t => t.a + t.b));
  const aiMax = Math.max(...aiHand.map(t => t.a + t.b));
  return playerMax >= aiMax ? 'player' : 'ai';
}

// ===== TIMER =====
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  gameStartTime = Date.now();
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimer() {
  if (!gameStartTime) return;
  const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  timerDisplay.textContent = `⏱ ${m}:${s}`;
}

function elapsedSeconds() {
  return gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
}

// ===== RENDER =====
function renderAll() {
  renderChain();
  renderHand();
  renderButtons();
}

function renderChain() {
  if (chain.length === 0) {
    chainEmpty.style.display = '';
    // remove all tiles except chainEmpty
    [...chainArea.children].forEach(el => {
      if (el !== chainEmpty) el.remove();
    });
    return;
  }
  chainEmpty.style.display = 'none';

  // Clear and re-render
  chainArea.innerHTML = '';
  chain.forEach((tile, idx) => {
    const el = createTileEl(tile.a, tile.b, 'chain-tile');
    if (idx === chain.length - 1) el.classList.add('new-tile');
    chainArea.appendChild(el);
  });

  // Auto-scroll to end
  chainArea.parentElement.scrollLeft = chainArea.parentElement.scrollWidth;
}

function renderHand() {
  handArea.innerHTML = '';
  const validLeft  = leftEnd === null ? Array.from({length: playerHand.length}, (_, i) => i)
                                      : playerHand.map((t, i) => canFitEnd(t, leftEnd) ? i : -1).filter(i => i !== -1);
  const validRight = leftEnd === null ? Array.from({length: playerHand.length}, (_, i) => i)
                                      : playerHand.map((t, i) => canFitEnd(t, rightEnd) ? i : -1).filter(i => i !== -1);
  const validSet   = new Set([...validLeft, ...validRight]);

  playerHand.forEach((tile, i) => {
    const el = createTileEl(tile.a, tile.b, 'hand-tile');
    if (i === selectedTile) el.classList.add('selected');
    if (validSet.has(i) && chain.length > 0) el.classList.add('valid-move');
    el.addEventListener('click', () => onTileClick(i));
    handArea.appendChild(el);
  });

  playerCountEl.textContent = playerHand.length;
}

function renderButtons() {
  if (gameOver || currentTurn !== 'player') {
    btnDraw.classList.add('hidden');
    btnPass.classList.add('hidden');
    btnPlaceLeft.classList.add('hidden');
    btnPlaceRight.classList.add('hidden');
    return;
  }

  const hasValid = playerHasValidMove();

  if (hasValid) {
    btnDraw.classList.add('hidden');
    btnPass.classList.add('hidden');
  } else if (boneyard.length > 0) {
    btnDraw.classList.remove('hidden');
    btnPass.classList.add('hidden');
  } else {
    btnDraw.classList.add('hidden');
    btnPass.classList.remove('hidden');
  }

  // Place buttons: show if a tile is selected and it fits ends
  if (selectedTile !== null) {
    const tile = playerHand[selectedTile];
    const fitsLeft  = leftEnd === null || canFitEnd(tile, leftEnd);
    const fitsRight = rightEnd === null || canFitEnd(tile, rightEnd);

    if (chain.length === 0) {
      // First tile: only one button needed, use right to place
      btnPlaceLeft.classList.add('hidden');
      btnPlaceRight.classList.remove('hidden');
      btnPlaceRight.textContent = 'Colocar ✓';
    } else if (fitsLeft && fitsRight) {
      btnPlaceLeft.classList.remove('hidden');
      btnPlaceRight.classList.remove('hidden');
      btnPlaceRight.textContent = 'Direita ➡';
    } else if (fitsLeft) {
      btnPlaceLeft.classList.remove('hidden');
      btnPlaceRight.classList.add('hidden');
    } else if (fitsRight) {
      btnPlaceLeft.classList.add('hidden');
      btnPlaceRight.classList.remove('hidden');
      btnPlaceRight.textContent = 'Direita ➡';
    } else {
      btnPlaceLeft.classList.add('hidden');
      btnPlaceRight.classList.add('hidden');
    }
  } else {
    btnPlaceLeft.classList.add('hidden');
    btnPlaceRight.classList.add('hidden');
  }
}

function createTileEl(a, b, cls) {
  const el = document.createElement('div');
  el.className = `domino ${cls}`;

  const halfA = createHalf(a);
  const divider = document.createElement('div');
  divider.className = 'divider-h';
  const halfB = createHalf(b);

  el.appendChild(halfA);
  el.appendChild(divider);
  el.appendChild(halfB);
  return el;
}

function createHalf(pips) {
  const half = document.createElement('div');
  half.className = 'half';
  const filled = new Set(DOTS[pips]);
  for (let pos = 0; pos < 9; pos++) {
    const dot = document.createElement('div');
    dot.className = filled.has(pos) ? 'dot' : 'dot hidden-dot';
    half.appendChild(dot);
  }
  return half;
}

function updateEndBadges() {
  if (leftEnd === null) {
    leftEndBadge.textContent  = '— ?';
    rightEndBadge.textContent = '? —';
  } else {
    leftEndBadge.textContent  = `← ${leftEnd}`;
    rightEndBadge.textContent = `${rightEnd} →`;
  }
}

function updateTopBar() {
  boneyardTopEl.textContent = `🁣 ${boneyard.length}`;
  aiCountTopEl.textContent  = `🤖 ${aiHand.length}`;
  scoreVal.textContent      = totalScore;
  winsVal.textContent       = wins;
}

function setTurnIndicator(who, thinking = false) {
  if (thinking) {
    turnIndicator.textContent = 'IA pensando…';
    turnIndicator.className = 'turn-indicator thinking';
  } else if (who === 'player') {
    turnIndicator.textContent = 'Sua vez';
    turnIndicator.className = 'turn-indicator';
  } else {
    turnIndicator.textContent = 'Vez da IA';
    turnIndicator.className = 'turn-indicator ai-turn';
  }
}

// ===== GAME LOGIC =====
function canFitEnd(tile, endVal) {
  return tile.a === endVal || tile.b === endVal;
}

function playerHasValidMove() {
  if (chain.length === 0) return true; // any tile can start
  return playerHand.some(t => canFitEnd(t, leftEnd) || canFitEnd(t, rightEnd));
}

function aiHasValidMove() {
  if (chain.length === 0) return aiHand.length > 0;
  return aiHand.some(t => canFitEnd(t, leftEnd) || canFitEnd(t, rightEnd));
}

/**
 * Place a tile onto the chain.
 * side: 'left' | 'right'
 * Returns false if invalid.
 */
function placeTile(tile, tileIndex, hand, side) {
  if (chain.length === 0) {
    // First tile placed
    chain.push({ a: tile.a, b: tile.b, flipped: false });
    leftEnd  = tile.a;
    rightEnd = tile.b;
  } else if (side === 'left') {
    if (!canFitEnd(tile, leftEnd)) return false;
    // Orient: the side matching leftEnd goes against the chain
    const flipped = tile.b === leftEnd; // if b matches, place a as new end
    chain.unshift({ a: tile.a, b: tile.b, flipped });
    leftEnd = flipped ? tile.a : tile.b;
  } else {
    if (!canFitEnd(tile, rightEnd)) return false;
    const flipped = tile.a === rightEnd; // if a matches, place b as new end
    chain.push({ a: tile.a, b: tile.b, flipped });
    rightEnd = flipped ? tile.b : tile.a;
  }

  hand.splice(tileIndex, 1);
  return true;
}

// ===== PLAYER ACTIONS =====
function onTileClick(idx) {
  if (gameOver || currentTurn !== 'player') return;

  const tile = playerHand[idx];

  // If chain is empty, auto-place on click
  if (chain.length === 0) {
    selectedTile = idx;
    doPlayerPlace('right');
    return;
  }

  const fitsLeft  = canFitEnd(tile, leftEnd);
  const fitsRight = canFitEnd(tile, rightEnd);

  if (!fitsLeft && !fitsRight) return; // tile doesn't fit anywhere

  if (fitsLeft && fitsRight) {
    // Need player to choose: select
    selectedTile = idx;
    renderHand();
    renderButtons();
    return;
  }

  // Only fits one end: auto-place
  selectedTile = idx;
  doPlayerPlace(fitsLeft ? 'left' : 'right');
}

function doPlayerPlace(side) {
  if (selectedTile === null) return;
  const tile = playerHand[selectedTile];
  const ok = placeTile(tile, selectedTile, playerHand, side);
  if (!ok) return;

  playerMoves++;
  consecutivePasses = 0;
  selectedTile = null;
  playSound('move');
  haptic(15);

  updateEndBadges();
  updateTopBar();
  renderAll();

  if (checkWin('player')) return;
  endPlayerTurn();
}

function endPlayerTurn() {
  currentTurn = 'ai';
  setTurnIndicator('ai', true);
  renderButtons();
  setTimeout(aiTurn, 900);
}

btnPlaceLeft.addEventListener('click', () => doPlayerPlace('left'));
btnPlaceRight.addEventListener('click', () => doPlayerPlace('right'));

btnDraw.addEventListener('click', () => {
  if (gameOver || currentTurn !== 'player') return;
  if (boneyard.length === 0) return;
  drawFromBoneyard(playerHand);
  updateTopBar();
  renderHand();
  renderButtons();
  // If player now has a valid move, let them play; else check again
  if (!playerHasValidMove() && boneyard.length === 0) {
    // Must pass
    btnPass.classList.remove('hidden');
    btnDraw.classList.add('hidden');
  }
});

btnPass.addEventListener('click', () => {
  if (gameOver || currentTurn !== 'player') return;
  consecutivePasses++;
  if (consecutivePasses >= 2) {
    resolveBlocked();
    return;
  }
  selectedTile = null;
  endPlayerTurn();
});

btnNewGame.addEventListener('click', () => {
  stopTimer();
  initGame();
});

btnPlayAgain.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
  stopTimer();
  initGame();
});

// ===== DRAW FROM BONEYARD =====
function drawFromBoneyard(hand) {
  if (boneyard.length === 0) return null;
  const tile = boneyard.pop();
  hand.push(tile);
  return tile;
}

// ===== AI TURN =====
function aiTurn() {
  if (gameOver) return;

  setTurnIndicator('ai', true);

  setTimeout(() => {
    if (chain.length === 0) {
      // AI places highest value tile as first
      const bestIdx = findBestTileIdx(aiHand);
      placeTile(aiHand[bestIdx], bestIdx, aiHand, 'right');
      consecutivePasses = 0;
    } else if (aiHasValidMove()) {
      // Find best playable tile
      const move = findBestAiMove();
      if (move) {
        placeTile(aiHand[move.idx], move.idx, aiHand, move.side);
        consecutivePasses = 0;
      }
    } else {
      // Draw until valid or empty
      let drew = false;
      while (boneyard.length > 0) {
        const t = drawFromBoneyard(aiHand);
        if (canFitEnd(t, leftEnd) || canFitEnd(t, rightEnd)) {
          drew = true;
          break;
        }
      }

      if (!drew) {
        // Pass
        consecutivePasses++;
        if (consecutivePasses >= 2) {
          updateEndBadges();
          updateTopBar();
          renderAll();
          resolveBlocked();
          return;
        }
      } else {
        // Now play the drawn tile
        const move = findBestAiMove();
        if (move) {
          placeTile(aiHand[move.idx], move.idx, aiHand, move.side);
          consecutivePasses = 0;
        }
      }
    }

    updateEndBadges();
    updateTopBar();
    renderAll();

    if (checkWin('ai')) return;

    currentTurn = 'player';
    setTurnIndicator('player');
    renderButtons();
  }, 400);
}

function findBestTileIdx(hand) {
  let best = 0;
  let bestVal = -1;
  hand.forEach((t, i) => {
    const val = t.a + t.b;
    if (val > bestVal) { bestVal = val; best = i; }
  });
  return best;
}

function findBestAiMove() {
  let bestMove = null;
  let bestVal  = -1;

  aiHand.forEach((tile, idx) => {
    const fitsLeft  = canFitEnd(tile, leftEnd);
    const fitsRight = canFitEnd(tile, rightEnd);
    const val = tile.a + tile.b;

    if (fitsLeft && val > bestVal) {
      bestVal  = val;
      bestMove = { idx, side: 'left' };
    }
    if (fitsRight && val > bestVal) {
      bestVal  = val;
      bestMove = { idx, side: 'right' };
    }
  });

  return bestMove;
}

// ===== WIN / END =====
function checkWin(who) {
  const hand = who === 'player' ? playerHand : aiHand;
  if (hand.length === 0) {
    const opponentPips = who === 'player' ? pipTotal(aiHand) : pipTotal(playerHand);
    endGame(who, opponentPips);
    return true;
  }
  return false;
}

function resolveBlocked() {
  const playerPips = pipTotal(playerHand);
  const aiPips     = pipTotal(aiHand);
  stopTimer();

  if (playerPips < aiPips) {
    endGame('player', aiPips - playerPips);
  } else if (aiPips < playerPips) {
    endGame('ai', playerPips - aiPips);
  } else {
    endGame('draw', 0);
  }
}

function endGame(winner, score) {
  gameOver = true;
  stopTimer();
  renderButtons();

  const elapsed = elapsedSeconds();

  if (winner === 'player') {
    wins++;
    totalScore += score;
    winsVal.textContent  = wins;
    scoreVal.textContent = totalScore;

    modalIcon.textContent  = '🏆';
    modalTitle.textContent = 'Você venceu!';
    modalMsg.textContent   = `Pontuação: ${score} pinos do adversário.`;
    modalScore.textContent = `Total acumulado: ${totalScore} pts`;
    launchConfetti();
    playSound('win');

    // Save to Supabase
    saveStats(score, playerMoves, elapsed);
  } else if (winner === 'ai') {
    modalIcon.textContent  = '😞';
    modalTitle.textContent = 'IA venceu!';
    modalMsg.textContent   = `Você ainda tinha ${pipTotal(playerHand)} pinos.`;
    modalScore.textContent = `Continue treinando!`;
  } else {
    modalIcon.textContent  = '🤝';
    modalTitle.textContent = 'Empate!';
    modalMsg.textContent   = `Jogo bloqueado — mesma contagem de pinos.`;
    modalScore.textContent = ``;
  }

  modalOverlay.classList.remove('hidden');
}

async function saveStats(score, moves, timeSeconds) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('game_stats').insert({
      user_id:      user.id,
      game:         'domino',
      result:       'win',
      score:        score,
      moves:        moves,
      time_seconds: timeSeconds
    });
  } catch (_) {
    // silently ignore stats errors
  }
}

// ===== KICK OFF =====
initGame();
