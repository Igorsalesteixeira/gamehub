'use strict';
// mobile.js — Input, Touch Controls, Joystick, Touch UI

// ============================================================
// INPUT — GDD §14: WASD + Mouse + Space
// ============================================================
const keys = {};
let mouseX = VIEW_W/2, mouseY = VIEW_H/2;
let mouseClicked = false;

document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left) * (VIEW_W / rect.width);
  mouseY = (e.clientY - rect.top) * (VIEW_H / rect.height);
});
canvas.addEventListener('mousedown', () => { mouseClicked = true; });

// ============================================================
// GDD §14 M6: MOBILE / TOUCH
// ============================================================
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// Joystick virtual — GDD §14: posição dinâmica, raio 50px, knob 20px, zona morta 8px
const joystick = {
  active: false, touchId: null,
  originX: 0, originY: 0,   // onde o toque começou (canvas coords)
  knobX: 0, knobY: 0,       // posição atual do knob
  dx: 0, dy: 0,              // -1..1 normalized
  outerR: 50, knobR: 20, deadzone: 8,
};
let lastJoyDir = 0; // último ângulo do joystick (para melee)

// Touch buttons layout (posições em canvas coords, calculadas no resize)
const touchBtns = {
  attack:    { x:0, y:0, r:24, active:false, touchId:null },
  skill:     [  // 5 skills em arco
    { x:0, y:0, r:16, active:false, touchId:null, dragAngle:null },
    { x:0, y:0, r:16, active:false, touchId:null, dragAngle:null },
    { x:0, y:0, r:16, active:false, touchId:null, dragAngle:null },
    { x:0, y:0, r:16, active:false, touchId:null, dragAngle:null },
    { x:0, y:0, r:16, active:false, touchId:null, dragAngle:null },
  ],
  essencia:  { x:0, y:0, r:14, active:false, touchId:null, holdTimer:0 },
  potion:    { x:0, y:0, r:14, active:false, touchId:null, holdTimer:0 },
  inventory: { x:0, y:0, r:14, active:false, touchId:null },
  pause:     { x:0, y:0, r:12, active:false, touchId:null },
  talk:      { x:0, y:0, r:16, visible:false, active:false, touchId:null },
};
let touchEssenciaRadial = false; // true quando segura essência (radial seleção)

// GDD §14: Recalcular posições dos botões no resize (coordenadas de canvas interno)
function layoutTouchButtons() {
  // Ataque — canto inferior direito
  touchBtns.attack.x = VIEW_W - 50;
  touchBtns.attack.y = VIEW_H - 55;
  // 5 skills em arco acima do botão de ataque
  const arcCx = VIEW_W - 50, arcCy = VIEW_H - 55, arcR = 52;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (Math.PI * (i + 0.5) / 5); // arco de 180° à esquerda/acima
    touchBtns.skill[i].x = arcCx + Math.cos(a) * arcR;
    touchBtns.skill[i].y = arcCy + Math.sin(a) * arcR;
  }
  // Essência — dourado, acima das skills
  touchBtns.essencia.x = VIEW_W - 95;
  touchBtns.essencia.y = VIEW_H - 115;
  // Poção ❤️ — abaixo do inventário
  touchBtns.potion.x = VIEW_W - 30;
  touchBtns.potion.y = VIEW_H - 115;
  // Inventário 🎒 — canto direito meio
  touchBtns.inventory.x = VIEW_W - 18;
  touchBtns.inventory.y = VIEW_H / 2;
  // Pausar ⏸ — canto superior direito
  touchBtns.pause.x = VIEW_W - 18;
  touchBtns.pause.y = 18;
}
layoutTouchButtons();

// Converter coordenada de tela para canvas
function screenToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (VIEW_W / rect.width),
    y: (clientY - rect.top) * (VIEW_H / rect.height),
  };
}

// Checar se toque está dentro de um botão circular
function hitBtn(btn, cx, cy) {
  const dx = cx - btn.x, dy = cy - btn.y;
  return (dx*dx + dy*dy) <= (btn.r * btn.r);
}

if (isTouchDevice) {
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    initAudio();
    for (const t of e.changedTouches) {
      const p = screenToCanvas(t.clientX, t.clientY);

      // Pausar
      if (hitBtn(touchBtns.pause, p.x, p.y)) {
        touchBtns.pause.active = true; touchBtns.pause.touchId = t.identifier;
        if (gameState === 'playing') { gameState = 'paused'; triggerSave(); }
        else if (gameState === 'paused') gameState = 'playing';
        continue;
      }

      // Menu states — tap anywhere para navegar
      if (gameState === 'mainMenu' || gameState === 'slotSelect' || gameState === 'importSave' || gameState === 'exportSave') {
        // Tap na metade superior = Up, inferior = Down, centro = Enter
        if (p.y < VIEW_H * 0.35) keys.ArrowUp = true;
        else if (p.y > VIEW_H * 0.65) keys.ArrowDown = true;
        else keys.Enter = true;
        continue;
      }
      if (gameState === 'dialogue') { keys.Enter = true; continue; }
      if (gameState === 'endCutscene') { keys.Space = true; continue; }
      if (gameState === 'credits') { keys.Escape = true; continue; }
      if (gameState === 'dead') { keys.Enter = true; continue; }
      if (gameState === 'levelUp') {
        if (p.x < VIEW_W/2) keys.ArrowLeft = true;
        else keys.ArrowRight = true;
        if (p.y > VIEW_H * 0.7) keys.Enter = true;
        continue;
      }
      if (gameState !== 'playing') {
        // Outros estados: tap = confirmar/navegar
        // Canto superior esquerdo = Escape (voltar)
        if (p.x < 40 && p.y < 30) { keys.Escape = true; continue; }
        if (p.y < VIEW_H * 0.3) keys.ArrowUp = true;
        else if (p.y > VIEW_H * 0.7) keys.ArrowDown = true;
        else if (p.x < VIEW_W * 0.3) keys.ArrowLeft = true;
        else if (p.x > VIEW_W * 0.7) keys.ArrowRight = true;
        else keys.Enter = true;
        continue;
      }

      // --- Estado 'playing' ---

      // Botão Falar (NPC)
      if (touchBtns.talk.visible && hitBtn(touchBtns.talk, p.x, p.y)) {
        touchBtns.talk.active = true; touchBtns.talk.touchId = t.identifier;
        keys.Space = true;
        continue;
      }

      // Ataque
      if (hitBtn(touchBtns.attack, p.x, p.y)) {
        touchBtns.attack.active = true; touchBtns.attack.touchId = t.identifier;
        mouseClicked = true;
        // GDD §14 Mobile: melee na última direção do joystick
        mouseX = player.x - camX + Math.cos(lastJoyDir) * TILE;
        mouseY = player.y - camY + Math.sin(lastJoyDir) * TILE;
        continue;
      }

      // Skills (5 botões em arco)
      let hitSkill = false;
      for (let i = 0; i < 5; i++) {
        if (hitBtn(touchBtns.skill[i], p.x, p.y)) {
          touchBtns.skill[i].active = true;
          touchBtns.skill[i].touchId = t.identifier;
          touchBtns.skill[i].dragAngle = null;
          hitSkill = true;
          break;
        }
      }
      if (hitSkill) continue;

      // Essência
      if (hitBtn(touchBtns.essencia, p.x, p.y)) {
        touchBtns.essencia.active = true;
        touchBtns.essencia.touchId = t.identifier;
        touchBtns.essencia.holdTimer = 0;
        continue;
      }

      // Poção — GDD §15: toque rápido = poção, segurar = menu rápido consumíveis
      if (hitBtn(touchBtns.potion, p.x, p.y)) {
        touchBtns.potion.active = true; touchBtns.potion.touchId = t.identifier;
        touchBtns.potion.holdTimer = 0;
        continue;
      }

      // Inventário
      if (hitBtn(touchBtns.inventory, p.x, p.y)) {
        touchBtns.inventory.active = true; touchBtns.inventory.touchId = t.identifier;
        keys.KeyI = true;
        continue;
      }

      // Joystick — metade esquerda da tela
      if (p.x < VIEW_W / 2 && !joystick.active) {
        joystick.active = true;
        joystick.touchId = t.identifier;
        joystick.originX = p.x;
        joystick.originY = p.y;
        joystick.knobX = p.x;
        joystick.knobY = p.y;
        joystick.dx = 0;
        joystick.dy = 0;
        continue;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const p = screenToCanvas(t.clientX, t.clientY);

      // Joystick move
      if (joystick.active && t.identifier === joystick.touchId) {
        let dx = p.x - joystick.originX;
        let dy = p.y - joystick.originY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > joystick.outerR) {
          dx = dx / dist * joystick.outerR;
          dy = dy / dist * joystick.outerR;
        }
        joystick.knobX = joystick.originX + dx;
        joystick.knobY = joystick.originY + dy;
        if (dist < joystick.deadzone) {
          joystick.dx = 0; joystick.dy = 0;
        } else {
          joystick.dx = dx / joystick.outerR;
          joystick.dy = dy / joystick.outerR;
          lastJoyDir = Math.atan2(dy, dx);
        }
        continue;
      }

      // GDD §14: Skills direcionais — segurar+arrastar→soltar
      for (let i = 0; i < 5; i++) {
        if (touchBtns.skill[i].active && t.identifier === touchBtns.skill[i].touchId) {
          const sdx = p.x - touchBtns.skill[i].x;
          const sdy = p.y - touchBtns.skill[i].y;
          if (Math.sqrt(sdx*sdx + sdy*sdy) > 10) {
            touchBtns.skill[i].dragAngle = Math.atan2(sdy, sdx);
          }
          break;
        }
      }

      // Essência hold timer tracking handled in update
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      // Joystick release — GDD §14: desaparece ao soltar
      if (joystick.active && t.identifier === joystick.touchId) {
        joystick.active = false;
        joystick.touchId = null;
        joystick.dx = 0; joystick.dy = 0;
        continue;
      }

      // Ataque release
      if (touchBtns.attack.active && t.identifier === touchBtns.attack.touchId) {
        touchBtns.attack.active = false; touchBtns.attack.touchId = null;
        continue;
      }

      // Skills release — GDD §14: soltar ativa a skill
      for (let i = 0; i < 5; i++) {
        if (touchBtns.skill[i].active && t.identifier === touchBtns.skill[i].touchId) {
          // Se arrastou, usar dragAngle como direção
          if (touchBtns.skill[i].dragAngle !== null) {
            mouseX = player.x - camX + Math.cos(touchBtns.skill[i].dragAngle) * TILE * 3;
            mouseY = player.y - camY + Math.sin(touchBtns.skill[i].dragAngle) * TILE * 3;
          } else {
            // Sem arraste: usa direção do joystick
            mouseX = player.x - camX + Math.cos(lastJoyDir) * TILE;
            mouseY = player.y - camY + Math.sin(lastJoyDir) * TILE;
          }
          useSkill(i);
          touchBtns.skill[i].active = false;
          touchBtns.skill[i].touchId = null;
          touchBtns.skill[i].dragAngle = null;
          break;
        }
      }

      // Essência release
      if (touchBtns.essencia.active && t.identifier === touchBtns.essencia.touchId) {
        if (!touchEssenciaRadial) {
          // GDD §14: toque rápido = usar essência skill 0
          useEssenciaSkill(0);
        }
        touchBtns.essencia.active = false;
        touchBtns.essencia.touchId = null;
        touchEssenciaRadial = false;
        continue;
      }

      // Outros botões release
      if (touchBtns.potion.active && t.identifier === touchBtns.potion.touchId) {
        // GDD §15: toque rápido = poção, segurar > 0.4s = abre inventário (consumíveis)
        if (touchBtns.potion.holdTimer < 0.4) usePotion();
        else keys.KeyI = true; // abre inventário como menu rápido
        touchBtns.potion.active = false; touchBtns.potion.touchId = null;
        touchBtns.potion.holdTimer = 0;
      }
      if (touchBtns.inventory.active && t.identifier === touchBtns.inventory.touchId) {
        touchBtns.inventory.active = false; touchBtns.inventory.touchId = null;
      }
      if (touchBtns.pause.active && t.identifier === touchBtns.pause.touchId) {
        touchBtns.pause.active = false; touchBtns.pause.touchId = null;
      }
      if (touchBtns.talk.active && t.identifier === touchBtns.talk.touchId) {
        touchBtns.talk.active = false; touchBtns.talk.touchId = null;
      }
    }
  });

  canvas.addEventListener('touchcancel', e => {
    // Reset all touch state
    joystick.active = false; joystick.touchId = null; joystick.dx = 0; joystick.dy = 0;
    touchBtns.attack.active = false; touchBtns.attack.touchId = null;
    for (const s of touchBtns.skill) { s.active = false; s.touchId = null; s.dragAngle = null; }
    touchBtns.essencia.active = false; touchBtns.essencia.touchId = null;
    touchBtns.potion.active = false; touchBtns.potion.touchId = null;
    touchBtns.inventory.active = false; touchBtns.inventory.touchId = null;
    touchBtns.pause.active = false; touchBtns.pause.touchId = null;
    touchBtns.talk.active = false; touchBtns.talk.touchId = null;
    touchEssenciaRadial = false;
  });
}

// GDD §13: auto-pause ao trocar de aba
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameState === 'playing') gameState = 'paused';
});

// ============================================================
// GDD §14 M6: TOUCH UPDATE + RENDER
// ============================================================
function updateTouch(dt) {
  // Botão "Falar" — GDD §14: aparece a 1.5 tiles de NPC
  touchBtns.talk.visible = false;
  if (gameState === 'playing') {
    for (const npc of npcs) {
      const d = distXY(player.x, player.y, npc.x, npc.y);
      if (d < TILE * 1.5) {
        touchBtns.talk.visible = true;
        // Posicionar acima do NPC (coordenadas de canvas)
        touchBtns.talk.x = npc.x - camX;
        touchBtns.talk.y = npc.y - camY - 20;
        break;
      }
    }
  }

  // Essência hold — GDD §14: segurar = radial seleção
  if (touchBtns.essencia.active) {
    touchBtns.essencia.holdTimer += dt;
    if (touchBtns.essencia.holdTimer > 0.4 && !touchEssenciaRadial) {
      touchEssenciaRadial = true;
    }
  }
  // Poção hold — GDD §15: segurar = menu rápido
  if (touchBtns.potion.active) {
    touchBtns.potion.holdTimer += dt;
  }
}

function renderTouchControls() {
  if (!isTouchDevice || gameState !== 'playing') return;

  // === JOYSTICK ===
  if (joystick.active) {
    // GDD §14: Semi-transparente 30%, knob 60%
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joystick.originX, joystick.originY, joystick.outerR, 0, Math.PI*2);
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ccc';
    ctx.beginPath();
    ctx.arc(joystick.knobX, joystick.knobY, joystick.knobR, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.5;

  // === BOTÃO ATAQUE ===
  const atk = touchBtns.attack;
  ctx.fillStyle = atk.active ? '#ff6644' : '#cc3322';
  ctx.beginPath(); ctx.arc(atk.x, atk.y, atk.r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('⚔', atk.x, atk.y + 4);

  // === 5 SKILLS EM ARCO ===
  if (player.classKey) {
    for (let i = 0; i < 5; i++) {
      const sb = touchBtns.skill[i];
      const skillId = player.equippedSkills[i];
      const skill = skillId ? SKILLS[skillId] : null;
      const cd = skillId ? (player.skillCooldowns[skillId] || 0) : 0;

      if (!skill) {
        ctx.fillStyle = '#222';
        ctx.globalAlpha = 0.25;
      } else if (cd > 0) {
        ctx.fillStyle = '#444';
        ctx.globalAlpha = 0.4;
      } else {
        ctx.fillStyle = sb.active ? '#6699ff' : '#3366aa';
        ctx.globalAlpha = 0.5;
      }
      ctx.beginPath(); ctx.arc(sb.x, sb.y, sb.r, 0, Math.PI*2); ctx.fill();

      if (skill) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = cd > 0 ? '#888' : '#fff';
        ctx.font = '7px monospace';
        ctx.fillText(skill.name.substr(0,3), sb.x, sb.y + 3);
        if (cd > 0) {
          // Circular cooldown arc overlay
          const maxCd = skill.cd || 10;
          const pct = cd / maxCd;
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath();
          ctx.moveTo(sb.x, sb.y);
          ctx.arc(sb.x, sb.y, sb.r, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#ff6666';
          ctx.font = '6px monospace';
          ctx.fillText(Math.ceil(cd)+'s', sb.x, sb.y + 11);
        }
      } else {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#666';
        ctx.font = '7px monospace';
        ctx.fillText(i+1, sb.x, sb.y + 3);
      }

      // GDD §14: Indicador de arraste direcional
      if (sb.active && sb.dragAngle !== null) {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sb.x, sb.y);
        ctx.lineTo(sb.x + Math.cos(sb.dragAngle) * 25, sb.y + Math.sin(sb.dragAngle) * 25);
        ctx.stroke();
      }
    }
  }

  ctx.globalAlpha = 0.5;

  // === ESSÊNCIA ===
  if (currentFloor >= 3) {
    const eb = touchBtns.essencia;
    ctx.fillStyle = eb.active ? '#ffee44' : '#ccaa00';
    ctx.beginPath(); ctx.arc(eb.x, eb.y, eb.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.fillText('E', eb.x, eb.y + 3);

    // Radial seleção
    if (touchEssenciaRadial) {
      ctx.globalAlpha = 0.6;
      const radR = 35;
      for (let i = 0; i < 5; i++) {
        const ra = Math.PI*2 * i / 5 - Math.PI/2;
        const rx = eb.x + Math.cos(ra) * radR;
        const ry = eb.y + Math.sin(ra) * radR;
        ctx.fillStyle = '#665500';
        ctx.beginPath(); ctx.arc(rx, ry, 12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.font = '7px monospace';
        ctx.fillText(i+1, rx, ry + 3);
      }
    }
  }

  // === POÇÃO ❤️ ===
  const pb = touchBtns.potion;
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = pb.active ? '#ff6666' : '#cc2222';
  ctx.beginPath(); ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText('♥', pb.x, pb.y + 4);

  // === INVENTÁRIO 🎒 ===
  const ib = touchBtns.inventory;
  ctx.fillStyle = ib.active ? '#886644' : '#664422';
  ctx.beginPath(); ctx.arc(ib.x, ib.y, ib.r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '9px monospace';
  ctx.fillText('🎒', ib.x, ib.y + 4);

  // === PAUSAR ⏸ ===
  const ps = touchBtns.pause;
  ctx.fillStyle = '#555';
  ctx.beginPath(); ctx.arc(ps.x, ps.y, ps.r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.fillText('⏸', ps.x, ps.y + 3);

  // === FALAR (flutuante sobre NPC) ===
  if (touchBtns.talk.visible) {
    const tb = touchBtns.talk;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#2266aa';
    ctx.beginPath(); ctx.arc(tb.x, tb.y, tb.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '7px monospace';
    ctx.fillText('Falar', tb.x, tb.y + 3);
  }

  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
