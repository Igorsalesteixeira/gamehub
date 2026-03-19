# Cacheta

Jogo de cartas Cacheta para o Games Hub.

## Regras

1. **Distribuicao**: Cada jogador recebe 9 cartas:
   - 3 cartas na mao
   - 6 cartas na mesa (3 colunas de 2 cartas)

2. **Objetivo**: Trocar cartas para formar a melhor mao de poker possivel.

3. **Trocas**: Em cada rodada, os jogadores podem:
   - Trocar uma carta da mao por uma carta da mesa
   - Comprar do monte (descarta automaticamente)
   - Pegar do descarte (se houver)
   - Passar a vez

4. **Rodadas**: Sao 3 rodadas de trocas.

5. **Final**: Apos as trocas, vence quem tiver a melhor mao de 5 cartas (3 da mao + 2 da mesa).

## Pontuacao das Maos

| Mao | Pontos |
|-----|--------|
| Royal Straight Flush | 100 |
| Straight Flush | 75 |
| Quadra (Four of a Kind) | 50 |
| Full House | 25 |
| Flush | 20 |
| Sequencia (Straight) | 15 |
| Trinca (Three of a Kind) | 10 |
| Dois Pares (Two Pair) | 5 |
| Um Par (One Pair) | 2 |
| Carta Alta (High Card) | 1 |

## Estrutura de Arquivos

```
cacheta/
├── index.html    # Pagina principal com SEO
├── game.js       # Logica do jogo
├── style.css     # Estilos mobile-first
└── README.md     # Este arquivo
```

## Funcionalidades

- 2-4 jogadores (1 humano + 1-3 bots)
- IA inteligente para bots
- Interface responsiva (mobile-first)
- Efeitos sonoros e animacoes
- Salvamento de estatisticas no Supabase
- Integracao com sidebar e ranking

## Desenvolvimento

Para testar localmente:

```bash
# Servir a pasta do jogo
npx serve .
```

Ou abra o arquivo `index.html` em um servidor local.

## Tecnologias

- HTML5
- CSS3 (com variaveis e grid/flexbox)
- JavaScript ES6+ (modulos)
- Supabase para estatisticas
