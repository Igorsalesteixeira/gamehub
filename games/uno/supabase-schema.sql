-- Tabela para salas de Uno Multiplayer
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS uno_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    host_name TEXT DEFAULT 'Jogador 1',
    guest_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    guest_name TEXT DEFAULT 'Jogador 2',
    status TEXT DEFAULT 'waiting', -- waiting, playing, finished
    game_state JSONB DEFAULT NULL, -- Estado completo do jogo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_uno_rooms_status ON uno_rooms(status);
CREATE INDEX IF NOT EXISTS idx_uno_rooms_host ON uno_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_uno_rooms_guest ON uno_rooms(guest_id);

-- Políticas de segurança RLS (Row Level Security)
ALTER TABLE uno_rooms ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer um pode criar uma sala
CREATE POLICY "Anyone can create uno rooms"
    ON uno_rooms FOR INSERT
    WITH CHECK (true);

-- Política: Jogadores podem ver suas próprias salas
CREATE POLICY "Players can view their rooms"
    ON uno_rooms FOR SELECT
    USING (
        auth.uid() = host_id
        OR auth.uid() = guest_id
        OR host_id IS NULL
        OR guest_id IS NULL
    );

-- Política: Jogadores podem atualizar suas próprias salas
CREATE POLICY "Players can update their rooms"
    ON uno_rooms FOR UPDATE
    USING (
        auth.uid() = host_id
        OR auth.uid() = guest_id
        OR host_id IS NULL
        OR guest_id IS NULL
    );

-- Política: Apenas jogadores da sala podem deletar
CREATE POLICY "Players can delete their rooms"
    ON uno_rooms FOR DELETE
    USING (
        auth.uid() = host_id
        OR auth.uid() = guest_id
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
DROP TRIGGER IF EXISTS update_uno_rooms_updated_at ON uno_rooms;
CREATE TRIGGER update_uno_rooms_updated_at
    BEFORE UPDATE ON uno_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Limpar salas antigas (mais de 24 horas sem atividade)
CREATE OR REPLACE FUNCTION cleanup_old_uno_rooms()
RETURNS void AS $$
BEGIN
    DELETE FROM uno_rooms
    WHERE updated_at < NOW() - INTERVAL '24 hours'
    AND status IN ('waiting', 'finished');
END;
$$ language 'plpgsql';

-- Comentários para documentação
COMMENT ON TABLE uno_rooms IS 'Salas de jogo de Uno multiplayer';
COMMENT ON COLUMN uno_rooms.id IS 'UUID único da sala, usado na URL';
COMMENT ON COLUMN uno_rooms.game_state IS 'Estado serializado: cartas, turno, direção, cores, etc';
COMMENT ON COLUMN uno_rooms.status IS 'waiting=aguardando jogador, playing=jogando, finished=terminado';
