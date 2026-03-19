-- Tabela para salas de Xadrez Multiplayer
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS chess_rooms (
    id SERIAL PRIMARY KEY,
    room_id UUID UNIQUE NOT NULL,
    player1_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    player1_name TEXT DEFAULT 'Jogador 1',
    player1_connected BOOLEAN DEFAULT true,
    player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    player2_name TEXT DEFAULT 'Jogador 2',
    player2_connected BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'waiting', -- waiting, playing, finished
    game_state JSONB DEFAULT NULL, -- Estado completo do jogo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_move_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chess_rooms_room_id ON chess_rooms(room_id);
CREATE INDEX IF NOT EXISTS idx_chess_rooms_status ON chess_rooms(status);
CREATE INDEX IF NOT EXISTS idx_chess_rooms_player1 ON chess_rooms(player1_id);
CREATE INDEX IF NOT EXISTS idx_chess_rooms_player2 ON chess_rooms(player2_id);

-- Políticas de segurança RLS (Row Level Security)
ALTER TABLE chess_rooms ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode criar uma sala
CREATE POLICY "Anyone can create chess rooms"
    ON chess_rooms FOR INSERT
    WITH CHECK (true);

-- Política: Jogadores podem ver suas próprias salas
CREATE POLICY "Players can view their rooms"
    ON chess_rooms FOR SELECT
    USING (
        auth.uid() = player1_id
        OR auth.uid() = player2_id
        OR player1_id IS NULL
        OR player2_id IS NULL
    );

-- Política: Jogadores podem atualizar suas próprias salas
CREATE POLICY "Players can update their rooms"
    ON chess_rooms FOR UPDATE
    USING (
        auth.uid() = player1_id
        OR auth.uid() = player2_id
        OR player1_id IS NULL
        OR player2_id IS NULL
    );

-- Política: Apenas jogadores da sala podem deletar
CREATE POLICY "Players can delete their rooms"
    ON chess_rooms FOR DELETE
    USING (
        auth.uid() = player1_id
        OR auth.uid() = player2_id
    );

-- Função para atualizar o timestamp automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_chess_rooms_updated_at ON chess_rooms;
CREATE TRIGGER update_chess_rooms_updated_at
    BEFORE UPDATE ON chess_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Limpar salas antigas (mais de 24 horas sem atividade)
CREATE OR REPLACE FUNCTION cleanup_old_chess_rooms()
RETURNS void AS $$
BEGIN
    DELETE FROM chess_rooms
    WHERE updated_at < NOW() - INTERVAL '24 hours'
    AND status IN ('waiting', 'finished');
END;
$$ language 'plpgsql';

-- Comentários para documentação
COMMENT ON TABLE chess_rooms IS 'Salas de jogo de xadrez multiplayer';
COMMENT ON COLUMN chess_rooms.room_id IS 'UUID único da sala, usado na URL';
COMMENT ON COLUMN chess_rooms.game_state IS 'Estado serializado do tabuleiro, turno, direitos de roque, etc';
COMMENT ON COLUMN chess_rooms.status IS 'waiting=aguardando jogador, playing=jogando, finished=terminado';
