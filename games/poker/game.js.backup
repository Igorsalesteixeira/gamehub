import '../../auth-check.js';
import { initAudio, playSound } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';

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

// ===== MULTIPLAYER STATE =====
let isMultiplayer = false;
let roomId = null;
let playerSeat = null; // 0 or 1 (seat position)
let playerId = null; // unique player id
let channel = null;
let isHost = false;
let opponentConnected = false;
let opponentName = '';
let playerName = '';

// ===== CONSTANTS =====
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VAL = {2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13,A:14};
const HAND_NAMES = ['Carta Alta','Par','Dois Pares','Trinca','Sequência','Flush','Full House','Quadra','Straight Flush','Royal Flush'];
const CPU_NAMES = ['Ana 🤖','Bob 🤖','Cris 🤖'];
const CPU_STYLES = ['tight','loose','aggressive'];

const STARTING_CHIPS = 1000;
const BLIND_LEVELS = [
  {sb:10,bb:20},{sb:15,bb:30},{sb:25,bb:50},{sb:50,bb:100},{sb:75,bb:150},{sb:100,bb:200}
];

// ===== STATE =====
let deck=[], communityCards=[], pot=0, sidePot=0;
let players=[]; // [{name, chips, hand, bet, folded, allIn, isHuman, style, id}]
let dealerIdx=0, currentIdx=0;
let phase=''; // preflop, flop, turn, river, showdown
let currentBet=0, lastRaise=0;
let handCount=0, blindLevel=0;
let gameOver=false;
let raiseAmount=0;
let session=null;
let isProcessing=false;

// ===== MULTIPLAYER UTILS =====
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return { room: params.get('room') };
}

function generateRoomId() {
  return crypto.randomUUID();
}

function getPlayerName() {
  return localStorage.getItem('poker_player_name') || 'Jogador';
}

function savePlayerName(name) {
  localStorage.setItem('poker_player_name', name);
}

// Serialize card for network
function serializeCard(card) {
  if (!card) return null;
  return { rank: card.rank, suit: card.suit, value: card.value };
}

function deserializeCard(card) {
  if (!card) return null;
  return { rank: card.rank, suit: card.suit, value: card.value };
}

// Serialize game state for multiplayer
function serializeGameState() {
  return {
    deck: deck.map(serializeCard),
    communityCards: communityCards.map(serializeCard),
    pot,
    sidePot,
    players: players.map(p => ({
      name: p.name,
      chips: p.chips,
      hand: p.hand.map(serializeCard),
      bet: p.bet,
      folded: p.folded,
      allIn: p.allIn,
      isHuman: p.isHuman,
      id: p.id
    })),
    dealerIdx,
    currentIdx,
    phase,
    currentBet,
    lastRaise,
    handCount,
    blindLevel,
    gameOver
  };
}

function deserializeGameState(state) {
  deck = state.deck.map(deserializeCard).filter(c => c);
  communityCards = state.communityCards.map(deserializeCard).filter(c => c);
  pot = state.pot;
  sidePot = state.sidePot;
  players = state.players.map((p, idx) => ({
    name: p.name,
    chips: p.chips,
    hand: p.hand.map(deserializeCard).filter(c => c),
    bet: p.bet,
    folded: p.folded,
    allIn: p.allIn,
    isHuman: p.isHuman,
    isMultiplayer: p.isHuman,
    id: p.id,
    style: idx === 0 ? '' : CPU_STYLES[(idx - 1) % CPU_STYLES.length]
  }));
  dealerIdx = state.dealerIdx;
  currentIdx = state.currentIdx;
  phase = state.phase;
  currentBet = state.currentBet;
  lastRaise = state.lastRaise;
  handCount = state.handCount;
  blindLevel = state.blindLevel;
  gameOver = state.gameOver;
}

// ===== MULTIPLAYER SETUP =====
async function initMultiplayer() {
  const params = getUrlParams();

  if (!params.room) {
    showSinglePlayerUI();
    return;
  }

  // Multiplayer mode
  isMultiplayer = true;
  roomId = params.room;
  playerName = getPlayerName();
  playerId = 'player_' + Math.random().toString(36).substr(2, 9);

  await joinOrCreateRoom();
}

async function joinOrCreateRoom() {
  try {
    // Check if room exists
    const { data: existingRoom, error: fetchError } = await supabase
      .from('poker_rooms')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching room:', fetchError);
      showError('Erro ao conectar à sala');
      return;
    }

    if (existingRoom) {
      // Join existing room
      if (existingRoom.player2_id) {
        showError('Sala cheia. Crie uma nova sala.');
        return;
      }

      // Assign seat 1 to second player
      playerSeat = 1;
      isHost = false;
      opponentName = existingRoom.player1_name || 'Oponente';

      // Update room with player 2
      const { data: { session } } = await supabase.auth.getSession();
      await supabase
        .from('poker_rooms')
        .update({
          player2_id: playerId,
          player2_name: playerName,
          status: 'playing'
        })
        .eq('room_id', roomId);

      // Load game state from host
      if (existingRoom.game_state) {
        deserializeGameState(existingRoom.game_state);
        // Update local player reference
        players[1].id = playerId;
        players[1].name = playerName;
      }

    } else {
      // Create new room as host
      playerSeat = 0;
      isHost = true;

      const { data: { session } } = await supabase.auth.getSession();
      await supabase
        .from('poker_rooms')
        .insert({
          room_id: roomId,
          player1_id: playerId,
          player1_name: playerName,
          status: 'waiting',
          game_state: null
        });
    }

    setupRealtimeChannel();
    showMultiplayerUI();
    updateMultiplayerStatus();

    // Initialize game if host
    if (isHost) {
      await initGame();
    }

  } catch (e) {
    console.error('Multiplayer init error:', e);
    showError('Erro ao inicializar multiplayer');
  }
}

function setupRealtimeChannel() {
  channel = supabase.channel(`poker:${roomId}`, {
    config: { broadcast: { self: false } }
  });

  channel
    .on('broadcast', { event: 'action' }, ({ payload }) => {
      handleOpponentAction(payload);
    })
    .on('broadcast', { event: 'player_joined' }, ({ payload }) => {
      opponentConnected = true;
      opponentName = payload.name || 'Oponente';
      updateMultiplayerStatus();

      // Host sends current state to new player
      if (isHost) {
        channel.send({
          type: 'broadcast',
          event: 'game_state',
          payload: {
            state: serializeGameState(),
            playerSeat: 1
          }
        });
      }
    })
    .on('broadcast', { event: 'game_state' }, ({ payload }) => {
      if (!isHost) {
        deserializeGameState(payload.state);
        playerSeat = payload.playerSeat;
        render();
      }
    })
    .on('broadcast', { event: 'new_hand' }, ({ payload }) => {
      deserializeGameState(payload.state);
      render();
    })
    .on('broadcast', { event: 'showdown_reveal' }, ({ payload }) => {
      // Reveal opponent's cards at showdown
      if (payload.hands) {
        payload.hands.forEach((hand, idx) => {
          if (idx !== playerSeat && hand) {
            players[idx].hand = hand.map(deserializeCard);
          }
        });
        render(true);
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'player_joined',
          payload: { name: playerName, seat: playerSeat }
        });
      }
    });

  // Listen for database changes
  supabase
    .channel(`poker_room_db:${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'poker_rooms',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      if (payload.new.status === 'playing' && !opponentConnected) {
        opponentConnected = true;
        if (isHost) {
          opponentName = payload.new.player2_name || 'Oponente';
        }
        updateMultiplayerStatus();
      }
    })
    .subscribe();
}

async function broadcastAction(action, amount = 0) {
  if (!channel) return;

  channel.send({
    type: 'broadcast',
    event: 'action',
    payload: {
      action,
      amount,
      playerIdx: playerSeat,
      gameState: serializeGameState()
    }
  });

  // Persist to database
  try {
    await supabase
      .from('poker_rooms')
      .update({
        game_state: serializeGameState(),
        last_action_at: new Date().toISOString()
      })
      .eq('room_id', roomId);
  } catch (e) {
    console.warn('Error saving game state:', e);
  }
}

function handleOpponentAction({ action, amount, playerIdx, gameState }) {
  // Apply opponent's action
  deserializeGameState(gameState);

  // Show action message
  const p = players[playerIdx];
  const actionLabels = {
    fold: 'Desistiu',
    check: 'Passou',
    call: `Pagou ${amount}`,
    raise: `Apostou ${amount}`,
    allin: 'All-In!'
  };
  showMessage(`${p.name}: ${actionLabels[action] || action}`);

  // Play sound
  if (action === 'fold') playSound('fold');
  else playSound('chip');

  render();
}

async function broadcastNewHand() {
  if (!channel || !isHost) return;

  channel.send({
    type: 'broadcast',
    event: 'new_hand',
    payload: { state: serializeGameState() }
  });

  try {
    await supabase
      .from('poker_rooms')
      .update({ game_state: serializeGameState() })
      .eq('room_id', roomId);
  } catch (e) {
    console.warn('Error saving game state:', e);
  }
}

async function broadcastShowdown() {
  if (!channel) return;

  // Send all hands for reveal
  const hands = players.map(p => p.hand.map(serializeCard));
  channel.send({
    type: 'broadcast',
    event: 'showdown_reveal',
    payload: { hands }
  });
}

function showSinglePlayerUI() {
  const mpStatus = document.getElementById('multiplayer-status');
  if (mpStatus) {
    mpStatus.innerHTML = `
      <div class="mp-section">
        <button class="btn-action btn-check" id="btn-create-room" style="margin: 0.5rem">
          Criar Sala Multiplayer
        </button>
      </div>
    `;
    document.getElementById('btn-create-room')?.addEventListener('click', createNewRoom);
  }
}

function showMultiplayerUI() {
  const mpStatus = document.getElementById('multiplayer-status');
  if (!mpStatus) return;

  const roomUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  const seatText = playerSeat === 0 ? 'Jogador 1' : 'Jogador 2';

  mpStatus.innerHTML = `
    <div class="mp-section">
      <div class="mp-header">
        <span class="mp-badge">${seatText}</span>
        <span class="mp-status" id="mp-connection-status">
          ${opponentConnected ? 'Oponente conectado' : 'Aguardando oponente...'}
        </span>
      </div>
      <div class="mp-room-info">
        <input type="text" class="mp-room-url" value="${roomUrl}" readonly id="mp-room-url">
        <button class="btn-action btn-check" id="btn-copy-link" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Copiar Link</button>
      </div>
      <div class="mp-actions">
        <button class="btn-action btn-fold" id="btn-leave-room" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;">Sair da Sala</button>
      </div>
    </div>
  `;

  document.getElementById('btn-copy-link')?.addEventListener('click', copyRoomLink);
  document.getElementById('btn-leave-room')?.addEventListener('click', leaveRoom);
}

function updateMultiplayerStatus() {
  const statusEl = document.getElementById('mp-connection-status');
  if (statusEl) {
    statusEl.textContent = opponentConnected ? `Oponente: ${opponentName}` : 'Aguardando oponente...';
    statusEl.classList.toggle('connected', opponentConnected);
  }
}

async function createNewRoom() {
  const newRoomId = generateRoomId();
  const newUrl = `${window.location.pathname}?room=${newRoomId}`;
  window.history.pushState({}, '', newUrl);
  await initMultiplayer();
}

function copyRoomLink() {
  const urlInput = document.getElementById('mp-room-url');
  if (urlInput) {
    urlInput.select();
    navigator.clipboard.writeText(urlInput.value);
    showToast('Link copiado!');
  }
}

function leaveRoom() {
  if (channel) {
    channel.unsubscribe();
    channel = null;
  }

  // Clean up room if host leaves
  if (isHost && roomId) {
    supabase.from('poker_rooms').delete().eq('room_id', roomId);
  }

  window.history.pushState({}, '', window.location.pathname);
  location.reload();
}

function showError(msg) {
  alert(msg);
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:0.5rem 1rem;border-radius:8px;z-index:1000;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== DECK =====
function createDeck() {
  const d=[];
  for(const s of SUITS) for(const r of RANKS) d.push({rank:r,suit:s,value:RANK_VAL[r]});
  return d;
}
function shuffle(d) {
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}
function isRed(suit){return suit==='♥'||suit==='♦';}

// ===== HAND EVALUATION =====
function combinations(arr,k){
  if(k===0)return[[]];
  if(arr.length===0)return[];
  const [first,...rest]=arr;
  return[...combinations(rest,k-1).map(c=>[first,...c]),...combinations(rest,k)];
}

function evalFive(cards) {
  const vals=cards.map(c=>c.value).sort((a,b)=>b-a);
  const suits=cards.map(c=>c.suit);
  const isFlush=new Set(suits).size===1;
  let isStraight=vals[0]-vals[4]===4&&new Set(vals).size===5;
  let straightHigh=vals[0];
  if(!isStraight&&vals[0]===14&&vals[1]===5&&vals[2]===4&&vals[3]===3&&vals[4]===2){
    isStraight=true;straightHigh=5;
  }
  const cnt={};vals.forEach(v=>cnt[v]=(cnt[v]||0)+1);
  const groups=Object.entries(cnt).map(([v,c])=>({v:+v,c})).sort((a,b)=>b.c-a.c||b.v-a.v);
  const [g0,g1]=groups;
  if(isFlush&&isStraight) return{rank:straightHigh===14?9:8,primary:straightHigh,vals};
  if(g0.c===4) return{rank:7,primary:g0.v,kicker:g1.v,vals};
  if(g0.c===3&&g1&&g1.c===2) return{rank:6,primary:g0.v,secondary:g1.v,vals};
  if(isFlush) return{rank:5,primary:vals[0],vals};
  if(isStraight) return{rank:4,primary:straightHigh,vals};
  if(g0.c===3) return{rank:3,primary:g0.v,vals};
  if(g0.c===2&&g1&&g1.c===2) return{rank:2,primary:Math.max(g0.v,g1.v),secondary:Math.min(g0.v,g1.v),vals};
  if(g0.c===2) return{rank:1,primary:g0.v,vals};
  return{rank:0,primary:vals[0],vals};
}

function bestHand(holeCards, community) {
  const all=[...holeCards,...community];
  const combos=all.length>=5?combinations(all,5):[all];
  let best=null;
  for(const combo of combos){
    const ev=evalFive(combo);
    if(!best||compareEval(ev,best)>0)best=ev;
  }
  return best;
}

function compareEval(a,b){
  if(a.rank!==b.rank)return a.rank-b.rank;
  if(a.primary!==b.primary)return a.primary-b.primary;
  if(a.secondary!==b.secondary&&a.secondary!==undefined)return(a.secondary||0)-(b.secondary||0);
  const av=a.vals||[],bv=b.vals||[];
  for(let i=0;i<Math.min(av.length,bv.length);i++)if(av[i]!==bv[i])return av[i]-bv[i];
  return 0;
}

// ===== INIT =====
async function init() {
  const {data:{session:s}}=await supabase.auth.getSession();
  session=s;

  // Check for multiplayer mode
  const params = getUrlParams();
  if (params.room) {
    await initMultiplayer();
    return;
  }

  await initGame();
}

async function initGame() {
  const {data:{session:s}}=await supabase.auth.getSession();
  session=s;

  if (isMultiplayer) {
    // Multiplayer: 2 human players
    players=[
      {name:isHost?playerName:opponentName,chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,isHuman:true,style:'',id:isHost?playerId:null},
      {name:isHost?opponentName:playerName,chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,isHuman:true,style:'',id:isHost?null:playerId}
    ];
  } else {
    // Single player: 1 human + 3 CPU
    players=[
      {name:'Você',chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,isHuman:true,style:'',id:null},
      {name:CPU_NAMES[0],chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,isHuman:false,style:CPU_STYLES[0],id:null},
      {name:CPU_NAMES[1],chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,isHuman:false,style:CPU_STYLES[1],id:null},
      {name:CPU_NAMES[2],chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,isHuman:false,style:CPU_STYLES[2],id:null}
    ];
  }

  handCount=0;blindLevel=0;gameOver=false;
  startHand();
}

function startHand() {
  ensureAudio();
  isProcessing = false;
  if(gameOver)return;

  const active=players.filter(p=>p.chips>0);
  if(active.length<2){endGame();return;}

  blindLevel=Math.min(Math.floor(handCount/10),BLIND_LEVELS.length-1);
  const {sb,bb}=BLIND_LEVELS[blindLevel];

  deck=shuffle(createDeck());
  communityCards=[];pot=0;currentBet=bb;lastRaise=bb;handCount++;

  players.forEach(p=>{p.hand=[];p.bet=0;p.folded=false;p.allIn=false;});

  do{dealerIdx=(dealerIdx+1)%players.length;}while(players[dealerIdx].chips<=0);

  const sbIdx=nextActive(dealerIdx);
  const bbIdx=nextActive(sbIdx);
  postBlind(sbIdx,sb);
  postBlind(bbIdx,bb);

  // Deal 2 cards to each active player
  players.forEach((p, idx)=>{
    if(p.chips>0||p.allIn){
      p.hand=[deck.pop(),deck.pop()];
      // In multiplayer, only the receiving player knows their cards initially
      if (isMultiplayer && idx !== playerSeat) {
        // Other player's cards are hidden locally
      }
    }
  });
  playSound('deal');

  phase='preflop';
  currentIdx=nextActive(bbIdx);
  render();

  if(!isMultiplayer && !players[currentIdx].isHuman){
    setTimeout(cpuTurn,1000);
  }
}

function nextActive(idx,skipBroke=false){
  let i=(idx+1)%players.length;
  while((players[i].folded||(skipBroke&&players[i].chips<=0&&!players[i].allIn))){
    i=(i+1)%players.length;
    if(i===idx)break;
  }
  return i;
}

function postBlind(idx,amount){
  const p=players[idx];
  const actual=Math.min(amount,p.chips);
  p.chips-=actual;p.bet+=actual;pot+=actual;
  if(p.chips===0)p.allIn=true;
}

// ===== BETTING =====
function activePlayers(){return players.filter(p=>!p.folded&&!p.allIn);}
function foldedAll(){return players.filter(p=>!p.folded).length===1;}

function allBetsEqual(){
  const ap=players.filter(p=>!p.folded&&!p.allIn&&p.chips>0);
  return ap.every(p=>p.bet===currentBet);
}

function nextPhase(){
  players.forEach(p=>p.bet=0);
  currentBet=0;lastRaise=0;
  if(phase==='preflop'){phase='flop';communityCards=[deck.pop(),deck.pop(),deck.pop()];playSound('deal');}
  else if(phase==='flop'){phase='turn';communityCards.push(deck.pop());playSound('deal');}
  else if(phase==='turn'){phase='river';communityCards.push(deck.pop());playSound('deal');}
  else{phase='showdown';showdown();return;}

  currentIdx=nextActive(dealerIdx,true);
  const canAct=players.filter(p=>!p.folded&&!p.allIn&&p.chips>0);
  if(canAct.length<=1){
    while(communityCards.length<5)communityCards.push(deck.pop());
    phase='showdown';showdown();return;
  }
  render();

  if(!isMultiplayer && !players[currentIdx].isHuman){
    setTimeout(cpuTurn,1000);
  }
}

function playerAction(action, amount=0){
  ensureAudio();
  if(isProcessing && !isMultiplayer) return;
  isProcessing = true;
  const p=players[currentIdx];

  if(action==='fold'){p.folded=true;playSound('fold');}
  else if(action==='check'){/* nothing */}
  else if(action==='call'){
    const toCall=Math.min(currentBet-p.bet,p.chips);
    p.chips-=toCall;p.bet+=toCall;pot+=toCall;
    if(p.chips===0)p.allIn=true;
    playSound('chip');
  }
  else if(action==='raise'){
    const total=Math.min(amount,p.chips+p.bet);
    const added=total-p.bet;
    p.chips-=added;pot+=added;
    lastRaise=total-currentBet;
    currentBet=total;p.bet=total;
    if(p.chips===0)p.allIn=true;
    playSound('chip');
  }
  else if(action==='allin'){
    const added=p.chips;
    pot+=added;p.bet+=added;p.chips=0;p.allIn=true;
    if(p.bet>currentBet)currentBet=p.bet;
    playSound('chip');
  }

  // Broadcast action in multiplayer
  if (isMultiplayer) {
    broadcastAction(action, amount);
  }

  if(foldedAll()){awardPot(players.findIndex(p=>!p.folded));return;}

  let next=nextActive(currentIdx,true);
  let laps=0;
  while(next!==currentIdx&&laps<players.length){
    const np=players[next];
    if(!np.folded&&!np.allIn&&np.chips>0&&np.bet<currentBet)break;
    next=nextActive(next,true);laps++;
  }
  if(allBetsEqual()||activePlayers().length===0){isProcessing=false;nextPhase();return;}
  currentIdx=next;
  isProcessing=false;
  render();

  if(!isMultiplayer && !players[currentIdx].isHuman){
    setTimeout(cpuTurn,1200);
  }
}

// ===== CPU AI =====
function showCpuThinking() {
  showMessage(`${players[currentIdx].name} está pensando <span class="thinking-dots"><span></span><span></span><span></span></span>`);
}

function cpuTurn(){
  if(gameOver)return;
  if(isMultiplayer)return; // No CPU in multiplayer
  const p=players[currentIdx];
  if(p.folded||p.allIn||p.chips===0){advanceCpu();return;}

  showCpuThinking();
  setTimeout(() => { cpuTurnActual(); }, 1000);
}

function cpuTurnActual(){
  if(gameOver)return;
  if(isMultiplayer)return;
  const p=players[currentIdx];
  if(p.folded||p.allIn||p.chips===0){advanceCpu();return;}

  const ev=communityCards.length>=3?bestHand(p.hand,communityCards):null;
  const hStr=ev?ev.rank:estimatePreflop(p.hand);
  const toCall=currentBet-p.bet;
  const potOdds=pot>0?toCall/pot:0;

  let aggression=0.5;
  if(p.style==='aggressive')aggression=0.75;
  if(p.style==='tight')aggression=0.3;
  if(p.style==='loose')aggression=0.6;

  const strength=hStr/9;

  let action;
  if(toCall===0){
    if(strength>0.5+aggression*0.2&&Math.random()<aggression){
      const raiseAmt=Math.min(currentBet+Math.max(lastRaise,BLIND_LEVELS[blindLevel].bb)*2,p.chips+p.bet);
      action={type:'raise',amount:raiseAmt};
    }else action={type:'check'};
  }else if(strength<0.2-aggression*0.1&&potOdds>0.3){
    action={type:'fold'};
  }else if(strength>0.7&&Math.random()<aggression*0.6){
    action={type:'allin'};
  }else if(strength>0.4||potOdds<0.25){
    if(strength>0.6&&Math.random()<aggression*0.4&&p.chips>toCall+lastRaise){
      const raiseAmt=Math.min(currentBet+Math.max(lastRaise,BLIND_LEVELS[blindLevel].bb)*2,p.chips+p.bet);
      action={type:'raise',amount:raiseAmt};
    }else action={type:'call'};
  }else{
    action={type:'fold'};
  }

  showMessage(`${p.name}: ${cpuActionLabel(action)}`);
  setTimeout(()=>{playerAction(action.type,action.amount||0);},800);
}

function advanceCpu(){
  const next=nextActive(currentIdx,true);
  if(next===currentIdx||allBetsEqual()){nextPhase();return;}
  currentIdx=next;render();
  if(!isMultiplayer && !players[currentIdx].isHuman){
    setTimeout(cpuTurn,800);
  }
}

function cpuActionLabel(a){
  if(a.type==='fold')return'Desistiu';
  if(a.type==='check')return'Passou';
  if(a.type==='call')return`Pagou ${currentBet-players[currentIdx].bet}`;
  if(a.type==='raise')return`Apostou ${a.amount}`;
  if(a.type==='allin')return'All-In!';
  return a.type;
}

function estimatePreflop(hand){
  const [c1,c2]=hand;
  const v1=c1.value,v2=c2.value;
  const suited=c1.suit===c2.suit;
  const paired=v1===v2;
  const gap=Math.abs(v1-v2);
  const hi=Math.max(v1,v2);
  if(paired&&hi>=10)return 8;
  if(paired)return 5+hi/14*2;
  if(hi===14&&Math.min(v1,v2)>=10)return 7;
  if(hi>=12&&gap<=2)return suited?6:5;
  if(hi===14)return suited?5:4;
  if(gap<=2&&hi>=10)return suited?5:4;
  if(gap<=3&&suited)return 4;
  return 2;
}

// ===== SHOWDOWN =====
async function showdown(){
  const active=players.filter(p=>!p.folded);
  if(active.length===1){awardPot(players.indexOf(active[0]));return;}

  // In multiplayer, broadcast hands for reveal
  if (isMultiplayer) {
    await broadcastShowdown();
  }

  const evals=active.map(p=>({p,ev:bestHand(p.hand,communityCards)}));
  evals.sort((a,b)=>compareEval(b.ev,a.ev));

  const best=evals[0].ev;
  const winners=evals.filter(e=>compareEval(e.ev,best)===0).map(e=>e.p);
  const share=Math.floor(pot/winners.length);
  winners.forEach(w=>{w.chips+=share;});

  // Determine if current player won
  const myPlayer = players[playerSeat || 0];
  const humanWon = winners.includes(myPlayer);

  render(true); // show all cards

  const winnerNames=winners.map(w=>w.name).join(' e ');
  const handName=HAND_NAMES[evals[0].ev.rank]||'?';
  showModal(
    humanWon?(winners.length>1?'🤝':'🏆'):'😔',
    humanWon?(winners.length>1?'Empate!':'Você venceu!'):`${winnerNames} venceu!`,
    `${humanWon?'Seu ':winnerNames+' — '}${handName} · Pote: ${pot}`
  );

  if(humanWon)playSound('win');

  if (!isMultiplayer) {
    saveStats(humanWon?'win':'loss',players[0].chips);
  }

  setTimeout(()=>{
    closeModal();
    const broke=players.filter(p=>p.chips<=0&&!p.isHuman);
    if(broke.length){broke.forEach(p=>{p.chips=STARTING_CHIPS;});}
    const humanBroke=players[playerSeat || 0].chips<=0;
    if(humanBroke){endGame();return;}
    startHand();
    if (isMultiplayer && isHost) {
      broadcastNewHand();
    }
  },3000);
}

function awardPot(winnerIdx){
  players[winnerIdx].chips+=pot;
  const myPlayer = players[playerSeat || 0];
  const humanWon = players[winnerIdx] === myPlayer;
  render(true);
  const w=players[winnerIdx];
  showModal(humanWon?'🏆':'😔',humanWon?'Você venceu!':w.name+' venceu!',`Todos desistiram · Pote: ${pot}`);
  if(humanWon)playSound('win');

  if (!isMultiplayer) {
    saveStats(humanWon?'win':'loss',players[0].chips);
  }

  setTimeout(()=>{
    closeModal();
    const humanBroke=players[playerSeat || 0].chips<=0;
    if(humanBroke){endGame();return;}
    const broke=players.filter(p=>p.chips<=0&&!p.isHuman);
    if(broke.length)broke.forEach(p=>{p.chips=STARTING_CHIPS;});
    startHand();
    if (isMultiplayer && isHost) {
      broadcastNewHand();
    }
  },2500);
}

function endGame(){
  gameOver=true;
  isProcessing=false;
  const myPlayer = players[playerSeat || 0];
  showModal('🎮','Fim de jogo!',myPlayer.chips>0?`Você terminou com ${myPlayer.chips} fichas!`:'Você ficou sem fichas!');
  document.getElementById('btn-modal-new').style.display='block';
}

// ===== STATS =====
async function saveStats(result, score){
  if(!session)return;
  await supabase.from('game_stats').insert({
    user_id:session.user.id,
    game:'poker',
    result,
    score,
    time_seconds:0,
    moves:handCount,
  });
}

// ===== RENDER =====
function cardEl(card,hidden=false,classes=''){
  if(!card||hidden)return`<div class="card back ${classes}"></div>`;
  const red=isRed(card.suit);
  return`<div class="card ${red?'red':''} ${classes}">${card.rank}<br>${card.suit}</div>`;
}

function render(showAll=false){
  const {sb,bb}=BLIND_LEVELS[blindLevel];
  const sbIdx=nextActive(dealerIdx);
  const bbIdx=nextActive(sbIdx);

  // Update phase indicator
  const phases = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  phases.forEach(p => {
    const dot = document.getElementById(`phase-${p}`);
    if(dot) dot.classList.toggle('active', phase === p);
  });

  // Community cards
  const commEl=document.getElementById('community-cards');
  commEl.innerHTML='';
  for(let i=0;i<5;i++){
    if(i<communityCards.length){
      const c=communityCards[i];
      commEl.innerHTML+=cardEl(c,false,'community');
    }else{
      commEl.innerHTML+=`<div class="card community placeholder"></div>`;
    }
  }

  // Pot
  document.getElementById('pot-display').textContent=`💰 Pote: ${pot}`;
  document.getElementById('blind-info').textContent=`Blinds: ${sb}/${bb} · Mão #${handCount}`;

  // Render opponents
  if (isMultiplayer) {
    // In multiplayer, show only the opponent
    renderMultiplayerOpponent(sbIdx, bbIdx, showAll);
  } else {
    // Single player: show all 3 CPU players
    renderSinglePlayerOpponents(sbIdx, bbIdx, showAll);
  }

  // Player
  const mySeat = playerSeat || 0;
  const me=players[mySeat];
  if (me) {
    document.getElementById('player-area').className=`player-area${currentIdx===mySeat?' active-turn':''}`;
    document.getElementById('player-chips').textContent=`${me.chips} fichas`;
    document.getElementById('player-name').innerHTML='Você'+(mySeat===dealerIdx?'<span class="blind-chip chip-d">D</span>':mySeat===sbIdx?'<span class="blind-chip chip-sb">SB</span>':mySeat===bbIdx?'<span class="blind-chip chip-bb">BB</span>':'');
    document.getElementById('player-bet').textContent=me.bet>0?`Apostado: ${me.bet}`:'';

    const handEl=document.getElementById('player-hand');
    handEl.innerHTML='';
    if(me.hand.length===2){
      handEl.innerHTML=cardEl(me.hand[0])+cardEl(me.hand[1]);
    }

    // Hand strength label
    if(me.hand.length===2&&communityCards.length>=3){
      const ev=bestHand(me.hand,communityCards);
      document.getElementById('hand-label').textContent=HAND_NAMES[ev.rank];
    }else{
      document.getElementById('hand-label').textContent='';
    }
  }

  // Action buttons
  const isMyTurn=currentIdx===(playerSeat || 0)&&!me?.folded&&!me?.allIn&&phase!=='showdown';
  const toCall=currentBet-(me?.bet||0);
  const canCheck=toCall===0;
  const canCall=toCall>0&&me?.chips>0;
  const minRaise=Math.min(currentBet+Math.max(lastRaise,bb),me?.chips+me?.bet||0);
  const canRaise=me?.chips+me?.bet>currentBet+1;

  const actionArea = document.getElementById('action-area');
  if(actionArea) {
    actionArea.classList.toggle('disabled', !isMyTurn);
  }

  document.getElementById('action-area').innerHTML=isMyTurn?`
    <button class="btn-action btn-fold" id="btn-fold">Desistir</button>
    ${canCheck?`<button class="btn-action btn-check" id="btn-check">Passar</button>`:''}
    ${canCall?`<button class="btn-action btn-call" id="btn-call">Pagar ${Math.min(toCall,me?.chips||0)}</button>`:''}
    ${canRaise?`<button class="btn-action btn-raise" id="btn-raise">Apostar</button>`:''}
    <button class="btn-action btn-allin" id="btn-allin">All-In (${me?.chips||0})</button>
    ${canRaise?`<div class="bet-control">
      <input type="range" class="bet-slider" id="raise-slider" min="${minRaise}" max="${me?.chips+me?.bet||0}" value="${minRaise}" step="${bb}">
      <span class="bet-value" id="raise-val">${minRaise}</span>
    </div>`:''}
  `:'';

  if(isMyTurn){
    document.getElementById('btn-fold')?.addEventListener('click',()=>playerAction('fold'));
    document.getElementById('btn-check')?.addEventListener('click',()=>playerAction('check'));
    document.getElementById('btn-call')?.addEventListener('click',()=>playerAction('call'));
    document.getElementById('btn-allin')?.addEventListener('click',()=>playerAction('allin'));
    const slider=document.getElementById('raise-slider');
    const valEl=document.getElementById('raise-val');
    if(slider){
      raiseAmount=+slider.value;
      slider.addEventListener('input',()=>{raiseAmount=+slider.value;valEl.textContent=raiseAmount;});
      document.getElementById('btn-raise')?.addEventListener('click',()=>playerAction('raise',raiseAmount));
    }
  }
}

function renderSinglePlayerOpponents(sbIdx, bbIdx, showAll) {
  // CPU players (indices 1, 2, 3)
  for(let i=1;i<=3;i++){
    const p=players[i];
    if (!p) continue;
    const el=document.getElementById(`opp-${i}`);
    if (!el) continue;
    el.className=`opponent${p.folded?' folded':''}${currentIdx===i&&phase!=='showdown'?' active-turn':''}${p.allIn?' all-in':''}`;
    document.getElementById(`opp-name-${i}`).innerHTML=p.name+(i===dealerIdx?'<span class="blind-chip chip-d">D</span>':i===sbIdx?'<span class="blind-chip chip-sb">SB</span>':i===bbIdx?'<span class="blind-chip chip-bb">BB</span>':'');
    document.getElementById(`opp-chips-${i}`).textContent=`${p.chips} fichas`;
    document.getElementById(`opp-bet-${i}`).textContent=p.bet>0?`Apostou: ${p.bet}`:'';
    document.getElementById(`opp-status-${i}`).textContent=p.folded?'Desistiu':p.allIn?'All-In':'';
    const cardsEl=document.getElementById(`opp-cards-${i}`);
    cardsEl.innerHTML='';
    if(p.hand.length===2){
      const reveal=showAll&&!p.folded&&phase==='showdown';
      cardsEl.innerHTML=cardEl(p.hand[0],!reveal)+cardEl(p.hand[1],!reveal);
      if(reveal){
        const ev=bestHand(p.hand,communityCards);
        document.getElementById(`opp-status-${i}`).textContent=HAND_NAMES[ev.rank];
      }
    }
  }
}

function renderMultiplayerOpponent(sbIdx, bbIdx, showAll) {
  // In multiplayer, only show the opponent (the other seat)
  const opponentSeat = playerSeat === 0 ? 1 : 0;
  const p = players[opponentSeat];
  if (!p) return;

  // Hide CPU opponents in multiplayer
  for(let i=1;i<=3;i++){
    const el=document.getElementById(`opp-${i}`);
    if(el) el.style.display = 'none';
  }

  // Show opponent in opp-1 slot
  const el=document.getElementById('opp-1');
  if(el) {
    el.style.display = 'block';
    el.className=`opponent${p.folded?' folded':''}${currentIdx===opponentSeat&&phase!=='showdown'?' active-turn':''}${p.allIn?' all-in':''}`;
    document.getElementById('opp-name-1').innerHTML=p.name+(opponentSeat===dealerIdx?'<span class="blind-chip chip-d">D</span>':opponentSeat===sbIdx?'<span class="blind-chip chip-sb">SB</span>':opponentSeat===bbIdx?'<span class="blind-chip chip-bb">BB</span>':'');
    document.getElementById('opp-chips-1').textContent=`${p.chips} fichas`;
    document.getElementById('opp-bet-1').textContent=p.bet>0?`Apostou: ${p.bet}`:'';
    document.getElementById('opp-status-1').textContent=p.folded?'Desistiu':p.allIn?'All-In':'';
    const cardsEl=document.getElementById('opp-cards-1');
    cardsEl.innerHTML='';
    if(p.hand.length===2){
      // Show back of cards during game, reveal at showdown
      const reveal=showAll&&!p.folded&&phase==='showdown';
      cardsEl.innerHTML=cardEl(p.hand[0],!reveal)+cardEl(p.hand[1],!reveal);
      if(reveal){
        const ev=bestHand(p.hand,communityCards);
        document.getElementById('opp-status-1').textContent=HAND_NAMES[ev.rank];
      }
    }
  }
}

// ===== UI HELPERS =====
function showMessage(msg){const el=document.getElementById('message');if(el)el.innerHTML=msg;}
function showModal(icon,title,msg){
  document.getElementById('modal-icon').textContent=icon;
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-msg').textContent=msg;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal(){document.getElementById('modal-overlay').classList.add('hidden');}

// ===== EVENTS =====
document.getElementById('btn-new-game')?.addEventListener('click',()=>{
  closeModal();init();
});
document.getElementById('btn-modal-new')?.addEventListener('click',()=>{
  document.getElementById('btn-modal-new').style.display='none';
  closeModal();init();
});

// Initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    init();
  });
}
