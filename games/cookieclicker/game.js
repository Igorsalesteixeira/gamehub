import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { GameStats, GameStorage } from '../shared/game-core.js';
import { onGameEnd } from '../shared/game-integration.js';

// ===== Cookie Clicker (Refatorado) =====

let cookies = 0;
let cps = 0;
let cpc = 1;
let totalEarned = 0;

const countEl = document.getElementById('count');
const cpsEl = document.getElementById('cps');
const shopEl = document.getElementById('shop');
const cookieBtn = document.getElementById('cookie-btn');

// Store interval references for cleanup
let cpsInterval = null;
let autoSaveInterval = null;
let statsSyncInterval = null;

// Debounce timer for renderShop
let renderShopDebounceTimer = null;

const upgrades = [
  { name: 'Cursor', desc: '+0.1 por segundo', icon: '👆', baseCost: 15, cps: 0.1, owned: 0 },
  { name: 'Vovo', desc: '+1 por segundo', icon: '👵', baseCost: 100, cps: 1, owned: 0 },
  { name: 'Fazenda', desc: '+8 por segundo', icon: '🌾', baseCost: 1100, cps: 8, owned: 0 },
  { name: 'Mina', desc: '+47 por segundo', icon: '⛏️', baseCost: 12000, cps: 47, owned: 0 },
  { name: 'Fabrica', desc: '+260 por segundo', icon: '🏭', baseCost: 130000, cps: 260, owned: 0 },
  { name: 'Banco', desc: '+1400 por segundo', icon: '🏦', baseCost: 1200000, cps: 1400, owned: 0 },
  { name: 'Duplo Clique', desc: '+1 por clique', icon: '✌️', baseCost: 500, cps: 0, cpcAdd: 1, owned: 0 },
  { name: 'Mega Clique', desc: '+5 por clique', icon: '💪', baseCost: 5000, cps: 0, cpcAdd: 5, owned: 0 },
];

// ===== STATS =====
const gameStats = new GameStats('cookieclicker', { autoSync: true });
const gameStorage = new GameStorage('cookieclicker');

// ===== UTILITY FUNCTIONS =====
function getCost(u) {
  return Math.floor(u.baseCost * Math.pow(1.15, u.owned));
}

function formatNum(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

// Debounced renderShop for performance
function debouncedRenderShop() {
  if (renderShopDebounceTimer) {
    clearTimeout(renderShopDebounceTimer);
  }
  renderShopDebounceTimer = setTimeout(() => {
    renderShopImmediate();
    renderShopDebounceTimer = null;
  }, 50);
}

function renderShopImmediate() {
  shopEl.innerHTML = '';
  for (let i = 0; i < upgrades.length; i++) {
    const u = upgrades[i];
    const cost = getCost(u);
    const canBuy = cookies >= cost;
    const el = document.createElement('div');
    el.className = `shop-item ${canBuy ? '' : 'locked'}`;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', canBuy ? '0' : '-1');
    el.setAttribute('aria-label', `${u.name}. ${u.desc}. Custo: ${formatNum(cost)} cookies. Voce tem ${u.owned}.`);
    el.setAttribute('aria-disabled', !canBuy);

    el.innerHTML = `
      <div class="shop-icon" aria-hidden="true">${u.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${u.name}</div>
        <div class="shop-desc">${u.desc}</div>
      </div>
      <div class="shop-meta">
        <div class="shop-cost">🍪 ${formatNum(cost)}</div>
        <div class="shop-owned">${u.owned}x</div>
      </div>
    `;

    if (canBuy) {
      el.addEventListener('click', () => buy(i));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          buy(i);
        }
      });
    }
    shopEl.appendChild(el);
  }
}

function buy(idx) {
  const u = upgrades[idx];
  const cost = getCost(u);
  if (cookies < cost) return;

  cookies -= cost;
  u.owned++;

  if (u.cpcAdd) cpc += u.cpcAdd;

  // Purchase animation
  const items = shopEl.querySelectorAll('.shop-item');
  if (items[idx]) {
    items[idx].classList.add('purchasing');
    setTimeout(() => items[idx].classList.remove('purchasing'), 300);
  }

  recalcCPS();
  update();
  renderShopImmediate();
  save();

  // Haptic feedback on purchase
  haptic(30);
}

function recalcCPS() {
  cps = 0;
  for (const u of upgrades) {
    cps += u.cps * u.owned;
  }
}

function update() {
  countEl.textContent = formatNum(cookies);
  cpsEl.textContent = formatNum(cps);
}

// ===== CLICK HANDLER =====
cookieBtn.addEventListener('click', (e) => {
  cookies += cpc;
  totalEarned += cpc;
  update();
  debouncedRenderShop();
  haptic(15);

  // Float text animation
  const ft = document.createElement('div');
  ft.className = 'float-text';
  ft.textContent = `+${cpc}`;
  ft.style.left = `${e.clientX - 10}px`;
  ft.style.top = `${e.clientY - 20}px`;
  ft.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ft);
  setTimeout(() => ft.remove(), 1000);
});

// Keyboard support for cookie button
cookieBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    const rect = cookieBtn.getBoundingClientRect();
    const fakeEvent = {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
    cookies += cpc;
    totalEarned += cpc;
    update();
    debouncedRenderShop();
    haptic(15);

    const ft = document.createElement('div');
    ft.className = 'float-text';
    ft.textContent = `+${cpc}`;
    ft.style.left = `${fakeEvent.clientX - 10}px`;
    ft.style.top = `${fakeEvent.clientY - 20}px`;
    ft.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ft);
    setTimeout(() => ft.remove(), 1000);
  }
});

// ===== GAME LOOP =====
function startGameLoop() {
  // CPS tick - 10 times per second for smooth accumulation
  cpsInterval = setInterval(() => {
    if (cps > 0) {
      cookies += cps / 10;
      totalEarned += cps / 10;
      update();
      debouncedRenderShop();
    }
  }, 100);

  // Auto-save every 30s
  autoSaveInterval = setInterval(save, 30000);

  // Sync stats to cloud every 5 minutes
  statsSyncInterval = setInterval(async () => {
    if (totalEarned < 100) return;

    // Use GameStats.recordGame() instead of manual insert
    gameStats.update({
      highScore: Math.max(gameStats.get().highScore, Math.floor(totalEarned)),
      totalScore: gameStats.get().totalScore + Math.floor(cps * 300),
      gamesPlayed: gameStats.get().gamesPlayed + 1
    });

    await gameStats.syncToCloud();
    onGameEnd('cookieclicker', { won: true, score: Math.floor(totalEarned) });
  }, 300000);
}

// ===== SAVE/LOAD =====
function save() {
  const state = {
    cookies,
    cpc,
    totalEarned,
    upgrades: upgrades.map(u => u.owned)
  };
  gameStorage.set('save', state);
}

function load() {
  const data = gameStorage.get('save');
  if (!data) return;

  try {
    cookies = data.cookies || 0;
    cpc = data.cpc || 1;
    totalEarned = data.totalEarned || 0;

    if (data.upgrades) {
      data.upgrades.forEach((owned, i) => {
        if (upgrades[i]) upgrades[i].owned = owned;
      });
    }

    recalcCPS();
  } catch (e) {
    console.warn('[CookieClicker] Error loading save:', e);
  }
}

// ===== CLEANUP ON UNLOAD =====
function cleanup() {
  if (cpsInterval) {
    clearInterval(cpsInterval);
    cpsInterval = null;
  }
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
  if (statsSyncInterval) {
    clearInterval(statsSyncInterval);
    statsSyncInterval = null;
  }
  if (renderShopDebounceTimer) {
    clearTimeout(renderShopDebounceTimer);
    renderShopDebounceTimer = null;
  }

  // Save before leaving
  save();

  // Stop GameStats auto-sync
  gameStats.destroy();
}

// Use both unload and pagehide for better compatibility
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);

// ===== VISIBILITY CHANGE HANDLER =====
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    save();
  }
});

// ===== INITIALIZE =====
load();
update();
renderShopImmediate();
startGameLoop();