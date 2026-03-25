'use strict';
// combat.js — Damage, Skills, Projectiles, Familiar, Sentinels, Traps, Meteors

// ============================================================
// COMBAT CORE
// ============================================================
let damageNumbers = [];
let particles = [];
let hudGoldNotifs = []; // GDD §21: gold pickup HUD notifications
let essenciaParticles = []; // GDD §8: essência active golden particles

// GDD §6: Level diff damage scaling
function getLevelDmgMod(attackerLvl, defenderLvl, isPlayer) {
  const diff = clamp(Math.abs(attackerLvl - defenderLvl), 0, 7);
  const entry = LEVEL_DMG_SCALE[Math.min(diff, 7)] || LEVEL_DMG_SCALE[7];
  if (isPlayer) {
    // Jogador atacando: se inimigo > jogador, dano reduzido
    return attackerLvl >= defenderLvl ? 1.0 : entry[0];
  } else {
    // Inimigo atacando: se inimigo > jogador, dano aumentado
    return attackerLvl >= defenderLvl ? entry[1] : 1.0;
  }
}

// GDD §4: dano_bruto = ATK × skill_mult → redução = DEF/(DEF+50)
function calcDamage(atk, def, skillMult) {
  const reduction = def / (def + 50);
  const raw = atk * (skillMult || 1) * (1 - reduction);
  return Math.max(1, Math.floor(raw * (0.9 + Math.random() * 0.2)));
}

function damageEnemy(enemy, rawAtk) {
  if (enemy.dead || enemy.invulnerable) return;

  // GDD §10 Gap#22: Blocking + reflect (Nahgord Barreira)
  if (enemy.blocking) {
    if (enemy.blockReflect) {
      const reflectDmg = Math.floor(rawAtk * 0.4);
      damagePlayer(reflectDmg, enemy.x, enemy.y, enemy.level);
      damageNumbers.push({x:enemy.x, y:enemy.y-enemy.def.h, text:'Refletido!', color:'#ff44ff', size:7, timer:0.8, vy:-20});
    }
    return; // blocked — no damage to boss
  }

  // GDD §6: Level scaling
  const lvlMod = getLevelDmgMod(player.level, enemy.level, true);
  // GDD §5: Maldição -20% ATK
  let atkMod = hasStatus(player, 'maldicao') ? 0.8 : 1;
  let dmg = calcDamage(rawAtk * lvlMod * atkMod, enemy.defense);
  let isCrit = false;

  // GDD §4: Crit check
  if (Math.random() * 100 < getCritChance()) {
    dmg = Math.floor(dmg * getCritDmg() / 100);
    isCrit = true;
    flashScreen('#fff', 0.15, 0.1);
  }

  // GDD §10: Escudo absorve dano primeiro (Lich Menor etc)
  if (enemy.shield && enemy.shield > 0) {
    const absorbed = Math.min(dmg, enemy.shield);
    enemy.shield -= absorbed;
    dmg -= absorbed;
  }
  enemy.hp -= dmg;
  enemy.hpShowTimer = 3;

  damageNumbers.push({
    x: enemy.x, y: enemy.y - enemy.def.h,
    text: '' + dmg, color: isCrit ? '#ffff00' : '#ffffff',
    size: isCrit ? 10 : 7, timer: 0.8, vy: -TILE/0.8
  });
  sfx('hit');

  // M3: onPlayerDamageDealt hook (essência, foco, regen batalha)
  onPlayerDamageDealt(dmg, isCrit);

  // GDD §5: Congela — dano quebra o gelo
  const freezeIdx = enemy.statusEffects.findIndex(s => s.id === 'congela');
  if (freezeIdx >= 0) enemy.statusEffects.splice(freezeIdx, 1);

  if (enemy.hp <= 0) killEnemy(enemy);
  else {
    enemy.state = 'chase';
    // GDD §10: Thornax F2 at HP≤50%
    if (enemy.isBoss && enemy.bossPhase === 1 && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.bossPhase = 2;
      sfx('bossRoar');
      shakeScreen(5, 0.3);
      flashScreen('#ff0000', 0.3, 0.3);
      enemy.speed = 0.8 * 1.3; // GDD §10: +30% vel
    }
  }
}

function damagePlayer(amount, fromX, fromY, attackerLvl) {
  if (player.iframeTimer > 0 || player.dead) return;

  // GDD §7: Bloqueio Perfeito — bloqueia 1 ataque (0 dano) + revida 100%
  if (player.perfectBlock) {
    player.perfectBlock = false;
    player.perfectBlockTimer = 0;
    damageNumbers.push({x:player.x, y:player.y-20, text:'Bloqueio!', color:'#ffd700', size:8, timer:0.8, vy:-30});
    // Revida 100% AtkFis no atacante mais próximo
    if (fromX !== undefined) {
      for (const e of enemies) {
        if (e.dead) continue;
        if (distXY(fromX, fromY, e.x, e.y) < TILE) {
          damageEnemy(e, getAtkFis());
          break;
        }
      }
    }
    return;
  }

  // GDD §4: Esquiva check
  let esquiva = getEsquiva();
  // Assassino passiva: Evasão +20%
  if (hasPassive('evasao')) esquiva += 20;
  if (Math.random() * 100 < esquiva) {
    damageNumbers.push({
      x: player.x, y: player.y - 20,
      text: 'Esquiva!', color: '#88ccff', size: 7, timer: 0.6, vy: -30
    });
    // Assassino recurso: +15 energia ao esquivar (só passiva)
    return;
  }

  // GDD §6: Level scaling
  const lvlMod = attackerLvl ? getLevelDmgMod(attackerLvl, player.level, false) : 1;
  // Buff DEF multiplier
  const defMult = getBuffMult('def');
  // Guerreiro passiva: Pele Ferro -10%
  let dmgReduction = 1;
  if (hasPassive('peleFerro')) dmgReduction *= 0.9;
  // Maldição: -20% DEF
  if (hasStatus(player, 'maldicao')) dmgReduction *= 1.2;

  let dmg = Math.floor(calcDamage(amount * lvlMod, getDefense() * defMult) * dmgReduction);

  // GDD §7: Escudo Espelhado — reflete 40% dano
  if (player.reflectTimer > 0 && player.reflectPct > 0) {
    const reflectDmg = Math.min(Math.floor(getMaxHp() * 0.15), Math.floor(dmg * player.reflectPct / 100));
    if (fromX !== undefined) {
      for (const e of enemies) {
        if (e.dead) continue;
        if (distXY(fromX, fromY, e.x, e.y) < TILE * 2) {
          e.hp -= reflectDmg;
          e.hpShowTimer = 3;
          damageNumbers.push({x:e.x, y:e.y-e.def.h, text:''+reflectDmg, color:'#8888ff', size:6, timer:0.6, vy:-25});
          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
    }
  }

  // GDD §8: Essência Escudo
  if (player.essenciaShield > 0) {
    const absorbed = Math.min(player.essenciaShield, dmg);
    player.essenciaShield -= absorbed;
    dmg -= absorbed;
    if (dmg <= 0) {
      damageNumbers.push({x:player.x, y:player.y-20, text:'Absorvido!', color:'#ffd700', size:7, timer:0.6, vy:-30});
      return;
    }
  }

  // GDD §7: Barreira absorve
  if (player.barrier > 0) {
    const absorbed = Math.min(player.barrier, dmg);
    player.barrier -= absorbed;
    dmg -= absorbed;
    if (dmg <= 0) {
      damageNumbers.push({x:player.x, y:player.y-20, text:'Barreira!', color:'#4488ff', size:7, timer:0.6, vy:-30});
      return;
    }
  }

  // Guerreiro passiva: Contra-Ataque — 15% chance revida 100% AtkFis
  if (hasPassive('contraAtaque') && Math.random() < 0.15 && fromX !== undefined) {
    for (const e of enemies) {
      if (e.dead) continue;
      if (distXY(fromX, fromY, e.x, e.y) < TILE * 2) {
        damageEnemy(e, getAtkFis());
        break;
      }
    }
  }

  player.hp -= dmg;
  player.iframeTimer = 0.5;
  player.blinkTimer = 0;

  // M3: essência fill on damage taken
  onPlayerDamageTaken();

  damageNumbers.push({
    x: player.x, y: player.y - 20,
    text: '' + dmg, color: '#ff4444', size: 8, timer: 0.8, vy: -TILE/0.8
  });

  // GDD §25: Knockback 1 tile — GDD §8: Canalização (Mago lvl40) impede knockback
  if (fromX !== undefined && !hasPassive('canalizacao')) {
    const angle = Math.atan2(player.y - fromY, player.x - fromX);
    player.kbVx = Math.cos(angle) * TILE * 5;
    player.kbVy = Math.sin(angle) * TILE * 5;
    player.kbTimer = 0.2;
  }

  sfx('playerHit');
  shakeScreen(3, 0.15);

  // GDD §11: HP baixo (<15%) — fala 1x por andar
  if (player.hp > 0 && player.hp < getMaxHp() * 0.15 && !player.dialogsSeen['hpBaixo' + currentFloor]) {
    player.dialogsSeen['hpBaixo' + currentFloor] = true;
    showDroghanBubble('Preciso de uma poção...');
  }

  if (player.hp <= 0) playerDeath();
}

function killEnemy(enemy) {
  enemy.dead = true;
  enemy.deathTimer = 0.5;
  player.enemiesKilled++;

  // GDD §10: Invocações (summoned) NÃO dão XP, ouro nem drops
  if (enemy.summoned) {
    sfx('kill');
    for (let i = 0; i < 4; i++) {
      particles.push({x: enemy.x, y: enemy.y, vx: (Math.random()-0.5)*60, vy: -Math.random()*40, color:'#888', size:2, life:0.4, timer:0});
    }
    return;
  }

  onEnemyKill(enemy); // M3: essência, passivas, recurso
  checkBadges('kill'); // GDD §21: check milionário, exterminador

  // GDD §16: Ouro = level×2 + random(0, level)
  let goldAmount = enemy.level * 2 + randInt(0, enemy.level);

  // GDD §6: Farm revisit gold/XP reduction
  const visitCount = (player.contadorRevisitasPorAndar || {})[currentFloor] || 1;
  let goldMult = 1.0, xpRevisitMult = 1.0;
  if (visitCount === 2) { goldMult = 0.50; xpRevisitMult = 0.70; }
  else if (visitCount === 3) { goldMult = 0.25; xpRevisitMult = 0.50; }
  else if (visitCount >= 4) { goldMult = 0.10; xpRevisitMult = 0.30; }
  goldAmount = Math.max(1, Math.floor(goldAmount * goldMult));

  goldPickups.push({x: enemy.x, y: enemy.y, amount: goldAmount});

  // GDD §16: XP = level × 3 (regular), ×3 mini-boss, ×10 boss
  let xpMult = 1;
  if (enemy.isMiniBoss) xpMult = 3;
  if (enemy.isBoss) xpMult = 10;
  let xpAmount = Math.max(1, Math.floor(enemy.level * 3 * xpMult * xpRevisitMult));
  grantXP(xpAmount);

  sfx('kill');

  // Partículas
  for (let i = 0; i < randInt(6, 8); i++) {
    particles.push({
      x: enemy.x, y: enemy.y,
      vx: (Math.random()-0.5)*80, vy: (Math.random()-0.5)*80 - 20,
      color: enemy.isBoss ? '#ffd700' : getBiomeParticleColor(), size: enemy.isBoss ? 3 : 2, life: 0.5, timer: 0
    });
  }

  // === DROPS (GDD §16) ===
  if (enemy.isMiniBoss) {
    // GDD §16: Mini-boss: 1 Poção Gra (fixo)
    itemDrops.push({
      x: enemy.x + randInt(-8,8), y: enemy.y + randInt(-8,8),
      item: {...POTIONS.potGra, id:'potGra', qty:1, type:'consumable'}
    });
    // GDD §16: + 1 item: Equip tier atual(50%) | Equip tier+1(15%) | Buff raro(20%) | Scroll(15%)
    const mbRoll = Math.random() * 100;
    const currentTier = currentFloor <= 5 ? 0 : Math.min(5, Math.floor((currentFloor - 1) / 5));
    let mbItem;
    if (mbRoll < 50) {
      const slots = ['weapon','body','head','secondary','feet'];
      mbItem = makeEquip(slots[randInt(0, slots.length-1)], currentTier, 0, player.classKey);
    } else if (mbRoll < 65) {
      const slots = ['weapon','body','head','secondary','feet'];
      mbItem = makeEquip(slots[randInt(0, slots.length-1)], Math.min(5, currentTier + 1), 0, player.classKey);
    } else if (mbRoll < 85) {
      // GDD §16: Buff raro
      const buffKeys = ['buffForca','buffVel','buffProtecao','buffSorte','buffFuria'];
      const bk = buffKeys[randInt(0, buffKeys.length-1)];
      mbItem = {...POTIONS[bk], id:bk, qty:1, type:'consumable'};
    } else {
      // GDD §16: Scroll Skill (15%) — só pós-A5
      if (currentFloor >= 5 && player.classKey) {
        mbItem = {name:'Scroll Skill', id:'scrollSkill', qty:1, type:'scroll', color:'#ffd700'};
      } else {
        mbItem = {...POTIONS.potGra, id:'potGra', qty:1, type:'consumable'};
      }
    }
    if (mbItem) {
      itemDrops.push({
        x: enemy.x + randInt(-12,12), y: enemy.y + randInt(-12,12),
        item: mbItem
      });
    }
    // GDD §3: Mini-boss dropa anel (andares 3,8,13,18,23)
    if ([3,8,13,18,23].includes(currentFloor)) {
      const ringTier = getRingTierForFloor(currentFloor);
      itemDrops.push({
        x: enemy.x + randInt(-10,10), y: enemy.y + randInt(-10,10),
        item: makeRing(ringTier)
      });
    }
    // GDD §3: Mini-boss dropa amuleto (chance por raridade)
    const mbAmuletRarity = rollAmuletRarity('miniBoss', currentFloor);
    if (mbAmuletRarity && player.classKey) {
      itemDrops.push({
        x: enemy.x + randInt(-10,10), y: enemy.y + randInt(-10,10),
        item: makeAmulet(mbAmuletRarity, 0, player.classKey)
      });
    }
    miniBossDefeated[currentFloor] = true;
    // GDD §11: Derrotar mini-boss — fala Droghan
    setTimeout(() => {
      showDroghanBubble(Math.random() < 0.5 ? 'Isso foi difícil.' : 'Quase não consegui.');
    }, 500);
  }

  if (enemy.isBoss) {
    bossDefeated[currentFloor] = true;
    // GDD §21: Check badges on boss kill
    checkBadges('bossKill');
    // GDD §22: Save ao derrotar boss
    triggerSave();
    // GDD §10: escada descer aparece após boss
    if (stairsDown && !stairsDown.placed) {
      setTile(stairsDown.x, stairsDown.y, TILE_STAIRS_DOWN);
      stairsDown.placed = true;
    }
    bossRoomLocked = false;

    // GDD §10: Recompensas específicas por boss
    const bossSlots = ['weapon','body','head','secondary','feet'];
    const bossSlot = bossSlots[randInt(0, bossSlots.length-1)];

    if (currentFloor === 5) {
      // GDD §10: Thornax — escolha classe + 1 peça T2 aleatória da classe
      // T2 drop gerado após escolha de classe (classKey é null aqui)
      const thornaxDropX = enemy.x + randInt(-12,12);
      const thornaxDropY = enemy.y + randInt(-12,12);
      const thornaxDropSlot = bossSlot;
      setTimeout(() => {
        if (!player.classKey) {
          gameState = 'classSelect';
          classSelectData = {cursor: 0, classes: ['guerreiro','mago','arqueiro','assassino'],
            thornaxDrop: {x: thornaxDropX, y: thornaxDropY, slot: thornaxDropSlot}};
        }
      }, 1500);
    } else if (currentFloor === 10) {
      // GDD §10: Morvena — T3 + 1ª evolução + scroll skill (específico, soma com o fixo)
      itemDrops.push({
        x: enemy.x + randInt(-12,12), y: enemy.y + randInt(-12,12),
        item: makeEquip(bossSlot, 3, 0, player.classKey)
      });
      // Scroll específico da Morvena (GDD §10: soma com o fixo de boss)
      itemDrops.push({
        x: enemy.x + randInt(-8,8), y: enemy.y + randInt(-4,4),
        item: {name:'Scroll Skill', id:'scrollSkill', qty:1, type:'scroll', color:'#ffd700'}
      });
      // 1ª evolução — flag para sistema de evolução
      player.classEvolution = (player.classEvolution || 0) + 1;
    } else if (currentFloor === 15) {
      // GDD §10: Azaroth — T4 + 2ª evolução + revelação poder oculto
      itemDrops.push({
        x: enemy.x + randInt(-12,12), y: enemy.y + randInt(-12,12),
        item: makeEquip(bossSlot, 4, 0, player.classKey)
      });
      player.classEvolution = (player.classEvolution || 0) + 1;
      // GDD §8: Azaroth reward event — revelação poder oculto
      setTimeout(() => {
        startDialogue('Narração', '#ffdd44', ['A Essência Ancestral pulsa dentro de você...', 'O poder oculto se revela.']);
      }, 2500);
    } else if (currentFloor === 20) {
      // GDD §10: Ignaroth — T5 + 3ª evolução + despertar poder
      itemDrops.push({
        x: enemy.x + randInt(-12,12), y: enemy.y + randInt(-12,12),
        item: makeEquip(bossSlot, 5, 0, player.classKey)
      });
      player.classEvolution = (player.classEvolution || 0) + 1;
      // GDD §8: Ignaroth reward event — despertar poder
      setTimeout(() => {
        startDialogue('Narração', '#ffdd44', ['O poder desperta completamente.', 'Você sente a Essência fluir sem restrição.']);
      }, 2500);
    } else if (currentFloor === 25) {
      // GDD §10: Nahgord — T5 + Anel Ancestral
      itemDrops.push({
        x: enemy.x + randInt(-12,12), y: enemy.y + randInt(-12,12),
        item: makeEquip(bossSlot, 5, 0, player.classKey)
      });
      // GDD §3: Anel Ancestral com efeito aleatório (usa makeRing)
      itemDrops.push({
        x: enemy.x + randInt(-8,8), y: enemy.y + randInt(-8,8),
        item: makeRing('ancestral')
      });
      // GDD §10: Cutscene final — Sombra Misteriosa + Damiana
      setTimeout(() => { triggerNahgordDeathCutscene(); }, 2000);
    }

    // GDD §3: Boss dropa amuleto (chance por raridade, lendário A20+)
    if (player.classKey) {
      const bossAmuletRarity = rollAmuletRarity('boss', currentFloor);
      if (bossAmuletRarity) {
        itemDrops.push({
          x: enemy.x + randInt(-10,10), y: enemy.y + randInt(-10,10),
          item: makeAmulet(bossAmuletRarity, 0, player.classKey)
        });
      }
    }

    // GDD §16: Boss: Poção Total + Scroll Skill (fixos, SOMAM com a específica)
    itemDrops.push({
      x: enemy.x + randInt(-8,8), y: enemy.y + randInt(4,12),
      item: {...POTIONS.potTotal, id:'potTotal', qty:1, type:'consumable'}
    });
    itemDrops.push({
      x: enemy.x + randInt(-12,12), y: enemy.y + randInt(-8,8),
      item: {name:'Scroll Skill', id:'scrollSkill', qty:1, type:'scroll', color:'#ffd700'}
    });

    // GDD §2/§11: Cutscenes Nahgord pós-boss (provocações)
    setTimeout(() => { triggerBossCutscene(currentFloor); }, 2000);
  }

  // Regular enemy drops (GDD §16)
  if (!enemy.isBoss && !enemy.isMiniBoss) {
    const archetype = enemy.def.arch;
    let dropChance = 0;
    if (archetype === 'enxame' || archetype === 'tank') dropChance = 0.08;
    else if (archetype === 'normal') dropChance = 0.12;
    else if (archetype === 'forte' || archetype === 'caster') dropChance = 0.18;

    // GDD §16: SOR modifier
    dropChance *= (1 + player.SOR * 0.01);
    // GDD §9: Mimic drop garantido
    if (enemy.guaranteedDrop) dropChance = 1.0;

    if (Math.random() < dropChance) {
      // GDD §16: Peso: Poção Vida(40%) | Poção Recurso(20%) | Antídoto/Água Benta(15%) | Buff(10%) | Equip(10%) | Scroll(3%) | Cristal Reset(2%)
      // Pré-classe: scroll redistribuído (GDD §16: "Scroll Skill só dropa a partir do A5")
      const roll = Math.random() * 100;
      let droppedItem;
      if (roll < 40) {
        // Poção Vida: Peq ou Méd dependendo do andar
        droppedItem = currentFloor < 3
          ? {...POTIONS.potPeq, id:'potPeq', qty:1, type:'consumable'}
          : {...POTIONS.potMed, id:'potMed', qty:1, type:'consumable'};
      }
      else if (roll < 60) {
        // GDD §15: Poção Recurso (+50% máx, só pós-A5)
        if (currentFloor >= 5 && player.classKey) {
          droppedItem = {name:'Poção Recurso', id:'potRecurso', qty:1, type:'consumable', restoreResource:true};
        } else {
          droppedItem = {...POTIONS.potPeq, id:'potPeq', qty:1, type:'consumable'};
        }
      }
      else if (roll < 75) {
        // Antídoto/Água Benta
        droppedItem = Math.random() < 0.6
          ? {...POTIONS.antidoto, id:'antidoto', qty:1, type:'consumable'}
          : {...POTIONS.aguaBenta, id:'aguaBenta', qty:1, type:'consumable'};
      }
      else if (roll < 85) {
        // GDD §15: Buff aleatório
        const bKeys = ['buffForca','buffVel','buffProtecao','buffSorte','buffFuria'];
        const bk = bKeys[randInt(0, bKeys.length-1)];
        droppedItem = {...POTIONS[bk], id:bk, qty:1, type:'consumable'};
      }
      else if (roll < 95) {
        // GDD §16: Equip drop: A1-5=T0 genérico
        const slots = ['weapon','body','head','secondary','feet'];
        const slot = slots[randInt(0, slots.length-1)];
        const tier = currentFloor <= 5 ? 0 : Math.min(5, Math.floor((currentFloor - 1) / 5));
        droppedItem = makeEquip(slot, tier, 0, player.classKey);
      }
      else if (roll < 98) {
        // GDD §16: Scroll Skill(3%) — só pós-A5
        if (currentFloor >= 5 && player.classKey) {
          droppedItem = {name:'Scroll Skill', id:'scrollSkill', qty:1, type:'scroll', color:'#ffd700'};
        } else {
          droppedItem = {...POTIONS.potPeq, id:'potPeq', qty:1, type:'consumable'};
        }
      }
      else {
        // GDD §16: Cristal Reset(2%) — reseta CD de 1 skill, raro
        droppedItem = {name:'Cristal Reset', id:'cristalReset', qty:1, type:'consumable', color:'#00ffff'};
      }

      if (droppedItem) {
        itemDrops.push({
          x: enemy.x + randInt(-6,6), y: enemy.y + randInt(-6,6),
          item: droppedItem
        });
      }
    }
    // GDD §3: Regular enemies drop amulet (raro)
    if (player.classKey) {
      const regAmuletRarity = rollAmuletRarity('regular', currentFloor);
      if (regAmuletRarity) {
        itemDrops.push({
          x: enemy.x + randInt(-6,6), y: enemy.y + randInt(-6,6),
          item: makeAmulet(regAmuletRarity, 0, player.classKey)
        });
      }
    }
  }

  // Kill boss summons when boss dies (GDD §10)
  if (enemy.isBoss || enemy.isMiniBoss) {
    for (const e of enemies) {
      if (e.summoner === enemy && !e.dead) {
        e.dead = true; e.deathTimer = 0.3;
      }
    }
  }
}

// pendingLevelUp e levelUpData definidos em player.js
let deathGoldLost = 0;

function grantXP(amount) {
  if (player.level >= 50) return; // GDD §4: Level max 50
  player.xp += amount;
  while (player.xp >= getXpToNext() && player.level < 50) {
    player.xp -= getXpToNext();
    player.level++;
    pendingLevelUp = true;
    // GDD §4: cura total no level up (exceto durante boss fight)
    const inBossFight = enemies.some(e => e.isBoss && !e.dead);
    if (!inBossFight) player.hp = getMaxHp();
    // GDD §7: +1 skill point por level (pós-classe)
    if (player.classKey) player.skillPoints++;
    // GDD §7: Desbloquear passivas por level
    checkPassiveUnlocks();
    sfx('levelUp');
    shakeScreen(2, 0.2);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      particles.push({
        x: player.x, y: player.y,
        vx: Math.cos(angle)*50, vy: Math.sin(angle)*50,
        color: '#ffd700', size: 3, life: 0.8, timer: 0
      });
    }
    // GDD §11: Primeiro level up — fala Droghan
    if (player.level === 2 && !player.dialogsSeen['firstLevelUp']) {
      player.dialogsSeen['firstLevelUp'] = true;
      setTimeout(() => { showDroghanBubble('Estou ficando mais forte.'); }, 500);
    }
  }
}

function playerDeath() {
  // GDD §7: Guerreiro passiva Vontade Inquebrável — revive 30% HP, 1x/andar
  // Também ativada temporariamente via Despertar Total
  if ((hasPassive('vontadeInqueb') || hasBuff('vontadeTemp')) && !player.vontadeUsed) {
    player.vontadeUsed = true;
    player.hp = Math.floor(getMaxHp() * 0.3);
    player.iframeTimer = 2;
    damageNumbers.push({x:player.x, y:player.y-30, text:'Vontade Inquebrável!', color:'#ffd700', size:8, timer:1.5, vy:-20});
    shakeScreen(4, 0.3);
    for (let i = 0; i < 15; i++) {
      const angle = (i/15)*Math.PI*2;
      particles.push({x:player.x, y:player.y, vx:Math.cos(angle)*60, vy:Math.sin(angle)*60, color:'#ffd700', size:3, life:0.8, timer:0});
    }
    sfx('levelUp');
    return;
  }
  player.dead = true;
  player.deathTimer = 1;
  player.deaths++;
  deathGoldLost = Math.floor(player.gold * 0.1);
  player.gold -= deathGoldLost;
  // GDD §21: Track if player died on a boss floor (disqualifies Caça-Chefes)
  if ([5,10,15,20,25].includes(currentFloor) && !bossDefeated[currentFloor]) {
    bossDeathTracker[currentFloor] = true;
  }
  // GDD §20: Essência cai pra 50% da barra atual
  player.essencia = Math.floor(player.essencia * 0.5);
  sfx('death');
  // GDD §22: Autosave na morte (estado pós-morte)
  triggerSave();
  // GDD §11: Primeira morte — fala Droghan
  if (player.deaths === 1) {
    showDroghanBubble('Não... ainda não.');
  }
}

// ============================================================
// SKILL COOLDOWNS
// ============================================================
function updateSkillCooldowns(dt) {
  for (const key of Object.keys(player.skillCooldowns)) {
    player.skillCooldowns[key] = Math.max(0, player.skillCooldowns[key] - dt);
  }
  // Invisible timer
  if (player.invisTimer > 0) {
    player.invisTimer -= dt;
    if (player.invisTimer <= 0) { player.invisible = false; player.invisBonusDmg = 0; }
  }
  // Perfect Block timer
  if (player.perfectBlockTimer > 0) {
    player.perfectBlockTimer -= dt;
    if (player.perfectBlockTimer <= 0) player.perfectBlock = false;
  }
  // Reflect timer
  if (player.reflectTimer > 0) {
    player.reflectTimer -= dt;
    if (player.reflectTimer <= 0) player.reflectPct = 0;
  }
  // Barrier timer
  if (player.barrierTimer > 0) {
    player.barrierTimer -= dt;
    if (player.barrierTimer <= 0) { player.barrier = 0; player.barrierMax = 0; }
  }
  // Essência Shield
  if (player.essenciaShieldTimer > 0) {
    player.essenciaShieldTimer -= dt;
    if (player.essenciaShieldTimer <= 0) player.essenciaShield = 0;
  }
  // GDD §4: VIT HP regen +0.2 HP/s per VIT point; GDD §5: Sangramento blocks regen
  if (player.hp < getMaxHp() && !player.dead && !hasStatus(player, 'sangramento')) {
    player.hp = Math.min(getMaxHp(), player.hp + player.VIT * 0.2 * dt);
  }
}

// ============================================================
// PLAYER PROJECTILES — GDD §7 skills ranged
// ============================================================
let playerProjectiles = [];

function updatePlayerProjectiles(dt) {
  for (let i = playerProjectiles.length - 1; i >= 0; i--) {
    const p = playerProjectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.traveled += Math.sqrt((p.vx*dt)**2 + (p.vy*dt)**2);

    // Wall collision
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    if (getTile(tx, ty) === TILE_WALL) {
      if (p.explode) doExplosion(p.x, p.y, p.explode, p.dmg, p.color);
      playerProjectiles.splice(i, 1); continue;
    }

    // Range limit
    if (p.traveled > p.maxRange) {
      if (p.explode) doExplosion(p.x, p.y, p.explode, p.dmg, p.color);
      playerProjectiles.splice(i, 1); continue;
    }

    // Hit enemies
    let hitSomething = false;
    for (const e of enemies) {
      if (e.dead || (p.hitList && p.hitList.has(e))) continue;
      const d = distXY(p.x, p.y, e.x, e.y);
      if (d < e.def.w / 2 + 4) {
        let dmg = p.dmg;
        // Crit
        let isCrit = p.autoCrit || Math.random() * 100 < getCritChance();
        if (isCrit) {
          dmg = Math.floor(dmg * getCritDmg() / 100);
          flashScreen('#fff', 0.15, 0.1);
        }
        const lvlMod = getLevelDmgMod(player.level, e.level, true);
        const finalDmg = calcDamage(dmg * lvlMod, e.defense);
        e.hp -= finalDmg;
        e.hpShowTimer = 3;
        damageNumbers.push({
          x: e.x, y: e.y - e.def.h,
          text: '' + finalDmg, color: isCrit ? '#ffff00' : '#ffffff',
          size: isCrit ? 10 : 7, timer: 0.8, vy: -TILE/0.8
        });
        sfx('hit');
        onPlayerDamageDealt(finalDmg, isCrit);
        // Status effect from skill
        if (p.status) applyStatusEnemy(e, p.status, p.statusDur);
        // Lifesteal
        if (p.lifesteal) {
          const heal = Math.floor(finalDmg * p.lifesteal);
          player.hp = Math.min(getMaxHp(), player.hp + heal);
        }
        if (e.hp <= 0) killEnemy(e);
        else e.state = 'chase';

        if (p.explode) {
          doExplosion(p.x, p.y, p.explode, p.dmg, p.color);
          hitSomething = true; break;
        }
        if (p.pierce && p.pierce > 0) {
          p.pierce--;
          if (!p.hitList) p.hitList = new Set();
          p.hitList.add(e);
        } else { hitSomething = true; break; }
      }
    }
    if (hitSomething) { playerProjectiles.splice(i, 1); }
  }
}

function doExplosion(x, y, radius, dmg, color) {
  shakeScreen(3, 0.2);
  sfx('hit');
  for (let k = 0; k < 8; k++) {
    const angle = Math.random() * Math.PI * 2;
    particles.push({
      x, y, vx: Math.cos(angle)*60, vy: Math.sin(angle)*60,
      color: color || '#ff6600', size: 3, life: 0.4, timer: 0
    });
  }
  for (const e of enemies) {
    if (e.dead) continue;
    if (distXY(x, y, e.x, e.y) < radius * TILE) {
      const lvlMod = getLevelDmgMod(player.level, e.level, true);
      const finalDmg = calcDamage(dmg * lvlMod, e.defense);
      e.hp -= finalDmg;
      e.hpShowTimer = 3;
      damageNumbers.push({x:e.x, y:e.y-e.def.h, text:''+finalDmg, color:'#ffaa00', size:7, timer:0.8, vy:-TILE/0.8});
      if (e.hp <= 0) killEnemy(e);
      else e.state = 'chase';
    }
  }
}

// ============================================================
// FAMILIAR — GDD §7 Mago skill 9
// ============================================================
function updateFamiliar(dt) {
  if (!player.familiar) return;
  player.familiar.timer -= dt;
  if (player.familiar.timer <= 0) { player.familiar = null; return; }
  // Orbit around player
  player.familiar.angle += dt * 2;
  player.familiar.x = player.x + Math.cos(player.familiar.angle) * TILE * 2;
  player.familiar.y = player.y + Math.sin(player.familiar.angle) * TILE * 2;
  // Attack nearest enemy every 1.5s
  player.familiar.atkTimer -= dt;
  if (player.familiar.atkTimer <= 0) {
    player.familiar.atkTimer = 1.5;
    let nearest = null, nearD = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = distXY(player.familiar.x, player.familiar.y, e.x, e.y);
      if (d < nearD) { nearD = d; nearest = e; }
    }
    if (nearest && nearD < 5 * TILE) {
      const dmg = Math.floor(getAtkMag() * player.familiar.dmgPct / 100);
      const lvlMod = getLevelDmgMod(player.level, nearest.level, true);
      const finalDmg = calcDamage(dmg * lvlMod, nearest.defense);
      nearest.hp -= finalDmg;
      nearest.hpShowTimer = 3;
      damageNumbers.push({x:nearest.x, y:nearest.y-nearest.def.h, text:''+finalDmg, color:'#8888ff', size:6, timer:0.6, vy:-25});
      if (nearest.hp <= 0) killEnemy(nearest);
      sfx('hit');
    }
  }
}

// ============================================================
// SENTINELS — GDD §7 Arqueiro skill 8
// ============================================================
function updateSentinels(dt) {
  for (let i = player.sentinels.length - 1; i >= 0; i--) {
    const s = player.sentinels[i];
    s.timer -= dt;
    if (s.timer <= 0 || s.hp <= 0) { player.sentinels.splice(i, 1); continue; }
    s.atkTimer -= dt;
    if (s.atkTimer <= 0) {
      s.atkTimer = 1.5;
      let nearest = null, nearD = Infinity;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = distXY(s.x, s.y, e.x, e.y);
        if (d < s.range * TILE && d < nearD) { nearD = d; nearest = e; }
      }
      if (nearest) {
        const dmg = Math.floor(getAtkDist() * s.dmgPct / 100);
        const lvlMod = getLevelDmgMod(player.level, nearest.level, true);
        const finalDmg = calcDamage(dmg * lvlMod, nearest.defense);
        nearest.hp -= finalDmg;
        nearest.hpShowTimer = 3;
        damageNumbers.push({x:nearest.x, y:nearest.y-nearest.def.h, text:''+finalDmg, color:'#44cc44', size:6, timer:0.6, vy:-25});
        if (nearest.hp <= 0) killEnemy(nearest);
        sfx('hit');
      }
    }
  }
}

// ============================================================
// TRAPS — GDD §7 Arqueiro skill 3
// ============================================================
let activeTraps = [];

function updateTraps(dt) {
  for (let i = activeTraps.length - 1; i >= 0; i--) {
    const t = activeTraps[i];
    t.timer -= dt;
    if (t.timer <= 0) { activeTraps.splice(i, 1); continue; }
    for (const e of enemies) {
      if (e.dead || t.triggered) continue;
      if (distXY(t.x, t.y, e.x, e.y) < TILE) {
        t.triggered = true;
        const atk = getAtkDist();
        const lvlMod = getLevelDmgMod(player.level, e.level, true);
        const finalDmg = calcDamage(atk * getSkillDamage(t.dmgPct, t.skillLevel) * lvlMod, e.defense);
        e.hp -= finalDmg;
        e.hpShowTimer = 3;
        damageNumbers.push({x:e.x, y:e.y-e.def.h, text:''+finalDmg, color:'#ffaa00', size:8, timer:0.8, vy:-TILE/0.8});
        if (t.status) applyStatusEnemy(e, t.status, t.statusDur);
        if (e.hp <= 0) killEnemy(e);
        sfx('hit'); shakeScreen(2, 0.15);
        activeTraps.splice(i, 1); break;
      }
    }
  }
}

// ============================================================
// METEORS — GDD §7 Mago skill 4
// ============================================================
let activeMeteors = [];

function updateMeteors(dt) {
  for (let i = activeMeteors.length - 1; i >= 0; i--) {
    const m = activeMeteors[i];
    m.delay -= dt;
    if (m.delay <= 0 && !m.exploded) {
      m.exploded = true;
      shakeScreen(5, 0.3);
      sfx('bossRoar');
      // 3×3 area damage
      for (const e of enemies) {
        if (e.dead) continue;
        if (distXY(m.x, m.y, e.x, e.y) < 1.5 * TILE) {
          const atk = getAtkMag();
          const lvlMod = getLevelDmgMod(player.level, e.level, true);
          const finalDmg = calcDamage(atk * getSkillDamage(m.dmgPct, m.skillLevel) * lvlMod, e.defense);
          e.hp -= finalDmg;
          e.hpShowTimer = 3;
          damageNumbers.push({x:e.x, y:e.y-e.def.h, text:''+finalDmg, color:'#ff4400', size:9, timer:0.8, vy:-TILE/0.8});
          if (e.hp <= 0) killEnemy(e);
        }
      }
      for (let k = 0; k < 12; k++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({x:m.x, y:m.y, vx:Math.cos(a)*80, vy:Math.sin(a)*80, color:'#ff4400', size:3, life:0.5, timer:0});
      }
    }
    if (m.exploded) {
      m.fadeTimer = (m.fadeTimer || 0) + dt;
      if (m.fadeTimer > 0.5) activeMeteors.splice(i, 1);
    }
  }
}

// ============================================================
// USE SKILL — GDD §7
// ============================================================
function useSkill(slotIndex) {
  // GDD §18 Gap#28: Check secret room puzzles on skill use
  if (typeof updateSecretPuzzles === 'function') updateSecretPuzzles(0, 'skill');
  if (!player.classKey || player.dead) return;
  const skillId = player.equippedSkills[slotIndex];
  if (!skillId) return;
  const skill = SKILLS[skillId];
  if (!skill) return;
  // GDD §3: Amuleto dá +1 level em skill específica (max 11)
  const skillLevel = Math.min(11, (player.skills[skillId] || 1) + getAmuletSkillBonus(skillId));

  // Check cooldown
  if ((player.skillCooldowns[skillId] || 0) > 0) return;

  // Check resource
  let cost = skill.cost;
  // Mago passiva Transcendência: skills custam HP em vez de Mana
  const transcActive = hasBuff('transcendencia');
  if (transcActive && player.classKey === 'mago') {
    if (player.hp <= cost) return; // bloqueada se HP < custo
    player.hp -= cost;
  } else {
    if (player.resource < cost) return;
    player.resource -= cost;
  }

  // Set cooldown — GDD §4: INT -1% cooldown reduction per point
  player.skillCooldowns[skillId] = Math.max(0.3, skill.cd * (1 - player.INT * 0.01));

  // Reset Guerreiro regen timer
  if (player.classKey === 'guerreiro') player.resourceRegenTimer = 0;

  const wmx = mouseX + camX, wmy = mouseY + camY;
  const angle = Math.atan2(wmy - player.y, wmx - player.x);
  // GDD §5: Maldição -20% ATK applies to skills too
  let atk = getClassAtk();
  if (hasStatus(player, 'maldicao')) atk *= 0.8;
  const skillMult = getSkillDamage(skill.dmg, skillLevel);

  // GDD §7: Invisível — próx ataque +80%
  let invisBonus = 1;
  if (player.invisible && skill.dmg > 0) {
    invisBonus = 1 + player.invisBonusDmg;
    player.invisible = false; player.invisTimer = 0; player.invisBonusDmg = 0;
  }

  // Passiva Mago: Mente Afiada +10% dano, Maestria +15%
  let passiveDmgMult = 1;
  if (hasPassive('menteAfiada')) passiveDmgMult += 0.10;
  if (hasPassive('maestria')) passiveDmgMult += 0.15;
  // Arqueiro Posição Firme: +40% dano parado
  if (hasPassive('posicaoFirme')) {
    const dx = keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'] ||
               keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'];
    if (!dx) passiveDmgMult += 0.40;
  }

  // Buff multipliers
  const buffAtkMult = getBuffMult('atk');

  sfx('swing');
  player.attackAnim = 0.2;
  player.dir = angle;

  // Execute by type
  switch (skill.type) {
    case 'melee': {
      let totalDmg = atk * skillMult * invisBonus * passiveDmgMult * buffAtkMult;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = distXY(player.x, player.y, e.x, e.y);
        if (d > skill.range * TILE) continue;
        const eAngle = Math.atan2(e.y - player.y, e.x - player.x);
        let diff = Math.abs(eAngle - angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff > Math.PI / 3) continue;

        let dmg = totalDmg;
        // Golpe Furtivo: +50% pelas costas
        if (skill.backBonus) {
          const behindAngle = Math.atan2(Math.sin(e.dir || 0), Math.cos(e.dir || 0));
          const fromBehind = Math.abs(angle - behindAngle);
          if (fromBehind < Math.PI / 3 || fromBehind > Math.PI * 5/3) {
            dmg *= (1 + skill.backBonus);
            // Passiva Marca Morte: ×2.5 em vez de ×1.5 (permanente ou via Despertar Total)
            if (hasPassive('marcaMorte') || hasBuff('marcaMorteTemp')) dmg *= (2.5 / 1.5);
          }
        }
        // Esmagar: ignora 30% DEF
        const defMod = skill.ignDef ? (1 - skill.ignDef) : 1;
        // Execução: +100% se alvo <30% HP
        if (skill.executePct && e.hp / e.maxHp < skill.executePct) dmg *= 2;
        // Emboscada: +30% dano
        if (skill.tpBonus) dmg *= (1 + skill.tpBonus);

        const lvlMod = getLevelDmgMod(player.level, e.level, true);
        let isCrit = Math.random() * 100 < getCritChance();
        let finalDmg = calcDamage(dmg * lvlMod, e.defense * defMod);
        if (isCrit) { finalDmg = Math.floor(finalDmg * getCritDmg() / 100); flashScreen('#fff', 0.15, 0.1); }
        e.hp -= finalDmg;
        e.hpShowTimer = 3;
        damageNumbers.push({x:e.x, y:e.y-e.def.h, text:''+finalDmg, color:isCrit?'#ffff00':'#ffffff', size:isCrit?10:7, timer:0.8, vy:-TILE/0.8});
        sfx('hit');
        onPlayerDamageDealt(finalDmg, isCrit);
        if (skill.status) applyStatusEnemy(e, skill.status, skill.statusDur);
        if (skill.lifesteal) { player.hp = Math.min(getMaxHp(), player.hp + Math.floor(finalDmg * skill.lifesteal)); }
        if (e.hp <= 0) killEnemy(e);
        else e.state = 'chase';
      }
      break;
    }

    case 'multi': {
      // Dança Lâminas: 3 golpes rápidos ao redor
      const hits = skill.hits || 3;
      for (let h = 0; h < hits; h++) {
        for (const e of enemies) {
          if (e.dead) continue;
          if (distXY(player.x, player.y, e.x, e.y) > skill.range * TILE) continue;
          const dmg = atk * skillMult * invisBonus * passiveDmgMult * buffAtkMult / hits;
          const lvlMod = getLevelDmgMod(player.level, e.level, true);
          const finalDmg = calcDamage(dmg * lvlMod, e.defense);
          e.hp -= finalDmg;
          e.hpShowTimer = 3;
          damageNumbers.push({x:e.x+randInt(-4,4), y:e.y-e.def.h+randInt(-4,4), text:''+finalDmg, color:'#ffffff', size:7, timer:0.6, vy:-25});
          onPlayerDamageDealt(finalDmg, false);
          if (e.hp <= 0) killEnemy(e);
          else e.state = 'chase';
        }
      }
      sfx('hit');
      break;
    }

    case 'proj': {
      const count = skill.projCount || 1;
      const speed = (skill.projSpeed || 7) * TILE;
      const alcMult = hasPassive('olhoAguia') ? 1.15 : 1;
      for (let p = 0; p < count; p++) {
        const spread = count > 1 ? (p - (count-1)/2) * 0.15 : 0;
        const a = angle + spread;
        playerProjectiles.push({
          x: player.x, y: player.y,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          dmg: atk * skillMult * invisBonus * passiveDmgMult * buffAtkMult,
          color: skill.cls === 'mago' ? '#ff6600' : skill.cls === 'arqueiro' ? '#88cc44' : '#cccccc',
          size: 4, maxRange: skill.range * TILE * alcMult, traveled: 0,
          pierce: skill.pierce || 0,
          explode: skill.explode || 0,
          status: skill.status, statusDur: skill.statusDur,
          autoCrit: skill.autoCrit || false,
          lifesteal: skill.lifesteal || 0,
        });
      }
      break;
    }

    case 'aoe': {
      // AoE around player (Corte Giratório, Fumaça)
      const range = skill.range * TILE;
      if (skill.smoke) {
        // Fumaça: inimigos perdem alvo
        for (const e of enemies) {
          if (e.dead) continue;
          if (distXY(player.x, player.y, e.x, e.y) < range) {
            e.state = 'patrol';
            e.confusionTimer = getSkillDuration(skill.dur, skillLevel);
          }
        }
        for (let k = 0; k < 10; k++) {
          particles.push({x:player.x+randInt(-20,20), y:player.y+randInt(-20,20),
            vx:(Math.random()-0.5)*30, vy:-20-Math.random()*20,
            color:'#666666', size:4, life:1, timer:0});
        }
      } else {
        for (const e of enemies) {
          if (e.dead) continue;
          if (distXY(player.x, player.y, e.x, e.y) > range) continue;
          const dmg = atk * skillMult * invisBonus * passiveDmgMult * buffAtkMult;
          const lvlMod = getLevelDmgMod(player.level, e.level, true);
          let isCrit = Math.random() * 100 < getCritChance();
          let finalDmg = calcDamage(dmg * lvlMod, e.defense);
          if (isCrit) { finalDmg = Math.floor(finalDmg * getCritDmg() / 100); }
          e.hp -= finalDmg;
          e.hpShowTimer = 3;
          damageNumbers.push({x:e.x, y:e.y-e.def.h, text:''+finalDmg, color:isCrit?'#ffff00':'#ffffff', size:7, timer:0.8, vy:-TILE/0.8});
          onPlayerDamageDealt(finalDmg, isCrit);
          if (skill.status) applyStatusEnemy(e, skill.status, skill.statusDur);
          if (e.hp <= 0) killEnemy(e);
          else e.state = 'chase';
        }
        shakeScreen(3, 0.2);
      }
      break;
    }

    case 'cone': {
      // Raio Congelante: cone 4 tiles
      for (const e of enemies) {
        if (e.dead) continue;
        const d = distXY(player.x, player.y, e.x, e.y);
        if (d > skill.range * TILE) continue;
        const eAngle = Math.atan2(e.y - player.y, e.x - player.x);
        let diff = Math.abs(eAngle - angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff > Math.PI / 4) continue; // ~45deg cone
        const dmg = atk * skillMult * passiveDmgMult * buffAtkMult;
        const lvlMod = getLevelDmgMod(player.level, e.level, true);
        const finalDmg = calcDamage(dmg * lvlMod, e.defense);
        e.hp -= finalDmg;
        e.hpShowTimer = 3;
        damageNumbers.push({x:e.x, y:e.y-e.def.h, text:''+finalDmg, color:'#aaddff', size:7, timer:0.8, vy:-TILE/0.8});
        onPlayerDamageDealt(finalDmg, false);
        if (skill.status) applyStatusEnemy(e, skill.status, skill.statusDur);
        if (e.hp <= 0) killEnemy(e);
        else e.state = 'chase';
      }
      break;
    }

    case 'chain': {
      // Corrente Raios: salta 3 inimigos
      const chainMax = skill.chainCount || 3;
      const hit = new Set();
      let lastX = player.x, lastY = player.y;
      for (let c = 0; c < chainMax; c++) {
        let nearest = null, nearD = Infinity;
        for (const e of enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = distXY(lastX, lastY, e.x, e.y);
          if (d < skill.range * TILE && d < nearD) { nearD = d; nearest = e; }
        }
        if (!nearest) break;
        hit.add(nearest);
        const dmg = atk * skillMult * passiveDmgMult * buffAtkMult;
        const lvlMod = getLevelDmgMod(player.level, nearest.level, true);
        const finalDmg = calcDamage(dmg * lvlMod, nearest.defense);
        nearest.hp -= finalDmg;
        nearest.hpShowTimer = 3;
        damageNumbers.push({x:nearest.x, y:nearest.y-nearest.def.h, text:''+finalDmg, color:'#aaaaff', size:7, timer:0.8, vy:-TILE/0.8});
        onPlayerDamageDealt(finalDmg, false);
        if (nearest.hp <= 0) killEnemy(nearest);
        else nearest.state = 'chase';
        lastX = nearest.x; lastY = nearest.y;
      }
      break;
    }

    case 'line': {
      // Golpe Sísmico: linha 2 tiles
      const lineLen = skill.range * TILE;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = distXY(player.x, player.y, e.x, e.y);
        if (d > lineLen) continue;
        const eAngle = Math.atan2(e.y - player.y, e.x - player.x);
        let diff = Math.abs(eAngle - angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff > Math.PI / 6) continue; // narrow line
        const dmg = atk * skillMult * passiveDmgMult * buffAtkMult;
        const lvlMod = getLevelDmgMod(player.level, e.level, true);
        const finalDmg = calcDamage(dmg * lvlMod, e.defense);
        e.hp -= finalDmg;
        e.hpShowTimer = 3;
        damageNumbers.push({x:e.x, y:e.y-e.def.h, text:''+finalDmg, color:'#ffcc00', size:8, timer:0.8, vy:-TILE/0.8});
        onPlayerDamageDealt(finalDmg, false);
        if (skill.status) applyStatusEnemy(e, skill.status, skill.statusDur);
        if (e.hp <= 0) killEnemy(e);
        else e.state = 'chase';
      }
      shakeScreen(4, 0.3);
      break;
    }

    case 'area': {
      // Meteoro / Chuva Flechas: area no cursor
      if (skill.delay) {
        activeMeteors.push({x: wmx, y: wmy, delay: skill.delay, dmgPct: skill.dmg, skillLevel, exploded: false});
      } else {
        // Chuva Flechas: instant area, multiple hits
        const hits = skill.hits || 5;
        for (let h = 0; h < hits; h++) {
          const hx = wmx + randInt(-TILE, TILE), hy = wmy + randInt(-TILE, TILE);
          for (const e of enemies) {
            if (e.dead) continue;
            if (distXY(hx, hy, e.x, e.y) < TILE) {
              const dmg = atk * skillMult / hits * passiveDmgMult * buffAtkMult;
              const lvlMod = getLevelDmgMod(player.level, e.level, true);
              const finalDmg = calcDamage(dmg * lvlMod, e.defense);
              e.hp -= finalDmg;
              e.hpShowTimer = 3;
              damageNumbers.push({x:e.x+randInt(-3,3), y:e.y-e.def.h, text:''+finalDmg, color:'#88cc44', size:6, timer:0.6, vy:-25});
              onPlayerDamageDealt(finalDmg, false);
              if (e.hp <= 0) killEnemy(e);
            }
          }
          particles.push({x:hx, y:hy, vx:0, vy:20, color:'#88cc44', size:2, life:0.3, timer:0});
        }
      }
      break;
    }

    case 'dash': case 'dodge': {
      // Investida Guerreiro / Rolamento Arqueiro / Esquiva Sombria
      const dashDist = skill.range * TILE;
      const nx = player.x + Math.cos(angle) * dashDist;
      const ny = player.y + Math.sin(angle) * dashDist;
      // Move step by step to avoid going through walls
      const steps = 10;
      for (let s = 1; s <= steps; s++) {
        const tx = player.x + Math.cos(angle) * dashDist * s / steps;
        const ty = player.y + Math.sin(angle) * dashDist * s / steps;
        if (collidesWall(tx, ty, 6, 8)) break;
        player.x = tx; player.y = ty;
      }
      player.iframeTimer = 0.3; // invulnerável durante dash
      // Investida Guerreiro: dano + atordoamento
      if (skill.dmg > 0 && skill.type === 'dash') {
        for (const e of enemies) {
          if (e.dead) continue;
          if (distXY(player.x, player.y, e.x, e.y) < TILE * 1.5) {
            const dmg = atk * skillMult * passiveDmgMult * buffAtkMult;
            const lvlMod = getLevelDmgMod(player.level, e.level, true);
            const finalDmg = calcDamage(dmg * lvlMod, e.defense);
            e.hp -= finalDmg;
            e.hpShowTimer = 3;
            damageNumbers.push({x:e.x, y:e.y-e.def.h, text:''+finalDmg, color:'#ffffff', size:7, timer:0.8, vy:-TILE/0.8});
            if (skill.status) applyStatusEnemy(e, skill.status, skill.statusDur);
            onPlayerDamageDealt(finalDmg, false);
            if (e.hp <= 0) killEnemy(e);
            else e.state = 'chase';
          }
        }
      }
      // Assassino recurso: +15 energia ao usar esquiva ativa
      if (player.classKey === 'assassino' && skill.type === 'dodge') {
        player.resource = Math.min(player.resourceMax, player.resource + 15);
      }
      break;
    }

    case 'blink': {
      // Teletransporte Mago: 5 tiles
      const blinkDist = skill.range * TILE;
      const steps = 10;
      for (let s = steps; s >= 1; s--) {
        const tx = player.x + Math.cos(angle) * blinkDist * s / steps;
        const ty = player.y + Math.sin(angle) * blinkDist * s / steps;
        if (!collidesWall(tx, ty, 6, 8)) { player.x = tx; player.y = ty; break; }
      }
      for (let k = 0; k < 6; k++) {
        particles.push({x:player.x, y:player.y, vx:(Math.random()-0.5)*40, vy:(Math.random()-0.5)*40,
          color:'#8888ff', size:3, life:0.3, timer:0});
      }
      break;
    }

    case 'teleport': {
      // Emboscada Assassino: teleporta atrás do alvo mais próximo
      let nearest = null, nearD = Infinity;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = distXY(player.x, player.y, e.x, e.y);
        if (d < skill.range * TILE && d < nearD) { nearD = d; nearest = e; }
      }
      if (nearest) {
        const behindX = nearest.x - Math.cos(nearest.dir || 0) * TILE;
        const behindY = nearest.y - Math.sin(nearest.dir || 0) * TILE;
        if (!collidesWall(behindX, behindY, 6, 8)) {
          player.x = behindX; player.y = behindY;
        }
        // Ataque automático
        const dmg = atk * skillMult * (1 + (skill.tpBonus || 0)) * passiveDmgMult * buffAtkMult;
        const lvlMod = getLevelDmgMod(player.level, nearest.level, true);
        const finalDmg = calcDamage(dmg * lvlMod, nearest.defense);
        nearest.hp -= finalDmg;
        nearest.hpShowTimer = 3;
        damageNumbers.push({x:nearest.x, y:nearest.y-nearest.def.h, text:''+finalDmg, color:'#aa44cc', size:8, timer:0.8, vy:-TILE/0.8});
        onPlayerDamageDealt(finalDmg, false);
        if (nearest.hp <= 0) killEnemy(nearest);
        else nearest.state = 'chase';
      }
      break;
    }

    case 'buff': {
      const dur = getSkillDuration(skill.dur, skillLevel);
      if (skillId === 'gritoGuerra')  player.buffs.push({id:'gritoGuerra', name:skill.name, timer:dur, effect:{atk:0.20}});
      if (skillId === 'frenesi')      player.buffs.push({id:'frenesi', name:skill.name, timer:dur, effect:{atkSpeed:0.30}});
      if (skillId === 'muralha')      player.buffs.push({id:'muralha', name:skill.name, timer:dur, effect:{def:0.40}});
      break;
    }

    case 'util': {
      // Provocar: agro 5s
      const range = skill.range * TILE;
      const dur = getSkillDuration(skill.dur, skillLevel);
      for (const e of enemies) {
        if (e.dead || e.isBoss) continue; // GDD §7: Bosses imunes
        if (distXY(player.x, player.y, e.x, e.y) < range) {
          e.state = 'chase';
          e.tauntTimer = dur;
        }
      }
      break;
    }

    case 'stance': {
      // Bloqueio Perfeito: postura 1.5s
      player.perfectBlock = true;
      player.perfectBlockTimer = getSkillDuration(skill.dur, skillLevel);
      break;
    }

    case 'invis': {
      // Passos Sombrios: invisível
      player.invisible = true;
      player.invisTimer = getSkillDuration(skill.dur, skillLevel);
      player.invisBonusDmg = skill.invisBonus;
      break;
    }

    case 'shield': {
      // Barreira Mago: absorve 30% HP máx
      const dur = getSkillDuration(skill.dur, skillLevel);
      const absorb = Math.floor(getMaxHp() * getSkillAbsorb(skill.absorbPct, skillLevel) / 100);
      player.barrier = absorb;
      player.barrierMax = absorb;
      player.barrierTimer = dur;
      break;
    }

    case 'reflect': {
      // Escudo Espelhado
      player.reflectTimer = getSkillDuration(skill.dur, skillLevel);
      player.reflectPct = skill.reflectPct;
      break;
    }

    case 'summon': {
      // Familiar Mago
      player.familiar = {
        x: player.x, y: player.y,
        angle: 0, timer: getSkillDuration(skill.dur, skillLevel),
        atkTimer: 1.5, dmgPct: skill.summonDmg
      };
      break;
    }

    case 'turret': {
      // Sentinela Arqueiro: máx 1
      if (player.sentinels.length >= 1) player.sentinels.shift();
      player.sentinels.push({
        x: player.x, y: player.y,
        timer: getSkillDuration(skill.dur, skillLevel),
        atkTimer: 1.5, range: skill.range,
        dmgPct: skill.turretDmg,
        hp: Math.floor(getMaxHp() * 0.2), // GDD §7: destrutível 20%HP jogador
      });
      break;
    }

    case 'trap': {
      // Armadilha Arqueiro
      activeTraps.push({
        x: player.x, y: player.y,
        timer: 30, // dura 30s no chão
        dmgPct: skill.dmg, skillLevel,
        status: skill.status, statusDur: skill.statusDur,
        triggered: false
      });
      break;
    }
  }
}

// ============================================================
// ESSÊNCIA SKILL USE — GDD §8
// ============================================================
function useEssenciaSkill(index) {
  if (currentFloor < 3) return;
  const eskill = ESSENCIA_SKILLS[index];
  if (!eskill) return;
  if (currentFloor < eskill.unlockFloor) return;
  if (player.essencia < eskill.cost) return;
  if ((player.skillCooldowns['ess_'+eskill.id] || 0) > 0) return;

  player.essencia -= eskill.cost;
  player.skillCooldowns['ess_'+eskill.id] = eskill.cd;

  const wmx = mouseX + camX, wmy = mouseY + camY;
  const angle = Math.atan2(wmy - player.y, wmx - player.x);
  let atk = getClassAtk();
  // GDD §5: Maldição -20% ATK applies to essence skills too
  if (hasStatus(player, 'maldicao')) atk *= 0.8;

  switch (eskill.id) {
    case 'pulso': {
      // AoE 3 tiles, knockback 2 tiles
      for (const e of enemies) {
        if (e.dead) continue;
        const d = distXY(player.x, player.y, e.x, e.y);
        if (d > 3 * TILE) continue;
        const dmg = atk * 2; // 200%
        const lvlMod = getLevelDmgMod(player.level, e.level, true);
        const finalDmg = calcDamage(dmg * lvlMod, e.defense);
        e.hp -= finalDmg;
        e.hpShowTimer = 3;
        damageNumbers.push({x:e.x, y:e.y-e.def.h, text:''+finalDmg, color:'#ffd700', size:9, timer:0.8, vy:-TILE/0.8});
        // Knockback 2 tiles
        const kbAngle = Math.atan2(e.y - player.y, e.x - player.x);
        e.x += Math.cos(kbAngle) * TILE * 2;
        e.y += Math.sin(kbAngle) * TILE * 2;
        if (e.hp <= 0) killEnemy(e);
      }
      shakeScreen(5, 0.3);
      flashScreen('#ffd700', 0.3, 0.2);
      break;
    }
    case 'escudo': {
      // Absorve 50% HP 8s, imune status
      player.essenciaShield = Math.floor(getMaxHp() * 0.5);
      player.essenciaShieldTimer = eskill.dur;
      player.statusEffects = []; // limpa status
      break;
    }
    case 'despertarP': {
      // +30% stats 12s
      player.buffs.push({id:'despertarP', name:'Despertar Parcial', timer:eskill.dur, effect:{atk:0.30, def:0.30, speed:0.30}});
      flashScreen('#ffd700', 0.5, 0.3);
      break;
    }
    case 'laminaLuz': {
      // Projétil 8 tiles, atravessa todos
      playerProjectiles.push({
        x: player.x, y: player.y,
        vx: Math.cos(angle) * 9 * TILE, vy: Math.sin(angle) * 9 * TILE,
        dmg: atk * 3.5, color: '#ffd700', size: 6,
        maxRange: 8 * TILE, traveled: 0,
        pierce: 999, // atravessa todos
      });
      break;
    }
    case 'despertarT': {
      // +50% stats 15s, regen 3%HP/s
      player.buffs.push({id:'despertarT', name:'Despertar Total', timer:eskill.dur, effect:{atk:0.50, def:0.50, speed:0.50, hpRegen:0.03}});
      flashScreen('#ffd700', 0.8, 0.5);
      // GDD §7: Desbloqueia Ultimate de classe temporariamente (15s)
      // GDD: "Level 50 = Ultimate permanente" — antes do 50, Despertar Total ativa temp
      if (player.classKey === 'mago') {
        player.buffs.push({id:'transcendencia', name:'Transcendência', timer:8, effect:{}});
      }
      if (player.classKey === 'arqueiro') {
        player.buffs.push({id:'chuvaInfinita', name:'Chuva Infinita', timer:6, effect:{}, shootTimer:0});
      }
      if (player.classKey === 'guerreiro' && !hasPassive('vontadeInqueb')) {
        // Ativa revive temporário 15s
        player.buffs.push({id:'vontadeTemp', name:'Vontade Temporária', timer:15, effect:{}});
      }
      if (player.classKey === 'assassino' && !hasPassive('marcaMorte')) {
        // Ativa costas x2.5 temporário 15s
        player.buffs.push({id:'marcaMorteTemp', name:'Marca Morte Temp', timer:15, effect:{}});
      }
      break;
    }
  }
}
