-- Tabela para salas de Truco Multiplayer
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS truco_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    player1_name TEXT DEFAULT 'Jogador 1',
    player1_connected BOOLEAN DEFAULT true,
    player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    player2_name TEXT DEFAULT 'Jogador 2',
    player2_connected BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'waiting', -- waiting, playing, finished
    game_state JSONB DEFAULT NULL, -- Estado completo do jogo (cartas, pontos, turno)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_move_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_truco_rooms_status ON truco_rooms(status);
CREATE INDEX IF NOT EXISTS idx_truco_rooms_player1 ON truco_rooms(player1_id);
CREATE INDEX IF NOT EXISTS idx_truco_rooms_player2 ON truco_rooms(player2_id);

-- Políticas de segurança RLS (Row Level Security)
ALTER TABLE truco_rooms ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode criar uma sala
CREATE POLICY "Anyone can create truco rooms"
    ON truco_rooms FOR INSERT
    WITH CHECK (true);

-- Política: Jogadores podem ver suas próprias salas
CREATE POLICY "Players can view their rooms"
    ON truco_rooms FOR SELECT
    USING (
        auth.uid() = player1_id
        OR auth.uid() = player2_id
        OR player1_id IS NULL
        OR player2_id IS NULL
    );

-- Política: Jogadores podem atualizar suas próprias salas
CREATE POLICY "Players can update their rooms"
    ON truco_rooms FOR UPDATE
    USING (
        auth.uid() = player1_id
        OR auth.uid() = player2_id
        OR player1_id IS NULL
        OR player2_id IS NULL
    );

-- Política: Apenas jogadores da sala podem deletar
CREATE POLICY "Players can delete their rooms"
    ON truco_rooms FOR DELETE
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
DROP TRIGGER IF EXISTS update_truco_rooms_updated_at ON truco_rooms;
CREATE TRIGGER update_truco_rooms_updated_at
    BEFORE UPDATE ON truco_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Limpar salas antigas (mais de 24 horas sem atividade)
CREATE OR REPLACE FUNCTION cleanup_old_truco_rooms()
RETURNS void AS $$
BEGIN
    DELETE FROM truco_rooms
    WHERE updated_at < NOW() - INTERVAL '24 hours'
    AND status IN ('waiting', 'finished');
END;
$$ language 'plpgsql';

-- Comentários para documentação
COMMENT ON TABLE truco_rooms IS 'Salas de jogo de truco multiplayer';
COMMENT ON COLUMN truco_rooms.game_state IS 'Estado serializado: cartas, pontos, turno, apostas, etc';
COMMENT ON COLUMN truco_rooms.status IS 'waiting=aguardando jogador, playing=jogando, finished=terminado';
