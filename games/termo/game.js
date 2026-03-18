import '../../auth-check.js';
// ===== Termo (Wordle BR) =====
import { supabase } from '../../supabase.js';
// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

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
let wins = parseInt(localStorage.getItem('termo_wins') || '0');
let board = []; // 6x5 array of letters
let keyStates = {}; // letter -> best state

// Keyboard layout
const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫']
];

// Game Design: Desafio Diário - palavra baseada na data
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
  winsDisplay.textContent = wins;
  // Game Design: Modo diário (todos jogam a mesma palavra por dia)
  targetWord = getDailyWord();
  currentRow = 0;
  currentCol = 0;
  gameOver = false;
  board = Array.from({ length: MAX_GUESSES }, () => Array(WORD_LENGTH).fill(''));
  keyStates = {};
  messageBar.textContent = '';
  modalOverlay.classList.remove('show');
  renderBoard();
  renderKeyboard();
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
      btn.addEventListener('click', () => handleKey(key));
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

function handleKey(key) {
  if (gameOver) return;

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
    submitGuess();
    return;
  }

  // Letter
  if (currentCol < WORD_LENGTH) {
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
      wins++;
      localStorage.setItem('termo_wins', wins);
      winsDisplay.textContent = wins;
      // Bounce animation
      tiles.forEach((tile, i) => {
        setTimeout(() => tile.classList.add('bounce'), i * 100);
      });
      setTimeout(() => {
        showModal('Parabens! 🎉', `Voce acertou em ${currentRow + 1} tentativa${currentRow > 0 ? 's' : ''}!`);
        saveGameStat('win');
      }, 600);
    } else {
      currentRow++;
      currentCol = 0;
      if (currentRow >= MAX_GUESSES) {
        gameOver = true;
        showModal('Que pena! 😔', 'Voce nao conseguiu adivinhar.');
        saveGameStat('loss');
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
  modalOverlay.classList.add('show');
}

// Physical keyboard
document.addEventListener('keydown', (e) => {
  if (gameOver && e.key !== 'Enter') return;
  if (e.key === 'Enter') {
    if (gameOver && modalOverlay.classList.contains('show')) {
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
btnNewGame.addEventListener('click', init);

// Supabase stats
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
