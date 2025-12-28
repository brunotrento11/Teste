-- Criar tabela para armazenar ofertas públicas da CVM
CREATE TABLE public.cvm_ofertas_publicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_ativo TEXT NOT NULL,
  cnpj_emissor TEXT NOT NULL,
  nome_emissor TEXT NOT NULL,
  serie TEXT,
  data_emissao DATE,
  data_vencimento DATE,
  valor_total_emissao NUMERIC,
  juros TEXT,
  atualizacao_monetaria TEXT,
  data_inicio_rentabilidade DATE,
  publico_alvo TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint para evitar duplicatas
  UNIQUE(cnpj_emissor, serie, data_emissao, tipo_ativo)
);

-- Configurar RLS
ALTER TABLE public.cvm_ofertas_publicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dados CVM são públicos para leitura"
  ON public.cvm_ofertas_publicas
  FOR SELECT
  USING (true);

-- Criar índices para performance
CREATE INDEX idx_cvm_ofertas_tipo_ativo ON public.cvm_ofertas_publicas(tipo_ativo);
CREATE INDEX idx_cvm_ofertas_data_vencimento ON public.cvm_ofertas_publicas(data_vencimento);
CREATE INDEX idx_cvm_ofertas_emissor ON public.cvm_ofertas_publicas(nome_emissor);
CREATE INDEX idx_cvm_ofertas_is_active ON public.cvm_ofertas_publicas(is_active);

-- Criar trigger para updated_at
CREATE TRIGGER update_cvm_ofertas_updated_at
  BEFORE UPDATE ON public.cvm_ofertas_publicas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();