import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TIPOS E INTERFACES
// ============================================

type YieldProfile = 'PREFIXADO' | 'POS_CDI' | 'POS_SELIC' | 'HIBRIDO_IPCA' | 'HIBRIDO_IGPM' | 'VARIAVEL' | 'DESCONHECIDO';
type ContractIndexer = 'CDI' | 'SELIC' | 'IPCA' | 'IGPM' | 'PREFIXADO' | null;
type ContractRateType = 'PERCENT_INDEXADOR' | 'INDEXADOR_PLUS_SPREAD' | 'TAXA_FIXA' | 'VARIAVEL' | null;

interface YieldClassification {
  profile: YieldProfile;
  indexer: ContractIndexer;
  spread: number | null;
  rateType: ContractRateType;
}

interface UnifiedAsset {
  source: string;
  source_id: string;
  source_table: string;
  asset_type: string;
  asset_code: string;
  display_name: string;
  issuer?: string;
  issuer_cnpj?: string;
  maturity_date?: string;
  profitability?: string;
  liquidity?: string;
  sector?: string;
  industry?: string;
  current_price?: number;
  price_change_percent?: number;
  market_cap?: number;
  average_volume?: number;
  dividend_yield?: number;
  price_earnings?: number;
  price_to_book?: number;
  risk_score?: number;
  risk_category?: string;
  volatility_1y?: number;
  beta?: number;
  var_95?: number;
  sharpe_ratio?: number;
  max_drawdown?: number;
  std_deviation?: number;
  source_updated_at?: string;
  risk_calculated_at?: string;
  // Novos campos estruturados (permite null para compatibilidade)
  contract_indexer?: string | null;
  contract_spread_percent?: number | null;
  contract_rate_type?: string | null;
  market_rate_indicative_percent?: number;
  market_rate_buy_percent?: number;
  market_rate_sell_percent?: number;
  market_source?: string;
  yield_profile?: string;
}

interface TransformResult {
  source: string;
  processed: number;
  inserted: number;
  updated: number;
  errors: number;
  errorDetails: string[];
  yieldProfileStats?: Record<string, number>;
}

// ============================================
// FUNÇÃO DE CLASSIFICAÇÃO AUTOMÁTICA
// ============================================

function inferYieldProfile(
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

  // 1. RENDA VARIÁVEL: Por tipo de ativo
  const variableIncomeTypes = ['stock', 'fii', 'etf', 'bdr', 'acao', 'acoes'];
  if (variableIncomeTypes.some(t => assetTypeLower.includes(t))) {
    return {
      profile: 'VARIAVEL',
      indexer: null,
      spread: null,
      rateType: 'VARIAVEL'
    };
  }

  // 2. FUNDOS: Tratados como VARIAVEL
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

  const text = yieldText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 3. TEXTOS NÃO CLASSIFICÁVEIS
  if (text.includes('consultar') || text.includes('prospecto') || text.includes('verificar')) {
    return defaultResult;
  }
  
  // 4. PÓS-CDI: Múltiplos padrões
  
  // "106% do CDI", "100% DI", "100% a.a do CDI"
  const percentCdiMatch = text.match(/(\d+[,.]?\d*)\s*%?\s*(a\.?a\.?)?\s*(do|da)?\s*(cdi|di|taxa\s*di)/i);
  if (percentCdiMatch) {
    const spread = parseFloat(percentCdiMatch[1].replace(',', '.'));
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: roundToTwo(spread),
      rateType: 'PERCENT_INDEXADOR'
    };
  }
  
  // "108,25 do DI" (sem % antes de "do")
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
  
  // "106,25% variação DI"
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
  
  // DI + X% / CDI + X%
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
  
  // "DI+" ou "DI ADITIVO"
  if (/^di\s*\+$/i.test(text.trim()) || /di\s*aditivo/i.test(text)) {
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: null,
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }
  
  // "CDI" ou "DI" isolado
  if (/^(cdi|di)$/i.test(text.trim())) {
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: 100,
      rateType: 'PERCENT_INDEXADOR'
    };
  }
  
  // "Indexado" ou "Indexado ao DI/CDI"
  if (/^indexado$/i.test(text.trim()) || /indexado\s*(ao|a)?\s*(cdi|di)/i.test(text)) {
    return {
      profile: 'POS_CDI',
      indexer: 'CDI',
      spread: null,
      rateType: 'PERCENT_INDEXADOR'
    };
  }

  // 5. PÓS-SELIC
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

  // 6. HÍBRIDO IPCA
  
  // "IPCA + 5,48%"
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
  
  // "PCA + 5,75%" (typo comum)
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
  
  // "IPCA (anual) + 5,05% a.a."
  if (/ipca\s*\(?\s*anual\s*\)?/i.test(text)) {
    const spreadMatch = text.match(/(\d+[,.]?\d*)\s*%/);
    const spread = spreadMatch ? parseFloat(spreadMatch[1].replace(',', '.')) : 0;
    return {
      profile: 'HIBRIDO_IPCA',
      indexer: 'IPCA',
      spread: roundToTwo(spread),
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }
  
  // "IPCA" sem spread
  if (text.includes('ipca') && !text.includes('+')) {
    return {
      profile: 'HIBRIDO_IPCA',
      indexer: 'IPCA',
      spread: 0,
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }
  
  // "Indexado ao IPCA"
  if (/indexado\s*(ao|a)?\s*ipca/i.test(text)) {
    return {
      profile: 'HIBRIDO_IPCA',
      indexer: 'IPCA',
      spread: null,
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }

  // 7. HÍBRIDO IGP-M
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
  
  if (/indexado\s*(ao|a)?\s*igp-?m/i.test(text)) {
    return {
      profile: 'HIBRIDO_IGPM',
      indexer: 'IGPM',
      spread: null,
      rateType: 'INDEXADOR_PLUS_SPREAD'
    };
  }

  // 8. PREFIXADO
  
  // "15% ao ano", "6,5891%% aa" (malformed)
  const prefixadoMatch = text.match(/^(\d+[,.]?\d*)\s*%+\s*(a\.?a\.?|ao\s+ano)?$/i);
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

  return defaultResult;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================
// FUNÇÃO DE FORMATAÇÃO DE PROFITABILITY
// ============================================

function formatProfitabilityDisplay(classification: YieldClassification): string {
  const fmt = (n: number | null): string => {
    if (n === null || isNaN(n)) return '0,00';
    return n.toFixed(2).replace('.', ',');
  };

  switch (classification.profile) {
    case 'PREFIXADO':
      return `${fmt(classification.spread)}% ao ano`;
    case 'POS_CDI':
      if (classification.rateType === 'PERCENT_INDEXADOR') {
        return `${fmt(classification.spread)}% do CDI`;
      }
      return `CDI + ${fmt(classification.spread)}% ao ano`;
    case 'POS_SELIC':
      if (classification.spread && classification.spread > 0) {
        return `SELIC + ${fmt(classification.spread)}% ao ano`;
      }
      return '100% da SELIC';
    case 'HIBRIDO_IPCA':
      return `IPCA + ${fmt(classification.spread)}% ao ano`;
    case 'HIBRIDO_IGPM':
      return `IGP-M + ${fmt(classification.spread)}% ao ano`;
    case 'VARIAVEL':
      return 'Renda Variável';
    default:
      return 'Consultar prospecto';
  }
}

// ============================================
// MAIN SERVER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { source, refresh_view = true } = await req.json().catch(() => ({}));
    
    console.log(`🔄 Iniciando transformação ETL${source ? ` para fonte: ${source}` : ' para todas as fontes'}`);
    
    const results: TransformResult[] = [];
    const startTime = Date.now();
    const globalYieldStats: Record<string, number> = {};

    const sources = source ? [source] : ['brapi', 'anbima', 'cvm'];

    for (const src of sources) {
      let result: TransformResult;
      
      switch (src) {
        case 'brapi':
          result = await transformBrapi(supabase);
          break;
        case 'anbima':
          result = await transformAnbima(supabase);
          break;
        case 'cvm':
          result = await transformCvm(supabase);
          break;
        default:
          console.log(`⚠️ Fonte desconhecida: ${src}`);
          continue;
      }
      
      // Agregar estatísticas de yield_profile
      if (result.yieldProfileStats) {
        for (const [profile, count] of Object.entries(result.yieldProfileStats)) {
          globalYieldStats[profile] = (globalYieldStats[profile] || 0) + count;
        }
      }
      
      results.push(result);
      console.log(`✅ ${src}: ${result.processed} processados, ${result.errors} erros`);
    }

    // Refresh da view materializada
    if (refresh_view) {
      console.log('🔄 Atualizando view materializada...');
      await supabase.rpc('refresh_mv_investment_search');
    }

    const duration = Date.now() - startTime;
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    // Registrar estatísticas
    await supabase.from('sync_execution_stats').insert({
      function_name: 'transform-to-unified',
      execution_type: source ? 'partial' : 'full',
      status: totalErrors > 0 ? 'completed_with_errors' : 'completed',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      total_assets_processed: totalProcessed,
      total_errors: totalErrors,
      metadata: { results, sources, yieldProfileStats: globalYieldStats }
    });

    // Log estatísticas de yield_profile
    console.log('📊 Estatísticas de yield_profile:', globalYieldStats);
    const desconhecidos = globalYieldStats['DESCONHECIDO'] || 0;
    const total = Object.values(globalYieldStats).reduce((a, b) => a + b, 0);
    if (total > 0) {
      const pctDesconhecido = ((desconhecidos / total) * 100).toFixed(1);
      console.log(`⚠️ ${pctDesconhecido}% dos ativos classificados como DESCONHECIDO`);
    }

    console.log(`🎉 ETL concluído em ${duration}ms: ${totalProcessed} ativos processados`);

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      total_processed: totalProcessed,
      total_errors: totalErrors,
      yield_profile_stats: globalYieldStats,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Erro no ETL:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ============================================
// TRANSFORMAÇÃO BRAPI (Renda Variável)
// ============================================

async function transformBrapi(supabase: any): Promise<TransformResult> {
  console.log('📊 Transformando dados Brapi...');
  
  const result: TransformResult = {
    source: 'brapi',
    processed: 0,
    inserted: 0,
    updated: 0,
    errors: 0,
    errorDetails: [],
    yieldProfileStats: {}
  };

  // Buscar todos os ativos com paginação (Supabase default limit = 1000)
  let allBrapiAssets: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data: brapiAssets, error } = await supabase
      .from('brapi_market_data')
      .select('*')
      .not('risk_score', 'is', null)
      .gt('risk_score', 0)
      .in('risk_category', ['Baixo', 'Moderado', 'Alto'])
      .range(offset, offset + pageSize - 1);

    if (error) {
      result.errors = 1;
      result.errorDetails.push(`Erro ao buscar Brapi (offset ${offset}): ${error.message}`);
      return result;
    }

    if (!brapiAssets || brapiAssets.length === 0) {
      break;
    }

    allBrapiAssets = allBrapiAssets.concat(brapiAssets);
    console.log(`📥 Página ${Math.floor(offset / pageSize) + 1}: ${brapiAssets.length} ativos (total: ${allBrapiAssets.length})`);
    
    if (brapiAssets.length < pageSize) {
      break; // Última página
    }
    offset += pageSize;
  }

  if (allBrapiAssets.length === 0) {
    console.log('⚠️ Nenhum ativo Brapi com risk_score válido encontrado');
    return result;
  }
  
  const brapiAssets = allBrapiAssets;

  console.log(`📥 Processando ${brapiAssets.length} ativos Brapi...`);

  const chunkSize = 500;
  for (let i = 0; i < brapiAssets.length; i += chunkSize) {
    const chunk = brapiAssets.slice(i, i + chunkSize);
    
    const unifiedAssets: UnifiedAsset[] = chunk.map((asset: any) => {
      const classification = inferYieldProfile(null, asset.asset_type);
      result.yieldProfileStats![classification.profile] = (result.yieldProfileStats![classification.profile] || 0) + 1;
      
      return {
        source: 'brapi',
        source_id: asset.id,
        source_table: 'brapi_market_data',
        asset_type: asset.asset_type || 'stock',
        asset_code: asset.ticker,
        display_name: asset.long_name || asset.short_name || asset.ticker,
        issuer: asset.long_name || asset.short_name,
        sector: asset.sector,
        industry: asset.industry,
        current_price: asset.regular_market_price,
        price_change_percent: asset.regular_market_change_percent,
        market_cap: asset.market_cap,
        average_volume: asset.average_daily_volume,
        dividend_yield: asset.dividend_yield,
        price_earnings: asset.price_earnings,
        price_to_book: asset.price_to_book,
        risk_score: asset.risk_score,
        risk_category: asset.risk_category,
        volatility_1y: asset.volatility_1y,
        beta: asset.beta,
        var_95: asset.var_95,
        sharpe_ratio: asset.sharpe_ratio,
        max_drawdown: asset.max_drawdown,
        liquidity: 'D+2',
        source_updated_at: asset.last_quote_update || asset.updated_at,
        risk_calculated_at: asset.last_risk_calculation,
        // Campos estruturados para renda variável
        yield_profile: classification.profile,
        contract_indexer: null,
        contract_spread_percent: null,
        contract_rate_type: 'VARIAVEL',
        market_source: 'BRAPI'
      };
    });

    const { error: upsertError, count } = await supabase
      .from('unified_assets')
      .upsert(unifiedAssets, { 
        onConflict: 'source,source_id',
        count: 'exact'
      });

    if (upsertError) {
      result.errors += chunk.length;
      result.errorDetails.push(`Erro ao upsert chunk ${i}: ${upsertError.message}`);
    } else {
      result.processed += chunk.length;
      result.inserted += count || chunk.length;
    }
  }

  return result;
}

// ============================================
// TRANSFORMAÇÃO ANBIMA (Renda Fixa + Fundos)
// ============================================

async function transformAnbima(supabase: any): Promise<TransformResult> {
  console.log('📊 Transformando dados ANBIMA...');
  
  const result: TransformResult = {
    source: 'anbima',
    processed: 0,
    inserted: 0,
    updated: 0,
    errors: 0,
    errorDetails: [],
    yieldProfileStats: {}
  };

  // Buscar risk scores
  const { data: riskScores, error: riskError } = await supabase
    .from('anbima_asset_risk_scores')
    .select('*');

  if (riskError) {
    result.errorDetails.push(`Erro ao buscar risk scores: ${riskError.message}`);
  }

  const riskMap = new Map();
  riskScores?.forEach((r: any) => {
    riskMap.set(`${r.asset_type}_${r.asset_id}`, r);
  });

  // 1. Títulos Públicos
  await processAnbimaTable(supabase, result, riskMap, {
    tableName: 'anbima_titulos_publicos',
    assetType: 'titulo_publico',
    mapFn: (item: any, risk: any) => {
      // Determinar classificação baseada no tipo de título
      const tipoUpper = (item.tipo_titulo || '').toUpperCase();
      let classification: YieldClassification;
      
      if (tipoUpper.includes('LFT')) {
        // LFT = SELIC
        classification = { profile: 'POS_SELIC', indexer: 'SELIC', spread: 0, rateType: 'PERCENT_INDEXADOR' };
      } else if (tipoUpper.includes('NTN-B') || tipoUpper.includes('NTNB')) {
        // NTN-B = IPCA + taxa
        const taxa = item.taxa_indicativa ? roundToTwo(item.taxa_indicativa) : 0;
        classification = { profile: 'HIBRIDO_IPCA', indexer: 'IPCA', spread: taxa, rateType: 'INDEXADOR_PLUS_SPREAD' };
      } else if (tipoUpper.includes('NTN-C') || tipoUpper.includes('NTNC')) {
        // NTN-C = IGP-M + taxa
        const taxa = item.taxa_indicativa ? roundToTwo(item.taxa_indicativa) : 0;
        classification = { profile: 'HIBRIDO_IGPM', indexer: 'IGPM', spread: taxa, rateType: 'INDEXADOR_PLUS_SPREAD' };
      } else {
        // LTN, NTN-F = Prefixado
        const taxa = item.taxa_indicativa ? roundToTwo(item.taxa_indicativa) : 0;
        classification = { profile: 'PREFIXADO', indexer: 'PREFIXADO', spread: taxa, rateType: 'TAXA_FIXA' };
      }

      return {
        source: 'anbima',
        source_id: item.id,
        source_table: 'anbima_titulos_publicos',
        asset_type: 'titulo_publico',
        asset_code: item.codigo_selic,
        display_name: `${item.tipo_titulo} ${item.data_vencimento}`,
        issuer: 'Tesouro Nacional',
        maturity_date: item.data_vencimento,
        profitability: formatProfitabilityDisplay(classification),
        liquidity: 'D+1',
        risk_score: risk?.risk_score || 3,
        risk_category: risk?.risk_category || 'Baixo',
        std_deviation: item.desvio_padrao,
        source_updated_at: item.updated_at,
        risk_calculated_at: risk?.calculated_at,
        // Campos estruturados
        yield_profile: classification.profile,
        contract_indexer: classification.indexer,
        contract_spread_percent: classification.spread,
        contract_rate_type: classification.rateType,
        market_rate_indicative_percent: item.taxa_indicativa,
        market_rate_buy_percent: item.taxa_compra,
        market_rate_sell_percent: item.taxa_venda,
        market_source: 'ANBIMA_TITULOS_PUBLICOS'
      };
    }
  });

  // 2. Debêntures
  await processAnbimaTable(supabase, result, riskMap, {
    tableName: 'anbima_debentures',
    assetType: 'debenture',
    mapFn: (item: any, risk: any) => {
      const rawYield = item.percentual_taxa || '';
      const classification = inferYieldProfile(rawYield, 'debenture');
      
      return {
        source: 'anbima',
        source_id: item.id,
        source_table: 'anbima_debentures',
        asset_type: 'debenture',
        asset_code: item.codigo_ativo,
        display_name: `Debênture ${item.emissor} - ${item.codigo_ativo}`,
        issuer: item.emissor,
        maturity_date: item.data_vencimento,
        profitability: classification.profile !== 'DESCONHECIDO' 
          ? formatProfitabilityDisplay(classification) 
          : rawYield || 'Consultar prospecto',
        liquidity: 'D+1',
        risk_score: risk?.risk_score || 10,
        risk_category: risk?.risk_category || 'Moderado',
        std_deviation: item.desvio_padrao,
        source_updated_at: item.updated_at,
        risk_calculated_at: risk?.calculated_at,
        // Campos estruturados
        yield_profile: classification.profile,
        contract_indexer: classification.indexer,
        contract_spread_percent: classification.spread,
        contract_rate_type: classification.rateType,
        market_rate_indicative_percent: item.taxa_indicativa,
        market_rate_buy_percent: item.taxa_compra,
        market_rate_sell_percent: item.taxa_venda,
        market_source: 'ANBIMA_DEBENTURES'
      };
    }
  });

  // 3. CRI/CRA
  await processAnbimaTable(supabase, result, riskMap, {
    tableName: 'anbima_cri_cra',
    assetType: 'cri_cra',
    mapFn: (item: any, risk: any) => {
      const rawYield = item.tipo_remuneracao || '';
      const classification = inferYieldProfile(rawYield, 'cri_cra');
      
      return {
        source: 'anbima',
        source_id: item.id,
        source_table: 'anbima_cri_cra',
        asset_type: item.tipo_contrato === 'CRI' ? 'cri' : 'cra',
        asset_code: item.codigo_ativo,
        display_name: `${item.tipo_contrato} ${item.emissor} - ${item.codigo_ativo}`,
        issuer: item.emissor,
        maturity_date: item.data_vencimento,
        profitability: classification.profile !== 'DESCONHECIDO' 
          ? formatProfitabilityDisplay(classification) 
          : rawYield || 'Indexado',
        liquidity: 'Baixa',
        risk_score: risk?.risk_score || 12,
        risk_category: risk?.risk_category || 'Moderado',
        std_deviation: item.desvio_padrao,
        source_updated_at: item.updated_at,
        risk_calculated_at: risk?.calculated_at,
        // Campos estruturados
        yield_profile: classification.profile,
        contract_indexer: classification.indexer,
        contract_spread_percent: classification.spread,
        contract_rate_type: classification.rateType,
        market_rate_indicative_percent: item.taxa_indicativa,
        market_source: 'ANBIMA_CRI_CRA'
      };
    }
  });

  // 4. FIDC
  await processAnbimaTable(supabase, result, riskMap, {
    tableName: 'anbima_fidc',
    assetType: 'fidc',
    mapFn: (item: any, risk: any) => {
      const rawYield = item.tipo_remuneracao || '';
      const classification = inferYieldProfile(rawYield, 'fidc');
      
      return {
        source: 'anbima',
        source_id: item.id,
        source_table: 'anbima_fidc',
        asset_type: 'fidc',
        asset_code: item.codigo_b3,
        display_name: item.nome || `FIDC ${item.emissor}`,
        issuer: item.emissor,
        maturity_date: item.data_vencimento,
        profitability: classification.profile !== 'DESCONHECIDO' 
          ? formatProfitabilityDisplay(classification) 
          : rawYield || 'Consultar prospecto',
        liquidity: 'Baixa',
        risk_score: risk?.risk_score || 14,
        risk_category: risk?.risk_category || 'Alto',
        std_deviation: item.desvio_padrao,
        source_updated_at: item.updated_at,
        risk_calculated_at: risk?.calculated_at,
        // Campos estruturados
        yield_profile: classification.profile,
        contract_indexer: classification.indexer,
        contract_spread_percent: classification.spread,
        contract_rate_type: classification.rateType,
        market_rate_indicative_percent: item.taxa_indicativa,
        market_source: 'ANBIMA_FIDC'
      };
    }
  });

  // 5. Letras Financeiras
  await processAnbimaTable(supabase, result, riskMap, {
    tableName: 'anbima_letras_financeiras',
    assetType: 'letra_financeira',
    mapFn: (item: any, risk: any) => {
      const rawYield = item.indexador || 'CDI';
      const classification = inferYieldProfile(rawYield, 'letra_financeira');
      
      return {
        source: 'anbima',
        source_id: item.id,
        source_table: 'anbima_letras_financeiras',
        asset_type: 'letra_financeira',
        asset_code: item.letra_financeira,
        display_name: `LF ${item.emissor}`,
        issuer: item.emissor,
        issuer_cnpj: item.cnpj_emissor,
        profitability: classification.profile !== 'DESCONHECIDO' 
          ? formatProfitabilityDisplay(classification) 
          : rawYield,
        liquidity: 'Baixa',
        risk_score: risk?.risk_score || 8,
        risk_category: risk?.risk_category || 'Moderado',
        source_updated_at: item.updated_at,
        risk_calculated_at: risk?.calculated_at,
        // Campos estruturados
        yield_profile: classification.profile,
        contract_indexer: classification.indexer,
        contract_spread_percent: classification.spread,
        contract_rate_type: classification.rateType,
        market_source: 'ANBIMA_LETRAS_FINANCEIRAS'
      };
    }
  });

  // 6. Fundos
  await processAnbimaTable(supabase, result, riskMap, {
    tableName: 'anbima_fundos',
    assetType: 'fundo',
    mapFn: (item: any, risk: any) => {
      // Fundos são classificados como VARIAVEL pelo inferYieldProfile
      const classification = inferYieldProfile(item.tipo_fundo, 'fundo');
      
      return {
        source: 'anbima',
        source_id: item.id,
        source_table: 'anbima_fundos',
        asset_type: 'fundo',
        asset_code: item.codigo_fundo,
        display_name: item.nome_comercial_fundo || item.razao_social_fundo,
        issuer: item.razao_social_fundo,
        profitability: item.tipo_fundo,
        liquidity: 'Variável',
        risk_score: risk?.risk_score || 10,
        risk_category: risk?.risk_category || 'Moderado',
        source_updated_at: item.updated_at,
        risk_calculated_at: risk?.calculated_at,
        // Campos estruturados
        yield_profile: classification.profile,
        contract_indexer: classification.indexer,
        contract_spread_percent: classification.spread,
        contract_rate_type: classification.rateType,
        market_source: 'ANBIMA_FUNDOS'
      };
    }
  });

  return result;
}

async function processAnbimaTable(
  supabase: any, 
  result: TransformResult, 
  riskMap: Map<string, any>,
  config: {
    tableName: string;
    assetType: string;
    mapFn: (item: any, risk: any) => UnifiedAsset;
  }
) {
  const { data, error } = await supabase
    .from(config.tableName)
    .select('*')
    .limit(10000);

  if (error) {
    result.errors += 1;
    result.errorDetails.push(`Erro ao buscar ${config.tableName}: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    console.log(`⚠️ Nenhum dado em ${config.tableName}`);
    return;
  }

  console.log(`  📥 ${config.tableName}: ${data.length} registros`);

  const chunkSize = 500;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    
    const unifiedAssets: UnifiedAsset[] = chunk.map((item: any) => {
      const riskKey = `${config.assetType}_${item.id}`;
      const risk = riskMap.get(riskKey);
      const asset = config.mapFn(item, risk);
      
      // Contabilizar yield_profile
      const profile = asset.yield_profile || 'DESCONHECIDO';
      result.yieldProfileStats![profile] = (result.yieldProfileStats![profile] || 0) + 1;
      
      return asset;
    });

    const { error: upsertError } = await supabase
      .from('unified_assets')
      .upsert(unifiedAssets, { onConflict: 'source,source_id' });

    if (upsertError) {
      result.errors += chunk.length;
      result.errorDetails.push(`Erro ao upsert ${config.tableName}: ${upsertError.message}`);
    } else {
      result.processed += chunk.length;
      result.inserted += chunk.length;
    }
  }
}

// ============================================
// TRANSFORMAÇÃO CVM (Ofertas Públicas)
// ============================================

async function transformCvm(supabase: any): Promise<TransformResult> {
  console.log('📊 Transformando dados CVM...');
  
  const result: TransformResult = {
    source: 'cvm',
    processed: 0,
    inserted: 0,
    updated: 0,
    errors: 0,
    errorDetails: [],
    yieldProfileStats: {}
  };

  const { data: cvmOffers, error } = await supabase
    .from('cvm_ofertas_publicas')
    .select('*')
    .eq('is_active', true);

  if (error) {
    result.errors = 1;
    result.errorDetails.push(`Erro ao buscar CVM: ${error.message}`);
    return result;
  }

  if (!cvmOffers || cvmOffers.length === 0) {
    console.log('⚠️ Nenhuma oferta CVM ativa encontrada');
    return result;
  }

  console.log(`📥 Processando ${cvmOffers.length} ofertas CVM...`);

  // Buscar risk scores
  const { data: riskScores } = await supabase
    .from('anbima_asset_risk_scores')
    .select('*')
    .in('asset_type', ['cvm_cri', 'cvm_cra', 'cvm_debenture']);

  const riskMap = new Map();
  riskScores?.forEach((r: any) => {
    riskMap.set(r.asset_id, r);
  });

  const mapCvmAssetType = (tipo: string): string => {
    const tipoUpper = tipo.toUpperCase();
    if (tipoUpper.includes('IMOBILIÁRI') || tipoUpper.includes('CRI')) return 'cri';
    if (tipoUpper.includes('AGRONEGÓCIO') || tipoUpper.includes('CRA')) return 'cra';
    if (tipoUpper.includes('DEBÊNTURE') || tipoUpper.includes('DEBENTURE')) return 'debenture';
    return 'debenture';
  };

  // Construir rentabilidade raw a partir dos campos CVM
  const buildRawYield = (offer: any): string => {
    let raw = '';
    if (offer.atualizacao_monetaria) raw = offer.atualizacao_monetaria;
    if (offer.juros) {
      raw = raw ? `${raw} + ${offer.juros}` : offer.juros;
    }
    return raw;
  };

  const unifiedAssets: UnifiedAsset[] = cvmOffers.map((offer: any) => {
    const risk = riskMap.get(offer.id);
    const assetType = mapCvmAssetType(offer.tipo_ativo);
    const rawYield = buildRawYield(offer);
    
    // Classificar
    const classification = inferYieldProfile(rawYield, assetType);
    result.yieldProfileStats![classification.profile] = (result.yieldProfileStats![classification.profile] || 0) + 1;

    // Gerar asset_code único
    const tipoCode = assetType.toUpperCase();
    const cnpjShort = offer.cnpj_emissor?.replace(/[^\d]/g, '').substring(0, 8) || 'NOCNPJ';
    const serieCode = offer.serie ? `S${offer.serie}` : '';
    const vencCode = offer.data_vencimento ? offer.data_vencimento.substring(2, 4) + offer.data_vencimento.substring(5, 7) : '';
    const idShort = offer.id.substring(0, 6);
    const uniqueAssetCode = `${tipoCode}_${cnpjShort}${serieCode ? '_' + serieCode : ''}${vencCode ? '_' + vencCode : ''}_${idShort}`;

    return {
      source: 'cvm',
      source_id: offer.id,
      source_table: 'cvm_ofertas_publicas',
      asset_type: assetType,
      asset_code: uniqueAssetCode,
      display_name: `${offer.tipo_ativo} ${offer.nome_emissor}${offer.serie ? ` - Série ${offer.serie}` : ''}`,
      issuer: offer.nome_emissor,
      issuer_cnpj: offer.cnpj_emissor,
      maturity_date: offer.data_vencimento,
      profitability: classification.profile !== 'DESCONHECIDO' 
        ? formatProfitabilityDisplay(classification) 
        : rawYield || 'Consultar prospecto',
      liquidity: 'Baixa',
      risk_score: risk?.risk_score || 12,
      risk_category: risk?.risk_category || 'Moderado',
      source_updated_at: offer.updated_at,
      risk_calculated_at: risk?.calculated_at,
      // Campos estruturados
      yield_profile: classification.profile,
      contract_indexer: classification.indexer,
      contract_spread_percent: classification.spread,
      contract_rate_type: classification.rateType,
      market_source: 'CVM_OFERTAS_PUBLICAS'
    };
  });

  const { error: upsertError, count } = await supabase
    .from('unified_assets')
    .upsert(unifiedAssets, { 
      onConflict: 'source,source_id',
      count: 'exact'
    });

  if (upsertError) {
    result.errors = cvmOffers.length;
    result.errorDetails.push(`Erro ao upsert CVM: ${upsertError.message}`);
  } else {
    result.processed = cvmOffers.length;
    result.inserted = count || cvmOffers.length;
  }

  return result;
}
