-- =============================================================================
-- Seed: Conquistas (Achievements) do Game Hub
--
-- Popula a tabela 'achievements' com todas as 70 conquistas definidas no
-- achievement-manager.js. Idempotente: usa ON CONFLICT (id) DO NOTHING.
--
-- Executar apos a migration add-achievements.sql
-- =============================================================================

INSERT INTO achievements (id, name, description, icon, category, coins) VALUES

-- === GLOBAIS (20) ===
('first_win',    'Primeira Vitoria',   'Venca seu primeiro jogo',            E'\U0001F3C6', 'global',   10),
('win_10',       'Vencedor',           'Venca 10 jogos',                     E'\u2B50',     'global',   25),
('win_50',       'Campeao',            'Venca 50 jogos',                     E'\U0001F451', 'global',   50),
('win_100',      'Lenda',              'Venca 100 jogos',                    E'\U0001F31F', 'global',  100),
('win_500',      'Imortal',            'Venca 500 jogos',                    E'\U0001F48E', 'global',  500),
('play_5_games', 'Explorador',         'Jogue 5 jogos diferentes',           E'\U0001F5FA', 'global',   15),
('play_15_games','Aventureiro',        'Jogue 15 jogos diferentes',          E'\U0001F9ED', 'global',   50),
('play_all',     'Colecionador',       'Jogue todos os 47 jogos',            E'\U0001F3AF', 'global',  200),
('streak_3',     'Constante',          '3 dias seguidos jogando',            E'\U0001F525', 'global',   15),
('streak_7',     'Dedicado',           '7 dias seguidos jogando',            E'\U0001F525', 'global',   50),
('streak_30',    'Maratonista',        '30 dias seguidos jogando',           E'\U0001F3C3', 'global',  200),
('total_100',    'Jogador Casual',     'Jogue 100 partidas no total',        E'\U0001F3AE', 'global',   30),
('total_500',    'Jogador Hardcore',   'Jogue 500 partidas no total',        E'\U0001F4AA', 'global',  100),
('total_1000',   'Viciado',            'Jogue 1000 partidas no total',       E'\U0001F92F', 'global',  250),
('night_owl',    'Coruja Noturna',     'Jogue entre 2h e 5h da manha',       E'\U0001F989', 'global',   15),
('speed_demon',  'Relampago',          'Venca um jogo em menos de 30s',      E'\u26A1',     'global',   20),
('perfect_week', 'Semana Perfeita',    'Jogue todos os 7 dias da semana',    E'\U0001F4C5', 'global',   75),
('coin_100',     'Poupador',           'Acumule 100 moedas',                 E'\U0001FA99', 'global',   10),
('coin_1000',    'Rico',               'Acumule 1000 moedas',                E'\U0001F4B0', 'global',   50),
('coin_5000',    'Milionario',         'Acumule 5000 moedas',                E'\U0001F3E6', 'global',  100),

-- === POR JOGO ===
-- Chess
('chess_10',     'Enxadrista',         'Venca 10 partidas de xadrez',        E'\u265F',     'chess',    30),
('chess_50',     'Mestre do Xadrez',   'Venca 50 partidas de xadrez',        E'\u265A',     'chess',   100),
-- Solitaire
('solitaire_10', 'Paciencia',          'Venca 10 partidas de paciencia',     E'\U0001F0CF', 'solitaire', 30),
('solitaire_fast','Paciencia Relampago','Venca paciencia em menos de 3min',  E'\u26A1',     'solitaire', 50),
-- Termo
('termo_10',     'Vocabulario',        'Venca 10 partidas de Termo',         E'\U0001F4DD', 'termo',    30),
('termo_streak', 'Genio das Palavras', 'Acerte Termo na primeira tentativa', E'\U0001F9E0', 'termo',    75),
-- Sudoku
('sudoku_10',    'Logico',             'Resolva 10 Sudokus',                 E'\U0001F522', 'sudoku',   30),
-- Tetris
('tetris_1000',  'Tetris Master',      'Faca 1000+ pontos no Tetris',        E'\U0001F9F1', 'tetris',   30),
('tetris_5000',  'Tetris God',         'Faca 5000+ pontos no Tetris',        E'\U0001F47E', 'tetris',  100),
-- Snake
('snake_50',     'Cobra Faminta',      'Marque 50+ pontos na Cobra',         E'\U0001F40D', 'snake',    30),
-- Minesweeper
('mines_10',     'Desminador',         'Venca 10 Campo Minado',              E'\U0001F4A3', 'minesweeper', 30),
-- Memory
('memory_10',    'Memoria de Elefante','Venca 10 jogos de Memoria',          E'\U0001F9E0', 'memory',   30),
-- Checkers
('checkers_10',  'Estrategista',       'Venca 10 partidas de Damas',         E'\u2B1B',     'checkers', 30),
-- Connect4
('connect4_10',  'Conectado',          'Venca 10 Lig 4',                     E'\U0001F534', 'connect4', 30),
-- Puzzle15
('puzzle15_10',  'Quebra-Cabeca',      'Resolva 10 Puzzle 15',               E'\U0001F9E9', 'puzzle15', 30),
-- 2048
('2048_2048',    '2048!',              'Alcance o tile 2048',                E'\U0001F3AF', 'game2048', 50),
-- Flappy Bird
('flappy_10',    'Passarinho',         'Marque 10+ no Flappy Bird',          E'\U0001F426', 'flappybird', 30),
('flappy_50',    'Aguia',              'Marque 50+ no Flappy Bird',          E'\U0001F985', 'flappybird',100),
-- Breakout
('breakout_10',  'Destruidor',         'Venca 10 Breakout',                  E'\U0001F9F1', 'breakout', 30),
-- Pong
('pong_10',      'Classico',           'Venca 10 Pong',                      E'\U0001F3D3', 'pong',     30),
-- Hangman
('hangman_10',   'Salva-vidas',        'Venca 10 Forca',                     E'\U0001FAA2', 'hangman',  30),
-- Reversi
('reversi_10',   'Reversor',           'Venca 10 Reversi',                   E'\u26AB',     'reversi',  30),
-- Mahjong
('mahjong_10',   'Zen',                'Venca 10 Mahjong',                   E'\U0001F004', 'mahjong',  30),
-- Go
('go_10',        'Mestre Go',          'Venca 10 partidas de Go',            E'\u26AA',     'go',       30),
-- Word Search
('wordsearch_10','Cacador de Palavras','Resolva 10 Caca-Palavras',           E'\U0001F50D', 'wordsearch', 30),
-- Space Invaders
('space_1000',   'Defensor Espacial',  'Faca 1000+ pontos no Space Invaders',E'\U0001F47E', 'spaceinvaders', 30),
-- Pac-Man
('pacman_1000',  'Pac-Master',         'Faca 1000+ pontos no Pac-Man',       E'\U0001F7E1', 'pacman',   30),
-- Dino Runner
('dino_500',     'Corredor Pre-Historico','Marque 500+ no Dino Runner',      E'\U0001F995', 'dinorunner', 30),
-- Cookie Clicker
('cookie_1000',  'Padeiro',            'Clique 1000 cookies',                E'\U0001F36A', 'cookieclicker', 30),
-- Nonogram
('nonogram_10',  'Artista Logico',     'Resolva 10 Nonogramas',              E'\U0001F3A8', 'nonogram', 30),
-- Numble
('numble_10',    'Matematico',         'Resolva 10 Numbles',                 E'\U0001F522', 'numble',   30),
-- Anagram
('anagram_10',   'Embaralhado',        'Resolva 10 Anagramas',               E'\U0001F524', 'anagram',  30),
-- Lights Out
('lightsout_10', 'Apagador',           'Resolva 10 Lights Out',              E'\U0001F4A1', 'lightsout', 30),
-- Sokoban
('sokoban_10',   'Empurrador',         'Resolva 10 Sokoban',                 E'\U0001F4E6', 'sokoban',  30),
-- Bubble Shooter
('bubble_10',    'Atirador de Bolhas', 'Venca 10 Bubble Shooter',            E'\U0001FAE7', 'bubble-shooter', 30),
-- Truco
('truco_10',     'Trucao',             'Venca 10 partidas de Truco',         E'\U0001F0CF', 'truco',    30),
-- UNO
('uno_10',       'UNO!',               'Venca 10 partidas de UNO',           E'\U0001F3B4', 'uno',      30),
-- Blackjack
('blackjack_10', 'Cassino',            'Venca 10 Blackjack',                 E'\U0001F0A1', 'blackjack', 30),
-- Poker
('poker_10',     'Blefador',           'Venca 10 partidas de Poker',         E'\u2660',     'poker',    30),
-- FreeCell
('freecell_10',  'Livre',              'Venca 10 FreeCell',                  E'\U0001F0CF', 'freecell', 30),
-- Pyramid
('pyramid_10',   'Farao',              'Venca 10 Pyramid',                   E'\U0001F3DB', 'pyramid',  30),
-- Spider Solitaire
('spider_10',    'Aranha',             'Venca 10 Spider Solitaire',          E'\U0001F577', 'spider-solitaire', 30),
-- Ludo
('ludo_10',      'Ludomaniaco',        'Venca 10 Ludo',                      E'\U0001F3B2', 'ludo',     30),
-- Domino
('domino_10',    'Dominador',          'Venca 10 Domino',                    E'\U0001F063', 'domino',   30),
-- Battleship
('battleship_10','Almirante',          'Venca 10 Batalha Naval',             E'\U0001F6A2', 'battleship', 30),
-- Stop
('stop_10',      'Stop Master',        'Complete 10 rodadas de Stop',        E'\u270B',     'stopgame', 30),
-- Sueca
('sueca_10',     'Suecao',             'Venca 10 Sueca',                     E'\U0001F0CF', 'sueca',    30),
-- Buraco
('buraco_10',    'Canastra',           'Venca 10 Buraco',                    E'\U0001F0CF', 'buraco',   30),
-- Cacheta
('cacheta_10',   'Cacheteiro',         'Venca 10 Cacheta',                   E'\U0001F0CF', 'cacheta',  30),
-- Pife
('pife_10',      'Pifeiro',            'Venca 10 Pife',                      E'\U0001F0CF', 'pife',     30),
-- Sinuca
('sinuca_10',    'Sinuqueiro',         'Venca 10 Sinuca',                    E'\U0001F3B1', 'sinuca',   30)

ON CONFLICT (id) DO NOTHING;
