// =============================================
//  Puzzle Editor — módulo UGC para criar e compartilhar puzzles
// =============================================
import { supabase } from '../../supabase.js';

class PuzzleEditor {
  constructor() {}

  // Save a user-created puzzle
  async savePuzzle({ gameType, title, data, difficulty }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Login necessário');

    const shareCode = this._generateCode();

    const { data: puzzle, error } = await supabase
      .from('user_puzzles')
      .insert({
        game_type: gameType,
        creator_id: session.user.id,
        title,
        puzzle_data: data,
        difficulty: difficulty || 'medio',
        share_code: shareCode,
        plays: 0,
        rating_sum: 0,
        rating_count: 0
      })
      .select()
      .single();

    if (error) throw error;
    return { ...puzzle, shareUrl: this.getShareUrl(gameType, shareCode) };
  }

  // Load a puzzle by share code
  async loadPuzzle(shareCode) {
    const { data, error } = await supabase
      .from('user_puzzles')
      .select('*, profiles(display_name)')
      .eq('share_code', shareCode)
      .single();

    if (error || !data) throw new Error('Puzzle não encontrado');

    // Increment plays
    await supabase
      .from('user_puzzles')
      .update({ plays: data.plays + 1 })
      .eq('id', data.id);

    return data;
  }

  // Rate a puzzle (1-5)
  async ratePuzzle(puzzleId, rating) {
    const { data: puzzle } = await supabase
      .from('user_puzzles')
      .select('rating_sum, rating_count')
      .eq('id', puzzleId)
      .single();

    if (!puzzle) return;

    await supabase
      .from('user_puzzles')
      .update({
        rating_sum: puzzle.rating_sum + rating,
        rating_count: puzzle.rating_count + 1
      })
      .eq('id', puzzleId);
  }

  // List featured/popular puzzles
  async listPuzzles(gameType, sort = 'popular', limit = 20) {
    let query = supabase
      .from('user_puzzles')
      .select('*, profiles(display_name)')
      .eq('game_type', gameType);

    if (sort === 'popular') {
      query = query.order('plays', { ascending: false });
    } else if (sort === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'rated') {
      query = query.order('rating_count', { ascending: false });
    }

    const { data } = await query.limit(limit);
    return data || [];
  }

  // List own puzzles
  async myPuzzles() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data } = await supabase
      .from('user_puzzles')
      .select('*')
      .eq('creator_id', session.user.id)
      .order('created_at', { ascending: false });

    return data || [];
  }

  getShareUrl(gameType, shareCode) {
    return `https://gameshub.com.br/games/${gameType}/index.html?puzzle=${shareCode}`;
  }

  _generateCode() {
    return Math.random().toString(36).substring(2, 10);
  }
}

export const puzzleEditor = new PuzzleEditor();
