import '../../auth-check.js';
import { launchConfetti, playSound, shareOnWhatsApp, haptic } from '../shared/game-design-utils.js';
import { supabase } from '../../supabase.js';

let cookies = 0, cps = 0, cpc = 1, totalEarned = 0;
const countEl = document.getElementById('count');
const cpsEl = document.getElementById('cps');
const shopEl = document.getElementById('shop');
const cookieBtn = document.getElementById('cookie-btn');

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

function renderShop() {
  shopEl.innerHTML = '';
  for (let i = 0; i < upgrades.length; i++) {
    const u = upgrades[i];
    const cost = getCost(u);
    const canBuy = cookies >= cost;
    const el = document.createElement('div');
    el.className = `shop-item ${canBuy ? '' : 'locked'}`;
    el.innerHTML = `
      <div class="shop-icon">${u.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${u.name}</div>
        <div class="shop-desc">${u.desc}</div>
      </div>
      <div>
        <div class="shop-cost">🍪 ${formatNum(cost)}</div>
        <div class="shop-owned">${u.owned}x</div>
      </div>
    `;
    if (canBuy) {
      el.addEventListener('click', () => buy(i));
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
  recalcCPS();
  update();
  renderShop();
  save();
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

// Click
cookieBtn.addEventListener('click', (e) => {
  cookies += cpc;
  totalEarned += cpc;
  update();
  renderShop();
  haptic(15);

  // Float text
  const ft = document.createElement('div');
  ft.className = 'float-text';
  ft.textContent = `+${cpc}`;
  ft.style.left = `${e.clientX - 10}px`;
  ft.style.top = `${e.clientY - 20}px`;
  document.body.appendChild(ft);
  setTimeout(() => ft.remove(), 1000);
});

// CPS tick
setInterval(() => {
  if (cps > 0) {
    cookies += cps / 10;
    totalEarned += cps / 10;
    update();
    renderShop();
  }
}, 100);

// Save/Load
function save() {
  const state = { cookies, cpc, totalEarned, upgrades: upgrades.map(u => u.owned) };
  localStorage.setItem('cookieclicker_save', JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem('cookieclicker_save');
  if (!raw) return;
  try {
    const state = JSON.parse(raw);
    cookies = state.cookies || 0;
    cpc = state.cpc || 1;
    totalEarned = state.totalEarned || 0;
    if (state.upgrades) {
      state.upgrades.forEach((owned, i) => { if (upgrades[i]) upgrades[i].owned = owned; });
    }
    recalcCPS();
  } catch (e) {}
}

// Auto-save every 30s
setInterval(save, 30000);

// Save stats periodically
setInterval(async () => {
  if (totalEarned < 100) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    await supabase.from('game_stats').insert({
      user_id: session.user.id, game: 'cookieclicker', result: 'end', moves: Math.floor(totalEarned), time_seconds: 0,
      score: Math.floor(totalEarned),
    });
  }
}, 300000); // Every 5 min

load();
update();
renderShop();
