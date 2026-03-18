# Arcade Games Skill

> Sub-skill para jogos arcade (Snake, Tetris, Pong, Space Invaders, etc.)

## Game Loop 60fps

```javascript
// Fixed timestep para lógica
const FIXED_DT = 1000 / 60;
let accumulator = 0;
let lastTime = performance.now();

function gameLoop(now) {
  const dt = now - lastTime;
  lastTime = now;
  accumulator += dt;

  while (accumulator >= FIXED_DT) {
    update(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  render(accumulator / FIXED_DT); // interpolação
  requestAnimationFrame(gameLoop);
}
```

## Input Abstraction

```javascript
// Abstrair input em ações, não teclas
const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
  pause: false
};

// Mapeamento de teclas
const KEY_MAP = {
  'ArrowLeft': 'left',
  'ArrowRight': 'right',
  ' ': 'fire',
  'p': 'pause'
};

// Touch virtual controls
// Botões: data-dir="up|down|left|right|fire"
```

## Mobile Controls

```javascript
// Touch targets grandes (min 44x44dp)
// Visual feedback no toque
// Haptic feedback para ações importantes
haptic('light'); // ou 'medium', 'heavy'
```

## Object Pooling

```javascript
// Evitar GC spikes
const bulletPool = [];
const activeBullets = [];

function spawnBullet(x, y) {
  const bullet = bulletPool.pop() || { x: 0, y: 0 };
  bullet.x = x;
  bullet.y = y;
  activeBullets.push(bullet);
}

function recycleBullet(index) {
  bulletPool.push(activeBullets.splice(index, 1)[0]);
}
```

## Colisões

```javascript
// AABB para objetos retangulares
function checkAABB(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

// Grid-based para muitos objetos pequenos
const grid = new SpatialHash(cellSize);
```

## Audio

```javascript
// Sempre inicializar em interação do usuário
initAudio(); // no primeiro click/touch

// Web Audio API para SFX sem delay
// Arquivos pequenos (< 50KB) base64 embutidos
```

## Performance Budget

| Operação | Budget |
|----------|--------|
| Update | 8ms |
| Render | 8ms |
| Audio | 1ms |

## Testes Críticos
- [ ] 60fps estável em mobile
- [ ] Controles touch responsivos
- [ ] Pause com tecla P
- [ ] Restart após game over
- [ ] Score persistente (localStorage)
