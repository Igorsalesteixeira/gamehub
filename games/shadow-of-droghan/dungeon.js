'use strict';
// dungeon.js — Map Generation, Fog of War, Camera, Hazards

// ============================================================
// MAP/TILE CONSTANTS
// ============================================================
const TILE_WALL = 0;
const TILE_FLOOR = 1;
const TILE_STAIRS_DOWN = 2;
const TILE_STAIRS_UP = 3;
const TILE_BOSS_DOOR = 4; // GDD §10: porta tranca ao entrar sala do boss
const TILE_PUZZLE = 5;   // GDD §18 Gap#28: tile puzzle para sala secreta

// GDD §18 Gap#28: Secret room puzzles per floor
const SECRET_PUZZLES = {
  3:  {type:'attackWall',  hint:'Uma rachadura na parede...'},
  6:  {type:'interact',    hint:'Uma tocha apagada...'},
  9:  {type:'standStill',  hint:'Um símbolo no chão...', duration:2},
  12: {type:'interact',    hint:'Uma tapeçaria estranha...'},
  15: {type:'attackWall',  hint:'Uma estátua com olhos brilhantes...'},
  18: {type:'useSkill',    hint:'Uma poça de lava diferente...'},
  21: {type:'interact',    hint:'Uma corrente pendurada...'},
  24: {type:'attackWall',  hint:'Um estandarte de Nahgord...'}
};

// ============================================================
// MAP STATE
// ============================================================
let dungeon = null;
let dungeonW = 60, dungeonH = 60;
let rooms = [];
let goldPickups = [];
let itemDrops = []; // itens no chão (equip, poções)
let chests = [];
let stairsDown = null;
let stairsUp = null;
let decorations = [];
let npcs = [];     // NPCs no andar atual
let hazards = [];  // GDD §18: Perigos ambientais por bioma
let enemies = [];
let enemyProjectiles = [];
let bossRoom = null; // ref para sala do boss
let bossRoomLocked = false;
let ultimoTemplate = null; // GDD §18 Gap#5: never repeat same template 2x in a row

// GDD §18 Gap#5: Templates per biome
const BIOME_TEMPLATES = {
  pedra:     ['radial','linear','labirinto','espiral'],
  catacumbas:['caverna','labirinto','assimetrico','espiral'],
  ruinas:    ['linear','radial','ilhas','labirinto'],
  lava:      ['ilhas','caverna','assimetrico','espiral'],
  fortaleza: ['fortaleza','fortaleza','radial','labirinto','linear'], // fortaleza 40%
};
const BOSS_TEMPLATE = 'linear'; // Boss floors always Linear

// ============================================================
// MAP FUNCTIONS
// ============================================================
function getTile(x, y) {
  if (x < 0 || y < 0 || x >= dungeonW || y >= dungeonH) return TILE_WALL;
  return dungeon[y * dungeonW + x];
}
function setTile(x, y, v) {
  if (x >= 1 && y >= 1 && x < dungeonW-1 && y < dungeonH-1)
    dungeon[y * dungeonW + x] = v;
}

function generateDungeon(floor) {
  // GDD Gap#31: Track opened chests across visits
  if (!player.openedChests) player.openedChests = {};

  const size = FLOOR_SIZES[Math.min(floor - 1, 24)];
  dungeonW = size; dungeonH = size;
  dungeon = new Uint8Array(dungeonW * dungeonH);
  rooms = []; enemies = []; enemyProjectiles = [];
  goldPickups = []; itemDrops = []; chests = []; decorations = [];
  stairsDown = null; stairsUp = null; npcs = [];
  bossRoom = null; bossRoomLocked = false;

  const cx = Math.floor(dungeonW / 2);
  const cy = Math.floor(dungeonH / 2);

  // GDD §18 Gap#5: Select template per biome (never repeat 2x in a row)
  const isBossFloorTemplate = [5,10,15,20,25].includes(floor);
  let template;
  if (isBossFloorTemplate) {
    template = BOSS_TEMPLATE;
  } else {
    const biomeId = getBiome(floor).id;
    const pool = BIOME_TEMPLATES[biomeId] || ['radial'];
    let candidates = pool.filter(t => t !== ultimoTemplate);
    if (candidates.length === 0) candidates = pool;
    template = candidates[randInt(0, candidates.length - 1)];
  }
  ultimoTemplate = template;

  // Dispatch to template generator
  let hubCx, hubCy;
  switch (template) {
    case 'radial':    ({hubCx, hubCy} = genTemplateRadial(cx, cy, size)); break;
    case 'linear':    ({hubCx, hubCy} = genTemplateLinear(cx, cy, size)); break;
    case 'labirinto': ({hubCx, hubCy} = genTemplateLabirinto(cx, cy, size)); break;
    case 'caverna':   ({hubCx, hubCy} = genTemplateCaverna(cx, cy, size)); break;
    case 'espiral':   ({hubCx, hubCy} = genTemplateEspiral(cx, cy, size)); break;
    case 'ilhas':     ({hubCx, hubCy} = genTemplateIlhas(cx, cy, size)); break;
    case 'assimetrico': ({hubCx, hubCy} = genTemplateAssimetrico(cx, cy, size)); break;
    case 'fortaleza': ({hubCx, hubCy} = genTemplateFortaleza(cx, cy, size)); break;
    default:          ({hubCx, hubCy} = genTemplateRadial(cx, cy, size)); break;
  }

  // === BOSS ROOM (GDD §10: andares 5,10,15,20,25) ===
  const isBossFloor = [5,10,15,20,25].includes(floor);
  // === MINI-BOSS (GDD §6: andares 3,8,13,18,23) ===
  const isMiniBossFloor = [3,8,13,18,23].includes(floor);

  // Escadas (GDD §18)
  if (floor < MAX_FLOOR) {
    let farthest = null, fDist = 0;
    for (let i = 1; i < rooms.length; i++) {
      if (rooms[i].isNPC || rooms[i].isBoss) continue;
      const d = distXY(rooms[i].cx, rooms[i].cy, hubCx, hubCy);
      if (d > fDist) { fDist = d; farthest = rooms[i]; }
    }
    if (farthest) {
      if (isBossFloor) {
        // GDD §18: Boss room = sala da escada descer, escada aparece APÓS boss
        bossRoom = farthest;
        farthest.isBoss = true;
        // Escada descer guardada mas não colocada até boss morrer
        stairsDown = {x: farthest.cx, y: farthest.cy, placed: false};
      } else {
        setTile(farthest.cx, farthest.cy, TILE_STAIRS_DOWN);
        stairsDown = {x: farthest.cx, y: farthest.cy, placed: true};
      }
    }
  }
  // Escada subir = hub (A1 não tem)
  if (floor > 1) {
    setTile(hubCx + 1, hubCy, TILE_STAIRS_UP);
    stairsUp = {x: hubCx + 1, y: hubCy};
  }

  // === SPAWN BOSS ===
  if (isBossFloor && bossRoom && !bossDefeated[floor]) {
    const bossDef = getBossDef(floor);
    if (bossDef) {
      const boss = createBoss(bossDef, bossRoom.cx * TILE + TILE/2, bossRoom.cy * TILE + TILE/2);
      enemies.push(boss);
    }
  } else if (isBossFloor && bossDefeated[floor] && stairsDown) {
    // Boss já derrotado, colocar escada
    setTile(stairsDown.x, stairsDown.y, TILE_STAIRS_DOWN);
    stairsDown.placed = true;
  }

  // === SPAWN MINI-BOSS (GDD §18: maior sala do andar) ===
  if (isMiniBossFloor && !miniBossDefeated[floor]) {
    let largestRoom = null, largestArea = 0;
    for (let i = 1; i < rooms.length; i++) {
      if (rooms[i].isBoss || rooms[i].isNPC) continue;
      const area = rooms[i].w * rooms[i].h;
      if (area > largestArea) { largestArea = area; largestRoom = rooms[i]; }
    }
    const mbData = getMiniBossDef(floor);
    if (largestRoom && mbData) {
      const mb = createMiniBoss(mbData.def, mbData.level, largestRoom.cx * TILE + TILE/2, largestRoom.cy * TILE + TILE/2);
      enemies.push(mb);
      largestRoom.isMiniBoss = true;
      // GDD §10: Guarda Real começa com 3 Cavaleiros Negros na sala
      if (mbData.def.id === 'guardaReal') {
        for (let ki = 0; ki < 3; ki++) {
          const ka = (Math.PI*2/3) * ki;
          const kx = mb.x + Math.cos(ka) * TILE * 2;
          const ky = mb.y + Math.sin(ka) * TILE * 2;
          const knight = createEnemy(B5_POOL[0], getEnemyLevel(floor), kx, ky); // Cavaleiro Negro
          knight.summoner = mb;
          knight.summoned = true;
          enemies.push(knight);
        }
      }
    }
  }

  // === SPAWN NPCs (GDD §12) ===
  spawnNPCs(floor, hubCx, hubCy);

  // === SPAWN REGULAR ENEMIES ===
  for (let i = 1; i < rooms.length; i++) {
    if (rooms[i].isNPC || rooms[i].isBoss || rooms[i].isMiniBoss) continue;
    spawnEnemiesInRoom(rooms[i], floor);
  }

  // GDD §18: Baús (2-4 por andar)
  const numChests = randInt(2, 4);
  for (let c = 0; c < numChests; c++) {
    if (rooms.length < 2) break;
    const room = rooms[1 + randInt(0, rooms.length - 2)];
    if (room.isNPC || room.isBoss) continue;
    const chX = room.x + 1 + randInt(0, Math.max(0, room.w - 3));
    const chY = room.y + 1 + randInt(0, Math.max(0, room.h - 3));
    if (getTile(chX, chY) === TILE_FLOOR) {
      const chestId = 'f' + floor + '_' + chX + '_' + chY;
      if (player.openedChests[chestId]) continue; // Gap#31: skip opened
      chests.push({x: chX, y: chY, opened: false, isMimic: false, chestId});
    }
  }

  // GDD §9: Mimic — 0-1 por andar B3 (andares 11-15, não boss). Disfarçado de baú.
  if (getBiome(floor).id === 'ruinas' && floor % 5 !== 0 && Math.random() < 0.6) {
    // Pega um baú existente e transforma em mimic, ou cria um novo
    if (chests.length > 0 && Math.random() < 0.5) {
      chests[randInt(0, chests.length-1)].isMimic = true;
    } else {
      const room = rooms[1 + randInt(0, Math.max(0, rooms.length - 2))];
      if (room && !room.isNPC && !room.isBoss) {
        const mx = room.x + 1 + randInt(0, Math.max(0, room.w - 3));
        const my = room.y + 1 + randInt(0, Math.max(0, room.h - 3));
        if (getTile(mx, my) === TILE_FLOOR) {
          chests.push({x: mx, y: my, opened: false, isMimic: true});
        }
      }
    }
  }

  // === GDD §18: TRAP ROOMS (1/andar A3+, pista visual: marcas no chão) ===
  if (floor >= 3) {
    let trapRoom = null;
    for (let i = 1; i < rooms.length; i++) {
      if (!rooms[i].isNPC && !rooms[i].isBoss && !rooms[i].isMiniBoss && !rooms[i].isSecret && !rooms[i].isHorde) {
        trapRoom = rooms[i];
        break;
      }
    }
    if (trapRoom) {
      trapRoom.isTrap = true;
      trapRoom.trapState = 'idle';     // idle | active | cleared
      trapRoom.trapTimer = 0;
      trapRoom.trapDuration = randInt(10, 15); // 10-15s sobreviver
      // Recompensa: baú com ouro x2 + 1 poção garantida
      trapRoom.trapReward = false;
    }
  }

  // === GDD §18: SECRET ROOMS (andares 3,6,9,12,15,18,21,24) ===
  const secretFloors = [3,6,9,12,15,18,21,24];
  if (secretFloors.includes(floor)) {
    // Criar sala secreta extra (pequena, escondida)
    const secretW = randInt(4, 6), secretH = randInt(4, 6);
    let placed = false;
    for (let attempt = 0; attempt < 20 && !placed; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const d = randInt(Math.floor(size * 0.3), Math.floor(size * 0.45));
      let sx = cx + Math.round(Math.cos(angle) * d) - Math.floor(secretW/2);
      let sy = cy + Math.round(Math.sin(angle) * d) - Math.floor(secretH/2);
      sx = clamp(sx, 2, dungeonW - secretW - 2);
      sy = clamp(sy, 2, dungeonH - secretH - 2);

      let overlap = false;
      for (const r of rooms) {
        if (sx < r.x+r.w+2 && sx+secretW+2 > r.x && sy < r.y+r.h+2 && sy+secretH+2 > r.y) {
          overlap = true; break;
        }
      }
      if (overlap) continue;

      carveRoom(sx, sy, secretW, secretH, false);
      const secretRoom = rooms[rooms.length - 1];
      secretRoom.isSecret = true;

      // GDD §18 Gap#28: Secret room puzzle — corridor blocked until puzzle solved
      const puzzle = SECRET_PUZZLES[floor];
      // Find nearest room for corridor
      let nearest = null, nDist = Infinity;
      for (let i = 0; i < rooms.length - 1; i++) {
        const d2 = distXY(rooms[i].cx, rooms[i].cy, secretRoom.cx, secretRoom.cy);
        if (d2 < nDist) { nDist = d2; nearest = rooms[i]; }
      }

      if (puzzle && nearest) {
        // Carve corridor but place a puzzle tile that blocks entry
        carveCorridor(secretRoom.cx, secretRoom.cy, nearest.cx, nearest.cy);

        // Find a tile on the corridor near the nearest room to place puzzle
        // Walk from nearest room toward secret room, find first corridor tile
        const dirX = secretRoom.cx > nearest.cx ? 1 : (secretRoom.cx < nearest.cx ? -1 : 0);
        const dirY = secretRoom.cy > nearest.cy ? 1 : (secretRoom.cy < nearest.cy ? -1 : 0);
        let puzzleX = nearest.cx + dirX * 2;
        let puzzleY = nearest.cy + dirY * 2;
        puzzleX = clamp(puzzleX, 2, dungeonW - 3);
        puzzleY = clamp(puzzleY, 2, dungeonH - 3);

        // Place wall blocks to seal the secret room entrance
        secretRoom.puzzleTile = {x: puzzleX, y: puzzleY};
        secretRoom.puzzleDef = puzzle;
        secretRoom.puzzleSolved = false;

        // Block entrance: place wall at the puzzle tile position
        // The puzzle tile is a special marker on the wall adjacent to the corridor
        setTile(puzzleX, puzzleY, TILE_WALL);
        // Mark it as puzzle tile for rendering
        secretRoom.blockedTiles = [{x: puzzleX, y: puzzleY}];

        // Place puzzle decoration for visual hint
        decorations.push({
          type: 'puzzle', x: puzzleX, y: puzzleY,
          hint: puzzle.hint, puzzleType: puzzle.type,
          floor: floor, solved: false
        });
      } else if (nearest) {
        carveCorridor(secretRoom.cx, secretRoom.cy, nearest.cx, nearest.cy);
      }

      // GDD §18 Gap#29: Secret room rewards — floor-specific
      // F3,6: Equip T+1 + Poção Gra + 200g | F9,12: Anel Ouro/Rubi + Buff raro + 500g
      // F15,18: Amuleto Raro/Épico + Pedra Alma + 800g | F21,24: Anel Ancestral/Amuleto Lendário + Essência + 1200g
      // (reward logic in gameplay.js openChest — isSecretChest flag triggers floor-specific loot)
      const secretChestId = 'secret_f' + floor;
      if (!player.openedChests[secretChestId]) {
        chests.push({x: secretRoom.cx, y: secretRoom.cy, opened: false, isMimic: false,
          isSecretChest: true, chestId: secretChestId, secretFloor: floor});
      }
      placed = true;
    }
  }

  // === GDD §18: HORDE ROOMS (1/andar A6+) ===
  if (floor >= 6) {
    let hordeRoom = null;
    for (let i = 1; i < rooms.length; i++) {
      if (!rooms[i].isNPC && !rooms[i].isBoss && !rooms[i].isMiniBoss && !rooms[i].isTrap && !rooms[i].isSecret && !rooms[i].isHorde) {
        // Preferir sala grande
        if (rooms[i].w >= 7 && rooms[i].h >= 7) {
          hordeRoom = rooms[i];
          break;
        }
      }
    }
    // Fallback: qualquer sala disponível
    if (!hordeRoom) {
      for (let i = 1; i < rooms.length; i++) {
        if (!rooms[i].isNPC && !rooms[i].isBoss && !rooms[i].isMiniBoss && !rooms[i].isTrap && !rooms[i].isSecret && !rooms[i].isHorde) {
          hordeRoom = rooms[i];
          break;
        }
      }
    }
    if (hordeRoom) {
      hordeRoom.isHorde = true;
      hordeRoom.hordeState = 'idle';     // idle | wave1 | wave2 | wave3 | cleared
      hordeRoom.hordeWave = 0;
      hordeRoom.hordeEnemiesAlive = 0;
      // Recompensa: Ouro x3 + 1 Poção Méd+ garantida + chance Equip (25%)
      hordeRoom.hordeReward = false;
    }
  }

  placeDecorations();
  spawnHazards(floor);

  // Posicionar jogador no hub
  player.x = hubCx * TILE + TILE/2;
  player.y = hubCy * TILE + TILE/2;
}

function spawnNPCs(floor, hubCx, hubCy) {
  // GDD §12: NPCs em salas dedicadas (barreira — inimigos não entram)
  for (const [key, npcDef] of Object.entries(NPC_DEFS)) {
    if (!npcDef.floors.includes(floor)) continue;
    // GDD §12: Kaelith só aparece pós-boss
    if (npcDef.requiresBossDefeated && !bossDefeated[floor]) continue;
    // GDD §12: Lira desaparece permanentemente após A22
    if (key === 'lira' && player.dialogsSeen['liraDesapareceu']) continue;

    // Encontrar sala para NPC (não hub, não boss)
    let npcRoom = null;
    for (let i = 1; i < rooms.length; i++) {
      if (!rooms[i].isNPC && !rooms[i].isBoss && !rooms[i].isMiniBoss) {
        npcRoom = rooms[i];
        rooms[i].isNPC = true;
        break;
      }
    }
    if (!npcRoom) continue;

    npcs.push({
      id: key, def: npcDef,
      x: npcRoom.cx * TILE + TILE/2,
      y: npcRoom.cy * TILE + TILE/2,
      room: npcRoom,
    });
  }
}

// GDD §18: Perigos ambientais por bioma — B1 nenhum
// B2: Espinhos(4-6), Ácido(2-3)
// B3: Runas explosivas(3-5), Cristais energia(3-4)
// B4: Lava(4-6), Geysers(2-3), Chão rachando(3-4)
// B5: Armadilhas sombra(3-5)
function spawnHazards(floor) {
  hazards = [];
  const biome = getBiome(floor).id;
  // GDD §18: B1 = tutorial zone, sem perigos
  if (biome === 'pedra') return;
  // Boss floors = sem perigos extras
  if (floor % 5 === 0) return;

  const hazardDefs = {
    catacumbas: [
      {type:'espinhos', count:[4,6], color:'#888888'},
      {type:'acido', count:[2,3], color:'#66ff33'},
    ],
    ruinas: [
      {type:'runaExplosiva', count:[3,5], color:'#ff6600'},
      {type:'cristalEnergia', count:[3,4], color:'#00ccff'},
    ],
    lava: [
      {type:'lava', count:[4,6], color:'#ff3300'},
      {type:'geyser', count:[2,3], color:'#ff8800'},
      {type:'chaoRachando', count:[3,4], color:'#996633'},
    ],
    fortaleza: [
      {type:'armadilhaSombra', count:[3,5], color:'#330066'},
    ],
  };

  const defs = hazardDefs[biome];
  if (!defs) return;

  for (const hd of defs) {
    const n = randInt(hd.count[0], hd.count[1]);
    for (let i = 0; i < n; i++) {
      // Colocar fora do caminho principal — em salas aleatórias, não hub/NPC/boss
      const room = rooms[1 + randInt(0, Math.max(0, rooms.length - 2))];
      if (!room || room.isNPC || room.isBoss || room.isHub) continue;
      const hx = room.x + 1 + randInt(0, Math.max(0, room.w - 3));
      const hy = room.y + 1 + randInt(0, Math.max(0, room.h - 3));
      if (getTile(hx, hy) !== TILE_FLOOR) continue;
      hazards.push({
        type: hd.type, color: hd.color,
        x: hx, y: hy,
        timer: 0, // geysers, runas, cristais usam timers
        active: hd.type !== 'cristalEnergia', // cristais pulsam (ligam/desligam 3s)
        broken: false, // chão rachando
        revealed: hd.type !== 'armadilhaSombra', // armadilhas sombra invisíveis até 2 tiles
      });
    }
  }
}

// GDD §18: Update hazards
function updateHazards(dt) {
  const px = player.x, py = player.y;
  for (const h of hazards) {
    const hcx = h.x * TILE + TILE/2, hcy = h.y * TILE + TILE/2;
    const dx = px - hcx, dy = py - hcy;
    const dist = Math.sqrt(dx*dx + dy*dy);

    h.timer += dt;

    // Armadilha sombra: revelar quando jogador a 2 tiles
    if (h.type === 'armadilhaSombra') {
      h.revealed = dist < 2 * TILE;
    }

    // GDD §18 Gap#32: Biome-specific trap room hazard updates
    // Wall arrows: fire projectile from wall every interval
    if (h.type === 'wallArrow' && h.room) {
      if (h.timer >= h.interval) {
        h.timer = 0;
        const r = h.room;
        let sx, sy, vx, vy;
        switch(h.side) {
          case 0: sx = r.x + randInt(1, r.w-2); sy = r.y; vx = 0; vy = 1; break;
          case 1: sx = r.x + r.w - 1; sy = r.y + randInt(1, r.h-2); vx = -1; vy = 0; break;
          case 2: sx = r.x + randInt(1, r.w-2); sy = r.y + r.h - 1; vx = 0; vy = -1; break;
          default: sx = r.x; sy = r.y + randInt(1, r.h-2); vx = 1; vy = 0; break;
        }
        enemyProjectiles.push({
          x: sx * TILE + TILE/2, y: sy * TILE + TILE/2,
          vx: vx * TILE * 4, vy: vy * TILE * 4,
          dmg: Math.max(1, Math.floor(getMaxHp() * 0.06)),
          life: 2.0, maxLife: 2.0, color: '#cccccc', size: 4, isTrap: true
        });
      }
    }
    // Rising spikes: activate after delay, then damage
    if (h.type === 'risingSpikes') {
      if (!h.active && h.timer >= h.delay) h.active = true;
    }
    // Sequence runes: activate after delay, then damage
    if (h.type === 'sequenceRune') {
      if (!h.active && h.timer >= h.delay) h.active = true;
    }
    // Rising lava: phases — 0=rising(bordas), 1=receding
    if (h.type === 'risingLava' && h.room) {
      const cycle = h.timer % 6;
      h.phase = cycle < 4 ? 0 : 1; // 4s rising, 2s recede
      // During rising phase, damage near room borders
      if (h.phase === 0) {
        const r = h.room;
        const ptx = Math.floor(px / TILE), pty = Math.floor(py / TILE);
        const borderDist = Math.min(ptx - r.x, r.x + r.w - 1 - ptx, pty - r.y, r.y + r.h - 1 - pty);
        if (borderDist <= 1 && player.iframeTimer <= 0 &&
            ptx >= r.x && ptx < r.x + r.w && pty >= r.y && pty < r.y + r.h) {
          const dmg = Math.max(1, Math.floor(getMaxHp() * 0.07));
          // GDD §20: Track death cause for rising lava hazard
          if (typeof deathCause !== 'undefined') deathCause = 'Lava Ascendente';
          applyPlayerDamage(dmg);
          applyStatusPlayer('queimadura', 2);
          player.iframeTimer = 0.5;
        }
      }
    }
    // Total darkness: reduce fog radius when active (visual effect handled in render)
    if (h.type === 'totalDarkness') {
      h.active = true; // stays active entire duration
    }
    // Shadow trap: same as armadilhaSombra reveal logic
    if (h.type === 'shadowTrap') {
      h.revealed = dist < 2 * TILE;
    }

    // Cristais pulsam: ligam/desligam a cada 3s
    if (h.type === 'cristalEnergia') {
      h.active = Math.floor(h.timer / 3) % 2 === 0;
    }

    // Geysers: erupção a cada 5s, aviso 1s (borbulha)
    if (h.type === 'geyser') {
      const cycle = h.timer % 5;
      h.warning = cycle >= 4; // último 1s = aviso
      h.erupting = cycle >= 4.5 && cycle < 5; // 0.5s erupção
    }

    // Chão rachando: treme ao pisar, cai após 1.5s
    if (h.type === 'chaoRachando' && !h.broken) {
      if (dist < TILE * 0.7) {
        if (!h.stepping) { h.stepping = true; h.stepTimer = 0; }
        h.stepTimer += dt;
        if (h.stepTimer >= 1.5) {
          h.broken = true;
          // Empurra jogador 1 tile + 5% HP
          const angle = Math.atan2(dy, dx);
          player.kbVx = Math.cos(angle) * TILE * 4;
          player.kbVy = Math.sin(angle) * TILE * 4;
          player.kbTimer = 0.15;
          const dmg = Math.floor(getMaxHp() * 0.05);
          // GDD §20: Track death cause for cracking floor hazard
          if (typeof deathCause !== 'undefined') deathCause = 'Chão Rachando';
          applyPlayerDamage(dmg);
        }
      } else {
        h.stepping = false; h.stepTimer = 0;
      }
    }

    // Dano ao jogador
    if (dist < TILE * 0.6 && player.iframeTimer <= 0) {
      let shouldDamage = false;
      let dmgPercent = 0;
      let statusId = null;
      let statusDur = 0;

      switch(h.type) {
        case 'espinhos':
          // -5% HP ao pisar (instantâneo, com i-frame)
          shouldDamage = true; dmgPercent = 0.05;
          break;
        case 'acido':
          // -3% HP + Veneno 3s
          shouldDamage = true; dmgPercent = 0.03;
          statusId = 'veneno'; statusDur = 3;
          break;
        case 'runaExplosiva':
          // Delay: brilham 1s antes, delay 2s ao pisar. Simplificado: instantâneo com i-frame
          // -10% HP área 2 tiles
          shouldDamage = true; dmgPercent = 0.10;
          break;
        case 'cristalEnergia':
          if (!h.active) break; // desligado = sem dano
          // -8% HP ao tocar
          shouldDamage = true; dmgPercent = 0.08;
          break;
        case 'lava':
          // -5% HP/s + Queimadura 3s. Botas T3+ = -50% dano
          shouldDamage = true; dmgPercent = 0.05;
          statusId = 'queimadura'; statusDur = 3;
          // GDD §18: Botas T3+ = -50% dano lava
          if (player.equipment.feet && player.equipment.feet.tier >= 3) dmgPercent *= 0.5;
          break;
        case 'geyser':
          if (!h.erupting) break;
          // -12% HP + knockback 2 tiles
          shouldDamage = true; dmgPercent = 0.12;
          const angle2 = Math.atan2(dy, dx);
          player.kbVx = Math.cos(angle2) * TILE * 6;
          player.kbVy = Math.sin(angle2) * TILE * 6;
          player.kbTimer = 0.2;
          break;
        case 'armadilhaSombra':
          // -8% HP + Lentidão 4s
          shouldDamage = true; dmgPercent = 0.08;
          statusId = 'lentidao'; statusDur = 4;
          break;
        // GDD §18 Gap#32: Biome-specific trap room hazard damage
        case 'risingSpikes':
          if (!h.active) break;
          shouldDamage = true; dmgPercent = 0.06;
          break;
        case 'sequenceRune':
          if (!h.active) break;
          shouldDamage = true; dmgPercent = 0.10;
          break;
        case 'shadowTrap':
          shouldDamage = true; dmgPercent = 0.08;
          statusId = 'lentidao'; statusDur = 4;
          break;
      }

      if (shouldDamage) {
        const dmg = Math.max(1, Math.floor(getMaxHp() * dmgPercent));
        // GDD §20: Rastrear causa da morte (perigo ambiental)
        if (player.hp - dmg <= 0) {
          const hazardNames = {
            espinhos:'Espinhos', acido:'Poça de Ácido', runaExplosiva:'Runa Explosiva',
            cristalEnergia:'Cristal de Energia', lava:'Lava', geyser:'Gêiser',
            chaoRachando:'Chão Rachando', armadilhaSombra:'Armadilha Sombra',
            wallArrow:'Flecha da Parede', risingSpikes:'Espinhos Ascendentes',
            sequenceRune:'Runa Sequencial', risingLava:'Lava Ascendente',
            shadowTrap:'Armadilha Sombra', totalDarkness:'Escuridão Total'
          };
          if (typeof deathCause !== 'undefined') deathCause = hazardNames[h.type] || h.type;
        }
        applyPlayerDamage(dmg);
        if (statusId) applyStatusPlayer(statusId, statusDur);
        player.iframeTimer = 0.5; // i-frame to avoid continuous damage
      }
    }
  }
}

// GDD §18 Gap#32: Biome-specific trap room hazards
function activateTrapRoom(room, biome) {
  const traps = [];
  switch(biome) {
    case 'pedra': // B1: flechas das paredes (projectiles from walls)
      for (let i = 0; i < 4; i++) {
        const side = i; // 0=top,1=right,2=bottom,3=left
        traps.push({type:'wallArrow', color:'#888888', side, room,
          interval:1.5, timer:0, x: room.cx, y: room.cy, active:true, broken:false, revealed:true});
      }
      break;
    case 'catacumbas': // B2: chão afunda + espinhos sobem
      for (let i = 0; i < 6; i++) {
        const tx = room.x + 1 + randInt(0, Math.max(0, room.w-3));
        const ty = room.y + 1 + randInt(0, Math.max(0, room.h-3));
        traps.push({type:'risingSpikes', color:'#888888',
          x:tx, y:ty, delay:1.0 + i*0.3, active:false, timer:0, broken:false, revealed:true});
      }
      break;
    case 'ruinas': // B3: runas em sequência
      for (let i = 0; i < 5; i++) {
        const tx = room.x + 1 + randInt(0, Math.max(0, room.w-3));
        const ty = room.y + 1 + randInt(0, Math.max(0, room.h-3));
        traps.push({type:'sequenceRune', color:'#ff6600',
          x:tx, y:ty, delay:i*0.8, active:false, timer:0, broken:false, revealed:true});
      }
      break;
    case 'lava': // B4: lava sobe pelas bordas
      traps.push({type:'risingLava', color:'#ff3300', room,
        x: room.cx, y: room.cy, timer:0, phase:0, active:true, broken:false, revealed:true});
      break;
    case 'fortaleza': // B5: escuridão total + armadilhas sombra
      traps.push({type:'totalDarkness', color:'#110022', room,
        x: room.cx, y: room.cy, timer:0, active:true, broken:false, revealed:true});
      for (let i = 0; i < 4; i++) {
        const tx = room.x + 1 + randInt(0, Math.max(0, room.w-3));
        const ty = room.y + 1 + randInt(0, Math.max(0, room.h-3));
        traps.push({type:'shadowTrap', color:'#330066',
          x:tx, y:ty, timer:0, active:true, broken:false, revealed:false});
      }
      break;
  }
  return traps;
}

// ============================================================
// GDD §18 Gap#28: SECRET ROOM PUZZLES — solve puzzle to open passage
// ============================================================
let secretPuzzleStandTimer = 0; // for standStill puzzles

function updateSecretPuzzles(dt, actionType) {
  // actionType: 'attack', 'interact', 'skill', or null (called each frame)
  const ptx = Math.floor(player.x / TILE);
  const pty = Math.floor(player.y / TILE);

  for (const room of rooms) {
    if (!room.isSecret || room.puzzleSolved || !room.puzzleTile || !room.puzzleDef) continue;

    const pt = room.puzzleTile;
    const dist = Math.abs(ptx - pt.x) + Math.abs(pty - pt.y);

    // Show hint when nearby
    if (dist <= 2 && !room._hintShown) {
      room._hintShown = true;
      if (typeof showDroghanBubble === 'function') showDroghanBubble(room.puzzleDef.hint);
    }
    if (dist > 3) room._hintShown = false;

    if (dist > 1) {
      secretPuzzleStandTimer = 0;
      continue;
    }

    let solved = false;
    switch(room.puzzleDef.type) {
      case 'attackWall':
        if (actionType === 'attack') solved = true;
        break;
      case 'interact':
        if (actionType === 'interact') solved = true;
        break;
      case 'standStill':
        // Player must stand still near puzzle tile for duration
        secretPuzzleStandTimer += dt;
        if (secretPuzzleStandTimer >= (room.puzzleDef.duration || 2)) solved = true;
        break;
      case 'useSkill':
        if (actionType === 'skill') solved = true;
        break;
    }

    if (solved) {
      room.puzzleSolved = true;
      secretPuzzleStandTimer = 0;
      // Open the blocked passage
      if (room.blockedTiles) {
        for (const bt of room.blockedTiles) {
          setTile(bt.x, bt.y, TILE_FLOOR);
        }
      }
      // Update puzzle decoration
      for (const dec of decorations) {
        if (dec.type === 'puzzle' && dec.x === pt.x && dec.y === pt.y) {
          dec.solved = true;
        }
      }
      sfx('chest');
      shakeScreen(2, 0.3);
      if (typeof showDroghanBubble === 'function') showDroghanBubble('Uma passagem secreta!');
      // Particles
      if (typeof particles !== 'undefined') {
        for (let i = 0; i < 8; i++) {
          particles.push({
            x: pt.x * TILE + TILE/2, y: pt.y * TILE + TILE/2,
            vx: (Math.random()-0.5)*80, vy: (Math.random()-0.5)*80,
            life: 0.8, maxLife: 0.8, color: '#ffdd44', size: 3
          });
        }
      }
    }
  }
}

// ============================================================
// GDD §18: TRAP ROOMS — porta tranca, armadilhas ativam, sobreviver 10-15s
// ============================================================
function updateTrapRooms(dt) {
  for (const room of rooms) {
    if (!room.isTrap) continue;
    const ptx = Math.floor(player.x / TILE);
    const pty = Math.floor(player.y / TILE);
    const inRoom = ptx >= room.x && ptx < room.x + room.w && pty >= room.y && pty < room.y + room.h;

    if (room.trapState === 'idle' && inRoom) {
      // Jogador pisou no centro? Ativar armadilha
      const centerDist = Math.abs(ptx - room.cx) + Math.abs(pty - room.cy);
      if (centerDist <= 1) {
        room.trapState = 'active';
        room.trapTimer = 0;
        // Tranca portas (bloquear saída — preencher bordas com parede temporária)
        room.savedTiles = [];
        for (let x = room.x; x < room.x + room.w; x++) {
          for (const y of [room.y, room.y + room.h - 1]) {
            if (getTile(x, y) === TILE_FLOOR) { room.savedTiles.push({x, y, v: TILE_FLOOR}); setTile(x, y, TILE_WALL); }
          }
        }
        for (let y = room.y; y < room.y + room.h; y++) {
          for (const x of [room.x, room.x + room.w - 1]) {
            if (getTile(x, y) === TILE_FLOOR) { room.savedTiles.push({x, y, v: TILE_FLOOR}); setTile(x, y, TILE_WALL); }
          }
        }
        // GDD §18 Gap#32: Spawnar armadilhas biome-specific
        const biome = getBiome(currentFloor).id;
        const trapHazards = activateTrapRoom(room, biome);
        for (const th of trapHazards) {
          hazards.push(th);
        }
        sfx('hit');
        if (typeof showDroghanBubble === 'function') showDroghanBubble('Uma armadilha!');
      }
    }

    if (room.trapState === 'active') {
      room.trapTimer += dt;
      if (room.trapTimer >= room.trapDuration) {
        room.trapState = 'cleared';
        // Destrancar portas
        if (room.savedTiles) {
          for (const t of room.savedTiles) setTile(t.x, t.y, t.v);
          room.savedTiles = null;
        }
        // Recompensa: baú com ouro x2 + 1 poção garantida
        if (!room.trapReward) {
          room.trapReward = true;
          const trapChestId = 'trap_f' + currentFloor + '_' + room.cx + '_' + room.cy;
          chests.push({x: room.cx, y: room.cy, opened: false, isMimic: false, isTrapReward: true, chestId: trapChestId});
          if (typeof showDroghanBubble === 'function') showDroghanBubble('Sobrevivi!');
        }
      }
    }
  }
}

// ============================================================
// GDD §18: HORDE ROOMS — porta tranca, 3 waves, recompensa
// ============================================================
function updateHordeRooms(dt) {
  for (const room of rooms) {
    if (!room.isHorde) continue;
    const ptx = Math.floor(player.x / TILE);
    const pty = Math.floor(player.y / TILE);
    const inRoom = ptx >= room.x && ptx < room.x + room.w && pty >= room.y && pty < room.y + room.h;

    if (room.hordeState === 'idle' && inRoom) {
      room.hordeState = 'wave1';
      room.hordeWave = 1;
      // Tranca portas
      room.savedTiles = [];
      for (let x = room.x; x < room.x + room.w; x++) {
        for (const y of [room.y, room.y + room.h - 1]) {
          if (getTile(x, y) === TILE_FLOOR) { room.savedTiles.push({x, y, v: TILE_FLOOR}); setTile(x, y, TILE_WALL); }
        }
      }
      for (let y = room.y; y < room.y + room.h; y++) {
        for (const x of [room.x, room.x + room.w - 1]) {
          if (getTile(x, y) === TILE_FLOOR) { room.savedTiles.push({x, y, v: TILE_FLOOR}); setTile(x, y, TILE_WALL); }
        }
      }
      sfx('hit');
      if (typeof showDroghanBubble === 'function') showDroghanBubble('Horda!');
      spawnHordeWave(room, 1, currentFloor);
    }

    // Checar se wave atual foi limpa
    if (room.hordeState === 'wave1' || room.hordeState === 'wave2' || room.hordeState === 'wave3') {
      // Contar inimigos vivos dentro da sala
      let alive = 0;
      for (const e of enemies) {
        if (e.dead) continue;
        const ex = Math.floor(e.x / TILE), ey = Math.floor(e.y / TILE);
        if (ex >= room.x && ex < room.x + room.w && ey >= room.y && ey < room.y + room.h) alive++;
      }
      room.hordeEnemiesAlive = alive;

      if (alive === 0) {
        if (room.hordeWave < 3) {
          room.hordeWave++;
          room.hordeState = 'wave' + room.hordeWave;
          spawnHordeWave(room, room.hordeWave, currentFloor);
        } else {
          // Todas as waves limpas
          room.hordeState = 'cleared';
          // Destrancar portas
          if (room.savedTiles) {
            for (const t of room.savedTiles) setTile(t.x, t.y, t.v);
            room.savedTiles = null;
          }
          // Recompensa: Ouro x3 + 1 Poção Méd+ garantida + chance Equip (25%)
          if (!room.hordeReward) {
            room.hordeReward = true;
            const goldReward = randInt(30, 60) * 3;
            goldPickups.push({x: room.cx * TILE + TILE/2, y: room.cy * TILE + TILE/2, amount: goldReward});
            // Poção Méd+ garantida
            const potId = currentFloor >= 15 ? 'potGra' : 'potMed';
            itemDrops.push({x: room.cx * TILE + TILE/2 + 10, y: room.cy * TILE + TILE/2,
              item: {...POTIONS[potId], id: potId}, type: 'consumable'});
            // 25% chance equip
            if (Math.random() < 0.25) {
              chests.push({x: room.cx, y: room.cy + 1, opened: false, isMimic: false});
            }
            if (typeof showDroghanBubble === 'function') showDroghanBubble('Horda eliminada!');
          }
        }
      }
    }
  }
}

function spawnHordeWave(room, wave, floor) {
  // GDD §18: Wave 1: 4 regulares | Wave 2: 6 regulares | Wave 3: 8 regulares + 1 forte
  const counts = {1: 4, 2: 6, 3: 8};
  const count = counts[wave] || 4;
  const pool = getFloorPool(floor);

  for (let i = 0; i < count; i++) {
    const ex = room.x + 1 + randInt(0, Math.max(0, room.w - 3));
    const ey = room.y + 1 + randInt(0, Math.max(0, room.h - 3));
    if (getTile(ex, ey) !== TILE_FLOOR) continue;
    const level = getEnemyLevel(floor) + 1; // GDD §18 Gap#35: horde enemies +1 level
    const def = pool[randInt(0, pool.length - 1)];
    enemies.push(createEnemy(def, level, ex * TILE + TILE/2, ey * TILE + TILE/2));
  }

  // Wave 3: + 1 inimigo forte (maior HP e ATK)
  if (wave === 3) {
    const ex = room.cx;
    const ey = room.cy;
    const level = getEnemyLevel(floor) + 2;
    const def = pool[randInt(0, pool.length - 1)];
    const strong = createEnemy(def, level, ex * TILE + TILE/2, ey * TILE + TILE/2);
    strong.maxHp = Math.round(strong.maxHp * 1.5);
    strong.hp = strong.maxHp;
    strong.atk = Math.round(strong.atk * 1.3);
    enemies.push(strong);
  }
}

// ============================================================
// GDD §18 Gap#5: MAP TEMPLATE GENERATORS
// ============================================================

function _placeRoomNoOverlap(rx, ry, rw, rh, isHub) {
  rx = clamp(rx, 2, dungeonW - rw - 2);
  ry = clamp(ry, 2, dungeonH - rh - 2);
  for (const r of rooms) {
    if (rx < r.x+r.w+2 && rx+rw+2 > r.x && ry < r.y+r.h+2 && ry+rh+2 > r.y) return false;
  }
  carveRoom(rx, ry, rw, rh, isHub);
  return true;
}

// 1. Radial — hub central + salas externas
function genTemplateRadial(cx, cy, size) {
  const hubW = randInt(7, 9), hubH = randInt(7, 9);
  const hubX = cx - Math.floor(hubW/2), hubY = cy - Math.floor(hubH/2);
  carveRoom(hubX, hubY, hubW, hubH, true);
  const numRooms = randInt(6, 8);
  const angleStep = (Math.PI * 2) / numRooms;
  for (let i = 0; i < numRooms; i++) {
    const angle = angleStep * i + (Math.random()-0.5)*angleStep*0.4;
    const d = randInt(12, Math.floor(size*0.35));
    const rw = randInt(5, 11), rh = randInt(5, 11);
    const rx = cx + Math.round(Math.cos(angle)*d) - Math.floor(rw/2);
    const ry = cy + Math.round(Math.sin(angle)*d) - Math.floor(rh/2);
    _placeRoomNoOverlap(rx, ry, rw, rh, false);
  }
  const hcx = hubX + Math.floor(hubW/2), hcy = hubY + Math.floor(hubH/2);
  for (let i = 1; i < rooms.length; i++) carveCorridor(rooms[i].cx, rooms[i].cy, hcx, hcy);
  for (let i = 1; i < rooms.length-1; i++) {
    if (Math.random() < 0.3) carveCorridor(rooms[i].cx, rooms[i].cy, rooms[i+1].cx, rooms[i+1].cy);
  }
  return {hubCx: hcx, hubCy: hcy};
}

// 2. Linear Ramificado — main path with branches
function genTemplateLinear(cx, cy, size) {
  const hubW = randInt(6, 8), hubH = randInt(6, 8);
  const hubX = 4, hubY = cy - Math.floor(hubH/2);
  carveRoom(hubX, hubY, hubW, hubH, true);
  const hcx = hubX + Math.floor(hubW/2), hcy = hubY + Math.floor(hubH/2);
  const mainCount = randInt(5, 7);
  const stepX = Math.floor((size - 12) / mainCount);
  for (let i = 0; i < mainCount; i++) {
    const rw = randInt(5, 9), rh = randInt(5, 9);
    const rx = hubX + hubW + stepX * i + randInt(0, 3);
    const ry = cy - Math.floor(rh/2) + randInt(-3, 3);
    _placeRoomNoOverlap(rx, ry, rw, rh, false);
  }
  // Connect main path linearly
  for (let i = 1; i < rooms.length; i++) carveCorridor(rooms[i-1].cx, rooms[i-1].cy, rooms[i].cx, rooms[i].cy);
  // Branches
  for (let i = 1; i < rooms.length; i++) {
    if (Math.random() < 0.4) {
      const bw = randInt(4, 7), bh = randInt(4, 7);
      const dir = Math.random() < 0.5 ? -1 : 1;
      const bx = rooms[i].cx - Math.floor(bw/2);
      const by = rooms[i].cy + dir * randInt(8, 14);
      if (_placeRoomNoOverlap(bx, by, bw, bh, false)) {
        carveCorridor(rooms[i].cx, rooms[i].cy, rooms[rooms.length-1].cx, rooms[rooms.length-1].cy);
      }
    }
  }
  return {hubCx: hcx, hubCy: hcy};
}

// 3. Labirinto Loops — maze with loops (no dead ends)
function genTemplateLabirinto(cx, cy, size) {
  const hubW = randInt(6, 8), hubH = randInt(6, 8);
  const hubX = cx - Math.floor(hubW/2), hubY = cy - Math.floor(hubH/2);
  carveRoom(hubX, hubY, hubW, hubH, true);
  const hcx = hubX + Math.floor(hubW/2), hcy = hubY + Math.floor(hubH/2);
  const numRooms = randInt(7, 10);
  for (let i = 0; i < numRooms; i++) {
    const rw = randInt(4, 8), rh = randInt(4, 8);
    const rx = randInt(4, size - rw - 4);
    const ry = randInt(4, size - rh - 4);
    _placeRoomNoOverlap(rx, ry, rw, rh, false);
  }
  // Connect each to hub
  for (let i = 1; i < rooms.length; i++) carveCorridor(rooms[i].cx, rooms[i].cy, hcx, hcy);
  // Extra loops: connect every room to 2 neighbors (no dead ends)
  for (let i = 1; i < rooms.length; i++) {
    let nearest1 = -1, nearest2 = -1, d1 = Infinity, d2 = Infinity;
    for (let j = 0; j < rooms.length; j++) {
      if (j === i) continue;
      const d = distXY(rooms[i].cx, rooms[i].cy, rooms[j].cx, rooms[j].cy);
      if (d < d1) { d2 = d1; nearest2 = nearest1; d1 = d; nearest1 = j; }
      else if (d < d2) { d2 = d; nearest2 = j; }
    }
    if (nearest1 >= 0) carveCorridor(rooms[i].cx, rooms[i].cy, rooms[nearest1].cx, rooms[nearest1].cy);
    if (nearest2 >= 0 && Math.random() < 0.6) carveCorridor(rooms[i].cx, rooms[i].cy, rooms[nearest2].cx, rooms[nearest2].cy);
  }
  return {hubCx: hcx, hubCy: hcy};
}

// 4. Caverna Aberta — cellular automata
function genTemplateCaverna(cx, cy, size) {
  // Step 1: random fill (45% wall)
  for (let y = 1; y < dungeonH-1; y++)
    for (let x = 1; x < dungeonW-1; x++)
      if (Math.random() < 0.45) setTile(x, y, TILE_FLOOR);
  // Step 2: smooth 4 iterations (4-5 rule)
  for (let iter = 0; iter < 4; iter++) {
    const copy = new Uint8Array(dungeon);
    for (let y = 1; y < dungeonH-1; y++) {
      for (let x = 1; x < dungeonW-1; x++) {
        let walls = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (copy[(y+dy)*dungeonW+(x+dx)] === TILE_WALL) walls++;
        dungeon[y*dungeonW+x] = walls >= 5 ? TILE_WALL : TILE_FLOOR;
      }
    }
  }
  // Step 3: carve distinct rooms in open areas
  const hubW = randInt(7, 9), hubH = randInt(7, 9);
  const hubX = cx - Math.floor(hubW/2), hubY = cy - Math.floor(hubH/2);
  carveRoom(hubX, hubY, hubW, hubH, true);
  const hcx = hubX + Math.floor(hubW/2), hcy = hubY + Math.floor(hubH/2);
  const numExtra = randInt(4, 6);
  for (let i = 0; i < numExtra; i++) {
    const rw = randInt(5, 8), rh = randInt(5, 8);
    const rx = randInt(4, size - rw - 4);
    const ry = randInt(4, size - rh - 4);
    _placeRoomNoOverlap(rx, ry, rw, rh, false);
  }
  for (let i = 1; i < rooms.length; i++) carveCorridor(rooms[i].cx, rooms[i].cy, hcx, hcy);
  return {hubCx: hcx, hubCy: hcy};
}

// 5. Espiral — rooms in spiral pattern from center
function genTemplateEspiral(cx, cy, size) {
  const hubW = randInt(6, 8), hubH = randInt(6, 8);
  const hubX = cx - Math.floor(hubW/2), hubY = cy - Math.floor(hubH/2);
  carveRoom(hubX, hubY, hubW, hubH, true);
  const hcx = hubX + Math.floor(hubW/2), hcy = hubY + Math.floor(hubH/2);
  const numRooms = randInt(6, 9);
  const spiralStep = (Math.PI * 2 * 2) / numRooms; // ~2 full turns
  for (let i = 0; i < numRooms; i++) {
    const angle = spiralStep * i;
    const d = 10 + i * Math.floor((size*0.35 - 10) / numRooms);
    const rw = randInt(5, 8), rh = randInt(5, 8);
    const rx = cx + Math.round(Math.cos(angle)*d) - Math.floor(rw/2);
    const ry = cy + Math.round(Math.sin(angle)*d) - Math.floor(rh/2);
    _placeRoomNoOverlap(rx, ry, rw, rh, false);
  }
  // Connect sequentially along spiral + to hub
  carveCorridor(rooms[0].cx, rooms[0].cy, rooms.length > 1 ? rooms[1].cx : hcx, rooms.length > 1 ? rooms[1].cy : hcy);
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(rooms[i-1].cx, rooms[i-1].cy, rooms[i].cx, rooms[i].cy);
  }
  // Connect last to hub for loop
  if (rooms.length > 2) carveCorridor(rooms[rooms.length-1].cx, rooms[rooms.length-1].cy, hcx, hcy);
  return {hubCx: hcx, hubCy: hcy};
}

// 6. Ilhas Conectadas — isolated room clusters connected by bridges
function genTemplateIlhas(cx, cy, size) {
  const hubW = randInt(6, 8), hubH = randInt(6, 8);
  const hubX = cx - Math.floor(hubW/2), hubY = cy - Math.floor(hubH/2);
  carveRoom(hubX, hubY, hubW, hubH, true);
  const hcx = hubX + Math.floor(hubW/2), hcy = hubY + Math.floor(hubH/2);
  // Create 3-4 clusters
  const numClusters = randInt(3, 4);
  const clusterAngleStep = (Math.PI * 2) / numClusters;
  const clusterCenters = [];
  for (let c = 0; c < numClusters; c++) {
    const angle = clusterAngleStep * c + (Math.random()-0.5)*0.5;
    const d = randInt(Math.floor(size*0.25), Math.floor(size*0.4));
    const ccx = cx + Math.round(Math.cos(angle)*d);
    const ccy = cy + Math.round(Math.sin(angle)*d);
    clusterCenters.push({cx: ccx, cy: ccy});
    // 2-3 rooms per cluster, close together
    const clusterRooms = randInt(2, 3);
    const firstIdx = rooms.length;
    for (let i = 0; i < clusterRooms; i++) {
      const rw = randInt(5, 8), rh = randInt(5, 8);
      const rx = ccx + randInt(-6, 6) - Math.floor(rw/2);
      const ry = ccy + randInt(-6, 6) - Math.floor(rh/2);
      _placeRoomNoOverlap(rx, ry, rw, rh, false);
    }
    // Connect rooms within cluster
    for (let i = firstIdx + 1; i < rooms.length; i++) {
      carveCorridor(rooms[i-1].cx, rooms[i-1].cy, rooms[i].cx, rooms[i].cy);
    }
  }
  // Bridge clusters to hub
  for (const cc of clusterCenters) {
    // Find nearest room to this cluster center
    let nearest = null, nDist = Infinity;
    for (let i = 1; i < rooms.length; i++) {
      const d = distXY(rooms[i].cx, rooms[i].cy, cc.cx, cc.cy);
      if (d < nDist) { nDist = d; nearest = rooms[i]; }
    }
    if (nearest) carveCorridor(nearest.cx, nearest.cy, hcx, hcy);
  }
  return {hubCx: hcx, hubCy: hcy};
}

// 7. Assimétrico Orgânico — irregular organic layout
function genTemplateAssimetrico(cx, cy, size) {
  const hubW = randInt(6, 9), hubH = randInt(6, 9);
  const hubX = cx - Math.floor(hubW/2), hubY = cy - Math.floor(hubH/2);
  carveRoom(hubX, hubY, hubW, hubH, true);
  const hcx = hubX + Math.floor(hubW/2), hcy = hubY + Math.floor(hubH/2);
  // Random walk from hub to place rooms organically
  const numRooms = randInt(6, 9);
  let walkX = hcx, walkY = hcy;
  for (let i = 0; i < numRooms; i++) {
    // Random direction and distance
    const angle = Math.random() * Math.PI * 2;
    const d = randInt(8, Math.floor(size * 0.3));
    walkX = clamp(walkX + Math.round(Math.cos(angle)*d), 6, size - 12);
    walkY = clamp(walkY + Math.round(Math.sin(angle)*d), 6, size - 12);
    const rw = randInt(4, 10), rh = randInt(4, 10);
    _placeRoomNoOverlap(walkX - Math.floor(rw/2), walkY - Math.floor(rh/2), rw, rh, false);
  }
  // Connect with winding corridors to previous room (organic feel)
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(rooms[i-1].cx, rooms[i-1].cy, rooms[i].cx, rooms[i].cy);
  }
  // A few random extra connections
  for (let i = 0; i < 3; i++) {
    const a = randInt(0, rooms.length-1), b = randInt(0, rooms.length-1);
    if (a !== b) carveCorridor(rooms[a].cx, rooms[a].cy, rooms[b].cx, rooms[b].cy);
  }
  return {hubCx: hcx, hubCy: hcy};
}

// 8. Fortaleza Estruturada — grid-based, regular rooms, military-style
function genTemplateFortaleza(cx, cy, size) {
  const hubW = randInt(7, 9), hubH = randInt(7, 9);
  const hubX = cx - Math.floor(hubW/2), hubY = cy - Math.floor(hubH/2);
  carveRoom(hubX, hubY, hubW, hubH, true);
  const hcx = hubX + Math.floor(hubW/2), hcy = hubY + Math.floor(hubH/2);
  // Grid of rooms (3x3 or 4x3)
  const cols = randInt(3, 4), rowCount = 3;
  const cellW = Math.floor((size - 8) / cols);
  const cellH = Math.floor((size - 8) / rowCount);
  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < cols; col++) {
      if (row === Math.floor(rowCount/2) && col === Math.floor(cols/2)) continue; // hub position
      const rw = randInt(5, Math.min(9, cellW - 4));
      const rh = randInt(5, Math.min(9, cellH - 4));
      const rx = 4 + col * cellW + Math.floor((cellW - rw) / 2);
      const ry = 4 + row * cellH + Math.floor((cellH - rh) / 2);
      _placeRoomNoOverlap(rx, ry, rw, rh, false);
    }
  }
  // Connect grid rooms with straight corridors (military style)
  for (let i = 1; i < rooms.length; i++) carveCorridor(rooms[i].cx, rooms[i].cy, hcx, hcy);
  // Horizontal connections between adjacent rooms
  for (let i = 1; i < rooms.length - 1; i++) {
    if (Math.abs(rooms[i].cy - rooms[i+1].cy) < cellH) {
      carveCorridor(rooms[i].cx, rooms[i].cy, rooms[i+1].cx, rooms[i+1].cy);
    }
  }
  return {hubCx: hcx, hubCy: hcy};
}

// ============================================================
// GDD §18 Gap#6: ROOM SHAPE TYPES
// ============================================================
// 5 types: 1.Retangular cortada 2.Circular 3.Caverna automata 4.L/T/Cruz 5.Grande com estrutura
const ROOM_SHAPES = ['rect','circular','caverna','ltcruz','estrutura'];

function carveRoom(rx, ry, rw, rh, isHub) {
  // Hub is always rectangular for reliability
  const shape = isHub ? 'rect' : ROOM_SHAPES[randInt(0, ROOM_SHAPES.length - 1)];
  const rcx = rx + Math.floor(rw/2), rcy = ry + Math.floor(rh/2);

  switch (shape) {
    case 'circular': {
      // Ellipse inscribed in the rectangle
      const radX = rw / 2, radY = rh / 2;
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++) {
          const dx = (x - rcx) / radX, dy = (y - rcy) / radY;
          if (dx*dx + dy*dy <= 1.0) setTile(x, y, TILE_FLOOR);
        }
      break;
    }
    case 'caverna': {
      // Organic shape: fill randomly then smooth once
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++)
          if (Math.random() < 0.6) setTile(x, y, TILE_FLOOR);
      // Smooth pass
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++) {
          let floors = 0;
          for (let dy2 = -1; dy2 <= 1; dy2++)
            for (let dx2 = -1; dx2 <= 1; dx2++)
              if (getTile(x+dx2, y+dy2) === TILE_FLOOR) floors++;
          if (floors >= 5) setTile(x, y, TILE_FLOOR);
        }
      // Ensure center is always floor
      setTile(rcx, rcy, TILE_FLOOR);
      for (let d = -1; d <= 1; d++) { setTile(rcx+d, rcy, TILE_FLOOR); setTile(rcx, rcy+d, TILE_FLOOR); }
      break;
    }
    case 'ltcruz': {
      // L, T, or Cross shape
      const variant = randInt(0, 2); // 0=L, 1=T, 2=Cruz
      const halfW = Math.floor(rw/2), halfH = Math.floor(rh/2);
      if (variant === 0) { // L shape: horizontal + vertical arm
        for (let y = ry; y < ry + rh; y++)
          for (let x = rx; x < rx + halfW + 1; x++) setTile(x, y, TILE_FLOOR);
        for (let y = rcy; y < ry + rh; y++)
          for (let x = rx; x < rx + rw; x++) setTile(x, y, TILE_FLOOR);
      } else if (variant === 1) { // T shape
        for (let y = ry; y < ry + halfH + 1; y++)
          for (let x = rx; x < rx + rw; x++) setTile(x, y, TILE_FLOOR);
        for (let y = ry; y < ry + rh; y++)
          for (let x = rcx - 1; x <= rcx + 1; x++) setTile(x, y, TILE_FLOOR);
      } else { // Cruz
        for (let y = ry; y < ry + rh; y++)
          for (let x = rcx - 1; x <= rcx + 1; x++) setTile(x, y, TILE_FLOOR);
        for (let y = rcy - 1; y <= rcy + 1; y++)
          for (let x = rx; x < rx + rw; x++) setTile(x, y, TILE_FLOOR);
      }
      break;
    }
    case 'estrutura': {
      // Large room with internal pillars/structure
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++) setTile(x, y, TILE_FLOOR);
      // Add 2x2 pillar blocks inside
      const pillarSpacing = 3;
      for (let py = ry + 2; py < ry + rh - 2; py += pillarSpacing)
        for (let px = rx + 2; px < rx + rw - 2; px += pillarSpacing)
          if (Math.random() < 0.5) {
            setTile(px, py, TILE_WALL); setTile(px+1, py, TILE_WALL);
            setTile(px, py+1, TILE_WALL); setTile(px+1, py+1, TILE_WALL);
          }
      break;
    }
    default: { // 'rect' — retangular cortada (cut corners)
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++) setTile(x, y, TILE_FLOOR);
      // Cut 1-2 random corners
      if (!isHub && rw >= 6 && rh >= 6) {
        const cut = randInt(1, 2);
        const corners = [[rx,ry],[rx+rw-1,ry],[rx,ry+rh-1],[rx+rw-1,ry+rh-1]];
        for (let c = 0; c < cut; c++) {
          const [ccx2,ccy2] = corners[randInt(0, 3)];
          const cs = randInt(1, 2);
          for (let dy3 = 0; dy3 <= cs; dy3++)
            for (let dx3 = 0; dx3 <= cs; dx3++) {
              const tx = ccx2 === rx ? rx + dx3 : rx + rw - 1 - dx3;
              const ty = ccy2 === ry ? ry + dy3 : ry + rh - 1 - dy3;
              setTile(tx, ty, TILE_WALL);
            }
        }
      }
      break;
    }
  }

  rooms.push({
    x: rx, y: ry, w: rw, h: rh,
    cx: rcx, cy: rcy,
    isHub: !!isHub, isNPC: false, isBoss: false, isMiniBoss: false,
    isTrap: false, isSecret: false, isHorde: false, shape: shape
  });
}

// GDD §18: Drunk Walk
function carveCorridor(x1, y1, x2, y2) {
  let cx = x1, cy = y1;
  let steps = dungeonW + dungeonH;
  while ((cx !== x2 || cy !== y2) && steps-- > 0) {
    setTile(cx, cy, TILE_FLOOR);
    if (Math.random() < 0.3) {
      if (Math.abs(x2-cx) > Math.abs(y2-cy))
        setTile(cx, cy + (Math.random()<0.5?1:-1), TILE_FLOOR);
      else
        setTile(cx + (Math.random()<0.5?1:-1), cy, TILE_FLOOR);
    }
    if (Math.random() < 0.7) {
      if (Math.abs(x2-cx) >= Math.abs(y2-cy)) cx += cx<x2?1:-1;
      else cy += cy<y2?1:-1;
    } else {
      if (Math.abs(x2-cx) >= Math.abs(y2-cy)) cy += Math.random()<0.5?1:-1;
      else cx += Math.random()<0.5?1:-1;
    }
    cx = clamp(cx, 1, dungeonW - 2);
    cy = clamp(cy, 1, dungeonH - 2);
  }
}

// GDD §18: Inimigos por sala
function spawnEnemiesInRoom(room, floor) {
  let count;
  if (room.w <= 7 && room.h <= 7) count = randInt(2, 3);
  else if (room.w <= 10 && room.h <= 10) count = randInt(4, 5);
  else count = randInt(6, 8);

  const pool = getFloorPool(floor);
  for (let i = 0; i < count; i++) {
    const ex = room.x + 1 + randInt(0, Math.max(0, room.w - 3));
    const ey = room.y + 1 + randInt(0, Math.max(0, room.h - 3));
    if (getTile(ex, ey) !== TILE_FLOOR) continue;
    const level = getEnemyLevel(floor);
    const def = pool[randInt(0, pool.length - 1)];
    enemies.push(createEnemy(def, level, ex * TILE + TILE/2, ey * TILE + TILE/2));
  }
}

function getFloorPool(floor) {
  if (floor <= 5)  return B1_POOL;
  if (floor <= 10) return B2_POOL;
  if (floor <= 15) return B3_POOL;
  if (floor <= 20) return B4_POOL;
  return B5_POOL;
}

function placeDecorations() {
  for (const room of rooms) {
    const corners = [
      [room.x, room.y], [room.x+room.w-1, room.y],
      [room.x, room.y+room.h-1], [room.x+room.w-1, room.y+room.h-1]
    ];
    for (const [tx, ty] of corners) {
      if (Math.random() < 0.6 && getTile(tx, ty) === TILE_FLOOR)
        decorations.push({type:'torch', x:tx, y:ty});
    }
    for (let i = 0; i < randInt(0, 3); i++) {
      const dx = room.x + randInt(1, Math.max(1, room.w-2));
      const dy = room.y + randInt(1, Math.max(1, room.h-2));
      if (getTile(dx, dy) === TILE_FLOOR) {
        const types = ['crack','puddle','cobweb','barrel'];
        decorations.push({type: types[randInt(0,3)], x:dx, y:dy});
      }
    }
  }
}

// ============================================================
// CAMERA
// ============================================================
let camX = 0, camY = 0;

function updateCamera() {
  const tx = player.x - VIEW_W / 2;
  const ty = player.y - VIEW_H / 2;
  camX += (tx - camX) * 0.1;
  camY += (ty - camY) * 0.1;
  camX = clamp(camX, 0, Math.max(0, dungeonW * TILE - VIEW_W));
  camY = clamp(camY, 0, Math.max(0, dungeonH * TILE - VIEW_H));
}

// ============================================================
// FOG OF WAR — GDD §24
// ============================================================
const FOG_RADIUS = 7;
const FOG_FADE = 3;
let fogMap = null;

function initFog() { fogMap = new Uint8Array(dungeonW * dungeonH); }

function updateFog() {
  for (let i = 0; i < fogMap.length; i++)
    if (fogMap[i] === 2) fogMap[i] = 1;

  const ptx = Math.floor(player.x / TILE);
  const pty = Math.floor(player.y / TILE);

  for (let dy = -FOG_RADIUS; dy <= FOG_RADIUS; dy++) {
    for (let dx = -FOG_RADIUS; dx <= FOG_RADIUS; dx++) {
      const tx = ptx + dx, ty = pty + dy;
      if (tx < 0 || ty < 0 || tx >= dungeonW || ty >= dungeonH) continue;
      if (Math.sqrt(dx*dx + dy*dy) <= FOG_RADIUS && hasLOS(ptx, pty, tx, ty)) {
        if (fogMap[ty * dungeonW + tx] !== 2) minimapDirty = true;
        fogMap[ty * dungeonW + tx] = 2;
      }
    }
  }
}

function hasLOS(x1, y1, x2, y2) {
  let dx = Math.abs(x2-x1), dy = Math.abs(y2-y1);
  let sx = x1<x2?1:-1, sy = y1<y2?1:-1;
  let err = dx - dy, cx = x1, cy = y1;
  while (cx !== x2 || cy !== y2) {
    if (getTile(cx, cy) === TILE_WALL && (cx !== x2 || cy !== y2)) return false;
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return true;
}

function getFog(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= dungeonW || ty >= dungeonH) return 0;
  return fogMap[ty * dungeonW + tx];
}
