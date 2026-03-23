import '../../auth-check.js';
import { playSound, initAudio } from '../shared/game-design-utils.js';
import { GameStats } from '../shared/game-core.js';
import { onGameEnd } from '../shared/game-integration.js';
// ===== Termo (Wordle BR) v8 - Refinamento Visual =====
import { supabase } from '../../supabase.js';

// Daily challenge support
const dailySeed = new URLSearchParams(window.location.search).get('daily');
let dailyRNG = null;

function seededRNG(seed) {
  let s = seed;
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

if (dailySeed) {
  dailyRNG = seededRNG(parseInt(dailySeed, 10) || 0);
}

// Debug mode
console.log('[Termo] v8 - Inicializando...');
const DEBUG = location.search.includes('debug');
function debug(...args) {
  if (DEBUG) console.log('[Termo]', ...args);
}

// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

// Theme management
let currentTheme = localStorage.getItem('termo-theme') || 'dark';
document.body.classList.toggle('light-theme', currentTheme === 'light');

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.classList.toggle('light-theme', currentTheme === 'light');
  localStorage.setItem('termo-theme', currentTheme);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = currentTheme === 'dark' ? '🌙' : '☀️';
  debug('Theme toggled:', currentTheme);
}

const WORDS = [
  'ABACO','ABRIR','ACASO','ACIMA','ADEUS','AGORA','AINDA','AJOIO','ALEGA','ALGUM',
  'ALHOS','ALTAR','AMADO','AMBAR','AMIGO','ANDAR','ANEIS','ANIMO','ANTES','ANZOL',
  'APOIO','AQUEM','AREIA','AROMA','ARROZ','ASILO','ATLAS','AVIAO','AVISO','AZEDO',
  'BAGRE','BAIXO','BALAO','BANCO','BANDA','BANHO','BARCO','BARRO','BICHO','BLOCO',
  'BOLHA','BOLAS','BOMBA','BONDI','BRACO','BRAVO','BRISA','BRUXA','BURRO','BUSCA',
  'CABRA','CACHO','CALDA','CALMO','CAMPO','CANTO','CARGA','CARNE','CASCO','CAUDA',
  'CERCA','CHAVE','CHEFE','CHORO','CHUVA','CINCO','CISNE','COBRA','COFRE','COLMO',
  'CONTE','CONTO','CORPO','COSTA','COURO','COUVE','CRIME','CRUEL','CUECA','CURVA',
  'DAMAS','DARDO','DELTA','DENSO','DIGNO','DISCO','DOIDO','DROGA','DUPLO','DUQUE',
  'ELITE','EMOEM','ENERGIA','ENJOO','ENTAO','ERRAR','ESCOLA','EXAME','EXTRA',
  'FALAR','FATAL','FAUNA','FAVOR','FEBRE','FELIZ','FERRO','FESTA','FIBRA','FIGOS',
  'FILHO','FLORA','FLUIR','FOBIA','FOLHA','FONTE','FORCA','FORMA','FORTE','FRACO',
  'FRASE','FROTA','FRUTA','FUGIR','FUNIL','FUSAO','GAFES','GALHO','GARRA','GATOS',
  'GENTE','GESTO','GLOBO','GOLFE','GORDO','GRACA','GRAMA','GRAVE','GREVE','GRILO',
  'GRUPO','GUIAR','HAVIA','HEROI','HINOS','HONRA','HOTEL','HUMOR','ICONE','IDEAL',
  'IGUAI','ILHAS','IMPAR','INDIA','INFRA','INICIO','IRMOS','ISOLA','ITEMS','JAULA',
  'JEANS','JOGOS','JOVEM','JUIZO','JUNCO','JUNTA','JUROS','JUSTO','LABIO','LAGOA',
  'LANCE','LAPSO','LASER','LAVAR','LEGAL','LEITE','LENCO','LERDO','LETAL','LIDAR',
  'LIMAO','LINDO','LINHA','LITRO','LIVRO','LOGRO','LOMBO','LONGE','LOUCO','LUNAR',
  'MACRO','MAGRO','MALHA','MANDO','MANHA','MANTO','MARCO','MASSA','MEDAL','MEIGO',
  'MELAO','MENOR','MESMA','METRO','MILHO','MINAR','MOCHO','MOLDE','MOLHO','MONTE',
  'MORAL','MORTO','MOTOR','MUNDO','MUSEU','NADAR','NAVIO','NERVO','NINHO','NIVEL',
  'NOITE','NORMA','NOSSO','NOTAR','NOVOS','NUVEM','OBESO','OBVIO','OITAV','OLHAR',
  'ONDAS','ONTEM','OPACO','OPERA','ORDEM','OSSOS','OUTRO','OUVIR','PACTO','PADRE',
  'PALCO','PALMA','PANDA','PARDO','PARTO','PASTA','PATAS','PATIO','PAUSA','PAVIO',
  'PEDRA','PEGAR','PEIXE','PERCA','PERDA','PERUA','PENAL','PIANO','PILHA','PINGO',
  'PINTO','PISTA','PLANO','PLUMA','PODER','POLIR','POLVO','POMAR','PONTO','PORTA',
  'POSSE','POUCO','PRAÇA','PRAIA','PRATA','PRECE','PRECO','PRESA','PRIMO','PROVA',
  'PULSO','PUNHO','QUALM','QUOTA','RAIVA','RAMOS','RANGO','RASTO','RAZAO','REDOR',
  'REGRA','REINO','RELVA','RENDA','RESTO','REZAR','RIGOR','RITMO','RIVAL','ROCHA',
  'ROLHA','ROMBO','RONCO','ROSCA','ROUPA','RUMOR','RURAL','SABER','SAFRA','SAGAZ',
  'SAINT','SALAO','SALSA','SALTO','SALVA','SANTO','SAUDE','SELIC','SENSO','SERRA',
  'SIGLA','SINAL','SOBRE','SOLAR','SONHO','SORTE','SULCO','SUMIR','SURDO','SURTO',
  'TEMPO','TENSO','TERRA','TIGRE','TINTA','TITULO','TOLDO','TOQUE','TOTAL','TRAÇO',
  'TRAJE','TREVO','TRIBO','TRIGO','TROCA','TRONO','TROPA','TURMA','ULTRA','UNGIR',
  'UNICO','UNIDO','USUAL','VALER','VALOR','VAPOR','VARAU','VAZIO','VEADO','VELHA',
  'VENTO','VERDE','VERSO','VIDEO','VIGOR','VINCO','VINHO','VIRAR','VISTA','VITAL',
  'VIUVA','VOTAR','VULTO','XADRE','ZAMBI','ZINCO','ZONAS'
];

// Filter only 5-letter words
const VALID_WORDS = WORDS.filter(w => w.length === 5);

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

// DOM
const boardEl = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalWord = document.getElementById('modal-word');
const btnNewGame = document.getElementById('btn-new-game');
const messageBar = document.getElementById('message-bar');
const winsDisplay = document.getElementById('wins-display');

// State
let targetWord = '';
let currentRow = 0;
let currentCol = 0;
let gameOver = false;
let board = []; // 6x5 array of letters
let keyStates = {}; // letter -> best state

// GameStats instance
let gameStats = null;

// Keyboard layout
const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫']
];

// Game Design: Desafio Diario - palavra baseada na data
function getDailyWord() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % VALID_WORDS.length;
  return VALID_WORDS[index];
}

function init() {
  debug('Initializing game...');

  // Verificar elementos essenciais
  if (!boardEl || !keyboardEl) {
    console.error('[Termo] Elementos essenciais não encontrados');
    return;
  }

  // Initialize GameStats
  if (!gameStats) {
    gameStats = new GameStats('termo', { autoSync: true });
    // Load wins from localStorage for backward compatibility
    const savedWins = parseInt(localStorage.getItem('termo_wins') || '0');
    if (savedWins > 0) {
      gameStats.update({ gamesWon: savedWins });
    }
  }

  // Update display from GameStats
  const stats = gameStats.get();
  winsDisplay.textContent = stats.gamesWon;

  // Update theme button
  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) themeBtn.textContent = currentTheme === 'dark' ? '🌙' : '☀️';

  // Game Design: Modo diario (todos jogam a mesma palavra por dia)
  if (dailySeed) {
    // Seeded daily challenge: use seed to pick word deterministically
    const rng = seededRNG(parseInt(dailySeed, 10) || 0);
    const idx = Math.floor(rng() * VALID_WORDS.length);
    targetWord = VALID_WORDS[idx];
  } else {
    targetWord = getDailyWord();
  }
  currentRow = 0;
  currentCol = 0;
  gameOver = false;
  board = Array.from({ length: MAX_GUESSES }, () => Array(WORD_LENGTH).fill(''));
  keyStates = {};
  messageBar.textContent = '';
  modalOverlay.classList.remove('show');
  renderBoard();
  renderKeyboard();

  debug('Game initialized:', { targetWord, theme: currentTheme });
}

function renderBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'row';
    rowEl.id = `row-${r}`;
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.id = `tile-${r}-${c}`;
      tile.textContent = board[r][c];
      if (board[r][c]) tile.classList.add('filled');
      rowEl.appendChild(tile);
    }
    boardEl.appendChild(rowEl);
  }
}

function renderKeyboard() {
  keyboardEl.innerHTML = '';
  for (const row of KB_ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';
    for (const key of row) {
      const btn = document.createElement('button');
      btn.className = 'key';
      if (key === 'ENTER' || key === '⌫') btn.classList.add('wide');
      if (keyStates[key]) btn.classList.add(keyStates[key]);
      btn.textContent = key === 'ENTER' ? 'ENTER' : key;
      btn.dataset.key = key;
      // Acessibilidade: aria-label para cada tecla
      const ariaLabels = {
        'ENTER': 'Enter - confirmar palavra',
        '⌫': 'Apagar - remover última letra'
      };
      btn.setAttribute('aria-label', ariaLabels[key] || `Letra ${key}`);
      btn.addEventListener('click', () => {
        playSound('click');
        handleKey(key);
      });
      rowEl.appendChild(btn);
    }
    keyboardEl.appendChild(rowEl);
  }
}

function updateKeyboard() {
  document.querySelectorAll('.key').forEach(btn => {
    const k = btn.dataset.key;
    if (keyStates[k]) {
      btn.className = 'key' + (k === 'ENTER' || k === '⌫' ? ' wide' : '') + ' ' + keyStates[k];
    }
  });
}

let audioInitialized = false;

function initAudioOnFirstInteraction() {
  if (!audioInitialized) {
    initAudio();
    audioInitialized = true;
  }
}

function handleKey(key) {
  if (gameOver) return;

  initAudioOnFirstInteraction();

  if (key === '⌫') {
    if (currentCol > 0) {
      currentCol--;
      board[currentRow][currentCol] = '';
      const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
      tile.textContent = '';
      tile.classList.remove('filled');
    }
    return;
  }

  if (key === 'ENTER') {
    if (currentCol < WORD_LENGTH) {
      showMessage('Palavra incompleta');
      shakeRow(currentRow);
      return;
    }
    playSound('place');
    submitGuess();
    return;
  }

  // Letter
  if (currentCol < WORD_LENGTH) {
    playSound('type');
    board[currentRow][currentCol] = key;
    const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
    tile.textContent = key;
    tile.classList.add('filled');
    currentCol++;
  }
}

function submitGuess() {
  const guess = board[currentRow].join('');

  // Evaluate
  const result = evaluate(guess, targetWord);

  // Animate tiles
  const row = document.getElementById(`row-${currentRow}`);
  const tiles = row.querySelectorAll('.tile');

  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add('flip');
      setTimeout(() => {
        tile.classList.add(result[i]);
        // Update key state (priority: correct > present > absent)
        const letter = guess[i];
        const priority = { correct: 3, present: 2, absent: 1 };
        const current = keyStates[letter];
        if (!current || priority[result[i]] > priority[current]) {
          keyStates[letter] = result[i];
        }
        if (i === WORD_LENGTH - 1) {
          updateKeyboard();
        }
      }, 250);
    }, i * 300);
  });

  // Check win/loss after animation
  const totalDelay = WORD_LENGTH * 300 + 300;
  setTimeout(() => {
    if (guess === targetWord) {
      gameOver = true;
      // Update GameStats
      if (gameStats) {
        gameStats.recordGame(true, { moves: currentRow + 1 });
        onGameEnd('termo', { won: true, score: currentRow + 1 });
        // Keep localStorage in sync for backward compatibility
        localStorage.setItem('termo_wins', gameStats.get().gamesWon);
        winsDisplay.textContent = gameStats.get().gamesWon;
      }
      // Bounce animation
      tiles.forEach((tile, i) => {
        setTimeout(() => tile.classList.add('bounce'), i * 100);
      });
      playSound('win');
      setTimeout(() => {
        showModal('Parabens! 🎉', `Voce acertou em ${currentRow + 1} tentativa${currentRow > 0 ? 's' : ''}!`);
        saveGameStat('win');
        if (dailySeed) {
          import('../shared/daily-challenge.js').then(m => {
            m.dailyChallenge.recordResult({ won: true, attempts: currentRow + 1 });
          });
        }
      }, 600);
    } else {
      currentRow++;
      currentCol = 0;
      if (currentRow >= MAX_GUESSES) {
        gameOver = true;
        playSound('error');
        // Update GameStats for loss
        if (gameStats) {
          gameStats.recordGame(false, { moves: MAX_GUESSES });
          onGameEnd('termo', { won: false, score: MAX_GUESSES });
        }
        showModal('Que pena! 😔', 'Voce nao conseguiu adivinhar.');
        saveGameStat('loss');
        if (dailySeed) {
          import('../shared/daily-challenge.js').then(m => {
            m.dailyChallenge.recordResult({ won: false, attempts: MAX_GUESSES });
          });
        }
      }
    }
  }, totalDelay);
}

function evaluate(guess, target) {
  const result = Array(WORD_LENGTH).fill('absent');
  const targetArr = target.split('');
  const guessArr = guess.split('');
  const used = Array(WORD_LENGTH).fill(false);

  // First pass: correct
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessArr[i] === targetArr[i]) {
      result[i] = 'correct';
      used[i] = true;
      guessArr[i] = null;
    }
  }

  // Second pass: present
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessArr[i] === null) continue;
    for (let j = 0; j < WORD_LENGTH; j++) {
      if (!used[j] && guessArr[i] === targetArr[j]) {
        result[i] = 'present';
        used[j] = true;
        break;
      }
    }
  }

  return result;
}

function showMessage(msg) {
  messageBar.textContent = msg;
  setTimeout(() => {
    if (messageBar.textContent === msg) messageBar.textContent = '';
  }, 2000);
}

function shakeRow(rowIndex) {
  const row = document.getElementById(`row-${rowIndex}`);
  row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 500);
}

function showModal(title, message) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalWord.textContent = targetWord;

  // Adicionar botao de compartilhar se nao existir
  let shareBtn = document.getElementById('btn-share');
  let shareResultDiv = document.getElementById('share-result');

  if (!shareBtn) {
    shareBtn = document.createElement('button');
    shareBtn.id = 'btn-share';
    shareBtn.className = 'btn btn-share';
    shareBtn.textContent = 'Compartilhar';
    shareBtn.addEventListener('click', handleShare);
    modalWord.parentElement.appendChild(shareBtn);
  }

  if (!shareResultDiv) {
    shareResultDiv = document.createElement('div');
    shareResultDiv.id = 'share-result';
    shareResultDiv.className = 'share-result';
    modalWord.parentElement.insertBefore(shareResultDiv, modalWord.nextSibling);
  }

  // Gerar resultado para compartilhar
  shareResultDiv.textContent = generateShareText();

  modalOverlay.classList.add('show');
}

function generateShareText() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');

  let result = `Termo ${day}/${month}\n`;

  for (let r = 0; r <= currentRow && r < MAX_GUESSES; r++) {
    if (board[r].every(c => c !== '')) {
      const guess = board[r].join('');
      const evaluation = evaluate(guess, targetWord);
      for (let i = 0; i < WORD_LENGTH; i++) {
        if (evaluation[i] === 'correct') result += '🟩';
        else if (evaluation[i] === 'present') result += '🟨';
        else result += '⬛';
      }
      result += '\n';
    }
  }

  if (board[currentRow].join('') === targetWord) {
    result += `\nAcertei em ${currentRow + 1}/6!`;
  }

  return result;
}

function handleShare() {
  const text = generateShareText();

  if (navigator.share) {
    navigator.share({
      title: 'Termo',
      text: text
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  navigator.clipboard.writeText(text).then(() => {
    showMessage('Copiado para a area de transferencia!');
  }).catch(() => {
    showMessage('Nao foi possivel copiar');
  });
}

// Physical keyboard
document.addEventListener('keydown', (e) => {
  if (gameOver && e.key !== 'Enter') return;
  if (e.key === 'Enter') {
    if (gameOver && modalOverlay.classList.contains('show')) {
      if (dailySeed) return; // Daily mode: no restart
      init();
      return;
    }
    handleKey('ENTER');
  } else if (e.key === 'Backspace') {
    handleKey('⌫');
  } else if (/^[a-zA-Z]$/.test(e.key)) {
    handleKey(e.key.toUpperCase());
  }
});

// New game button
btnNewGame.addEventListener('click', () => {
  if (dailySeed) return; // Daily mode: single attempt only
  playSound('click');
  init();
});

// Disable new game button in daily mode
if (dailySeed && btnNewGame) {
  btnNewGame.disabled = true;
  btnNewGame.style.opacity = '0.5';
  btnNewGame.style.cursor = 'not-allowed';
  btnNewGame.title = 'Desafio diário: apenas uma tentativa';
}

// Theme toggle
document.getElementById('btn-theme')?.addEventListener('click', () => {
  playSound('click');
  toggleTheme();
});

// Help modal
document.getElementById('btn-help')?.addEventListener('click', () => {
  playSound('click');
  document.getElementById('help-modal').classList.add('show');
});

document.getElementById('btn-close-help')?.addEventListener('click', () => {
  document.getElementById('help-modal').classList.remove('show');
});

// Close help modal on outside click
document.getElementById('help-modal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('help-modal')) {
    document.getElementById('help-modal').classList.remove('show');
  }
});

// Supabase stats - mantida para compatibilidade
async function saveGameStat(result) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('game_stats').insert({
      user_id: session.user.id,
      game: 'termo',
      result: result,
      moves: currentRow + 1,
      time_seconds: 0,
    });
  } catch (e) {
    console.warn('Erro ao salvar stats:', e);
  }
}

// Start
init();
