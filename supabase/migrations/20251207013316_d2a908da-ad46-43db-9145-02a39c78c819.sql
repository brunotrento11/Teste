-- =============================================
-- FASE 1: CRIAR SCHEMA UNIFICADO
-- =============================================

-- 1. Criar tabela unified_assets (consolidação de todas as fontes)
CREATE TABLE public.unified_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Origem e referência
  source TEXT NOT NULL, -- 'brapi', 'anbima', 'cvm'
  source_id UUID NOT NULL, -- ID na tabela original
  source_table TEXT NOT NULL, -- Nome da tabela fonte para auditoria
  
  -- Identificação do ativo
  asset_type TEXT NOT NULL, -- stock, fii, etf, bdr, cri, cra, debenture, titulo_publico, fidc, fundo, letra_financeira
  asset_code TEXT NOT NULL, -- Ticker ou código do ativo
  display_name TEXT NOT NULL, -- Nome para exibição ao usuário
  
  -- Emissor
  issuer TEXT, -- Emissor/empresa
  issuer_cnpj TEXT, -- CNPJ do emissor (quando disponível)
  
  -- Características do ativo
  maturity_date DATE, -- Data de vencimento (renda fixa)
  profitability TEXT, -- Rentabilidade descritiva
  liquidity TEXT, -- Liquidez (D+0, D+1, etc)
  sector TEXT, -- Setor (renda variável)
  industry TEXT, -- Indústria/subsetor
  
  -- Dados de mercado (principalmente renda variável)
  current_price NUMERIC, -- Preço atual
  price_change_percent NUMERIC, -- Variação %
  market_cap NUMERIC, -- Valor de mercado
  average_volume NUMERIC, -- Volume médio
  dividend_yield NUMERIC, -- Dividend yield
  price_earnings NUMERIC, -- P/L
  price_to_book NUMERIC, -- P/VP
  
  -- Indicadores de risco calculados
  risk_score INTEGER CHECK (risk_score >= 1 AND risk_score <= 20), -- Score 1-20
  risk_category TEXT CHECK (risk_category IN ('Baixo', 'Moderado', 'Alto')), -- Categoria
  volatility_1y NUMERIC, -- Volatilidade anualizada
  beta NUMERIC, -- Beta vs IBOVESPA
  var_95 NUMERIC, -- Value at Risk 95%
  sharpe_ratio NUMERIC, -- Sharpe Ratio
  max_drawdown NUMERIC, -- Drawdown máximo
  std_deviation NUMERIC, -- Desvio padrão
  
  -- Metadados de sincronização
  source_updated_at TIMESTAMPTZ, -- Última atualização na fonte
  risk_calculated_at TIMESTAMPTZ, -- Última cálculo de risco
  
  -- Timestamps padrão
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint de unicidade: um ativo por fonte
  CONSTRAINT unified_assets_source_unique UNIQUE (source, source_id)
);

-- 2. Criar índices otimizados para buscas
CREATE INDEX idx_unified_assets_asset_type ON public.unified_assets(asset_type);
CREATE INDEX idx_unified_assets_asset_code ON public.unified_assets(asset_code);
CREATE INDEX idx_unified_assets_risk_category ON public.unified_assets(risk_category);
CREATE INDEX idx_unified_assets_risk_score ON public.unified_assets(risk_score);
CREATE INDEX idx_unified_assets_source ON public.unified_assets(source);
CREATE INDEX idx_unified_assets_issuer ON public.unified_assets(issuer);
CREATE INDEX idx_unified_assets_maturity ON public.unified_assets(maturity_date) WHERE maturity_date IS NOT NULL;

-- 3. Criar índice GIN para full-text search
CREATE INDEX idx_unified_assets_search ON public.unified_assets 
  USING GIN (to_tsvector('portuguese', coalesce(display_name, '') || ' ' || coalesce(issuer, '') || ' ' || coalesce(asset_code, '')));

-- 4. Habilitar RLS
ALTER TABLE public.unified_assets ENABLE ROW LEVEL SECURITY;

-- 5. Criar policy de leitura pública (dados de mercado são públicos)
CREATE POLICY "Unified assets são públicos para leitura" 
  ON public.unified_assets 
  FOR SELECT 
  USING (true);

-- 6. Criar trigger para atualizar updated_at
CREATE TRIGGER update_unified_assets_updated_at
  BEFORE UPDATE ON public.unified_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Criar view materializada para buscas otimizadas
CREATE MATERIALIZED VIEW public.mv_investment_search AS
SELECT 
  id,
  source,
  source_id,
  asset_type,
  asset_code,
  display_name,
  issuer,
  maturity_date,
  profitability,
  liquidity,
  sector,
  current_price,
  dividend_yield,
  risk_score,
  risk_category,
  volatility_1y,
  beta,
  var_95,
  sharpe_ratio,
  -- Campo de busca full-text pré-computado
  to_tsvector('portuguese', coalesce(display_name, '') || ' ' || coalesce(issuer, '') || ' ' || coalesce(asset_code, '')) as search_vector,
  updated_at
FROM public.unified_assets
WHERE risk_score IS NOT NULL
WITH DATA;

-- 8. Criar índices na view materializada
CREATE UNIQUE INDEX idx_mv_search_id ON public.mv_investment_search(id);
CREATE INDEX idx_mv_search_asset_type ON public.mv_investment_search(asset_type);
CREATE INDEX idx_mv_search_risk_category ON public.mv_investment_search(risk_category);
CREATE INDEX idx_mv_search_vector ON public.mv_investment_search USING GIN(search_vector);

-- 9. Adicionar comentários para documentação
COMMENT ON TABLE public.unified_assets IS 'Tabela consolidada de todos os ativos de investimento (Brapi, ANBIMA, CVM)';
COMMENT ON MATERIALIZED VIEW public.mv_investment_search IS 'View materializada otimizada para busca de investimentos com full-text search';