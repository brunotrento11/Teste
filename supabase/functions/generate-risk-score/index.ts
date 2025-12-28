import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RiskScoreResponse {
  score: number;
  justification: string;
  risk_category: string;
  compatible_with_conservador: boolean;
  compatible_with_moderado: boolean;
  compatible_with_arrojado: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { risk_indicators_id, investment_id } = await req.json();

    console.log('[generate-risk-score] Generating score for indicators:', risk_indicators_id);

    // Buscar indicadores de risco
    const { data: indicators, error: indicatorsError } = await supabaseClient
      .from('investment_risk_indicators')
      .select('*')
      .eq('id', risk_indicators_id)
      .single();

    if (indicatorsError || !indicators) {
      console.error('[generate-risk-score] Indicators not found:', indicatorsError);
      return new Response(JSON.stringify({ error: 'Indicators not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar ranges de perfis
    const { data: profiles } = await supabaseClient
      .from('investor_profile_ranges')
      .select('*');

    const profilesInfo = profiles?.map(p => 
      `${p.profile_name}: scores ${p.min_score}-${p.max_score}`
    ).join(', ') || '';

    // Prompt estruturado para IA
    const systemPrompt = `Você é um especialista em análise de risco de investimentos. Sua tarefa é avaliar o nível de risco de um investimento com base em 4 indicadores financeiros clássicos e atribuir uma nota de 1 a 20.

METODOLOGIA DE ANÁLISE:

1. Índice de Sharpe (Peso 30%):
   - Sharpe > 2.0: Excelente retorno ajustado ao risco (score baixo, 1-5)
   - Sharpe 1.0-2.0: Bom retorno ajustado ao risco (score médio, 6-12)
   - Sharpe 0.5-1.0: Retorno moderado para o risco (score médio-alto, 13-16)
   - Sharpe < 0.5: Retorno insuficiente para o risco (score alto, 17-20)

2. Beta (Peso 35%):
   - Beta < 0.5: Muito menos volátil que o mercado (score baixo, 1-5)
   - Beta 0.5-1.0: Menos volátil que o mercado (score médio-baixo, 6-10)
   - Beta 1.0-1.5: Mais volátil que o mercado (score médio-alto, 11-15)
   - Beta > 1.5: Muito mais volátil que o mercado (score alto, 16-20)

3. Value at Risk - VaR 95% (Peso 25%):
   - VaR < 3%: Perda potencial baixa (score baixo, 1-5)
   - VaR 3-7%: Perda potencial moderada (score médio, 6-12)
   - VaR 7-12%: Perda potencial alta (score médio-alto, 13-17)
   - VaR > 12%: Perda potencial muito alta (score alto, 18-20)

4. Desvio Padrão (Peso 10%):
   - Desvio < 3%: Volatilidade muito baixa (score baixo, 1-5)
   - Desvio 3-6%: Volatilidade moderada (score médio, 6-12)
   - Desvio 6-10%: Volatilidade alta (score médio-alto, 13-17)
   - Desvio > 10%: Volatilidade muito alta (score alto, 18-20)

PERFIS DE INVESTIDOR (referência):
${profilesInfo}

FORMATO DE RESPOSTA (JSON):
{
  "score": número de 1 a 20,
  "justification": "Explicação técnica de 2-3 linhas sobre o score",
  "risk_category": "Baixo" | "Moderado" | "Alto",
  "compatible_with_conservador": true/false,
  "compatible_with_moderado": true/false,
  "compatible_with_arrojado": true/false
}`;

    const userPrompt = `Analise os seguintes indicadores de risco e retorne SOMENTE um JSON válido (sem markdown, sem explicações adicionais):

Sharpe Ratio: ${indicators.sharpe_ratio}
Beta: ${indicators.beta}
VaR 95%: ${indicators.var_95}%
Desvio Padrão: ${indicators.std_deviation}%

Lembre-se: 
- Score 1-8: Perfil Conservador
- Score 7-14: Perfil Moderado  
- Score 12-20: Perfil Arrojado

Retorne apenas o JSON.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('[generate-risk-score] Calling Lovable AI...');

    // Chamar Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[generate-risk-score] AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fallback: cálculo determinístico simples
      console.log('[generate-risk-score] Using fallback calculation');
      const fallbackScore = calculateFallbackScore(indicators);
      const fallbackResult = createFallbackResponse(fallbackScore);
      
      const { error: saveError } = await supabaseClient
        .from('risk_score_history')
        .insert({
          investment_id,
          risk_indicators_id,
          ...fallbackResult,
        });

      if (saveError) {
        console.error('[generate-risk-score] Error saving fallback score:', saveError);
      }

      return new Response(JSON.stringify({ success: true, ...fallbackResult, fallback: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    console.log('[generate-risk-score] AI response received');

    // Parse JSON da resposta
    let riskScore: RiskScoreResponse;
    try {
      // Remover markdown se houver
      const jsonStr = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      riskScore = JSON.parse(jsonStr);
      
      // Validar score
      if (riskScore.score < 1 || riskScore.score > 20) {
        throw new Error('Invalid score range');
      }
    } catch (parseError) {
      console.error('[generate-risk-score] Error parsing AI response:', parseError);
      const fallbackScore = calculateFallbackScore(indicators);
      riskScore = createFallbackResponse(fallbackScore);
    }

    // Salvar score no histórico
    const { data: savedScore, error: saveError } = await supabaseClient
      .from('risk_score_history')
      .insert({
        investment_id,
        risk_indicators_id,
        score: riskScore.score,
        justification: riskScore.justification,
        risk_category: riskScore.risk_category,
        compatible_with_conservador: riskScore.compatible_with_conservador,
        compatible_with_moderado: riskScore.compatible_with_moderado,
        compatible_with_arrojado: riskScore.compatible_with_arrojado,
      })
      .select()
      .single();

    if (saveError) {
      console.error('[generate-risk-score] Error saving score:', saveError);
      return new Response(JSON.stringify({ error: 'Failed to save score' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[generate-risk-score] Successfully generated and saved score:', riskScore.score);

    return new Response(
      JSON.stringify({ success: true, score: savedScore }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-risk-score] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function calculateFallbackScore(indicators: any): number {
  // Cálculo determinístico baseado nos pesos
  const sharpeScore = indicators.sharpe_ratio > 2 ? 3 : 
                     indicators.sharpe_ratio > 1 ? 9 :
                     indicators.sharpe_ratio > 0.5 ? 14 : 18;
  
  const betaScore = indicators.beta < 0.5 ? 3 :
                    indicators.beta < 1 ? 8 :
                    indicators.beta < 1.5 ? 13 : 18;
  
  const varScore = indicators.var_95 < 3 ? 3 :
                   indicators.var_95 < 7 ? 9 :
                   indicators.var_95 < 12 ? 15 : 19;
  
  const stdScore = indicators.std_deviation < 3 ? 3 :
                   indicators.std_deviation < 6 ? 9 :
                   indicators.std_deviation < 10 ? 15 : 19;
  
  const weightedScore = (sharpeScore * 0.3) + (betaScore * 0.35) + (varScore * 0.25) + (stdScore * 0.1);
  
  return Math.round(Math.max(1, Math.min(20, weightedScore)));
}

function createFallbackResponse(score: number): RiskScoreResponse {
  return {
    score,
    justification: `Score calculado com base em análise determinística dos indicadores de risco (Sharpe, Beta, VaR e Desvio Padrão).`,
    risk_category: score <= 8 ? 'Baixo' : score <= 14 ? 'Moderado' : 'Alto',
    compatible_with_conservador: score <= 9,
    compatible_with_moderado: score >= 6 && score <= 15,
    compatible_with_arrojado: score >= 11,
  };
}