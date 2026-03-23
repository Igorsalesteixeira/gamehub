-- =============================================
-- TOURNAMENTS SYSTEM
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

-- Row Level Security
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

-- Policies: tournaments
CREATE POLICY "Anyone can view tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Auth users create tournaments" ON tournaments FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator manages tournament" ON tournaments FOR UPDATE USING (auth.uid() = created_by);

-- Policies: participants
CREATE POLICY "Anyone can view participants" ON tournament_participants FOR SELECT USING (true);
CREATE POLICY "Auth users join tournaments" ON tournament_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies: matches
CREATE POLICY "Anyone can view matches" ON tournament_matches FOR SELECT USING (true);
CREATE POLICY "Players update own matches" ON tournament_matches FOR UPDATE USING (auth.uid() IN (player1_id, player2_id));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_game_id ON tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round ON tournament_matches(tournament_id, round);
