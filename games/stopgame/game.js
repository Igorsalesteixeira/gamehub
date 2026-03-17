import { supabase } from '../../supabase.js';

const CATEGORIES = ['Nome', 'Animal', 'Fruta', 'Cidade', 'Objeto', 'Cor'];
const LETTERS = 'ABCDEFGHIJLMNOPRS'.split('');

let currentLetter, timerSeconds, timerInterval, round, totalScore, roundActive;

const letterEl = document.getElementById('letter');
const timerEl = document.getElementById('timer');
const roundEl = document.getElementById('round');
const scoreEl = document.getElementById('score');
const catsEl = document.getElementById('categories');
const resultsEl = document.getElementById('results');

function init() {
  round = 1;
  totalScore = 0;
  scoreEl.textContent = '0';
  newRound();
}

function newRound() {
  currentLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  letterEl.textContent = currentLetter;
  roundEl.textContent = round;
  timerSeconds = 60;
  timerEl.textContent = '60';
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
      if (e.key === 'Enter') {
        if (i < inputs.length - 1) inputs[i + 1].focus();
        else stopRound();
      }
    });
  });

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSeconds--;
    timerEl.textContent = timerSeconds;
    if (timerSeconds <= 10) timerEl.classList.add('urgent');
    if (timerSeconds <= 0) stopRound();
  }, 1000);
}

function stopRound() {
  if (!roundActive) return;
  roundActive = false;
  clearInterval(timerInterval);

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

  resultsEl.innerHTML = `<h3>Rodada ${round}: +${roundScore} pontos</h3><p>Total: ${totalScore} pontos</p>`;
  resultsEl.style.display = 'block';
  round++;
}

document.getElementById('stop-btn').addEventListener('click', stopRound);
document.getElementById('new-round').addEventListener('click', () => {
  if (roundActive) stopRound();
  saveStats();
  newRound();
});

async function saveStats() {
  if (totalScore === 0) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('game_stats').insert({
      user_id: session.user.id, game: 'stopgame', result: 'win', score: totalScore, moves: totalScore, time_seconds: 0
    });
  }
}

init();
