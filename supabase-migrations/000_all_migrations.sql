-- =============================================
-- GAME HUB — Migração Consolidada
-- =============================================
-- Este arquivo contém TODAS as migrações do banco de dados
-- em ordem correta de dependências.
--
-- Como usar:
--   1. Abra o Supabase SQL Editor
--   2. Cole este arquivo inteiro e execute
--   3. Todas as tabelas, indexes e RLS policies serão criadas
--
-- Este script é IDEMPOTENTE — pode ser executado múltiplas vezes
-- sem causar erros (usa IF NOT EXISTS / IF NOT EXISTS).
--
-- Pré-requisito: a tabela "profiles" já deve existir
-- (criada automaticamente pelo Supabase Auth trigger).
-- =============================================


-- =============================================
-- 1. COINS (profiles.total_coins + coin_transactions)
-- =============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_coins INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  game_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id);

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coin_transactions' AND policyname = 'Users can read own transactions') THEN
    CREATE POLICY "Users can read own transactions" ON coin_transactions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'coin_transactions' AND policyname = 'Users can insert own transactions') THEN
    CREATE POLICY "Users can insert own transactions" ON coin_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================
-- 2. STREAKS (profiles streak columns + daily_activity)
-- =============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_date DATE;

CREATE TABLE IF NOT EXISTS daily_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  games_played INTEGER DEFAULT 0,
  coins_earned INTEGER DEFAULT 0,
  UNIQUE(user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_activity_user ON daily_activity(user_id, activity_date);

ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_activity' AND policyname = 'Users can read own activity') THEN
    CREATE POLICY "Users can read own activity" ON daily_activity FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_activity' AND policyname = 'Users can insert own activity') THEN
    CREATE POLICY "Users can insert own activity" ON daily_activity FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_activity' AND policyname = 'Users can update own activity') THEN
    CREATE POLICY "Users can update own activity" ON daily_activity FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================
-- 3. ACHIEVEMENTS (achievements + user_achievements)
-- =============================================

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  coins INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_achievements' AND policyname = 'Users see own achievements') THEN
    CREATE POLICY "Users see own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_achievements' AND policyname = 'Users insert own achievements') THEN
    CREATE POLICY "Users insert own achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================
-- 4. PUSH SUBSCRIPTIONS
-- =============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT,
  keys_auth TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'Users manage own subscriptions') THEN
    CREATE POLICY "Users manage own subscriptions" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================
-- 5. ELO RATINGS (player_ratings)
-- =============================================

CREATE TABLE IF NOT EXISTS player_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  rating INTEGER DEFAULT 1200,
  division TEXT DEFAULT 'Prata',
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, game_id)
);

ALTER TABLE player_ratings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_ratings' AND policyname = 'Anyone can view ratings') THEN
    CREATE POLICY "Anyone can view ratings" ON player_ratings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_ratings' AND policyname = 'Users update own ratings') THEN
    CREATE POLICY "Users update own ratings" ON player_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'player_ratings' AND policyname = 'Users upsert own ratings') THEN
    CREATE POLICY "Users upsert own ratings" ON player_ratings FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_player_ratings_game_rating ON player_ratings(game_id, rating DESC);


-- =============================================
-- 6. TOURNAMENTS (tournaments + participants + matches)
-- =============================================

CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  max_players INTEGER DEFAULT 8,
  status TEXT DEFAULT 'registration',
  registration_end TIMESTAMPTZ,
  current_round INTEGER DEFAULT 0,
  rounds_total INTEGER DEFAULT 3,
  winner_id UUID REFERENCES auth.users(id),
  prize_coins INTEGER DEFAULT 400,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournament_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  seed INTEGER,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id UUID REFERENCES auth.users(id),
  player2_id UUID REFERENCES auth.users(id),
  player1_name TEXT,
  player2_name TEXT,
  winner_id UUID REFERENCES auth.users(id),
  room_id UUID,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Tournaments policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tournaments' AND policyname = 'Anyone can view tournaments') THEN
    CREATE POLICY "Anyone can view tournaments" ON tournaments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tournaments' AND policyname = 'Auth users create tournaments') THEN
    CREATE POLICY "Auth users create tournaments" ON tournaments FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tournaments' AND policyname = 'Creator manages tournament') THEN
    CREATE POLICY "Creator manages tournament" ON tournaments FOR UPDATE USING (auth.uid() = created_by);
  END IF;

  -- Participants policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tournament_participants' AND policyname = 'Anyone can view participants') THEN
    CREATE POLICY "Anyone can view participants" ON tournament_participants FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tournament_participants' AND policyname = 'Auth users join tournaments') THEN
    CREATE POLICY "Auth users join tournaments" ON tournament_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Matches policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tournament_matches' AND policyname = 'Anyone can view matches') THEN
    CREATE POLICY "Anyone can view matches" ON tournament_matches FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tournament_matches' AND policyname = 'Players update own matches') THEN
    CREATE POLICY "Players update own matches" ON tournament_matches FOR UPDATE USING (auth.uid() IN (player1_id, player2_id));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_game_id ON tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round ON tournament_matches(tournament_id, round);


-- =============================================
-- 7. SHOP (shop_items + user_inventory)
-- =============================================

CREATE TABLE IF NOT EXISTS shop_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  rarity TEXT DEFAULT 'comum'
);

CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, item_id)
);

ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_inventory' AND policyname = 'Users see own inventory') THEN
    CREATE POLICY "Users see own inventory" ON user_inventory FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_inventory' AND policyname = 'Users buy items') THEN
    CREATE POLICY "Users buy items" ON user_inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shop_items' AND policyname = 'Anyone views shop') THEN
    CREATE POLICY "Anyone views shop" ON shop_items FOR SELECT USING (true);
  END IF;
END $$;


-- =============================================
-- 8. USER PUZZLES (UGC — puzzles criados por usuários)
-- =============================================

CREATE TABLE IF NOT EXISTS user_puzzles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_type TEXT NOT NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  puzzle_data JSONB NOT NULL,
  difficulty TEXT DEFAULT 'medio',
  share_code TEXT UNIQUE NOT NULL,
  plays INTEGER DEFAULT 0,
  rating_sum INTEGER DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_puzzles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_puzzles' AND policyname = 'Anyone can view puzzles') THEN
    CREATE POLICY "Anyone can view puzzles" ON user_puzzles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_puzzles' AND policyname = 'Auth users create puzzles') THEN
    CREATE POLICY "Auth users create puzzles" ON user_puzzles FOR INSERT WITH CHECK (auth.uid() = creator_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_puzzles' AND policyname = 'Creators update own puzzles') THEN
    CREATE POLICY "Creators update own puzzles" ON user_puzzles FOR UPDATE USING (auth.uid() = creator_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_puzzles' AND policyname = 'Anyone can increment plays') THEN
    CREATE POLICY "Anyone can increment plays" ON user_puzzles FOR UPDATE USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_puzzles_game_type ON user_puzzles(game_type);
CREATE INDEX IF NOT EXISTS idx_user_puzzles_share_code ON user_puzzles(share_code);
CREATE INDEX IF NOT EXISTS idx_user_puzzles_plays ON user_puzzles(plays DESC);


-- =============================================
-- FIM — Todas as migrações aplicadas com sucesso!
-- =============================================
