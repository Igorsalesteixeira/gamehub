import { supabase } from '../../supabase.js';

// ===== CONSTANTS =====
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VAL = {2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13,A:14};
const HAND_NAMES = ['Carta Alta','Par','Dois Pares','Trinca','Sequência','Flush','Full House','Quadra','Straight Flush','Royal Flush'];
const CPU_NAMES = ['Ana 🤖','Bob 🤖','Cris 🤖'];
const CPU_STYLES = ['tight','loose','aggressive']; // personality

const STARTING_CHIPS = 1000;
const BLIND_LEVELS = [
  {sb:10,bb:20},{sb:15,bb:30},{sb:25,bb:50},{sb:50,bb:100},{sb:75,bb:150},{sb:100,bb:200}
];

// ===== STATE =====
let deck=[], communityCards=[], pot=0, sidePot=0;
let players=[]; // [{name, chips, hand, bet, folded, allIn, isHuman, style}]
let dealerIdx=0, currentIdx=0;
let phase=''; // preflop, flop, turn, river, showdown
let currentBet=0, lastRaise=0;
let handCount=0, blindLevel=0;
let gameOver=false;
let raiseAmount=0;
let session=null;

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
  // Straight check (including A-2-3-4-5)
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
  players=[
    {name:'Você',chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,isHuman:true,style:''},
    {name:CPU_NAMES[0],chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,isHuman:false,style:CPU_STYLES[0]},
    {name:CPU_NAMES[1],chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,isHuman:false,style:CPU_STYLES[1]},
    {name:CPU_NAMES[2],chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,isHuman:false,style:CPU_STYLES[2]},
  ];
  handCount=0;blindLevel=0;gameOver=false;
  startHand();
}

function startHand() {
  if(gameOver)return;
  // Check if only 1 player has chips
  const active=players.filter(p=>p.chips>0);
  if(active.length<2){endGame();return;}

  // Advance blind level every 5 hands
  blindLevel=Math.min(Math.floor(handCount/5),BLIND_LEVELS.length-1);
  const {sb,bb}=BLIND_LEVELS[blindLevel];

  deck=shuffle(createDeck());
  communityCards=[];pot=0;currentBet=bb;lastRaise=bb;handCount++;

  // Reset players
  players.forEach(p=>{p.hand=[];p.bet=0;p.folded=false;p.allIn=false;});

  // Skip broke players for dealer rotation
  do{dealerIdx=(dealerIdx+1)%players.length;}while(players[dealerIdx].chips<=0);

  // Post blinds
  const sbIdx=nextActive(dealerIdx);
  const bbIdx=nextActive(sbIdx);
  postBlind(sbIdx,sb);
  postBlind(bbIdx,bb);

  // Deal 2 cards to each active player
  players.forEach(p=>{if(p.chips>0||p.allIn){p.hand=[deck.pop(),deck.pop()];}});

  phase='preflop';
  currentIdx=nextActive(bbIdx);
  render();
  if(!players[currentIdx].isHuman)setTimeout(cpuTurn,1000);
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
  if(phase==='preflop'){phase='flop';communityCards=[deck.pop(),deck.pop(),deck.pop()];}
  else if(phase==='flop'){phase='turn';communityCards.push(deck.pop());}
  else if(phase==='turn'){phase='river';communityCards.push(deck.pop());}
  else{phase='showdown';showdown();return;}

  // First active after dealer
  currentIdx=nextActive(dealerIdx,true);
  // Skip if only allIn players remain
  const canAct=players.filter(p=>!p.folded&&!p.allIn&&p.chips>0);
  if(canAct.length<=1){
    // Auto-run remaining streets
    while(communityCards.length<5)communityCards.push(deck.pop());
    phase='showdown';showdown();return;
  }
  render();
  if(!players[currentIdx].isHuman)setTimeout(cpuTurn,1000);
}

function playerAction(action, amount=0){
  const p=players[currentIdx];
  if(action==='fold'){p.folded=true;}
  else if(action==='check'){/* nothing */}
  else if(action==='call'){
    const toCall=Math.min(currentBet-p.bet,p.chips);
    p.chips-=toCall;p.bet+=toCall;pot+=toCall;
    if(p.chips===0)p.allIn=true;
  }
  else if(action==='raise'){
    const total=Math.min(amount,p.chips+p.bet);
    const added=total-p.bet;
    p.chips-=added;pot+=added;
    lastRaise=total-currentBet;
    currentBet=total;p.bet=total;
    if(p.chips===0)p.allIn=true;
  }
  else if(action==='allin'){
    const added=p.chips;
    pot+=added;p.bet+=added;p.chips=0;p.allIn=true;
    if(p.bet>currentBet)currentBet=p.bet;
  }

  if(foldedAll()){awardPot(players.findIndex(p=>!p.folded));return;}

  // Advance
  let next=nextActive(currentIdx,true);
  // Check if betting round is over
  let laps=0;
  while(next!==currentIdx&&laps<players.length){
    const np=players[next];
    if(!np.folded&&!np.allIn&&np.chips>0&&np.bet<currentBet)break;
    next=nextActive(next,true);laps++;
  }
  if(allBetsEqual()||activePlayers().length===0){nextPhase();return;}
  currentIdx=next;
  render();
  if(!players[currentIdx].isHuman)setTimeout(cpuTurn,1000);
}

// ===== CPU AI =====
function cpuTurn(){
  if(gameOver)return;
  const p=players[currentIdx];
  if(p.folded||p.allIn||p.chips===0){advanceCpu();return;}

  const ev=communityCards.length>=3?bestHand(p.hand,communityCards):null;
  const hStr=ev?ev.rank:estimatePreflop(p.hand);
  const toCall=currentBet-p.bet;
  const potOdds=pot>0?toCall/pot:0;

  // Personality adjustments
  let aggression=0.5;
  if(p.style==='aggressive')aggression=0.75;
  if(p.style==='tight')aggression=0.3;
  if(p.style==='loose')aggression=0.6;

  const strength=hStr/9; // 0 to 1

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

  // Animate CPU action
  showMessage(`${p.name}: ${cpuActionLabel(action)}`);
  setTimeout(()=>{playerAction(action.type,action.amount||0);},600);
}

function advanceCpu(){
  const next=nextActive(currentIdx,true);
  if(next===currentIdx||allBetsEqual()){nextPhase();return;}
  currentIdx=next;render();
  if(!players[currentIdx].isHuman)setTimeout(cpuTurn,800);
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
  // Estimate hand strength from hole cards only
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
function showdown(){
  const active=players.filter(p=>!p.folded);
  if(active.length===1){awardPot(players.indexOf(active[0]));return;}

  // Evaluate hands
  const evals=active.map(p=>({p,ev:bestHand(p.hand,communityCards)}));
  evals.sort((a,b)=>compareEval(b.ev,a.ev));

  // Find winners (could be tie)
  const best=evals[0].ev;
  const winners=evals.filter(e=>compareEval(e.ev,best)===0).map(e=>e.p);
  const share=Math.floor(pot/winners.length);
  winners.forEach(w=>{w.chips+=share;});

  const humanWon=winners.includes(players[0]);

  render(true); // show all cards

  const winnerNames=winners.map(w=>w.name).join(' e ');
  const handName=HAND_NAMES[evals[0].ev.rank]||'?';
  showModal(
    humanWon?(winners.length>1?'🤝':'🏆'):'😔',
    humanWon?(winners.length>1?'Empate!':'Você venceu!'):`${winnerNames} venceu!`,
    `${humanWon?'Seu ':winnerNames+' — '}${handName} · Pote: ${pot}`
  );

  // Save stats
  saveStats(humanWon?'win':'loss',players[0].chips);

  setTimeout(()=>{
    closeModal();
    const broke=players.filter(p=>p.chips<=0&&!p.isHuman);
    if(broke.length){broke.forEach(p=>{p.chips=STARTING_CHIPS;});} // rebuy CPU
    const humanBroke=players[0].chips<=0;
    if(humanBroke){endGame();return;}
    startHand();
  },3000);
}

function awardPot(winnerIdx){
  players[winnerIdx].chips+=pot;
  const humanWon=winnerIdx===0;
  render(true);
  const w=players[winnerIdx];
  showModal(humanWon?'🏆':'😔',humanWon?'Você venceu!':w.name+' venceu!',`Todos desistiram · Pote: ${pot}`);
  saveStats(humanWon?'win':'loss',players[0].chips);
  setTimeout(()=>{
    closeModal();
    const humanBroke=players[0].chips<=0;
    if(humanBroke){endGame();return;}
    const broke=players.filter(p=>p.chips<=0&&!p.isHuman);
    if(broke.length)broke.forEach(p=>{p.chips=STARTING_CHIPS;});
    startHand();
  },2500);
}

function endGame(){
  gameOver=true;
  showModal('🎮','Fim de jogo!',players[0].chips>0?`Você terminou com ${players[0].chips} fichas!`:'Você ficou sem fichas!');
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

  // CPU players (indices 1, 2, 3)
  for(let i=1;i<=3;i++){
    const p=players[i];
    const el=document.getElementById(`opp-${i}`);
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

  // Player
  const me=players[0];
  document.getElementById('player-area').className=`player-area${currentIdx===0?' active-turn':''}`;
  document.getElementById('player-chips').textContent=`${me.chips} fichas`;
  document.getElementById('player-name').innerHTML='Você'+(0===dealerIdx?'<span class="blind-chip chip-d">D</span>':0===sbIdx?'<span class="blind-chip chip-sb">SB</span>':0===bbIdx?'<span class="blind-chip chip-bb">BB</span>':'');
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

  // Action buttons
  const isMyTurn=currentIdx===0&&!me.folded&&!me.allIn&&phase!=='showdown';
  const toCall=currentBet-me.bet;
  const canCheck=toCall===0;
  const canCall=toCall>0&&me.chips>0;
  const minRaise=Math.min(currentBet+Math.max(lastRaise,bb),me.chips+me.bet);
  const canRaise=me.chips+me.bet>currentBet+1;

  document.getElementById('action-area').innerHTML=isMyTurn?`
    <button class="btn-action btn-fold" id="btn-fold">Desistir</button>
    ${canCheck?`<button class="btn-action btn-check" id="btn-check">Passar</button>`:''}
    ${canCall?`<button class="btn-action btn-call" id="btn-call">Pagar ${Math.min(toCall,me.chips)}</button>`:''}
    ${canRaise?`<button class="btn-action btn-raise" id="btn-raise">Apostar</button>`:''}
    <button class="btn-action btn-allin" id="btn-allin">All-In (${me.chips})</button>
    ${canRaise?`<div class="bet-control">
      <input type="range" class="bet-slider" id="raise-slider" min="${minRaise}" max="${me.chips+me.bet}" value="${minRaise}" step="${bb}">
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

// ===== UI HELPERS =====
function showMessage(msg){const el=document.getElementById('message');if(el)el.textContent=msg;}
function showModal(icon,title,msg){
  document.getElementById('modal-icon').textContent=icon;
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-msg').textContent=msg;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal(){document.getElementById('modal-overlay').classList.add('hidden');}

// ===== EVENTS =====
document.getElementById('btn-new-game').addEventListener('click',()=>{
  closeModal();init();
});
document.getElementById('btn-modal-new').addEventListener('click',()=>{
  document.getElementById('btn-modal-new').style.display='none';
  closeModal();init();
});

init();
