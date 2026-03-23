/**
 * Game Integration — Hook central que conecta todos os sistemas
 *
 * COMO USAR em qualquer game.js:
 *   import { onGameEnd } from '../shared/game-integration.js';
 *   // Ao final da partida:
 *   onGameEnd('chess', { won: true, score: 0, time: 45000, multiplayer: false });
 */

import { coinManager } from './coin-manager.js';
import { streakManager } from './streak-manager.js';
import { achievementManager } from './achievement-manager.js';

/**
 * Chamado ao final de qualquer partida.
 * Dispara: moedas, streak check-in, achievements, sync cloud.
 *
 * @param {string} gameId - ID do jogo (ex: 'chess', 'tetris')
 * @param {Object} opts
 * @param {boolean} opts.won - Se o jogador venceu
 * @param {number} [opts.score] - Pontuação
 * @param {number} [opts.time] - Tempo em ms
 * @param {boolean} [opts.multiplayer=false] - Se foi partida multiplayer
 */
export function onGameEnd(gameId, { won = false, score, time, multiplayer = false } = {}) {
  try {
    // 1. Award coins
    coinManager.awardForGame(won, gameId);

    // 2. Streak check-in (once per day)
    const streakResult = streakManager.checkIn();
    if (streakResult.isNewDay && streakResult.streakBroken) {
      window.dispatchEvent(new CustomEvent('streak-broken', {
        detail: { previousStreak: streakResult.streakDay }
      }));
    }

    // 3. Check achievements
    const newAchievements = achievementManager.checkAchievements(gameId);

    // 4. Play celebration effect if equipped and won
    if (won) {
      import('./cosmetics-applier.js')
        .then(m => m.playCelebration())
        .catch(() => {});
    }

    // 5. Dispatch integration event for any UI that wants to react
    window.dispatchEvent(new CustomEvent('game-end', {
      detail: {
        gameId,
        won,
        score,
        time,
        multiplayer,
        coins: won ? 15 : 5,
        streak: streakResult,
        newAchievements
      }
    }));

    // 6. Async cloud sync (fire and forget)
    _syncAll();
  } catch (e) {
    console.warn('[GameIntegration] Error:', e);
  }
}

async function _syncAll() {
  try {
    await Promise.allSettled([
      coinManager.syncToCloud(),
      streakManager.syncToCloud()
    ]);
  } catch { /* ignore */ }
}
