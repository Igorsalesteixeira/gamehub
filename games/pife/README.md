
# Pife (Pif-Paf)

Jogo de cartas brasileiro classico onde o objetivo e formar 3 sequencias com 9 cartas.

## Regras

### Objetivo
Formar **3 sequencias** de 3 cartas cada usando as 9 cartas da sua mao.

### Sequencias Validas
1. **Trinca**: 3 cartas do mesmo valor (ex: 7♠ 7♥ 7♦)
2. **Sequencia**: 3 cartas consecutivas do mesmo naipe (ex: 4♠ 5♠ 6♠)

### Como Jogar
1. Cada jogador recebe **9 cartas**
2. No seu turno:
   - **Compre** 1 carta do monte ou do descarte
   - **Descarte** 1 carta
3. Quando completar 3 sequencias, clique em **"Bater!"**
4. Os outros jogadores tem uma **ultima rodada**
5. Quem tiver menos pontos nas cartas sobrando vence

### Pontuacao
- Cartas que sobram na mao = pontos negativos
- A = 1 ponto
- 2-10 = valor da carta
- J, Q, K = 10 pontos
- Quem bate = 0 pontos

### Dicas
- Observe o descarte - nao de cartas uteis aos adversarios
- Cartas intermediarias (5, 6, 7) sao mais faceis de usar
- As e 2 sao faceis para sequencias baixas
- Q e K sao faceis para sequencias altas
- Se tiver 2 sequencias prontas, procure bater rapido!

## Desenvolvimento

### Arquivos
- `index.html` - Estrutura do jogo
- `game.js` - Logica do jogo
- `style.css` - Estilos

### Funcionalidades
- 2-4 jogadores
- IA para bots
- Interface responsiva
- Estatisticas no Supabase
