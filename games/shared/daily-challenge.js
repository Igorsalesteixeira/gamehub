/**
 * Sistema de Desafio Diário do Games Hub
 * Gera um desafio por dia usando seed determinístico
 */

// Game rotation: Monday=Termo, Tuesday=Sudoku, Wednesday=Nonogram,
// Thursday=WordSearch, Friday=Numble, Saturday=Puzzle15, Sunday=Minesweeper
const DAILY_GAMES = [
  { day: 1, gameId: 'termo', name: 'Termo', icon: '\u{1F4DD}', path: 'games/termo/index.html' },
  { day: 2, gameId: 'sudoku', name: 'Sudoku', icon: '\u{1F522}', path: 'games/sudoku/index.html' },
  { day: 3, gameId: 'nonogram', name: 'Nonogram', icon: '\u{1F9E9}', path: 'games/nonogram/index.html' },
  { day: 4, gameId: 'wordsearch', name: 'Ca\u00E7a-Palavras', icon: '\u{1F50D}', path: 'games/wordsearch/index.html' },
  { day: 5, gameId: 'numble', name: 'Numble', icon: '\u{1F522}', path: 'games/numble/index.html' },
  { day: 6, gameId: 'puzzle15', name: 'Puzzle 15', icon: '\u{1F9E9}', path: 'games/puzzle15/index.html' },
  { day: 0, gameId: 'minesweeper', name: 'Campo Minado', icon: '\u{1F4A3}', path: 'games/minesweeper/index.html' },
];

class DailyChallenge {
  constructor() {
    this.today = this._getTodayBRT();
    this.todayGame = this._getTodaysGame();
    this.results = this._loadResults();
  }

  _getTodayBRT() {
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return brt.toISOString().slice(0, 10);
  }

  _getTodaysGame() {
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const dayOfWeek = brt.getDay(); // 0=Sunday
    return DAILY_GAMES.find(g => g.day === dayOfWeek) || DAILY_GAMES[0];
  }

  /**
   * Generate a deterministic seed from today's date
   * All players get the same seed = same puzzle
   */
  getSeed() {
    const dateStr = this.today;
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      const char = dateStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Seeded random number generator (mulberry32)
   */
  createRNG(seed) {
    let s = seed;
    return function() {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  _loadResults() {
    try {
      return JSON.parse(localStorage.getItem('gamehub_daily_results') || '{}');
    } catch {
      return {};
    }
  }

  _saveResults() {
    localStorage.setItem('gamehub_daily_results', JSON.stringify(this.results));
  }

  /**
   * Check if today's challenge has been completed
   */
  isCompletedToday() {
    return !!this.results[this.today];
  }

  /**
   * Record today's challenge result
   */
  recordResult(data) {
    if (this.isCompletedToday()) return false;

    this.results[this.today] = {
      gameId: this.todayGame.gameId,
      ...data,
      completedAt: new Date().toISOString()
    };

    // Keep only last 30 days of results
    const keys = Object.keys(this.results).sort();
    if (keys.length > 30) {
      keys.slice(0, keys.length - 30).forEach(k => delete this.results[k]);
    }

    this._saveResults();
    return true;
  }

  /**
   * Get today's challenge info
   */
  getTodayInfo() {
    return {
      date: this.today,
      game: this.todayGame,
      seed: this.getSeed(),
      completed: this.isCompletedToday(),
      result: this.results[this.today] || null
    };
  }

  /**
   * Get streak of consecutive daily challenges completed
   */
  getChallengeStreak() {
    let streak = 0;
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    for (let i = 0; i < 365; i++) {
      const date = new Date(brt.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().slice(0, 10);
      if (this.results[dateStr]) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  }

  /**
   * Generate share text (Wordle-style)
   */
  generateShareText(result) {
    const dayNumber = Math.floor((new Date(this.today) - new Date('2024-01-01')) / 86400000);
    const game = this.todayGame;

    let text = `\u{1F3C6} Desafio Di\u00E1rio #${dayNumber}\n`;
    text += `${game.icon} ${game.name}\n`;

    if (result.won) {
      if (result.attempts) text += `\u2705 ${result.attempts} tentativa${result.attempts > 1 ? 's' : ''}\n`;
      if (result.time) text += `\u23F1\uFE0F ${this._formatTime(result.time)}\n`;
      if (result.score) text += `\u{1F3AF} ${result.score} pontos\n`;
    } else {
      text += '\u274C N\u00E3o consegui hoje\n';
    }

    text += `\n\u{1F3AE} gameshub.com.br/desafio-diario.html`;
    return text;
  }

  _formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }
}

export const dailyChallenge = new DailyChallenge();
export { DAILY_GAMES };
