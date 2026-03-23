/**
 * Sistema de Streaks do Games Hub
 * Rastreia dias consecutivos jogando e dá recompensas
 */

import { coinManager, COIN_REWARDS } from './coin-manager.js';

const STREAK_REWARDS = {
  1: 10,    // Day 1
  3: 25,    // Day 3
  7: 100,   // Day 7
  14: 200,  // Day 14
  30: 500,  // Day 30
  60: 1000, // Day 60
  100: 2000 // Day 100
};

class StreakManager {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const saved = localStorage.getItem('gamehub_streak');
      return saved ? JSON.parse(saved) : {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        history: [], // Array of date strings 'YYYY-MM-DD'
        totalDaysPlayed: 0
      };
    } catch {
      return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, history: [], totalDaysPlayed: 0 };
    }
  }

  _save() {
    localStorage.setItem('gamehub_streak', JSON.stringify(this.data));
  }

  _todayStr() {
    // Use BRT (UTC-3)
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return brt.toISOString().slice(0, 10);
  }

  _yesterdayStr() {
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000);
    return brt.toISOString().slice(0, 10);
  }

  /**
   * Check in for today. Call this when user plays any game.
   * Returns { streakDay, reward, isNewDay, streakBroken }
   */
  checkIn() {
    const today = this._todayStr();
    const yesterday = this._yesterdayStr();
    const lastDate = this.data.lastActiveDate;

    // Already checked in today
    if (lastDate === today) {
      return {
        streakDay: this.data.currentStreak,
        reward: 0,
        isNewDay: false,
        streakBroken: false
      };
    }

    let streakBroken = false;
    let reward = 0;

    if (lastDate === yesterday) {
      // Continue streak
      this.data.currentStreak += 1;
    } else if (lastDate === null) {
      // First time ever
      this.data.currentStreak = 1;
    } else {
      // Streak broken!
      streakBroken = this.data.currentStreak > 0;
      this.data.currentStreak = 1;
    }

    this.data.lastActiveDate = today;
    this.data.totalDaysPlayed += 1;

    // Add to history (keep last 90 days)
    if (!this.data.history.includes(today)) {
      this.data.history.push(today);
      if (this.data.history.length > 90) {
        this.data.history = this.data.history.slice(-90);
      }
    }

    // Update longest
    if (this.data.currentStreak > this.data.longestStreak) {
      this.data.longestStreak = this.data.currentStreak;
    }

    // Check for milestone rewards
    const day = this.data.currentStreak;
    if (STREAK_REWARDS[day]) {
      reward = STREAK_REWARDS[day];
      coinManager.award(reward, 'streak');
    } else {
      // Base daily reward
      reward = COIN_REWARDS.STREAK_DAY_1;
      coinManager.award(reward, 'streak');
    }

    this._save();

    return {
      streakDay: this.data.currentStreak,
      reward,
      isNewDay: true,
      streakBroken
    };
  }

  getStreak() {
    return this.data.currentStreak;
  }

  getLongestStreak() {
    return this.data.longestStreak;
  }

  getHistory() {
    return [...this.data.history];
  }

  getData() {
    return { ...this.data };
  }

  /**
   * Sync with Supabase
   */
  async syncToCloud() {
    try {
      const { supabase } = await import('../../supabase.js');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('profiles').update({
        current_streak: this.data.currentStreak,
        longest_streak: this.data.longestStreak,
        last_active_date: this.data.lastActiveDate
      }).eq('id', user.id);
    } catch (e) {
      console.warn('[StreakManager] Sync failed:', e);
    }
  }
}

export const streakManager = new StreakManager();
export { STREAK_REWARDS };
