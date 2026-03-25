'use strict';
// main.js — Update, Game Loop, Start Floor, Minimap, Tutorial, Boot

// ============================================================
// UPDATE
// ============================================================
function update(dt) {
  if (gameState === 'openingCutscene') { if (typeof updateOpeningCutscene === 'function') updateOpeningCutscene(dt); return; }
  if (gameState === 'bossIntro') { updateBossIntro(dt); return; }
  if (gameState !== 'playing') return;

  if (pendingLevelUp) {
    pendingLevelUp = false;
    levelUpData = {cursor: 0, points: 3, tempAttrs: {}};
    gameState = 'levelUp';
    return;
  }

  updatePlayer(dt);
  updateEnemies(dt);
  updateBossAI(dt);
  updateMiniBossAI(dt);
  updateProjectiles(dt);
  updatePlayerProjectiles(dt);
  updatePickups();
  updateParticles(dt);
  updateHazards(dt);
  updateTrapRooms(dt);
  updateHordeRooms(dt);
  updateSecretPuzzles(dt, null);
  updateDmgNumbers(dt);
  updateEffects(dt);
  updateCamera();
  updateFog();
  updateResource(dt);
  updateSkillCooldowns(dt);
  updateStatusEffects(player, dt, true);
  updatePlayerBuffs(dt);
  updateFamiliar(dt);
  updateSentinels(dt);
  updateTraps(dt);
  updateMeteors(dt);
  updateEssenciaCap();
  checkBossRoom();
  // GDD §27: Tutorial
  updateTutorial(dt);
  // GDD §22: Tempo jogado + autosave
  player.tempoJogado += dt;
  autosaveTimer += dt;
  if (autosaveTimer >= 60) { autosaveTimer = 0; autoSave(); }
  // GDD §14 M6: Touch updates
  if (isTouchDevice) updateTouch(dt);
  mouseClicked = false;
}

// ============================================================
// GAME LOOP — GDD §GameLoop
// ============================================================
let lastTime = 0;
let accumulator = 0;

function gameLoop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  const frameTime = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  // Input para estados não-playing
  if (gameState === 'mainMenu')      handleMainMenuInput();
  else if (gameState === 'slotSelect') handleSlotSelectInput();
  else if (gameState === 'importSave') handleImportSaveInput();
  else if (gameState === 'exportSave' || gameState === 'stats') {
    if (keys.Escape) { keys.Escape = false; gameState = 'paused'; menuState.exportCopied = false; }
  }
  else if (gameState === 'levelUp')      handleLevelUpInput();
  else if (gameState === 'dead')    handleDeathInput();
  else if (gameState === 'paused')  handlePauseMenuInput();
  else if (gameState === 'dialogue') {
    updateDialogue(frameTime);
    handleDialogueInput();
  }
  else if (gameState === 'shop')       handleShopInput();
  else if (gameState === 'inventory')  handleInventoryInput();
  else if (gameState === 'classSelect') handleClassSelectInput();
  else if (gameState === 'upgrade')    handleUpgradeInput();
  else if (gameState === 'seleneUpgrade') handleSeleneUpgradeInput();
  else if (gameState === 'skillMenu')  handleSkillMenuInput();
  else if (gameState === 'openingCutscene') {
    if (typeof updateOpeningCutscene === 'function') updateOpeningCutscene(frameTime);
    if (typeof handleOpeningCutsceneInput === 'function') handleOpeningCutsceneInput();
  }
  else if (gameState === 'endCutscene') {
    updateEndCutscene(frameTime);
    handleEndCutsceneInput();
  }
  else if (gameState === 'credits') {
    handleCreditsInput();
  }

  if (gameState === 'loading') {
    requestAnimationFrame(gameLoop);
    return;
  }

  // Menus não rodam update do jogo
  const menuStates = ['mainMenu','slotSelect','importSave','exportSave'];
  if (!menuStates.includes(gameState)) {
    accumulator += frameTime;
    while (accumulator >= FIXED_DT) {
      update(FIXED_DT);
      accumulator -= FIXED_DT;
    }
  }

  // Opening cutscene has its own render (bypasses normal render)
  if (gameState === 'openingCutscene' && typeof renderOpeningCutscene === 'function') {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    renderOpeningCutscene();
  } else {
    render();
  }
  requestAnimationFrame(gameLoop);
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
function startFloor(floor) {
  currentFloor = floor;
  if (floor > maxFloorReached) maxFloorReached = floor;
  gameState = 'loading';

  // GDD §30: Reset buffs/status/cooldowns on floor change
  player.buffs = [];
  player.statusEffects = [];
  player.skillCooldowns = {};
  player.invisible = false;
  player.invisTimer = 0;
  player.perfectBlock = false;
  player.perfectBlockTimer = 0;
  player.reflectTimer = 0;
  player.barrier = 0;
  player.barrierTimer = 0;
  player.essenciaShield = 0;
  player.essenciaShieldTimer = 0;
  player.familiar = null;
  player.sentinels = [];

  // GDD §4: Track floor revisits for farm penalty
  if (!player.contadorRevisitasPorAndar) player.contadorRevisitasPorAndar = {};
  const key = '' + currentFloor;
  player.contadorRevisitasPorAndar[key] = (player.contadorRevisitasPorAndar[key] || 0) + 1;

  // GDD §7: Vontade Inquebrável reseta a cada andar
  player.vontadeUsed = false;
  // GDD §9: Atualizar tema visual do bioma
  updateThemeForFloor(floor);
  // GDD §ASSETS: Tocar música do bioma
  if (typeof playBiomeMusic === 'function') playBiomeMusic();
  // GDD §22: Save ao trocar andar
  triggerSave();
  // Minimap reset
  minimapDirty = true;

  const loadingEl = document.getElementById('loading');
  const loadBar   = document.getElementById('loadBar');
  const loadText  = document.getElementById('loadText');

  loadingEl.classList.remove('hidden');
  loadText.textContent = 'Gerando masmorra...';
  loadBar.style.width = '0%';

  setTimeout(() => {
    loadBar.style.width = '40%';
    loadText.textContent = 'Criando salas...';
    generateDungeon(floor);
    initFog();

    loadBar.style.width = '80%';
    loadText.textContent = 'Posicionando inimigos...';

    setTimeout(() => {
      loadBar.style.width = '100%';
      loadText.textContent = 'Pronto!';
      updateFog();
      camX = player.x - VIEW_W/2;
      camY = player.y - VIEW_H/2;
      camX = clamp(camX, 0, Math.max(0, dungeonW*TILE - VIEW_W));
      camY = clamp(camY, 0, Math.max(0, dungeonH*TILE - VIEW_H));

      setTimeout(() => {
        loadingEl.classList.add('hidden');

        // New game → show opening cutscene before floor 1
        if (floor === 1 && !player.dialogsSeen['intro'] && !player.dialogsSeen['openingCutsceneSeen']) {
          player.dialogsSeen['openingCutsceneSeen'] = true;
          gameState = 'openingCutscene';
          if (typeof startOpeningCutscene === 'function') startOpeningCutscene();
        } else {
          gameState = 'playing';
        }

        // GDD §11: Droghan reações ao entrar bioma/andar
        if (floor === 1 && !player.dialogsSeen['intro'] && gameState === 'playing') {
          player.dialogsSeen['intro'] = true;
          startDialogue('Droghan', '#f0c8a0', [
            'Preciso encontrar minha mãe...',
            'Vamos lá.'
          ], null);
        } else {
          triggerFloorDialogues(floor);
        }
      }, 300);
    }, 100);
  }, 100);
}

// ============================================================
// MINIMAP — GDD §14
// ============================================================
let minimapCanvas = null;
let minimapDirty = true;

function initMinimap() {
  minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = 120;
  minimapCanvas.height = 120;
  minimapDirty = true;
}

function updateMinimapIfDirty() {
  if (!minimapDirty || !minimapCanvas) return;
  minimapDirty = false;
  const mctx = minimapCanvas.getContext('2d');
  mctx.clearRect(0, 0, 120, 120);

  const scale = Math.min(120 / dungeonW, 120 / dungeonH);
  const offX = (120 - dungeonW * scale) / 2;
  const offY = (120 - dungeonH * scale) / 2;

  // Desenhar tiles
  for (let ty = 0; ty < dungeonH; ty++) {
    for (let tx = 0; tx < dungeonW; tx++) {
      const fog = getFog(tx, ty);
      if (fog === 0) continue; // não visitado
      const tile = getTile(tx, ty);
      const px = Math.floor(offX + tx * scale);
      const py = Math.floor(offY + ty * scale);
      const pw = Math.max(1, Math.ceil(scale));
      const ph = Math.max(1, Math.ceil(scale));

      if (tile === TILE_WALL) {
        mctx.fillStyle = fog === 2 ? '#333' : '#1a1a1a';
      } else {
        mctx.fillStyle = fog === 2 ? '#444' : '#222';
      }
      mctx.fillRect(px, py, pw, ph);
    }
  }

  // Marcadores
  const mark = (x, y, color) => {
    const px = Math.floor(offX + x * scale);
    const py = Math.floor(offY + y * scale);
    mctx.fillStyle = color;
    mctx.fillRect(px-1, py-1, 3, 3);
  };

  // Escadas
  if (stairsDown && stairsDown.placed) mark(stairsDown.x, stairsDown.y, '#ffd700');
  if (stairsUp) mark(stairsUp.x, stairsUp.y, '#c0c0c0');

  // NPCs
  for (const n of npcs) mark(Math.floor(n.x/TILE), Math.floor(n.y/TILE), '#4488ff');

  // Boss (se visível)
  for (const e of enemies) {
    if (e.isBoss && !e.dead) mark(Math.floor(e.x/TILE), Math.floor(e.y/TILE), '#ff4444');
  }

  // GDD §14: Passiva Rastreador (Arqueiro) — mostra inimigos e baús
  if (hasPassive && hasPassive('rastreador')) {
    for (const e of enemies) {
      if (!e.dead && !e.isBoss) mark(Math.floor(e.x/TILE), Math.floor(e.y/TILE), '#ff0000');
    }
    for (const ch of chests) {
      if (!ch.opened) mark(ch.x, ch.y, '#ffdd44');
    }
  }

  // Player
  const ptx = Math.floor(player.x / TILE);
  const pty = Math.floor(player.y / TILE);
  mctx.fillStyle = '#44ff44';
  mctx.fillRect(Math.floor(offX + ptx * scale) - 1, Math.floor(offY + pty * scale) - 1, 3, 3);
}

function renderMinimap() {
  if (!showMinimap || !minimapCanvas) return;
  updateMinimapIfDirty();
  // GDD §14: 120×120px, canto superior direito, semi-transparente
  ctx.globalAlpha = 0.7;
  ctx.drawImage(minimapCanvas, VIEW_W - 125, 5);
  ctx.globalAlpha = 1;
  // Borda
  ctx.strokeStyle = '#555';
  ctx.strokeRect(VIEW_W - 125, 5, 120, 120);
}

// ============================================================
// TUTORIAL — GDD §27
// ============================================================
let activeTip = null;
let tipTimer = 0;

function showTutorialTip(id, text) {
  if (player.tutorialVisto[id]) return;
  player.tutorialVisto[id] = true;
  activeTip = {text, timer: 5};
}

function updateTutorial(dt) {
  if (activeTip) {
    activeTip.timer -= dt;
    if (activeTip.timer <= 0) activeTip = null;
  }
  // GDD §27: Dicas contextuais
  if (currentFloor === 1) {
    if (!player.tutorialVisto['mover']) showTutorialTip('mover', isTouchDevice ? 'Toque à esquerda para mover' : 'WASD para mover');
    // Primeiro inimigo
    if (!player.tutorialVisto['atacar'] && enemies.some(e => !e.dead && distXY(player.x, player.y, e.x, e.y) < 5*TILE))
      showTutorialTip('atacar', isTouchDevice ? 'Toque ⚔ para atacar' : 'Clique para atacar');
    // Primeiro ouro
    if (!player.tutorialVisto['ouro'] && goldPickups.length > 0)
      showTutorialTip('ouro', 'Ouro: passe por cima para pegar');
    // Primeiro item
    if (!player.tutorialVisto['item'] && itemDrops.length > 0)
      showTutorialTip('item', 'Espaço para interagir com itens');
  }
  // Escada
  if (!player.tutorialVisto['escada'] && stairsDown && stairsDown.placed) {
    const sdx = stairsDown.x * TILE + TILE/2, sdy = stairsDown.y * TILE + TILE/2;
    if (distXY(player.x, player.y, sdx, sdy) < 3*TILE)
      showTutorialTip('escada', 'Pise na escada para descer');
  }
}

function renderTutorialTip() {
  if (!activeTip) return;
  const alpha = Math.min(1, activeTip.timer / 0.5); // fade out nos últimos 0.5s
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = '#000';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(activeTip.text).width + 20;
  ctx.fillRect(VIEW_W/2 - tw/2, 8, tw, 18);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffd700';
  ctx.fillText(activeTip.text, VIEW_W/2, 21);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// Boot — carrega assets e inicia
(async function boot() {
  // Carrega assets reais (sprites, sons, músicas)
  if (typeof loadAllAssets === 'function') {
    try {
      await loadAllAssets();
      console.log('[Boot] Assets carregados com sucesso');
    } catch(e) {
      console.warn('[Boot] Falha ao carregar assets, usando fallback procedural:', e);
    }
  }
  initPlayer();
  initMinimap();
  initCloudSave();
  document.getElementById('loading').classList.add('hidden');
  gameState = 'mainMenu';
  requestAnimationFrame(gameLoop);
})();
