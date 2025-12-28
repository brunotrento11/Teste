/**
 * Classificação Multi-Objetivo de Ativos
 * 
 * Este módulo implementa a lógica de classificação de ativos em objetivos de investimento.
 * Um ativo pode pertencer a múltiplos objetivos dependendo de suas características.
 * 
 * Tipos de ativos suportados:
 * - stock: Ações ordinárias e preferenciais
 * - unit: Units (composição de ON + PN)
 * - fii: Fundos de Investimento Imobiliário
 * - etf: Exchange Traded Funds
 * - bdr: Brazilian Depositary Receipts
 * - fundo: Fundos de investimento
 * - titulo_publico: Títulos públicos federais
 * - debenture, cri, cra, letra_financeira, fidc: Renda fixa privada
 * 
 * Objetivos:
 * - accumulate: Acumular riqueza (crescimento de capital)
 * - income: Renda regular (distribuições periódicas)
 * - security: Segurança (preservação de capital)
 * 
 * LIMITAÇÕES ATUAIS (Fase 1):
 * - dividend_yield pode estar NULL para alguns ativos Brapi
 * - Não temos coupon_frequency para debêntures/CRI/CRA
 * - Fundos não têm subtipo (equity vs fixed_income)
 */

export type InvestmentObjective = 'accumulate' | 'income' | 'security';

export interface UnifiedAsset {
  asset_type: string;
  display_name: string;
  dividend_yield?: number | null;
  asset_code?: string; // Para identificar ETFs específicos
}

// ETFs de dividendos (distribuem rendimentos periodicamente)
const DIVIDEND_ETFS = [
  'DIVD11', 'NDIV11', 'BBSD11', 'TIRB11', 'NSDV11', 'YDIV11', 'DIVO11',
];

// ETFs de renda fixa (podem gerar renda)
const FIXED_INCOME_ETFS = [
  'FIXA11', 'IRFM11', 'IMAB11', 'B5P211', 'IMBB11', 'IB5M11', 
  'LFTS11', 'NTNS11', 'DEBB11', 'TEPP11', 'BGIF11',
];

/**
 * Extrai o código do ativo do display_name ou asset_code
 */
function extractAssetCode(asset: UnifiedAsset): string | null {
  // Se temos asset_code, usar diretamente
  if (asset.asset_code) {
    return asset.asset_code.toUpperCase();
  }
  // Tentar extrair do display_name (primeiro "palavra" antes do espaço)
  const match = asset.display_name?.match(/^([A-Z0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Classifica um ativo em um ou mais objetivos de investimento.
 * 
 * Regras:
 * - FII: SEMPRE 'income' (Lei 8.668/1993 obriga 95%+ distribuição mensal)
 * - Unit: 'accumulate' (+ 'income' se dividend_yield > 3%)
 * - ETF: 'accumulate' (+ 'income' se for ETF de dividendos ou renda fixa)
 * - Títulos Públicos com cupom (NTN-B, NTN-C, NTN-F): ['security', 'income']
 * - Títulos Públicos sem cupom (LFT, LTN): ['security']
 * - Stock com dividend_yield > 5%: ['accumulate', 'income']
 * - Renda Variável sem dividendos: ['accumulate']
 * - Renda Fixa sem dados de distribuição: ['accumulate']
 * - Fundos: ['accumulate']
 */
export function getObjectivesForAsset(asset: UnifiedAsset): InvestmentObjective[] {
  const objectives: InvestmentObjective[] = [];
  const assetType = asset.asset_type?.toLowerCase();
  const assetCode = extractAssetCode(asset);
  
  // FII: SEMPRE 'income' (Lei 8.668/1993 obriga 95%+ distribuição)
  if (assetType === 'fii') {
    return ['income'];
  }
  
  // UNIT: Ações compostas (ON + PN)
  if (assetType === 'unit') {
    objectives.push('accumulate');
    
    // Units com alto dividend_yield → também 'income'
    if (asset.dividend_yield && asset.dividend_yield > 3) {
      objectives.push('income');
    }
    
    return objectives;
  }
  
  // ETF: Depende do tipo de ETF
  if (assetType === 'etf') {
    objectives.push('accumulate');
    
    // ETFs de dividendos → também 'income'
    if (assetCode && DIVIDEND_ETFS.includes(assetCode)) {
      objectives.push('income');
    }
    
    // ETFs de renda fixa → também 'income' (geram rendimentos)
    if (assetCode && FIXED_INCOME_ETFS.includes(assetCode)) {
      objectives.push('income');
    }
    
    return objectives;
  }
  
  // TÍTULOS PÚBLICOS: Verificar tipo para determinar se tem cupom
  if (assetType === 'titulo_publico') {
    objectives.push('security');
    
    // Extrair tipo do display_name (ex: "NTN-B 2030-05-15" → "NTN-B")
    const tipoTitulo = asset.display_name?.split(' ')[0]?.toUpperCase();
    
    // Títulos com cupom semestral → também 'income'
    const titulosComCupom = ['NTN-B', 'NTN-C', 'NTN-F'];
    if (tipoTitulo && titulosComCupom.includes(tipoTitulo)) {
      objectives.push('income');
    }
    
    return objectives;
  }
  
  // STOCK: Ações (com verificação de dividend_yield)
  if (assetType === 'stock') {
    objectives.push('accumulate');
    
    // Ações com alto dividend_yield → também 'income'
    if (asset.dividend_yield && asset.dividend_yield > 5) {
      objectives.push('income');
    }
    
    return objectives;
  }
  
  // BDR: Brazilian Depositary Receipts
  if (assetType === 'bdr') {
    objectives.push('accumulate');
    
    // BDRs com alto dividend_yield → também 'income'
    if (asset.dividend_yield && asset.dividend_yield > 5) {
      objectives.push('income');
    }
    
    return objectives;
  }
  
  // RENDA FIXA SEM DADOS DE DISTRIBUIÇÃO
  if (['debenture', 'cri', 'cra', 'letra_financeira', 'fidc'].includes(assetType)) {
    return ['accumulate'];
    // TODO FASE 2: Adicionar 'income' quando temos coupon_frequency
  }
  
  // FUNDOS: Sem subtipo disponível
  if (assetType === 'fundo') {
    return ['accumulate'];
    // TODO FASE 2: Classificar por subtipo CVM (renda fixa → income, ações → accumulate)
  }
  
  // Default para outros tipos
  return ['accumulate'];
}

/**
 * Retorna asset_types que pertencem a um objetivo.
 * Usado para filtrar no InvestmentSearchDialog.
 */
export function getAssetTypesForObjective(objective: InvestmentObjective): string[] {
  switch (objective) {
    case 'accumulate':
      // Todos os tipos que podem acumular riqueza (inclui unit agora)
      return ['stock', 'unit', 'fundo', 'etf', 'bdr', 'debenture', 'cri', 'cra', 'letra_financeira', 'fidc'];
    
    case 'income':
      // FIIs (todos) + Títulos públicos (filtrados por tipo) + Units com DY + ETFs de dividendos
      return ['fii', 'titulo_publico', 'unit', 'etf', 'stock', 'bdr'];
    
    case 'security':
      return ['titulo_publico'];
    
    default:
      return [];
  }
}

/**
 * Verifica se objetivo requer sub-filtro especial para títulos com cupom
 */
export function requiresIncomeSubfilter(objective: InvestmentObjective): boolean {
  return objective === 'income';
}

/**
 * Retorna filtro de títulos com cupom para o objetivo 'income'
 */
export function getTitulosComCupomFilter(): string[] {
  return ['NTN-B', 'NTN-C', 'NTN-F'];
}

/**
 * Retorna lista de ETFs de dividendos (para uso em filtros)
 */
export function getDividendETFs(): string[] {
  return [...DIVIDEND_ETFS];
}

/**
 * Retorna lista de ETFs de renda fixa (para uso em filtros)
 */
export function getFixedIncomeETFs(): string[] {
  return [...FIXED_INCOME_ETFS];
}

/**
 * Verifica se um ativo específico pertence ao objetivo 'income'
 * Útil para filtrar resultados já carregados
 */
export function assetBelongsToIncomeObjective(asset: UnifiedAsset): boolean {
  const objectives = getObjectivesForAsset(asset);
  return objectives.includes('income');
}
