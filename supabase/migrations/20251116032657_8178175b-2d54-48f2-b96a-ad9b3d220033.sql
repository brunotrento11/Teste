-- Create table for pre-calculated ANBIMA asset risk scores
CREATE TABLE IF NOT EXISTS public.anbima_asset_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type TEXT NOT NULL,
  asset_id UUID NOT NULL,
  asset_code TEXT NOT NULL,
  emissor TEXT,
  data_vencimento DATE,
  rentabilidade TEXT,
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 1 AND 20),
  risk_category TEXT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_type, asset_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_risk_scores_asset ON public.anbima_asset_risk_scores(asset_type, asset_code);
CREATE INDEX IF NOT EXISTS idx_risk_scores_emissor ON public.anbima_asset_risk_scores(emissor);
CREATE INDEX IF NOT EXISTS idx_risk_scores_vencimento ON public.anbima_asset_risk_scores(data_vencimento);

-- Enable RLS
ALTER TABLE public.anbima_asset_risk_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read risk scores (public market data)
CREATE POLICY "Risk scores são públicos"
  ON public.anbima_asset_risk_scores
  FOR SELECT
  USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_risk_scores_updated_at
  BEFORE UPDATE ON public.anbima_asset_risk_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();