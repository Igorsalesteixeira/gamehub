// =============================================
//  Live Feed — Realtime activity feed via Supabase
// =============================================

import { supabase } from '../../supabase.js';

const GAME_ICONS = {
  solitaire: '\uD83C\uDCCF', freecell: '\uD83C\uDCA1', blackjack: '\uD83C\uDCCF', truco: '\uD83C\uDCA0', uno: '\uD83D\uDFE5', pyramid: '\uD83D\uDD3A',
  memory: '\uD83E\uDDE0', minesweeper: '\uD83D\uDCA3', game2048: '\uD83D\uDD22', sudoku: '\uD83D\uDD22', puzzle15: '\uD83E\uDDE9',
  nonogram: '\uD83D\uDDBC\uFE0F', mahjong: '\uD83C\uDC04', lightsout: '\uD83D\uDCA1', sokoban: '\uD83D\uDCE6',
  snake: '\uD83D\uDC0D', tetris: '\uD83E\uDDF1', flappybird: '\uD83D\uDC26', pong: '\uD83C\uDFD3', breakout: '\uD83E\uDDF1',
  dinorunner: '\uD83E\uDD95', spaceinvaders: '\uD83D\uDC7E', pacman: '\uD83D\uDFE1',
  checkers: '\u26AB', tictactoe: '\u274C', reversi: '\u26AA', chess: '\u265F\uFE0F', battleship: '\uD83D\uDEA2',
  connect4: '\uD83D\uDD34', go: '\u26AB', ludo: '\uD83C\uDFB2', domino: '\uD83C\uDC63',
  termo: '\uD83D\uDCDD', hangman: '\uD83D\uDD24', wordsearch: '\uD83D\uDD0D', anagram: '\uD83D\uDD00', stopgame: '\u270B',
  cookieclicker: '\uD83C\uDF6A', sinuca: '\uD83C\uDFB1'
};

const LOCAL_FEED_KEY = 'gamehub_local_feed';
const MAX_ITEMS = 20;

/**
 * Get relative time string in Portuguese
 */
function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'agora';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min atr\u00E1s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h atr\u00E1s`;
  return `${Math.floor(seconds / 86400)} d atr\u00E1s`;
}

/**
 * Build a single feed item HTML string
 */
function buildFeedItemHtml(name, action, gameName, gameId, timeAgo, isNew = false) {
  const icon = GAME_ICONS[gameId] || '\uD83C\uDFAE';
  const initial = name ? name[0].toUpperCase() : '?';
  return `
    <div class="feed-item${isNew ? ' feed-item-new' : ''}">
      <div class="feed-avatar">${initial}</div>
      <div class="feed-content">
        <strong>${name}</strong> ${action} no <span class="feed-game">${gameName}</span>
        <span class="feed-time">${timeAgo}</span>
      </div>
      <span class="feed-game-icon">${icon}</span>
    </div>`;
}

/**
 * Get local feed from localStorage
 */
function getLocalFeed() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FEED_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Save local feed to localStorage
 */
function saveLocalFeed(feed) {
  try {
    localStorage.setItem(LOCAL_FEED_KEY, JSON.stringify(feed.slice(0, MAX_ITEMS)));
  } catch { /* quota exceeded — ignore */ }
}

/**
 * Render local-only feed (fallback)
 */
function renderLocalFeed(container) {
  const feed = getLocalFeed();
  if (feed.length === 0) {
    container.innerHTML = `
      <div class="activity-feed-empty">
        <div class="activity-feed-empty-icon">\uD83C\uDFAE</div>
        <p>Nenhuma atividade recente</p>
      </div>`;
    return;
  }
  container.innerHTML = feed.map(item => {
    const gameName = item.game ? item.game.charAt(0).toUpperCase() + item.game.slice(1) : 'Jogo';
    const action = item.result === 'win' ? 'venceu' : 'jogou';
    return buildFeedItemHtml(item.name || 'Voc\u00EA', action, gameName, item.game, getTimeAgo(item.created_at));
  }).join('');
}

/**
 * Post a new action to the local feed (called by game-core or externally)
 */
export function postToFeed(gameId, action, data = {}) {
  const feed = getLocalFeed();
  feed.unshift({
    game: gameId,
    result: action,
    name: data.name || 'Voc\u00EA',
    created_at: new Date().toISOString(),
    ...data
  });
  saveLocalFeed(feed);
}

/**
 * Initialize the live feed with Supabase Realtime
 */
export async function initLiveFeed(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Profile cache for display names
  const profileCache = new Map();

  async function getDisplayName(userId) {
    if (profileCache.has(userId)) return profileCache.get(userId);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single();
      const name = data?.display_name || 'Jogador';
      profileCache.set(userId, name);
      return name;
    } catch {
      return 'Jogador';
    }
  }

  // Check if Supabase is available
  let session = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data?.session;
  } catch {
    // Supabase unavailable — fallback to local
    renderLocalFeed(container);
    return;
  }

  if (!session) {
    // Not authenticated — show local feed or login prompt
    const localFeed = getLocalFeed();
    if (localFeed.length > 0) {
      renderLocalFeed(container);
    } else {
      container.innerHTML = `
        <div class="activity-feed-empty">
          <div class="activity-feed-empty-icon">\uD83D\uDD12</div>
          <p>Fa\u00E7a login para ver as atividades dos seus amigos</p>
          <a href="auth.html" class="btn btn-primary" style="margin-top:1rem">Entrar</a>
        </div>`;
    }
    return;
  }

  // ----- Load initial data (friends' activities) -----
  let friendIds = [];
  try {
    const { data: friends } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', session.user.id)
      .eq('status', 'accepted');

    friendIds = (friends || []).map(f => f.friend_id);
  } catch { /* ignore */ }

  // Include own user to see own activity too
  const allUserIds = [...new Set([session.user.id, ...friendIds])];

  // Fetch recent activities
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: activities } = await supabase
      .from('game_stats')
      .select('user_id, game, result, time_seconds, created_at')
      .in('user_id', allUserIds)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS);

    // Pre-fetch profile names
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', allUserIds);

    (profiles || []).forEach(p => profileCache.set(p.id, p.display_name));

    if (!activities || activities.length === 0) {
      container.innerHTML = `
        <div class="activity-feed-empty">
          <div class="activity-feed-empty-icon">\uD83C\uDFAE</div>
          <p>Seus amigos ainda n\u00E3o jogaram hoje</p>
        </div>`;
    } else {
      container.innerHTML = activities.slice(0, MAX_ITEMS).map(a => {
        const name = profileCache.get(a.user_id) || 'Jogador';
        const gameName = a.game.charAt(0).toUpperCase() + a.game.slice(1);
        const action = a.result === 'win' ? 'venceu' : 'jogou';
        return buildFeedItemHtml(name, action, gameName, a.game, getTimeAgo(a.created_at));
      }).join('');
    }
  } catch (error) {
    console.error('Erro ao carregar feed:', error);
    renderLocalFeed(container);
    return;
  }

  // ----- Add live indicator to section header -----
  const sectionTitle = container.closest('section')?.querySelector('h2, .section-title');
  if (sectionTitle && !sectionTitle.querySelector('.feed-live-dot')) {
    const dot = document.createElement('span');
    dot.className = 'feed-live-dot';
    dot.title = 'Ao vivo';
    sectionTitle.prepend(dot);
  }

  // ----- Subscribe to Realtime inserts on game_stats -----
  try {
    const channel = supabase
      .channel('live-feed-game-stats')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_stats' },
        async (payload) => {
          const row = payload.new;
          if (!row) return;

          // Only show activities from friends or self
          if (!allUserIds.includes(row.user_id)) return;

          const name = await getDisplayName(row.user_id);
          const gameName = row.game.charAt(0).toUpperCase() + row.game.slice(1);
          const action = row.result === 'win' ? 'venceu' : 'jogou';
          const html = buildFeedItemHtml(name, action, gameName, row.game, 'agora', true);

          // Remove empty state if present
          const emptyState = container.querySelector('.activity-feed-empty');
          if (emptyState) emptyState.remove();

          // Prepend new item
          container.insertAdjacentHTML('afterbegin', html);

          // Trim excess items
          const items = container.querySelectorAll('.feed-item');
          while (items.length > MAX_ITEMS) {
            container.removeChild(container.lastElementChild);
          }
        }
      )
      .subscribe();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      supabase.removeChannel(channel);
    });
  } catch (err) {
    console.warn('Realtime feed subscription failed:', err);
    // Feed still works with initial static data — no action needed
  }
}
