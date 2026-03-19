import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, initAudio } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { createCountdown } from '../shared/timer.js';

// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

const CATEGORIES = ['Nome', 'Animal', 'Fruta', 'Cidade', 'Objeto', 'Cor'];
const LETTERS = 'ABCDEFGHIJLMNOPRS'.split('');

let currentLetter, round, totalScore, roundActive;

const letterEl = document.getElementById('letter');
const timerEl = document.getElementById('timer');
const roundEl = document.getElementById('round');
const scoreEl = document.getElementById('score');
const catsEl = document.getElementById('categories');
const resultsEl = document.getElementById('results');

// GameStats e GameTimer (countdown)
const gameStats = new GameStats('stopgame', { autoSync: true });
let countdownTimer = null;

function init() {
  round = 1;
  totalScore = 0;
  scoreEl.textContent = '0';
  newRound();
}

let audioInitialized = false;

function initAudioOnFirstInteraction() {
  if (!audioInitialized) {
    initAudio();
    audioInitialized = true;
  }
}

function newRound() {
  currentLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  letterEl.textContent = currentLetter;
  roundEl.textContent = round;
  timerEl.classList.remove('urgent');
  roundActive = true;
  resultsEl.style.display = 'none';

  catsEl.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <span class="cat-label">${cat}</span>
      <input type="text" class="cat-input" data-cat="${cat}" placeholder="${cat} com ${currentLetter}..." maxlength="30">
      <span class="cat-result" data-result="${cat}"></span>
    `;
    catsEl.appendChild(row);
  });

  // Focus first input
  catsEl.querySelector('.cat-input').focus();

  // Tab navigation between inputs
  const inputs = catsEl.querySelectorAll('.cat-input');
  inputs.forEach((input, i) => {
    input.addEventListener('keydown', (e) => {
      initAudioOnFirstInteraction();
      playSound('type');
      if (e.key === 'Enter') {
        if (i < inputs.length - 1) inputs[i + 1].focus();
        else stopRound();
      }
    });
  });

  // Cria countdown de 60 segundos
  if (countdownTimer) countdownTimer.destroy();
  countdownTimer = createCountdown(60, {
    onTick: (time) => {
      timerEl.textContent = time;
      if (time <= 10) {
        timerEl.classList.add('urgent');
        if (time > 0) playSound('tick');
      }
    },
    onMaxTime: () => {
      stopRound();
    }
  });
  countdownTimer.start();
}

function stopRound() {
  if (!roundActive) return;
  roundActive = false;
  if (countdownTimer) countdownTimer.stop();

  const inputs = catsEl.querySelectorAll('.cat-input');
  let roundScore = 0;

  inputs.forEach(input => {
    input.disabled = true;
    const cat = input.dataset.cat;
    const answer = input.value.trim();
    const resultEl = catsEl.querySelector(`[data-result="${cat}"]`);

    if (answer.length > 0 && answer.toUpperCase().startsWith(currentLetter)) {
      roundScore += 10;
      resultEl.textContent = '+10';
      resultEl.className = 'cat-result valid';
    } else if (answer.length > 0) {
      resultEl.textContent = '✗';
      resultEl.className = 'cat-result invalid';
    } else {
      resultEl.textContent = '0';
      resultEl.className = 'cat-result invalid';
    }
  });

  totalScore += roundScore;
  scoreEl.textContent = totalScore;

  resultsEl.innerHTML = `<h3>Rodada ${round}: +${roundScore} pontos</h3><p>Total: ${totalScore} pontos</p><button class="btn btn-secondary" id="btn-share" style="margin-top:10px;">Compartilhar no WhatsApp</button>`;
  resultsEl.style.display = 'block';
  round++;

  // Celebrate good rounds
  if (roundScore >= 40) {
    launchConfetti();
    playSound('win');
  }

  // Setup WhatsApp share button
  const shareBtn = document.getElementById('btn-share');
  if (shareBtn) {
    shareBtn.onclick = () => {
      const text = `🎮 Joguei Stop no Games Hub! Rodada ${round - 1}: +${roundScore} pontos. Total: ${totalScore} pontos. Jogue você também! 🎮 https://gameshub.com.br/games/stopgame/`;
      shareOnWhatsApp(text);
    };
  }
}

document.getElementById('stop-btn').addEventListener('click', () => {
  playSound('click');
  stopRound();
});
document.getElementById('new-round').addEventListener('click', () => {
  playSound('click');
  if (roundActive) stopRound();
  saveStats();
  newRound();
});

async function saveStats() {
  if (totalScore === 0) return;
  gameStats.recordGame(true, { score: totalScore, moves: totalScore });
}

init();
