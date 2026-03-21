// =============================================
// Games Hub - Service Worker
// PWA com cache estratégico para offline play
// =============================================

const CACHE_NAME = 'gameshub-v1';
const STATIC_CACHE = 'gameshub-static-v1';
const GAME_CACHE = 'gameshub-games-v1';

// Assets essenciais para o shell da app
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/sidebar.js',
  '/supabase.js',
  '/auth-check.js',
  '/games/shared/design-system.css',
  '/games/shared/game-design-utils.js',
  '/icon.svg',
  '/manifest.json'
];

// Jogos populares para precache
const POPULAR_GAMES = [
  '/games/solitaire/index.html',
  '/games/solitaire/game.js',
  '/games/solitaire/style.css',
  '/games/termo/index.html',
  '/games/termo/game.js',
  '/games/termo/style.css',
  '/games/snake/index.html',
  '/games/snake/game.js',
  '/games/snake/style.css',
  '/games/tetris/index.html',
  '/games/tetris/game.js',
  '/games/tetris/style.css',
  '/games/pacman/index.html',
  '/games/pacman/game.js',
  '/games/pacman/style.css'
];

// Instalação: cache dos assets estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Cacheando assets estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Precache de jogos populares em background
        return caches.open(GAME_CACHE).then(cache => {
          console.log('[SW] Precacheando jogos populares');
          return Promise.all(
            POPULAR_GAMES.map(url =>
              fetch(url).then(res => {
                if (res.ok) cache.put(url, res);
              }).catch(() => {})
            )
          );
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação: limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('gameshub-') && name !== STATIC_CACHE && name !== GAME_CACHE)
          .map((name) => {
            console.log('[SW] Deletando cache antigo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: estratégia de cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests não-GET
  if (request.method !== 'GET') return;

  // Ignorar requests do Supabase/API
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Estratégia: Cache First para assets estáticos
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Estratégia: Cache First para imagens
  if (isImage(url)) {
    event.respondWith(imageCache(request));
    return;
  }

  // Estratégia: Network First para jogos (com fallback offline)
  if (isGameFile(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Estratégia: Stale While Revalidate para o resto
  event.respondWith(staleWhileRevalidate(request));
});

// Verificar se é asset estático
function isStaticAsset(url) {
  const staticExts = ['.css', '.js', '.svg', '.woff2'];
  return staticExts.some((ext) => url.pathname.endsWith(ext)) ||
         url.pathname === '/' ||
         url.pathname === '/index.html';
}

// Verificar se é imagem
function isImage(url) {
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'];
  return imageExts.some((ext) => url.pathname.endsWith(ext));
}

// Verificar se é arquivo de jogo
function isGameFile(url) {
  return url.pathname.startsWith('/games/') &&
         (url.pathname.endsWith('.html') || url.pathname.endsWith('.js'));
}

// Estratégia: Cache First
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Falha ao buscar:', request.url, error);
    // Retornar página offline se disponível
    return caches.match('/offline.html');
  }
}

// Estratégia: Cache First para imagens
async function imageCache(request) {
  const cache = await caches.open('gameshub-images-v1');
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Retornar placeholder ou erro para imagens
    return new Response('', { status: 404, statusText: 'Not found' });
  }
}

// Estratégia: Network First (para jogos)
async function networkFirst(request) {
  const cache = await caches.open(GAME_CACHE);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Offline, buscando no cache:', request.url);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Estratégia: Stale While Revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Background sync para salvar scores quando voltar online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scores') {
    event.waitUntil(syncScores());
  }
});

async function syncScores() {
  // Implementar sincronização de scores pendentes
  console.log('[SW] Sincronizando scores...');
}

// Push notifications (para desafio diário)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};

  event.waitUntil(
    self.registration.showNotification(data.title || 'Games Hub', {
      body: data.body || 'Novo desafio disponível!',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: data.tag || 'default',
      requireInteraction: false,
      actions: [
        { action: 'play', title: 'Jogar' },
        { action: 'close', title: 'Fechar' }
      ]
    })
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'play') {
    event.waitUntil(
      clients.openWindow('/games/termo/')
    );
  }
});
