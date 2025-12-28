-- Criar tabela de estatísticas de execução
CREATE TABLE public.sync_execution_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação da execução
  function_name TEXT NOT NULL,
  execution_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running',
  
  -- Métricas de processamento
  total_assets_processed INTEGER DEFAULT 0,
  total_assets_skipped INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  
  -- Distribuição por tipo de ativo
  distribution_by_type JSONB DEFAULT '{}',
  
  -- Distribuição por categoria de risco
  distribution_by_risk_category JSONB DEFAULT '{}',
  
  -- Métricas de qualidade
  avg_risk_score NUMERIC(5,2),
  min_risk_score INTEGER,
  max_risk_score INTEGER,
  
  -- Detalhes de erros
  error_details JSONB DEFAULT '[]',
  
  -- Metadados
  triggered_by TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX idx_sync_stats_function ON sync_execution_stats(function_name);
CREATE INDEX idx_sync_stats_started_at ON sync_execution_stats(started_at DESC);
CREATE INDEX idx_sync_stats_status ON sync_execution_stats(status);

-- Criar tabela de alertas de anomalias
CREATE TABLE public.sync_anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referência à execução
  execution_id UUID REFERENCES sync_execution_stats(id),
  
  -- Detalhes do alerta
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  
  -- Métricas do alerta
  metric_name TEXT NOT NULL,
  expected_value NUMERIC,
  actual_value NUMERIC,
  deviation_percent NUMERIC(5,2),
  message TEXT,
  
  -- Status do alerta
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_anomaly_alerts_execution ON sync_anomaly_alerts(execution_id);
CREATE INDEX idx_anomaly_alerts_severity ON sync_anomaly_alerts(severity);
CREATE INDEX idx_anomaly_alerts_acknowledged ON sync_anomaly_alerts(is_acknowledged);

-- Enable RLS
ALTER TABLE sync_execution_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_anomaly_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (público para leitura por enquanto, será restrito no dashboard admin)
CREATE POLICY "Stats são públicas para leitura"
  ON sync_execution_stats
  FOR SELECT
  USING (true);

CREATE POLICY "Alertas são públicos para leitura"
  ON sync_anomaly_alerts
  FOR SELECT
  USING (true);