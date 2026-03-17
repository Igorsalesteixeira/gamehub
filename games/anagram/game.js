import '../../auth-check.js';
// ===== Anagrama =====
import { supabase } from '../../supabase.js';

const WORD_BANK = {
  'Animais': ['GATO','LOBO','URSO','PATO','RATO','VACA','BURRO','COBRA','TIGRE','LEAO','AGUIA','MACACO','CAVALO','COELHO','RAPOSA','GALINHA','CORUJA','JACARE','CAMELO','TUCANO','GIRAFA','BALEIA','PANTERA','PINGUIM','GOLFINHO','ELEFANTE','TARTARUGA','PAPAGAIO','CACHORRO','BORBOLETA'],
  'Frutas': ['UVA','FIGO','PERA','COCO','KIWI','LIMA','AMORA','MANGA','CAQUI','LIMAO','MAMAO','CEREJA','GOIABA','BANANA','MORANGO','ABACAXI','LARANJA','ACEROLA','AMEIXA','PITANGA','PESSEGO','MIRTILO','MELANCIA','GRAVIOLA','FRAMBOESA','JABUTICABA','CARAMBOLA','TANGERINA'],
  'Objetos': ['LUZ','COR','MES','CHA','MESA','VASO','BOLA','FACA','SINO','ARCO','RODA','COPO','CHAVE','LIVRO','RELOGIO','ESPELHO','TAPETE','CORTINA','JANELA','CADEIRA','PANELA','CANETA','MOCHILA','OCULOS','TESOURA','MARTELO','VASSOURA','GUITARRA','LAMPADA','TRAVESSEIRO','COMPUTADOR','TELEVISAO','GELADEIRA','BICICLETA'],
  'Paises': ['PERU','CUBA','CHILE','CHINA','INDIA','JAPAO','EGITO','FRANCA','ITALIA','CANADA','MEXICO','RUSSIA','BRASIL','ESPANHA','TURQUIA','COLOMBIA','PORTUGAL','ARGENTINA','ALEMANHA','AUSTRALIA','MARROCOS','BELGICA','HOLANDA','NORUEGA','GRECIA'],
  'Profissoes': ['PINTOR','PILOTO','MEDICO','MUSICO','PADEIRO','PEDREIRO','BOMBEIRO','POLICIAL','DENTISTA','MOTORISTA','PROFESSOR','ADVOGADO','COZINHEIRO','ENGENHEIRO','PESCADOR','MECANICO','ARQUITETO','JORNALISTA','FOTOGRAFO','ELETRICISTA','CARPINTEIRO','VETERINARIO'],
  'Esportes': ['BOXE','GOLFE','SURFE','TENIS','REMO','ESQUI','RUGBY','CORRIDA','FUTEBOL','NATACAO','VOLEIBOL','BASQUETE','CICLISMO','HANDEBOL','ESGRIMA','ATLETISMO','PATINACAO','GINASTICA','MERGULHO','HIPISMO'],
  'Comidas': ['ARROZ','SOPA','BOLO','PIZZA','TORTA','CARNE','SALADA','FEIJAO','QUEIJO','PUDIM','PASTEL','COXINHA','FRANGO','LASANHA','MACARRAO','RISOTO','EMPADA','MOUSSE','BROWNIE','SORVETE']
};

const TOTAL_ROUNDS = 10;
const DIFFICULTY_SCHEDULE = [4,4,5,5,5,6,6,7,7,8]; // word lengths per round

let currentWord = '';
let currentCategory = '';
let scrambled = [];
let answerSlots = [];
let round = 0;
let score = 0;
let hints = 3;
let startTime = 0;
let timerInterval = null;
let gameOver = false;

const answerArea = document.getElementById('answer-area');
const scrambleArea = document.getElementById('scramble-area');
const scoreEl = document.getElementById('score-display');
const roundEl = document.getElementById('round-display');
const timerEl = document.getElementById('timer-display');
const hintsEl = document.getElementById('hints-display');
const categoryEl = document.getElementById('category-name');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');

function getWordOfLength(len) {
  const candidates = [];
  for (const [cat, words] of Object.entries(WORD_BANK)) {
    for (const w of words) {
      if (w.length === len) candidates.push({ word: w, category: cat });
      // Also allow len+1 or len-1 for flexibility
      else if (Math.abs(w.length - len) <= 1 && candidates.length < 5) candidates.push({ word: w, category: cat });
    }
  }
  if (candidates.length === 0) {
    // fallback: any word
    const allCats = Object.keys(WORD_BANK);
    const cat = allCats[Math.floor(Math.random() * allCats.length)];
    const w = WORD_BANK[cat][Math.floor(Math.random() * WORD_BANK[cat].length)];
    return { word: w, category: cat };
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scrambleWord(word) {
  let s = shuffle([...word]);
  // ensure not same as original
  let tries = 0;
  while (s.join('') === word && tries < 20) {
    s = shuffle([...word]);
    tries++;
  }
  return s;
}

function renderRound() {
  const targetLen = DIFFICULTY_SCHEDULE[Math.min(round, DIFFICULTY_SCHEDULE.length - 1)];
  const pick = getWordOfLength(targetLen);
  currentWord = pick.word;
  currentCategory = pick.category;
  scrambled = scrambleWord(currentWord);
  answerSlots = Array(currentWord.length).fill(null);

  categoryEl.textContent = currentCategory;
  roundEl.textContent = round + 1;
  hintsEl.textContent = hints;

  renderAnswer();
  renderScramble();
}

function renderAnswer() {
  answerArea.innerHTML = '';
  for (let i = 0; i < currentWord.length; i++) {
    const slot = document.createElement('div');
    slot.className = 'answer-slot';
    if (answerSlots[i] !== null) {
      slot.textContent = answerSlots[i].letter;
      if (answerSlots[i].hint) {
        slot.classList.add('hint');
      } else {
        slot.classList.add('filled');
        slot.addEventListener('click', () => removeFromAnswer(i));
      }
    }
    answerArea.appendChild(slot);
  }
}

function renderScramble() {
  scrambleArea.innerHTML = '';
  for (let i = 0; i < scrambled.length; i++) {
    const tile = document.createElement('div');
    tile.className = 'letter-tile';
    tile.textContent = scrambled[i];
    // Check if this tile index is used in answer
    const usedIndices = answerSlots.filter(s => s !== null && !s.hint).map(s => s.srcIdx);
    if (usedIndices.includes(i)) {
      tile.classList.add('used');
    } else {
      tile.addEventListener('click', () => addToAnswer(i));
    }
    scrambleArea.appendChild(tile);
  }
}

function addToAnswer(srcIdx) {
  // Find first empty non-hint slot
  const emptyIdx = answerSlots.findIndex(s => s === null);
  if (emptyIdx === -1) return;
  answerSlots[emptyIdx] = { letter: scrambled[srcIdx], srcIdx, hint: false };
  renderAnswer();
  renderScramble();

  // Check if all filled
  if (answerSlots.every(s => s !== null)) {
    checkAnswer();
  }
}

function removeFromAnswer(idx) {
  if (answerSlots[idx] && answerSlots[idx].hint) return;
  answerSlots[idx] = null;
  renderAnswer();
  renderScramble();
}

function checkAnswer() {
  const attempt = answerSlots.map(s => s.letter).join('');
  const slots = answerArea.querySelectorAll('.answer-slot');

  if (attempt === currentWord) {
    slots.forEach(s => { s.classList.remove('filled'); s.classList.add('correct'); });
    const timeBonus = Math.max(0, 100 - getElapsed());
    const roundScore = currentWord.length * 10 + timeBonus;
    score += roundScore;
    scoreEl.textContent = score;
    setTimeout(() => nextRound(), 800);
  } else {
    slots.forEach(s => {
      if (s.classList.contains('filled')) s.classList.add('wrong');
    });
    setTimeout(() => {
      // Clear non-hint slots
      for (let i = 0; i < answerSlots.length; i++) {
        if (answerSlots[i] && !answerSlots[i].hint) answerSlots[i] = null;
      }
      renderAnswer();
      renderScramble();
    }, 600);
  }
}

function nextRound() {
  round++;
  if (round >= TOTAL_ROUNDS) {
    endGame(true);
  } else {
    renderRound();
  }
}

function useHint() {
  if (hints <= 0) return;
  // Find a position that isn't filled or hinted
  const emptyPositions = [];
  for (let i = 0; i < currentWord.length; i++) {
    if (answerSlots[i] === null) emptyPositions.push(i);
  }
  if (emptyPositions.length === 0) return;

  hints--;
  hintsEl.textContent = hints;

  const pos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
  const correctLetter = currentWord[pos];

  // Find unused scramble index with that letter
  const usedIndices = answerSlots.filter(s => s !== null).map(s => s.srcIdx);
  let srcIdx = -1;
  for (let i = 0; i < scrambled.length; i++) {
    if (!usedIndices.includes(i) && scrambled[i] === correctLetter) {
      srcIdx = i;
      break;
    }
  }

  if (srcIdx === -1) {
    // Letter not available in remaining scrambled, swap approach
    // Just reveal without linking to scramble
    answerSlots[pos] = { letter: correctLetter, srcIdx: -1, hint: true };
  } else {
    answerSlots[pos] = { letter: correctLetter, srcIdx, hint: true };
  }

  renderAnswer();
  renderScramble();

  // Check if all filled
  if (answerSlots.every(s => s !== null)) {
    checkAnswer();
  }
}

function reshuffleLetters() {
  scrambled = scrambleWord(currentWord);
  // Re-map answer slots srcIdx
  for (let i = 0; i < answerSlots.length; i++) {
    if (answerSlots[i] && !answerSlots[i].hint) {
      answerSlots[i] = null;
    }
  }
  renderAnswer();
  renderScramble();
}

function skipWord() {
  score = Math.max(0, score - 20);
  scoreEl.textContent = score;
  nextRound();
}

function endGame(won) {
  gameOver = true;
  clearInterval(timerInterval);
  const t = getElapsed();
  modalTitle.textContent = won ? 'Parabéns!' : 'Fim de Jogo';
  modalTitle.className = won ? 'win' : 'loss';
  modalMessage.textContent = `Pontuação final: ${score} pontos em ${Math.floor(t/60)}m ${t%60}s`;
  modalOverlay.classList.add('active');
  saveGameStat(won ? 'win' : 'loss', t);
}

// Timer
function startTimer() {
  startTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const s = getElapsed();
    const m = Math.floor(s / 60);
    timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  }, 1000);
}

function getElapsed() {
  return Math.floor((Date.now() - startTime) / 1000);
}

async function saveGameStat(result, timeSec) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'anagram',
      result,
      moves: score,
      time_seconds: timeSec
    });
  } catch (e) { console.error(e); }
}

function newGame() {
  modalOverlay.classList.remove('active');
  round = 0;
  score = 0;
  hints = 3;
  gameOver = false;
  scoreEl.textContent = 0;
  renderRound();
  startTimer();
}

document.getElementById('btn-hint').addEventListener('click', useHint);
document.getElementById('btn-shuffle').addEventListener('click', reshuffleLetters);
document.getElementById('btn-skip').addEventListener('click', skipWord);
document.getElementById('btn-new-game').addEventListener('click', newGame);

newGame();
