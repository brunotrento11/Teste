import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RiskCalculationInput {
  investment_id: string;
  asset_type: 'titulo_publico' | 'debenture' | 'cri_cra' | 'fidc' | 'letra_financeira' | 'fundo';
  asset_code: string;
  investment_amount: number;
}

interface RiskIndicators {
  var_95: number;
  beta: number;
  sharpe_ratio: number;
  std_deviation: number;
  expected_return: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { investment_id, asset_type, asset_code, investment_amount } = await req.json() as RiskCalculationInput;

    console.log(`📊 Calculando risco para investimento ${investment_id}`);
    console.log(`Tipo: ${asset_type}, Código: ${asset_code}, Valor: ${investment_amount}`);

    // Buscar dados históricos do ativo na base ANBIMA
    let assetData: any = null;
    let tableName = '';

    switch (asset_type) {
      case 'titulo_publico':
        tableName = 'anbima_titulos_publicos';
        const { data: titulosData } = await supabase
          .from(tableName)
          .select('*')
          .eq('codigo_isin', asset_code)
          .order('data_referencia', { ascending: false })
          .limit(30);
        assetData = titulosData;
        break;

      case 'debenture':
        tableName = 'anbima_debentures';
        const { data: debenturesData } = await supabase
          .from(tableName)
          .select('*')
          .eq('codigo_ativo', asset_code)
          .order('data_referencia', { ascending: false })
          .limit(30);
        assetData = debenturesData;
        break;

      case 'cri_cra':
        tableName = 'anbima_cri_cra';
        const { data: criCraData } = await supabase
          .from(tableName)
          .select('*')
          .eq('codigo_ativo', asset_code)
          .order('data_referencia', { ascending: false })
          .limit(30);
        assetData = criCraData;
        break;

      case 'fidc':
        tableName = 'anbima_fidc';
        const { data: fidcData } = await supabase
          .from(tableName)
          .select('*')
          .eq('codigo_b3', asset_code)
          .order('data_referencia', { ascending: false })
          .limit(30);
        assetData = fidcData;
        break;

      case 'letra_financeira':
        tableName = 'anbima_letras_financeiras';
        const { data: lfData } = await supabase
          .from(tableName)
          .select('*')
          .eq('letra_financeira', asset_code)
          .order('data_referencia', { ascending: false })
          .limit(30);
        assetData = lfData;
        break;

      case 'fundo':
        tableName = 'anbima_fundos';
        const { data: fundoData } = await supabase
          .from(tableName)
          .select('*')
          .eq('codigo_fundo', asset_code)
          .single();
        assetData = fundoData ? [fundoData] : null;
        break;
    }

    if (!assetData || assetData.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Dados insuficientes para calcular risco',
          message: 'Não foram encontrados dados históricos para este ativo',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calcular indicadores de risco
    const indicators = calculateRiskIndicators(assetData, asset_type, investment_amount);

    // Salvar indicadores no banco
    const { data: savedIndicator, error: saveError } = await supabase
      .from('investment_risk_indicators')
      .insert({
        user_investment_id: investment_id,
        var_95: indicators.var_95,
        beta: indicators.beta,
        sharpe_ratio: indicators.sharpe_ratio,
        std_deviation: indicators.std_deviation,
        data_source: `ANBIMA - ${tableName}`,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Erro ao salvar indicadores:', saveError);
      throw saveError;
    }

    // Calcular score de risco e compatibilidade com perfis
    const riskScore = calculateRiskScore(indicators);
    const profileCompatibility = determineProfileCompatibility(riskScore);

    // Salvar histórico de score
    const { error: scoreError } = await supabase
      .from('risk_score_history')
      .insert({
        investment_id: investment_id,
        risk_indicators_id: savedIndicator.id,
        score: riskScore,
        risk_category: getRiskCategory(riskScore),
        compatible_with_conservador: profileCompatibility.conservador,
        compatible_with_moderado: profileCompatibility.moderado,
        compatible_with_arrojado: profileCompatibility.arrojado,
        justification: generateRiskJustification(indicators, riskScore),
      });

    if (scoreError) {
      console.error('Erro ao salvar score:', scoreError);
      throw scoreError;
    }

    console.log(`✅ Indicadores calculados e salvos com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        indicators: {
          ...indicators,
          risk_score: riskScore,
          risk_category: getRiskCategory(riskScore),
          profile_compatibility: profileCompatibility,
        },
        data_points: assetData.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao calcular risco:', error);
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function calculateRiskIndicators(
  assetData: any[],
  assetType: string,
  investmentAmount: number
): RiskIndicators {
  // Extrair taxas/retornos dos dados
  const returns: number[] = [];
  
  for (let i = 0; i < assetData.length - 1; i++) {
    const current = assetData[i];
    const previous = assetData[i + 1];
    
    let currentValue = 0;
    let previousValue = 0;

    // Extrair valores conforme tipo de ativo
    if (assetType === 'fundo') {
      // Para fundos, usar dados da classe (se disponível)
      continue; // Por enquanto, skip fundos
    } else {
      currentValue = parseFloat(current.taxa_indicativa || current.pu || 0);
      previousValue = parseFloat(previous.taxa_indicativa || previous.pu || 0);
    }

    if (currentValue > 0 && previousValue > 0) {
      const dailyReturn = (currentValue - previousValue) / previousValue;
      returns.push(dailyReturn);
    }
  }

  // Se não tiver retornos suficientes, usar valores padrão baseados no tipo
  if (returns.length < 5) {
    return getDefaultIndicators(assetType);
  }

  // Calcular média e desvio padrão dos retornos
  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDeviation = Math.sqrt(variance);

  // Anualizar métricas (assumindo retornos diários)
  const annualizedReturn = meanReturn * 252;
  const annualizedStdDev = stdDeviation * Math.sqrt(252);

  // Calcular VaR 95% (Value at Risk)
  // VaR = média - (1.645 * desvio padrão) para 95% de confiança
  const var95Percent = (meanReturn - 1.645 * stdDeviation) * investmentAmount;

  // Calcular Beta (aproximado usando desvio padrão relativo ao mercado)
  // Assumindo mercado com volatilidade de 15% ao ano
  const marketVolatility = 0.15;
  const beta = annualizedStdDev / marketVolatility;

  // Calcular Sharpe Ratio
  // Assumindo taxa livre de risco de 10.5% ao ano (Selic aproximada)
  const riskFreeRate = 0.105;
  const sharpeRatio = (annualizedReturn - riskFreeRate) / annualizedStdDev;

  return {
    var_95: Math.abs(var95Percent),
    beta: beta,
    sharpe_ratio: sharpeRatio,
    std_deviation: annualizedStdDev,
    expected_return: annualizedReturn,
  };
}

function getDefaultIndicators(assetType: string): RiskIndicators {
  // Valores padrão recalibrados baseados em características típicas de cada ativo
  const defaults: Record<string, RiskIndicators> = {
    // Baixo risco - Títulos públicos (referência de menor risco)
    titulo_publico: {
      var_95: 0.01,
      beta: 0.2,
      sharpe_ratio: 0.9,
      std_deviation: 0.03,
      expected_return: 0.105,
    },
    // Baixo risco - CDB com garantia FGC
    cdb: {
      var_95: 0.015,
      beta: 0.25,
      sharpe_ratio: 0.85,
      std_deviation: 0.04,
      expected_return: 0.11,
    },
    // Baixo risco - LCI/LCA (isentos de IR)
    lci_lca: {
      var_95: 0.015,
      beta: 0.25,
      sharpe_ratio: 0.85,
      std_deviation: 0.04,
      expected_return: 0.095,
    },
    // Risco moderado - CRI/CRA (recalibrado)
    cri_cra: {
      var_95: 0.025,
      beta: 0.4,
      sharpe_ratio: 0.6,
      std_deviation: 0.06,
      expected_return: 0.13,
    },
    // Risco moderado - Debêntures (recalibrado)
    debenture: {
      var_95: 0.03,
      beta: 0.5,
      sharpe_ratio: 0.55,
      std_deviation: 0.07,
      expected_return: 0.135,
    },
    // Risco moderado - Letras Financeiras (recalibrado)
    letra_financeira: {
      var_95: 0.025,
      beta: 0.4,
      sharpe_ratio: 0.65,
      std_deviation: 0.06,
      expected_return: 0.12,
    },
    // Alto risco - FIDC
    fidc: {
      var_95: 0.06,
      beta: 0.8,
      sharpe_ratio: 0.4,
      std_deviation: 0.12,
      expected_return: 0.15,
    },
    // Alto risco - Fundos
    fundo: {
      var_95: 0.08,
      beta: 1.0,
      sharpe_ratio: 0.5,
      std_deviation: 0.15,
      expected_return: 0.16,
    },
  };

  return defaults[assetType] || defaults.cdb;
}

function calculateRiskScore(indicators: RiskIndicators): number {
  // Score de 1 a 20 baseado nos indicadores (recalibrado)
  // Menor score = menor risco
  
  // Ajustar pesos para refletir melhor a realidade de renda fixa
  const varScore = Math.min(indicators.var_95 * 100, 8); // Reduzido de 200 para 100
  const betaScore = Math.min(indicators.beta * 5, 6); // Aumentado de 4 para 5
  const volatilityScore = Math.min(indicators.std_deviation * 30, 6); // Aumentado de 20 para 30
  
  const totalScore = varScore + betaScore + volatilityScore;
  
  return Math.max(1, Math.min(Math.round(totalScore), 20));
}

function getRiskCategory(score: number): string {
  if (score <= 6) return 'Baixo';
  if (score <= 13) return 'Médio';
  return 'Alto';
}

function determineProfileCompatibility(score: number): {
  conservador: boolean;
  moderado: boolean;
  arrojado: boolean;
} {
  return {
    conservador: score <= 8,
    moderado: score >= 5 && score <= 14,
    arrojado: score >= 10,
  };
}

function generateRiskJustification(indicators: RiskIndicators, score: number): string {
  const category = getRiskCategory(score);
  const sharpe = indicators.sharpe_ratio.toFixed(2);
  const beta = indicators.beta.toFixed(2);
  const volatility = (indicators.std_deviation * 100).toFixed(2);

  return `Risco ${category} (Score: ${score}/20). ` +
    `Sharpe Ratio: ${sharpe}, Beta: ${beta}, ` +
    `Volatilidade anualizada: ${volatility}%. ` +
    `VaR 95%: R$ ${indicators.var_95.toFixed(2)} por dia de negociação.`;
}
