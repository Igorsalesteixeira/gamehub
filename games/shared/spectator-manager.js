import { supabase } from '../../supabase.js';

class SpectatorManager {
  constructor() {
    this.channel = null;
    this.roomId = null;
    this.spectatorCount = 0;
    this.onGameUpdate = null;
    this.onSpectatorCount = null;
  }

  // Check if current URL has ?spectate= parameter
  isSpectateMode() {
    return new URLSearchParams(window.location.search).has('spectate');
  }

  getSpectateRoomId() {
    return new URLSearchParams(window.location.search).get('spectate');
  }

  // Join as spectator
  async joinAsSpectator(roomId) {
    this.roomId = roomId;

    // Fetch initial room state
    const { data: room } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (!room) throw new Error('Sala não encontrada');

    // Subscribe to room changes
    this.channel = supabase
      .channel(`spectate-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${roomId}`
      }, (payload) => {
        if (this.onGameUpdate) {
          this.onGameUpdate(payload.new);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = this.channel.presenceState();
        this.spectatorCount = Object.keys(state).length;
        if (this.onSpectatorCount) {
          this.onSpectatorCount(this.spectatorCount);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel.track({ role: 'spectator', joined: new Date().toISOString() });
        }
      });

    return room;
  }

  // Leave spectator mode
  async leave() {
    if (this.channel) {
      await this.channel.untrack();
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.roomId = null;
  }

  // Get list of active games that can be spectated
  async getActiveGames(limit = 10) {
    try {
      const cutoff = new Date(Date.now() - 60 * 60000).toISOString(); // últimas 1h
      const { data } = await supabase
        .from('game_rooms')
        .select('id, game, player1_name, player2_name, status, created_at')
        .eq('status', 'playing')
        .not('player2_id', 'is', null)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(limit);
      return data || [];
    } catch { return []; }
  }

  // Generate spectator URL for a room
  getSpectateUrl(gameType, roomId) {
    return `games/${gameType}/index.html?spectate=${roomId}`;
  }
}

export const spectatorManager = new SpectatorManager();
