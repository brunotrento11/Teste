import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRAPI_API_KEY = Deno.env.get('BRAPI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface BrapiQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
}

interface SyncResult {
  synced: number;
  updated: Array<{ ticker: string; name: string }>;
  errors: Array<{ ticker: string; error: string }>;
  skipped: string[];
}

// Retry com exponential backoff
async function fetchWithRetry(url: string, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        // Rate limit - exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[BRAPI SYNC] Rate limited, waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  // Verificar API key
  if (!BRAPI_API_KEY) {
    console.error('[BRAPI SYNC] BRAPI_API_KEY não configurada');
    return new Response(JSON.stringify({
      success: false,
      error: 'BRAPI_API_KEY não configurada. Configure em Settings → Secrets.',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const result: SyncResult = {
    synced: 0,
    updated: [],
    errors: [],
    skipped: [],
  };

  try {
    // 1. Buscar BDRs sem nome
    console.log('[BRAPI SYNC] Buscando BDRs sem nome...');
    const { data: bdrsWithoutName, error: queryError } = await supabase
      .from('brapi_market_data')
      .select('ticker')
      .eq('asset_type', 'bdr')
      .is('short_name', null);

    if (queryError) {
      throw new Error(`Erro ao buscar BDRs: ${queryError.message}`);
    }

    if (!bdrsWithoutName || bdrsWithoutName.length === 0) {
      console.log('[BRAPI SYNC] Nenhum BDR sem nome encontrado');
      return new Response(JSON.stringify({
        success: true,
        message: 'Todos os BDRs já possuem nome',
        ...result,
        duration_ms: Date.now() - startTime,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[BRAPI SYNC] Encontrados ${bdrsWithoutName.length} BDRs sem nome`);

    // 2. Processar cada ticker
    for (const { ticker } of bdrsWithoutName) {
      try {
        console.log(`[BRAPI SYNC] Buscando dados para ${ticker}...`);
        
        const url = `https://brapi.dev/api/quote/${ticker}?token=${BRAPI_API_KEY}`;
        const response = await fetchWithRetry(url);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error || !data.results || data.results.length === 0) {
          console.warn(`[BRAPI SYNC] Ticker ${ticker} não encontrado na BRAPI`);
          result.skipped.push(ticker);
          continue;
        }
        
        const quote: BrapiQuote = data.results[0];
        const name = quote.longName || quote.shortName;
        
        if (!name) {
          console.warn(`[BRAPI SYNC] ${ticker} sem nome na resposta da BRAPI`);
          result.skipped.push(ticker);
          continue;
        }
        
        // 3. Atualizar no banco
        const { error: updateError } = await supabase
          .from('brapi_market_data')
          .update({
            short_name: quote.shortName || name,
            long_name: quote.longName || null,
            updated_at: new Date().toISOString(),
          })
          .eq('ticker', ticker);
        
        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`);
        }
        
        console.log(`[BRAPI SYNC] ✅ Updated ${ticker} → ${name}`);
        result.synced++;
        result.updated.push({ ticker, name });
        
        // Pequeno delay para não sobrecarregar a API
        await new Promise(r => setTimeout(r, 200));
        
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[BRAPI SYNC] ❌ Erro em ${ticker}: ${errMsg}`);
        result.errors.push({ ticker, error: errMsg });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[BRAPI SYNC] Concluído: ${result.synced} sincronizados, ${result.errors.length} erros, ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      ...result,
      duration_ms: duration,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[BRAPI SYNC] Erro crítico: ${errMsg}`);
    
    return new Response(JSON.stringify({
      success: false,
      error: errMsg,
      ...result,
      duration_ms: Date.now() - startTime,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
