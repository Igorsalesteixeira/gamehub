'use strict';
// constants.js — Config, Canvas, Utilities, Audio, Screen Effects

// ============================================================
// CONFIG — GDD valores exatos
// ============================================================
const TILE = 32;           // GDD §Contexto: tiles 32×32
const VIEW_W = 480;        // GDD §24: 15 tiles × 32
const VIEW_H = 352;        // GDD §24: 11 tiles × 32
const WALL_DEPTH = 10;     // pseudo-3D wall face
const MAX_FLOOR = 25;      // GDD §9: 25 andares
const FIXED_DT = 1/60;     // GDD §GameLoop: timestep fixo 1/60s

// GDD §18: tamanhos de mapa por andar
const FLOOR_SIZES = [
  60,70,70,70,50,  // B1 (A1-A5)
  75,75,75,75,55,  // B2 (A6-A10)
  80,80,80,80,55,  // B3 (A11-A15)
  85,85,85,85,60,  // B4 (A16-A20)
  90,90,90,90,60   // B5 (A21-A25)
];

// GDD §6: Redução de dano por diferença de level
const LEVEL_DMG_SCALE = {
  0: [1.0, 1.0], 1: [0.9, 1.1], 2: [0.8, 1.2], 3: [0.7, 1.3],
  4: [0.5, 1.6], 5: [0.35, 1.9], 6: [0.2, 2.2], 7: [0.05, 2.5]
};

// ============================================================
// CANVAS — GDD §24: 480×352 resolução interna
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
ctx.imageSmoothingEnabled = false; // GDD §Contexto

// Scaling (CSS)
function resize() {
  const scaleX = window.innerWidth / VIEW_W;
  const scaleY = window.innerHeight / VIEW_H;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.width = Math.floor(VIEW_W * scale) + 'px';
  canvas.style.height = Math.floor(VIEW_H * scale) + 'px';
}
resize();
window.addEventListener('resize', resize);

// ============================================================
// UTILITY
// ============================================================
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
function distXY(x1, y1, x2, y2) { return Math.sqrt((x2-x1)**2 + (y2-y1)**2); }

// ============================================================
// AUDIO — GDD §23 (procedural Web Audio)
// ============================================================
let audioCtx = null;
// GDD §13: Volume sliders SFX + Música (0-1)
let sfxVolume = 0.8;
let musicVolume = 0.4;
let bgMusic = null; // background music nodes

function initAudio() {
  if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
}

// --- Audio helpers ---
// Quick oscillator: creates osc+gain, connects, returns {o,g}
function _osc(type, freq, vol, dur, t) {
  const g = audioCtx.createGain();
  g.connect(audioCtx.destination);
  g.gain.setValueAtTime(vol * sfxVolume, t);
  const o = audioCtx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  o.connect(g); o.start(t); o.stop(t + dur);
  return {o, g};
}
// Noise burst helper (for impacts, explosions, etc)
function _noise(vol, dur, t) {
  const sz = audioCtx.sampleRate * dur;
  const buf = audioCtx.createBuffer(1, sz, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const g = audioCtx.createGain(); g.gain.setValueAtTime(vol * sfxVolume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(g); g.connect(audioCtx.destination);
  src.start(t); src.stop(t + dur);
  return {src, g};
}
// Sweep helper: osc with freq ramp
function _sweep(type, f1, f2, vol, dur, t) {
  const {o, g} = _osc(type, f1, vol, dur, t);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  return {o, g};
}

// Mapeamento sfx type → chave de áudio real
const SFX_REAL_MAP = {
  swing: 'sfx_hit',
  hit: 'sfx_swing2',
  kill: 'sfx_monster',
  playerHit: 'sfx_hit',
  coin: 'sfx_coin1',
  levelUp: 'sfx_menuSelect',
  heal: 'sfx_bottle',
  death: 'sfx_monster',
  chest: 'sfx_metalClick',
  door: 'sfx_door',
  buy: 'sfx_coin2',
  equip: 'sfx_armorLight',
  menuOpen: 'sfx_menuOpen',
  menuClose: 'sfx_menuClose',
  menuSelect: 'sfx_menuSelect',
  menuCursor: 'sfx_menuCursor',
  page: 'sfx_bookFlip1',
  potion: 'sfx_bottle',
};

function sfx(type, opts) {
  // Tenta usar áudio real primeiro
  const realKey = SFX_REAL_MAP[type];
  if (realKey && typeof AUDIO_CACHE !== 'undefined' && AUDIO_CACHE[realKey]) {
    if (typeof playSfxReal === 'function') playSfxReal(realKey);
    return;
  }

  // Fallback: Web Audio procedural
  if (!audioCtx) initAudio();
  if (!audioCtx) return;
  if (sfxVolume <= 0) return;
  const now = audioCtx.currentTime;
  const vol = (opts && opts.vol) || 0.12;
  const g = audioCtx.createGain();
  g.connect(audioCtx.destination);
  g.gain.setValueAtTime(vol * sfxVolume, now);
  const o = audioCtx.createOscillator();
  o.connect(g);
  switch(type) {
    // --- Original SFX ---
    case 'swing':
      o.type='triangle'; o.frequency.setValueAtTime(250,now);
      o.frequency.exponentialRampToValueAtTime(150,now+0.06);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.06);
      o.start(now); o.stop(now+0.06); break;
    case 'hit':
      o.type='square'; o.frequency.setValueAtTime(200,now);
      o.frequency.exponentialRampToValueAtTime(80,now+0.1);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.12);
      o.start(now); o.stop(now+0.12); break;
    case 'kill':
      o.type='sawtooth'; o.frequency.setValueAtTime(300,now);
      o.frequency.exponentialRampToValueAtTime(50,now+0.3);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.3);
      o.start(now); o.stop(now+0.3); break;
    case 'playerHit':
      o.type='square'; o.frequency.setValueAtTime(120,now);
      o.frequency.exponentialRampToValueAtTime(60,now+0.15);
      g.gain.setValueAtTime(0.2*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.2);
      o.start(now); o.stop(now+0.2); break;
    case 'gold':
      o.type='sine'; o.frequency.setValueAtTime(800,now);
      o.frequency.setValueAtTime(1200,now+0.05);
      o.frequency.setValueAtTime(1600,now+0.1);
      g.gain.setValueAtTime(0.08*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
      o.start(now); o.stop(now+0.15); break;
    case 'levelUp':
      o.type='sine'; o.frequency.setValueAtTime(400,now);
      o.frequency.setValueAtTime(600,now+0.1);
      o.frequency.setValueAtTime(800,now+0.2);
      o.frequency.setValueAtTime(1000,now+0.3);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.5);
      o.start(now); o.stop(now+0.5); break;
    case 'chest':
      o.type='sine'; o.frequency.setValueAtTime(600,now);
      o.frequency.setValueAtTime(900,now+0.1);
      o.frequency.setValueAtTime(1200,now+0.2);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.35);
      o.start(now); o.stop(now+0.35); break;
    case 'stairs':
      o.type='sine'; o.frequency.setValueAtTime(300,now);
      o.frequency.exponentialRampToValueAtTime(800,now+0.3);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.4);
      o.start(now); o.stop(now+0.4); break;
    case 'death':
      o.type='sawtooth'; o.frequency.setValueAtTime(200,now);
      o.frequency.exponentialRampToValueAtTime(30,now+0.8);
      g.gain.setValueAtTime(0.2*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+1);
      o.start(now); o.stop(now+1); break;
    case 'potion':
      o.type='sine'; o.frequency.setValueAtTime(500,now);
      o.frequency.setValueAtTime(700,now+0.1);
      o.frequency.setValueAtTime(900,now+0.2);
      g.gain.setValueAtTime(0.08*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.3);
      o.start(now); o.stop(now+0.3); break;
    case 'shopBuy':
      o.type='sine'; o.frequency.setValueAtTime(600,now);
      o.frequency.setValueAtTime(900,now+0.08);
      o.frequency.setValueAtTime(1200,now+0.16);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.25);
      o.start(now); o.stop(now+0.25); break;
    case 'equip':
      o.type='triangle'; o.frequency.setValueAtTime(500,now);
      o.frequency.setValueAtTime(700,now+0.05);
      g.gain.setValueAtTime(0.08*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.12);
      o.start(now); o.stop(now+0.12); break;
    case 'bossRoar':
      o.type='sawtooth'; o.frequency.setValueAtTime(80,now);
      o.frequency.exponentialRampToValueAtTime(40,now+0.6);
      g.gain.setValueAtTime(0.25*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.8);
      o.start(now); o.stop(now+0.8); break;
    case 'doorLock':
      o.type='square'; o.frequency.setValueAtTime(150,now);
      o.frequency.exponentialRampToValueAtTime(80,now+0.2);
      g.gain.setValueAtTime(0.15*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.3);
      o.start(now); o.stop(now+0.3); break;
    case 'classSelect':
      o.type='sine'; o.frequency.setValueAtTime(500,now);
      o.frequency.setValueAtTime(700,now+0.15);
      o.frequency.setValueAtTime(900,now+0.3);
      o.frequency.setValueAtTime(1200,now+0.45);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.6);
      o.start(now); o.stop(now+0.6); break;
    case 'upgradeOk':
      o.type='sine'; o.frequency.setValueAtTime(600,now);
      o.frequency.setValueAtTime(1000,now+0.1);
      o.frequency.setValueAtTime(1400,now+0.2);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.35);
      o.start(now); o.stop(now+0.35); break;
    case 'upgradeFail':
      o.type='square'; o.frequency.setValueAtTime(200,now);
      o.frequency.exponentialRampToValueAtTime(100,now+0.3);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.4);
      o.start(now); o.stop(now+0.4); break;

    // --- NPC-specific bleeps (GDD §23) ---
    case 'npcTalk': {
      const npc = (opts && opts.npc) || '';
      o.disconnect(); // we use _osc helpers instead
      if (npc === 'bron') {
        // Low/grave ~200Hz
        const {o:ob,g:gb} = _osc('sawtooth',200,0.08,0.12,now);
        ob.frequency.setValueAtTime(220,now+0.04); ob.frequency.setValueAtTime(180,now+0.08);
        gb.gain.exponentialRampToValueAtTime(0.001,now+0.12);
      } else if (npc === 'selene') {
        // Medium ~400Hz
        const {o:os,g:gs} = _osc('sine',400,0.07,0.1,now);
        os.frequency.setValueAtTime(450,now+0.03); os.frequency.setValueAtTime(380,now+0.07);
        gs.gain.exponentialRampToValueAtTime(0.001,now+0.1);
      } else if (npc === 'kaelith') {
        // High/sharp ~600Hz
        const {o:ok,g:gk} = _osc('triangle',600,0.06,0.1,now);
        ok.frequency.setValueAtTime(700,now+0.03); ok.frequency.setValueAtTime(550,now+0.07);
        gk.gain.exponentialRampToValueAtTime(0.001,now+0.1);
      } else if (npc === 'lira') {
        // Echo ~350Hz with delay
        const {o:ol,g:gl} = _osc('sine',350,0.07,0.15,now);
        ol.frequency.setValueAtTime(400,now+0.04); ol.frequency.setValueAtTime(330,now+0.1);
        gl.gain.exponentialRampToValueAtTime(0.001,now+0.15);
        // Echo repeat
        const {g:ge} = _osc('sine',340,0.03,0.1,now+0.12);
        ge.gain.exponentialRampToValueAtTime(0.001,now+0.22);
      } else if (npc === 'nahgord') {
        // Distorted ~150Hz with noise
        const {o:on,g:gn} = _osc('sawtooth',150,0.1,0.15,now);
        on.frequency.setValueAtTime(170,now+0.05); on.frequency.setValueAtTime(130,now+0.1);
        gn.gain.exponentialRampToValueAtTime(0.001,now+0.15);
        _noise(0.06,0.12,now);
      } else {
        // Default npcTalk
        o.type='sine'; o.frequency.setValueAtTime(400,now);
        o.frequency.setValueAtTime(500,now+0.04); o.frequency.setValueAtTime(350,now+0.08);
        g.gain.setValueAtTime(0.06*sfxVolume,now);
        g.gain.exponentialRampToValueAtTime(0.001,now+0.1);
        o.connect(g); o.start(now); o.stop(now+0.1);
      }
      break;
    }

    // ============================================================
    // GUERREIRO SKILLS (GDD §23) — prefix sk_gue_
    // ============================================================
    case 'sk_gue_golpeBrutal': // heavy metal impact
      o.type='square'; o.frequency.setValueAtTime(100,now);
      o.frequency.exponentialRampToValueAtTime(40,now+0.15);
      g.gain.setValueAtTime(0.2*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.2);
      o.start(now); o.stop(now+0.2);
      _noise(0.15,0.1,now); break;
    case 'sk_gue_provocar': // war cry low freq
      o.type='sawtooth'; o.frequency.setValueAtTime(100,now);
      o.frequency.exponentialRampToValueAtTime(60,now+0.4);
      g.gain.setValueAtTime(0.18*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.5);
      o.start(now); o.stop(now+0.5); break;
    case 'sk_gue_investida': // wind rush + impact
      o.disconnect();
      _sweep('sine',800,200,0.1,0.2,now);
      _noise(0.12,0.15,now+0.15); break;
    case 'sk_gue_gritoGuerra': { // reverberant roar
      o.type='sawtooth'; o.frequency.setValueAtTime(120,now);
      o.frequency.exponentialRampToValueAtTime(80,now+0.5);
      g.gain.setValueAtTime(0.2*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.6);
      o.start(now); o.stop(now+0.6);
      // reverb echo
      _osc('sawtooth',110,0.08,0.4,now+0.15);
      break; }
    case 'sk_gue_esmagar': // stone breaking
      o.type='square'; o.frequency.setValueAtTime(60,now);
      o.frequency.exponentialRampToValueAtTime(30,now+0.3);
      g.gain.setValueAtTime(0.2*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.35);
      o.start(now); o.stop(now+0.35);
      _noise(0.18,0.2,now+0.05); break;
    case 'sk_gue_bloqueioPerfeito': // shield resonance
      o.type='triangle'; o.frequency.setValueAtTime(400,now);
      o.frequency.exponentialRampToValueAtTime(600,now+0.15);
      g.gain.setValueAtTime(0.15*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.3);
      o.start(now); o.stop(now+0.3);
      _osc('sine',800,0.05,0.2,now+0.1); break;
    case 'sk_gue_corteGiratorio': // spinning blade whoosh
      o.type='sine'; o.frequency.setValueAtTime(300,now);
      o.frequency.setValueAtTime(600,now+0.1);
      o.frequency.setValueAtTime(300,now+0.2);
      o.frequency.setValueAtTime(600,now+0.3);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.35);
      o.start(now); o.stop(now+0.35); break;
    case 'sk_gue_frenesi': { // accelerating heartbeat
      o.disconnect();
      for (let i=0; i<6; i++) {
        const t = now + i*0.07;
        _osc('sine',80,0.1-i*0.01,0.04,t);
      }
      break; }
    case 'sk_gue_golpeSismico': // ground tremor
      o.type='sine'; o.frequency.setValueAtTime(40,now);
      o.frequency.setValueAtTime(35,now+0.2);
      o.frequency.setValueAtTime(45,now+0.4);
      g.gain.setValueAtTime(0.2*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.5);
      o.start(now); o.stop(now+0.5);
      _noise(0.1,0.3,now); break;
    case 'sk_gue_muralha': // stones rising
      o.type='square'; o.frequency.setValueAtTime(50,now);
      o.frequency.exponentialRampToValueAtTime(200,now+0.4);
      g.gain.setValueAtTime(0.15*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.5);
      o.start(now); o.stop(now+0.5);
      _noise(0.08,0.3,now+0.1); break;

    // ============================================================
    // MAGO SKILLS (GDD §23) — prefix sk_mag_
    // ============================================================
    case 'sk_mag_bolaFogo': // fire ignition + whoosh
      o.disconnect();
      _noise(0.12,0.15,now);
      _sweep('sawtooth',200,800,0.12,0.25,now+0.05); break;
    case 'sk_mag_barreira': // crystal shimmer
      o.type='sine'; o.frequency.setValueAtTime(1200,now);
      o.frequency.setValueAtTime(1500,now+0.1);
      o.frequency.setValueAtTime(1000,now+0.2);
      g.gain.setValueAtTime(0.08*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.35);
      o.start(now); o.stop(now+0.35);
      _osc('sine',1800,0.03,0.3,now+0.05); break;
    case 'sk_mag_raioCongelante': // ice wind + crack
      o.disconnect();
      _noise(0.08,0.2,now);
      _sweep('triangle',2000,500,0.1,0.15,now+0.15); break;
    case 'sk_mag_meteoro': // descending whistle + explosion
      o.disconnect();
      _sweep('sine',1500,200,0.12,0.3,now);
      _noise(0.2,0.2,now+0.25); break;
    case 'sk_mag_correnteRaios': { // electric chain crackle
      o.disconnect();
      for (let i=0; i<5; i++) {
        _osc('square',800+i*200,0.08-i*0.01,0.04,now+i*0.06);
        _noise(0.05,0.03,now+i*0.06+0.02);
      }
      break; }
    case 'sk_mag_teletransporte': // air implosion + pop
      o.type='sine'; o.frequency.setValueAtTime(800,now);
      o.frequency.exponentialRampToValueAtTime(100,now+0.15);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.18);
      o.start(now); o.stop(now+0.18);
      _osc('sine',1200,0.1,0.04,now+0.16); break;
    case 'sk_mag_drenarVida': // ethereal suction
      o.type='sine'; o.frequency.setValueAtTime(500,now);
      o.frequency.exponentialRampToValueAtTime(150,now+0.4);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.45);
      o.start(now); o.stop(now+0.45);
      _osc('triangle',300,0.04,0.35,now+0.05); break;
    case 'sk_mag_novaGelo': // shattering glass wave
      o.disconnect();
      _osc('sine',2000,0.1,0.1,now);
      _noise(0.15,0.25,now+0.08);
      _sweep('triangle',1800,400,0.08,0.2,now+0.1); break;
    case 'sk_mag_familiar': { // summoning bells
      o.disconnect();
      const notes = [800,1000,1200,1000,800];
      notes.forEach((f,i) => _osc('sine',f,0.06,0.08,now+i*0.08));
      break; }
    case 'sk_mag_escudoEspelhado': // crystalline reverb
      o.type='triangle'; o.frequency.setValueAtTime(1000,now);
      o.frequency.setValueAtTime(1400,now+0.1);
      o.frequency.setValueAtTime(800,now+0.2);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.4);
      o.start(now); o.stop(now+0.4);
      _osc('sine',1200,0.04,0.3,now+0.1);
      _osc('sine',1500,0.02,0.2,now+0.2); break;

    // ============================================================
    // ARQUEIRO SKILLS (GDD §23) — prefix sk_arq_
    // ============================================================
    case 'sk_arq_flechaPerfurante': // tense string + whistle
      o.type='triangle'; o.frequency.setValueAtTime(150,now);
      o.frequency.exponentialRampToValueAtTime(1200,now+0.08);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
      o.start(now); o.stop(now+0.15);
      _osc('sine',1500,0.06,0.1,now+0.08); break;
    case 'sk_arq_chuvaFlechas': { // multiple whistles + thud
      o.disconnect();
      for (let i=0; i<4; i++) {
        _sweep('sine',1000+i*100,400,0.06,0.1,now+i*0.08);
      }
      _noise(0.1,0.1,now+0.35); break; }
    case 'sk_arq_armadilha': // mechanical click + spring
      o.type='square'; o.frequency.setValueAtTime(800,now);
      o.frequency.setValueAtTime(200,now+0.02);
      o.frequency.exponentialRampToValueAtTime(1500,now+0.12);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
      o.start(now); o.stop(now+0.15); break;
    case 'sk_arq_tiroCerteiro': // slow string + precise impact
      o.type='triangle'; o.frequency.setValueAtTime(200,now);
      o.frequency.exponentialRampToValueAtTime(1000,now+0.2);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.25);
      o.start(now); o.stop(now+0.25);
      _osc('square',300,0.12,0.06,now+0.2); break;
    case 'sk_arq_flechaExplosiva': // whistle + dry explosion
      o.disconnect();
      _sweep('sine',1200,600,0.1,0.15,now);
      _noise(0.18,0.15,now+0.12);
      _osc('square',80,0.12,0.1,now+0.12); break;
    case 'sk_arq_rolamento': // fabric sliding
      o.disconnect();
      _noise(0.06,0.2,now);
      _sweep('sine',400,200,0.05,0.2,now); break;
    case 'sk_arq_flechaVeneno': // whistle + acid bubble
      o.disconnect();
      _sweep('sine',1000,500,0.08,0.12,now);
      { const {o:ob,g:gb} = _osc('sine',300,0.06,0.2,now+0.1);
        ob.frequency.setValueAtTime(350,now+0.15);
        ob.frequency.setValueAtTime(280,now+0.2);
        ob.frequency.setValueAtTime(320,now+0.25);
        gb.gain.exponentialRampToValueAtTime(0.001,now+0.3); }
      break;
    case 'sk_arq_sentinela': // gears building
      o.type='square'; o.frequency.setValueAtTime(200,now);
      o.frequency.exponentialRampToValueAtTime(600,now+0.3);
      g.gain.setValueAtTime(0.08*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.35);
      o.start(now); o.stop(now+0.35);
      _osc('square',400,0.04,0.25,now+0.05); break;
    case 'sk_arq_tiroDuplo': // two strings in sequence
      o.disconnect();
      _sweep('triangle',200,1200,0.1,0.1,now);
      _sweep('triangle',250,1300,0.1,0.1,now+0.12); break;
    case 'sk_arq_rede': // stretching + wrapping
      o.type='sine'; o.frequency.setValueAtTime(300,now);
      o.frequency.exponentialRampToValueAtTime(500,now+0.2);
      o.frequency.exponentialRampToValueAtTime(200,now+0.35);
      g.gain.setValueAtTime(0.08*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.4);
      o.start(now); o.stop(now+0.4); break;

    // ============================================================
    // ASSASSINO SKILLS (GDD §23) — prefix sk_ass_
    // ============================================================
    case 'sk_ass_golpeFurtivo': // silent blade + surprise
      o.type='triangle'; o.frequency.setValueAtTime(2000,now+0.08);
      o.frequency.exponentialRampToValueAtTime(400,now+0.15);
      g.gain.setValueAtTime(0.001,now);
      g.gain.setValueAtTime(0.15*sfxVolume,now+0.08);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.18);
      o.start(now); o.stop(now+0.18); break;
    case 'sk_ass_laminaVeneno': // dripping liquid on knife
      o.disconnect();
      _sweep('triangle',300,500,0.08,0.1,now);
      for (let i=0; i<3; i++) _osc('sine',600+i*50,0.04,0.03,now+0.1+i*0.05);
      break;
    case 'sk_ass_passosSombrios': // shadow whisper
      o.disconnect();
      _noise(0.04,0.3,now);
      _osc('sine',150,0.04,0.25,now); break;
    case 'sk_ass_dancaLaminas': { // multiple rapid cuts
      o.disconnect();
      for (let i=0; i<5; i++)
        _sweep('triangle',1500,300,0.08,0.04,now+i*0.05);
      break; }
    case 'sk_ass_lancarAdaga': // sharp metal cutting air
      o.type='sawtooth'; o.frequency.setValueAtTime(1000,now);
      o.frequency.exponentialRampToValueAtTime(2000,now+0.06);
      o.frequency.exponentialRampToValueAtTime(300,now+0.12);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
      o.start(now); o.stop(now+0.15); break;
    case 'sk_ass_esquivaSombria': // smoke puff
      o.disconnect();
      _noise(0.08,0.15,now);
      _sweep('sine',400,100,0.05,0.12,now); break;
    case 'sk_ass_corteHemorragico': // deep cut + splash
      o.type='sawtooth'; o.frequency.setValueAtTime(300,now);
      o.frequency.exponentialRampToValueAtTime(80,now+0.15);
      g.gain.setValueAtTime(0.15*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.2);
      o.start(now); o.stop(now+0.2);
      _noise(0.1,0.1,now+0.1); break;
    case 'sk_ass_emboscada': // silence → sudden impact
      o.type='square'; o.frequency.setValueAtTime(50,now+0.15);
      o.frequency.exponentialRampToValueAtTime(300,now+0.18);
      o.frequency.exponentialRampToValueAtTime(80,now+0.25);
      g.gain.setValueAtTime(0.001,now);
      g.gain.setValueAtTime(0.2*sfxVolume,now+0.15);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.3);
      o.start(now); o.stop(now+0.3);
      _noise(0.12,0.1,now+0.15); break;
    case 'sk_ass_fumaca': // muffled explosion + hiss
      o.disconnect();
      _osc('square',60,0.1,0.1,now);
      _noise(0.1,0.3,now+0.05); break;
    case 'sk_ass_execucao': // slow blade + final strike
      o.type='triangle'; o.frequency.setValueAtTime(200,now);
      o.frequency.exponentialRampToValueAtTime(800,now+0.3);
      g.gain.setValueAtTime(0.08*sfxVolume,now);
      g.gain.setValueAtTime(0.2*sfxVolume,now+0.28);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.4);
      o.start(now); o.stop(now+0.4);
      _noise(0.15,0.08,now+0.28); break;

    // ============================================================
    // ESSÊNCIA SKILLS (GDD §23) — prefix sk_ess_
    // ============================================================
    case 'sk_ess_pulso': // golden wave — expanding sine burst
      o.type='sine'; o.frequency.setValueAtTime(400,now);
      o.frequency.exponentialRampToValueAtTime(200,now+0.3);
      g.gain.setValueAtTime(0.18*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.35);
      o.start(now); o.stop(now+0.35);
      _osc('triangle',600,0.08,0.25,now+0.05);
      _sweep('sine',800,300,0.06,0.2,now+0.1); break;
    case 'sk_ess_escudo': // protective resonance — layered harmonics
      o.type='triangle'; o.frequency.setValueAtTime(500,now);
      o.frequency.setValueAtTime(600,now+0.15);
      o.frequency.setValueAtTime(500,now+0.3);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.4);
      o.start(now); o.stop(now+0.4);
      _osc('sine',1000,0.05,0.35,now);
      _osc('sine',750,0.04,0.3,now+0.05); break;
    case 'sk_ess_despertarP': { // rising energy — ascending cascade
      o.disconnect();
      for (let i=0; i<6; i++) {
        _osc('sine',300+i*120,0.08-i*0.005,0.08,now+i*0.06);
        _osc('triangle',400+i*150,0.04,0.06,now+i*0.06+0.02);
      }
      _sweep('sine',300,1200,0.06,0.4,now);
      break; }
    case 'sk_ess_laminaLuz': // celestial cut — bright slash + shimmer
      o.disconnect();
      _sweep('triangle',2000,600,0.14,0.12,now);
      _osc('sine',1800,0.06,0.15,now+0.05);
      _osc('sine',2200,0.04,0.12,now+0.08);
      _noise(0.06,0.08,now+0.1); break;
    case 'sk_ess_despertarT': { // epic explosion — most impactful sound in game
      o.disconnect();
      // Deep sub-bass rumble
      _osc('sawtooth',40,0.2,0.5,now);
      // Rising power chord
      _sweep('sawtooth',80,400,0.15,0.4,now);
      _sweep('square',120,600,0.1,0.35,now+0.05);
      // Explosion burst
      _noise(0.25,0.3,now+0.3);
      // Shimmering overtones
      for (let i=0; i<4; i++) {
        _osc('sine',800+i*300,0.06-i*0.01,0.2,now+0.35+i*0.05);
      }
      // Final resonance
      _osc('triangle',200,0.08,0.4,now+0.4);
      _osc('sine',400,0.05,0.35,now+0.45);
      break; }

    // ============================================================
    // ENEMY SOUNDS BY CATEGORY (GDD §23)
    // ============================================================
    // --- Ambient/attack sounds ---
    case 'enemy_slime': // bubbling
      o.type='sine'; o.frequency.setValueAtTime(200,now);
      o.frequency.setValueAtTime(280,now+0.05);
      o.frequency.setValueAtTime(180,now+0.1);
      o.frequency.setValueAtTime(250,now+0.15);
      g.gain.setValueAtTime(0.08*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.2);
      o.start(now); o.stop(now+0.2); break;
    case 'enemy_bat': // screech
      o.type='sawtooth'; o.frequency.setValueAtTime(2000,now);
      o.frequency.exponentialRampToValueAtTime(3000,now+0.06);
      o.frequency.exponentialRampToValueAtTime(1500,now+0.12);
      g.gain.setValueAtTime(0.07*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
      o.start(now); o.stop(now+0.15); break;
    case 'enemy_skeleton': // bones creaking
      o.disconnect();
      for (let i=0; i<3; i++) {
        _noise(0.06,0.04,now+i*0.06);
        _osc('square',150+i*30,0.04,0.03,now+i*0.06+0.02);
      }
      break;
    case 'enemy_wolf': // growl
      o.type='sawtooth'; o.frequency.setValueAtTime(100,now);
      o.frequency.setValueAtTime(120,now+0.1);
      o.frequency.setValueAtTime(80,now+0.2);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.25);
      o.start(now); o.stop(now+0.25); break;
    case 'enemy_zombie': // groan
      o.type='sawtooth'; o.frequency.setValueAtTime(80,now);
      o.frequency.exponentialRampToValueAtTime(60,now+0.3);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.35);
      o.start(now); o.stop(now+0.35); break;
    case 'enemy_ghost': // whisper
      o.disconnect();
      _noise(0.03,0.3,now);
      _osc('sine',600,0.04,0.25,now);
      _sweep('sine',800,400,0.03,0.25,now+0.05); break;
    case 'enemy_golem': // stone dragging
      o.disconnect();
      _noise(0.1,0.25,now);
      _osc('square',50,0.08,0.2,now);
      _osc('sine',40,0.06,0.15,now+0.1); break;
    case 'enemy_demon': // deep roar
      o.type='sawtooth'; o.frequency.setValueAtTime(60,now);
      o.frequency.exponentialRampToValueAtTime(35,now+0.4);
      g.gain.setValueAtTime(0.2*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.5);
      o.start(now); o.stop(now+0.5);
      _osc('square',45,0.08,0.3,now+0.1); break;

    // --- Death sounds ---
    case 'death_slime': // splash
      o.disconnect();
      _noise(0.12,0.2,now);
      _osc('sine',300,0.06,0.15,now);
      _sweep('sine',400,100,0.04,0.15,now+0.05); break;
    case 'death_skeleton': // crumbling bones
      o.disconnect();
      _noise(0.15,0.3,now);
      for (let i=0; i<4; i++) _osc('square',100+i*20,0.04,0.05,now+i*0.07);
      break;
    case 'death_ghost': // dissipating
      o.disconnect();
      _sweep('sine',800,100,0.08,0.4,now);
      _noise(0.04,0.35,now);
      _osc('sine',500,0.03,0.3,now+0.1); break;
    case 'death_demon': // scream
      o.type='sawtooth'; o.frequency.setValueAtTime(200,now);
      o.frequency.exponentialRampToValueAtTime(50,now+0.5);
      g.gain.setValueAtTime(0.22*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.6);
      o.start(now); o.stop(now+0.6);
      _noise(0.1,0.3,now+0.2); break;
    // Generic death (bat, wolf, zombie, golem)
    case 'death_generic':
      o.type='square'; o.frequency.setValueAtTime(150,now);
      o.frequency.exponentialRampToValueAtTime(40,now+0.25);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.3);
      o.start(now); o.stop(now+0.3);
      _noise(0.06,0.15,now+0.1); break;

    // ============================================================
    // ADDITIONAL UI/ENVIRONMENT SOUNDS (GDD §23)
    // ============================================================
    case 'pickup': // pickup item (generic)
      o.type='sine'; o.frequency.setValueAtTime(600,now);
      o.frequency.setValueAtTime(900,now+0.06);
      g.gain.setValueAtTime(0.08*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.12);
      o.start(now); o.stop(now+0.12); break;
    case 'trap': // trap trigger
      o.type='square'; o.frequency.setValueAtTime(1000,now);
      o.frequency.exponentialRampToValueAtTime(200,now+0.1);
      g.gain.setValueAtTime(0.15*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.15);
      o.start(now); o.stop(now+0.15);
      _noise(0.1,0.1,now+0.05); break;
    case 'door': // door opening
      o.type='triangle'; o.frequency.setValueAtTime(200,now);
      o.frequency.exponentialRampToValueAtTime(400,now+0.2);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.25);
      o.start(now); o.stop(now+0.25);
      _noise(0.04,0.15,now); break;
    case 'bossAppear': // boss appearing — dramatic
      o.disconnect();
      _osc('sawtooth',50,0.2,0.6,now);
      _sweep('sawtooth',50,30,0.15,0.5,now+0.1);
      _noise(0.12,0.4,now+0.2);
      _osc('square',80,0.1,0.3,now+0.3);
      _osc('triangle',120,0.06,0.2,now+0.5); break;
    case 'mimicReveal': // mimic surprise — sharp alert
      o.type='square'; o.frequency.setValueAtTime(400,now);
      o.frequency.setValueAtTime(800,now+0.05);
      o.frequency.setValueAtTime(600,now+0.1);
      g.gain.setValueAtTime(0.15*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.2);
      o.start(now); o.stop(now+0.2);
      _noise(0.08,0.1,now+0.08); break;

    // --- Class-specific basic attack sounds (GDD §23) ---
    case 'atkSword': // sword cutting
      o.type='sawtooth'; o.frequency.setValueAtTime(300,now);
      o.frequency.exponentialRampToValueAtTime(100,now+0.08);
      g.gain.setValueAtTime(0.12*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.1);
      o.start(now); o.stop(now+0.1); break;
    case 'atkStaff': // staff vibrating
      o.type='sine'; o.frequency.setValueAtTime(300,now);
      o.frequency.setValueAtTime(500,now+0.05);
      o.frequency.setValueAtTime(350,now+0.1);
      g.gain.setValueAtTime(0.08*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.12);
      o.start(now); o.stop(now+0.12); break;
    case 'atkBow': // bowstring
      o.type='triangle'; o.frequency.setValueAtTime(150,now);
      o.frequency.exponentialRampToValueAtTime(800,now+0.06);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.1);
      o.start(now); o.stop(now+0.1); break;
    case 'atkKnife': // quick knife
      o.type='triangle'; o.frequency.setValueAtTime(1500,now);
      o.frequency.exponentialRampToValueAtTime(600,now+0.05);
      g.gain.setValueAtTime(0.1*sfxVolume,now);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.06);
      o.start(now); o.stop(now+0.06); break;

    // --- Step sounds by terrain ---
    case 'stepStone':
      o.disconnect();
      _noise(0.04,0.06,now);
      _osc('square',100,0.02,0.04,now); break;
    case 'stepWater':
      o.disconnect();
      _noise(0.03,0.08,now);
      _osc('sine',400,0.02,0.06,now+0.02); break;
    case 'stepLava':
      o.disconnect();
      _noise(0.04,0.1,now);
      _osc('sine',200,0.03,0.08,now);
      _osc('sine',250,0.02,0.06,now+0.03); break;

    default: // unknown sfx — do nothing
      o.disconnect(); return;
  }
}

// ============================================================
// SKILL SOUND MAPPING — playSkillSound(skillId)
// ============================================================
// Maps SKILLS keys to sfx case names
const SKILL_SFX_MAP = {
  // Guerreiro
  golpeBrutal:     'sk_gue_golpeBrutal',
  provocar:        'sk_gue_provocar',
  investidaG:      'sk_gue_investida',
  gritoGuerra:     'sk_gue_gritoGuerra',
  esmagar:         'sk_gue_esmagar',
  bloqueioPerf:    'sk_gue_bloqueioPerfeito',
  corteGiratorio:  'sk_gue_corteGiratorio',
  frenesi:         'sk_gue_frenesi',
  golpeSismico:    'sk_gue_golpeSismico',
  muralha:         'sk_gue_muralha',
  // Mago
  bolaFogo:        'sk_mag_bolaFogo',
  barreira:        'sk_mag_barreira',
  raioCongelante:  'sk_mag_raioCongelante',
  meteoro:         'sk_mag_meteoro',
  correnteRaios:   'sk_mag_correnteRaios',
  teletransporte:  'sk_mag_teletransporte',
  drenarVida:      'sk_mag_drenarVida',
  novaGelo:        'sk_mag_novaGelo',
  familiar:        'sk_mag_familiar',
  escudoEspelhado: 'sk_mag_escudoEspelhado',
  // Arqueiro
  flechaPerfurante:'sk_arq_flechaPerfurante',
  chuvaFlechas:    'sk_arq_chuvaFlechas',
  armadilha:       'sk_arq_armadilha',
  tiroCerteiro:    'sk_arq_tiroCerteiro',
  flechaExplosiva: 'sk_arq_flechaExplosiva',
  rolamento:       'sk_arq_rolamento',
  flechaVeneno:    'sk_arq_flechaVeneno',
  sentinela:       'sk_arq_sentinela',
  tiroDuplo:       'sk_arq_tiroDuplo',
  rede:            'sk_arq_rede',
  // Assassino
  golpeFurtivo:    'sk_ass_golpeFurtivo',
  laminaVeneno:    'sk_ass_laminaVeneno',
  passosSombrios:  'sk_ass_passosSombrios',
  dancaLaminas:    'sk_ass_dancaLaminas',
  lancarAdaga:     'sk_ass_lancarAdaga',
  esquivaSombria:  'sk_ass_esquivaSombria',
  corteHemor:      'sk_ass_corteHemorragico',
  emboscada:       'sk_ass_emboscada',
  fumaca:          'sk_ass_fumaca',
  execucao:        'sk_ass_execucao',
  // Essência
  pulso:           'sk_ess_pulso',
  escudo:          'sk_ess_escudo',
  despertarP:      'sk_ess_despertarP',
  laminaLuz:       'sk_ess_laminaLuz',
  despertarT:      'sk_ess_despertarT',
};

function playSkillSound(skillId) {
  const sfxKey = SKILL_SFX_MAP[skillId];
  if (sfxKey) sfx(sfxKey);
}

// ============================================================
// NPC BLEEP — playNpcBleep(npcName)
// ============================================================
function playNpcBleep(npcName) {
  const name = (npcName || '').toLowerCase();
  sfx('npcTalk', {npc: name});
}

// ============================================================
// ENEMY SOUND — playEnemySound(type, event)
// ============================================================
// type: 'slime','bat','skeleton','wolf','zombie','ghost','golem','demon'
// event: 'ambient' (default), 'death'
const ENEMY_DEATH_SFX = {
  slime:    'death_slime',
  skeleton: 'death_skeleton',
  ghost:    'death_ghost',
  demon:    'death_demon',
  bat:      'death_generic',
  wolf:     'death_generic',
  zombie:   'death_generic',
  golem:    'death_generic',
};

function playEnemySound(type, event) {
  if (event === 'death') {
    const deathSfx = ENEMY_DEATH_SFX[type] || 'death_generic';
    sfx(deathSfx);
  } else {
    sfx('enemy_' + type);
  }
}

// ============================================================
// stopMusic — alias for stopBgMusic (GDD §23 interface)
// ============================================================
function stopMusic() {
  stopBgMusic();
  currentBiome = null;
}

// Post-boss transition: silence 2s → biome fade in
function postBossTransition(biomeKey) {
  stopBgMusic();
  currentBiome = null;
  setTimeout(() => {
    if (!audioCtx) return;
    try {
      const t = audioCtx.currentTime;
      const master = audioCtx.createGain();
      const targetVol = musicVolume * 0.06;
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(Math.max(targetVol, 0.0001), t + 1);
      master.connect(audioCtx.destination);
      const builder = BIOME_MUSIC[biomeKey] || BIOME_MUSIC.menu;
      const oscs = builder(t, master);
      bgMusic = { gain: master, oscs };
      currentBiome = biomeKey;
    } catch(e) { console.error('[Music] postBoss error:', e); }
  }, 2000);
}

document.addEventListener('click', () => { initAudio(); startBiomeMusic('menu'); }, {once:true});
document.addEventListener('keydown', () => { initAudio(); startBiomeMusic('menu'); }, {once:true});

// ============================================================
// BIOME MUSIC SYSTEM (GDD §23) — procedural per-biome themes
// ============================================================
let currentBiome = null;

// Biome music definitions: each returns array of {osc, gain} nodes
const BIOME_MUSIC = {
  menu(t, master) {
    // Soft ambient loop — gentle sine pad
    const o1 = audioCtx.createOscillator(); o1.type='sine'; o1.frequency.setValueAtTime(220,t);
    const g1 = audioCtx.createGain(); g1.gain.setValueAtTime(0.5,t);
    o1.connect(g1); g1.connect(master); o1.start(t);
    const o2 = audioCtx.createOscillator(); o2.type='sine'; o2.frequency.setValueAtTime(330,t);
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.25,t);
    o2.connect(g2); g2.connect(master); o2.start(t);
    // Gentle LFO
    const lfo = audioCtx.createOscillator(); lfo.type='sine'; lfo.frequency.setValueAtTime(0.1,t);
    const lg = audioCtx.createGain(); lg.gain.setValueAtTime(0.01,t);
    lfo.connect(lg); lg.connect(master.gain); lfo.start(t);
    return [o1,o2,lfo];
  },
  B1(t, master) {
    // Masmorras: light percussion feel + low tone
    const o1 = audioCtx.createOscillator(); o1.type='sine'; o1.frequency.setValueAtTime(55,t);
    const g1 = audioCtx.createGain(); g1.gain.setValueAtTime(0.6,t);
    o1.connect(g1); g1.connect(master); o1.start(t);
    const o2 = audioCtx.createOscillator(); o2.type='square'; o2.frequency.setValueAtTime(2,t);
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.02,t);
    o2.connect(g2); g2.connect(master); o2.start(t);
    const o3 = audioCtx.createOscillator(); o3.type='triangle'; o3.frequency.setValueAtTime(110,t);
    const g3 = audioCtx.createGain(); g3.gain.setValueAtTime(0.2,t);
    o3.connect(g3); g3.connect(master); o3.start(t);
    return [o1,o2,o3];
  },
  B2(t, master) {
    // Catacumbas: whispered choir + dissonant
    const o1 = audioCtx.createOscillator(); o1.type='sine'; o1.frequency.setValueAtTime(185,t);
    const g1 = audioCtx.createGain(); g1.gain.setValueAtTime(0.3,t);
    o1.connect(g1); g1.connect(master); o1.start(t);
    const o2 = audioCtx.createOscillator(); o2.type='sine'; o2.frequency.setValueAtTime(196,t); // dissonant
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.25,t);
    o2.connect(g2); g2.connect(master); o2.start(t);
    // Slow LFO for choir-like tremolo
    const lfo = audioCtx.createOscillator(); lfo.type='sine'; lfo.frequency.setValueAtTime(4,t);
    const lg = audioCtx.createGain(); lg.gain.setValueAtTime(0.15,t);
    lfo.connect(lg); lg.connect(g1.gain); lfo.start(t);
    const o3 = audioCtx.createOscillator(); o3.type='sawtooth'; o3.frequency.setValueAtTime(65,t);
    const g3 = audioCtx.createGain(); g3.gain.setValueAtTime(0.1,t);
    o3.connect(g3); g3.connect(master); o3.start(t);
    return [o1,o2,o3,lfo];
  },
  B3(t, master) {
    // Ruínas: crystal bells + harp
    const o1 = audioCtx.createOscillator(); o1.type='sine'; o1.frequency.setValueAtTime(880,t);
    const g1 = audioCtx.createGain(); g1.gain.setValueAtTime(0.15,t);
    o1.connect(g1); g1.connect(master); o1.start(t);
    const o2 = audioCtx.createOscillator(); o2.type='sine'; o2.frequency.setValueAtTime(1320,t);
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.1,t);
    o2.connect(g2); g2.connect(master); o2.start(t);
    // Arpeggio LFO on freq
    const lfo = audioCtx.createOscillator(); lfo.type='sine'; lfo.frequency.setValueAtTime(0.3,t);
    const lg = audioCtx.createGain(); lg.gain.setValueAtTime(50,t);
    lfo.connect(lg); lg.connect(o1.frequency); lfo.start(t);
    const o3 = audioCtx.createOscillator(); o3.type='triangle'; o3.frequency.setValueAtTime(440,t);
    const g3 = audioCtx.createGain(); g3.gain.setValueAtTime(0.2,t);
    o3.connect(g3); g3.connect(master); o3.start(t);
    return [o1,o2,o3,lfo];
  },
  B4(t, master) {
    // Profundezas: heavy drums feel + bass
    const o1 = audioCtx.createOscillator(); o1.type='sawtooth'; o1.frequency.setValueAtTime(36,t);
    const g1 = audioCtx.createGain(); g1.gain.setValueAtTime(0.5,t);
    o1.connect(g1); g1.connect(master); o1.start(t);
    const o2 = audioCtx.createOscillator(); o2.type='square'; o2.frequency.setValueAtTime(1.5,t); // rhythmic pulse
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.04,t);
    o2.connect(g2); g2.connect(master); o2.start(t);
    const o3 = audioCtx.createOscillator(); o3.type='sine'; o3.frequency.setValueAtTime(73,t);
    const g3 = audioCtx.createGain(); g3.gain.setValueAtTime(0.3,t);
    o3.connect(g3); g3.connect(master); o3.start(t);
    // Sub vibrato
    const lfo = audioCtx.createOscillator(); lfo.type='sine'; lfo.frequency.setValueAtTime(0.2,t);
    const lg = audioCtx.createGain(); lg.gain.setValueAtTime(3,t);
    lfo.connect(lg); lg.connect(o1.frequency); lfo.start(t);
    return [o1,o2,o3,lfo];
  },
  B5(t, master) {
    // Fortaleza: ominous organ + tense strings
    const o1 = audioCtx.createOscillator(); o1.type='sawtooth'; o1.frequency.setValueAtTime(82,t);
    const g1 = audioCtx.createGain(); g1.gain.setValueAtTime(0.3,t);
    o1.connect(g1); g1.connect(master); o1.start(t);
    const o2 = audioCtx.createOscillator(); o2.type='sawtooth'; o2.frequency.setValueAtTime(164,t);
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.15,t);
    o2.connect(g2); g2.connect(master); o2.start(t);
    const o3 = audioCtx.createOscillator(); o3.type='square'; o3.frequency.setValueAtTime(246,t);
    const g3 = audioCtx.createGain(); g3.gain.setValueAtTime(0.08,t);
    o3.connect(g3); g3.connect(master); o3.start(t);
    // Tension LFO
    const lfo = audioCtx.createOscillator(); lfo.type='sine'; lfo.frequency.setValueAtTime(0.08,t);
    const lg = audioCtx.createGain(); lg.gain.setValueAtTime(0.02,t);
    lfo.connect(lg); lg.connect(master.gain); lfo.start(t);
    return [o1,o2,o3,lfo];
  },
  boss(t, master) {
    // Epic boss theme: fast tempo, high intensity
    const o1 = audioCtx.createOscillator(); o1.type='sawtooth'; o1.frequency.setValueAtTime(55,t);
    const g1 = audioCtx.createGain(); g1.gain.setValueAtTime(0.5,t);
    o1.connect(g1); g1.connect(master); o1.start(t);
    const o2 = audioCtx.createOscillator(); o2.type='square'; o2.frequency.setValueAtTime(110,t);
    const g2 = audioCtx.createGain(); g2.gain.setValueAtTime(0.3,t);
    o2.connect(g2); g2.connect(master); o2.start(t);
    // Fast rhythmic pulse
    const o3 = audioCtx.createOscillator(); o3.type='square'; o3.frequency.setValueAtTime(3,t);
    const g3 = audioCtx.createGain(); g3.gain.setValueAtTime(0.06,t);
    o3.connect(g3); g3.connect(master); o3.start(t);
    // Aggressive LFO
    const lfo = audioCtx.createOscillator(); lfo.type='sawtooth'; lfo.frequency.setValueAtTime(0.5,t);
    const lg = audioCtx.createGain(); lg.gain.setValueAtTime(8,t);
    lfo.connect(lg); lg.connect(o1.frequency); lfo.start(t);
    // High tension layer
    const o4 = audioCtx.createOscillator(); o4.type='triangle'; o4.frequency.setValueAtTime(220,t);
    const g4 = audioCtx.createGain(); g4.gain.setValueAtTime(0.15,t);
    o4.connect(g4); g4.connect(master); o4.start(t);
    return [o1,o2,o3,o4,lfo];
  }
};

function startBiomeMusic(biome) {
  if (!audioCtx) initAudio();
  if (!audioCtx) return;
  if (currentBiome === biome && bgMusic) return; // already playing
  stopBgMusic();
  currentBiome = biome;
  try {
    const t = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(musicVolume * 0.06, t);
    master.connect(audioCtx.destination);
    const builder = BIOME_MUSIC[biome] || BIOME_MUSIC.menu;
    const oscs = builder(t, master);
    bgMusic = { gain: master, oscs };
  } catch(e) { console.error('[Music] error:', e); }
}

// Legacy compat: startBgMusic starts menu music
function startBgMusic() {
  startBiomeMusic(currentBiome || 'menu');
}

function updateMusicVolume() {
  if (bgMusic && bgMusic.gain) {
    bgMusic.gain.gain.setValueAtTime(musicVolume * 0.06, audioCtx.currentTime);
  }
}

function stopBgMusic() {
  if (!bgMusic) return;
  try {
    if (bgMusic.oscs) bgMusic.oscs.forEach(o => { try { o.stop(); } catch(e) {} });
    // Legacy format
    if (bgMusic.osc1) { bgMusic.osc1.stop(); bgMusic.osc2.stop(); bgMusic.lfo.stop(); }
  } catch(e) {}
  bgMusic = null;
}

// GDD §23: Music transition — fade out → silence → fade in
function transitionMusic(newBiome) {
  if (!audioCtx) { startBiomeMusic(newBiome); return; }
  const t = audioCtx.currentTime;
  const isBoss = newBiome === 'boss';
  if (bgMusic && bgMusic.gain) {
    // Fade out current (1s)
    bgMusic.gain.gain.setValueAtTime(bgMusic.gain.gain.value, t);
    bgMusic.gain.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    const oldMusic = bgMusic;
    bgMusic = null;
    setTimeout(() => {
      try {
        if (oldMusic.oscs) oldMusic.oscs.forEach(o => { try { o.stop(); } catch(e) {} });
        if (oldMusic.osc1) { oldMusic.osc1.stop(); oldMusic.osc2.stop(); oldMusic.lfo.stop(); }
      } catch(e) {}
    }, 1100);
    // After silence gap, start new biome with fade in
    const silenceGap = isBoss ? 0.2 : 0.5;
    setTimeout(() => {
      currentBiome = newBiome;
      try {
        const t2 = audioCtx.currentTime;
        const master = audioCtx.createGain();
        const targetVol = musicVolume * 0.06;
        if (isBoss) {
          // Boss enters strong
          master.gain.setValueAtTime(targetVol * 0.5, t2);
          master.gain.linearRampToValueAtTime(targetVol, t2 + 0.5);
        } else {
          // Normal fade in (1s)
          master.gain.setValueAtTime(0.0001, t2);
          master.gain.exponentialRampToValueAtTime(Math.max(targetVol, 0.0001), t2 + 1);
        }
        master.connect(audioCtx.destination);
        const builder = BIOME_MUSIC[newBiome] || BIOME_MUSIC.menu;
        const oscs = builder(t2, master);
        bgMusic = { gain: master, oscs };
      } catch(e) { console.error('[Music] transition error:', e); }
    }, (1 + silenceGap) * 1000);
  } else {
    startBiomeMusic(newBiome);
  }
}

// ============================================================
// SCREEN EFFECTS
// ============================================================
let screenShake = {intensity:0, duration:0, timer:0};
let screenFlash = {color:'#fff', alpha:0, duration:0, timer:0};

function shakeScreen(intensity, duration) {
  screenShake.intensity = Math.max(screenShake.intensity, intensity);
  screenShake.duration = duration; screenShake.timer = 0;
}
function flashScreen(color, alpha, duration) {
  screenFlash = {color, alpha, duration, timer:0};
}
