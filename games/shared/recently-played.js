// recently-played.js — Recently Played + Favorites module

export function getRecentlyPlayed(limit = 5) {
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith('gamehub_stats_')) continue;
    try {
      const stats = JSON.parse(localStorage.getItem(key));
      if (stats && stats.lastPlayed) {
        const gameId = key.replace('gamehub_stats_', '');
        results.push({
          gameId,
          lastPlayed: stats.lastPlayed,
          stats
        });
      }
    } catch (e) {
      // skip malformed entries
    }
  }
  results.sort((a, b) => b.lastPlayed - a.lastPlayed);
  return results.slice(0, limit);
}

export function getFavorites() {
  return JSON.parse(localStorage.getItem('gamehub_favorites') || '[]');
}

export function toggleFavorite(gameId) {
  const favs = getFavorites();
  const idx = favs.indexOf(gameId);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(gameId);
  localStorage.setItem('gamehub_favorites', JSON.stringify(favs));
  return idx < 0; // true if added, false if removed
}

export function isFavorite(gameId) {
  return getFavorites().includes(gameId);
}
