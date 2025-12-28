-- FASE 0: Backup completo antes de qualquer alteração
-- Cria snapshot de segurança para permitir rollback se necessário

CREATE TABLE brapi_market_data_backup_20250119 AS 
SELECT * FROM brapi_market_data;