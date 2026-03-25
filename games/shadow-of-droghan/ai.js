'use strict';
// ai.js — Boss AI, Mini-Boss AI, Enemy Update, Boss Room

// ============================================================
// BOSS ROOM + INTRO
// ============================================================

function checkBossRoom() {
  if (!bossRoom || bossRoomLocked || bossDefeated[currentFloor]) return;
  const ptx = Math.floor(player.x / TILE);
  const pty = Math.floor(player.y / TILE);
  if (ptx >= bossRoom.x && ptx < bossRoom.x + bossRoom.w &&
      pty >= bossRoom.y && pty < bossRoom.y + bossRoom.h) {
    // Lock the room
    bossRoomLocked = true;
    sfx('doorLock');
    // GDD §10: Boss intro — screen shake + nome grande no centro por 2s
    const bossEnemy = enemies.find(e => e.isBoss && !e.dead);
    if (bossEnemy) {
      gameState = 'bossIntro';
      bossIntroData = {name: bossEnemy.name || 'Boss', timer: 2.0};
      shakeScreen(5, 0.5);
      sfx('bossRoar');
    }
  }
}

let bossIntroData = null;

function updateBossIntro(dt) {
  if (!bossIntroData) return;
  bossIntroData.timer -= dt;
  if (bossIntroData.timer <= 0) {
    gameState = 'playing';
    // GDD §11: Droghan fala ao entrar em cada boss
    const bossDialogKey = 'bossA' + currentFloor;
    if (!player.dialogsSeen[bossDialogKey]) {
      player.dialogsSeen[bossDialogKey] = true;
      const bossLines = {
        5:  'Saia do meu caminho!',
        10: 'Eu não vou parar aqui.',
        15: 'Esse poder... é meu.',
        20: 'Estou chegando, mãe.',
        25: 'Finalmente te encontrei.',
      };
      if (bossLines[currentFloor]) {
        startDialogue('Droghan', '#f0c8a0', [bossLines[currentFloor]], null);
      }
    }
    bossIntroData = null;
  }
}

function renderBossIntro() {
  if (!bossIntroData) return;
  // Overlay escuro
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // GDD §10: Nome do boss grande no centro
  const alpha = Math.min(1, bossIntroData.timer / 0.3);
  ctx.globalAlpha = Math.min(1, (2 - bossIntroData.timer) * 2); // fade in
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4444';
  ctx.fillText(bossIntroData.name, VIEW_W/2, VIEW_H/2 - 10);
  ctx.font = '9px monospace';
  ctx.fillStyle = '#ff8888';
  ctx.fillText('— Guardião —', VIEW_W/2, VIEW_H/2 + 8);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ============================================================
// BOSS AI — GDD §10
// ============================================================

function updateBossAI(dt) {
  for (const e of enemies) {
    if (!e.isBoss || e.dead) continue;

    // Update special CDs
    for (const k of Object.keys(e.specialCD)) e.specialCD[k] = Math.max(0, e.specialCD[k] - dt);

    // Phase check — all bosses: F2 at HP<=50%
    // GDD §12: F2 para Nahgord em 60%, demais em 50%
    if (e.bossPhase === 1 && e.hp <= e.maxHp * (e.bossId === 'nahgord' ? 0.6 : 0.5)) {
      e.bossPhase = 2;
      shakeScreen(5, 0.5);
      flashScreen('#ff0000', 0.3, 0.3);
      damageNumbers.push({x:e.x, y:e.y-e.def.h-10, text:'Fase 2!', color:'#ff4444', size:10, timer:1.5, vy:-15});
    }
    // GDD §10: Azaroth F2 — cristais explodem + distorção visual
    if (e.def.id === 'azaroth' && e.bossPhase === 2 && !e.f2Triggered) {
      e.f2Triggered = true;
      flashScreen('#44aaff', 0.5, 0.5);
      for (let i=0;i<15;i++) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*80,vy:(Math.random()-0.5)*80,color:'#44ddff',size:3,life:0.6,timer:0});
    }
    // GDD §10: Ignaroth F2 — martelo bate no chão + erupção lava
    if (e.def.id === 'ignaroth' && e.bossPhase === 2 && !e.f2Triggered) {
      e.f2Triggered = true;
      shakeScreen(8, 0.6);
      flashScreen('#ff4400', 0.5, 0.4);
      // Erupção: múltiplos meteoros ao redor
      for (let i=0;i<6;i++) {
        const mx = e.x + (Math.random()-0.5)*8*TILE;
        const my = e.y + (Math.random()-0.5)*8*TILE;
        activeMeteors.push({x:mx, y:my, timer:0.5+Math.random()*0.5, dmgPct:150, skillLevel:1, exploded:false, color:'#ff4400', radius:1.5*TILE});
      }
    }
    // GDD §10: Nahgord F2 — Domínio Trevas escurece sala + spawn 3 clones
    if (e.def.id === 'nahgord' && e.bossPhase === 2 && !e.f2Triggered) {
      e.f2Triggered = true;
      e.dominioTrevas = true; // flag para escurecer sala no render
      // Spawn 3 Clones (3 hits, 50% ATK, mesma opacidade, real pisca branco a cada 3s)
      e.clones = [];
      e.realBlinkTimer = 0;
      for (let i = 0; i < 3; i++) {
        const angle = (i/3)*Math.PI*2;
        const cx = e.x + Math.cos(angle)*TILE*3;
        const cy = e.y + Math.sin(angle)*TILE*3;
        const clone = createEnemy(BOSS_NAHGORD, e.level, cx, cy);
        clone.hp = 3; clone.maxHp = 3; // 3 hits mata
        clone.atk = Math.round(e.atk * 0.5);
        clone.isClone = true;
        clone.summoner = e; clone.summoned = true;
        clone.isBoss = false;
        enemies.push(clone);
        e.clones.push(clone);
        for (let j=0;j<8;j++) particles.push({x:cx,y:cy,vx:(Math.random()-0.5)*50,vy:(Math.random()-0.5)*50,color:'#6622aa',size:3,life:0.4,timer:0});
      }
    }
    // Nahgord F3 at HP<=30%
    if (e.def.id === 'nahgord' && e.bossPhase === 2 && e.hp <= e.maxHp*0.3) {
      e.bossPhase = 3;
      shakeScreen(8, 0.8);
      flashScreen('#330044', 0.5, 0.5);
      damageNumbers.push({x:e.x, y:e.y-e.def.h-10, text:'Fase Final!', color:'#ff00ff', size:10, timer:2, vy:-15});
      // GDD §10: F3 cutscene — Damiana, poder desperta
      e.dominioTrevas = false; // escuridão some
      // Matar clones restantes
      if (e.clones) {
        for (const c of e.clones) { if (!c.dead) { c.dead = true; c.hp = 0; for (let j=0;j<6;j++) particles.push({x:c.x,y:c.y,vx:(Math.random()-0.5)*40,vy:(Math.random()-0.5)*40,color:'#6622aa',size:3,life:0.4,timer:0}); }}
      }
      // Trigger F3 cutscene
      triggerNahgordF3Cutscene(e);
      // GDD §10 F3: auto-activate class ultimate skill after cutscene completes
      if (!e._f3UltScheduled) {
        e._f3UltScheduled = true;
        const checkAndFireUlt = setInterval(() => {
          // Wait until cutscene ends and gameState returns to 'playing'
          if (gameState === 'playing') {
            clearInterval(checkAndFireUlt);
            // GDD §10: auto-activate ultimate (essencia skill index 0)
            if (typeof useEssenciaSkill === 'function') {
              // Force essencia to max so ultimate fires regardless
              player.essencia = player.essenciaMax;
              useEssenciaSkill(0);
            }
          }
        }, 100);
      }
    }

    // Telegraph countdown
    if (e.telegraphTimer > 0) {
      e.telegraphTimer -= dt;
      if (e.telegraphTimer <= 0) executeBossAttack(e);
      continue;
    }

    // Charging
    if (e.charging) {
      e.chargeTimer -= dt;
      const nx = e.x + e.chargeVx * dt;
      const ny = e.y + e.chargeVy * dt;
      if (collidesWall(nx, ny, e.def.w/2, e.def.h/2) || e.chargeTimer <= 0) {
        e.charging = false;
        if (collidesWall(nx, ny, e.def.w/2, e.def.h/2)) {
          shakeScreen(4, 0.2);
          // GDD §10 Gap#19: Thornax wall stun — atordoa jogador se dentro de 2 tiles
          if (e.def.id === 'thornax' && distXY(e.x, e.y, player.x, player.y) < 2 * TILE) {
            applyStatusPlayer('atordoamento', 1);
            shakeScreen(3, 0.2);
          }
        }
      } else {
        e.x = nx; e.y = ny;
        if (distXY(e.x, e.y, player.x, player.y) < e.def.w/2 + 8) {
          damagePlayer(e.atk * 1.5, e.x, e.y, e.level);
        }
      }
      continue;
    }

    // Blocking
    if (e.blockTimer > 0) {
      e.blockTimer -= dt;
      e.blocking = e.blockTimer > 0;
      if (!e.blocking) e.blockReflect = false; // GDD §10 Gap#22: clear reflect when barrier ends
      continue;
    }

    const dx = player.x - e.x, dy = player.y - e.y;
    const dToPlayer = Math.sqrt(dx*dx + dy*dy);
    e.dir = Math.atan2(dy, dx);

    // Dispatch by boss type
    switch (e.def.id) {
      case 'thornax':  updateThornaxAI(e, dt, dx, dy, dToPlayer); break;
      case 'morvena':  updateMorvenaAI(e, dt, dx, dy, dToPlayer); break;
      case 'azaroth':  updateAzarothAI(e, dt, dx, dy, dToPlayer); break;
      case 'ignaroth': updateIgnarothAI(e, dt, dx, dy, dToPlayer); break;
      case 'nahgord':  updateNahgordAI(e, dt, dx, dy, dToPlayer); break;
    }
  }
}

// GDD §10: Thornax — Golpe Pesado, Investida, Bloqueia, F2:+Spin+30%vel
function updateThornaxAI(e, dt, dx, dy, dToPlayer) {
  const baseSpeed = e.speed * 4 * TILE * (e.bossPhase >= 2 ? 1.3 : 1);
  if (dToPlayer > TILE*1.2) {
    const spd = baseSpeed*dt;
    const nx = e.x + (dx/dToPlayer)*spd, ny = e.y + (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  }
  e.atkTimer = Math.max(0, e.atkTimer - dt);
  if (e.atkTimer > 0) return;
  if (dToPlayer < TILE*2 && e.specialCD.heavySlash <= 0) {
    e.telegraphTimer = 0.8; e.telegraphType = 'heavySlash';
    e.telegraphArea = {x:e.x+Math.cos(e.dir)*TILE, y:e.y+Math.sin(e.dir)*TILE, r:TILE*1.2}; e.atkTimer = 2;
  } else if (dToPlayer > TILE*3 && dToPlayer < TILE*8 && e.specialCD.charge <= 0) {
    e.telegraphTimer = 0.5; e.telegraphType = 'charge';
    e.chargeVx = (dx/dToPlayer)*TILE*8; e.chargeVy = (dy/dToPlayer)*TILE*8; e.atkTimer = 3;
  } else if (e.bossPhase >= 2 && e.specialCD.spin <= 0 && dToPlayer < TILE*2) {
    e.telegraphTimer = 0.6; e.telegraphType = 'spin';
    e.telegraphArea = {x:e.x, y:e.y, r:TILE*2}; e.atkTimer = 2.5;
  } else if (e.specialCD.heavySlash > 0 && Math.random() < 0.3) {
    e.blocking = true; e.blockTimer = 1.5; e.atkTimer = 2;
  } else if (dToPlayer < TILE*1.5) {
    damagePlayer(e.atk, e.x, e.y, e.level); e.atkTimer = 1.5;
  }
}

// GDD §10: Morvena — invoca esqueletos, raio sombrio, escudo almas. F2: golem osso, explosão, teleporta
function updateMorvenaAI(e, dt, dx, dy, dToPlayer) {
  const baseSpeed = e.speed * 4 * TILE;
  // Mantém distância
  if (dToPlayer < 3*TILE) {
    const spd = baseSpeed*dt;
    const nx = e.x - (dx/dToPlayer)*spd, ny = e.y - (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  } else if (dToPlayer > 6*TILE) {
    const spd = baseSpeed*0.5*dt;
    const nx = e.x + (dx/dToPlayer)*spd, ny = e.y + (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  }
  // GDD §10 Gap#20: Morvena shield timer countdown
  if (e.shieldTimer > 0) {
    e.shieldTimer -= dt;
    if (e.shieldTimer <= 0) e.shield = 0;
  }
  e.atkTimer = Math.max(0, e.atkTimer - dt);
  if (e.atkTimer > 0) return;
  // GDD §10: Raio Sombrio (drena vida). F2: raio divide em 3 projéteis
  if (e.specialCD.shadowRay <= 0 && dToPlayer < 7*TILE) {
    const d = Math.max(1, Math.sqrt(dx*dx+dy*dy));
    if (e.bossPhase >= 2) {
      // F2: 3 projéteis em leque
      for (let i = -1; i <= 1; i++) {
        const spread = i * 0.25;
        const angle = Math.atan2(dy, dx) + spread;
        enemyProjectiles.push({x:e.x, y:e.y, vx:Math.cos(angle)*5*TILE, vy:Math.sin(angle)*5*TILE, dmg:e.atk*0.8, color:'#8833cc', size:4, range:7*TILE, traveled:0, drainHP:0.03, owner:e});
      }
    } else {
      enemyProjectiles.push({x:e.x, y:e.y, vx:(dx/d)*5*TILE, vy:(dy/d)*5*TILE, dmg:e.atk*1.2, color:'#8833cc', size:5, range:7*TILE, traveled:0, drainHP:0.05, owner:e});
    }
    e.specialCD.shadowRay = 3; e.atkTimer = 1.5;
  }
  // Invocar esqueletos (F1) ou Golem Osso (F2)
  else if (e.specialCD.summon <= 0) {
    if (e.bossPhase >= 2) {
      // F2: Golem Osso como invocação especial
      spawnMinion(e, B2_POOL, 5, 1, 0.8, 0.6); // Golem Osso = B2_POOL[5]
    } else {
      spawnMinion(e, B2_POOL, 0, 2, 0.5, 0.5);
    }
    e.specialCD.summon = 10; e.atkTimer = 2;
  }
  // GDD §10 Gap#20: Escudo Almas = absorb shield (não blocking)
  else if (e.specialCD.shield <= 0 && e.hp < e.maxHp*0.7) {
    e.shield = Math.floor(e.maxHp * 0.2);
    e.shieldTimer = 8;
    e.specialCD.shield = 15; e.atkTimer = 2;
    damageNumbers.push({x:e.x, y:e.y-e.def.h, text:'Escudo Almas!', color:'#aa66ff', size:8, timer:1, vy:-20});
  }
  // F2: Teleporta + Explosão
  else if (e.bossPhase >= 2 && e.specialCD.teleport <= 0) {
    // Teleporta pra posição aleatória na sala
    if (bossRoom) {
      e.x = (bossRoom.x + 2 + Math.random()*(bossRoom.w-4)) * TILE;
      e.y = (bossRoom.y + 2 + Math.random()*(bossRoom.h-4)) * TILE;
    }
    // Explosão AoE
    e.telegraphTimer = 0.8; e.telegraphType = 'soulExplosion';
    e.telegraphArea = {x:e.x, y:e.y, r:2.5*TILE};
    e.specialCD.teleport = 8; e.atkTimer = 2;
  }
}

// GDD §10: Azaroth — teleporta, orbes perseguidores, pilar luz, campo runas. F2: clones, distorção
function updateAzarothAI(e, dt, dx, dy, dToPlayer) {
  // GDD §10: Campo Runas — zones de dano contínuo
  if (e.campoRunasCD > 0) e.campoRunasCD -= dt;
  if (e.campoRunas) {
    for (const cr of e.campoRunas) {
      cr.timer -= dt; cr.dmgCD = Math.max(0, (cr.dmgCD||0) - dt);
      if (cr.timer > 0 && cr.dmgCD <= 0 && distXY(player.x, player.y, cr.x, cr.y) < cr.r) {
        damagePlayer(Math.round(e.atk * 0.4), cr.x, cr.y, e.level);
        cr.dmgCD = 1; // 1 tick por segundo
      }
    }
    e.campoRunas = e.campoRunas.filter(c => c.timer > 0);
  }
  const baseSpeed = e.speed * 4 * TILE;
  if (dToPlayer > TILE*2) {
    const spd = baseSpeed*dt;
    const nx = e.x + (dx/dToPlayer)*spd, ny = e.y + (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  }
  e.atkTimer = Math.max(0, e.atkTimer - dt);
  if (e.atkTimer > 0) return;
  // GDD §10 Gap#21: Orbes perseguidores (3 projéteis lentos que rastream, homing)
  if (e.specialCD.orbs <= 0) {
    for (let i=0;i<3;i++) {
      const a = (i/3)*Math.PI*2;
      enemyProjectiles.push({x:e.x, y:e.y, vx:Math.cos(a)*2*TILE, vy:Math.sin(a)*2*TILE, dmg:e.atk*0.8, color:'#44aaff', size:4, range:8*TILE, traveled:0, homing:true});
    }
    e.specialCD.orbs = 6; e.atkTimer = 2;
  }
  // Pilar Luz (delay 1s, área grande)
  else if (e.specialCD.pillar <= 0) {
    activeMeteors.push({x:player.x, y:player.y, timer:1.0, dmgPct:200, skillLevel:1, exploded:false, color:'#ffff44', radius:2*TILE});
    e.specialCD.pillar = 8; e.atkTimer = 2;
  }
  // Teleporta (CD 10s)
  else if (e.specialCD.teleport <= 0 && bossRoom) {
    e.x = (bossRoom.x + 2 + Math.random()*(bossRoom.w-4)) * TILE;
    e.y = (bossRoom.y + 2 + Math.random()*(bossRoom.h-4)) * TILE;
    e.specialCD.teleport = 10; e.atkTimer = 1;
    for (let i=0;i<10;i++) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*60,vy:(Math.random()-0.5)*60,color:'#44aaff',size:3,life:0.5,timer:0});
  }
  // GDD §10 F1: Campo Runas (zona de dano no chão, CD 9s)
  else if (!e.campoRunasCD || e.campoRunasCD <= 0) {
    if (!e.campoRunas) e.campoRunas = [];
    // Max 3 campos ativos
    e.campoRunas = e.campoRunas.filter(c => c.timer > 0);
    if (e.campoRunas.length < 3) {
      e.campoRunas.push({x:player.x, y:player.y, timer:5, r:1.5*TILE, dmgCD:0});
      e.campoRunasCD = 9; e.atkTimer = 1.5;
      damageNumbers.push({x:player.x, y:player.y-10, text:'Campo Runas!', color:'#44aaff', size:7, timer:0.8, vy:-20});
    }
  }
  // F2: Distorção (inverte controles 3s)
  else if (e.bossPhase >= 2 && e.specialCD.distortion <= 0) {
    applyStatusPlayer('confusao', 3);
    e.specialCD.distortion = 12; e.atkTimer = 2;
    damageNumbers.push({x:player.x, y:player.y-20, text:'Distorção!', color:'#ff66ff', size:8, timer:1, vy:-20});
    // GDD §10 F2: 2 Clones (1 hit mata, 30% ATK, 70% opacidade)
    if (!e.clones) e.clones = [];
    const liveClones = e.clones.filter(c => !c.dead).length;
    if (liveClones < 2) {
      for (let i = 0; i < 2 - liveClones; i++) {
        const angle = Math.random() * Math.PI * 2;
        const cx = e.x + Math.cos(angle) * TILE * 3;
        const cy = e.y + Math.sin(angle) * TILE * 3;
        const clone = createEnemy(BOSS_AZAROTH, e.level, cx, cy);
        clone.hp = 1; clone.maxHp = 1; // 1 hit mata
        clone.atk = Math.round(e.atk * 0.3);
        clone.isClone = true; clone.cloneAlpha = 0.7;
        clone.summoner = e; clone.summoned = true;
        clone.isBoss = false; // não trigger boss AI/phase
        enemies.push(clone);
        e.clones.push(clone);
        for (let j=0;j<6;j++) particles.push({x:cx,y:cy,vx:(Math.random()-0.5)*40,vy:(Math.random()-0.5)*40,color:'#44aaff',size:3,life:0.4,timer:0});
      }
    }
  }
}

// GDD §10: Ignaroth — martelada cruz, chuva escória, sopro lava. F2: erupção, forjar espada
function updateIgnarothAI(e, dt, dx, dy, dToPlayer) {
  const baseSpeed = e.speed * 4 * TILE;
  if (dToPlayer > TILE*1.5) {
    const spd = baseSpeed*dt;
    const nx = e.x + (dx/dToPlayer)*spd, ny = e.y + (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  }
  e.atkTimer = Math.max(0, e.atkTimer - dt);
  if (e.atkTimer > 0) return;
  // Martelada (onda cruz — 4 linhas cardeais)
  if (dToPlayer < TILE*2 && e.specialCD.hammer <= 0) {
    for (let i=0;i<4;i++) {
      const a = i*Math.PI/2;
      enemyProjectiles.push({x:e.x, y:e.y, vx:Math.cos(a)*5*TILE, vy:Math.sin(a)*5*TILE, dmg:e.atk*1.5, color:'#ff6600', size:6, range:4*TILE, traveled:0});
    }
    shakeScreen(5, 0.3); e.specialCD.hammer = 5; e.atkTimer = 2;
  }
  // Chuva Escória (meteoros na área)
  else if (e.specialCD.slagRain <= 0) {
    for (let i=0;i<4;i++) {
      const mx = player.x + (Math.random()-0.5)*5*TILE;
      const my = player.y + (Math.random()-0.5)*5*TILE;
      activeMeteors.push({x:mx, y:my, timer:1.0, dmgPct:180, skillLevel:1, exploded:false, color:'#ff4400', radius:1.5*TILE});
    }
    e.specialCD.slagRain = 10; e.atkTimer = 2;
  }
  // Sopro Lava (cone 3 tiles)
  else if (dToPlayer < 3*TILE && e.specialCD.lavaBreath <= 0) {
    e.telegraphTimer = 0.8; e.telegraphType = 'lavaBreath';
    e.telegraphArea = {x:e.x+Math.cos(e.dir)*2*TILE, y:e.y+Math.sin(e.dir)*2*TILE, r:2*TILE};
    e.specialCD.lavaBreath = 7; e.atkTimer = 2;
  }
  // GDD §10 F1: Chão vira lava — tiles periodicamente se tornam lava hazard
  if (!e.lavaFloorCD) e.lavaFloorCD = 0;
  e.lavaFloorCD = Math.max(0, e.lavaFloorCD - dt);
  if (e.lavaFloorCD <= 0 && bossRoom) {
    if (!e.lavaFloorTiles) e.lavaFloorTiles = [];
    // Remove expired lava tiles
    e.lavaFloorTiles = e.lavaFloorTiles.filter(lt => lt.timer > 0);
    // Spawn 2-3 new lava tiles near the player
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const ltx = Math.floor(player.x / TILE) + Math.floor((Math.random()-0.5) * 4);
      const lty = Math.floor(player.y / TILE) + Math.floor((Math.random()-0.5) * 4);
      // Only place inside boss room
      if (ltx >= bossRoom.x+1 && ltx < bossRoom.x+bossRoom.w-1 &&
          lty >= bossRoom.y+1 && lty < bossRoom.y+bossRoom.h-1) {
        // Avoid duplicates
        if (!e.lavaFloorTiles.find(t => t.tx === ltx && t.ty === lty)) {
          e.lavaFloorTiles.push({tx: ltx, ty: lty, timer: 4 + Math.random()*2, dmgCD: 0});
        }
      }
    }
    e.lavaFloorCD = 6; // new lava tiles every 6s
  }
  // Lava floor damage tick
  if (e.lavaFloorTiles) {
    const ptx = Math.floor(player.x / TILE);
    const pty = Math.floor(player.y / TILE);
    for (const lt of e.lavaFloorTiles) {
      lt.timer -= dt;
      lt.dmgCD = Math.max(0, lt.dmgCD - dt);
      if (lt.timer > 0 && lt.dmgCD <= 0 && ptx === lt.tx && pty === lt.ty) {
        damagePlayer(Math.round(e.atk * 0.25), lt.tx * TILE + TILE/2, lt.ty * TILE + TILE/2, e.level);
        applyStatusPlayer('queimadura', 2);
        lt.dmgCD = 1;
      }
    }
  }
  // F2: Forjar Espada (arremessa 8 direções)
  if (e.bossPhase >= 2 && e.specialCD.forgeThrow <= 0) {
    for (let i=0;i<8;i++) {
      const a = (i/8)*Math.PI*2;
      enemyProjectiles.push({x:e.x, y:e.y, vx:Math.cos(a)*6*TILE, vy:Math.sin(a)*6*TILE, dmg:e.atk, color:'#ffaa00', size:5, range:6*TILE, traveled:0});
    }
    e.specialCD.forgeThrow = 10; e.atkTimer = 2;
  }
  // GDD §10 F2: Dano de contato
  if (e.bossPhase >= 2 && dToPlayer < e.def.w/2 + 10) {
    if (!e.contactCD || e.contactCD <= 0) {
      damagePlayer(Math.round(e.atk * 0.5), e.x, e.y, e.level);
      applyStatusPlayer('queimadura', 3);
      e.contactCD = 1.5;
    }
  }
  if (e.contactCD > 0) e.contactCD -= dt;
  // GDD §10 F2: Lava sobe (reduz área segura ao longo do tempo)
  if (e.bossPhase >= 2 && bossRoom) {
    if (!e.lavaRise) e.lavaRise = 0;
    e.lavaRise = Math.min(3, e.lavaRise + dt * 0.08); // sobe gradualmente, max 3 tiles
    // Dano se jogador nas bordas (dentro da faixa de lava)
    const px = Math.floor(player.x / TILE) - bossRoom.x;
    const py = Math.floor(player.y / TILE) - bossRoom.y;
    const lavaDepth = Math.floor(e.lavaRise);
    if (lavaDepth > 0 && (px < lavaDepth || px >= bossRoom.w - lavaDepth || py < lavaDepth || py >= bossRoom.h - lavaDepth)) {
      if (!e.lavaDmgCD || e.lavaDmgCD <= 0) {
        damagePlayer(Math.round(e.atk * 0.3), player.x, player.y, e.level);
        applyStatusPlayer('queimadura', 2);
        e.lavaDmgCD = 1;
      }
    }
    if (e.lavaDmgCD > 0) e.lavaDmgCD -= dt;
  }
}

// GDD §10: Nahgord — lâminas sombra, passo sombrio, correntes, barreira. F2: escurece, garras, clones. F3: cutscene
function updateNahgordAI(e, dt, dx, dy, dToPlayer) {
  // GDD §10: F2 real pisca branco a cada 3s
  if (e.bossPhase >= 2 && e.realBlinkTimer !== undefined) {
    e.realBlinkTimer += dt;
    e.realBlink = (e.realBlinkTimer % 3) < 0.15; // pisca 0.15s a cada 3s
  }
  const baseSpeed = e.speed * 4 * TILE * (e.bossPhase >= 2 ? 1.2 : 1);
  if (dToPlayer > TILE*1.5) {
    const spd = baseSpeed*dt;
    const nx = e.x + (dx/dToPlayer)*spd, ny = e.y + (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  }
  e.atkTimer = Math.max(0, e.atkTimer - dt);
  if (e.atkTimer > 0) return;
  // Lâminas Sombra (projéteis 3)
  if (e.specialCD.shadowBlades <= 0) {
    for (let i=-1;i<=1;i++) {
      const a = e.dir + i*0.3;
      enemyProjectiles.push({x:e.x, y:e.y, vx:Math.cos(a)*7*TILE, vy:Math.sin(a)*7*TILE, dmg:e.atk*1.2, color:'#6622aa', size:5, range:7*TILE, traveled:0});
    }
    e.specialCD.shadowBlades = 4; e.atkTimer = 1.5;
  }
  // Passo Sombrio (teleporta atrás do player)
  else if (e.specialCD.shadowStep <= 0 && dToPlayer > 2*TILE) {
    const behind = Math.atan2(dy, dx) + Math.PI;
    e.x = player.x + Math.cos(behind)*TILE*1.5;
    e.y = player.y + Math.sin(behind)*TILE*1.5;
    damagePlayer(e.atk*1.3, e.x, e.y, e.level);
    e.specialCD.shadowStep = 8; e.atkTimer = 1.5;
    for (let i=0;i<8;i++) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*50,vy:(Math.random()-0.5)*50,color:'#6622aa',size:3,life:0.4,timer:0});
  }
  // Correntes Trevas (puxa jogador)
  else if (e.specialCD.chains <= 0 && dToPlayer > 3*TILE && dToPlayer < 8*TILE) {
    const pullDist = Math.min(dToPlayer*0.5, 3*TILE);
    const d = Math.max(1, Math.sqrt(dx*dx+dy*dy));
    player.x += (dx/d) * pullDist * -0.3; // puxa em direção ao boss
    player.y += (dy/d) * pullDist * -0.3;
    e.specialCD.chains = 10; e.atkTimer = 1;
    damageNumbers.push({x:player.x, y:player.y-20, text:'Correntes!', color:'#6622aa', size:7, timer:0.8, vy:-20});
  }
  // GDD §10 Gap#22: Barreira (reflete 40% dano, CD 12s)
  else if (e.specialCD.barrier <= 0 && e.hp < e.maxHp*0.6) {
    e.blocking = true; e.blockReflect = true; e.blockTimer = 3; e.specialCD.barrier = 12; e.atkTimer = 1;
    damageNumbers.push({x:e.x, y:e.y-e.def.h, text:'Barreira!', color:'#6622aa', size:8, timer:1, vy:-20});
  }
  // F2: Garras do chão (AoE sob jogador)
  else if (e.bossPhase >= 2 && e.specialCD.claws <= 0) {
    activeMeteors.push({x:player.x, y:player.y, timer:0.8, dmgPct:220, skillLevel:1, exploded:false, color:'#6622aa', radius:2*TILE});
    e.specialCD.claws = 6; e.atkTimer = 1.5;
  }
  // F2: Devorar (puxa forte)
  else if (e.bossPhase >= 2 && e.specialCD.devour <= 0 && dToPlayer > 2*TILE) {
    const d = Math.max(1, Math.sqrt(dx*dx+dy*dy));
    player.x -= (dx/d) * 2*TILE * -1; // puxa forte
    player.y -= (dy/d) * 2*TILE * -1;
    damagePlayer(e.atk*0.8, e.x, e.y, e.level);
    e.specialCD.devour = 12; e.atkTimer = 2;
  }
  // Regular melee
  else if (dToPlayer < TILE*1.8) {
    damagePlayer(e.atk, e.x, e.y, e.level); e.atkTimer = 1.5;
  }
}

function executeBossAttack(boss) {
  const attackType = boss.telegraphType;
  boss.telegraphType = null;
  const dx = player.x - boss.x, dy = player.y - boss.y;
  const d = Math.sqrt(dx*dx + dy*dy);

  if (attackType === 'charge') {
    boss.charging = true;
    boss.chargeTimer = 0.5;
    boss.chargeVx = (dx / (d || 1)) * TILE * 8;
    boss.chargeVy = (dy / (d || 1)) * TILE * 8;
    boss.specialCD.charge = 6;
    sfx('bossRoar');
    return;
  }

  if (boss.telegraphArea) {
    const area = boss.telegraphArea;
    const pDist = distXY(player.x, player.y, area.x, area.y);
    let dmgMult = 1.5;
    if (attackType === 'spin') dmgMult = 1.2;
    else if (attackType === 'soulExplosion') dmgMult = 1.8;
    else if (attackType === 'lavaBreath') { dmgMult = 1.6; if (pDist < area.r) applyStatusPlayer('queimadura', 3); }
    if (pDist < area.r) {
      damagePlayer(boss.atk * dmgMult, boss.x, boss.y, boss.level);
    }
    shakeScreen(3, 0.2);
    if (attackType === 'heavySlash') boss.specialCD.heavySlash = 4;
    if (attackType === 'spin') boss.specialCD.spin = 5;
    boss.telegraphArea = null;
  }
}

// ============================================================
// MINI-BOSS AI — GDD §10
// ============================================================

function updateMiniBossAI(dt) {
  for (const e of enemies) {
    if (!e.isMiniBoss || e.dead) continue;

    // Update CDs
    for (const k of Object.keys(e.specialCD)) e.specialCD[k] = Math.max(0, e.specialCD[k] - dt);

    const dx = player.x - e.x, dy = player.y - e.y;
    const dToPlayer = Math.sqrt(dx*dx + dy*dy);
    const baseSpeed = e.speed * 4 * TILE;
    e.dir = Math.atan2(dy, dx);

    // Dispatch por tipo de mini-boss
    switch (e.def.id) {
      case 'aranhaRainha': updateAranhaRainhaAI(e, dt, dx, dy, dToPlayer, baseSpeed); break;
      case 'lichMenor':    updateLichMenorAI(e, dt, dx, dy, dToPlayer, baseSpeed); break;
      case 'golemArcano':  updateGolemArcanoAI(e, dt, dx, dy, dToPlayer, baseSpeed); break;
      case 'dragaoMenor':  updateDragaoMenorAI(e, dt, dx, dy, dToPlayer, baseSpeed); break;
      case 'guardaReal':   updateGuardaRealAI(e, dt, dx, dy, dToPlayer, baseSpeed); break;
    }
  }
}

// Helper: spawn minions for mini-bosses
function spawnMinion(boss, pool, poolIdx, count, hpMult, atkMult) {
  const living = enemies.filter(s => s.summoner === boss && !s.dead).length;
  const toSpawn = Math.min(count, 3 - living);
  if (living >= 3 || toSpawn <= 0) return;
  for (let i = 0; i < toSpawn; i++) {
    const angle = Math.random() * Math.PI * 2;
    const sx = boss.x + Math.cos(angle) * TILE * 2;
    const sy = boss.y + Math.sin(angle) * TILE * 2;
    const summon = createEnemy(pool[poolIdx], getEnemyLevel(currentFloor), sx, sy);
    summon.hp = Math.round(summon.hp * (hpMult||0.5));
    summon.maxHp = summon.hp;
    summon.atk = Math.round(summon.atk * (atkMult||0.5) * 10) / 10;
    summon.summoner = boss;
    summon.summoned = true; // GDD §10: sem XP/drops
    summon.state = 'chase';
    enemies.push(summon);
  }
  for (let i = 0; i < 8; i++) {
    particles.push({x:boss.x, y:boss.y, vx:(Math.random()-0.5)*60, vy:(Math.random()-0.5)*60, color:boss.def.color, size:2, life:0.4, timer:0});
  }
}

// GDD §10: Aranha Rainha — foge, teia, invoca aranhas
function updateAranhaRainhaAI(e, dt, dx, dy, dToPlayer, baseSpeed) {
  if (dToPlayer < 3*TILE) {
    const spd = baseSpeed*dt;
    const nx = e.x - (dx/dToPlayer)*spd, ny = e.y - (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  } else if (dToPlayer > 6*TILE) {
    const spd = baseSpeed*0.5*dt;
    const nx = e.x + (dx/dToPlayer)*spd, ny = e.y + (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  }
  if (dToPlayer < TILE*1.5 && e.specialCD.bite <= 0) {
    damagePlayer(e.atk, e.x, e.y, e.level);
    applyStatusPlayer('veneno', 5);
    e.specialCD.bite = 2;
  }
  // GDD §10: Teia (imobiliza 2s, área 2×2) — GDD §10 Gap#26: red ground indicator before web
  if (dToPlayer < 5*TILE && e.specialCD.web <= 0) {
    if (!e.webTelegraph) {
      // Phase 1: show red ground indicator for 0.5s before web lands
      const wx = Math.floor(player.x / TILE) * TILE + TILE/2;
      const wy = Math.floor(player.y / TILE) * TILE + TILE/2;
      e.webTelegraph = {x: wx, y: wy, timer: 0.5, radius: TILE};
      e.seismicTelegraph = {x: wx, y: wy, timer: 0.5, radius: TILE}; // reuse for render
      damageNumbers.push({x:wx, y:wy-10, text:'Teia!', color:'#cccccc', size:7, timer:0.5, vy:-20});
    }
  }
  // Process web telegraph countdown
  if (e.webTelegraph) {
    e.webTelegraph.timer -= dt;
    if (e.webTelegraph.timer <= 0) {
      // Phase 2: spawn the web zone
      if (!e.webZones) e.webZones = [];
      const wx = e.webTelegraph.x, wy = e.webTelegraph.y;
      e.webZones.push({x: wx, y: wy, timer: 5, r: TILE}); // 2×2 = 1 tile radius from center
      if (Math.abs(player.x - wx) < TILE && Math.abs(player.y - wy) < TILE) {
        applyStatusPlayer('imobiliza', 2);
      }
      for (let i=0;i<6;i++) particles.push({x:wx,y:wy,vx:(Math.random()-0.5)*30,vy:(Math.random()-0.5)*30,color:'#cccccc',size:2,life:0.5,timer:0});
      e.webTelegraph = null;
      e.seismicTelegraph = null;
      e.specialCD.web = 5;
    }
  }
  // Update web zones — immobilize player if they step in 2×2 area
  if (e.webZones) {
    for (const wz of e.webZones) {
      wz.timer -= dt;
      if (wz.timer > 0 && Math.abs(player.x - wz.x) < TILE && Math.abs(player.y - wz.y) < TILE) {
        if (!hasStatus(player, 'imobiliza')) applyStatusPlayer('imobiliza', 2);
      }
    }
    e.webZones = e.webZones.filter(w => w.timer > 0);
  }
  if (e.specialCD.summon <= 0) {
    spawnMinion(e, B1_POOL, 3, 3, 0.5, 0.5); // Aranhas
    e.specialCD.summon = 15;
  }
}

// GDD §10: Lich Menor — mantém distância, raio sombrio, invoca esqueletos, escudo ossos
function updateLichMenorAI(e, dt, dx, dy, dToPlayer, baseSpeed) {
  // Mantém distância 4-5 tiles
  if (dToPlayer < 3*TILE) {
    const spd = baseSpeed*dt;
    const nx = e.x - (dx/dToPlayer)*spd, ny = e.y - (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  } else if (dToPlayer > 6*TILE) {
    const spd = baseSpeed*0.5*dt;
    const nx = e.x + (dx/dToPlayer)*spd, ny = e.y + (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  }
  // GDD §10: Raio Sombrio (projétil drena 5%HP para curar Lich) — Gap#26: red ground indicator
  if (dToPlayer < 6*TILE && e.specialCD.shadowRay <= 0) {
    if (!e.shadowRayTelegraph) {
      // Phase 1: show red line/circle indicator at target for 0.4s
      e.shadowRayTelegraph = {x: player.x, y: player.y, timer: 0.4, radius: TILE*0.8, srcX: e.x, srcY: e.y};
      e.seismicTelegraph = {x: player.x, y: player.y, timer: 0.4, radius: TILE*0.8}; // reuse for render
      damageNumbers.push({x:e.x, y:e.y-e.def.h, text:'Raio Sombrio!', color:'#aa44ff', size:7, timer:0.4, vy:-20});
    }
  }
  // Process shadow ray telegraph
  if (e.shadowRayTelegraph) {
    e.shadowRayTelegraph.timer -= dt;
    if (e.shadowRayTelegraph.timer <= 0) {
      // Phase 2: fire the projectile
      const rdx = player.x - e.x, rdy = player.y - e.y;
      const rd = Math.sqrt(rdx*rdx + rdy*rdy) || 1;
      enemyProjectiles.push({x:e.x, y:e.y, vx:(rdx/rd)*4*TILE, vy:(rdy/rd)*4*TILE, dmg:e.atk, color:'#aa44ff', size:4, range:6*TILE, traveled:0, drainHP:0.05, owner:e});
      e.specialCD.shadowRay = 3;
      e.shadowRayTelegraph = null;
      e.seismicTelegraph = null;
    }
  }
  // Invocar 2 esqueletos (CD 12s)
  if (e.specialCD.summonSkel <= 0) {
    spawnMinion(e, B2_POOL, 0, 2, 0.5, 0.5); // Zumbis como esqueletos
    e.specialCD.summonSkel = 12;
  }
  // GDD §10: Escudo Ossos (absorve 20%HP por 8s quando HP<50%, CD 15s)
  if (e.hp < e.maxHp*0.5 && e.specialCD.boneShield <= 0) {
    e.shield = Math.floor(e.maxHp * 0.2);
    e.shieldTimer = 8;
    e.specialCD.boneShield = 15;
    damageNumbers.push({x:e.x, y:e.y-e.def.h, text:'Escudo Ossos!', color:'#ccbbaa', size:7, timer:1, vy:-20});
    for (let i=0;i<6;i++) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*40,vy:-Math.random()*40,color:'#ccbbaa',size:2,life:0.5,timer:0});
  }
  // Update shield timer
  if (e.shieldTimer > 0) {
    e.shieldTimer -= dt;
    if (e.shieldTimer <= 0) e.shield = 0;
  }
}

// GDD §10: Golem Arcano — tank lento, soco sísmico AoE, pulso rúnico, regenera 1x
function updateGolemArcanoAI(e, dt, dx, dy, dToPlayer, baseSpeed) {
  // Tank: vai direto pro jogador
  if (dToPlayer > TILE*1.5) {
    const spd = baseSpeed*0.7*dt;
    const nx = e.x + (dx/dToPlayer)*spd, ny = e.y + (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  }
  // GDD §10 Gap#26: Soco Sísmico (AoE 2 tiles, atordoa 1s) — telegraph 0.5s antes
  if (dToPlayer < TILE*2 && e.specialCD.seismicPunch <= 0) {
    if (!e.seismicTelegraph) {
      // Phase 1: show telegraph indicator (red circle) for 0.5s
      e.seismicTelegraph = {x: e.x, y: e.y, timer: 0.5, radius: 2 * TILE};
      damageNumbers.push({x:e.x, y:e.y-e.def.h, text:'Soco Sísmico!', color:'#ff8833', size:7, timer:0.5, vy:-20});
    }
  }
  // Process seismic telegraph countdown
  if (e.seismicTelegraph) {
    e.seismicTelegraph.timer -= dt;
    if (e.seismicTelegraph.timer <= 0) {
      // Phase 2: deal damage
      if (distXY(player.x, player.y, e.seismicTelegraph.x, e.seismicTelegraph.y) < 2*TILE) {
        damagePlayer(e.atk*1.5, e.x, e.y, e.level);
        applyStatusPlayer('atordoamento', 1);
      }
      shakeScreen(4, 0.3);
      e.seismicTelegraph = null;
      e.specialCD.seismicPunch = 6;
    }
  }
  // Pulso Rúnico (4 projéteis 4 direções)
  if (e.specialCD.runicPulse <= 0) {
    for (let i=0;i<4;i++) {
      const a = i*Math.PI/2;
      enemyProjectiles.push({x:e.x, y:e.y, vx:Math.cos(a)*4*TILE, vy:Math.sin(a)*4*TILE, dmg:e.atk*0.8, color:'#ffaa33', size:4, range:5*TILE, traveled:0});
    }
    e.specialCD.runicPulse = 8;
  }
  // Regenerar 5%HP, 1x quando HP<30%
  if (!e.hasRegenerated && e.hp < e.maxHp*0.3) {
    e.hp = Math.min(e.maxHp, e.hp + Math.floor(e.maxHp*0.05));
    e.hasRegenerated = true;
    damageNumbers.push({x:e.x, y:e.y-e.def.h, text:'Regenerar!', color:'#44cc44', size:7, timer:1, vy:-20});
  }
}

// GDD §10: Dragão Menor — sopro fogo cone, voo rasante dash, chuva fogo
function updateDragaoMenorAI(e, dt, dx, dy, dToPlayer, baseSpeed) {
  // Alterna melee/ranged
  if (dToPlayer > 4*TILE) {
    const spd = baseSpeed*dt;
    const nx = e.x + (dx/dToPlayer)*spd, ny = e.y + (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  }
  // Sopro Fogo (cone 3 tiles, queimadura) — Gap#26: red ground indicator before breath
  if (dToPlayer < 3*TILE && e.specialCD.fireBreath <= 0) {
    if (!e.fireBreathTelegraph) {
      // Phase 1: show red cone indicator for 0.5s
      const angle = Math.atan2(dy, dx);
      e.fireBreathTelegraph = {x: e.x + Math.cos(angle)*1.5*TILE, y: e.y + Math.sin(angle)*1.5*TILE, timer: 0.5, radius: 2*TILE, angle: angle};
      e.seismicTelegraph = {x: e.x + Math.cos(angle)*1.5*TILE, y: e.y + Math.sin(angle)*1.5*TILE, timer: 0.5, radius: 2*TILE}; // reuse for render
      damageNumbers.push({x:e.x, y:e.y-e.def.h, text:'Sopro Fogo!', color:'#ff4400', size:7, timer:0.5, vy:-20});
    }
  }
  // Process fire breath telegraph
  if (e.fireBreathTelegraph) {
    e.fireBreathTelegraph.timer -= dt;
    if (e.fireBreathTelegraph.timer <= 0) {
      // Phase 2: execute breath cone
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      const pAngle = Math.atan2(player.y - e.y, player.x - e.x);
      const diff = Math.abs(pAngle - angle);
      if ((diff < Math.PI/3 || diff > Math.PI*5/3) && dToPlayer < 3*TILE) {
        damagePlayer(e.atk*1.3, e.x, e.y, e.level);
        applyStatusPlayer('queimadura', 3);
      }
      e.specialCD.fireBreath = 5;
      for (let i=0;i<10;i++) particles.push({x:e.x+Math.cos(angle)*TILE,y:e.y+Math.sin(angle)*TILE,vx:Math.cos(angle+((Math.random()-0.5)*0.5))*80,vy:Math.sin(angle+((Math.random()-0.5)*0.5))*80,color:'#ff6600',size:3,life:0.4,timer:0});
      e.fireBreathTelegraph = null;
      e.seismicTelegraph = null;
    }
  }
  // Voo Rasante (dash 4 tiles + dano)
  if (dToPlayer > 2*TILE && dToPlayer < 6*TILE && e.specialCD.swoopDash <= 0) {
    // Dash toward player
    const dashDist = 4*TILE;
    e.x += (dx/dToPlayer)*dashDist;
    e.y += (dy/dToPlayer)*dashDist;
    if (distXY(e.x, e.y, player.x, player.y) < TILE*1.5) {
      damagePlayer(e.atk*1.2, e.x, e.y, e.level);
    }
    e.specialCD.swoopDash = 8;
  }
  // GDD §10 Gap#26: Chuva Fogo (3 áreas aleatórias, telegraph 1s + red indicator)
  if (e.specialCD.fireRain <= 0) {
    if (!e.fireRainZones) e.fireRainZones = [];
    for (let i=0;i<3;i++) {
      const mx = player.x + (Math.random()-0.5)*4*TILE;
      const my = player.y + (Math.random()-0.5)*4*TILE;
      e.fireRainZones.push({x:mx, y:my, timer:1.0, radius:1.5*TILE, dmg:e.atk*1.3});
      // Visual telegraph: red circle via activeMeteors
      activeMeteors.push({x:mx, y:my, timer:1.0, dmgPct:0, skillLevel:1, exploded:false, color:'#ff4400', radius:1.5*TILE});
    }
    e.specialCD.fireRain = 12;
  }
  // GDD §10 Gap#26: Process fire rain telegraph zones → damage player when timer expires
  if (e.fireRainZones && e.fireRainZones.length > 0) {
    for (const fz of e.fireRainZones) {
      fz.timer -= dt;
      if (fz.timer <= 0 && !fz.hit) {
        fz.hit = true;
        if (distXY(player.x, player.y, fz.x, fz.y) < fz.radius) {
          damagePlayer(fz.dmg, fz.x, fz.y, e.level);
          applyStatusPlayer('queimadura', 3);
        }
        shakeScreen(3, 0.2);
      }
    }
    e.fireRainZones = e.fireRainZones.filter(fz => !fz.hit);
  }
}

// GDD §10: Guarda Real — agressivo, combo espada, escudo carregado, grito, invoca cavaleiros
function updateGuardaRealAI(e, dt, dx, dy, dToPlayer, baseSpeed) {
  // Agressivo: sempre persegue
  if (dToPlayer > TILE*1.2) {
    const spd = baseSpeed*dt;
    const nx = e.x + (dx/dToPlayer)*spd, ny = e.y + (dy/dToPlayer)*spd;
    if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2)) e.x = nx;
    if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2)) e.y = ny;
  }
  // Combo Espada (3 golpes rápidos) — Gap#26: red ground indicator before combo
  if (dToPlayer < TILE*1.5 && e.specialCD.swordCombo <= 0) {
    if (!e.swordComboTelegraph) {
      // Phase 1: red indicator at melee range for 0.4s
      e.swordComboTelegraph = {x: e.x, y: e.y, timer: 0.4, radius: TILE*1.5};
      e.seismicTelegraph = {x: e.x, y: e.y, timer: 0.4, radius: TILE*1.5}; // reuse for render
      damageNumbers.push({x:e.x, y:e.y-e.def.h, text:'Combo Espada!', color:'#ff4444', size:7, timer:0.4, vy:-20});
    }
  }
  // Process sword combo telegraph
  if (e.swordComboTelegraph) {
    e.swordComboTelegraph.timer -= dt;
    if (e.swordComboTelegraph.timer <= 0) {
      // Phase 2: execute the 3-hit combo
      for (let i=0;i<3;i++) {
        setTimeout(() => {
          if (!e.dead && !player.dead) damagePlayer(e.atk*0.8, e.x, e.y, e.level);
        }, i*200);
      }
      e.specialCD.swordCombo = 5;
      e.swordComboTelegraph = null;
      e.seismicTelegraph = null;
    }
  }
  // GDD §10: Escudo Carregado (investida 3 tiles + bloqueio frontal) — Gap#26: red ground indicator
  if (dToPlayer > 2*TILE && dToPlayer < 5*TILE && e.specialCD.shieldCharge <= 0) {
    if (!e.shieldChargeTelegraph) {
      // Phase 1: red line/area indicator toward player for 0.4s
      const targetX = e.x + (dx/dToPlayer)*3*TILE;
      const targetY = e.y + (dy/dToPlayer)*3*TILE;
      e.shieldChargeTelegraph = {x: targetX, y: targetY, timer: 0.4, radius: TILE*1.5, srcX: e.x, srcY: e.y};
      e.seismicTelegraph = {x: targetX, y: targetY, timer: 0.4, radius: TILE*1.5}; // reuse for render
      damageNumbers.push({x:e.x, y:e.y-e.def.h, text:'Investida!', color:'#ff4444', size:7, timer:0.4, vy:-20});
    }
  }
  // Process shield charge telegraph
  if (e.shieldChargeTelegraph) {
    e.shieldChargeTelegraph.timer -= dt;
    if (e.shieldChargeTelegraph.timer <= 0) {
      // Phase 2: execute charge
      const cdx = player.x - e.x, cdy = player.y - e.y;
      const cdist = Math.sqrt(cdx*cdx + cdy*cdy) || 1;
      e.shieldCharging = true;
      e.shieldChargeDir = Math.atan2(cdy, cdx);
      e.blocking = true;
      e.blockTimer = 0.6;
      e.frontalBlock = true;
      e.frontalBlockDir = e.shieldChargeDir;
      const dashDist = 3*TILE;
      e.x += (cdx/cdist)*dashDist;
      e.y += (cdy/cdist)*dashDist;
      if (distXY(e.x, e.y, player.x, player.y) < TILE*1.5) {
        damagePlayer(e.atk*1.2, e.x, e.y, e.level);
      }
      e.specialCD.shieldCharge = 8;
      e.shieldChargeTelegraph = null;
      e.seismicTelegraph = null;
      setTimeout(() => {
        e.shieldCharging = false;
        e.frontalBlock = false;
      }, 600);
    }
  }
  // GDD §10: Grito Comando (+30%ATK aliados 8s — temporário)
  if (e.specialCD.warCry <= 0) {
    for (const ally of enemies) {
      if (ally === e || ally.dead || ally.isBoss) continue;
      if (distXY(e.x, e.y, ally.x, ally.y) < 5*TILE) {
        if (!ally.warCryBuff) {
          ally.warCryBuff = {timer: 8, atkBonus: ally.atk * 0.3};
          ally.atk += ally.warCryBuff.atkBonus;
        }
        damageNumbers.push({x:ally.x, y:ally.y-ally.def.h, text:'Buff!', color:'#ff8800', size:6, timer:0.6, vy:-20});
      }
    }
    e.specialCD.warCry = 15;
    damageNumbers.push({x:e.x, y:e.y-e.def.h, text:'Grito de Comando!', color:'#ff8800', size:7, timer:1, vy:-20});
  }
  // Invocar 2 Cavaleiros (CD 15s)
  if (e.specialCD.summonKnights <= 0) {
    spawnMinion(e, B5_POOL, 0, 2, 0.5, 0.5); // Cavaleiros Negros
    e.specialCD.summonKnights = 15;
  }
}

// GDD §18: NPC room barrier — helper to check if a position is inside any NPC room
function isInNpcRoom(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  for (const npc of npcs) {
    if (!npc.room) continue;
    const r = npc.room;
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return true;
  }
  return false;
}

// ============================================================
// UPDATE ENEMIES (regular enemies — pathfinding, contact damage)
// ============================================================

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) { e.deathTimer -= dt; continue; }
    if (e.isBoss || e.isMiniBoss) continue; // Handled by dedicated AI

    e.atkTimer = Math.max(0, e.atkTimer - dt);
    if (e.hpShowTimer > 0) e.hpShowTimer -= dt;
    // GDD §9 Gap#25: Regular enemy telegraph 0.3s (sprite recua antes de atacar)
    if (e.telegraphing) {
      e.telegraphTimer -= dt;
      // Visual cue: flash red during telegraph
      e.telegraphFlash = true;
      if (e.telegraphTimer <= 0) {
        e.telegraphing = false;
        e.telegraphAnim = false;
        e.telegraphFlash = false;
        e.readyToStrike = true; // flag para executar o ataque neste frame
      } else {
        // Ainda telegrafando — skip movement e attack
        continue;
      }
    } else {
      e.telegraphFlash = false;
    }
    // GDD §10: Guarda Real warCry buff expira
    if (e.warCryBuff) {
      e.warCryBuff.timer -= dt;
      if (e.warCryBuff.timer <= 0) { e.atk -= e.warCryBuff.atkBonus; e.warCryBuff = null; }
    }

    const dx = player.x - e.x, dy = player.y - e.y;
    const dToPlayer = Math.sqrt(dx*dx + dy*dy);
    const arch = ARCHETYPES[e.def.arch];
    const baseSpeed = e.speed * 4 * TILE;

    // GDD §18: NPC room barrier — inimigos não entram, param na porta e voltam a patrulhar após 3s
    if (e.npcBlockTimer > 0) {
      e.npcBlockTimer -= dt;
      if (e.npcBlockTimer <= 0) e.state = 'patrol';
      continue; // Espera na porta sem se mover
    }
    for (const npc of npcs) {
      if (npc.room) {
        const r = npc.room;
        const etx = Math.floor(e.x / TILE);
        const ety = Math.floor(e.y / TILE);
        if (etx >= r.x && etx < r.x+r.w && ety >= r.y && ety < r.y+r.h) {
          // Já está dentro — empurra pra fora
          e.x = (r.cx > etx ? r.x - 1 : r.x + r.w) * TILE + TILE/2;
          e.state = 'patrol';
        }
      }
    }

    // GDD §5: Status effects on enemies
    if (e.statusEffects) {
      updateStatusEffects(e, dt, false);
      // Congela/Atordoamento: imóvel, não ataca
      if (hasStatus(e, 'congela') || hasStatus(e, 'atordoamento')) continue;
      // Imobiliza: preso, mas pode atacar (handled below — skip movement only)
    }
    // Taunt timer
    if (e.tauntTimer > 0) e.tauntTimer -= dt;
    // Confusion timer (from smoke)
    if (e.confusionTimer > 0) { e.confusionTimer -= dt; e.state = 'patrol'; }

    // GDD §5: Lentidão = -30% velocidade
    const speedMult = hasStatus(e, 'lentidao') ? 0.7 : 1;
    const isImmobilized = e.statusEffects && hasStatus(e, 'imobiliza');

    if (e.state === 'patrol') {
      if (!e.patrolTarget || e.patrolTimer <= 0) {
        e.patrolTarget = {
          x: e.x + (Math.random()-0.5) * TILE * randInt(3,4) * 2,
          y: e.y + (Math.random()-0.5) * TILE * randInt(3,4) * 2
        };
        e.patrolTimer = randInt(2, 4);
      }
      const ptDx = e.patrolTarget.x - e.x;
      const ptDy = e.patrolTarget.y - e.y;
      const ptD = Math.sqrt(ptDx*ptDx + ptDy*ptDy);
      if (ptD > 4 && !isImmobilized) {
        const spd = baseSpeed * 0.4 * speedMult * dt;
        const nx = e.x + (ptDx/ptD) * spd;
        const ny = e.y + (ptDy/ptD) * spd;
        if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2) && !isInNpcRoom(nx, e.y)) e.x = nx;
        if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2) && !isInNpcRoom(e.x, ny)) e.y = ny;
      }
      e.patrolTimer -= dt;
      // GDD §7: invisível — inimigos não detectam
      if (dToPlayer <= e.aggroRange && !player.dead && !player.invisible) e.state = 'chase';
    }

    else if (e.state === 'chase') {
      if (player.dead || player.invisible) { e.state = 'patrol'; continue; }
      // GDD §18: Se jogador está em sala NPC, inimigo para na porta e volta a patrulhar após 3s
      if (isInNpcRoom(player.x, player.y)) {
        e.state = 'patrol';
        e.npcBlockTimer = 3;
        continue;
      }
      const spd = isImmobilized ? 0 : baseSpeed * speedMult * dt;
      e.dir = Math.atan2(dy, dx);

      if (e.def.arch === 'caster') {
        if (!isImmobilized && dToPlayer < 2 * TILE) {
          const nx = e.x - (dx/dToPlayer) * spd;
          const ny = e.y - (dy/dToPlayer) * spd;
          if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2) && !isInNpcRoom(nx, e.y)) e.x = nx;
          if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2) && !isInNpcRoom(e.x, ny)) e.y = ny;
        } else if (dToPlayer > 5 * TILE) {
          const nx = e.x + (dx/dToPlayer) * spd * 0.6;
          const ny = e.y + (dy/dToPlayer) * spd * 0.6;
          if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2) && !isInNpcRoom(nx, e.y)) e.x = nx;
          if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2) && !isInNpcRoom(e.x, ny)) e.y = ny;
        }
        if (e.atkTimer <= 0 && e.def.projSpeed && dToPlayer <= e.def.projRange * TILE) {
          // GDD §9 Gap#25: telegraph 0.3s antes de atacar (caster)
          if (!e.telegraphing && !e.readyToStrike) {
            e.telegraphing = true; e.telegraphTimer = 0.3; e.telegraphAnim = true;
          } else if (e.readyToStrike) {
            e.readyToStrike = false;
            e.atkTimer = arch.atkCD;
            enemyProjectiles.push({
              x: e.x, y: e.y,
              vx: (dx/dToPlayer) * e.def.projSpeed * TILE,
              vy: (dy/dToPlayer) * e.def.projSpeed * TILE,
              dmg: e.atk, color: e.def.projColor || '#ff6600',
              size: 3, range: e.def.projRange * TILE, traveled: 0
            });
          }
        }
      }
      // GDD §9: Forte tenta flanquear (ir pras costas)
      else if (e.def.arch === 'forte') {
        // Calcula ponto atrás do jogador (oposto à direção que ele olha)
        const behindX = player.x - Math.cos(player.dir || 0) * TILE * 2;
        const behindY = player.y - Math.sin(player.dir || 0) * TILE * 2;
        const flankDx = behindX - e.x, flankDy = behindY - e.y;
        const flankD = Math.sqrt(flankDx*flankDx + flankDy*flankDy);
        if (dToPlayer > TILE * 0.7 && flankD > TILE) {
          const nx = e.x + (flankDx/flankD) * spd;
          const ny = e.y + (flankDy/flankD) * spd;
          if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2) && !isInNpcRoom(nx, e.y)) e.x = nx;
          if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2) && !isInNpcRoom(e.x, ny)) e.y = ny;
        } else if (dToPlayer > TILE * 0.7) {
          const nx = e.x + (dx/dToPlayer) * spd;
          const ny = e.y + (dy/dToPlayer) * spd;
          if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2) && !isInNpcRoom(nx, e.y)) e.x = nx;
          if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2) && !isInNpcRoom(e.x, ny)) e.y = ny;
        }
        if (dToPlayer <= TILE && e.atkTimer <= 0) {
          // GDD §9 Gap#25: telegraph 0.3s antes de atacar
          if (!e.telegraphing && !e.readyToStrike) {
            e.telegraphing = true; e.telegraphTimer = 0.3; e.telegraphAnim = true;
          } else if (e.readyToStrike) {
            e.readyToStrike = false;
            e.atkTimer = arch.atkCD;
            damagePlayer(e.atk, e.x, e.y, e.level);
          }
        }
      }
      else {
        if (dToPlayer > TILE * 0.7) {
          const nx = e.x + (dx/dToPlayer) * spd;
          const ny = e.y + (dy/dToPlayer) * spd;
          if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2) && !isInNpcRoom(nx, e.y)) e.x = nx;
          if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2) && !isInNpcRoom(e.x, ny)) e.y = ny;
        }
        if (dToPlayer <= TILE && e.atkTimer <= 0) {
          // GDD §9 Gap#25: telegraph 0.3s antes de atacar
          if (!e.telegraphing && !e.readyToStrike) {
            e.telegraphing = true; e.telegraphTimer = 0.3; e.telegraphAnim = true;
          } else if (e.readyToStrike) {
            e.readyToStrike = false;
            e.atkTimer = arch.atkCD;
            damagePlayer(e.atk, e.x, e.y, e.level);
            if (e.def.arch === 'normal') {
              e.state = 'retreat';
              e.retreatTimer = 0.5;
            }
          }
        }
      }
      if (dToPlayer > e.aggroRange * 1.5) e.state = 'patrol';
    }

    else if (e.state === 'retreat') {
      e.retreatTimer -= dt;
      const spd = baseSpeed * dt;
      if (dToPlayer > 1) {
        const nx = e.x - (dx/dToPlayer) * spd;
        const ny = e.y - (dy/dToPlayer) * spd;
        if (!collidesWall(nx, e.y, e.def.w/2, e.def.h/2) && !isInNpcRoom(nx, e.y)) e.x = nx;
        if (!collidesWall(e.x, ny, e.def.w/2, e.def.h/2) && !isInNpcRoom(e.x, ny)) e.y = ny;
      }
      if (e.retreatTimer <= 0) e.state = 'chase';
    }
  }

  enemies = enemies.filter(e => !e.dead || e.deathTimer > 0);
}
