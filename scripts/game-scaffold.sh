#!/bin/bash
# game-scaffold.sh - Gera estrutura de novo jogo com skills automáticas
# Uso: ./scripts/game-scaffold.sh [nome] [tipo]
#
# Skills aplicadas automaticamente:
# - arcade: arcade-games, mobile-canvas, e2e-testing
# - card: card-games, 2d-games, e2e-testing
# - board: 2d-games, mobile-canvas, e2e-testing
# - puzzle: 2d-games, mobile-canvas, game-design
# - multiplayer: multiplayer-games, mobile-canvas

GAME_NAME=$1
GAME_TYPE=$2

if [ -z "$GAME_NAME" ] || [ -z "$GAME_TYPE" ]; then
  echo "Uso: ./scripts/game-scaffold.sh [nome-do-jogo] [tipo]"
  echo ""
  echo "Tipos disponíveis:"
  echo "  arcade      → Arcade games (Snake, Tetris, Space Invaders)"
  echo "              Skills: arcade-games, mobile-canvas, e2e-testing"
  echo ""
  echo "  card        → Card games (Solitaire, Blackjack)"
  echo "              Skills: card-games, 2d-games, e2e-testing"
  echo ""
  echo "  board       → Board games (Chess, Checkers, Ludo)"
  echo "              Skills: 2d-games, mobile-canvas, e2e-testing"
  echo ""
  echo "  puzzle      → Puzzle games (2048, Sudoku)"
  echo "              Skills: 2d-games, mobile-canvas, game-design"
  echo ""
  echo "  multiplayer → Multiplayer games (Truco, Uno, Poker)"
  echo "              Skills: multiplayer-games, mobile-canvas, game-design"
  exit 1
fi

# Validar tipo
VALID_TYPES="arcade card board puzzle multiplayer"
if [[ ! " $VALID_TYPES " =~ " $GAME_TYPE " ]]; then
  echo "Erro: Tipo '$GAME_TYPE' inválido"
  echo "Tipos válidos: $VALID_TYPES"
  exit 1
fi

# Determinar skills a aplicar
declare -A SKILLS
SKILLS[arcade]="arcade-games mobile-canvas e2e-testing web-games"
SKILLS[card]="card-games 2d-games e2e-testing web-games"
SKILLS[board]="2d-games mobile-canvas e2e-testing web-games"
SKILLS[puzzle]="2d-games mobile-canvas game-design web-games"
SKILLS[multiplayer]="multiplayer-games mobile-canvas game-design web-games"

APPLIED_SKILLS="${SKILLS[$GAME_TYPE]}"

echo "========================================"
echo "🎮 Game Scaffold - Game Hub"
echo "========================================"
echo "Jogo: $GAME_NAME"
echo "Tipo: $GAME_TYPE"
echo "Skills aplicadas: $APPLIED_SKILLS"
echo ""

GAME_DIR="games/$GAME_NAME"

if [ -d "$GAME_DIR" ]; then
  echo "Erro: Jogo $GAME_NAME já existe!"
  exit 1
fi

# Criar estrutura
echo "Criando $GAME_NAME ($GAME_TYPE)..."
mkdir -p "$GAME_DIR/assets/sounds"
mkdir -p "$GAME_DIR/assets/images"

# index.html
cat > "$GAME_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="description" content="{{GAME_NAME}} - Jogue grátis online no Game Hub">
  <meta name="keywords" content="jogo, online, grátis, {{GAME_TYPE}}">
  <meta property="og:title" content="{{GAME_NAME}} - Game Hub">
  <meta property="og:description" content="Jogue {{GAME_NAME}} grátis no Game Hub">
  <meta property="og:image" content="/games/{{GAME_NAME}}/assets/icon.svg">
  <title>{{GAME_NAME}} - Game Hub</title>
  <link rel="stylesheet" href="style.css?v=1">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
</head>
<body>
  <div id="game-container">
    <canvas id="game-canvas"></canvas>
    <div id="overlay">
      <h1 id="overlay-title">{{GAME_NAME}}</h1>
      <p id="overlay-msg">Clique em Jogar para começar</p>
      <p id="overlay-score"></p>
      <button id="btn-start">Jogar</button>
    </div>
    <div class="mobile-controls">
      <!-- Controles serão adicionados conforme o jogo -->
    </div>
    <div id="score-display">0</div>
  </div>
  <script type="module" src="game.js?v=1"></script>
</body>
</html>
EOF

# Gerar game.js com skills aplicadas
echo "// =============================================" > "$GAME_DIR/game.js"
echo "//  {{GAME_NAME}} - Game Hub" >> "$GAME_DIR/game.js"
echo "//  Tipo: {{GAME_TYPE}}" >> "$GAME_DIR/game.js"
echo "//  Skills aplicadas: $APPLIED_SKILLS" >> "$GAME_DIR/game.js"
echo "// =============================================" >> "$GAME_DIR/game.js"
echo "" >> "$GAME_DIR/game.js"

cat >> "$GAME_DIR/game.js" << 'EOF'
import '../../auth-check.js?v=4';
import { supabase } from '../../supabase.js?v=2';
import { launchConfetti, playSound, initAudio, haptic } from '../shared/game-design-utils.js?v=4';

const GAME_NAME = '{{GAME_NAME}}';
const GAME_TYPE = '{{GAME_TYPE}}';
const IS_MOBILE = window.matchMedia('(pointer: coarse)').matches;

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const btnStart = document.getElementById('btn-start');
const scoreDisplay = document.getElementById('score-display');

let state = 'idle';
let score = 0;
let bestScore = parseInt(localStorage.getItem(`${GAME_NAME}_best`) || '0');

// Sizing
const BASE_W = 480;
const BASE_H = 640;
let scale = 1;

function resize() {
  const container = canvas.parentElement;
  const maxW = container.clientWidth - 16;
  const maxH = container.clientHeight - 16;
  scale = Math.min(maxW / BASE_W, maxH / BASE_H, 1.5);
  canvas.width = Math.floor(BASE_W * scale);
  canvas.height = Math.floor(BASE_H * scale);
}

window.addEventListener('resize', resize);
document.addEventListener('DOMContentLoaded', resize);

// Game Loop
function gameLoop() {
  if (state === 'playing') {
    update();
  }
  render();
  requestAnimationFrame(gameLoop);
}

function update() {
  // Implementar lógica do jogo
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Implementar renderização
}

function startGame() {
  initAudio();
  score = 0;
  state = 'playing';
  overlay.classList.add('hidden');
  haptic('light');
  updateScore();
}

function updateScore() {
  scoreDisplay.textContent = score;
}

async function saveScore(result) {
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
        result: result,
        score: score
      });
    }
  } catch (e) {
    console.error('Erro ao salvar:', e);
  }
}

// Input
document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    if (state === 'playing') {
      // Toggle pause
    }
  }
});

btnStart.addEventListener('click', startGame);

// Init
gameLoop();
EOF

# style.css
cat > "$GAME_DIR/style.css" << 'EOF'
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap');

:root {
  --primary: #ff6b6b;
  --secondary: #4ecdc4;
  --bg: #1a1a2e;
  --text: #ffffff;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Nunito', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  overflow: hidden;
}

#game-container {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

#game-canvas {
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

#overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 100;
}

#overlay.hidden {
  display: none;
}

#btn-start {
  padding: 16px 48px;
  font-size: 1.2rem;
  font-weight: 700;
  background: var(--primary);
  border: none;
  border-radius: 50px;
  color: white;
  cursor: pointer;
  transition: transform 0.2s;
}

#btn-start:hover {
  transform: scale(1.05);
}

#btn-start:active {
  transform: scale(0.95);
}

#score-display {
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 1.5rem;
  font-weight: 700;
}

.mobile-controls {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  z-index: 1000;
}

@media (min-width: 769px) {
  .mobile-controls {
    display: none;
  }
}

.ctrl-btn {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  border: 2px solid rgba(255,255,255,0.4);
  color: white;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  touch-action: manipulation;
}

.ctrl-btn:active {
  background: rgba(255,255,255,0.4);
}
EOF

# README.md
cat > "$GAME_DIR/README.md" << EOF
# {{GAME_NAME}}

## Descrição
Adicione descrição do jogo aqui.

## Regras
1. Regra 1
2. Regra 2
3. Regra 3

## Controles
- **Desktop**: Setas/WASD
- **Mobile**: Botões na tela

## TODO
- [ ] Implementar lógica principal
- [ ] Adicionar som
- [ ] Criar testes E2E
- [ ] Otimizar para mobile
EOF

# Criar teste E2E base
TEST_FILE="tests/${GAME_NAME}-critical.e2e.spec.js"
cat > "$TEST_FILE" << EOF
const { test, expect } = require('@playwright/test');

const mockSupabaseCode = \`
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'test-user' } } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  from: () => ({
    select: () => ({ data: [], error: null }),
    insert: () => ({ data: null, error: null }),
  }),
};
\`;

test.beforeEach(async ({ page }) => {
  await page.route('**/supabase.js', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: mockSupabaseCode,
    });
  });
});

test.describe('🎮 ${GAME_NAME} - Testes Críticos', () => {
  test('deve carregar sem erros', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/games/${GAME_NAME}/');
    await page.waitForTimeout(1000);

    expect(errors).toHaveLength(0);
  });

  test('deve ter título correto', async ({ page }) => {
    await page.goto('/games/${GAME_NAME}/');
    await expect(page).toHaveTitle(/${GAME_NAME}/i);
  });

  test('deve ter canvas visível', async ({ page }) => {
    await page.goto('/games/${GAME_NAME}/');
    await expect(page.locator('#game-canvas')).toBeVisible();
  });

  test('deve iniciar ao clicar em Jogar', async ({ page }) => {
    await page.goto('/games/${GAME_NAME}/');
    await page.waitForTimeout(500);

    await page.locator('#btn-start').click();
    await page.waitForTimeout(300);

    await expect(page.locator('#overlay')).toBeHidden();
  });

  test('deve responder a tecla P (pausa)', async ({ page }) => {
    await page.goto('/games/${GAME_NAME}/');
    await page.locator('#btn-start').click();
    await page.waitForTimeout(300);

    await page.keyboard.press('p');
    await page.waitForTimeout(200);

    await expect(page.locator('#game-canvas')).toBeVisible();
  });
});
EOF

# Substituir placeholders
sed -i "s/{{GAME_NAME}}/$GAME_NAME/g" "$GAME_DIR"/*
sed -i "s/{{GAME_TYPE}}/$GAME_TYPE/g" "$GAME_DIR"/*

echo "✅ Scaffold criado em $GAME_DIR"
echo ""
echo "Próximos passos:"
echo "1. Editar game.js - implementar lógica"
echo "2. Editar style.css - ajustar estilos"
echo "3. Adicionar ícone em assets/icon.svg"
echo "4. Rodar testes: npx playwright test $TEST_FILE"
