/**
 * Cosmetics Applier — Aplica cosméticos equipados nos jogos
 *
 * Importar em qualquer jogo que suporte cosméticos:
 *   import { applyCosmetics } from '../shared/cosmetics-applier.js';
 *   applyCosmetics(); // aplica no load
 */

import { cosmeticsManager, SHOP_ITEMS } from './cosmetics-manager.js';

// CSS classes for each cosmetic item
const COSMETIC_CSS = {
  // Card backs
  'card-back-neon': `
    .card-back, .card.face-down { background: linear-gradient(135deg, #0ff, #f0f) !important; box-shadow: 0 0 15px rgba(0,255,255,0.4); }
  `,
  'card-back-galaxy': `
    .card-back, .card.face-down { background: linear-gradient(135deg, #0d0d2b, #1a0533, #0d0d2b) !important; box-shadow: 0 0 20px rgba(100,0,200,0.3); }
  `,
  'card-back-gold': `
    .card-back, .card.face-down { background: linear-gradient(135deg, #ffd700, #b8860b, #ffd700) !important; box-shadow: 0 0 15px rgba(255,215,0,0.4); }
  `,
  'card-back-holographic': `
    .card-back, .card.face-down {
      background: linear-gradient(135deg, #ff6b6b, #ffd93d, #6bff6b, #6bcfff, #d16bff) !important;
      background-size: 400% 400% !important;
      animation: holo-shift 3s ease infinite !important;
      box-shadow: 0 0 20px rgba(255,255,255,0.3);
    }
    @keyframes holo-shift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
  `,
  // Board themes
  'board-dark': `
    .board, .game-board, [class*="board"] { background: #1a1a2e !important; }
    .cell, .square, [class*="cell"] { border-color: rgba(255,255,255,0.1) !important; }
  `,
  'board-wood': `
    .board, .game-board, [class*="board"] { background: linear-gradient(135deg, #8B4513, #A0522D, #8B4513) !important; }
  `,
  'board-marble': `
    .board, .game-board, [class*="board"] { background: linear-gradient(135deg, #e8e8e8, #f5f5f5, #d0d0d0) !important; }
  `,
  'board-cyber': `
    .board, .game-board, [class*="board"] { background: #0a0a1a !important; box-shadow: 0 0 30px rgba(0,255,255,0.2); }
    .cell, .square, [class*="cell"] { border-color: rgba(0,255,255,0.2) !important; }
  `,
  // Celebrations
  'cele-confetti': '', // handled via JS
  'cele-fireworks': '',
  'cele-stars': '',
  'cele-lightning': '',
  // Avatar frames
  'frame-fire': `.avatar, .profile-avatar { box-shadow: 0 0 15px rgba(255,100,0,0.6), 0 0 30px rgba(255,50,0,0.3) !important; }`,
  'frame-ice': `.avatar, .profile-avatar { box-shadow: 0 0 15px rgba(100,200,255,0.6), 0 0 30px rgba(50,150,255,0.3) !important; }`,
  'frame-diamond': `.avatar, .profile-avatar { box-shadow: 0 0 20px rgba(185,242,255,0.6), 0 0 40px rgba(185,242,255,0.2) !important; }`,
  'frame-rainbow': `
    .avatar, .profile-avatar {
      box-shadow: 0 0 20px rgba(255,0,0,0.3), 0 0 40px rgba(0,0,255,0.2) !important;
      animation: rainbow-glow 3s ease infinite;
    }
    @keyframes rainbow-glow {
      0% { box-shadow: 0 0 20px rgba(255,0,0,0.4); }
      33% { box-shadow: 0 0 20px rgba(0,255,0,0.4); }
      66% { box-shadow: 0 0 20px rgba(0,0,255,0.4); }
      100% { box-shadow: 0 0 20px rgba(255,0,0,0.4); }
    }
  `,
  // Banners
  'banner-sunset': `.profile-banner { background: linear-gradient(135deg, #ff6b35, #ff1493, #8b5cf6) !important; }`,
  'banner-ocean': `.profile-banner { background: linear-gradient(135deg, #006994, #0099cc, #00bcd4) !important; }`,
  'banner-aurora': `.profile-banner { background: linear-gradient(135deg, #00ff87, #60efff, #b967ff) !important; }`,
  'banner-dragon': `.profile-banner { background: linear-gradient(135deg, #ff0000, #ff6600, #ffcc00) !important; }`,
};

/**
 * Apply currently equipped cosmetics by injecting a <style> tag.
 */
export function applyCosmetics() {
  const equipped = cosmeticsManager.getEquipped();
  let css = '';

  for (const [category, itemId] of Object.entries(equipped)) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item || !item.css) continue;
    const itemCss = COSMETIC_CSS[item.css];
    if (itemCss) css += itemCss + '\n';
  }

  if (!css) return;

  // Remove previous cosmetic styles
  const existing = document.getElementById('gamehub-cosmetics');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = 'gamehub-cosmetics';
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Get the equipped celebration effect name (for game-end animations).
 * @returns {string|null} Effect name: 'confetti', 'fireworks', 'stars', 'lightning'
 */
export function getEquippedCelebration() {
  const item = cosmeticsManager.getEquippedItem('celebration');
  if (!item) return null;
  return item.css.replace('cele-', '');
}

/**
 * Play celebration effect if one is equipped.
 * Call this when the player wins a game.
 */
export function playCelebration() {
  const effect = getEquippedCelebration();
  if (!effect) return;

  const container = document.createElement('div');
  container.className = 'celebration-overlay';
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(container);

  if (effect === 'confetti') {
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('div');
      const colors = ['#ff6b6b','#ffd93d','#6bff6b','#6bcfff','#d16bff','#ff6b35'];
      p.style.cssText = `position:absolute;width:8px;height:8px;background:${colors[i%colors.length]};
        left:${Math.random()*100}%;top:-10px;border-radius:${Math.random()>0.5?'50%':'0'};
        animation:confetti-fall ${1+Math.random()*2}s ease-out forwards;
        animation-delay:${Math.random()*0.5}s;`;
      container.appendChild(p);
    }
  } else if (effect === 'fireworks') {
    for (let i = 0; i < 3; i++) {
      const burst = document.createElement('div');
      burst.style.cssText = `position:absolute;left:${20+Math.random()*60}%;top:${20+Math.random()*40}%;
        width:4px;height:4px;background:#fff;border-radius:50%;
        box-shadow:0 0 30px 15px rgba(255,200,50,0.8);
        animation:firework-burst 0.8s ease-out forwards;
        animation-delay:${i*0.3}s;`;
      container.appendChild(burst);
    }
  } else if (effect === 'stars') {
    for (let i = 0; i < 20; i++) {
      const s = document.createElement('div');
      s.textContent = '⭐';
      s.style.cssText = `position:absolute;left:${Math.random()*100}%;top:-20px;font-size:${12+Math.random()*16}px;
        animation:star-fall ${1.5+Math.random()*2}s ease-out forwards;
        animation-delay:${Math.random()*1}s;`;
      container.appendChild(s);
    }
  } else if (effect === 'lightning') {
    container.style.background = 'rgba(255,255,255,0.3)';
    container.style.animation = 'lightning-flash 0.6s ease-out forwards';
  }

  // Inject animation keyframes
  if (!document.getElementById('celebration-keyframes')) {
    const kf = document.createElement('style');
    kf.id = 'celebration-keyframes';
    kf.textContent = `
      @keyframes confetti-fall { to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
      @keyframes firework-burst { to { box-shadow: 0 0 60px 30px rgba(255,200,50,0); transform: scale(3); opacity: 0; } }
      @keyframes star-fall { to { transform: translateY(100vh) rotate(360deg); opacity: 0; } }
      @keyframes lightning-flash { to { background: transparent; } }
    `;
    document.head.appendChild(kf);
  }

  setTimeout(() => container.remove(), 3000);
}

// Auto-apply on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCosmetics);
  } else {
    applyCosmetics();
  }
}
