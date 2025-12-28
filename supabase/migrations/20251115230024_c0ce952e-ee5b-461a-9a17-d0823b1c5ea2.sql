-- FASE 1: Estrutura de Dados

-- Criar tabela de indicadores de risco
CREATE TABLE public.investment_risk_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_investment_id UUID NOT NULL REFERENCES public.user_investments(id) ON DELETE CASCADE,
  sharpe_ratio DECIMAL(8,4),
  beta DECIMAL(8,4),
  var_95 DECIMAL(8,4), -- Value at Risk 95% confiança
  std_deviation DECIMAL(8,4),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_source TEXT, -- 'brapi.dev' ou 'manual'
  UNIQUE(user_investment_id, calculated_at)
);

-- Criar tabela de histórico de scores de risco gerados pela IA
CREATE TABLE public.risk_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES public.user_investments(id) ON DELETE CASCADE,
  risk_indicators_id UUID REFERENCES public.investment_risk_indicators(id) ON DELETE SET NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 20),
  justification TEXT,
  risk_category TEXT,
  compatible_with_conservador BOOLEAN NOT NULL DEFAULT false,
  compatible_with_moderado BOOLEAN NOT NULL DEFAULT false,
  compatible_with_arrojado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Criar tabela de ranges de score por perfil de investidor
CREATE TABLE public.investor_profile_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_name TEXT UNIQUE NOT NULL,
  min_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adicionar taxas estimadas de retorno anual em investment_categories
ALTER TABLE public.investment_categories
ADD COLUMN estimated_annual_return_min DECIMAL(5,2),
ADD COLUMN estimated_annual_return_max DECIMAL(5,2);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.investment_risk_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_profile_ranges ENABLE ROW LEVEL SECURITY;

-- RLS Policies para investment_risk_indicators
CREATE POLICY "Usuários podem ver indicadores de seus próprios investimentos"
ON public.investment_risk_indicators
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_investments
    WHERE user_investments.id = investment_risk_indicators.user_investment_id
    AND user_investments.user_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem inserir indicadores de seus próprios investimentos"
ON public.investment_risk_indicators
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_investments
    WHERE user_investments.id = investment_risk_indicators.user_investment_id
    AND user_investments.user_id = auth.uid()
  )
);

-- RLS Policies para risk_score_history
CREATE POLICY "Usuários podem ver scores de seus próprios investimentos"
ON public.risk_score_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_investments
    WHERE user_investments.id = risk_score_history.investment_id
    AND user_investments.user_id = auth.uid()
  )
);

CREATE POLICY "Usuários podem inserir scores de seus próprios investimentos"
ON public.risk_score_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_investments
    WHERE user_investments.id = risk_score_history.investment_id
    AND user_investments.user_id = auth.uid()
  )
);

-- RLS Policy para investor_profile_ranges (leitura pública)
CREATE POLICY "Todos podem visualizar ranges de perfis"
ON public.investor_profile_ranges
FOR SELECT
USING (true);

-- Popular investor_profile_ranges com dados iniciais
INSERT INTO public.investor_profile_ranges (profile_name, min_score, max_score, description) VALUES
('conservador', 1, 8, 'Baixa tolerância ao risco, prioriza preservação de capital'),
('moderado', 7, 14, 'Tolerância média ao risco, busca equilíbrio entre segurança e rentabilidade'),
('arrojado', 12, 20, 'Alta tolerância ao risco, busca máxima rentabilidade');

-- Popular investment_categories com taxas estimadas de retorno
UPDATE public.investment_categories
SET 
  estimated_annual_return_min = CASE name
    WHEN 'Tesouro Direto' THEN 10.5
    WHEN 'CDB' THEN 11.0
    WHEN 'LCI' THEN 9.5
    WHEN 'LCA' THEN 9.5
    WHEN 'CRI' THEN 10.0
    WHEN 'CRA' THEN 10.0
    WHEN 'Debêntures' THEN 11.5
    WHEN 'Fundos de Renda Fixa' THEN 10.0
    WHEN 'Fundos Multimercado' THEN 12.0
    WHEN 'Fundos de Ações' THEN 15.0
    WHEN 'Ações' THEN 12.0
    WHEN 'FIIs' THEN 11.0
    WHEN 'ETFs' THEN 13.0
    WHEN 'BDRs' THEN 14.0
    WHEN 'Fundos Imobiliários' THEN 11.0
    WHEN 'COE' THEN 9.0
    WHEN 'Previdência Privada' THEN 10.5
    WHEN 'Criptomoedas' THEN 20.0
    WHEN 'Ouro' THEN 8.0
    WHEN 'Câmbio' THEN 10.0
    ELSE 10.0
  END,
  estimated_annual_return_max = CASE name
    WHEN 'Tesouro Direto' THEN 13.5
    WHEN 'CDB' THEN 14.0
    WHEN 'LCI' THEN 12.0
    WHEN 'LCA' THEN 12.0
    WHEN 'CRI' THEN 13.0
    WHEN 'CRA' THEN 13.0
    WHEN 'Debêntures' THEN 15.0
    WHEN 'Fundos de Renda Fixa' THEN 13.0
    WHEN 'Fundos Multimercado' THEN 18.0
    WHEN 'Fundos de Ações' THEN 25.0
    WHEN 'Ações' THEN 30.0
    WHEN 'FIIs' THEN 16.0
    WHEN 'ETFs' THEN 22.0
    WHEN 'BDRs' THEN 28.0
    WHEN 'Fundos Imobiliários' THEN 16.0
    WHEN 'COE' THEN 14.0
    WHEN 'Previdência Privada' THEN 14.0
    WHEN 'Criptomoedas' THEN 100.0
    WHEN 'Ouro' THEN 12.0
    WHEN 'Câmbio' THEN 15.0
    ELSE 15.0
  END;

-- Criar índices para melhorar performance
CREATE INDEX idx_investment_risk_indicators_user_investment 
ON public.investment_risk_indicators(user_investment_id);

CREATE INDEX idx_investment_risk_indicators_calculated_at 
ON public.investment_risk_indicators(calculated_at DESC);

CREATE INDEX idx_risk_score_history_investment 
ON public.risk_score_history(investment_id);

CREATE INDEX idx_risk_score_history_created_at 
ON public.risk_score_history(created_at DESC);