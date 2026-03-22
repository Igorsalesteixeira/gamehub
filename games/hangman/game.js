import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, initAudio } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
// ===== Jogo da Forca =====
import { supabase } from '../../supabase.js';

// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

const WORD_BANK = {
  'Animais': [
    'GATO','CACHORRO','ELEFANTE','GIRAFA','TIGRE','LEAO','MACACO','COBRA','AGUIA','BALEIA',
    'CAVALO','COELHO','GALINHA','PAPAGAIO','PINGUIM','TARTARUGA','JACARE','LOBO','URSO','RAPOSA',
    'GOLFINHO','CORUJA','PANTERA','CAMELO','TUCANO','ARANHA','FORMIGA','BORBOLETA','LAGARTO','POLVO'
  ],
  'Frutas': [
    'BANANA','MORANGO','ABACAXI','LARANJA','MELANCIA','MANGA','GOIABA','PESSEGO','CEREJA','AMORA',
    'LIMAO','MAMAO','CAQUI','FRAMBOESA','GRAVIOLA','JABUTICABA','PITANGA','ACEROLA','COCO','FIGO',
    'AMEIXA','KIWI','PERA','MIRTILO','CARAMBOLA'
  ],
  'Paises': [
    'BRASIL','PORTUGAL','ESPANHA','FRANCA','ALEMANHA','ITALIA','JAPAO','CHINA','CANADA','MEXICO',
    'ARGENTINA','CHILE','COLOMBIA','PERU','AUSTRALIA','INDIA','RUSSIA','TURQUIA','EGITO','MARROCOS',
    'SUECIA','NORUEGA','HOLANDA','BELGICA','GRECIA'
  ],
  'Objetos': [
    'CADEIRA','TELEVISAO','GELADEIRA','COMPUTADOR','TELEFONE','RELOGIO','ESPELHO','TRAVESSEIRO',
    'LAMPADA','BICICLETA','GUITARRA','MARTELO','TESOURA','GARFO','PANELA','VASSOURA','CHAVE',
    'OCULOS','MOCHILA','GUARDA','CANETA','LIVRO','TAPETE','CORTINA','JANELA'
  ],
  'Profissoes': [
    'MEDICO','PROFESSOR','ENGENHEIRO','ADVOGADO','DENTISTA','BOMBEIRO','POLICIAL','COZINHEIRO',
    'MOTORISTA','PADEIRO','JARDINEIRO','PINTOR','MUSICO','ELETRICISTA','CARPINTEIRO','PESCADOR',
    'PILOTO','JORNALISTA','FOTOGRAFO','VETERINARIO','FARMACEUTICO','ARQUITETO','ASTRONAUTA',
    'MECANICO','PEDREIRO'
  ],
  'Esportes': [
    'FUTEBOL','BASQUETE','VOLEIBOL','NATACAO','TENIS','HANDEBOL','ATLETISMO','CICLISMO','BOXE',
    'SURFE','KARATE','ESGRIMA','HIPISMO','REMO','GOLFE','RUGBY','BEISEBOL','PATINACAO','XADREZ',
    'BOLICHE','ESQUI','MERGULHO','CORRIDA','GINASTICA','LUTA'
  ]
};

const MAX_WRONG = 6;
const BODY_PARTS = ['hm-head','hm-body','hm-left-arm','hm-right-arm','hm-left-leg','hm-right-leg'];

const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M']
];

// DOM
const wordDisplay = document.getElementById('word-display');
const keyboardEl = document.getElementById('keyboard');
const categoryName = document.getElementById('category-name');
const wrongCount = document.getElementById('wrong-count');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalWord = document.getElementById('modal-word');
const btnNewGame = document.getElementById('btn-new-game');
const winsDisplay = document.getElementById('wins-display');

// State
let targetWord = '';
let category = '';
let guessedLetters = new Set();
let wrongGuesses = 0;
let gameOver = false;

// GameStats instance
let gameStats = null;

function init() {
  // Initialize GameStats
  if (!gameStats) {
    gameStats = new GameStats('hangman', { autoSync: true });
    // Load wins from localStorage for backward compatibility
    const savedWins = parseInt(localStorage.getItem('forca_wins') || '0');
    if (savedWins > 0) {
      gameStats.update({ gamesWon: savedWins });
    }
  }

  // Update display from GameStats
  const stats = gameStats.get();
  winsDisplay.textContent = stats.gamesWon;

  // Pick random category and word
  const categories = Object.keys(WORD_BANK);
  category = categories[Math.floor(Math.random() * categories.length)];
  const words = WORD_BANK[category];
  targetWord = words[Math.floor(Math.random() * words.length)];

  guessedLetters = new Set();
  wrongGuesses = 0;
  gameOver = false;

  categoryName.textContent = category;
  wrongCount.textContent = '0';
  modalOverlay.classList.remove('show');

  // Reset hangman
  BODY_PARTS.forEach(id => {
    document.getElementById(id).classList.remove('show');
  });

  renderWord();
  renderKeyboard();
}

function renderWord() {
  wordDisplay.innerHTML = '';
  wordDisplay.setAttribute('role', 'group');
  wordDisplay.setAttribute('aria-label', 'Letras da palavra secreta');
  for (const letter of targetWord) {
    const slot = document.createElement('div');
    slot.className = 'letter-slot';
    slot.setAttribute('role', 'letter');
    slot.setAttribute('aria-label', guessedLetters.has(letter) ? `Letra ${letter}` : 'Letra oculta');
    if (guessedLetters.has(letter)) {
      slot.textContent = letter;
      slot.classList.add('revealed');
    }
    wordDisplay.appendChild(slot);
  }
}

function renderKeyboard() {
  keyboardEl.innerHTML = '';
  keyboardEl.setAttribute('role', 'group');
  keyboardEl.setAttribute('aria-label', 'Teclado virtual - clique nas letras para adivinhar');
  for (const row of KB_ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';
    for (const key of row) {
      const btn = document.createElement('button');
      btn.className = 'key';
      btn.textContent = key;
      btn.dataset.key = key;
      btn.setAttribute('aria-label', `Letra ${key}`);
      btn.setAttribute('type', 'button');

      if (guessedLetters.has(key)) {
        btn.classList.add('used');
        btn.setAttribute('aria-disabled', 'true');
        if (targetWord.includes(key)) {
          btn.classList.add('correct');
          btn.setAttribute('aria-label', `Letra ${key} - correta`);
        } else {
          btn.classList.add('wrong');
          btn.setAttribute('aria-label', `Letra ${key} - incorreta`);
        }
      }

      btn.addEventListener('click', () => {
        playSound('click');
        handleGuess(key);
      });
      rowEl.appendChild(btn);
    }
    keyboardEl.appendChild(rowEl);
  }
}

let audioInitialized = false;

function initAudioOnFirstInteraction() {
  if (!audioInitialized) {
    initAudio();
    audioInitialized = true;
  }
}

function handleGuess(letter) {
  if (gameOver) return;
  if (guessedLetters.has(letter)) return;

  initAudioOnFirstInteraction();
  guessedLetters.add(letter);

  if (targetWord.includes(letter)) {
    // Correct
    playSound('place');
    renderWord();
    updateKeyButton(letter, 'correct');

    // Check win
    const allRevealed = [...targetWord].every(l => guessedLetters.has(l));
    if (allRevealed) {
      gameOver = true;
      // Update GameStats
      if (gameStats) {
        gameStats.recordGame(true, { moves: wrongGuesses });
        // Keep localStorage in sync for backward compatibility
        localStorage.setItem('forca_wins', gameStats.get().gamesWon);
        winsDisplay.textContent = gameStats.get().gamesWon;
      }
      launchConfetti();
      playSound('win');
      setTimeout(() => {
        showModal('Parabens! 🎉', 'Voce adivinhou a palavra!');
        saveGameStat('win');
      }, 500);
    }
  } else {
    // Wrong
    playSound('error');
    updateKeyButton(letter, 'wrong');
    document.getElementById(BODY_PARTS[wrongGuesses]).classList.add('show');
    wrongGuesses++;
    wrongCount.textContent = wrongGuesses;

    if (wrongGuesses >= MAX_WRONG) {
      gameOver = true;
      playSound('gameover');
      // Update GameStats for loss
      if (gameStats) {
        gameStats.recordGame(false, { moves: wrongGuesses });
      }
      // Reveal word
      const slots = wordDisplay.querySelectorAll('.letter-slot');
      [...targetWord].forEach((l, i) => {
        if (!guessedLetters.has(l)) {
          slots[i].textContent = l;
          slots[i].classList.add('wrong-reveal');
        }
      });
      setTimeout(() => {
        showModal('Que pena! 😔', 'O boneco foi enforcado.');
        saveGameStat('loss');
      }, 600);
    }
  }
}

function updateKeyButton(letter, state) {
  const btn = document.querySelector(`.key[data-key="${letter}"]`);
  if (btn) {
    btn.classList.add('used', state);
  }
}

function showModal(title, message) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalWord.textContent = targetWord;
  modalOverlay.classList.add('show');

  // Setup WhatsApp share button
  const shareBtn = document.getElementById('btn-share');
  if (shareBtn) {
    shareBtn.onclick = () => {
      const text = `🎉 Acabei de vencer no Jogo da Forca no Games Hub! A palavra era "${targetWord}". Jogue você também! 🎮 https://gameshub.com.br/games/hangman/`;
      shareOnWhatsApp(text);
    };
  }
}

// Physical keyboard
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && gameOver) {
    playSound('click');
    init();
    return;
  }
  if (/^[a-zA-Z]$/.test(e.key)) {
    initAudioOnFirstInteraction();
    handleGuess(e.key.toUpperCase());
  }
});

btnNewGame.addEventListener('click', () => {
  playSound('click');
  init();
});

// Supabase stats - mantida para compatibilidade
async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'hangman',
      result: result,
      moves: wrongGuesses,
      time_seconds: 0,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

init();
