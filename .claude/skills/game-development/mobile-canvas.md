# Mobile Canvas Skill

> Padrões para canvas e touch em dispositivos móveis

## Viewport

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

```javascript
// Prevenir zoom em double-tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);
```

## Canvas Sizing

```javascript
// Tamanho base fixo, escala dinâmica
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
```

## Touch Events

```javascript
// Touch targets grandes (44x44dp mínimo)
// Prevent default em touchstart/passive: false

function getTouchPos(canvas, touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) / scale,
    y: (touch.clientY - rect.top) / scale
  };
}
```

## Haptic Feedback

```javascript
export function haptic(type = 'light') {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30,
      success: [50, 50, 50],
      error: [100, 50, 100]
    };
    navigator.vibrate(patterns[type] || patterns.light);
  }
}
```

## Performance Mobile

```javascript
// Desligar sombras em mobile de baixo custo
const isMobile = window.matchMedia('(pointer: coarse)').matches;
const useShadows = !isMobile;

// Reduzir partículas
const particleCount = isMobile ? 10 : 30;

// Offscreen canvas para static elements
const offscreen = document.createElement('canvas');
```

## Layout Responsivo

```css
/* Mobile: controles na parte inferior */
@media (max-width: 768px) {
  .mobile-controls {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
  }
}

/* Desktop: esconder controles touch */
@media (min-width: 769px) {
  .mobile-controls {
    display: none;
  }
}
```

## Testes Mobile
- [ ] iOS Safari: touch funciona
- [ ] Android Chrome: touch funciona
- [ ] No zoom em double-tap
- [ ] Scroll não interfere no jogo
- [ ] Virtual keyboard não quebra layout (input games)
