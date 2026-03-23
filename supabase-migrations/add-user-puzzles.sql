-- =============================================
--  User Puzzles (UGC) — puzzles criados por usuários
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

CREATE POLICY "Anyone can view puzzles"
  ON user_puzzles FOR SELECT USING (true);

CREATE POLICY "Auth users create puzzles"
  ON user_puzzles FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators update own puzzles"
  ON user_puzzles FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Anyone can increment plays"
  ON user_puzzles FOR UPDATE USING (true);

CREATE INDEX idx_user_puzzles_game_type ON user_puzzles(game_type);
CREATE INDEX idx_user_puzzles_share_code ON user_puzzles(share_code);
CREATE INDEX idx_user_puzzles_plays ON user_puzzles(plays DESC);
