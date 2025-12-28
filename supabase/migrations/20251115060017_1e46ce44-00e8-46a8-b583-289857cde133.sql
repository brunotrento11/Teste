-- Adicionar campo de email na tabela profiles para facilitar login por CPF
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

-- Criar índice para melhorar performance de busca por email
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);