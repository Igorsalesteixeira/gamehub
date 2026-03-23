import '../../auth-check.js';
// =============================================
//  RITMO BRASILEIRO — game.js
//  Guitar Hero-style rhythm game with procedural Brazilian music
// =============================================
import { onGameEnd } from '../shared/game-integration.js';

// ---- DOM ----
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayIcon = document.getElementById('overlay-icon');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const btnStart = document.getElementById('btn-start');
const btnShare = document.getElementById('btn-share');
const scoreDisplay = document.getElementById('score-display');
const bestDisplay = document.getElementById('best-display');
const genreModal = document.getElementById('genre-modal');
const comboDisplay = document.getElementById('combo-display');
const comboCount = document.getElementById('combo-count');
const comboMult = document.getElementById('combo-mult');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const timingFeedback = document.getElementById('timing-feedback');
const mobileControls = document.getElementById('mobile-controls');

// ---- Constants ----
const LANE_COLORS = ['#ff4466', '#4488ff', '#44ff88', '#ffdd44'];
const LANE_GLOW   = ['rgba(255,68,102,', 'rgba(68,136,255,', 'rgba(68,255,136,', 'rgba(255,221,68,'];
const NUM_LANES = 4;
const NOTE_HEIGHT = 24;
const NOTE_RADIUS = 6;
const HIT_ZONE_Y_RATIO = 0.85; // fraction of canvas height
const PERFECT_WINDOW = 50; // ms
const GOOD_WINDOW = 100; // ms

const KEY_MAP = { 'd': 0, 'f': 1, 'j': 2, 'k': 3 };

// ---- Genre Definitions ----
const GENRES = {
  samba: {
    name: 'Samba', bpm: 100, emoji: '🥁',
    bgColor1: '#2a0a3e', bgColor2: '#1a0528',
    // Pattern weights per lane per beat subdivision (16ths)
    // Higher = more likely to place a note
    patterns: {
      easy:   [3,0,1,0, 2,0,0,0, 3,0,1,0, 2,0,0,0],
      normal: [4,0,2,1, 3,0,1,0, 4,0,2,1, 3,1,0,1],
      hard:   [5,1,3,2, 4,1,2,1, 5,1,3,2, 4,2,1,2]
    }
  },
  bossa: {
    name: 'Bossa Nova', bpm: 80, emoji: '🎸',
    bgColor1: '#0a1e3e', bgColor2: '#05102e',
    patterns: {
      easy:   [2,0,0,1, 0,0,2,0, 1,0,0,1, 0,0,2,0],
      normal: [3,0,1,2, 0,1,3,0, 2,0,1,2, 0,1,3,1],
      hard:   [4,1,2,3, 1,2,4,1, 3,1,2,3, 1,2,4,2]
    }
  },
  funk: {
    name: 'Funk Carioca', bpm: 130, emoji: '🔊',
    bgColor1: '#2e0a2e', bgColor2: '#1e0520',
    patterns: {
      easy:   [3,0,0,0, 2,0,0,0, 0,0,3,0, 2,0,0,0],
      normal: [4,0,1,0, 3,0,1,0, 1,0,4,0, 3,0,1,1],
      hard:   [5,1,2,1, 4,1,2,1, 2,1,5,1, 4,1,2,2]
    }
  },
  forro: {
    name: 'Forro', bpm: 120, emoji: '🪗',
    bgColor1: '#2e1a0a', bgColor2: '#1e1005',
    patterns: {
      easy:   [2,0,2,0, 1,0,2,0, 2,0,1,0, 2,0,1,0],
      normal: [3,1,3,0, 2,1,3,0, 3,0,2,1, 3,0,2,1],
      hard:   [4,2,4,1, 3,2,4,1, 4,1,3,2, 4,1,3,2]
    }
  },
  baiao: {
    name: 'Baiao', bpm: 110, emoji: '🪘',
    bgColor1: '#1a2e0a', bgColor2: '#102005',
    patterns: {
      easy:   [3,0,0,2, 0,0,3,0, 0,2,0,0, 3,0,0,1],
      normal: [4,0,1,3, 1,0,4,0, 1,3,0,1, 4,1,0,2],
      hard:   [5,1,2,4, 2,1,5,1, 2,4,1,2, 5,2,1,3]
    }
  }
};

// ---- Audio Engine ----
let audioCtx = null;
let masterGain = null;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Procedural sound generators
function playKick(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
  gain.gain.setValueAtTime(0.8, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + 0.25);
}

function playSnare(time) {
  // Noise burst
  const bufferSize = audioCtx.sampleRate * 0.1;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.5, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000;
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noise.start(time);
  noise.stop(time + 0.12);

  // Tone body
  const osc = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, time);
  osc.frequency.exponentialRampToValueAtTime(60, time + 0.08);
  oscGain.gain.setValueAtTime(0.4, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  osc.connect(oscGain);
  oscGain.connect(masterGain);
  osc.start(time);
  osc.stop(time + 0.1);
}

function playHiHat(time, open = false) {
  const bufferSize = audioCtx.sampleRate * (open ? 0.15 : 0.05);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.2, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.15 : 0.05));
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  noise.connect(hp);
  hp.connect(gain);
  gain.connect(masterGain);
  noise.start(time);
  noise.stop(time + (open ? 0.15 : 0.05));
}

function playAgogo(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800 + Math.random() * 400, time);
  gain.gain.setValueAtTime(0.15, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + 0.08);
}

function playTriangle(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(4000, time);
  gain.gain.setValueAtTime(0.2, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + 0.04);
}

function playBassNote(time, freq = 55) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.4, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + 0.4);
}

function playGuitarNote(time, freq = 220) {
  // Simulated pluck with harmonics
  for (let h = 1; h <= 4; h++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * h;
    const amp = 0.15 / h;
    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3 / h);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.35);
  }
}

function playSanfona(time, freq = 330) {
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc1.type = 'sawtooth';
  osc2.type = 'sawtooth';
  osc1.frequency.value = freq;
  osc2.frequency.value = freq * 1.005; // slight detune
  gain.gain.setValueAtTime(0.08, time);
  gain.gain.setValueAtTime(0.08, time + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(masterGain);
  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + 0.25);
  osc2.stop(time + 0.25);
}

function play808(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(55, time);
  osc.frequency.exponentialRampToValueAtTime(30, time + 0.5);
  gain.gain.setValueAtTime(0.7, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + 0.5);
}

function playClap(time) {
  for (let i = 0; i < 3; i++) {
    const d = i * 0.01;
    const bufferSize = audioCtx.sampleRate * 0.04;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) data[j] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, time + d);
    gain.gain.exponentialRampToValueAtTime(0.001, time + d + 0.08);
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2000;
    noise.connect(bp);
    bp.connect(gain);
    gain.connect(masterGain);
    noise.start(time + d);
    noise.stop(time + d + 0.08);
  }
}

function playZabumba(time) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.2);
  gain.gain.setValueAtTime(0.6, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + 0.2);
}

// Sound pool per genre per beat subdivision step
function getSoundForGenre(genre, step, lane) {
  const funcs = {
    samba: [playKick, playHiHat, playSnare, playAgogo],
    bossa: [playBassNote, playGuitarNote, playGuitarNote, playHiHat],
    funk:  [play808, playClap, playHiHat, playSnare],
    forro: [playZabumba, playTriangle, playHiHat, playSanfona],
    baiao: [playZabumba, playTriangle, playSanfona, playHiHat]
  };
  return (funcs[genre] || funcs.samba)[lane];
}

// Play hit feedback sound
function playHitSound(quality) {
  ensureAudio();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  if (quality === 'perfect') {
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1100, now + 0.05);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  } else if (quality === 'good') {
    osc.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  } else {
    osc.frequency.setValueAtTime(200, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  }
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.15);
}

// ---- State ----
let gameState = 'menu'; // menu, genre-select, playing, gameover
let currentGenre = null;
let difficulty = 'normal';
let score = 0;
let combo = 0;
let maxCombo = 0;
let multiplier = 1;
let notes = []; // {lane, time, hit, y}
let particles = [];
let songStartTime = 0;
let songDuration = 0; // ms
let beatmap = [];
let scheduledBeats = new Set();
let laneFlash = [0, 0, 0, 0]; // flash intensity per lane
let animFrame = null;
let bestScore = parseInt(localStorage.getItem('ritmo_best') || '0', 10);
let perfects = 0;
let goods = 0;
let misses = 0;
let isMobile = false;

// ---- Canvas sizing ----
function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

// ---- Beatmap generation ----
function generateBeatmap(genreKey, diff) {
  const genre = GENRES[genreKey];
  const bpm = genre.bpm;
  const pattern = genre.patterns[diff];
  const sixteenthDuration = (60 / bpm) / 4 * 1000; // ms per 16th note
  const totalSixteenths = Math.floor(75000 / sixteenthDuration); // ~75 seconds
  songDuration = totalSixteenths * sixteenthDuration;

  const map = [];
  const rng = mulberry32(Date.now());

  for (let i = 0; i < totalSixteenths; i++) {
    const patIdx = i % pattern.length;
    const weight = pattern[patIdx];
    if (weight > 0 && rng() * 6 < weight) {
      // Pick a lane — sometimes pick based on pattern position for musicality
      let lane;
      if (rng() < 0.3) {
        lane = patIdx % NUM_LANES;
      } else {
        lane = Math.floor(rng() * NUM_LANES);
      }
      const time = i * sixteenthDuration;
      // Avoid notes too close together on same lane
      const lastOnLane = map.filter(n => n.lane === lane);
      const lastTime = lastOnLane.length > 0 ? lastOnLane[lastOnLane.length - 1].time : -1000;
      if (time - lastTime >= sixteenthDuration * 2) {
        map.push({ lane, time, hit: false });
      }
    }
  }
  return map;
}

// Simple seeded random
function mulberry32(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Schedule audio for the beatmap ----
function scheduleAudio() {
  if (!audioCtx || gameState !== 'playing') return;
  const now = performance.now();
  const songTime = now - songStartTime;
  const lookAhead = 200; // ms

  for (let i = 0; i < beatmap.length; i++) {
    const note = beatmap[i];
    if (note.time >= songTime && note.time < songTime + lookAhead && !scheduledBeats.has(i)) {
      scheduledBeats.add(i);
      const audioTime = audioCtx.currentTime + (note.time - songTime) / 1000;
      const soundFn = getSoundForGenre(currentGenre, i % 16, note.lane);
      try { soundFn(audioTime); } catch(e) {}
    }
  }
}

// ---- Input handling ----
function hitLane(lane) {
  if (gameState !== 'playing') return;

  const now = performance.now();
  const songTime = now - songStartTime;
  const hitZoneY = getHitZoneY();

  // Find closest unhit note in this lane
  let closest = null;
  let closestDiff = Infinity;

  for (const note of beatmap) {
    if (note.hit || note.lane !== lane) continue;
    const diff = Math.abs(note.time - songTime);
    if (diff < closestDiff && diff < GOOD_WINDOW + 50) {
      closest = note;
      closestDiff = diff;
    }
  }

  laneFlash[lane] = 1.0;

  if (!closest) {
    return; // no note nearby, just flash
  }

  const diff = closestDiff;

  if (diff <= PERFECT_WINDOW) {
    closest.hit = true;
    perfects++;
    combo++;
    updateMultiplier();
    score += 100 * multiplier;
    showTimingFeedback('PERFEITO!', 'perfect');
    playHitSound('perfect');
    spawnParticles(lane, hitZoneY, LANE_COLORS[lane]);
  } else if (diff <= GOOD_WINDOW) {
    closest.hit = true;
    goods++;
    combo++;
    updateMultiplier();
    score += 50 * multiplier;
    showTimingFeedback('BOM!', 'good');
    playHitSound('good');
  } else {
    combo = 0;
    multiplier = 1;
    misses++;
    showTimingFeedback('ERROU!', 'miss');
    playHitSound('miss');
  }

  if (combo > maxCombo) maxCombo = combo;
  updateHUD();
}

function updateMultiplier() {
  if (combo >= 40) multiplier = 8;
  else if (combo >= 20) multiplier = 4;
  else if (combo >= 10) multiplier = 2;
  else multiplier = 1;
}

function getHitZoneY() {
  const h = canvas.height / window.devicePixelRatio;
  return h * HIT_ZONE_Y_RATIO;
}

function getLaneWidth() {
  const w = canvas.width / window.devicePixelRatio;
  return w / NUM_LANES;
}

// ---- UI Feedback ----
let feedbackTimer = null;
function showTimingFeedback(text, type) {
  timingFeedback.textContent = text;
  timingFeedback.className = 'timing-feedback show timing-' + type;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    timingFeedback.className = 'timing-feedback';
  }, 400);
}

function updateHUD() {
  scoreDisplay.textContent = score;
  comboCount.textContent = combo;
  comboMult.textContent = 'x' + multiplier;

  if (combo > 1) {
    comboDisplay.style.display = 'flex';
  } else {
    comboDisplay.style.display = 'none';
  }
}

// ---- Particles ----
function spawnParticles(lane, y, color) {
  const lw = getLaneWidth();
  const cx = lane * lw + lw / 2;
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: cx,
      y: y,
      vx: (Math.random() - 0.5) * 6,
      vy: -(Math.random() * 4 + 2),
      life: 1,
      color: color,
      size: Math.random() * 4 + 2
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= dt * 2;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ---- Rendering ----
function render() {
  const w = canvas.width / window.devicePixelRatio;
  const h = canvas.height / window.devicePixelRatio;
  const lw = getLaneWidth();
  const hitY = getHitZoneY();
  const now = performance.now();
  const songTime = now - songStartTime;

  // Clear
  const genre = GENRES[currentGenre];
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, genre ? genre.bgColor1 : '#1a0a2e');
  grad.addColorStop(1, genre ? genre.bgColor2 : '#0d0518');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Lane dividers
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < NUM_LANES; i++) {
    ctx.beginPath();
    ctx.moveTo(i * lw, 0);
    ctx.lineTo(i * lw, h);
    ctx.stroke();
  }

  // Lane flash
  for (let i = 0; i < NUM_LANES; i++) {
    if (laneFlash[i] > 0) {
      ctx.fillStyle = LANE_GLOW[i] + (laneFlash[i] * 0.15) + ')';
      ctx.fillRect(i * lw, 0, lw, h);
      laneFlash[i] = Math.max(0, laneFlash[i] - 0.04);
    }
  }

  // Hit zone
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, hitY - 3, w, 6);

  // Hit zone lane indicators
  for (let i = 0; i < NUM_LANES; i++) {
    const cx = i * lw + lw / 2;
    ctx.beginPath();
    ctx.arc(cx, hitY, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = LANE_COLORS[i] + '44';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Key label (desktop)
    if (!isMobile) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '14px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const keys = ['D', 'F', 'J', 'K'];
      ctx.fillText(keys[i], cx, hitY);
    }
  }

  // Notes
  const noteSpeed = h * HIT_ZONE_Y_RATIO / 2000; // pixels per ms — 2 seconds to fall
  for (const note of beatmap) {
    if (note.hit) continue;
    const timeDiff = note.time - songTime;
    const noteY = hitY - timeDiff * noteSpeed;

    // Only render if on screen
    if (noteY < -NOTE_HEIGHT || noteY > h + NOTE_HEIGHT) continue;

    const x = note.lane * lw + (lw - lw * 0.7) / 2;
    const nw = lw * 0.7;

    // Glow
    ctx.shadowColor = LANE_COLORS[note.lane];
    ctx.shadowBlur = 15;

    // Note body
    ctx.fillStyle = LANE_COLORS[note.lane];
    roundRect(ctx, x, noteY - NOTE_HEIGHT / 2, nw, NOTE_HEIGHT, NOTE_RADIUS);
    ctx.fill();

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    roundRect(ctx, x + 2, noteY - NOTE_HEIGHT / 2 + 2, nw - 4, NOTE_HEIGHT / 3, NOTE_RADIUS - 1);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  // Particles
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Progress
  if (songDuration > 0) {
    const progress = Math.min(songTime / songDuration, 1);
    progressBar.style.width = (progress * 100) + '%';
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ---- Game loop ----
function gameLoop() {
  if (gameState !== 'playing') return;

  const now = performance.now();
  const songTime = now - songStartTime;
  const dt = 1 / 60;

  // Schedule audio
  scheduleAudio();

  // Check for missed notes
  for (const note of beatmap) {
    if (!note.hit && note.time < songTime - GOOD_WINDOW - 50) {
      note.hit = true; // mark as passed
      combo = 0;
      multiplier = 1;
      misses++;
      updateHUD();
    }
  }

  // Update particles
  updateParticles(dt);

  // Render
  render();

  // Check song end
  if (songTime >= songDuration + 1000) {
    endSong();
    return;
  }

  animFrame = requestAnimationFrame(gameLoop);
}

// ---- Song flow ----
function startSong(genreKey) {
  ensureAudio();
  currentGenre = genreKey;
  score = 0;
  combo = 0;
  maxCombo = 0;
  multiplier = 1;
  perfects = 0;
  goods = 0;
  misses = 0;
  notes = [];
  particles = [];
  scheduledBeats = new Set();
  laneFlash = [0, 0, 0, 0];

  beatmap = generateBeatmap(genreKey, difficulty);
  songStartTime = performance.now() + 1500; // 1.5s lead-in

  gameState = 'playing';
  genreModal.style.display = 'none';
  overlay.style.display = 'none';
  comboDisplay.style.display = 'none';
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';
  updateHUD();

  resizeCanvas();
  animFrame = requestAnimationFrame(gameLoop);
}

function endSong() {
  gameState = 'gameover';
  if (animFrame) cancelAnimationFrame(animFrame);

  const totalNotes = beatmap.length;
  const hitNotes = perfects + goods;
  const accuracy = totalNotes > 0 ? Math.round((hitNotes / totalNotes) * 100) : 0;

  // Update best
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('ritmo_best', bestScore);
  }
  bestDisplay.textContent = bestScore;

  // Show game over overlay
  overlayIcon.textContent = score > 0 ? '🎉' : '😅';
  overlayTitle.textContent = 'Fim da Musica!';
  overlayMsg.innerHTML = `
    <strong>${GENRES[currentGenre].name}</strong> — ${difficulty === 'easy' ? 'Facil' : difficulty === 'normal' ? 'Normal' : 'Dificil'}<br>
    ✨ Perfeitos: ${perfects} | 👍 Bons: ${goods} | ❌ Erros: ${misses}<br>
    🎯 Precisao: ${accuracy}% | 🔥 Max Combo: ${maxCombo}
  `;
  overlayScore.textContent = score + ' pontos';
  btnStart.textContent = 'Jogar Novamente';
  btnShare.style.display = 'inline-block';
  overlay.style.display = 'flex';
  comboDisplay.style.display = 'none';
  progressContainer.style.display = 'none';

  // Integration
  try {
    onGameEnd('ritmo', { won: score > 500, score });
  } catch(e) {}
}

// ---- Share ----
function share() {
  const genreName = GENRES[currentGenre]?.name || 'Ritmo';
  const text = `🎵 Ritmo Brasileiro: ${score} pontos no ${genreName}!\n🔥 ${maxCombo}x combo maximo!\nJogue: https://gameshub.com.br/games/ritmo/`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(text));
  }
}

// ---- Event listeners ----
function init() {
  // Detect mobile
  isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;

  bestDisplay.textContent = bestScore;

  // Resize
  resizeCanvas();
  window.addEventListener('resize', () => {
    resizeCanvas();
    if (gameState === 'playing') render();
  });

  // Start button
  btnStart.addEventListener('click', () => {
    ensureAudio();
    if (gameState === 'menu' || gameState === 'gameover') {
      overlay.style.display = 'none';
      genreModal.style.display = 'flex';
      gameState = 'genre-select';
    }
  });

  // Share button
  btnShare.addEventListener('click', share);

  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.diff;
    });
  });

  // Genre cards
  document.querySelectorAll('.genre-card').forEach(card => {
    card.addEventListener('click', () => {
      startSong(card.dataset.genre);
    });
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    const lane = KEY_MAP[e.key.toLowerCase()];
    if (lane !== undefined) {
      e.preventDefault();
      hitLane(lane);
    }
    // Escape to quit
    if (e.key === 'Escape' && gameState === 'playing') {
      gameState = 'gameover';
      endSong();
    }
  });

  // Mobile buttons
  document.querySelectorAll('.lane-btn').forEach(btn => {
    const lane = parseInt(btn.dataset.lane);

    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      hitLane(lane);
    }, { passive: false });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
    }, { passive: false });

    // Also handle mouse for hybrid devices
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      hitLane(lane);
    });

    btn.addEventListener('mouseup', () => {
      btn.classList.remove('pressed');
    });
  });

  // Touch on canvas for mobile (divide into 4 zones)
  canvas.addEventListener('touchstart', (e) => {
    if (gameState !== 'playing') return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    for (const touch of e.changedTouches) {
      const x = touch.clientX - rect.left;
      const lane = Math.floor((x / rect.width) * NUM_LANES);
      if (lane >= 0 && lane < NUM_LANES) {
        hitLane(lane);
      }
    }
  }, { passive: false });

  // Draw initial state
  resizeCanvas();
  renderIdle();
}

function renderIdle() {
  const w = canvas.width / window.devicePixelRatio;
  const h = canvas.height / window.devicePixelRatio;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1a0a2e');
  grad.addColorStop(1, '#0d0518');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Draw faint lanes
  const lw = w / NUM_LANES;
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = 1; i < NUM_LANES; i++) {
    ctx.beginPath();
    ctx.moveTo(i * lw, 0);
    ctx.lineTo(i * lw, h);
    ctx.stroke();
  }

  // Hit zone
  const hitY = h * HIT_ZONE_Y_RATIO;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, hitY - 2, w, 4);

  for (let i = 0; i < NUM_LANES; i++) {
    const cx = i * lw + lw / 2;
    ctx.beginPath();
    ctx.arc(cx, hitY, 14, 0, Math.PI * 2);
    ctx.fillStyle = LANE_COLORS[i] + '22';
    ctx.fill();
    ctx.strokeStyle = LANE_COLORS[i] + '33';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// Start
init();
