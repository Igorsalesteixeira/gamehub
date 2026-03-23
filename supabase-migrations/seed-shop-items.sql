-- =============================================================================
-- Seed: Itens da Loja (Shop Items) do Game Hub
--
-- Popula a tabela 'shop_items' com os 20 itens cosmeticos definidos no
-- cosmetics-manager.js. Idempotente: usa ON CONFLICT (id) DO NOTHING.
--
-- Categorias: card_back, board_theme, avatar_frame, celebration, profile_banner
-- Raridades: comum, incomum, raro, epico, lendario
--
-- Executar apos a migration add-shop.sql
-- =============================================================================

INSERT INTO shop_items (id, name, description, icon, category, price, rarity) VALUES

-- === Card Backs (costas de carta) ===
('card_neon',        'Neon Glow',          'Costas de carta com brilho neon',       E'\U0001F0CF', 'card_back',       200, 'incomum'),
('card_galaxy',      'Galáxia',            'Padrão de galáxia nas cartas',          E'\U0001F30C', 'card_back',       500, 'raro'),
('card_gold',        'Ouro Puro',          'Cartas douradas premium',               E'\u2728',     'card_back',      1000, 'epico'),
('card_holographic', 'Holográfico',        'Efeito holográfico animado',            E'\U0001F308', 'card_back',      2000, 'lendario'),

-- === Board Themes (temas de tabuleiro) ===
('board_dark',       'Modo Escuro',        'Tabuleiro escuro elegante',             E'\U0001F319', 'board_theme',     150, 'comum'),
('board_wood',       'Madeira Nobre',      'Textura de madeira premium',            E'\U0001FAB5', 'board_theme',     300, 'incomum'),
('board_marble',     'Mármore',            'Tabuleiro de mármore polido',           E'\U0001F3DB', 'board_theme',     600, 'raro'),
('board_cyber',      'Cyberpunk',          'Neon e circuitos digitais',             E'\U0001F4BB', 'board_theme',    1500, 'epico'),

-- === Avatar Frames (molduras de avatar) ===
('frame_fire',       'Moldura Fogo',       'Borda flamejante no avatar',            E'\U0001F525', 'avatar_frame',    100, 'comum'),
('frame_ice',        'Moldura Gelo',       'Cristais de gelo no avatar',            E'\u2744',     'avatar_frame',    100, 'comum'),
('frame_diamond',    'Moldura Diamante',   'Brilho de diamantes',                   E'\U0001F48E', 'avatar_frame',    500, 'raro'),
('frame_rainbow',    'Moldura Arco-íris',  'Gradiente animado multicolorido',       E'\U0001F308', 'avatar_frame',   1000, 'epico'),

-- === Celebrations (efeitos de celebracao) ===
('cele_confetti',    'Confetti',           'Chuva de confetti na vitória',          E'\U0001F389', 'celebration',     200, 'incomum'),
('cele_fireworks',   'Fogos',              'Fogos de artifício explosivos',         E'\U0001F386', 'celebration',     400, 'raro'),
('cele_stars',       'Estrelas Cadentes',  'Chuva de estrelas douradas',            E'\u2B50',     'celebration',     300, 'incomum'),
('cele_lightning',   'Tempestade',         'Raios e relâmpagos épicos',             E'\u26A1',     'celebration',     800, 'epico'),

-- === Profile Banners (banners de perfil) ===
('banner_sunset',    'Pôr do Sol',         'Banner gradiente sunset',               E'\U0001F305', 'profile_banner',  250, 'incomum'),
('banner_ocean',     'Oceano',             'Ondas azuis animadas',                  E'\U0001F30A', 'profile_banner',  250, 'incomum'),
('banner_aurora',    'Aurora Boreal',      'Luzes do norte vibrantes',              E'\U0001F30C', 'profile_banner',  750, 'raro'),
('banner_dragon',    'Dragão',             'Chamas de dragão lendário',             E'\U0001F409', 'profile_banner', 2500, 'lendario')

ON CONFLICT (id) DO NOTHING;
