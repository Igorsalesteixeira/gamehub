/**
 * Party Manager — Gerenciador de Modo Festa
 *
 * Gerencia salas de festa com mini-games multiplayer em tempo real.
 * Usa Supabase Realtime broadcast + presence (sem tabelas).
 *
 * @module party-manager
 */

import { supabase } from '../../supabase.js';

const MINI_GAMES = [
  { id: 'speed-math', name: 'Matematica Rapida', icon: '\u{1F522}', desc: 'Resolva contas o mais rapido possivel', duration: 30 },
  { id: 'reaction', name: 'Tempo de Reacao', icon: '\u26A1', desc: 'Clique quando a tela mudar de cor', duration: 20 },
  { id: 'memory-flash', name: 'Memoria Flash', icon: '\u{1F9E0}', desc: 'Memorize a sequencia de cores', duration: 30 },
  { id: 'word-scramble', name: 'Desembaralhar', icon: '\u{1F524}', desc: 'Descubra a palavra embaralhada', duration: 30 },
  { id: 'click-frenzy', name: 'Clique Frenetico', icon: '\u{1F446}', desc: 'Clique o maximo que puder em 10s', duration: 10 },
  { id: 'color-match', name: 'Cor Certa', icon: '\u{1F3A8}', desc: 'Acerte a cor da palavra, nao o texto', duration: 25 },
];

class PartyManager {
  constructor() {
    this.room = null;
    this.channel = null;
    this.players = [];
    this.scores = {};
    this.currentRound = 0;
    this.totalRounds = 5;
    this.isHost = false;
    this.playerName = null;
    this.onPlayersUpdate = null;
    this.onGameStart = null;
    this.onScoreUpdate = null;
    this.onRoundEnd = null;
    this.onPartyEnd = null;
  }

  /** Generate shareable room code (6 chars) */
  _generateCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /** Setup channel event listeners */
  _setupListeners() {
    this.channel.on('presence', { event: 'sync' }, () => {
      this._updatePlayers();
    });

    this.channel.on('broadcast', { event: 'game-start' }, ({ payload }) => {
      if (this.onGameStart) this.onGameStart(payload);
    });

    this.channel.on('broadcast', { event: 'score-update' }, ({ payload }) => {
      this.scores[payload.player] = (this.scores[payload.player] || 0) + payload.score;
      if (this.onScoreUpdate) this.onScoreUpdate(this.scores);
    });

    this.channel.on('broadcast', { event: 'round-end' }, ({ payload }) => {
      if (this.onRoundEnd) this.onRoundEnd(payload);
    });

    this.channel.on('broadcast', { event: 'party-end' }, ({ payload }) => {
      if (this.onPartyEnd) this.onPartyEnd(payload);
    });
  }

  /** Create party room */
  async createRoom(hostName) {
    const code = this._generateCode();
    this.isHost = true;
    this.playerName = hostName;

    this.channel = supabase.channel(`party-${code}`, {
      config: { presence: { key: hostName } }
    });

    this._setupListeners();

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({
          name: hostName,
          isHost: true,
          score: 0,
          joinedAt: Date.now()
        });
      }
    });

    this.room = { code, host: hostName };
    return { code };
  }

  /** Join existing party */
  async joinRoom(code, playerName) {
    this.isHost = false;
    this.playerName = playerName;

    this.channel = supabase.channel(`party-${code}`, {
      config: { presence: { key: playerName } }
    });

    this._setupListeners();

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({
          name: playerName,
          isHost: false,
          score: 0,
          joinedAt: Date.now()
        });
      }
    });

    this.room = { code, host: null };
    return true;
  }

  /** Update local players list from presence state */
  _updatePlayers() {
    const state = this.channel.presenceState();
    this.players = Object.values(state).flat().map(p => ({
      name: p.name,
      isHost: p.isHost,
      score: this.scores[p.name] || 0
    }));
    if (this.onPlayersUpdate) this.onPlayersUpdate(this.players);
  }

  /** Host starts next round */
  async startRound() {
    if (!this.isHost) return;
    this.currentRound++;

    // Pick a random mini-game, avoid repeating last one if possible
    const game = MINI_GAMES[Math.floor(Math.random() * MINI_GAMES.length)];

    await this.channel.send({
      type: 'broadcast',
      event: 'game-start',
      payload: { round: this.currentRound, game, totalRounds: this.totalRounds }
    });
  }

  /** Report score for current round */
  async reportScore(playerName, score) {
    await this.channel.send({
      type: 'broadcast',
      event: 'score-update',
      payload: { player: playerName, score, round: this.currentRound }
    });
  }

  /** Host ends current round */
  async endRound() {
    if (!this.isHost) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'round-end',
      payload: { round: this.currentRound, scores: { ...this.scores } }
    });

    if (this.currentRound >= this.totalRounds) {
      await this.channel.send({
        type: 'broadcast',
        event: 'party-end',
        payload: { scores: { ...this.scores } }
      });
    }
  }

  /** Leave party and cleanup */
  async leave() {
    if (this.channel) {
      await this.channel.untrack();
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.room = null;
    this.players = [];
    this.scores = {};
    this.currentRound = 0;
    this.isHost = false;
    this.playerName = null;
  }

  getShareUrl(code) {
    return `https://gameshub.com.br/festa.html?code=${code}`;
  }

  getShareText(code) {
    return `\u{1F389} Entra na minha festa no Games Hub!\n\nCodigo: ${code}\n\u{1F3AE} ${this.getShareUrl(code)}`;
  }
}

export const partyManager = new PartyManager();
export { MINI_GAMES };
