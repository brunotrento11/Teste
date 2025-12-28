-- Tabela para histórico de validações de qualidade de ativos
CREATE TABLE asset_validation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMPTZ DEFAULT now(),
  total_assets INT NOT NULL,
  bdrs INT NOT NULL,
  fiis INT NOT NULL,
  stocks INT NOT NULL,
  etfs INT NOT NULL,
  units INT NOT NULL,
  bdrs_with_marker INT NOT NULL,
  critical_divergences INT NOT NULL,
  quality_score INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PASSED', 'FAILED')),
  executed_by UUID NOT NULL REFERENCES auth.users(id),
  full_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE asset_validation_history ENABLE ROW LEVEL SECURITY;

-- SELECT: público para leitura (dados de validação são públicos)
CREATE POLICY "Histórico de validação é público para leitura"
  ON asset_validation_history FOR SELECT
  USING (true);

-- INSERT: apenas usuário autenticado pode inserir SEU registro
CREATE POLICY "Usuários autenticados podem inserir validações"
  ON asset_validation_history FOR INSERT
  TO authenticated
  WITH CHECK (executed_by = auth.uid());

-- Índice para performance na ordenação por data
CREATE INDEX idx_validation_history_executed_at 
  ON asset_validation_history(executed_at DESC);