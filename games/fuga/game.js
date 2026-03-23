/**
 * Fuga — Escape Room Online
 * Canvas 2D escape room with 5 Brazilian-themed rooms.
 * No external dependencies, procedural drawing only.
 */

import { onGameEnd } from '../shared/game-integration.js';
import { GameStats, GameStorage } from '../shared/game-core.js';

/* ============================================================
   CONSTANTS & DOM
   ============================================================ */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayIcon = document.getElementById('overlay-icon');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayScore = document.getElementById('overlay-score');
const btnStart = document.getElementById('btn-start');
const btnShare = document.getElementById('btn-share');
const roomDisp = document.getElementById('room-display');
const timeDisp = document.getElementById('time-display');
const hintsDisp = document.getElementById('hints-display');

const DESIGN_W = 800;
const DESIGN_H = 600;
const INV_H = 70;           // inventory bar height at bottom
const ROOM_H = DESIGN_H - INV_H;
const PRIMARY = '#ffb347';
const PRIMARY_DIM = '#ffb34766';
const BG_DARK = '#0e0e0e';
const TEXT_COLOR = '#e2e2e2';

/* ============================================================
   STATE
   ============================================================ */
let state = 'MENU'; // MENU | PLAYING | SOLVED | ROOM_SELECT
let currentRoom = 0;
let timerStart = 0;
let elapsedSeconds = 0;
let totalScore = 0;
let hintsLeft = 3;
let inventory = [];
let draggingItem = null;
let dragX = 0, dragY = 0;
let hoverObj = null;
let messageText = '';
let messageTimer = 0;
let roomsCompleted = [false, false, false, false, false];
let animFrame = 0;
let selectedInvSlot = -1;

// Touch / mouse unified
let pointerDown = false;
let pointerX = 0, pointerY = 0;

const stats = new GameStats('fuga');

/* ============================================================
   ROOM DEFINITIONS
   ============================================================ */

function createRooms() {
  return [
    // Room 0 — Escritorio do Detetive (Rio)
    {
      name: 'Escritorio do Detetive',
      subtitle: 'Rio de Janeiro',
      bgColor: '#1a1520',
      accentColor: '#4a9eff',
      hints: [
        'Examine a foto na parede — ha numeros escondidos.',
        'O cofre precisa de 3 digitos. Olhe a foto, o relogio e o livro.',
        'O codigo do cofre e 7-3-9.'
      ],
      hintsUsed: 0,
      solved: false,
      puzzleState: { foundPhoto: false, foundClock: false, foundBook: false, safeOpen: false },
      objects: [
        {
          id: 'desk', x: 200, y: 280, w: 400, h: 100, color: '#5c3d2e', label: 'Mesa',
          action(room) {
            if (!room.puzzleState.foundBook) {
              showMessage('Uma mesa de mogno. Ha um livro aberto na pagina 9.');
              room.puzzleState.foundBook = true;
            } else {
              showMessage('A mesa do detetive. Pagina 9 esta marcada.');
            }
          }
        },
        {
          id: 'photo', x: 100, y: 60, w: 120, h: 90, color: '#3a3a5a', label: 'Foto',
          action(room) {
            if (!room.puzzleState.foundPhoto) {
              showMessage('Uma foto do Corcovado. No canto: "7o andar".');
              room.puzzleState.foundPhoto = true;
            } else {
              showMessage('Foto do Corcovado — "7o andar".');
            }
          }
        },
        {
          id: 'clock', x: 580, y: 50, w: 80, h: 80, color: '#2a2a3a', label: 'Relogio',
          action(room) {
            if (!room.puzzleState.foundClock) {
              showMessage('Um relogio parado as 3:00.');
              room.puzzleState.foundClock = true;
            } else {
              showMessage('Relogio parado — 3 horas.');
            }
          }
        },
        {
          id: 'safe', x: 350, y: 140, w: 100, h: 90, color: '#4a4a4a', label: 'Cofre',
          action(room) {
            if (room.puzzleState.safeOpen) {
              showMessage('O cofre ja foi aberto!');
              return;
            }
            if (room.puzzleState.foundPhoto && room.puzzleState.foundClock && room.puzzleState.foundBook) {
              showMessage('Codigo 7-3-9 aceito! O cofre abriu! Chave encontrada!');
              room.puzzleState.safeOpen = true;
              addToInventory('chave-porta', 'Chave Dourada', '#ffd700');
            } else {
              showMessage('Cofre trancado. Precisa de 3 digitos. Procure pistas!');
            }
          }
        },
        {
          id: 'door', x: 700, y: 150, w: 60, h: 200, color: '#654321', label: 'Porta',
          action(room) {
            if (room.puzzleState.safeOpen && hasItem('chave-porta')) {
              removeItem('chave-porta');
              room.solved = true;
              completeRoom();
            } else if (room.puzzleState.safeOpen) {
              showMessage('Precisa da chave do cofre para abrir a porta.');
            } else {
              showMessage('Porta trancada. Deve haver uma chave em algum lugar...');
            }
          },
          acceptsItem: 'chave-porta'
        },
        {
          id: 'window', x: 30, y: 180, w: 60, h: 100, color: '#1a2a4a', label: 'Janela',
          action() { showMessage('A vista do Rio a noite. Luzes da cidade brilham.'); }
        },
        {
          id: 'lamp', x: 500, y: 250, w: 40, h: 80, color: '#8a7a3a', label: 'Abajur',
          action() { showMessage('Um abajur art-deco. Ilumina a mesa suavemente.'); }
        }
      ]
    },

    // Room 1 — Cozinha da Vovo Baiana
    {
      name: 'Cozinha da Vovo Baiana',
      subtitle: 'Salvador, Bahia',
      bgColor: '#1e1510',
      accentColor: '#ff6b35',
      hints: [
        'A receita no quadro mostra a ordem: dende, camarao, coco.',
        'Colete cada ingrediente e coloque na panela NA ORDEM certa.',
        'Ordem: primeiro dende, depois camarao, por ultimo coco.'
      ],
      hintsUsed: 0,
      solved: false,
      puzzleState: { recipe: ['dende', 'camarao', 'coco'], added: [], recipeFound: false },
      objects: [
        {
          id: 'recipe-board', x: 100, y: 40, w: 180, h: 120, color: '#f5f0dc', label: 'Quadro de Receita',
          action(room) {
            room.puzzleState.recipeFound = true;
            showMessage('Moqueca da Vovo: 1) Dende 2) Camarao 3) Coco');
          }
        },
        {
          id: 'dende', x: 50, y: 300, w: 70, h: 60, color: '#ff8c00', label: 'Dende',
          action(room) {
            if (!hasItem('dende')) {
              addToInventory('dende', 'Azeite de Dende', '#ff8c00');
              showMessage('Azeite de dende coletado!');
            } else {
              showMessage('Ja tem o dende.');
            }
          },
          collectible: true
        },
        {
          id: 'camarao', x: 600, y: 280, w: 80, h: 50, color: '#ff6b6b', label: 'Camarao',
          action(room) {
            if (!hasItem('camarao')) {
              addToInventory('camarao', 'Camarao Fresco', '#ff6b6b');
              showMessage('Camarao coletado!');
            } else {
              showMessage('Ja tem o camarao.');
            }
          },
          collectible: true
        },
        {
          id: 'coco', x: 350, y: 60, w: 60, h: 60, color: '#f5f5dc', label: 'Leite de Coco',
          action(room) {
            if (!hasItem('coco')) {
              addToInventory('coco', 'Leite de Coco', '#f5f5dc');
              showMessage('Leite de coco coletado!');
            } else {
              showMessage('Ja tem o coco.');
            }
          },
          collectible: true
        },
        {
          id: 'panela', x: 300, y: 300, w: 140, h: 100, color: '#8b4513', label: 'Panela de Barro',
          action(room) {
            const ps = room.puzzleState;
            const nextIdx = ps.added.length;
            if (nextIdx >= ps.recipe.length) {
              showMessage('A moqueca esta pronta! Que cheiro bom!');
              return;
            }
            const needed = ps.recipe[nextIdx];
            if (hasItem(needed)) {
              removeItem(needed);
              ps.added.push(needed);
              if (ps.added.length === ps.recipe.length) {
                showMessage('Moqueca perfeita! A vovo deixou a chave dentro!');
                addToInventory('chave-cozinha', 'Chave de Cobre', '#b87333');
              } else {
                showMessage(`${capitalize(needed)} adicionado! Faltam ${ps.recipe.length - ps.added.length}.`);
              }
            } else if (inventory.length > 0) {
              // Wrong order — reset
              const wrongItem = inventory.find(i => ps.recipe.includes(i.id));
              if (wrongItem) {
                showMessage('Ordem errada! A vovo nao aprovaria... Tente de novo!');
                // put items back
                ps.added.forEach(id => addToInventory(id, capitalize(id), getIngredientColor(id)));
                ps.added = [];
              } else {
                showMessage('Precisa dos ingredientes certos!');
              }
            } else {
              showMessage('Panela vazia. Colete ingredientes e coloque na ordem da receita!');
            }
          },
          acceptsItem: 'any-ingredient'
        },
        {
          id: 'door-kitchen', x: 700, y: 150, w: 60, h: 200, color: '#654321', label: 'Porta',
          action(room) {
            if (hasItem('chave-cozinha')) {
              removeItem('chave-cozinha');
              room.solved = true;
              completeRoom();
            } else {
              showMessage('Porta trancada. Complete a receita da vovo!');
            }
          },
          acceptsItem: 'chave-cozinha'
        },
        {
          id: 'fogao', x: 500, y: 350, w: 120, h: 80, color: '#3a3a3a', label: 'Fogao',
          action() { showMessage('Um fogao a lenha antigo. Ainda quente.'); }
        }
      ]
    },

    // Room 2 — Laboratorio Amazonia
    {
      name: 'Laboratorio Amazonia',
      subtitle: 'Manaus, AM',
      bgColor: '#0e1a10',
      accentColor: '#00ff88',
      hints: [
        'As cores dos frascos na prateleira indicam a sequencia.',
        'Misture na ordem: Verde, Azul, Roxo (de cima para baixo na prateleira).',
        'Clique nos tubos de ensaio na ordem: verde, azul, roxo.'
      ],
      hintsUsed: 0,
      solved: false,
      puzzleState: { sequence: ['verde', 'azul', 'roxo'], entered: [], shelfExamined: false, mixed: false },
      objects: [
        {
          id: 'shelf', x: 50, y: 30, w: 150, h: 200, color: '#2a3a2a', label: 'Prateleira',
          action(room) {
            room.puzzleState.shelfExamined = true;
            showMessage('Frascos organizados de cima p/ baixo: VERDE, AZUL, ROXO.');
          }
        },
        {
          id: 'tubo-verde', x: 300, y: 100, w: 50, h: 80, color: '#00cc44', label: 'Tubo Verde',
          action(room) { addTubeToSequence(room, 'verde'); }
        },
        {
          id: 'tubo-azul', x: 400, y: 100, w: 50, h: 80, color: '#4488ff', label: 'Tubo Azul',
          action(room) { addTubeToSequence(room, 'azul'); }
        },
        {
          id: 'tubo-roxo', x: 500, y: 100, w: 50, h: 80, color: '#9944cc', label: 'Tubo Roxo',
          action(room) { addTubeToSequence(room, 'roxo'); }
        },
        {
          id: 'tubo-vermelho', x: 600, y: 100, w: 50, h: 80, color: '#cc2222', label: 'Tubo Vermelho',
          action(room) { addTubeToSequence(room, 'vermelho'); }
        },
        {
          id: 'microscope', x: 250, y: 280, w: 80, h: 100, color: '#555555', label: 'Microscopio',
          action() { showMessage('Um microscopio avancado. Amostras da floresta amazonica.'); }
        },
        {
          id: 'beaker', x: 450, y: 280, w: 100, h: 80, color: '#335544', label: 'Bequer',
          action(room) {
            if (room.puzzleState.mixed) {
              showMessage('A formula esta pronta! Brilha com uma luz verde.');
            } else {
              showMessage('Bequer vazio. Misture os quimicos na ordem correta!');
            }
          }
        },
        {
          id: 'door-lab', x: 700, y: 150, w: 60, h: 200, color: '#2a4a2a', label: 'Porta',
          action(room) {
            if (hasItem('cartao-lab')) {
              removeItem('cartao-lab');
              room.solved = true;
              completeRoom();
            } else {
              showMessage('Porta com leitor de cartao. Precisa de um cartao de acesso.');
            }
          },
          acceptsItem: 'cartao-lab'
        },
        {
          id: 'plant', x: 30, y: 300, w: 80, h: 120, color: '#1a5a1a', label: 'Planta',
          action() { showMessage('Uma bromeleia rara da Amazonia. Linda!'); }
        }
      ]
    },

    // Room 3 — Camarim de Escola de Samba
    {
      name: 'Camarim de Samba',
      subtitle: 'Rio de Janeiro',
      bgColor: '#1a0e1e',
      accentColor: '#ff44aa',
      hints: [
        'O manequim precisa de 3 pecas: plumas, saia e coroa. Nessa ordem!',
        'Colete as pecas espalhadas e coloque no manequim de baixo para cima.',
        'Ordem: saia (baixo), plumas (meio), coroa (topo).'
      ],
      hintsUsed: 0,
      solved: false,
      puzzleState: { pieces: ['saia', 'plumas', 'coroa'], placed: [] },
      objects: [
        {
          id: 'manequim', x: 340, y: 100, w: 100, h: 280, color: '#deb887', label: 'Manequim',
          action(room) {
            const ps = room.puzzleState;
            const nextIdx = ps.placed.length;
            if (nextIdx >= ps.pieces.length) {
              showMessage('Fantasia completa! Que espetaculo!');
              return;
            }
            const needed = ps.pieces[nextIdx];
            if (hasItem(needed)) {
              removeItem(needed);
              ps.placed.push(needed);
              if (ps.placed.length === ps.pieces.length) {
                showMessage('Fantasia montada! A porta do camarim destravou!');
                room.puzzleState.doorOpen = true;
              } else {
                showMessage(`${capitalize(needed)} colocado(a)! Faltam ${ps.pieces.length - ps.placed.length}.`);
              }
            } else {
              showMessage(`O manequim precisa: ${ps.pieces.map(capitalize).join(', ')}. Nessa ordem!`);
            }
          },
          acceptsItem: 'costume-piece'
        },
        {
          id: 'saia', x: 60, y: 350, w: 80, h: 50, color: '#ff1493', label: 'Saia de Plumas',
          action() {
            if (!hasItem('saia')) { addToInventory('saia', 'Saia de Plumas', '#ff1493'); showMessage('Saia coletada!'); }
            else showMessage('Ja tem a saia.');
          }, collectible: true
        },
        {
          id: 'plumas', x: 600, y: 200, w: 80, h: 60, color: '#ff69b4', label: 'Plumas',
          action() {
            if (!hasItem('plumas')) { addToInventory('plumas', 'Plumas Coloridas', '#ff69b4'); showMessage('Plumas coletadas!'); }
            else showMessage('Ja tem as plumas.');
          }, collectible: true
        },
        {
          id: 'coroa', x: 150, y: 50, w: 70, h: 50, color: '#ffd700', label: 'Coroa',
          action() {
            if (!hasItem('coroa')) { addToInventory('coroa', 'Coroa Dourada', '#ffd700'); showMessage('Coroa coletada!'); }
            else showMessage('Ja tem a coroa.');
          }, collectible: true
        },
        {
          id: 'mirror', x: 550, y: 40, w: 100, h: 140, color: '#668899', label: 'Espelho',
          action() { showMessage('Um grande espelho iluminado. Voce se ve refletido.'); }
        },
        {
          id: 'makeup', x: 100, y: 200, w: 80, h: 40, color: '#cc6699', label: 'Maquiagem',
          action() { showMessage('Bancada de maquiagem cheia de glitter e cores.'); }
        },
        {
          id: 'door-samba', x: 700, y: 150, w: 60, h: 200, color: '#5a2a5a', label: 'Porta',
          action(room) {
            if (room.puzzleState.doorOpen) {
              room.solved = true;
              completeRoom();
            } else {
              showMessage('Porta travada. Monte a fantasia no manequim!');
            }
          }
        }
      ]
    },

    // Room 4 — Biblioteca do Museu
    {
      name: 'Biblioteca do Museu',
      subtitle: 'Sao Paulo',
      bgColor: '#151015',
      accentColor: '#c9a84c',
      hints: [
        'As lombadas dos livros tem letras. Leia na ordem das cores: V-A-L-E.',
        'Examine cada estante para encontrar as letras. A senha e VALE.',
        'Digite VALE no terminal para abrir a porta.'
      ],
      hintsUsed: 0,
      solved: false,
      puzzleState: {
        letters: { red: 'V', blue: 'A', green: 'L', gold: 'E' },
        found: {},
        password: 'VALE',
        entered: '',
        terminalActive: false
      },
      objects: [
        {
          id: 'estante-red', x: 40, y: 50, w: 120, h: 200, color: '#8b2222', label: 'Estante Vermelha',
          action(room) {
            room.puzzleState.found['red'] = true;
            showMessage('Lombada vermelha com a letra "V" gravada.');
          }
        },
        {
          id: 'estante-blue', x: 200, y: 50, w: 120, h: 200, color: '#22448b', label: 'Estante Azul',
          action(room) {
            room.puzzleState.found['blue'] = true;
            showMessage('Lombada azul com a letra "A" gravada.');
          }
        },
        {
          id: 'estante-green', x: 400, y: 50, w: 120, h: 200, color: '#226b22', label: 'Estante Verde',
          action(room) {
            room.puzzleState.found['green'] = true;
            showMessage('Lombada verde com a letra "L" gravada.');
          }
        },
        {
          id: 'estante-gold', x: 560, y: 50, w: 120, h: 200, color: '#8b7322', label: 'Estante Dourada',
          action(room) {
            room.puzzleState.found['gold'] = true;
            showMessage('Lombada dourada com a letra "E" gravada.');
          }
        },
        {
          id: 'terminal', x: 300, y: 310, w: 120, h: 80, color: '#2a2a3a', label: 'Terminal',
          action(room) {
            const ps = room.puzzleState;
            const foundCount = Object.keys(ps.found).length;
            if (foundCount < 4) {
              showMessage(`Terminal ativo. Examine todas as estantes primeiro! (${foundCount}/4)`);
              return;
            }
            if (!ps.terminalActive) {
              ps.terminalActive = true;
              ps.entered = '';
              showMessage('Terminal desbloqueado! Clique nas estantes na ordem: V-A-L-E');
            } else {
              showMessage('Clique nas estantes na ordem correta para formar a senha.');
            }
          }
        },
        {
          id: 'globe', x: 100, y: 320, w: 70, h: 70, color: '#4a6a8a', label: 'Globo',
          action() { showMessage('Um globo antigo. O Brasil esta marcado com um X.'); }
        },
        {
          id: 'door-museum', x: 700, y: 150, w: 60, h: 200, color: '#5a4a2a', label: 'Porta',
          action(room) {
            if (room.puzzleState.entered === room.puzzleState.password) {
              room.solved = true;
              completeRoom();
            } else {
              showMessage('Porta eletronica. Use o terminal para inserir a senha.');
            }
          }
        }
      ]
    }
  ];
}

let rooms = createRooms();

/* ============================================================
   HELPER FUNCTIONS
   ============================================================ */

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function getIngredientColor(id) {
  const map = { dende: '#ff8c00', camarao: '#ff6b6b', coco: '#f5f5dc' };
  return map[id] || '#aaa';
}

function hasItem(id) { return inventory.some(i => i.id === id); }

function addToInventory(id, label, color) {
  if (!hasItem(id)) {
    inventory.push({ id, label, color });
  }
}

function removeItem(id) {
  inventory = inventory.filter(i => i.id !== id);
  if (selectedInvSlot >= inventory.length) selectedInvSlot = -1;
}

function showMessage(text) {
  messageText = text;
  messageTimer = 180; // frames
}

function addTubeToSequence(room, color) {
  const ps = room.puzzleState;
  if (ps.mixed) { showMessage('Formula ja foi criada!'); return; }
  ps.entered.push(color);
  const idx = ps.entered.length - 1;
  if (ps.sequence[idx] !== color) {
    showMessage('Reacao errada! Fumaca toxica... Resetando!');
    ps.entered = [];
    return;
  }
  if (ps.entered.length === ps.sequence.length) {
    ps.mixed = true;
    showMessage('Formula perfeita! Um cartao de acesso apareceu no bequer!');
    addToInventory('cartao-lab', 'Cartao de Acesso', '#00ff88');
  } else {
    showMessage(`${capitalize(color)} adicionado! (${ps.entered.length}/${ps.sequence.length})`);
  }
}

function handleLibraryEstanteClick(room, estanteColor) {
  const ps = room.puzzleState;
  if (!ps.terminalActive) return;
  const letterMap = { 'red': 'V', 'blue': 'A', 'green': 'L', 'gold': 'E' };
  const letter = letterMap[estanteColor];
  if (!letter) return;
  ps.entered += letter;
  showMessage(`Digitando: ${ps.entered}`);
  if (ps.entered.length === ps.password.length) {
    if (ps.entered === ps.password) {
      showMessage('VALE! Senha correta! A porta destravou!');
    } else {
      showMessage('Senha incorreta! Tente novamente.');
      ps.entered = '';
    }
  }
}

/* ============================================================
   CANVAS RESIZE
   ============================================================ */
function resize() {
  const container = canvas.parentElement;
  const cw = container.clientWidth - 16;
  const ch = container.clientHeight - 16;
  const scale = Math.min(cw / DESIGN_W, ch / DESIGN_H);
  canvas.width = DESIGN_W;
  canvas.height = DESIGN_H;
  canvas.style.width = Math.floor(DESIGN_W * scale) + 'px';
  canvas.style.height = Math.floor(DESIGN_H * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

/* ============================================================
   INPUT
   ============================================================ */
function canvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * DESIGN_W,
    y: (clientY - rect.top) / rect.height * DESIGN_H
  };
}

// Mouse events
canvas.addEventListener('mousemove', e => {
  const p = canvasCoords(e.clientX, e.clientY);
  pointerX = p.x; pointerY = p.y;
  if (draggingItem) { dragX = p.x; dragY = p.y; }
  updateHover(p.x, p.y);
});

canvas.addEventListener('mousedown', e => {
  const p = canvasCoords(e.clientX, e.clientY);
  pointerDown = true;
  handlePointerDown(p.x, p.y);
});

canvas.addEventListener('mouseup', e => {
  const p = canvasCoords(e.clientX, e.clientY);
  pointerDown = false;
  handlePointerUp(p.x, p.y);
});

// Touch events
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  const p = canvasCoords(t.clientX, t.clientY);
  pointerX = p.x; pointerY = p.y;
  pointerDown = true;
  handlePointerDown(p.x, p.y);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0];
  const p = canvasCoords(t.clientX, t.clientY);
  pointerX = p.x; pointerY = p.y;
  if (draggingItem) { dragX = p.x; dragY = p.y; }
  updateHover(p.x, p.y);
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  pointerDown = false;
  handlePointerUp(pointerX, pointerY);
}, { passive: false });

/* ============================================================
   POINTER LOGIC
   ============================================================ */
function updateHover(x, y) {
  if (state !== 'PLAYING') { hoverObj = null; return; }
  const room = rooms[currentRoom];
  hoverObj = null;
  for (const obj of room.objects) {
    if (x >= obj.x && x <= obj.x + obj.w && y >= obj.y && y <= obj.y + obj.h) {
      hoverObj = obj;
      break;
    }
  }
}

function handlePointerDown(x, y) {
  if (state === 'ROOM_SELECT') {
    handleRoomSelectClick(x, y);
    return;
  }
  if (state !== 'PLAYING') return;

  // Check inventory click
  if (y >= ROOM_H) {
    const slotW = 60;
    const startX = (DESIGN_W - inventory.length * slotW) / 2;
    for (let i = 0; i < inventory.length; i++) {
      const sx = startX + i * slotW;
      if (x >= sx && x <= sx + 50 && y >= ROOM_H + 10 && y <= ROOM_H + 55) {
        // Start drag or select
        selectedInvSlot = i;
        draggingItem = inventory[i];
        dragX = x; dragY = y;
        return;
      }
    }
    // Check hint button
    if (x >= DESIGN_W - 100 && x <= DESIGN_W - 10 && y >= ROOM_H + 15 && y <= ROOM_H + 55) {
      useHint();
      return;
    }
    return;
  }

  // If we have a selected inventory item and click on an object, try to use it
  if (selectedInvSlot >= 0 && !draggingItem) {
    const room = rooms[currentRoom];
    for (const obj of room.objects) {
      if (x >= obj.x && x <= obj.x + obj.w && y >= obj.y && y <= obj.y + obj.h) {
        obj.action(room);
        return;
      }
    }
    selectedInvSlot = -1;
    return;
  }

  // Click on room object
  const room = rooms[currentRoom];
  for (const obj of room.objects) {
    if (x >= obj.x && x <= obj.x + obj.w && y >= obj.y && y <= obj.y + obj.h) {
      // Library special: estante click when terminal active
      if (currentRoom === 4 && room.puzzleState.terminalActive) {
        const estanteMap = {
          'estante-red': 'red', 'estante-blue': 'blue',
          'estante-green': 'green', 'estante-gold': 'gold'
        };
        if (estanteMap[obj.id]) {
          handleLibraryEstanteClick(room, estanteMap[obj.id]);
          return;
        }
      }
      obj.action(room);
      return;
    }
  }
}

function handlePointerUp(x, y) {
  if (draggingItem) {
    // Check if dropped on an object
    if (state === 'PLAYING' && y < ROOM_H) {
      const room = rooms[currentRoom];
      for (const obj of room.objects) {
        if (x >= obj.x && x <= obj.x + obj.w && y >= obj.y && y <= obj.y + obj.h) {
          obj.action(room);
          break;
        }
      }
    }
    draggingItem = null;
    selectedInvSlot = -1;
  }
}

/* ============================================================
   HINT SYSTEM
   ============================================================ */
function useHint() {
  const room = rooms[currentRoom];
  if (hintsLeft <= 0) {
    showMessage('Sem dicas restantes!');
    return;
  }
  if (room.hintsUsed >= room.hints.length) {
    showMessage('Sem mais dicas para esta sala.');
    return;
  }
  const hint = room.hints[room.hintsUsed];
  room.hintsUsed++;
  hintsLeft--;
  hintsDisp.textContent = hintsLeft;
  showMessage('DICA: ' + hint);
}

/* ============================================================
   ROOM COMPLETION
   ============================================================ */
function completeRoom() {
  roomsCompleted[currentRoom] = true;
  const roomScore = Math.max(100, 500 - elapsedSeconds * 2 + hintsLeft * 50);
  totalScore += roomScore;

  const allDone = roomsCompleted.every(Boolean);
  if (allDone) {
    state = 'SOLVED';
    showEndScreen();
  } else {
    showMessage(`Sala concluida! +${roomScore} pontos!`);
    setTimeout(() => {
      state = 'ROOM_SELECT';
      inventory = [];
      selectedInvSlot = -1;
    }, 1500);
  }
}

function showEndScreen() {
  overlayIcon.textContent = '\u{1F3C6}';
  overlayTitle.textContent = 'Parabens! Voce Escapou!';
  overlayMsg.textContent = `Todas as 5 salas concluidas!`;
  overlayScore.textContent = `Pontuacao: ${totalScore} | Tempo: ${formatTime(elapsedSeconds)}`;
  btnStart.textContent = 'Jogar Novamente';
  overlay.classList.remove('hidden');

  stats.save(totalScore);

  window.onGameEnd?.({
    game: 'fuga',
    score: totalScore,
    details: { rooms: 5, time: elapsedSeconds, hintsUsed: 15 - hintsLeft }
  });
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

/* ============================================================
   ROOM SELECT SCREEN
   ============================================================ */
function handleRoomSelectClick(x, y) {
  const boxW = 140, boxH = 100, gap = 20;
  const totalW = 3 * boxW + 2 * gap;
  const startX = (DESIGN_W - totalW) / 2;
  const row1Y = 180, row2Y = 310;

  for (let i = 0; i < 5; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = startX + col * (boxW + gap);
    const by = row === 0 ? row1Y : row2Y;

    if (x >= bx && x <= bx + boxW && y >= by && y <= by + boxH) {
      if (!roomsCompleted[i]) {
        enterRoom(i);
      }
      return;
    }
  }
}

function enterRoom(idx) {
  currentRoom = idx;
  state = 'PLAYING';
  inventory = [];
  selectedInvSlot = -1;
  const room = rooms[idx];
  // Reset puzzle state for replay if needed (room stays as created)
  roomDisp.textContent = room.name;
  hintsDisp.textContent = hintsLeft;
}

/* ============================================================
   DRAWING
   ============================================================ */
function drawRoom() {
  const room = rooms[currentRoom];

  // Background
  ctx.fillStyle = room.bgColor;
  ctx.fillRect(0, 0, DESIGN_W, ROOM_H);

  // Floor
  const floorGrad = ctx.createLinearGradient(0, ROOM_H - 80, 0, ROOM_H);
  floorGrad.addColorStop(0, room.bgColor);
  floorGrad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, ROOM_H - 80, DESIGN_W, 80);

  // Floor line
  ctx.strokeStyle = room.accentColor + '44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, ROOM_H - 80);
  ctx.lineTo(DESIGN_W, ROOM_H - 80);
  ctx.stroke();

  // Wall lines for depth
  ctx.strokeStyle = room.accentColor + '22';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 3; i++) {
    const wy = 20 + i * 120;
    ctx.beginPath();
    ctx.moveTo(0, wy);
    ctx.lineTo(DESIGN_W, wy);
    ctx.stroke();
  }

  // Room title
  ctx.fillStyle = room.accentColor + '88';
  ctx.font = '10px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText(room.name.toUpperCase(), DESIGN_W / 2, 20);
  ctx.font = '16px "VT323"';
  ctx.fillStyle = room.accentColor + '66';
  ctx.fillText(room.subtitle, DESIGN_W / 2, 38);

  // Draw objects
  for (const obj of room.objects) {
    drawObject(obj, room);
  }

  // Draw inventory bar
  drawInventory(room);

  // Draw message
  if (messageTimer > 0) {
    drawMessage();
  }

  // Draw dragging item
  if (draggingItem) {
    ctx.fillStyle = draggingItem.color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(dragX - 20, dragY - 20, 40, 40);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(dragX - 20, dragY - 20, 40, 40);
  }
}

function drawObject(obj, room) {
  const isHover = hoverObj === obj;
  const pulse = Math.sin(animFrame * 0.05) * 0.15 + 0.85;

  // Special drawing for certain object types
  if (obj.id === 'door' || obj.id === 'door-kitchen' || obj.id === 'door-lab' || obj.id === 'door-samba' || obj.id === 'door-museum') {
    drawDoor(obj, room, isHover);
    return;
  }

  if (obj.id.startsWith('estante-')) {
    drawBookshelf(obj, isHover);
    return;
  }

  if (obj.id.startsWith('tubo-')) {
    drawTube(obj, isHover);
    return;
  }

  if (obj.id === 'safe') {
    drawSafe(obj, room, isHover);
    return;
  }

  if (obj.id === 'clock') {
    drawClock(obj, isHover);
    return;
  }

  if (obj.id === 'manequim') {
    drawManequim(obj, room, isHover);
    return;
  }

  if (obj.id === 'terminal') {
    drawTerminal(obj, room, isHover);
    return;
  }

  if (obj.id === 'panela') {
    drawPanela(obj, room, isHover);
    return;
  }

  if (obj.id === 'photo') {
    drawPhoto(obj, isHover);
    return;
  }

  // Generic object
  ctx.fillStyle = obj.color;
  if (isHover) {
    ctx.shadowColor = room.accentColor;
    ctx.shadowBlur = 15;
  }

  // Rounded rect
  roundRect(obj.x, obj.y, obj.w, obj.h, 4);
  ctx.fill();

  if (isHover) {
    ctx.strokeStyle = room.accentColor;
    ctx.lineWidth = 2;
    roundRect(obj.x, obj.y, obj.w, obj.h, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Label
  ctx.fillStyle = '#ffffff99';
  ctx.font = '12px "VT323"';
  ctx.textAlign = 'center';
  ctx.fillText(obj.label, obj.x + obj.w / 2, obj.y + obj.h + 14);

  // Collectible sparkle
  if (obj.collectible && !hasItem(obj.id)) {
    const sparkle = Math.sin(animFrame * 0.1 + obj.x) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255, 255, 100, ${sparkle * 0.6})`;
    ctx.beginPath();
    ctx.arc(obj.x + obj.w - 5, obj.y + 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDoor(obj, room, isHover) {
  const solved = room.solved;
  ctx.fillStyle = solved ? '#2a6a2a' : obj.color;
  roundRect(obj.x, obj.y, obj.w, obj.h, 3);
  ctx.fill();

  // Door frame
  ctx.strokeStyle = isHover ? room.accentColor : '#ffffff33';
  ctx.lineWidth = isHover ? 3 : 2;
  roundRect(obj.x, obj.y, obj.w, obj.h, 3);
  ctx.stroke();

  // Door knob
  ctx.fillStyle = solved ? '#ffd700' : '#888';
  ctx.beginPath();
  ctx.arc(obj.x + obj.w - 12, obj.y + obj.h / 2, 5, 0, Math.PI * 2);
  ctx.fill();

  // Door arch
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(obj.x + obj.w / 2, obj.y, obj.w / 2, Math.PI, 0);
  ctx.stroke();

  // Label
  ctx.fillStyle = solved ? '#00ff00' : '#ffffff99';
  ctx.font = '12px "VT323"';
  ctx.textAlign = 'center';
  ctx.fillText(solved ? 'ABERTA!' : 'Porta', obj.x + obj.w / 2, obj.y + obj.h + 14);

  if (isHover) {
    ctx.shadowColor = room.accentColor;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = room.accentColor + '88';
    roundRect(obj.x - 2, obj.y - 2, obj.w + 4, obj.h + 4, 5);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawSafe(obj, room, isHover) {
  ctx.fillStyle = room.puzzleState.safeOpen ? '#2a5a2a' : '#4a4a4a';
  roundRect(obj.x, obj.y, obj.w, obj.h, 3);
  ctx.fill();

  // Safe dial
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(obj.x + obj.w / 2, obj.y + obj.h / 2, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = room.puzzleState.safeOpen ? '#00ff00' : '#666';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Numbers
  ctx.fillStyle = room.puzzleState.safeOpen ? '#00ff00' : '#888';
  ctx.font = '10px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText(room.puzzleState.safeOpen ? 'OK' : '???', obj.x + obj.w / 2, obj.y + obj.h / 2 + 4);

  if (isHover) {
    ctx.strokeStyle = rooms[currentRoom].accentColor;
    ctx.lineWidth = 2;
    roundRect(obj.x, obj.y, obj.w, obj.h, 3);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff99';
  ctx.font = '12px "VT323"';
  ctx.fillText(obj.label, obj.x + obj.w / 2, obj.y + obj.h + 14);
}

function drawClock(obj, isHover) {
  ctx.fillStyle = '#2a2a3a';
  ctx.beginPath();
  ctx.arc(obj.x + obj.w / 2, obj.y + obj.h / 2, obj.w / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isHover ? rooms[currentRoom].accentColor : '#666';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Clock hands (pointing to 3:00)
  const cx = obj.x + obj.w / 2, cy = obj.y + obj.h / 2;
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - 20); // minute at 12
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 18, cy); // hour at 3
  ctx.stroke();

  ctx.fillStyle = '#ffffff99';
  ctx.font = '12px "VT323"';
  ctx.textAlign = 'center';
  ctx.fillText(obj.label, cx, obj.y + obj.h + 14);
}

function drawPhoto(obj, isHover) {
  // Frame
  ctx.fillStyle = '#3a3a5a';
  roundRect(obj.x, obj.y, obj.w, obj.h, 2);
  ctx.fill();

  // "Photo" - simple mountain/Cristo shape
  ctx.fillStyle = '#5a5a7a';
  ctx.beginPath();
  ctx.moveTo(obj.x + 10, obj.y + obj.h - 10);
  ctx.lineTo(obj.x + obj.w / 2, obj.y + 15);
  ctx.lineTo(obj.x + obj.w - 10, obj.y + obj.h - 10);
  ctx.closePath();
  ctx.fill();

  // Cristo silhouette
  ctx.fillStyle = '#7a7a9a';
  ctx.fillRect(obj.x + obj.w / 2 - 2, obj.y + 10, 4, 15);
  ctx.fillRect(obj.x + obj.w / 2 - 10, obj.y + 14, 20, 3);

  if (isHover) {
    ctx.strokeStyle = rooms[currentRoom].accentColor;
    ctx.lineWidth = 2;
    roundRect(obj.x, obj.y, obj.w, obj.h, 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff99';
  ctx.font = '12px "VT323"';
  ctx.textAlign = 'center';
  ctx.fillText(obj.label, obj.x + obj.w / 2, obj.y + obj.h + 14);
}

function drawBookshelf(obj, isHover) {
  ctx.fillStyle = obj.color;
  roundRect(obj.x, obj.y, obj.w, obj.h, 3);
  ctx.fill();

  // Books
  const bookW = 12;
  for (let i = 0; i < 7; i++) {
    const bx = obj.x + 10 + i * (bookW + 3);
    const bh = 40 + Math.sin(i * 2) * 15;
    const colors = ['#cc4444', '#44cc44', '#4444cc', '#cccc44', '#cc44cc', '#44cccc', '#ccaa44'];
    ctx.fillStyle = colors[i % colors.length] + '88';
    ctx.fillRect(bx, obj.y + obj.h - bh - 5, bookW, bh);
  }

  // Shelf lines
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(obj.x, obj.y + obj.h / 2);
  ctx.lineTo(obj.x + obj.w, obj.y + obj.h / 2);
  ctx.stroke();

  if (isHover) {
    ctx.strokeStyle = rooms[currentRoom].accentColor;
    ctx.lineWidth = 2;
    roundRect(obj.x, obj.y, obj.w, obj.h, 3);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff99';
  ctx.font = '11px "VT323"';
  ctx.textAlign = 'center';
  ctx.fillText(obj.label, obj.x + obj.w / 2, obj.y + obj.h + 14);
}

function drawTube(obj, isHover) {
  // Tube body
  ctx.fillStyle = obj.color + '44';
  roundRect(obj.x + 10, obj.y + 10, obj.w - 20, obj.h - 10, 8);
  ctx.fill();

  // Liquid
  ctx.fillStyle = obj.color;
  roundRect(obj.x + 12, obj.y + obj.h - 40, obj.w - 24, 30, 6);
  ctx.fill();

  // Tube outline
  ctx.strokeStyle = isHover ? '#fff' : '#ffffff44';
  ctx.lineWidth = isHover ? 2 : 1;
  roundRect(obj.x + 10, obj.y + 10, obj.w - 20, obj.h - 10, 8);
  ctx.stroke();

  // Bubble
  const bubbleY = obj.y + obj.h - 20 + Math.sin(animFrame * 0.08 + obj.x) * 5;
  ctx.fillStyle = '#ffffff33';
  ctx.beginPath();
  ctx.arc(obj.x + obj.w / 2, bubbleY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff99';
  ctx.font = '11px "VT323"';
  ctx.textAlign = 'center';
  ctx.fillText(obj.label, obj.x + obj.w / 2, obj.y + obj.h + 14);
}

function drawManequim(obj, room, isHover) {
  const ps = room.puzzleState;

  // Body
  ctx.fillStyle = '#deb887';
  // Head
  ctx.beginPath();
  ctx.arc(obj.x + obj.w / 2, obj.y + 30, 20, 0, Math.PI * 2);
  ctx.fill();
  // Torso
  ctx.fillRect(obj.x + 30, obj.y + 50, 40, 100);
  // Legs
  ctx.fillRect(obj.x + 30, obj.y + 150, 15, 80);
  ctx.fillRect(obj.x + 55, obj.y + 150, 15, 80);

  // Placed costume pieces
  if (ps.placed.includes('saia')) {
    ctx.fillStyle = '#ff1493';
    ctx.fillRect(obj.x + 20, obj.y + 140, 60, 50);
    // Fringes
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(obj.x + 20 + i * 10, obj.y + 185, 8, 10);
    }
  }
  if (ps.placed.includes('plumas')) {
    ctx.fillStyle = '#ff69b4';
    // Feathers on shoulders
    for (let i = 0; i < 5; i++) {
      const angle = (i - 2) * 0.3;
      ctx.save();
      ctx.translate(obj.x + 25, obj.y + 55);
      ctx.rotate(angle - 0.5);
      ctx.fillRect(-3, -30, 6, 30);
      ctx.restore();
      ctx.save();
      ctx.translate(obj.x + 75, obj.y + 55);
      ctx.rotate(-angle + 0.5);
      ctx.fillRect(-3, -30, 6, 30);
      ctx.restore();
    }
  }
  if (ps.placed.includes('coroa')) {
    ctx.fillStyle = '#ffd700';
    // Crown
    ctx.beginPath();
    ctx.moveTo(obj.x + 30, obj.y + 12);
    ctx.lineTo(obj.x + 35, obj.y - 5);
    ctx.lineTo(obj.x + 42, obj.y + 8);
    ctx.lineTo(obj.x + 50, obj.y - 8);
    ctx.lineTo(obj.x + 58, obj.y + 8);
    ctx.lineTo(obj.x + 65, obj.y - 5);
    ctx.lineTo(obj.x + 70, obj.y + 12);
    ctx.closePath();
    ctx.fill();
  }

  if (isHover) {
    ctx.strokeStyle = room.accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(obj.x - 5, obj.y - 15, obj.w + 10, obj.h + 20);
  }

  ctx.fillStyle = '#ffffff99';
  ctx.font = '12px "VT323"';
  ctx.textAlign = 'center';
  ctx.fillText(obj.label, obj.x + obj.w / 2, obj.y + obj.h + 14);
}

function drawTerminal(obj, room, isHover) {
  // Monitor
  ctx.fillStyle = '#1a1a2a';
  roundRect(obj.x, obj.y, obj.w, obj.h, 4);
  ctx.fill();

  // Screen
  ctx.fillStyle = '#0a2a0a';
  roundRect(obj.x + 8, obj.y + 8, obj.w - 16, obj.h - 24, 2);
  ctx.fill();

  // Text on screen
  const ps = room.puzzleState;
  ctx.font = '12px "Press Start 2P"';
  ctx.textAlign = 'center';
  if (ps.terminalActive) {
    ctx.fillStyle = '#00ff00';
    ctx.fillText(ps.entered || '____', obj.x + obj.w / 2, obj.y + obj.h / 2 + 2);
  } else {
    ctx.fillStyle = '#006600';
    ctx.fillText('SENHA?', obj.x + obj.w / 2, obj.y + obj.h / 2 + 2);
  }

  // Keyboard base
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(obj.x + 20, obj.y + obj.h - 12, obj.w - 40, 8);

  if (isHover) {
    ctx.strokeStyle = room.accentColor;
    ctx.lineWidth = 2;
    roundRect(obj.x, obj.y, obj.w, obj.h, 4);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff99';
  ctx.font = '12px "VT323"';
  ctx.fillText(obj.label, obj.x + obj.w / 2, obj.y + obj.h + 14);
}

function drawPanela(obj, room, isHover) {
  const ps = room.puzzleState;

  // Pot body
  ctx.fillStyle = '#8b4513';
  ctx.beginPath();
  ctx.ellipse(obj.x + obj.w / 2, obj.y + obj.h - 20, obj.w / 2, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pot opening
  ctx.fillStyle = '#654321';
  ctx.beginPath();
  ctx.ellipse(obj.x + obj.w / 2, obj.y + 20, obj.w / 2, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ingredients inside
  const colors = { dende: '#ff8c00', camarao: '#ff6b6b', coco: '#f5f5dc' };
  ps.added.forEach((id, i) => {
    ctx.fillStyle = colors[id] || '#aaa';
    ctx.beginPath();
    ctx.arc(obj.x + 40 + i * 30, obj.y + 25, 10, 0, Math.PI * 2);
    ctx.fill();
  });

  // Steam if complete
  if (ps.added.length === ps.recipe.length) {
    ctx.fillStyle = '#ffffff22';
    for (let i = 0; i < 3; i++) {
      const sy = obj.y - 10 - Math.sin(animFrame * 0.05 + i * 2) * 15;
      ctx.beginPath();
      ctx.arc(obj.x + 30 + i * 35, sy, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (isHover) {
    ctx.strokeStyle = rooms[currentRoom].accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(obj.x - 3, obj.y - 3, obj.w + 6, obj.h + 6);
  }

  ctx.fillStyle = '#ffffff99';
  ctx.font = '12px "VT323"';
  ctx.textAlign = 'center';
  ctx.fillText(obj.label, obj.x + obj.w / 2, obj.y + obj.h + 14);
}

function drawInventory(room) {
  // Bar background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, ROOM_H, DESIGN_W, INV_H);

  // Top border
  ctx.strokeStyle = room.accentColor + '66';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, ROOM_H);
  ctx.lineTo(DESIGN_W, ROOM_H);
  ctx.stroke();

  // Inventory label
  ctx.fillStyle = '#ffffff44';
  ctx.font = '12px "VT323"';
  ctx.textAlign = 'left';
  ctx.fillText('INVENTARIO', 10, ROOM_H + 20);

  // Items
  const slotW = 60;
  const startX = (DESIGN_W - Math.max(inventory.length, 1) * slotW) / 2;
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    const sx = startX + i * slotW;
    const sy = ROOM_H + 10;
    const selected = (i === selectedInvSlot);

    // Slot bg
    ctx.fillStyle = selected ? room.accentColor + '33' : '#2a2a2a';
    roundRect(sx, sy, 50, 45, 4);
    ctx.fill();

    // Item color block
    ctx.fillStyle = item.color;
    roundRect(sx + 8, sy + 5, 34, 24, 3);
    ctx.fill();

    // Item name
    ctx.fillStyle = '#ddd';
    ctx.font = '10px "VT323"';
    ctx.textAlign = 'center';
    ctx.fillText(item.label.substring(0, 8), sx + 25, sy + 42);

    // Border
    ctx.strokeStyle = selected ? room.accentColor : '#555';
    ctx.lineWidth = selected ? 2 : 1;
    roundRect(sx, sy, 50, 45, 4);
    ctx.stroke();
  }

  // Hint button
  ctx.fillStyle = hintsLeft > 0 ? '#2a2a4a' : '#1a1a1a';
  roundRect(DESIGN_W - 100, ROOM_H + 15, 90, 40, 6);
  ctx.fill();
  ctx.strokeStyle = hintsLeft > 0 ? '#ffb347' : '#444';
  ctx.lineWidth = 1;
  roundRect(DESIGN_W - 100, ROOM_H + 15, 90, 40, 6);
  ctx.stroke();
  ctx.fillStyle = hintsLeft > 0 ? '#ffb347' : '#666';
  ctx.font = '14px "VT323"';
  ctx.textAlign = 'center';
  ctx.fillText(`DICA (${hintsLeft})`, DESIGN_W - 55, ROOM_H + 40);
}

function drawMessage() {
  const alpha = Math.min(1, messageTimer / 30);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.85 * alpha})`;
  roundRect(40, ROOM_H - 80, DESIGN_W - 80, 60, 8);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 179, 71, ${0.5 * alpha})`;
  ctx.lineWidth = 1;
  roundRect(40, ROOM_H - 80, DESIGN_W - 80, 60, 8);
  ctx.stroke();

  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.font = '18px "VT323"';
  ctx.textAlign = 'center';

  // Word wrap
  const maxW = DESIGN_W - 120;
  const words = messageText.split(' ');
  let lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  lines.push(line);

  const lineH = 20;
  const startY = ROOM_H - 80 + 30 - (lines.length - 1) * lineH / 2;
  lines.forEach((l, i) => {
    ctx.fillText(l, DESIGN_W / 2, startY + i * lineH);
  });
}

function drawMenuScreen() {
  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // Ambient glow
  const grad = ctx.createRadialGradient(DESIGN_W / 2, DESIGN_H / 2, 50, DESIGN_W / 2, DESIGN_H / 2, 300);
  grad.addColorStop(0, '#ffb34711');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  // Title
  ctx.fillStyle = PRIMARY;
  ctx.font = '20px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.shadowColor = PRIMARY;
  ctx.shadowBlur = 20;
  ctx.fillText('FUGA', DESIGN_W / 2, DESIGN_H / 2 - 40);
  ctx.shadowBlur = 0;

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = '24px "VT323"';
  ctx.fillText('Escape Room - 5 Salas Brasileiras', DESIGN_W / 2, DESIGN_H / 2 + 10);

  ctx.fillStyle = '#ffffff66';
  ctx.font = '18px "VT323"';
  const blink = Math.sin(animFrame * 0.06) > 0;
  if (blink) {
    ctx.fillText('Clique em JOGAR para comecar', DESIGN_W / 2, DESIGN_H / 2 + 50);
  }
}

function drawRoomSelect() {
  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  ctx.fillStyle = PRIMARY;
  ctx.font = '16px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('SELECIONE A SALA', DESIGN_W / 2, 80);

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = '20px "VT323"';
  ctx.fillText(`Pontuacao: ${totalScore} | Tempo: ${formatTime(elapsedSeconds)}`, DESIGN_W / 2, 120);

  const boxW = 140, boxH = 100, gap = 20;
  const totalW = 3 * boxW + 2 * gap;
  const startX = (DESIGN_W - totalW) / 2;
  const row1Y = 180, row2Y = 310;

  for (let i = 0; i < 5; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = startX + col * (boxW + gap);
    const by = row === 0 ? row1Y : row2Y;
    const completed = roomsCompleted[i];

    ctx.fillStyle = completed ? '#1a3a1a' : '#1f1f1f';
    roundRect(bx, by, boxW, boxH, 6);
    ctx.fill();

    ctx.strokeStyle = completed ? '#00ff44' : rooms[i].accentColor;
    ctx.lineWidth = 2;
    roundRect(bx, by, boxW, boxH, 6);
    ctx.stroke();

    ctx.fillStyle = completed ? '#00ff44' : '#fff';
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(`Sala ${i + 1}`, bx + boxW / 2, by + 30);

    ctx.font = '14px "VT323"';
    ctx.fillStyle = completed ? '#00ff4488' : rooms[i].accentColor;
    ctx.fillText(rooms[i].name, bx + boxW / 2, by + 55);

    ctx.fillStyle = '#ffffff66';
    ctx.font = '14px "VT323"';
    ctx.fillText(completed ? 'COMPLETA' : rooms[i].subtitle, bx + boxW / 2, by + 80);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ============================================================
   GAME LOOP
   ============================================================ */
function update() {
  animFrame++;

  if (state === 'PLAYING') {
    const now = Date.now();
    elapsedSeconds = Math.floor((now - timerStart) / 1000);
    timeDisp.textContent = formatTime(elapsedSeconds);

    if (messageTimer > 0) messageTimer--;
  }
}

function draw() {
  ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);

  switch (state) {
    case 'MENU':
      drawMenuScreen();
      break;
    case 'PLAYING':
      drawRoom();
      break;
    case 'ROOM_SELECT':
      drawRoomSelect();
      break;
    case 'SOLVED':
      drawMenuScreen(); // behind overlay
      break;
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

/* ============================================================
   START / RESTART
   ============================================================ */
function startGame() {
  state = 'ROOM_SELECT';
  rooms = createRooms();
  roomsCompleted = [false, false, false, false, false];
  totalScore = 0;
  hintsLeft = 15; // 3 per room
  elapsedSeconds = 0;
  timerStart = Date.now();
  inventory = [];
  selectedInvSlot = -1;
  draggingItem = null;
  messageText = '';
  messageTimer = 0;

  roomDisp.textContent = '-';
  timeDisp.textContent = '0:00';
  hintsDisp.textContent = hintsLeft;

  overlay.classList.add('hidden');
}

/* ============================================================
   BUTTON HANDLERS
   ============================================================ */
btnStart.addEventListener('click', () => {
  startGame();
});

btnShare.addEventListener('click', () => {
  const text = `🔓 Joguei Fuga no Games Hub e fiz ${totalScore} pontos! Consegue me superar?\nhttps://gameshub.com.br/games/fuga/`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
});

/* ============================================================
   INIT
   ============================================================ */
resize();
loop();
