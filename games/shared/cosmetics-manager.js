/**
 * Cosmetics Manager — Loja de Cosméticos do Games Hub
 * Gerencia inventário, equipamento e compra de itens cosméticos
 */

const SHOP_ITEMS = [
  // Card Backs (para jogos de carta)
  { id: 'card_neon', name: 'Neon Glow', desc: 'Costas de carta com brilho neon', icon: '🃏', category: 'card_back', price: 200, rarity: 'incomum', css: 'card-back-neon' },
  { id: 'card_galaxy', name: 'Galáxia', desc: 'Padrão de galáxia nas cartas', icon: '🌌', category: 'card_back', price: 500, rarity: 'raro', css: 'card-back-galaxy' },
  { id: 'card_gold', name: 'Ouro Puro', desc: 'Cartas douradas premium', icon: '✨', category: 'card_back', price: 1000, rarity: 'epico', css: 'card-back-gold' },
  { id: 'card_holographic', name: 'Holográfico', desc: 'Efeito holográfico animado', icon: '🌈', category: 'card_back', price: 2000, rarity: 'lendario', css: 'card-back-holographic' },

  // Temas de Tabuleiro
  { id: 'board_dark', name: 'Modo Escuro', desc: 'Tabuleiro escuro elegante', icon: '🌙', category: 'board_theme', price: 150, rarity: 'comum', css: 'board-dark' },
  { id: 'board_wood', name: 'Madeira Nobre', desc: 'Textura de madeira premium', icon: '🪵', category: 'board_theme', price: 300, rarity: 'incomum', css: 'board-wood' },
  { id: 'board_marble', name: 'Mármore', desc: 'Tabuleiro de mármore polido', icon: '🏛️', category: 'board_theme', price: 600, rarity: 'raro', css: 'board-marble' },
  { id: 'board_cyber', name: 'Cyberpunk', desc: 'Neon e circuitos digitais', icon: '💻', category: 'board_theme', price: 1500, rarity: 'epico', css: 'board-cyber' },

  // Molduras de Avatar
  { id: 'frame_fire', name: 'Moldura Fogo', desc: 'Borda flamejante no avatar', icon: '🔥', category: 'avatar_frame', price: 100, rarity: 'comum', css: 'frame-fire' },
  { id: 'frame_ice', name: 'Moldura Gelo', desc: 'Cristais de gelo no avatar', icon: '❄️', category: 'avatar_frame', price: 100, rarity: 'comum', css: 'frame-ice' },
  { id: 'frame_diamond', name: 'Moldura Diamante', desc: 'Brilho de diamantes', icon: '💎', category: 'avatar_frame', price: 500, rarity: 'raro', css: 'frame-diamond' },
  { id: 'frame_rainbow', name: 'Moldura Arco-íris', desc: 'Gradiente animado multicolorido', icon: '🌈', category: 'avatar_frame', price: 1000, rarity: 'epico', css: 'frame-rainbow' },

  // Efeitos de Celebração
  { id: 'cele_confetti', name: 'Confetti', desc: 'Chuva de confetti na vitória', icon: '🎉', category: 'celebration', price: 200, rarity: 'incomum', css: 'cele-confetti' },
  { id: 'cele_fireworks', name: 'Fogos', desc: 'Fogos de artifício explosivos', icon: '🎆', category: 'celebration', price: 400, rarity: 'raro', css: 'cele-fireworks' },
  { id: 'cele_stars', name: 'Estrelas Cadentes', desc: 'Chuva de estrelas douradas', icon: '⭐', category: 'celebration', price: 300, rarity: 'incomum', css: 'cele-stars' },
  { id: 'cele_lightning', name: 'Tempestade', desc: 'Raios e relâmpagos épicos', icon: '⚡', category: 'celebration', price: 800, rarity: 'epico', css: 'cele-lightning' },

  // Banners de Perfil
  { id: 'banner_sunset', name: 'Pôr do Sol', desc: 'Banner gradiente sunset', icon: '🌅', category: 'profile_banner', price: 250, rarity: 'incomum', css: 'banner-sunset' },
  { id: 'banner_ocean', name: 'Oceano', desc: 'Ondas azuis animadas', icon: '🌊', category: 'profile_banner', price: 250, rarity: 'incomum', css: 'banner-ocean' },
  { id: 'banner_aurora', name: 'Aurora Boreal', desc: 'Luzes do norte vibrantes', icon: '🌌', category: 'profile_banner', price: 750, rarity: 'raro', css: 'banner-aurora' },
  { id: 'banner_dragon', name: 'Dragão', desc: 'Chamas de dragão lendário', icon: '🐉', category: 'profile_banner', price: 2500, rarity: 'lendario', css: 'banner-dragon' },
];

const CATEGORIES = {
  card_back: { name: 'Costas de Carta', icon: '🃏' },
  board_theme: { name: 'Temas de Tabuleiro', icon: '♟️' },
  avatar_frame: { name: 'Molduras de Avatar', icon: '🖼️' },
  celebration: { name: 'Celebrações', icon: '🎉' },
  profile_banner: { name: 'Banners de Perfil', icon: '🏞️' },
};

class CosmeticsManager {
  constructor() {
    this.inventory = this._loadInventory();
    this.equipped = this._loadEquipped();
  }

  _loadInventory() {
    try { return JSON.parse(localStorage.getItem('gamehub_inventory') || '[]'); }
    catch { return []; }
  }
  _saveInventory() { localStorage.setItem('gamehub_inventory', JSON.stringify(this.inventory)); }

  _loadEquipped() {
    try { return JSON.parse(localStorage.getItem('gamehub_equipped') || '{}'); }
    catch { return {}; }
  }
  _saveEquipped() { localStorage.setItem('gamehub_equipped', JSON.stringify(this.equipped)); }

  getShopItems() { return SHOP_ITEMS; }
  getCategories() { return CATEGORIES; }
  getInventory() { return [...this.inventory]; }
  getEquipped() { return { ...this.equipped }; }

  owns(itemId) { return this.inventory.includes(itemId); }

  async purchase(itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) throw new Error('Item não encontrado');
    if (this.owns(itemId)) throw new Error('Já possui este item');

    // Import coin manager dynamically
    const { coinManager } = await import('./coin-manager.js');
    const balance = coinManager.getBalance();
    if (balance < item.price) throw new Error('Moedas insuficientes');

    coinManager.spend(item.price, `Compra: ${item.name}`);
    this.inventory.push(itemId);
    this._saveInventory();

    // Dispatch event
    window.dispatchEvent(new CustomEvent('item-purchased', { detail: item }));

    // Sync to cloud
    this._syncToCloud(itemId);
    return item;
  }

  equip(itemId) {
    if (!this.owns(itemId)) return false;
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return false;
    this.equipped[item.category] = itemId;
    this._saveEquipped();
    window.dispatchEvent(new CustomEvent('item-equipped', { detail: item }));
    return true;
  }

  unequip(category) {
    delete this.equipped[category];
    this._saveEquipped();
  }

  getEquippedItem(category) {
    const id = this.equipped[category];
    if (!id) return null;
    return SHOP_ITEMS.find(i => i.id === id) || null;
  }

  async _syncToCloud(itemId) {
    try {
      const { supabase } = await import('../../supabase.js');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from('user_inventory').insert({
        user_id: session.user.id,
        item_id: itemId,
        purchased_at: new Date().toISOString()
      });
    } catch (e) { console.error('[Cosmetics] Sync failed:', e); }
  }
}

export const cosmeticsManager = new CosmeticsManager();
export { SHOP_ITEMS, CATEGORIES };
