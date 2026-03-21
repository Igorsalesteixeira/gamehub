-- ============================================
-- FIX: Criar tabela profiles corretamente
-- ============================================

-- Primeiro, verifica se a tabela existe e dropa se necessário
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Cria a tabela profiles do zero
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_display_name ON public.profiles(display_name);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Profiles visíveis publicamente"
    ON public.profiles
    FOR SELECT
    USING (true);

CREATE POLICY "Usuários inserem próprio perfil"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Usuários atualizam próprio perfil"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Insere perfis para usuários existentes
INSERT INTO public.profiles (id, username, display_name)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Trigger para novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Verifica se funcionou
SELECT COUNT(*) as total_profiles FROM public.profiles;
