-- Criar tabela para Títulos Públicos
CREATE TABLE public.anbima_titulos_publicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_isin TEXT NOT NULL,
  codigo_selic TEXT NOT NULL,
  tipo_titulo TEXT NOT NULL,
  data_referencia DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_base DATE,
  pu NUMERIC(18, 8),
  taxa_compra NUMERIC(10, 4),
  taxa_venda NUMERIC(10, 4),
  taxa_indicativa NUMERIC(10, 4),
  desvio_padrao NUMERIC(10, 8),
  intervalo_min_d0 NUMERIC(10, 4),
  intervalo_max_d0 NUMERIC(10, 4),
  intervalo_min_d1 NUMERIC(10, 4),
  intervalo_max_d1 NUMERIC(10, 4),
  expressao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(codigo_isin, data_referencia)
);

-- Criar tabela para Debêntures
CREATE TABLE public.anbima_debentures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_ativo TEXT NOT NULL,
  emissor TEXT NOT NULL,
  data_referencia DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  grupo TEXT,
  percentual_taxa TEXT,
  pu NUMERIC(18, 8),
  taxa_compra NUMERIC(10, 4),
  taxa_venda NUMERIC(10, 4),
  taxa_indicativa NUMERIC(10, 4),
  desvio_padrao NUMERIC(10, 4),
  duration NUMERIC(10, 2),
  percent_pu_par NUMERIC(10, 4),
  percent_reune TEXT,
  val_min_intervalo NUMERIC(10, 4),
  val_max_intervalo NUMERIC(10, 4),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(codigo_ativo, data_referencia)
);

-- Criar tabela para CRI/CRA
CREATE TABLE public.anbima_cri_cra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_ativo TEXT NOT NULL,
  tipo_contrato TEXT NOT NULL,
  emissor TEXT NOT NULL,
  originador TEXT,
  originador_credito TEXT,
  data_referencia DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  emissao TEXT,
  serie TEXT,
  tipo_remuneracao TEXT,
  taxa_correcao NUMERIC(10, 4),
  pu NUMERIC(18, 8),
  vl_pu NUMERIC(18, 8),
  taxa_compra NUMERIC(10, 4),
  taxa_venda NUMERIC(10, 4),
  taxa_indicativa NUMERIC(10, 4),
  desvio_padrao NUMERIC(10, 4),
  duration NUMERIC(10, 2),
  percent_pu_par NUMERIC(10, 4),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(codigo_ativo, data_referencia)
);

-- Criar tabela para FIDC
CREATE TABLE public.anbima_fidc (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_b3 TEXT NOT NULL,
  isin TEXT,
  nome TEXT NOT NULL,
  emissor TEXT NOT NULL,
  serie TEXT,
  data_referencia DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  tipo_remuneracao TEXT,
  taxa_correcao NUMERIC(10, 4),
  referencia_ntnb DATE,
  pu NUMERIC(18, 8),
  taxa_compra NUMERIC(10, 4),
  taxa_venda NUMERIC(10, 4),
  taxa_indicativa NUMERIC(10, 4),
  desvio_padrao NUMERIC(10, 4),
  duration NUMERIC(10, 2),
  percent_pu_par NUMERIC(10, 4),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(codigo_b3, data_referencia)
);

-- Criar tabela para Letras Financeiras
CREATE TABLE public.anbima_letras_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letra_financeira TEXT NOT NULL,
  cnpj_emissor TEXT NOT NULL,
  emissor TEXT NOT NULL,
  data_referencia DATE NOT NULL,
  indexador TEXT,
  fluxo TEXT,
  vertices JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(letra_financeira, cnpj_emissor, data_referencia)
);

-- Criar tabela para Fundos
CREATE TABLE public.anbima_fundos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_fundo TEXT NOT NULL,
  tipo_identificador_fundo TEXT NOT NULL,
  identificador_fundo TEXT NOT NULL,
  razao_social_fundo TEXT NOT NULL,
  nome_comercial_fundo TEXT,
  tipo_fundo TEXT NOT NULL,
  data_vigencia DATE,
  data_encerramento_fundo DATE,
  classes JSONB,
  data_atualizacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(codigo_fundo)
);

-- Criar índices para performance
CREATE INDEX idx_titulos_publicos_data_ref ON public.anbima_titulos_publicos(data_referencia DESC);
CREATE INDEX idx_titulos_publicos_tipo ON public.anbima_titulos_publicos(tipo_titulo);
CREATE INDEX idx_debentures_data_ref ON public.anbima_debentures(data_referencia DESC);
CREATE INDEX idx_debentures_emissor ON public.anbima_debentures(emissor);
CREATE INDEX idx_cri_cra_data_ref ON public.anbima_cri_cra(data_referencia DESC);
CREATE INDEX idx_cri_cra_tipo ON public.anbima_cri_cra(tipo_contrato);
CREATE INDEX idx_fidc_data_ref ON public.anbima_fidc(data_referencia DESC);
CREATE INDEX idx_letras_financeiras_data_ref ON public.anbima_letras_financeiras(data_referencia DESC);
CREATE INDEX idx_fundos_tipo ON public.anbima_fundos(tipo_fundo);

-- Habilitar RLS nas tabelas
ALTER TABLE public.anbima_titulos_publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anbima_debentures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anbima_cri_cra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anbima_fidc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anbima_letras_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anbima_fundos ENABLE ROW LEVEL SECURITY;

-- Criar políticas de leitura pública (dados de mercado)
CREATE POLICY "Dados de mercado são públicos - titulos_publicos"
  ON public.anbima_titulos_publicos FOR SELECT
  USING (true);

CREATE POLICY "Dados de mercado são públicos - debentures"
  ON public.anbima_debentures FOR SELECT
  USING (true);

CREATE POLICY "Dados de mercado são públicos - cri_cra"
  ON public.anbima_cri_cra FOR SELECT
  USING (true);

CREATE POLICY "Dados de mercado são públicos - fidc"
  ON public.anbima_fidc FOR SELECT
  USING (true);

CREATE POLICY "Dados de mercado são públicos - letras_financeiras"
  ON public.anbima_letras_financeiras FOR SELECT
  USING (true);

CREATE POLICY "Dados de mercado são públicos - fundos"
  ON public.anbima_fundos FOR SELECT
  USING (true);

-- Criar função para atualizar timestamp
CREATE OR REPLACE FUNCTION public.update_anbima_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar triggers para atualização automática de updated_at
CREATE TRIGGER update_titulos_publicos_updated_at
  BEFORE UPDATE ON public.anbima_titulos_publicos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_anbima_updated_at();

CREATE TRIGGER update_debentures_updated_at
  BEFORE UPDATE ON public.anbima_debentures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_anbima_updated_at();

CREATE TRIGGER update_cri_cra_updated_at
  BEFORE UPDATE ON public.anbima_cri_cra
  FOR EACH ROW
  EXECUTE FUNCTION public.update_anbima_updated_at();

CREATE TRIGGER update_fidc_updated_at
  BEFORE UPDATE ON public.anbima_fidc
  FOR EACH ROW
  EXECUTE FUNCTION public.update_anbima_updated_at();

CREATE TRIGGER update_letras_financeiras_updated_at
  BEFORE UPDATE ON public.anbima_letras_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_anbima_updated_at();

CREATE TRIGGER update_fundos_updated_at
  BEFORE UPDATE ON public.anbima_fundos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_anbima_updated_at();