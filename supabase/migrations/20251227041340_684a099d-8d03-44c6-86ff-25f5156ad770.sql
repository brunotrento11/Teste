-- Adicionar coluna JSONB para preferências de acessibilidade
ALTER TABLE profiles 
ADD COLUMN accessibility_settings JSONB DEFAULT NULL;

-- Índice para performance em queries
CREATE INDEX idx_profiles_accessibility_settings 
ON profiles(id) 
WHERE accessibility_settings IS NOT NULL;

-- Comentário para documentação
COMMENT ON COLUMN profiles.accessibility_settings IS 
'User accessibility preferences: {minFontSize, fontScale, reduceMotion, highContrast}';