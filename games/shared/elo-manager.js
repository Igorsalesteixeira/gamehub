/**
 * ELO Rating Manager — Game Hub
 * Gerencia ratings ELO por jogo com persistência local + cloud (Supabase).
 * Export: eloManager (singleton), DIVISIONS, DEFAULT_RATING
 */

const DIVISIONS = [
  { name: 'Bronze', icon: '\u{1F949}', min: 0, max: 999, color: '#cd7f32' },
  { name: 'Prata', icon: '\u{1F948}', min: 1000, max: 1199, color: '#c0c0c0' },
  { name: 'Ouro', icon: '\u{1F947}', min: 1200, max: 1399, color: '#ffd700' },
  { name: 'Diamante', icon: '\u{1F48E}', min: 1400, max: 1599, color: '#b9f2ff' },
  { name: 'Mestre', icon: '\u{1F451}', min: 1600, max: Infinity, color: '#ff6b35' },
];

const DEFAULT_RATING = 1200;
const K_FACTOR = 32;

class EloManager {
  constructor() {
    this.ratings = this._loadLocal();
  }

  _loadLocal() {
    try {
      return JSON.parse(localStorage.getItem('gamehub_elo_ratings') || '{}');
    } catch { return {}; }
  }

  _saveLocal() {
    localStorage.setItem('gamehub_elo_ratings', JSON.stringify(this.ratings));
  }

  // Get rating for a specific game
  getRating(gameId) {
    return this.ratings[gameId] || DEFAULT_RATING;
  }

  // Get division info for a rating
  getDivision(rating) {
    return DIVISIONS.find(d => rating >= d.min && rating <= d.max) || DIVISIONS[0];
  }

  // Get all ratings
  getAllRatings() {
    return { ...this.ratings };
  }

  // Calculate expected score
  _expectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  // Calculate new ratings after a match
  calculateMatch(gameId, myRating, opponentRating, result) {
    // result: 1 = win, 0.5 = draw, 0 = loss
    const expected = this._expectedScore(myRating, opponentRating);
    const newRating = Math.round(myRating + K_FACTOR * (result - expected));
    return Math.max(0, newRating); // Never go below 0
  }

  // Record a match result
  recordMatch(gameId, opponentRating, result) {
    const myRating = this.getRating(gameId);
    const newRating = this.calculateMatch(gameId, myRating, opponentRating, result);
    const oldDivision = this.getDivision(myRating);
    const newDivision = this.getDivision(newRating);
    const change = newRating - myRating;

    this.ratings[gameId] = newRating;
    this._saveLocal();

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('elo-changed', {
      detail: { gameId, oldRating: myRating, newRating, change, oldDivision, newDivision }
    }));

    // Sync to cloud
    this._syncToCloud(gameId, newRating);

    return {
      oldRating: myRating,
      newRating,
      change,
      oldDivision,
      newDivision,
      promoted: newDivision.name !== oldDivision.name && change > 0
    };
  }

  async _syncToCloud(gameId, rating) {
    try {
      const { supabase } = await import('../../supabase.js');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from('player_ratings')
        .upsert({
          user_id: session.user.id,
          game_id: gameId,
          rating: rating,
          division: this.getDivision(rating).name,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,game_id' });
    } catch (e) {
      console.error('[ELO] Sync failed:', e);
    }
  }

  async loadFromCloud() {
    try {
      const { supabase } = await import('../../supabase.js');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('player_ratings')
        .select('game_id, rating')
        .eq('user_id', session.user.id);

      if (data && data.length) {
        data.forEach(r => { this.ratings[r.game_id] = r.rating; });
        this._saveLocal();
      }
    } catch (e) {
      console.error('[ELO] Load failed:', e);
    }
  }

  // Get top players for a game (leaderboard)
  async getLeaderboard(gameId, limit = 20) {
    try {
      const { supabase } = await import('../../supabase.js');
      const { data } = await supabase
        .from('player_ratings')
        .select('user_id, rating, division, profiles(display_name)')
        .eq('game_id', gameId)
        .order('rating', { ascending: false })
        .limit(limit);
      return data || [];
    } catch { return []; }
  }

  // Find opponent within rating range for matchmaking
  async findOpponent(gameId, range = 200) {
    try {
      const { supabase } = await import('../../supabase.js');
      const myRating = this.getRating(gameId);
      const { data } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('game_type', gameId)
        .eq('status', 'waiting')
        .is('player2_id', null)
        .limit(10);

      if (!data || !data.length) return null;

      // Filter by rating range (need to cross-reference player_ratings)
      // For simplicity, return first available room
      return data[0];
    } catch { return null; }
  }
}

export const eloManager = new EloManager();
export { DIVISIONS, DEFAULT_RATING };
