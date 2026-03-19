import '../../auth-check.js';
import { initAudio, playSound } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';
import { GameStats } from '../shared/game-core.js';

// Mobile: haptic feedback helper
function haptic(ms = 10) { if (navigator.vibrate) navigator.vibrate(ms); }

// Initialize audio on first user interaction
let audioInitialized = false;
function ensureAudio() {
  if (!audioInitialized) {
    initAudio();
    audioInitialized = true;
  }
}

// === GameStats ===
const gameStats = new GameStats('buraco', { autoSync: true });

// ===== MULTIPLAYER CONFIG =====
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
const IS_MULTIPLAYER = !!ROOM_ID;
let playerId = null;
let playerSeat = null; // 'player1' or 'player2'
let opponentSeat = null;
let opponentId = null;
let gameChannel = null;
let isHost = false;
let opponentConnected = false;
let lastSyncVersion = 0;

// ===== DECK (2 baralhos + 4 coringas) =====
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RANK_VAL = {A:15,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:10,Q:10,K:10};
const RANK_ORDER = {A:14,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13};

function createDeck(){
  const d=[];
  for(let k=0;k<2;k++){
    for(const s of SUITS)for(const r of RANKS)d.push({rank:r,suit:s,wild:false});
    d.push({rank:'JK',suit:'★',wild:true});
    d.push({rank:'JK',suit:'★',wild:true});
  }
  return d;
}
function shuffle(d){for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
function isRed(c){return c.suit==='♥'||c.suit==='♦'||c.suit==='★';}
function cardPts(c){if(c.wild)return 50;if(c.rank==='A')return 15;if(['10','J','Q','K'].includes(c.rank))return 10;return 5;}
function cardKey(c){return c.rank+c.suit;}

// ===== STATE =====
let stock=[], discardPile=[], morto1=[], morto2=[];
let hand=[], opponentHand=[], melds=[], opponentMelds=[];
let mortoTaken=false, opponentMortoTaken=false;
let turn='player'; // 'player' or 'opponent'
let drawnThisTurn=false;
let selectedCards=new Set(); // indices in hand
let score=0, opponentScore=0;
let gameOver=false;
let session=null;
let roundNum=0;
let isProcessing=false;

// ===== MULTIPLAYER FUNCTIONS =====
async function initMultiplayer() {
  const { data: { session: s } } = await supabase.auth.getSession();
  session = s;

  // Require authentication for multiplayer
  if (!session) {
    window.location.href = '/auth.html?redirect=' + encodeURIComponent(window.location.href);
    return;
  }

  playerId = session.user.id;

  // Join or create room
  await joinRoom();
}

async function joinRoom() {
  try {
    // Check if room exists
    const { data: room, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', ROOM_ID)
      .single();

    if (error || !room) {
      // Create room as host
      isHost = true;
      playerSeat = 'player1';
      opponentSeat = 'player2';

      const { error: insertError } = await supabase.from('game_rooms').insert({
        id: ROOM_ID,
        game_type: 'buraco',
        player1_id: playerId,
        status: 'waiting',
        created_at: new Date().toISOString()
      });

      if (insertError) {
        console.error('Erro ao criar sala:', insertError);
        alert('Erro ao criar sala. Verifique sua conexão.');
        return;
      }
    } else {
      // Check if room is full
      if (room.player2_id && room.player2_id !== playerId) {
        alert('Sala cheia! Esta sala já tem 2 jogadores.');
        window.location.href = '/games/buraco/';
        return;
      }

      // Join existing room
      isHost = false;
      playerSeat = 'player2';
      opponentSeat = 'player1';
      opponentId = room.player1_id;

      await supabase.from('game_rooms')
        .update({ player2_id: playerId, status: 'playing', started_at: new Date().toISOString() })
        .eq('id', ROOM_ID);

      // Notify host that opponent joined
      await broadcastGameState({ type: 'player_joined', playerId, seat: playerSeat });
    }

    // Subscribe to game state changes
    subscribeToGameChannel();

    // Update UI
    updateMultiplayerUI();

    if (isHost) {
      setMsg('Aguardando oponente... Compartilhe o link!');
    } else {
      setMsg('Conectado! Aguardando início...');
      // Request current game state from host
      await broadcastGameState({ type: 'request_state', playerId });
    }
  } catch (e) {
    console.error('Erro ao entrar na sala:', e);
    alert('Erro ao conectar à sala.');
  }
}

function subscribeToGameChannel() {
  gameChannel = supabase.channel(`room-${ROOM_ID}`)
    .on('broadcast', { event: 'game_state' }, (payload) => {
      handleGameMessage(payload.payload);
    })
    .on('broadcast', { event: 'game_action' }, (payload) => {
      handleGameAction(payload.payload);
    })
    .subscribe((status) => {
      console.log('Buraco multiplayer status:', status);
    });
}

async function broadcastGameState(data) {
  if (!gameChannel) return;
  await gameChannel.send({
    type: 'broadcast',
    event: 'game_state',
    payload: data
  });
}

async function broadcastAction(data) {
  if (!gameChannel) return;
  await gameChannel.send({
    type: 'broadcast',
    event: 'game_action',
    payload: { ...data, fromSeat: playerSeat, timestamp: Date.now() }
  });
}

function handleGameMessage(msg) {
  switch (msg.type) {
    case 'player_joined':
      if (isHost && msg.playerId !== playerId) {
        opponentId = msg.playerId;
        opponentConnected = true;
        setMsg('Oponente conectado! Iniciando jogo...');
        // Host starts the game
        setTimeout(() => startMultiplayerGame(), 1000);
      }
      break;

    case 'request_state':
      if (isHost) {
        sendFullGameState();
      }
      break;

    case 'full_state':
      if (!isHost) {
        applyGameState(msg.state);
      }
      break;

    case 'game_started':
      if (!isHost) {
        applyGameState(msg.state);
      }
      break;
  }
}

function handleGameAction(action) {
  if (action.fromSeat === playerSeat) return; // Ignore own actions

  switch (action.type) {
    case 'draw_stock':
      opponentHand.push({});
      if (action.stockCount !== undefined) stock.length = action.stockCount;
      updateTurn(action.nextTurn);
      render();
      break;

    case 'draw_discard':
      opponentHand.push({});
      if (action.discardPile) discardPile = action.discardPile;
      updateTurn(action.nextTurn);
      render();
      break;

    case 'meld':
      opponentMelds.push(action.cards);
      opponentHand.splice(0, action.cards.length);
      if (action.mortoTaken) opponentMortoTaken = true;
      render();
      break;

    case 'add_to_meld':
      if (opponentMelds[action.meldIdx]) {
        opponentMelds[action.meldIdx] = [...opponentMelds[action.meldIdx], ...action.cards];
      }
      opponentHand.splice(0, action.cards.length);
      render();
      break;

    case 'discard':
      if (action.card) discardPile.push(action.card);
      opponentHand.pop();
      if (action.mortoTaken) opponentMortoTaken = true;
      updateTurn(action.nextTurn);
      drawnThisTurn = false;
      render();
      setMsg('Sua vez! Compre do monte ou pegue o descarte.');
      break;

    case 'baixar':
      opponentScore += action.score;
      endRound(false, true);
      break;

    case 'morto_open':
      // Reveal mortos at end of round
      morto1 = action.morto1;
      morto2 = action.morto2;
      render();
      break;
  }
}

async function sendFullGameState() {
  const state = {
    stock,
    discardPile,
    morto1,
    morto2,
    hand: isHost ? hand : opponentHand,
    opponentHand: isHost ? opponentHand.length : hand.length,
    melds: isHost ? melds : opponentMelds,
    opponentMelds: isHost ? opponentMelds : melds,
    mortoTaken: isHost ? mortoTaken : opponentMortoTaken,
    opponentMortoTaken: isHost ? opponentMortoTaken : mortoTaken,
    turn,
    roundNum,
    score: isHost ? score : opponentScore,
    opponentScore: isHost ? opponentScore : score
  };

  await broadcastGameState({
    type: 'full_state',
    state
  });
}

function applyGameState(state) {
  stock = state.stock;
  discardPile = state.discardPile;
  morto1 = state.morto1;
  morto2 = state.morto2;
  hand = state.hand;
  opponentHand = new Array(state.opponentHand).fill({});
  melds = state.melds;
  opponentMelds = state.opponentMelds;
  mortoTaken = state.mortoTaken;
  opponentMortoTaken = state.opponentMortoTaken;
  turn = state.turn === 'player1' ? (playerSeat === 'player1' ? 'player' : 'opponent') : (playerSeat === 'player2' ? 'player' : 'opponent');
  roundNum = state.roundNum;
  score = state.score;
  opponentScore = state.opponentScore;
  gameOver = false;
  render();
}

async function startMultiplayerGame() {
  ensureAudio();
  isProcessing = false;
  roundNum++;

  // Create and shuffle deck
  const deck = shuffle(createDeck());

  // Deal: 11 to each player, 11 to each morto
  const p1Hand = deck.splice(0, 11);
  const p2Hand = deck.splice(0, 11);
  const m1 = deck.splice(0, 11);
  const m2 = deck.splice(0, 11);

  stock = [...deck];
  discardPile = [];
  if (stock.length > 0) discardPile.push(stock.pop());

  if (isHost) {
    hand = p1Hand;
    opponentHand = new Array(11).fill({});
    melds = [];
    opponentMelds = [];
    morto1 = m1;
    morto2 = m2;
    mortoTaken = false;
    opponentMortoTaken = false;
    turn = 'player';
  } else {
    hand = p2Hand;
    opponentHand = new Array(11).fill({});
    melds = [];
    opponentMelds = [];
    mortoTaken = false;
    opponentMortoTaken = false;
    turn = 'opponent';
  }

  drawnThisTurn = false;
  selectedCards = new Set();
  gameOver = false;

  // Send game state to opponent
  await broadcastGameState({
    type: 'game_started',
    state: {
      stock,
      discardPile,
      morto1,
      morto2,
      hand: isHost ? p2Hand : p1Hand,
      opponentHand: 11,
      melds: [],
      opponentMelds: [],
      mortoTaken: false,
      opponentMortoTaken: false,
      turn: isHost ? 'player1' : 'player1',
      roundNum,
      score: 0,
      opponentScore: 0
    }
  });

  playSound('deal');
  render();
  setMsg(isHost ? 'Sua vez! Compre do monte ou pegue o descarte.' : 'Aguardando oponente...');
}

function updateTurn(newTurn) {
  if (IS_MULTIPLAYER) {
    turn = newTurn === playerSeat ? 'player' : 'opponent';
  } else {
    turn = newTurn;
  }
  drawnThisTurn = false;
}

function updateMultiplayerUI() {
  // Update score labels
  const playerNameEl = document.querySelector('.score-side:first-child .score-name');
  const opponentNameEl = document.querySelector('.score-side:last-child .score-name');

  if (playerNameEl) playerNameEl.textContent = 'Você';
  if (opponentNameEl) opponentNameEl.textContent = 'Oponente';

  // Update area labels
  const cpuLabel = document.querySelector('.cpu-area .area-label');
  if (cpuLabel) {
    cpuLabel.innerHTML = `Oponente · <span id="cpu-hand-count"></span>`;
  }

  // Show room info
  const roomInfo = document.createElement('div');
  roomInfo.className = 'room-info';
  roomInfo.innerHTML = `
    <span class="room-badge ${isHost ? 'host' : 'guest'}">${isHost ? 'Anfitrião' : 'Convidado'}</span>
    <span class="room-id">Sala: ${ROOM_ID.substring(0, 8)}...</span>
  `;

  const topbar = document.querySelector('.topbar');
  if (topbar && !document.querySelector('.room-info')) {
    topbar.appendChild(roomInfo);
  }
}

// ===== SINGLE PLAYER INIT =====
async function init(){
  const {data:{session:s}}=await supabase.auth.getSession();
  session=s;

  if (IS_MULTIPLAYER) {
    await initMultiplayer();
  } else {
    startRound();
  }
}

function startRound(){
  ensureAudio();
  isProcessing = false;
  roundNum++;
  const deck=shuffle(createDeck());
  // Deal: 11 to each, 11 to morto1, 11 to morto2
  hand=deck.splice(0,11);
  opponentHand=deck.splice(0,11);
  morto1=deck.splice(0,11);
  morto2=deck.splice(0,11);
  stock=[...deck];
  discardPile=[];
  melds=[];opponentMelds=[];
  mortoTaken=false;opponentMortoTaken=false;
  turn='player';drawnThisTurn=false;selectedCards=new Set();
  gameOver=false;
  // First discard to start pile
  if(stock.length>0)discardPile.push(stock.pop());
  playSound('deal');
  render();
  setMsg('Sua vez! Compre do monte ou pegue o descarte.');
}

// ===== MELD VALIDATION =====
function rankIdx(r){return RANK_ORDER[r]||0;}

function isValidMeld(cards){
  if(cards.length<3)return false;
  const naturals=cards.filter(c=>!c.wild);
  const wilds=cards.filter(c=>c.wild);
  if(naturals.length<2)return false; // need at least 2 naturals
  // Try group (same rank)
  const ranks=new Set(naturals.map(c=>c.rank));
  if(ranks.size===1)return true; // all same rank = group
  // Try sequence (same suit, consecutive)
  const suits=new Set(naturals.map(c=>c.suit));
  if(suits.size===1){
    const vals=naturals.map(c=>rankIdx(c.rank)).sort((a,b)=>a-b);
    // Fill gaps with wilds
    let gaps=0;
    for(let i=1;i<vals.length;i++)gaps+=vals[i]-vals[i-1]-1;
    if(gaps<=wilds.length)return true;
  }
  return false;
}

function getMeldType(meld){
  // Returns 'group' or 'sequence'
  const naturals=meld.filter(c=>!c.wild);
  const ranks=new Set(naturals.map(c=>c.rank));
  return ranks.size===1?'group':'sequence';
}

function canAddToMeld(meld,card){
  // Try adding card to existing meld
  const test=[...meld,card];
  return isValidMeld(test);
}

function isCanasta(meld){return meld.length>=7;}
function isPureCanasta(meld){return isCanasta(meld)&&!meld.some(c=>c.wild);}

function meldScore(meld){
  let pts=meld.reduce((s,c)=>s+cardPts(c),0);
  if(isPureCanasta(meld))pts+=200;
  else if(isCanasta(meld))pts+=100;
  return pts;
}

function calcScore(playerMelds, playerHand){
  let pts=playerMelds.reduce((s,m)=>s+meldScore(m),0);
  pts-=playerHand.reduce((s,c)=>s+cardPts(c),0);
  return pts;
}

// ===== PLAYER ACTIONS =====
function drawFromStock(){
  ensureAudio();
  if(isProcessing || turn !== 'player') return;
  if(drawnThisTurn){setMsg('Já comprou esta rodada. Descarte uma carta.');return;}
  if(stock.length===0){endRound();return;}

  isProcessing = true;
  hand.push(stock.pop());
  drawnThisTurn=true;

  if (IS_MULTIPLAYER) {
    broadcastAction({
      type: 'draw_stock',
      stockCount: stock.length,
      nextTurn: opponentSeat
    });
    turn = 'opponent';
  }

  playSound('deal');
  setTimeout(() => { isProcessing = false; }, 300);
  render();setMsg('Carta comprada. Agora descarte ou jogue uma combinação.');
}

function drawFromDiscard(){
  ensureAudio();
  if(isProcessing || turn !== 'player') return;
  if(drawnThisTurn){setMsg('Já comprou esta rodada.');return;}
  if(discardPile.length===0){setMsg('Descarte vazio.');return;}

  isProcessing = true;
  const top=discardPile[discardPile.length-1];
  hand.push(discardPile.pop());
  drawnThisTurn=true;

  if (IS_MULTIPLAYER) {
    broadcastAction({
      type: 'draw_discard',
      discardPile: discardPile,
      nextTurn: opponentSeat
    });
    turn = 'opponent';
  }

  playSound('deal');
  setTimeout(() => { isProcessing = false; }, 300);
  render();setMsg('Pegou o descarte! Use a carta em uma combinação e depois descarte.');
}

function toggleSelect(idx){
  if(isProcessing || turn !== 'player') return;
  if(!drawnThisTurn){setMsg('Compre uma carta primeiro!');return;}
  if(selectedCards.has(idx))selectedCards.delete(idx);
  else selectedCards.add(idx);
  render();
}

function tryMeld(){
  ensureAudio();
  if(isProcessing || turn !== 'player') return;
  if(selectedCards.size<3){setMsg('Selecione pelo menos 3 cartas para combinar.');playSound('error');return;}
  isProcessing = true;
  const sel=Array.from(selectedCards).sort((a,b)=>a-b);
  const cards=sel.map(i=>hand[i]);
  if(!isValidMeld(cards)){setMsg('Combinação inválida! Precisa ser grupo (mesma figura) ou sequência (mesmo naipe, ordem).');playSound('error');isProcessing=false;return;}
  // Remove from hand
  const remaining=hand.filter((_,i)=>!selectedCards.has(i));

  if (IS_MULTIPLAYER) {
    broadcastAction({
      type: 'meld',
      cards: cards,
      mortoTaken: mortoTaken
    });
  }

  melds.push([...cards]);
  hand=remaining;
  selectedCards=new Set();
  checkMorto();
  setTimeout(() => { isProcessing = false; }, 300);
  render();setMsg('Combinação formada! Você pode adicionar mais ou descartar.');
}

function tryAddToMeld(meldIdx){
  ensureAudio();
  if(isProcessing || turn !== 'player') return;
  if(selectedCards.size===0){setMsg('Selecione cartas da mão primeiro.');return;}
  isProcessing = true;
  const sel=Array.from(selectedCards).sort((a,b)=>a-b);
  const cards=sel.map(i=>hand[i]);
  const target=[...melds[meldIdx],...cards];
  if(!isValidMeld(target)){setMsg('Não é possível adicionar essas cartas a esta combinação.');playSound('error');isProcessing=false;return;}

  if (IS_MULTIPLAYER) {
    broadcastAction({
      type: 'add_to_meld',
      meldIdx: meldIdx,
      cards: cards
    });
  }

  melds[meldIdx]=target;
  hand=hand.filter((_,i)=>!selectedCards.has(i));
  selectedCards=new Set();
  checkMorto();
  setTimeout(() => { isProcessing = false; }, 300);
  render();setMsg('Cartas adicionadas à combinação!');
}

function checkMorto(){
  if(hand.length===0&&!mortoTaken){
    hand=[...morto1];
    mortoTaken=true;
    setMsg('Pegou o morto! Continue jogando.');
  }
}

function discardCard(){
  ensureAudio();
  if(isProcessing || turn !== 'player') return;
  if(!drawnThisTurn){setMsg('Compre uma carta primeiro!');playSound('error');return;}
  if(selectedCards.size!==1){setMsg('Selecione exatamente 1 carta para descartar.');playSound('error');return;}
  isProcessing = true;
  const idx=Array.from(selectedCards)[0];
  const card=hand[idx];
  discardPile.push(card);
  hand.splice(idx,1);
  selectedCards=new Set();
  drawnThisTurn=false;

  // Check if can baixar (go down)
  if(hand.length===0){
    if(mortoTaken){
      // Can end round!
      isProcessing = false;
      endRound(true);return;
    }else{
      hand=[...morto1];mortoTaken=true;
      isProcessing = false;
      setMsg('Pegou o morto! Continue jogando.');
      turn='player';render();return;
    }
  }

  if (IS_MULTIPLAYER) {
    broadcastAction({
      type: 'discard',
      card: card,
      mortoTaken: mortoTaken,
      nextTurn: opponentSeat
    });
    turn = 'opponent';
  } else {
    turn='cpu';
    setTimeout(cpuTurn,1200);
  }

  isProcessing = false;
  render();
  setMsg(IS_MULTIPLAYER ? 'Aguardando oponente...' : 'Vez da CPU...');
}

function tryBaixar(){
  // Check: must have at least one canasta to go down
  const hasCanasta=melds.some(m=>isCanasta(m));
  if(!hasCanasta){setMsg('Precisa de pelo menos uma canasta para baixar!');return;}
  if(hand.length>0){setMsg('Precisa esvaziar a mão para baixar.');return;}
  endRound(true);
}

// ===== CPU AI (Single Player Only) =====
function showCpuThinking() {
  setMsg('CPU está pensando <span class="thinking-dots"><span></span><span></span><span></span></span>');
}

function cpuTurn(){
  if(gameOver || IS_MULTIPLAYER) return;
  showCpuThinking();

  setTimeout(() => {
    cpuTurnActual();
  }, 1000);
}

function cpuTurnActual(){
  if(gameOver)return;
  // Simple CPU: draw from stock, try to form melds, discard worst card
  if(stock.length>0)opponentHand.push(stock.pop());
  else{endRound();return;}

  // Try to form melds
  let madeProgress=true;
  while(madeProgress){
    madeProgress=false;
    // Try all combos of 3+ cards
    for(let size=opponentHand.length;size>=3;size--){
      const combos=combinations(opponentHand,size);
      for(const combo of combos){
        if(isValidMeld(combo)){
          opponentMelds.push([...combo]);
          const comboKeys=combo.map(c=>cardKey(c));
          opponentHand=opponentHand.filter(c=>!comboKeys.includes(cardKey(c)));
          madeProgress=true;break;
        }
      }
      if(madeProgress)break;
    }
  }

  // Try to add to existing melds
  for(let mi=0;mi<opponentMelds.length;mi++){
    for(let ci=opponentHand.length-1;ci>=0;ci--){
      const card=opponentHand[ci];
      if(canAddToMeld(opponentMelds[mi],card)){
        opponentMelds[mi].push(card);
        opponentHand.splice(ci,1);
      }
    }
  }

  // Pick up morto if empty
  if(opponentHand.length===0&&!opponentMortoTaken){
    opponentHand=[...morto2];opponentMortoTaken=true;
  }

  // Discard worst card (lowest value, avoid wild)
  if(opponentHand.length>0){
    opponentHand.sort((a,b)=>cardPts(a)-cardPts(b));
    // Discard first non-wild if possible
    let discIdx=opponentHand.findIndex(c=>!c.wild);
    if(discIdx<0)discIdx=0;
    discardPile.push(opponentHand.splice(discIdx,1)[0]);
  }

  // Check if CPU can go down
  if(opponentHand.length===0){
    const hasCanasta=opponentMelds.some(m=>isCanasta(m));
    if(opponentMortoTaken&&hasCanasta){endRound(false,true);return;}
    else if(!opponentMortoTaken){opponentHand=[...morto2];opponentMortoTaken=true;}
  }

  turn='player';drawnThisTurn=false;
  render();setMsg('Sua vez! Compre do monte ou pegue o descarte.');
}

const cpuTurnDelayed = cpuTurn;

function combinations(arr,k){
  if(k===0)return[[]];
  if(arr.length<k)return[];
  const[first,...rest]=arr;
  return[...combinations(rest,k-1).map(c=>[first,...c]),...combinations(rest)];
}

// ===== END ROUND =====
async function endRound(playerDown=false,cpuDown=false){
  gameOver=true;

  // In multiplayer, reveal mortos
  if (IS_MULTIPLAYER) {
    await broadcastGameState({
      type: 'morto_open',
      morto1,
      morto2
    });
  }

  const playerRoundScore=calcScore(melds,hand)+(playerDown?100:0);
  const opponentRoundScore=calcScore(opponentMelds,opponentHand)+(cpuDown?100:0);
  score+=playerRoundScore;
  opponentScore+=opponentRoundScore;

  const won=score>opponentScore;
  const tied=score===opponentScore;

  if(won)playSound('win');

  // Save stats using GameStats (single player only)
  if (!IS_MULTIPLAYER) {
    gameStats.recordGame(won, { score: score });
  }

  render();
  showModal(
    won?'🏆':tied?'🤝':'😔',
    playerDown?'Você baixou!':cpuDown?'Oponente baixou!':'Rodada encerrada!',
    `Você: ${playerRoundScore>0?'+':''}${playerRoundScore}pts (Total: ${score})\nOponente: ${opponentRoundScore>0?'+':''}${opponentRoundScore}pts (Total: ${opponentScore})`
  );
}

// ===== RENDER =====
function cardHTML(c,idx=-1,small=false,sel=false,playable=false){
  if(!c)return'';
  const red=isRed(c);
  const cls=['card',red?'red':'',c.wild?'wild':'',small?'sm':'',sel?'selected':'',playable?'playable':''].filter(Boolean).join(' ');
  const txt=c.wild?'JK':`${c.rank}<br>${c.suit}`;
  return`<div class="${cls}" ${idx>=0?`data-idx="${idx}"`:''}>${txt}</div>`;
}

function meldHTML(meld,idx,isPlayer){
  const pure=isPureCanasta(meld);
  const dirty=isCanasta(meld)&&!pure;
  const cls=['meld-group',pure?'canasta-pure':dirty?'canasta-dirty':''].filter(Boolean).join(' ');
  const badge=pure?'<span class="meld-badge">Canasta!</span>':dirty?'<span class="meld-badge" style="background:#ff8c00">Suja</span>':'';
  const cards=meld.map(c=>cardHTML(c,-1,true)).join('');
  return`<div class="${cls}" data-meld="${idx}" ${isPlayer?'':'style="cursor:default"'}>${badge}${cards}</div>`;
}

function render(){
  // Score bar
  document.getElementById('score-player').textContent=score;
  document.getElementById('score-cpu').textContent=opponentScore;
  const tb=document.getElementById('turn-badge');
  tb.textContent=turn==='player'?'Sua vez':'Vez do oponente';
  tb.className='turn-badge '+(turn==='player'?'turn-mine':'turn-cpu')+(turn==='opponent'?' active':'');

  // Round display
  const rd=document.getElementById('round-display');
  if(rd)rd.textContent=`Rodada ${roundNum}`;

  // Opponent area
  const cpuArea = document.querySelector('.cpu-area');
  if(turn === 'opponent') {
    cpuArea?.classList.add('active-turn');
  } else {
    cpuArea?.classList.remove('active-turn');
  }

  document.getElementById('cpu-hand-display').innerHTML=opponentHand.map(()=>`<div class="card back sm"></div>`).join('');
  document.getElementById('cpu-hand-count').textContent=`${opponentHand.length} cartas${opponentMortoTaken?' · Morto em mãos':''}`;
  document.getElementById('cpu-melds-display').innerHTML=opponentMelds.map((m,i)=>meldHTML(m,i,false)).join('');

  // Table
  document.getElementById('stock-count').textContent=stock.length;
  const top=discardPile[discardPile.length-1];
  document.getElementById('discard-display').innerHTML=top?cardHTML(top):`<div class="empty-discard"></div>`;
  document.getElementById('morto1-display').innerHTML=`<div class="pile-stack${mortoTaken?' morto-taken':''}"><div class="card back"></div></div><div class="pile-count">${mortoTaken?'Retirado':morto1.length+' cartas'}</div>`;
  document.getElementById('morto2-display').innerHTML=`<div class="pile-stack${opponentMortoTaken?' morto-taken':''}"><div class="card back"></div></div><div class="pile-count">${opponentMortoTaken?'Retirado':morto2.length+' cartas'}</div>`;

  // Player hand
  const isMyTurn=turn==='player';
  const playerArea = document.querySelector('.player-area');
  if(!isMyTurn) {
    playerArea?.classList.add('disabled');
  } else {
    playerArea?.classList.remove('disabled');
  }

  document.getElementById('player-hand-display').innerHTML=hand.map((c,i)=>cardHTML(c,i,false,selectedCards.has(i),isMyTurn)).join('');
  document.getElementById('player-melds-display').innerHTML=melds.map((m,i)=>meldHTML(m,i,true)).join('');
  document.getElementById('morto-status').textContent=mortoTaken?'Morto retirado':'Morto disponível';

  // Action buttons
  const canDiscard=isMyTurn&&drawnThisTurn&&selectedCards.size===1;
  const canMeld=isMyTurn&&drawnThisTurn&&selectedCards.size>=3;
  const hasCanasta=melds.some(m=>isCanasta(m));
  const canBaixar=isMyTurn&&hand.length===0&&mortoTaken&&hasCanasta;
  document.getElementById('btn-discard').disabled=!canDiscard;
  document.getElementById('btn-meld').style.display=canMeld?'':'none';
  document.getElementById('btn-baixar').style.display=canBaixar?'':'none';

  // Hand info
  document.getElementById('hand-count').textContent=`${hand.length} cartas na mão`;

  // Events
  if(isMyTurn){
    document.querySelectorAll('.player-area .card[data-idx]').forEach(el=>{
      el.addEventListener('click',()=>toggleSelect(+el.dataset.idx));
    });
    document.querySelectorAll('#player-melds-display .meld-group').forEach(el=>{
      el.addEventListener('click',()=>tryAddToMeld(+el.dataset.meld));
    });
    document.getElementById('stock-pile')?.addEventListener('click',()=>drawFromStock());
    document.getElementById('discard-display')?.querySelector('.card')?.addEventListener('click',()=>drawFromDiscard());
  }
}

function setMsg(msg){const el=document.getElementById('msg-bar');if(el)el.innerHTML=msg;}
function showModal(icon,title,msg){
  document.getElementById('m-icon').textContent=icon;
  document.getElementById('m-title').textContent=title;
  document.getElementById('m-msg').textContent=msg;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// Events
document.getElementById('btn-draw-stock').addEventListener('click',drawFromStock);
document.getElementById('btn-draw-discard').addEventListener('click',drawFromDiscard);
document.getElementById('btn-meld').addEventListener('click',tryMeld);
document.getElementById('btn-discard').addEventListener('click',discardCard);
document.getElementById('btn-baixar').addEventListener('click',tryBaixar);
document.getElementById('btn-new-round').addEventListener('click',()=>{
  document.getElementById('modal-overlay').classList.add('hidden');
  if (IS_MULTIPLAYER) {
    // Restart multiplayer game
    if (isHost) {
      startMultiplayerGame();
    } else {
      setMsg('Apenas o anfitrião pode iniciar uma nova rodada.');
    }
  } else {
    startRound();
  }
});

init();
