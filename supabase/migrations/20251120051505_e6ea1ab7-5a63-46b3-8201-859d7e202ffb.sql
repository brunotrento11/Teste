-- Adicionar coluna anbima_asset_type na tabela investment_categories
ALTER TABLE public.investment_categories
ADD COLUMN anbima_asset_type text;

-- Comentário explicativo
COMMENT ON COLUMN public.investment_categories.anbima_asset_type IS 'Tipo de ativo ANBIMA correspondente para filtro (titulo_publico, debenture, cri_cra, fidc, fundo, letras_financeiras)';

-- Popular a coluna com os valores corretos baseado no nome da categoria
UPDATE public.investment_categories
SET anbima_asset_type = CASE 
  WHEN name = 'Tesouro Direto' THEN 'titulo_publico'
  WHEN name = 'CDB' THEN 'debenture'
  WHEN name = 'LCI' THEN 'debenture'
  WHEN name = 'LCA' THEN 'debenture'
  WHEN name = 'CRI' THEN 'cri_cra'
  WHEN name = 'CRA' THEN 'cri_cra'
  WHEN name = 'Debêntures' THEN 'debenture'
  WHEN name = 'FIDC' THEN 'fidc'
  WHEN name = 'Letras Financeiras' THEN 'letras_financeiras'
  WHEN name = 'Fundos de Investimento' THEN 'fundo'
  WHEN name = 'Previdência Privada' THEN 'fundo'
  ELSE NULL
END;

-- Categorias que não têm correspondência direta em ANBIMA ficam NULL:
-- Poupança, Ações, FII, ETF não são da base ANBIMA