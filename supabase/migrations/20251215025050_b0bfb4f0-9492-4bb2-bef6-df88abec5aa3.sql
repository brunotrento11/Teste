-- Adicionar campos estruturados para separar dados contratuais de dados de mercado
ALTER TABLE unified_assets 
ADD COLUMN IF NOT EXISTS contract_indexer TEXT,
ADD COLUMN IF NOT EXISTS contract_spread_percent NUMERIC,
ADD COLUMN IF NOT EXISTS contract_rate_type TEXT,
ADD COLUMN IF NOT EXISTS market_rate_indicative_percent NUMERIC,
ADD COLUMN IF NOT EXISTS market_rate_buy_percent NUMERIC,
ADD COLUMN IF NOT EXISTS market_rate_sell_percent NUMERIC,
ADD COLUMN IF NOT EXISTS market_source TEXT,
ADD COLUMN IF NOT EXISTS yield_profile TEXT;

-- Criar índice para filtro por yield_profile
CREATE INDEX IF NOT EXISTS idx_unified_assets_yield_profile ON unified_assets(yield_profile);

-- Criar índice para filtro por contract_indexer
CREATE INDEX IF NOT EXISTS idx_unified_assets_contract_indexer ON unified_assets(contract_indexer);

-- Comentários para documentação
COMMENT ON COLUMN unified_assets.contract_indexer IS 'Indexador contratual: CDI, IPCA, IGPM, SELIC, PREFIXADO';
COMMENT ON COLUMN unified_assets.contract_spread_percent IS 'Spread contratual sobre o indexador (ex: 5.48 para IPCA+5.48%)';
COMMENT ON COLUMN unified_assets.contract_rate_type IS 'Tipo de taxa: PERCENT_INDEXADOR, INDEXADOR_PLUS_SPREAD, TAXA_FIXA, VARIAVEL';
COMMENT ON COLUMN unified_assets.market_rate_indicative_percent IS 'Taxa indicativa ANBIMA (marcação a mercado, % a.a. base 252)';
COMMENT ON COLUMN unified_assets.market_rate_buy_percent IS 'Taxa de compra mercado secundário';
COMMENT ON COLUMN unified_assets.market_rate_sell_percent IS 'Taxa de venda mercado secundário';
COMMENT ON COLUMN unified_assets.market_source IS 'Fonte dos dados de mercado: ANBIMA_DEBENTURES, ANBIMA_TITULOS_PUBLICOS, etc.';
COMMENT ON COLUMN unified_assets.yield_profile IS 'Classificação automática: PREFIXADO, POS_CDI, HIBRIDO_IPCA, HIBRIDO_IGPM, VARIAVEL, DESCONHECIDO';

-- Recriar a materialized view com os novos campos
DROP MATERIALIZED VIEW IF EXISTS mv_investment_search;

CREATE MATERIALIZED VIEW mv_investment_search AS
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
  updated_at,
  -- Novos campos estruturados
  contract_indexer,
  contract_spread_percent,
  contract_rate_type,
  market_rate_indicative_percent,
  market_source,
  yield_profile,
  -- Campo de busca full-text
  to_tsvector('portuguese', 
    coalesce(display_name, '') || ' ' || 
    coalesce(issuer, '') || ' ' || 
    coalesce(asset_code, '')
  ) as search_vector
FROM unified_assets
WHERE risk_score IS NOT NULL;

-- Índice para performance de busca full-text
CREATE INDEX IF NOT EXISTS idx_mv_search_vector ON mv_investment_search USING GIN(search_vector);

-- Índice para yield_profile na view
CREATE INDEX IF NOT EXISTS idx_mv_yield_profile ON mv_investment_search(yield_profile);

-- Índice para filtros comuns
CREATE INDEX IF NOT EXISTS idx_mv_risk_score ON mv_investment_search(risk_score);
CREATE INDEX IF NOT EXISTS idx_mv_asset_type ON mv_investment_search(asset_type);
CREATE INDEX IF NOT EXISTS idx_mv_maturity_date ON mv_investment_search(maturity_date);

-- Refresh inicial
REFRESH MATERIALIZED VIEW mv_investment_search;