# Game Hub — Guia de Desenvolvimento

> **Context Mode**: Este projeto usa Context Mode para gerenciar o contexto. Ferramentas de busca (Grep, Glob, Read) devem ser processadas via `context-mode sandbox` quando possível.

## Checklist de Testes (verificar ANTES de cada push)

### Arraste de cartas (CRITICO)
- [ ] **Desktop (mouse)**: arrastar carta do tableau para outra coluna
- [ ] **Desktop (mouse)**: arrastar carta do descarte para coluna
- [ ] **iOS (touch)**: arrastar carta do tableau para outra coluna
- [ ] **iOS (touch)**: arrastar carta do descarte para coluna
- [ ] **Android (touch)**: arrastar carta entre colunas

### Toque/Clique
- [ ] Toque simples em carta: seleciona
- [ ] Duplo toque: move para fundacao ou coluna valida
- [ ] Toque no monte (stock): vira carta
- [ ] Toque no descarte: seleciona carta do topo

### Pilhas e sequencias
- [ ] Mover pilha inteira (ex: 5-4-3 para coluna com 6)
- [ ] Rei em coluna vazia
- [ ] As para fundacao

### Layout
- [ ] Celular portrait: tudo visivel sem scroll excessivo
- [ ] Celular landscape: tudo cabe na tela
- [ ] Desktop: layout proporcional

### Regras importantes de codigo
- NUNCA usar `-webkit-user-drag: none` (bloqueia touch no iOS)
- NUNCA usar `IS_TOUCH` para controlar `draggable` (pode ser true em desktop)
- Sempre manter `el.draggable = true` em todas as plataformas
- Touch drag (custom) e HTML5 drag (nativo) coexistem: `e.preventDefault()` no touchstart evita conflitos
- Waste peek: usar `wasteEl.innerHTML = ''` para limpar, depois criar carta anterior dinamicamente
- Desktop waste drag: usar `e.dataTransfer.setDragImage(canvas1x1, 0, 0)` para eliminar ghost nativo do navegador
- No dragstart do waste (desktop): limpar wasteEl e mostrar carta anterior, igual ao touchstart
- No dragend do waste (desktop): chamar `renderWaste()` para restaurar estado visual
- Sempre incrementar `?v=N` no script/css tag ao fazer alteracoes para evitar cache (atual: v=11)
