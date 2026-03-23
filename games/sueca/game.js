// =============================================
//  Sueca - Games Hub
//  Jogo de cartas português - 2 duplas
// =============================================

import '../../auth-check.js?v=4';
import { supabase } from '../../supabase.js?v=2';
import { launchConfetti, playSound, initAudio, haptic } from '../shared/game-design-utils.js?v=4';
import { onGameEnd } from '../shared/game-integration.js';

const GAME_NAME = 'sueca';
const IS_MOBILE = window.matchMedia('(pointer: coarse)').matches;

// Elementos DOM
const overlay = document.getElementById('overlay');
const gameRules = document.getElementById('game-rules');
const btnSingle = document.getElementById('btn-single');
const btnMulti = document.getElementById('btn-multi');
const btnStart = document.getElementById('btn-start');
const playerHand = document.getElementById('player-hand');
const trumpIndicator = document.getElementById('trump-suit');
const ourScoreEl = document.getElementById('our-score');
const theirScoreEl = document.getElementById('their-score');
const turnIndicator = document.getElementById('turn-indicator');
const endScreen = document.getElementById('end-screen');
const finalScores = document.getElementById('final-scores');
const btnNewGame = document.getElementById('btn-new-game');

// Áreas de cartas jogadas
const trickCards = {
  0: document.getElementById('card-bottom'),  // Jogador
  1: document.getElementById('card-left'),   // Adversário 1
  2: document.getElementById('card-top'),      // Parceiro
  3: document.getElementById('card-right')    // Adversário 2
};

// Estado do jogo
let gameState = 'menu'; // menu | playing | ended
let deck = [];
let hands = [[], [], [], []]; // 0=jogador, 1=adv1, 2=parceiro, 3=adv2
let trumpSuit = '';
let currentPlayer = 0;
let trick = []; // Cartas jogadas na rodada atual
let scores = { us: 0, them: 0 };
let tricksWon = { us: 0, them: 0 };
let isMultiplayer = false;
let roomId = null;
let myPosition = 0;
let channel = null;

// Configuração das cartas
const SUITS = ['♠', '♥', '♦', '♣']; // Espadas, Copas, Ouros, Paus
const SUIT_NAMES = { '♠': 'espadas', '♥': 'copas', '♦': 'ouros', '♣': 'paus' };
const RANKS = ['7', '6', 'A', '5', '4', '3', '2', 'Q', 'J', 'K'];
const RANK_VALUES = { '7': 10, '6': 9, 'A': 8, '5': 7, '4': 6, '3': 5, '2': 4, 'Q': 3, 'J': 2, 'K': 1 };
const CARD_POINTS = { 'A': 11, '7': 10, 'K': 4, 'J': 3, 'Q': 2 };

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  btnSingle.addEventListener('click', () => selectMode(false));
  btnMulti.addEventListener('click', () => selectMode(true));
  btnStart.addEventListener('click', startGame);
  btnNewGame.addEventListener('click', resetGame);
});

function selectMode(multiplayer) {
  isMultiplayer = multiplayer;
  if (multiplayer) {
    window.location.href = '/multiplayer.html?game=sueca';
    return;
  }
  gameRules.classList.remove('hidden');
  btnSingle.classList.add('hidden');
  btnMulti.classList.add('hidden');
}

// Criar baralho (40 cartas, sem 8, 9, 10)
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, points: CARD_POINTS[rank] || 0 });
    }
  }
  return shuffle(deck);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Distribuir cartas
function dealCards() {
  deck = createDeck();
  hands = [[], [], [], []];

  // Distribuir 10 cartas para cada jogador
  for (let i = 0; i < 40; i++) {
    hands[i % 4].push(deck[i]);
  }

  // O último card (deck[39]) define o trunfo
  trumpSuit = deck[39].suit;
  trumpIndicator.textContent = trumpSuit;
}

// Renderizar mão do jogador
function renderPlayerHand() {
  playerHand.innerHTML = '';

  hands[0].forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.index = index;
    cardEl.dataset.suit = card.suit;
    cardEl.dataset.rank = card.rank;

    const isRed = card.suit === '♥' || card.suit === '♦';
    cardEl.innerHTML = `
      <span class="rank ${isRed ? 'red' : ''}">${card.rank}</span>
      <span class="suit ${isRed ? 'red' : ''}">${card.suit}</span>
    `;

    cardEl.addEventListener('click', () => playCard(index));
    playerHand.appendChild(cardEl);
  });
}

// Verificar se pode jogar carta
function canPlayCard(cardIndex) {
  if (currentPlayer !== 0) return false;
  if (trick.length === 0) return true; // Primeiro a jogar pode qualquer carta

  const card = hands[0][cardIndex];
  const leadSuit = trick[0].card.suit;

  // Se tem carta do naipe, deve jogar
  const hasLeadSuit = hands[0].some(c => c.suit === leadSuit);
  if (hasLeadSuit && card.suit !== leadSuit) return false;

  return true;
}

// Jogar carta
function playCard(cardIndex) {
  if (!canPlayCard(cardIndex)) {
    haptic('error');
    return;
  }

  const card = hands[0].splice(cardIndex, 1)[0];
  trick.push({ player: 0, card });

  renderPlayedCard(0, card);
  renderPlayerHand();
  haptic('light');

  if (isMultiplayer) {
    broadcastMove(0, card);
  }

  nextTurn();
}

// Renderizar carta jogada
function renderPlayedCard(player, card) {
  const el = trickCards[player];
  const isRed = card.suit === '♥' || card.suit === '♦';
  el.innerHTML = `
    <span class="rank ${isRed ? 'red' : ''}">${card.rank}</span>
    <span class="suit ${isRed ? 'red' : ''}">${card.suit}</span>
  `;
  el.classList.add('visible');
}

// Próximo turno
function nextTurn() {
  currentPlayer = (currentPlayer + 1) % 4;

  if (trick.length === 4) {
    setTimeout(endTrick, 1000);
  } else if (!isMultiplayer && currentPlayer !== 0) {
    setTimeout(botPlay, 1000);
  } else if (currentPlayer === 0) {
    turnIndicator.classList.remove('hidden');
  }
}

// IA dos bots
function botPlay() {
  const hand = hands[currentPlayer];
  if (hand.length === 0) return;

  let cardIndex = 0;

  if (trick.length > 0) {
    const leadSuit = trick[0].card.suit;
    const hasLeadSuit = hand.some(c => c.suit === leadSuit);

    if (hasLeadSuit) {
      // Jogar a menor carta do naipe
      cardIndex = hand.findIndex(c => c.suit === leadSuit);
    } else {
      // Verificar se tem trunfo
      const hasTrump = hand.some(c => c.suit === trumpSuit);
      if (hasTrump) {
        // Cortar com trunfo (menor)
        cardIndex = hand.findIndex(c => c.suit === trumpSuit);
      } else {
        // Descartar menor carta
        cardIndex = 0;
      }
    }
  } else {
    // Primeiro a jogar - jogar carta média
    cardIndex = Math.floor(hand.length / 2);
  }

  const card = hand.splice(cardIndex, 1)[0];
  trick.push({ player: currentPlayer, card });

  renderPlayedCard(currentPlayer, card);
  nextTurn();
}

// Determinar vencedor da rodada
function getTrickWinner() {
  const leadSuit = trick[0].card.suit;
  let winner = trick[0];

  for (const play of trick) {
    const card = play.card;
    const winnerCard = winner.card;

    // Trunfo vence
    if (card.suit === trumpSuit && winnerCard.suit !== trumpSuit) {
      winner = play;
      continue;
    }
    if (winnerCard.suit === trumpSuit && card.suit !== trumpSuit) {
      continue;
    }

    // Mesmo naipe - comparar valor
    if (card.suit === winnerCard.suit) {
      if (RANK_VALUES[card.rank] > RANK_VALUES[winnerCard.rank]) {
        winner = play;
      }
    }
  }

  return winner.player;
}

// Fim da rodada
function endTrick() {
  const winner = getTrickWinner();
  const isOurTeam = winner === 0 || winner === 2;

  // Calcular pontos
  const points = trick.reduce((sum, play) => sum + (play.card.points || 0), 0);

  if (isOurTeam) {
    scores.us += points;
    tricksWon.us++;
  } else {
    scores.them += points;
    tricksWon.them++;
  }

  updateScoreDisplay();

  // Limpar mesa
  trick = [];
  Object.values(trickCards).forEach(el => {
    el.innerHTML = '';
    el.classList.remove('visible');
  });

  currentPlayer = winner;

  // Verificar fim do jogo
  if (hands[0].length === 0) {
    endGame();
  } else if (!isMultiplayer && currentPlayer !== 0) {
    setTimeout(botPlay, 500);
  } else if (currentPlayer === 0) {
    turnIndicator.classList.remove('hidden');
  }
}

// Atualizar placar
function updateScoreDisplay() {
  ourScoreEl.textContent = scores.us;
  theirScoreEl.textContent = scores.them;
}

// Iniciar jogo
function startGame() {
  initAudio();
  overlay.classList.add('hidden');
  gameState = 'playing';

  scores = { us: 0, them: 0 };
  tricksWon = { us: 0, them: 0 };
  trick = [];
  currentPlayer = 0;

  dealCards();
  renderPlayerHand();
  updateScoreDisplay();

  haptic('light');
}

// Fim do jogo
function endGame() {
  gameState = 'ended';

  // Bônus de 40 para quem fizer 4+ voltas
  if (tricksWon.us >= 4) scores.us += 40;
  if (tricksWon.them >= 4) scores.them += 40;

  const weWon = scores.us > scores.them;

  finalScores.innerHTML = `
    <div class="score-row ${weWon ? 'winner' : ''}">Nós: ${scores.us} pontos</div>
    <div class="score-row ${!weWon ? 'winner' : ''}">Eles: ${scores.them} pontos</div>
    <div class="result">${weWon ? '🎉 Vitória!' : '😢 Derrota'}</div>
  `;

  endScreen.classList.remove('hidden');

  if (weWon) {
    launchConfetti();
    playSound('win');
  }

  saveScore(weWon ? 'win' : 'lose');
  onGameEnd('sueca', { won: weWon, score: scores.us });
}

// Salvar pontuação
async function saveScore(result) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('game_stats').insert({
        user_id: user.id,
        game: GAME_NAME,
        result: result,
        score: scores.us
      });
    }
  } catch (e) {
    console.error('Erro ao salvar:', e);
  }
}

// Novo jogo
function resetGame() {
  endScreen.classList.add('hidden');
  overlay.classList.remove('hidden');
  gameRules.classList.add('hidden');
  btnSingle.classList.remove('hidden');
  btnMulti.classList.remove('hidden');

  // Limpar mesa
  trick = [];
  Object.values(trickCards).forEach(el => {
    el.innerHTML = '';
    el.classList.remove('visible');
  });
  playerHand.innerHTML = '';
}

// Multiplayer (broadcast)
function broadcastMove(player, card) {
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'move',
      payload: { player, card, trick: trick.length }
    });
  }
}
