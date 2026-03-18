# Card Games Skill

> Sub-skill para jogos de cartas (Solitaire, Spider, FreeCell, Blackjack, etc.)

## Padrões Específicos

### Drag and Drop
```javascript
// Sempre manter draggable=true em todas as plataformas
// NUNCA usar IS_TOUCH para controlar draggable
el.draggable = true;

// Desktop: usar canvas 1x1 para eliminar ghost image
e.dataTransfer.setDragImage(canvas1x1, 0, 0);

// Touch: e.preventDefault() no touchstart evita conflitos
el.addEventListener('touchstart', (e) => {
  e.preventDefault();
  // iniciar drag custom
}, { passive: false });
```

### Waste (Descarte)
```javascript
// Limpar waste ao iniciar drag
wasteEl.innerHTML = '';

// Render carta anterior dinamicamente
renderWaste();

// No dragend: restaurar estado visual
renderWaste();
```

### Seleção de Cartas
- **Toque simples**: seleciona carta
- **Duplo toque**: move para foundation/coluna válida
- **Long press**: mostra preview (opcional)

### Fundações
```javascript
// Ace sempre pode ir para fundação vazia
// Sequência: mesmo naipe, crescente (A→K)
// Auto-move: cartas que só têm uma opção válida
```

## Anti-Patterns Card Games

| Não | Sim |
|-----|-----|
| `-webkit-user-drag: none` | Sempre permitir drag |
| `draggable = !IS_TOUCH` | `draggable = true` sempre |
| `setDragImage` nativo | Canvas 1x1 transparente |

## Testes Críticos
- [ ] Arrastar carta entre colunas (desktop)
- [ ] Arrastar carta entre colunas (touch)
- [ ] Duplo clique para fundação
- [ ] Clique no monte vira carta
- [ ] Layout mobile sem scroll
