'use strict';
// player.js — Game State, Player, Classes, Stats, Skill Helpers, Buffs

// ============================================================
// GAME STATE
// ============================================================
// loading, playing, levelUp, dead, paused, dialogue, shop, inventory, classSelect, bossIntro, upgrade
let gameState = 'loading';
let currentFloor = 1;
let maxFloorReached = 1;
let autosaveTimer = 0;
let currentSaveSlot = 0; // 0, 1 ou 2
let showMinimap = false; // GDD §14: toggle M
let bossDefeated = {}; // {5: true, 10: true, ...}
let miniBossDefeated = {}; // {3: true, 8: true, ...}

let pendingLevelUp = false;
let levelUpData = {cursor: 0, points: 3, tempAttrs: {}};

// ============================================================
// PLAYER OBJECT
// ============================================================
const player = {
  x: 0, y: 0,
  facing: 'down',
  dir: Math.PI/2,

  // GDD §4: 6 Atributos (começam em 3)
  FOR: 3, DES: 3, INT: 3, AGI: 3, VIT: 3, SOR: 3,

  level: 1, xp: 0, gold: 0,
  hp: 0,

  classKey: null, // null = pré-classe (A1-A4) — GDD §1
  resource: 0,    // Estamina/Mana/Foco/Energia pós-classe
  resourceMax: 0,
  resourceRegenTimer: 0,

  // Combate
  attackTimer: 0, attackAnim: 0,
  iframeTimer: 0, blinkTimer: 0,
  kbVx: 0, kbVy: 0, kbTimer: 0,

  // Animação
  walkFrame: 0, walkTimer: 0,
  dead: false, deathTimer: 0,

  // GDD §3: Equipamento (8 slots, vazio no início)
  equipment: {},

  // GDD §13: Mochila 20 slots
  inventory: [],

  // GDD §15: Consumíveis (separados da mochila)
  consumables: [{...POTIONS.potPeq, id:'potPeq', qty:2}],

  // Status effects — GDD §5
  statusEffects: [],

  // Stats de tracking
  deaths: 0,
  enemiesKilled: 0,

  // Dialogues seen flags — GDD §11
  dialogsSeen: {},
};

// GDD §1: Classes
const CLASS_DATA = {
  guerreiro: {
    name:'Guerreiro', resource:'Estamina', resColor:'#cccc00',
    // GDD §1: Estamina = 50+FOR×3+VIT×2, regen +8/s após 2s sem atacar
    getMax: () => 50 + player.FOR*3 + player.VIT*2,
    regenRate: 8, regenDelay: 2,
    desc: 'Combate corpo a corpo. Estamina regenera após 2s sem atacar.'
  },
  mago: {
    name:'Mago', resource:'Mana', resColor:'#4488ff',
    // GDD §1: Mana = 30+INT×5, regen constante +3/s
    getMax: () => 30 + player.INT*5,
    regenRate: 3, regenDelay: 0,
    desc: 'Magias poderosas. Mana regenera constantemente.'
  },
  arqueiro: {
    name:'Arqueiro', resource:'Foco', resColor:'#44cc44',
    // GDD §1: Foco = 40+DES×4+AGI, regen +10 ao acertar
    getMax: () => 40 + player.DES*4 + player.AGI,
    regenRate: 10, regenDelay: -1, // -1 = ao acertar
    desc: 'Ataques à distância. Foco recupera ao acertar.'
  },
  assassino: {
    name:'Assassino', resource:'Energia', resColor:'#aa44cc',
    // GDD §1: Energia = 40+AGI×4+DES, regen ao esquivar/matar
    getMax: () => 40 + player.AGI*4 + player.DES,
    regenRate: 15, regenDelay: -2, // -2 = ao esquivar/matar
    desc: 'Golpes rápidos e furtivos. Energia ao esquivar e matar.'
  },
};

// GDD §4: Stats derivados

// GDD §3: Helper — soma de bônus de atributo de anéis e amuleto equipados
function getRingAmuletBonus(attrName) {
  let bonus = 0;
  // Anéis (ring1, ring2)
  for (const slot of ['ring1','ring2']) {
    const ring = player.equipment[slot];
    if (ring && ring.type === 'ring' && ring.attr === attrName) {
      bonus += ring.val;
    }
  }
  // Amuleto
  const amu = player.equipment.amulet;
  if (amu && amu.type === 'amulet') {
    if (amu.attr1 === attrName) bonus += amu.val1;
    if (amu.attr2 === attrName) bonus += amu.val2;
  }
  return bonus;
}

// GDD §3: Bonus de crit% dos anéis Rubi/Ancestral +5
function getRingCritBonus() {
  let bonus = 0;
  for (const slot of ['ring1','ring2']) {
    const ring = player.equipment[slot];
    if (ring && ring.type === 'ring' && ring.upgLevel >= 5) {
      if (ring.tier === 'rubi' || ring.tier === 'ancestral') bonus += 5;
    }
  }
  return bonus;
}

// GDD §3: Efeitos especiais do Anel Ancestral +5
function getAncestralEffect(effectName) {
  for (const slot of ['ring1','ring2']) {
    const ring = player.equipment[slot];
    if (ring && ring.type === 'ring' && ring.tier === 'ancestral' && ring.upgLevel >= 5 && ring.effect === effectName) {
      return true;
    }
  }
  return false;
}

// GDD §3: Amuleto — +1 level em skill específica
function getAmuletSkillBonus(skillId) {
  const amu = player.equipment.amulet;
  if (amu && amu.type === 'amulet' && amu.skillId === skillId) return 1;
  return 0;
}

function getMaxHp() {
  let hp = 80 + player.VIT * 8;
  // GDD §3: Bônus VIT de anéis/amuleto (VIT×8)
  hp += getRingAmuletBonus('VIT') * 8;
  // GDD §3: Ancestral efeito Vida: +15% HP máx
  if (getAncestralEffect('vida')) hp = Math.floor(hp * 1.15);
  return hp;
}
function getAtkFis()    {
  let wAtk = 0;
  if (player.equipment.weapon) wAtk = player.equipment.weapon.atk || 0;
  let atk = player.FOR * 2 + wAtk + player.level;
  // GDD §3: Bônus FOR de anéis/amuleto (FOR×2)
  atk += getRingAmuletBonus('FOR') * 2;
  // GDD §3: Ancestral efeito Força: +10% dano
  if (getAncestralEffect('forca')) atk = Math.floor(atk * 1.10);
  return atk;
}
function getDefense()   {
  let armorDef = 0;
  for (const slot of ['head','body','secondary','feet']) {
    if (player.equipment[slot]) armorDef += (player.equipment[slot].def || 0);
  }
  let def = player.VIT + armorDef + player.FOR * 0.3 + getRingAmuletBonus('VIT') + getRingAmuletBonus('FOR') * 0.3;
  // GDD §5: Maldição -20% DEF
  if (hasStatus(player, 'maldicao')) def *= 0.8;
  return def;
}
function getEsquiva() {
  let esq = player.AGI * 0.5 + player.DES * 0.3;
  // GDD §3: Bônus AGI/DES de anéis/amuleto
  esq += getRingAmuletBonus('AGI') * 0.5 + getRingAmuletBonus('DES') * 0.3;
  // GDD §3: Ancestral efeito Sombra: +10% esquiva
  if (getAncestralEffect('sombra')) esq += 10;
  return Math.min(40, esq);
}
function getCritChance(){
  let crit = player.AGI * 0.3 + player.SOR * 0.5;
  // GDD §3: Bônus AGI/SOR de anéis/amuleto
  crit += getRingAmuletBonus('AGI') * 0.3 + getRingAmuletBonus('SOR') * 0.5;
  // GDD §3: +5% Crit de Rubi/Ancestral +5
  crit += getRingCritBonus();
  // GDD §7: Cap base 35 sem passiva
  crit = Math.min(35, crit);
  // GDD §7: Arqueiro passiva Tiro Crítico +20% crit (cap 55 com passiva)
  if (hasPassive('tiroCritico')) crit += 20;
  return crit;
}
function getCritDmg()   { return Math.min(250, 150 + (player.SOR + getRingAmuletBonus('SOR')) * 2); }
function getMoveSpeed() {
  let spd = 1.0 * (1 + (player.AGI + getRingAmuletBonus('AGI')) * 0.005);
  // GDD §7: Assassino passiva Agilidade Felina +15% velocidade
  if (hasPassive('agilidadeFelina')) spd *= 1.15;
  // GDD §10: Evolution speed bonus at evo 3
  if (player.classEvolution >= 3) spd *= 1.05;
  return spd;
}
function getXpToNext()  { return 30 + (player.level - 1) * 15; } // GDD §4
function getResourceMax() {
  if (!player.classKey) return 0;
  // GDD §10: Evolution bonus +10% per evolution level
  return Math.floor(CLASS_DATA[player.classKey].getMax() * (1 + (player.classEvolution || 0) * 0.10));
}

// GDD §4: DES +0.5% attack speed per point
function getAttackSpeed() {
  return 0.5 / (1 + player.DES * 0.005);
}

// GDD §4: AtkMag = INT×2 + arma + lvl (pós-classe Mago)
function getAtkMag() {
  let wAtk = 0;
  if (player.equipment.weapon) wAtk = player.equipment.weapon.atk || 0;
  let atk = player.INT * 2 + wAtk + player.level;
  // GDD §3: Bônus INT de anéis/amuleto
  atk += getRingAmuletBonus('INT') * 2;
  if (getAncestralEffect('forca')) atk = Math.floor(atk * 1.10);
  return atk;
}
// GDD §4: AtkDist = DES×2 + arma + lvl (pós-classe Arqueiro)
function getAtkDist() {
  let wAtk = 0;
  if (player.equipment.weapon) wAtk = player.equipment.weapon.atk || 0;
  let atk = player.DES * 2 + wAtk + player.level;
  // GDD §3: Bônus DES de anéis/amuleto
  atk += getRingAmuletBonus('DES') * 2;
  if (getAncestralEffect('forca')) atk = Math.floor(atk * 1.10);
  return atk;
}
// GDD §7: Dano de skill = atk × base% × (1 + (skill_level-1) × 0.12)
function getSkillDamage(basePercent, skillLevel) {
  let mult = basePercent / 100 * (1 + (skillLevel - 1) * 0.12);
  // GDD §10: Evolution damage bonus
  let evoBonus = 0;
  if (player.classEvolution >= 2) evoBonus += 0.05;
  if (player.classEvolution >= 3) evoBonus += 0.05;
  return mult * (1 + evoBonus);
}
// GDD §7: Utilidade: duração +0.5s/level, absorção +5%/level
function getSkillDuration(baseDuration, skillLevel) {
  return baseDuration + (skillLevel - 1) * 0.5;
}
function getSkillAbsorb(basePercent, skillLevel) {
  return basePercent + (skillLevel - 1) * 5;
}

// ============================================================
// PLAYER INIT
// ============================================================
function initPlayer() {
  player.FOR = 3; player.DES = 3; player.INT = 3;
  player.AGI = 3; player.VIT = 3; player.SOR = 3;
  player.level = 1; player.xp = 0; player.gold = 0;
  player.hp = getMaxHp();
  player.classKey = null;
  player.resource = 0; player.resourceMax = 0;
  player.dead = false; player.deathTimer = 0;
  player.attackTimer = 0; player.attackAnim = 0;
  player.iframeTimer = 0; player.kbTimer = 0;
  player.equipment = {};
  player.inventory = [];
  player.consumables = [{...POTIONS.potPeq, id:'potPeq', qty:2}];
  player.statusEffects = [];
  player.deaths = 0; player.enemiesKilled = 0;
  player.secretRoomsFound = 0; // GDD §21: for Explorador badge
  player.ouroTotal = 0; // GDD §22: ouro acumulado total
  player.tempoJogado = 0; // GDD §22: segundos jogados
  player.tutorialVisto = {}; // GDD §27: flags de tutorial
  player.badges = []; // GDD §22: badges conquistadas
  player.gameCompleted = false; // GDD §29: post-game flag
  player.classEvolution = 0; // GDD §10: evoluções de classe
  player.dialogsSeen = {};
  // M3: Skills
  player.skillPoints = 0;
  player.skills = {};        // {skillId: level} ex: {golpeBrutal:3, provocar:1}
  player.equippedSkills = [null,null,null,null,null]; // 5 slots
  player.skillCooldowns = {};  // {skillId: timer}
  player.scrollSkills = 0;   // Scroll Skill count
  // M3: Passivas
  player.passives = [];       // Array de passiveId desbloqueadas
  // M3: Essência
  player.essencia = 0;
  player.essenciaMax = 100;   // GDD §8: começa 100, sobe em A15/A20
  player.essenciaStage = 0; // GDD §8: staged revelation (0-10)
  // M3: Buffs ativos
  player.buffs = []; // {id, name, duration, timer, effect:{}}
  // M3: Invisível (Assassino Passos Sombrios)
  player.invisible = false;
  player.invisTimer = 0;
  player.invisBonusDmg = 0;
  // M3: Bloqueio Perfeito (Guerreiro)
  player.perfectBlock = false;
  player.perfectBlockTimer = 0;
  // M3: Familiar (Mago)
  player.familiar = null;
  // M3: Sentinela (Arqueiro)
  player.sentinels = [];
  // M3: Escudo Espelhado
  player.reflectTimer = 0;
  player.reflectPct = 0;
  // M3: Vontade Inquebrável (1x/andar)
  player.vontadeUsed = false;
  // M3: Barreira absorb
  player.barrier = 0;
  player.barrierMax = 0;
  player.barrierTimer = 0;
  // M3: Essência Escudo
  player.essenciaShield = 0;
  player.essenciaShieldTimer = 0;
}

// ============================================================
// SKILL HELPERS
// ============================================================
function getClassSkills() {
  if (!player.classKey) return [];
  return Object.entries(SKILLS)
    .filter(([, s]) => s.cls === player.classKey)
    .sort((a, b) => a[1].num - b[1].num);
}

// Check if player has a passive
function hasPassive(passiveId) {
  return player.passives.includes(passiveId);
}

// Check passives to unlock at current level
function checkPassiveUnlocks() {
  if (!player.classKey) return;
  const classPas = PASSIVES[player.classKey];
  for (const p of classPas) {
    if (player.level >= p.lvl && !player.passives.includes(p.id)) {
      player.passives.push(p.id);
      damageNumbers.push({
        x: player.x, y: player.y - 30,
        text: 'Passiva: ' + p.name, color: '#ffd700', size: 8, timer: 2, vy: -15
      });
    }
  }
}

// GDD §8: Essência — encher barra
function addEssencia(amount) {
  if (currentFloor < 3) return; // GDD §8: só aparece em A3
  player.essencia = Math.min(player.essenciaMax, player.essencia + amount);
}

// GDD §8: Essência fill rates
function onEnemyKill(enemy) {
  const arch = enemy.def ? enemy.def.arch : 'normal';
  // GDD §8: kills: Enxame+5%, Normal/Tank+8%, Forte/Caster+12%, Mini+25%, Boss+50%
  let pct = 0;
  if (enemy.isBoss) pct = 50;
  else if (enemy.isMiniBoss) pct = 25;
  else if (arch === 'enxame') pct = 5;
  else if (arch === 'normal' || arch === 'tank') pct = 8;
  else if (arch === 'forte' || arch === 'caster') pct = 12;
  addEssencia(player.essenciaMax * pct / 100);

  // Assassino passiva: Sede Sangue — kill = 15% HP
  if (hasPassive('sedeSangue')) {
    const heal = Math.floor(getMaxHp() * 0.15);
    player.hp = Math.min(getMaxHp(), player.hp + heal);
    damageNumbers.push({x: player.x, y: player.y-20, text:'+'+heal, color:'#33ff33', size:7, timer:0.6, vy:-30});
  }

  // Assassino recurso: +20 energia por kill
  if (player.classKey === 'assassino') {
    player.resource = Math.min(player.resourceMax, player.resource + 20);
  }
}

// GDD §8: Essência — dano recebido/causado/crit (A10+)
function onPlayerDamageDealt(dmg, isCrit) {
  if (currentFloor >= 10) {
    addEssencia(player.essenciaMax * 0.01); // +1% por hit
    if (isCrit) addEssencia(player.essenciaMax * 0.05); // +5% por crit
  }
  // Arqueiro recurso: +10 foco ao acertar
  if (player.classKey === 'arqueiro') {
    player.resource = Math.min(player.resourceMax, player.resource + 10);
  }
  // Guerreiro passiva: Regen Batalha — 1% HP por acerto
  if (hasPassive('regenBatalha')) {
    const heal = Math.floor(getMaxHp() * 0.01);
    player.hp = Math.min(getMaxHp(), player.hp + heal);
  }
}
function onPlayerDamageTaken() {
  if (currentFloor >= 10) addEssencia(player.essenciaMax * 0.03); // +3% por hit
}

// Update essência max cap and stage (GDD §8)
function updateEssenciaCap() {
  if (currentFloor >= 20) player.essenciaMax = 200;
  else if (currentFloor >= 15) player.essenciaMax = 150;
  else player.essenciaMax = 100;
  player.essenciaStage = getEssenciaStage(maxFloorReached);
}

// GDD §8: Staged essência revelation based on max floor reached
function getEssenciaStage(floor) {
  if (floor >= 25) return 10; // Despertar Total + Ultimate
  if (floor >= 23) return 9;  // Lâmina Luz
  if (floor >= 20) return 8;  // 200% cap
  if (floor >= 18) return 7;  // Despertar Parcial
  if (floor >= 15) return 6;  // 150% cap
  if (floor >= 13) return 5;  // Escudo unlocked
  if (floor >= 10) return 4;  // "Essência" label, damage fills
  if (floor >= 8)  return 3;  // Pulso unlocked
  if (floor >= 5)  return 2;  // "???" label
  if (floor >= 3)  return 1;  // bar visible
  return 0;                   // hidden
}

// GDD §8: Return only essência skills unlocked at current stage
function getAvailableEssenciaSkills() {
  const stage = getEssenciaStage(maxFloorReached);
  return ESSENCIA_SKILLS.filter(sk => {
    const skStage = getEssenciaStage(sk.unlockFloor);
    return skStage <= stage;
  });
}

// ============================================================
// PLAYER BUFFS
// ============================================================
function updatePlayerBuffs(dt) {
  for (let i = player.buffs.length - 1; i >= 0; i--) {
    const b = player.buffs[i];
    b.timer -= dt;
    // GDD §7: Despertar Total — regen 3% HP/s
    if (b.effect.hpRegen) {
      const heal = Math.floor(getMaxHp() * b.effect.hpRegen * dt);
      player.hp = Math.min(getMaxHp(), player.hp + heal);
    }
    // GDD §7: Chuva Infinita — 3 flechas auto-aim/0.5s
    if (b.id === 'chuvaInfinita') {
      b.shootTimer = (b.shootTimer || 0) + dt;
      if (b.shootTimer >= 0.5) {
        b.shootTimer -= 0.5;
        // 3 flechas ao inimigo mais próximo (range 6 tiles)
        const targets = enemies.filter(e => !e.dead && distXY(player.x, player.y, e.x, e.y) < 6 * TILE);
        targets.sort((a, b2) => distXY(player.x, player.y, a.x, a.y) - distXY(player.x, player.y, b2.x, b2.y));
        for (let f = 0; f < 3 && targets.length > 0; f++) {
          const tgt = targets[f % targets.length];
          const ang = Math.atan2(tgt.y - player.y, tgt.x - player.x) + (f-1)*0.1;
          playerProjectiles.push({
            x: player.x, y: player.y,
            vx: Math.cos(ang) * 7 * TILE, vy: Math.sin(ang) * 7 * TILE,
            dmg: getAtkDist() * 0.6, color: '#88ccff', size: 3,
            maxRange: 6 * TILE, traveled: 0
          });
        }
      }
    }
    // GDD §7: Muralha — imóvel enquanto ativo (handled in movement via buff check)
    if (b.timer <= 0) player.buffs.splice(i, 1);
  }
}
function hasBuff(id) { return player.buffs.some(b => b.id === id); }

// ============================================================
// GDD §21: BADGES (13 conquistas)
// ============================================================
const BADGE_DEFS = [
  {id:'imortal',       name:'Imortal',          desc:'Zerou com 0 mortes',                       icon:'💀'},
  {id:'persistente',   name:'Persistente',      desc:'Zerou com < 5 mortes',                     icon:'🔥'},
  {id:'milionario',    name:'Milionário',       desc:'Acumulou 100.000g total',                  icon:'💰'},
  {id:'exterminador',  name:'Exterminador',     desc:'Matou 1.000 inimigos',                     icon:'⚔️'},
  {id:'speedrunner',   name:'Speedrunner',      desc:'Zerou em < 3 horas',                       icon:'⏱️'},
  {id:'explorador',    name:'Explorador',       desc:'Encontrou todas as 8 salas secretas',      icon:'🗺️'},
  {id:'colecionador',  name:'Colecionador',     desc:'Obteve equip T5 completo',                 icon:'🛡️'},
  {id:'cacaChefes',    name:'Caça-Chefes',      desc:'Derrotou todos 5 bosses sem morrer pra eles', icon:'👑'},
  {id:'lendario',      name:'Lendário',         desc:'Zerou com 0 mortes em < 4 horas',          icon:'⭐'},
  {id:'muralhaViva',   name:'Muralha Viva',     desc:'Zerou sem morrer usando Guerreiro',        icon:'🏰'},
  {id:'arcanoSupremo', name:'Arcano Supremo',   desc:'Zerou sem morrer usando Mago',             icon:'🔮'},
  {id:'olhoInfalivel', name:'Olho Infalível',   desc:'Zerou sem morrer usando Arqueiro',         icon:'🎯'},
  {id:'fantasmaPerfeito',name:'Fantasma Perfeito',desc:'Zerou sem morrer usando Assassino',      icon:'👻'},
];

// Track boss deaths (player died to a boss = disqualifies Caça-Chefes)
let bossDeathTracker = {}; // {floorNum: true} if player died while boss alive

function checkBadges(trigger) {
  // trigger: 'kill', 'bossKill', 'victory', 'goldPickup', 'always'
  const earned = [];

  function award(id) {
    if (!player.badges.includes(id)) {
      player.badges.push(id);
      const def = BADGE_DEFS.find(b => b.id === id);
      if (def) {
        damageNumbers.push({
          x: player.x, y: player.y - 40,
          text: 'Badge: ' + def.name, color: '#ffd700', size: 9, timer: 3, vy: -10
        });
      }
      earned.push(id);
    }
  }

  const isVictory = trigger === 'victory';
  const hoursPlayed = player.tempoJogado / 3600;

  // Milionário: 100k ouro total (check anytime)
  if (player.ouroTotal >= 100000) award('milionario');

  // Exterminador: 1000 kills (check anytime)
  if (player.enemiesKilled >= 1000) award('exterminador');

  // Victory-only badges
  if (isVictory) {
    // Imortal: 0 mortes
    if (player.deaths === 0) award('imortal');

    // Persistente: < 5 mortes
    if (player.deaths < 5) award('persistente');

    // Speedrunner: < 3 horas
    if (hoursPlayed < 3) award('speedrunner');

    // Lendário: 0 mortes + < 4 horas
    if (player.deaths === 0 && hoursPlayed < 4) award('lendario');

    // Muralha Viva: 0 mortes + Guerreiro
    if (player.deaths === 0 && player.classKey === 'guerreiro') award('muralhaViva');

    // Arcano Supremo: 0 mortes + Mago
    if (player.deaths === 0 && player.classKey === 'mago') award('arcanoSupremo');

    // Olho Infalível: 0 mortes + Arqueiro
    if (player.deaths === 0 && player.classKey === 'arqueiro') award('olhoInfalivel');

    // Fantasma Perfeito: 0 mortes + Assassino
    if (player.deaths === 0 && player.classKey === 'assassino') award('fantasmaPerfeito');

    // Caça-Chefes: all 5 bosses killed without dying to any
    const allBossFloors = [5, 10, 15, 20, 25];
    const allBossesKilled = allBossFloors.every(f => bossDefeated[f]);
    const noBossDeaths = allBossFloors.every(f => !bossDeathTracker[f]);
    if (allBossesKilled && noBossDeaths) award('cacaChefes');

    // Colecionador: T5 equip in all 5 armor/weapon slots
    const t5Slots = ['weapon', 'body', 'head', 'secondary', 'feet'];
    const allT5 = t5Slots.every(s => player.equipment[s] && player.equipment[s].tier >= 5);
    if (allT5) award('colecionador');

    // Explorador: 8 unique secret rooms found (floors 3,6,9,12,15,18,21,24)
    if ((player.salaSecretaEncontrada || []).length >= 8) award('explorador');
  }

  return earned;
}
function getBuffMult(stat) {
  let mult = 1;
  for (const b of player.buffs) {
    if (b.effect[stat]) mult += b.effect[stat];
  }
  return mult;
}
