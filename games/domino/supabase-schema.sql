-- Tabela para salas de Dominó Multiplayer
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS domino_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    player1_name TEXT DEFAULT 'Jogador 1',
    player1_hand JSONB DEFAULT '[]'::jsonb, -- Mão do jogador 1 (apenas ele vê)
    player2_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    player2_name TEXT DEFAULT 'Jogador 2',
    player2_hand JSONB DEFAULT '[]'::jsonb, -- Mão do jogador 2 (apenas ele vê)
    chain JSONB DEFAULT '[]'::jsonb, -- Cadeia de peças jogadas (visível para ambos)
    boneyard JSONB DEFAULT '[]'::jsonb, -- Monte de peças restantes
    current_turn TEXT DEFAULT NULL, -- 'player1' ou 'player2'
    game_status TEXT DEFAULT 'waiting', -- waiting, playing, finished, abandoned
    left_end INTEGER DEFAULT NULL, -- Valor da ponta esquerda
    right_end INTEGER DEFAULT NULL, -- Valor da ponta direita
    consecutive_passes INTEGER DEFAULT 0, -- Contador de passes consecutivos
    winner UUID DEFAULT NULL, -- ID do vencedor
    final_score INTEGER DEFAULT 0, -- Pontuação final
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    finished_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_domino_rooms_status ON domino_rooms(game_status);
CREATE INDEX IF NOT EXISTS idx_domino_rooms_player1 ON domino_rooms(player1_id);
CREATE INDEX IF NOT EXISTS idx_domino_rooms_player2 ON domino_rooms(player2_id);
CREATE INDEX IF NOT EXISTS idx_domino_rooms_updated ON domino_rooms(updated_at);

-- Políticas de segurança RLS (Row Level Security)
ALTER TABLE domino_rooms ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer usuário autenticado pode criar uma sala
CREATE POLICY "Authenticated users can create domino rooms"
    ON domino_rooms FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = player1_id);

-- Política: Jogadores podem ver suas próprias salas
CREATE POLICY "Players can view their domino rooms"
    ON domino_rooms FOR SELECT
    USING (
        auth.uid() = player1_id
        OR auth.uid() = player2_id
        OR (player1_id IS NULL AND game_status = 'waiting')
        OR (player2_id IS NULL AND game_status = 'waiting')
    );

-- Política: Jogadores podem atualizar suas próprias salas
CREATE POLICY "Players can update their domino rooms"
    ON domino_rooms FOR UPDATE
    USING (
        auth.uid() = player1_id
        OR auth.uid() = player2_id
    );

-- Política: Apenas jogadores da sala podem deletar
CREATE POLICY "Players can delete their domino rooms"
    ON domino_rooms FOR DELETE
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
DROP TRIGGER IF EXISTS update_domino_rooms_updated_at ON domino_rooms;
CREATE TRIGGER update_domino_rooms_updated_at
    BEFORE UPDATE ON domino_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para limpar salas antigas (mais de 24 horas sem atividade)
CREATE OR REPLACE FUNCTION cleanup_old_domino_rooms()
RETURNS void AS $$
BEGIN
    DELETE FROM domino_rooms
    WHERE updated_at < NOW() - INTERVAL '24 hours'
    AND game_status IN ('waiting', 'finished', 'abandoned');
END;
$$ language 'plpgsql';

-- Comentários para documentação
COMMENT ON TABLE domino_rooms IS 'Salas de jogo de dominó multiplayer';
COMMENT ON COLUMN domino_rooms.id IS 'UUID único da sala, usado na URL (?room=UUID)';
COMMENT ON COLUMN domino_rooms.player1_hand IS 'Mão do jogador 1 (array de objetos {a, b})';
COMMENT ON COLUMN domino_rooms.player2_hand IS 'Mão do jogador 2 (array de objetos {a, b})';
COMMENT ON COLUMN domino_rooms.chain IS 'Cadeia de peças jogadas (array de objetos {a, b, flipped})';
COMMENT ON COLUMN domino_rooms.boneyard IS 'Monte de peças restantes para compra';
COMMENT ON COLUMN domino_rooms.game_status IS 'waiting=aguardando, playing=jogando, finished=terminado, abandoned=abandonado';
COMMENT ON COLUMN domino_rooms.left_end IS 'Valor numérico da ponta esquerda da cadeia';
COMMENT ON COLUMN domino_rooms.right_end IS 'Valor numérico da ponta direita da cadeia';
