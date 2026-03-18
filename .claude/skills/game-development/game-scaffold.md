---
name: game-scaffold
description: "Template e checklist obrigatória para criação de novos jogos. Garante que todos os jogos tenham testes, SEO, ranking e integrações necessárias."
risk: low
source: project
date_added: "2026-03-18"
---

# Game Scaffold - Template de Novo Jogo

> **Checklist obrigatória** para garantir que todo jogo novo tenha o mesmo padrão dos existentes.

## Uso

### Opção 1: Script (Recomendado)
```bash
./scripts/game-scaffold.sh [nome-do-jogo] [tipo]
```

### Opção 2: Comigo
Diga: `"Criar scaffold para [nome-do-jogo] do tipo [tipo]`"

### Tipos e Skills Automáticas

| Tipo | Exemplos | Skills Aplicadas |
|------|----------|------------------|
| `arcade` | Snake, Tetris, Space Invaders | `arcade-games`, `mobile-canvas`, `e2e-testing`, `web-games` |
| `card` | Solitaire, Blackjack, Poker | `card-games`, `2d-games`, `e2e-testing`, `web-games` |
| `board` | Xadrez, Damas, Ludo | `2d-games`, `mobile-canvas`, `e2e-testing`, `web-games` |
| `puzzle` | 2048, Sudoku, Wordle | `2d-games`, `mobile-canvas`, `game-design`, `web-games` |
| `multiplayer` | Truco, Uno, Poker | `multiplayer-games`, `mobile-canvas`, `game-design`, `web-games` |

**As skills são aplicadas automaticamente** nos arquivos gerados:
- Código segue padrões da skill
- Comentários referenciam documentação
- Imports corretos já inclusos

---

## 📁 Estrutura de Pastas Obrigatória

```
games/
└── [game-name]/
    ├── index.html          # Meta tags SEO, viewport, Adsense
    ├── game.js             # Lógica do jogo + integrações
    ├── style.css           # Mobile-first + desktop
    ├── README.md           # Regras do jogo
    └── assets/
        ├── icon.svg         # Ícone do jogo
        └── sounds/          # Opcional
```

---

## ✅ Checklist de Novo Jogo

### 1. Arquivos Base
- [ ] `index.html` com estrutura padrão
- [ ] `game.js` com imports corretos
- [ ] `style.css` com variáveis do tema
- [ ] `README.md` com regras

### 2. SEO (Obrigatório)
```html
<!-- Meta tags obrigatórias -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="[Nome] - Jogue grátis online">
<meta name="keywords" content="jogo, online, grátis, [categoria]">
<meta property="og:title" content="[Nome] - Game Hub">
<meta property="og:description" content="Jogue [Nome] grátis">
<meta property="og:image" content="/games/[game]/assets/icon.svg">
```

### 3. Integrações
- [ ] `auth-check.js` importado
- [ ] `supabase.js` para ranking
- [ ] `game-design-utils.js` (confetti, som, haptic)
- [ ] `sidebar.js` (menu lateral)

### 4. Ranking/Stats
```javascript
// Sempre salvar no Supabase
await supabase.from('game_stats').insert({
  user_id: user.id,
  game: 'game-name',
  result: 'win|lose|draw',
  score: score,
  moves: moves,
  time_seconds: elapsedTime
});

// LocalStorage para cache
localStorage.setItem(`${game}_best`, score);
```

### 5. Testes E2E
Criar arquivo: `tests/[game]-critical.e2e.spec.js`

Template mínimo:
```javascript
test.describe(`🎮 ${game} - Testes Críticos`, () => {
  test('carrega sem erros', async () => { /* ... */ });
  test('inicia ao clicar em Jogar', async () => { /* ... */ });
  test('pausa com tecla P', async () => { /* ... */ });
  test('salva pontuação', async () => { /* ... */ });
  if (mobile) {
    test('controles touch visíveis', async () => { /* ... */ });
  }
});
```

### 6. Mobile
- [ ] Controles touch implementados
- [ ] Viewport configurado
- [ ] Z-index > 1000 para controles
- [ ] Botões mínimo 44x44px

### 7. Multiplayer (se aplicável)
- [ ] Canal Supabase configurado
- [ ] Botão "Jogar com Amigos" (apenas se multiplayer)
- [ ] Indicador de presença
- [ ] Sync de estado

### 8. Performance
- [ ] Game loop em 60fps
- [ ] Sem memory leaks
- [ ] Object pooling para partículas
- [ ] Throttle em event handlers

---

## 🚫 Anti-Patterns Proibidos

| ❌ Nunca | ✅ Sempre |
|----------|-----------|
| `IS_TOUCH` para draggable | `draggable = true` sempre |
| `-webkit-user-drag: none` | Permitir drag nativo |
| Criar jogo sem testes | Testes antes de commit |
| Hardcoded strings | Constantes configuráveis |
| Sem version (?v=N) | Incrementar version em assets |

---

## 📊 Métricas de Qualidade

Antes de considerar "pronto":
- [ ] Lighthouse score > 90
- [ ] Testes passando em Chrome, Safari, Firefox
- [ ] Mobile: 60fps estável
- [ ] Zero erros no console
- [ ] Ranking funciona (testar com usuário logado)

---

## 📝 Template de index.html

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="description" content="{{GAME_NAME}} - Jogue grátis online no Game Hub">
  <meta name="keywords" content="jogo, online, grátis, {{CATEGORY}}">
  <meta property="og:title" content="{{GAME_NAME}} - Game Hub">
  <meta property="og:description" content="Jogue {{GAME_NAME}} grátis no Game Hub">
  <title>{{GAME_NAME}} - Game Hub</title>
  <link rel="stylesheet" href="style.css?v=1">
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
</head>
<body>
  <div id="game-container">
    <canvas id="game-canvas"></canvas>
    <div id="overlay" class="hidden">
      <h1 id="overlay-title">{{GAME_NAME}}</h1>
      <p id="overlay-msg">Clique em Jogar para começar</p>
      <p id="overlay-score"></p>
      <button id="btn-start">Jogar</button>
    </div>
    <div class="mobile-controls hidden">
      <!-- Controles touch -->
    </div>
    <div id="score-display">0</div>
  </div>
  <script type="module" src="game.js?v=1"></script>
</body>
</html>
```

---

## 🎮 Template de game.js

```javascript
import '../../auth-check.js?v=4';
import { supabase } from '../../supabase.js?v=2';
import { launchConfetti, playSound, initAudio, haptic } from '../shared/game-design-utils.js?v=4';

// Configurações
const GAME_NAME = '{{GAME_NAME}}';
const IS_MOBILE = window.matchMedia('(pointer: coarse)').matches;

// Elementos DOM
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const btnStart = document.getElementById('btn-start');

// Estado do jogo
let state = 'idle'; // idle | playing | paused | gameover
let score = 0;
let bestScore = parseInt(localStorage.getItem(`${GAME_NAME}_best`) || '0');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  btnStart.addEventListener('click', startGame);
  resize();
  window.addEventListener('resize', resize);
});

function startGame() {
  initAudio();
  score = 0;
  state = 'playing';
  overlay.classList.add('hidden');
  haptic('light');
  gameLoop();
}

async function saveScore() {
  if (score > bestScore) {
    localStorage.setItem(`${GAME_NAME}_best`, score);
    bestScore = score;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('game_stats').insert({
        user_id: user.id,
        game: GAME_NAME,
        result: state === 'gameover' ? 'lose' : 'win',
        score: score
      });
    }
  } catch (e) {
    console.error('Erro ao salvar:', e);
  }
}

// ... implementação específica do jogo
```

---

> **Lembrete:** Nunca comece a codificar antes de verificar esta lista. É mais fácil fazer certo da primeira vez do que refatorar depois.
