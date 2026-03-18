// =============================================
// Games Hub - PWA Registration
// Registra Service Worker em todos os jogos
// =============================================

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[PWA] SW registrado:', registration.scope);

        // Solicitar permissão para notificações
        if ('Notification' in window && Notification.permission === 'default') {
          // Não solicitar imediatamente, esperar interação do usuário
          console.log('[PWA] Notificações disponíveis');
        }
      })
      .catch((error) => {
        console.log('[PWA] Falha ao registrar SW:', error);
      });
  });
}

// Pausar jogo quando aba não estiver visível
document.addEventListener('visibilitychange', () => {
  if (document.hidden && window.gameInstance && window.gameInstance.pause) {
    window.gameInstance.pause();
  }
});

// Prevenir zoom em mobile
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());

// Lazy load de imagens
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src || img.src;
        img.classList.remove('lazy');
        imageObserver.unobserve(img);
      }
    });
  });

  // Observar imagens lazy após DOM carregar
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img.lazy').forEach((img) => {
      imageObserver.observe(img);
    });
  });
}

// Audio context initialization (browser requirement)
let audioContextInitialized = false;
function initAudioContext() {
  if (!audioContextInitialized && typeof AudioContext !== 'undefined') {
    const audioContext = new AudioContext();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    audioContextInitialized = true;
  }
}

// Initialize audio on first user interaction
document.addEventListener('click', initAudioContext, { once: true });
document.addEventListener('touchstart', initAudioContext, { once: true });

// Exportar funções úteis
window.PWAUtils = {
  // Verificar se está online
  isOnline: () => navigator.onLine,

  // Verificar se app está instalado
  isInstalled: () => window.matchMedia('(display-mode: standalone)').matches ||
                     window.navigator.standalone === true,

  // Solicitar instalação (deve ser chamado em gesture do usuário)
  promptInstall: async () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      const { outcome } = await window.deferredPrompt.userChoice;
      window.deferredPrompt = null;
      return outcome;
    }
    return null;
  },

  // Cache asset específico
  cacheAsset: async (url) => {
    if ('caches' in window) {
      const cache = await caches.open('gameshub-games-v1');
      await cache.add(url);
    }
  }
};

// Capturar evento beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
  console.log('[PWA] App pronto para instalação');
});
