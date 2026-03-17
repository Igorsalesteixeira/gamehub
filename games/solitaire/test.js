// =============================================
//  SISTEMA DE TESTES — Paciência Klondike
//  Abre test.html no browser para executar
// =============================================

const SUITS  = ['♠','♥','♦','♣'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥','♦']);

// ---- Helpers de teste ----
let passed = 0, failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ ok: true, name });
  } catch(e) {
    failed++;
    results.push({ ok: false, name, error: e.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''}: esperado ${JSON.stringify(b)}, recebeu ${JSON.stringify(a)}`);
}

// ---- Funções puras copiadas do game.js para teste isolado ----

function buildDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (let r = 0; r < 13; r++)
      deck.push({ rank: r, suit, faceUp: false });
  return shuffle([...deck]);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function card(rank, suit, faceUp = true) {
  const r = typeof rank === 'string' ? RANKS.indexOf(rank) : rank;
  return { rank: r, suit, faceUp };
}

function canPlaceOnTableau(c, col) {
  if (col.length === 0) return c.rank === 12; // K em coluna vazia
  const top = col[col.length - 1];
  if (!top.faceUp) return false;
  return c.rank === top.rank - 1 &&
    RED_SUITS.has(c.suit) !== RED_SUITS.has(top.suit);
}

function canPlaceOnFoundation(c, suit, pile) {
  if (c.suit !== suit) return false;
  if (pile.length === 0) return c.rank === 0; // As inicia
  return c.rank === pile[pile.length - 1].rank + 1;
}

function canPickFromTableau(col, cardIndex) {
  if (!col[cardIndex].faceUp) return false;
  for (let i = cardIndex; i < col.length - 1; i++) {
    const a = col[i], b = col[i + 1];
    if (!a.faceUp || !b.faceUp) return false;
    if (a.rank !== b.rank + 1) return false;
    if (RED_SUITS.has(a.suit) === RED_SUITS.has(b.suit)) return false;
  }
  return true;
}

function makeGameState(drawCount = 1) {
  const deck = buildDeck();
  let idx = 0;
  const tableau = [];
  for (let c = 0; c < 7; c++) {
    const col = [];
    for (let i = 0; i <= c; i++) col.push({ ...deck[idx++] });
    col[col.length - 1].faceUp = true;
    tableau.push(col);
  }
  return {
    tableau,
    stock: deck.slice(idx).map(c => ({ ...c, faceUp: false })),
    waste: [],
    foundations: { '♠':[], '♥':[], '♦':[], '♣':[] },
    history: [],
    moves: 0,
    drawCount,
  };
}

function drawFromStock(state) {
  const s = deepClone(state);
  if (s.stock.length === 0) {
    if (s.waste.length === 0) return s;
    s.stock = [...s.waste].reverse().map(c => ({ ...c, faceUp: false }));
    s.waste = [];
    s.moves++;
    return s;
  }
  const count = Math.min(s.drawCount, s.stock.length);
  for (let i = 0; i < count; i++) {
    const c = s.stock.pop();
    c.faceUp = true;
    s.waste.push(c);
  }
  s.moves++;
  return s;
}

function flipTopCard(col) {
  if (col.length > 0 && !col[col.length - 1].faceUp)
    col[col.length - 1].faceUp = true;
}

function checkWin(state) {
  return SUITS.every(s => state.foundations[s].length === 13);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function countAllCards(state) {
  let total = 0;
  state.tableau.forEach(col => total += col.length);
  total += state.stock.length;
  total += state.waste.length;
  SUITS.forEach(s => total += state.foundations[s].length);
  return total;
}

// =============================================
//  TESTES: BARALHO
// =============================================

test('Baralho tem 52 cartas', () => {
  const deck = buildDeck();
  assertEqual(deck.length, 52, 'tamanho do baralho');
});

test('Baralho: 4 naipes × 13 ranks (sem duplicatas)', () => {
  const deck = buildDeck();
  const seen = new Set();
  for (const c of deck) {
    const key = `${c.rank}-${c.suit}`;
    assert(!seen.has(key), `Carta duplicada: ${key}`);
    seen.add(key);
  }
  assertEqual(seen.size, 52, 'deve ter 52 cartas únicas');
});

test('Baralho: todas as cartas face-down', () => {
  const deck = buildDeck();
  assert(deck.every(c => !c.faceUp), 'todas devem estar face-down');
});

test('Baralho: ranks de 0 a 12', () => {
  const deck = buildDeck();
  for (let r = 0; r < 13; r++) {
    const count = deck.filter(c => c.rank === r).length;
    assertEqual(count, 4, `rank ${r} deve aparecer 4 vezes`);
  }
});

test('Baralho: naipes corretos', () => {
  const deck = buildDeck();
  for (const suit of SUITS) {
    const count = deck.filter(c => c.suit === suit).length;
    assertEqual(count, 13, `naipe ${suit} deve ter 13 cartas`);
  }
});

// =============================================
//  TESTES: DISTRIBUIÇÃO INICIAL
// =============================================

test('Estado inicial: 52 cartas no total', () => {
  const state = makeGameState();
  assertEqual(countAllCards(state), 52, 'total de cartas');
});

test('Estado inicial: tableau tem 7 colunas', () => {
  const state = makeGameState();
  assertEqual(state.tableau.length, 7, 'colunas do tableau');
});

test('Estado inicial: coluna i tem i+1 cartas', () => {
  const state = makeGameState();
  for (let i = 0; i < 7; i++)
    assertEqual(state.tableau[i].length, i + 1, `coluna ${i}`);
});

test('Estado inicial: 24 cartas no monte', () => {
  const state = makeGameState();
  assertEqual(state.stock.length, 24, 'cartas no monte');
});

test('Estado inicial: última carta de cada coluna face-up', () => {
  const state = makeGameState();
  for (let i = 0; i < 7; i++) {
    const col = state.tableau[i];
    assert(col[col.length - 1].faceUp, `última carta da coluna ${i} deve estar face-up`);
  }
});

test('Estado inicial: cartas do monte face-down', () => {
  const state = makeGameState();
  assert(state.stock.every(c => !c.faceUp), 'monte deve ter cartas face-down');
});

test('Estado inicial: waste e fundações vazias', () => {
  const state = makeGameState();
  assertEqual(state.waste.length, 0, 'waste vazio');
  SUITS.forEach(s => assertEqual(state.foundations[s].length, 0, `fundação ${s} vazia`));
});

// =============================================
//  TESTES: REGRAS DO TABLEAU
// =============================================

test('Tableau: Rei pode ir para coluna vazia', () => {
  const k = card('K', '♠');
  assert(canPlaceOnTableau(k, []), 'K em coluna vazia');
});

test('Tableau: não-Rei NÃO pode ir para coluna vazia', () => {
  ['A','2','3','4','5','6','7','8','9','10','J','Q'].forEach(r => {
    assert(!canPlaceOnTableau(card(r, '♠'), []), `${r} não pode ir para coluna vazia`);
  });
});

test('Tableau: sequência válida (vermelho sobre preto, decrescente)', () => {
  // 7♠ (preto) → 6♥ (vermelho): OK
  const col = [card('7', '♠')];
  assert(canPlaceOnTableau(card('6', '♥'), col), '6♥ sobre 7♠');
  // 7♥ (vermelho) → 6♠ (preto): OK
  const col2 = [card('7', '♥')];
  assert(canPlaceOnTableau(card('6', '♠'), col2), '6♠ sobre 7♥');
});

test('Tableau: mesma cor NÃO é válida', () => {
  assert(!canPlaceOnTableau(card('6', '♠'), [card('7', '♣')]), '6♠ sobre 7♣ = inválido (preto sobre preto)');
  assert(!canPlaceOnTableau(card('6', '♥'), [card('7', '♦')]), '6♥ sobre 7♦ = inválido (vermelho sobre vermelho)');
});

test('Tableau: rank não consecutivo é inválido', () => {
  assert(!canPlaceOnTableau(card('5', '♥'), [card('7', '♠')]), '5♥ sobre 7♠ = inválido');
  assert(!canPlaceOnTableau(card('7', '♥'), [card('7', '♠')]), 'mesmo rank = inválido');
  assert(!canPlaceOnTableau(card('8', '♥'), [card('7', '♠')]), 'maior rank = inválido');
});

test('Tableau: não pode colocar sobre carta face-down', () => {
  const col = [{ rank: 6, suit: '♠', faceUp: false }];
  assert(!canPlaceOnTableau(card('5', '♥'), col), 'não pode colocar sobre face-down');
});

// =============================================
//  TESTES: REGRAS DA FUNDAÇÃO
// =============================================

test('Fundação: Ás inicia pilha vazia', () => {
  assert(canPlaceOnFoundation(card('A', '♠'), '♠', []), 'A♠ em fundação vazia de ♠');
});

test('Fundação: não-Ás NÃO inicia pilha vazia', () => {
  ['2','3','K'].forEach(r => {
    assert(!canPlaceOnFoundation(card(r, '♠'), '♠', []), `${r}♠ não pode iniciar fundação`);
  });
});

test('Fundação: sequência crescente do mesmo naipe', () => {
  const pile = [card('A','♠'), card('2','♠'), card('3','♠')];
  assert(canPlaceOnFoundation(card('4','♠'), '♠', pile), '4♠ sobre 3♠');
});

test('Fundação: naipe errado é inválido', () => {
  assert(!canPlaceOnFoundation(card('A','♥'), '♠', []), 'A♥ na fundação de ♠ = inválido');
  const pile = [card('A','♠')];
  assert(!canPlaceOnFoundation(card('2','♥'), '♠', pile), '2♥ na fundação de ♠ = inválido');
});

test('Fundação: rank não consecutivo é inválido', () => {
  const pile = [card('A','♠'), card('2','♠')];
  assert(!canPlaceOnFoundation(card('4','♠'), '♠', pile), '4♠ pula 3 = inválido');
  assert(!canPlaceOnFoundation(card('2','♠'), '♠', pile), '2♠ duplicado = inválido');
});

// =============================================
//  TESTES: PICK DO TABLEAU
// =============================================

test('Pickup: pode pegar carta face-up do topo', () => {
  const col = [card('K','♠',false), card('Q','♥')];
  assert(canPickFromTableau(col, 1), 'Q♥ face-up pode ser pega');
});

test('Pickup: não pode pegar carta face-down', () => {
  const col = [card('K','♠',false), card('Q','♥',false)];
  assert(!canPickFromTableau(col, 1), 'Q♥ face-down não pode ser pega');
});

test('Pickup: pode pegar sequência válida', () => {
  const col = [
    card('K','♠',false),
    card('7','♠'),  // vermelho vai vir sobre esse
    card('6','♥'),
    card('5','♠'),
  ];
  assert(canPickFromTableau(col, 1), 'sequência 7♠-6♥-5♠ pode ser pega');
});

test('Pickup: não pode pegar sequência inválida (mesma cor)', () => {
  const col = [
    card('7','♠'),
    card('6','♣'), // preto sobre preto = inválido
  ];
  assert(!canPickFromTableau(col, 0), 'sequência inválida não pode ser pega');
});

test('Pickup: não pode pegar sequência com rank incorreto', () => {
  const col = [
    card('7','♠'),
    card('5','♥'), // pula um rank = inválido
  ];
  assert(!canPickFromTableau(col, 0), 'sequência com rank incorreto');
});

// =============================================
//  TESTES: COMPRA DO MONTE
// =============================================

test('Draw-1: compra 1 carta do monte', () => {
  let s = makeGameState(1);
  const before = s.stock.length;
  s = drawFromStock(s);
  assertEqual(s.waste.length, 1, 'waste deve ter 1 carta');
  assertEqual(s.stock.length, before - 1, 'monte deve ter 1 carta a menos');
  assertEqual(countAllCards(s), 52, '52 cartas no total');
});

test('Draw-3: compra 3 cartas do monte', () => {
  let s = makeGameState(3);
  s = drawFromStock(s);
  assertEqual(s.waste.length, 3, 'waste deve ter 3 cartas');
  assertEqual(s.stock.length, 21, 'monte deve ter 21 cartas');
});

test('Draw-3: compra menos de 3 se monte tem < 3', () => {
  let s = makeGameState(3);
  // Deixa apenas 2 cartas no monte
  s.waste = [...s.stock.slice(0, 22).map(c => ({ ...c, faceUp: true }))];
  s.stock = s.stock.slice(22);
  assertEqual(s.stock.length, 2, 'monte tem 2 cartas');
  s = drawFromStock(s);
  assertEqual(s.waste.length, 24, 'waste deve ter 22+2=24');
  assertEqual(s.stock.length, 0, 'monte deve estar vazio');
});

test('Draw: carta comprada fica face-up no waste', () => {
  let s = makeGameState(1);
  s = drawFromStock(s);
  assert(s.waste[s.waste.length - 1].faceUp, 'carta no waste deve ser face-up');
});

test('Draw: recicla waste para monte quando monte vazio', () => {
  let s = makeGameState(1);
  // Esvazia o monte
  while (s.stock.length > 0) s = drawFromStock(s);
  assertEqual(s.stock.length, 0, 'monte deve estar vazio');
  const wasteLen = s.waste.length;
  s = drawFromStock(s); // recicla
  assertEqual(s.stock.length, wasteLen, 'cartas do waste voltam ao monte');
  assertEqual(s.waste.length, 0, 'waste deve estar vazio após reciclagem');
});

test('Draw: cartas recicladas voltam face-down', () => {
  let s = makeGameState(1);
  while (s.stock.length > 0) s = drawFromStock(s);
  s = drawFromStock(s); // recicla
  assert(s.stock.every(c => !c.faceUp), 'cartas recicladas devem ser face-down');
});

test('Draw: não faz nada se monte e waste ambos vazios', () => {
  let s = makeGameState(1);
  s.stock = [];
  s.waste = [];
  const before = s.moves;
  s = drawFromStock(s);
  assertEqual(s.moves, before, 'moves não deve incrementar');
  assertEqual(s.stock.length, 0, 'monte permanece vazio');
  assertEqual(s.waste.length, 0, 'waste permanece vazio');
});

test('Draw: conserva 52 cartas após múltiplas compras', () => {
  let s = makeGameState(1);
  for (let i = 0; i < 30; i++) s = drawFromStock(s);
  assertEqual(countAllCards(s), 52, '52 cartas após 30 compras');
});

test('Draw: conserva 52 cartas após reciclagem', () => {
  let s = makeGameState(1);
  // Compra tudo
  while (s.stock.length > 0) s = drawFromStock(s);
  s = drawFromStock(s); // recicla
  s = drawFromStock(s); // compra 1
  assertEqual(countAllCards(s), 52, '52 cartas após reciclagem + compra');
});

// =============================================
//  TESTES: VITÓRIA
// =============================================

test('Vitória: detectada quando todas as fundações têm 13 cartas', () => {
  const state = makeGameState();
  state.foundations['♠'] = Array.from({length:13}, (_,i) => card(i,'♠'));
  state.foundations['♥'] = Array.from({length:13}, (_,i) => card(i,'♥'));
  state.foundations['♦'] = Array.from({length:13}, (_,i) => card(i,'♦'));
  state.foundations['♣'] = Array.from({length:13}, (_,i) => card(i,'♣'));
  assert(checkWin(state), 'deve detectar vitória');
});

test('Vitória: NÃO detectada quando fundações incompletas', () => {
  const state = makeGameState();
  state.foundations['♠'] = Array.from({length:12}, (_,i) => card(i,'♠'));
  assert(!checkWin(state), 'não deve detectar vitória com fundação incompleta');
});

// =============================================
//  TESTES: UNDO
// =============================================

test('Undo: restaura estado após draw', () => {
  let s = makeGameState(1);
  const snap = deepClone(s);
  // Simula saveHistory + draw
  s.history.push(deepClone({
    tableau: s.tableau, stock: s.stock, waste: s.waste,
    foundations: s.foundations, moves: s.moves
  }));
  s = drawFromStock(s);
  // Desfaz
  const restored = s.history.pop();
  s.stock = restored.stock;
  s.waste = restored.waste;
  s.tableau = restored.tableau;
  s.foundations = restored.foundations;
  s.moves = restored.moves;
  assertEqual(s.stock.length, snap.stock.length, 'monte restaurado');
  assertEqual(s.waste.length, 0, 'waste restaurado');
});

// =============================================
//  TESTES: INVARIANTES DE ESTADO
// =============================================

test('Estado: nunca tem < 0 cartas no monte', () => {
  let s = makeGameState(1);
  for (let i = 0; i < 100; i++) {
    s = drawFromStock(s);
    assert(s.stock.length >= 0, 'monte nunca negativo');
    assert(s.waste.length >= 0, 'waste nunca negativo');
  }
});

test('Estado: total de cartas é sempre 52 após múltiplas operações', () => {
  let s = makeGameState(3);
  for (let i = 0; i < 50; i++) {
    s = drawFromStock(s);
    assertEqual(countAllCards(s), 52, `52 cartas na iteração ${i}`);
  }
});

test('Cores: naipes vermelhos são ♥ e ♦', () => {
  assert(RED_SUITS.has('♥'), '♥ é vermelho');
  assert(RED_SUITS.has('♦'), '♦ é vermelho');
  assert(!RED_SUITS.has('♠'), '♠ não é vermelho');
  assert(!RED_SUITS.has('♣'), '♣ não é vermelho');
});

// =============================================
//  RENDER DOS RESULTADOS
// =============================================

function renderResults() {
  const container = document.getElementById('results');
  const summary = document.getElementById('summary');

  const color = failed === 0 ? '#22c55e' : '#ef4444';
  summary.style.color = color;
  summary.textContent = `${passed} passaram ✓   ${failed} falharam ✗   (${passed+failed} total)`;

  results.forEach(r => {
    const div = document.createElement('div');
    div.className = 'test-row ' + (r.ok ? 'pass' : 'fail');
    div.innerHTML = `
      <span class="icon">${r.ok ? '✓' : '✗'}</span>
      <span class="name">${r.name}</span>
      ${r.error ? `<span class="error">${r.error}</span>` : ''}
    `;
    container.appendChild(div);
  });
}

renderResults();
