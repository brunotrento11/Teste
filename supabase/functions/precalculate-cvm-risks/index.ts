import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CvmAsset {
  id: string;
  tipo_ativo: string;
  cnpj_emissor: string;
  nome_emissor: string;
  serie: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  juros: string | null;
  atualizacao_monetaria: string | null;
  valor_total_emissao: number | null;
}

interface Anomaly {
  type: string;
  severity: string;
  metric: string;
  expected?: number;
  actual?: number;
  deviation?: number;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Endpoint /health
    if (action === 'health') {
      return new Response(
        JSON.stringify(await handleHealthCheck(supabase)),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Execução normal do cálculo de risco
    return new Response(
      JSON.stringify(await handleRiskCalculation(supabase)),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in precalculate-cvm-risks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleHealthCheck(supabase: any) {
  // Buscar última execução
  const { data: lastExecution } = await supabase
    .from('sync_execution_stats')
    .select('*')
    .eq('function_name', 'precalculate-cvm-risks')
    .eq('status', 'success')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  // Calcular estatísticas atuais
  const currentStats = await getCurrentStats(supabase);

  // Detectar anomalias
  const anomalies = detectAnomalies(lastExecution, currentStats);

  // Buscar alertas pendentes
  const { data: pendingAlerts } = await supabase
    .from('sync_anomaly_alerts')
    .select('*')
    .eq('is_acknowledged', false)
    .order('created_at', { ascending: false });

  return {
    status: anomalies.length > 0 ? 'warning' : 'healthy',
    last_execution: lastExecution || null,
    current_stats: currentStats,
    anomalies: anomalies,
    pending_alerts: pendingAlerts?.length || 0,
    generated_at: new Date().toISOString()
  };
}

async function getCurrentStats(supabase: any) {
  // Buscar estatísticas dos ativos CVM com risk scores
  const { data: scores } = await supabase
    .from('anbima_asset_risk_scores')
    .select('asset_type, risk_category, risk_score')
    .in('asset_type', ['cvm_cri', 'cvm_cra', 'cvm_debenture']);

  if (!scores || scores.length === 0) {
    return {
      total_assets: 0,
      by_type: {},
      by_risk_category: {},
      avg_risk_score: 0
    };
  }

  // Calcular distribuições
  const byType: Record<string, number> = {};
  const byRiskCategory: Record<string, number> = {};
  let totalScore = 0;

  scores.forEach((score: any) => {
    byType[score.asset_type] = (byType[score.asset_type] || 0) + 1;
    byRiskCategory[score.risk_category] = (byRiskCategory[score.risk_category] || 0) + 1;
    totalScore += score.risk_score;
  });

  return {
    total_assets: scores.length,
    by_type: byType,
    by_risk_category: byRiskCategory,
    avg_risk_score: scores.length > 0 ? (totalScore / scores.length).toFixed(2) : 0
  };
}

function detectAnomalies(lastExecution: any, currentStats: any): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (!lastExecution) {
    anomalies.push({
      type: 'no_history',
      severity: 'info',
      metric: 'execution_history',
      message: 'Nenhuma execução anterior encontrada'
    });
    return anomalies;
  }

  // Verificar variação no total de ativos
  const lastTotal = lastExecution.total_assets_processed || 0;
  const currentTotal = currentStats.total_assets;
  
  if (lastTotal > 0) {
    const countVariation = ((currentTotal - lastTotal) / lastTotal) * 100;
    
    if (countVariation < -10) {
      anomalies.push({
        type: 'count_drop',
        severity: 'warning',
        metric: 'total_assets',
        expected: lastTotal,
        actual: currentTotal,
        deviation: countVariation,
        message: `Queda de ${Math.abs(countVariation).toFixed(1)}% no total de ativos`
      });
    } else if (countVariation > 50) {
      anomalies.push({
        type: 'count_spike',
        severity: 'info',
        metric: 'total_assets',
        expected: lastTotal,
        actual: currentTotal,
        deviation: countVariation,
        message: `Aumento de ${countVariation.toFixed(1)}% no total de ativos`
      });
    }
  }

  // Verificar variação no score médio
  const lastAvgScore = parseFloat(lastExecution.avg_risk_score) || 0;
  const currentAvgScore = parseFloat(currentStats.avg_risk_score) || 0;
  
  if (lastAvgScore > 0) {
    const scoreVariation = ((currentAvgScore - lastAvgScore) / lastAvgScore) * 100;
    
    if (Math.abs(scoreVariation) > 15) {
      anomalies.push({
        type: 'risk_shift',
        severity: 'warning',
        metric: 'avg_risk_score',
        expected: lastAvgScore,
        actual: currentAvgScore,
        deviation: scoreVariation,
        message: `Variação de ${scoreVariation.toFixed(1)}% no score médio de risco`
      });
    }
  }

  // Verificar dados obsoletos
  const lastExecutionDate = new Date(lastExecution.completed_at);
  const daysSinceLastExecution = (Date.now() - lastExecutionDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSinceLastExecution > 7) {
    anomalies.push({
      type: 'stale_data',
      severity: 'warning',
      metric: 'days_since_execution',
      expected: 7,
      actual: Math.floor(daysSinceLastExecution),
      message: `Última execução há ${Math.floor(daysSinceLastExecution)} dias`
    });
  }

  return anomalies;
}

async function handleRiskCalculation(supabase: any) {
  const startTime = Date.now();
  
  // Criar registro de execução
  const { data: execution, error: execError } = await supabase
    .from('sync_execution_stats')
    .insert({
      function_name: 'precalculate-cvm-risks',
      execution_type: 'manual',
      status: 'running',
      triggered_by: 'api'
    })
    .select()
    .single();

  if (execError) {
    console.error('Error creating execution record:', execError);
    throw new Error('Failed to create execution record');
  }

  const executionId = execution.id;

  try {
    // Buscar ativos CVM ativos
    const { data: cvmAssets, error: fetchError } = await supabase
      .from('cvm_ofertas_publicas')
      .select('*')
      .eq('is_active', true);

    if (fetchError) {
      throw new Error(`Failed to fetch CVM assets: ${fetchError.message}`);
    }

    console.log(`Found ${cvmAssets?.length || 0} active CVM assets`);

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      byType: {} as Record<string, number>,
      byRiskCategory: {} as Record<string, number>,
      scores: [] as number[],
      errorDetails: [] as any[]
    };

    // Processar cada ativo
    for (const asset of cvmAssets || []) {
      try {
        const assetType = mapCvmToAssetType(asset.tipo_ativo);
        if (!assetType) {
          results.skipped++;
          continue;
        }

        // Calcular risk score via IA
        const { score, category } = await calculateRiskScore(asset, supabase);

        // Inserir/atualizar no banco
        const { error: upsertError } = await supabase
          .from('anbima_asset_risk_scores')
          .upsert({
            asset_type: assetType,
            asset_id: asset.id,
            asset_code: `${asset.serie || 'S/S'}-${asset.data_emissao?.substring(0, 10) || 'N/A'}`,
            emissor: asset.nome_emissor,
            data_vencimento: asset.data_vencimento,
            rentabilidade: formatRentabilidade(asset.juros, asset.atualizacao_monetaria),
            risk_score: score,
            risk_category: category,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'asset_type,asset_id'
          });

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }

        results.processed++;
        results.byType[assetType] = (results.byType[assetType] || 0) + 1;
        results.byRiskCategory[category] = (results.byRiskCategory[category] || 0) + 1;
        results.scores.push(score);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing asset ${asset.id}:`, error);
        results.errors++;
        results.errorDetails.push({
          asset_id: asset.id,
          emissor: asset.nome_emissor,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Calcular estatísticas finais
    const avgScore = results.scores.length > 0
      ? results.scores.reduce((a, b) => a + b, 0) / results.scores.length
      : 0;

    const duration = Date.now() - startTime;

    // Atualizar registro de execução
    await supabase
      .from('sync_execution_stats')
      .update({
        status: results.errors > 0 ? 'partial' : 'success',
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        total_assets_processed: results.processed,
        total_assets_skipped: results.skipped,
        total_errors: results.errors,
        distribution_by_type: results.byType,
        distribution_by_risk_category: results.byRiskCategory,
        avg_risk_score: avgScore.toFixed(2),
        min_risk_score: Math.min(...results.scores),
        max_risk_score: Math.max(...results.scores),
        error_details: results.errorDetails
      })
      .eq('id', executionId);

    // Detectar e criar alertas de anomalias
    await createAnomalyAlerts(supabase, executionId);

    return {
      success: true,
      execution_id: executionId,
      duration_ms: duration,
      summary: {
        processed: results.processed,
        skipped: results.skipped,
        errors: results.errors,
        by_type: results.byType,
        by_risk_category: results.byRiskCategory,
        avg_risk_score: avgScore.toFixed(2)
      }
    };
  } catch (error) {
    // Marcar execução como erro
    await supabase
      .from('sync_execution_stats')
      .update({
        status: 'error',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error_details: [{ message: error instanceof Error ? error.message : 'Unknown error' }]
      })
      .eq('id', executionId);

    throw error;
  }
}

async function calculateRiskScore(asset: CvmAsset, supabase: any): Promise<{ score: number; category: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.log('LOVABLE_API_KEY not found, using fallback');
    return calculateFallbackScore(asset);
  }

  const prompt = buildAiPrompt(asset);

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um analista de risco de investimentos brasileiro especializado em renda fixa.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      return calculateFallbackScore(asset);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // Extrair score do response - tentar múltiplos padrões
    let score = null;
    
    // Padrão 1: "score: 10" ou "Score: 10"
    let scoreMatch = aiResponse.match(/score[:\s]+(\d+)/i);
    if (scoreMatch) {
      score = parseInt(scoreMatch[1]);
    }
    
    // Padrão 2: apenas um número sozinho na resposta
    if (!score) {
      scoreMatch = aiResponse.match(/^\s*(\d+)\s*$/);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1]);
      }
    }
    
    // Padrão 3: qualquer número entre 1-20 no texto
    if (!score) {
      scoreMatch = aiResponse.match(/\b([1-9]|1[0-9]|20)\b/);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1]);
      }
    }

    if (score && score >= 1 && score <= 20) {
      console.log(`AI score extracted: ${score} from response: ${aiResponse.substring(0, 100)}`);
      return {
        score,
        category: getCategoryFromScore(score)
      };
    }

    console.log(`Invalid AI score, using fallback. Response: ${aiResponse.substring(0, 200)}`);
    return calculateFallbackScore(asset);
  } catch (error) {
    console.error('AI calculation error:', error);
    return calculateFallbackScore(asset);
  }
}

function buildAiPrompt(asset: CvmAsset): string {
  const anos = calcularAnosAteVencimento(asset.data_vencimento);
  const rentabilidade = formatRentabilidade(asset.juros, asset.atualizacao_monetaria);

  return `Você é um analista de risco brasileiro. Calcule um score de risco de 1 a 20 para este ativo:

TIPO: ${asset.tipo_ativo}
EMISSOR: ${asset.nome_emissor}
RENTABILIDADE: ${rentabilidade}
VENCIMENTO: ${anos.toFixed(1)} anos
VALOR: R$ ${(asset.valor_total_emissao || 0).toLocaleString('pt-BR')}

CRITÉRIOS:
- Emissor (40%): Banco=3-5, Leasing/Securitizadora=6-10, Outros=11-15
- Rentabilidade (25%): CDI puro=baixo, CDI+spread<2%=moderado, IPCA+>5%=alto
- Prazo (20%): <2 anos=+0, 2-5 anos=+1-2, >5 anos=+2-3
- Tipo (15%): Debênture banco<CRA<CRI

ESCALAS:
1-6 = Baixo risco
7-13 = Moderado
14-20 = Alto risco

RESPONDA APENAS COM UM NÚMERO DE 1 A 20. EXEMPLO: 8`;
}

function calculateFallbackScore(asset: CvmAsset): { score: number; category: string } {
  let baseScore = 8;

  // Ajustar por tipo de ativo
  if (asset.tipo_ativo.includes('DEBÊNTURE')) {
    baseScore = 7;
    const emissorLower = asset.nome_emissor.toLowerCase();
    if (emissorLower.includes('leasing') || emissorLower.includes('banco')) {
      baseScore = 5;
    }
  } else if (asset.tipo_ativo.includes('AGRONEGÓCIO')) {
    baseScore = 9;
  } else if (asset.tipo_ativo.includes('IMOBILIÁRIO')) {
    baseScore = 10;
  }

  // Ajustar por prazo
  const anos = calcularAnosAteVencimento(asset.data_vencimento);
  if (anos > 7) baseScore += 2;
  else if (anos > 4) baseScore += 1;

  // Ajustar por rentabilidade (spreads altos = maior risco)
  if (asset.juros) {
    const jurosLower = asset.juros.toLowerCase();
    if (jurosLower.includes('+')) {
      const spreadMatch = jurosLower.match(/\+\s*([\d,\.]+)/);
      if (spreadMatch) {
        const spread = parseFloat(spreadMatch[1].replace(',', '.'));
        if (spread > 4) baseScore += 2;
        else if (spread > 2) baseScore += 1;
      }
    }
  }

  const score = Math.min(20, Math.max(1, baseScore));
  
  return {
    score,
    category: getCategoryFromScore(score)
  };
}

function mapCvmToAssetType(tipoAtivo: string): string | null {
  if (tipoAtivo.includes('CERTIFICADO DE RECEBÍVEIS IMOBILIÁRIOS')) return 'cvm_cri';
  if (tipoAtivo.includes('CERTIFICADO DE RECEBÍVEIS DO AGRONEGÓCIO')) return 'cvm_cra';
  if (tipoAtivo.includes('DEBÊNTURE')) return 'cvm_debenture';
  return null;
}

function formatRentabilidade(juros: string | null, atualizacao: string | null): string {
  if (!juros && !atualizacao) return 'Consultar';
  
  let result = '';
  
  if (atualizacao && atualizacao.trim() !== '') {
    result = atualizacao.trim();
  }
  
  if (juros && juros.trim() !== '') {
    const jurosFormatted = juros.trim();
    if (result) {
      result += ` + ${jurosFormatted}`;
    } else {
      result = jurosFormatted;
    }
  }
  
  return result || 'Consultar';
}

function calcularAnosAteVencimento(dataVencimento: string | null): number {
  if (!dataVencimento) return 5; // Default
  
  const vencimento = new Date(dataVencimento);
  const hoje = new Date();
  const diffMs = vencimento.getTime() - hoje.getTime();
  const diffAnos = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  
  return Math.max(0, diffAnos);
}

function getCategoryFromScore(score: number): string {
  if (score <= 6) return 'Baixo';
  if (score <= 13) return 'Moderado';
  return 'Alto';
}

async function createAnomalyAlerts(supabase: any, executionId: string) {
  // Buscar execução anterior bem-sucedida
  const { data: prevExecution } = await supabase
    .from('sync_execution_stats')
    .select('*')
    .eq('function_name', 'precalculate-cvm-risks')
    .eq('status', 'success')
    .neq('id', executionId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!prevExecution) return;

  // Buscar execução atual
  const { data: currentExecution } = await supabase
    .from('sync_execution_stats')
    .select('*')
    .eq('id', executionId)
    .single();

  if (!currentExecution) return;

  const alerts = [];

  // Verificar queda no total de ativos
  const prevTotal = prevExecution.total_assets_processed || 0;
  const currentTotal = currentExecution.total_assets_processed || 0;
  
  if (prevTotal > 0) {
    const variation = ((currentTotal - prevTotal) / prevTotal) * 100;
    
    if (variation < -10) {
      alerts.push({
        execution_id: executionId,
        alert_type: 'count_drop',
        severity: 'warning',
        metric_name: 'total_assets_processed',
        expected_value: prevTotal,
        actual_value: currentTotal,
        deviation_percent: variation,
        message: `Queda de ${Math.abs(variation).toFixed(1)}% no total de ativos processados`
      });
    }
  }

  // Verificar variação no score médio
  const prevAvg = parseFloat(prevExecution.avg_risk_score) || 0;
  const currentAvg = parseFloat(currentExecution.avg_risk_score) || 0;
  
  if (prevAvg > 0) {
    const scoreVariation = ((currentAvg - prevAvg) / prevAvg) * 100;
    
    if (Math.abs(scoreVariation) > 15) {
      alerts.push({
        execution_id: executionId,
        alert_type: 'risk_shift',
        severity: 'warning',
        metric_name: 'avg_risk_score',
        expected_value: prevAvg,
        actual_value: currentAvg,
        deviation_percent: scoreVariation,
        message: `Variação de ${scoreVariation.toFixed(1)}% no score médio de risco`
      });
    }
  }

  // Inserir alertas
  if (alerts.length > 0) {
    await supabase
      .from('sync_anomaly_alerts')
      .insert(alerts);
  }
}