'use strict';
// save.js — Save/Load System, Cloud Save, Export/Import

// GDD §22: Serializar equipamento (apenas dados puros)
function serializeEquip(eq) {
  if (!eq) return null;
  if (eq.type === 'ring') return {type:'ring', tier:eq.tier, name:eq.name, upgLevel:eq.upgLevel||0, attr:eq.attr, val:eq.val, effect:eq.effect};
  if (eq.type === 'amulet') return {
    type:'amulet', rarity:eq.rarity, upgLevel:eq.upgLevel||0,
    classKey:eq.classKey, name:eq.name, skillId:eq.skillId, skillName:eq.skillName,
    attr1:eq.attr1, attr2:eq.attr2, baseVal1:eq.baseVal1, baseVal2:eq.baseVal2,
    val1:eq.val1, val2:eq.val2
  };
  return {type:'equip', slot:eq.slot, tier:eq.tier, upgLevel:eq.upgLevel||0, name:eq.name};
}

function deserializeEquip(data) {
  if (!data) return null;
  if (data.type === 'ring') return data;
  if (data.type === 'amulet') return data;
  return makeEquip(data.slot, data.tier, data.upgLevel, player.classKey);
}

// GDD §22: Serializar consumíveis
function serializeConsumables(arr) {
  return arr.map(c => ({id:c.id, qty:c.qty}));
}

function deserializeConsumables(arr) {
  return arr.map(c => {
    const def = POTIONS[c.id];
    if (def) return {...def, id:c.id, qty:c.qty};
    return {id:c.id, qty:c.qty, name:c.id, type:'consumable'};
  }).filter(Boolean);
}

// GDD §22: Serializar inventário (mochila)
function serializeInventory(inv) {
  return inv.map(item => {
    if (!item) return null;
    if (item.type === 'equip') return serializeEquip(item);
    if (item.type === 'ring') return serializeEquip(item);
    if (item.type === 'amulet') return serializeEquip(item);
    if (item.type === 'scroll') return {type:'scroll', id:item.id, name:item.name, qty:item.qty||1};
    if (item.type === 'consumable') return {type:'consumable', id:item.id, qty:item.qty||1};
    return item;
  });
}

function deserializeInventory(arr) {
  return arr.map(item => {
    if (!item) return null;
    if (item.type === 'equip') return deserializeEquip(item);
    if (item.type === 'ring') return item;
    if (item.type === 'amulet') return item;
    if (item.type === 'scroll') return item;
    if (item.type === 'consumable') {
      const def = POTIONS[item.id];
      if (def) return {...def, id:item.id, qty:item.qty, type:'consumable'};
      return item;
    }
    return item;
  });
}

// GDD §22: Construir dados de save completos
function buildSaveData() {
  return {
    version: 1,
    timestamp: Date.now(),
    // Player core
    level: player.level, xp: player.xp, gold: player.gold,
    hp: player.hp,
    FOR: player.FOR, DES: player.DES, INT: player.INT,
    AGI: player.AGI, VIT: player.VIT, SOR: player.SOR,
    // Classe
    classKey: player.classKey,
    classEvolution: player.classEvolution || 0,
    resource: player.resource, resourceMax: player.resourceMax,
    // Equipamento (8 slots)
    equipment: {
      weapon: serializeEquip(player.equipment.weapon),
      body: serializeEquip(player.equipment.body),
      head: serializeEquip(player.equipment.head),
      secondary: serializeEquip(player.equipment.secondary),
      feet: serializeEquip(player.equipment.feet),
      ring1: serializeEquip(player.equipment.ring1),
      ring2: serializeEquip(player.equipment.ring2),
      amulet: serializeEquip(player.equipment.amulet),
    },
    // Inventário e consumíveis
    inventory: serializeInventory(player.inventory),
    consumables: serializeConsumables(player.consumables),
    // Skills
    skills: {...player.skills},
    equippedSkills: player.equippedSkills.map(s => s ? s.id : null),
    skillPoints: player.skillPoints,
    scrollSkills: player.scrollSkills,
    // Passivas
    passives: [...player.passives],
    // Essência
    essencia: player.essencia,
    essenciaMax: player.essenciaMax,
    essenciaStage: player.essenciaStage,
    // Progressão
    currentFloor, maxFloorReached,
    bossDefeated: {...bossDefeated},
    miniBossDefeated: {...miniBossDefeated},
    dialogsSeen: {...player.dialogsSeen},
    // Stats
    deaths: player.deaths,
    enemiesKilled: player.enemiesKilled,
    ouroTotal: player.ouroTotal,
    tempoJogado: player.tempoJogado,
    secretRoomsFound: player.secretRoomsFound || 0,
    // Flags
    tutorialVisto: {...player.tutorialVisto},
    badges: [...player.badges],
    bossDeathTracker: {...(bossDeathTracker || {})},
    // GDD §29: Post-game flag
    gameCompleted: player.gameCompleted || false,
    // Gap #41-44: campos faltantes
    bausAbertos: player.openedChests || {},
    salaSecretaEncontrada: player.salaSecretaEncontrada || [],
    contadorRevisitasPorAndar: player.contadorRevisitasPorAndar || {},
    ultimoTemplate: typeof ultimoTemplate !== 'undefined' ? ultimoTemplate : null,
    runsCompletas: player.runsCompletas || 0,
  };
}

// GDD §22: Restaurar estado do jogo a partir de save
function loadSaveData(data) {
  if (!data || data.version === undefined) return false;
  // Player core
  player.level = data.level || 1;
  player.xp = data.xp || 0;
  player.gold = data.gold || 0;
  player.hp = data.hp || getMaxHp();
  player.FOR = data.FOR || 3; player.DES = data.DES || 3; player.INT = data.INT || 3;
  player.AGI = data.AGI || 3; player.VIT = data.VIT || 3; player.SOR = data.SOR || 3;
  // Classe
  player.classKey = data.classKey || null;
  player.classEvolution = data.classEvolution || 0;
  player.resource = data.resource || 0;
  player.resourceMax = data.resourceMax || 0;
  // Equipamento
  player.equipment = {};
  if (data.equipment) {
    for (const slot of ['weapon','body','head','secondary','feet','ring1','ring2','amulet']) {
      player.equipment[slot] = deserializeEquip(data.equipment[slot]);
    }
  }
  // Inventário e consumíveis
  player.inventory = data.inventory ? deserializeInventory(data.inventory) : [];
  player.consumables = data.consumables ? deserializeConsumables(data.consumables) : [{...POTIONS.potPeq, id:'potPeq', qty:2}];
  // Skills
  player.skills = data.skills || {};
  player.skillPoints = data.skillPoints || 0;
  player.scrollSkills = data.scrollSkills || 0;
  // Restaurar equippedSkills — são IDs (strings), validar que existem em SKILLS
  player.equippedSkills = (data.equippedSkills || [null,null,null,null,null]).map(id => {
    if (!id) return null;
    return SKILLS[id] ? id : null;
  });
  // Passivas
  player.passives = data.passives || [];
  // Essência
  player.essencia = data.essencia || 0;
  player.essenciaMax = data.essenciaMax || 100;
  // Backward compat: old saves have essenciaRevealed (boolean), convert to stage
  if (data.essenciaStage !== undefined) {
    player.essenciaStage = data.essenciaStage;
  } else if (data.essenciaRevealed) {
    player.essenciaStage = getEssenciaStage(data.maxFloorReached || 1);
  } else {
    player.essenciaStage = 0;
  }
  // Progressão
  currentFloor = data.currentFloor || 1;
  maxFloorReached = data.maxFloorReached || 1;
  bossDefeated = data.bossDefeated || {};
  miniBossDefeated = data.miniBossDefeated || {};
  player.dialogsSeen = data.dialogsSeen || {};
  // Stats
  player.deaths = data.deaths || 0;
  player.enemiesKilled = data.enemiesKilled || 0;
  player.ouroTotal = data.ouroTotal || 0;
  player.tempoJogado = data.tempoJogado || 0;
  player.secretRoomsFound = data.secretRoomsFound || 0;
  // Flags
  player.tutorialVisto = data.tutorialVisto || {};
  player.badges = data.badges || [];
  bossDeathTracker = data.bossDeathTracker || {};
  // GDD §29: Post-game flag
  player.gameCompleted = data.gameCompleted || false;
  // Gap #41-44: campos faltantes
  player.openedChests = data.bausAbertos || {};
  player.salaSecretaEncontrada = data.salaSecretaEncontrada || [];
  player.contadorRevisitasPorAndar = data.contadorRevisitasPorAndar || {};
  if (typeof ultimoTemplate !== 'undefined') ultimoTemplate = data.ultimoTemplate || null;
  player.runsCompletas = data.runsCompletas || 0;
  // Reset combat state
  player.dead = false; player.deathTimer = 0;
  player.attackTimer = 0; player.attackAnim = 0;
  player.iframeTimer = 0; player.kbTimer = 0;
  player.statusEffects = [];
  player.buffs = [];
  player.invisible = false; player.invisTimer = 0;
  player.perfectBlock = false; player.perfectBlockTimer = 0;
  player.familiar = null; player.sentinels = [];
  player.reflectTimer = 0; player.barrier = 0; player.barrierTimer = 0;
  player.essenciaShield = 0; player.essenciaShieldTimer = 0;
  player.vontadeUsed = false;
  player.skillCooldowns = {};
  return true;
}

// === CAMADA 2: localStorage ===
const SAVE_KEY = 'shadowOfDroghan_saves';

function saveToLocal(slot) {
  try {
    const all = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    all[slot] = buildSaveData();
    localStorage.setItem(SAVE_KEY, JSON.stringify(all));
    return true;
  } catch(e) { console.error('[Save] localStorage error:', e); return false; }
}

function loadFromLocal(slot) {
  try {
    const all = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    return all[slot] || null;
  } catch(e) { console.error('[Save] localStorage read error:', e); return null; }
}

function deleteLocalSave(slot) {
  try {
    const all = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    delete all[slot];
    localStorage.setItem(SAVE_KEY, JSON.stringify(all));
  } catch(e) {}
}

function getAllLocalSaves() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
  } catch(e) { return {}; }
}

// GDD §22: Autosave — a cada 60s, trocar andar, boss, NPC, pausar
function autoSave() {
  if (gameState === 'mainMenu' || gameState === 'slotSelect') return;
  saveToLocal(currentSaveSlot);
  // Nuvem: salvar async se logado
  saveToCloud(currentSaveSlot);
}

// GDD §22: Trigger save em momentos específicos
function triggerSave() {
  saveToLocal(currentSaveSlot);
  saveToCloud(currentSaveSlot);
}

// === CAMADA 3: Export/Import base64 ===
function exportSaveBase64(slot) {
  const data = buildSaveData();
  try {
    const json = JSON.stringify(data);
    return btoa(unescape(encodeURIComponent(json)));
  } catch(e) { console.error('[Save] export error:', e); return null; }
}

function importSaveBase64(base64str) {
  try {
    const json = decodeURIComponent(escape(atob(base64str.trim())));
    const data = JSON.parse(json);
    if (data.version === undefined) return null;
    return data;
  } catch(e) { console.error('[Save] import error:', e); return null; }
}

// === CAMADA 1: Supabase (nuvem) ===
// Usa window._supabase e window._getCurrentUser expostos pelo index.html
let cloudUser = null;
let cloudReady = false;

async function initCloudSave() {
  try {
    if (!window._supabase) { cloudReady = false; return; }
    const user = window._getCurrentUser ? await window._getCurrentUser() : null;
    if (user) { cloudUser = user; cloudReady = true; }
    else { cloudReady = false; }
  } catch(e) { cloudReady = false; }
}

async function saveToCloud(slot) {
  if (!cloudReady || !cloudUser) return false;
  try {
    const data = buildSaveData();
    const { error } = await window._supabase.from('shadow_saves').upsert({
      user_id: cloudUser.id,
      slot: slot,
      save_data: data,
      andar_atual: data.currentFloor,
      nivel: data.level,
      classe: data.classKey || 'nenhuma',
      tempo_jogado: Math.floor(data.tempoJogado),
      updated_at: new Date().toISOString(),
    }, {onConflict: 'user_id,slot'});
    if (error) console.error('[Save] cloud error:', error);
    return !error;
  } catch(e) { console.error('[Save] cloud error:', e); return false; }
}

async function loadFromCloud(slot) {
  if (!cloudReady || !cloudUser) return null;
  try {
    const { data, error } = await window._supabase
      .from('shadow_saves')
      .select('save_data')
      .eq('user_id', cloudUser.id)
      .eq('slot', slot)
      .single();
    if (error || !data) return null;
    return data.save_data;
  } catch(e) { return null; }
}

async function getAllCloudSaves() {
  if (!cloudReady || !cloudUser) return {};
  try {
    const { data, error } = await window._supabase
      .from('shadow_saves')
      .select('slot, save_data, updated_at')
      .eq('user_id', cloudUser.id);
    if (error || !data) return {};
    const result = {};
    for (const row of data) result[row.slot] = row.save_data;
    return result;
  } catch(e) { return {}; }
}

async function deleteCloudSave(slot) {
  if (!cloudReady || !cloudUser) return;
  try {
    await window._supabase.from('shadow_saves')
      .delete().eq('user_id', cloudUser.id).eq('slot', slot);
  } catch(e) {}
}

// ============================================================
// GDD §21: LEADERBOARD — shadow_leaderboard
// ============================================================
async function submitToLeaderboard() {
  if (!window._supabase) return false;
  try {
    const user = window._getCurrentUser ? await window._getCurrentUser() : null;
    if (!user) return false;
    const { error } = await window._supabase.from('shadow_leaderboard').upsert({
      user_id: user.id,
      nome: user.user_metadata?.name || user.email || 'Anônimo',
      mortes: player.deaths,
      tempo_total: Math.floor(player.tempoJogado),
      ouro_total: player.ouroTotal,
      inimigos_mortos: player.enemiesKilled,
      andar_max: maxFloorReached,
      runs_completas: player.runsCompletas || 0,
      badges: [...player.badges],
      updated_at: new Date().toISOString(),
    }, {onConflict: 'user_id'});
    if (error) console.error('[Leaderboard] submit error:', error);
    return !error;
  } catch(e) { console.error('[Leaderboard] error:', e); return false; }
}

async function getLeaderboard(limit = 20) {
  if (!window._supabase) return [];
  try {
    const { data, error } = await window._supabase
      .from('shadow_leaderboard')
      .select('nome, mortes, tempo_total, ouro_total, inimigos_mortos, andar_max, runs_completas, badges')
      .order('runs_completas', {ascending: false})
      .order('mortes', {ascending: true})
      .order('tempo_total', {ascending: true})
      .limit(limit);
    if (error) { console.error('[Leaderboard] fetch error:', error); return []; }
    return data || [];
  } catch(e) { console.error('[Leaderboard] error:', e); return []; }
}

// GDD §22: Resolver conflito nuvem vs local
async function resolveSaveConflict(slot) {
  const local = loadFromLocal(slot);
  const cloud = await loadFromCloud(slot);
  if (!local && !cloud) return null;
  if (!cloud) return local;
  if (!local) return cloud;
  // Ambos existem — retorna o mais recente
  if (cloud.timestamp > local.timestamp) return cloud;
  return local;
}
