/**
 * Game Hub - Dashboard de Estatísticas Visual
 *
 * Dashboard completo usando todos os módulos modernos:
 * - GameStateStore para persistência de dados
 * - GameHooks para eventos em tempo real
 * - ParticleSystem para efeitos visuais
 * - SyncManager para sincronização
 * - AnimationSystem para transições suaves
 *
 * @module shared/dashboard
 * @version 1.0.0
 */

import { GameStateStore, stateStore } from '../state-store.js';
import { GameHooks, GameEvents } from '../hooks.js';
import { ParticleSystem, emitConfetti } from '../skills/particle-system/index.js';
import { AnimationSystem } from '../skills/animation-system/index.js';
import { SyncManager, syncManager } from '../sync-manager.js';
import { GameStats } from '../game-core.js';

/**
 * Dashboard de estatísticas do jogador
 * @class GameDashboard
 */
export class GameDashboard {
  /**
   * Cria uma instância do Dashboard
   * @param {Object} options - Opções de configuração
   * @param {HTMLElement} options.container - Container para o dashboard
   * @param {string} [options.gameId=null] - ID do jogo específico (null = todos)
   * @param {boolean} [options.showParticles=true] - Habilita efeitos de partículas
   */
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.gameId = options.gameId || null;
    this.showParticles = options.showParticles !== false;

    // Inicializar sistemas
    this.hooks = new GameHooks({ gameId: 'dashboard' });
    this.animations = new AnimationSystem();

    // Estado
    this.stats = new Map();
    this.achievements = [];
    this.isVisible = false;

    // Elementos DOM
    this.elements = {};

    // Bindings
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    this._handleStorageChange = this._handleStorageChange.bind(this);

    // Inicializar
    this._init();
  }

  /**
   * Inicializa o dashboard
   * @private
   */
  async _init() {
    await this._loadData();
    this._createDOM();
    this._setupEventListeners();
    this._setupHooks();

    // Se houver partículas habilitadas, criar sistema
    if (this.showParticles) {
      this._initParticles();
    }
  }

  /**
   * Carrega dados do StateStore
   * @private
   */
  async _loadData() {
    try {
      if (this.gameId) {
        // Dados de um jogo específico
        const history = await stateStore.getGameHistory(this.gameId, { limit: 100 });
        const analytics = await stateStore.getAnalytics(this.gameId, 'month');
        this.stats.set(this.gameId, { history, analytics });
      } else {
        // Dados de todos os jogos
        const games = ['pacman', 'chess', 'tetris', 'snake', 'minesweeper']; // Lista de jogos
        for (const game of games) {
          try {
            const history = await stateStore.getGameHistory(game, { limit: 50 });
            const analytics = await stateStore.getAnalytics(game, 'month');
            this.stats.set(game, { history, analytics });
          } catch (e) {
            console.warn(`[Dashboard] Erro ao carregar ${game}:`, e);
          }
        }
      }
    } catch (e) {
      console.error('[Dashboard] Erro ao carregar dados:', e);
    }
  }

  /**
   * Cria a estrutura DOM do dashboard
   * @private
   */
  _createDOM() {
    const dashboard = document.createElement('div');
    dashboard.className = 'game-dashboard glass-panel';
    dashboard.innerHTML = `
      <div class="dashboard-header">
        <h2 class="dashboard-title">
          <span class="dashboard-icon">📊</span>
          Estatísticas
          ${this.gameId ? `- ${this._capitalize(this.gameId)}` : 'Gerais'}
        </h2>
        <button class="dashboard-close" aria-label="Fechar">×</button>
      </div>

      <div class="dashboard-content">
        <!-- Streak Section -->
        <div class="dashboard-section streak-section">
          <div class="streak-display">
            <div class="streak-flame">🔥</div>
            <div class="streak-info">
              <span class="streak-count" id="streak-count">0</span>
              <span class="streak-label">dias seguidos</span>
            </div>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="dashboard-grid">
          <div class="stat-card" data-stat="gamesPlayed">
            <div class="stat-value" id="stat-games">0</div>
            <div class="stat-label">Partidas</div>
            <div class="stat-change" id="stat-games-change">+0</div>
          </div>
          <div class="stat-card" data-stat="highScore">
            <div class="stat-value" id="stat-score">0</div>
            <div class="stat-label">Melhor Score</div>
            <div class="stat-change positive" id="stat-score-change">+0</div>
          </div>
          <div class="stat-card" data-stat="winRate">
            <div class="stat-value" id="stat-winrate">0%</div>
            <div class="stat-label">Taxa de Vitória</div>
            <div class="progress-ring" id="winrate-ring">
              <svg viewBox="0 0 36 36">
                <path class="progress-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path class="progress-ring-fill" id="winrate-progress" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
            </div>
          </div>
          <div class="stat-card" data-stat="totalTime">
            <div class="stat-value" id="stat-time">0h</div>
            <div class="stat-label">Tempo de Jogo</div>
            <div class="stat-change" id="stat-time-change">+0m</div>
          </div>
        </div>

        <!-- Performance Chart -->
        <div class="dashboard-section">
          <h3 class="section-title">Desempenho</h3>
          <div class="chart-container">
            <canvas id="performance-chart" width="600" height="200"></canvas>
          </div>
        </div>

        <!-- Heatmap -->
        <div class="dashboard-section">
          <h3 class="section-title">Horários de Jogo</h3>
          <div class="heatmap-container" id="heatmap">
            <!-- Gerado dinamicamente -->
          </div>
        </div>

        <!-- Recent Achievements -->
        <div class="dashboard-section">
          <h3 class="section-title">Conquistas Recentes</h3>
          <div class="achievements-list" id="achievements-list">
            <!-- Gerado dinamicamente -->
          </div>
        </div>

        <!-- Sync Status -->
        <div class="dashboard-footer">
          <div class="sync-status" id="sync-status">
            <span class="sync-icon">☁️</span>
            <span class="sync-text">Sincronizado</span>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(dashboard);
    this.elements.dashboard = dashboard;
    this.elements.closeBtn = dashboard.querySelector('.dashboard-close');
    this.elements.streakCount = dashboard.querySelector('#streak-count');
    this.elements.achievementsList = dashboard.querySelector('#achievements-list');
    this.elements.heatmap = dashboard.querySelector('#heatmap');

    // Salvar referências
    this._cacheElements();
  }

  /**
   * Cacheia elementos DOM frequentemente usados
   * @private
   */
  _cacheElements() {
    this.elements.stats = {
      games: this.elements.dashboard.querySelector('#stat-games'),
      score: this.elements.dashboard.querySelector('#stat-score'),
      winrate: this.elements.dashboard.querySelector('#stat-winrate'),
      time: this.elements.dashboard.querySelector('#stat-time')
    };
  }

  /**
   * Configura listeners de eventos
   * @private
   */
  _setupEventListeners() {
    // Fechar dashboard
    this.elements.closeBtn?.addEventListener('click', () => this.hide());

    // Tecla ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // Mudanças no storage (dados atualizados em outra aba)
    window.addEventListener('storage', this._handleStorageChange);

    // Visibilidade da página
    document.addEventListener('visibilitychange', this._handleVisibilityChange);

    // Atualizar quando sincronização completar
    syncManager?.onSyncComplete?.(() => {
      this._refreshData();
    });
  }

  /**
   * Configura hooks para eventos do jogo
   * @private
   */
  _setupHooks() {
    // Quando uma conquista é desbloqueada
    this.hooks.on('achievement:unlock', (achievement) => {
      this._showAchievementNotification(achievement);
      this._emitParticles('magic');
    });

    // Quando o streak muda
    this.hooks.on('streak:change', ({ streak }) => {
      this._animateStreak(streak);
    });
  }

  /**
   * Inicializa sistema de partículas para o dashboard
   * @private
   */
  _initParticles() {
    // Canvas para partículas do dashboard
    let canvas = document.getElementById('dashboard-particles');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'dashboard-particles';
      canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10000;
      `;
      document.body.appendChild(canvas);
    }

    this.particles = new ParticleSystem(canvas, { autoResize: true });
  }

  /**
   * Mostra notificação de conquista
   * @private
   */
  _showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification animate-slide-down';
    notification.innerHTML = `
      <div class="achievement-icon">${achievement.icon || '🏆'}</div>
      <div class="achievement-info">
        <div class="achievement-title">${achievement.title}</div>
        <div class="achievement-desc">${achievement.description}</div>
      </div>
    `;

    document.body.appendChild(notification);

    // Efeito de partículas
    const rect = notification.getBoundingClientRect();
    this._emitParticles('sparkle', rect.left + rect.width / 2, rect.top);

    // Remover após animação
    setTimeout(() => {
      this.animations.fadeOut(notification, {
        duration: 300,
        onComplete: () => notification.remove()
      });
    }, 3000);
  }

  /**
   * Emite partículas em uma posição
   * @private
   */
  _emitParticles(type, x, y) {
    if (!this.particles || !this.showParticles) return;

    const centerX = x ?? window.innerWidth / 2;
    const centerY = y ?? window.innerHeight / 2;

    switch (type) {
      case 'magic':
        this.particles.magic(centerX, centerY, { count: 30 });
        break;
      case 'sparkle':
        this.particles.emit({
          x: centerX,
          y: centerY,
          count: 20,
          type: 'sparkle',
          color: '#ffe66d'
        });
        break;
      case 'confetti':
        emitConfetti(centerX, centerY);
        break;
    }
  }

  /**
   * Anima o display de streak
   * @private
   */
  _animateStreak(streak) {
    const element = this.elements.streakCount;
    if (!element) return;

    // Animação de contagem
    const oldValue = parseInt(element.textContent) || 0;
    const newValue = streak;

    if (newValue > oldValue) {
      // Streak aumentou - efeito positivo
      this.animations.bounce(element);
      this._emitParticles('sparkle');
    }

    element.textContent = newValue;

    // Mudar tamanho da chama baseado no streak
    const flame = this.elements.dashboard?.querySelector('.streak-flame');
    if (flame) {
      const scale = 1 + Math.min(streak / 30, 0.5);
      flame.style.transform = `scale(${scale})`;
    }
  }

  /**
   * Desenha o gráfico de performance
   * @private
   */
  _drawPerformanceChart() {
    const canvas = document.getElementById('performance-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Limpar
    ctx.clearRect(0, 0, width, height);

    // Pegar dados do jogo atual ou agregado
    const data = this._getChartData();
    if (data.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '14px Nunito';
      ctx.textAlign = 'center';
      ctx.fillText('Jogue mais para ver estatísticas!', width / 2, height / 2);
      return;
    }

    // Configurar estilo
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const valueRange = maxValue - minValue || 1;

    // Desenhar grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Desenhar linha do gráfico
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    data.forEach((point, i) => {
      const x = padding + (chartWidth / (data.length - 1)) * i;
      const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Preencher área sob a linha
    ctx.fillStyle = 'rgba(255, 107, 53, 0.2)';
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fill();

    // Desenhar pontos
    data.forEach((point, i) => {
      const x = padding + (chartWidth / (data.length - 1)) * i;
      const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;

      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * Gera dados para o gráfico
   * @private
   */
  _getChartData() {
    const data = [];
    const days = 7;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Agregar scores de todos os jogos para este dia
      let dayScore = 0;
      this.stats.forEach((gameStats, gameId) => {
        const dayGames = gameStats.history?.filter(h =>
          h.played_at?.startsWith(dateStr)
        ) || [];
        dayScore += dayGames.reduce((sum, h) => sum + (h.score || 0), 0);
      });

      data.push({
        date: dateStr,
        value: dayScore,
        label: date.toLocaleDateString('pt-BR', { weekday: 'short' })
      });
    }

    return data;
  }

  /**
   * Gera o heatmap de horários
   * @private
   */
  _generateHeatmap() {
    const container = this.elements.heatmap;
    if (!container) return;

    container.innerHTML = '';

    // 7 dias da semana × 24 horas
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Coletar dados de jogos por hora
    const activityData = new Map();
    this.stats.forEach((gameStats) => {
      gameStats.history?.forEach(h => {
        const date = new Date(h.played_at);
        const day = date.getDay();
        const hour = date.getHours();
        const key = `${day}-${hour}`;
        activityData.set(key, (activityData.get(key) || 0) + 1);
      });
    });

    // Criar grid
    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';

    // Header de horas
    const headerRow = document.createElement('div');
    headerRow.className = 'heatmap-row header';
    headerRow.innerHTML = '<div class="heatmap-label"></div>';
    hours.filter(h => h % 3 === 0).forEach(h => {
      headerRow.innerHTML += `<div class="heatmap-hour">${h}h</div>`;
    });
    grid.appendChild(headerRow);

    // Linhas de dias
    days.forEach((day, dayIndex) => {
      const row = document.createElement('div');
      row.className = 'heatmap-row';
      row.innerHTML = `<div class="heatmap-day">${day}</div>`;

      hours.forEach(hour => {
        const key = `${dayIndex}-${hour}`;
        const count = activityData.get(key) || 0;
        const intensity = Math.min(count / 5, 1); // Max at 5+ games

        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.dataset.count = count;
        cell.style.backgroundColor = this._getHeatmapColor(intensity);
        cell.title = `${day} ${hour}h: ${count} partida(s)`;

        row.appendChild(cell);
      });

      grid.appendChild(row);
    });

    container.appendChild(grid);
  }

  /**
   * Retorna cor para o heatmap baseada na intensidade
   * @private
   */
  _getHeatmapColor(intensity) {
    if (intensity === 0) return 'rgba(255,255,255,0.05)';
    const r = Math.round(255 * intensity);
    const g = Math.round(107 + (148 * (1 - intensity)));
    const b = Math.round(53 + (172 * (1 - intensity)));
    return `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.7})`;
  }

  /**
   * Renderiza conquistas recentes
   * @private
   */
  _renderAchievements() {
    const container = this.elements.achievementsList;
    if (!container) return;

    // Mock de conquistas (em produção viriam do backend)
    const achievements = [
      { icon: '🏆', title: 'Primeira Vitória', description: 'Vença sua primeira partida', unlocked: true, date: '2h atrás' },
      { icon: '🔥', title: 'Streak de 3 Dias', description: 'Jogue 3 dias seguidos', unlocked: true, date: '1d atrás' },
      { icon: '⭐', title: 'Score Master', description: 'Atinja 1000 pontos', unlocked: false },
      { icon: '⚡', title: 'Velocista', description: 'Complete em menos de 2 minutos', unlocked: false }
    ];

    container.innerHTML = achievements.map(ach => `
      <div class="achievement-item ${ach.unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">${ach.icon}</div>
        <div class="achievement-info">
          <div class="achievement-name">${ach.title}</div>
          <div class="achievement-desc">${ach.description}</div>
        </div>
        ${ach.unlocked ? `<div class="achievement-date">${ach.date}</div>` : '<div class="achievement-lock">🔒</div>'}
      </div>
    `).join('');
  }

  /**
   * Atualiza os valores das estatísticas
   * @private
   */
  _updateStats() {
    let totalGames = 0;
    let totalWins = 0;
    let highScore = 0;
    let totalTime = 0;

    this.stats.forEach((gameStats) => {
      const history = gameStats.history || [];
      totalGames += history.length;
      totalWins += history.filter(h => h.result === 'win').length;
      totalTime += history.reduce((sum, h) => sum + (h.time_seconds || 0), 0);

      const gameHigh = Math.max(...history.map(h => h.score || 0), 0);
      highScore = Math.max(highScore, gameHigh);
    });

    const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
    const hours = Math.floor(totalTime / 3600);
    const minutes = Math.floor((totalTime % 3600) / 60);

    // Atualizar DOM
    if (this.elements.stats) {
      this.elements.stats.games.textContent = totalGames;
      this.elements.stats.score.textContent = highScore.toLocaleString();
      this.elements.stats.winrate.textContent = `${winRate}%`;
      this.elements.stats.time.textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    // Atualizar anel de progresso
    const progressRing = document.getElementById('winrate-progress');
    if (progressRing) {
      progressRing.setAttribute('stroke-dasharray', `${winRate}, 100`);
    }
  }

  /**
   * Mostra o dashboard
   */
  show() {
    if (!this.elements.dashboard) return;

    this.isVisible = true;
    this.elements.dashboard.classList.remove('hidden');
    this.elements.dashboard.classList.add('animate-fade-in');

    // Atualizar dados
    this._refreshData();

    // Efeito de entrada
    this.animations.slideUp(this.elements.dashboard, { duration: 300 });

    // Emitir evento
    this.hooks.emit('dashboard:show', { timestamp: Date.now() });
  }

  /**
   * Esconde o dashboard
   */
  hide() {
    if (!this.elements.dashboard) return;

    this.animations.fadeOut(this.elements.dashboard, {
      duration: 200,
      onComplete: () => {
        this.elements.dashboard.classList.add('hidden');
        this.isVisible = false;
      }
    });

    this.hooks.emit('dashboard:hide', { timestamp: Date.now() });
  }

  /**
   * Atualiza os dados do dashboard
   * @private
   */
  async _refreshData() {
    await this._loadData();
    this._updateStats();
    this._drawPerformanceChart();
    this._generateHeatmap();
    this._renderAchievements();
  }

  /**
   * Handler para mudanças no storage
   * @private
   */
  _handleStorageChange(e) {
    if (e.key?.startsWith('gamehub_')) {
      this._refreshData();
    }
  }

  /**
   * Handler para mudanças de visibilidade da página
   * @private
   */
  _handleVisibilityChange() {
    if (document.visibilityState === 'visible' && this.isVisible) {
      this._refreshData();
    }
  }

  /**
   * Destrói o dashboard e limpa recursos
   */
  destroy() {
    // Limpar event listeners
    document.removeEventListener('keydown', this._handleKeyDown);
    window.removeEventListener('storage', this._handleStorageChange);
    document.removeEventListener('visibilitychange', this._handleVisibilityChange);

    // Destruir partículas
    if (this.particles) {
      this.particles.destroy();
    }

    // Remover DOM
    this.elements.dashboard?.remove();

    // Limpar hooks
    this.hooks.destroy?.();
  }

  /**
   * Utilitário: capitaliza string
   * @private
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Cria um dashboard global singleton
 * @returns {GameDashboard}
 */
export function createDashboard(options = {}) {
  return new GameDashboard(options);
}

/**
 * Mostra o dashboard de estatísticas
 * @param {string} [gameId] - ID do jogo específico (opcional)
 */
export function showDashboard(gameId = null) {
  const dashboard = new GameDashboard({
    container: document.body,
    gameId,
    showParticles: true
  });

  dashboard.show();
  return dashboard;
}

// Exportar como default
export default GameDashboard;
