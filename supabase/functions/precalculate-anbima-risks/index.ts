import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RiskCalculation {
  asset_type: string;
  asset_id: string;
  asset_code: string;
  emissor: string;
  data_vencimento: string | null;
  rentabilidade: string;
  risk_score: number;
  risk_category: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Health check endpoint
    if (req.method === 'GET' && action === 'health') {
      console.log('🏥 Executando health check para precalculate-anbima-risks');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Credenciais Supabase não encontradas');
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Buscar última execução
      const { data: lastExecution } = await supabase
        .from('sync_execution_stats')
        .select('*')
        .eq('function_name', 'precalculate-anbima-risks')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      // Buscar estatísticas atuais dos risk scores
      const { data: riskScores, error: scoresError } = await supabase
        .from('anbima_asset_risk_scores')
        .select('asset_type, risk_score, risk_category');
      
      if (scoresError) {
        console.error('Erro ao buscar risk scores:', scoresError);
      }
      
      const currentStats = {
        total_assets: riskScores?.length || 0,
        avg_risk_score: riskScores?.length ? 
          (riskScores.reduce((sum, s) => sum + s.risk_score, 0) / riskScores.length).toFixed(2) : 0,
        min_risk_score: riskScores?.length ? Math.min(...riskScores.map(s => s.risk_score)) : 0,
        max_risk_score: riskScores?.length ? Math.max(...riskScores.map(s => s.risk_score)) : 0,
        distribution_by_type: riskScores?.reduce((acc, s) => {
          acc[s.asset_type] = (acc[s.asset_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
        distribution_by_risk: riskScores?.reduce((acc, s) => {
          acc[s.risk_category] = (acc[s.risk_category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {},
      };
      
      // Detectar anomalias
      const anomalies: string[] = [];
      
      if (!lastExecution) {
        anomalies.push('no_previous_execution');
      } else {
        // Verificar queda no número de ativos
        if (lastExecution.total_assets_processed && currentStats.total_assets < lastExecution.total_assets_processed * 0.8) {
          anomalies.push('count_drop');
        }
        
        // Verificar spike no número de ativos
        if (lastExecution.total_assets_processed && currentStats.total_assets > lastExecution.total_assets_processed * 1.5) {
          anomalies.push('count_spike');
        }
        
        // Verificar variação significativa no score médio
        if (lastExecution.avg_risk_score) {
          const scoreDiff = Math.abs(parseFloat(currentStats.avg_risk_score.toString()) - lastExecution.avg_risk_score);
          if (scoreDiff > 2) {
            anomalies.push('risk_shift');
          }
        }
        
        // Verificar dados desatualizados (>7 dias sem execução)
        const daysSinceLastExecution = (Date.now() - new Date(lastExecution.completed_at || lastExecution.started_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastExecution > 7) {
          anomalies.push('stale_data');
        }
      }
      
      // Buscar alertas pendentes
      const { data: pendingAlerts } = await supabase
        .from('sync_anomaly_alerts')
        .select('*')
        .eq('is_acknowledged', false)
        .order('created_at', { ascending: false });
      
      const healthStatus = {
        status: anomalies.length === 0 ? 'healthy' : anomalies.includes('no_previous_execution') ? 'warning' : 'unhealthy',
        last_execution: lastExecution ? {
          started_at: lastExecution.started_at,
          completed_at: lastExecution.completed_at,
          duration_ms: lastExecution.duration_ms,
          total_assets_processed: lastExecution.total_assets_processed,
          total_errors: lastExecution.total_errors,
          avg_risk_score: lastExecution.avg_risk_score,
          distribution_by_type: lastExecution.distribution_by_type,
          distribution_by_risk_category: lastExecution.distribution_by_risk_category,
        } : null,
        current_stats: currentStats,
        anomalies: anomalies,
        pending_alerts_count: pendingAlerts?.length || 0,
      };
      
      console.log('✅ Health check concluído:', healthStatus);
      
      return new Response(JSON.stringify(healthStatus), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🧮 Iniciando pré-cálculo de scores de risco ANBIMA');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Credenciais Supabase não encontradas');
    }

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não encontrada');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const executionStartTime = Date.now();
    const executionId = crypto.randomUUID();
    
    // Registrar início da execução
    await supabase.from('sync_execution_stats').insert({
      id: executionId,
      function_name: 'precalculate-anbima-risks',
      execution_type: 'risk_calculation',
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by: 'manual',
    });

    let totalProcessed = 0;
    let totalErrors = 0;
    const distributionByType: Record<string, number> = {};
    const distributionByRisk: Record<string, number> = {};
    let sumRiskScore = 0;
    let minRiskScore = 20;
    let maxRiskScore = 1;

    // Processar cada tipo de ativo
    const assetTables = [
      { table: 'anbima_cri_cra', type: 'cri_cra' },
      { table: 'anbima_debentures', type: 'debenture' },
      { table: 'anbima_fidc', type: 'fidc' },
      { table: 'anbima_titulos_publicos', type: 'titulo_publico' },
    ];

    for (const { table, type } of assetTables) {
      console.log(`\n📊 Processando ${table}...`);

      const { data: assets, error } = await supabase
        .from(table)
        .select('*')
        .limit(100); // Limitar para não sobrecarregar

      if (error) {
        console.error(`❌ Erro ao buscar ${table}:`, error);
        totalErrors++;
        continue;
      }

      console.log(`✅ Encontrados ${assets?.length || 0} ativos em ${table}`);

      for (const asset of assets || []) {
        try {
          const calculation = await calculateRiskScore(asset, type, lovableApiKey);
          
          // Salvar score calculado
          const { error: upsertError } = await supabase
            .from('anbima_asset_risk_scores')
            .upsert({
              asset_type: calculation.asset_type,
              asset_id: calculation.asset_id,
              asset_code: calculation.asset_code,
              emissor: calculation.emissor,
              data_vencimento: calculation.data_vencimento,
              rentabilidade: calculation.rentabilidade,
              risk_score: calculation.risk_score,
              risk_category: calculation.risk_category,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'asset_type,asset_id'
            });

          if (upsertError) {
            console.error(`❌ Erro ao salvar score para ${calculation.asset_code}:`, upsertError);
            totalErrors++;
          } else {
            totalProcessed++;
            distributionByType[calculation.asset_type] = (distributionByType[calculation.asset_type] || 0) + 1;
            distributionByRisk[calculation.risk_category] = (distributionByRisk[calculation.risk_category] || 0) + 1;
            sumRiskScore += calculation.risk_score;
            minRiskScore = Math.min(minRiskScore, calculation.risk_score);
            maxRiskScore = Math.max(maxRiskScore, calculation.risk_score);
            if (totalProcessed % 10 === 0) {
              console.log(`✅ Processados ${totalProcessed} ativos...`);
            }
          }

        } catch (error) {
          console.error(`❌ Erro ao processar ativo:`, error);
          totalErrors++;
        }
      }
    }

    const avgRiskScore = totalProcessed > 0 ? sumRiskScore / totalProcessed : 0;
    const executionDuration = Date.now() - executionStartTime;
    
    // Atualizar estatísticas da execução
    await supabase.from('sync_execution_stats').update({
      completed_at: new Date().toISOString(),
      status: 'completed',
      duration_ms: executionDuration,
      total_assets_processed: totalProcessed,
      total_errors: totalErrors,
      distribution_by_type: distributionByType,
      distribution_by_risk_category: distributionByRisk,
      avg_risk_score: avgRiskScore,
      min_risk_score: minRiskScore,
      max_risk_score: maxRiskScore,
    }).eq('id', executionId);

    const report = {
      timestamp: new Date().toISOString(),
      total_processed: totalProcessed,
      total_errors: totalErrors,
      avg_risk_score: avgRiskScore.toFixed(2),
      distribution_by_type: distributionByType,
      distribution_by_risk_category: distributionByRisk,
      execution_time_ms: executionDuration,
      message: `Pré-cálculo concluído: ${totalProcessed} scores salvos, ${totalErrors} erros`
    };

    console.log('\n✅ Pré-cálculo concluído:', report);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no pré-cálculo:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function calculateRiskScore(
  asset: any,
  assetType: string,
  lovableApiKey: string
): Promise<RiskCalculation> {
  
  // Extrair informações do ativo
  const codigo = asset.codigo_ativo || asset.codigo_b3 || asset.codigo_isin || asset.codigo_fundo || 'N/A';
  const emissor = asset.emissor || 'N/A';
  const dataVencimento = asset.data_vencimento || null;
  
  // Calcular rentabilidade
  let rentabilidade = 'Consultar';
  if (assetType === 'cri_cra' && asset.tipo_remuneracao && asset.taxa_indicativa) {
    rentabilidade = `${asset.tipo_remuneracao} + ${asset.taxa_indicativa}%`;
  } else if (assetType === 'debenture' && asset.percentual_taxa) {
    rentabilidade = asset.percentual_taxa;
  } else if (assetType === 'titulo_publico' && asset.taxa_indicativa) {
    rentabilidade = `${asset.taxa_indicativa}% a.a.`;
  }

  // Indicadores para o cálculo de risco
  const indicators = {
    desvio_padrao: asset.desvio_padrao || null,
    duration: asset.duration || null,
    taxa_indicativa: asset.taxa_indicativa || null,
    tipo_remuneracao: asset.tipo_remuneracao || null,
    data_vencimento: dataVencimento,
  };

  // Calcular score usando IA (prompt recalibrado para renda fixa)
  const prompt = `Você é um analista de risco de investimentos brasileiro. Calcule um score de risco de 1 a 20 para este ativo de renda fixa do tipo ${assetType}.

IMPORTANTE: Este é um produto de RENDA FIXA, não renda variável. O score deve refletir risco de crédito e liquidez, NÃO volatilidade de preço.

Indicadores do ativo:
- Desvio Padrão: ${indicators.desvio_padrao || 'N/A'} (em pontos percentuais)
- Duration: ${indicators.duration || 'N/A'} (em anos)
- Taxa Indicativa: ${indicators.taxa_indicativa || 'N/A'}% a.a.
- Tipo Remuneração: ${indicators.tipo_remuneracao || 'N/A'}
- Data Vencimento: ${indicators.data_vencimento || 'N/A'}
- Emissor: ${emissor}

Critérios de avaliação (pesos):
1. Qualidade do emissor (40%): Governo < Banco Grande < Securitizadora < Empresa
2. Desvio padrão (30%): <0.5 = baixo, 0.5-2.0 = moderado, >2.0 = alto
3. Liquidez (20%): Título público > CDB > CRI/Debênture > FIDC
4. Duration (10%): Só penalizar se >7 anos

Escalas de referência:
- 1-6: Baixo risco (Títulos públicos, CDBs grandes bancos)
- 7-13: Risco moderado (CRI/CRA, LF, Debêntures IG)
- 14-20: Alto risco (FIDC, Debêntures HY)

Retorne apenas um número de 1 a 20.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um analista de risco. Responda apenas com um número de 1 a 20.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 50,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const scoreText = aiData.choices[0]?.message?.content || '10';
    let score = parseInt(scoreText.match(/\d+/)?.[0] || '10');
    
    // Garantir que está no range 1-20
    score = Math.max(1, Math.min(20, score));

    // Determinar categoria de risco
    let category = 'Moderado';
    if (score <= 7) category = 'Baixo';
    else if (score >= 15) category = 'Alto';

    return {
      asset_type: assetType,
      asset_id: asset.id,
      asset_code: codigo,
      emissor,
      data_vencimento: dataVencimento,
      rentabilidade,
      risk_score: score,
      risk_category: category,
    };

  } catch (error) {
    console.error('❌ Erro na IA, usando fallback recalibrado:', error);
    
    // Fallback recalibrado: começar com score baixo para renda fixa
    let baseScore = 5; // Base baixa para renda fixa
    
    // Ajustar por tipo de ativo
    if (assetType === 'titulo_publico') baseScore = 3;
    else if (assetType === 'cri_cra') baseScore = 6;
    else if (assetType === 'debenture') baseScore = 8;
    else if (assetType === 'fidc') baseScore = 13;
    
    // Ajustes incrementais baseados em indicadores
    if (indicators.desvio_padrao) {
      // Desvio padrão em pontos percentuais (0-5 típico para renda fixa)
      if (indicators.desvio_padrao > 2.0) baseScore += 3;
      else if (indicators.desvio_padrao > 1.0) baseScore += 1;
    }
    
    if (indicators.duration) {
      // Só penalizar duration muito longa (>7 anos)
      if (indicators.duration > 7) baseScore += 2;
    }
    
    // Ajustar por qualidade do emissor
    const emissorLower = emissor.toLowerCase();
    if (emissorLower.includes('tesouro') || emissorLower.includes('governo')) {
      baseScore = Math.max(1, baseScore - 2);
    } else if (emissorLower.includes('banco do brasil') || emissorLower.includes('caixa') || 
               emissorLower.includes('itau') || emissorLower.includes('bradesco') || 
               emissorLower.includes('santander')) {
      baseScore = Math.max(2, baseScore - 1);
    }

    const score = Math.max(1, Math.min(20, baseScore));
    
    let category = 'Moderado';
    if (score <= 6) category = 'Baixo';
    else if (score >= 14) category = 'Alto';

    return {
      asset_type: assetType,
      asset_id: asset.id,
      asset_code: codigo,
      emissor,
      data_vencimento: dataVencimento,
      rentabilidade,
      risk_score: score,
      risk_category: category,
    };
  }
}
