// =============================================
//  DESENHANDO (Drawing/Gartic-style) — game.js
// =============================================
import { onGameEnd } from '../shared/game-integration.js';

// ========== WORD DATABASE (200+ words, PT-BR) ==========
const WORDS = {
  animais: {
    label: 'Animais',
    difficulty: 1,
    words: [
      'cachorro','gato','elefante','borboleta','jacare','capivara','arara','cobra',
      'leao','girafa','macaco','pinguim','baleia','tubarao','cavalo','coelho',
      'tartaruga','aguia','coruja','papagaio','formiga','abelha','golfinho',
      'urso','tigre','zebra','camaleao','polvo','sapo','galinha'
    ]
  },
  objetos: {
    label: 'Objetos',
    difficulty: 1,
    words: [
      'televisao','guarda-chuva','oculos','violao','chave','panela','relogio',
      'cadeira','mesa','lampada','celular','computador','livro','bicicleta',
      'tesoura','martelo','espelho','mochila','garrafa','escada','vassoura',
      'guitarra','piano','microfone','camera','sapato','chapeu','anel',
      'guarda-roupa','ventilador'
    ]
  },
  comidas: {
    label: 'Comidas',
    difficulty: 1,
    words: [
      'pizza','bolo','sorvete','churrasco','acai','coxinha','feijoada',
      'hamburguer','pipoca','banana','maca','abacaxi','morango','brocolis',
      'cenoura','ovo','queijo','pao','chocolate','cafe','suco','lasanha',
      'pastel','tapioca','brigadeiro','pudim','sushi','milho','melancia',
      'uva'
    ]
  },
  lugares: {
    label: 'Lugares',
    difficulty: 2,
    words: [
      'praia','escola','hospital','fazenda','castelo','montanha','ilha',
      'cinema','parque','igreja','aeroporto','biblioteca','restaurante',
      'estadio','mercado','floresta','deserto','cachoeira','vulcao','caverna'
    ]
  },
  profissoes: {
    label: 'Profissoes',
    difficulty: 2,
    words: [
      'medico','bombeiro','professor','astronauta','policial','cozinheiro',
      'piloto','dentista','veterinario','cientista','engenheiro','padeiro',
      'pintor','musico','jogador','pescador','fotografo','jornalista',
      'carteiro','agricultor'
    ]
  },
  acoes: {
    label: 'Acoes',
    difficulty: 2,
    words: [
      'dormir','nadar','cozinhar','dancar','voar','correr','pular','cantar',
      'pescar','surfar','escalar','mergulhar','patinar','pedalar','dirigir',
      'ler','escrever','pintar','fotografar','acampar'
    ]
  },
  brasil: {
    label: 'Brasil',
    difficulty: 2,
    words: [
      'cristo redentor','capoeira','carnaval','futebol','cangaceiro',
      'samba','pandeiro','berimbau','tucano','amazonia','ipanema',
      'caipirinha','acai','forró','maracana','jangada','candomble',
      'favela','cerrado','pantanal'
    ]
  },
  dificeis: {
    label: 'Dificeis',
    difficulty: 3,
    words: [
      'democracia','saudade','evolucao','filosofia','gravidade','eclipse',
      'constelacao','fotossintese','reciclagem','sustentabilidade',
      'imaginacao','inspiracao','liberdade','tecnologia','inteligencia',
      'criatividade','nostalgia','esperanca','serenidade','harmonia',
      'equilibrio','perspectiva','horizonte','infinito','metamorfose',
      'renascimento','revolucao','consciencia','empatia','resiliencia'
    ]
  }
};

// ========== PRE-DEFINED DRAWINGS (strokes for common words) ==========
// Each drawing is an array of strokes. Each stroke: { color, width, points: [[x,y],...] }
// Coordinates are 0-1 normalized (multiply by canvas size)
const DRAWINGS = {
  cachorro: [
    { color: '#000', width: 4, points: [[0.3,0.5],[0.3,0.35],[0.35,0.3],[0.45,0.3],[0.5,0.35],[0.5,0.5]] },
    { color: '#000', width: 4, points: [[0.5,0.4],[0.7,0.4],[0.75,0.35],[0.75,0.5],[0.7,0.55],[0.5,0.55]] },
    { color: '#000', width: 4, points: [[0.3,0.5],[0.3,0.65],[0.35,0.65]] },
    { color: '#000', width: 4, points: [[0.45,0.5],[0.45,0.65],[0.5,0.65]] },
    { color: '#000', width: 4, points: [[0.6,0.55],[0.6,0.65],[0.65,0.65]] },
    { color: '#000', width: 4, points: [[0.7,0.55],[0.7,0.65],[0.75,0.65]] },
    { color: '#000', width: 4, points: [[0.75,0.45],[0.85,0.42],[0.88,0.45]] },
    { color: '#000', width: 3, points: [[0.66,0.4],[0.67,0.41]] },
    { color: '#000', width: 3, points: [[0.72,0.4],[0.73,0.41]] },
    { color: '#000', width: 2, points: [[0.69,0.44],[0.69,0.46],[0.68,0.47]] },
  ],
  gato: [
    { color: '#000', width: 4, points: [[0.35,0.55],[0.35,0.35],[0.4,0.3],[0.5,0.3],[0.55,0.25],[0.55,0.35]] },
    { color: '#000', width: 4, points: [[0.55,0.35],[0.65,0.3],[0.65,0.35],[0.6,0.4],[0.55,0.4]] },
    { color: '#000', width: 4, points: [[0.55,0.4],[0.55,0.55],[0.35,0.55]] },
    { color: '#000', width: 4, points: [[0.38,0.55],[0.38,0.68]] },
    { color: '#000', width: 4, points: [[0.52,0.55],[0.52,0.68]] },
    { color: '#000', width: 3, points: [[0.55,0.5],[0.65,0.48],[0.7,0.5]] },
    { color: '#000', width: 3, points: [[0.55,0.52],[0.65,0.54],[0.7,0.52]] },
    { color: '#000', width: 2, points: [[0.45,0.38],[0.46,0.39]] },
    { color: '#000', width: 2, points: [[0.55,0.38],[0.56,0.39]] },
  ],
  elefante: [
    { color: '#95a5a6', width: 6, points: [[0.25,0.5],[0.25,0.35],[0.35,0.3],[0.55,0.3],[0.65,0.35],[0.65,0.55],[0.25,0.55],[0.25,0.5]] },
    { color: '#95a5a6', width: 5, points: [[0.65,0.38],[0.72,0.35],[0.72,0.42],[0.68,0.5],[0.65,0.55],[0.62,0.6],[0.6,0.65]] },
    { color: '#95a5a6', width: 4, points: [[0.3,0.55],[0.3,0.7]] },
    { color: '#95a5a6', width: 4, points: [[0.4,0.55],[0.4,0.7]] },
    { color: '#95a5a6', width: 4, points: [[0.5,0.55],[0.5,0.7]] },
    { color: '#95a5a6', width: 4, points: [[0.6,0.55],[0.6,0.7]] },
    { color: '#000', width: 2, points: [[0.58,0.38],[0.59,0.39]] },
    { color: '#95a5a6', width: 4, points: [[0.65,0.32],[0.7,0.28],[0.72,0.32],[0.68,0.35]] },
  ],
  cobra: [
    { color: '#2ecc71', width: 5, points: [[0.2,0.5],[0.3,0.4],[0.4,0.5],[0.5,0.4],[0.6,0.5],[0.7,0.4],[0.75,0.38]] },
    { color: '#2ecc71', width: 3, points: [[0.75,0.38],[0.78,0.36],[0.8,0.38]] },
    { color: '#000', width: 2, points: [[0.77,0.36],[0.77,0.37]] },
    { color: '#e74c3c', width: 2, points: [[0.8,0.38],[0.83,0.37],[0.82,0.39]] },
  ],
  pizza: [
    { color: '#f1c40f', width: 5, points: [[0.5,0.25],[0.25,0.7],[0.75,0.7],[0.5,0.25]] },
    { color: '#e74c3c', width: 8, points: [[0.42,0.42],[0.43,0.43]] },
    { color: '#e74c3c', width: 8, points: [[0.55,0.48],[0.56,0.49]] },
    { color: '#e74c3c', width: 8, points: [[0.45,0.58],[0.46,0.59]] },
    { color: '#e74c3c', width: 8, points: [[0.58,0.6],[0.59,0.61]] },
    { color: '#2ecc71', width: 4, points: [[0.38,0.52],[0.4,0.5],[0.42,0.52]] },
    { color: '#2ecc71', width: 4, points: [[0.52,0.55],[0.54,0.53],[0.56,0.55]] },
  ],
  bolo: [
    { color: '#795548', width: 5, points: [[0.3,0.45],[0.3,0.65],[0.7,0.65],[0.7,0.45]] },
    { color: '#e74c3c', width: 5, points: [[0.28,0.45],[0.72,0.45]] },
    { color: '#f1c40f', width: 5, points: [[0.28,0.5],[0.72,0.5]] },
    { color: '#ff8c42', width: 3, points: [[0.5,0.35],[0.5,0.45]] },
    { color: '#ff8c42', width: 6, points: [[0.49,0.32],[0.5,0.3],[0.51,0.32]] },
  ],
  sorvete: [
    { color: '#fd79a8', width: 8, points: [[0.42,0.35],[0.5,0.32],[0.58,0.35],[0.58,0.42],[0.42,0.42],[0.42,0.35]] },
    { color: '#f1c40f', width: 4, points: [[0.42,0.42],[0.5,0.68],[0.58,0.42]] },
    { color: '#ffffff', width: 5, points: [[0.44,0.37],[0.56,0.37]] },
  ],
  sol: [
    { color: '#f1c40f', width: 5, points: [] },
    { color: '#f1c40f', width: 3, points: [[0.5,0.2],[0.5,0.12]] },
    { color: '#f1c40f', width: 3, points: [[0.5,0.62],[0.5,0.7]] },
    { color: '#f1c40f', width: 3, points: [[0.3,0.4],[0.22,0.4]] },
    { color: '#f1c40f', width: 3, points: [[0.7,0.4],[0.78,0.4]] },
    { color: '#f1c40f', width: 3, points: [[0.36,0.26],[0.3,0.2]] },
    { color: '#f1c40f', width: 3, points: [[0.64,0.26],[0.7,0.2]] },
    { color: '#f1c40f', width: 3, points: [[0.36,0.54],[0.3,0.6]] },
    { color: '#f1c40f', width: 3, points: [[0.64,0.54],[0.7,0.6]] },
  ],
  casa: [
    { color: '#795548', width: 5, points: [[0.3,0.45],[0.3,0.7],[0.7,0.7],[0.7,0.45]] },
    { color: '#e74c3c', width: 5, points: [[0.25,0.45],[0.5,0.25],[0.75,0.45]] },
    { color: '#3498db', width: 4, points: [[0.45,0.52],[0.55,0.52],[0.55,0.62],[0.45,0.62],[0.45,0.52]] },
    { color: '#795548', width: 4, points: [[0.55,0.55],[0.65,0.55],[0.65,0.7],[0.55,0.7]] },
  ],
  arvore: [
    { color: '#795548', width: 6, points: [[0.48,0.55],[0.48,0.75],[0.52,0.75],[0.52,0.55]] },
    { color: '#2ecc71', width: 8, points: [[0.5,0.2],[0.3,0.4],[0.35,0.4],[0.25,0.55],[0.75,0.55],[0.65,0.4],[0.7,0.4],[0.5,0.2]] },
  ],
  carro: [
    { color: '#e74c3c', width: 5, points: [[0.2,0.5],[0.2,0.55],[0.8,0.55],[0.8,0.5],[0.65,0.5],[0.6,0.38],[0.4,0.38],[0.35,0.5],[0.2,0.5]] },
    { color: '#3498db', width: 3, points: [[0.42,0.4],[0.5,0.4],[0.5,0.48],[0.42,0.48],[0.42,0.4]] },
    { color: '#3498db', width: 3, points: [[0.52,0.4],[0.58,0.4],[0.58,0.48],[0.52,0.48],[0.52,0.4]] },
    { color: '#000', width: 6, points: [[0.32,0.57],[0.33,0.57]] },
    { color: '#000', width: 6, points: [[0.68,0.57],[0.69,0.57]] },
  ],
  flor: [
    { color: '#2ecc71', width: 4, points: [[0.5,0.5],[0.5,0.75]] },
    { color: '#2ecc71', width: 3, points: [[0.5,0.6],[0.4,0.55]] },
    { color: '#2ecc71', width: 3, points: [[0.5,0.62],[0.6,0.57]] },
    { color: '#e74c3c', width: 6, points: [[0.5,0.35],[0.5,0.36]] },
    { color: '#fd79a8', width: 6, points: [[0.44,0.38],[0.44,0.39]] },
    { color: '#fd79a8', width: 6, points: [[0.56,0.38],[0.56,0.39]] },
    { color: '#fd79a8', width: 6, points: [[0.47,0.44],[0.47,0.45]] },
    { color: '#fd79a8', width: 6, points: [[0.53,0.44],[0.53,0.45]] },
    { color: '#fd79a8', width: 6, points: [[0.44,0.42],[0.44,0.43]] },
    { color: '#fd79a8', width: 6, points: [[0.56,0.42],[0.56,0.43]] },
    { color: '#f1c40f', width: 5, points: [[0.5,0.4],[0.5,0.41]] },
  ],
  coracao: [
    { color: '#e74c3c', width: 5, points: [
      [0.5,0.65],[0.25,0.42],[0.25,0.33],[0.3,0.28],[0.38,0.28],[0.45,0.33],[0.5,0.38],
      [0.55,0.33],[0.62,0.28],[0.7,0.28],[0.75,0.33],[0.75,0.42],[0.5,0.65]
    ]},
  ],
  estrela: [
    { color: '#f1c40f', width: 4, points: [
      [0.5,0.2],[0.55,0.38],[0.72,0.38],[0.58,0.5],[0.64,0.68],[0.5,0.56],
      [0.36,0.68],[0.42,0.5],[0.28,0.38],[0.45,0.38],[0.5,0.2]
    ]},
  ],
  lua: [
    { color: '#f1c40f', width: 5, points: [
      [0.55,0.25],[0.45,0.3],[0.4,0.4],[0.4,0.5],[0.45,0.6],[0.55,0.65],
      [0.5,0.6],[0.47,0.5],[0.47,0.4],[0.5,0.3],[0.55,0.25]
    ]},
  ],
  nuvem: [
    { color: '#95a5a6', width: 6, points: [
      [0.3,0.5],[0.28,0.45],[0.3,0.38],[0.38,0.35],[0.45,0.33],[0.5,0.3],
      [0.58,0.33],[0.65,0.35],[0.7,0.38],[0.72,0.45],[0.7,0.5],[0.3,0.5]
    ]},
  ],
  montanha: [
    { color: '#795548', width: 5, points: [[0.15,0.7],[0.4,0.3],[0.55,0.5],[0.7,0.25],[0.85,0.7],[0.15,0.7]] },
    { color: '#ffffff', width: 3, points: [[0.4,0.3],[0.37,0.38],[0.43,0.38],[0.4,0.3]] },
    { color: '#ffffff', width: 3, points: [[0.7,0.25],[0.66,0.35],[0.74,0.35],[0.7,0.25]] },
  ],
  praia: [
    { color: '#3498db', width: 5, points: [[0.0,0.4],[0.15,0.38],[0.3,0.42],[0.45,0.38],[0.6,0.42],[0.75,0.38],[0.9,0.4],[1,0.4]] },
    { color: '#f1c40f', width: 8, points: [[0.0,0.7],[1,0.7]] },
    { color: '#f1c40f', width: 5, points: [[0.0,0.55],[1,0.55]] },
    { color: '#795548', width: 4, points: [[0.7,0.3],[0.7,0.55]] },
    { color: '#2ecc71', width: 6, points: [[0.7,0.3],[0.6,0.25],[0.65,0.28]] },
    { color: '#2ecc71', width: 6, points: [[0.7,0.3],[0.8,0.25],[0.75,0.28]] },
    { color: '#f1c40f', width: 8, points: [[0.82,0.15],[0.83,0.16]] },
  ],
  leao: [
    { color: '#e67e22', width: 8, points: [
      [0.5,0.25],[0.38,0.28],[0.32,0.35],[0.3,0.45],[0.32,0.55],[0.38,0.6],
      [0.5,0.62],[0.62,0.6],[0.68,0.55],[0.7,0.45],[0.68,0.35],[0.62,0.28],[0.5,0.25]
    ]},
    { color: '#f1c40f', width: 5, points: [
      [0.4,0.32],[0.4,0.55],[0.6,0.55],[0.6,0.32],[0.4,0.32]
    ]},
    { color: '#000', width: 3, points: [[0.45,0.4],[0.46,0.41]] },
    { color: '#000', width: 3, points: [[0.55,0.4],[0.56,0.41]] },
    { color: '#000', width: 2, points: [[0.5,0.46],[0.49,0.48],[0.51,0.48]] },
    { color: '#000', width: 2, points: [[0.45,0.52],[0.5,0.55],[0.55,0.52]] },
  ],
  baleia: [
    { color: '#3498db', width: 6, points: [
      [0.2,0.45],[0.3,0.38],[0.5,0.35],[0.7,0.38],[0.75,0.45],[0.7,0.55],[0.5,0.58],[0.3,0.55],[0.2,0.45]
    ]},
    { color: '#3498db', width: 4, points: [[0.75,0.45],[0.82,0.35],[0.85,0.45],[0.82,0.55],[0.75,0.45]] },
    { color: '#3498db', width: 3, points: [[0.35,0.35],[0.38,0.28],[0.4,0.3]] },
    { color: '#000', width: 2, points: [[0.3,0.43],[0.31,0.44]] },
  ],
  violao: [
    { color: '#795548', width: 3, points: [[0.5,0.2],[0.5,0.45]] },
    { color: '#795548', width: 5, points: [
      [0.42,0.45],[0.38,0.5],[0.38,0.58],[0.42,0.65],[0.5,0.68],[0.58,0.65],[0.62,0.58],[0.62,0.5],[0.58,0.45],[0.42,0.45]
    ]},
    { color: '#000', width: 3, points: [[0.5,0.5],[0.5,0.6]] },
    { color: '#795548', width: 3, points: [[0.46,0.2],[0.54,0.2]] },
    { color: '#000', width: 2, points: [[0.48,0.2],[0.48,0.45]] },
    { color: '#000', width: 2, points: [[0.52,0.2],[0.52,0.45]] },
  ],
  televisao: [
    { color: '#000', width: 5, points: [[0.25,0.3],[0.75,0.3],[0.75,0.6],[0.25,0.6],[0.25,0.3]] },
    { color: '#3498db', width: 3, points: [[0.28,0.33],[0.72,0.33],[0.72,0.57],[0.28,0.57],[0.28,0.33]] },
    { color: '#000', width: 4, points: [[0.45,0.6],[0.45,0.68],[0.55,0.68],[0.55,0.6]] },
    { color: '#000', width: 4, points: [[0.38,0.68],[0.62,0.68]] },
  ],
  relogio: [
    { color: '#000', width: 4, points: [] },
    { color: '#000', width: 3, points: [[0.5,0.5],[0.5,0.35]] },
    { color: '#000', width: 3, points: [[0.5,0.5],[0.62,0.5]] },
    { color: '#e74c3c', width: 2, points: [[0.5,0.5],[0.55,0.58]] },
    { color: '#000', width: 2, points: [[0.5,0.28],[0.5,0.3]] },
    { color: '#000', width: 2, points: [[0.5,0.7],[0.5,0.68]] },
    { color: '#000', width: 2, points: [[0.28,0.5],[0.3,0.5]] },
    { color: '#000', width: 2, points: [[0.72,0.5],[0.7,0.5]] },
  ],
  oculos: [
    { color: '#000', width: 4, points: [[0.25,0.45],[0.25,0.4],[0.3,0.38],[0.4,0.38],[0.45,0.4],[0.45,0.45],[0.4,0.48],[0.3,0.48],[0.25,0.45]] },
    { color: '#000', width: 4, points: [[0.55,0.45],[0.55,0.4],[0.6,0.38],[0.7,0.38],[0.75,0.4],[0.75,0.45],[0.7,0.48],[0.6,0.48],[0.55,0.45]] },
    { color: '#000', width: 3, points: [[0.45,0.42],[0.55,0.42]] },
    { color: '#000', width: 3, points: [[0.25,0.42],[0.2,0.4]] },
    { color: '#000', width: 3, points: [[0.75,0.42],[0.8,0.4]] },
  ],
  chave: [
    { color: '#f1c40f', width: 4, points: [[0.35,0.4],[0.35,0.35],[0.4,0.32],[0.45,0.35],[0.45,0.4],[0.4,0.43],[0.35,0.4]] },
    { color: '#f1c40f', width: 3, points: [[0.45,0.38],[0.7,0.38]] },
    { color: '#f1c40f', width: 3, points: [[0.65,0.38],[0.65,0.44]] },
    { color: '#f1c40f', width: 3, points: [[0.7,0.38],[0.7,0.44]] },
  ],
  aviao: [
    { color: '#95a5a6', width: 5, points: [[0.2,0.5],[0.75,0.5]] },
    { color: '#95a5a6', width: 3, points: [[0.75,0.5],[0.8,0.48],[0.8,0.52],[0.75,0.5]] },
    { color: '#95a5a6', width: 4, points: [[0.4,0.5],[0.5,0.35],[0.6,0.5]] },
    { color: '#95a5a6', width: 3, points: [[0.65,0.5],[0.7,0.44],[0.75,0.5]] },
    { color: '#3498db', width: 3, points: [[0.43,0.5],[0.45,0.42],[0.55,0.42],[0.57,0.5]] },
  ],
  chapeu: [
    { color: '#000', width: 5, points: [[0.2,0.55],[0.8,0.55]] },
    { color: '#000', width: 5, points: [[0.35,0.55],[0.35,0.4],[0.4,0.32],[0.5,0.28],[0.6,0.32],[0.65,0.4],[0.65,0.55]] },
    { color: '#e74c3c', width: 3, points: [[0.35,0.52],[0.65,0.52]] },
  ],
  hamburguer: [
    { color: '#e67e22', width: 6, points: [[0.3,0.38],[0.35,0.32],[0.5,0.3],[0.65,0.32],[0.7,0.38]] },
    { color: '#2ecc71', width: 4, points: [[0.28,0.42],[0.72,0.42]] },
    { color: '#e74c3c', width: 4, points: [[0.28,0.48],[0.72,0.48]] },
    { color: '#f1c40f', width: 3, points: [[0.28,0.52],[0.72,0.52]] },
    { color: '#795548', width: 4, points: [[0.28,0.56],[0.72,0.56]] },
    { color: '#e67e22', width: 6, points: [[0.3,0.6],[0.7,0.6]] },
  ],
  banana: [
    { color: '#f1c40f', width: 6, points: [
      [0.4,0.3],[0.35,0.4],[0.33,0.5],[0.35,0.6],[0.42,0.65],[0.5,0.65],[0.55,0.6],[0.52,0.5],[0.48,0.4],[0.45,0.32],[0.4,0.3]
    ]},
    { color: '#795548', width: 3, points: [[0.4,0.3],[0.38,0.26]] },
  ],
  livro: [
    { color: '#3498db', width: 5, points: [[0.3,0.3],[0.3,0.65],[0.7,0.65],[0.7,0.3],[0.3,0.3]] },
    { color: '#3498db', width: 3, points: [[0.5,0.3],[0.5,0.65]] },
    { color: '#000', width: 2, points: [[0.35,0.4],[0.47,0.4]] },
    { color: '#000', width: 2, points: [[0.35,0.46],[0.47,0.46]] },
    { color: '#000', width: 2, points: [[0.35,0.52],[0.47,0.52]] },
    { color: '#000', width: 2, points: [[0.53,0.4],[0.65,0.4]] },
    { color: '#000', width: 2, points: [[0.53,0.46],[0.65,0.46]] },
  ],
  futebol: [
    { color: '#000', width: 3, points: [
      [0.5,0.25],[0.38,0.3],[0.3,0.42],[0.3,0.55],[0.38,0.67],[0.5,0.72],
      [0.62,0.67],[0.7,0.55],[0.7,0.42],[0.62,0.3],[0.5,0.25]
    ]},
    { color: '#000', width: 3, points: [[0.5,0.35],[0.44,0.4],[0.46,0.48],[0.54,0.48],[0.56,0.4],[0.5,0.35]] },
    { color: '#000', width: 2, points: [[0.5,0.25],[0.5,0.35]] },
    { color: '#000', width: 2, points: [[0.44,0.4],[0.33,0.38]] },
    { color: '#000', width: 2, points: [[0.56,0.4],[0.67,0.38]] },
    { color: '#000', width: 2, points: [[0.46,0.48],[0.4,0.58]] },
    { color: '#000', width: 2, points: [[0.54,0.48],[0.6,0.58]] },
  ],
  cafe: [
    { color: '#795548', width: 5, points: [[0.35,0.35],[0.35,0.6],[0.6,0.6],[0.6,0.35],[0.35,0.35]] },
    { color: '#795548', width: 4, points: [[0.6,0.42],[0.68,0.42],[0.7,0.48],[0.68,0.54],[0.6,0.54]] },
    { color: '#795548', width: 5, points: [[0.3,0.62],[0.65,0.62]] },
    { color: '#95a5a6', width: 2, points: [[0.42,0.3],[0.44,0.22],[0.46,0.3]] },
    { color: '#95a5a6', width: 2, points: [[0.5,0.28],[0.52,0.2],[0.54,0.28]] },
  ],
  bicicleta: [
    { color: '#000', width: 3, points: [[0.3,0.55],[0.3,0.42],[0.45,0.38],[0.5,0.55]] },
    { color: '#000', width: 3, points: [[0.45,0.38],[0.55,0.38],[0.7,0.55]] },
    { color: '#000', width: 3, points: [[0.5,0.55],[0.55,0.38]] },
    { color: '#e74c3c', width: 3, points: [[0.45,0.38],[0.42,0.35]] },
  ],
  foguete: [
    { color: '#95a5a6', width: 5, points: [[0.5,0.2],[0.44,0.35],[0.44,0.6],[0.56,0.6],[0.56,0.35],[0.5,0.2]] },
    { color: '#e74c3c', width: 4, points: [[0.44,0.55],[0.38,0.65],[0.44,0.6]] },
    { color: '#e74c3c', width: 4, points: [[0.56,0.55],[0.62,0.65],[0.56,0.6]] },
    { color: '#e67e22', width: 4, points: [[0.46,0.6],[0.5,0.72],[0.54,0.6]] },
    { color: '#f1c40f', width: 3, points: [[0.48,0.6],[0.5,0.68],[0.52,0.6]] },
    { color: '#3498db', width: 3, points: [[0.48,0.38],[0.52,0.38],[0.52,0.42],[0.48,0.42],[0.48,0.38]] },
  ],
  abacaxi: [
    { color: '#f1c40f', width: 6, points: [
      [0.5,0.38],[0.42,0.42],[0.38,0.52],[0.4,0.62],[0.48,0.68],[0.52,0.68],[0.6,0.62],[0.62,0.52],[0.58,0.42],[0.5,0.38]
    ]},
    { color: '#2ecc71', width: 3, points: [[0.5,0.38],[0.45,0.28],[0.5,0.32]] },
    { color: '#2ecc71', width: 3, points: [[0.5,0.38],[0.55,0.28],[0.5,0.32]] },
    { color: '#2ecc71', width: 3, points: [[0.5,0.38],[0.5,0.26]] },
    { color: '#e67e22', width: 2, points: [[0.45,0.48],[0.55,0.48]] },
    { color: '#e67e22', width: 2, points: [[0.43,0.55],[0.57,0.55]] },
    { color: '#e67e22', width: 2, points: [[0.45,0.62],[0.55,0.62]] },
  ],
  castelo: [
    { color: '#95a5a6', width: 5, points: [[0.25,0.4],[0.25,0.7],[0.75,0.7],[0.75,0.4]] },
    { color: '#95a5a6', width: 4, points: [[0.25,0.4],[0.25,0.32],[0.3,0.32],[0.3,0.4]] },
    { color: '#95a5a6', width: 4, points: [[0.45,0.4],[0.45,0.3],[0.55,0.3],[0.55,0.4]] },
    { color: '#95a5a6', width: 4, points: [[0.7,0.4],[0.7,0.32],[0.75,0.32],[0.75,0.4]] },
    { color: '#795548', width: 4, points: [[0.45,0.55],[0.55,0.55],[0.55,0.7],[0.45,0.7]] },
    { color: '#3498db', width: 3, points: [[0.33,0.48],[0.38,0.48],[0.38,0.55],[0.33,0.55],[0.33,0.48]] },
    { color: '#3498db', width: 3, points: [[0.62,0.48],[0.67,0.48],[0.67,0.55],[0.62,0.55],[0.62,0.48]] },
    { color: '#e74c3c', width: 3, points: [[0.48,0.26],[0.5,0.2],[0.52,0.26]] },
  ],
  escola: [
    { color: '#795548', width: 5, points: [[0.2,0.45],[0.2,0.7],[0.8,0.7],[0.8,0.45]] },
    { color: '#e74c3c', width: 5, points: [[0.15,0.45],[0.5,0.28],[0.85,0.45]] },
    { color: '#795548', width: 4, points: [[0.45,0.55],[0.55,0.55],[0.55,0.7],[0.45,0.7]] },
    { color: '#3498db', width: 3, points: [[0.28,0.5],[0.36,0.5],[0.36,0.6],[0.28,0.6],[0.28,0.5]] },
    { color: '#3498db', width: 3, points: [[0.64,0.5],[0.72,0.5],[0.72,0.6],[0.64,0.6],[0.64,0.5]] },
  ],
  bombeiro: [
    { color: '#e74c3c', width: 5, points: [[0.4,0.3],[0.6,0.3],[0.6,0.36],[0.4,0.36],[0.4,0.3]] },
    { color: '#e74c3c', width: 3, points: [[0.35,0.36],[0.65,0.36]] },
    { color: '#000', width: 4, points: [[0.45,0.4],[0.45,0.6],[0.55,0.6],[0.55,0.4]] },
    { color: '#e74c3c', width: 4, points: [[0.45,0.4],[0.55,0.4],[0.55,0.55],[0.45,0.55],[0.45,0.4]] },
    { color: '#000', width: 3, points: [[0.45,0.6],[0.42,0.75]] },
    { color: '#000', width: 3, points: [[0.55,0.6],[0.58,0.75]] },
    { color: '#f1c40f', width: 3, points: [[0.48,0.46],[0.52,0.46],[0.5,0.52],[0.48,0.46]] },
  ],
  astronauta: [
    { color: '#ffffff', width: 5, points: [
      [0.5,0.22],[0.42,0.26],[0.38,0.34],[0.38,0.42],[0.42,0.48],[0.5,0.5],[0.58,0.48],[0.62,0.42],[0.62,0.34],[0.58,0.26],[0.5,0.22]
    ]},
    { color: '#3498db', width: 3, points: [
      [0.44,0.32],[0.56,0.32],[0.56,0.42],[0.44,0.42],[0.44,0.32]
    ]},
    { color: '#ffffff', width: 5, points: [[0.42,0.5],[0.42,0.68],[0.58,0.68],[0.58,0.5]] },
    { color: '#95a5a6', width: 3, points: [[0.42,0.55],[0.35,0.62]] },
    { color: '#95a5a6', width: 3, points: [[0.58,0.55],[0.65,0.62]] },
    { color: '#95a5a6', width: 3, points: [[0.45,0.68],[0.45,0.75]] },
    { color: '#95a5a6', width: 3, points: [[0.55,0.68],[0.55,0.75]] },
  ],
  pinguim: [
    { color: '#000', width: 5, points: [
      [0.5,0.25],[0.42,0.3],[0.38,0.4],[0.38,0.55],[0.42,0.65],[0.5,0.68],[0.58,0.65],[0.62,0.55],[0.62,0.4],[0.58,0.3],[0.5,0.25]
    ]},
    { color: '#ffffff', width: 4, points: [
      [0.44,0.38],[0.44,0.58],[0.56,0.58],[0.56,0.38],[0.44,0.38]
    ]},
    { color: '#000', width: 2, points: [[0.46,0.34],[0.47,0.35]] },
    { color: '#000', width: 2, points: [[0.54,0.34],[0.55,0.35]] },
    { color: '#e67e22', width: 3, points: [[0.48,0.38],[0.5,0.42],[0.52,0.38]] },
    { color: '#e67e22', width: 3, points: [[0.44,0.66],[0.48,0.7],[0.52,0.7],[0.56,0.66]] },
  ],
  morango: [
    { color: '#e74c3c', width: 6, points: [
      [0.5,0.35],[0.42,0.42],[0.38,0.52],[0.4,0.6],[0.48,0.66],[0.52,0.66],[0.6,0.6],[0.62,0.52],[0.58,0.42],[0.5,0.35]
    ]},
    { color: '#2ecc71', width: 3, points: [[0.45,0.35],[0.5,0.28],[0.55,0.35]] },
    { color: '#2ecc71', width: 3, points: [[0.42,0.34],[0.5,0.32],[0.58,0.34]] },
    { color: '#f1c40f', width: 1, points: [[0.47,0.45],[0.47,0.46]] },
    { color: '#f1c40f', width: 1, points: [[0.53,0.45],[0.53,0.46]] },
    { color: '#f1c40f', width: 1, points: [[0.45,0.52],[0.45,0.53]] },
    { color: '#f1c40f', width: 1, points: [[0.55,0.52],[0.55,0.53]] },
    { color: '#f1c40f', width: 1, points: [[0.5,0.58],[0.5,0.59]] },
  ],
  guarda_chuva: [
    { color: '#3498db', width: 5, points: [
      [0.25,0.45],[0.3,0.35],[0.4,0.28],[0.5,0.25],[0.6,0.28],[0.7,0.35],[0.75,0.45]
    ]},
    { color: '#795548', width: 3, points: [[0.5,0.25],[0.5,0.68]] },
    { color: '#795548', width: 3, points: [[0.5,0.68],[0.55,0.72],[0.55,0.68]] },
  ],
  panela: [
    { color: '#95a5a6', width: 5, points: [[0.3,0.4],[0.3,0.6],[0.7,0.6],[0.7,0.4],[0.3,0.4]] },
    { color: '#95a5a6', width: 3, points: [[0.28,0.46],[0.22,0.46]] },
    { color: '#95a5a6', width: 3, points: [[0.72,0.46],[0.78,0.46]] },
    { color: '#95a5a6', width: 4, points: [[0.28,0.38],[0.72,0.38]] },
    { color: '#95a5a6', width: 2, points: [[0.44,0.32],[0.46,0.26],[0.48,0.32]] },
    { color: '#95a5a6', width: 2, points: [[0.52,0.32],[0.54,0.26],[0.56,0.32]] },
  ],
  ovo: [
    { color: '#f1c40f', width: 5, points: [
      [0.5,0.28],[0.42,0.35],[0.38,0.45],[0.38,0.55],[0.42,0.62],[0.5,0.65],[0.58,0.62],[0.62,0.55],[0.62,0.45],[0.58,0.35],[0.5,0.28]
    ]},
    { color: '#ffffff', width: 3, points: [[0.46,0.36],[0.48,0.34]] },
  ],
};

// Map words with hyphens/spaces to drawing keys
const DRAWING_KEY_MAP = {
  'guarda-chuva': 'guarda_chuva',
  'cristo redentor': 'cristo_redentor',
};

// ========== DOM ELEMENTS ==========
const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const bestDisplay = document.getElementById('best-display');
const overlay = document.getElementById('overlay');
const roundOverlay = document.getElementById('round-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const wordOverlay = document.getElementById('word-overlay');
const drawResultOverlay = document.getElementById('draw-result-overlay');
const gameInfoBar = document.getElementById('game-info-bar');
const toolbar = document.getElementById('toolbar');
const guessArea = document.getElementById('guess-area');
const guessInput = document.getElementById('guess-input');
const guessFeedback = document.getElementById('guess-feedback');
const timerDisplay = document.getElementById('timer-display');
const timerCircle = document.getElementById('timer-circle');
const roundDisplay = document.getElementById('round-display');
const hintDisplay = document.getElementById('hint-display');

// ========== GAME STATE ==========
let currentMode = null; // 'guess', 'draw', 'free'
let score = 0;
let bestScore = parseInt(localStorage.getItem('desenhando_best') || '0');
let currentRound = 0;
let totalRounds = 10;
let timeLeft = 60;
let timerInterval = null;
let currentWord = null;
let currentCategory = null;
let currentDifficulty = 1;
let usedWords = new Set();
let drawingAnimation = null;
let hintRevealed = { category: false, firstLetter: false };
let isDrawing = false;
let lastX = 0, lastY = 0;
let currentColor = '#000000';
let currentSize = 8;
let currentTool = 'brush'; // brush | eraser
let strokes = []; // Array of strokes for undo
let currentStroke = null;

// Draw mode
let drawModeRound = 0;
let drawModeScore = 0;

bestDisplay.textContent = bestScore;

// ========== UTILITY ==========
function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (a === b) return 1;
  const len = Math.max(a.length, b.length);
  if (len === 0) return 1;
  let matches = 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  // Also check Levenshtein-like: count position matches
  let posMatch = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) posMatch++;
  }
  return Math.max(matches / len, posMatch / len);
}

function getRandomWord() {
  const categories = Object.keys(WORDS);
  let attempts = 0;
  while (attempts < 500) {
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const wordList = WORDS[cat].words;
    const word = wordList[Math.floor(Math.random() * wordList.length)];
    if (!usedWords.has(word)) {
      usedWords.add(word);
      return { word, category: WORDS[cat].label, difficulty: WORDS[cat].difficulty };
    }
    attempts++;
  }
  // Reset used words if we ran out
  usedWords.clear();
  const cat = categories[0];
  const word = WORDS[cat].words[0];
  usedWords.add(word);
  return { word, category: WORDS[cat].label, difficulty: WORDS[cat].difficulty };
}

function generateHintMask(word, showFirst) {
  return word.split('').map((ch, i) => {
    if (ch === ' ') return '  ';
    if (ch === '-') return '-';
    if (showFirst && i === 0) return ch.toUpperCase();
    return '_';
  }).join(' ');
}

// ========== CANVAS DRAWING ==========
function clearCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  strokes = [];
}

function redrawCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    drawStroke(stroke);
  }
}

function drawStroke(stroke) {
  if (!stroke.points || stroke.points.length < 2) {
    if (stroke.points && stroke.points.length === 1) {
      ctx.beginPath();
      ctx.arc(stroke.points[0][0], stroke.points[0][1], stroke.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
    }
    return;
  }
  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (stroke.eraser) {
    ctx.globalCompositeOperation = 'destination-out';
  }
  ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
  }
  ctx.stroke();
  if (stroke.eraser) {
    ctx.globalCompositeOperation = 'source-over';
  }
}

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  let clientX, clientY;
  if (e.touches) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return [
    (clientX - rect.left) * scaleX,
    (clientY - rect.top) * scaleY
  ];
}

// ========== CANVAS INPUT HANDLERS ==========
function onPointerDown(e) {
  if (currentMode === 'guess') return;
  e.preventDefault();
  isDrawing = true;
  const [x, y] = getCanvasPos(e);
  lastX = x;
  lastY = y;
  currentStroke = {
    color: currentTool === 'eraser' ? '#ffffff' : currentColor,
    width: currentTool === 'eraser' ? currentSize * 3 : currentSize,
    eraser: currentTool === 'eraser',
    points: [[x, y]]
  };
}

function onPointerMove(e) {
  if (!isDrawing || currentMode === 'guess') return;
  e.preventDefault();
  const [x, y] = getCanvasPos(e);
  currentStroke.points.push([x, y]);
  // Draw live
  ctx.beginPath();
  ctx.strokeStyle = currentStroke.eraser ? '#ffffff' : currentStroke.color;
  ctx.lineWidth = currentStroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (currentStroke.eraser) {
    ctx.globalCompositeOperation = 'destination-out';
  }
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  if (currentStroke.eraser) {
    ctx.globalCompositeOperation = 'source-over';
  }
  lastX = x;
  lastY = y;
}

function onPointerUp(e) {
  if (!isDrawing) return;
  isDrawing = false;
  if (currentStroke) {
    strokes.push(currentStroke);
    currentStroke = null;
  }
}

// Mouse events
canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('mouseleave', onPointerUp);

// Touch events
canvas.addEventListener('touchstart', onPointerDown, { passive: false });
canvas.addEventListener('touchmove', onPointerMove, { passive: false });
canvas.addEventListener('touchend', onPointerUp);
canvas.addEventListener('touchcancel', onPointerUp);

// ========== TOOLBAR ==========
// Colors
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.dataset.color;
    currentTool = 'brush';
    document.getElementById('btn-brush').classList.add('active');
    document.getElementById('btn-eraser').classList.remove('active');
  });
});

// Sizes
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSize = parseInt(btn.dataset.size);
  });
});

// Tools
document.getElementById('btn-brush').addEventListener('click', () => {
  currentTool = 'brush';
  document.getElementById('btn-brush').classList.add('active');
  document.getElementById('btn-eraser').classList.remove('active');
});

document.getElementById('btn-eraser').addEventListener('click', () => {
  currentTool = 'eraser';
  document.getElementById('btn-eraser').classList.add('active');
  document.getElementById('btn-brush').classList.remove('active');
});

document.getElementById('btn-undo').addEventListener('click', () => {
  if (strokes.length > 0) {
    strokes.pop();
    redrawCanvas();
  }
});

document.getElementById('btn-clear').addEventListener('click', () => {
  clearCanvas();
});

// ========== AUTO DRAWING (Guess Mode) ==========
function getDrawingForWord(word) {
  const key = DRAWING_KEY_MAP[word] || word.replace(/[\s-]/g, '_');
  if (DRAWINGS[key]) return DRAWINGS[key];
  // Generate procedural drawing
  return generateProceduralDrawing(word);
}

function generateProceduralDrawing(word) {
  // Generate abstract shapes that give hints about the word
  const strokes = [];
  const seed = hashString(word);
  const rng = seededRandom(seed);

  // Generate 8-15 strokes of geometric shapes
  const numStrokes = 8 + Math.floor(rng() * 8);
  const colors = ['#000000', '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#795548'];

  for (let i = 0; i < numStrokes; i++) {
    const color = colors[Math.floor(rng() * colors.length)];
    const width = 2 + Math.floor(rng() * 5);
    const points = [];
    const shapeType = Math.floor(rng() * 4);

    if (shapeType === 0) {
      // Line
      points.push([0.15 + rng() * 0.7, 0.15 + rng() * 0.7]);
      points.push([0.15 + rng() * 0.7, 0.15 + rng() * 0.7]);
    } else if (shapeType === 1) {
      // Circle-ish
      const cx = 0.3 + rng() * 0.4;
      const cy = 0.3 + rng() * 0.4;
      const r = 0.05 + rng() * 0.15;
      const segments = 8 + Math.floor(rng() * 8);
      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI * 2;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }
    } else if (shapeType === 2) {
      // Rectangle
      const x = 0.2 + rng() * 0.4;
      const y = 0.2 + rng() * 0.4;
      const w = 0.1 + rng() * 0.2;
      const h = 0.1 + rng() * 0.2;
      points.push([x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]);
    } else {
      // Curve
      const numPts = 4 + Math.floor(rng() * 4);
      for (let j = 0; j < numPts; j++) {
        points.push([0.15 + rng() * 0.7, 0.15 + rng() * 0.7]);
      }
    }

    strokes.push({ color, width, points });
  }
  return strokes;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function animateDrawing(drawing, onComplete) {
  clearCanvas();
  canvas.classList.add('no-draw');
  let strokeIndex = 0;
  let pointIndex = 0;
  const speed = 3; // points per frame

  function drawFrame() {
    if (strokeIndex >= drawing.length) {
      if (onComplete) onComplete();
      return;
    }

    const stroke = drawing[strokeIndex];
    if (!stroke.points || stroke.points.length === 0) {
      strokeIndex++;
      drawingAnimation = requestAnimationFrame(drawFrame);
      return;
    }

    const w = canvas.width;
    const h = canvas.height;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * (w / 600);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const endPoint = Math.min(pointIndex + speed, stroke.points.length);

    if (pointIndex === 0 && endPoint >= 1) {
      ctx.moveTo(stroke.points[0][0] * w, stroke.points[0][1] * h);
    } else if (pointIndex > 0) {
      ctx.moveTo(stroke.points[Math.max(0, pointIndex - 1)][0] * w, stroke.points[Math.max(0, pointIndex - 1)][1] * h);
    }

    for (let i = Math.max(1, pointIndex); i < endPoint; i++) {
      ctx.lineTo(stroke.points[i][0] * w, stroke.points[i][1] * h);
    }
    ctx.stroke();

    // Single-point strokes (dots)
    if (stroke.points.length <= 2 && pointIndex === 0) {
      ctx.beginPath();
      ctx.arc(stroke.points[0][0] * w, stroke.points[0][1] * h, stroke.width * (w / 600) / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
    }

    pointIndex = endPoint;

    if (pointIndex >= stroke.points.length) {
      strokeIndex++;
      pointIndex = 0;
      // Pause between strokes
      setTimeout(() => {
        drawingAnimation = requestAnimationFrame(drawFrame);
      }, 200 + Math.random() * 300);
      return;
    }

    drawingAnimation = requestAnimationFrame(drawFrame);
  }

  drawingAnimation = requestAnimationFrame(drawFrame);
}

function stopDrawingAnimation() {
  if (drawingAnimation) {
    cancelAnimationFrame(drawingAnimation);
    drawingAnimation = null;
  }
}

// ========== TIMER ==========
const TIMER_CIRCUMFERENCE = 2 * Math.PI * 20; // r=20

function startTimer(seconds, onTick, onEnd) {
  timeLeft = seconds;
  updateTimerDisplay();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (onTick) onTick(timeLeft);
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (onEnd) onEnd();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function updateTimerDisplay() {
  timerDisplay.textContent = timeLeft;
  const fraction = timeLeft / 60;
  const offset = TIMER_CIRCUMFERENCE * (1 - fraction);
  timerCircle.style.strokeDasharray = TIMER_CIRCUMFERENCE;
  timerCircle.style.strokeDashoffset = offset;

  timerCircle.classList.remove('warning', 'danger');
  if (timeLeft <= 10) timerCircle.classList.add('danger');
  else if (timeLeft <= 20) timerCircle.classList.add('warning');
}

// ========== GUESS MODE ==========
function startGuessMode() {
  currentMode = 'guess';
  score = 0;
  currentRound = 0;
  usedWords.clear();
  updateScore();
  hideAllOverlays();
  gameInfoBar.style.display = 'flex';
  guessArea.style.display = 'block';
  toolbar.style.display = 'none';
  canvas.classList.add('no-draw');
  nextGuessRound();
}

function nextGuessRound() {
  currentRound++;
  if (currentRound > totalRounds) {
    endGame();
    return;
  }

  const wordData = getRandomWord();
  currentWord = wordData.word;
  currentCategory = wordData.category;
  currentDifficulty = wordData.difficulty;
  hintRevealed = { category: false, firstLetter: false };

  roundDisplay.textContent = `Rodada ${currentRound}/${totalRounds}`;
  hintDisplay.innerHTML = generateHintMask(currentWord, false);
  guessInput.value = '';
  guessFeedback.textContent = '';
  guessFeedback.className = 'guess-feedback';
  guessInput.focus();

  const drawing = getDrawingForWord(currentWord);
  animateDrawing(drawing);

  startTimer(60, (t) => {
    // Progressive hints
    if (t <= 40 && !hintRevealed.category) {
      hintRevealed.category = true;
      hintDisplay.innerHTML = generateHintMask(currentWord, false) +
        `<span class="hint-category">Categoria: ${currentCategory}</span>`;
    }
    if (t <= 20 && !hintRevealed.firstLetter) {
      hintRevealed.firstLetter = true;
      hintDisplay.innerHTML = generateHintMask(currentWord, true) +
        `<span class="hint-category">Categoria: ${currentCategory}</span>`;
    }
  }, () => {
    // Time's up
    showRoundResult(false);
  });
}

function submitGuess() {
  const guess = guessInput.value.trim();
  if (!guess) return;

  const normalizedGuess = normalize(guess);
  const normalizedWord = normalize(currentWord);

  if (normalizedGuess === normalizedWord) {
    // Correct!
    const points = timeLeft * 10;
    score += points;
    updateScore();
    stopTimer();
    stopDrawingAnimation();
    showRoundResult(true, points);
  } else {
    const sim = similarity(guess, currentWord);
    if (sim >= 0.5) {
      guessFeedback.textContent = 'Quase! Muito perto!';
      guessFeedback.className = 'guess-feedback wrong';
    } else {
      guessFeedback.textContent = 'Errado! Tente novamente.';
      guessFeedback.className = 'guess-feedback wrong';
    }
    guessInput.value = '';
    guessInput.focus();

    // Shake animation
    guessInput.classList.add('shake');
    setTimeout(() => guessInput.classList.remove('shake'), 300);
  }
}

function showRoundResult(correct, points = 0) {
  stopDrawingAnimation();
  stopTimer();
  canvas.classList.remove('no-draw');

  // Draw the full image
  const drawing = getDrawingForWord(currentWord);
  clearCanvas();
  const w = canvas.width, h = canvas.height;
  for (const stroke of drawing) {
    if (!stroke.points || stroke.points.length === 0) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * (w / 600);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(stroke.points[0][0] * w, stroke.points[0][1] * h);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i][0] * w, stroke.points[i][1] * h);
    }
    ctx.stroke();
    if (stroke.points.length <= 2) {
      ctx.beginPath();
      ctx.arc(stroke.points[0][0] * w, stroke.points[0][1] * h, stroke.width * (w / 600) / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
    }
  }

  const roundIcon = document.getElementById('round-icon');
  const roundTitle = document.getElementById('round-title');
  const roundMsg = document.getElementById('round-msg');
  const roundScoreDisp = document.getElementById('round-score-display');

  if (correct) {
    roundIcon.textContent = '\u2705';
    roundTitle.textContent = 'Acertou!';
    roundMsg.textContent = `A palavra era: ${currentWord}`;
    roundScoreDisp.textContent = `+${points} pontos`;
  } else {
    roundIcon.textContent = '\u274C';
    roundTitle.textContent = 'Tempo esgotado!';
    roundMsg.textContent = `A palavra era: ${currentWord}`;
    roundScoreDisp.textContent = '';
  }

  roundOverlay.style.display = 'flex';
}

// ========== DRAW MODE ==========
function startDrawMode() {
  currentMode = 'draw';
  drawModeRound = 0;
  drawModeScore = 0;
  score = 0;
  usedWords.clear();
  updateScore();
  hideAllOverlays();
  gameInfoBar.style.display = 'flex';
  guessArea.style.display = 'none';
  toolbar.style.display = 'flex';
  canvas.classList.remove('no-draw');
  nextDrawRound();
}

function nextDrawRound() {
  drawModeRound++;
  if (drawModeRound > totalRounds) {
    endGame();
    return;
  }

  const wordData = getRandomWord();
  currentWord = wordData.word;
  currentCategory = wordData.category;

  roundDisplay.textContent = `Rodada ${drawModeRound}/${totalRounds}`;
  hintDisplay.innerHTML = '';

  // Show word to draw
  document.getElementById('word-to-draw').textContent = currentWord.toUpperCase();
  document.getElementById('word-category').textContent = `Categoria: ${currentCategory}`;
  wordOverlay.style.display = 'flex';
}

function startDrawingRound() {
  wordOverlay.style.display = 'none';
  clearCanvas();
  strokes = [];
  currentRound = drawModeRound;

  hintDisplay.textContent = currentWord.toUpperCase();

  startTimer(60, null, () => {
    // Time up — AI "guesses"
    aiGuess();
  });
}

function aiGuess() {
  stopTimer();
  const hasDrawing = strokes.length > 0;

  // Simulate AI guessing with some randomness
  const aiCorrect = hasDrawing && Math.random() < 0.4; // 40% chance if player drew something
  const drawResultIcon = document.getElementById('draw-result-icon');
  const drawResultTitle = document.getElementById('draw-result-title');
  const drawResultMsg = document.getElementById('draw-result-msg');

  if (aiCorrect) {
    drawResultIcon.textContent = '\uD83E\uDD16';
    drawResultTitle.textContent = 'A IA adivinhou!';
    drawResultMsg.textContent = `A IA acertou: "${currentWord}"! +100 pontos`;
    score += 100;
    drawModeScore += 100;
  } else {
    // AI guesses wrong — pick a random word from same category
    const cat = Object.values(WORDS).find(c => c.label === currentCategory);
    const wrongGuess = cat ? cat.words[Math.floor(Math.random() * cat.words.length)] : 'banana';
    drawResultIcon.textContent = '\uD83E\uDD14';
    drawResultTitle.textContent = 'A IA errou!';
    drawResultMsg.textContent = `A IA chutou "${wrongGuess}". Era "${currentWord}".`;
  }
  updateScore();
  drawResultOverlay.style.display = 'flex';
}

// ========== FREE MODE ==========
function startFreeMode() {
  currentMode = 'free';
  hideAllOverlays();
  gameInfoBar.style.display = 'none';
  guessArea.style.display = 'none';
  toolbar.style.display = 'flex';
  canvas.classList.remove('no-draw');
  clearCanvas();
}

// ========== GAME END ==========
function endGame() {
  stopTimer();
  stopDrawingAnimation();

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('desenhando_best', bestScore.toString());
    bestDisplay.textContent = bestScore;
  }

  const rounds = currentMode === 'draw' ? drawModeRound - 1 : currentRound - 1;

  document.getElementById('gameover-msg').textContent =
    `Voce fez ${score} pontos em ${rounds} rodadas!`;
  document.getElementById('gameover-score').textContent = `${score} pts`;

  gameoverOverlay.style.display = 'flex';

  try {
    onGameEnd('desenhando', { won: score > 0, score });
  } catch(e) { /* integration optional */ }
}

function updateScore() {
  scoreDisplay.textContent = score;
}

// ========== SHARE ==========
function share() {
  const rounds = currentMode === 'draw' ? drawModeRound - 1 : currentRound - 1;
  const text = `\uD83C\uDFA8 Desenhando: ${score} pontos em ${rounds} rodadas!\nJogue: https://gameshub.com.br/games/desenhando/`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }
}

// ========== OVERLAY MANAGEMENT ==========
function hideAllOverlays() {
  overlay.style.display = 'none';
  roundOverlay.style.display = 'none';
  gameoverOverlay.style.display = 'none';
  wordOverlay.style.display = 'none';
  drawResultOverlay.style.display = 'none';
}

// ========== EVENT LISTENERS ==========
// Menu buttons
document.getElementById('btn-guess-mode').addEventListener('click', startGuessMode);
document.getElementById('btn-draw-mode').addEventListener('click', startDrawMode);
document.getElementById('btn-free-mode').addEventListener('click', startFreeMode);

// Guess input
document.getElementById('btn-guess').addEventListener('click', submitGuess);
guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitGuess();
});

// Round result
document.getElementById('btn-next-round').addEventListener('click', () => {
  roundOverlay.style.display = 'none';
  nextGuessRound();
});

// Draw mode
document.getElementById('btn-start-drawing').addEventListener('click', startDrawingRound);
document.getElementById('btn-draw-next').addEventListener('click', () => {
  drawResultOverlay.style.display = 'none';
  nextDrawRound();
});

// Game over
document.getElementById('btn-play-again').addEventListener('click', () => {
  hideAllOverlays();
  overlay.style.display = 'flex';
});
document.getElementById('btn-share').addEventListener('click', share);

// ========== INIT ==========
clearCanvas();
overlay.style.display = 'flex';
