/**
 * Tournament Manager — Gerencia torneios eliminatórios para o Games Hub
 * @module tournament-manager
 */
import { supabase } from '../../supabase.js';

const TOURNAMENT_SIZES = [8, 16, 32];
const TOURNAMENT_STATUS = {
  REGISTRATION: 'registration',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

class TournamentManager {
  constructor() {
    this.currentTournament = null;
    this.channel = null;
  }

  // Create a new tournament
  async createTournament({ gameId, name, size = 8, registrationMinutes = 30 }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Login necessário');

    const registrationEnd = new Date(Date.now() + registrationMinutes * 60000).toISOString();

    const { data, error } = await supabase
      .from('tournaments')
      .insert({
        game_id: gameId,
        name: name || `Torneio de ${gameId}`,
        created_by: session.user.id,
        max_players: size,
        status: TOURNAMENT_STATUS.REGISTRATION,
        registration_end: registrationEnd,
        rounds_total: Math.log2(size),
        current_round: 0,
        prize_coins: size * 50
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Join a tournament
  async joinTournament(tournamentId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Login necessário');

    // Check if already joined
    const { data: existing } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', session.user.id)
      .single();

    if (existing) throw new Error('Já inscrito');

    // Check participant count
    const { count } = await supabase
      .from('tournament_participants')
      .select('id', { count: 'exact' })
      .eq('tournament_id', tournamentId);

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('max_players, status')
      .eq('id', tournamentId)
      .single();

    if (!tournament || tournament.status !== TOURNAMENT_STATUS.REGISTRATION) {
      throw new Error('Inscrições encerradas');
    }
    if (count >= tournament.max_players) {
      throw new Error('Torneio lotado');
    }

    const { data, error } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournamentId,
        user_id: session.user.id,
        seed: count + 1
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // List open tournaments
  async listTournaments(gameId = null) {
    let query = supabase
      .from('tournaments')
      .select('*, tournament_participants(count)')
      .in('status', [TOURNAMENT_STATUS.REGISTRATION, TOURNAMENT_STATUS.IN_PROGRESS])
      .order('created_at', { ascending: false })
      .limit(20);

    if (gameId) query = query.eq('game_id', gameId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Get tournament details with bracket
  async getTournament(tournamentId) {
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('*, profiles(display_name)')
      .eq('tournament_id', tournamentId)
      .order('seed');

    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round')
      .order('match_number');

    return { tournament, participants: participants || [], matches: matches || [] };
  }

  // Generate bracket (called when registration closes)
  async generateBracket(tournamentId) {
    const { participants } = await this.getTournament(tournamentId);

    // Shuffle participants for random seeding
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const totalRounds = Math.log2(shuffled.length);

    // Create first round matches
    const matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      matches.push({
        tournament_id: tournamentId,
        round: 1,
        match_number: Math.floor(i / 2) + 1,
        player1_id: shuffled[i]?.user_id || null,
        player2_id: shuffled[i + 1]?.user_id || null,
        player1_name: shuffled[i]?.profiles?.display_name || 'TBD',
        player2_name: shuffled[i + 1]?.profiles?.display_name || 'TBD',
        status: 'pending'
      });
    }

    // Create placeholder matches for subsequent rounds
    let matchesInRound = matches.length / 2;
    for (let round = 2; round <= totalRounds; round++) {
      for (let m = 0; m < matchesInRound; m++) {
        matches.push({
          tournament_id: tournamentId,
          round,
          match_number: m + 1,
          status: 'pending'
        });
      }
      matchesInRound = matchesInRound / 2;
    }

    const { error } = await supabase.from('tournament_matches').insert(matches);
    if (error) throw error;

    // Update tournament status
    await supabase
      .from('tournaments')
      .update({ status: TOURNAMENT_STATUS.IN_PROGRESS, current_round: 1 })
      .eq('id', tournamentId);
  }

  // Record match result
  async recordMatchResult(tournamentId, matchId, winnerId) {
    // Update match
    await supabase
      .from('tournament_matches')
      .update({ winner_id: winnerId, status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', matchId);

    // Check if round is complete, advance winner to next match
    const { matches } = await this.getTournament(tournamentId);
    const currentMatch = matches.find(m => m.id === matchId);
    if (!currentMatch) return;

    const roundMatches = matches.filter(m => m.round === currentMatch.round);
    const allComplete = roundMatches.every(m => m.status === 'completed');

    if (allComplete) {
      const nextRound = currentMatch.round + 1;
      const nextRoundMatches = matches.filter(m => m.round === nextRound);

      if (nextRoundMatches.length === 0) {
        // Tournament complete
        await supabase
          .from('tournaments')
          .update({ status: TOURNAMENT_STATUS.COMPLETED, winner_id: winnerId })
          .eq('id', tournamentId);
        return;
      }

      // Advance winners to next round
      const winners = roundMatches.map(m => ({
        id: m.winner_id,
        name: m.winner_id === m.player1_id ? m.player1_name : m.player2_name
      }));

      for (let i = 0; i < nextRoundMatches.length; i++) {
        await supabase
          .from('tournament_matches')
          .update({
            player1_id: winners[i * 2]?.id,
            player1_name: winners[i * 2]?.name || 'TBD',
            player2_id: winners[i * 2 + 1]?.id,
            player2_name: winners[i * 2 + 1]?.name || 'TBD',
            status: 'pending'
          })
          .eq('id', nextRoundMatches[i].id);
      }

      await supabase
        .from('tournaments')
        .update({ current_round: nextRound })
        .eq('id', tournamentId);
    }
  }

  // Subscribe to tournament updates (Realtime)
  subscribeTournament(tournamentId, onUpdate) {
    this.unsubscribe();
    this.channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, (payload) => {
        if (onUpdate) onUpdate(payload);
      })
      .subscribe();
  }

  unsubscribe() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

export const tournamentManager = new TournamentManager();
export { TOURNAMENT_SIZES, TOURNAMENT_STATUS };
