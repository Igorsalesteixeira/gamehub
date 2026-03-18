# Multiplayer Games Skill

> Sub-skill para jogos multiplayer (Truco, Poker, Uno, Xadrez, etc.)

## Arquitetura

```
Cliente ←→ Supabase Realtime ←→ Outros Clientes
                ↑
           PostgreSQL
```

## Supabase Realtime

```javascript
// Canal por sala
const channel = supabase
  .channel(`room:${roomId}`)
  .on('broadcast', { event: 'move' }, ({ payload }) => {
    applyMove(payload);
  })
  .subscribe();

// Enviar movimento
channel.send({
  type: 'broadcast',
  event: 'move',
  payload: { playerId, move, timestamp }
});
```

## Estado do Jogo

```javascript
// Estado autoritativo no servidor (se possível)
// ou majority vote para casual games

// Estado local
const gameState = {
  players: [],
  currentTurn: null,
  board: [],
  deck: [],
  moves: []
};

// Sync: aplicar movimentos em ordem
function applyMove(move) {
  gameState.moves.push(move);
  // validar e aplicar
  validateAndApply(move);
}
```

## Reconexão

```javascript
// Guardar state no localStorage
// Reconectar e sincronizar ao voltar

// Heartbeat
setInterval(() => {
  channel.send({ type: 'broadcast', event: 'ping', payload: {} });
}, 5000);
```

## Presença (Quem está online)

```javascript
channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    updatePlayersList(state);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ user_id, online_at: new Date() });
    }
  });
```

## UI Multiplayer

```javascript
// Indicador de turno
// Chat simples (opcional)
// Lista de jogadores com status
// Indicador de "está digitando..."
```

## Testes Críticos
- [ ] Dois jogadores conectam
- [ ] Movimento sincroniza em < 500ms
- [ ] Reconexão recupera estado
- [ ] Desconexão mostra indicador
- [ ] Botão "Jogar com Amigos" visível apenas em jogos multiplayer
