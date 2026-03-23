/**
 * Sistema de Moedas do Games Hub
 * Gerencia moedas virtuais ganhas ao jogar
 */

const COIN_REWARDS = {
  GAME_PLAYED: 5,
  GAME_WON: 10,
  DAILY_CHALLENGE: 50,
  STREAK_DAY_1: 10,
  STREAK_DAY_7: 100,
  STREAK_DAY_30: 500,
};

class CoinManager {
  constructor() {
    this.balance = this._loadBalance();
  }

  _loadBalance() {
    return parseInt(localStorage.getItem('gamehub_coins') || '0', 10);
  }

  _saveBalance() {
    localStorage.setItem('gamehub_coins', this.balance.toString());
  }

  getBalance() {
    return this.balance;
  }

  /**
   * Award coins with optional floating animation
   * @param {number} amount
   * @param {string} reason - 'game_played', 'game_won', 'daily_challenge', 'streak', 'achievement'
   * @param {object} options - { animate: true, element: DOM element to show +N near }
   */
  award(amount, reason = 'unknown', options = {}) {
    if (amount <= 0) return;
    this.balance += amount;
    this._saveBalance();
    this._logTransaction(amount, reason);

    if (options.animate !== false) {
      this._showFloatingCoins(amount, options.element);
    }

    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent('coins-changed', {
      detail: { balance: this.balance, earned: amount, reason }
    }));
  }

  /**
   * Award coins for completing a game
   * @param {boolean} won
   * @param {string} gameId
   */
  awardForGame(won, gameId) {
    this.award(COIN_REWARDS.GAME_PLAYED, 'game_played');
    if (won) {
      this.award(COIN_REWARDS.GAME_WON, 'game_won');
    }
  }

  _logTransaction(amount, reason) {
    try {
      const log = JSON.parse(localStorage.getItem('gamehub_coin_log') || '[]');
      log.push({
        amount,
        reason,
        date: new Date().toISOString(),
        balance: this.balance
      });
      // Keep only last 100 transactions
      if (log.length > 100) log.splice(0, log.length - 100);
      localStorage.setItem('gamehub_coin_log', JSON.stringify(log));
    } catch (e) { /* storage full, ignore */ }
  }

  _showFloatingCoins(amount, element) {
    // Create a floating "+N" text that animates up and fades
    const el = document.createElement('div');
    el.className = 'coin-float';
    el.textContent = `+${amount} \u{1FA99}`;

    if (element) {
      const rect = element.getBoundingClientRect();
      el.style.position = 'fixed';
      el.style.left = `${rect.left + rect.width / 2}px`;
      el.style.top = `${rect.top}px`;
    } else {
      // Default: near the coin display in the header
      const coinDisplay = document.getElementById('coin-display');
      if (coinDisplay) {
        const rect = coinDisplay.getBoundingClientRect();
        el.style.position = 'fixed';
        el.style.left = `${rect.left + rect.width / 2}px`;
        el.style.top = `${rect.top}px`;
      } else {
        el.style.position = 'fixed';
        el.style.top = '60px';
        el.style.right = '20px';
      }
    }

    document.body.appendChild(el);

    // Animate
    requestAnimationFrame(() => {
      el.style.transform = 'translateY(-40px)';
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), 1000);
  }

  /**
   * Sync balance to Supabase (call periodically or on page unload)
   */
  async syncToCloud() {
    try {
      const { supabase } = await import('../../supabase.js');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('profiles').update({
        total_coins: this.balance
      }).eq('id', user.id);
    } catch (e) {
      console.warn('[CoinManager] Sync failed:', e);
    }
  }

  /**
   * Load balance from cloud (on login)
   */
  async loadFromCloud() {
    try {
      const { supabase } = await import('../../supabase.js');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from('profiles')
        .select('total_coins')
        .eq('id', user.id)
        .single();

      if (data?.total_coins !== undefined) {
        // Use the higher of local or cloud
        this.balance = Math.max(this.balance, data.total_coins);
        this._saveBalance();
      }
    } catch (e) {
      console.warn('[CoinManager] Load from cloud failed:', e);
    }
  }
}

// Singleton
export const coinManager = new CoinManager();
export { COIN_REWARDS };
