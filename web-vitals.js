/**
 * Web Vitals Reporter
 * Rastreia Core Web Vitals e envia para analytics
 * LCP (Largest Contentful Paint), FID (First Input Delay), CLS (Cumulative Layout Shift)
 */

(function() {
  'use strict';

  const DEBUG = location.hostname === 'localhost' ||
                location.search.includes('debug=vitals') ||
                localStorage.getItem('web-vitals-debug') === 'true';

  const REPORT_ALL = location.search.includes('vitals=all');

  // Thresholds conforme Web Vitals
  const THRESHOLDS = {
    LCP: { good: 2500, poor: 4000 },      // ms
    FID: { good: 100, poor: 300 },       // ms
    CLS: { good: 0.1, poor: 0.25 },       // unitless
    FCP: { good: 1800, poor: 3000 },      // ms
    TTFB: { good: 800, poor: 1800 },      // ms
    INP: { good: 200, poor: 500 }          // ms (Interaction to Next Paint)
  };

  // Buffer para métricas aguardando gtag
  let metricsQueue = [];
  let gtagReady = false;

  function log(...args) {
    if (DEBUG) {
      console.log('[Web Vitals]', ...args);
    }
  }

  // Envia para analytics (gtag ou console em debug)
  function sendToAnalytics(metric) {
    const { name, value, rating, id, delta } = metric;

    // Log no console
    const logStyle = rating === 'good' ? 'color: #10b981' :
                     rating === 'needs-improvement' ? 'color: #f59e0b' : 'color: #ef4444';

    log(`%c${name}: ${value.toFixed(3)} (${rating})`, logStyle);

    // Constrói o evento
    const eventData = {
      event_category: 'Web Vitals',
      event_label: id,
      value: Math.round(name === 'CLS' ? delta * 1000 : delta),
      metric_name: name,
      metric_value: value,
      metric_rating: rating,
      metric_id: id
    };

    // Envia para gtag se disponível
    if (typeof gtag !== 'undefined' && gtagReady) {
      gtag('event', name.toLowerCase(), eventData);
      log('Enviado para analytics:', name);
    } else {
      metricsQueue.push(eventData);
    }

    // Evento customizado para debug
    if (DEBUG) {
      window.dispatchEvent(new CustomEvent('web-vital-measured', {
        detail: metric
      }));
    }
  }

  // Processa fila quando gtag estiver disponível
  function processQueue() {
    if (typeof gtag === 'undefined') return;

    gtagReady = true;
    metricsQueue.forEach(data => {
      gtag('event', data.metric_name.toLowerCase(), data);
    });
    metricsQueue = [];
    log('Fila de métricas processada');
  }

  // Determina rating baseado no valor
  function getRating(name, value) {
    const t = THRESHOLDS[name];
    if (!t) return 'unknown';

    if (value <= t.good) return 'good';
    if (value <= t.poor) return 'needs-improvement';
    return 'poor';
  }

  // Observa LCP (Largest Contentful Paint)
  function observeLCP() {
    const entries = [];
    let lcpValue = 0;

    const observer = new PerformanceObserver((list) => {
      const newEntries = list.getEntries();
      entries.push(...newEntries);

      // O último entry geralmente é o maior
      const lastEntry = newEntries[newEntries.length - 1];
      lcpValue = lastEntry.startTime;
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });

    // Reporta no visibilitychange (quando usuário sai da página)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && lcpValue > 0) {
        observer.disconnect();
        sendToAnalytics({
          name: 'LCP',
          value: lcpValue,
          delta: lcpValue,
          rating: getRating('LCP', lcpValue),
          id: generateUniqueId()
        });
      }
    }, { once: true });
  }

  // Observa FID (First Input Delay)
  function observeFID() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      entries.forEach(entry => {
        // Só processa se houver delay de processamento
        if (entry.processingStart && entry.startTime) {
          const delay = entry.processingStart - entry.startTime;

          sendToAnalytics({
            name: 'FID',
            value: delay,
            delta: delay,
            rating: getRating('FID', delay),
            id: generateUniqueId()
          });
        }
      });
    });

    observer.observe({ entryTypes: ['first-input'] });
  }

  // Observa CLS (Cumulative Layout Shift)
  function observeCLS() {
    let clsValue = 0;
    let clsEntries = [];
    let sessionValue = 0;
    let sessionEntries = [];

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      entries.forEach(entry => {
        // Ignora shifts sem recent input (CLS only counts unexpected shifts)
        if (!entry.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0];
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

          // Se passou de 1 segundo desde o último shift, nova sessão
          if (sessionValue &&
              entry.startTime - lastSessionEntry.startTime > 1000 &&
              entry.startTime - firstSessionEntry.startTime > 5000) {
            sessionValue = 0;
            sessionEntries = [];
          }

          sessionValue += entry.value;
          sessionEntries.push(entry);

          // Atualiza valor total se a sessão atual é maior
          if (sessionValue > clsValue) {
            clsValue = sessionValue;
            clsEntries = [...sessionEntries];
          }
        }
      });
    });

    observer.observe({ entryTypes: ['layout-shift'] });

    // Reporta no visibilitychange
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && clsValue > 0) {
        sendToAnalytics({
          name: 'CLS',
          value: clsValue,
          delta: clsValue,
          rating: getRating('CLS', clsValue),
          id: generateUniqueId()
        });
      }
    }, { once: true });
  }

  // Observa FCP (First Contentful Paint)
  function observeFCP() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find(e => e.name === 'first-contentful-paint');

      if (fcpEntry) {
        const value = fcpEntry.startTime;
        sendToAnalytics({
          name: 'FCP',
          value: value,
          delta: value,
          rating: getRating('FCP', value),
          id: generateUniqueId()
        });
        observer.disconnect();
      }
    });

    observer.observe({ entryTypes: ['paint'] });
  }

  // Observa TTFB (Time to First Byte)
  function observeTTFB() {
    const navigation = performance.getEntriesByType('navigation')[0];

    if (navigation) {
      const value = navigation.responseStart - navigation.startTime;
      sendToAnalytics({
        name: 'TTFB',
        value: value,
        delta: value,
        rating: getRating('TTFB', value),
        id: generateUniqueId()
      });
    }
  }

  // Observa INP (Interaction to Next Paint) - nova métrica
  function observeINP() {
    const interactions = [];

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      entries.forEach(entry => {
        // Ignora entradas sem interactionId ou que não são eventos
        if (entry.interactionId > 0) {
          interactions.push({
            id: entry.interactionId,
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['event'], buffered: true });
    } catch (e) {
      // INP não suportado neste navegador
      return;
    }

    // Reporta no visibilitychange
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && interactions.length > 0) {
        // INP é o 98º percentil das interações (mais alta que não é outlier)
        const sorted = interactions.sort((a, b) => b.duration - a.duration);
        const inpValue = sorted[Math.floor(sorted.length * 0.02)]?.duration || sorted[0]?.duration;

        if (inpValue) {
          sendToAnalytics({
            name: 'INP',
            value: inpValue,
            delta: inpValue,
            rating: getRating('INP', inpValue),
            id: generateUniqueId()
          });
        }
      }
    }, { once: true });
  }

  // Gera ID único para cada métrica
  function generateUniqueId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Força relatório de todas as métricas (para debug)
  function reportAll() {
    observeTTFB();
    observeFCP();

    // Tenta obter valores já calculados do performance API
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    const nav = performance.getEntriesByType('navigation')[0];

    if (fcp) {
      log('FCP (from buffer):', fcp.startTime);
    }
    if (lcpEntries.length > 0) {
      log('LCP (from buffer):', lcpEntries[lcpEntries.length - 1].startTime);
    }
    if (nav) {
      log('TTFB (from buffer):', nav.responseStart - nav.startTime);
    }
  }

  // Inicialização
  function init() {
    if (!('PerformanceObserver' in window)) {
      log('PerformanceObserver não suportado');
      return;
    }

    log('Inicializando Web Vitals tracking...');
    log('Modo debug:', DEBUG);

    // Verifica quando gtag estiver disponível
    if (typeof gtag !== 'undefined') {
      gtagReady = true;
    } else {
      // Observa carregamento do gtag
      const checkGtag = setInterval(() => {
        if (typeof gtag !== 'undefined') {
          clearInterval(checkGtag);
          processQueue();
        }
      }, 100);

      // Timeout de 10s
      setTimeout(() => clearInterval(checkGtag), 10000);
    }

    // Inicia observadores
    observeCLS();
    observeLCP();
    observeFID();
    observeFCP();
    observeTTFB();
    observeINP();

    // Se solicitado, reporta imediatamente
    if (REPORT_ALL) {
      setTimeout(reportAll, 100);
    }

    // API pública para debug
    window.WebVitals = {
      getMetrics: () => metricsQueue,
      reportAll: reportAll,
      enableDebug: () => {
        localStorage.setItem('web-vitals-debug', 'true');
        location.reload();
      },
      disableDebug: () => {
        localStorage.removeItem('web-vitals-debug');
        location.reload();
      },
      thresholds: THRESHOLDS
    };

    log('Web Vitals tracking inicializado');
  }

  // Inicia quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
