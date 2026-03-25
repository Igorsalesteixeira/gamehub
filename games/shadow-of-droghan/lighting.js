'use strict';
// lighting.js — Sistema de Iluminação Dinâmica, Sombras, Post-Processing
// Canvas2D lightMap composited com multiply para iluminação real

// ============================================================
// LIGHT MAP CANVAS
// ============================================================
let lightCanvas = null;
let lightCtx = null;
let lightingEnabled = false;

function initLighting() {
  lightCanvas = document.createElement('canvas');
  lightCanvas.width = VIEW_W;
  lightCanvas.height = VIEW_H;
  lightCtx = lightCanvas.getContext('2d');
}

// ============================================================
// LIGHT SOURCES
// ============================================================

// Ambient light level per biome (0 = total darkness, 1 = full bright)
const BIOME_AMBIENT = {
  1: 0.08,   // B1: Catacumbas — muito escuro
  2: 0.06,   // B2: Cripta — mais escuro ainda
  3: 0.10,   // B3: Minas — um pouco mais claro (lava)
  4: 0.05,   // B4: Abismo — quase total escuridão
  5: 0.04,   // B5: Trono — escuridão opressiva
};

// Light color per biome
const BIOME_LIGHT_COLOR = {
  1: { r: 255, g: 200, b: 120 },  // Quente (tochas)
  2: { r: 150, g: 180, b: 255 },  // Frio/azulado (espectral)
  3: { r: 255, g: 140, b: 60 },   // Alaranjado (lava/fogo)
  4: { r: 180, g: 120, b: 255 },  // Roxo (arcano)
  5: { r: 255, g: 80, b: 80 },    // Vermelho (sangue/trono)
};

function getBiomeIndex() {
  if (typeof currentFloor === 'undefined') return 1;
  return Math.ceil(currentFloor / 5);
}

// ============================================================
// RENDER LIGHT MAP
// ============================================================
function renderLightMap() {
  if (!lightCanvas || !lightingEnabled) return;

  const biome = getBiomeIndex();
  const ambient = BIOME_AMBIENT[biome] || 0.08;
  const lightColor = BIOME_LIGHT_COLOR[biome] || { r: 255, g: 200, b: 120 };

  // Preencher com escuridão (quase preto, com ambient sutil)
  lightCtx.fillStyle = `rgba(0, 0, 0, 1)`;
  lightCtx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Ambient light base (muito sutil)
  lightCtx.fillStyle = `rgba(${lightColor.r}, ${lightColor.g}, ${lightColor.b}, ${ambient})`;
  lightCtx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Modo de composição: lighten (cada luz ADICIONA brilho)
  lightCtx.globalCompositeOperation = 'lighten';

  // --- PLAYER LIGHT (lanterna/aura pessoal) ---
  const px = Math.round(player.x - camX);
  const py = Math.round(player.y - camY) - 8;
  const playerRadius = 90;
  const playerGrad = lightCtx.createRadialGradient(px, py, 0, px, py, playerRadius);
  playerGrad.addColorStop(0, `rgba(${lightColor.r}, ${lightColor.g}, ${lightColor.b}, 0.7)`);
  playerGrad.addColorStop(0.4, `rgba(${lightColor.r}, ${lightColor.g}, ${lightColor.b}, 0.3)`);
  playerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  lightCtx.fillStyle = playerGrad;
  lightCtx.fillRect(px - playerRadius, py - playerRadius, playerRadius * 2, playerRadius * 2);

  // --- TORCH LIGHTS ---
  if (typeof decorations !== 'undefined') {
    const t = performance.now() / 1000;
    for (const dec of decorations) {
      if (dec.type !== 'torch') continue;
      if (typeof getFog === 'function' && getFog(dec.x, dec.y) === 0) continue;

      const tx = Math.round(dec.x * TILE + TILE / 2 - camX);
      const ty = Math.round(dec.y * TILE + TILE / 4 - camY);

      // Flicker effect — radius oscila
      const flicker = Math.sin(t * 4 + dec.x * 7.3 + dec.y * 3.1) * 8
                    + Math.sin(t * 7 + dec.x * 2.1) * 4;
      const radius = 70 + flicker;

      // Intensidade com flicker
      const intensity = 0.6 + Math.sin(t * 5 + dec.x * 11) * 0.1;

      const grad = lightCtx.createRadialGradient(tx, ty, 0, tx, ty, radius);
      grad.addColorStop(0, `rgba(255, 180, 80, ${intensity})`);
      grad.addColorStop(0.3, `rgba(255, 140, 40, ${intensity * 0.5})`);
      grad.addColorStop(0.7, `rgba(200, 80, 20, ${intensity * 0.15})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lightCtx.fillStyle = grad;
      lightCtx.fillRect(tx - radius, ty - radius, radius * 2, radius * 2);
    }
  }

  // --- LAVA / HAZARD GLOW ---
  if (typeof hazards !== 'undefined') {
    for (const h of hazards) {
      if (h.broken) continue;
      if (h.type !== 'lava' && h.type !== 'acid') continue;
      if (typeof getFog === 'function' && getFog(h.x, h.y) === 0) continue;

      const hx = Math.round(h.x * TILE + TILE / 2 - camX);
      const hy = Math.round(h.y * TILE + TILE / 2 - camY);
      const radius = 40;
      const color = h.type === 'lava' ? '255, 100, 20' : '40, 255, 80';
      const grad = lightCtx.createRadialGradient(hx, hy, 0, hx, hy, radius);
      grad.addColorStop(0, `rgba(${color}, 0.4)`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lightCtx.fillStyle = grad;
      lightCtx.fillRect(hx - radius, hy - radius, radius * 2, radius * 2);
    }
  }

  // --- PROJECTILE GLOW ---
  if (typeof projectiles !== 'undefined') {
    for (const p of projectiles) {
      const ppx = Math.round(p.x - camX);
      const ppy = Math.round(p.y - camY);
      const radius = 30;
      const grad = lightCtx.createRadialGradient(ppx, ppy, 0, ppx, ppy, radius);
      grad.addColorStop(0, `rgba(${lightColor.r}, ${lightColor.g}, ${lightColor.b}, 0.5)`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lightCtx.fillStyle = grad;
      lightCtx.fillRect(ppx - radius, ppy - radius, radius * 2, radius * 2);
    }
  }

  // --- PLAYER PROJECTILE GLOW ---
  if (typeof playerProjectiles !== 'undefined') {
    for (const p of playerProjectiles) {
      const ppx = Math.round(p.x - camX);
      const ppy = Math.round(p.y - camY);
      const radius = 25;
      const color = p.color || '#ffdd44';
      const grad = lightCtx.createRadialGradient(ppx, ppy, 0, ppx, ppy, radius);
      grad.addColorStop(0, `rgba(255, 220, 100, 0.5)`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lightCtx.fillStyle = grad;
      lightCtx.fillRect(ppx - radius, ppy - radius, radius * 2, radius * 2);
    }
  }

  // --- ESSÊNCIA GLOW (player aura dourada quando skills ativas) ---
  if (typeof player !== 'undefined') {
    const essActive = (typeof hasBuff === 'function') &&
      (hasBuff('despertarP') || hasBuff('despertarT') || player.essenciaShieldTimer > 0);
    if (essActive) {
      const radius = 60;
      const grad = lightCtx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
      grad.addColorStop(0.5, 'rgba(255, 180, 0, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lightCtx.fillStyle = grad;
      lightCtx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
    }
  }

  // --- ATTACK FLASH (breve flash de luz no ataque) ---
  if (typeof player !== 'undefined' && player.attackAnim > 0) {
    const atkAngle = player.dir || 0;
    const ax = px + Math.cos(atkAngle) * 16;
    const ay = py + Math.sin(atkAngle) * 16;
    const radius = 35;
    const alpha = player.attackAnim / 0.2 * 0.6;
    const grad = lightCtx.createRadialGradient(ax, ay, 0, ax, ay, radius);
    grad.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lightCtx.fillStyle = grad;
    lightCtx.fillRect(ax - radius, ay - radius, radius * 2, radius * 2);
  }

  // Reset composite operation
  lightCtx.globalCompositeOperation = 'source-over';
}

// ============================================================
// APPLY LIGHTING TO MAIN CANVAS
// ============================================================
function applyLighting() {
  if (!lightCanvas || !lightingEnabled) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lightCanvas, 0, 0);
  ctx.restore();
}

// ============================================================
// ENTITY SHADOWS
// ============================================================
function renderEntityShadow(sx, sy, w, h) {
  // Sombra oval escura embaixo da entidade
  const shadowW = w * 0.7;
  const shadowH = h * 0.25;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 2, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============================================================
// POST-PROCESSING
// ============================================================

// Vinheta — escurecimento nas bordas da tela
function renderVignette() {
  const grad = ctx.createRadialGradient(
    VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.3,
    VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.75
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// Color grading sutil por bioma
function renderColorGrading() {
  const biome = getBiomeIndex();
  const grading = {
    1: 'rgba(40, 30, 15, 0.08)',    // Sépia quente
    2: 'rgba(20, 25, 50, 0.10)',    // Azul frio
    3: 'rgba(50, 20, 10, 0.08)',    // Vermelho lava
    4: 'rgba(30, 15, 50, 0.10)',    // Roxo arcano
    5: 'rgba(50, 10, 10, 0.12)',    // Vermelho sangue
  };
  const color = grading[biome] || grading[1];
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// ============================================================
// AMBIENT PARTICLES
// ============================================================
const ambientParticles = [];
const MAX_AMBIENT = 30;

function initAmbientParticles() {
  ambientParticles.length = 0;
  for (let i = 0; i < MAX_AMBIENT; i++) {
    ambientParticles.push(createAmbientParticle(true));
  }
}

function createAmbientParticle(randomY) {
  const biome = getBiomeIndex();
  const types = {
    1: { color: 'rgba(200, 180, 140, 0.3)', size: 1.5 },  // Poeira
    2: { color: 'rgba(140, 160, 220, 0.25)', size: 1 },    // Névoa espectral
    3: { color: 'rgba(255, 120, 40, 0.3)', size: 2 },      // Cinzas/brasas
    4: { color: 'rgba(160, 100, 255, 0.2)', size: 1.5 },   // Partículas arcanas
    5: { color: 'rgba(200, 50, 50, 0.2)', size: 1 },       // Névoa vermelha
  };
  const t = types[biome] || types[1];
  return {
    x: Math.random() * VIEW_W,
    y: randomY ? Math.random() * VIEW_H : -5,
    vx: (Math.random() - 0.5) * 8,
    vy: Math.random() * 6 + 2,
    size: t.size + Math.random() * 1.5,
    color: t.color,
    life: 8 + Math.random() * 8,
    timer: 0,
    wobble: Math.random() * Math.PI * 2,
  };
}

function updateAmbientParticles(dt) {
  for (let i = 0; i < ambientParticles.length; i++) {
    const p = ambientParticles[i];
    p.timer += dt;
    p.wobble += dt * 1.5;
    p.x += (p.vx + Math.sin(p.wobble) * 3) * dt;
    p.y += p.vy * dt;

    // Reset if off screen or expired
    if (p.y > VIEW_H + 10 || p.x < -10 || p.x > VIEW_W + 10 || p.timer > p.life) {
      ambientParticles[i] = createAmbientParticle(false);
    }
  }
}

function renderAmbientParticles() {
  for (const p of ambientParticles) {
    const alpha = Math.min(1, p.timer / 1) * Math.max(0, 1 - p.timer / p.life);
    if (alpha < 0.01) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(Math.round(p.x), Math.round(p.y), p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
