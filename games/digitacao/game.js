import '../../auth-check.js';
// =============================================
//  DIGITACAO TURBO — game.js
// =============================================
import { GameStats, GameStorage } from '../shared/game-core.js';
import { onGameEnd } from '../shared/game-integration.js';

// ---- Banco de frases PT-BR ----
const FRASES = {
  ditados: [
    'Quem com ferro fere, com ferro sera ferido',
    'Agua mole em pedra dura, tanto bate ate que fura',
    'De grao em grao, a galinha enche o papo',
    'Quem nao tem colher, come com a mao',
    'Mais vale um passaro na mao do que dois voando',
    'Cachorro que ladra nao morde',
    'Em terra de cego, quem tem um olho e rei',
    'Deus ajuda quem cedo madruga',
    'A pressa e inimiga da perfeicao',
    'Quem nao arrisca, nao petisca',
    'Gato escaldado tem medo de agua fria',
    'Devagar se vai ao longe',
    'A uniao faz a forca',
    'Cada macaco no seu galho',
    'De graos nasce um monte',
    'Quem semeia vento colhe tempestade',
    'O barato sai caro',
    'Quem tudo quer nada tem',
    'A voz do povo e a voz de Deus',
    'Antes tarde do que nunca'
  ],
  musicas: [
    'Olha que coisa mais linda, mais cheia de graca',
    'Eu sei que vou te amar, por toda a minha vida',
    'O mundo e um moinho, vai triturar teus sonhos',
    'Deixa a vida me levar, vida leva eu',
    'Nao tenho medo do escuro, mas deixa as luzes acesas',
    'Chega de saudade, a realidade e que sem ela nao ha paz',
    'Aquarela do Brasil, meu Brasil brasileiro',
    'Segura o tchan, amarra o tchan',
    'Ai se eu te pego, ai ai se eu te pego',
    'Pais tropical, abencoado por Deus e bonito por natureza',
    'Era um garoto que como eu amava os Beatles e os Rolling Stones',
    'Maluco beleza, eu sou feliz e canto',
    'Que pais e esse, no Congresso tem mae de rua',
    'Andar com fe eu vou, que a fe nao costuma falhar',
    'Como uma onda no mar, tudo que se ve nao e',
    'Eu nasci ha dez mil anos atras',
    'Quando o sol bater na janela do teu quarto',
    'Descobri que minha arma e o que a memoria guarda',
    'Eu quero e botar meu bloco na rua',
    'O sol nascera, a luz dos olhos teus'
  ],
  memes: [
    'Eu nao vim aqui para fazer amigos',
    'Voce nao vale nem um real',
    'Isso e uma cilada, Bino',
    'Faz o L que e sucesso',
    'Calabreso com bastante queijo',
    'Na moral, isso nao faz o menor sentido',
    'Se correr o bicho pega, se ficar o bicho come',
    'Hoje eu to tranquilo, amanha eu nao sei',
    'E so alegria, nao tem tempo ruim',
    'Que situacao hein, pai',
    'Eu sou muito humilde, mas sou o melhor',
    'Nao e possivel, nao acredito nisso',
    'Pior que ta nao fica, mas ficou',
    'A vida e assim, um dia da certo',
    'Vai dar bom, confia no processo',
    'Eu nao to entendendo mais nada',
    'Isso aqui ta muito doido',
    'A gente vai levando, ne',
    'Na minha epoca era tudo diferente',
    'Quem nunca fez isso, nao sabe o que ta perdendo'
  ],
  curiosidades: [
    'O Brasil tem mais de duzentos milhoes de habitantes',
    'A Amazonia e a maior floresta tropical do mundo',
    'O Rio Amazonas e o rio com maior volume de agua do planeta',
    'Sao Paulo e a cidade mais populosa da America do Sul',
    'O Carnaval brasileiro e o maior festival do mundo',
    'O Brasil e o quinto maior pais do mundo em extensao',
    'A caipirinha e a bebida oficial do Brasil',
    'O futebol foi introduzido no Brasil por Charles Miller',
    'O Cristo Redentor e uma das sete maravilhas modernas',
    'O Pantanal e a maior area umida continental do planeta',
    'O Brasil tem seis biomas distintos',
    'A Cataratas do Iguacu estao entre as maiores do mundo',
    'O Brasil produz mais cafe do que qualquer outro pais',
    'A lingua portuguesa e a quinta mais falada no mundo',
    'O Pao de Acucar e um dos cartoes postais do Rio',
    'O Brasil possui a maior biodiversidade do planeta',
    'A selecao brasileira venceu cinco Copas do Mundo',
    'Salvador foi a primeira capital do Brasil',
    'O real brasileiro foi criado em mil novecentos e noventa e quatro',
    'O Brasil faz fronteira com dez paises diferentes'
  ]
};

// Palavras curtas para modo chuva
const PALAVRAS_CHUVA = [
  'gato','mesa','casa','bola','dado','fogo','lago','mapa','neve','onda',
  'pato','rede','sapo','trem','urso','vaca','xale','zero','amor','azul',
  'bebe','cafe','dedo','faca','gelo','hora','ilha','jogo','kiwi','loja',
  'mala','nada','ouro','pena','quem','rosa','sala','teia','uvas','vida',
  'bravo','calmo','doido','feliz','grama','humor','ideal','jovem','limao',
  'mundo','nobre','perda','raiva','sonho','terra','unico','verde','fonte',
  'digno','campo','nuvem','plano','ritmo','sinal','turbo','vapor','norte',
  'praia','folha','marca','corpo','chave','pedra','ponto','regra','texto',
  'livro','chuva','tigre','rapaz','samba','festa','palco','danca','forte'
];

// ---- Todas as frases juntas ----
function getAllPhrases() {
  return [...FRASES.ditados, ...FRASES.musicas, ...FRASES.memes, ...FRASES.curiosidades];
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- DOM Elements ----
const raceCanvas = document.getElementById('race-canvas');
const raceCtx = raceCanvas.getContext('2d');
const typingArea = document.getElementById('typing-area');
const phraseDisplay = document.getElementById('phrase-display');
const typingInput = document.getElementById('typing-input');
const timerDisplay = document.getElementById('timer-display');
const accuracyDisplay = document.getElementById('accuracy-display');
const progressDisplay = document.getElementById('progress-display');
const rainContainer = document.getElementById('rain-container');
const rainCanvas = document.getElementById('rain-canvas');
const rainCtx = rainCanvas.getContext('2d');
const rainInput = document.getElementById('rain-input');
const overlay = document.getElementById('overlay');
const overlayIcon = document.getElementById('overlay-icon');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const btnStart = document.getElementById('btn-start');
const btnShare = document.getElementById('btn-share');
const modeSelect = document.getElementById('mode-select');
const modeDesc = document.getElementById('mode-desc');
const wpmDisplay = document.getElementById('wpm-display');
const bestDisplay = document.getElementById('best-display');

// ---- Stats & Storage ----
const stats = new GameStats('digitacao');
const storage = new GameStorage('digitacao');

function getBestWPM() { return storage.get('bestWPM', 0); }
function setBestWPM(v) { storage.set('bestWPM', v); }

// ---- State ----
let gameMode = 'classic'; // classic, marathon, rain
let gameActive = false;
let startTime = 0;
let timerInterval = null;
let currentPhrases = [];
let currentPhraseIndex = 0;
let currentPhrase = '';
let charIndex = 0;
let totalCharsTyped = 0;
let correctChars = 0;
let currentWPM = 0;
let currentAccuracy = 100;

// Race canvas state
let carProgress = 0;
let stars = [];
let raceAnimFrame = null;

// Rain mode state
let rainWords = [];
let rainScore = 0;
let rainMissed = 0;
let rainSpawnTimer = 0;
let rainAnimFrame = null;
let rainStartTime = 0;
const RAIN_DURATION = 60000; // 60s
const RAIN_MAX_MISSED = 5;

// ---- Mode descriptions ----
const MODE_DESCS = {
  classic: '10 frases. Digite cada uma o mais rapido possivel.',
  marathon: 'Texto continuo por 60 segundos. Seu WPM final conta!',
  rain: 'Palavras caem pela tela. Digite-as antes de chegarem ao fundo!'
};

// ---- Init ----
function init() {
  bestDisplay.textContent = getBestWPM();

  // Mode buttons
  modeSelect.querySelectorAll('.btn-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      modeSelect.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gameMode = btn.dataset.mode;
      modeDesc.textContent = MODE_DESCS[gameMode];
    });
  });

  btnStart.addEventListener('click', startGame);
  btnShare.addEventListener('click', share);

  // Resize
  window.addEventListener('resize', resizeCanvases);
  resizeCanvases();

  // Init stars
  initStars();
  drawRace();

  showOverlay('start');
}

// ---- Canvas resize ----
function resizeCanvases() {
  const dpr = window.devicePixelRatio || 1;

  // Race canvas
  const raceRect = raceCanvas.getBoundingClientRect();
  raceCanvas.width = raceRect.width * dpr;
  raceCanvas.height = raceRect.height * dpr;
  raceCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Rain canvas
  if (rainCanvas) {
    const rainRect = rainCanvas.getBoundingClientRect();
    if (rainRect.width > 0 && rainRect.height > 0) {
      rainCanvas.width = rainRect.width * dpr;
      rainCanvas.height = rainRect.height * dpr;
      rainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  initStars();
}

// ---- Stars background ----
function initStars() {
  const rect = raceCanvas.getBoundingClientRect();
  stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * rect.width,
      y: Math.random() * rect.height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 2 + 1,
      alpha: Math.random() * 0.6 + 0.2
    });
  }
}

// ---- Race canvas drawing ----
function drawRace() {
  const w = raceCanvas.getBoundingClientRect().width;
  const h = raceCanvas.getBoundingClientRect().height;

  raceCtx.clearRect(0, 0, w, h);

  // Background
  raceCtx.fillStyle = '#060618';
  raceCtx.fillRect(0, 0, w, h);

  // Stars / speed lines
  const speed = gameActive ? 3 + carProgress * 4 : 1;
  stars.forEach(s => {
    s.x -= s.speed * speed;
    if (s.x < 0) {
      s.x = w;
      s.y = Math.random() * h;
    }
    raceCtx.globalAlpha = s.alpha;
    if (gameActive && speed > 2) {
      // Speed lines
      raceCtx.strokeStyle = '#00f0ff';
      raceCtx.lineWidth = s.size * 0.5;
      raceCtx.beginPath();
      raceCtx.moveTo(s.x, s.y);
      raceCtx.lineTo(s.x + s.speed * speed * 3, s.y);
      raceCtx.stroke();
    } else {
      raceCtx.fillStyle = '#ffffff';
      raceCtx.fillRect(s.x, s.y, s.size, s.size);
    }
  });
  raceCtx.globalAlpha = 1;

  // Road
  const roadY = h * 0.6;
  const roadH = h * 0.25;
  raceCtx.fillStyle = '#1a1a3a';
  raceCtx.fillRect(0, roadY, w, roadH);

  // Road lines
  raceCtx.strokeStyle = '#333366';
  raceCtx.lineWidth = 1;
  raceCtx.setLineDash([20, 15]);
  raceCtx.beginPath();
  raceCtx.moveTo(0, roadY + roadH / 2);
  raceCtx.lineTo(w, roadY + roadH / 2);
  raceCtx.stroke();
  raceCtx.setLineDash([]);

  // Road edges
  raceCtx.strokeStyle = '#00f0ff';
  raceCtx.lineWidth = 2;
  raceCtx.globalAlpha = 0.4;
  raceCtx.beginPath();
  raceCtx.moveTo(0, roadY);
  raceCtx.lineTo(w, roadY);
  raceCtx.stroke();
  raceCtx.beginPath();
  raceCtx.moveTo(0, roadY + roadH);
  raceCtx.lineTo(w, roadY + roadH);
  raceCtx.stroke();
  raceCtx.globalAlpha = 1;

  // Finish flag
  const flagX = w - 30;
  raceCtx.fillStyle = '#ffffff';
  raceCtx.fillRect(flagX, roadY - 15, 4, roadH + 15);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      raceCtx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#000000';
      raceCtx.fillRect(flagX + 4 + c * 6, roadY - 15 + r * 6, 6, 6);
    }
  }

  // Car
  const carX = 30 + carProgress * (w - 90);
  const carY = roadY + roadH / 2 - 10;
  drawCar(carX, carY);

  raceAnimFrame = requestAnimationFrame(drawRace);
}

function drawCar(x, y) {
  // Car body
  raceCtx.fillStyle = '#00f0ff';
  raceCtx.shadowColor = '#00f0ff';
  raceCtx.shadowBlur = 15;
  raceCtx.beginPath();
  raceCtx.roundRect(x, y, 35, 16, 3);
  raceCtx.fill();
  raceCtx.shadowBlur = 0;

  // Windshield
  raceCtx.fillStyle = '#0a0a1a';
  raceCtx.fillRect(x + 22, y + 2, 8, 12);

  // Spoiler
  raceCtx.fillStyle = '#00d4e0';
  raceCtx.fillRect(x - 3, y + 2, 4, 12);

  // Wheels
  raceCtx.fillStyle = '#222244';
  raceCtx.beginPath();
  raceCtx.arc(x + 8, y + 16, 4, 0, Math.PI * 2);
  raceCtx.fill();
  raceCtx.beginPath();
  raceCtx.arc(x + 27, y + 16, 4, 0, Math.PI * 2);
  raceCtx.fill();

  // Exhaust glow
  if (gameActive) {
    raceCtx.fillStyle = `rgba(0, 240, 255, ${0.3 + Math.random() * 0.3})`;
    raceCtx.beginPath();
    raceCtx.ellipse(x - 5, y + 8, 4 + Math.random() * 4, 3, 0, 0, Math.PI * 2);
    raceCtx.fill();
  }
}

// ---- Show overlay ----
function showOverlay(state, data = {}) {
  overlay.style.display = 'flex';

  if (state === 'start') {
    overlayIcon.textContent = '\u2328'; // keyboard symbol
    overlayTitle.textContent = 'Digitacao Turbo';
    overlayMsg.textContent = 'Teste sua velocidade de digitacao!';
    overlayScore.innerHTML = '';
    modeSelect.style.display = 'flex';
    modeDesc.style.display = 'block';
    btnStart.textContent = 'Jogar';
    btnShare.style.display = 'none';
  } else if (state === 'result') {
    overlayIcon.textContent = '\u2328';
    overlayTitle.textContent = data.newRecord ? 'Novo Recorde!' : 'Resultado';
    overlayMsg.textContent = '';
    modeSelect.style.display = 'none';
    modeDesc.style.display = 'none';
    btnStart.textContent = 'Jogar Novamente';
    btnShare.style.display = 'inline-block';

    overlayScore.innerHTML = `
      <div class="result-details">
        <div class="result-item">
          <span class="label">WPM</span>
          <span class="value">${data.wpm}</span>
        </div>
        <div class="result-item">
          <span class="label">Precisao</span>
          <span class="value accent">${data.accuracy}%</span>
        </div>
        <div class="result-item">
          <span class="label">Tempo</span>
          <span class="value warn">${data.time}</span>
        </div>
        <div class="result-item">
          <span class="label">Modo</span>
          <span class="value" style="font-size:1rem;color:var(--on-surface-variant)">${data.modeName}</span>
        </div>
      </div>
    `;
  }
}

// ---- Start game ----
function startGame() {
  overlay.style.display = 'none';
  gameActive = true;
  totalCharsTyped = 0;
  correctChars = 0;
  currentWPM = 0;
  currentAccuracy = 100;
  carProgress = 0;
  charIndex = 0;

  wpmDisplay.textContent = '0';
  accuracyDisplay.textContent = '100%';

  if (gameMode === 'classic') {
    startClassic();
  } else if (gameMode === 'marathon') {
    startMarathon();
  } else if (gameMode === 'rain') {
    startRain();
  }
}

// ---- CLASSIC MODE ----
function startClassic() {
  typingArea.style.display = 'flex';
  rainContainer.style.display = 'none';

  currentPhrases = shuffleArray(getAllPhrases()).slice(0, 10);
  currentPhraseIndex = 0;
  progressDisplay.textContent = '0/10';

  loadPhrase(currentPhrases[0]);
  startTimer();
  typingInput.value = '';
  typingInput.focus();

  typingInput.oninput = onClassicInput;
}

function loadPhrase(phrase) {
  currentPhrase = phrase;
  charIndex = 0;
  renderPhrase();
}

function renderPhrase() {
  let html = '';
  for (let i = 0; i < currentPhrase.length; i++) {
    let cls = 'char ';
    if (i < charIndex) {
      // Already typed
      cls += typingInput.value[i] === currentPhrase[i] ? 'correct' : 'incorrect';
    } else if (i === charIndex) {
      cls += 'current pending';
    } else {
      cls += 'pending';
    }
    const ch = currentPhrase[i] === ' ' ? '&nbsp;' : escapeHtml(currentPhrase[i]);
    html += `<span class="${cls}">${ch}</span>`;
  }
  phraseDisplay.innerHTML = html;
}

function escapeHtml(c) {
  if (c === '<') return '&lt;';
  if (c === '>') return '&gt;';
  if (c === '&') return '&amp;';
  return c;
}

function onClassicInput() {
  const val = typingInput.value;
  charIndex = val.length;

  // Count accuracy
  let correct = 0;
  for (let i = 0; i < val.length; i++) {
    if (val[i] === currentPhrase[i]) correct++;
  }

  totalCharsTyped = val.length;
  correctChars = correct;

  // Check error state on input
  if (val.length > 0 && val[val.length - 1] !== currentPhrase[val.length - 1]) {
    typingInput.classList.add('error');
    setTimeout(() => typingInput.classList.remove('error'), 200);
  }

  renderPhrase();
  updateStats();

  // Phrase complete
  if (val.length >= currentPhrase.length) {
    currentPhraseIndex++;
    progressDisplay.textContent = `${currentPhraseIndex}/10`;
    carProgress = currentPhraseIndex / 10;

    if (currentPhraseIndex >= 10) {
      endGame();
    } else {
      loadPhrase(currentPhrases[currentPhraseIndex]);
      typingInput.value = '';
    }
  }
}

// ---- MARATHON MODE ----
function startMarathon() {
  typingArea.style.display = 'flex';
  rainContainer.style.display = 'none';
  progressDisplay.textContent = '60s';

  // Build long text from multiple phrases
  const phrases = shuffleArray(getAllPhrases());
  currentPhrase = phrases.join('. ') + '.';
  charIndex = 0;
  totalCharsTyped = 0;
  correctChars = 0;

  renderPhrase();
  startTimer(60);
  typingInput.value = '';
  typingInput.focus();

  typingInput.oninput = onMarathonInput;
}

function onMarathonInput() {
  const val = typingInput.value;
  charIndex = val.length;

  let correct = 0;
  for (let i = 0; i < val.length; i++) {
    if (i < currentPhrase.length && val[i] === currentPhrase[i]) correct++;
  }
  totalCharsTyped = val.length;
  correctChars = correct;

  if (val.length > 0 && val[val.length - 1] !== currentPhrase[val.length - 1]) {
    typingInput.classList.add('error');
    setTimeout(() => typingInput.classList.remove('error'), 200);
  }

  renderPhrase();
  updateStats();

  // Update car progress based on chars typed vs total visible
  carProgress = Math.min(1, charIndex / Math.min(currentPhrase.length, 500));

  // If typed entire text (unlikely but possible)
  if (val.length >= currentPhrase.length) {
    endGame();
  }
}

// ---- RAIN MODE ----
function startRain() {
  typingArea.style.display = 'none';
  rainContainer.style.display = 'flex';
  resizeCanvases();

  rainWords = [];
  rainScore = 0;
  rainMissed = 0;
  rainSpawnTimer = 0;
  totalCharsTyped = 0;
  correctChars = 0;
  rainStartTime = Date.now();

  rainInput.value = '';
  rainInput.focus();
  progressDisplay.textContent = '60s';

  startTimer(60);
  rainInput.oninput = onRainInput;
  rainLoop();
}

function rainLoop() {
  const rect = rainCanvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  if (w === 0 || h === 0) {
    rainAnimFrame = requestAnimationFrame(rainLoop);
    return;
  }

  rainCtx.clearRect(0, 0, w, h);

  // Background
  rainCtx.fillStyle = '#060618';
  rainCtx.fillRect(0, 0, w, h);

  // Danger zone
  rainCtx.fillStyle = 'rgba(255, 51, 102, 0.05)';
  rainCtx.fillRect(0, h - 40, w, 40);
  rainCtx.strokeStyle = 'rgba(255, 51, 102, 0.3)';
  rainCtx.lineWidth = 1;
  rainCtx.beginPath();
  rainCtx.moveTo(0, h - 40);
  rainCtx.lineTo(w, h - 40);
  rainCtx.stroke();

  // Spawn words
  rainSpawnTimer++;
  const spawnRate = Math.max(30, 80 - Math.floor((Date.now() - rainStartTime) / 2000));
  if (rainSpawnTimer >= spawnRate) {
    rainSpawnTimer = 0;
    const word = PALAVRAS_CHUVA[Math.floor(Math.random() * PALAVRAS_CHUVA.length)];
    rainWords.push({
      text: word,
      x: 20 + Math.random() * (w - 80),
      y: -20,
      speed: 0.5 + Math.random() * 0.8 + (Date.now() - rainStartTime) / 60000,
      matched: 0,
      alive: true
    });
  }

  // Update & draw words
  const inputVal = rainInput.value.toLowerCase().trim();

  rainWords.forEach(rw => {
    if (!rw.alive) return;

    rw.y += rw.speed;

    // Check if matches input
    if (inputVal.length > 0 && rw.text.startsWith(inputVal)) {
      rw.matched = inputVal.length;
    } else {
      rw.matched = 0;
    }

    // Draw word
    const fontSize = Math.min(20, w / 25);
    rainCtx.font = `${fontSize}px 'Space Grotesk', sans-serif`;

    for (let i = 0; i < rw.text.length; i++) {
      const ch = rw.text[i];
      if (i < rw.matched) {
        rainCtx.fillStyle = '#00ff88';
        rainCtx.shadowColor = '#00ff88';
        rainCtx.shadowBlur = 8;
      } else {
        rainCtx.fillStyle = '#e8eaf0';
        rainCtx.shadowBlur = 0;
      }
      const charW = rainCtx.measureText(ch).width;
      const offsetX = rainCtx.measureText(rw.text.substring(0, i)).width;
      rainCtx.fillText(ch, rw.x + offsetX, rw.y);
    }
    rainCtx.shadowBlur = 0;

    // Hit bottom
    if (rw.y > h - 10) {
      rw.alive = false;
      rainMissed++;
    }
  });

  // Remove dead words
  rainWords = rainWords.filter(rw => rw.alive);

  // Draw score & missed
  rainCtx.font = "16px 'Space Grotesk', sans-serif";
  rainCtx.fillStyle = '#00f0ff';
  rainCtx.fillText(`Acertos: ${rainScore}`, 10, 25);
  rainCtx.fillStyle = '#ff3366';
  rainCtx.fillText(`Erros: ${rainMissed}/${RAIN_MAX_MISSED}`, w - 110, 25);

  // Car progress
  carProgress = Math.min(1, rainScore / 30);

  // Check game over by misses
  if (rainMissed >= RAIN_MAX_MISSED) {
    endGame();
    return;
  }

  if (gameActive) {
    rainAnimFrame = requestAnimationFrame(rainLoop);
  }
}

function onRainInput() {
  const val = rainInput.value.toLowerCase().trim();
  if (!val) return;

  // Check if any word matches completely
  const matchIdx = rainWords.findIndex(rw => rw.alive && rw.text === val);
  if (matchIdx !== -1) {
    rainWords[matchIdx].alive = false;
    rainScore++;
    correctChars += val.length;
    totalCharsTyped += val.length;
    rainInput.value = '';
    updateStats();
  }
}

// ---- Timer ----
function startTimer(countdownSecs) {
  startTime = Date.now();
  clearInterval(timerInterval);

  if (countdownSecs) {
    // Countdown
    let remaining = countdownSecs;
    timerDisplay.textContent = formatTime(remaining);

    timerInterval = setInterval(() => {
      if (!gameActive) { clearInterval(timerInterval); return; }
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      remaining = countdownSecs - elapsed;
      if (remaining <= 0) {
        remaining = 0;
        timerDisplay.textContent = '00:00';
        endGame();
        return;
      }
      timerDisplay.textContent = formatTime(remaining);
      updateStats();
    }, 250);
  } else {
    // Count up
    timerInterval = setInterval(() => {
      if (!gameActive) { clearInterval(timerInterval); return; }
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      timerDisplay.textContent = formatTime(elapsed);
      updateStats();
    }, 250);
  }
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---- Update stats (WPM, accuracy) ----
function updateStats() {
  const elapsedMin = (Date.now() - startTime) / 60000;
  if (elapsedMin > 0 && correctChars > 0) {
    // WPM = (correct chars / 5) / minutes
    currentWPM = Math.round((correctChars / 5) / elapsedMin);
  } else {
    currentWPM = 0;
  }

  if (totalCharsTyped > 0) {
    currentAccuracy = Math.round((correctChars / totalCharsTyped) * 100);
  } else {
    currentAccuracy = 100;
  }

  wpmDisplay.textContent = currentWPM;
  accuracyDisplay.textContent = `${currentAccuracy}%`;
}

// ---- End game ----
function endGame() {
  gameActive = false;
  clearInterval(timerInterval);

  // Calculate final stats
  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
  const elapsedMin = elapsedSec / 60;

  // For rain mode, calculate differently
  if (gameMode === 'rain') {
    if (elapsedMin > 0 && correctChars > 0) {
      currentWPM = Math.round((correctChars / 5) / elapsedMin);
    }
    currentAccuracy = rainMissed === 0 ? 100 : Math.max(0, Math.round((rainScore / (rainScore + rainMissed)) * 100));
  } else {
    // Recalculate for classic/marathon
    if (elapsedMin > 0 && correctChars > 0) {
      currentWPM = Math.round((correctChars / 5) / elapsedMin);
    }
  }

  wpmDisplay.textContent = currentWPM;

  // Check record
  const prevBest = getBestWPM();
  const isNewRecord = currentWPM > prevBest;
  if (isNewRecord) {
    setBestWPM(currentWPM);
    bestDisplay.textContent = currentWPM;
  }

  // Integration
  try {
    onGameEnd('digitacao', { won: true, score: currentWPM });
  } catch (e) { /* shared module may not exist */ }

  const modeNames = { classic: 'Classico', marathon: 'Maratona', rain: 'Chuva de Palavras' };

  // Disable inputs
  typingInput.oninput = null;
  rainInput.oninput = null;

  // Cancel rain loop
  if (rainAnimFrame) cancelAnimationFrame(rainAnimFrame);

  showOverlay('result', {
    wpm: currentWPM,
    accuracy: currentAccuracy,
    time: formatTime(elapsedSec),
    modeName: modeNames[gameMode],
    newRecord: isNewRecord
  });

  // Reset for next game
  carProgress = isNewRecord ? 1 : carProgress;
}

// ---- Share ----
function share() {
  const modeNames = { classic: 'Classico', marathon: 'Maratona', rain: 'Chuva de Palavras' };
  const text = `Digitacao Turbo: ${currentWPM} WPM com ${currentAccuracy}% de precisao no modo ${modeNames[gameMode]}!\nJogue: https://gameshub.com.br/games/digitacao/`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }
}

// ---- Polyfill roundRect if needed ----
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = [r, r, r, r];
    this.moveTo(x + r[0], y);
    this.lineTo(x + w - r[1], y);
    this.quadraticCurveTo(x + w, y, x + w, y + r[1]);
    this.lineTo(x + w, y + h - r[2]);
    this.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
    this.lineTo(x + r[3], y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r[3]);
    this.lineTo(x, y + r[0]);
    this.quadraticCurveTo(x, y, x + r[0], y);
    this.closePath();
  };
}

// ---- Boot ----
init();
