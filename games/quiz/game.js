import { GameStats } from '../shared/game-core.js';
import { onGameEnd } from '../shared/game-integration.js';

const stats = new GameStats('quiz');

// ========== QUESTIONS DATABASE ==========
const QUESTIONS = [
  // ===== GEOGRAFIA (25) =====
  { q: 'Qual e a capital do Brasil?', options: ['Sao Paulo', 'Brasilia', 'Rio de Janeiro', 'Salvador'], answer: 1, category: 'geografia' },
  { q: 'Qual e o maior pais do mundo em area?', options: ['China', 'EUA', 'Russia', 'Canada'], answer: 2, category: 'geografia' },
  { q: 'Qual e o rio mais longo do Brasil?', options: ['Amazonas', 'Sao Francisco', 'Parana', 'Tocantins'], answer: 0, category: 'geografia' },
  { q: 'Quantos estados tem o Brasil?', options: ['24', '25', '26', '27'], answer: 2, category: 'geografia' },
  { q: 'Qual oceano banha a costa brasileira?', options: ['Pacifico', 'Indico', 'Atlantico', 'Artico'], answer: 2, category: 'geografia' },
  { q: 'Qual e o maior deserto do mundo?', options: ['Gobi', 'Kalahari', 'Saara', 'Atacama'], answer: 2, category: 'geografia' },
  { q: 'Em qual continente fica o Egito?', options: ['Asia', 'Africa', 'Europa', 'Oceania'], answer: 1, category: 'geografia' },
  { q: 'Qual e o pico mais alto do Brasil?', options: ['Pico da Neblina', 'Pico da Bandeira', 'Monte Roraima', 'Pico do Cristal'], answer: 0, category: 'geografia' },
  { q: 'Qual pais tem formato de bota?', options: ['Grecia', 'Portugal', 'Italia', 'Espanha'], answer: 2, category: 'geografia' },
  { q: 'Qual e a capital da Argentina?', options: ['Santiago', 'Montevideu', 'Buenos Aires', 'Lima'], answer: 2, category: 'geografia' },
  { q: 'Qual e o menor pais do mundo?', options: ['Monaco', 'Vaticano', 'San Marino', 'Liechtenstein'], answer: 1, category: 'geografia' },
  { q: 'Qual e o maior lago da America do Sul?', options: ['Titicaca', 'Maracaibo', 'Guaiba', 'Patos'], answer: 0, category: 'geografia' },
  { q: 'Em que estado brasileiro fica a cidade de Manaus?', options: ['Para', 'Amazonas', 'Roraima', 'Acre'], answer: 1, category: 'geografia' },
  { q: 'Qual e a montanha mais alta do mundo?', options: ['K2', 'Kangchenjunga', 'Everest', 'Lhotse'], answer: 2, category: 'geografia' },
  { q: 'Qual pais tem mais habitantes no mundo?', options: ['India', 'EUA', 'China', 'Indonesia'], answer: 0, category: 'geografia' },
  { q: 'Qual e a capital do Japao?', options: ['Osaka', 'Toquio', 'Quioto', 'Hiroshima'], answer: 1, category: 'geografia' },
  { q: 'Qual rio corta a cidade de Paris?', options: ['Tamisa', 'Reno', 'Sena', 'Danubio'], answer: 2, category: 'geografia' },
  { q: 'Qual e o maior estado do Brasil em area?', options: ['Minas Gerais', 'Para', 'Amazonas', 'Mato Grosso'], answer: 2, category: 'geografia' },
  { q: 'Qual e a capital de Portugal?', options: ['Porto', 'Lisboa', 'Coimbra', 'Faro'], answer: 1, category: 'geografia' },
  { q: 'Em que continente fica a Australia?', options: ['Asia', 'Oceania', 'America', 'Europa'], answer: 1, category: 'geografia' },
  { q: 'Qual e o rio mais longo do mundo?', options: ['Amazonas', 'Nilo', 'Mississipi', 'Yangtzé'], answer: 1, category: 'geografia' },
  { q: 'Qual pais e conhecido como "terra do sol nascente"?', options: ['China', 'Coreia do Sul', 'Japao', 'Tailandia'], answer: 2, category: 'geografia' },
  { q: 'Qual e a capital da Alemanha?', options: ['Munique', 'Berlim', 'Frankfurt', 'Hamburgo'], answer: 1, category: 'geografia' },
  { q: 'Quantos continentes existem?', options: ['5', '6', '7', '8'], answer: 2, category: 'geografia' },
  { q: 'Qual e o maior arquipelago do mundo?', options: ['Filipinas', 'Japao', 'Indonesia', 'Maldivas'], answer: 2, category: 'geografia' },

  // ===== HISTORIA (25) =====
  { q: 'Em que ano o Brasil foi descoberto?', options: ['1492', '1500', '1510', '1498'], answer: 1, category: 'historia' },
  { q: 'Quem proclamou a independencia do Brasil?', options: ['Tiradentes', 'D. Pedro I', 'D. Pedro II', 'Getulio Vargas'], answer: 1, category: 'historia' },
  { q: 'Em que ano a escravidao foi abolida no Brasil?', options: ['1822', '1889', '1888', '1900'], answer: 2, category: 'historia' },
  { q: 'Quem foi o primeiro presidente do Brasil?', options: ['Getulio Vargas', 'Deodoro da Fonseca', 'Floriano Peixoto', 'Prudente de Morais'], answer: 1, category: 'historia' },
  { q: 'Em que ano comecou a Segunda Guerra Mundial?', options: ['1935', '1939', '1941', '1937'], answer: 1, category: 'historia' },
  { q: 'Qual civilizacao construiu as piramides de Gize?', options: ['Romana', 'Grega', 'Egipcia', 'Mesopotamica'], answer: 2, category: 'historia' },
  { q: 'Quem pintou a Mona Lisa?', options: ['Michelangelo', 'Rafael', 'Leonardo da Vinci', 'Donatello'], answer: 2, category: 'historia' },
  { q: 'Em que ano o homem pisou na Lua pela primeira vez?', options: ['1965', '1969', '1971', '1967'], answer: 1, category: 'historia' },
  { q: 'Qual era o nome da esposa de D. Pedro I?', options: ['Leopoldina', 'Isabel', 'Maria', 'Carlota'], answer: 0, category: 'historia' },
  { q: 'Em que ano caiu o Muro de Berlim?', options: ['1985', '1989', '1991', '1987'], answer: 1, category: 'historia' },
  { q: 'Quem liderou a Revolucao Francesa?', options: ['Napoleao', 'O povo', 'Luis XVI', 'Robespierre'], answer: 3, category: 'historia' },
  { q: 'Qual foi a primeira capital do Brasil?', options: ['Rio de Janeiro', 'Brasilia', 'Salvador', 'Recife'], answer: 2, category: 'historia' },
  { q: 'Em que seculo aconteceu o Renascimento?', options: ['XIII', 'XIV-XVI', 'XVII', 'XVIII'], answer: 1, category: 'historia' },
  { q: 'Quem descobriu a America?', options: ['Vasco da Gama', 'Cristovao Colombo', 'Pedro Cabral', 'Americo Vespucio'], answer: 1, category: 'historia' },
  { q: 'Qual imperador romano incendiou Roma?', options: ['Julio Cesar', 'Augusto', 'Nero', 'Caligula'], answer: 2, category: 'historia' },
  { q: 'Em que ano o Brasil se tornou republica?', options: ['1822', '1888', '1889', '1891'], answer: 2, category: 'historia' },
  { q: 'Quem foi Cleópatra?', options: ['Rainha da Grecia', 'Rainha do Egito', 'Imperatriz de Roma', 'Rainha da Persia'], answer: 1, category: 'historia' },
  { q: 'Qual guerra durou de 1914 a 1918?', options: ['Guerra Fria', 'Guerra do Vietna', 'Primeira Guerra Mundial', 'Guerra dos Cem Anos'], answer: 2, category: 'historia' },
  { q: 'Quem foi Tiradentes?', options: ['Padre', 'Militar e dentista', 'Medico', 'Advogado'], answer: 1, category: 'historia' },
  { q: 'Em que ano Brasilia foi inaugurada?', options: ['1950', '1955', '1960', '1964'], answer: 2, category: 'historia' },
  { q: 'Qual povo inventou a democracia?', options: ['Romanos', 'Gregos', 'Egipcios', 'Persas'], answer: 1, category: 'historia' },
  { q: 'Quem escreveu "Os Lusiadas"?', options: ['Machado de Assis', 'Camoes', 'Fernando Pessoa', 'Gil Vicente'], answer: 1, category: 'historia' },
  { q: 'Em que ano terminou a Segunda Guerra Mundial?', options: ['1943', '1944', '1945', '1946'], answer: 2, category: 'historia' },
  { q: 'Qual era o sistema politico do Brasil antes de 1889?', options: ['Republica', 'Monarquia', 'Ditadura', 'Anarquia'], answer: 1, category: 'historia' },
  { q: 'Quem foi o ultimo imperador do Brasil?', options: ['D. Pedro I', 'D. Pedro II', 'D. Joao VI', 'D. Jose'], answer: 1, category: 'historia' },

  // ===== CULTURA POP (25) =====
  { q: 'Quem criou o Mickey Mouse?', options: ['Pixar', 'Walt Disney', 'Warner Bros', 'DreamWorks'], answer: 1, category: 'cultura' },
  { q: 'Qual e o nome do bruxo mais famoso da literatura?', options: ['Gandalf', 'Harry Potter', 'Merlin', 'Dumbledore'], answer: 1, category: 'cultura' },
  { q: 'Quem interpretou Jack Sparrow?', options: ['Brad Pitt', 'Johnny Depp', 'Orlando Bloom', 'Tom Cruise'], answer: 1, category: 'cultura' },
  { q: 'Qual banda lançou o album "Abbey Road"?', options: ['Rolling Stones', 'Queen', 'Beatles', 'Pink Floyd'], answer: 2, category: 'cultura' },
  { q: 'Qual super-heroi e conhecido como "Homem de Aco"?', options: ['Batman', 'Homem-Aranha', 'Superman', 'Thor'], answer: 2, category: 'cultura' },
  { q: 'Qual filme ganhou 11 Oscars em 2004?', options: ['Gladiador', 'O Senhor dos Aneis: O Retorno do Rei', 'Titanic', 'Ben-Hur'], answer: 1, category: 'cultura' },
  { q: 'Quem cantou "Thriller"?', options: ['Prince', 'Michael Jackson', 'Stevie Wonder', 'Whitney Houston'], answer: 1, category: 'cultura' },
  { q: 'Qual e o nome do pai do Simba em "O Rei Leao"?', options: ['Scar', 'Rafiki', 'Mufasa', 'Zazu'], answer: 2, category: 'cultura' },
  { q: 'Em que ano foi lancado o primeiro iPhone?', options: ['2005', '2006', '2007', '2008'], answer: 2, category: 'cultura' },
  { q: 'Qual e o nome do vilao principal de Star Wars?', options: ['Darth Maul', 'Darth Vader', 'Kylo Ren', 'Palpatine'], answer: 1, category: 'cultura' },
  { q: 'Quem escreveu "Game of Thrones"?', options: ['J.R.R. Tolkien', 'George R.R. Martin', 'Stephen King', 'J.K. Rowling'], answer: 1, category: 'cultura' },
  { q: 'Qual rede social e representada por um passaro azul?', options: ['Facebook', 'Instagram', 'Twitter/X', 'LinkedIn'], answer: 2, category: 'cultura' },
  { q: 'Quem e a "Rainha do Pop"?', options: ['Beyonce', 'Lady Gaga', 'Madonna', 'Rihanna'], answer: 2, category: 'cultura' },
  { q: 'Qual personagem diz "Eu sou Groot"?', options: ['Rocket', 'Groot', 'Drax', 'Star-Lord'], answer: 1, category: 'cultura' },
  { q: 'Qual serie se passa em Hawkins, Indiana?', options: ['The Walking Dead', 'Stranger Things', 'Dark', 'Lost'], answer: 1, category: 'cultura' },
  { q: 'Quem dirigiu "Pulp Fiction"?', options: ['Martin Scorsese', 'Steven Spielberg', 'Quentin Tarantino', 'Christopher Nolan'], answer: 2, category: 'cultura' },
  { q: 'Qual e o jogo de video game mais vendido da historia?', options: ['GTA V', 'Minecraft', 'Tetris', 'Mario Bros'], answer: 1, category: 'cultura' },
  { q: 'Qual cantor e conhecido como "Rei do Rock"?', options: ['Chuck Berry', 'Elvis Presley', 'Little Richard', 'Buddy Holly'], answer: 1, category: 'cultura' },
  { q: 'Qual e o nome da princesa de "Frozen"?', options: ['Anna e Elsa', 'Aurora', 'Rapunzel', 'Bela'], answer: 0, category: 'cultura' },
  { q: 'Em qual cidade se passa "Friends"?', options: ['Los Angeles', 'Chicago', 'Nova York', 'Boston'], answer: 2, category: 'cultura' },
  { q: 'Quem e o detetive mais famoso da literatura?', options: ['Hercule Poirot', 'Sherlock Holmes', 'Miss Marple', 'Philip Marlowe'], answer: 1, category: 'cultura' },
  { q: 'Qual e o nome do protagonista de "Breaking Bad"?', options: ['Jesse Pinkman', 'Walter White', 'Hank Schrader', 'Saul Goodman'], answer: 1, category: 'cultura' },
  { q: 'Qual filme conta a historia do navio que afundou em 1912?', options: ['Poseidon', 'Titanic', 'A Vida e Bela', 'Pearl Harbor'], answer: 1, category: 'cultura' },
  { q: 'Quem interpretou o Coringa no filme de 2019?', options: ['Heath Ledger', 'Jack Nicholson', 'Joaquin Phoenix', 'Jared Leto'], answer: 2, category: 'cultura' },
  { q: 'Qual banda cantou "Bohemian Rhapsody"?', options: ['Led Zeppelin', 'Queen', 'The Who', 'AC/DC'], answer: 1, category: 'cultura' },

  // ===== CIENCIAS (25) =====
  { q: 'Qual e o elemento quimico mais abundante no universo?', options: ['Oxigenio', 'Carbono', 'Hidrogenio', 'Helio'], answer: 2, category: 'ciencias' },
  { q: 'Qual planeta e conhecido como "planeta vermelho"?', options: ['Venus', 'Jupiter', 'Marte', 'Saturno'], answer: 2, category: 'ciencias' },
  { q: 'Quantos ossos tem o corpo humano adulto?', options: ['196', '206', '216', '226'], answer: 1, category: 'ciencias' },
  { q: 'Qual e a formula quimica da agua?', options: ['CO2', 'H2O', 'NaCl', 'O2'], answer: 1, category: 'ciencias' },
  { q: 'Qual e o maior orgao do corpo humano?', options: ['Figado', 'Cerebro', 'Pele', 'Intestino'], answer: 2, category: 'ciencias' },
  { q: 'Qual gas as plantas absorvem da atmosfera?', options: ['Oxigenio', 'Nitrogenio', 'Gas carbonico', 'Hidrogenio'], answer: 2, category: 'ciencias' },
  { q: 'Qual e a velocidade da luz?', options: ['300 mil km/s', '150 mil km/s', '500 mil km/s', '1 milhao km/s'], answer: 0, category: 'ciencias' },
  { q: 'Quem formulou a teoria da relatividade?', options: ['Newton', 'Einstein', 'Hawking', 'Bohr'], answer: 1, category: 'ciencias' },
  { q: 'Qual e o planeta mais proximo do Sol?', options: ['Venus', 'Terra', 'Mercurio', 'Marte'], answer: 2, category: 'ciencias' },
  { q: 'O que e DNA?', options: ['Acido ribonucleico', 'Acido desoxirribonucleico', 'Uma proteina', 'Um lipidio'], answer: 1, category: 'ciencias' },
  { q: 'Qual e o metal mais abundante na crosta terrestre?', options: ['Ferro', 'Aluminio', 'Cobre', 'Ouro'], answer: 1, category: 'ciencias' },
  { q: 'Quantos planetas tem o sistema solar?', options: ['7', '8', '9', '10'], answer: 1, category: 'ciencias' },
  { q: 'Qual e a unidade de medida de forca?', options: ['Watt', 'Joule', 'Newton', 'Pascal'], answer: 2, category: 'ciencias' },
  { q: 'Qual vitamina e produzida pela exposicao ao sol?', options: ['Vitamina A', 'Vitamina C', 'Vitamina D', 'Vitamina E'], answer: 2, category: 'ciencias' },
  { q: 'Qual e o gas mais abundante na atmosfera terrestre?', options: ['Oxigenio', 'Nitrogenio', 'Gas carbonico', 'Argonio'], answer: 1, category: 'ciencias' },
  { q: 'Qual cientista descobriu a penicilina?', options: ['Pasteur', 'Fleming', 'Koch', 'Jenner'], answer: 1, category: 'ciencias' },
  { q: 'Qual e a estrela mais proxima da Terra?', options: ['Sirius', 'Alpha Centauri', 'Sol', 'Proxima Centauri'], answer: 2, category: 'ciencias' },
  { q: 'Qual parte da celula contem o DNA?', options: ['Membrana', 'Citoplasma', 'Nucleo', 'Ribossomo'], answer: 2, category: 'ciencias' },
  { q: 'O que mede um termometro?', options: ['Pressao', 'Umidade', 'Temperatura', 'Altitude'], answer: 2, category: 'ciencias' },
  { q: 'Qual e o simbolo quimico do ouro?', options: ['Ag', 'Fe', 'Au', 'Cu'], answer: 2, category: 'ciencias' },
  { q: 'Qual e o maior planeta do sistema solar?', options: ['Saturno', 'Jupiter', 'Urano', 'Netuno'], answer: 1, category: 'ciencias' },
  { q: 'O que e fotossintese?', options: ['Producao de luz', 'Producao de alimento pelas plantas', 'Decomposicao', 'Respiracao celular'], answer: 1, category: 'ciencias' },
  { q: 'Qual orgao e responsavel por filtrar o sangue?', options: ['Figado', 'Coracao', 'Rim', 'Pulmao'], answer: 2, category: 'ciencias' },
  { q: 'Qual e o ponto de ebulicao da agua ao nivel do mar?', options: ['90 graus C', '100 graus C', '110 graus C', '120 graus C'], answer: 1, category: 'ciencias' },
  { q: 'Quem e considerado o pai da fisica moderna?', options: ['Galileu', 'Newton', 'Einstein', 'Copérnico'], answer: 2, category: 'ciencias' },

  // ===== ESPORTES (25) =====
  { q: 'Quantas Copas do Mundo o Brasil ganhou?', options: ['3', '4', '5', '6'], answer: 2, category: 'esportes' },
  { q: 'Qual esporte usa raquete e peteca?', options: ['Tenis', 'Badminton', 'Squash', 'Ping-pong'], answer: 1, category: 'esportes' },
  { q: 'Quantos jogadores tem um time de futebol em campo?', options: ['9', '10', '11', '12'], answer: 2, category: 'esportes' },
  { q: 'Qual pais sediou a Copa do Mundo de 2014?', options: ['Russia', 'Africa do Sul', 'Brasil', 'Alemanha'], answer: 2, category: 'esportes' },
  { q: 'Quem e considerado o maior jogador de basquete?', options: ['Kobe Bryant', 'LeBron James', 'Michael Jordan', 'Magic Johnson'], answer: 2, category: 'esportes' },
  { q: 'Qual e o esporte mais popular do mundo?', options: ['Basquete', 'Cricket', 'Futebol', 'Tenis'], answer: 2, category: 'esportes' },
  { q: 'Quantos sets sao necessarios para vencer no volei?', options: ['2', '3', '5', '4'], answer: 1, category: 'esportes' },
  { q: 'Qual nadador tem mais medalhas olimpicas?', options: ['Ian Thorpe', 'Michael Phelps', 'Ryan Lochte', 'Mark Spitz'], answer: 1, category: 'esportes' },
  { q: 'Qual pais inventou o futebol moderno?', options: ['Brasil', 'Alemanha', 'Inglaterra', 'Italia'], answer: 2, category: 'esportes' },
  { q: 'Qual esporte e praticado em Wimbledon?', options: ['Golf', 'Cricket', 'Tenis', 'Polo'], answer: 2, category: 'esportes' },
  { q: 'Quantas rodadas tem um jogo de boxe profissional?', options: ['10', '12', '15', '8'], answer: 1, category: 'esportes' },
  { q: 'Qual corredor jamaicano e recordista dos 100m rasos?', options: ['Asafa Powell', 'Usain Bolt', 'Yohan Blake', 'Tyson Gay'], answer: 1, category: 'esportes' },
  { q: 'Qual selecao ganhou a Copa do Mundo de 2022?', options: ['Franca', 'Brasil', 'Argentina', 'Croacia'], answer: 2, category: 'esportes' },
  { q: 'Quantos pontos vale um touchdown no futebol americano?', options: ['3', '5', '6', '7'], answer: 2, category: 'esportes' },
  { q: 'Qual tenista tem mais Grand Slams masculinos?', options: ['Roger Federer', 'Rafael Nadal', 'Novak Djokovic', 'Pete Sampras'], answer: 2, category: 'esportes' },
  { q: 'Qual e a duracao de um jogo de futebol?', options: ['80 minutos', '90 minutos', '100 minutos', '120 minutos'], answer: 1, category: 'esportes' },
  { q: 'Qual esporte usa taco e bola em um campo verde?', options: ['Cricket', 'Baseball', 'Golf', 'Polo'], answer: 2, category: 'esportes' },
  { q: 'Em que cidade serao as Olimpiadas de 2028?', options: ['Paris', 'Los Angeles', 'Toquio', 'Brisbane'], answer: 1, category: 'esportes' },
  { q: 'Qual jogador brasileiro e conhecido como "Rei do Futebol"?', options: ['Garrincha', 'Zico', 'Pele', 'Ronaldo'], answer: 2, category: 'esportes' },
  { q: 'Qual esporte e jogado em piscina com gol?', options: ['Polo aquatico', 'Nado sincronizado', 'Saltos ornamentais', 'Surf'], answer: 0, category: 'esportes' },
  { q: 'Quantos jogadores tem um time de basquete em quadra?', options: ['4', '5', '6', '7'], answer: 1, category: 'esportes' },
  { q: 'Qual clube de futebol e conhecido como "Mengao"?', options: ['Vasco', 'Fluminense', 'Flamengo', 'Botafogo'], answer: 2, category: 'esportes' },
  { q: 'Qual piloto de F1 tem mais titulos mundiais?', options: ['Ayrton Senna', 'Michael Schumacher', 'Lewis Hamilton', 'Max Verstappen'], answer: 2, category: 'esportes' },
  { q: 'Qual esporte utiliza luvas e um ringue?', options: ['Judo', 'Karate', 'Boxe', 'Luta livre'], answer: 2, category: 'esportes' },
  { q: 'Qual pais ganhou mais medalhas olimpicas na historia?', options: ['China', 'Russia', 'EUA', 'Gra-Bretanha'], answer: 2, category: 'esportes' },
];

// ========== GAME STATE ==========
let currentCategory = 'all';
let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let correctCount = 0;
let timerInterval = null;
let timeLeft = 15;
let gameStartTime = 0;
let questionStartTime = 0;
let answered = false;

const TOTAL_QUESTIONS = 10;
const TIME_PER_QUESTION = 15;
const BASE_SCORE = 100;
const MAX_SPEED_BONUS = 50;

// ========== DOM ELEMENTS ==========
const categoriesEl = document.getElementById('categories');
const startScreen = document.getElementById('start-screen');
const questionArea = document.getElementById('question-area');
const questionText = document.getElementById('question-text');
const optionsEl = document.getElementById('options');
const qNumEl = document.getElementById('q-num');
const scoreEl = document.getElementById('score');
const timerFill = document.getElementById('timer-fill');
const catBadge = document.getElementById('cat-badge');
const modalOverlay = document.getElementById('modal');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-msg');
const modalStats = document.getElementById('modal-stats');
const btnStart = document.getElementById('btn-start');
const btnNew = document.getElementById('btn-new');
const btnShare = document.getElementById('btn-share');

// ========== CATEGORY SELECTION ==========
categoriesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-btn');
  if (!btn) return;
  categoriesEl.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentCategory = btn.dataset.cat;
});

// ========== GAME FUNCTIONS ==========
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getQuestions() {
  let pool = currentCategory === 'all'
    ? [...QUESTIONS]
    : QUESTIONS.filter(q => q.category === currentCategory);
  return shuffle(pool).slice(0, TOTAL_QUESTIONS);
}

const categoryLabels = {
  geografia: 'Geografia',
  historia: 'Historia',
  cultura: 'Cultura Pop',
  ciencias: 'Ciencias',
  esportes: 'Esportes'
};

function startGame() {
  currentQuestions = getQuestions();
  currentIndex = 0;
  score = 0;
  correctCount = 0;
  gameStartTime = Date.now();

  scoreEl.textContent = '0';
  startScreen.style.display = 'none';
  questionArea.style.display = 'block';
  categoriesEl.style.display = 'none';

  showQuestion();
}

function showQuestion() {
  if (currentIndex >= currentQuestions.length) {
    endGame();
    return;
  }

  answered = false;
  const q = currentQuestions[currentIndex];
  questionStartTime = Date.now();

  qNumEl.textContent = currentIndex + 1;
  questionText.textContent = q.q;
  catBadge.textContent = categoryLabels[q.category] || q.category;

  const letters = ['A', 'B', 'C', 'D'];
  optionsEl.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-letter">${letters[i]}</span>${opt}`;
    btn.addEventListener('click', () => selectAnswer(i));
    optionsEl.appendChild(btn);
  });

  startTimer();
}

function startTimer() {
  timeLeft = TIME_PER_QUESTION;
  timerFill.style.width = '100%';
  timerFill.classList.remove('warning');

  clearInterval(timerInterval);
  const startTime = Date.now();

  timerInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    timeLeft = Math.max(0, TIME_PER_QUESTION - elapsed);
    const pct = (timeLeft / TIME_PER_QUESTION) * 100;
    timerFill.style.width = pct + '%';

    if (timeLeft <= 5) {
      timerFill.classList.add('warning');
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (!answered) {
        timeUp();
      }
    }
  }, 50);
}

function timeUp() {
  answered = true;
  const q = currentQuestions[currentIndex];
  const buttons = optionsEl.querySelectorAll('.option-btn');

  buttons.forEach((btn, i) => {
    btn.classList.add('disabled');
    if (i === q.answer) {
      btn.classList.add('correct');
    }
  });

  setTimeout(() => {
    currentIndex++;
    showQuestion();
  }, 1500);
}

function selectAnswer(index) {
  if (answered) return;
  answered = true;
  clearInterval(timerInterval);

  const q = currentQuestions[currentIndex];
  const isCorrect = index === q.answer;
  const buttons = optionsEl.querySelectorAll('.option-btn');

  buttons.forEach((btn, i) => {
    btn.classList.add('disabled');
    if (i === q.answer) {
      btn.classList.add('correct');
    }
    if (i === index && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  if (isCorrect) {
    correctCount++;
    const elapsed = (Date.now() - questionStartTime) / 1000;
    const speedRatio = Math.max(0, (TIME_PER_QUESTION - elapsed) / TIME_PER_QUESTION);
    const speedBonus = Math.round(speedRatio * MAX_SPEED_BONUS);
    score += BASE_SCORE + speedBonus;
    scoreEl.textContent = score;
  }

  setTimeout(() => {
    currentIndex++;
    showQuestion();
  }, 1200);
}

function endGame() {
  clearInterval(timerInterval);
  questionArea.style.display = 'none';

  const totalTime = Math.round((Date.now() - gameStartTime) / 1000);
  const pct = Math.round((correctCount / TOTAL_QUESTIONS) * 100);

  // Update stats
  try {
    stats.update({
      gamesPlayed: (v) => v + 1,
      totalScore: (v) => v + score,
      totalTime: (v) => v + totalTime,
      highScore: (v) => Math.max(v, score),
      lastPlayed: new Date().toISOString()
    });
    if (pct >= 70) {
      stats.update({ gamesWon: (v) => v + 1 });
    }
  } catch (e) {
    console.warn('Stats error:', e);
  }

  // Modal content
  if (pct === 100) {
    modalIcon.textContent = '\u{1F3C6}';
    modalTitle.textContent = 'Perfeito!';
    modalMsg.textContent = 'Voce acertou todas as perguntas!';
  } else if (pct >= 70) {
    modalIcon.textContent = '\u{1F31F}';
    modalTitle.textContent = 'Muito Bem!';
    modalMsg.textContent = 'Otimo desempenho!';
  } else if (pct >= 40) {
    modalIcon.textContent = '\u{1F44D}';
    modalTitle.textContent = 'Bom Jogo!';
    modalMsg.textContent = 'Continue praticando para melhorar!';
  } else {
    modalIcon.textContent = '\u{1F4AA}';
    modalTitle.textContent = 'Nao Desista!';
    modalMsg.textContent = 'Tente novamente e melhore sua pontuacao!';
  }

  const mins = Math.floor(totalTime / 60);
  const secs = totalTime % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  modalStats.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">Acertos</span>
      <span class="stat-value">${correctCount}/${TOTAL_QUESTIONS}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Pontuacao</span>
      <span class="stat-value accent">${score}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Aproveitamento</span>
      <span class="stat-value">${pct}%</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Tempo</span>
      <span class="stat-value accent">${timeStr}</span>
    </div>
  `;

  modalOverlay.classList.remove('hidden');
  onGameEnd('quiz', { won: pct >= 70, score, time: totalTime * 1000 });
}

function resetGame() {
  modalOverlay.classList.add('hidden');
  questionArea.style.display = 'none';
  startScreen.style.display = 'flex';
  categoriesEl.style.display = 'flex';
  clearInterval(timerInterval);
}

// ========== SHARE ==========
function shareWhatsApp() {
  const pct = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
  const catName = currentCategory === 'all' ? 'Todas' : categoryLabels[currentCategory];
  const text = `🧠 Quiz Battle - Games Hub\n\n` +
    `Acertei ${correctCount}/${TOTAL_QUESTIONS} (${pct}%)\n` +
    `Pontuacao: ${score} pontos\n` +
    `Categoria: ${catName}\n\n` +
    `Jogue tambem: https://gameshub.com.br/games/quiz/`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// ========== EVENT LISTENERS ==========
btnStart.addEventListener('click', startGame);
btnNew.addEventListener('click', resetGame);
btnShare.addEventListener('click', shareWhatsApp);
