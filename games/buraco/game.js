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

// ===== DECK (2 baralhos + 4 coringas) =====
const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RANK_VAL = {A:15,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:10,Q:10,K:10};
const RANK_ORDER = {A:14,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13};
// Wild: jokers and 2♦ (in traditional Buraco, 2♦ is wild in some regional rules; here we use 4 jokers as wilds)
// We use standard: red 2s are NOT wild; jokers ARE wild

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
let hand=[], cpuHand=[], melds=[], cpuMelds=[];
let mortoTaken=false, cpuMortoTaken=false;
let turn='player'; // 'player' or 'cpu'
let drawnThisTurn=false;
let selectedCards=new Set(); // indices in hand
let score=0, cpuScore=0;
let gameOver=false;
let session=null;
let roundNum=0;
let isProcessing=false;

async function init(){
  const {data:{session:s}}=await supabase.auth.getSession();
  session=s;
  startRound();
}

function startRound(){
  ensureAudio();
  isProcessing = false;
  roundNum++;
  const deck=shuffle(createDeck());
  // Deal: 11 to each, 11 to morto1, 11 to morto2
  hand=deck.splice(0,11);
  cpuHand=deck.splice(0,11);
  morto1=deck.splice(0,11);
  morto2=deck.splice(0,11);
  stock=[...deck];
  discardPile=[];
  melds=[];cpuMelds=[];
  mortoTaken=false;cpuMortoTaken=false;
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
  turn='cpu';
  isProcessing = false;
  render();setMsg('Vez da CPU...');
  setTimeout(cpuTurn,1200);
}

function tryBaixar(){
  // Check: must have at least one canasta to go down
  const hasCanasta=melds.some(m=>isCanasta(m));
  if(!hasCanasta){setMsg('Precisa de pelo menos uma canasta para baixar!');return;}
  if(hand.length>0){setMsg('Precisa esvaziar a mão para baixar.');return;}
  endRound(true);
}

// ===== CPU AI =====
function showCpuThinking() {
  setMsg('CPU está pensando <span class="thinking-dots"><span></span><span></span><span></span></span>');
}

function cpuTurn(){
  if(gameOver)return;
  showCpuThinking();

  setTimeout(() => {
    cpuTurnActual();
  }, 1000);
}

function cpuTurnActual(){
  if(gameOver)return;
  // Simple CPU: draw from stock, try to form melds, discard worst card
  if(stock.length>0)cpuHand.push(stock.pop());
  else{endRound();return;}

  // Try to form melds
  let madeProgress=true;
  while(madeProgress){
    madeProgress=false;
    // Try all combos of 3+ cards
    for(let size=cpuHand.length;size>=3;size--){
      const combos=combinations(cpuHand,size);
      for(const combo of combos){
        if(isValidMeld(combo)){
          cpuMelds.push([...combo]);
          const comboKeys=combo.map(c=>cardKey(c));
          cpuHand=cpuHand.filter(c=>!comboKeys.includes(cardKey(c)));
          madeProgress=true;break;
        }
      }
      if(madeProgress)break;
    }
  }

  // Try to add to existing melds
  for(let mi=0;mi<cpuMelds.length;mi++){
    for(let ci=cpuHand.length-1;ci>=0;ci--){
      const card=cpuHand[ci];
      if(canAddToMeld(cpuMelds[mi],card)){
        cpuMelds[mi].push(card);
        cpuHand.splice(ci,1);
      }
    }
  }

  // Pick up morto if empty
  if(cpuHand.length===0&&!cpuMortoTaken){
    cpuHand=[...morto2];cpuMortoTaken=true;
  }

  // Discard worst card (lowest value, avoid wild)
  if(cpuHand.length>0){
    cpuHand.sort((a,b)=>cardPts(a)-cardPts(b));
    // Discard first non-wild if possible
    let discIdx=cpuHand.findIndex(c=>!c.wild);
    if(discIdx<0)discIdx=0;
    discardPile.push(cpuHand.splice(discIdx,1)[0]);
  }

  // Check if CPU can go down
  if(cpuHand.length===0){
    const hasCanasta=cpuMelds.some(m=>isCanasta(m));
    if(cpuMortoTaken&&hasCanasta){endRound(false,true);return;}
    else if(!cpuMortoTaken){cpuHand=[...morto2];cpuMortoTaken=true;}
  }

  turn='player';drawnThisTurn=false;
  render();setMsg('Sua vez! Compre do monte ou pegue o descarte.');
}

// Keep the old function name for compatibility (now calls the delayed version)
const cpuTurnDelayed = cpuTurn;

function combinations(arr,k){
  if(k===0)return[[]];
  if(arr.length<k)return[];
  const[first,...rest]=arr;
  return[...combinations(rest,k-1).map(c=>[first,...c]),...combinations(rest,k)];
}

// ===== END ROUND =====
function endRound(playerDown=false,cpuDown=false){
  gameOver=true;
  const playerRoundScore=calcScore(melds,hand)+(playerDown?100:0);
  const cpuRoundScore=calcScore(cpuMelds,cpuHand)+(cpuDown?100:0);
  score+=playerRoundScore;
  cpuScore+=cpuRoundScore;

  const won=score>cpuScore;
  const tied=score===cpuScore;

  if(won)playSound('win');

  saveStats(won?'win':tied?'draw':'loss',score);

  render();
  showModal(
    won?'🏆':tied?'🤝':'😔',
    playerDown?'Você baixou!':cpuDown?'CPU baixou!':'Rodada encerrada!',
    `Você: ${playerRoundScore>0?'+':''}${playerRoundScore}pts (Total: ${score})\nCPU: ${cpuRoundScore>0?'+':''}${cpuRoundScore}pts (Total: ${cpuScore})`
  );
}

async function saveStats(result,pts){
  if(!session)return;
  await supabase.from('game_stats').insert({user_id:session.user.id,game:'buraco',result,score:pts,time_seconds:0,moves:0});
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
  document.getElementById('score-cpu').textContent=cpuScore;
  const tb=document.getElementById('turn-badge');
  tb.textContent=turn==='player'?'Sua vez':'Vez da CPU';
  tb.className='turn-badge '+(turn==='player'?'turn-mine':'turn-cpu')+(turn==='cpu'?' active':'');

  // Round display
  const rd=document.getElementById('round-display');
  if(rd)rd.textContent=`Rodada ${roundNum}`;

  // CPU area
  const cpuArea = document.querySelector('.cpu-area');
  if(turn === 'cpu') {
    cpuArea?.classList.add('active-turn');
  } else {
    cpuArea?.classList.remove('active-turn');
  }

  document.getElementById('cpu-hand-display').innerHTML=cpuHand.map(()=>`<div class="card back sm"></div>`).join('');
  document.getElementById('cpu-hand-count').textContent=`${cpuHand.length} cartas${cpuMortoTaken?' · Morto em mãos':''}`;
  document.getElementById('cpu-melds-display').innerHTML=cpuMelds.map((m,i)=>meldHTML(m,i,false)).join('');

  // Table
  document.getElementById('stock-count').textContent=stock.length;
  const top=discardPile[discardPile.length-1];
  document.getElementById('discard-display').innerHTML=top?cardHTML(top):`<div class="empty-discard"></div>`;
  document.getElementById('morto1-display').innerHTML=`<div class="pile-stack${mortoTaken?' morto-taken':''}"><div class="card back"></div></div><div class="pile-count">${mortoTaken?'Retirado':morto1.length+' cartas'}</div>`;
  document.getElementById('morto2-display').innerHTML=`<div class="pile-stack${cpuMortoTaken?' morto-taken':''}"><div class="card back"></div></div><div class="pile-count">${cpuMortoTaken?'Retirado':morto2.length+' cartas'}</div>`;

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

function setMsg(msg){const el=document.getElementById('msg-bar');if(el)el.textContent=msg;}
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
  startRound();
});

init();
