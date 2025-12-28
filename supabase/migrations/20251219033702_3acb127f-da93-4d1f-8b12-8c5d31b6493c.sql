-- Habilitar RLS na tabela de backup (apenas admins devem acessar)
ALTER TABLE brapi_market_data_backup_20250119 ENABLE ROW LEVEL SECURITY;

-- Não criar políticas públicas - tabela de backup deve ser acessível apenas via service role