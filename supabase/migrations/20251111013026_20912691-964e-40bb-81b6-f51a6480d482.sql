-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar tabela de categorias de investimentos
CREATE TABLE public.investment_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('renda_fixa', 'renda_variavel')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('conservador', 'moderado', 'arrojado')),
  description TEXT,
  keywords TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de instituições financeiras
CREATE TABLE public.financial_institutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT,
  type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de investimentos do usuário
CREATE TABLE public.user_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID REFERENCES public.investment_categories(id),
  institution_id UUID REFERENCES public.financial_institutions(id),
  investment_name TEXT NOT NULL,
  amount DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.investment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_investments ENABLE ROW LEVEL SECURITY;

-- Policies para categorias
CREATE POLICY "Categorias são visíveis por todos"
ON public.investment_categories FOR SELECT
USING (true);

-- Policies para instituições
CREATE POLICY "Instituições são visíveis por todos"
ON public.financial_institutions FOR SELECT
USING (true);

-- Policies para investimentos do usuário
CREATE POLICY "Usuários podem ver seus próprios investimentos"
ON public.user_investments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios investimentos"
ON public.user_investments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios investimentos"
ON public.user_investments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios investimentos"
ON public.user_investments FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_investments_updated_at
BEFORE UPDATE ON public.user_investments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir categorias iniciais
INSERT INTO public.investment_categories (name, type, risk_level, description, keywords) VALUES
('Poupança', 'renda_fixa', 'conservador', 'Caderneta de poupança', ARRAY['poupanca', 'caderneta']),
('CDB', 'renda_fixa', 'conservador', 'Certificado de Depósito Bancário', ARRAY['cdb', 'certificado', 'deposito', 'bancario']),
('LCI', 'renda_fixa', 'conservador', 'Letra de Crédito Imobiliário', ARRAY['lci', 'letra', 'credito', 'imobiliario']),
('LCA', 'renda_fixa', 'conservador', 'Letra de Crédito do Agronegócio', ARRAY['lca', 'letra', 'credito', 'agronegocio', 'agro']),
('CRI', 'renda_fixa', 'moderado', 'Certificado de Recebíveis Imobiliários', ARRAY['cri', 'certificado', 'recebiveis', 'imobiliarios']),
('CRA', 'renda_fixa', 'moderado', 'Certificado de Recebíveis do Agronegócio', ARRAY['cra', 'certificado', 'recebiveis', 'agronegocio']),
('Tesouro Direto', 'renda_fixa', 'conservador', 'Títulos públicos federais', ARRAY['tesouro', 'direto', 'selic', 'ipca', 'prefixado']),
('Debêntures', 'renda_fixa', 'moderado', 'Títulos de dívida de empresas', ARRAY['debentures', 'debenture', 'divida']),
('Ações', 'renda_variavel', 'arrojado', 'Ações de empresas na bolsa', ARRAY['acoes', 'acao', 'bolsa', 'b3', 'papeis']),
('Fundos Imobiliários (FII)', 'renda_variavel', 'moderado', 'Fundos de investimento imobiliário', ARRAY['fii', 'fundos', 'imobiliarios', 'imoveis']),
('Fundos Multimercado', 'renda_variavel', 'moderado', 'Fundos que investem em diversos mercados', ARRAY['multimercado', 'multi', 'mercado', 'fundo']),
('ETF', 'renda_variavel', 'moderado', 'Exchange Traded Funds', ARRAY['etf', 'exchange', 'traded', 'funds', 'indice']),
('Fundos de Ações', 'renda_variavel', 'arrojado', 'Fundos de investimento em ações', ARRAY['fundos', 'acoes', 'fundo', 'acao']),
('Previdência Privada', 'renda_fixa', 'conservador', 'PGBL e VGBL', ARRAY['previdencia', 'pgbl', 'vgbl', 'privada']);

-- Inserir instituições financeiras principais
INSERT INTO public.financial_institutions (code, name, short_name, type) VALUES
('001', 'Banco do Brasil S.A.', 'Banco do Brasil', 'banco'),
('033', 'Banco Santander (Brasil) S.A.', 'Santander', 'banco'),
('104', 'Caixa Econômica Federal', 'Caixa', 'banco'),
('237', 'Banco Bradesco S.A.', 'Bradesco', 'banco'),
('341', 'Itaú Unibanco S.A.', 'Itaú', 'banco'),
('077', 'Banco Inter S.A.', 'Inter', 'banco'),
('260', 'Nu Pagamentos S.A. (Nubank)', 'Nubank', 'banco'),
('290', 'Pagseguro Internet S.A.', 'PagBank', 'banco'),
('323', 'Mercado Pago', 'Mercado Pago', 'banco'),
('102', 'XP Investimentos CCTVM S.A.', 'XP Investimentos', 'corretora'),
('097', 'Cooperativa Central de Crédito Noroeste Brasileiro Ltda.', 'Sicredi', 'banco'),
('336', 'Banco C6 S.A.', 'C6 Bank', 'banco'),
('655', 'Banco Votorantim S.A.', 'Votorantim', 'banco'),
('208', 'Banco BTG Pactual S.A.', 'BTG Pactual', 'banco');
