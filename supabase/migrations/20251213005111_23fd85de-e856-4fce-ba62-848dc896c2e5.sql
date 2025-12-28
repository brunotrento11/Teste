-- Criar tabela para preferências de filtros do usuário
CREATE TABLE public.user_filter_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  asset_type TEXT, -- NULL = global, 'cri'/'stock'/etc = específico por tipo
  risk_filter TEXT DEFAULT 'all',
  profitability_filter TEXT DEFAULT 'all',
  maturity_filter TEXT DEFAULT 'all',
  sort_by TEXT DEFAULT 'risk_asc',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, asset_type)
);

-- Índice para busca rápida por usuário
CREATE INDEX idx_user_filter_preferences_user_id ON public.user_filter_preferences(user_id);

-- Enable RLS
ALTER TABLE public.user_filter_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver suas próprias preferências"
ON public.user_filter_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias preferências"
ON public.user_filter_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias preferências"
ON public.user_filter_preferences
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias preferências"
ON public.user_filter_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_filter_preferences_updated_at
BEFORE UPDATE ON public.user_filter_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();