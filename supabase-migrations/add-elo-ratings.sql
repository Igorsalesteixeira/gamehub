-- ELO Rating System — player_ratings table
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
CREATE POLICY "Anyone can view ratings" ON player_ratings FOR SELECT USING (true);
CREATE POLICY "Users update own ratings" ON player_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users upsert own ratings" ON player_ratings FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_player_ratings_game_rating ON player_ratings(game_id, rating DESC);
