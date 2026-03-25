'use strict';
// render.js — Theme, All Render Functions, HUD, Boss HP Bar

let THEME = {
  floor1: '#554433', floor2: '#5a4838', grout: '#3a2a1a',
  wallTop: '#332211', wallFace: '#221100', wallDetail: '#3a2a1a'
};
function updateThemeForFloor(floor) {
  const biome = getBiome(floor);
  THEME.floor1 = biome.floorColor;
  // Ligeira variação para floor2
  THEME.floor2 = lightenColor(biome.floorColor, 10);
  THEME.grout = darkenColor(biome.floorColor, 30);
  THEME.wallTop = biome.wallTop;
  THEME.wallFace = darkenColor(biome.wallColor, 10);
  THEME.wallDetail = biome.decoColor || biome.wallTop;
}
function lightenColor(hex, amount) {
  let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  r = Math.min(255, r+amount); g = Math.min(255, g+amount); b = Math.min(255, b+amount);
  return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}
function darkenColor(hex, amount) {
  let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  r = Math.max(0, r-amount); g = Math.max(0, g-amount); b = Math.max(0, b-amount);
  return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // GDD §26: Telas de menu (não renderizam o jogo)
  if (gameState === 'mainMenu')    { renderMainMenu(); return; }
  if (gameState === 'slotSelect')  { renderSlotSelect(); return; }
  if (gameState === 'importSave')  { renderImportSave(); return; }
  if (gameState === 'exportSave')  { renderExportSave(); return; }
  if (gameState === 'endCutscene') { renderEndCutscene(); return; }
  if (gameState === 'credits')     { renderCreditsScreen(); return; }

  let sox = 0, soy = 0;
  if (screenShake.intensity > 0) {
    const fade = 1 - screenShake.timer / screenShake.duration;
    sox = (Math.random()-0.5) * screenShake.intensity * 2 * fade;
    soy = (Math.random()-0.5) * screenShake.intensity * 2 * fade;
  }
  ctx.save();
  ctx.translate(Math.round(sox), Math.round(soy));

  renderMap();
  renderTrapRoomHints();
  renderDecorations();
  renderHazards();
  renderChests();
  renderItemDrops();
  renderEntities();
  renderPlayerProjectiles();
  renderFamiliar();
  renderSentinels();
  renderTraps();
  renderMeteors();
  renderBossTelegraph();
  renderBossEffects();
  renderParticlesLayer();
  renderFogOverlay();

  ctx.restore();

  renderScreenFlashOverlay();
  renderHUD();
  renderBossHPBar();

  // UI overlays
  if (gameState === 'levelUp')    renderLevelUpScreen();
  if (gameState === 'dead')       renderDeathScreen();
  if (gameState === 'paused')     renderPauseMenuFull();
  if (gameState === 'dialogue')   renderDialogue();
  if (gameState === 'shop')       renderShop();
  if (gameState === 'inventory')  renderInventory();
  if (gameState === 'classSelect')renderClassSelect();
  if (gameState === 'upgrade')    renderUpgrade();
  if (gameState === 'seleneUpgrade') renderSeleneUpgrade();
  if (gameState === 'bossIntro')  renderBossIntro();
  if (gameState === 'skillMenu')  renderSkillMenu();
  if (gameState === 'cutscene')   renderDialogue();
  if (gameState === 'victory')    renderVictoryScreen();
  if (gameState === 'stats')      renderStatsScreen();
  // GDD §14: Minimap overlay
  renderMinimap();
  // GDD §27: Tutorial tip
  renderTutorialTip();
  // GDD §14 M6: Touch controls overlay
  renderTouchControls();
}

// GDD §29: Tela de vitória — Fim do Capítulo 1
function renderVictoryScreen() {
  // GDD §29: Process victory input here since victory state is render-driven
  if (typeof handleVictoryInput === 'function') handleVictoryInput();

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Dark gradient overlay
  const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, 'rgba(10,5,20,0.95)');
  grd.addColorStop(0.5, 'rgba(15,8,30,0.9)');
  grd.addColorStop(1, 'rgba(5,2,10,0.95)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = 'center';

  // Title
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('Fim do Capítulo 1', VIEW_W / 2, 28);

  // Subtitle
  ctx.fillStyle = '#aa88cc';
  ctx.font = '8px monospace';
  ctx.fillText('A sombra verdadeira ainda espreita...', VIEW_W / 2, 42);

  // --- Run Stats ---
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('— Estatísticas da Run —', VIEW_W / 2, 62);

  ctx.font = '7px monospace';
  const mins = Math.floor(player.tempoJogado / 60);
  const hrs = Math.floor(mins / 60);
  const timeStr = `${hrs}h${(mins % 60).toString().padStart(2, '0')}m`;

  const className = player.classKey ? CLASS_DATA[player.classKey].name : 'Sem classe';

  const col1X = VIEW_W / 2 - 80;
  const col2X = VIEW_W / 2 + 20;
  let statY = 76;
  const statLine = (x, label, val) => {
    ctx.fillStyle = '#999'; ctx.textAlign = 'left'; ctx.fillText(label, x, statY);
    ctx.fillStyle = '#fff'; ctx.fillText(val, x + 75, statY);
    statY += 12;
  };

  statLine(col1X, 'Classe:', className);
  statY -= 12; // same row for col2
  const savedStatY = statY;
  statLine(col2X, 'Nível:', '' + player.level);
  statY = savedStatY + 12;
  statLine(col1X, 'Tempo:', timeStr);
  statY -= 12;
  statLine(col2X, 'Mortes:', '' + player.deaths);
  statLine(col1X, 'Inimigos:', '' + player.enemiesKilled);
  statY -= 12;
  statLine(col2X, 'Ouro total:', '' + player.ouroTotal);
  statLine(col1X, 'Badges:', '' + player.badges.length);

  // --- Ranking ---
  const rankY = statY + 8;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('— Ranking —', VIEW_W / 2, rankY);

  ctx.font = '7px monospace';
  if (victoryState && victoryState.leaderboardLoading) {
    ctx.fillStyle = '#888';
    ctx.fillText('Carregando ranking...', VIEW_W / 2, rankY + 14);
  } else if (victoryState && victoryState.playerRank) {
    ctx.fillStyle = '#44cc44';
    ctx.fillText(`Sua posição: #${victoryState.playerRank}`, VIEW_W / 2, rankY + 14);
  } else {
    ctx.fillStyle = '#888';
    ctx.fillText('Ranking indisponível', VIEW_W / 2, rankY + 14);
  }

  // Top 5 leaderboard entries
  if (victoryState && victoryState.leaderboardData && victoryState.leaderboardData.length > 0) {
    ctx.font = '6px monospace';
    const top = Math.min(5, victoryState.leaderboardData.length);
    for (let i = 0; i < top; i++) {
      const entry = victoryState.leaderboardData[i];
      const entryY = rankY + 26 + i * 10;
      ctx.fillStyle = i === 0 ? '#ffd700' : i === 1 ? '#cccccc' : i === 2 ? '#cc8844' : '#888';
      ctx.fillText(`#${i + 1} ${entry.nome || '???'} — A${entry.andar_max || '?'} ${entry.mortes || 0}d`, VIEW_W / 2, entryY);
    }
  }

  // --- Buttons ---
  const btnY = VIEW_H - 45;
  const btnLabels = {
    explore: 'Continuar Explorando',
    menu: 'Menu Principal',
    share: 'Compartilhar',
    credits: 'Créditos',
  };

  if (victoryState) {
    ctx.font = '8px monospace';
    for (let i = 0; i < victoryState.buttons.length; i++) {
      const btnId = victoryState.buttons[i];
      const label = btnLabels[btnId] || btnId;
      const sel = i === victoryState.cursor;
      const bx = VIEW_W / 2;
      const by = btnY + i * 14;

      if (sel) {
        ctx.fillStyle = 'rgba(255,215,0,0.12)';
        ctx.fillRect(bx - 80, by - 9, 160, 13);
      }
      ctx.fillStyle = sel ? '#ffd700' : '#888';
      ctx.fillText((sel ? '▶ ' : '  ') + label, bx, by);
    }
  }

  // Controls hint
  ctx.fillStyle = '#555';
  ctx.font = '6px monospace';
  ctx.fillText('Setas: navegar | Enter: selecionar', VIEW_W / 2, VIEW_H - 4);

  ctx.textAlign = 'left';
}

function renderMap() {
  const sx0 = Math.max(0, Math.floor(camX / TILE));
  const sy0 = Math.max(0, Math.floor(camY / TILE));
  const sx1 = Math.min(dungeonW-1, Math.floor((camX+VIEW_W)/TILE) + 1);
  const sy1 = Math.min(dungeonH-1, Math.floor((camY+VIEW_H)/TILE) + 1);

  for (let ty = sy0; ty <= sy1; ty++) {
    for (let tx = sx0; tx <= sx1; tx++) {
      const fog = getFog(tx, ty);
      if (fog === 0) continue;
      const tile = getTile(tx, ty);
      const sx = Math.round(tx * TILE - camX);
      const sy = Math.round(ty * TILE - camY);

      if (tile >= TILE_FLOOR) {
        ctx.fillStyle = ((tx*7+ty*13) % 4 < 2) ? THEME.floor1 : THEME.floor2;
        ctx.fillRect(sx, sy, TILE, TILE);
        ctx.fillStyle = THEME.grout;
        ctx.fillRect(sx, sy, TILE, 1);
        ctx.fillRect(sx, sy, 1, TILE);

        if (tile === TILE_STAIRS_DOWN) {
          ctx.fillStyle = '#886622';
          ctx.fillRect(sx+6, sy+6, 20, 20);
          ctx.fillStyle = '#ffd700';
          ctx.fillRect(sx+10, sy+10, 12, 12);
          ctx.fillStyle = '#443311';
          ctx.fillRect(sx+14, sy+11, 4, 8);
          ctx.fillRect(sx+12, sy+17, 8, 3);
        }
        if (tile === TILE_STAIRS_UP) {
          ctx.fillStyle = '#888888';
          ctx.fillRect(sx+6, sy+6, 20, 20);
          ctx.fillStyle = '#cccccc';
          ctx.fillRect(sx+10, sy+10, 12, 12);
          ctx.fillStyle = '#444444';
          ctx.fillRect(sx+14, sy+13, 4, 8);
          ctx.fillRect(sx+12, sy+12, 8, 3);
        }
      } else {
        ctx.fillStyle = THEME.wallTop;
        ctx.fillRect(sx, sy, TILE, TILE);
        if (getTile(tx, ty+1) >= TILE_FLOOR) {
          ctx.fillStyle = THEME.wallFace;
          ctx.fillRect(sx, sy + TILE, TILE, WALL_DEPTH);
        }
        ctx.fillStyle = THEME.wallDetail;
        ctx.fillRect(sx + TILE/2-1, sy + TILE/2-1, 2, 2);
      }

      if (fog === 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        const extraH = (tile===TILE_WALL && getTile(tx,ty+1)>=TILE_FLOOR) ? WALL_DEPTH : 0;
        ctx.fillRect(sx, sy, TILE, TILE + extraH);
      }
    }
  }
}

// GDD §18 Gap#34: Trap room visual hint — scratch marks on floor at entrance
function renderTrapRoomHints() {
  for (const room of rooms) {
    if (!room.isTrap || room.trapState === 'cleared') continue;
    // Draw claw/scratch marks on floor tiles at room borders (entrance tiles)
    const rx = room.x, ry = room.y, rw = room.w, rh = room.h;
    for (let tx = rx; tx < rx + rw; tx++) {
      for (let ty = ry; ty < ry + rh; ty++) {
        // Only border tiles (entrance area)
        const isBorder = (tx === rx || tx === rx + rw - 1 || ty === ry || ty === ry + rh - 1);
        if (!isBorder) continue;
        if (getFog(tx, ty) === 0) continue;
        const tile = getTile(tx, ty);
        if (tile < TILE_FLOOR) continue;
        const sx = Math.round(tx * TILE - camX);
        const sy = Math.round(ty * TILE - camY);
        // Draw small claw scratch marks
        ctx.strokeStyle = 'rgba(180,40,40,0.55)';
        ctx.lineWidth = 1;
        // 3 diagonal scratches
        const seed = (tx * 31 + ty * 17) % 7;
        ctx.beginPath();
        ctx.moveTo(sx + 4 + seed, sy + 6);  ctx.lineTo(sx + 12 + seed, sy + 20);
        ctx.moveTo(sx + 8 + seed, sy + 5);  ctx.lineTo(sx + 16 + seed, sy + 19);
        ctx.moveTo(sx + 12 + seed, sy + 7); ctx.lineTo(sx + 20 + seed, sy + 21);
        ctx.stroke();
        // Small warning dot
        ctx.fillStyle = 'rgba(200,50,50,0.4)';
        ctx.beginPath();
        ctx.arc(sx + TILE / 2, sy + TILE / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function renderDecorations() {
  for (const dec of decorations) {
    if (getFog(dec.x, dec.y) === 0) continue;
    const sx = Math.round(dec.x * TILE - camX);
    const sy = Math.round(dec.y * TILE - camY);

    if (dec.type === 'torch') {
      const flicker = Math.sin(performance.now()/100 + dec.x*5) * 2;
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(sx+TILE/2-2, sy+4+flicker, 4, 6);
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(sx+TILE/2-1, sy+2+flicker, 2, 4);
      ctx.fillStyle = '#664422';
      ctx.fillRect(sx+TILE/2-1, sy+10, 2, 8);
    } else if (dec.type === 'crack') {
      ctx.strokeStyle = THEME.grout;
      ctx.beginPath();
      ctx.moveTo(sx+8, sy+8); ctx.lineTo(sx+16, sy+20); ctx.lineTo(sx+24, sy+16);
      ctx.stroke();
    } else if (dec.type === 'puddle') {
      ctx.fillStyle = 'rgba(60,80,120,0.35)';
      ctx.beginPath();
      ctx.ellipse(sx+TILE/2, sy+TILE/2, 8, 5, 0, 0, Math.PI*2);
      ctx.fill();
    } else if (dec.type === 'cobweb') {
      ctx.strokeStyle = 'rgba(200,200,200,0.25)';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx+10, sy+12, sx+TILE/2, sy+TILE/2);
      ctx.stroke();
    } else if (dec.type === 'barrel') {
      ctx.fillStyle = '#664422';
      ctx.fillRect(sx+8, sy+8, 16, 18);
      ctx.fillStyle = '#886633';
      ctx.fillRect(sx+9, sy+12, 14, 3);
      ctx.fillRect(sx+9, sy+20, 14, 3);
    }

    if (getFog(dec.x, dec.y) === 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx, sy, TILE, TILE);
    }
  }
}

// GDD §18: Renderizar perigos ambientais
function renderHazards() {
  for (const h of hazards) {
    if (h.broken) continue; // chão rachado = buraco, não renderiza
    if (getFog(h.x, h.y) === 0) continue;
    // Armadilhas sombra: invisíveis até 2 tiles
    if (!h.revealed) continue;

    const sx = Math.round(h.x * TILE - camX);
    const sy = Math.round(h.y * TILE - camY);
    const t = performance.now() / 1000;

    switch(h.type) {
      case 'espinhos':
        ctx.fillStyle = '#888888';
        for (let i = 0; i < 4; i++) {
          const ox = 4 + i * 7, oy = 20;
          ctx.beginPath();
          ctx.moveTo(sx+ox, sy+oy); ctx.lineTo(sx+ox+3, sy+oy-10); ctx.lineTo(sx+ox+6, sy+oy);
          ctx.fill();
        }
        break;
      case 'acido':
        ctx.fillStyle = `rgba(102,255,51,${0.5 + Math.sin(t*3)*0.2})`;
        ctx.beginPath();
        ctx.ellipse(sx+TILE/2, sy+TILE/2, 12, 8, 0, 0, Math.PI*2);
        ctx.fill();
        // Bolhas
        ctx.fillStyle = '#88ff44';
        ctx.fillRect(sx+10+Math.sin(t*5)*3, sy+8, 3, 3);
        ctx.fillRect(sx+20+Math.cos(t*4)*2, sy+12, 2, 2);
        break;
      case 'runaExplosiva':
        const glow = 0.3 + Math.sin(t*4)*0.2;
        ctx.fillStyle = `rgba(255,102,0,${glow})`;
        // Runa = quadrado com X
        ctx.fillRect(sx+6, sy+6, 20, 20);
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx+8, sy+8); ctx.lineTo(sx+24, sy+24);
        ctx.moveTo(sx+24, sy+8); ctx.lineTo(sx+8, sy+24);
        ctx.stroke();
        break;
      case 'cristalEnergia':
        const cAlpha = h.active ? (0.6 + Math.sin(t*6)*0.3) : 0.15;
        ctx.fillStyle = `rgba(0,204,255,${cAlpha})`;
        // Cristal = diamante
        ctx.beginPath();
        ctx.moveTo(sx+TILE/2, sy+4); ctx.lineTo(sx+TILE-4, sy+TILE/2);
        ctx.lineTo(sx+TILE/2, sy+TILE-4); ctx.lineTo(sx+4, sy+TILE/2);
        ctx.closePath(); ctx.fill();
        if (h.active) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        break;
      case 'lava':
        ctx.fillStyle = `rgba(255,51,0,${0.7 + Math.sin(t*2)*0.15})`;
        ctx.fillRect(sx+2, sy+2, TILE-4, TILE-4);
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(sx+8+Math.sin(t*3)*4, sy+8, 6, 4);
        ctx.fillRect(sx+18+Math.cos(t*2)*3, sy+18, 4, 5);
        break;
      case 'geyser':
        ctx.fillStyle = '#553322';
        ctx.beginPath();
        ctx.ellipse(sx+TILE/2, sy+TILE/2, 8, 8, 0, 0, Math.PI*2);
        ctx.fill();
        if (h.warning) {
          // Borbulhas de aviso
          ctx.fillStyle = `rgba(255,136,0,${0.5+Math.sin(t*10)*0.3})`;
          ctx.fillRect(sx+12, sy+8-Math.sin(t*8)*4, 4, 4);
          ctx.fillRect(sx+18, sy+10-Math.cos(t*7)*3, 3, 3);
        }
        if (h.erupting) {
          // Coluna de vapor
          ctx.fillStyle = 'rgba(255,200,100,0.6)';
          ctx.fillRect(sx+10, sy-20, 12, 30);
          ctx.fillStyle = 'rgba(255,150,50,0.4)';
          ctx.fillRect(sx+8, sy-30, 16, 20);
        }
        break;
      case 'chaoRachando':
        ctx.fillStyle = '#996633';
        ctx.fillRect(sx+4, sy+4, TILE-8, TILE-8);
        // Rachaduras
        ctx.strokeStyle = '#553311';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx+8, sy+8); ctx.lineTo(sx+20, sy+18);
        ctx.moveTo(sx+14, sy+6); ctx.lineTo(sx+10, sy+22);
        ctx.stroke();
        // Treme se jogador pisando
        if (h.stepping) {
          const shake = Math.sin(t*30) * 1.5;
          ctx.fillStyle = 'rgba(150,100,50,0.3)';
          ctx.fillRect(sx+4+shake, sy+4, TILE-8, TILE-8);
        }
        break;
      case 'armadilhaSombra':
        ctx.fillStyle = `rgba(51,0,102,${0.3+Math.sin(t*2)*0.15})`;
        ctx.fillRect(sx+4, sy+4, TILE-8, TILE-8);
        ctx.strokeStyle = 'rgba(100,0,200,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx+6, sy+6, TILE-12, TILE-12);
        break;
    }
  }
}

function renderChests() {
  for (const ch of chests) {
    if (getFog(ch.x, ch.y) === 0) continue;
    const sx = Math.round(ch.x * TILE - camX);
    const sy = Math.round(ch.y * TILE - camY);

    if (ch.opened) {
      ctx.fillStyle = '#664422';
      ctx.fillRect(sx+6, sy+10, 20, 14);
      ctx.fillStyle = '#553311';
      ctx.fillRect(sx+6, sy+6, 20, 8);
    } else {
      // GDD §9: Mimic treme levemente a cada 5s (dica sutil)
      let mx = 0;
      if (ch.isMimic) {
        const t = performance.now() / 1000;
        const cycle = t % 5;
        if (cycle < 0.15) mx = Math.sin(cycle * 80) * 1.5;
      }
      ctx.fillStyle = '#885522';
      ctx.fillRect(sx+6+mx, sy+8, 20, 16);
      ctx.fillStyle = '#aa6633';
      ctx.fillRect(sx+6+mx, sy+8, 20, 4);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(sx+14+mx, sy+14, 4, 4);
      const glow = 0.15 + Math.sin(performance.now()/500) * 0.08;
      ctx.fillStyle = `rgba(255,215,0,${glow})`;
      ctx.fillRect(sx+2+mx, sy+4, 28, 24);
    }
  }
}

function renderItemDrops() {
  for (const drop of itemDrops) {
    const tx = Math.floor(drop.x / TILE);
    const ty = Math.floor(drop.y / TILE);
    if (getFog(tx, ty) === 0) continue;
    const sx = Math.round(drop.x - camX);
    const sy = Math.round(drop.y - camY);

    // Item glow
    const glow = 0.2 + Math.sin(performance.now()/400) * 0.1;
    if (drop.item.type === 'equip') {
      ctx.fillStyle = `rgba(100,200,255,${glow})`;
      ctx.fillRect(sx-6, sy-6, 12, 12);
      ctx.fillStyle = '#88ccff';
      ctx.fillRect(sx-4, sy-4, 8, 8);
    } else {
      ctx.fillStyle = `rgba(100,255,100,${glow})`;
      ctx.fillRect(sx-5, sy-5, 10, 10);
      ctx.fillStyle = '#88ff88';
      ctx.fillRect(sx-3, sy-3, 6, 6);
    }
  }
}

function renderBossTelegraph() {
  for (const e of enemies) {
    if (!e.isBoss || e.dead || !e.telegraphArea) continue;
    const area = e.telegraphArea;
    const sx = Math.round(area.x - camX);
    const sy = Math.round(area.y - camY);
    // GDD §9: área vermelha semi-transparente
    ctx.fillStyle = 'rgba(255,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(sx, sy, area.r, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,0,0,0.5)';
    ctx.stroke();
  }
}

// GDD §10: Renderização efeitos de boss — Campo Runas, Lava sobe, Domínio Trevas
function renderBossEffects() {
  for (const e of enemies) {
    if (e.dead) continue;
    // Azaroth: Campo Runas (círculos azuis pulsantes)
    if (e.campoRunas && e.campoRunas.length > 0) {
      for (const cr of e.campoRunas) {
        const sx = Math.round(cr.x - camX), sy = Math.round(cr.y - camY);
        const pulse = 0.15 + Math.sin(performance.now()/200) * 0.08;
        ctx.fillStyle = `rgba(68,170,255,${pulse})`;
        ctx.beginPath(); ctx.arc(sx, sy, cr.r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = `rgba(68,170,255,${pulse+0.15})`;
        ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
      }
    }
    // Ignaroth F2: Lava sobe (borda vermelha)
    if (e.lavaRise > 0 && bossRoom) {
      const depth = e.lavaRise;
      const rx = Math.round(bossRoom.x * TILE - camX);
      const ry = Math.round(bossRoom.y * TILE - camY);
      const rw = bossRoom.w * TILE, rh = bossRoom.h * TILE;
      const pulse = 0.3 + Math.sin(performance.now()/300) * 0.1;
      ctx.fillStyle = `rgba(255,68,0,${pulse})`;
      const d = depth * TILE;
      ctx.fillRect(rx, ry, rw, d); // top
      ctx.fillRect(rx, ry + rh - d, rw, d); // bottom
      ctx.fillRect(rx, ry + d, d, rh - d*2); // left
      ctx.fillRect(rx + rw - d, ry + d, d, rh - d*2); // right
    }
    // Nahgord F2: Domínio Trevas (overlay escuro na sala)
    if (e.dominioTrevas && bossRoom) {
      const rx = Math.round(bossRoom.x * TILE - camX);
      const ry = Math.round(bossRoom.y * TILE - camY);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(rx, ry, bossRoom.w * TILE, bossRoom.h * TILE);
      // Luz apenas ao redor do jogador
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      const px = Math.round(player.x - camX), py = Math.round(player.y - camY);
      const grd = ctx.createRadialGradient(px, py, 0, px, py, 3*TILE);
      grd.addColorStop(0, 'rgba(0,0,0,0.7)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(rx, ry, bossRoom.w * TILE, bossRoom.h * TILE);
      ctx.restore();
    }
  }
}

function renderEntities() {
  const ents = [];
  for (const g of goldPickups) ents.push({y: g.y, type:'gold', d: g});
  for (const e of enemies)     ents.push({y: e.y, type:'enemy', d: e});
  for (const n of npcs)        ents.push({y: n.y, type:'npc', d: n});
  if (!player.dead)            ents.push({y: player.y, type:'player', d: player});
  for (const p of enemyProjectiles) ents.push({y: p.y, type:'proj', d: p});

  ents.sort((a,b) => a.y - b.y);

  for (const ent of ents) {
    if (ent.type === 'gold')   renderGoldPickup(ent.d);
    if (ent.type === 'enemy')  renderEnemy(ent.d);
    if (ent.type === 'npc')    renderNPC(ent.d);
    if (ent.type === 'player') renderPlayer();
    if (ent.type === 'proj')   renderProjectile(ent.d);
  }

  for (const d of damageNumbers) {
    const sx = Math.round(d.x - camX);
    const sy = Math.round(d.y - camY);
    ctx.globalAlpha = clamp(d.timer / 0.3, 0, 1);
    ctx.fillStyle = d.color;
    ctx.font = `bold ${d.size}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(d.text, sx, sy);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

function renderPlayer() {
  if (player.iframeTimer > 0 && Math.floor(player.blinkTimer/0.1) % 2 === 0) return;

  const sx = Math.round(player.x - camX);
  const sy = Math.round(player.y - camY);

  // GDD §8: Essência active particles — golden aura when essência skills are active
  const essActive = hasBuff('despertarP') || hasBuff('despertarT') || player.essenciaShieldTimer > 0;
  if (essActive) {
    const t = performance.now() / 1000;
    for (let i = 0; i < 5; i++) {
      const angle = t * 2 + i * (Math.PI * 2 / 5);
      const radius = 14 + Math.sin(t * 3 + i) * 4;
      const px = sx + Math.cos(angle) * radius;
      const py = sy - 10 + Math.sin(angle) * radius * 0.6;
      const alpha = 0.4 + Math.sin(t * 5 + i * 1.5) * 0.3;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
    }
    // Outer glow
    ctx.globalAlpha = 0.08 + Math.sin(t * 2) * 0.04;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(sx, sy - 10, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  const pw = 16, ph = 24;
  const dx = sx - pw/2;
  const dy = sy - ph + 4;

  // Ataque visual
  if (player.attackAnim > 0) {
    const atkAngle = player.dir;
    const arcX = sx + Math.cos(atkAngle) * 16;
    const arcY = sy - 8 + Math.sin(atkAngle) * 16;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(arcX, arcY, 10, atkAngle - 0.8, atkAngle + 0.8);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Corpo
  ctx.fillStyle = '#f0c8a0';
  ctx.fillRect(dx+4, dy, 8, 8);
  ctx.fillRect(dx+3, dy+8, 10, 6);

  ctx.fillStyle = '#222';
  ctx.fillRect(dx+3, dy, 10, 4);
  if (player.facing === 'left' || player.facing === 'down')
    ctx.fillRect(dx+1, dy+4, 3, 6);

  // Equipamento visual
  if (player.equipment.body) {
    const tier = player.equipment.body.tier;
    ctx.fillStyle = tier >= 2 ? '#557799' : tier >= 1 ? '#668855' : '#887766';
    ctx.fillRect(dx+3, dy+8, 10, 6);
  } else {
    ctx.fillStyle = '#eee'; // sunguinha
    ctx.fillRect(dx+3, dy+14, 10, 4);
  }

  if (player.equipment.head) {
    const tier = player.equipment.head.tier;
    ctx.fillStyle = tier >= 2 ? '#778899' : '#998877';
    ctx.fillRect(dx+3, dy-2, 10, 4);
  }

  ctx.fillStyle = '#f0c8a0';
  const wo = player.walkFrame === 1 ? 1 : player.walkFrame === 2 ? -1 : 0;
  ctx.fillRect(dx+4, dy+18, 3, 6+wo);
  ctx.fillRect(dx+9, dy+18, 3, 6-wo);

  if (player.equipment.feet) {
    ctx.fillStyle = '#665544';
    ctx.fillRect(dx+4, dy+22+wo, 3, 2);
    ctx.fillRect(dx+9, dy+22-wo, 3, 2);
  }

  // Olhos
  ctx.fillStyle = '#222';
  if (player.facing === 'down') {
    ctx.fillRect(dx+5, dy+4, 2, 2);
    ctx.fillRect(dx+9, dy+4, 2, 2);
  } else if (player.facing === 'left') {
    ctx.fillRect(dx+4, dy+4, 2, 2);
  } else if (player.facing === 'right') {
    ctx.fillRect(dx+10, dy+4, 2, 2);
  }

  // Arma
  if (player.equipment.weapon) {
    const t = player.equipment.weapon.tier;
    ctx.fillStyle = t >= 2 ? '#aaccee' : t >= 1 ? '#bbbbbb' : '#999999';
    if (player.facing === 'right') ctx.fillRect(dx+14, dy+8, 6, 2);
    else if (player.facing === 'left') ctx.fillRect(dx-4, dy+8, 6, 2);
    else if (player.facing === 'down') ctx.fillRect(dx+12, dy+10, 2, 6);
    else ctx.fillRect(dx+2, dy+2, 2, 6);
  }
}

function renderEnemy(e) {
  const etx = Math.floor(e.x / TILE), ety = Math.floor(e.y / TILE);
  if (getFog(etx, ety) < 2 && !e.isBoss && !e.isMiniBoss) return;

  if (e.dead) ctx.globalAlpha = clamp(e.deathTimer / 0.5, 0, 1);

  // GDD §10: Clone opacity (Azaroth=70%, Nahgord=100% mas real pisca branco)
  if (e.isClone && e.cloneAlpha) ctx.globalAlpha *= e.cloneAlpha;
  // GDD §10: Nahgord real pisca branco a cada 3s em F2
  if (e.realBlink) ctx.globalAlpha = 0.4;

  let sx = Math.round(e.x - camX);
  let sy = Math.round(e.y - camY);
  const w = e.def.w, h = e.def.h;

  // GDD §9 Gap#25: Regular enemy telegraph visual — sprite recua (pulls back)
  if (e.telegraphAnim && e.dir !== undefined) {
    sx -= Math.cos(e.dir) * 3;
    sy -= Math.sin(e.dir) * 3;
    // Flash white to indicate incoming attack
    ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(Date.now() / 50);
  }

  // Boss blocking indicator
  if (e.isBoss && e.blocking) {
    ctx.fillStyle = 'rgba(200,200,200,0.3)';
    ctx.fillRect(sx - w/2 - 4, sy - h - 4, w + 8, h + 8);
  }

  ctx.fillStyle = e.def.color;
  if (e.def.id === 'slime') {
    ctx.beginPath();
    ctx.ellipse(sx, sy - h/2 + 2, w/2, h/2, 0, 0, Math.PI*2);
    ctx.fill();
  } else if (e.isBoss) {
    // Boss: larger, more detailed
    ctx.fillRect(sx - w/2, sy - h + 2, w, h);
    // Armor details
    ctx.fillStyle = '#888';
    ctx.fillRect(sx - w/2 + 4, sy - h + 6, w - 8, 4);
    ctx.fillRect(sx - w/2 + 2, sy - h/2, w - 4, 3);
    // Eyes (red in phase 2)
    ctx.fillStyle = e.bossPhase >= 2 ? '#ff0000' : '#ffcc00';
    ctx.fillRect(sx - 6, sy - h + 10, 4, 4);
    ctx.fillRect(sx + 2, sy - h + 10, 4, 4);
  } else if (e.isMiniBoss) {
    // Mini-boss: Aranha Rainha
    ctx.fillRect(sx - w/2, sy - h + 2, w, h);
    // Legs
    ctx.strokeStyle = e.def.color;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const lx = (i - 1.5) * 6;
      ctx.beginPath();
      ctx.moveTo(sx + lx, sy - h/2);
      ctx.lineTo(sx + lx - 8, sy + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + lx, sy - h/2);
      ctx.lineTo(sx + lx + 8, sy + 4);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    // Red eyes
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(sx - 5, sy - h + 8, 3, 3);
    ctx.fillRect(sx + 2, sy - h + 8, 3, 3);
  } else {
    ctx.fillRect(sx - w/2, sy - h + 2, w, h);
  }

  // Eyes for regulars
  if (!e.isBoss && !e.isMiniBoss) {
    ctx.fillStyle = e.def.id === 'lobo' ? '#ffcc00' : '#ff3333';
    ctx.fillRect(sx - 3, sy - h + 6, 2, 2);
    ctx.fillRect(sx + 1, sy - h + 6, 2, 2);
  }

  ctx.globalAlpha = 1;

  // HP bar — GDD §28: Boss HP fixa no topo (renderizada em renderBossHPBar), mini-boss e regulares acima do sprite
  if (e.hpShowTimer > 0 && !e.dead && !e.isBoss) {
    const barW = Math.max(e.def.w + 4, e.isMiniBoss ? 40 : e.def.w + 4);
    const barH = 3;
    const barX = sx - barW/2;
    const barY = sy - h - 2;
    ctx.fillStyle = '#222';
    ctx.fillRect(barX-1, barY-1, barW+2, barH+2);
    const ratio = e.hp / e.maxHp;
    ctx.fillStyle = ratio > 0.5 ? '#44cc44' : ratio > 0.25 ? '#cccc00' : '#cc4444';
    ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);

    if (e.isMiniBoss) {
      ctx.fillStyle = '#fff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(e.def.name, sx, barY - 3);
      ctx.textAlign = 'left';
    }
  }
}

function renderNPC(npc) {
  const ntx = Math.floor(npc.x / TILE), nty = Math.floor(npc.y / TILE);
  if (getFog(ntx, nty) < 2) return;

  const sx = Math.round(npc.x - camX);
  const sy = Math.round(npc.y - camY);
  const w = npc.def.w, h = npc.def.h;

  // Body
  ctx.fillStyle = npc.def.color;
  ctx.fillRect(sx - w/2, sy - h + 2, w, h);

  // Head (skin)
  ctx.fillStyle = npc.id === 'lira' ? 'rgba(150,180,255,0.7)' : '#f0c8a0';
  ctx.fillRect(sx - 4, sy - h - 2, 8, 8);

  // Eyes
  ctx.fillStyle = npc.id === 'selene' ? '#ccaa00' : '#222';
  ctx.fillRect(sx - 2, sy - h + 2, 2, 2);
  ctx.fillRect(sx + 1, sy - h + 2, 2, 2);

  // Lira ghost glow
  if (npc.id === 'lira') {
    const glow = 0.15 + Math.sin(performance.now()/600) * 0.08;
    ctx.fillStyle = `rgba(100,150,255,${glow})`;
    ctx.fillRect(sx - w/2 - 4, sy - h - 6, w + 8, h + 12);
  }

  // Name tag
  ctx.fillStyle = '#fff';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(npc.def.name, sx, sy - h - 6);

  // GDD §14: botão "Falar" se perto (1.5 tiles)
  const d = distXY(player.x, player.y, npc.x, npc.y);
  if (d < TILE * 1.5) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(sx - 20, sy - h - 18, 40, 12);
    ctx.fillStyle = '#ffd700';
    ctx.font = '7px monospace';
    ctx.fillText('[Espaço]', sx, sy - h - 9);
  }
  ctx.textAlign = 'left';
}

function renderGoldPickup(g) {
  const sx = Math.round(g.x - camX);
  const sy = Math.round(g.y - camY);
  ctx.fillStyle = '#ffd700';
  ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#cc9900';
  ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI*2); ctx.fill();
}

function renderProjectile(p) {
  const sx = Math.round(p.x - camX);
  const sy = Math.round(p.y - camY);
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI*2); ctx.fill();
}

function renderParticlesLayer() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(1 - p.timer / p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x-camX-p.size/2), Math.round(p.y-camY-p.size/2), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function renderFogOverlay() {
  const sx0 = Math.max(0, Math.floor(camX / TILE));
  const sy0 = Math.max(0, Math.floor(camY / TILE));
  const sx1 = Math.min(dungeonW-1, Math.floor((camX+VIEW_W)/TILE) + 1);
  const sy1 = Math.min(dungeonH-1, Math.floor((camY+VIEW_H)/TILE) + 1);
  const ptx = Math.floor(player.x / TILE);
  const pty = Math.floor(player.y / TILE);
  for (let ty = sy0; ty <= sy1; ty++) {
    for (let tx = sx0; tx <= sx1; tx++) {
      const fog = getFog(tx, ty);
      const sx = Math.round(tx * TILE - camX);
      const sy = Math.round(ty * TILE - camY);
      if (fog === 0) {
        ctx.fillStyle = '#000';
        ctx.fillRect(sx, sy, TILE+1, TILE+1);
      } else if (fog === 1) {
        // GDD §24: explored = 50% opacity
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(sx, sy, TILE+1, TILE+1);
      } else {
        // GDD §24: FOG_FADE = 3 tiles gradiente nas bordas da visão
        const dist = Math.sqrt((tx-ptx)**2 + (ty-pty)**2);
        if (dist > FOG_RADIUS - FOG_FADE) {
          const fadeAlpha = clamp((dist - (FOG_RADIUS - FOG_FADE)) / FOG_FADE, 0, 0.6);
          if (fadeAlpha > 0.01) {
            ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
            ctx.fillRect(sx, sy, TILE+1, TILE+1);
          }
        }
      }
    }
  }
}

function renderScreenFlashOverlay() {
  if (screenFlash.alpha > 0 && screenFlash.duration > 0) {
    const fade = clamp(1 - screenFlash.timer / screenFlash.duration, 0, 1);
    ctx.globalAlpha = screenFlash.alpha * fade;
    ctx.fillStyle = screenFlash.color;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// HUD — GDD §13
// ============================================================
function renderHUD() {
  const pad = 4;

  // HP bar
  const hpW = 80, hpH = 8;
  const hpRatio = clamp(player.hp / getMaxHp(), 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(pad, pad, hpW + 6, player.classKey ? 44 : 30);
  ctx.fillStyle = '#cc4444';
  ctx.font = '7px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('HP', pad+2, pad+8);
  ctx.fillStyle = '#333';
  ctx.fillRect(pad+2, pad+11, hpW, hpH);
  ctx.fillStyle = hpRatio > 0.5 ? '#cc2222' : hpRatio > 0.25 ? '#cc8800' : '#880000';
  ctx.fillRect(pad+2, pad+11, Math.round(hpW * hpRatio), hpH);
  ctx.fillStyle = '#fff';
  ctx.fillText(`${player.hp}/${getMaxHp()}`, pad+2, pad+27);

  // GDD §13: Resource bar (só pós-A5)
  if (player.classKey) {
    const cd = CLASS_DATA[player.classKey];
    const resW = 60, resH = 6;
    const resRatio = clamp(player.resource / player.resourceMax, 0, 1);
    ctx.fillStyle = cd.resColor;
    ctx.font = '6px monospace';
    ctx.fillText(cd.resource, pad+2, pad+36);
    ctx.fillStyle = '#333';
    ctx.fillRect(pad+2, pad+38, resW, resH);
    ctx.fillStyle = cd.resColor;
    ctx.fillRect(pad+2, pad+38, Math.round(resW * resRatio), resH);
  }

  // Level + XP
  const cx = VIEW_W / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(cx-35, pad, 70, 20);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Lv.${player.level}`, cx, pad+10);
  ctx.fillStyle = '#333';
  ctx.fillRect(cx-28, pad+13, 56, 4);
  ctx.fillStyle = '#4488ff';
  ctx.fillRect(cx-28, pad+13, Math.round(56 * player.xp / getXpToNext()), 4);

  // Ouro
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(VIEW_W-68, pad, 64, 16);
  ctx.fillStyle = '#ffd700';
  ctx.beginPath(); ctx.arc(VIEW_W-60, pad+8, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${player.gold}`, VIEW_W-pad-2, pad+12);

  // GDD §21: Gold pickup floating notifications near gold counter
  for (let i = hudGoldNotifs.length - 1; i >= 0; i--) {
    const n = hudGoldNotifs[i];
    const alpha = clamp(n.timer / 0.3, 0, 1);
    const yOff = (1 - n.timer) * 20;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(n.text, VIEW_W - pad - 2, pad + 12 - yOff);
    ctx.globalAlpha = 1;
  }

  // Andar + Classe
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(VIEW_W-50, pad+20, 46, 14);
  ctx.fillStyle = '#aaa';
  ctx.font = '7px monospace';
  const classLabel = player.classKey ? CLASS_DATA[player.classKey].name : '';
  ctx.fillText(`A${currentFloor} ${classLabel}`, VIEW_W-pad-2, pad+30);

  // Consumíveis
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(pad, VIEW_H - 20, 90, 16);
  ctx.fillStyle = '#cc4444';
  ctx.textAlign = 'left';
  ctx.font = '7px monospace';
  const potCount = player.consumables.reduce((sum, c) => c.type === 'vida' ? sum + c.qty : sum, 0);
  ctx.fillText(`C:Poção x${potCount} | I:Inv`, pad+2, VIEW_H-8);

  // GDD §7: Skill bar (bottom center) — 5 slots
  if (player.classKey) {
    const sbW = 130, sbH = 18;
    const sbX = (VIEW_W - sbW) / 2, sbY = VIEW_H - sbH - 2;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(sbX, sbY, sbW, sbH);
    ctx.font = '6px monospace';
    for (let i = 0; i < 5; i++) {
      const sx = sbX + 2 + i * 26;
      const skillId = player.equippedSkills[i];
      const skill = skillId ? SKILLS[skillId] : null;
      const cd = skillId ? (player.skillCooldowns[skillId] || 0) : 0;
      // Slot background
      ctx.fillStyle = cd > 0 ? '#222' : (skill ? '#333' : '#1a1a1a');
      ctx.fillRect(sx, sbY+2, 24, 14);
      // Key number
      ctx.fillStyle = '#888';
      ctx.fillText(`${i+1}`, sx+1, sbY+9);
      if (skill) {
        // Skill abbreviation
        ctx.fillStyle = cd > 0 ? '#666' : '#fff';
        ctx.fillText(skill.name.substr(0,3), sx+8, sbY+9);
        // Cooldown
        if (cd > 0) {
          ctx.fillStyle = '#ff6666';
          ctx.fillText(Math.ceil(cd)+'s', sx+8, sbY+15);
        }
      }
    }
  }

  // GDD §8: Essência bar — staged revelation
  const essStage = getEssenciaStage(maxFloorReached);
  if (essStage >= 1) {
    const essW = 60, essH = 5;
    const essY = player.classKey ? pad + 48 : pad + 32;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    if (essStage >= 2) {
      // stage 2+: show label area
      ctx.fillRect(pad, essY, essW + 6, 12);
      ctx.fillStyle = '#999';
      ctx.font = '6px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(essStage >= 4 ? 'Essência' : '???', pad+2, essY+7);
    } else {
      // stage 1: bar only, no label
      ctx.fillRect(pad, essY+4, essW + 6, 8);
    }
    ctx.fillStyle = '#333';
    ctx.fillRect(pad+2, essY+8, essW, essH);
    ctx.fillStyle = '#ffd700';
    const essRatio = clamp(player.essencia / player.essenciaMax, 0, 1);
    ctx.fillRect(pad+2, essY+8, Math.round(essW * essRatio), essH);
  }

  // GDD §5: Status effect icons (below HP, máx 3 + 1 buff)
  const statusY = player.classKey ? pad + 62 : pad + 46;
  let sIdx = 0;
  for (const s of player.statusEffects) {
    if (sIdx >= 3) break;
    const def = STATUS_DEFS[s.id];
    const iconX = pad + sIdx * 18, iconW = 16, iconH = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(iconX, statusY, iconW, iconH);
    ctx.strokeStyle = '#cc3333'; ctx.lineWidth = 1;
    ctx.strokeRect(iconX, statusY, iconW, iconH);
    ctx.fillStyle = def.color;
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.name.substr(0,3), iconX + 8, statusY + 8);
    ctx.fillStyle = '#aaa';
    ctx.fillText(Math.ceil(s.timer)+'', iconX + 8, statusY + 13);
    // GDD §13 Gap#50: Circular countdown timer arc
    const pct = clamp(s.timer / def.dur, 0, 1);
    ctx.beginPath();
    ctx.arc(iconX + iconW / 2, statusY + iconH / 2, iconW / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct, false);
    ctx.strokeStyle = 'rgba(255,0,0,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    sIdx++;
  }
  // Buffs (borda verde)
  for (const b of player.buffs) {
    if (sIdx >= 4) break;
    const bIconX = pad + sIdx * 18, bIconW = 16, bIconH = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bIconX, statusY, bIconW, bIconH);
    ctx.strokeStyle = '#33cc33'; ctx.lineWidth = 1;
    ctx.strokeRect(bIconX, statusY, bIconW, bIconH);
    ctx.fillStyle = '#33cc33';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(b.name.substr(0,3), bIconX + 8, statusY + 8);
    ctx.fillStyle = '#aaa';
    ctx.fillText(Math.ceil(b.timer)+'', bIconX + 8, statusY + 13);
    // GDD §13 Gap#50: Circular countdown timer arc (green for buffs)
    if (!b._maxTimer) b._maxTimer = b.timer; // cache initial duration
    const bPct = clamp(b.timer / b._maxTimer, 0, 1);
    ctx.beginPath();
    ctx.arc(bIconX + bIconW / 2, statusY + bIconH / 2, bIconW / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * bPct, false);
    ctx.strokeStyle = 'rgba(50,200,50,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    sIdx++;
  }
  // Barrier indicator
  if (player.barrier > 0) {
    ctx.fillStyle = '#4488ff';
    ctx.font = '6px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Barr:${player.barrier}`, pad, statusY + 22);
  }

  ctx.textAlign = 'left';
}

// GDD §28: Boss HP bar fixa no topo do canvas, ~60% largura
// Phase flash tracker for border glow on phase transition
let _bossPhaseFlash = { lastPhase: 0, timer: 0, duration: 0.1 };

function renderBossHPBar() {
  const boss = enemies.find(e => e.isBoss && !e.dead);
  if (!boss) { _bossPhaseFlash.lastPhase = 0; return; }
  const barW = Math.floor(VIEW_W * 0.6);
  const barH = 8;
  const barX = Math.floor((VIEW_W - barW) / 2);
  const barY = 28;
  // GDD §28: Phase indicator — determine current phase and max phases
  const phase = boss.bossPhase || 1;
  const isNahgord = boss.def.id === 'nahgord';
  const maxPhase = isNahgord ? 3 : 2;

  // GDD §28 M7.2: Detect phase transition and trigger flash
  if (_bossPhaseFlash.lastPhase > 0 && phase !== _bossPhaseFlash.lastPhase) {
    _bossPhaseFlash.timer = _bossPhaseFlash.duration;
  }
  _bossPhaseFlash.lastPhase = phase;
  // Tick flash timer (uses ~16ms frame time)
  if (_bossPhaseFlash.timer > 0) {
    _bossPhaseFlash.timer = Math.max(0, _bossPhaseFlash.timer - 1/60);
  }

  // GDD §28: Border color changes per phase
  const biome = getBiome(currentFloor);
  let borderColor = phase === 1 ? (biome.wallTop || '#443322')
    : phase === 2 ? '#cc4400'
    : '#440066';

  // GDD §28 M7.2: White flash override on border during phase transition
  const isFlashing = _bossPhaseFlash.timer > 0;
  if (isFlashing) {
    borderColor = '#ffffff';
  }

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(barX - 2, barY - 12, barW + 4, barH + 24);
  // GDD §28: Border with phase-based color (+ flash glow)
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = isFlashing ? 3 : 2;
  ctx.strokeRect(barX - 2, barY - 12, barW + 4, barH + 24);
  // Name + phase indicator (e.g. "Thornax — F1/F2")
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  const phaseLabel = 'F' + phase + '/' + 'F' + maxPhase;
  ctx.fillText(boss.def.name + ' \u2014 ' + phaseLabel, VIEW_W / 2, barY - 2);
  // Bar bg
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barW, barH);
  // Bar fill
  const ratio = boss.hp / boss.maxHp;
  ctx.fillStyle = ratio > 0.5 ? '#cc2222' : ratio > 0.25 ? '#cc8800' : '#880000';
  ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);
  // HP text
  ctx.fillStyle = '#fff';
  ctx.font = '6px monospace';
  ctx.fillText(`${boss.hp} / ${boss.maxHp}`, VIEW_W / 2, barY + barH + 8);

  // GDD §28 M7.2: Phase dots — filled/empty circles showing total phases and current phase
  const dotRadius = 3;
  const dotSpacing = 12;
  const dotsY = barY + barH + 16;
  const dotsStartX = VIEW_W / 2 - ((maxPhase - 1) * dotSpacing) / 2;
  for (let i = 1; i <= maxPhase; i++) {
    const dx = dotsStartX + (i - 1) * dotSpacing;
    ctx.beginPath();
    ctx.arc(dx, dotsY, dotRadius, 0, Math.PI * 2);
    if (i <= phase) {
      // Filled dot — current or past phase
      ctx.fillStyle = i === phase ? borderColor : '#888';
      ctx.fill();
    } else {
      // Empty dot — future phase
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  ctx.textAlign = 'left';
}

// ============================================================
// RENDER: Player Projectiles, Familiar, Sentinels, Traps, Meteors
// ============================================================
function renderPlayerProjectiles() {
  for (const p of playerProjectiles) {
    const sx = Math.round(p.x - camX), sy = Math.round(p.y - camY);
    ctx.fillStyle = p.color || '#ff6600';
    ctx.beginPath();
    ctx.arc(sx, sy, p.size || 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderFamiliar() {
  if (!player.familiar) return;
  const sx = Math.round(player.familiar.x - camX);
  const sy = Math.round(player.familiar.y - camY);
  ctx.fillStyle = '#8888ff';
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(sx, sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function renderSentinels() {
  for (const s of player.sentinels) {
    const sx = Math.round(s.x - camX), sy = Math.round(s.y - camY);
    ctx.fillStyle = '#44cc44';
    ctx.fillRect(sx - 4, sy - 6, 8, 12);
    ctx.fillStyle = '#88ee88';
    ctx.fillRect(sx - 2, sy - 4, 4, 4);
  }
}

function renderTraps() {
  for (const t of activeTraps) {
    if (t.triggered) continue;
    const sx = Math.round(t.x - camX), sy = Math.round(t.y - camY);
    ctx.fillStyle = 'rgba(255,170,0,0.3)';
    ctx.fillRect(sx - 8, sy - 8, 16, 16);
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 8, sy - 8, 16, 16);
  }
}

function renderMeteors() {
  for (const m of activeMeteors) {
    const sx = Math.round(m.x - camX), sy = Math.round(m.y - camY);
    const r = m.radius || TILE * 1.5;
    if (!m.exploded) {
      // Telegraph circle — GDD §10 Gap#26: use m.color if provided
      const pulse = 0.3 + 0.3 * Math.sin(Date.now()/100);
      if (m.color) {
        // Parse hex color to rgba
        const hex = m.color;
        const cr = parseInt(hex.slice(1,3),16), cg = parseInt(hex.slice(3,5),16), cb = parseInt(hex.slice(5,7),16);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${pulse})`;
      } else {
        ctx.fillStyle = `rgba(255,68,0,${pulse})`;
      }
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      // GDD §10 Gap#26: Red border for better visibility
      ctx.strokeStyle = m.color || '#ff4400';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Explosion
      ctx.fillStyle = 'rgba(255,100,0,0.5)';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // GDD §10 Gap#26: Mini-boss seismic telegraph zones (Golem Arcano)
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.seismicTelegraph) {
      const st = e.seismicTelegraph;
      const sx = Math.round(st.x - camX), sy = Math.round(st.y - camY);
      const pulse = 0.2 + 0.4 * Math.sin(Date.now()/80);
      ctx.fillStyle = `rgba(255,68,51,${pulse})`;
      ctx.beginPath();
      ctx.arc(sx, sy, st.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff4433';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

// ============================================================
// GDD §29: End Cutscene — Sombra Misteriosa (10 scenes, typewriter)
// ============================================================
function renderEndCutscene() {
  if (!endCutsceneState) return;
  const sc = endCutsceneState;
  const scene = sc.scenes[sc.sceneIndex];
  if (!scene) return;

  const t = performance.now() / 1000;

  // Dark background with gradient
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Scene-specific dark gradient
  const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, scene.bgTop || 'rgba(5,0,15,1)');
  grd.addColorStop(0.5, scene.bgMid || 'rgba(10,2,25,1)');
  grd.addColorStop(1, scene.bgBot || 'rgba(3,0,8,1)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Screen shake effect
  if (sc.shakeTimer > 0) {
    const shakeAmt = sc.shakeIntensity * (sc.shakeTimer / sc.shakeDuration);
    ctx.save();
    ctx.translate(
      Math.round((Math.random() - 0.5) * shakeAmt * 2),
      Math.round((Math.random() - 0.5) * shakeAmt * 2)
    );
  }

  // Dark particles for Sombra scenes
  if (scene.darkParticles) {
    for (const p of sc.particles) {
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.min(1, p.life) * 0.7;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Sombra visual — amorphous dark mass in center
  if (scene.showSombra) {
    const pulseA = 0.3 + 0.15 * Math.sin(t * 2);
    ctx.globalAlpha = pulseA;
    // Multiple overlapping dark circles for amorphous shape
    for (let i = 0; i < 5; i++) {
      const ox = Math.sin(t * 1.3 + i * 1.2) * 8;
      const oy = Math.cos(t * 0.9 + i * 0.8) * 6;
      const r = 25 + Math.sin(t * 1.5 + i) * 8;
      ctx.fillStyle = '#0a0018';
      ctx.beginPath();
      ctx.arc(VIEW_W / 2 + ox, VIEW_H * 0.35 + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dark core
    ctx.globalAlpha = pulseA + 0.2;
    ctx.fillStyle = '#050010';
    ctx.beginPath();
    ctx.arc(VIEW_W / 2, VIEW_H * 0.35, 15, 0, Math.PI * 2);
    ctx.fill();
    // Glowing edges
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#6600aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(VIEW_W / 2, VIEW_H * 0.35, 30 + Math.sin(t * 2) * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Droghan and Damiana silhouettes for emotional scenes
  if (scene.showEmbrace) {
    ctx.globalAlpha = 0.6;
    // Two figures embracing (simple pixel silhouettes)
    ctx.fillStyle = '#f0c8a0';
    ctx.fillRect(VIEW_W / 2 - 10, VIEW_H * 0.35, 8, 20);   // Droghan
    ctx.fillRect(VIEW_W / 2 - 8, VIEW_H * 0.33, 6, 6);      // head
    ctx.fillStyle = '#ffccee';
    ctx.fillRect(VIEW_W / 2 + 2, VIEW_H * 0.35, 7, 18);     // Damiana
    ctx.fillRect(VIEW_W / 2 + 3, VIEW_H * 0.33, 5, 6);      // head
    ctx.globalAlpha = 1;
  }

  if (sc.shakeTimer > 0) {
    ctx.restore();
  }

  // Text box at bottom — dark panel
  const textBoxY = VIEW_H - 80;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(10, textBoxY, VIEW_W - 20, 70);
  ctx.strokeStyle = scene.speakerColor || '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, textBoxY, VIEW_W - 20, 70);

  // Speaker name
  if (scene.speaker) {
    ctx.fillStyle = scene.speakerColor || '#aaa';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(scene.speaker, 18, textBoxY + 12);
  }

  // Typewriter text
  const displayLen = Math.min(scene.text.length, sc.charIndex);
  const displayText = scene.text.substring(0, displayLen);
  ctx.fillStyle = '#ddd';
  ctx.font = '7px monospace';
  ctx.textAlign = 'left';

  // Word wrap
  const maxLineW = VIEW_W - 44;
  const words = displayText.split(' ');
  let line = '';
  let lineY = textBoxY + (scene.speaker ? 24 : 16);
  const lineH = 10;
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > maxLineW && line) {
      ctx.fillText(line, 18, lineY);
      line = word;
      lineY += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 18, lineY);

  // Blinking cursor if still typing
  if (displayLen < scene.text.length) {
    if (Math.floor(t * 3) % 2 === 0) {
      const cursorX = 18 + ctx.measureText(line).width + 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(cursorX, lineY - 6, 4, 7);
    }
  }

  // "Continue" hint when text complete
  if (displayLen >= scene.text.length) {
    ctx.fillStyle = Math.floor(t * 2) % 2 === 0 ? '#888' : '#555';
    ctx.font = '6px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Clique / Space / Enter ▶', VIEW_W - 18, VIEW_H - 14);
  }

  // Scene counter
  ctx.fillStyle = '#333';
  ctx.font = '6px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${sc.sceneIndex + 1} / ${sc.scenes.length}`, VIEW_W - 14, 12);

  ctx.textAlign = 'left';
}

// ============================================================
// GDD §29: Credits Screen — standalone gameState 'credits'
// ============================================================
function renderCreditsScreen() {
  if (!creditsState) return;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const credits = [
    '',
    'The Shadow of Droghan',
    '',
    '———————————',
    '',
    'Criado por Igor',
    '',
    '———————————',
    '',
    'Game Design & Programming',
    'Igor',
    '',
    'Pixel Art Assets',
    'Ninja Adventure — Pixel-Boy & AAA',
    'DungeonTileset II — 0x72',
    'Zelda-like Tilesets — ArMM1998',
    'Roguelike/RPG Pack — Kenney',
    '',
    '———————————',
    '',
    'Agradecimentos Especiais',
    'A todos que jogaram e testaram',
    '',
    '———————————',
    '',
    'Capítulo 2 em breve...',
    '',
    '',
    'Obrigado por jogar!',
    '',
    '',
    '',
  ];

  ctx.textAlign = 'center';
  ctx.font = '10px monospace';
  let y = creditsState.scrollY;

  for (let i = 0; i < credits.length; i++) {
    const lineY = y + i * 22;
    if (lineY < -20 || lineY > VIEW_H + 20) continue;

    // Fade at edges
    const distFromCenter = Math.abs(lineY - VIEW_H / 2);
    const alpha = Math.max(0.1, 1 - distFromCenter / (VIEW_H / 2));
    ctx.globalAlpha = alpha;

    if (credits[i] === 'The Shadow of Droghan') {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px monospace';
    } else if (credits[i] === 'Capítulo 2 em breve...') {
      ctx.fillStyle = '#aa88cc';
      ctx.font = 'bold 10px monospace';
    } else if (credits[i].startsWith('———')) {
      ctx.fillStyle = '#444';
      ctx.font = '8px monospace';
    } else {
      ctx.fillStyle = '#ccc';
      ctx.font = '9px monospace';
    }

    ctx.fillText(credits[i], VIEW_W / 2, lineY);
  }

  ctx.globalAlpha = 1;

  // Hint to skip
  ctx.fillStyle = '#555';
  ctx.font = '6px monospace';
  ctx.fillText('Clique ou ESC para pular', VIEW_W / 2, VIEW_H - 6);

  ctx.textAlign = 'left';

  // Auto-scroll
  creditsState.scrollY -= 0.8;

  // If all credits scrolled past, return to victory
  const totalH = credits.length * 22;
  if (creditsState.scrollY + totalH < -20) {
    creditsState = null;
    gameState = 'victory';
  }
}
