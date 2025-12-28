/**
 * Utilitários para classificação e formatação de rentabilidade de ativos
 * 
 * Separação clara entre:
 * - Dados contratuais (do prospecto/emissão)
 * - Dados de mercado (marcação a mercado ANBIMA)
 */

// ============================================
// TIPOS E INTERFACES
// ============================================

export type YieldProfile = 
  | 'PREFIXADO'      // Taxa fixa, sem indexador
  | 'POS_CDI'        // Indexado ao CDI (ex: 106% CDI ou DI+1,5%)
  | 'POS_SELIC'      // Indexado à SELIC
  | 'HIBRIDO_IPCA'   // IPCA + spread
  | 'HIBRIDO_IGPM'   // IGP-M + spread
  | 'VARIAVEL'       // Renda variável (ações, FIIs, ETFs)
  | 'DESCONHECIDO';  // Não foi possível classificar

export type ContractIndexer = 'CDI' | 'SELIC' | 'IPCA' | 'IGPM' | 'PREFIXADO' | null;

export type ContractRateType = 
  | 'PERCENT_INDEXADOR'      // Ex: 106% do CDI
  | 'INDEXADOR_PLUS_SPREAD'  // Ex: IPCA + 5,48%
  | 'TAXA_FIXA'              // Ex: 15% ao ano
  | 'VARIAVEL'               // Renda variável
  | null;

export interface YieldClassification {
  profile: YieldProfile;
  indexer: ContractIndexer;
  spread: number | null;
  rateType: ContractRateType;
}

export interface AssetYieldDisplay {
  headline: string;           // Texto principal (ex: "IPCA + 5,48% ao ano")
  subtitle?: string;          // Contexto adicional
  isMarketRate: boolean;      // Se true, mostrar disclaimer
  tooltip?: string;           // Explicação detalhada
}

export interface UnifiedAssetYield {
  asset_type?: string;
  yield_profile?: string;
  contract_indexer?: string | null;
  contract_spread_percent?: number | null;
  contract_rate_type?: string | null;
  market_rate_indicative_percent?: number | null;
  dividend_yield?: number | null;
  profitability?: string | null;
  price_change_percent?: number | null;
}

// ============================================
// FUNÇÃO DE CLASSIFICAÇÃO AUTOMÁTICA
// ============================================

/**
 * Infere o perfil de rentabilidade do ativo a partir do texto de taxa
 * e do tipo de ativo
 * 
 * @param yieldText - Texto da rentabilidade (ex: "IPCA + 5,48%", "106% do CDI")
 * @param assetType - Tipo do ativo (ex: "stock", "debenture", "titulo_publico")
 * @returns Objeto com classificação completa
 */
export function inferYieldProfile(
  yieldText: string | null | undefined,
  assetType: string | null | undefined
): YieldClassification {
  const defaultResult: YieldClassification = {
    profile: 'DESCONHECIDO',
    indexer: null,
    spread: null,
    rateType: null
  };

  const assetTypeLower = (assetType || '').toLowerCase();

  // ============================================
  // 1. RENDA VARIÁVEL: Identificação por tipo de ativo
  // ============================================
  const variableIncomeTypes = ['stock', 'fii', 'etf', 'bdr', 'acao', 'acoes'];
  if (variableIncomeTypes.some(t => assetTypeLower.includes(t))) {
    return {
      profile: 'VARIAVEL',
      indexer: null,
      spread: null,
      rateType: 'VARIAVEL'
    };
  }

  // ============================================
  // 2. FUNDOS: Tratados como VARIAVEL (estratégias diversas)
  // ============================================
  if (assetTypeLower.includes('fundo') || assetTypeLower === 'fif') {
    return {
      profile: 'VARIAVEL',
      indexer: null,
      spread: null,
      rateType: 'VARIAVEL'
    };
  }

  // Se não há texto, não conseguimos classificar
  if (!yieldText || yieldText.trim() === '') {
    return defaultResult;
  }

  // Normalizar texto para matching
  const text = yieldText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const textOriginal = yieldText.toLowerCase();

  // ============================================
  // 3. TEXTOS EXPLICITAMENTE NÃO CLASSIFICÁVEIS
  // ============================================
  if (text.includes('consultar') || text.includes('prospecto') || text.includes('verificar')) {
    return defaultResult;
  }

  // ============================================
  // 4. PÓS-CDI: Múltiplos padrões
  // ============================================
  
  // Padrão: X% do CDI / X% do DI / X% da Taxa DI
  const percentCdiMatch = text.match(/(\d+[,.]?\d*)\s*%\s*(do|da)?\s*(cdi|di|taxa\s*di)/i);
  if (percentCdiMatch) {
    const spread = parseFloat(percentCdiMatch[1].replace(',', '.'));
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: roundToTwo(spread),
      rateType: 'PERCENT_INDEXADOR'
    };
  }
  
  // Padrão: X do DI / X do CDI (sem % antes de "do") - ex: "108,25 do DI"
  const numDiMatch = text.match(/(\d+[,.]?\d*)\s+(do|da)\s+(cdi|di)/i);
  if (numDiMatch) {
    const spread = parseFloat(numDiMatch[1].replace(',', '.'));
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: roundToTwo(spread),
      rateType: 'PERCENT_INDEXADOR'
    };
  }
  
  // Padrão: X% variação do DI / X% variacao DI
  const variacaoDiMatch = text.match(/(\d+[,.]?\d*)\s*%?\s*variacao\s*(do|da)?\s*(cdi|di)/i);
  if (variacaoDiMatch) {
    const spread = parseFloat(variacaoDiMatch[1].replace(',', '.'));
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: roundToTwo(spread),
      rateType: 'PERCENT_INDEXADOR'
    };
  }
  
  // Padrão: DI + X% / CDI + X%
  const cdiPlusMatch = text.match(/(cdi|di)\s*\+\s*(\d+[,.]?\d*)\s*%?/i);
  if (cdiPlusMatch) {
    const spread = parseFloat(cdiPlusMatch[2].replace(',', '.'));
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: roundToTwo(spread),
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }
  
  // Padrão: "DI+" ou "DI ADITIVO" (letras financeiras)
  if (/^di\s*\+$/i.test(text.trim()) || /^di\s*aditivo$/i.test(text.trim())) {
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: null,
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }
  
  // Apenas "CDI" ou "DI" isolado = 100% do CDI
  if (/^(cdi|di)$/i.test(text.trim())) {
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: 100,
      rateType: 'PERCENT_INDEXADOR'
    };
  }
  
  // Padrão: "Indexado" ou "Indexado ao DI/CDI"
  if (/^indexado$/i.test(text.trim()) || /indexado\s*(ao|a)?\s*(cdi|di)/i.test(text)) {
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: null,
      rateType: 'PERCENT_INDEXADOR'
    };
  }

  // ============================================
  // 5. PÓS-SELIC: Padrões como "SELIC + X%" ou "100% SELIC"
  // ============================================
  
  const selicMatch = text.match(/selic\s*\+?\s*(\d+[,.]?\d*)?\s*%?/i);
  if (selicMatch || text.includes('selic')) {
    const spread = selicMatch?.[1] ? parseFloat(selicMatch[1].replace(',', '.')) : 0;
    return {
      profile: 'POS_SELIC',
      indexer: 'SELIC',
      spread: roundToTwo(spread),
      rateType: spread > 0 ? 'INDEXADOR_PLUS_SPREAD' : 'PERCENT_INDEXADOR'
    };
  }

  // ============================================
  // 6. HÍBRIDO IPCA: Múltiplos padrões incluindo variantes
  // ============================================
  
  // Padrão: IPCA + X%
  const ipcaMatch = text.match(/ipca\s*\+\s*(\d+[,.]?\d*)\s*%?/i);
  if (ipcaMatch) {
    const spread = parseFloat(ipcaMatch[1].replace(',', '.'));
    return {
      profile: 'HIBRIDO_IPCA',
      indexer: 'IPCA',
      spread: roundToTwo(spread),
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }
  
  // Padrão: "PCA + X%" (typo comum)
  const pcaMatch = text.match(/pca\s*\+\s*(\d+[,.]?\d*)\s*%?/i);
  if (pcaMatch) {
    const spread = parseFloat(pcaMatch[1].replace(',', '.'));
    return {
      profile: 'HIBRIDO_IPCA',
      indexer: 'IPCA',
      spread: roundToTwo(spread),
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }
  
  // Padrão: "IPCA (anual)" ou "IPCA anual"
  if (/ipca\s*\(?\s*anual\s*\)?/i.test(text)) {
    // Tentar extrair spread se existir
    const spreadMatch = text.match(/(\d+[,.]?\d*)\s*%/);
    const spread = spreadMatch ? parseFloat(spreadMatch[1].replace(',', '.')) : 0;
    return {
      profile: 'HIBRIDO_IPCA',
      indexer: 'IPCA',
      spread: roundToTwo(spread),
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }
  
  // Apenas "IPCA" sem spread
  if (text.includes('ipca') && !text.includes('+')) {
    return {
      profile: 'HIBRIDO_IPCA',
      indexer: 'IPCA',
      spread: 0,
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }
  
  // Padrão: "Indexado ao IPCA"
  if (/indexado\s*(ao|a)?\s*ipca/i.test(text)) {
    return {
      profile: 'HIBRIDO_IPCA',
      indexer: 'IPCA',
      spread: null,
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }

  // ============================================
  // 7. HÍBRIDO IGP-M: Padrões como "IGP-M + 3,5%"
  // ============================================
  
  const igpmMatch = text.match(/igp-?m\s*\+\s*(\d+[,.]?\d*)\s*%?/i);
  if (igpmMatch) {
    const spread = parseFloat(igpmMatch[1].replace(',', '.'));
    return {
      profile: 'HIBRIDO_IGPM',
      indexer: 'IGPM',
      spread: roundToTwo(spread),
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }
  
  // Padrão: "Indexado ao IGP-M"
  if (/indexado\s*(ao|a)?\s*igp-?m/i.test(text)) {
    return {
      profile: 'HIBRIDO_IGPM',
      indexer: 'IGPM',
      spread: null,
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }

  // ============================================
  // 8. PREFIXADO: Apenas percentual fixo sem indexador
  // ============================================
  
  // Padrão: X% ao ano / X% a.a. (sem indexador)
  const prefixadoMatch = text.match(/^(\d+[,.]?\d*)\s*%\s*(a\.?a\.?|ao\s+ano)?$/i);
  if (prefixadoMatch) {
    const rate = parseFloat(prefixadoMatch[1].replace(',', '.'));
    return {
      profile: 'PREFIXADO',
      indexer: 'PREFIXADO',
      spread: roundToTwo(rate),
      rateType: 'TAXA_FIXA'
    };
  }
  
  // Títulos públicos prefixados (LTN, NTN-F)
  if (assetTypeLower === 'titulo_publico') {
    // Verificar se o texto contém apenas um número percentual
    const taxaMatch = text.match(/(\d+[,.]?\d*)\s*%/);
    if (taxaMatch && !text.includes('ipca') && !text.includes('selic') && !text.includes('igp')) {
      const rate = parseFloat(taxaMatch[1].replace(',', '.'));
      return {
        profile: 'PREFIXADO',
        indexer: 'PREFIXADO',
        spread: roundToTwo(rate),
        rateType: 'TAXA_FIXA'
      };
    }
  }

  // ============================================
  // 9. DESCONHECIDO: Não conseguimos classificar
  // ============================================
  
  return defaultResult;
}

/**
 * Arredonda número para 2 casas decimais
 */
function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================
// FUNÇÃO DE FORMATAÇÃO PARA UI
// ============================================

/**
 * Formata a rentabilidade do ativo para exibição amigável ao usuário
 * 
 * @param asset - Objeto do ativo com campos estruturados
 * @returns Objeto com texto formatado e metadados de exibição
 */
export function formatAssetYield(asset: UnifiedAssetYield): AssetYieldDisplay {
  const profile = asset.yield_profile as YieldProfile | undefined;
  const indexer = asset.contract_indexer;
  const spread = asset.contract_spread_percent;
  const rateType = asset.contract_rate_type;
  const marketRate = asset.market_rate_indicative_percent;
  const dividendYield = asset.dividend_yield;
  const priceChange = asset.price_change_percent;
  
  // Formatar número com 2 casas decimais
  const fmt = (n: number | null | undefined): string => {
    if (n === null || n === undefined || isNaN(n)) return '0,00';
    return n.toFixed(2).replace('.', ',');
  };

  switch (profile) {
    case 'PREFIXADO':
      return {
        headline: `${fmt(spread)}% ao ano`,
        subtitle: 'Taxa fixa',
        isMarketRate: false,
        tooltip: 'Taxa contratual fixa definida na emissão'
      };
      
    case 'POS_CDI':
      if (rateType === 'PERCENT_INDEXADOR') {
        return {
          headline: `${fmt(spread)}% do CDI`,
          isMarketRate: false,
          tooltip: 'Rendimento proporcional à taxa CDI'
        };
      } else {
        return {
          headline: `CDI + ${fmt(spread)}% ao ano`,
          isMarketRate: false,
          tooltip: 'CDI mais um spread fixo'
        };
      }
      
    case 'POS_SELIC':
      if (spread && spread > 0) {
        return {
          headline: `SELIC + ${fmt(spread)}% ao ano`,
          isMarketRate: false,
          tooltip: 'Taxa SELIC mais um spread fixo'
        };
      }
      return {
        headline: '100% da SELIC',
        isMarketRate: false,
        tooltip: 'Acompanha a taxa básica de juros'
      };
      
    case 'HIBRIDO_IPCA':
      return {
        headline: `IPCA + ${fmt(spread)}% ao ano`,
        isMarketRate: false,
        tooltip: 'Inflação (IPCA) mais uma taxa fixa'
      };
      
    case 'HIBRIDO_IGPM':
      return {
        headline: `IGP-M + ${fmt(spread)}% ao ano`,
        isMarketRate: false,
        tooltip: 'Inflação (IGP-M) mais uma taxa fixa'
      };
      
    case 'VARIAVEL':
      // Para renda variável, mostrar dividend yield ou variação
      if (dividendYield && dividendYield > 0) {
        return {
          headline: `DY ${fmt(dividendYield)}%`,
          subtitle: 'Dividend Yield',
          isMarketRate: true,
          tooltip: 'Rendimento de dividendos nos últimos 12 meses. Rentabilidade variável conforme mercado.'
        };
      }
      if (priceChange !== null && priceChange !== undefined) {
        const sign = priceChange >= 0 ? '+' : '';
        return {
          headline: `${sign}${fmt(priceChange)}%`,
          subtitle: 'Variação',
          isMarketRate: true,
          tooltip: 'Variação de preço. Rentabilidade variável conforme mercado.'
        };
      }
      return {
        headline: 'Renda Variável',
        isMarketRate: true,
        tooltip: 'Rentabilidade variável conforme condições de mercado'
      };
      
    case 'DESCONHECIDO':
    default:
      // Fallback: usar o campo profitability legado se disponível
      if (asset.profitability && asset.profitability !== 'Consultar prospecto') {
        return {
          headline: asset.profitability,
          isMarketRate: marketRate !== null && marketRate !== undefined,
          tooltip: marketRate 
            ? 'Taxa indicativa de mercado (referência ANBIMA). Pode variar diariamente.' 
            : 'Consulte o prospecto para detalhes'
        };
      }
      
      // Se temos taxa de mercado, usar ela com disclaimer
      if (marketRate !== null && marketRate !== undefined) {
        return {
          headline: `${fmt(marketRate)}% a.a.`,
          subtitle: 'Taxa de mercado',
          isMarketRate: true,
          tooltip: 'Taxa indicativa ANBIMA (referência de mercado). Não é garantia de retorno.'
        };
      }
      
      return {
        headline: 'Consultar prospecto',
        isMarketRate: false,
        tooltip: 'Consulte o prospecto do ativo para detalhes sobre a rentabilidade'
      };
  }
}

/**
 * Retorna o tipo de rentabilidade para uso em filtros
 * Substitui a antiga lógica baseada em parsing de string
 */
export function getYieldFilterType(asset: UnifiedAssetYield): string {
  const profile = asset.yield_profile as YieldProfile | undefined;
  const assetType = asset.asset_type?.toLowerCase() || '';
  
  // Primeiro verificar pelo yield_profile estruturado
  switch (profile) {
    case 'POS_CDI':
    case 'POS_SELIC':
      return 'cdi';
    case 'HIBRIDO_IPCA':
    case 'HIBRIDO_IGPM':
      return 'ipca';
    case 'PREFIXADO':
      return 'prefixado';
    case 'VARIAVEL':
      return 'variavel';
  }
  
  // Fallback: verificar pelo tipo de ativo
  if (['stock', 'fii', 'etf', 'bdr'].some(t => assetType.includes(t))) {
    return 'variavel';
  }
  if (assetType.includes('fundo')) {
    return 'fundos';
  }
  
  // Fallback final: tentar inferir do texto de profitability
  const prof = (asset.profitability || '').toLowerCase();
  if (prof.includes('cdi') || prof.includes(' di ') || prof.includes('% do di')) return 'cdi';
  if (prof.includes('ipca') || prof.includes('igpm')) return 'ipca';
  if (/^\d+[,.]?\d*%/.test(prof) && !prof.includes('cdi') && !prof.includes('ipca')) return 'prefixado';
  
  return 'outro';
}

// ============================================
// TESTES UNITÁRIOS (para referência)
// ============================================

/**
 * Casos de teste para inferYieldProfile:
 * 
 * - "106% do CDI" → POS_CDI, CDI, 106.00, PERCENT_INDEXADOR
 * - "100% da Taxa DI" → POS_CDI, CDI, 100.00, PERCENT_INDEXADOR
 * - "DI + 1,40%" → POS_CDI, CDI, 1.40, INDEXADOR_PLUS_SPREAD
 * - "IPCA + 5,48% ao ano" → HIBRIDO_IPCA, IPCA, 5.48, INDEXADOR_PLUS_SPREAD
 * - "15% ao ano" → PREFIXADO, PREFIXADO, 15.00, TAXA_FIXA
 * - "IGP-M + 3,5%" → HIBRIDO_IGPM, IGPM, 3.50, INDEXADOR_PLUS_SPREAD
 * - null + assetType="stock" → VARIAVEL, null, null, VARIAVEL
 * - "CDI" → POS_CDI, CDI, 100, PERCENT_INDEXADOR
 */
