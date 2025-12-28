import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RiskStatus = 'green' | 'yellow' | 'red';

interface EvaluationResult {
  status: RiskStatus;
  score: number;
  user_profile: string;
  profile_range: { min: number; max: number };
  message: string;
  compatibility: string;
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

    const { investment_id } = await req.json();

    console.log('[evaluate-investment-risk] Evaluating investment:', investment_id);

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('investor_profile')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.investor_profile) {
      console.error('[evaluate-investment-risk] Profile not found or incomplete:', profileError);
      return new Response(JSON.stringify({ error: 'User profile not found or incomplete' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userProfile = profile.investor_profile.toLowerCase();

    // Buscar range do perfil do usuário
    const { data: profileRange, error: rangeError } = await supabaseClient
      .from('investor_profile_ranges')
      .select('*')
      .eq('profile_name', userProfile)
      .single();

    if (rangeError || !profileRange) {
      console.error('[evaluate-investment-risk] Profile range not found:', rangeError);
      return new Response(JSON.stringify({ error: 'Profile range not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar último score do investimento
    const { data: latestScore, error: scoreError } = await supabaseClient
      .from('risk_score_history')
      .select('*')
      .eq('investment_id', investment_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (scoreError || !latestScore) {
      console.log('[evaluate-investment-risk] No risk score found for investment, will need to calculate');
      return new Response(
        JSON.stringify({ 
          success: false,
          requires_calculation: true,
          investment_id 
        }), 
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Avaliar compatibilidade
    const score = latestScore.score;
    const minScore = profileRange.min_score;
    const maxScore = profileRange.max_score;

    let status: RiskStatus;
    let message: string;
    let compatibility: string;

    if (score >= minScore && score <= maxScore) {
      // Verde: dentro do range
      status = 'green';
      compatibility = 'Compatível';
      message = `Este investimento está alinhado com seu perfil ${userProfile}.`;
    } else if (
      (score === minScore - 1 || score === maxScore + 1) // 1 ponto fora
    ) {
      // Amarelo: 1 ponto fora do range
      status = 'yellow';
      compatibility = 'Atenção';
      message = score < minScore
        ? `Este investimento é levemente mais conservador que seu perfil ${userProfile}.`
        : `Este investimento é levemente mais arrojado que seu perfil ${userProfile}.`;
    } else {
      // Vermelho: 2 ou mais pontos fora do range
      status = 'red';
      compatibility = 'Incompatível';
      message = score < minScore
        ? `Este investimento é muito mais conservador que seu perfil ${userProfile}.`
        : `Este investimento é muito mais arrojado que seu perfil ${userProfile}. Considere reavaliar.`;
    }

    const evaluation: EvaluationResult = {
      status,
      score,
      user_profile: userProfile,
      profile_range: { min: minScore, max: maxScore },
      message,
      compatibility,
    };

    console.log('[evaluate-investment-risk] Evaluation result:', status, 'Score:', score);

    return new Response(
      JSON.stringify({ success: true, evaluation }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[evaluate-investment-risk] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});