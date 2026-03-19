-- ============================================
--  Schema para Poker Multiplayer
-- ============================================

-- Tabela de salas de poker
CREATE TABLE IF NOT EXISTS poker_rooms (
    id SERIAL PRIMARY KEY,
    room_id UUID UNIQUE NOT NULL,
    player1_id TEXT,
    player1_name TEXT DEFAULT 'Jogador 1',
    player2_id TEXT,
    player2_name TEXT DEFAULT 'Jogador 2',
    status TEXT DEFAULT 'waiting', -- waiting, playing, finished
    game_state JSONB,
    player1_connected BOOLEAN DEFAULT false,
    player2_connected BOOLEAN DEFAULT false,
    last_action_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_poker_rooms_room_id ON poker_rooms(room_id);
CREATE INDEX IF NOT EXISTS idx_poker_rooms_status ON poker_rooms(status);
CREATE INDEX IF NOT EXISTS idx_poker_rooms_player1_id ON poker_rooms(player1_id);
CREATE INDEX IF NOT EXISTS idx_poker_rooms_player2_id ON poker_rooms(player2_id);

-- Políticas de segurança (RLS)
ALTER TABLE poker_rooms ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura pública das salas
CREATE POLICY "Allow public read access to poker rooms"
    ON poker_rooms FOR SELECT
    USING (true);

-- Política para permitir inserção pública (criação de salas)
CREATE POLICY "Allow public insert to poker rooms"
    ON poker_rooms FOR INSERT
    WITH CHECK (true);

-- Política para permitir atualização pelos jogadores da sala
CREATE POLICY "Allow update by room players"
    ON poker_rooms FOR UPDATE
    USING (true);

-- Política para permitir exclusão pelo host
CREATE POLICY "Allow delete by room creator"
    ON poker_rooms FOR DELETE
    USING (true);

-- Trigger para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_poker_rooms_updated_at ON poker_rooms;
CREATE TRIGGER update_poker_rooms_updated_at
    BEFORE UPDATE ON poker_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Limpar salas antigas (mais de 24 horas sem atividade)
CREATE OR REPLACE FUNCTION cleanup_old_poker_rooms()
RETURNS void AS $$
BEGIN
    DELETE FROM poker_rooms
    WHERE updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE poker_rooms IS 'Salas de poker multiplayer';
COMMENT ON COLUMN poker_rooms.room_id IS 'UUID único da sala, usado na URL';
COMMENT ON COLUMN poker_rooms.game_state IS 'Estado atual do jogo em JSON';
COMMENT ON COLUMN poker_rooms.status IS 'Estado da sala: waiting, playing, finished';
