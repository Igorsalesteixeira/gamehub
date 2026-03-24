/**
 * Dungeon Crawler — Premium Cartoon (Canvas2D)
 * Warrior character, textured walls, smooth lighting
 */

import { onGameEnd } from '../shared/game-integration.js';
import { GameStats, GameStorage } from '../shared/game-core.js';

const stats = new GameStats('dungeon');
const storage = new GameStorage('dungeon');

const TILE = 28;
const LIGHT_BASE_RADIUS = 6;
const TILE_FLOOR = 0, TILE_WALL = 1, TILE_STAIRS = 3;

const C = {
  floor1: '#B8A88C', floor2: '#A89878',
  wall: '#5C4A3A', wallLight: '#7B6B58', wallDark: '#3E3028',
  stairs: '#FFD54F', stairGlow: '#FFB300',
  player: '#3F8C4F', playerArmor: '#607D8B', playerHelmet: '#78909C',
  playerSword: '#90CAF9', playerSkin: '#FFCC80',
  slime: '#66BB6A', bat: '#7E57C2', skeleton: '#BDBDBD', boss: '#C62828',
  potionHP: '#E53935', sword: '#42A5F5', shield: '#FFD54F',
  torch: '#FF8F00', gold: '#FFD54F', bg: '#2D3B36',
};

function hexD(hex, f) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.floor(r*f)},${Math.floor(g*f)},${Math.floor(b*f)})`;
}
function hexDA(hex, f, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${Math.floor(r*f)},${Math.floor(g*f)},${Math.floor(b*f)},${a})`;
}

let canvas, ctx;
let mapW, mapH, tiles, explored, rooms;
let player, enemies, items;
let floor = 1, score = 0, kills = 0;
let bestScore = parseInt(localStorage.getItem('dungeon_best') || '0', 10);
let gameRunning = false, lightRadius = LIGHT_BASE_RADIUS;
let flickerTime = 0, animating = false, playerDamageFlash = 0;
let visibleSet = new Set();
const particles = [], floatingTexts = [];
const DOM = {};

function boot() {
  DOM.container = document.getElementById('pixi-container');
  DOM.overlay = document.getElementById('overlay');
  DOM.title = document.getElementById('overlay-title');
  DOM.msg = document.getElementById('overlay-msg');
  DOM.scoreEl = document.getElementById('overlay-score');
  DOM.icon = document.getElementById('overlay-icon');
  DOM.btnStart = document.getElementById('btn-start');
  DOM.btnShare = document.getElementById('btn-share');
  DOM.scoreDisplay = document.getElementById('score-display');
  DOM.bestDisplay = document.getElementById('best-display');
  DOM.bestDisplay.textContent = bestScore;

  canvas = document.createElement('canvas');
  canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.display = 'block';
  DOM.container.appendChild(canvas);
  ctx = canvas.getContext('2d');

  resize();
  window.addEventListener('resize', resize);
  setupControls();
  DOM.btnStart.addEventListener('click', startGame);
  DOM.btnShare.addEventListener('click', shareResult);
  showOverlay('start');
  requestAnimationFrame(gameLoop);
}

function resize() {
  const r = DOM.container.getBoundingClientRect();
  canvas.width = r.width || window.innerWidth;
  canvas.height = r.height || (window.innerHeight - 50);
}

function getScale() {
  return Math.max(1, Math.min(canvas.width, canvas.height) / ((lightRadius * 2 + 4) * TILE));
}

function showOverlay(mode) {
  DOM.overlay.classList.remove('hidden');
  if (mode === 'start') {
    DOM.icon.textContent = '⚔️'; DOM.title.textContent = 'Dungeon Crawler';
    DOM.msg.textContent = 'Explore masmorras na escuridão.\nWASD/Setas para mover.\nClique/Toque para atacar.';
    DOM.scoreEl.textContent = ''; DOM.btnStart.textContent = 'Explorar';
    DOM.btnShare.style.display = 'none';
  } else {
    DOM.icon.textContent = '💀'; DOM.title.textContent = 'Você Caiu!';
    DOM.msg.textContent = `Andar ${floor} • ${kills} monstros derrotados`;
    DOM.scoreEl.textContent = `Pontuação: ${score}`;
    DOM.btnStart.textContent = 'Tentar Novamente'; DOM.btnShare.style.display = 'inline-block';
  }
}
function hideOverlay() { DOM.overlay.classList.add('hidden'); }

function startGame() {
  hideOverlay();
  floor = 1; score = 0; kills = 0; lightRadius = LIGHT_BASE_RADIUS;
  player = { x:0,y:0,hp:10,maxHp:10,atk:2,def:1,px:0,py:0,moveT:1,dirX:0,dirY:1,fromPX:0,fromPY:0,toPX:0,toPY:0 };
  generateFloor(); gameRunning = true; animating = false; updateHUD();
}

// ── Generation ──
function generateFloor() {
  const sz = 40 + Math.min(floor * 5, 40);
  mapW = sz; mapH = sz;
  tiles = new Array(mapW * mapH).fill(TILE_WALL);
  explored = new Array(mapW * mapH).fill(false);
  rooms = []; enemies = []; items = [];
  genRooms(5 + Math.min(Math.floor(floor * 0.8), 8));
  connectRooms(); placeStairs(); placePlayer(); spawnEnemies(); spawnItems();
}

function genRooms(count) {
  let att = 0;
  while (rooms.length < count && att < 500) {
    att++;
    const w = 5+Math.floor(Math.random()*8), h = 5+Math.floor(Math.random()*8);
    const x = 2+Math.floor(Math.random()*(mapW-w-4)), y = 2+Math.floor(Math.random()*(mapH-h-4));
    let ov = false;
    for (const r of rooms) if (x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y){ov=true;break;}
    if (ov) continue;
    rooms.push({x,y,w,h,cx:Math.floor(x+w/2),cy:Math.floor(y+h/2)});
    for (let ry=y;ry<y+h;ry++) for (let rx=x;rx<x+w;rx++) tiles[ry*mapW+rx]=TILE_FLOOR;
  }
}
function connectRooms() {
  for (let i=1;i<rooms.length;i++) carve(rooms[i-1].cx,rooms[i-1].cy,rooms[i].cx,rooms[i].cy);
  if (rooms.length>4) carve(rooms[0].cx,rooms[0].cy,rooms[rooms.length-1].cx,rooms[rooms.length-1].cy);
}
function carve(x1,y1,x2,y2) {
  let x=x1,y=y1;
  while(x!==x2){if(x>=0&&x<mapW&&y>=0&&y<mapH){tiles[y*mapW+x]=TILE_FLOOR;if(y+1<mapH)tiles[(y+1)*mapW+x]=TILE_FLOOR;}x+=x<x2?1:-1;}
  while(y!==y2){if(x>=0&&x<mapW&&y>=0&&y<mapH){tiles[y*mapW+x]=TILE_FLOOR;if(x+1<mapW)tiles[y*mapW+x+1]=TILE_FLOOR;}y+=y<y2?1:-1;}
}
function placeStairs(){tiles[rooms[rooms.length-1].cy*mapW+rooms[rooms.length-1].cx]=TILE_STAIRS;}
function placePlayer(){
  const r=rooms[0]; player.x=r.cx; player.y=r.cy;
  player.px=player.x*TILE; player.py=player.y*TILE; player.moveT=1;
  animating = false; // FIX: reset animating on new floor
}

function spawnEnemies() {
  const cnt=3+Math.floor(floor*1.5);
  for(let i=0;i<cnt;i++){
    const rm=rooms[1+Math.floor(Math.random()*(rooms.length-1))]; if(!rm)continue;
    const ex=rm.x+1+Math.floor(Math.random()*(rm.w-2)),ey=rm.y+1+Math.floor(Math.random()*(rm.h-2));
    if(tiles[ey*mapW+ex]!==TILE_FLOOR||(ex===player.x&&ey===player.y))continue;
    const t=Math.random();
    if(t<0.35) enemies.push({x:ex,y:ey,type:'slime',hp:3,maxHp:3,atk:1,def:0,color:C.slime,score:10,speed:0.3});
    else if(t<0.6) enemies.push({x:ex,y:ey,type:'bat',hp:2,maxHp:2,atk:1,def:0,color:C.bat,score:15,speed:0.7});
    else enemies.push({x:ex,y:ey,type:'skeleton',hp:5,maxHp:5,atk:2,def:1,color:C.skeleton,score:30,speed:0.5});
    const e=enemies[enemies.length-1]; e.hp+=Math.floor(floor*0.3); e.maxHp=e.hp; e.atk+=Math.floor(floor*0.2);
  }
  if(floor%5===0){const br=rooms[Math.floor(rooms.length/2)];
    enemies.push({x:br.cx,y:br.cy,type:'boss',hp:15+floor*2,maxHp:15+floor*2,atk:4+Math.floor(floor*0.3),def:2,color:C.boss,score:100+floor*10,speed:0.6});}
}

function spawnItems() {
  for(let i=0;i<3+Math.floor(floor*0.5);i++){
    const rm=rooms[Math.floor(Math.random()*rooms.length)];
    const ix=rm.x+1+Math.floor(Math.random()*(rm.w-2)),iy=rm.y+1+Math.floor(Math.random()*(rm.h-2));
    if(tiles[iy*mapW+ix]!==TILE_FLOOR)continue;
    const t=Math.random();
    if(t<0.35)items.push({x:ix,y:iy,type:'potion',color:C.potionHP,effect:'hp'});
    else if(t<0.55)items.push({x:ix,y:iy,type:'sword',color:C.sword,effect:'atk'});
    else if(t<0.7)items.push({x:ix,y:iy,type:'shield',color:C.shield,effect:'def'});
    else items.push({x:ix,y:iy,type:'torch',color:C.torch,effect:'light'});
  }
  for(let i=0;i<4+floor;i++){
    const rm=rooms[Math.floor(Math.random()*rooms.length)];
    const gx=rm.x+1+Math.floor(Math.random()*(rm.w-2)),gy=rm.y+1+Math.floor(Math.random()*(rm.h-2));
    if(tiles[gy*mapW+gx]!==TILE_FLOOR)continue;
    items.push({x:gx,y:gy,type:'gold',color:C.gold,effect:'score'});
  }
}

// Helper: check if tile is wall
function isWall(x,y){return x<0||x>=mapW||y<0||y>=mapH||tiles[y*mapW+x]===TILE_WALL;}

// ══════════════════════════
// RENDER
// ══════════════════════════
function render() {
  const W=canvas.width, H=canvas.height, scale=getScale();
  ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);

  const camX=W/2-(player.px+TILE/2)*scale, camY=H/2-(player.py+TILE/2)*scale;
  ctx.save(); ctx.translate(camX,camY); ctx.scale(scale,scale);

  const pcx=player.x*TILE+TILE/2, pcy=player.y*TILE+TILE/2;
  const flick=Math.sin(flickerTime*3)*0.12+Math.sin(flickerTime*7.3)*0.06;
  const lr=(lightRadius+flick)*TILE;
  const dr=lightRadius+3;
  visibleSet=new Set();

  // ── TILES ──
  for(let dy=-dr;dy<=dr;dy++) for(let dx=-dr;dx<=dr;dx++){
    const x=player.x+dx, y=player.y+dy;
    if(x<0||x>=mapW||y<0||y>=mapH)continue;
    const idx=y*mapW+x, t=tiles[idx], px=x*TILE, py=y*TILE;
    const dist=Math.sqrt((px+TILE/2-pcx)**2+(py+TILE/2-pcy)**2);
    const inLight=dist<=lr;
    if(inLight){explored[idx]=true;visibleSet.add(idx);}
    if(!inLight&&!explored[idx])continue;
    const br=inLight?Math.max(0.3,1-(dist/lr)*0.7):0.15;

    if(t===TILE_WALL){
      // Wall with 3D depth effect
      ctx.fillStyle=hexD(C.wall, br);
      ctx.fillRect(px, py, TILE, TILE);
      // Top face (lighter)
      if(!isWall(x,y-1)){
        ctx.fillStyle=hexD(C.wallLight, br);
        ctx.fillRect(px, py, TILE, 5);
      }
      // Bottom shadow
      if(!isWall(x,y+1)){
        ctx.fillStyle=hexDA(C.wallDark, br, 0.6);
        ctx.fillRect(px, py+TILE-3, TILE, 3);
      }
      // Left/right edges
      if(!isWall(x-1,y)){
        ctx.fillStyle=hexDA(C.wallLight, br, 0.3);
        ctx.fillRect(px, py, 2, TILE);
      }
      if(!isWall(x+1,y)){
        ctx.fillStyle=hexDA(C.wallDark, br, 0.3);
        ctx.fillRect(px+TILE-2, py, 2, TILE);
      }
      // Stone texture lines
      if(inLight&&br>0.4){
        ctx.strokeStyle=hexDA(C.wallDark, br, 0.15);
        ctx.lineWidth=1;
        ctx.beginPath();
        ctx.moveTo(px+4, py+TILE/2); ctx.lineTo(px+TILE-4, py+TILE/2);
        ctx.moveTo(px+TILE/2, py+3); ctx.lineTo(px+TILE/2, py+TILE-3);
        ctx.stroke();
      }
    } else if(t===TILE_FLOOR){
      const col=(x+y)%2===0?C.floor1:C.floor2;
      ctx.fillStyle=hexD(col, br);
      ctx.fillRect(px, py, TILE, TILE);
      // Subtle stone crack detail
      if(inLight&&br>0.5&&((x*7+y*13)%11===0)){
        ctx.strokeStyle=hexDA('#8B7B68', br, 0.2);
        ctx.lineWidth=0.5;
        ctx.beginPath();
        ctx.moveTo(px+3,py+TILE/3); ctx.lineTo(px+TILE*0.6,py+TILE*0.7);
        ctx.stroke();
      }
      // Shadow at wall edge (ambient occlusion)
      if(isWall(x,y-1)){ctx.fillStyle=`rgba(0,0,0,${0.12*br})`; ctx.fillRect(px,py,TILE,4);}
      if(isWall(x,y+1)){ctx.fillStyle=`rgba(0,0,0,${0.08*br})`; ctx.fillRect(px,py+TILE-3,TILE,3);}
      if(isWall(x-1,y)){ctx.fillStyle=`rgba(0,0,0,${0.08*br})`; ctx.fillRect(px,py,3,TILE);}
      if(isWall(x+1,y)){ctx.fillStyle=`rgba(0,0,0,${0.08*br})`; ctx.fillRect(px+TILE-3,py,3,TILE);}
    } else if(t===TILE_STAIRS){
      ctx.fillStyle=hexD(C.stairs, br);
      ctx.fillRect(px, py, TILE, TILE);
      // Stair lines
      ctx.strokeStyle=hexDA('#C6A700', br, 0.5);
      ctx.lineWidth=2;
      for(let sy=0;sy<3;sy++){
        const yy=py+5+sy*8;
        ctx.beginPath(); ctx.moveTo(px+3,yy); ctx.lineTo(px+TILE-3,yy); ctx.stroke();
      }
      // Glow
      const ga=0.12+Math.sin(flickerTime*4)*0.06;
      ctx.fillStyle=`rgba(255,179,0,${ga})`;
      ctx.beginPath(); ctx.arc(px+TILE/2,py+TILE/2,TILE,0,Math.PI*2); ctx.fill();
    }
  }

  // Torch radial glow
  const grad=ctx.createRadialGradient(pcx,pcy,0,pcx,pcy,lr*0.6);
  grad.addColorStop(0,'rgba(255,170,50,0.08)');
  grad.addColorStop(1,'rgba(255,170,50,0)');
  ctx.fillStyle=grad;
  ctx.fillRect(pcx-lr,pcy-lr,lr*2,lr*2);

  // ── ITEMS ──
  for(const it of items){
    if(!visibleSet.has(it.y*mapW+it.x))continue;
    const px=it.x*TILE+TILE/2, py=it.y*TILE+TILE/2;
    const bob=Math.sin(performance.now()*0.003+it.x*2)*2;
    const dist=Math.sqrt((px-pcx)**2+(py-pcy)**2);
    const br=Math.max(0.3,1-dist/lr);
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(px,py+8,5,2,0,0,Math.PI*2); ctx.fill();
    if(it.type==='gold'){
      ctx.fillStyle=hexD(C.gold,br);
      ctx.beginPath(); ctx.arc(px,py+bob,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,255,255,${0.4*br})`;
      ctx.beginPath(); ctx.arc(px-1,py+bob-2,2,0,Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle=hexD(it.color,br);
      ctx.beginPath(); ctx.arc(px,py+bob,7,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=`rgba(255,255,255,${0.3*br})`;
      ctx.beginPath(); ctx.arc(px-2,py+bob-2,3,0,Math.PI*2); ctx.fill();
      // Item icon
      ctx.fillStyle='#fff'; ctx.font='800 10px Nunito'; ctx.textAlign='center';
      const icons={potion:'♥',sword:'⚔',shield:'🛡',torch:'🔥'};
      ctx.fillText(icons[it.type]||'?', px, py+bob+4);
    }
  }

  // ── ENEMIES ──
  for(const e of enemies){
    if(e.hp<=0||!visibleSet.has(e.y*mapW+e.x))continue;
    const px=e.x*TILE+TILE/2, py=e.y*TILE+TILE/2;
    const dist=Math.sqrt((px-pcx)**2+(py-pcy)**2);
    const br=Math.max(0.35,1-dist/lr);
    const col=hexD(e.color,br);
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(px,py+11,8,3,0,0,Math.PI*2); ctx.fill();

    if(e.type==='slime'){
      const sq=Math.sin(performance.now()*0.005)*2;
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.ellipse(px,py+2-sq,11+sq,9-sq,0,0,Math.PI*2); ctx.fill();
      // Highlight
      ctx.fillStyle=`rgba(255,255,255,${0.25*br})`;
      ctx.beginPath(); ctx.ellipse(px-3,py-3-sq,4,3,0,0,Math.PI*2); ctx.fill();
      // Eyes
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(px-4,py-1,3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+4,py-1,3,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#1B5E20';
      ctx.beginPath(); ctx.arc(px-4,py-1,1.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+4,py-1,1.5,0,Math.PI*2); ctx.fill();
      // Mouth
      ctx.strokeStyle=hexDA('#1B5E20',br,0.5); ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(px,py+3,4,0.1*Math.PI,0.9*Math.PI); ctx.stroke();
    } else if(e.type==='bat'){
      const wf=Math.sin(performance.now()*0.015)*5;
      ctx.fillStyle=col;
      // Wings
      ctx.beginPath(); ctx.moveTo(px,py); ctx.quadraticCurveTo(px-12,py-8+wf,px-16,py+2+wf); ctx.quadraticCurveTo(px-8,py+4,px,py); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px,py); ctx.quadraticCurveTo(px+12,py-8+wf,px+16,py+2+wf); ctx.quadraticCurveTo(px+8,py+4,px,py); ctx.fill();
      // Body
      ctx.beginPath(); ctx.arc(px,py,6,0,Math.PI*2); ctx.fill();
      // Ears
      ctx.beginPath(); ctx.moveTo(px-4,py-5); ctx.lineTo(px-6,py-11); ctx.lineTo(px-1,py-5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px+4,py-5); ctx.lineTo(px+6,py-11); ctx.lineTo(px+1,py-5); ctx.fill();
      // Eyes
      ctx.fillStyle='#FFEB3B';
      ctx.beginPath(); ctx.arc(px-2,py-2,2.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+2,py-2,2.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#000';
      ctx.beginPath(); ctx.arc(px-2,py-2,1,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+2,py-2,1,0,Math.PI*2); ctx.fill();
    } else if(e.type==='skeleton'){
      ctx.fillStyle=col;
      // Skull
      ctx.beginPath(); ctx.arc(px,py-5,8,0,Math.PI*2); ctx.fill();
      // Jaw
      ctx.beginPath(); ctx.arc(px,py-1,5,0,Math.PI); ctx.fill();
      // Body (ribcage)
      ctx.fillRect(px-4,py+3,8,10);
      ctx.fillStyle=hexDA('#3E2723',br,0.4);
      for(let i=0;i<3;i++){ctx.fillRect(px-3,py+4+i*3,6,1);}
      // Eye sockets
      ctx.fillStyle='#000';
      ctx.beginPath(); ctx.arc(px-3,py-6,2.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+3,py-6,2.5,0,Math.PI*2); ctx.fill();
      // Eye glow
      ctx.fillStyle=hexDA('#E53935',br,0.9);
      ctx.beginPath(); ctx.arc(px-3,py-6,1.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+3,py-6,1.5,0,Math.PI*2); ctx.fill();
    } else if(e.type==='boss'){
      const pulse=Math.sin(performance.now()*0.003);
      // Aura
      ctx.fillStyle=hexDA(C.boss,br,0.1+pulse*0.05);
      ctx.beginPath(); ctx.arc(px,py,22,0,Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.arc(px,py,14,0,Math.PI*2); ctx.fill();
      // Horns
      ctx.fillStyle=hexD('#5D4037',br);
      ctx.beginPath(); ctx.moveTo(px-9,py-10); ctx.lineTo(px-14,py-24); ctx.lineTo(px-5,py-10); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px+9,py-10); ctx.lineTo(px+14,py-24); ctx.lineTo(px+5,py-10); ctx.closePath(); ctx.fill();
      // Face
      ctx.fillStyle='#FFD54F';
      ctx.beginPath(); ctx.arc(px-5,py-3,4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+5,py-3,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#000';
      ctx.beginPath(); ctx.arc(px-5,py-3,2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px+5,py-3,2,0,Math.PI*2); ctx.fill();
      // Angry mouth
      ctx.strokeStyle=hexDA('#8B0000',br,0.8); ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(px-6,py+6); ctx.lineTo(px-3,py+9); ctx.lineTo(px+3,py+9); ctx.lineTo(px+6,py+6); ctx.stroke();
    }

    // HP bar
    if(e.hp<e.maxHp){
      const bw=24,bh=4,bx=px-bw/2,by=py-22;
      ctx.fillStyle='#3E2723'; ctx.fillRect(bx-1,by-1,bw+2,bh+2);
      ctx.fillStyle='#1B0000'; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle='#E53935'; ctx.fillRect(bx,by,bw*(e.hp/e.maxHp),bh);
    }
  }

  // ── PLAYER — WARRIOR CHARACTER ──
  const ppx=player.px+TILE/2, ppy=player.py+TILE/2;
  const pFlash=playerDamageFlash>0&&playerDamageFlash%2===0;

  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(ppx,ppy+13,10,4,0,0,Math.PI*2); ctx.fill();

  // Torch glow
  ctx.fillStyle='rgba(255,170,50,0.05)';
  ctx.beginPath(); ctx.arc(ppx,ppy,22,0,Math.PI*2); ctx.fill();

  // Legs (brown boots)
  ctx.fillStyle=pFlash?'#C62828':'#5D4037';
  ctx.fillRect(ppx-6,ppy+6,4,7);
  ctx.fillRect(ppx+2,ppy+6,4,7);

  // Body (armor)
  ctx.fillStyle=pFlash?'#E53935':C.playerArmor;
  ctx.beginPath(); ctx.arc(ppx,ppy,9,0,Math.PI*2); ctx.fill();
  // Armor highlight
  ctx.fillStyle=`rgba(255,255,255,0.15)`;
  ctx.beginPath(); ctx.arc(ppx-2,ppy-3,5,0,Math.PI*2); ctx.fill();
  // Belt
  ctx.fillStyle='#4E342E'; ctx.fillRect(ppx-8,ppy+3,16,3);
  // Belt buckle
  ctx.fillStyle='#FFD54F'; ctx.fillRect(ppx-2,ppy+3,4,3);

  // Sword (right side, points in direction)
  ctx.save();
  ctx.translate(ppx+player.dirX*4, ppy+player.dirY*4);
  const swordAngle = Math.atan2(player.dirY, player.dirX) - Math.PI/4;
  ctx.rotate(swordAngle);
  // Blade
  ctx.fillStyle=C.playerSword;
  ctx.fillRect(4,-1,12,3);
  // Tip
  ctx.beginPath(); ctx.moveTo(16,-2); ctx.lineTo(20,0.5); ctx.lineTo(16,3); ctx.fill();
  // Guard
  ctx.fillStyle='#FFD54F';
  ctx.fillRect(2,-3,3,7);
  // Handle
  ctx.fillStyle='#5D4037';
  ctx.fillRect(-1,-1,4,3);
  ctx.restore();

  // Head
  ctx.fillStyle=pFlash?'#E53935':C.playerSkin;
  ctx.beginPath(); ctx.arc(ppx,ppy-7,7,0,Math.PI*2); ctx.fill();

  // Helmet
  ctx.fillStyle=pFlash?'#C62828':C.playerHelmet;
  ctx.beginPath();
  ctx.arc(ppx,ppy-8,8,Math.PI,0); // top half
  ctx.fill();
  // Helmet visor line
  ctx.fillStyle=hexDA('#455A64',1,0.6);
  ctx.fillRect(ppx-7,ppy-8,14,2);
  // Helmet crest
  ctx.fillStyle='#E53935';
  ctx.beginPath(); ctx.moveTo(ppx-2,ppy-16); ctx.lineTo(ppx,ppy-19); ctx.lineTo(ppx+2,ppy-16); ctx.closePath(); ctx.fill();
  ctx.fillRect(ppx-1,ppy-16,2,5);

  // Eyes (below helmet visor)
  const edx=player.dirX*1.5, edy=player.dirY*1.5;
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.arc(ppx-3+edx,ppy-5+edy,2.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(ppx+3+edx,ppy-5+edy,2.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1B5E20';
  ctx.beginPath(); ctx.arc(ppx-3+edx*1.3,ppy-5+edy*1.3,1.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(ppx+3+edx*1.3,ppy-5+edy*1.3,1.3,0,Math.PI*2); ctx.fill();

  // Shield (left side)
  ctx.fillStyle='#5D4037';
  ctx.beginPath();
  ctx.moveTo(ppx-10,ppy-4); ctx.lineTo(ppx-6,ppy-8); ctx.lineTo(ppx-2,ppy-4);
  ctx.lineTo(ppx-2,ppy+2); ctx.lineTo(ppx-6,ppy+6); ctx.lineTo(ppx-10,ppy+2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#8D6E63';
  ctx.beginPath();
  ctx.moveTo(ppx-9,ppy-3); ctx.lineTo(ppx-6,ppy-7); ctx.lineTo(ppx-3,ppy-3);
  ctx.lineTo(ppx-3,ppy+1); ctx.lineTo(ppx-6,ppy+5); ctx.lineTo(ppx-9,ppy+1);
  ctx.closePath(); ctx.fill();
  // Shield emblem
  ctx.fillStyle='#FFD54F';
  ctx.beginPath(); ctx.arc(ppx-6,ppy-1,2,0,Math.PI*2); ctx.fill();

  // ── PARTICLES ──
  for(const p of particles){
    ctx.globalAlpha=p.life; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  // Floating text
  ctx.font='800 13px Nunito'; ctx.textAlign='center';
  for(const ft of floatingTexts){
    ctx.globalAlpha=ft.life;
    ctx.strokeStyle='#3E2723'; ctx.lineWidth=3;
    ctx.strokeText(ft.text,ft.x,ft.y);
    ctx.fillStyle=ft.color; ctx.fillText(ft.text,ft.x,ft.y);
  }
  ctx.globalAlpha=1;

  ctx.restore();

  drawHUD();
  drawMinimap();
}

function drawHUD(){
  const W=canvas.width;
  ctx.font='800 13px Nunito';
  const bx=14,by=14,bw=130,bh=14;
  // HP bar border
  ctx.fillStyle='#5D4037';
  rrect(bx-2,by-2,bw+4,bh+4,6);
  ctx.fillStyle='#3E2723'; rrect(bx,by,bw,bh,4);
  const hr=Math.max(0,player.hp/player.maxHp);
  ctx.fillStyle=hr>0.5?'#4CAF50':hr>0.25?'#FFB300':'#E53935';
  if(hr>0) rrect(bx,by,bw*hr,bh,4);
  ctx.fillStyle='rgba(255,255,255,0.2)';
  if(hr>0) rrect(bx+2,by+1,Math.max(0,bw*hr-4),4,2);
  ctx.fillStyle='#fff'; ctx.textAlign='left';
  ctx.strokeStyle='#3E2723'; ctx.lineWidth=2;
  ctx.strokeText(`HP ${player.hp}/${player.maxHp}`,bx+6,by+12);
  ctx.fillText(`HP ${player.hp}/${player.maxHp}`,bx+6,by+12);
  ctx.font='800 14px Nunito'; ctx.fillStyle='#F5E6D0';
  ctx.strokeText(`ATK:${player.atk}  DEF:${player.def}`,bx,by+bh+18);
  ctx.fillText(`ATK:${player.atk}  DEF:${player.def}`,bx,by+bh+18);
  ctx.font='800 18px Nunito'; ctx.textAlign='center';
  ctx.fillStyle='#FFD54F'; ctx.strokeStyle='#5D4037'; ctx.lineWidth=3;
  ctx.strokeText(`ANDAR ${floor}`,W/2,28); ctx.fillText(`ANDAR ${floor}`,W/2,28);
  ctx.font='800 15px Nunito'; ctx.textAlign='right';
  ctx.fillStyle='#F5E6D0'; ctx.strokeStyle='#3E2723'; ctx.lineWidth=2;
  ctx.strokeText(`${score} pts`,W-14,28); ctx.fillText(`${score} pts`,W-14,28);
}

function rrect(x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); ctx.fill();
}

function drawMinimap(){
  const W=canvas.width,H=canvas.height,ms=2,mw=mapW*ms,mh=mapH*ms;
  if(mw>150||mh>150)return;
  const mx=W-mw-14,my=H-mh-14;
  ctx.fillStyle='#5D4037'; rrect(mx-4,my-4,mw+8,mh+8,4);
  ctx.fillStyle='rgba(30,20,15,0.85)'; rrect(mx-2,my-2,mw+4,mh+4,3);
  for(let y=0;y<mapH;y++) for(let x=0;x<mapW;x++){
    const idx=y*mapW+x;
    if(!explored[idx]||tiles[idx]===TILE_WALL)continue;
    ctx.fillStyle=tiles[idx]===TILE_STAIRS?'#FFD54F':'rgba(184,168,140,0.7)';
    ctx.fillRect(mx+x*ms,my+y*ms,ms,ms);
  }
  ctx.fillStyle='#4CAF50'; ctx.fillRect(mx+player.x*ms-1,my+player.y*ms-1,ms+2,ms+2);
  for(const e of enemies){
    if(e.hp<=0||!explored[e.y*mapW+e.x])continue;
    ctx.fillStyle=e.color; ctx.globalAlpha=0.8;
    ctx.fillRect(mx+e.x*ms,my+e.y*ms,ms,ms); ctx.globalAlpha=1;
  }
}

function updateHUD(){DOM.scoreDisplay.textContent=`Andar ${floor}`;DOM.bestDisplay.textContent=bestScore;}

// ── Movement ──
function tryMove(dx,dy){
  if(!gameRunning||animating)return;
  player.dirX=dx; player.dirY=dy;
  const nx=player.x+dx, ny=player.y+dy;
  if(nx<0||nx>=mapW||ny<0||ny>=mapH)return;
  if(tiles[ny*mapW+nx]===TILE_WALL)return;
  const hit=enemies.find(e=>e.hp>0&&e.x===nx&&e.y===ny);
  if(hit){attackEnemy(hit);moveEnemies();return;}
  player.x=nx; player.y=ny;
  player.moveT=0; player.fromPX=player.px; player.fromPY=player.py;
  player.toPX=nx*TILE; player.toPY=ny*TILE; animating=true;
  pickupItems();
  if(tiles[ny*mapW+nx]===TILE_STAIRS){nextFloor();return;}
  moveEnemies(); updateHUD();
}

function attackEnemy(e){
  const d=Math.max(1,player.atk-(e.def||0)); e.hp-=d;
  spawnFT(e.x*TILE+TILE/2,e.y*TILE,`-${d}`,'#E53935');
  if(e.hp<=0){score+=e.score;kills++;spawnDP(e.x*TILE+TILE/2,e.y*TILE+TILE/2,e.color);spawnFT(e.x*TILE+TILE/2,e.y*TILE-10,`+${e.score}`,'#FFD54F');}
  updateHUD();
}
function attackPlayer(e){
  const d=Math.max(1,e.atk-player.def); player.hp-=d;
  spawnFT(player.px+TILE/2,player.py,`-${d}`,'#E53935'); playerDamageFlash=8;
  if(player.hp<=0)gameOver(); updateHUD();
}
function tryAttackAdjacent(){
  if(!gameRunning||animating)return;
  let t=enemies.find(e=>e.hp>0&&e.x===player.x+player.dirX&&e.y===player.y+player.dirY);
  if(t){attackEnemy(t);moveEnemies();return;}
  for(const[dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
    const a=enemies.find(e=>e.hp>0&&e.x===player.x+dx&&e.y===player.y+dy);
    if(a){player.dirX=dx;player.dirY=dy;attackEnemy(a);moveEnemies();return;}
  }
}

function moveEnemies(){
  for(const e of enemies){
    if(e.hp<=0||Math.random()>e.speed)continue;
    const dist=Math.abs(e.x-player.x)+Math.abs(e.y-player.y);
    let mx=0,my=0;
    if(e.type==='slime'){const d=[[0,-1],[0,1],[-1,0],[1,0]][Math.floor(Math.random()*4)];mx=d[0];my=d[1];}
    else{const rng=e.type==='bat'?lightRadius+2:lightRadius+3;
      if(dist<=rng){mx=Math.sign(player.x-e.x);my=Math.sign(player.y-e.y);if(Math.random()<0.5)mx=0;else my=0;}
      else{const d=[[0,-1],[0,1],[-1,0],[1,0]][Math.floor(Math.random()*4)];mx=d[0];my=d[1];}}
    const nx=e.x+mx,ny=e.y+my;
    if(nx<0||nx>=mapW||ny<0||ny>=mapH||tiles[ny*mapW+nx]===TILE_WALL)continue;
    if(nx===player.x&&ny===player.y){attackPlayer(e);continue;}
    if(enemies.some(o=>o!==e&&o.hp>0&&o.x===nx&&o.y===ny))continue;
    e.x=nx;e.y=ny;
  }
}

function pickupItems(){
  for(let i=items.length-1;i>=0;i--){
    const it=items[i]; if(it.x!==player.x||it.y!==player.y)continue;
    switch(it.effect){
      case'hp':player.hp=Math.min(player.maxHp,player.hp+3);spawnFT(player.px+TILE/2,player.py,'+3 HP','#E53935');break;
      case'atk':player.atk++;spawnFT(player.px+TILE/2,player.py,'+1 ATK','#42A5F5');break;
      case'def':player.def++;spawnFT(player.px+TILE/2,player.py,'+1 DEF','#FFD54F');break;
      case'light':lightRadius++;spawnFT(player.px+TILE/2,player.py,'+1 LUZ','#FF8F00');break;
      case'score':score+=5;spawnFT(player.px+TILE/2,player.py,'+5','#FFD54F');break;
    }
    spawnSP(it.x*TILE+TILE/2,it.y*TILE+TILE/2,it.color); items.splice(i,1);
  }
}

function nextFloor(){
  floor++;score+=100;
  spawnFT(player.px+TILE/2,player.py-20,'+100 ANDAR!','#FFD54F');
  generateFloor(); updateHUD();
}
function gameOver(){
  gameRunning=false; const fs=score+floor*50; score=fs;
  if(fs>bestScore){bestScore=fs;localStorage.setItem('dungeon_best',bestScore.toString());}
  try{onGameEnd('dungeon',{won:false,score:fs});}catch(e){}
  DOM.bestDisplay.textContent=bestScore; showOverlay('gameover');
}

function spawnDP(x,y,color){for(let i=0;i<12;i++){const a=Math.random()*Math.PI*2,s=1+Math.random()*3;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,color,size:2+Math.random()*3});}}
function spawnSP(x,y,color){for(let i=0;i<8;i++){const a=Math.random()*Math.PI*2,s=0.5+Math.random()*2;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,color,size:1.5+Math.random()*2});}}
function spawnFT(x,y,text,color){floatingTexts.push({x,y,text,color,life:1,vy:-1.5});}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.life-=dt*2;if(p.life<=0)particles.splice(i,1);}
  for(let i=floatingTexts.length-1;i>=0;i--){const f=floatingTexts[i];f.y+=f.vy;f.life-=dt*1.5;if(f.life<=0)floatingTexts.splice(i,1);}
}

// ── Controls ──
function setupControls(){
  window.addEventListener('keydown',e=>{if(!gameRunning)return;
    switch(e.key){
      case'w':case'W':case'ArrowUp':tryMove(0,-1);e.preventDefault();break;
      case's':case'S':case'ArrowDown':tryMove(0,1);e.preventDefault();break;
      case'a':case'A':case'ArrowLeft':tryMove(-1,0);e.preventDefault();break;
      case'd':case'D':case'ArrowRight':tryMove(1,0);e.preventDefault();break;
      case' ':case'e':case'E':tryAttackAdjacent();e.preventDefault();break;}});
  document.addEventListener('pointerdown',e=>{
    if(!gameRunning||animating)return;
    const r=canvas.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
    const sc=getScale(),cx=canvas.width/2-(player.px+TILE/2)*sc,cy=canvas.height/2-(player.py+TILE/2)*sc;
    const wx=(e.clientX-r.left-cx)/sc,wy=(e.clientY-r.top-cy)/sc;
    const tx=Math.floor(wx/TILE),ty=Math.floor(wy/TILE),dx=tx-player.x,dy=ty-player.y;
    if(Math.abs(dx)+Math.abs(dy)===1){player.dirX=dx;player.dirY=dy;
      const t=enemies.find(en=>en.hp>0&&en.x===tx&&en.y===ty);
      if(t){attackEnemy(t);moveEnemies();updateHUD();}else tryMove(dx,dy);}});
  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn=>{
    const h=e=>{e.preventDefault();e.stopPropagation();
      switch(btn.dataset.dir){case'up':tryMove(0,-1);break;case'down':tryMove(0,1);break;case'left':tryMove(-1,0);break;case'right':tryMove(1,0);break;}};
    btn.addEventListener('touchstart',h,{passive:false}); btn.addEventListener('mousedown',h);});
  const ab=document.getElementById('btn-attack');
  if(ab){ab.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();tryAttackAdjacent();},{passive:false});
    ab.addEventListener('mousedown',e=>{e.stopPropagation();tryAttackAdjacent();});}
}

function shareResult(){
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`⚔️ Dungeon Crawler: Andar ${floor}! ${kills} monstros, ${score} pts!\nJogue: https://gameshub.com.br/games/dungeon/`)}`,'_blank');
}

let lastTime=0;
function gameLoop(now){
  requestAnimationFrame(gameLoop);
  const dt=Math.min(0.05,(now-lastTime)/1000); lastTime=now;
  if(!gameRunning){if(canvas&&ctx&&player)render();return;}
  flickerTime+=dt;
  if(player.moveT<1){
    player.moveT=Math.min(1,player.moveT+dt*8);
    const t=1-(1-player.moveT)*(1-player.moveT);
    player.px=player.fromPX+(player.toPX-player.fromPX)*t;
    player.py=player.fromPY+(player.toPY-player.fromPY)*t;
    if(player.moveT>=1){player.px=player.toPX;player.py=player.toPY;animating=false;}
  }
  if(isNaN(player.px))player.px=player.x*TILE;
  if(isNaN(player.py))player.py=player.y*TILE;
  if(playerDamageFlash>0)playerDamageFlash--;
  updateParticles(dt); render();
}

document.addEventListener('DOMContentLoaded',boot);
