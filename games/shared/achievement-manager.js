/**
 * Sistema de Conquistas do Games Hub
 * Gerencia conquistas (achievements) com verificacao automatica
 *
 * @module achievement-manager
 */

import { coinManager } from './coin-manager.js';
import { showAchievementToast } from './achievement-toast.js';

const ACHIEVEMENTS = [
  // === GLOBAIS (20) ===
  { id: 'first_win', name: 'Primeira Vitoria', desc: 'Venca seu primeiro jogo', icon: '\u{1F3C6}', category: 'global', condition: (stats) => stats.totalWins >= 1, coins: 10 },
  { id: 'win_10', name: 'Vencedor', desc: 'Venca 10 jogos', icon: '\u2B50', category: 'global', condition: (stats) => stats.totalWins >= 10, coins: 25 },
  { id: 'win_50', name: 'Campeao', desc: 'Venca 50 jogos', icon: '\u{1F451}', category: 'global', condition: (stats) => stats.totalWins >= 50, coins: 50 },
  { id: 'win_100', name: 'Lenda', desc: 'Venca 100 jogos', icon: '\u{1F31F}', category: 'global', condition: (stats) => stats.totalWins >= 100, coins: 100 },
  { id: 'win_500', name: 'Imortal', desc: 'Venca 500 jogos', icon: '\u{1F48E}', category: 'global', condition: (stats) => stats.totalWins >= 500, coins: 500 },
  { id: 'play_5_games', name: 'Explorador', desc: 'Jogue 5 jogos diferentes', icon: '\u{1F5FA}\uFE0F', category: 'global', condition: (stats) => stats.uniqueGames >= 5, coins: 15 },
  { id: 'play_15_games', name: 'Aventureiro', desc: 'Jogue 15 jogos diferentes', icon: '\u{1F9ED}', category: 'global', condition: (stats) => stats.uniqueGames >= 15, coins: 50 },
  { id: 'play_all', name: 'Colecionador', desc: 'Jogue todos os 47 jogos', icon: '\u{1F3AF}', category: 'global', condition: (stats) => stats.uniqueGames >= 47, coins: 200 },
  { id: 'streak_3', name: 'Constante', desc: '3 dias seguidos jogando', icon: '\u{1F525}', category: 'global', condition: (stats) => stats.currentStreak >= 3, coins: 15 },
  { id: 'streak_7', name: 'Dedicado', desc: '7 dias seguidos jogando', icon: '\u{1F525}', category: 'global', condition: (stats) => stats.currentStreak >= 7, coins: 50 },
  { id: 'streak_30', name: 'Maratonista', desc: '30 dias seguidos jogando', icon: '\u{1F3C3}', category: 'global', condition: (stats) => stats.currentStreak >= 30, coins: 200 },
  { id: 'total_100', name: 'Jogador Casual', desc: 'Jogue 100 partidas no total', icon: '\u{1F3AE}', category: 'global', condition: (stats) => stats.totalPlayed >= 100, coins: 30 },
  { id: 'total_500', name: 'Jogador Hardcore', desc: 'Jogue 500 partidas no total', icon: '\u{1F4AA}', category: 'global', condition: (stats) => stats.totalPlayed >= 500, coins: 100 },
  { id: 'total_1000', name: 'Viciado', desc: 'Jogue 1000 partidas no total', icon: '\u{1F92F}', category: 'global', condition: (stats) => stats.totalPlayed >= 1000, coins: 250 },
  { id: 'night_owl', name: 'Coruja Noturna', desc: 'Jogue entre 2h e 5h da manha', icon: '\u{1F989}', category: 'global', condition: (stats) => stats.nightPlay, coins: 15 },
  { id: 'speed_demon', name: 'Relampago', desc: 'Venca um jogo em menos de 30s', icon: '\u26A1', category: 'global', condition: (stats) => stats.fastWin, coins: 20 },
  { id: 'perfect_week', name: 'Semana Perfeita', desc: 'Jogue todos os 7 dias da semana', icon: '\u{1F4C5}', category: 'global', condition: (stats) => stats.currentStreak >= 7, coins: 75 },
  { id: 'coin_100', name: 'Poupador', desc: 'Acumule 100 moedas', icon: '\u{1FA99}', category: 'global', condition: (stats) => stats.totalCoins >= 100, coins: 10 },
  { id: 'coin_1000', name: 'Rico', desc: 'Acumule 1000 moedas', icon: '\u{1F4B0}', category: 'global', condition: (stats) => stats.totalCoins >= 1000, coins: 50 },
  { id: 'coin_5000', name: 'Milionario', desc: 'Acumule 5000 moedas', icon: '\u{1F3E6}', category: 'global', condition: (stats) => stats.totalCoins >= 5000, coins: 100 },

  // === POR JOGO ===
  // Chess
  { id: 'chess_10', name: 'Enxadrista', desc: 'Venca 10 partidas de xadrez', icon: '\u265F\uFE0F', category: 'chess', gameId: 'chess', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'chess_50', name: 'Mestre do Xadrez', desc: 'Venca 50 partidas de xadrez', icon: '\u265A', category: 'chess', gameId: 'chess', condition: (s) => s.gamesWon >= 50, coins: 100 },
  // Solitaire
  { id: 'solitaire_10', name: 'Paciencia', desc: 'Venca 10 partidas de paciencia', icon: '\u{1F0CF}', category: 'solitaire', gameId: 'solitaire', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'solitaire_fast', name: 'Paciencia Relampago', desc: 'Venca paciencia em menos de 3min', icon: '\u26A1', category: 'solitaire', gameId: 'solitaire', condition: (s) => s.bestTime && s.bestTime < 180000, coins: 50 },
  // Termo
  { id: 'termo_10', name: 'Vocabulario', desc: 'Venca 10 partidas de Termo', icon: '\u{1F4DD}', category: 'termo', gameId: 'termo', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'termo_streak', name: 'Genio das Palavras', desc: 'Acerte Termo na primeira tentativa', icon: '\u{1F9E0}', category: 'termo', gameId: 'termo', condition: (s) => s.highScore >= 6, coins: 75 },
  // Sudoku
  { id: 'sudoku_10', name: 'Logico', desc: 'Resolva 10 Sudokus', icon: '\u{1F522}', category: 'sudoku', gameId: 'sudoku', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Tetris
  { id: 'tetris_1000', name: 'Tetris Master', desc: 'Faca 1000+ pontos no Tetris', icon: '\u{1F9F1}', category: 'tetris', gameId: 'tetris', condition: (s) => s.highScore >= 1000, coins: 30 },
  { id: 'tetris_5000', name: 'Tetris God', desc: 'Faca 5000+ pontos no Tetris', icon: '\u{1F47E}', category: 'tetris', gameId: 'tetris', condition: (s) => s.highScore >= 5000, coins: 100 },
  // Snake
  { id: 'snake_50', name: 'Cobra Faminta', desc: 'Marque 50+ pontos na Cobra', icon: '\u{1F40D}', category: 'snake', gameId: 'snake', condition: (s) => s.highScore >= 50, coins: 30 },
  // Minesweeper
  { id: 'mines_10', name: 'Desminador', desc: 'Venca 10 Campo Minado', icon: '\u{1F4A3}', category: 'minesweeper', gameId: 'minesweeper', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Memory
  { id: 'memory_10', name: 'Memoria de Elefante', desc: 'Venca 10 jogos de Memoria', icon: '\u{1F9E0}', category: 'memory', gameId: 'memory', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Checkers
  { id: 'checkers_10', name: 'Estrategista', desc: 'Venca 10 partidas de Damas', icon: '\u2B1B', category: 'checkers', gameId: 'checkers', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Connect4
  { id: 'connect4_10', name: 'Conectado', desc: 'Venca 10 Lig 4', icon: '\u{1F534}', category: 'connect4', gameId: 'connect4', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Puzzle15
  { id: 'puzzle15_10', name: 'Quebra-Cabeca', desc: 'Resolva 10 Puzzle 15', icon: '\u{1F9E9}', category: 'puzzle15', gameId: 'puzzle15', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // 2048
  { id: '2048_2048', name: '2048!', desc: 'Alcance o tile 2048', icon: '\u{1F3AF}', category: 'game2048', gameId: 'game2048', condition: (s) => s.highScore >= 2048, coins: 50 },
  // Flappy
  { id: 'flappy_10', name: 'Passarinho', desc: 'Marque 10+ no Flappy Bird', icon: '\u{1F426}', category: 'flappybird', gameId: 'flappybird', condition: (s) => s.highScore >= 10, coins: 30 },
  { id: 'flappy_50', name: 'Aguia', desc: 'Marque 50+ no Flappy Bird', icon: '\u{1F985}', category: 'flappybird', gameId: 'flappybird', condition: (s) => s.highScore >= 50, coins: 100 },
  // Breakout
  { id: 'breakout_10', name: 'Destruidor', desc: 'Venca 10 Breakout', icon: '\u{1F9F1}', category: 'breakout', gameId: 'breakout', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Pong
  { id: 'pong_10', name: 'Classico', desc: 'Venca 10 Pong', icon: '\u{1F3D3}', category: 'pong', gameId: 'pong', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Hangman
  { id: 'hangman_10', name: 'Salva-vidas', desc: 'Venca 10 Forca', icon: '\u{1FAA2}', category: 'hangman', gameId: 'hangman', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Reversi
  { id: 'reversi_10', name: 'Reversor', desc: 'Venca 10 Reversi', icon: '\u26AB', category: 'reversi', gameId: 'reversi', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Mahjong
  { id: 'mahjong_10', name: 'Zen', desc: 'Venca 10 Mahjong', icon: '\u{1F004}', category: 'mahjong', gameId: 'mahjong', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Go
  { id: 'go_10', name: 'Mestre Go', desc: 'Venca 10 partidas de Go', icon: '\u26AA', category: 'go', gameId: 'go', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // WordSearch
  { id: 'wordsearch_10', name: 'Cacador de Palavras', desc: 'Resolva 10 Caca-Palavras', icon: '\u{1F50D}', category: 'wordsearch', gameId: 'wordsearch', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // SpaceInvaders
  { id: 'space_1000', name: 'Defensor Espacial', desc: 'Faca 1000+ pontos no Space Invaders', icon: '\u{1F47E}', category: 'spaceinvaders', gameId: 'spaceinvaders', condition: (s) => s.highScore >= 1000, coins: 30 },
  // Pac-Man
  { id: 'pacman_1000', name: 'Pac-Master', desc: 'Faca 1000+ pontos no Pac-Man', icon: '\u{1F7E1}', category: 'pacman', gameId: 'pacman', condition: (s) => s.highScore >= 1000, coins: 30 },
  // DinoRunner
  { id: 'dino_500', name: 'Corredor Pre-Historico', desc: 'Marque 500+ no Dino Runner', icon: '\u{1F995}', category: 'dinorunner', gameId: 'dinorunner', condition: (s) => s.highScore >= 500, coins: 30 },
  // Cookie Clicker
  { id: 'cookie_1000', name: 'Padeiro', desc: 'Clique 1000 cookies', icon: '\u{1F36A}', category: 'cookieclicker', gameId: 'cookieclicker', condition: (s) => s.highScore >= 1000, coins: 30 },
  // Nonogram
  { id: 'nonogram_10', name: 'Artista Logico', desc: 'Resolva 10 Nonogramas', icon: '\u{1F3A8}', category: 'nonogram', gameId: 'nonogram', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Numble
  { id: 'numble_10', name: 'Matematico', desc: 'Resolva 10 Numbles', icon: '\u{1F522}', category: 'numble', gameId: 'numble', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Anagram
  { id: 'anagram_10', name: 'Embaralhado', desc: 'Resolva 10 Anagramas', icon: '\u{1F524}', category: 'anagram', gameId: 'anagram', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // LightsOut
  { id: 'lightsout_10', name: 'Apagador', desc: 'Resolva 10 Lights Out', icon: '\u{1F4A1}', category: 'lightsout', gameId: 'lightsout', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Sokoban
  { id: 'sokoban_10', name: 'Empurrador', desc: 'Resolva 10 Sokoban', icon: '\u{1F4E6}', category: 'sokoban', gameId: 'sokoban', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Bubble Shooter
  { id: 'bubble_10', name: 'Atirador de Bolhas', desc: 'Venca 10 Bubble Shooter', icon: '\u{1FAE7}', category: 'bubble-shooter', gameId: 'bubble-shooter', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Card games
  { id: 'truco_10', name: 'Trucao', desc: 'Venca 10 partidas de Truco', icon: '\u{1F0CF}', category: 'truco', gameId: 'truco', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'uno_10', name: 'UNO!', desc: 'Venca 10 partidas de UNO', icon: '\u{1F3B4}', category: 'uno', gameId: 'uno', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'blackjack_10', name: 'Cassino', desc: 'Venca 10 Blackjack', icon: '\u{1F0A1}', category: 'blackjack', gameId: 'blackjack', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'poker_10', name: 'Blefador', desc: 'Venca 10 partidas de Poker', icon: '\u2660\uFE0F', category: 'poker', gameId: 'poker', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'freecell_10', name: 'Livre', desc: 'Venca 10 FreeCell', icon: '\u{1F0CF}', category: 'freecell', gameId: 'freecell', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'pyramid_10', name: 'Farao', desc: 'Venca 10 Pyramid', icon: '\u{1F3DB}\uFE0F', category: 'pyramid', gameId: 'pyramid', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'spider_10', name: 'Aranha', desc: 'Venca 10 Spider Solitaire', icon: '\u{1F577}\uFE0F', category: 'spider-solitaire', gameId: 'spider-solitaire', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Board games
  { id: 'ludo_10', name: 'Ludomaniaco', desc: 'Venca 10 Ludo', icon: '\u{1F3B2}', category: 'ludo', gameId: 'ludo', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'domino_10', name: 'Dominador', desc: 'Venca 10 Domino', icon: '\u{1F063}', category: 'domino', gameId: 'domino', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'battleship_10', name: 'Almirante', desc: 'Venca 10 Batalha Naval', icon: '\u{1F6A2}', category: 'battleship', gameId: 'battleship', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Stopgame
  { id: 'stop_10', name: 'Stop Master', desc: 'Complete 10 rodadas de Stop', icon: '\u270B', category: 'stopgame', gameId: 'stopgame', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Sueca, Buraco, Cacheta, Pife
  { id: 'sueca_10', name: 'Suecao', desc: 'Venca 10 Sueca', icon: '\u{1F0CF}', category: 'sueca', gameId: 'sueca', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'buraco_10', name: 'Canastra', desc: 'Venca 10 Buraco', icon: '\u{1F0CF}', category: 'buraco', gameId: 'buraco', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'cacheta_10', name: 'Cacheteiro', desc: 'Venca 10 Cacheta', icon: '\u{1F0CF}', category: 'cacheta', gameId: 'cacheta', condition: (s) => s.gamesWon >= 10, coins: 30 },
  { id: 'pife_10', name: 'Pifeiro', desc: 'Venca 10 Pife', icon: '\u{1F0CF}', category: 'pife', gameId: 'pife', condition: (s) => s.gamesWon >= 10, coins: 30 },
  // Sinuca
  { id: 'sinuca_10', name: 'Sinuqueiro', desc: 'Venca 10 Sinuca', icon: '\u{1F3B1}', category: 'sinuca', gameId: 'sinuca', condition: (s) => s.gamesWon >= 10, coins: 30 },
];

/**
 * Gerenciador de conquistas do Games Hub.
 * Verifica condicoes baseadas em stats agregadas do localStorage.
 */
class AchievementManager {
  constructor() {
    this._unlocked = this._loadUnlocked();
  }

  /**
   * Carrega IDs de conquistas desbloqueadas do localStorage.
   * @private
   * @returns {Set<string>}
   */
  _loadUnlocked() {
    try {
      const saved = localStorage.getItem('gamehub_achievements');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  }

  /**
   * Salva conquistas desbloqueadas no localStorage.
   * @private
   */
  _saveUnlocked() {
    try {
      localStorage.setItem('gamehub_achievements', JSON.stringify([...this._unlocked]));
    } catch (e) {
      console.warn('[AchievementManager] Erro ao salvar:', e);
    }
  }

  /**
   * Coleta stats agregadas de todos os jogos no localStorage.
   * @private
   * @returns {Object} Stats globais agregadas
   */
  _collectGlobalStats() {
    let totalWins = 0;
    let totalPlayed = 0;
    let uniqueGames = 0;
    let fastWin = false;

    // Scan all gamehub_stats_* keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('gamehub_stats_')) continue;

      try {
        const stats = JSON.parse(localStorage.getItem(key));
        if (!stats) continue;

        const played = stats.gamesPlayed || 0;
        const won = stats.gamesWon || 0;

        if (played > 0) uniqueGames++;
        totalPlayed += played;
        totalWins += won;

        // Check for fast win (bestTime < 30000ms and has won at least once)
        if (won > 0 && stats.bestTime && stats.bestTime < 30000) {
          fastWin = true;
        }
      } catch {
        // Skip invalid entries
      }
    }

    // Streak data
    let currentStreak = 0;
    try {
      const streakData = JSON.parse(localStorage.getItem('gamehub_streak') || '{}');
      currentStreak = streakData.currentStreak || 0;
    } catch { /* ignore */ }

    // Coin data
    let totalCoins = 0;
    try {
      totalCoins = parseInt(localStorage.getItem('gamehub_coins') || '0', 10);
    } catch { /* ignore */ }

    // Night play check (current hour between 2 and 5)
    const hour = new Date().getHours();
    const nightPlay = hour >= 2 && hour < 5;

    return {
      totalWins,
      totalPlayed,
      uniqueGames,
      currentStreak,
      totalCoins,
      nightPlay,
      fastWin
    };
  }

  /**
   * Coleta stats de um jogo especifico.
   * @private
   * @param {string} gameId
   * @returns {Object} Stats do jogo
   */
  _collectGameStats(gameId) {
    try {
      const key = `gamehub_stats_${gameId}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : { gamesPlayed: 0, gamesWon: 0, highScore: 0, bestTime: null };
    } catch {
      return { gamesPlayed: 0, gamesWon: 0, highScore: 0, bestTime: null };
    }
  }

  /**
   * Verifica todas as conquistas e desbloqueia as que atendem as condicoes.
   * @param {string} [gameId] - Se fornecido, prioriza checagem deste jogo
   * @returns {Array} Lista de conquistas recém desbloqueadas
   */
  checkAchievements(gameId) {
    const globalStats = this._collectGlobalStats();
    const newlyUnlocked = [];

    for (const achievement of ACHIEVEMENTS) {
      // Skip if already unlocked
      if (this._unlocked.has(achievement.id)) continue;

      try {
        let conditionMet = false;

        if (achievement.gameId) {
          // Per-game achievement: check with game-specific stats
          const gameStats = this._collectGameStats(achievement.gameId);
          conditionMet = achievement.condition(gameStats);
        } else {
          // Global achievement: check with aggregate stats
          conditionMet = achievement.condition(globalStats);
        }

        if (conditionMet) {
          this.unlock(achievement);
          newlyUnlocked.push(achievement);
        }
      } catch (e) {
        console.warn(`[AchievementManager] Erro ao verificar ${achievement.id}:`, e);
      }
    }

    return newlyUnlocked;
  }

  /**
   * Desbloqueia uma conquista.
   * @param {Object} achievement - Objeto da conquista
   */
  unlock(achievement) {
    if (this._unlocked.has(achievement.id)) return;

    this._unlocked.add(achievement.id);
    this._saveUnlocked();

    // Award coins
    if (achievement.coins > 0) {
      coinManager.award(achievement.coins, 'achievement', { animate: true });
    }

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('achievement-unlocked', {
      detail: { achievement }
    }));

    // Show achievement toast
    try {
      showAchievementToast(achievement);
    } catch {
      // Fallback to regular toast
      if (window.showToast) {
        window.showToast(`${achievement.icon} ${achievement.name} desbloqueado! +${achievement.coins} moedas`, 'success');
      }
    }

    // Sync to cloud
    this._syncToCloud(achievement.id);
  }

  /**
   * Sincroniza conquista com Supabase.
   * @private
   * @param {string} achievementId
   */
  async _syncToCloud(achievementId) {
    try {
      const { supabase } = await import('../../supabase.js');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('user_achievements').upsert({
        user_id: user.id,
        achievement_id: achievementId,
        unlocked_at: new Date().toISOString()
      }, { onConflict: 'user_id,achievement_id' });
    } catch (e) {
      console.warn('[AchievementManager] Sync failed:', e);
    }
  }

  /**
   * Retorna array de IDs de conquistas desbloqueadas.
   * @returns {string[]}
   */
  getUnlocked() {
    return [...this._unlocked];
  }

  /**
   * Verifica se uma conquista esta desbloqueada.
   * @param {string} id
   * @returns {boolean}
   */
  isUnlocked(id) {
    return this._unlocked.has(id);
  }

  /**
   * Retorna todas as conquistas com campo `unlocked` adicionado.
   * @returns {Object[]}
   */
  getAll() {
    return ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: this._unlocked.has(a.id)
    }));
  }

  /**
   * Retorna progresso geral das conquistas.
   * @returns {{ unlocked: number, total: number, percentage: number }}
   */
  getProgress() {
    const total = ACHIEVEMENTS.length;
    const unlocked = this._unlocked.size;
    const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;
    return { unlocked, total, percentage };
  }
}

// Singleton
export const achievementManager = new AchievementManager();
export { ACHIEVEMENTS };
