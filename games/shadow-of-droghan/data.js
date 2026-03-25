'use strict';
// data.js — Equipment, Potions, NPCs, Skills, Enemies, Status Effects

// ============================================================
// EQUIPMENT DATA — GDD §3
// ============================================================
// T0 = genérico (pré-classe), T1 = classe-específico
const EQUIP_STATS = {
  // GDD §3: Stats por tier
  weapon:    {stat:'atk', T0:2,  T1:8,  T2:18, T3:32, T4:50, T5:75},
  body:      {stat:'def', T0:2,  T1:6,  T2:14, T3:25, T4:40, T5:60},
  head:      {stat:'def', T0:1,  T1:4,  T2:10, T3:18, T4:30, T5:45},
  secondary: {stat:'def', T0:1,  T1:4,  T2:10, T3:18, T4:30, T5:45},
  feet:      {stat:'agi', T0:1,  T1:3,  T2:7,  T3:12, T4:20, T5:30},
};

// GDD §3: Nomes e preços individuais dos itens T0
const T0_ITEMS = {
  weapon:    {name:'Porrete de Madeira', price:45},
  body:      {name:'Camisa Rasgada',     price:50},
  head:      {name:'Faixa de Pano',      price:30},
  secondary: {name:'Tábua Velha',        price:35},
  feet:      {name:'Sandálias Gastas',    price:30},
};

const SLOT_NAMES = {
  weapon:'Arma', body:'Corpo', head:'Cabeça', secondary:'Secundária',
  feet:'Pés', ring1:'Anel 1', ring2:'Anel 2', amulet:'Amuleto'
};

// GDD §3: Nomes de equip por classe e tier
// Guerreiro: Elmo/Peitoral/Espada/Escudo/Botas (Couro→Ferro→Aço→Dourado→Campeão)
// Mago: Capuz/Túnica/Cajado/Orbe/Sandálias (Linho→Arcano→Sábio→Místico→Merlim)
// Arqueiro: Bandana/Colete/Arco/Aljava/Botas (Pano→Couro→Caçador→Atirador→Sentinela)
// Assassino: Faixa/Roupa/Faca/Faca2/Panos (Rasgada→Negro→Sombra→Fantasma→Ceifador)
const CLASS_EQUIP_NAMES = {
  guerreiro: {
    tiers: ['Couro','Ferro','Aço','Dourado','Campeão'],
    slots: {weapon:'Espada',body:'Peitoral',head:'Elmo',secondary:'Escudo',feet:'Botas'},
  },
  mago: {
    tiers: ['Linho','Arcano','Sábio','Místico','Merlim'],
    slots: {weapon:'Cajado',body:'Túnica',head:'Capuz',secondary:'Orbe',feet:'Sandálias'},
  },
  arqueiro: {
    tiers: ['Pano','Couro','Caçador','Atirador','Sentinela'],
    slots: {weapon:'Arco',body:'Colete',head:'Bandana',secondary:'Aljava',feet:'Botas'},
  },
  assassino: {
    tiers: ['Rasgada','Negro','Sombra','Fantasma','Ceifador'],
    slots: {weapon:'Faca',body:'Roupa',head:'Faixa',secondary:'Faca Dupla',feet:'Panos'},
  },
};

// GDD §1: Nomes de evolução de classe por nível
const CLASS_EVOLUTIONS = {
  guerreiro: [{lvl:10, name:'Cavaleiro'}, {lvl:15, name:'Paladino'}, {lvl:20, name:'Campeão'}],
  mago:      [{lvl:10, name:'Sábio'},     {lvl:15, name:'Arcano'},   {lvl:20, name:'Merlim'}],
  arqueiro:  [{lvl:10, name:'Caçador'},   {lvl:15, name:'Atirador'}, {lvl:20, name:'Sentinela'}],
  assassino: [{lvl:10, name:'Sombra'},    {lvl:15, name:'Fantasma'}, {lvl:20, name:'Ceifador'}],
};

function makeEquip(slot, tier, upgLevel, classKey) {
  const info = EQUIP_STATS[slot];
  if (!info) return null;
  const tierKey = 'T' + tier;
  const baseVal = info[tierKey] || 0;
  // GDD §3: Upgrade Bron: +10% do valor base por nível
  const val = Math.round(baseVal * (1 + (upgLevel || 0) * 0.1));
  // GDD §3: T0 tem nomes próprios, T1+ usa nomes de classe
  let name;
  const upg = upgLevel ? ' +'+upgLevel : '';
  if (tier === 0 && T0_ITEMS[slot]) {
    name = T0_ITEMS[slot].name + upg;
  } else if (tier >= 1 && classKey && CLASS_EQUIP_NAMES[classKey]) {
    const cd = CLASS_EQUIP_NAMES[classKey];
    const slotName = cd.slots[slot] || SLOT_NAMES[slot];
    const tierName = cd.tiers[tier - 1] || ('T' + tier);
    name = slotName + ' ' + tierName + upg;
  } else {
    name = SLOT_NAMES[slot] + ' T' + tier + upg;
  }
  return {
    type: 'equip', slot, tier, upgLevel: upgLevel || 0,
    classKey: classKey || null,
    name,
    [info.stat]: val
  };
}

// ============================================================
// RING DATA — GDD §3 Anéis (universais, 2 slots)
// ============================================================
const RING_TIERS = ['cobre','prata','ouro','rubi','ancestral'];
const RING_DATA = {
  // GDD §3: base +0, incremento por upgrade level
  cobre:     {name:'Anel de Cobre',    base:1.0,  incr:0.5},
  prata:     {name:'Anel de Prata',    base:4.0,  incr:0.6},
  ouro:      {name:'Anel de Ouro',     base:8.0,  incr:0.8},
  rubi:      {name:'Anel de Rubi',     base:13.0, incr:1.0, maxBonus:'+5%Crit'},
  ancestral: {name:'Anel Ancestral',   base:19.0, incr:1.5, maxBonus:'+5%Crit+efeito'},
};
const RING_ATTRS = ['FOR','DES','INT','AGI','VIT','SOR'];
// GDD §3: Efeitos Ancestral (1 aleatório)
const ANCESTRAL_EFFECTS = {
  vida:   {desc:'+15% HP máx',    hpMaxPct: 0.15},
  forca:  {desc:'+10% dano',      dmgPct: 0.10},
  sombra: {desc:'+10% esquiva',   esquivaPct: 0.10},
};

function makeRing(tierKey, upgLevel, attr, effect) {
  const data = RING_DATA[tierKey];
  if (!data) return null;
  upgLevel = upgLevel || 0;
  attr = attr || RING_ATTRS[randInt(0, RING_ATTRS.length - 1)];
  const val = data.base + upgLevel * data.incr;
  // GDD §3: Ancestral: efeito aleatório
  if (tierKey === 'ancestral' && !effect) {
    const effs = Object.keys(ANCESTRAL_EFFECTS);
    effect = effs[randInt(0, effs.length - 1)];
  }
  const upg = upgLevel ? ' +' + upgLevel : '';
  let name = data.name + upg;
  return {
    type: 'ring', tier: tierKey, name, upgLevel,
    attr, val,
    effect: effect || null,
  };
}

// GDD §3: Drop de anéis por bioma
function getRingTierForFloor(floor) {
  // Pool cumulativo: tiers anteriores continuam dropando
  const pool = ['cobre']; // B1 (A1-5)
  if (floor >= 6)  pool.push('prata');     // B2 (A6-10)
  if (floor >= 11) pool.push('ouro');      // B3 (A11-15)
  if (floor >= 16) pool.push('rubi');      // B4 (A16-20)
  if (floor >= 21) pool.push('ancestral'); // B5 (A21-25)
  // Peso maior para tiers mais altos
  if (pool.length <= 1) return pool[0];
  // 50% chance tier mais alto, resto distribuído
  if (Math.random() < 0.5) return pool[pool.length - 1];
  return pool[randInt(0, pool.length - 1)];
}

// ============================================================
// AMULET DATA — GDD §3 Amuletos (1 slot)
// ============================================================
const AMULET_RARITIES = ['comum','incomum','raro','epico','lendario'];
const AMULET_ATTR_RANGES = {
  // GDD §3: Valores dos atributos aleatórios por raridade {attr1:[min,max], attr2:[min,max]}
  comum:   {a1:[1,2], a2:[1,2]},
  incomum: {a1:[2,3], a2:[1,2]},
  raro:    {a1:[3,4], a2:[2,3]},
  epico:   {a1:[4,5], a2:[3,4]},
  lendario:{a1:[5,6], a2:[4,5]},
};
const AMULET_RARITY_NAMES = {
  comum:'Comum', incomum:'Incomum', raro:'Raro', epico:'Épico', lendario:'Lendário'
};
const AMULET_RARITY_COLORS = {
  comum:'#aaa', incomum:'#44cc44', raro:'#4488ff', epico:'#aa44cc', lendario:'#ffd700'
};
// GDD §3: Upgrade Selene (multiplica atributos)
const AMULET_UPGRADE_MULT = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5]; // +0 a +5

// GDD §3: Skills associadas por raridade e classe
function getAmuletSkillPool(classKey, rarity) {
  if (!classKey || rarity === 'lendario') {
    // Lendários = skills de Essência (universais)
    return ESSENCIA_SKILLS.map(s => s.id);
  }
  const classSkills = Object.entries(SKILLS).filter(([,s]) => s.cls === classKey);
  classSkills.sort((a,b) => a[1].num - b[1].num);
  // GDD §3: Comum=skill 1,2 | Incomum=3,4,5 | Raro=6,7,8 | Épico=9,10
  switch (rarity) {
    case 'comum':  return classSkills.filter(([,s]) => s.num <= 2).map(([k]) => k);
    case 'incomum':return classSkills.filter(([,s]) => s.num >= 3 && s.num <= 5).map(([k]) => k);
    case 'raro':   return classSkills.filter(([,s]) => s.num >= 6 && s.num <= 8).map(([k]) => k);
    case 'epico':  return classSkills.filter(([,s]) => s.num >= 9 && s.num <= 10).map(([k]) => k);
    default: return classSkills.map(([k]) => k);
  }
}

function makeAmulet(rarity, upgLevel, classKey, skillId, attr1, attr2, val1, val2) {
  rarity = rarity || 'comum';
  upgLevel = upgLevel || 0;
  classKey = classKey || player.classKey;
  const ranges = AMULET_ATTR_RANGES[rarity];

  // Pick 2 different random attributes
  if (!attr1 || !attr2) {
    const attrs = [...RING_ATTRS];
    const i1 = randInt(0, attrs.length - 1);
    attr1 = attr1 || attrs[i1];
    attrs.splice(i1, 1);
    const i2 = randInt(0, attrs.length - 1);
    attr2 = attr2 || attrs[i2];
  }

  // Roll values within range
  val1 = val1 || randInt(ranges.a1[0], ranges.a1[1]);
  val2 = val2 || randInt(ranges.a2[0], ranges.a2[1]);

  // Apply upgrade multiplier (arredonda pra baixo)
  const mult = AMULET_UPGRADE_MULT[upgLevel] || 1.0;
  const finalVal1 = Math.floor(val1 * mult);
  const finalVal2 = Math.floor(val2 * mult);

  // Pick skill
  if (!skillId) {
    const pool = getAmuletSkillPool(classKey, rarity);
    skillId = pool.length > 0 ? pool[randInt(0, pool.length - 1)] : null;
  }

  const skillName = skillId ? (SKILLS[skillId] ? SKILLS[skillId].name : (ESSENCIA_SKILLS.find(s => s.id === skillId) || {}).name || skillId) : '???';
  const upg = upgLevel ? ' +' + upgLevel : '';
  const name = 'Amuleto ' + AMULET_RARITY_NAMES[rarity] + upg;

  return {
    type: 'amulet', rarity, upgLevel,
    classKey: classKey || null,
    name,
    skillId,
    skillName,
    attr1, attr2,
    baseVal1: val1, baseVal2: val2,  // valores base antes do mult (para upgrade)
    val1: finalVal1, val2: finalVal2, // valores finais
  };
}

// GDD §3: Selene upgrade costs for rings and amulets
const SELENE_UPGRADE_DATA = [
  {cost:80,   chance:1.0},   // +1: 80g, 100%
  {cost:200,  chance:0.85},  // +2: 200g, 85%
  {cost:500,  chance:0.65},  // +3: 500g, 65%
  {cost:1000, chance:0.45},  // +4: 1000g, 45%
  {cost:2000, chance:0.25},  // +5: 2000g, 25%
];

// GDD §3: Drop de amuletos — rates
const AMULET_DROP_RATES = {
  // {regular: chance%, miniBoss: chance%, boss: chance%}
  comum:   {regular:5,  miniBoss:15, boss:0},
  incomum: {regular:3,  miniBoss:12, boss:0},
  raro:    {regular:1.5,miniBoss:10, boss:20},
  epico:   {regular:0,  miniBoss:8,  boss:30},
  lendario:{regular:0,  miniBoss:0,  boss:0},  // A20+ boss special
};

// Selene amulet prices
const AMULET_SELENE_PRICES = {
  comum:80, incomum:200, raro:450, epico:900,
};

function rollAmuletRarity(source, floor) {
  // source: 'regular', 'miniBoss', 'boss'
  const roll = Math.random() * 100;
  let cumulative = 0;
  // Roll from rarest to most common
  const rarities = ['lendario','epico','raro','incomum','comum'];
  for (const r of rarities) {
    if (r === 'lendario' && source === 'boss' && floor >= 20) {
      // GDD §3: Lendário só de boss A20+
      if (roll < 10) return 'lendario'; // 10% chance from A20+ bosses
    }
    const rate = AMULET_DROP_RATES[r][source] || 0;
    cumulative += rate;
    if (roll < cumulative) return r;
  }
  return null; // no amulet drop
}

// ============================================================
// POTION DATA — GDD §15
// ============================================================
const POTIONS = {
  potPeq:   {name:'Poção Peq',   heal:30,   price:30,  type:'vida'},
  potMed:   {name:'Poção Méd',   heal:80,   price:80,  type:'vida'},
  potGra:   {name:'Poção Gra',   heal:150,  price:180, type:'vida'},
  potTotal: {name:'Poção Total', heal:9999, price:350, type:'vida'},
  potRegen: {name:'Poção Regen', heal:0,    price:120, type:'vida', regen:{hps:5, dur:20}},
  antidoto: {name:'Antídoto',    heal:0,    price:25,  type:'cura', cures:['veneno','sangramento']},
  aguaBenta:{name:'Água Benta',  heal:0,    price:40,  type:'cura', cures:['maldição','confusão']},
  // GDD §15: Buffs (1 buff ativo)
  buffForca:    {name:'Poção Força',    heal:0, price:100, type:'buff', buffId:'forca',    buffEffect:{atkMul:1.20}, dur:60},
  buffVel:      {name:'Poção Velocidade',heal:0,price:100, type:'buff', buffId:'velBuff',  buffEffect:{spdMul:1.30}, dur:60},
  buffProtecao: {name:'Poção Proteção', heal:0, price:100, type:'buff', buffId:'protecao', buffEffect:{defMul:1.25}, dur:60},
  buffSorte:    {name:'Poção Sorte',    heal:0, price:150, type:'buff', buffId:'sorte',    buffEffect:{dropMul:1.50}, dur:60},
  buffFuria:    {name:'Poção Fúria',    heal:0, price:120, type:'buff', buffId:'furia',    buffEffect:{atkMul:1.15, spdAtkMul:1.15, defMul:0.90}, dur:45},
  // GDD §15: Consumíveis especiais
  pergaminhoRetorno: {name:'Pergaminho Retorno', heal:0, price:200, type:'special', rarity:'raro', desc:'Teleporta ao andar mais próximo com NPC abaixo do atual'},
  pedraAlma:         {name:'Pedra da Alma',      heal:0, price:0,   type:'special', rarity:'raro', desc:'Revive com 50% HP. Obtida em baús secretos. Na morte: "Usar Pedra da Alma?"', reviveHpPct:0.50},
  essenciaConcentrada:{name:'Essência Concentrada',heal:0,price:0,  type:'special', rarity:'raro', desc:'+50% barra de essência', minFloor:15, essencePct:0.50},
  cristalReset:      {name:'Cristal Reset',      heal:0, price:300, type:'special', rarity:'muito raro', desc:'Reseta cooldown de 1 skill'},
};

// ============================================================
// SHOP DATA — GDD §17: Selene stock por andar
// ============================================================
function getSeleneStock(floor) {
  const stock = [];
  // Poções sempre disponíveis
  stock.push({item:{...POTIONS.potPeq, id:'potPeq'}, price:30, qty:5});
  stock.push({item:{...POTIONS.antidoto, id:'antidoto'}, price:25, qty:3});
  if (floor >= 2) stock.push({item:{...POTIONS.potMed, id:'potMed'}, price:80, qty:3});

  // GDD §17: Equip por andar — A2=T0, A5(pré-boss)=T0, A5(pós)=T1, A8=T2, A11=T2, A14=T3, A17=T3, A20=T4, A23=T5
  let equipTier = 0;
  if (floor >= 23) equipTier = 5;
  else if (floor >= 20) equipTier = 4;
  else if (floor >= 14) equipTier = 3;
  else if (floor >= 8) equipTier = 2;
  else if (floor >= 5 && bossDefeated[5] && player.classKey) equipTier = 1;
  // GDD §3: Pré-classe = T0 genérico; pós-classe = tier da classe
  for (const slot of ['weapon','body','head','secondary','feet']) {
    stock.push({item: makeEquip(slot, equipTier, 0, player.classKey), price: getEquipPrice(slot, equipTier)});
  }

  // GDD §15: Poções maiores em andares avançados
  if (floor >= 8) stock.push({item:{...POTIONS.potGra, id:'potGra'}, price:180, qty:2});
  if (floor >= 14) stock.push({item:{...POTIONS.aguaBenta, id:'aguaBenta'}, price:40, qty:3});
  if (floor >= 5) stock.push({item:{type:'consumable', id:'potRecurso', name:'Poção Recurso', heal:0, price:50}, price:50, qty:3});

  // GDD §3: Selene vende amuletos (Comum, Incomum, Raro, Épico — NÃO Lendário)
  if (player.classKey) {
    const amuletRarities = ['comum'];
    if (floor >= 8) amuletRarities.push('incomum');
    if (floor >= 14) amuletRarities.push('raro');
    if (floor >= 20) amuletRarities.push('epico');
    for (const r of amuletRarities) {
      stock.push({item: makeAmulet(r, 0, player.classKey), price: AMULET_SELENE_PRICES[r], qty:1});
    }
  }

  return stock;
}

// GDD §17: Preços de equip (T0 = GDD §3 preços individuais, T1+ = GDD §17)
function getEquipPrice(slot, tier) {
  if (tier === 0 && T0_ITEMS[slot]) return T0_ITEMS[slot].price;
  const prices = {
    weapon:    [45,120,300,550,900,1500],
    body:      [50,100,260,480,800,1350],
    head:      [30,90,230,420,750,1250],
    secondary: [35,90,230,420,750,1250],
    feet:      [30,80,200,400,700,1200],
  };
  return (prices[slot] || [45])[tier] || 45;
}

// GDD §3: Bron upgrade costs and chances
const UPGRADE_DATA = [
  {cost:50,  chance:1.0},  // +1
  {cost:150, chance:0.9},  // +2
  {cost:400, chance:0.7},  // +3
  {cost:800, chance:0.5},  // +4
  {cost:1500,chance:0.3},  // +5
];

// ============================================================
// NPC DATA — GDD §11, §12
// ============================================================
const NPC_DEFS = {
  selene: {
    name: 'Selene', color: '#9966cc', w:14, h:22,
    // GDD §12: Capa roxa, olhos dourados
    floors: [2,5,8,11,14,17,20,23],
    role: 'shop',
    greetings: {
      2: ['Você vende suprimentos? Vou precisar de tudo que tiver.'],
      5: ['Você sobreviveu ao Thornax!','Tenho equipamentos novos da sua classe.'],
      _default: ['Quer dar uma olhada? Tenho novidades!']
    },
  },
  lira: {
    name: 'Lira', color: '#6699ff', w:14, h:22,
    // GDD §12: Cavaleira translúcida, armadura rachada, brilho azul
    floors: [2,7,12,17,22],
    role: 'lore',
    greetings: {
      // GDD §12: falas específicas por andar
      2: [
        'Sou Lira. Fui uma cavaleira... há muito tempo.',
        'Essas masmorras são perigosas. Use [I] para ver seu inventário.',
        'Poções podem salvar sua vida. Explore cada sala.',
        'Sinto algo diferente em você... uma energia que não via há muito tempo.'
      ],
      7: ['Aquela energia... está mais forte.','Tome cuidado com ela.'],
      12: ['Essas ruínas... foram construídas pela minha Ordem.','Aqui guardávamos segredos sobre a Essência.','Alguém destruiu tudo.'],
      17: ['A morte do seu pai...','...não foi natural.','Eu sinto a mesma energia sombria aqui.'],
      22: ['Eu falhei aqui, anos atrás.','Mas você... você vai conseguir.','Minha missão agora é sua.'],
      _default: ['Cuidado adiante... eu não consegui passar.']
    },
  },
  bron: {
    name: 'Bron', color: '#cc6633', w:16, h:22,
    // GDD §12: Robusto, avental couro, barba ruiva
    floors: [4,9,14,19,24],
    role: 'upgrade',
    greetings: {
      4: ['Você é ferreiro? Preciso de ajuda com meu equipamento.'],
      _default: ['Hmm. Bom aço.']
    },
  },
  kaelith: {
    name: 'Kaelith', color: '#66cccc', w:14, h:22,
    // GDD §12: Velho cego, cajado cristal. Só aparece pós-boss
    floors: [5,10,15,20],
    role: 'skills',
    requiresBossDefeated: true,
    greetings: {
      5: ['Você pode me ensinar a lutar melhor?'],
      _default: ['O poder flui...']
    },
  },
};

// ============================================================
// STATUS EFFECTS — GDD §5
// ============================================================
const STATUS_DEFS = {
  // GDD §5: 9 efeitos de status
  veneno:       {name:'Veneno',       dur:5, color:'#33cc33', tick:(e,dt)=>{e.hp-=Math.floor(getMaxHp()*0.02*dt);}, icon:'☠'},
  sangramento:  {name:'Sangramento',  dur:4, color:'#cc3333', tick:(e,dt)=>{e.hp-=Math.floor(getMaxHp()*0.015*dt);}, icon:'🩸'},
  maldicao:     {name:'Maldição',     dur:8, color:'#7700aa', icon:'💀'},  // -20% ATK e DEF
  confusao:     {name:'Confusão',     dur:3, color:'#ff66ff', icon:'💫'},  // inverte controles
  queimadura:   {name:'Queimadura',   dur:3, color:'#ff6600', tick:(e,dt)=>{e.hp-=Math.floor(getMaxHp()*0.03*dt);}, icon:'🔥'},
  lentidao:     {name:'Lentidão',     dur:4, color:'#6699cc', icon:'❄'},   // -30% velocidade
  congela:      {name:'Congela',      dur:2, color:'#aaddff', icon:'🧊'},  // imóvel, não ataca. Dano quebra
  imobiliza:    {name:'Imobiliza',    dur:3, color:'#996633', icon:'🕸'},   // preso, pode atacar
  atordoamento: {name:'Atordoamento', dur:1.5, color:'#ffff00', icon:'⭐'}, // imóvel, não ataca
};

// GDD §5: Aplicar status effect no jogador
function applyStatusPlayer(statusId, duration) {
  const def = STATUS_DEFS[statusId];
  if (!def) return;
  // GDD §7: Passiva Inabalável — immune to stun
  if (statusId === 'atordoamento' && hasPassive('inabalavel')) return;
  // GDD §5: Stack — mesmo efeito 2x = reseta timer
  const existing = player.statusEffects.find(s => s.id === statusId);
  if (existing) { existing.timer = duration || def.dur; return; }
  // GDD §5: Máx 3 simultâneos
  if (player.statusEffects.length >= 3) return;
  player.statusEffects.push({id: statusId, timer: duration || def.dur});
}

// GDD §5: Aplicar status effect no inimigo
function applyStatusEnemy(enemy, statusId, duration) {
  const def = STATUS_DEFS[statusId];
  if (!def) return;
  // GDD §5: Bosses imunes a Congela (recebem Lentidão)
  if (statusId === 'congela' && enemy.isBoss) { statusId = 'lentidao'; }
  // GDD §5: Bosses: duração ×0.5 para imobiliza e atordoamento
  let dur = duration || def.dur;
  if (enemy.isBoss && (statusId === 'imobiliza' || statusId === 'atordoamento')) dur *= 0.5;
  const existing = enemy.statusEffects.find(s => s.id === statusId);
  if (existing) { existing.timer = dur; return; }
  if (enemy.statusEffects.length >= 3) return;
  enemy.statusEffects.push({id: statusId, timer: dur});
}

// GDD §5: Update status effects
function updateStatusEffects(entity, dt, isPlayer) {
  for (let i = entity.statusEffects.length - 1; i >= 0; i--) {
    const s = entity.statusEffects[i];
    const def = STATUS_DEFS[s.id];
    s.timer -= dt;
    // DoT
    if (def.tick && isPlayer) {
      const hpBefore = player.hp;
      def.tick(player, dt);
      if (player.hp < hpBefore) {
        player.hp = Math.max(1, player.hp); // DoT não mata direto
      }
    } else if (def.tick && !isPlayer) {
      entity.hp -= Math.floor(entity.maxHp * (s.id === 'veneno' ? 0.02 : s.id === 'queimadura' ? 0.03 : 0.015) * dt);
      if (entity.hp <= 0) killEnemy(entity);
    }
    // GDD §5: Congela — dano recebido quebra o gelo
    // (handled in damageEnemy/damagePlayer)
    if (s.timer <= 0) entity.statusEffects.splice(i, 1);
  }
}

function hasStatus(entity, id) {
  return entity.statusEffects.some(s => s.id === id);
}

// ============================================================
// SKILL DATA — GDD §7: 40 skills (10/classe)
// ============================================================
const SKILLS = {
  // === GUERREIRO (Estamina, base=AtkFis) ===
  golpeBrutal:     {name:'Golpe Brutal',     cls:'guerreiro', num:1, cost:20, cd:3,   dmg:180, type:'melee',  range:1.5, desc:'Golpe poderoso'},
  provocar:        {name:'Provocar',         cls:'guerreiro', num:2, cost:25, cd:12,  dmg:0,   type:'util',   range:3,   desc:'Agro 5s, inimigos 3 tiles focam', dur:5},
  investidaG:      {name:'Investida',        cls:'guerreiro', num:3, cost:30, cd:6,   dmg:150, type:'dash',   range:3,   desc:'Avança 3 tiles, atordoa 1s', status:'atordoamento', statusDur:1},
  gritoGuerra:     {name:'Grito Guerra',     cls:'guerreiro', num:4, cost:35, cd:18,  dmg:0,   type:'buff',   range:0,   desc:'+20% ATK 10s', dur:10, scroll:true},
  esmagar:         {name:'Esmagar',          cls:'guerreiro', num:5, cost:25, cd:5,   dmg:160, type:'melee',  range:1.5, desc:'Ignora 30% DEF', ignDef:0.3, scroll:true},
  bloqueioPerf:    {name:'Bloqueio Perfeito',cls:'guerreiro', num:6, cost:20, cd:10,  dmg:0,   type:'stance', range:0,   desc:'Postura 1.5s, bloqueia 1 ataque + revida 100%', dur:1.5, scroll:true},
  corteGiratorio:  {name:'Corte Giratório',  cls:'guerreiro', num:7, cost:30, cd:7,   dmg:120, type:'aoe',    range:1,   desc:'AoE 1 tile ao redor', scroll:true},
  frenesi:         {name:'Frenesi',          cls:'guerreiro', num:8, cost:25, cd:15,  dmg:0,   type:'buff',   range:0,   desc:'+30% vel ataque 8s', dur:8, scroll:true},
  golpeSismico:    {name:'Golpe Sísmico',    cls:'guerreiro', num:9, cost:35, cd:8,   dmg:200, type:'line',   range:2,   desc:'Linha 2 tiles, atordoa 1.5s', status:'atordoamento', statusDur:1.5, scroll:true},
  muralha:         {name:'Muralha',          cls:'guerreiro', num:10,cost:30, cd:14,  dmg:0,   type:'buff',   range:0,   desc:'+40% DEF 6s, imóvel', dur:6, scroll:true},

  // === MAGO (Mana, base=AtkMag) ===
  bolaFogo:        {name:'Bola Fogo',        cls:'mago', num:1, cost:15, cd:2,   dmg:170, type:'proj',   range:6,   desc:'Projétil 6 tiles, Queimadura 2s', status:'queimadura', statusDur:2, projSpeed:6},
  barreira:        {name:'Barreira',         cls:'mago', num:2, cost:25, cd:14,  dmg:0,   type:'shield', range:0,   desc:'Absorve 30% HP máx 10s', dur:10, absorbPct:30},
  raioCongelante:  {name:'Raio Congelante',  cls:'mago', num:3, cost:30, cd:5,   dmg:140, type:'cone',   range:4,   desc:'Cone 4 tiles, Lentidão 3s', status:'lentidao', statusDur:3},
  meteoro:         {name:'Meteoro',          cls:'mago', num:4, cost:50, cd:20,  dmg:250, type:'area',   range:3,   desc:'Área 3×3, delay 1s', delay:1, scroll:true},
  correnteRaios:   {name:'Corrente Raios',   cls:'mago', num:5, cost:20, cd:4,   dmg:130, type:'chain',  range:3,   desc:'Salta 3 inimigos próximos', chainCount:3, scroll:true},
  teletransporte:  {name:'Teletransporte',   cls:'mago', num:6, cost:15, cd:8,   dmg:0,   type:'blink',  range:5,   desc:'Move 5 tiles direção cursor', scroll:true},
  drenarVida:      {name:'Drenar Vida',      cls:'mago', num:7, cost:20, cd:6,   dmg:120, type:'melee',  range:1.5, desc:'Cura 50% do dano causado', lifesteal:0.5, scroll:true},
  novaGelo:        {name:'Nova Gelo',        cls:'mago', num:8, cost:35, cd:12,  dmg:180, type:'aoe',    range:2,   desc:'AoE circular 2 tiles, congela 2s', status:'congela', statusDur:2, scroll:true},
  familiar:        {name:'Familiar',         cls:'mago', num:9, cost:30, cd:25,  dmg:0,   type:'summon', range:2,   desc:'Orbe 15s, 60% AtkMag a cada 1.5s', dur:15, summonDmg:60, scroll:true},
  escudoEspelhado: {name:'Escudo Espelhado', cls:'mago', num:10,cost:25, cd:16,  dmg:0,   type:'reflect',range:0,   desc:'Reflete 40% dano 5s', dur:5, reflectPct:40, scroll:true},

  // === ARQUEIRO (Foco, base=AtkDist) ===
  flechaPerfurante:{name:'Flecha Perfurante',cls:'arqueiro', num:1, cost:15, cd:3,   dmg:160, type:'proj',   range:8,   desc:'Projétil 8 tiles, atravessa 1', pierce:1, projSpeed:8},
  chuvaFlechas:    {name:'Chuva Flechas',    cls:'arqueiro', num:2, cost:25, cd:10,  dmg:100, type:'area',   range:3,   desc:'Área 3×3, 5 flechas', hits:5},
  armadilha:       {name:'Armadilha',        cls:'arqueiro', num:3, cost:20, cd:8,   dmg:150, type:'trap',   range:0,   desc:'Chão: 150% + Lentidão 3s', status:'lentidao', statusDur:3},
  tiroCerteiro:    {name:'Tiro Certeiro',    cls:'arqueiro', num:4, cost:40, cd:15,  dmg:300, type:'proj',   range:10,  desc:'Projétil 10 tiles, crit garantido', autoCrit:true, projSpeed:10, scroll:true},
  flechaExplosiva: {name:'Flecha Explosiva', cls:'arqueiro', num:5, cost:20, cd:5,   dmg:140, type:'proj',   range:6,   desc:'Projétil 6 tiles, explosão 2 tiles', explode:2, projSpeed:7, scroll:true},
  rolamento:       {name:'Rolamento',        cls:'arqueiro', num:6, cost:0,  cd:4,   dmg:0,   type:'dodge',  range:3,   desc:'Esquiva 3 tiles, invulnerável', scroll:true},
  flechaVeneno:    {name:'Flecha Veneno',    cls:'arqueiro', num:7, cost:15, cd:6,   dmg:130, type:'proj',   range:7,   desc:'Projétil 7 tiles, Veneno 5s', status:'veneno', statusDur:5, projSpeed:7, scroll:true},
  sentinela:       {name:'Sentinela',        cls:'arqueiro', num:8, cost:30, cd:22,  dmg:0,   type:'turret', range:5,   desc:'Torreta 12s, 50% AtkDist, máx 1', dur:12, turretDmg:50, scroll:true},
  tiroDuplo:       {name:'Tiro Duplo',       cls:'arqueiro', num:9, cost:20, cd:3,   dmg:120, type:'proj',   range:6,   desc:'2 projéteis 6 tiles', projCount:2, projSpeed:7, scroll:true},
  rede:            {name:'Rede',             cls:'arqueiro', num:10,cost:15, cd:9,   dmg:0,   type:'proj',   range:5,   desc:'Projétil 5 tiles, imobiliza 3s', status:'imobiliza', statusDur:3, projSpeed:6, scroll:true},

  // === ASSASSINO (Energia, base=AtkFis) ===
  golpeFurtivo:    {name:'Golpe Furtivo',    cls:'assassino', num:1, cost:20, cd:5,   dmg:220, type:'melee',  range:1.5, desc:'+50% pelas costas', backBonus:0.5},
  laminaVeneno:    {name:'Lâmina Veneno',    cls:'assassino', num:2, cost:15, cd:8,   dmg:140, type:'melee',  range:1.5, desc:'Veneno 5s', status:'veneno', statusDur:5},
  passosSombrios:  {name:'Passos Sombrios',  cls:'assassino', num:3, cost:30, cd:14,  dmg:0,   type:'invis',  range:0,   desc:'Invisível 4s, próx ataque +80%', dur:4, invisBonus:0.8},
  dancaLaminas:    {name:'Dança Lâminas',    cls:'assassino', num:4, cost:40, cd:12,  dmg:150, type:'multi',  range:1,   desc:'3 golpes rápidos ao redor', hits:3, scroll:true},
  lancarAdaga:     {name:'Lançar Adaga',     cls:'assassino', num:5, cost:10, cd:2,   dmg:130, type:'proj',   range:5,   desc:'Projétil 5 tiles', projSpeed:8, scroll:true},
  esquivaSombria:  {name:'Esquiva Sombria',  cls:'assassino', num:6, cost:15, cd:6,   dmg:0,   type:'dodge',  range:3,   desc:'Dash 3 tiles, invulnerável', scroll:true},
  corteHemor:      {name:'Corte Hemorrágico',cls:'assassino', num:7, cost:20, cd:5,   dmg:160, type:'melee',  range:1.5, desc:'Sangramento 4s', status:'sangramento', statusDur:4, scroll:true},
  emboscada:       {name:'Emboscada',        cls:'assassino', num:8, cost:25, cd:10,  dmg:200, type:'teleport',range:5,  desc:'Teleporta atrás, +30% dano', tpBonus:0.3, scroll:true},
  fumaca:          {name:'Fumaça',           cls:'assassino', num:9, cost:25, cd:16,  dmg:0,   type:'aoe',    range:2,   desc:'AoE 2 tiles, inimigos perdem alvo 4s', dur:4, smoke:true, scroll:true},
  execucao:        {name:'Execução',         cls:'assassino', num:10,cost:35, cd:18,  dmg:250, type:'melee',  range:1.5, desc:'+100% se alvo <30% HP', executePct:0.3, scroll:true},
};

// GDD §7: Passivas por classe (desbloqueio por level: 10, 20, 30, 40, 50)
const PASSIVES = {
  guerreiro: [
    {id:'peleFerro',     lvl:10, name:'Pele Ferro',           desc:'-10% dano recebido'},
    {id:'contraAtaque',  lvl:20, name:'Contra-Ataque',        desc:'15% chance revida 100% AtkFis'},
    {id:'regenBatalha',  lvl:30, name:'Regen Batalha',        desc:'Cura 1% HP por acerto'},
    {id:'inabalavel',    lvl:40, name:'Inabalável',           desc:'Imune a atordoamento'},
    {id:'vontadeInqueb', lvl:50, name:'Vontade Inquebrável',  desc:'Revive 30% HP, 1x/andar', ult:true},
  ],
  mago: [
    {id:'menteAfiada',    lvl:10, name:'Mente Afiada',        desc:'+10% dano skills'},
    {id:'meditacao',      lvl:20, name:'Meditação',           desc:'+20% regen mana'},
    {id:'maestria',       lvl:30, name:'Maestria Elemental',  desc:'+15% dano elemental'},
    {id:'canalizacao',    lvl:40, name:'Canalização',         desc:'Não interrompe ao tomar dano'},
    {id:'transcendencia', lvl:50, name:'Transcendência',      desc:'Skills custam HP em vez de Mana 8s', ult:true},
  ],
  arqueiro: [
    {id:'olhoAguia',      lvl:10, name:'Olho Águia',          desc:'+15% alcance projéteis'},
    {id:'rastreador',     lvl:20, name:'Rastreador',          desc:'Minimap marca inimigos'},
    {id:'tiroCritico',    lvl:30, name:'Tiro Crítico',        desc:'+20% chance crit'},
    {id:'posicaoFirme',   lvl:40, name:'Posição Firme',       desc:'+40% dano parado'},
    {id:'chuvaInfinita',  lvl:50, name:'Chuva Infinita',      desc:'3 flechas auto-aim/0.5s por 6s', ult:true},
  ],
  assassino: [
    {id:'agilidadeFelina',lvl:10, name:'Agilidade Felina',    desc:'+15% velocidade'},
    {id:'venenoNatural',  lvl:20, name:'Veneno Natural',      desc:'10% chance Veneno 5s ataque básico'},
    {id:'evasao',         lvl:30, name:'Evasão',              desc:'+20% esquiva'},
    {id:'sedeSangue',     lvl:40, name:'Sede Sangue',         desc:'Kill = cura 15% HP'},
    {id:'marcaMorte',     lvl:50, name:'Marca Morte',         desc:'Ataques pelas costas ×2.5', ult:true},
  ],
};

// GDD §8: Essência — skills universais
const ESSENCIA_SKILLS = [
  {id:'pulso',     name:'Pulso',            cost:100, cd:30, dmg:200, type:'aoe', range:3, desc:'AoE 3 tiles, knockback 2', unlockFloor:8},
  {id:'escudo',    name:'Escudo Essência',  cost:50,  cd:20, dmg:0,   type:'shield', desc:'Absorve 50% HP 8s, imune status', dur:8, unlockFloor:13},
  {id:'despertarP',name:'Despertar Parcial',cost:100, cd:45, dmg:0,   type:'buff', desc:'+30% stats 12s', dur:12, unlockFloor:18},
  {id:'laminaLuz', name:'Lâmina Luz',       cost:75,  cd:25, dmg:350, type:'proj', range:8, desc:'Projétil atravessa todos', projSpeed:9, unlockFloor:23},
  {id:'despertarT',name:'Despertar Total',  cost:200, cd:60, dmg:0,   type:'buff', desc:'+50% stats 15s, regen 3%HP/s', dur:15, unlockFloor:25},
];

// GDD §8: Essência bar progression
const ESSENCIA_PROGRESSION = {
  3: 'bar',       // barra aparece
  5: 'label',     // "???"
  8: 'pulso',     // skill Pulso
  10: 'name',     // "Essência" + dano recebido enche
  13: 'escudo',   // skill Escudo
  15: 'cap150',   // barra→150%
  18: 'despertarP',// Despertar Parcial
  20: 'cap200',   // barra→200%
  23: 'laminaLuz',// Lâmina Luz
  25: 'despertarT',// Despertar Total + Ultimate
};

// Get class-specific attack value
function getClassAtk() {
  if (!player.classKey) return getAtkFis();
  switch (player.classKey) {
    case 'guerreiro': case 'assassino': return getAtkFis();
    case 'mago': return getAtkMag();
    case 'arqueiro': return getAtkDist();
    default: return getAtkFis();
  }
}

// ============================================================
// ENEMIES — GDD §9
// ============================================================
const ARCHETYPES = {
  enxame:   {hpMul:0.6,  atkMul:0.8,  defMul:0.3, speed:1.3, aggro:4, atkCD:0.8},
  normal:   {hpMul:1.0,  atkMul:1.0,  defMul:0.6, speed:1.0, aggro:5, atkCD:1.2},
  tank:     {hpMul:1.8,  atkMul:0.7,  defMul:1.2, speed:0.6, aggro:3, atkCD:2.0},
  forte:    {hpMul:1.2,  atkMul:1.4,  defMul:0.8, speed:0.9, aggro:6, atkCD:1.0},
  caster:   {hpMul:0.8,  atkMul:1.3,  defMul:0.4, speed:0.8, aggro:7, atkCD:2.0},
  miniboss: {hpMul:3.0,  atkMul:1.5,  defMul:1.0, speed:0.8, aggro:8, atkCD:1.5},
};

// GDD §9: B1 Masmorras Pedra — 10 inimigos regulares
const B1_POOL = [
  {id:'rato',        name:'Rato',            arch:'enxame', color:'#8B7355', w:14, h:12},
  {id:'morcego',     name:'Morcego',         arch:'enxame', color:'#5a3070', w:16, h:12},
  {id:'slime',       name:'Slime',           arch:'tank',   color:'#44bb44', w:16, h:14},
  {id:'aranha',      name:'Aranha',          arch:'enxame', color:'#444444', w:16, h:14, statusOnHit:'veneno', statusChance:0.20},
  {id:'esqSoldado',  name:'Esq. Soldado',    arch:'normal', color:'#aaaaaa', w:14, h:22},
  {id:'goblin',      name:'Goblin',          arch:'normal', color:'#558833', w:14, h:20},
  {id:'gobArqueiro', name:'Goblin Arqueiro', arch:'caster', color:'#557733', w:14, h:20,
    projSpeed:6, projRange:6, projColor:'#8B6914'},
  {id:'kobold',      name:'Kobold',          arch:'normal', color:'#886644', w:12, h:16},
  {id:'lobo',        name:'Lobo Sombrio',    arch:'forte',  color:'#333355', w:18, h:14, statusOnHit:'sangramento', statusChance:0.25},
  {id:'centopeia',   name:'Centopeia',       arch:'tank',   color:'#665533', w:20, h:10, statusOnHit:'veneno', statusChance:0.15},
];

// GDD §9: B2 Catacumbas (A6-10)
const B2_POOL = [
  {id:'zumbi',       name:'Zumbi',           arch:'normal', color:'#556655', w:14, h:22},
  {id:'fantasma',    name:'Fantasma',        arch:'normal', color:'#aabbcc', w:14, h:20},
  {id:'esqArqueiro', name:'Esq. Arqueiro',   arch:'caster', color:'#aaaaaa', w:14, h:22, projSpeed:6, projRange:6, projColor:'#cccccc'},
  {id:'esqGuerreiro',name:'Esq. Guerreiro',  arch:'forte',  color:'#999999', w:16, h:22},
  {id:'necromante',  name:'Necromante',       arch:'caster', color:'#553366', w:14, h:22, projSpeed:4, projRange:5, projColor:'#aa44ff', statusOnHit:'maldicao', statusChance:0.20},
  {id:'golemOsso',   name:'Golem Osso',      arch:'forte',  color:'#ccbb99', w:18, h:24},
  {id:'almaPenada',  name:'Alma Penada',     arch:'caster', color:'#8899cc', w:14, h:20, projSpeed:5, projRange:5, projColor:'#6677cc', statusOnHit:'maldicao', statusChance:0.20},
  {id:'carnicai',    name:'Carniçal',        arch:'forte',  color:'#664433', w:16, h:22, statusOnHit:'sangramento', statusChance:0.25},
  {id:'mumia',       name:'Múmia',           arch:'normal', color:'#ccbb88', w:14, h:22},
  {id:'vampiroMenor',name:'Vampiro Menor',   arch:'normal', color:'#442244', w:14, h:22, statusOnHit:'confusao', statusChance:0.15},
];

// GDD §9: B3 Ruínas Ancestrais (A11-15)
const B3_POOL = [
  {id:'golemPedra',  name:'Golem Pedra',     arch:'tank',   color:'#888877', w:20, h:24, statusOnHit:'lentidao', statusChance:0.20},
  {id:'wisp',        name:'Wisp',            arch:'enxame', color:'#aaccff', w:12, h:12, statusOnHit:'confusao', statusChance:0.20},
  {id:'guardiaoPedra',name:'Guardião Pedra', arch:'forte',  color:'#776655', w:18, h:24},
  {id:'elemental',   name:'Elemental',       arch:'forte', color:'#44aacc', w:16, h:20},
  {id:'cultista',    name:'Cultista',        arch:'normal', color:'#664444', w:14, h:22},
  {id:'gargula',     name:'Gárgula',         arch:'forte', color:'#666677', w:16, h:22},
  {id:'serpente',    name:'Serpente',         arch:'normal', color:'#448844', w:18, h:12, statusOnHit:'veneno', statusChance:0.25},
  {id:'sentinelaMag',name:'Sentinela Mágica',arch:'caster', color:'#5577aa', w:16, h:22, projSpeed:4, projRange:5, projColor:'#4466ff'},
  {id:'mimic',       name:'Mimic',           arch:'tank',   color:'#886633', w:16, h:16, isMimic:true},
  {id:'estatuaViva', name:'Estátua Viva',    arch:'tank',   color:'#999988', w:18, h:24, statusOnHit:'lentidao', statusChance:0.15},
];

// GDD §9: B4 Profundezas Lava (A16-20)
const B4_POOL = [
  {id:'impFogo',     name:'Imp Fogo',        arch:'enxame', color:'#cc4400', w:12, h:16, statusOnHit:'queimadura', statusChance:0.25},
  {id:'demonioMenor',name:'Demônio Menor',   arch:'normal', color:'#882222', w:16, h:22},
  {id:'salamandra',  name:'Salamandra',      arch:'normal', color:'#cc6600', w:18, h:14, statusOnHit:'queimadura', statusChance:0.20},
  {id:'caoInfernal', name:'Cão Infernal',    arch:'normal', color:'#993300', w:16, h:16},
  {id:'elementalLava',name:'Elemental Lava', arch:'caster', color:'#ff4400', w:16, h:20, projSpeed:5, projRange:6, projColor:'#ff6600', statusOnHit:'queimadura', statusChance:0.20},
  {id:'fenixSombria',name:'Fênix Sombria',   arch:'forte',  color:'#ff6600', w:18, h:18, statusOnHit:'queimadura', statusChance:0.20},
  {id:'diaboAlado',  name:'Diabo Alado',     arch:'forte',  color:'#660022', w:18, h:24},
  {id:'forjadorInf', name:'Forjador Infernal',arch:'caster',color:'#aa3300', w:16, h:24, projSpeed:5, projRange:5, projColor:'#ff8800'},
  {id:'sucubo',      name:'Sucubo',          arch:'caster', color:'#992266', w:14, h:22, projSpeed:5, projRange:6, projColor:'#cc44aa', statusOnHit:'veneno', statusChance:0.20},
  {id:'golemMagma',  name:'Golem Magma',     arch:'tank',   color:'#883300', w:20, h:24, statusOnHit:'lentidao', statusChance:0.20},
];

// GDD §9: B5 Fortaleza Demônio (A21-25)
const B5_POOL = [
  {id:'cavalNegroB5',name:'Cavaleiro Negro', arch:'normal', color:'#333344', w:16, h:24},
  {id:'sombra',      name:'Sombra',          arch:'normal', color:'#222233', w:14, h:20},
  {id:'wraith',      name:'Wraith',          arch:'normal', color:'#443366', w:14, h:22},
  {id:'arquidemonio',name:'Arquidemônio',    arch:'forte',  color:'#550022', w:20, h:26},
  {id:'sentinelaT',  name:'Sentinela Trono', arch:'forte',  color:'#444455', w:18, h:26},
  {id:'espectroElite',name:'Espectro Elite', arch:'forte',  color:'#6644aa', w:16, h:22},
  {id:'berserker',   name:'Berserker',       arch:'forte',  color:'#880000', w:18, h:24},
  {id:'bruxaSombras',name:'Bruxa Sombras',   arch:'caster', color:'#553355', w:14, h:22, projSpeed:5, projRange:7, projColor:'#aa44cc', statusOnHit:'maldicao', statusChance:0.25},
  {id:'carrasco',    name:'Carrasco',        arch:'forte',  color:'#442222', w:18, h:26, statusOnHit:'sangramento', statusChance:0.25},
  {id:'arautoTrevas', name:'Arauto das Trevas',arch:'caster',color:'#331144', w:16, h:24, projSpeed:5, projRange:7, projColor:'#7722cc'},
];

// GDD §10: Mini-boss B1 — Aranha Rainha (A3)
const MINIBOSS_B1 = {
  id:'aranhaRainha', name:'Aranha Rainha', arch:'miniboss', color:'#222222',
  w:32, h:32,
  attacks: ['bite','web','summon'],
  summonCD: 15, webCD: 5, biteCD: 2,
};
// GDD §10: Mini-boss B2 — Lich Menor (A8)
const MINIBOSS_B2 = {
  id:'lichMenor', name:'Lich Menor', arch:'miniboss', color:'#553377',
  w:32, h:32,
  attacks: ['shadowRay','summonSkel','boneShield'],
};
// GDD §10: Mini-boss B3 — Golem Arcano (A13)
const MINIBOSS_B3 = {
  id:'golemArcano', name:'Golem Arcano', arch:'miniboss', color:'#887766',
  w:32, h:32,
  attacks: ['seismicPunch','runicPulse','regenerate'],
};
// GDD §10: Mini-boss B4 — Dragão Menor (A18)
const MINIBOSS_B4 = {
  id:'dragaoMenor', name:'Dragão Menor', arch:'miniboss', color:'#cc3300',
  w:32, h:32,
  attacks: ['fireBreath','swoopDash','fireRain'],
};
// GDD §10: Mini-boss B5 — Guarda Real (A23)
const MINIBOSS_B5 = {
  id:'guardaReal', name:'Guarda Real', arch:'miniboss', color:'#444466',
  w:32, h:32,
  attacks: ['swordCombo','shieldCharge','warCry','summonKnights'],
};

// GDD §10: Boss A5 — Thornax
const BOSS_THORNAX = {
  id:'thornax', name:'Thornax', arch:'boss',
  w:48, h:48, color:'#665544',
  hp: 800, atkMul: 1.8, defMul: 1.5, level: 14,
  phase: 1,
};
// GDD §10: Boss A10 — Morvena
const BOSS_MORVENA = {
  id:'morvena', name:'Morvena', arch:'boss',
  w:48, h:48, color:'#553366',
  hp: 2000, atkMul: 1.6, defMul: 1.0, level: 26,
  phase: 1,
};
// GDD §10: Boss A15 — Azaroth
const BOSS_AZAROTH = {
  id:'azaroth', name:'Azaroth', arch:'boss',
  w:48, h:48, color:'#446688',
  hp: 4000, atkMul: 2.0, defMul: 1.2, level: 38,
  phase: 1,
};
// GDD §10: Boss A20 — Ignaroth
const BOSS_IGNAROTH = {
  id:'ignaroth', name:'Ignaroth', arch:'boss',
  w:64, h:64, color:'#aa3300',
  hp: 7000, atkMul: 2.2, defMul: 1.8, level: 50,
  phase: 1,
};
// GDD §10: Boss A25 — Nahgord
const BOSS_NAHGORD = {
  id:'nahgord', name:'Nahgord', arch:'boss',
  w:48, h:64, color:'#330044',
  hp: 10000, atkMul: 2.5, defMul: 1.5, level: 55,
  phase: 1,
};

// GDD §9: Bioma lookup por andar
const BIOME_DATA = {
  B1: {id:'pedra',     name:'Masmorras Pedra', floorColor:'#554433', wallColor:'#332211', wallTop:'#443322', decoColor:'#665544'},
  B2: {id:'catacumbas', name:'Catacumbas',      floorColor:'#445566', wallColor:'#223344', wallTop:'#334455', decoColor:'#556677'},
  B3: {id:'ruinas',    name:'Ruínas Ancestrais',floorColor:'#887755', wallColor:'#665533', wallTop:'#776644', decoColor:'#998866'},
  B4: {id:'lava',      name:'Profundezas Lava', floorColor:'#553322', wallColor:'#331100', wallTop:'#442211', decoColor:'#774422'},
  B5: {id:'fortaleza', name:'Fortaleza Demônio',floorColor:'#332244', wallColor:'#110022', wallTop:'#221133', decoColor:'#443355'},
};
function getBiome(floor) {
  if (floor <= 5)  return BIOME_DATA.B1;
  if (floor <= 10) return BIOME_DATA.B2;
  if (floor <= 15) return BIOME_DATA.B3;
  if (floor <= 20) return BIOME_DATA.B4;
  return BIOME_DATA.B5;
}
// Mini-boss por andar
function getMiniBossDef(floor) {
  if (floor === 3)  return {def: MINIBOSS_B1, level: 6};
  if (floor === 8)  return {def: MINIBOSS_B2, level: 17};
  if (floor === 13) return {def: MINIBOSS_B3, level: 27};
  if (floor === 18) return {def: MINIBOSS_B4, level: 37};
  if (floor === 23) return {def: MINIBOSS_B5, level: 47};
  return null;
}
// Boss por andar
function getBossDef(floor) {
  if (floor === 5)  return BOSS_THORNAX;
  if (floor === 10) return BOSS_MORVENA;
  if (floor === 15) return BOSS_AZAROTH;
  if (floor === 20) return BOSS_IGNAROTH;
  if (floor === 25) return BOSS_NAHGORD;
  return null;
}

// GDD §9: Base stats (level 1): HP=20, ATK=5, DEF=3
const ENEMY_BASE = {hp: 20, atk: 5, def: 3};

// GDD §6: Level dos inimigos = 1 + (andar-1)×2, range +0~1
function getEnemyLevel(floor) {
  const base = 1 + (floor - 1) * 2;
  return Math.max(1, base + randInt(-1, 1)); // GDD §6: range ±1
}

// GDD §9: Scaling por level
function createEnemy(def, level, px, py) {
  const arch = ARCHETYPES[def.arch] || ARCHETYPES.normal;
  const hpScale  = 1 + (level - 1) * 0.18;
  const atkScale = 1 + (level - 1) * 0.15;
  const defScale = 1 + (level - 1) * 0.12;

  // GDD §6: +10% HP/ATK per revisit (cap +50%, 5 revisitas max)
  const visitCount = (player.contadorRevisitasPorAndar || {})[currentFloor] || 1;
  const revisitBonus = Math.min(0.50, (visitCount - 1) * 0.10);

  const maxHp = Math.round(ENEMY_BASE.hp * arch.hpMul * hpScale * (1 + revisitBonus));
  return {
    def, level,
    x: px, y: py,
    hp: maxHp, maxHp,
    atk: Math.round(ENEMY_BASE.atk * arch.atkMul * atkScale * (1 + revisitBonus) * 10) / 10,
    defense: Math.round(ENEMY_BASE.def * arch.defMul * defScale * 10) / 10,
    speed: arch.speed,
    aggroRange: arch.aggro * TILE,
    atkCD: arch.atkCD,
    atkTimer: arch.atkCD * Math.random(),
    contactCD: 0,
    state: 'patrol',
    patrolTarget: null, patrolTimer: 0,
    retreatTimer: 0,
    dir: Math.random() * Math.PI * 2,
    hpShowTimer: 0,
    dead: false, deathTimer: 0,
    isBoss: false, isMiniBoss: false,
    // Mini-boss/Boss specific timers
    specialCD: {},
    summons: [],
    bossPhase: 1,
    telegraphTimer: 0, telegraphType: null, telegraphArea: null,
    statusEffects: [], // GDD §5
    tauntTimer: 0, confusionTimer: 0,
  };
}

// Create boss with fixed stats (GDD §9: Boss HP fixo)
function createBoss(bossDef, px, py) {
  const level = bossDef.level;
  const atkScale = 1 + (level - 1) * 0.15;
  const defScale = 1 + (level - 1) * 0.12;
  const e = {
    def: bossDef, level,
    x: px, y: py,
    hp: bossDef.hp, maxHp: bossDef.hp,
    atk: Math.round(ENEMY_BASE.atk * bossDef.atkMul * atkScale * 10) / 10,
    defense: Math.round(ENEMY_BASE.def * bossDef.defMul * defScale * 10) / 10,
    speed: 0.8,
    aggroRange: 10 * TILE,
    atkCD: 1.5,
    atkTimer: 2, contactCD: 0,
    state: 'chase',
    patrolTarget: null, patrolTimer: 0,
    retreatTimer: 0,
    dir: Math.PI/2,
    hpShowTimer: 999,
    dead: false, deathTimer: 0,
    isBoss: true, isMiniBoss: false,
    specialCD: getBossSpecialCDs(bossDef.id),
    summons: [],
    bossPhase: 1,
    telegraphTimer: 0, telegraphType: null, telegraphArea: null,
    chargeVx: 0, chargeVy: 0, charging: false, chargeTimer: 0,
    blocking: false, blockTimer: 0,
    statusEffects: [], tauntTimer: 0, confusionTimer: 0,
  };
  return e;
}

// GDD §10: CDs específicos por boss
function getBossSpecialCDs(bossId) {
  switch(bossId) {
    case 'thornax': return {heavySlash:0, charge:0, spin:0};
    case 'morvena': return {shadowRay:0, summon:0, shield:0, teleport:0, soulExplosion:0};
    case 'azaroth': return {orbs:0, pillar:0, teleport:0, distortion:0};
    case 'ignaroth': return {hammer:0, slagRain:0, lavaBreath:0, forgeThrow:0};
    case 'nahgord': return {shadowBlades:0, shadowStep:0, chains:0, barrier:0, claws:0, devour:0};
    default: return {};
  }
}

// Create mini-boss (generic for all biomes)
function createMiniBoss(def, level, px, py) {
  const e = createEnemy(def, level, px, py);
  e.isMiniBoss = true;
  e.hpShowTimer = 999;
  e.summons = [];
  e.aggroRange = 8 * TILE;
  // GDD §10: CDs específicos por mini-boss
  if (def.id === 'aranhaRainha') e.specialCD = {bite:0, web:0, summon:0};
  else if (def.id === 'lichMenor') e.specialCD = {shadowRay:0, summonSkel:0, boneShield:0};
  else if (def.id === 'golemArcano') e.specialCD = {seismicPunch:0, runicPulse:0, regenerate:0};
  else if (def.id === 'dragaoMenor') e.specialCD = {fireBreath:0, swoopDash:0, fireRain:0};
  else if (def.id === 'guardaReal') e.specialCD = {swordCombo:0, shieldCharge:0, warCry:0, summonKnights:0};
  else e.specialCD = {};
  // Golem Arcano: flag para regen 1x
  if (def.id === 'golemArcano') e.hasRegenerated = false;
  return e;
}
