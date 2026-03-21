-- ============================================
-- SISTEMA SOCIAL - SUPABASE SCHEMA
-- ============================================
-- Execute no Supabase Dashboard SQL Editor
-- ============================================

-- ============================================
-- 1. TABELA: friendships
-- ============================================
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT no_self_friendship CHECK (user_id != friend_id),
    CONSTRAINT unique_friendship UNIQUE (user_id, friend_id)
);

-- ============================================
-- 2. TABELA: notifications
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('friend_request', 'challenge', 'game_invite', 'friend_online', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. TABELA: challenges
-- ============================================
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenged_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    room_id UUID REFERENCES public.game_rooms(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    CONSTRAINT no_self_challenge CHECK (challenger_id != challenged_id)
);

-- ============================================
-- 4. TABELA: user_activity (feed social)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('game_played', 'achievement_unlocked', 'friend_added', 'high_score', 'joined_platform')),
    game TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índices para friendships
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_user_status ON public.friendships(user_id, status);

-- Índices para notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Índices para challenges
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON public.challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON public.challenges(challenged_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_expires_at ON public.challenges(expires_at);

-- Índices para user_activity
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON public.user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON public.user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON public.user_activity(activity_type);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: friendships
-- ============================================

-- Usuários podem ver suas próprias amizades (como user_id ou friend_id)
CREATE POLICY "Usuários veem suas próprias amizades"
    ON public.friendships
    FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Apenas o solicitante pode criar uma amizade
CREATE POLICY "Usuários criam solicitações de amizade"
    ON public.friendships
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Apenas os envolvidos podem atualizar o status
CREATE POLICY "Amigos podem atualizar status"
    ON public.friendships
    FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = friend_id)
    WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- Apenas os envolvidos podem deletar
CREATE POLICY "Amigos podem deletar amizade"
    ON public.friendships
    FOR DELETE
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ============================================
-- RLS POLICIES: notifications
-- ============================================

-- Usuários só veem suas próprias notificações
CREATE POLICY "Usuários veem suas próprias notificações"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Sistema pode criar notificações para qualquer usuário
CREATE POLICY "Sistema cria notificações"
    ON public.notifications
    FOR INSERT
    WITH CHECK (true);

-- Usuários só atualizam suas próprias notificações (marcar como lida)
CREATE POLICY "Usuários atualizam suas notificações"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Usuários só deletam suas próprias notificações
CREATE POLICY "Usuários deletam suas notificações"
    ON public.notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: challenges
-- ============================================

-- Desafiador e desafiado podem ver
CREATE POLICY "Participantes veem desafios"
    ON public.challenges
    FOR SELECT
    USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- Apenas o desafiador pode criar
CREATE POLICY "Desafiador cria desafios"
    ON public.challenges
    FOR INSERT
    WITH CHECK (auth.uid() = challenger_id);

-- Ambos podem atualizar
CREATE POLICY "Participantes atualizam desafios"
    ON public.challenges
    FOR UPDATE
    USING (auth.uid() = challenger_id OR auth.uid() = challenged_id)
    WITH CHECK (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- Ambos podem deletar
CREATE POLICY "Participantes deletam desafios"
    ON public.challenges
    FOR DELETE
    USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- ============================================
-- RLS POLICIES: user_activity
-- ============================================

-- Feed público (amigos veem atividades)
CREATE POLICY "Feed visível para amigos"
    ON public.user_activity
    FOR SELECT
    USING (
        auth.uid() = user_id OR
        auth.uid() IN (
            SELECT friend_id FROM public.friendships
            WHERE user_id = user_activity.user_id AND status = 'accepted'
            UNION
            SELECT user_id FROM public.friendships
            WHERE friend_id = user_activity.user_id AND status = 'accepted'
        )
    );

-- Usuário cria sua própria atividade
CREATE POLICY "Usuário cria atividade"
    ON public.user_activity
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Usuário não atualiza (apenas sistema)
CREATE POLICY "Ninguém atualiza atividade"
    ON public.user_activity
    FOR UPDATE
    USING (false);

-- Usuário pode deletar sua própria atividade
CREATE POLICY "Usuário deleta atividade"
    ON public.user_activity
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- FUNÇÕES AUXILIARES
-- ============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para friendships
DROP TRIGGER IF EXISTS update_friendships_updated_at ON public.friendships;
CREATE TRIGGER update_friendships_updated_at
    BEFORE UPDATE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FUNÇÃO: Criar notificação de solicitação de amizade
-- ============================================
CREATE OR REPLACE FUNCTION public.create_friend_request_notification()
RETURNS TRIGGER AS $$
DECLARE
    sender_name TEXT;
BEGIN
    -- Só cria notificação se for uma nova solicitação pendente
    IF NEW.status = 'pending' THEN
        -- Busca o nome/email do usuário que enviou
        SELECT COALESCE(raw_user_meta_data->>'full_name', email)
        INTO sender_name
        FROM auth.users
        WHERE id = NEW.user_id;

        -- Cria notificação para o destinatário
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            NEW.friend_id,
            'friend_request',
            'Nova solicitação de amizade',
            COALESCE(sender_name, 'Alguém') || ' quer ser seu amigo!',
            jsonb_build_object(
                'sender_id', NEW.user_id,
                'sender_name', sender_name,
                'friendship_id', NEW.id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS friend_request_notification ON public.friendships;
CREATE TRIGGER friend_request_notification
    AFTER INSERT ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION public.create_friend_request_notification();

-- ============================================
-- FUNÇÃO: Criar notificação quando amizade é aceita
-- ============================================
CREATE OR REPLACE FUNCTION public.create_friend_accepted_notification()
RETURNS TRIGGER AS $$
DECLARE
    accepter_name TEXT;
BEGIN
    -- Só cria notificação se mudou de pending para accepted
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
        -- Quem aceitou é o friend_id (quem recebeu a solicitação)
        SELECT COALESCE(raw_user_meta_data->>'full_name', email)
        INTO accepter_name
        FROM auth.users
        WHERE id = NEW.friend_id;

        -- Notifica o solicitante original (user_id)
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            NEW.user_id,
            'friend_request',
            'Solicitação aceita!',
            COALESCE(accepter_name, 'Alguém') || ' aceitou seu pedido de amizade!',
            jsonb_build_object(
                'friend_id', NEW.friend_id,
                'friend_name', accepter_name
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS friend_accepted_notification ON public.friendships;
CREATE TRIGGER friend_accepted_notification
    AFTER UPDATE ON public.friendships
    FOR EACH ROW
    EXECUTE FUNCTION public.create_friend_accepted_notification();

-- ============================================
-- FUNÇÃO: Criar notificação de desafio
-- ============================================
CREATE OR REPLACE FUNCTION public.create_challenge_notification()
RETURNS TRIGGER AS $$
DECLARE
    challenger_name TEXT;
BEGIN
    -- Só cria notificação se for novo desafio pendente
    IF NEW.status = 'pending' THEN
        -- Busca nome do desafiador
        SELECT COALESCE(raw_user_meta_data->>'full_name', email)
        INTO challenger_name
        FROM auth.users
        WHERE id = NEW.challenger_id;

        -- Cria notificação para o desafiado
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            NEW.challenged_id,
            'challenge',
            'Novo desafio recebido!',
            COALESCE(challenger_name, 'Alguém') || ' te desafiou para ' || NEW.game_type,
            jsonb_build_object(
                'challenger_id', NEW.challenger_id,
                'challenger_name', challenger_name,
                'game_type', NEW.game_type,
                'challenge_id', NEW.id,
                'room_id', NEW.room_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS challenge_notification ON public.challenges;
CREATE TRIGGER challenge_notification
    AFTER INSERT ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION public.create_challenge_notification();

-- ============================================
-- FUNÇÃO: Criar notificação quando desafio é aceito
-- ============================================
CREATE OR REPLACE FUNCTION public.create_challenge_accepted_notification()
RETURNS TRIGGER AS $$
DECLARE
    challenged_name TEXT;
BEGIN
    -- Só cria notificação se mudou de pending para accepted
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
        SELECT COALESCE(raw_user_meta_data->>'full_name', email)
        INTO challenged_name
        FROM auth.users
        WHERE id = NEW.challenged_id;

        -- Notifica o desafiador
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
            NEW.challenger_id,
            'challenge',
            'Desafio aceito!',
            COALESCE(challenged_name, 'Alguém') || ' aceitou seu desafio de ' || NEW.game_type,
            jsonb_build_object(
                'challenge_id', NEW.id,
                'room_id', NEW.room_id,
                'opponent_id', NEW.challenged_id,
                'opponent_name', challenged_name
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS challenge_accepted_notification ON public.challenges;
CREATE TRIGGER challenge_accepted_notification
    AFTER UPDATE ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION public.create_challenge_accepted_notification();

-- ============================================
-- FUNÇÃO: Expirar desafios antigos automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.expire_old_challenges()
RETURNS void AS $$
BEGIN
    UPDATE public.challenges
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNÇÕES RPC PARA O CLIENTE
-- ============================================

-- Buscar amigos do usuário atual
CREATE OR REPLACE FUNCTION public.get_my_friends()
RETURNS TABLE (
    friend_id UUID,
    friend_email TEXT,
    friend_name TEXT,
    friend_avatar TEXT,
    status TEXT,
    friendship_id UUID,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN f.user_id = auth.uid() THEN f.friend_id
            ELSE f.user_id
        END as friend_id,
        u.email as friend_email,
        COALESCE(u.raw_user_meta_data->>'full_name', u.email) as friend_name,
        u.raw_user_meta_data->>'avatar_url' as friend_avatar,
        f.status,
        f.id as friendship_id,
        f.created_at
    FROM public.friendships f
    JOIN auth.users u ON (
        CASE
            WHEN f.user_id = auth.uid() THEN f.friend_id = u.id
            ELSE f.user_id = u.id
        END
    )
    WHERE (f.user_id = auth.uid() OR f.friend_id = auth.uid())
    AND f.status = 'accepted'
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Buscar solicitações pendentes
CREATE OR REPLACE FUNCTION public.get_pending_friend_requests()
RETURNS TABLE (
    friendship_id UUID,
    sender_id UUID,
    sender_email TEXT,
    sender_name TEXT,
    sender_avatar TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id as friendship_id,
        f.user_id as sender_id,
        u.email as sender_email,
        COALESCE(u.raw_user_meta_data->>'full_name', u.email) as sender_name,
        u.raw_user_meta_data->>'avatar_url' as sender_avatar,
        f.created_at
    FROM public.friendships f
    JOIN auth.users u ON u.id = f.user_id
    WHERE f.friend_id = auth.uid()
    AND f.status = 'pending'
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Contar notificações não lidas
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM public.notifications
    WHERE user_id = auth.uid() AND is_read = false;
    RETURN count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Marcar todas as notificações como lidas
CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
RETURNS void AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = auth.uid() AND is_read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View: Feed de atividades dos amigos
CREATE OR REPLACE VIEW public.friends_activity_feed AS
SELECT
    a.id,
    a.user_id,
    u.email as user_email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as user_name,
    u.raw_user_meta_data->>'avatar_url' as user_avatar,
    a.activity_type,
    a.game,
    a.details,
    a.created_at
FROM public.user_activity a
JOIN auth.users u ON u.id = a.user_id
WHERE a.user_id = auth.uid()
   OR a.user_id IN (
       SELECT friend_id FROM public.friendships
       WHERE user_id = auth.uid() AND status = 'accepted'
       UNION
       SELECT user_id FROM public.friendships
       WHERE friend_id = auth.uid() AND status = 'accepted'
   )
ORDER BY a.created_at DESC;

-- ============================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON TABLE public.friendships IS 'Armazena relacionamentos de amizade entre usuários';
COMMENT ON TABLE public.notifications IS 'Sistema de notificações em tempo real';
COMMENT ON TABLE public.challenges IS 'Desafios entre jogadores';
COMMENT ON TABLE public.user_activity IS 'Feed de atividades dos usuários';

COMMENT ON COLUMN public.friendships.status IS 'pending, accepted, blocked';
COMMENT ON COLUMN public.notifications.type IS 'friend_request, challenge, game_invite, friend_online, system';
COMMENT ON COLUMN public.challenges.status IS 'pending, accepted, declined, expired';
COMMENT ON COLUMN public.user_activity.activity_type IS 'game_played, achievement_unlocked, friend_added, high_score, joined_platform';

-- ============================================
-- FIM DO SCRIPT
-- ============================================
