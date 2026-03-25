'use strict';
// ui.js — Dialogue, Cutscenes, Shop, Inventory, Skill Menu, All UI Renders, Input Handlers, Menu Screens

// ============================================================
// GDD §20: Causa da morte + Pedra da Alma
// ============================================================
let deathCause = '';        // Rastreado em combat/dungeon: nome do inimigo ou perigo
let deathSoulStonePrompt = false; // true = mostrando prompt "Usar Pedra da Alma?"
let deathScreenInitialized = false; // para detectar primeiro render da tela de morte

// GDD §20: NPC floors para "Voltar ao Acampamento"
const NPC_FLOORS = [2,4,5,7,8,9,10,11,12,14,15,17,19,20,22,23,24];
// Selene:2,5,8,11,14,17,20,23 | Bron:4,9,14,19,24 | Kaelith:5,10,15,20 | Lira:2,7,12,17,22

// ============================================================
// DIALOGUE SYSTEM — GDD §11
// ============================================================
let dialogState = null;
// {lines: string[], index:0, charIndex:0, charTimer:0, speaker:'', portrait_color:'', onEnd:fn}

function startDialogue(speaker, color, lines, onEnd) {
  dialogState = {
    lines, index: 0, charIndex: 0, charTimer: 0,
    speaker, portrait_color: color, onEnd: onEnd || null,
  };
  gameState = 'dialogue';
}

function updateDialogue(dt) {
  if (!dialogState) return;
  // GDD §11: Typewriter ~30 chars/s
  dialogState.charTimer += dt;
  const line = dialogState.lines[dialogState.index];
  if (dialogState.charIndex < line.length) {
    dialogState.charIndex = Math.min(line.length, Math.floor(dialogState.charTimer * 30));
    // SFX bleep every few chars
    if (dialogState.charIndex % 3 === 0) sfx('npcTalk', 0.04);
  }
}

function advanceDialogue() {
  if (!dialogState) return;
  const line = dialogState.lines[dialogState.index];
  if (dialogState.charIndex < line.length) {
    // GDD §11: Click quando incompleto → mostra tudo
    dialogState.charIndex = line.length;
  } else {
    // Avança para próxima linha
    dialogState.index++;
    dialogState.charIndex = 0;
    dialogState.charTimer = 0;
    if (dialogState.index >= dialogState.lines.length) {
      // Fim do diálogo
      const onEnd = dialogState.onEnd;
      dialogState = null;
      gameState = 'playing';
      if (onEnd) onEnd();
    }
  }
}

// GDD §2/§11: Cutscenes pós-boss (Nahgord provocações + Kaelith spawn)
function triggerBossCutscene(floor) {
  if (floor === 5) {
    // A5 cutscene já existe em handleClassSelectInput (Nahgord fala + Droghan responde)
    return;
  }
  if (floor === 10 && !player.dialogsSeen['nahgordA10']) {
    player.dialogsSeen['nahgordA10'] = true;
    // GDD §2: Nahgord A10 — aparece como sombra
    startDialogue('Nahgord', '#5500aa', [
      'Continue vindo.',
      'Cada passo te aproxima dela... e de mim.'
    ], () => {
      startDialogue('Droghan', '#f0c8a0', ['Vou te encontrar.'], null);
    });
  }
  if (floor === 15 && !player.dialogsSeen['nahgordA15']) {
    player.dialogsSeen['nahgordA15'] = true;
    // GDD §2: Nahgord A15 — projeção no centro da sala
    startDialogue('Nahgord', '#5500aa', [
      'Sinto seu poder crescendo.',
      'Exatamente como planejei.'
    ], () => {
      startDialogue('Droghan', '#f0c8a0', ['Você não me controla.'], null);
    });
  }
  if (floor === 20 && !player.dialogsSeen['nahgordA20']) {
    player.dialogsSeen['nahgordA20'] = true;
    // GDD §2: Nahgord A20 — cutscene com Damiana presa
    startDialogue('Nahgord', '#5500aa', [
      'Ela está esperando.',
      'Não a decepcione.'
    ], () => {
      startDialogue('Droghan', '#f0c8a0', ['Aguenta firme, mãe...'], null);
    });
  }
  // GDD §10: A25 Nahgord cutscene — handled by the Nahgord F3 phase transition + final sequence
}

// GDD §11: Cutscene A14 — Selene + Bron juntos ("Preparação")
function triggerA14Cutscene() {
  if (player.dialogsSeen['cutsceneA14']) return;
  player.dialogsSeen['cutsceneA14'] = true;
  startDialogue('Selene', '#9966cc', [
    'Bron! Olha quem chegou. Nosso aventureiro favorito.'
  ], () => {
    startDialogue('Bron', '#cc6633', ['Hmm. Parece mais forte. Bom.'], () => {
      startDialogue('Selene', '#9966cc', [
        'O que tem lá embaixo não é brincadeira.',
        'Eu vi coisas... ruínas antigas, cristais que brilham sozinhos.'
      ], () => {
        startDialogue('Bron', '#cc6633', ['Trouxe meu melhor aço pra você. Vai precisar.'], () => {
          startDialogue('Droghan', '#f0c8a0', ['Obrigado. Pelos dois.'], () => {
            startDialogue('Selene', '#9966cc', [
              'Ei, nada de morrer lá embaixo.',
              'Quem vai comprar minhas poções caras?'
            ], () => {
              startDialogue('Bron', '#cc6633', ['*ri baixo* Boa sorte, garoto.'], null);
            });
          });
        });
      });
    });
  });
}

// GDD §10: Nahgord F3 Cutscene — Damiana, poder desperta, full heal, ultimate
function triggerNahgordF3Cutscene(nahgord) {
  gameState = 'cutscene';
  nahgord.invulnerable = true; // não morre durante cutscene
  startDialogue('Damiana', '#ffccee', [
    'DROGHAN! NÃO!',
    'Meu filho... eu sabia que você viria...'
  ], () => {
    startDialogue('', '#ffffff', [
      'Um poder ancestral desperta dentro de Droghan...',
      'Toda dor, toda luta, todo sacrifício — tudo converge neste momento.'
    ], () => {
      // GDD §10: HP 100% + recurso 100% + essência 100% + cooldowns resetados
      player.hp = getMaxHp();
      if (player.resource !== undefined) player.resource = player.maxResource || 100;
      player.essencia = player.essenciaMax;
      // Reset cooldowns — GDD §12: Nahgord F3 reseta todos os CDs
      for (const key of Object.keys(player.skillCooldowns)) {
        player.skillCooldowns[key] = 0;
      }
      // Visual feedback
      shakeScreen(6, 0.5);
      flashScreen('#ffffff', 0.5, 0.5);
      for (let i=0;i<20;i++) particles.push({x:player.x,y:player.y,vx:(Math.random()-0.5)*80,vy:(Math.random()-0.5)*80,color:'#ffdd44',size:3,life:0.8,timer:0});
      damageNumbers.push({x:player.x, y:player.y-30, text:'Despertar Total!', color:'#ffdd44', size:10, timer:2, vy:-15});
      startDialogue('Droghan', '#f0c8a0', [
        'Agora eu entendo.',
        'Solta a minha mãe.'
      ], () => {
        nahgord.invulnerable = false;
        gameState = 'playing';
        // GDD §10: Nahgord frenético — +50% vel, +30% atk
        nahgord.speed *= 1.5;
        nahgord.atk = Math.round(nahgord.atk * 1.3);
      });
    });
  });
}

// GDD §10/§29: Nahgord death — Sombra Misteriosa cutscene completa, Fim do Capítulo 1
// Victory screen state
let victoryState = null;
// {cursor:0, buttons:['explore','menu','share'], showCredits:false, creditsY:0}

function triggerNahgordDeathCutscene() {
  // GDD §29: Dedicated end cutscene with 10 scenes, typewriter, dark effects
  startEndCutscene();
}

// GDD §29: Handle victory screen input — cursor navigation between buttons
function handleVictoryInput() {
  if (!victoryState) return;

  // Navigate buttons
  if (keys['ArrowLeft'] || keys['KeyA']) {
    keys['ArrowLeft'] = false; keys['KeyA'] = false;
    victoryState.cursor = (victoryState.cursor - 1 + victoryState.buttons.length) % victoryState.buttons.length;
  }
  if (keys['ArrowRight'] || keys['KeyD']) {
    keys['ArrowRight'] = false; keys['KeyD'] = false;
    victoryState.cursor = (victoryState.cursor + 1) % victoryState.buttons.length;
  }
  if (keys['ArrowUp'] || keys['KeyW']) {
    keys['ArrowUp'] = false; keys['KeyW'] = false;
    victoryState.cursor = (victoryState.cursor - 1 + victoryState.buttons.length) % victoryState.buttons.length;
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    keys['ArrowDown'] = false; keys['KeyS'] = false;
    victoryState.cursor = (victoryState.cursor + 1) % victoryState.buttons.length;
  }

  // Select button
  if (keys['Enter'] || keys['Space'] || mouseClicked) {
    keys['Enter'] = false; keys['Space'] = false; mouseClicked = false;
    const selected = victoryState.buttons[victoryState.cursor];

    if (selected === 'explore') {
      // GDD §29: "Continuar Explorando" — return to A25, free roam
      player.gameCompleted = true;
      victoryState = null;
      currentFloor = 25;
      startFloor(25);
      triggerSave();
      // Player keeps everything, enemies normal levels
    } else if (selected === 'menu') {
      // GDD §29: "Menu Principal"
      player.gameCompleted = true;
      victoryState = null;
      triggerSave();
      gameState = 'mainMenu';
      menuState.cursor = 0;
    } else if (selected === 'share') {
      // GDD §29: "Compartilhar" — copy stats to clipboard
      const mins = Math.floor(player.tempoJogado / 60);
      const hrs = Math.floor(mins / 60);
      const shareText = `The Shadow of Droghan — Capítulo 1 Completo!\n` +
        `Classe: ${player.classKey ? CLASS_DATA[player.classKey].name : '?'} Lv.${player.level}\n` +
        `Tempo: ${hrs}h${(mins % 60).toString().padStart(2, '0')}m | Mortes: ${player.deaths}\n` +
        `Inimigos: ${player.enemiesKilled} | Ouro: ${player.ouroTotal}\n` +
        `Badges: ${player.badges.length}`;
      navigator.clipboard.writeText(shareText).catch(() => {});
      damageNumbers.push({ x: VIEW_W / 2, y: VIEW_H / 2, text: 'Copiado!', color: '#44cc44', size: 10, timer: 1.5, vy: -15 });
    } else if (selected === 'credits') {
      // GDD §29: Open credits as standalone screen
      startCredits();
    }
  }
}

// ============================================================
// GDD §29: End Cutscene — Sombra Misteriosa (10 scenes, typewriter)
// ============================================================
let endCutsceneState = null;
// {sceneIndex, charIndex, charTimer, scenes[], particles[], shakeTimer, shakeIntensity, shakeDuration}

function startEndCutscene() {
  const scenes = [
    {
      text: 'Droghan prepara o golpe final. A câmera trava. O tempo desacelera.',
      speaker: '', speakerColor: '#888',
      bgTop: 'rgba(5,0,15,1)', bgMid: 'rgba(10,2,25,1)', bgBot: 'rgba(3,0,8,1)',
      darkParticles: false, showSombra: false, showEmbrace: false,
      shake: 4, shakeDur: 1.0,
    },
    {
      text: 'Uma presença inimaginável invade a sala... A escuridão pura toma forma — sem rosto, sem contorno definido. Puro poder sombrio. O ar congela.',
      speaker: '', speakerColor: '#1a0033',
      bgTop: 'rgba(2,0,8,1)', bgMid: 'rgba(5,0,15,1)', bgBot: 'rgba(1,0,4,1)',
      darkParticles: true, showSombra: true, showEmbrace: false,
      shake: 8, shakeDur: 1.5,
    },
    {
      text: 'A Sombra ergue uma mão e segura o golpe de Droghan sem esforço algum. Uma onda de energia empurra Droghan para trás.',
      speaker: '', speakerColor: '#ffffff',
      bgTop: 'rgba(3,0,10,1)', bgMid: 'rgba(8,0,20,1)', bgBot: 'rgba(2,0,6,1)',
      darkParticles: true, showSombra: true, showEmbrace: false,
      shake: 10, shakeDur: 0.8,
    },
    {
      text: 'Patético. Não consegue fazer uma tarefa simples.',
      speaker: 'Sombra Misteriosa', speakerColor: '#1a0033',
      bgTop: 'rgba(2,0,8,1)', bgMid: 'rgba(5,0,15,1)', bgBot: 'rgba(1,0,4,1)',
      darkParticles: true, showSombra: true, showEmbrace: false,
      shake: 0, shakeDur: 0,
    },
    {
      text: 'Mestre... eu...',
      speaker: 'Nahgord', speakerColor: '#5500aa',
      bgTop: 'rgba(3,0,10,1)', bgMid: 'rgba(8,0,20,1)', bgBot: 'rgba(2,0,6,1)',
      darkParticles: true, showSombra: true, showEmbrace: false,
      shake: 0, shakeDur: 0,
    },
    {
      text: 'A Sombra agarra Nahgord pelo pescoço. Ambos desaparecem nas trevas, sem deixar rastro.',
      speaker: '', speakerColor: '#444',
      bgTop: 'rgba(1,0,4,1)', bgMid: 'rgba(3,0,8,1)', bgBot: 'rgba(0,0,2,1)',
      darkParticles: true, showSombra: false, showEmbrace: false,
      shake: 6, shakeDur: 0.6,
    },
    {
      text: 'As correntes de Damiana se desfazem. A escuridão se dissipa. Damiana corre até Droghan. Mãe e filho se abraçam.',
      speaker: '', speakerColor: '#ffccee',
      bgTop: 'rgba(10,5,20,1)', bgMid: 'rgba(15,8,25,1)', bgBot: 'rgba(8,3,15,1)',
      darkParticles: false, showSombra: false, showEmbrace: true,
      shake: 0, shakeDur: 0,
    },
    {
      text: 'Droghan... meu filho... você cresceu tanto. Eu sempre soube que você viria.',
      speaker: 'Damiana', speakerColor: '#ffccee',
      bgTop: 'rgba(12,6,22,1)', bgMid: 'rgba(18,10,30,1)', bgBot: 'rgba(8,3,15,1)',
      darkParticles: false, showSombra: false, showEmbrace: true,
      shake: 0, shakeDur: 0,
    },
    {
      text: 'Quem... era aquele?',
      speaker: 'Droghan', speakerColor: '#f0c8a0',
      bgTop: 'rgba(10,5,18,1)', bgMid: 'rgba(15,8,25,1)', bgBot: 'rgba(6,2,12,1)',
      darkParticles: false, showSombra: false, showEmbrace: true,
      shake: 0, shakeDur: 0,
    },
    {
      text: 'Algo muito pior do que Nahgord.',
      speaker: 'Damiana', speakerColor: '#ffccee',
      bgTop: 'rgba(5,2,10,1)', bgMid: 'rgba(8,4,18,1)', bgBot: 'rgba(2,0,5,1)',
      darkParticles: false, showSombra: false, showEmbrace: true,
      shake: 0, shakeDur: 0,
    },
  ];

  endCutsceneState = {
    sceneIndex: 0,
    charIndex: 0,
    charTimer: 0,
    scenes,
    particles: [],
    shakeTimer: 0,
    shakeIntensity: 0,
    shakeDuration: 0,
  };

  // Trigger initial shake
  if (scenes[0].shake) {
    endCutsceneState.shakeTimer = scenes[0].shakeDur;
    endCutsceneState.shakeIntensity = scenes[0].shake;
    endCutsceneState.shakeDuration = scenes[0].shakeDur;
  }

  gameState = 'endCutscene';
}

function updateEndCutscene(dt) {
  if (!endCutsceneState) return;
  const sc = endCutsceneState;
  const scene = sc.scenes[sc.sceneIndex];
  if (!scene) return;

  // Typewriter — ~25 chars/s
  sc.charTimer += dt;
  if (sc.charIndex < scene.text.length) {
    sc.charIndex = Math.min(scene.text.length, Math.floor(sc.charTimer * 25));
    // SFX bleep every few chars
    if (sc.charIndex % 4 === 0) sfx('npcTalk', 0.03);
  }

  // Screen shake decay
  if (sc.shakeTimer > 0) {
    sc.shakeTimer = Math.max(0, sc.shakeTimer - dt);
  }

  // Dark particles update
  if (scene.darkParticles) {
    // Spawn new particles
    if (Math.random() < 0.3) {
      sc.particles.push({
        x: Math.random() * VIEW_W,
        y: VIEW_H + 5,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 40,
        color: Math.random() < 0.5 ? '#1a0033' : '#330066',
        size: 2 + Math.random() * 3,
        life: 1.5 + Math.random(),
      });
    }
    for (const p of sc.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    sc.particles = sc.particles.filter(p => p.life > 0);
  }
}

function advanceEndCutscene() {
  if (!endCutsceneState) return;
  const sc = endCutsceneState;
  const scene = sc.scenes[sc.sceneIndex];
  if (!scene) return;

  if (sc.charIndex < scene.text.length) {
    // Show all text immediately
    sc.charIndex = scene.text.length;
  } else {
    // Advance to next scene
    sc.sceneIndex++;
    sc.charIndex = 0;
    sc.charTimer = 0;
    sc.particles = [];

    if (sc.sceneIndex >= sc.scenes.length) {
      // Cutscene finished → transition to victory screen
      endCutsceneState = null;
      if (!player.gameCompleted) player.runsCompletas = (player.runsCompletas || 0) + 1;
      player.gameCompleted = true;
      checkBadges('victory');
      submitToLeaderboard();
      // Initialize victory screen state
      victoryState = {
        cursor: 0,
        buttons: ['explore', 'menu', 'share', 'credits'],
        showCredits: false,
        creditsY: VIEW_H,
        leaderboardData: null,
        leaderboardLoading: true,
        playerRank: null,
      };
      // Fetch leaderboard async
      getLeaderboard(20).then(data => {
        if (!victoryState) return;
        victoryState.leaderboardData = data || [];
        victoryState.leaderboardLoading = false;
        if (data && data.length > 0) {
          const playerName = typeof playerNickname !== 'undefined' ? playerNickname : '';
          const idx = data.findIndex(r => r.nome === playerName);
          victoryState.playerRank = idx >= 0 ? idx + 1 : null;
        }
      }).catch(() => {
        if (victoryState) victoryState.leaderboardLoading = false;
      });
      triggerSave();
      gameState = 'victory';
    } else {
      // Setup shake for next scene
      const next = sc.scenes[sc.sceneIndex];
      if (next.shake) {
        sc.shakeTimer = next.shakeDur;
        sc.shakeIntensity = next.shake;
        sc.shakeDuration = next.shakeDur;
      }
    }
  }
}

// ============================================================
// GDD §29: Credits — standalone gameState
// ============================================================
let creditsState = null;
// {scrollY: number}

function startCredits() {
  creditsState = { scrollY: VIEW_H };
  gameState = 'credits';
  if (typeof startCreditsMusic === 'function') startCreditsMusic();
}

function skipCredits() {
  creditsState = null;
  gameState = 'victory';
}

// GDD §29: Input handler for endCutscene state
function handleEndCutsceneInput() {
  if (!endCutsceneState) return;
  if (keys['Enter'] || keys['Space'] || mouseClicked) {
    keys['Enter'] = false; keys['Space'] = false; mouseClicked = false;
    advanceEndCutscene();
  }
}

// GDD §29: Input handler for credits state
function handleCreditsInput() {
  if (!creditsState) return;
  if (keys['Escape'] || keys['Space'] || keys['Enter'] || mouseClicked) {
    keys['Escape'] = false; keys['Space'] = false; keys['Enter'] = false; mouseClicked = false;
    skipCredits();
  }
}

// ============================================================
// GDD §11: Opening Cutscene "A Profecia" — 7 scenes, visual novel style
// NOTE: main.js needs to add state check: if (gameState === 'openingCutscene') { updateOpeningCutscene(dt); renderOpeningCutscene(); handleOpeningCutsceneInput(); }
// ============================================================
let openingCutsceneState = null;
// {sceneIndex, charIndex, charTimer, scenes[], fadeAlpha, fadeDir, skipHover}

function startOpeningCutscene() {
  const scenes = [
    {
      title: 'Cena 1 — O Nascimento',
      lines: [
        'Uma tempestade rugia sobre a aldeia de Eryn.',
        'Na casa de Aldric e Damiana, um bebê nasceu brilhando em ouro.',
        'Os anciãos murmuraram: "O Herdeiro da Essência."',
        'Aldric chorou de alegria. Ao fundo, Nahgord observava em silêncio.',
      ],
      bgDraw: (ctx, W, H) => {
        // Storm sky
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#0a0a1a'); g.addColorStop(0.4, '#1a1a3a'); g.addColorStop(1, '#0d0d20');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // Lightning
        ctx.strokeStyle = 'rgba(255,255,200,0.3)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W*0.7, 0); ctx.lineTo(W*0.65, H*0.2); ctx.lineTo(W*0.72, H*0.35); ctx.stroke();
        // House
        ctx.fillStyle = '#2a2015'; ctx.fillRect(W*0.3, H*0.4, W*0.4, H*0.35);
        ctx.fillStyle = '#3a2a1a';
        ctx.beginPath(); ctx.moveTo(W*0.25, H*0.4); ctx.lineTo(W*0.5, H*0.2); ctx.lineTo(W*0.75, H*0.4); ctx.fill();
        // Golden glow (baby)
        ctx.fillStyle = 'rgba(255,215,0,0.15)';
        ctx.beginPath(); ctx.arc(W*0.5, H*0.55, 30, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.beginPath(); ctx.arc(W*0.5, H*0.55, 12, 0, Math.PI*2); ctx.fill();
      },
    },
    {
      title: 'Cena 2 — Infância',
      lines: [
        'Aldric treinava o jovem Droghan no quintal.',
        'Espadas de madeira, risadas ao sol.',
        'Dias simples. Dias felizes.',
      ],
      bgDraw: (ctx, W, H) => {
        // Sunny sky
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#4488cc'); g.addColorStop(0.6, '#66aadd'); g.addColorStop(1, '#2d5a1e');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // Sun
        ctx.fillStyle = '#ffdd44';
        ctx.beginPath(); ctx.arc(W*0.8, H*0.15, 20, 0, Math.PI*2); ctx.fill();
        // Grass
        ctx.fillStyle = '#3a7a2a'; ctx.fillRect(0, H*0.65, W, H*0.35);
        // Aldric (tall figure)
        ctx.fillStyle = '#5a3a2a'; ctx.fillRect(W*0.35, H*0.4, 12, 24);
        ctx.fillStyle = '#f0c8a0'; ctx.fillRect(W*0.36, H*0.35, 10, 8);
        // Young Droghan (small)
        ctx.fillStyle = '#4a4a6a'; ctx.fillRect(W*0.55, H*0.5, 8, 16);
        ctx.fillStyle = '#f0c8a0'; ctx.fillRect(W*0.56, H*0.46, 6, 6);
        // Wooden swords
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W*0.34, H*0.45); ctx.lineTo(W*0.28, H*0.35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W*0.58, H*0.52); ctx.lineTo(W*0.64, H*0.44); ctx.stroke();
      },
    },
    {
      title: 'Cena 3 — Morte do Pai',
      lines: [
        'Uma lápide solitária sob a chuva.',
        'Damiana segurava Droghan, ambos em lágrimas.',
        'Atrás deles, Nahgord surgiu: "Eu cuido dele, irmã."',
      ],
      bgDraw: (ctx, W, H) => {
        // Rainy grey sky
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#2a2a3a'); g.addColorStop(0.5, '#3a3a4a'); g.addColorStop(1, '#1a2a1a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // Rain
        ctx.strokeStyle = 'rgba(150,170,200,0.3)'; ctx.lineWidth = 1;
        for (let i = 0; i < 30; i++) {
          const rx = Math.random() * W, ry = Math.random() * H;
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 2, ry + 8); ctx.stroke();
        }
        // Ground
        ctx.fillStyle = '#2a3a2a'; ctx.fillRect(0, H*0.7, W, H*0.3);
        // Grave
        ctx.fillStyle = '#555'; ctx.fillRect(W*0.47, H*0.45, 12, 20);
        ctx.fillStyle = '#666';
        ctx.beginPath(); ctx.arc(W*0.53, H*0.45, 6, Math.PI, 0); ctx.fill();
        // Damiana + young Droghan
        ctx.fillStyle = '#6a4a6a'; ctx.fillRect(W*0.35, H*0.5, 10, 18);
        ctx.fillStyle = '#4a4a6a'; ctx.fillRect(W*0.38, H*0.56, 6, 12);
        // Nahgord (shadow behind)
        ctx.fillStyle = '#2a1a3a'; ctx.fillRect(W*0.62, H*0.46, 12, 22);
      },
    },
    {
      title: 'Cena 4 — Manipulação',
      lines: [
        'Nahgord conduzia rituais sombrios com o jovem Droghan.',
        'Tentava forçar o despertar da Essência.',
        'Círculos arcanos, dor, medo.',
      ],
      bgDraw: (ctx, W, H) => {
        // Dark ritual room
        ctx.fillStyle = '#0a0515'; ctx.fillRect(0, 0, W, H);
        // Purple glow circle
        ctx.strokeStyle = '#5500aa'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W*0.5, H*0.5, 40, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = '#330066';
        ctx.beginPath(); ctx.arc(W*0.5, H*0.5, 55, 0, Math.PI*2); ctx.stroke();
        // Runes
        ctx.fillStyle = '#5500aa';
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          ctx.fillRect(W*0.5 + Math.cos(a)*45 - 3, H*0.5 + Math.sin(a)*45 - 3, 6, 6);
        }
        // Nahgord
        ctx.fillStyle = '#2a1a3a'; ctx.fillRect(W*0.3, H*0.38, 12, 24);
        // Teen Droghan (kneeling)
        ctx.fillStyle = '#4a4a6a'; ctx.fillRect(W*0.55, H*0.48, 10, 14);
        // Dark energy
        ctx.fillStyle = 'rgba(85,0,170,0.1)';
        ctx.beginPath(); ctx.arc(W*0.5, H*0.5, 70, 0, Math.PI*2); ctx.fill();
      },
    },
    {
      title: 'Cena 5 — Confronto',
      lines: [
        'Damiana flagrou o ritual.',
        '"O que você está fazendo com meu filho?!"',
        'Nahgord: "Esse poder deveria ser MEU."',
      ],
      bgDraw: (ctx, W, H) => {
        // Dark room, dramatic lighting
        ctx.fillStyle = '#0d0818'; ctx.fillRect(0, 0, W, H);
        // Torch light
        ctx.fillStyle = 'rgba(255,150,50,0.08)';
        ctx.beginPath(); ctx.arc(W*0.2, H*0.3, 60, 0, Math.PI*2); ctx.fill();
        // Damiana (left, angry)
        ctx.fillStyle = '#8a4a6a'; ctx.fillRect(W*0.2, H*0.4, 10, 20);
        ctx.fillStyle = '#f0c8a0'; ctx.fillRect(W*0.21, H*0.35, 8, 8);
        // Nahgord (right)
        ctx.fillStyle = '#2a1a3a'; ctx.fillRect(W*0.65, H*0.38, 12, 24);
        // Droghan (center, on ground)
        ctx.fillStyle = '#4a4a6a'; ctx.fillRect(W*0.45, H*0.55, 10, 10);
        // Broken circle
        ctx.strokeStyle = '#440088'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(W*0.5, H*0.5, 35, 0.5, Math.PI*1.5); ctx.stroke();
      },
    },
    {
      title: 'Cena 6 — Ruptura',
      lines: [
        'Droghan, aos 15, ficou de pé.',
        '"Sai de perto da minha mãe."',
        'Uma onda dourada involuntária empurrou Nahgord.',
        'Ele fugiu: "Eu vou conseguir esse poder."',
      ],
      bgDraw: (ctx, W, H) => {
        // Dark with golden burst
        ctx.fillStyle = '#0a0818'; ctx.fillRect(0, 0, W, H);
        // Golden shockwave
        ctx.strokeStyle = 'rgba(255,215,0,0.3)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(W*0.4, H*0.5, 50, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,215,0,0.15)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W*0.4, H*0.5, 80, 0, Math.PI*2); ctx.stroke();
        // Droghan (standing, golden)
        ctx.fillStyle = '#f0c8a0'; ctx.fillRect(W*0.38, H*0.35, 8, 8);
        ctx.fillStyle = '#4a4a6a'; ctx.fillRect(W*0.37, H*0.42, 10, 18);
        ctx.fillStyle = 'rgba(255,215,0,0.2)';
        ctx.beginPath(); ctx.arc(W*0.41, H*0.45, 18, 0, Math.PI*2); ctx.fill();
        // Damiana (behind)
        ctx.fillStyle = '#6a4a6a'; ctx.fillRect(W*0.25, H*0.44, 8, 16);
        // Nahgord (flying back)
        ctx.fillStyle = '#2a1a3a'; ctx.fillRect(W*0.72, H*0.4, 10, 18);
      },
    },
    {
      title: 'Cena 7 — O Presente',
      lines: [
        'Cinco anos depois. Droghan acorda.',
        'A porta da casa está arrombada. Damiana desapareceu.',
        'Um bilhete no chão: "Desça."',
        'Onde antes não havia nada, uma entrada se abriu para as profundezas.',
      ],
      bgDraw: (ctx, W, H) => {
        // Dawn light, broken door
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1a1520'); g.addColorStop(0.5, '#2a2030'); g.addColorStop(1, '#151015');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // House interior
        ctx.fillStyle = '#1a150f'; ctx.fillRect(W*0.1, H*0.2, W*0.8, H*0.7);
        // Broken door
        ctx.fillStyle = '#3a2a15'; ctx.fillRect(W*0.42, H*0.25, 14, H*0.5);
        ctx.fillStyle = '#1a1520'; ctx.fillRect(W*0.44, H*0.25, 10, H*0.3); // Opening
        // Dawn light through door
        ctx.fillStyle = 'rgba(200,150,100,0.06)';
        ctx.beginPath(); ctx.moveTo(W*0.44, H*0.25); ctx.lineTo(W*0.35, H*0.8); ctx.lineTo(W*0.6, H*0.8); ctx.lineTo(W*0.54, H*0.25); ctx.fill();
        // Note on floor
        ctx.fillStyle = '#ddc'; ctx.fillRect(W*0.46, H*0.7, 8, 6);
        // Dungeon entrance (hole in floor)
        ctx.fillStyle = '#050008'; ctx.fillRect(W*0.55, H*0.65, 20, 15);
        ctx.strokeStyle = '#333'; ctx.strokeRect(W*0.55, H*0.65, 20, 15);
        // Droghan (standing, adult)
        ctx.fillStyle = '#f0c8a0'; ctx.fillRect(W*0.3, H*0.4, 10, 10);
        ctx.fillStyle = '#3a3a5a'; ctx.fillRect(W*0.29, H*0.49, 12, 22);
      },
    },
  ];

  openingCutsceneState = {
    sceneIndex: 0,
    charIndex: 0,
    charTimer: 0,
    lineIndex: 0,
    scenes,
    fadeAlpha: 1.0, // Start faded in (black), will fade out to reveal scene
    fadeDir: -1,     // -1 = fading out (reveal), +1 = fading in (hide)
    fadeSpeed: 1.0,  // 1s fade
    transitioning: false,
  };

  gameState = 'openingCutscene';
}

function updateOpeningCutscene(dt) {
  if (!openingCutsceneState) return;
  const st = openingCutsceneState;

  // Handle fade transitions
  if (st.fadeAlpha > 0 && st.fadeDir < 0) {
    st.fadeAlpha = Math.max(0, st.fadeAlpha - dt * st.fadeSpeed);
    return; // Don't advance text during fade
  }
  if (st.transitioning) {
    st.fadeAlpha = Math.min(1, st.fadeAlpha + dt * st.fadeSpeed);
    if (st.fadeAlpha >= 1) {
      // Fade to black complete — advance scene
      st.sceneIndex++;
      st.lineIndex = 0;
      st.charIndex = 0;
      st.charTimer = 0;
      st.transitioning = false;
      if (st.sceneIndex >= st.scenes.length) {
        // All scenes done
        openingCutsceneState = null;
        startFloor(1);
        return;
      }
      st.fadeDir = -1; // Start revealing next scene
    }
    return;
  }

  // Typewriter ~25 chars/s
  const scene = st.scenes[st.sceneIndex];
  if (!scene) return;
  const line = scene.lines[st.lineIndex];
  if (line && st.charIndex < line.length) {
    st.charTimer += dt;
    st.charIndex = Math.min(line.length, Math.floor(st.charTimer * 25));
    if (st.charIndex % 4 === 0) sfx('npcTalk', 0.03);
  }
}

function renderOpeningCutscene() {
  if (!openingCutsceneState) return;
  const st = openingCutsceneState;
  const scene = st.scenes[st.sceneIndex];
  if (!scene) return;

  // Draw scene background
  ctx.save();
  scene.bgDraw(ctx, VIEW_W, VIEW_H);
  ctx.restore();

  // Title
  ctx.fillStyle = 'rgba(255,215,0,0.7)';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(scene.title, 15, 20);

  // Text box at bottom
  const boxH = 70;
  const boxY = VIEW_H - boxH - 8;
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(8, boxY, VIEW_W - 16, boxH);
  ctx.strokeStyle = '#555';
  ctx.strokeRect(8, boxY, VIEW_W - 16, boxH);

  // Render completed lines
  ctx.fillStyle = '#ccc';
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  let ty = boxY + 14;
  for (let i = 0; i < st.lineIndex; i++) {
    ctx.fillStyle = '#999';
    ctx.fillText(scene.lines[i], 16, ty);
    ty += 12;
  }

  // Current line (typewriter)
  if (st.lineIndex < scene.lines.length) {
    const line = scene.lines[st.lineIndex];
    const visible = line.substring(0, st.charIndex);
    ctx.fillStyle = '#fff';
    ctx.fillText(visible, 16, ty);

    // Blinking cursor if line complete
    if (st.charIndex >= line.length) {
      const blink = Math.sin(performance.now() / 300) > 0;
      if (blink) {
        ctx.fillStyle = '#ffd700';
        ctx.fillText('▼', VIEW_W - 30, boxY + boxH - 10);
      }
    }
  }

  // "Pular" button (top-right corner)
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '7px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('[ESC] Pular', VIEW_W - 10, 18);

  // Scene counter
  ctx.fillStyle = '#666';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${st.sceneIndex + 1}/7`, VIEW_W / 2, VIEW_H - 4);

  // Fade overlay
  if (st.fadeAlpha > 0) {
    ctx.fillStyle = `rgba(0,0,0,${st.fadeAlpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  ctx.textAlign = 'left';
}

function handleOpeningCutsceneInput() {
  if (!openingCutsceneState) return;
  const st = openingCutsceneState;

  // Skip entire cutscene
  if (keys['Escape']) {
    keys['Escape'] = false;
    openingCutsceneState = null;
    startFloor(1);
    return;
  }

  // Don't accept input during transitions
  if (st.transitioning || (st.fadeAlpha > 0 && st.fadeDir < 0)) return;

  if (keys['Space'] || keys['Enter'] || mouseClicked) {
    keys['Space'] = false; keys['Enter'] = false; mouseClicked = false;

    const scene = st.scenes[st.sceneIndex];
    if (!scene) return;
    const line = scene.lines[st.lineIndex];

    if (line && st.charIndex < line.length) {
      // Show full line immediately
      st.charIndex = line.length;
    } else {
      // Advance to next line
      st.lineIndex++;
      st.charIndex = 0;
      st.charTimer = 0;
      if (st.lineIndex >= scene.lines.length) {
        // Scene complete — start fade transition
        st.transitioning = true;
        st.fadeDir = 1;
      }
    }
  }
}

// GDD §11: Droghan fala contextual (não pausa jogo, mostra como balão flutuante)
function showDroghanBubble(text) {
  damageNumbers.push({x:player.x, y:player.y-35, text:text, color:'#f0c8a0', size:7, timer:2.5, vy:-12});
}

// GDD §11: Droghan reações contextuais (1x por andar)
function triggerFloorDialogues(floor) {
  // Bioma novo
  const biomeId = getBiome(floor).id;
  if (!player.dialogsSeen['bioma' + biomeId]) {
    const biomeLines = {
      'catacumbas': 'Esse lugar cheira a morte...',
      'ruinas': 'Ruínas antigas... o que aconteceu aqui?',
      'lava': 'Tá quente demais...',
      'fortaleza': 'Então é aqui que ele se esconde.',
    };
    if (biomeLines[biomeId]) {
      player.dialogsSeen['bioma' + biomeId] = true;
      setTimeout(() => {
        startDialogue('Droghan', '#f0c8a0', [biomeLines[biomeId]], null);
      }, 1000);
    }
  }
  // GDD §8/§11: Essência desperta (A3)
  if (floor === 3 && !player.dialogsSeen['essenciaA3']) {
    player.dialogsSeen['essenciaA3'] = true;
    player.essenciaStage = getEssenciaStage(maxFloorReached);
    setTimeout(() => {
      showDroghanBubble('Essa energia... o que está acontecendo comigo?');
    }, 2000);
  }
  // A14: cutscene Selene+Bron
  if (floor === 14) {
    setTimeout(() => { triggerA14Cutscene(); }, 500);
  }
}

// ============================================================
// SELENE UPGRADE — GDD §3 Anéis e Amuletos
// ============================================================
let seleneUpgradeState = null;
// {cursor:0, slots:['ring1','ring2','amulet'], result:null, resultTimer:0}

function openSeleneUpgrade() {
  seleneUpgradeState = {
    cursor: 0,
    slots: ['ring1','ring2','amulet'],
    result: null, resultTimer: 0,
  };
  gameState = 'seleneUpgrade';
}

// ============================================================
// SHOP SYSTEM — GDD §17
// ============================================================
let shopState = null;
// {npc:'selene', tab:'buy'|'sell'|'upgrade', stock:[], cursor:0, sellItems:[]}

function openShop(npcId) {
  const stock = getSeleneStock(currentFloor);
  shopState = {
    npc: npcId, tab: 'buy', stock,
    cursor: 0,
    sellItems: getSellableItems(),
  };
  gameState = 'shop';
}

function getSellableItems() {
  const items = [];
  for (let i = 0; i < player.inventory.length; i++) {
    const item = player.inventory[i];
    if (item) items.push({item, index: i});
  }
  return items;
}

// ============================================================
// UPGRADE SYSTEM — GDD §3 Bron
// ============================================================
let upgradeState = null;
// {cursor:0, slots:['weapon','body','head','secondary','feet'], result:null, resultTimer:0}

function openUpgrade() {
  upgradeState = {
    cursor: 0,
    slots: ['weapon','body','head','secondary','feet'],
    result: null, resultTimer: 0,
  };
  gameState = 'upgrade';
}

// ============================================================
// CLASS SELECTION — GDD §1
// ============================================================
let classSelectData = null;

// ============================================================
// INVENTORY STATE — GDD §13
// ============================================================
let inventoryState = null;
// {cursor:0, section:'equip'|'bag', equipCursor:0}

function openInventory() {
  inventoryState = {cursor: 0, section: 'bag', equipCursor: 0};
  gameState = 'inventory';
}

// ============================================================
// SKILL MENU — GDD §7: acessível via K
// ============================================================
let skillMenuState = null;

function openSkillMenu() {
  if (!player.classKey) return;
  const allSkills = getClassSkills();
  skillMenuState = {
    cursor: 0,
    section: 'equipped',
    allSkills,
    isKaelith: false,
  };
  gameState = 'skillMenu';
}

// GDD §12: Kaelith — desbloquear skills 4-10 (scroll+300g), trocar (grátis), resetar (500g)
function openKaelithMenu() {
  if (!player.classKey) return;
  const allSkills = getClassSkills();
  skillMenuState = {
    cursor: 0,
    section: 'equipped',
    allSkills,
    isKaelith: true,
  };
  gameState = 'skillMenu';
}

function renderSkillMenu() {
  if (!skillMenuState) return;
  const pad = 10;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(pad, pad, VIEW_W - pad*2, VIEW_H - pad*2);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, VIEW_W - pad*2, VIEW_H - pad*2);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText((skillMenuState.isKaelith ? 'KAELITH — ' : 'SKILLS — ') + CLASS_DATA[player.classKey].name, VIEW_W/2, pad+14);
  ctx.fillStyle = '#aaa';
  ctx.font = '7px monospace';
  ctx.fillText(`Pontos: ${player.skillPoints} | Scrolls: ${player.scrollSkills}`, VIEW_W/2, pad+24);

  // Skills list
  const allSkills = skillMenuState.allSkills;
  ctx.textAlign = 'left';
  const startY = pad + 34;
  for (let i = 0; i < allSkills.length; i++) {
    const [id, skill] = allSkills[i];
    const lvl = player.skills[id] || 0;
    const learned = lvl > 0;
    const equipped = player.equippedSkills.includes(id);
    const y = startY + i * 16;

    // Highlight cursor
    if (i === skillMenuState.cursor) {
      ctx.fillStyle = 'rgba(255,215,0,0.15)';
      ctx.fillRect(pad+4, y-2, VIEW_W - pad*2 - 8, 15);
    }

    // Skill number
    ctx.fillStyle = learned ? '#fff' : '#555';
    ctx.font = '7px monospace';
    ctx.fillText(`${skill.num}.`, pad+8, y+8);

    // Name
    ctx.fillStyle = equipped ? '#ffd700' : learned ? '#fff' : '#555';
    ctx.fillText(skill.name, pad+22, y+8);

    // Level
    ctx.fillStyle = '#aaa';
    if (learned) ctx.fillText(`Lv${lvl}/10`, pad+130, y+8);
    else if (skill.scroll) ctx.fillText(skillMenuState.isKaelith ? `🔓300g+Scr` : '🔒Scroll', pad+130, y+8);
    else ctx.fillText(`#${skill.num}≤3`, pad+130, y+8);

    // Cost + CD
    ctx.fillStyle = '#888';
    ctx.fillText(`${skill.cost}res ${skill.cd}s`, pad+190, y+8);

    // Equipped indicator
    if (equipped) {
      const slot = player.equippedSkills.indexOf(id) + 1;
      ctx.fillStyle = '#ffd700';
      ctx.fillText(`[${slot}]`, pad+260, y+8);
    }

    // Dmg
    if (skill.dmg > 0) {
      ctx.fillStyle = '#cc4444';
      ctx.fillText(`${skill.dmg}%`, pad+290, y+8);
    }
  }

  // Passives section
  const passY = startY + 10 * 16 + 4;
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('Passivas:', pad+8, passY);
  const classPas = PASSIVES[player.classKey];
  for (let i = 0; i < classPas.length; i++) {
    const p = classPas[i];
    const unlocked = player.passives.includes(p.id);
    ctx.fillStyle = unlocked ? '#33cc33' : '#555';
    ctx.font = '6px monospace';
    ctx.fillText(`Lv${p.lvl}: ${p.name} — ${p.desc}`, pad+12, passY + 12 + i * 10);
  }

  // Controls hint
  ctx.fillStyle = '#888';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  const kaelithHint = skillMenuState.isKaelith ? '  R:Resetar(500g)' : '';
  ctx.fillText('↑↓:Sel  Enter:Aprender  E:Equipar  Q:Desequipar' + kaelithHint + '  Esc:Fechar', VIEW_W/2, VIEW_H - pad - 4);
  ctx.textAlign = 'left';
}

function handleSkillMenuInput() {
  if (!skillMenuState) return;
  const allSkills = skillMenuState.allSkills;

  if (keys['ArrowUp'] || keys['KeyW']) {
    keys['ArrowUp'] = false; keys['KeyW'] = false;
    skillMenuState.cursor = (skillMenuState.cursor - 1 + allSkills.length) % allSkills.length;
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    keys['ArrowDown'] = false; keys['KeyS'] = false;
    skillMenuState.cursor = (skillMenuState.cursor + 1) % allSkills.length;
  }

  // Enter: Learn or Upgrade
  if (keys['Enter'] || keys['Space']) {
    keys['Enter'] = false; keys['Space'] = false;
    const [id, skill] = allSkills[skillMenuState.cursor];
    const currentLvl = player.skills[id] || 0;

    if (currentLvl === 0) {
      // Learn: Skills 1-3 = just need a point. Skills 4-10 = need scroll + 300g (via Kaelith)
      if (skill.num <= 3) {
        // Can learn in order: need previous skill learned
        const prev = allSkills.find(([, s]) => s.num === skill.num - 1);
        if (skill.num === 1 || (prev && (player.skills[prev[0]] || 0) > 0)) {
          if (player.skillPoints > 0) {
            player.skills[id] = 1;
            player.skillPoints--;
            sfx('levelUp');
          }
        }
      }
      // Skills 4-10: unlocked via Kaelith (scroll + 300g)
      else if (skill.num >= 4 && skillMenuState.isKaelith) {
        if (player.scrollSkills > 0 && player.gold >= 300) {
          player.scrollSkills--;
          player.gold -= 300;
          player.skills[id] = 1;
          sfx('levelUp');
          damageNumbers.push({x:player.x, y:player.y-30, text:'Skill Desbloqueada!', color:'#ffd700', size:8, timer:1, vy:-20});
        }
      }
    } else if (currentLvl < 10) {
      // Upgrade
      if (player.skillPoints > 0) {
        player.skills[id]++;
        player.skillPoints--;
        sfx('levelUp');
      }
    }
  }

  // E: Equip skill
  if (keys['KeyE']) {
    keys['KeyE'] = false;
    const [id] = allSkills[skillMenuState.cursor];
    if ((player.skills[id] || 0) > 0 && !player.equippedSkills.includes(id)) {
      // Find empty slot
      const emptyIdx = player.equippedSkills.indexOf(null);
      if (emptyIdx >= 0) {
        player.equippedSkills[emptyIdx] = id;
        sfx('pickup');
      }
    }
  }

  // Q: Unequip skill
  if (keys['KeyQ']) {
    keys['KeyQ'] = false;
    const [id] = allSkills[skillMenuState.cursor];
    const idx = player.equippedSkills.indexOf(id);
    if (idx >= 0) {
      player.equippedSkills[idx] = null;
    }
  }

  // R: Reset skill points (Kaelith only, 500g)
  if (keys['KeyR'] && skillMenuState.isKaelith) {
    keys['KeyR'] = false;
    if (player.gold >= 500) {
      player.gold -= 500;
      // GDD §12: Resetar pontos — devolve todos os pontos investidos
      let refund = 0;
      for (const [id] of allSkills) {
        const lvl = player.skills[id] || 0;
        if (lvl > 0) {
          // Skills 1-3: refund all levels as points
          // Skills 4-10: keep at level 1 (unlocked via scroll), refund levels above 1
          const skill = SKILLS[id];
          if (skill.num <= 3) {
            refund += lvl;
            player.skills[id] = 0;
            // Unequip if equipped
            const eqIdx = player.equippedSkills.indexOf(id);
            if (eqIdx >= 0) player.equippedSkills[eqIdx] = null;
          } else {
            refund += lvl - 1; // Keep lvl 1 (scroll unlock)
            player.skills[id] = 1;
          }
        }
      }
      player.skillPoints += refund;
      sfx('pickup');
      damageNumbers.push({x:player.x, y:player.y-30, text:`+${refund} pontos devolvidos`, color:'#ffd700', size:8, timer:1.5, vy:-20});
    }
  }

  // Escape: close
  if (keys['Escape'] || keys['KeyK']) {
    keys['Escape'] = false; keys['KeyK'] = false;
    gameState = 'playing';
    skillMenuState = null;
  }
}

// ============================================================
// DIALOGUE RENDER — GDD §11
// ============================================================
function renderDialogue() {
  if (!dialogState) return;

  // GDD §11: Caixa na parte inferior, fundo escuro semi-transparente, borda pixel art
  const boxH = 70;
  const boxY = VIEW_H - boxH - 4;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(4, boxY, VIEW_W - 8, boxH);
  ctx.strokeStyle = '#888';
  ctx.strokeRect(4, boxY, VIEW_W - 8, boxH);

  // GDD §11: Retrato à esquerda (32×32)
  ctx.fillStyle = dialogState.portrait_color;
  ctx.fillRect(12, boxY + 8, 28, 28);
  ctx.fillStyle = '#fff';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(dialogState.speaker.substring(0,4), 26, boxY + 42);

  // Text
  const line = dialogState.lines[dialogState.index];
  const visibleText = line.substring(0, dialogState.charIndex);
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';

  // Word wrap
  const maxW = VIEW_W - 60;
  const words = visibleText.split(' ');
  let lineText = '';
  let ty = boxY + 18;
  for (const word of words) {
    const test = lineText + (lineText ? ' ' : '') + word;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(lineText, 48, ty);
      lineText = word;
      ty += 12;
    } else {
      lineText = test;
    }
  }
  ctx.fillText(lineText, 48, ty);

  // Indicator
  if (dialogState.charIndex >= line.length) {
    ctx.fillStyle = '#ffd700';
    const blink = Math.sin(performance.now()/300) > 0;
    if (blink) ctx.fillText('▼', VIEW_W - 20, boxY + boxH - 8);
  }

  // Page indicator
  ctx.fillStyle = '#888';
  ctx.font = '6px monospace';
  ctx.fillText(`${dialogState.index+1}/${dialogState.lines.length}`, VIEW_W - 40, boxY + boxH - 8);

  ctx.textAlign = 'left';
}

// ============================================================
// SHOP RENDER — GDD §17
// ============================================================
function renderShop() {
  if (!shopState) return;

  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(20, 20, VIEW_W - 40, VIEW_H - 40);
  ctx.strokeStyle = '#888';
  ctx.strokeRect(20, 20, VIEW_W - 40, VIEW_H - 40);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('LOJA DA SELENE', VIEW_W/2, 42);

  // Tabs
  ctx.fillStyle = shopState.tab === 'buy' ? '#ffd700' : '#888';
  ctx.font = '9px monospace';
  ctx.fillText('[1] Comprar', VIEW_W/2 - 100, 58);
  ctx.fillStyle = shopState.tab === 'sell' ? '#ffd700' : '#888';
  ctx.fillText('[2] Vender', VIEW_W/2, 58);
  ctx.fillStyle = '#9966cc';
  ctx.fillText('[3] Upgrade', VIEW_W/2 + 100, 58);

  // Gold
  ctx.fillStyle = '#fff';
  ctx.fillText(`Ouro: ${player.gold}`, VIEW_W/2, 72);

  ctx.textAlign = 'left';
  const startY = 85;

  if (shopState.tab === 'buy') {
    for (let i = 0; i < shopState.stock.length; i++) {
      const s = shopState.stock[i];
      const y = startY + i * 18;
      if (y > VIEW_H - 60) break;
      const sel = i === shopState.cursor;
      if (sel) {
        ctx.fillStyle = 'rgba(255,215,0,0.1)';
        ctx.fillRect(30, y - 8, VIEW_W - 60, 16);
      }
      ctx.fillStyle = sel ? '#ffd700' : '#ccc';
      ctx.font = '8px monospace';
      ctx.fillText(s.item.name, 36, y);
      ctx.fillStyle = player.gold >= s.price ? '#ffd700' : '#cc4444';
      ctx.textAlign = 'right';
      ctx.fillText(`${s.price}g`, VIEW_W - 36, y);
      ctx.textAlign = 'left';
      // Stats preview
      if (s.item.atk) { ctx.fillStyle = '#ff8844'; ctx.fillText(`ATK+${s.item.atk}`, 200, y); }
      if (s.item.def) { ctx.fillStyle = '#4488ff'; ctx.fillText(`DEF+${s.item.def}`, 200, y); }
      if (s.item.heal) { ctx.fillStyle = '#44cc44'; ctx.fillText(`+${s.item.heal}HP`, 200, y); }
      if (s.item.type === 'ring') { ctx.fillStyle = '#88ff88'; ctx.fillText(`${s.item.attr}+${s.item.val}`, 200, y); }
      if (s.item.type === 'amulet') { ctx.fillStyle = AMULET_RARITY_COLORS[s.item.rarity] || '#aaa'; ctx.fillText(`${s.item.skillName}+1`, 200, y); }
    }
  } else {
    // Sell tab
    const sellItems = getSellableItems();
    for (let i = 0; i < sellItems.length; i++) {
      const s = sellItems[i];
      const y = startY + i * 18;
      if (y > VIEW_H - 60) break;
      const sel = i === shopState.cursor;
      if (sel) {
        ctx.fillStyle = 'rgba(255,215,0,0.1)';
        ctx.fillRect(30, y - 8, VIEW_W - 60, 16);
      }
      ctx.fillStyle = sel ? '#ffd700' : '#ccc';
      ctx.font = '8px monospace';
      ctx.fillText(s.item.name, 36, y);
      // GDD §17: Venda = 40%
      let sellPrice = 0;
      if (s.item.type === 'ring') {
        const ringPrices = {cobre:40, prata:100, ouro:200, rubi:400, ancestral:800};
        sellPrice = Math.floor((ringPrices[s.item.tier] || 40) * 0.4);
      } else if (s.item.type === 'amulet') {
        sellPrice = Math.floor((AMULET_SELENE_PRICES[s.item.rarity] || 40) * 0.4);
      } else {
        sellPrice = Math.floor(getEquipPrice(s.item.slot, s.item.tier) * 0.4);
      }
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'right';
      ctx.fillText(`${sellPrice}g`, VIEW_W - 36, y);
      ctx.textAlign = 'left';
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = '7px monospace';
  ctx.fillText('Setas:navegar | Enter:comprar/vender | ESC:sair', VIEW_W/2, VIEW_H - 28);
  ctx.textAlign = 'left';
}

// ============================================================
// INVENTORY RENDER — GDD §13
// ============================================================
function renderInventory() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(15, 15, VIEW_W - 30, VIEW_H - 30);
  ctx.strokeStyle = '#888';
  ctx.strokeRect(15, 15, VIEW_W - 30, VIEW_H - 30);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('INVENTARIO', VIEW_W/2, 36);

  // GDD §13: Esquerda: Droghan preview com equip visual + 8 slots ao redor
  const prevX = 70, prevY = 120; // Centro do preview
  // Corpo do Droghan (silhueta)
  ctx.fillStyle = '#f0c8a0'; // Pele
  ctx.fillRect(prevX - 5, prevY - 20, 10, 12); // Cabeça
  ctx.fillStyle = '#3a3a5a'; // Corpo
  ctx.fillRect(prevX - 8, prevY - 8, 16, 18); // Torso
  ctx.fillRect(prevX - 10, prevY - 4, 4, 14); // Braço esq
  ctx.fillRect(prevX + 6, prevY - 4, 4, 14); // Braço dir
  ctx.fillRect(prevX - 6, prevY + 10, 5, 12); // Perna esq
  ctx.fillRect(prevX + 1, prevY + 10, 5, 12); // Perna dir

  // 8 equip slots ao redor do preview (pequenos quadrados coloridos)
  const eqSlots = ['weapon','body','head','secondary','feet','ring1','ring2','amulet'];
  const slotPositions = [
    {x: prevX - 30, y: prevY - 4, label: 'W'},   // weapon — esquerda
    {x: prevX - 2, y: prevY - 2, label: 'B'},     // body — centro torso
    {x: prevX - 4, y: prevY - 28, label: 'H'},    // head — acima
    {x: prevX + 18, y: prevY - 4, label: 'S'},    // secondary — direita
    {x: prevX - 4, y: prevY + 22, label: 'F'},    // feet — abaixo
    {x: prevX - 30, y: prevY + 14, label: 'R1'},  // ring1 — esq baixo
    {x: prevX + 18, y: prevY + 14, label: 'R2'},  // ring2 — dir baixo
    {x: prevX - 2, y: prevY + 32, label: 'A'},    // amulet — abaixo centro
  ];
  const slotColors = {
    weapon: '#ff8844', body: '#4488ff', head: '#88aaff',
    secondary: '#cc8844', feet: '#886644',
    ring1: '#88ff88', ring2: '#88ff88', amulet: '#cc44cc',
  };
  for (let i = 0; i < eqSlots.length; i++) {
    const slot = eqSlots[i];
    const eq = player.equipment[slot];
    const sp = slotPositions[i];
    const sel = inventoryState.section === 'equip' && inventoryState.equipCursor === i;
    // Slot background
    ctx.fillStyle = eq ? slotColors[slot] : '#333';
    ctx.fillRect(sp.x, sp.y, 10, 10);
    if (sel) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.strokeRect(sp.x - 1, sp.y - 1, 12, 12);
    }
    // Tiny label
    ctx.fillStyle = '#888';
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(sp.label, sp.x + 5, sp.y + 19);
  }

  // Equipamento lista (à direita do preview)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#aaa';
  ctx.font = '8px monospace';
  ctx.fillText('Equipado:', 130, 52);

  for (let i = 0; i < eqSlots.length; i++) {
    const slot = eqSlots[i];
    const y = 62 + i * 16;
    const eq = player.equipment[slot];
    const sel = inventoryState.section === 'equip' && inventoryState.equipCursor === i;
    if (sel) {
      ctx.fillStyle = 'rgba(255,215,0,0.1)';
      ctx.fillRect(128, y - 6, 320, 14);
    }
    ctx.fillStyle = sel ? '#ffd700' : '#888';
    ctx.font = '7px monospace';
    ctx.fillText(SLOT_NAMES[slot] + ':', 132, y);
    ctx.fillStyle = eq ? '#fff' : '#555';
    ctx.fillText(eq ? eq.name : '(vazio)', 196, y);
    if (eq && eq.atk) { ctx.fillStyle = '#ff8844'; ctx.fillText(`+${eq.atk}ATK`, 330, y); }
    if (eq && eq.def) { ctx.fillStyle = '#4488ff'; ctx.fillText(`+${eq.def}DEF`, 330, y); }
    if (eq && eq.agi) { ctx.fillStyle = '#44cc44'; ctx.fillText(`+${eq.agi}AGI`, 330, y); }
    if (eq && eq.type === 'ring') { ctx.fillStyle = '#88ff88'; ctx.fillText(`${eq.attr}+${eq.val.toFixed(1)}`, 330, y); }
    if (eq && eq.type === 'amulet') { ctx.fillStyle = AMULET_RARITY_COLORS[eq.rarity]||'#aaa'; ctx.fillText(`${eq.attr1}+${eq.val1} ${eq.attr2}+${eq.val2}`, 330, y); }
  }

  // Mochila
  ctx.fillStyle = '#aaa';
  ctx.font = '8px monospace';
  ctx.fillText(`Mochila (${player.inventory.length}/20):`, 25, 200);

  for (let i = 0; i < player.inventory.length; i++) {
    const item = player.inventory[i];
    const y = 212 + i * 14;
    if (y > VIEW_H - 50) break;
    const sel = inventoryState.section === 'bag' && inventoryState.cursor === i;
    if (sel) {
      ctx.fillStyle = 'rgba(255,215,0,0.1)';
      ctx.fillRect(22, y - 6, VIEW_W - 60, 12);
    }
    ctx.fillStyle = sel ? '#ffd700' : '#ccc';
    ctx.font = '7px monospace';
    ctx.fillText(item.name, 30, y);
    if (item.atk) { ctx.fillStyle = '#ff8844'; ctx.fillText(`+${item.atk}`, 180, y); }
    if (item.def) { ctx.fillStyle = '#4488ff'; ctx.fillText(`+${item.def}`, 180, y); }
    if (item.type === 'ring') { ctx.fillStyle = '#88ff88'; ctx.fillText(`${item.attr}+${item.val.toFixed(1)}`, 180, y); }
    if (item.type === 'amulet') { ctx.fillStyle = AMULET_RARITY_COLORS[item.rarity]||'#aaa'; ctx.fillText(`${item.attr1}+${item.val1}`, 180, y); }
    // GDD §13: Comparison arrows ↑↓ vs equipped item
    if (item.slot && player.equipment) {
      const equipped = player.equipment[item.slot];
      let compX = 230;
      const showDiff = (label, newVal, eqVal) => {
        const diff = (newVal || 0) - (eqVal || 0);
        if (diff > 0) { ctx.fillStyle = '#44ff44'; ctx.fillText(`${label}↑+${diff}`, compX, y); compX += 45; }
        else if (diff < 0) { ctx.fillStyle = '#ff4444'; ctx.fillText(`${label}↓${diff}`, compX, y); compX += 45; }
      };
      if (item.atk || (equipped && equipped.atk)) showDiff('ATK', item.atk, equipped ? equipped.atk : 0);
      if (item.def || (equipped && equipped.def)) showDiff('DEF', item.def, equipped ? equipped.def : 0);
      if (item.agi || (equipped && equipped.agi)) showDiff('AGI', item.agi, equipped ? equipped.agi : 0);
    }
  }

  // Consumíveis
  ctx.fillStyle = '#aaa';
  ctx.font = '7px monospace';
  let consY = Math.min(212 + player.inventory.length * 14, VIEW_H - 70);
  ctx.fillText('Consumiveis:', 260, 52);
  for (let i = 0; i < player.consumables.length; i++) {
    const c = player.consumables[i];
    ctx.fillStyle = '#ccc';
    ctx.fillText(`${c.name} x${c.qty}`, 260, 64 + i * 12);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = '7px monospace';
  ctx.fillText('Tab:equip/mochila | Enter:equipar | ESC:fechar', VIEW_W/2, VIEW_H - 22);
  ctx.textAlign = 'left';
}

// ============================================================
// CLASS SELECT — GDD §1
// ============================================================
function renderClassSelect() {
  if (!classSelectData) return;

  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('ESCOLHA SUA CLASSE', VIEW_W/2, 40);

  ctx.fillStyle = '#aaa';
  ctx.font = '8px monospace';
  ctx.fillText('GDD §1: Sem classe até andar 5. Escolhe após Boss 1.', VIEW_W/2, 56);

  const classes = classSelectData.classes;
  for (let i = 0; i < classes.length; i++) {
    const cd = CLASS_DATA[classes[i]];
    const y = 80 + i * 60;
    const sel = i === classSelectData.cursor;

    if (sel) {
      ctx.fillStyle = 'rgba(255,215,0,0.12)';
      ctx.fillRect(40, y - 8, VIEW_W - 80, 52);
      ctx.strokeStyle = '#ffd700';
      ctx.strokeRect(40, y - 8, VIEW_W - 80, 52);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = sel ? '#ffd700' : '#aaa';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(cd.name, 60, y + 8);

    ctx.fillStyle = sel ? '#fff' : '#888';
    ctx.font = '8px monospace';
    ctx.fillText(`Recurso: ${cd.resource}`, 60, y + 22);
    ctx.fillText(cd.desc, 60, y + 34);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = '9px monospace';
  ctx.fillText('Setas: selecionar | Enter: confirmar', VIEW_W/2, VIEW_H - 20);
  ctx.textAlign = 'left';
}

// ============================================================
// UPGRADE RENDER — GDD §3 Bron
// ============================================================
function renderUpgrade() {
  if (!upgradeState) return;

  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(30, 30, VIEW_W - 60, VIEW_H - 60);
  ctx.strokeStyle = '#888';
  ctx.strokeRect(30, 30, VIEW_W - 60, VIEW_H - 60);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#cc6633';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('FERREIRO BRON', VIEW_W/2, 52);
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.fillText(`Ouro: ${player.gold}`, VIEW_W/2, 66);

  ctx.textAlign = 'left';

  for (let i = 0; i < upgradeState.slots.length; i++) {
    const slot = upgradeState.slots[i];
    const eq = player.equipment[slot];
    const y = 85 + i * 30;
    const sel = i === upgradeState.cursor;

    if (sel) {
      ctx.fillStyle = 'rgba(255,215,0,0.1)';
      ctx.fillRect(38, y - 8, VIEW_W - 80, 26);
    }

    ctx.fillStyle = sel ? '#ffd700' : '#aaa';
    ctx.font = '8px monospace';
    ctx.fillText(SLOT_NAMES[slot], 44, y);

    if (eq) {
      ctx.fillStyle = '#fff';
      ctx.fillText(eq.name, 110, y);
      if (eq.upgLevel < 5) {
        const upg = UPGRADE_DATA[eq.upgLevel];
        ctx.fillStyle = player.gold >= upg.cost ? '#44cc44' : '#cc4444';
        ctx.fillText(`+${eq.upgLevel+1}: ${upg.cost}g (${Math.round(upg.chance*100)}%)`, 110, y + 12);
      } else {
        ctx.fillStyle = '#ffd700';
        ctx.fillText('MAX', 110, y + 12);
      }
    } else {
      ctx.fillStyle = '#555';
      ctx.fillText('(nenhum equipamento)', 110, y);
    }
  }

  // Result message
  if (upgradeState.result) {
    ctx.textAlign = 'center';
    ctx.fillStyle = upgradeState.result === 'success' ? '#44ff44' : '#ff4444';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(upgradeState.result === 'success' ? 'SUCESSO!' : 'FALHOU... Ouro perdido.', VIEW_W/2, VIEW_H - 70);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = '7px monospace';
  ctx.fillText('Setas:navegar | Enter:melhorar | ESC:sair', VIEW_W/2, VIEW_H - 38);
  ctx.textAlign = 'left';
}

// ============================================================
// SELENE UPGRADE RENDER — GDD §3 Anéis e Amuletos
// ============================================================
function renderSeleneUpgrade() {
  if (!seleneUpgradeState) return;

  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(30, 30, VIEW_W - 60, VIEW_H - 60);
  ctx.strokeStyle = '#9966cc';
  ctx.strokeRect(30, 30, VIEW_W - 60, VIEW_H - 60);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#9966cc';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('SELENE — UPGRADE', VIEW_W/2, 52);
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.fillText(`Ouro: ${player.gold}`, VIEW_W/2, 66);

  ctx.textAlign = 'left';

  for (let i = 0; i < seleneUpgradeState.slots.length; i++) {
    const slot = seleneUpgradeState.slots[i];
    const eq = player.equipment[slot];
    const y = 85 + i * 40;
    const sel = i === seleneUpgradeState.cursor;

    if (sel) {
      ctx.fillStyle = 'rgba(153,102,204,0.1)';
      ctx.fillRect(38, y - 8, VIEW_W - 80, 36);
    }

    ctx.fillStyle = sel ? '#ffd700' : '#aaa';
    ctx.font = '8px monospace';
    ctx.fillText(SLOT_NAMES[slot], 44, y);

    if (eq) {
      // Nome do item
      ctx.fillStyle = '#fff';
      ctx.fillText(eq.name, 110, y);

      // Show stats
      if (eq.type === 'ring') {
        ctx.fillStyle = '#88ff88';
        ctx.fillText(`${eq.attr}: +${eq.val.toFixed(1)}`, 110, y + 12);
        if (eq.effect) {
          const effData = ANCESTRAL_EFFECTS[eq.effect];
          ctx.fillStyle = '#ffd700';
          ctx.fillText(effData ? effData.desc : '', 220, y + 12);
        }
      } else if (eq.type === 'amulet') {
        ctx.fillStyle = AMULET_RARITY_COLORS[eq.rarity] || '#aaa';
        ctx.fillText(`${eq.skillName} +1lvl`, 110, y + 12);
        ctx.fillStyle = '#88ff88';
        ctx.fillText(`${eq.attr1}:+${eq.val1} ${eq.attr2}:+${eq.val2}`, 110, y + 22);
      }

      // Upgrade info
      if (eq.upgLevel < 5) {
        const upg = SELENE_UPGRADE_DATA[eq.upgLevel];
        ctx.fillStyle = player.gold >= upg.cost ? '#44cc44' : '#cc4444';
        ctx.fillText(`+${eq.upgLevel+1}: ${upg.cost}g (${Math.round(upg.chance*100)}%)`, 300, y);
      } else {
        ctx.fillStyle = '#ffd700';
        ctx.fillText('MAX', 300, y);
      }
    } else {
      ctx.fillStyle = '#555';
      ctx.fillText('(vazio)', 110, y);
    }
  }

  // Result message
  if (seleneUpgradeState.result) {
    ctx.textAlign = 'center';
    ctx.fillStyle = seleneUpgradeState.result === 'success' ? '#44ff44' : '#ff4444';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(seleneUpgradeState.result === 'success' ? 'SUCESSO!' : 'FALHOU... Ouro perdido.', VIEW_W/2, VIEW_H - 70);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = '7px monospace';
  ctx.fillText('Setas:navegar | Enter:melhorar | ESC:sair', VIEW_W/2, VIEW_H - 38);
  ctx.textAlign = 'left';
}

// ============================================================
// LEVEL UP — GDD §4
// ============================================================
function renderLevelUpScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`NIVEL ${player.level}!`, VIEW_W/2, 35);

  ctx.fillStyle = '#fff';
  ctx.font = '9px monospace';
  ctx.fillText(`${levelUpData.points} pontos restantes`, VIEW_W/2, 52);

  const attrs = ['FOR','DES','INT','AGI','VIT','SOR'];
  const descs = [
    '+2 AtkFis, +1 Dano',
    '+2 AtkDist, +0.5% VelAtk',
    '+2 AtkMag, +5 Mana, -1% CD',
    '+0.5% Vel, +0.5% Esq, +0.3% Crit',
    '+8 HP, +0.2 Regen',
    '+0.5% Crit, +1% Drop, +2% Ouro'
  ];

  const startY = 70;
  for (let i = 0; i < 6; i++) {
    const y = startY + i * 30;
    const sel = i === levelUpData.cursor;
    const added = levelUpData.tempAttrs[attrs[i]] || 0;

    if (sel) {
      ctx.fillStyle = 'rgba(255,215,0,0.12)';
      ctx.fillRect(40, y - 10, VIEW_W - 80, 26);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = sel ? '#ffd700' : '#aaa';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(attrs[i], 60, y + 4);

    ctx.fillStyle = '#fff';
    ctx.fillText(`${player[attrs[i]] + added}`, 110, y + 4);
    if (added > 0) {
      ctx.fillStyle = '#44cc44';
      ctx.fillText(`(+${added})`, 140, y + 4);
    }

    ctx.fillStyle = '#888';
    ctx.font = '7px monospace';
    ctx.fillText(descs[i], 180, y + 4);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = '8px monospace';
  const instY = startY + 6 * 30 + 8;
  ctx.fillText('Setas: selecionar | Enter: adicionar ponto', VIEW_W/2, instY);

  if (levelUpData.points === 0) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('[ CONFIRMAR (Enter) ]', VIEW_W/2, instY + 20);
  }
  ctx.textAlign = 'left';
}

// ============================================================
// DEATH SCREEN — GDD §20
// ============================================================
function renderDeathScreen() {
  // GDD §20: Na primeira vez que renderiza tela de morte, checar Pedra da Alma
  if (!deathScreenInitialized) {
    deathScreenInitialized = true;
    const hasPedra = player.consumables && player.consumables.some(c => c.id === 'pedraAlma' && c.qty > 0);
    if (hasPedra) {
      deathSoulStonePrompt = true;
    }
  }

  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // GDD §20: Pedra da Alma prompt — mostrar ANTES da tela de morte normal
  if (deathSoulStonePrompt) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cc44cc';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('PEDRA DA ALMA', VIEW_W/2, VIEW_H/2 - 40);

    ctx.fillStyle = '#ddd';
    ctx.font = '10px monospace';
    ctx.fillText('Usar Pedra da Alma?', VIEW_W/2, VIEW_H/2 - 15);
    ctx.fillText('Revive com 50% HP', VIEW_W/2, VIEW_H/2 + 2);

    ctx.fillStyle = '#ffd700';
    ctx.font = '10px monospace';
    ctx.fillText('[ Sim (Enter) ]', VIEW_W/2, VIEW_H/2 + 30);
    ctx.fillStyle = '#aaa';
    ctx.fillText('[ Nao (Backspace) ]', VIEW_W/2, VIEW_H/2 + 50);
    ctx.textAlign = 'left';
    return;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#cc4444';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('VOCE CAIU!', VIEW_W/2, VIEW_H/2 - 50);

  ctx.fillStyle = '#aaa';
  ctx.font = '9px monospace';
  ctx.fillText(`Andar: ${currentFloor}`, VIEW_W/2, VIEW_H/2 - 25);
  // GDD §20: Causa da morte
  const cause = deathCause || inferDeathCause();
  ctx.fillText(`Causa: ${cause}`, VIEW_W/2, VIEW_H/2 - 10);
  ctx.fillText(`Ouro perdido: ${deathGoldLost}`, VIEW_W/2, VIEW_H/2 + 5);
  ctx.fillText(`Mortes: ${player.deaths}`, VIEW_W/2, VIEW_H/2 + 20);

  ctx.fillStyle = '#ffd700';
  ctx.font = '10px monospace';
  ctx.fillText('[ Tentar Novamente (Enter) ]', VIEW_W/2, VIEW_H/2 + 45);
  if (currentFloor > 1) {
    ctx.fillStyle = '#88ccff';
    ctx.font = '9px monospace';
    // GDD §20: "Voltar ao Acampamento" — NPC mais próximo abaixo
    ctx.fillText('[ Voltar ao Acampamento (Backspace) ]', VIEW_W/2, VIEW_H/2 + 65);
  }
  ctx.textAlign = 'left';
}

// GDD §20: Inferir causa da morte quando não rastreada por hazard
function inferDeathCause() {
  // Procurar o inimigo mais próximo como provável causador
  if (typeof enemies !== 'undefined' && enemies.length > 0) {
    let nearest = null, nDist = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < nDist) { nDist = d; nearest = e; }
    }
    if (nearest && nDist < TILE * 4) {
      return nearest.name || nearest.def?.name || 'Inimigo';
    }
  }
  return 'Desconhecida';
}

function renderPauseScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('PAUSADO', VIEW_W/2, VIEW_H/2 - 20);
  ctx.fillStyle = '#aaa';
  ctx.font = '9px monospace';
  ctx.fillText('ESC para continuar', VIEW_W/2, VIEW_H/2 + 5);
  ctx.fillText(`Classe: ${player.classKey ? CLASS_DATA[player.classKey].name : 'Nenhuma'}`, VIEW_W/2, VIEW_H/2 + 25);
  ctx.fillText(`DEF: ${Math.round(getDefense())} | ATK: ${getAtkFis()} | ESQ: ${Math.round(getEsquiva())}%`, VIEW_W/2, VIEW_H/2 + 40);
  ctx.textAlign = 'left';
}

// ============================================================
// INPUT HANDLERS
// ============================================================
function handleLevelUpInput() {
  if (keys['ArrowUp'] || keys['KeyW']) {
    keys['ArrowUp'] = false; keys['KeyW'] = false;
    levelUpData.cursor = (levelUpData.cursor - 1 + 6) % 6;
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    keys['ArrowDown'] = false; keys['KeyS'] = false;
    levelUpData.cursor = (levelUpData.cursor + 1) % 6;
  }
  if (keys['Enter'] || keys['Space']) {
    keys['Enter'] = false; keys['Space'] = false;
    const attrs = ['FOR','DES','INT','AGI','VIT','SOR'];
    if (levelUpData.points > 0) {
      const attr = attrs[levelUpData.cursor];
      levelUpData.tempAttrs[attr] = (levelUpData.tempAttrs[attr] || 0) + 1;
      levelUpData.points--;
    } else {
      for (const [attr, val] of Object.entries(levelUpData.tempAttrs))
        player[attr] += val;
      player.hp = getMaxHp();
      if (player.classKey) {
        player.resourceMax = getResourceMax();
        player.resource = player.resourceMax;
      }
      gameState = 'playing';
    }
  }
}

function handleDeathInput() {
  // GDD §20: Pedra da Alma prompt — check antes de mostrar tela de morte
  if (deathSoulStonePrompt) {
    if (keys['Enter'] || keys['Space']) {
      keys['Enter'] = false; keys['Space'] = false;
      // Usar Pedra da Alma: revive com 50% HP
      const pedraIdx = player.consumables.findIndex(c => c.id === 'pedraAlma');
      if (pedraIdx >= 0) {
        if (player.consumables[pedraIdx].qty > 1) player.consumables[pedraIdx].qty--;
        else player.consumables.splice(pedraIdx, 1);
      }
      player.dead = false;
      player.hp = Math.floor(getMaxHp() * 0.5);
      player.iframeTimer = 3;
      player.kbTimer = 0;
      deathSoulStonePrompt = false;
      deathScreenInitialized = false;
      deathCause = '';
      gameState = 'playing';
      if (typeof shakeScreen === 'function') shakeScreen(3, 0.3);
      if (typeof showDroghanBubble === 'function') showDroghanBubble('Ainda nao...');
      return;
    }
    if (keys['Backspace'] || keys['Escape']) {
      keys['Backspace'] = false; keys['Escape'] = false;
      // Recusar: ir para tela de morte normal
      deathSoulStonePrompt = false;
      return;
    }
    return;
  }

  if (keys['Enter'] || keys['Space']) {
    keys['Enter'] = false; keys['Space'] = false;
    player.dead = false;
    player.hp = getMaxHp();
    player.iframeTimer = 2;
    player.kbTimer = 0;
    deathCause = '';
    deathScreenInitialized = false;
    startFloor(currentFloor);
  }
  if (keys['Backspace'] && currentFloor > 1) {
    keys['Backspace'] = false;
    player.dead = false;
    player.hp = getMaxHp();
    player.iframeTimer = 2;
    player.kbTimer = 0;
    deathCause = '';
    deathScreenInitialized = false;
    // GDD §20: "Voltar ao Acampamento" — andar com NPC mais próximo abaixo
    let targetFloor = currentFloor - 1;
    for (let f = currentFloor - 1; f >= 1; f--) {
      if (NPC_FLOORS.includes(f)) { targetFloor = f; break; }
    }
    currentFloor = targetFloor;
    startFloor(currentFloor);
  }
}

function handlePauseInput() {
  if (keys['Escape']) { keys['Escape'] = false; gameState = 'playing'; }
}

function handleDialogueInput() {
  if (keys['Space'] || keys['Enter'] || mouseClicked) {
    keys['Space'] = false; keys['Enter'] = false; mouseClicked = false;
    advanceDialogue();
  }
}

function handleShopInput() {
  if (keys['Escape']) { keys['Escape'] = false; shopState = null; gameState = 'playing'; return; }
  if (keys['Digit1']) { keys['Digit1'] = false; shopState.tab = 'buy'; shopState.cursor = 0; }
  if (keys['Digit2']) { keys['Digit2'] = false; shopState.tab = 'sell'; shopState.cursor = 0; }
  // GDD §3: Selene upgrade (key 3)
  if (keys['Digit3']) { keys['Digit3'] = false; shopState = null; openSeleneUpgrade(); return; }

  if (keys['ArrowUp'] || keys['KeyW']) {
    keys['ArrowUp'] = false; keys['KeyW'] = false;
    shopState.cursor = Math.max(0, shopState.cursor - 1);
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    keys['ArrowDown'] = false; keys['KeyS'] = false;
    const max = shopState.tab === 'buy' ? shopState.stock.length - 1 : getSellableItems().length - 1;
    shopState.cursor = Math.min(max, shopState.cursor + 1);
  }
  if (keys['Enter'] || keys['Space']) {
    keys['Enter'] = false; keys['Space'] = false;
    if (shopState.tab === 'buy') {
      const item = shopState.stock[shopState.cursor];
      if (item && player.gold >= item.price) {
        player.gold -= item.price;
        if (item.item.type === 'equip' || item.item.type === 'ring' || item.item.type === 'amulet') {
          if (player.inventory.length < 20) {
            player.inventory.push({...item.item});
          } else {
            player.gold += item.price; // refund
            return;
          }
        } else {
          // GDD §15: Verificar limite de consumíveis
          if (typeof canAddConsumable === 'function' && !canAddConsumable(item.item.id)) {
            player.gold += item.price; // refund
            return;
          }
          const existing = player.consumables.find(c => c.id === item.item.id);
          if (existing) existing.qty++;
          else player.consumables.push({...item.item, qty:1});
        }
        sfx('shopBuy');
      }
    } else {
      // Sell
      const sellItems = getSellableItems();
      const sel = sellItems[shopState.cursor];
      if (sel) {
        let sellPrice = 0;
        if (sel.item.type === 'ring') {
          const ringPrices = {cobre:40, prata:100, ouro:200, rubi:400, ancestral:800};
          sellPrice = Math.floor((ringPrices[sel.item.tier] || 40) * 0.4);
        } else if (sel.item.type === 'amulet') {
          sellPrice = Math.floor((AMULET_SELENE_PRICES[sel.item.rarity] || 40) * 0.4);
        } else {
          sellPrice = Math.floor(getEquipPrice(sel.item.slot, sel.item.tier) * 0.4);
        }
        player.gold += sellPrice;
        player.inventory.splice(sel.index, 1);
        sfx('gold');
        shopState.cursor = Math.max(0, shopState.cursor - 1);
      }
    }
  }
}

function handleInventoryInput() {
  if (keys['Escape'] || keys['KeyI']) {
    keys['Escape'] = false; keys['KeyI'] = false;
    inventoryState = null; gameState = 'playing'; return;
  }
  if (keys['Tab']) {
    keys['Tab'] = false;
    inventoryState.section = inventoryState.section === 'equip' ? 'bag' : 'equip';
  }
  if (keys['ArrowUp'] || keys['KeyW']) {
    keys['ArrowUp'] = false; keys['KeyW'] = false;
    if (inventoryState.section === 'equip')
      inventoryState.equipCursor = Math.max(0, inventoryState.equipCursor - 1);
    else
      inventoryState.cursor = Math.max(0, inventoryState.cursor - 1);
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    keys['ArrowDown'] = false; keys['KeyS'] = false;
    if (inventoryState.section === 'equip')
      inventoryState.equipCursor = Math.min(7, inventoryState.equipCursor + 1);
    else
      inventoryState.cursor = Math.min(player.inventory.length - 1, inventoryState.cursor + 1);
  }
  if (keys['Enter'] || keys['Space']) {
    keys['Enter'] = false; keys['Space'] = false;
    if (inventoryState.section === 'bag' && player.inventory.length > 0) {
      const item = player.inventory[inventoryState.cursor];
      if (item && item.type === 'equip' && item.slot) {
        // Equip item
        const oldEquip = player.equipment[item.slot];
        player.equipment[item.slot] = item;
        player.inventory.splice(inventoryState.cursor, 1);
        if (oldEquip) player.inventory.push(oldEquip);
        sfx('equip');
        inventoryState.cursor = Math.min(inventoryState.cursor, player.inventory.length - 1);
      } else if (item && item.type === 'ring') {
        // GDD §3: 2 slots de anel — prioriza ring1, depois ring2
        const targetSlot = !player.equipment.ring1 ? 'ring1' : 'ring2';
        const oldEquip = player.equipment[targetSlot];
        player.equipment[targetSlot] = item;
        player.inventory.splice(inventoryState.cursor, 1);
        if (oldEquip) player.inventory.push(oldEquip);
        sfx('equip');
        inventoryState.cursor = Math.min(inventoryState.cursor, player.inventory.length - 1);
      } else if (item && item.type === 'amulet') {
        // GDD §3: 1 slot amuleto
        const oldEquip = player.equipment.amulet;
        player.equipment.amulet = item;
        player.inventory.splice(inventoryState.cursor, 1);
        if (oldEquip) player.inventory.push(oldEquip);
        sfx('equip');
        inventoryState.cursor = Math.min(inventoryState.cursor, player.inventory.length - 1);
      }
    } else if (inventoryState.section === 'equip') {
      // Unequip
      const eqSlots = ['weapon','body','head','secondary','feet','ring1','ring2','amulet'];
      const slot = eqSlots[inventoryState.equipCursor];
      const eq = player.equipment[slot];
      if (eq && player.inventory.length < 20) {
        player.inventory.push(eq);
        player.equipment[slot] = null;
        sfx('equip');
      }
    }
  }
}

function handleClassSelectInput() {
  if (!classSelectData) return;
  if (keys['ArrowUp'] || keys['KeyW']) {
    keys['ArrowUp'] = false; keys['KeyW'] = false;
    classSelectData.cursor = (classSelectData.cursor - 1 + 4) % 4;
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    keys['ArrowDown'] = false; keys['KeyS'] = false;
    classSelectData.cursor = (classSelectData.cursor + 1) % 4;
  }
  if (keys['Enter'] || keys['Space']) {
    keys['Enter'] = false; keys['Space'] = false;
    const chosen = classSelectData.classes[classSelectData.cursor];
    player.classKey = chosen;
    const cd = CLASS_DATA[chosen];
    player.resourceMax = cd.getMax();
    player.resource = player.resourceMax;
    // GDD §18: Auto-assign first skill of chosen class
    const classSkills = Object.keys(SKILLS).filter(id => SKILLS[id].cls === chosen);
    if (classSkills.length > 0) {
      const skill1Id = classSkills[0];
      player.skills[skill1Id] = 1;
      player.equippedSkills[0] = skill1Id;
    }
    sfx('classSelect');
    flashScreen('#ffd700', 0.3, 0.5);
    shakeScreen(3, 0.3);

    // GDD §10: Thornax T2 drop agora que temos classKey
    if (classSelectData.thornaxDrop) {
      const td = classSelectData.thornaxDrop;
      itemDrops.push({x:td.x, y:td.y, item: makeEquip(td.slot, 2, 0, chosen)});
    }
    // GDD §11: Droghan fala ao escolher classe
    classSelectData = null;
    startDialogue('Droghan', '#f0c8a0', ['É isso. Esse é o meu caminho.'], () => {
      // GDD §2: Nahgord provocação pós-Thornax (exato)
      startDialogue('???', '#5500aa', [
        'Interessante...',
        'Você derrotou meu cão de guarda.'
      ], () => {
        // GDD §11: Resposta do Droghan
        startDialogue('Droghan', '#f0c8a0', ['...Quem é você?'], null);
      });
    });
  }
}

function handleUpgradeInput() {
  if (!upgradeState) return;
  if (keys['Escape']) { keys['Escape'] = false; upgradeState = null; gameState = 'playing'; return; }

  // Clear result after a moment
  if (upgradeState.result) {
    upgradeState.resultTimer -= FIXED_DT;
    if (upgradeState.resultTimer <= 0) upgradeState.result = null;
  }

  if (keys['ArrowUp'] || keys['KeyW']) {
    keys['ArrowUp'] = false; keys['KeyW'] = false;
    upgradeState.cursor = Math.max(0, upgradeState.cursor - 1);
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    keys['ArrowDown'] = false; keys['KeyS'] = false;
    upgradeState.cursor = Math.min(upgradeState.slots.length - 1, upgradeState.cursor + 1);
  }
  if (keys['Enter'] || keys['Space']) {
    keys['Enter'] = false; keys['Space'] = false;
    const slot = upgradeState.slots[upgradeState.cursor];
    const eq = player.equipment[slot];
    if (!eq || eq.upgLevel >= 5) return;

    const upg = UPGRADE_DATA[eq.upgLevel];
    if (player.gold < upg.cost) return;

    // GDD §3: Paga ouro, rola chance
    player.gold -= upg.cost;
    if (Math.random() < upg.chance) {
      // Sucesso
      eq.upgLevel++;
      const info = EQUIP_STATS[slot];
      const baseVal = info['T' + eq.tier] || 0;
      eq[info.stat] = Math.round(baseVal * (1 + eq.upgLevel * 0.1));
      // Recria nome com classe
      const tmpEquip = makeEquip(slot, eq.tier, eq.upgLevel, eq.classKey || player.classKey);
      eq.name = tmpEquip.name;
      upgradeState.result = 'success';
      sfx('upgradeOk');
      flashScreen('#ffd700', 0.2, 0.3);
    } else {
      // GDD §3: Falha = perde ouro, SEM regressão
      upgradeState.result = 'fail';
      sfx('upgradeFail');
      shakeScreen(2, 0.2);
    }
    upgradeState.resultTimer = 2;
  }
}

function handleSeleneUpgradeInput() {
  if (!seleneUpgradeState) return;
  if (keys['Escape']) { keys['Escape'] = false; seleneUpgradeState = null; gameState = 'playing'; return; }

  // Clear result after a moment
  if (seleneUpgradeState.result) {
    seleneUpgradeState.resultTimer -= FIXED_DT;
    if (seleneUpgradeState.resultTimer <= 0) seleneUpgradeState.result = null;
  }

  if (keys['ArrowUp'] || keys['KeyW']) {
    keys['ArrowUp'] = false; keys['KeyW'] = false;
    seleneUpgradeState.cursor = Math.max(0, seleneUpgradeState.cursor - 1);
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    keys['ArrowDown'] = false; keys['KeyS'] = false;
    seleneUpgradeState.cursor = Math.min(seleneUpgradeState.slots.length - 1, seleneUpgradeState.cursor + 1);
  }
  if (keys['Enter'] || keys['Space']) {
    keys['Enter'] = false; keys['Space'] = false;
    const slot = seleneUpgradeState.slots[seleneUpgradeState.cursor];
    const eq = player.equipment[slot];
    if (!eq || eq.upgLevel >= 5) return;

    const upg = SELENE_UPGRADE_DATA[eq.upgLevel];
    if (player.gold < upg.cost) return;

    // GDD §3: Paga ouro, rola chance
    player.gold -= upg.cost;
    if (Math.random() < upg.chance) {
      // Sucesso
      eq.upgLevel++;
      if (eq.type === 'ring') {
        // GDD §3: Recalcula valor do anel
        const data = RING_DATA[eq.tier];
        eq.val = data.base + eq.upgLevel * data.incr;
        const upStr = eq.upgLevel ? ' +' + eq.upgLevel : '';
        eq.name = data.name + upStr;
      } else if (eq.type === 'amulet') {
        // GDD §3: Recalcula valores do amuleto (multiplica base)
        const mult = AMULET_UPGRADE_MULT[eq.upgLevel] || 1.0;
        eq.val1 = Math.floor(eq.baseVal1 * mult);
        eq.val2 = Math.floor(eq.baseVal2 * mult);
        const upStr = eq.upgLevel ? ' +' + eq.upgLevel : '';
        eq.name = 'Amuleto ' + AMULET_RARITY_NAMES[eq.rarity] + upStr;
      }
      seleneUpgradeState.result = 'success';
      sfx('upgradeOk');
      flashScreen('#9966cc', 0.2, 0.3);
    } else {
      // GDD §3: Falha = perde ouro, SEM regressão
      seleneUpgradeState.result = 'fail';
      sfx('upgradeFail');
      shakeScreen(2, 0.2);
    }
    seleneUpgradeState.resultTimer = 2;
  }
}

// ============================================================
// TELA INICIAL / MENU PRINCIPAL — GDD §26
// ============================================================
let menuState = {cursor: 0, slots: null, slotCursor: 0, importing: false, importText: '', confirmDelete: -1};

function renderMainMenu() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Fundo — silhueta dungeon
  ctx.fillStyle = '#111122';
  for (let i = 0; i < 8; i++) {
    const w = 30 + Math.sin(i*1.3)*15;
    const h = 60 + Math.cos(i*0.9)*40;
    ctx.fillRect(VIEW_W/2 - 120 + i*30, VIEW_H - h - 20, w, h);
  }

  // Droghan silhueta (centro)
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(VIEW_W/2 - 8, VIEW_H - 90, 16, 24);
  ctx.fillRect(VIEW_W/2 - 6, VIEW_H - 96, 12, 8);

  // Título
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('The Shadow of', VIEW_W/2, 60);
  ctx.font = 'bold 22px monospace';
  ctx.fillText('DROGHAN', VIEW_W/2, 85);

  // Opções
  const options = [];
  const saves = getAllLocalSaves();
  const hasAnySave = Object.keys(saves).length > 0;
  if (hasAnySave) options.push('Continuar');
  options.push('Novo Jogo');
  options.push('Importar Save');

  ctx.font = '10px monospace';
  const startY = 140;
  for (let i = 0; i < options.length; i++) {
    const sel = i === menuState.cursor;
    ctx.fillStyle = sel ? '#ffd700' : '#888';
    ctx.fillText((sel ? '▶ ' : '  ') + options[i], VIEW_W/2, startY + i * 22);
  }

  // Cloud status
  ctx.font = '7px monospace';
  ctx.fillStyle = cloudReady ? '#44cc44' : '#666';
  ctx.fillText(cloudReady ? '☁ Nuvem conectada' : '☁ Offline (local)', VIEW_W/2, VIEW_H - 10);
  ctx.textAlign = 'left';
}

function handleMainMenuInput() {
  const saves = getAllLocalSaves();
  const hasAnySave = Object.keys(saves).length > 0;
  const options = [];
  if (hasAnySave) options.push('continue');
  options.push('newgame');
  options.push('import');

  if (keys.ArrowUp || keys.KeyW) { menuState.cursor = (menuState.cursor - 1 + options.length) % options.length; keys.ArrowUp = keys.KeyW = false; }
  if (keys.ArrowDown || keys.KeyS) { menuState.cursor = (menuState.cursor + 1) % options.length; keys.ArrowDown = keys.KeyS = false; }
  if (keys.Enter || keys.Space) {
    keys.Enter = keys.Space = false;
    const sel = options[menuState.cursor];
    if (sel === 'continue') {
      // Carregar último slot usado
      const last = parseInt(localStorage.getItem('shadowOfDroghan_lastSlot') || '0');
      loadAndStartSlot(last);
    } else if (sel === 'newgame') {
      gameState = 'slotSelect';
      menuState.slotCursor = 0;
      menuState.confirmDelete = -1;
    } else if (sel === 'import') {
      gameState = 'importSave';
      menuState.importText = '';
    }
  }
}

// Tela de seleção de slots
function renderSlotSelect() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Selecionar Slot', VIEW_W/2, 30);

  const saves = getAllLocalSaves();
  for (let i = 0; i < 3; i++) {
    const sel = i === menuState.slotCursor;
    const data = saves[i];
    const y = 55 + i * 85;

    // Fundo do slot
    ctx.fillStyle = sel ? '#222244' : '#111122';
    ctx.fillRect(40, y, VIEW_W - 80, 75);
    ctx.strokeStyle = sel ? '#ffd700' : '#333';
    ctx.strokeRect(40, y, VIEW_W - 80, 75);

    ctx.fillStyle = sel ? '#ffd700' : '#aaa';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Slot ${i+1}`, 50, y + 15);

    if (data) {
      ctx.fillStyle = '#ccc';
      ctx.fillText(`${data.classKey ? data.classKey.charAt(0).toUpperCase() + data.classKey.slice(1) : 'Sem classe'} Lv.${data.level}`, 50, y + 30);
      ctx.fillText(`Andar ${data.currentFloor}/${data.maxFloorReached}`, 50, y + 44);
      const mins = Math.floor((data.tempoJogado||0)/60);
      const hrs = Math.floor(mins/60);
      ctx.fillText(`Tempo: ${hrs}h${(mins%60).toString().padStart(2,'0')}m`, 50, y + 58);
      ctx.fillText(`Mortes: ${data.deaths||0}`, 200, y + 44);
      // Deletar
      if (sel) {
        ctx.fillStyle = '#cc4444';
        ctx.textAlign = 'right';
        ctx.fillText('[D] Apagar', VIEW_W - 50, y + 15);
        ctx.textAlign = 'left';
      }
    } else {
      ctx.fillStyle = '#666';
      ctx.fillText('Vazio — Novo Jogo', 50, y + 38);
    }
  }

  // Confirmação de delete
  if (menuState.confirmDelete >= 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Apagar Slot ${menuState.confirmDelete+1}?`, VIEW_W/2, VIEW_H/2 - 15);
    ctx.fillStyle = '#ccc';
    ctx.font = '8px monospace';
    ctx.fillText('Enter = Confirmar | ESC = Cancelar', VIEW_W/2, VIEW_H/2 + 10);
  }

  ctx.fillStyle = '#666';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ESC = Voltar', VIEW_W/2, VIEW_H - 10);
  ctx.textAlign = 'left';
}

function handleSlotSelectInput() {
  // Confirmação delete
  if (menuState.confirmDelete >= 0) {
    if (keys.Enter) {
      keys.Enter = false;
      deleteLocalSave(menuState.confirmDelete);
      deleteCloudSave(menuState.confirmDelete);
      menuState.confirmDelete = -1;
    }
    if (keys.Escape) { keys.Escape = false; menuState.confirmDelete = -1; }
    return;
  }

  if (keys.ArrowUp || keys.KeyW) { menuState.slotCursor = (menuState.slotCursor - 1 + 3) % 3; keys.ArrowUp = keys.KeyW = false; }
  if (keys.ArrowDown || keys.KeyS) { menuState.slotCursor = (menuState.slotCursor + 1) % 3; keys.ArrowDown = keys.KeyS = false; }
  if (keys.Escape) { keys.Escape = false; gameState = 'mainMenu'; menuState.cursor = 0; return; }
  if (keys.KeyD) {
    keys.KeyD = false;
    const saves = getAllLocalSaves();
    if (saves[menuState.slotCursor]) menuState.confirmDelete = menuState.slotCursor;
    return;
  }
  if (keys.Enter || keys.Space) {
    keys.Enter = keys.Space = false;
    const saves = getAllLocalSaves();
    const slot = menuState.slotCursor;
    if (saves[slot]) {
      loadAndStartSlot(slot);
    } else {
      // Novo jogo neste slot
      currentSaveSlot = slot;
      localStorage.setItem('shadowOfDroghan_lastSlot', slot.toString());
      initPlayer();
      // GDD §11: Opening cutscene "A Profecia" before gameplay
      startOpeningCutscene();
    }
  }
}

// Tela de importar save
function renderImportSave() {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Importar Save', VIEW_W/2, 40);
  ctx.fillStyle = '#ccc';
  ctx.font = '8px monospace';
  ctx.fillText('Cole o código base64 e pressione Enter', VIEW_W/2, 65);
  ctx.fillText('ESC = Voltar', VIEW_W/2, VIEW_H - 20);

  // Textarea visual
  ctx.fillStyle = '#111';
  ctx.fillRect(30, 80, VIEW_W - 60, 180);
  ctx.strokeStyle = '#444';
  ctx.strokeRect(30, 80, VIEW_W - 60, 180);
  ctx.fillStyle = '#aaa';
  ctx.font = '7px monospace';
  ctx.textAlign = 'left';
  const preview = menuState.importText.length > 200 ? menuState.importText.substring(0,200)+'...' : menuState.importText;
  const lines = [];
  for (let i = 0; i < preview.length; i += 55) lines.push(preview.substring(i, i+55));
  for (let i = 0; i < lines.length && i < 20; i++) ctx.fillText(lines[i], 35, 95 + i * 9);
  if (!menuState.importText) { ctx.fillStyle = '#555'; ctx.fillText('Ctrl+V para colar...', 35, 95); }
  ctx.textAlign = 'left';
}

function handleImportSaveInput() {
  if (keys.Escape) { keys.Escape = false; gameState = 'mainMenu'; menuState.cursor = 0; return; }
  if (keys.Enter && menuState.importText.length > 0) {
    keys.Enter = false;
    const data = importSaveBase64(menuState.importText);
    if (data) {
      currentSaveSlot = 0;
      loadSaveData(data);
      saveToLocal(currentSaveSlot);
      startFloor(currentFloor);
    } else {
      menuState.importText = ''; // Limpa se inválido
    }
  }
}

// Helper: carregar slot e iniciar jogo
async function loadAndStartSlot(slot) {
  currentSaveSlot = slot;
  localStorage.setItem('shadowOfDroghan_lastSlot', slot.toString());
  // GDD §22: Resolver conflito nuvem vs local
  let data = loadFromLocal(slot);
  if (cloudReady) {
    const cloudData = await loadFromCloud(slot);
    if (data && cloudData) {
      // Ambos existem — comparar timestamps, oferecer escolha
      if (cloudData.timestamp !== data.timestamp) {
        const localDate = new Date(data.timestamp).toLocaleString();
        const cloudDate = new Date(cloudData.timestamp).toLocaleString();
        const useCloud = cloudData.timestamp > data.timestamp;
        // Mostrar conflito — por ora usa mais recente (popup futuro)
        data = useCloud ? cloudData : data;
      }
    } else if (cloudData && !data) {
      data = cloudData;
    }
  }
  if (data && loadSaveData(data)) {
    startFloor(currentFloor);
  } else {
    initPlayer();
    startFloor(1);
  }
}

// Handler de paste para importar save
document.addEventListener('paste', (e) => {
  if (gameState !== 'importSave') return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (text) menuState.importText = text;
});

// ============================================================
// MENU DE PAUSA COMPLETO — GDD §13
// ============================================================
let pauseMenuCursor = 0;
function getPauseOptions() {
  const sfxPct = Math.round(sfxVolume * 100);
  const musPct = Math.round(musicVolume * 100);
  const sfxBar = '\u2588'.repeat(Math.round(sfxVolume * 10)) + '\u2591'.repeat(10 - Math.round(sfxVolume * 10));
  const musBar = '\u2588'.repeat(Math.round(musicVolume * 10)) + '\u2591'.repeat(10 - Math.round(musicVolume * 10));
  return [
    'Continuar','Inventário','Stats',
    'SFX: ' + sfxBar + ' ' + sfxPct + '%',
    'Musica: ' + musBar + ' ' + musPct + '%',
    'Salvar','Exportar Save','Sair'
  ];
}
const PAUSE_SFX_INDEX = 3;
const PAUSE_MUSIC_INDEX = 4;

function renderPauseMenuFull() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSADO', VIEW_W/2, 40);

  // Opções
  const pauseOpts = getPauseOptions();
  ctx.font = '10px monospace';
  for (let i = 0; i < pauseOpts.length; i++) {
    const sel = i === pauseMenuCursor;
    ctx.fillStyle = sel ? '#ffd700' : '#aaa';
    ctx.fillText((sel ? '\u25B6 ' : '  ') + pauseOpts[i], VIEW_W/2, 80 + i * 20);
  }

  // Info rápida
  ctx.font = '7px monospace';
  ctx.fillStyle = '#666';
  ctx.fillText(`Slot ${currentSaveSlot+1} | ${cloudReady ? '☁ Nuvem' : '💾 Local'}`, VIEW_W/2, VIEW_H - 15);
  ctx.textAlign = 'left';
}

function handlePauseMenuInput() {
  const pauseOpts = getPauseOptions();
  if (keys.ArrowUp || keys.KeyW) { pauseMenuCursor = (pauseMenuCursor - 1 + pauseOpts.length) % pauseOpts.length; keys.ArrowUp = keys.KeyW = false; }
  if (keys.ArrowDown || keys.KeyS) { pauseMenuCursor = (pauseMenuCursor + 1) % pauseOpts.length; keys.ArrowDown = keys.KeyS = false; }

  // Volume sliders: left/right adjusts volume
  if (pauseMenuCursor === PAUSE_SFX_INDEX) {
    if (keys.ArrowLeft || keys.KeyA) { sfxVolume = Math.max(0, Math.round((sfxVolume - 0.1) * 10) / 10); keys.ArrowLeft = keys.KeyA = false; }
    if (keys.ArrowRight || keys.KeyD) { sfxVolume = Math.min(1, Math.round((sfxVolume + 0.1) * 10) / 10); keys.ArrowRight = keys.KeyD = false; }
  }
  if (pauseMenuCursor === PAUSE_MUSIC_INDEX) {
    if (keys.ArrowLeft || keys.KeyA) { musicVolume = Math.max(0, Math.round((musicVolume - 0.1) * 10) / 10); keys.ArrowLeft = keys.KeyA = false; if (typeof updateMusicVolume === 'function') updateMusicVolume(); }
    if (keys.ArrowRight || keys.KeyD) { musicVolume = Math.min(1, Math.round((musicVolume + 0.1) * 10) / 10); keys.ArrowRight = keys.KeyD = false; if (typeof updateMusicVolume === 'function') updateMusicVolume(); }
  }

  if (keys.Escape) { keys.Escape = false; gameState = 'playing'; return; }
  if (keys.Enter || keys.Space) {
    keys.Enter = keys.Space = false;
    switch (pauseMenuCursor) {
      case 0: gameState = 'playing'; break; // Continuar
      case 1: gameState = 'inventory'; break; // Inventário
      case 2: gameState = 'stats'; break; // Stats
      case PAUSE_SFX_INDEX: break; // SFX volume — use left/right
      case PAUSE_MUSIC_INDEX: break; // Music volume — use left/right
      case 5: // Salvar
        triggerSave();
        damageNumbers.push({x:player.x, y:player.y-30, text:'Salvo!', color:'#44cc44', size:8, timer:1.5, vy:-15});
        gameState = 'playing';
        break;
      case 6: // Exportar Save
        gameState = 'exportSave';
        menuState.exportCode = exportSaveBase64(currentSaveSlot);
        break;
      case 7: // Sair
        triggerSave();
        gameState = 'mainMenu';
        menuState.cursor = 0;
        break;
    }
  }
}

// Tela Stats
function renderStatsScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Estatísticas', VIEW_W/2, 25);

  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  const x1 = 40, x2 = 250;
  let y = 50;
  const line = (label, val) => { ctx.fillStyle = '#aaa'; ctx.fillText(label, x1, y); ctx.fillStyle = '#fff'; ctx.fillText(''+val, x2, y); y += 14; };

  line('Classe:', player.classKey ? player.classKey.charAt(0).toUpperCase() + player.classKey.slice(1) : 'Nenhuma');
  line('Nível:', player.level);
  line('XP:', player.xp + '/' + getXpToNext());
  line('HP:', player.hp + '/' + getMaxHp());
  line('Ouro:', player.gold);
  y += 5;
  line('FOR:', player.FOR); line('DES:', player.DES); line('INT:', player.INT);
  line('AGI:', player.AGI); line('VIT:', player.VIT); line('SOR:', player.SOR);
  y += 5;
  line('ATK Físico:', getAtkFis()); line('ATK Mágico:', getAtkMag()); line('DEF:', getDefense());
  y += 5;
  line('Andar:', currentFloor + '/' + maxFloorReached);
  line('Mortes:', player.deaths);
  line('Inimigos:', player.enemiesKilled);
  const bossCount = Object.keys(bossDefeated).filter(k => bossDefeated[k]).length;
  line('Bosses Derrotados:', bossCount + '/5');
  line('Ouro total:', player.ouroTotal);
  const mins = Math.floor(player.tempoJogado/60);
  line('Tempo:', Math.floor(mins/60) + 'h' + (mins%60).toString().padStart(2,'0') + 'm');

  ctx.fillStyle = '#666';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ESC = Voltar', VIEW_W/2, VIEW_H - 10);
  ctx.textAlign = 'left';
}

// Tela Export
function renderExportSave() {
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Exportar Save', VIEW_W/2, 30);
  ctx.fillStyle = '#ccc';
  ctx.font = '8px monospace';
  ctx.fillText('Copie o código abaixo (Ctrl+C)', VIEW_W/2, 50);

  ctx.fillStyle = '#111';
  ctx.fillRect(20, 60, VIEW_W - 40, 200);
  ctx.strokeStyle = '#444';
  ctx.strokeRect(20, 60, VIEW_W - 40, 200);

  ctx.fillStyle = '#aaa';
  ctx.font = '6px monospace';
  ctx.textAlign = 'left';
  const code = menuState.exportCode || '';
  const lines = [];
  for (let i = 0; i < code.length; i += 70) lines.push(code.substring(i, i+70));
  for (let i = 0; i < Math.min(lines.length, 25); i++) ctx.fillText(lines[i], 25, 75 + i * 8);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#666';
  ctx.font = '7px monospace';
  ctx.fillText('ESC = Voltar', VIEW_W/2, VIEW_H - 10);
  ctx.textAlign = 'left';

  // Auto-copy to clipboard
  if (code && !menuState.exportCopied) {
    menuState.exportCopied = true;
    navigator.clipboard.writeText(code).catch(() => {});
  }
}
