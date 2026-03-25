'use strict';
// gameplay.js — Player Update, Attack, Interact, Pickups, Potions, Resource

// GDD §14: KeyF essência — tap=usar, hold=radial de seleção
let selectedEssenciaSkill = 0;
let keyFPressed = false;
let keyFHoldTimer = 0;
let essenciaRadialOpen = false;

// ============================================================
// UPDATE PLAYER
// ============================================================
function updatePlayer(dt) {
  if (player.dead) {
    player.deathTimer -= dt;
    if (player.deathTimer <= 0) gameState = 'dead';
    return;
  }

  // Knockback
  if (player.kbTimer > 0) {
    const nx = player.x + player.kbVx * dt;
    const ny = player.y + player.kbVy * dt;
    if (!collidesWall(nx, player.y, 6, 8)) player.x = nx;
    if (!collidesWall(player.x, ny, 6, 8)) player.y = ny;
    player.kbTimer -= dt;
    return;
  }

  if (player.iframeTimer > 0) {
    player.iframeTimer -= dt;
    player.blinkTimer += dt;
  } else player.blinkTimer = 0;

  if (player.attackTimer > 0) player.attackTimer -= dt;
  if (player.attackAnim > 0) player.attackAnim -= dt;

  // GDD §14: Movimento WASD 8 direções
  // GDD §5: Imobiliza — preso no lugar, pode atacar/skills
  if (hasStatus(player, 'imobiliza') || hasStatus(player, 'congela') || hasStatus(player, 'atordoamento')) {
    // Congela/Atordoamento: imóvel, não ataca, não usa skills (handled by blocking input below)
    // Imobiliza: imóvel, MAS pode atacar/skills
    if (hasStatus(player, 'congela') || hasStatus(player, 'atordoamento')) {
      // Block attack and skills too
      player.attackTimer = Math.max(player.attackTimer, 0.1);
    }
  }
  let dx = 0, dy = 0;
  // GDD §7: Muralha — imóvel enquanto buff ativo
  const immobile = hasStatus(player, 'imobiliza') || hasStatus(player, 'congela') || hasStatus(player, 'atordoamento') || hasBuff('muralha');
  if (!immobile) {
    // GDD §14 M6: Joystick virtual OU teclado
    if (joystick.active && (joystick.dx !== 0 || joystick.dy !== 0)) {
      dx = joystick.dx;
      dy = joystick.dy;
    } else {
      if (keys['KeyW'] || keys['ArrowUp'])    dy -= 1;
      if (keys['KeyS'] || keys['ArrowDown'])  dy += 1;
      if (keys['KeyA'] || keys['ArrowLeft'])  dx -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
    }
    // GDD §5: Confusão — inverte controles de movimento
    if (hasStatus(player, 'confusao')) { dx = -dx; dy = -dy; }
  }

  if (dx !== 0 || dy !== 0) {
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
    // GDD §5: Lentidão — -30% velocidade
    const lentidaoMult = hasStatus(player, 'lentidao') ? 0.7 : 1;
    const spd = 4 * TILE * getMoveSpeed() * lentidaoMult * dt;
    const mx = dx * spd, my = dy * spd;
    let newX = player.x + mx, newY = player.y + my;
    // GDD §10: Boss room trancada — sem fuga
    if (bossRoomLocked && bossRoom) {
      const minX = bossRoom.x * TILE + 8;
      const maxX = (bossRoom.x + bossRoom.w) * TILE - 8;
      const minY = bossRoom.y * TILE + 8;
      const maxY = (bossRoom.y + bossRoom.h) * TILE - 8;
      newX = clamp(newX, minX, maxX);
      newY = clamp(newY, minY, maxY);
    }
    if (!collidesWall(newX, player.y, 6, 8)) player.x = newX;
    if (!collidesWall(player.x, newY, 6, 8)) player.y = newY;

    if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? 'right' : 'left';
    else player.facing = dy > 0 ? 'down' : 'up';
    // GDD §14 M6: atualizar lastJoyDir para melee touch
    player.dir = Math.atan2(dy, dx);
    lastJoyDir = player.dir;

    player.walkTimer += dt;
    if (player.walkTimer > 0.15) {
      player.walkTimer = 0;
      player.walkFrame = (player.walkFrame + 1) % 3;
    }
  } else {
    player.walkFrame = 0;
    player.walkTimer = 0;
  }

  // GDD §5: Congela/Atordoamento — não ataca, não usa skills
  const stunned = hasStatus(player, 'congela') || hasStatus(player, 'atordoamento');
  // GDD §5: Inabalável (guerreiro passiva) — imune a atordoamento
  if (hasStatus(player, 'atordoamento') && hasPassive('inabalavel')) {
    player.statusEffects = player.statusEffects.filter(s => s.id !== 'atordoamento');
  }

  // GDD §14: Click para atacar (imobiliza PODE atacar, congela/stun NÃO)
  if (mouseClicked && player.attackTimer <= 0 && !stunned) performAttack();

  // GDD §14: Espaço para interagir
  if (keys['Space']) { keys['Space'] = false; tryInteract(); }

  // GDD §15: C para poção vida
  if (keys['KeyC']) { keys['KeyC'] = false; usePotion(); }

  // GDD §7: Skills (teclas 1-5) — imobiliza PODE usar, congela/stun NÃO
  if (!stunned) {
    if (keys['Digit1']) { keys['Digit1'] = false; useSkill(0); }
    if (keys['Digit2']) { keys['Digit2'] = false; useSkill(1); }
    if (keys['Digit3']) { keys['Digit3'] = false; useSkill(2); }
    if (keys['Digit4']) { keys['Digit4'] = false; useSkill(3); }
    if (keys['Digit5']) { keys['Digit5'] = false; useSkill(4); }

    // GDD §8/§14: KeyF essência — tap=usar selecionada, hold=radial de seleção
    if (keys['KeyF'] && !keyFPressed) {
      keyFPressed = true;
      keyFHoldTimer = 0;
    }
    if (keyFPressed && keys['KeyF']) {
      keyFHoldTimer += FIXED_DT;
      if (keyFHoldTimer >= 0.5 && !essenciaRadialOpen) {
        essenciaRadialOpen = true;
      }
    }
    if (keyFPressed && !keys['KeyF']) {
      keyFPressed = false;
      if (keyFHoldTimer < 0.5) {
        useEssenciaSkill(selectedEssenciaSkill);
      }
      essenciaRadialOpen = false;
      keyFHoldTimer = 0;
    }
    // While radial is open, Digit1-5 select essência skill
    if (essenciaRadialOpen) {
      for (let i = 0; i < 5; i++) {
        if (keys['Digit' + (i + 1)]) {
          selectedEssenciaSkill = i;
          essenciaRadialOpen = false;
          keyFPressed = false;
        }
      }
    }
  }

  // I para inventário
  if (keys['KeyI']) { keys['KeyI'] = false; openInventory(); }

  // K para skill menu (Kaelith)
  if (keys['KeyK'] && player.classKey) { keys['KeyK'] = false; openSkillMenu(); }

  // ESC para pausar
  if (keys['Escape']) { keys['Escape'] = false; gameState = 'paused'; pauseMenuCursor = 0; triggerSave(); }
  // GDD §15: B para menu rápido de consumíveis
  if (keys['KeyB'] && !keys._KeyB) {
    keys._KeyB = true;
    gameState = 'consumableMenu';
  }
  if (!keys['KeyB']) keys._KeyB = false;

  // GDD §14: M para minimap
  if (keys['KeyM']) { keys['KeyM'] = false; showMinimap = !showMinimap; }
  // GDD §14: T para stats
  if (keys['KeyT']) { keys['KeyT'] = false; gameState = 'stats'; }
  // GDD §15: V para poção recurso
  if (keys['KeyV'] && player.classKey) { keys['KeyV'] = false; useResourcePotion(); }

  // GDD §4: Dano de contato inimigos (ATK×0.5, CD 1s por inimigo)
  for (const e of enemies) {
    if (e.dead) continue;
    e.contactCD = Math.max(0, e.contactCD - dt);
    if (e.contactCD > 0) continue;
    const d = distXY(player.x, player.y, e.x, e.y);
    if (d < 6 + e.def.w/2) {
      damagePlayer(Math.round(e.atk * 0.5), e.x, e.y, e.level);
      // GDD §5: Chance de status por inimigo (15-25% por hit)
      if (e.def.statusOnHit && Math.random() < (e.def.statusChance || 0.20)) {
        applyStatusPlayer(e.def.statusOnHit);
      }
      e.contactCD = 1;
    }
  }
}

function collidesWall(px, py, hw, hh) {
  const tx1 = Math.floor((px - hw) / TILE);
  const ty1 = Math.floor((py - hh) / TILE);
  const tx2 = Math.floor((px + hw - 0.1) / TILE);
  const ty2 = Math.floor((py + hh - 0.1) / TILE);
  for (let ty = ty1; ty <= ty2; ty++)
    for (let tx = tx1; tx <= tx2; tx++)
      if (getTile(tx, ty) === TILE_WALL) return true;
  return false;
}

// ============================================================
// PERFORM ATTACK
// ============================================================
function performAttack() {
  // GDD §18 Gap#28: Check secret room puzzles on attack
  updateSecretPuzzles(0, 'attack');
  // GDD §7: Frenesi buff — +30% vel ataque
  const atkSpeedMult = hasBuff('frenesi') ? 0.7 : 1;
  // GDD §4: DES +0.5% attack speed per point
  player.attackTimer = getAttackSpeed() * atkSpeedMult;
  player.attackAnim = 0.2;
  // Guerreiro: reset regen timer
  player.resourceRegenTimer = 0;

  const wmx = mouseX + camX, wmy = mouseY + camY;
  const angle = Math.atan2(wmy - player.y, wmx - player.x);

  const deg = ((angle * 180 / Math.PI) + 360) % 360;
  if (deg >= 315 || deg < 45)        player.facing = 'right';
  else if (deg >= 45 && deg < 135)   player.facing = 'down';
  else if (deg >= 135 && deg < 225)  player.facing = 'left';
  else                                player.facing = 'up';
  player.dir = angle;

  sfx('swing');

  // GDD §7: Pós-classe attack type
  // Arqueiro: projétil 3 tiles (AtkDist)
  if (player.classKey === 'arqueiro') {
    const atk = getAtkDist();
    const alcMult = hasPassive('olhoAguia') ? 1.15 : 1;
    const isMoving = (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']) || (joystick.active && (Math.abs(joystick.dx) > 0.1 || Math.abs(joystick.dy) > 0.1));
    const posBonus = hasPassive('posicaoFirme') && !isMoving ? 1.4 : 1;
    playerProjectiles.push({
      x: player.x, y: player.y,
      vx: Math.cos(angle) * 7 * TILE, vy: Math.sin(angle) * 7 * TILE,
      dmg: atk * posBonus, color: '#88cc44', size: 3,
      maxRange: 3 * TILE * alcMult, traveled: 0, pierce: 0,
    });
    return;
  }

  // Melee attack (Guerreiro, Mago, Assassino, pré-classe)
  let atk;
  if (player.classKey === 'mago') atk = getAtkMag();
  else atk = getAtkFis();

  // GDD §7: Invisível — próx ataque +80%
  let invisBonus = 1;
  if (player.invisible) {
    invisBonus = 1 + player.invisBonusDmg;
    player.invisible = false; player.invisTimer = 0; player.invisBonusDmg = 0;
  }
  // Buff ATK multiplier
  const buffAtkMult = getBuffMult('atk');

  for (const e of enemies) {
    if (e.dead) continue;
    const edx = e.x - player.x, edy = e.y - player.y;
    const d = Math.sqrt(edx*edx + edy*edy);
    if (d > TILE * 1.5) continue;

    const eAngle = Math.atan2(edy, edx);
    let diff = Math.abs(eAngle - angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < Math.PI / 3) {
      damageEnemy(e, atk * invisBonus * buffAtkMult);
      // Assassino passiva: Veneno Natural — 10% chance Veneno 5s
      if (player.classKey === 'assassino' && hasPassive('venenoNatural') && Math.random() < 0.10) {
        applyStatusEnemy(e, 'veneno', 5);
      }
    }
  }
}

// ============================================================
// TRY INTERACT
// ============================================================
function tryInteract() {
  // GDD §18 Gap#28: Check secret room puzzles on interact
  updateSecretPuzzles(0, 'interact');

  const ptx = Math.floor(player.x / TILE);
  const pty = Math.floor(player.y / TILE);

  // Escadas
  const tile = getTile(ptx, pty);
  if (tile === TILE_STAIRS_DOWN && stairsDown && stairsDown.placed) {
    // GDD §18: Boss floor — escada só funciona se boss derrotado
    sfx('stairs');
    currentFloor++;
    if (currentFloor > maxFloorReached) maxFloorReached = currentFloor;
    startFloor(currentFloor);
    return;
  }
  if (tile === TILE_STAIRS_UP && currentFloor > 1) {
    sfx('stairs');
    currentFloor--;
    startFloor(currentFloor);
    return;
  }

  // NPC interaction (GDD §14: 1.5 tiles de distância)
  for (const npc of npcs) {
    const d = distXY(player.x, player.y, npc.x, npc.y);
    if (d < TILE * 1.5) {
      interactNPC(npc);
      return;
    }
  }

  // Item drops — interagir pra pegar (GDD §16)
  for (let i = itemDrops.length - 1; i >= 0; i--) {
    const drop = itemDrops[i];
    const d = distXY(player.x, player.y, drop.x, drop.y);
    if (d < TILE * 1.2) {
      pickupItem(drop, i);
      return;
    }
  }

  // Baús (+ Mimic GDD §9)
  for (const chest of chests) {
    if (chest.opened) continue;
    if (Math.abs(ptx - chest.x) <= 1 && Math.abs(pty - chest.y) <= 1) {
      // GDD §9: Mimic — ao interagir transforma em inimigo Tank
      if (chest.isMimic) {
        chest.opened = true;
        const mimicDef = {id:'mimic', name:'Mimic', arch:'tank', color:'#886633', w:16, h:16, isMimic:true};
        const mimicLevel = 1 + (currentFloor - 1) * 2;
        const mimicEnemy = createEnemy(mimicDef, mimicLevel, chest.x * TILE + TILE/2, chest.y * TILE + TILE/2);
        mimicEnemy.guaranteedDrop = true; // GDD §9: drop garantido
        enemies.push(mimicEnemy);
        shakeScreen(3, 0.3);
        sfx('mimicReveal');
        // Partículas de transformação
        for (let i = 0; i < 10; i++) {
          particles.push({
            x: chest.x * TILE + TILE/2, y: chest.y * TILE + TILE/2,
            vx: (Math.random()-0.5)*60, vy: (Math.random()-0.5)*60,
            life: 0.6, maxLife: 0.6, color: '#886633', size: 3
          });
        }
        return;
      }

      chest.opened = true;
      // GDD Gap#31: Track opened chests
      if (chest.chestId) {
        if (!player.openedChests) player.openedChests = {};
        player.openedChests[chest.chestId] = true;
      }
      // GDD §38: Droghan reage ao encontrar sala secreta
      if (chest.isSecretChest && !player.tutorialVisto.secretRoom) {
        player.tutorialVisto.secretRoom = true;
        startDialogue('Droghan', '#ffdd44', ['O que é esse lugar...?']);
      }
      sfx('chest');

      // GDD §18 Gap#33: Trap room reward = gold x2 + guaranteed potion
      if (chest.isTrapReward) {
        const gold = (player.level * 5 + randInt(0, player.level * 3)) * 2;
        player.gold += gold;
        damageNumbers.push({
          x: chest.x * TILE + TILE/2, y: chest.y * TILE,
          text: '+' + gold + 'g', color: '#ffd700', size: 8, timer: 1.0, vy: -30
        });
        const potions = ['potPeq','potMed','potGra'];
        const potId = potions[Math.min(2, Math.floor(currentFloor / 8))];
        const pot = POTIONS[potId];
        if (pot) {
          itemDrops.push({
            x: chest.x * TILE + TILE/2, y: chest.y * TILE + TILE/2 + 10,
            item: {...pot, id: potId, qty:1, type:'consumable'}
          });
        }
        return;
      }

      // GDD §18 Gap#29: Secret room floor-specific rewards
      if (chest.isSecretChest) {
        const SECRET_REWARDS = {
          3: {equip:'tier+1', potion:'potGra', gold:200},
          6: {equip:'tier+1', potion:'potGra', gold:200},
          9: {ring:'ouro', buff:'random', gold:500},
          12: {ring:'ouro', buff:'random', gold:500},
          15: {amulet:'raro', special:'pedraAlma', gold:800},
          18: {amulet:'raro', special:'pedraAlma', gold:800},
          21: {ring:'ancestral', special:'essenciaConcentrada', gold:1200},
          24: {ring:'ancestral', special:'essenciaConcentrada', gold:1200}
        };
        const reward = SECRET_REWARDS[currentFloor];
        if (reward) {
          player.gold += reward.gold;
          damageNumbers.push({
            x: chest.x * TILE + TILE/2, y: chest.y * TILE,
            text: '+' + reward.gold + 'g', color: '#ffd700', size: 8, timer: 1.0, vy: -30
          });
          if (reward.equip === 'tier+1') {
            const equipTier = Math.min(5, Math.floor((currentFloor - 1) / 5) + 1);
            const slots = ['weapon','body','head','secondary','feet'];
            const slot = slots[randInt(0, slots.length-1)];
            itemDrops.push({
              x: chest.x * TILE + TILE/2, y: chest.y * TILE + TILE/2 + 10,
              item: makeEquip(slot, equipTier, 0, player.classKey)
            });
          }
          if (reward.ring) {
            itemDrops.push({
              x: chest.x * TILE + TILE/2 - 10, y: chest.y * TILE + TILE/2 + 10,
              item: makeRing(reward.ring)
            });
          }
          if (reward.amulet) {
            itemDrops.push({
              x: chest.x * TILE + TILE/2 + 10, y: chest.y * TILE + TILE/2 + 10,
              item: makeAmulet(reward.amulet, 0, player.classKey)
            });
          }
          if (reward.potion) {
            const pot = POTIONS[reward.potion];
            if (pot) {
              itemDrops.push({
                x: chest.x * TILE + TILE/2, y: chest.y * TILE + TILE/2 + 20,
                item: {...pot, id: reward.potion, qty:1, type:'consumable'}
              });
            }
          }
          if (reward.special && POTIONS[reward.special]) {
            const spec = POTIONS[reward.special];
            itemDrops.push({
              x: chest.x * TILE + TILE/2 + 15, y: chest.y * TILE + TILE/2 + 20,
              item: {...spec, id: reward.special, qty:1, type:'consumable'}
            });
          }
          if (reward.buff === 'random') {
            const buffIds = ['buffForca','buffVel','buffProtecao','buffSorte','buffFuria'];
            const bId = buffIds[randInt(0, buffIds.length-1)];
            const bPot = POTIONS[bId];
            if (bPot) {
              itemDrops.push({
                x: chest.x * TILE + TILE/2 - 15, y: chest.y * TILE + TILE/2 + 20,
                item: {...bPot, id: bId, qty:1, type:'consumable'}
              });
            }
          }
        } else {
          // Fallback for secret floors not in rewards table
          const gold = player.level * 10 + randInt(0, player.level * 5);
          player.gold += gold;
          damageNumbers.push({
            x: chest.x * TILE + TILE/2, y: chest.y * TILE,
            text: '+' + gold + 'g', color: '#ffd700', size: 8, timer: 1.0, vy: -30
          });
        }
        return;
      }

      // Regular chest
      const gold = player.level * 5 + randInt(0, player.level * 3);
      player.gold += gold;
      damageNumbers.push({
        x: chest.x * TILE + TILE/2, y: chest.y * TILE,
        text: '+' + gold + 'g', color: '#ffd700', size: 8, timer: 1.0, vy: -30
      });
      // Conteúdo do baú — item aleatório + tier do bioma atual
      const chestTier = currentFloor <= 5 ? 0 : Math.min(5, Math.floor((currentFloor - 1) / 5));
      const roll = Math.random();
      if (roll < 0.4) {
        const pot = currentFloor < 8
          ? (Math.random() < 0.6 ? POTIONS.potPeq : POTIONS.potMed)
          : (Math.random() < 0.4 ? POTIONS.potMed : POTIONS.potGra);
        const potId = pot === POTIONS.potPeq ? 'potPeq' : pot === POTIONS.potMed ? 'potMed' : 'potGra';
        itemDrops.push({
          x: chest.x * TILE + TILE/2, y: chest.y * TILE + TILE/2 + 10,
          item: {...pot, id: potId, qty:1, type:'consumable'}
        });
      } else if (roll < 0.75) {
        const slots = ['weapon','body','head','secondary','feet'];
        const slot = slots[randInt(0, slots.length-1)];
        itemDrops.push({
          x: chest.x * TILE + TILE/2, y: chest.y * TILE + TILE/2 + 10,
          item: makeEquip(slot, chestTier, 0, player.classKey)
        });
      } else {
        // GDD §3: Baú dropa anel (tier do bioma)
        const ringTier = getRingTierForFloor(currentFloor);
        itemDrops.push({
          x: chest.x * TILE + TILE/2, y: chest.y * TILE + TILE/2 + 10,
          item: makeRing(ringTier)
        });
      }
      return;
    }
  }
}

// ============================================================
// PICKUP / NPC / POTION
// ============================================================

// GDD §15: Limite de consumíveis — 5 vida + 3 recurso + 3 cura + 2 buff = 13 máx
function canAddConsumable(itemId) {
  const def = POTIONS[itemId];
  if (!def) return true;
  let vidaCount = 0, recursoCount = 0, curaCount = 0, buffCount = 0;
  for (const c of player.consumables) {
    const d = POTIONS[c.id];
    if (!d) continue;
    if (d.type === 'vida') vidaCount += c.qty;
    else if (c.id === 'potRecurso') recursoCount += c.qty;
    else if (d.type === 'cura') curaCount += c.qty;
    else if (d.type === 'buff') buffCount += c.qty;
  }
  if (def.type === 'vida' && vidaCount >= 5) return false;
  if (itemId === 'potRecurso' && recursoCount >= 3) return false;
  if (def.type === 'cura' && curaCount >= 3) return false;
  if (def.type === 'buff' && buffCount >= 2) return false;
  return true;
}

function pickupItem(drop, index) {
  const item = drop.item;
  if (item.type === 'consumable' || item.heal) {
    // GDD §15: Verificar limite de consumíveis
    if (!canAddConsumable(item.id)) {
      damageNumbers.push({
        x: player.x, y: player.y - 20,
        text: 'Limite atingido!', color: '#ff8800', size: 7, timer: 1, vy: -20
      });
      return;
    }
    // Adicionar aos consumíveis
    const existing = player.consumables.find(c => c.id === item.id);
    if (existing) {
      existing.qty += (item.qty || 1);
    } else {
      player.consumables.push({...item, qty: item.qty || 1});
    }
    sfx('gold');
  } else if (item.type === 'scroll') {
    // GDD §7: Scroll Skill — incrementa contador
    player.scrollSkills += (item.qty || 1);
    sfx('levelUp');
  } else if (item.type === 'equip' || item.type === 'ring' || item.type === 'amulet') {
    // Adicionar à mochila
    if (player.inventory.length < 20) {
      player.inventory.push(item);
      sfx('equip');
    } else {
      damageNumbers.push({
        x: player.x, y: player.y - 20,
        text: 'Mochila cheia!', color: '#ff8800', size: 7, timer: 1, vy: -20
      });
      return; // Não remove do chão
    }
  }
  damageNumbers.push({
    x: drop.x, y: drop.y - 10,
    text: item.name, color: '#88ff88', size: 7, timer: 0.8, vy: -25
  });
  itemDrops.splice(index, 1);
}

function interactNPC(npc) {
  const def = npc.def;
  const dialogKey = def.name + '_' + currentFloor;
  // GDD §22: Save ao falar com NPC
  triggerSave();

  // GDD §11: Falas do Droghan (1ª vez com NPC)
  let lines = [];
  const floorGreet = def.greetings[currentFloor] || def.greetings._default;
  const firstMeet = !player.dialogsSeen[dialogKey];

  // GDD §11: primeira fala do Droghan ao encontrar NPC
  if (firstMeet) {
    player.dialogsSeen[dialogKey] = true;
    if (npc.id === 'selene' && currentFloor === 2)
      lines.push('Droghan: Você vende suprimentos? Vou precisar de tudo que tiver.');
    else if (npc.id === 'lira' && currentFloor === 2)
      lines.push('Droghan: Um fantasma? Espera... você quer me ajudar?');
    else if (npc.id === 'bron' && currentFloor === 4)
      lines.push('Droghan: Você é ferreiro? Preciso de ajuda com meu equipamento.');
    else if (npc.id === 'kaelith' && currentFloor === 5)
      lines.push('Droghan: Você pode me ensinar a lutar melhor?');
  }

  // NPC greeting
  for (const line of floorGreet) {
    lines.push(def.name + ': ' + line);
  }

  // Start dialogue, then open shop/upgrade after
  const afterDialogue = () => {
    if (def.role === 'shop') openShop(npc.id);
    else if (def.role === 'upgrade') openUpgrade();
    // GDD §12: Kaelith abre menu de skills
    else if (npc.id === 'kaelith' && player.classKey) openKaelithMenu();
  };

  // GDD §12: Lira A22 despedida — desaparece com brilho azul
  let onEndCallback = null;
  if (def.role === 'shop' || def.role === 'upgrade') {
    onEndCallback = afterDialogue;
  } else if (npc.id === 'kaelith' && player.classKey) {
    onEndCallback = afterDialogue;
  }
  if (npc.id === 'lira' && currentFloor === 22) {
    onEndCallback = () => {
      // GDD §11: Droghan responde
      startDialogue('Droghan', '#f0c8a0', ['Obrigado por tudo, Lira.'], () => {
        // Lira desaparece: partículas azuis + flag
        for (let i = 0; i < 20; i++) {
          particles.push({
            x: npc.x, y: npc.y,
            vx: (Math.random()-0.5)*40, vy: -Math.random()*60-20,
            life: 1.5, maxLife: 1.5,
            color: '#6699ff', size: 3
          });
        }
        // Remove NPC
        const idx = npcs.indexOf(npc);
        if (idx >= 0) npcs.splice(idx, 1);
        player.dialogsSeen['liraDesapareceu'] = true;
      });
    };
  }
  startDialogue(def.name, def.color, lines, onEndCallback);
}

function usePotion() {
  // GDD §15: C = usa menor poção que resolve sem desperdiçar
  const missing = getMaxHp() - player.hp;
  if (missing <= 0) return;

  // Ordem: potPeq(30), potMed(80), potGra(150), potTotal(9999)
  const order = ['potPeq','potMed','potGra','potTotal'];
  let bestPot = null;
  for (const id of order) {
    const pot = player.consumables.find(c => c.id === id && c.qty > 0);
    if (pot) {
      if (!bestPot || (POTIONS[id].heal <= missing && POTIONS[id].heal > (POTIONS[bestPot.id] || {heal:0}).heal)) {
        bestPot = pot;
      }
    }
  }
  // Fallback: menor disponível
  if (!bestPot) {
    for (const id of order) {
      const pot = player.consumables.find(c => c.id === id && c.qty > 0);
      if (pot) { bestPot = pot; break; }
    }
  }
  if (!bestPot) return;

  bestPot.qty--;
  if (bestPot.qty <= 0) {
    player.consumables = player.consumables.filter(c => c.qty > 0);
  }
  const heal = POTIONS[bestPot.id].heal;
  const actual = Math.min(getMaxHp() - player.hp, heal >= 9999 ? getMaxHp() : heal);
  player.hp = Math.min(getMaxHp(), player.hp + actual);
  sfx('potion');
  damageNumbers.push({
    x: player.x, y: player.y - 20,
    text: '+' + actual, color: '#44cc44', size: 8, timer: 0.8, vy: -30
  });
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: player.x + (Math.random()-0.5)*16,
      y: player.y + (Math.random()-0.5)*16,
      vx: (Math.random()-0.5)*20, vy: -20-Math.random()*20,
      color: '#44cc44', size: 2, life: 0.5, timer: 0
    });
  }
}

// GDD §25: Cor de partícula por bioma (morte inimigo)
function getBiomeParticleColor() {
  const b = getBiome(currentFloor).id;
  switch(b) {
    case 'pedra':     return '#8B6914'; // marrom
    case 'catacumbas': return '#888888'; // cinza
    case 'ruinas':    return '#ccaa44'; // dourado
    case 'lava':      return '#cc3300'; // vermelho
    case 'fortaleza': return '#7722aa'; // roxo
    default:          return '#8B6914';
  }
}

// GDD §15: V = poção de recurso (+50% max)
function useResourcePotion() {
  if (!player.classKey || player.resourceMax <= 0) return;
  const pot = player.consumables.find(c => c.id === 'potRecurso' && c.qty > 0);
  if (!pot) return;
  pot.qty--;
  if (pot.qty <= 0) player.consumables = player.consumables.filter(c => c.qty > 0);
  const amount = Math.floor(player.resourceMax * 0.5);
  player.resource = Math.min(player.resourceMax, player.resource + amount);
  sfx('potion');
  damageNumbers.push({x:player.x, y:player.y-20, text:'+'+amount, color:'#4488ff', size:8, timer:0.8, vy:-30});
  for (let i=0;i<5;i++) particles.push({x:player.x+(Math.random()-0.5)*16, y:player.y+(Math.random()-0.5)*16, vx:(Math.random()-0.5)*20, vy:-20-Math.random()*20, color:'#4488ff', size:2, life:0.5, timer:0});
}

// ============================================================
// UPDATE RESOURCE
// ============================================================
function updateResource(dt) {
  if (!player.classKey) return;
  const cd = CLASS_DATA[player.classKey];
  player.resourceMax = cd.getMax();
  // GDD §1: Regen por classe
  if (cd.regenDelay === 0) {
    // Mago: constante
    player.resource = Math.min(player.resourceMax, player.resource + cd.regenRate * dt);
  } else if (cd.regenDelay > 0) {
    // Guerreiro: após 2s sem atacar
    player.resourceRegenTimer += dt;
    if (player.attackTimer <= 0 && player.resourceRegenTimer >= cd.regenDelay) {
      player.resource = Math.min(player.resourceMax, player.resource + cd.regenRate * dt);
    }
  }
  // Arqueiro/Assassino: regen on-hit handled elsewhere
  // Mago passiva: Meditação (+20% regen)
  if (hasPassive('meditacao') && cd.regenDelay === 0) {
    player.resource = Math.min(player.resourceMax, player.resource + cd.regenRate * 0.2 * dt);
  }
}

// ============================================================
// UPDATE PROJECTILES / PICKUPS / PARTICLES / EFFECTS
// ============================================================
function updateProjectiles(dt) {
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const p = enemyProjectiles[i];
    // GDD §10 Gap#21: Homing projectiles (Azaroth orbs)
    if (p.homing) {
      const hdx = player.x - p.x, hdy = player.y - p.y;
      const hd = Math.sqrt(hdx*hdx + hdy*hdy);
      if (hd > 0) {
        const turnRate = 2.0;
        p.vx += (hdx/hd) * turnRate * dt * TILE;
        p.vy += (hdy/hd) * turnRate * dt * TILE;
        const spd = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
        const maxSpd = 3 * TILE;
        if (spd > maxSpd) { p.vx = p.vx/spd * maxSpd; p.vy = p.vy/spd * maxSpd; }
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.traveled += Math.sqrt((p.vx*dt)**2 + (p.vy*dt)**2);

    if (distXY(p.x, p.y, player.x, player.y) < 10) {
      if (p.isWeb) {
        // GDD §5: Teia = Imobiliza 2s
        applyStatusPlayer('imobiliza', 2);
        damageNumbers.push({
          x: player.x, y: player.y - 20,
          text: 'Teia!', color: '#cccccc', size: 7, timer: 0.8, vy: -25
        });
      } else {
        damagePlayer(p.dmg, p.x, p.y);
        // GDD §10: drainHP — projétil cura o dono ao acertar
        if (p.drainHP && p.owner && !p.owner.dead) {
          const heal = Math.floor(p.owner.maxHp * p.drainHP);
          p.owner.hp = Math.min(p.owner.maxHp, p.owner.hp + heal);
          damageNumbers.push({x:p.owner.x, y:p.owner.y-20, text:'+'+heal, color:'#44ff44', size:6, timer:0.8, vy:-25});
        }
      }
      enemyProjectiles.splice(i, 1); continue;
    }
    if (getTile(Math.floor(p.x/TILE), Math.floor(p.y/TILE)) === TILE_WALL || p.traveled > p.range)
      enemyProjectiles.splice(i, 1);
  }
}

function updatePickups() {
  for (let i = goldPickups.length - 1; i >= 0; i--) {
    const g = goldPickups[i];
    if (distXY(player.x, player.y, g.x, g.y) < TILE * 0.8) {
      // GDD §4: SOR bônus ouro
      const bonus = Math.round(g.amount * player.SOR * 0.02);
      const totalGold = g.amount + bonus;
      player.gold += totalGold;
      player.ouroTotal += totalGold;
      sfx('gold');
      // GDD §21: gold pickup HUD notification — float near gold counter
      hudGoldNotifs.push({text: '+' + totalGold, timer: 1.0});
      checkBadges('goldPickup'); // check milionário
      for (let j = 0; j < 3; j++) {
        particles.push({
          x: g.x, y: g.y,
          vx: (Math.random()-0.5)*30, vy: -40-Math.random()*20,
          color: '#ffd700', size: 2, life: 0.4, timer: 0
        });
      }
      goldPickups.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.timer += dt;
    if (p.timer >= p.life) particles.splice(i, 1);
  }
  while (particles.length > 50) particles.shift();
  // GDD §21: Update HUD gold notifications
  for (let i = hudGoldNotifs.length - 1; i >= 0; i--) {
    hudGoldNotifs[i].timer -= dt;
    if (hudGoldNotifs[i].timer <= 0) hudGoldNotifs.splice(i, 1);
  }
}

function updateDmgNumbers(dt) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i];
    d.y += d.vy * dt;
    d.timer -= dt;
    if (d.timer <= 0) damageNumbers.splice(i, 1);
  }
}

function updateEffects(dt) {
  if (screenShake.duration > 0) {
    screenShake.timer += dt;
    if (screenShake.timer >= screenShake.duration) {
      screenShake.intensity = 0; screenShake.duration = 0;
    }
  }
  if (screenFlash.duration > 0) {
    screenFlash.timer += dt;
    if (screenFlash.timer >= screenFlash.duration) {
      screenFlash.alpha = 0; screenFlash.duration = 0;
    }
  }
}
