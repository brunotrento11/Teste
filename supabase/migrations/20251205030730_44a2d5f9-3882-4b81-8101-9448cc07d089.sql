-- Tabela para dados de mercado em tempo real (ações, FIIs, ETFs, BDRs)
CREATE TABLE public.brapi_market_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  asset_type TEXT NOT NULL, -- 'stock', 'fii', 'etf', 'bdr'
  short_name TEXT,
  long_name TEXT,
  sector TEXT,
  industry TEXT,
  -- Cotação
  regular_market_price NUMERIC,
  regular_market_change_percent NUMERIC,
  market_cap NUMERIC,
  average_daily_volume NUMERIC,
  -- Fundamentalistas
  price_earnings NUMERIC,
  dividend_yield NUMERIC,
  price_to_book NUMERIC,
  debt_to_equity NUMERIC,
  return_on_equity NUMERIC,
  profit_margins NUMERIC,
  -- Risco calculado
  volatility_1y NUMERIC,
  beta NUMERIC,
  var_95 NUMERIC,
  sharpe_ratio NUMERIC,
  max_drawdown NUMERIC,
  risk_score INTEGER,
  risk_category TEXT,
  -- Metadata
  last_quote_update TIMESTAMP WITH TIME ZONE,
  last_risk_calculation TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_brapi_market_data_ticker ON public.brapi_market_data(ticker);
CREATE INDEX idx_brapi_market_data_asset_type ON public.brapi_market_data(asset_type);
CREATE INDEX idx_brapi_market_data_sector ON public.brapi_market_data(sector);
CREATE INDEX idx_brapi_market_data_risk_score ON public.brapi_market_data(risk_score);

-- Tabela para indicadores econômicos (Selic, IPCA, CDI)
CREATE TABLE public.economic_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicator_type TEXT NOT NULL, -- 'selic', 'ipca', 'cdi'
  reference_date DATE NOT NULL,
  value NUMERIC NOT NULL,
  accumulated_12m NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(indicator_type, reference_date)
);

CREATE INDEX idx_economic_indicators_type_date ON public.economic_indicators(indicator_type, reference_date DESC);

-- Tabela para cache de preços históricos
CREATE TABLE public.brapi_historical_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  price_date DATE NOT NULL,
  open_price NUMERIC,
  high_price NUMERIC,
  low_price NUMERIC,
  close_price NUMERIC,
  adjusted_close NUMERIC,
  volume BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ticker, price_date)
);

CREATE INDEX idx_brapi_historical_ticker_date ON public.brapi_historical_prices(ticker, price_date DESC);

-- Enable RLS
ALTER TABLE public.brapi_market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brapi_historical_prices ENABLE ROW LEVEL SECURITY;

-- Políticas públicas para leitura (dados de mercado são públicos)
CREATE POLICY "Dados de mercado são públicos para leitura" 
ON public.brapi_market_data 
FOR SELECT 
USING (true);

CREATE POLICY "Indicadores econômicos são públicos para leitura" 
ON public.economic_indicators 
FOR SELECT 
USING (true);

CREATE POLICY "Preços históricos são públicos para leitura" 
ON public.brapi_historical_prices 
FOR SELECT 
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_brapi_market_data_updated_at
BEFORE UPDATE ON public.brapi_market_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_economic_indicators_updated_at
BEFORE UPDATE ON public.economic_indicators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();