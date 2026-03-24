(function(){
'use strict';

// ============================================================
// CONFIG
// ============================================================
const T = 40; // tile size in pixels (larger = more detail)
const WALL_DEPTH = 14; // pseudo-3D wall face height

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

// ============================================================
// DUNGEON GENERATION (same as before)
// ============================================================
function randInt(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=randInt(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
class DungeonMap{
    constructor(w,h){this.width=w;this.height=h;this.tiles=new Uint8Array(w*h).fill(1);
    this.rooms=[];this.enemySpawns=[];this.chestPositions=[];
    this.torchPositions=[];this.spawnPoint={x:0,y:0};this.stairsDown={x:0,y:0};}
    get(x,y){return(x<0||x>=this.width||y<0||y>=this.height)?1:this.tiles[y*this.width+x];}
    set(x,y,v){if(x>=0&&x<this.width&&y>=0&&y<this.height)this.tiles[y*this.width+x]=v;}
    isWalkable(x,y){const t=this.get(x,y);return t===0||t===2||t===3;}
}
function carveRoom(m,x,y,w,h){for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)m.set(x+dx,y+dy,0);return{x,y,w,h,cx:Math.floor(x+w/2),cy:Math.floor(y+h/2)};}
function carveCorridor(m,x1,y1,x2,y2){let x=x1,y=y1;if(Math.random()>0.5){while(x!==x2){m.set(x,y,0);if(Math.random()>0.6)m.set(x,y+1,0);x+=x<x2?1:-1;}while(y!==y2){m.set(x,y,0);if(Math.random()>0.6)m.set(x+1,y,0);y+=y<y2?1:-1;}}else{while(y!==y2){m.set(x,y,0);if(Math.random()>0.6)m.set(x+1,y,0);y+=y<y2?1:-1;}while(x!==x2){m.set(x,y,0);if(Math.random()>0.6)m.set(x,y+1,0);x+=x<x2?1:-1;}}m.set(x2,y2,0);}

function generateDungeon(){
    const size=50;const m=new DungeonMap(size,size);const cx=25,cy=25;
    const hubW=randInt(7,9),hubH=randInt(6,8);
    const hub=carveRoom(m,cx-Math.floor(hubW/2),cy-Math.floor(hubH/2),hubW,hubH);
    m.rooms.push(hub);m.spawnPoint.x=hub.cx;m.spawnPoint.y=hub.cy;
    const numR=randInt(5,7);const outer=[];
    for(let i=0;i<numR;i++){const a=(i/numR)*Math.PI*2+(Math.random()-0.5)*0.4;const d=randInt(10,15);
    const rw=randInt(5,8),rh=randInt(4,7);
    const rx=Math.max(2,Math.min(size-rw-2,Math.floor(cx+Math.cos(a)*d-rw/2)));
    const ry=Math.max(2,Math.min(size-rh-2,Math.floor(cy+Math.sin(a)*d-rh/2)));
    const room=carveRoom(m,rx,ry,rw,rh);m.rooms.push(room);outer.push(room);
    carveCorridor(m,hub.cx,hub.cy,room.cx,room.cy);}
    if(outer.length>=3){for(let i=0;i<2;i++){const a=outer[randInt(0,outer.length-1)],b=outer[randInt(0,outer.length-1)];if(a!==b)carveCorridor(m,a.cx,a.cy,b.cx,b.cy);}}
    let far=outer[0],maxD=0;for(const r of outer){const d=Math.abs(r.cx-hub.cx)+Math.abs(r.cy-hub.cy);if(d>maxD){maxD=d;far=r;}}
    m.stairsDown.x=far.cx;m.stairsDown.y=far.cy;m.set(far.cx,far.cy,3);
    const chR=shuffle(outer.filter(r=>r!==far)).slice(0,randInt(2,3));
    for(const r of chR)m.chestPositions.push({x:randInt(r.x+1,r.x+r.w-2),y:randInt(r.y+1,r.y+r.h-2),opened:false});
    for(const room of m.rooms){for(const s of[{x:room.x,y:room.y},{x:room.x+room.w-1,y:room.y},{x:room.x,y:room.y+room.h-1},{x:room.x+room.w-1,y:room.y+room.h-1}]){if(m.get(s.x,s.y-1)===1&&m.get(s.x,s.y)===0)m.torchPositions.push({x:s.x,y:s.y,flicker:Math.random()*100});}}
    for(const room of outer){const num=room===far?1:randInt(2,4);for(let i=0;i<num;i++){const ex=randInt(room.x+1,room.x+room.w-2),ey=randInt(room.y+1,room.y+room.h-2);if(m.get(ex,ey)===0&&!(ex===m.stairsDown.x&&ey===m.stairsDown.y))m.enemySpawns.push({x:ex,y:ey});}}
    return m;
}

// ============================================================
// FOG OF WAR
// ============================================================
// 0 = never seen (total black), 1 = explored (dark overlay), 2 = currently visible
const FOG_RADIUS = 7; // tiles of full visibility around player
const FOG_FADE = 3;   // extra tiles of gradual fade
let fogMap; // Uint8Array, same size as dungeon

function initFog(dmap) {
    fogMap = new Uint8Array(dmap.width * dmap.height); // all 0 = unseen
}

function updateFog(px, py) {
    const totalR = FOG_RADIUS + FOG_FADE;
    // Reset current visibility to explored (1) — keep explored status
    for (let i = 0; i < fogMap.length; i++) {
        if (fogMap[i] === 2) fogMap[i] = 1;
    }
    // Reveal tiles around player using line-of-sight
    const cx = Math.floor(px), cy = Math.floor(py);
    for (let dy = -totalR; dy <= totalR; dy++) {
        for (let dx = -totalR; dx <= totalR; dx++) {
            const tx = cx + dx, ty = cy + dy;
            if (tx < 0 || ty < 0 || tx >= dmap.width || ty >= dmap.height) continue;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > totalR) continue;
            // Simple line-of-sight: cast ray from player to tile
            if (hasLineOfSight(px, py, tx + 0.5, ty + 0.5)) {
                const idx = ty * dmap.width + tx;
                if (dist <= FOG_RADIUS) {
                    fogMap[idx] = 2; // fully visible
                } else if (fogMap[idx] < 2) {
                    fogMap[idx] = Math.max(fogMap[idx], 1); // explored
                }
            }
        }
    }
}

function hasLineOfSight(x0, y0, x1, y1) {
    const ddx = x1 - x0, ddy = y1 - y0;
    const steps = Math.ceil(Math.max(Math.abs(ddx), Math.abs(ddy)) * 2);
    if (steps === 0) return true;
    const sx = ddx / steps, sy = ddy / steps;
    let cx = x0, cy = y0;
    for (let i = 0; i < steps; i++) {
        cx += sx; cy += sy;
        const tx = Math.floor(cx), ty = Math.floor(cy);
        if (dmap.get(tx, ty) === 1) {
            // Wall blocks sight, but reveal the wall tile itself
            const idx = ty * dmap.width + tx;
            fogMap[idx] = Math.max(fogMap[idx], 1);
            return false;
        }
    }
    return true;
}

function getFogLevel(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= dmap.width || ty >= dmap.height) return 0;
    return fogMap[ty * dmap.width + tx];
}

// ============================================================
// TILE CACHE — pre-rendered floor tiles
// ============================================================
function makeTileCache(){
    const cache={};
    for(let v=0;v<4;v++){
        const oc=document.createElement('canvas');oc.width=T;oc.height=T;
        const c=oc.getContext('2d');
        const br=52+v*5,bg=52+v*4,bb=68+v*6;
        c.fillStyle=`rgb(${br},${bg},${bb})`;c.fillRect(0,0,T,T);
        // Stone grout lines
        c.strokeStyle='rgba(0,0,0,0.18)';c.lineWidth=1;
        if(v<2){c.strokeRect(1,1,T/2-1,T/2-1);c.strokeRect(T/2,1,T/2-1,T/2-1);c.strokeRect(1,T/2,T/2-1,T/2-1);c.strokeRect(T/2,T/2,T/2-1,T/2-1);}
        else{c.strokeRect(1,1,T-2,T/2-1);c.strokeRect(1,T/2,T/2-1,T/2-1);c.strokeRect(T/2,T/2,T/2-1,T/2-1);}
        // Noise
        for(let i=0;i<20;i++){c.fillStyle=Math.random()>0.5?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.06)';c.fillRect(Math.random()*T|0,Math.random()*T|0,1+Math.random()*2|0,1+Math.random()*2|0);}
        // Subtle cracks
        c.strokeStyle='rgba(0,0,0,0.1)';c.lineWidth=0.5;c.beginPath();c.moveTo(T*0.3,T*0.2);c.lineTo(T*0.5,T*0.7);c.stroke();
        cache['floor_'+v]=oc;
    }
    // Stairs
    {const oc=document.createElement('canvas');oc.width=T;oc.height=T;const c=oc.getContext('2d');
    c.fillStyle='#3a4a6a';c.fillRect(0,0,T,T);
    for(let i=0;i<5;i++){const shade=60-i*8;c.fillStyle=`rgb(${shade+30},${shade+40},${shade+70})`;c.fillRect(3+i*2,3+i*(T/5-1),T-6-i*4,T/5-1);}
    c.fillStyle='rgba(100,160,255,0.15)';c.fillRect(0,0,T,T);cache.stairs=oc;}
    // Wall top
    {const oc=document.createElement('canvas');oc.width=T;oc.height=T;const c=oc.getContext('2d');
    c.fillStyle='#2e2e42';c.fillRect(0,0,T,T);
    // Brick pattern
    for(let row=0;row<Math.ceil(T/10);row++){const y=row*10;const off=row%2===0?0:T/2;
    c.strokeStyle='rgba(0,0,0,0.25)';c.lineWidth=0.5;
    c.strokeRect(off,y,T/2,10);c.strokeRect(off+T/2,y,T/2,10);if(off>0)c.strokeRect(off-T,y,T/2,10);}
    for(let i=0;i<15;i++){c.fillStyle=Math.random()>0.6?'rgba(60,90,60,0.06)':'rgba(0,0,0,0.04)';c.fillRect(Math.random()*T|0,Math.random()*T|0,2,2);}
    cache.wallTop=oc;}
    return cache;
}
const tileCache=makeTileCache();

// ============================================================
// GAME STATE
// ============================================================
const dmap=generateDungeon();
initFog(dmap);

const player={
    x:dmap.spawnPoint.x,y:dmap.spawnPoint.y,
    speed:4.5,
    hp:80,maxHp:80,atk:10,def:3,
    level:1,xp:0,xpToNext:30,gold:0,
    attacking:false,attackTimer:0,attackDuration:0.22,
    attackCooldown:0,attackCooldownTime:0.35,
    attackAngle:0,facingAngle:Math.PI/2,
    invulnerable:false,invulnTimer:0,
    dead:false,deathTimer:0,
    animPhase:0,moving:false,
};

const ENEMY_DEFS={
    rat:{name:'Rato',type:'swarm',hp:12,atk:4,def:1,speed:1.3,aggro:4,xp:3,gold:[2,4],color:'#a08050',bodyH:8,bodyW:10},
    bat:{name:'Morcego',type:'swarm',hp:10,atk:5,def:0,speed:1.4,aggro:4,xp:3,gold:[2,3],color:'#8855aa',bodyH:8,bodyW:12},
    slime:{name:'Slime',type:'tank',hp:36,atk:3,def:4,speed:0.6,aggro:3,xp:5,gold:[3,6],color:'#33dd55',bodyH:14,bodyW:16},
    skeleton:{name:'Esqueleto',type:'normal',hp:20,atk:7,def:2,speed:1.0,aggro:5,xp:5,gold:[3,5],color:'#e0d8c8',bodyH:22,bodyW:12},
    goblin:{name:'Goblin',type:'normal',hp:18,atk:6,def:2,speed:1.0,aggro:5,xp:4,gold:[2,5],color:'#6aa040',bodyH:18,bodyW:12},
    spider:{name:'Aranha',type:'normal',hp:16,atk:5,def:1,speed:1.1,aggro:5,xp:4,gold:[2,4],color:'#5a3535',bodyH:10,bodyW:14},
};
const FLOOR_POOL=['rat','rat','slime','bat','skeleton','goblin','spider'];

const enemies=[];
const particles=[];
const damageNumbers=[];
const goldPickups=[];

for(const sp of dmap.enemySpawns){
    const key=FLOOR_POOL[Math.floor(Math.random()*FLOOR_POOL.length)];
    const d=ENEMY_DEFS[key];
    enemies.push({x:sp.x,y:sp.y,typeKey:key,
        hp:d.hp,maxHp:d.hp,atk:d.atk,def:d.def,
        speed:d.speed*3,aggroRange:d.aggro,
        xpReward:d.xp,goldReward:d.gold,
        state:'patrol',patrolTimer:0,patrolTarget:null,
        contactDamageCD:0,dead:false,deathTimer:0,
        damageFlash:0,archetype:d.type,
        animPhase:Math.random()*100,
        color:d.color,bodyH:d.bodyH,bodyW:d.bodyW,name:d.name,_rewarded:false,
    });
}

// ============================================================
// INPUT
// ============================================================
const keys={};
const mouse={x:canvas.width/2,y:canvas.height/2,clicked:false};
window.addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
canvas.addEventListener('mousedown',e=>{if(e.button===0)mouse.clicked=true;});
canvas.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;});
canvas.addEventListener('touchstart',e=>{mouse.clicked=true;mouse.x=e.touches[0].clientX;mouse.y=e.touches[0].clientY;e.preventDefault();},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());

// ============================================================
// CAMERA
// ============================================================
let camX=0,camY=0;
function updateCamera(dt){
    const tx=player.x*T-canvas.width/2;
    const ty=player.y*T-canvas.height/2;
    camX+=(tx-camX)*6*dt;
    camY+=(ty-camY)*6*dt;
}
function screenToWorld(sx,sy){return{x:(sx+camX)/T,y:(sy+camY)/T};}

// ============================================================
// COLLISION
// ============================================================
function canMove(x,y){
    const m=0.2;
    for(const[cx,cy]of[[x-m,y-m],[x+m,y-m],[x-m,y+m],[x+m,y+m]])
        if(!dmap.isWalkable(Math.floor(cx),Math.floor(cy)))return false;
    return true;
}

// ============================================================
// COMBAT
// ============================================================
function dmgEnemy(e,amount){const red=e.def/(e.def+50);const dmg=Math.max(1,Math.floor(amount*(1-red)*(0.9+Math.random()*0.2)));e.hp-=dmg;e.damageFlash=0.15;e.state='chase';if(e.hp<=0){e.hp=0;e.dead=true;e.deathTimer=0;}return dmg;}
function dmgPlayer(amount){if(player.invulnerable||player.dead)return 0;const red=player.def/(player.def+50);const dmg=Math.max(1,Math.floor(amount*(1-red)*(0.9+Math.random()*0.2)));player.hp-=dmg;player.invulnerable=true;player.invulnTimer=0.5;if(player.hp<=0){player.hp=0;player.dead=true;player.deathTimer=0;}return dmg;}
function addDmg(wx,wy,text,color){damageNumbers.push({wx,wy,text:String(text),color,age:0});}
function addParts(wx,wy,color,count){for(let i=0;i<count;i++)particles.push({wx,wy,vx:(Math.random()-0.5)*3,vy:-1.5-Math.random()*2.5,color,age:0,life:0.4+Math.random()*0.4,size:2+Math.random()*3});}
function spawnGold(wx,wy,amt){goldPickups.push({wx,wy,amount:amt,age:0});}

// ============================================================
// UPDATE
// ============================================================
function update(dt){
    if(player.dead){player.deathTimer+=dt;if(player.deathTimer>2&&keys.Space){player.dead=false;player.hp=player.maxHp;player.x=dmap.spawnPoint.x;player.y=dmap.spawnPoint.y;player.gold=Math.floor(player.gold*0.9);player.invulnerable=true;player.invulnTimer=1;for(const e of enemies){if(e.dead){e.dead=false;e.hp=e.maxHp;e.deathTimer=0;e._rewarded=false;}}}return;}

    // Movement (standard top-down)
    let dx=0,dy=0;
    if(keys.KeyW||keys.ArrowUp)dy=-1;
    if(keys.KeyS||keys.ArrowDown)dy=1;
    if(keys.KeyA||keys.ArrowLeft)dx=-1;
    if(keys.KeyD||keys.ArrowRight)dx=1;
    const len=Math.sqrt(dx*dx+dy*dy);if(len>0){dx/=len;dy/=len;}
    player.moving=len>0;
    const nx=player.x+dx*player.speed*dt;
    const ny=player.y+dy*player.speed*dt;
    if(canMove(nx,player.y))player.x=nx;
    if(canMove(player.x,ny))player.y=ny;
    if(player.moving)player.animPhase+=dt*10;

    // Mouse angle
    const mw=screenToWorld(mouse.x,mouse.y);
    player.facingAngle=Math.atan2(mw.y-player.y,mw.x-player.x);

    // Attack
    if(player.attackCooldown>0)player.attackCooldown-=dt;
    if(player.attacking){player.attackTimer+=dt;if(player.attackTimer>=player.attackDuration){player.attacking=false;player.attackTimer=0;}}
    if(mouse.clicked&&!player.attacking&&player.attackCooldown<=0){
        player.attacking=true;player.attackTimer=0;player.attackCooldown=player.attackCooldownTime;
        player.attackAngle=player.facingAngle;
        const atkR=1.3;const ax=player.x+Math.cos(player.attackAngle)*atkR;const ay=player.y+Math.sin(player.attackAngle)*atkR;
        for(const e of enemies){if(e.dead)continue;const d=Math.sqrt((e.x-ax)**2+(e.y-ay)**2);
            if(d<1.3){const dmg=dmgEnemy(e,player.atk);addDmg(e.x,e.y,dmg,'#fff');addParts(e.x,e.y,'#ffaa44',6);
                const kd=Math.sqrt((e.x-player.x)**2+(e.y-player.y)**2)||1;const kx=(e.x-player.x)/kd*0.5,ky=(e.y-player.y)/kd*0.5;
                if(canMove(e.x+kx,e.y))e.x+=kx;if(canMove(e.x,e.y+ky))e.y+=ky;}}
    }
    mouse.clicked=false;

    if(player.invulnerable){player.invulnTimer-=dt;if(player.invulnTimer<=0)player.invulnerable=false;}

    // Enemies
    for(const e of enemies){
        if(e.dead){e.deathTimer+=dt;if(e.deathTimer>0.1&&!e._rewarded){e._rewarded=true;
            player.xp+=e.xpReward;while(player.xp>=player.xpToNext){player.xp-=player.xpToNext;player.level++;player.xpToNext=30+(player.level-1)*15;player.maxHp+=8;player.hp=player.maxHp;player.atk+=2;player.def+=1;addParts(player.x,player.y,'#ffd700',12);}
            const[minG,maxG]=e.goldReward;spawnGold(e.x,e.y,minG+randInt(0,maxG-minG));addParts(e.x,e.y,e.color,10);}continue;}
        if(e.damageFlash>0)e.damageFlash-=dt;
        if(e.contactDamageCD>0)e.contactDamageCD-=dt;
        e.animPhase+=dt*6;
        const edx=player.x-e.x,edy=player.y-e.y,dist=Math.sqrt(edx*edx+edy*edy);
        if(dist<=e.aggroRange)e.state='chase';else if(e.state==='chase'&&dist>e.aggroRange*2.5)e.state='patrol';
        if(e.state==='chase'&&dist>0.3){let spd=e.speed;if(e.archetype==='normal'&&e.contactDamageCD>0.7)spd=-e.speed*0.5;
            const nx2=e.x+(edx/dist)*spd*dt,ny2=e.y+(edy/dist)*spd*dt;if(canMove(nx2,e.y))e.x=nx2;if(canMove(e.x,ny2))e.y=ny2;}
        else if(e.state==='patrol'){e.patrolTimer-=dt;if(e.patrolTimer<=0||!e.patrolTarget){const a=Math.random()*Math.PI*2,d=2+Math.random()*2;e.patrolTarget={x:e.x+Math.cos(a)*d,y:e.y+Math.sin(a)*d};e.patrolTimer=2+Math.random()*3;}
            const pdx=e.patrolTarget.x-e.x,pdy=e.patrolTarget.y-e.y,pd=Math.sqrt(pdx*pdx+pdy*pdy);if(pd>0.2){const s=e.speed*0.3;const nx2=e.x+(pdx/pd)*s*dt,ny2=e.y+(pdy/pd)*s*dt;if(canMove(nx2,e.y))e.x=nx2;if(canMove(e.x,ny2))e.y=ny2;}}
        if(!player.invulnerable&&!player.dead&&e.contactDamageCD<=0&&dist<0.55){
            const dmg=dmgPlayer(e.atk);addDmg(player.x,player.y,dmg,'#ff4444');addParts(player.x,player.y,'#ff2222',5);
            const kd=dist||1;const kx=(player.x-e.x)/kd*0.6,ky=(player.y-e.y)/kd*0.6;
            if(canMove(player.x+kx,player.y))player.x+=kx;if(canMove(player.x,player.y+ky))player.y+=ky;e.contactDamageCD=1.0;}
    }

    // Chests
    for(const ch of dmap.chestPositions){if(ch.opened)continue;if(Math.abs(player.x-ch.x)<=1.2&&Math.abs(player.y-ch.y)<=1.2){ch.opened=true;const g=player.level*5+randInt(0,player.level*3);spawnGold(ch.x,ch.y,g);addParts(ch.x,ch.y,'#ffd700',12);addDmg(ch.x,ch.y,`+${g}g`,'#ffd700');}}

    // Gold pickup
    for(let i=goldPickups.length-1;i>=0;i--){const g=goldPickups[i];g.age+=dt;const gdx=player.x-g.wx,gdy=player.y-g.wy,gd=Math.sqrt(gdx*gdx+gdy*gdy);
        if(gd<1.5&&gd>0){g.wx+=(gdx/gd)*6*dt;g.wy+=(gdy/gd)*6*dt;if(gd<0.4){player.gold+=g.amount;addDmg(player.x,player.y-0.3,`+${g.amount}g`,'#ffd700');goldPickups.splice(i,1);}}}

    // Damage numbers & particles
    for(let i=damageNumbers.length-1;i>=0;i--){damageNumbers[i].age+=dt;if(damageNumbers[i].age>0.8)damageNumbers.splice(i,1);}
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;p.wx+=p.vx*dt;p.wy+=p.vy*dt*0.3;p.vy+=4*dt;if(p.age>=p.life)particles.splice(i,1);}

    updateCamera(dt);
    updateFog(player.x, player.y);
}

// ============================================================
// RENDER
// ============================================================
function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Visible range
    const startX=Math.max(0,Math.floor(camX/T)-1);
    const startY=Math.max(0,Math.floor(camY/T)-1);
    const endX=Math.min(dmap.width,Math.ceil((camX+canvas.width)/T)+1);
    const endY=Math.min(dmap.height,Math.ceil((camY+canvas.height)/T)+1);

    // ---- PASS 1: Floor tiles (only revealed) ----
    for(let y=startY;y<endY;y++){
        for(let x=startX;x<endX;x++){
            const fog=getFogLevel(x,y);
            if(fog===0)continue; // never seen — total black
            const t=dmap.get(x,y);
            const sx=x*T-camX, sy=y*T-camY;
            if(t===0||t===2){
                const v=(x*7+y*13)%4;
                ctx.drawImage(tileCache['floor_'+v],sx,sy);
            } else if(t===3){
                ctx.drawImage(tileCache.stairs,sx,sy);
                if(fog===2){
                    const pulse=0.12+Math.sin(performance.now()*0.003)*0.08;
                    const grad=ctx.createRadialGradient(sx+T/2,sy+T/2,2,sx+T/2,sy+T/2,T*1.2);
                    grad.addColorStop(0,`rgba(80,140,255,${pulse})`);
                    grad.addColorStop(1,'rgba(80,140,255,0)');
                    ctx.fillStyle=grad;
                    ctx.fillRect(sx-T,sy-T,T*3,T*3);
                }
            }
        }
    }

    // ---- PASS 2: Wall tiles (only revealed) ----
    for(let y=startY;y<endY;y++){
        for(let x=startX;x<endX;x++){
            const fog=getFogLevel(x,y);
            if(fog===0)continue;
            if(dmap.get(x,y)!==1)continue;
            let near=false;
            for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dmap.isWalkable(x+dx,y+dy))near=true;
            if(!near)continue;

            const sx=x*T-camX, sy=y*T-camY;
            const h=(x*31+y*17)%100;
            const br=38+(h%12),bg=38+(h%10),bb=52+(h%14);

            ctx.drawImage(tileCache.wallTop,sx,sy);

            if(dmap.isWalkable(x,y+1)){
                ctx.fillStyle=`rgb(${br+18},${bg+18},${bb+22})`;
                ctx.fillRect(sx,sy+T,T,WALL_DEPTH);
                ctx.fillStyle='rgba(255,255,255,0.06)';
                ctx.fillRect(sx,sy+T,T,1);
                ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=0.5;
                ctx.beginPath();
                ctx.moveTo(sx,sy+T+7);ctx.lineTo(sx+T,sy+T+7);
                ctx.moveTo(sx+T/3,sy+T);ctx.lineTo(sx+T/3,sy+T+7);
                ctx.moveTo(sx+T*2/3,sy+T+7);ctx.lineTo(sx+T*2/3,sy+T+WALL_DEPTH);
                ctx.stroke();
                ctx.fillStyle='rgba(0,0,0,0.2)';
                ctx.fillRect(sx,sy+T+WALL_DEPTH,T,3);
            }
            if(dmap.isWalkable(x+1,y)){
                ctx.fillStyle=`rgb(${br+10},${bg+10},${bb+14})`;
                ctx.fillRect(sx+T,sy,4,T);
            }
        }
    }

    // ---- PASS 3: Torch glow (only in currently visible area) ----
    for(const t of dmap.torchPositions){
        if(getFogLevel(t.x,t.y)<2)continue; // only glow in active vision
        const sx=t.x*T-camX+T/2, sy=t.y*T-camY+T/2;
        if(sx<-100||sx>canvas.width+100||sy<-100||sy>canvas.height+100)continue;
        const time=performance.now()*0.005+t.flicker;
        const flicker=0.7+Math.sin(time)*0.15+Math.sin(time*2.3)*0.1;
        const glowR=T*2+Math.sin(time)*T*0.3;
        const glow=ctx.createRadialGradient(sx,sy,3,sx,sy,glowR);
        glow.addColorStop(0,`rgba(255,170,50,${0.18*flicker})`);
        glow.addColorStop(0.5,`rgba(255,130,30,${0.06*flicker})`);
        glow.addColorStop(1,'rgba(255,100,20,0)');
        ctx.fillStyle=glow;
        ctx.fillRect(sx-glowR,sy-glowR,glowR*2,glowR*2);
    }

    // ---- Collect sorted entities (by Y) — only visible ones ----
    const sortable=[];

    for(const ch of dmap.chestPositions){
        if(getFogLevel(Math.floor(ch.x),Math.floor(ch.y))>=1) // chests visible if explored
            sortable.push({type:'chest',y:ch.y,data:ch,sx:ch.x*T-camX,sy:ch.y*T-camY});
    }
    for(const g of goldPickups){
        if(getFogLevel(Math.floor(g.wx),Math.floor(g.wy))===2)
            sortable.push({type:'gold',y:g.wy,data:g,sx:g.wx*T-camX,sy:g.wy*T-camY});
    }
    for(const e of enemies){
        if(e.dead&&e.deathTimer>0.6)continue;
        if(getFogLevel(Math.floor(e.x),Math.floor(e.y))===2) // enemies only in active vision
            sortable.push({type:'enemy',y:e.y,data:e,sx:e.x*T-camX,sy:e.y*T-camY});
    }
    if(!player.dead||player.deathTimer<1){
        sortable.push({type:'player',y:player.y,sx:player.x*T-camX,sy:player.y*T-camY});
    }

    sortable.sort((a,b)=>a.y-b.y);

    for(const item of sortable){
        switch(item.type){
            case 'chest':renderChest(item.sx,item.sy,item.data);break;
            case 'gold':renderGold(item.sx,item.sy,item.data);break;
            case 'enemy':renderEnemy(item.sx,item.sy,item.data);break;
            case 'player':renderPlayer(item.sx,item.sy);break;
        }
    }

    // ---- Torches flame (only in active vision) ----
    for(const t of dmap.torchPositions){
        if(getFogLevel(t.x,t.y)<2)continue;
        const sx=t.x*T-camX+T/2, sy=t.y*T-camY;
        if(sx<-50||sx>canvas.width+50||sy<-50||sy>canvas.height+50)continue;
        const time=performance.now()*0.005+t.flicker;
        ctx.fillStyle='#665533';ctx.fillRect(sx-2,sy+2,4,10);
        const fh=5+Math.sin(time*1.5)*2;
        const fg=ctx.createRadialGradient(sx,sy,1,sx,sy-2,fh+4);
        const fl=0.7+Math.sin(time)*0.15;
        fg.addColorStop(0,`rgba(255,230,100,${fl})`);
        fg.addColorStop(0.5,`rgba(255,150,40,${fl*0.6})`);
        fg.addColorStop(1,'rgba(255,80,10,0)');
        ctx.fillStyle=fg;
        ctx.beginPath();ctx.ellipse(sx,sy-2,4,fh,0,0,Math.PI*2);ctx.fill();
    }

    // Attack swing
    if(player.attacking)renderSwing();

    // ---- FOG OF WAR OVERLAY ----
    // Draw dark overlay on explored-but-not-visible tiles, black on unseen
    for(let y=startY;y<endY;y++){
        for(let x=startX;x<endX;x++){
            const fog=getFogLevel(x,y);
            const sx=x*T-camX, sy=y*T-camY;
            if(fog===0){
                // Total black
                ctx.fillStyle='#0a0a12';
                ctx.fillRect(sx-1,sy-1,T+2,T+2);
                // Also cover wall extrusion area below
                if(dmap.get(x,y)===1&&dmap.isWalkable(x,y+1))
                    ctx.fillRect(sx-1,sy+T,T+2,WALL_DEPTH+4);
            } else if(fog===1){
                // Explored but not in current view — dark overlay
                ctx.fillStyle='rgba(8,8,16,0.6)';
                ctx.fillRect(sx,sy,T,T);
                if(dmap.get(x,y)===1&&dmap.isWalkable(x,y+1))
                    ctx.fillRect(sx,sy+T,T,WALL_DEPTH+4);
            }
            // fog===2: fully visible, no overlay
        }
    }

    // ---- Smooth fog edge: radial vignette around player ----
    const pcx=player.x*T-camX, pcy=player.y*T-camY;
    const vigR=FOG_RADIUS*T;
    const vigOuter=(FOG_RADIUS+FOG_FADE)*T;
    const vig=ctx.createRadialGradient(pcx,pcy,vigR*0.8,pcx,pcy,vigOuter);
    vig.addColorStop(0,'rgba(8,8,16,0)');
    vig.addColorStop(0.5,'rgba(8,8,16,0)');
    vig.addColorStop(1,'rgba(8,8,16,0.35)');
    ctx.fillStyle=vig;
    ctx.fillRect(pcx-vigOuter,pcy-vigOuter,vigOuter*2,vigOuter*2);

    // Particles
    for(const p of particles){
        const sx=p.wx*T-camX, sy=p.wy*T-camY-8;
        ctx.globalAlpha=1-p.age/p.life;
        ctx.fillStyle=p.color;
        ctx.beginPath();ctx.arc(sx,sy-p.vy*p.age*8,p.size*(1-p.age/p.life),0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;

    // Damage numbers
    for(const dn of damageNumbers){
        const sx=dn.wx*T-camX, sy=dn.wy*T-camY-20-dn.age*60;
        ctx.globalAlpha=1-dn.age/0.8;
        ctx.font='bold 16px monospace';
        ctx.fillStyle='#000';ctx.fillText(dn.text,sx+1,sy+1);
        ctx.fillStyle=dn.color;ctx.fillText(dn.text,sx,sy);
    }
    ctx.globalAlpha=1;

    // HUD
    renderHUD();
    if(player.dead)renderDeath();
}

// ============================================================
// ENTITY RENDERING
// ============================================================
function drawShadow(sx,sy,rx,ry){ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(sx,sy+3,rx,ry,0,0,Math.PI*2);ctx.fill();}

function renderChest(sx,sy,ch){
    drawShadow(sx+T/2,sy+T*0.8,12,5);
    if(ch.opened){
        ctx.fillStyle='#8b6914';ctx.fillRect(sx+T/2-12,sy+T/2-4,24,14);
        ctx.fillStyle='#6b4e0a';ctx.fillRect(sx+T/2-12,sy+T/2-10,24,7);
        ctx.fillStyle='#222';ctx.fillRect(sx+T/2-8,sy+T/2,16,6);
    }else{
        ctx.fillStyle='#8b6914';ctx.fillRect(sx+T/2-12,sy+T/2-6,24,16);
        ctx.fillStyle='#a07818';ctx.fillRect(sx+T/2-12,sy+T/2-10,24,6);
        ctx.fillStyle='#ffd700';ctx.fillRect(sx+T/2-2,sy+T/2-4,5,5);
        ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(sx+T/2-10,sy+T/2-9,20,2);
    }
}

function renderGold(sx,sy,g){
    const bob=Math.sin(g.age*6)*3;
    ctx.fillStyle='#ffd700';ctx.beginPath();ctx.arc(sx+T/2,sy+T/2-4+bob,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffee88';ctx.beginPath();ctx.arc(sx+T/2-1,sy+T/2-5+bob,2,0,Math.PI*2);ctx.fill();
}

function renderEnemy(sx,sy,e){
    const cx=sx+T/2,cy=sy+T/2;
    const alpha=e.dead?Math.max(0,1-e.deathTimer*2):1;
    ctx.globalAlpha=alpha;
    const bob=Math.sin(e.animPhase)*2;
    const flash=e.damageFlash>0;

    drawShadow(cx,cy+e.bodyH*0.3,e.bodyW*0.4,4);

    if(e.typeKey==='slime'){
        const sq=1+Math.sin(e.animPhase*0.8)*0.15;
        ctx.fillStyle=flash?'#fff':e.color;
        ctx.beginPath();ctx.ellipse(cx,cy-4+bob,e.bodyW*0.5*sq,e.bodyH*0.5/sq,0,0,Math.PI*2);ctx.fill();
        // Highlight
        ctx.fillStyle='rgba(255,255,255,0.3)';
        ctx.beginPath();ctx.ellipse(cx-3,cy-9+bob,4,3,-0.3,0,Math.PI*2);ctx.fill();
        // Eyes
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx-4,cy-6+bob,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+4,cy-6+bob,3,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#222';ctx.beginPath();ctx.arc(cx-3,cy-6+bob,1.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+5,cy-6+bob,1.5,0,Math.PI*2);ctx.fill();
    }else if(e.typeKey==='bat'){
        const wA=Math.sin(e.animPhase*2)*0.6;
        ctx.fillStyle=flash?'#fff':e.color;
        ctx.beginPath();ctx.moveTo(cx,cy-10+bob);ctx.quadraticCurveTo(cx-20,cy-16+bob-wA*10,cx-16,cy-2+bob);ctx.fill();
        ctx.beginPath();ctx.moveTo(cx,cy-10+bob);ctx.quadraticCurveTo(cx+20,cy-16+bob-wA*10,cx+16,cy-2+bob);ctx.fill();
        ctx.beginPath();ctx.ellipse(cx,cy-8+bob,5,6,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ff4444';ctx.beginPath();ctx.arc(cx-2,cy-9+bob,1.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+2,cy-9+bob,1.5,0,Math.PI*2);ctx.fill();
    }else if(e.typeKey==='skeleton'){
        ctx.fillStyle=flash?'#fff':e.color;
        ctx.fillRect(cx-4,cy-16+bob,8,14);
        ctx.beginPath();ctx.arc(cx,cy-20+bob,6,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ff3300';ctx.fillRect(cx-4,cy-22+bob,3,3);ctx.fillRect(cx+1,cy-22+bob,3,3);
        ctx.fillStyle=flash?'#fff':e.color;
        ctx.fillRect(cx-9,cy-14+bob,5,2);ctx.fillRect(cx+4,cy-14+bob,5,2);
        ctx.fillRect(cx-4,cy-2+bob,3,6);ctx.fillRect(cx+1,cy-2+bob,3,6);
    }else if(e.typeKey==='spider'){
        ctx.fillStyle=flash?'#fff':e.color;
        ctx.beginPath();ctx.ellipse(cx,cy-4+bob,e.bodyW/2,e.bodyH/2,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ff2222';ctx.beginPath();ctx.arc(cx-3,cy-5+bob,1.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+3,cy-5+bob,1.5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=flash?'#fff':'#3a2020';ctx.lineWidth=1.5;
        for(let i=0;i<4;i++){const lb=Math.sin(e.animPhase+i)*2;
            ctx.beginPath();ctx.moveTo(cx-e.bodyW/2,cy-4+i*3+bob);ctx.lineTo(cx-e.bodyW/2-7,cy-4+i*3+4+lb);ctx.stroke();
            ctx.beginPath();ctx.moveTo(cx+e.bodyW/2,cy-4+i*3+bob);ctx.lineTo(cx+e.bodyW/2+7,cy-4+i*3+4+lb);ctx.stroke();}
        ctx.lineWidth=1;
    }else if(e.typeKey==='goblin'){
        ctx.fillStyle=flash?'#fff':e.color;
        ctx.beginPath();ctx.ellipse(cx,cy-e.bodyH/2+bob,e.bodyW/2,e.bodyH/2,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ff2222';ctx.beginPath();ctx.arc(cx-3,cy-e.bodyH/2-1+bob,1.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+3,cy-e.bodyH/2-1+bob,1.5,0,Math.PI*2);ctx.fill();
        // Ears
        ctx.fillStyle=flash?'#fff':'#5a8a2a';
        ctx.beginPath();ctx.moveTo(cx-6,cy-e.bodyH+2+bob);ctx.lineTo(cx-10,cy-e.bodyH-4+bob);ctx.lineTo(cx-3,cy-e.bodyH+bob);ctx.fill();
        ctx.beginPath();ctx.moveTo(cx+6,cy-e.bodyH+2+bob);ctx.lineTo(cx+10,cy-e.bodyH-4+bob);ctx.lineTo(cx+3,cy-e.bodyH+bob);ctx.fill();
    }else{
        // rat
        ctx.fillStyle=flash?'#fff':e.color;
        ctx.beginPath();ctx.ellipse(cx,cy-e.bodyH/2+bob,e.bodyW/2,e.bodyH/2,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ff2222';ctx.beginPath();ctx.arc(cx-3,cy-e.bodyH/2-1+bob,1.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+3,cy-e.bodyH/2-1+bob,1.5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=flash?'#fff':'#7a6040';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(cx+5,cy+bob);ctx.quadraticCurveTo(cx+12,cy-4+bob,cx+10,cy-8+bob+Math.sin(e.animPhase)*3);ctx.stroke();
    }

    // HP bar
    if(e.hp<e.maxHp&&!e.dead){
        const bw=26,bh=3,bx=cx-bw/2,by=cy-e.bodyH-8+bob;
        ctx.fillStyle='#333';ctx.fillRect(bx,by,bw,bh);
        const r=e.hp/e.maxHp;ctx.fillStyle=r>0.5?'#44ff44':r>0.25?'#ffcc00':'#ff4444';
        ctx.fillRect(bx,by,Math.ceil(bw*r),bh);
        ctx.strokeStyle='#000';ctx.lineWidth=0.5;ctx.strokeRect(bx,by,bw,bh);ctx.lineWidth=1;
    }
    ctx.globalAlpha=1;
}

function renderPlayer(sx,sy){
    const cx=sx+T/2,cy=sy+T/2;
    const bob=player.moving?Math.sin(player.animPhase)*2:0;
    const vis=!player.invulnerable||Math.floor(player.invulnTimer*15)%2===0;
    if(!vis)return;

    drawShadow(cx,cy+6,14,5);

    const fa=player.facingAngle;
    const facingRight=Math.cos(fa)>=0;
    const dir=facingRight?1:-1;

    // Cape
    const capeWave=player.moving?Math.sin(player.animPhase*0.8)*3:0;
    ctx.fillStyle='#cc2222';
    ctx.beginPath();
    ctx.moveTo(cx-3*dir,cy-18+bob);
    ctx.quadraticCurveTo(cx-10*dir,cy-10+bob+capeWave,cx-8*dir,cy+4+bob);
    ctx.lineTo(cx-2*dir,cy+2+bob);ctx.fill();

    // Legs
    const legSwing=player.moving?Math.sin(player.animPhase)*3:0;
    ctx.fillStyle='#444455';
    ctx.fillRect(cx-5,cy+bob,4,8);ctx.fillRect(cx+1,cy+bob-legSwing*0.4,4,8);
    // Boots
    ctx.fillStyle='#553322';
    ctx.fillRect(cx-6,cy+8+bob,6,3);ctx.fillRect(cx,cy+8+bob-legSwing*0.4,6,3);

    // Body
    ctx.fillStyle='#2266bb';
    ctx.beginPath();
    ctx.moveTo(cx-8,cy+bob);ctx.lineTo(cx-9,cy-16+bob);
    ctx.lineTo(cx+9,cy-16+bob);ctx.lineTo(cx+8,cy+bob);ctx.fill();
    // Belt
    ctx.fillStyle='#886633';ctx.fillRect(cx-8,cy-4+bob,16,3);
    ctx.fillStyle='#ffd700';ctx.fillRect(cx-1,cy-4+bob,3,3);

    // Shield
    ctx.fillStyle='#774411';ctx.fillRect(cx-12*dir,cy-14+bob,5*dir,12);
    ctx.fillStyle='#aa6622';ctx.fillRect(cx-11*dir,cy-13+bob,3*dir,10);
    ctx.fillStyle='#ffd700';ctx.beginPath();ctx.arc(cx-10*dir,cy-8+bob,2.5,0,Math.PI*2);ctx.fill();

    // Head
    ctx.fillStyle='#eebb88';ctx.beginPath();ctx.arc(cx,cy-20+bob,7,0,Math.PI*2);ctx.fill();
    // Helmet
    ctx.fillStyle='#8888aa';ctx.beginPath();ctx.arc(cx,cy-21+bob,8,Math.PI,0);ctx.fill();
    ctx.fillStyle='#666680';ctx.fillRect(cx-8,cy-21+bob,16,2);
    // Eyes
    ctx.fillStyle='#222';ctx.fillRect(cx-3,cy-20+bob,2,2);ctx.fillRect(cx+1,cy-20+bob,2,2);

    // Sword
    if(player.attacking){
        const prog=player.attackTimer/player.attackDuration;
        const swingAngle=-1.2+prog*2.4;
        const swordLen=22;
        const aDx=Math.cos(player.attackAngle);
        const aDy=Math.sin(player.attackAngle);
        const tipX=cx+aDx*swordLen*Math.cos(swingAngle)-aDy*swordLen*Math.sin(swingAngle)*0.3;
        const tipY=cy-14+bob+aDy*swordLen*Math.cos(swingAngle)*0.5+aDx*swordLen*Math.sin(swingAngle)*0.5;
        // Blade
        ctx.strokeStyle='#ccccee';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(cx+7*dir,cy-12+bob);ctx.lineTo(tipX,tipY);ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(cx+7*dir,cy-12+bob);ctx.lineTo(tipX,tipY);ctx.stroke();
        // Guard
        ctx.fillStyle='#aa8833';ctx.fillRect(cx+5*dir,cy-14+bob,5*dir,3);
    }else{
        // Idle sword
        ctx.fillStyle='#aa8833';ctx.fillRect(cx+8*dir,cy-14+bob,4*dir,2);
        ctx.fillStyle='#ccccee';ctx.fillRect(cx+9*dir,cy-28+bob,2*dir,15);
        ctx.fillStyle='#553311';ctx.fillRect(cx+9*dir,cy-13+bob,2*dir,5);
    }
    ctx.lineWidth=1;
}

function renderSwing(){
    const cx=player.x*T-camX+T/2,cy=player.y*T-camY+T/2;
    const prog=player.attackTimer/player.attackDuration;
    const angle=player.attackAngle;
    const radius=T*1.1;
    const arcW=Math.PI*0.55;

    ctx.globalAlpha=0.3*(1-prog);
    ctx.fillStyle='#ffdd66';
    ctx.beginPath();ctx.moveTo(cx,cy-14);
    ctx.arc(cx,cy-14,radius,angle-arcW/2,angle-arcW/2+(arcW)*prog);
    ctx.closePath();ctx.fill();

    ctx.strokeStyle='#fff';ctx.lineWidth=2;
    ctx.globalAlpha=0.5*(1-prog);
    const edgeA=angle-arcW/2+arcW*prog;
    ctx.beginPath();ctx.moveTo(cx,cy-14);
    ctx.lineTo(cx+Math.cos(edgeA)*(radius+5),cy-14+Math.sin(edgeA)*(radius+5));
    ctx.stroke();

    ctx.globalAlpha=1;ctx.lineWidth=1;
}

// ============================================================
// HUD
// ============================================================
function renderHUD(){
    ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(10,10,170,58);
    ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.strokeRect(10,10,170,58);

    ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';
    ctx.fillText(`Lv.${player.level}`,18,28);

    ctx.fillStyle='#888';ctx.font='10px monospace';ctx.fillText('HP',18,42);
    ctx.fillStyle='#222';ctx.fillRect(40,34,128,12);
    const hpR=player.hp/player.maxHp;
    ctx.fillStyle=hpR>0.5?'#cc2222':hpR>0.25?'#cc8800':'#ff0000';
    ctx.fillRect(40,34,Math.ceil(128*hpR),12);
    ctx.fillStyle=hpR>0.5?'#ff4444':'#ffaa00';
    ctx.fillRect(40,34,Math.ceil(128*hpR),6);
    ctx.fillStyle='#fff';ctx.font='9px monospace';
    ctx.fillText(`${player.hp}/${player.maxHp}`,80,44);

    ctx.fillStyle='#888';ctx.font='10px monospace';ctx.fillText('XP',18,58);
    ctx.fillStyle='#222';ctx.fillRect(40,52,128,7);
    ctx.fillStyle='#4488ff';ctx.fillRect(40,52,Math.ceil(128*(player.xp/player.xpToNext)),7);
    ctx.fillStyle='#66aaff';ctx.fillRect(40,52,Math.ceil(128*(player.xp/player.xpToNext)),3);

    ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(canvas.width-130,10,120,42);
    ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.strokeRect(canvas.width-130,10,120,42);
    ctx.fillStyle='#ffd700';ctx.font='bold 14px monospace';
    ctx.fillText(`G: ${player.gold}`,canvas.width-122,30);
    ctx.fillStyle='#aaa';ctx.font='11px monospace';
    ctx.fillText('Andar 1',canvas.width-118,46);
}

function renderDeath(){
    const alpha=Math.min(0.8,player.deathTimer*2);
    ctx.fillStyle=`rgba(10,0,0,${alpha})`;ctx.fillRect(0,0,canvas.width,canvas.height);
    if(player.deathTimer>0.5){
        ctx.fillStyle='#cc2222';ctx.font='bold 36px monospace';
        const txt='VOCE CAIU!';const tw=ctx.measureText(txt).width;
        ctx.fillText(txt,(canvas.width-tw)/2,canvas.height/2-30);
        ctx.fillStyle='#aaa';ctx.font='14px monospace';
        ctx.fillText(`Level: ${player.level}  |  Ouro perdido: ${Math.floor(player.gold*0.1)}`,(canvas.width-320)/2,canvas.height/2+10);
    }
    if(player.deathTimer>1.5&&Math.floor(player.deathTimer*3)%2===0){
        ctx.fillStyle='#ffd700';ctx.font='13px monospace';
        const h='Pressione ESPACO para tentar novamente';const hw=ctx.measureText(h).width;
        ctx.fillText(h,(canvas.width-hw)/2,canvas.height/2+50);
    }
}

// ============================================================
// BOOT (with loading screen)
// ============================================================
function boot(){
    const loadBar=document.getElementById('loadBar');
    const loadText=document.getElementById('loadText');
    const loading=document.getElementById('loading');

    if(loadBar)loadBar.style.width='50%';
    if(loadText)loadText.textContent='Gerando dungeon...';

    setTimeout(()=>{
        if(loadBar)loadBar.style.width='100%';
        if(loadText)loadText.textContent='Pronto!';
        setTimeout(()=>{
            if(loading)loading.classList.add('hidden');
            let lastTime=performance.now();
            function loop(ts){
                const dt=Math.min((ts-lastTime)/1000,0.1);lastTime=ts;
                update(dt);render();
                requestAnimationFrame(loop);
            }
            requestAnimationFrame(loop);
        },300);
    },100);
}
boot();

})();
