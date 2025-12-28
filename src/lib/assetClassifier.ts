/**
 * Asset Classification Module
 * 
 * Classifica tickers brasileiros em tipos de ativos.
 * Sincronizado com: supabase/functions/sync-brapi-quotes/index.ts
 * 
 * @module assetClassifier
 */

export type AssetType = 
  | 'stock' 
  | 'stock_fractional' 
  | 'bdr' 
  | 'fii' 
  | 'etf' 
  | 'unit' 
  | 'invalid';

// Lista expandida de ETFs conhecidos
export const KNOWN_ETFS = [
  // ETFs de índices de ações
  'BOVA11', 'SMAL11', 'IVVB11', 'BOVV11', 'PIBB11', 'DIVO11', 'FIND11',
  'MATB11', 'ISUS11', 'ECOO11', 'SMAC11', 'ESGB11', 'BRAX11', 'BBOV11',
  // ETFs internacionais
  'SPXI11', 'NASD11', 'EURP11', 'ACWI11', 'WRLD11', 'XINA11', 'ASIA11',
  // ETFs de commodities e cripto
  'GOLD11', 'HASH11', 'BITH11', 'ETHE11', 'QBTC11', 'BITI11', 'DEFI11',
  'NFTS11', 'META11', 'WEB311', 'QDFI11', 'CRPT11',
  // ETFs de renda fixa
  'IMAB11', 'IRFM11', 'FIXA11', 'B5P211', 'IB5M11', 'DEBB11', 'LFTS11', 
  'NTNS11', 'IMBB11', 'TEPP11', 'BGIF11',
  // ETFs temáticos e setoriais
  'TECK11', 'SHOT11', 'GURU11', 'JOGO11', 'FOOD11', 'AGRI11', 'REVE11',
  'DNAI11', '5GTK11', 'MILL11', 'GENB11', 'SXXX11', 'HTEK11',
  // ETFs de dividendos
  'DIVD11', 'NDIV11', 'BBSD11', 'TIRB11', 'NSDV11', 'YDIV11',
];

// Units conhecidas (ações compostas ON + PN, terminam em 11 mas NÃO são FIIs)
export const KNOWN_UNITS = [
  'SANB11', 'TAEE11', 'KLBN11', 'BPAC11', 'ENGI11', 'ALUP11',
  'IGTI11', 'SAPR11', 'BRBI11', 'FLMA11', 'SULA11', 'TIET11',
  'AERI11', 'BRAP11', 'GGBR11', 'CSNA11', 'ELET11',
];

export interface AssetQuote {
  shortName?: string;
  longName?: string;
}

/**
 * Classifica o tipo de ativo com base em:
 * 1. Listas conhecidas (ETFs e Units)
 * 2. Conteúdo do nome (quando disponível)
 * 3. Padrão do ticker (fallback)
 * 
 * @param ticker - Código do ticker (ex: 'PETR4', 'AAPL34')
 * @param quote - Informações opcionais do ativo (shortName, longName)
 * @returns Tipo do ativo classificado
 */
export function classifyAssetType(ticker: string, quote?: AssetQuote): AssetType {
  // 0. Validar ticker básico - deve começar com letra
  if (!ticker || !/^[A-Z]/.test(ticker)) {
    return 'invalid';
  }
  
  // 1. ETFs conhecidos (prioridade máxima para lista conhecida)
  if (KNOWN_ETFS.includes(ticker)) {
    return 'etf';
  }
  
  // 2. Units conhecidas (prioridade sobre detecção por nome para evitar confusão com FII)
  if (KNOWN_UNITS.includes(ticker)) {
    return 'unit';
  }
  
  // 3. Detecção por conteúdo do nome (mais confiável que regex)
  if (quote?.shortName || quote?.longName) {
    const name = `${quote.shortName || ''} ${quote.longName || ''}`.toUpperCase();
    
    // ETFs: contém "ETF" ou "FUNDO DE INDICE"
    if (name.includes('ETF') || name.includes('FUNDO DE INDICE') || 
        name.includes('FUNDO DE ÍNDICE') || name.includes('FDO INDICE')) {
      return 'etf';
    }
    
    // Units: contém "UNT" ou "UNIT" no nome
    if (name.includes(' UNT') || name.includes(' UNIT') || 
        name.includes('UNT ') || name.includes('UNIT ') ||
        /\bUNT\b/.test(name) || /\bUNIT\b/.test(name)) {
      return 'unit';
    }
    
    // FIIs: contém padrões específicos de FII
    if (name.includes('FII ') || name.includes(' FII') || 
        name.includes('FIAGRO') || 
        name.includes('FUNDO DE INVESTIMENTO IMOBILIARIO') ||
        name.includes('FUNDO DE INVESTIMENTO IMOBILIÁRIO') ||
        name.includes('FDO INV IMOB') || name.includes('F.I.I')) {
      return 'fii';
    }
  }
  
  // 4. Fallback: detecção por padrão de ticker
  
  // Ações fracionárias: terminam em F (PETR4F, VALE3F)
  if (/F$/.test(ticker) && ticker.length >= 5) {
    return 'stock_fractional';
  }
  
  // BDRs: começam com letra, podem ter dígitos no meio, terminam em 31-39
  // Padrões válidos: AAPL34, GOGL34, M1TA34, P2LT34, XPBR31, ABGD39
  // Comprimento entre 5 e 7 caracteres
  if (/^[A-Z][A-Z0-9]{2,4}3[1-9]$/.test(ticker) && 
      ticker.length >= 5 && ticker.length <= 7) {
    return 'bdr';
  }
  
  // Ações: padrão XXXX3-8 (4 letras + dígito 3-8)
  if (/^[A-Z]{4}[3-8]$/.test(ticker)) {
    return 'stock';
  }
  
  // FIIs: terminam em 11 e têm 6 caracteres (fallback final)
  if (ticker.endsWith('11') && ticker.length === 6) {
    return 'fii';
  }
  
  // Default para ações (caso não identificado)
  return 'stock';
}
