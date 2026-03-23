// =============================================
// Push Notification Manager — Games Hub
// Gerencia Web Push API com graceful degradation
// =============================================

class PushManager {
  constructor() {
    this.permission = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    this.subscription = null;
  }

  // Check if push is supported
  isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  // Request permission and subscribe
  async requestPermission() {
    if (!this.isSupported()) return false;

    const permission = await Notification.requestPermission();
    this.permission = permission;

    if (permission === 'granted') {
      await this._subscribe();
      return true;
    }
    return false;
  }

  // Subscribe to push (stores subscription locally for now)
  async _subscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      // For now, we use local notifications (no push server yet)
      // Store that user opted in
      localStorage.setItem('gamehub_push_enabled', 'true');
      localStorage.setItem('gamehub_push_granted_at', new Date().toISOString());
      this.subscription = true;
      return true;
    } catch (err) {
      console.error('[Push] Subscribe failed:', err);
      return false;
    }
  }

  isEnabled() {
    return localStorage.getItem('gamehub_push_enabled') === 'true' && Notification.permission === 'granted';
  }

  disable() {
    localStorage.removeItem('gamehub_push_enabled');
    this.subscription = null;
  }

  // Send a local notification (works without push server)
  async sendLocalNotification(title, options = {}) {
    if (!this.isEnabled()) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/icon.svg',
        badge: '/icon.svg',
        vibrate: [100, 50, 100],
        tag: options.tag || 'gameshub-notification',
        renotify: true,
        ...options
      });
    } catch (err) {
      // Fallback to regular Notification API
      if (Notification.permission === 'granted') {
        new Notification(title, {
          icon: '/icon.svg',
          ...options
        });
      }
    }
  }

  // Schedule recurring checks (streak reminder, daily challenge)
  startScheduledChecks() {
    if (!this.isEnabled()) return;

    // Check every hour
    setInterval(() => this._checkScheduledNotifications(), 60 * 60 * 1000);
    // Also check on init
    setTimeout(() => this._checkScheduledNotifications(), 5000);
  }

  _checkScheduledNotifications() {
    if (!this.isEnabled()) return;

    const now = new Date();
    const hour = now.getHours();
    const lastNotif = localStorage.getItem('gamehub_last_notif_date');
    const today = now.toISOString().slice(0, 10);

    if (lastNotif === today) return; // Already sent today

    // Evening reminder (20h) - streak about to expire
    if (hour >= 20 && hour < 22) {
      const streakData = JSON.parse(localStorage.getItem('gamehub_streak') || '{}');
      const lastActive = streakData.lastActiveDate;

      if (lastActive && lastActive !== today && streakData.currentStreak > 0) {
        this.sendLocalNotification('\u{1F525} Sua streak vai expirar!', {
          body: `Voc\u00EA tem ${streakData.currentStreak} dias seguidos. Jogue hoje para n\u00E3o perder!`,
          tag: 'streak-reminder',
          data: { url: '/' }
        });
        localStorage.setItem('gamehub_last_notif_date', today);
      }
    }

    // Morning reminder (9h) - daily challenge available
    if (hour >= 9 && hour < 11) {
      const dailyResult = JSON.parse(localStorage.getItem('gamehub_daily_results') || '{}');
      if (!dailyResult[today]) {
        this.sendLocalNotification('\u{1F3C6} Desafio Di\u00E1rio dispon\u00EDvel!', {
          body: 'Um novo puzzle te espera. Mesmo desafio para todos!',
          tag: 'daily-challenge',
          data: { url: '/desafio-diario.html' }
        });
        localStorage.setItem('gamehub_last_notif_date', today);
      }
    }
  }
}

export const pushManager = new PushManager();
