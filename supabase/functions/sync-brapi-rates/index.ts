import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRAPI_API_KEY = Deno.env.get('BRAPI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface PrimeRateData {
  date: string;
  value: number;
}

interface InflationData {
  date: string;
  value: number;
  epochDate: number;
}

async function fetchSelic(): Promise<PrimeRateData[]> {
  // Try without historical first
  const url = `https://brapi.dev/api/v2/prime-rate?token=${BRAPI_API_KEY}&country=brazil&sortBy=date&sortOrder=desc`;
  
  console.log('Fetching Selic data from:', url.replace(BRAPI_API_KEY!, '[TOKEN]'));
  
  const response = await fetch(url);
  const responseText = await response.text();
  
  console.log('Selic response status:', response.status);
  console.log('Selic response body:', responseText.substring(0, 500));
  
  if (!response.ok) {
    throw new Error(`Brapi API error: ${response.status} - ${responseText.substring(0, 200)}`);
  }
  
  const data = JSON.parse(responseText);
  return data['prime-rate'] || [];
}

async function fetchIPCA(): Promise<InflationData[]> {
  const url = `https://brapi.dev/api/v2/inflation?token=${BRAPI_API_KEY}&country=brazil&historical=true&sortBy=date&sortOrder=desc`;
  
  console.log('Fetching IPCA data...');
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Brapi API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.inflation || [];
}

function calculateAccumulated12m(data: { date: string; value: number }[]): number {
  // Get last 12 months
  const sortedData = [...data].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  const last12 = sortedData.slice(0, 12);
  
  // Compound calculation: (1 + r1) * (1 + r2) * ... - 1
  let accumulated = 1;
  for (const item of last12) {
    accumulated *= (1 + item.value / 100);
  }
  
  return (accumulated - 1) * 100;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startTime = Date.now();

  try {
    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Fetch and save Selic
    try {
      const selicData = await fetchSelic();
      console.log(`Fetched ${selicData.length} Selic records`);
      
      if (selicData.length > 0) {
        // Current Selic (annualized rate)
        const currentSelic = selicData[0];
        
        // Save current and historical
        const selicRecords = selicData.slice(0, 24).map(item => ({
          indicator_type: 'selic',
          reference_date: item.date,
          value: item.value / 100, // Convert to decimal (11.75% -> 0.1175)
          accumulated_12m: item.value / 100,
        }));
        
        const { error } = await supabase
          .from('economic_indicators')
          .upsert(selicRecords, { onConflict: 'indicator_type,reference_date' });
        
        if (error) throw error;
        
        // Calculate and save CDI (approximately Selic - 0.10 p.p.)
        const cdiRecords = selicData.slice(0, 24).map(item => ({
          indicator_type: 'cdi',
          reference_date: item.date,
          value: (item.value - 0.10) / 100,
          accumulated_12m: (item.value - 0.10) / 100,
        }));
        
        await supabase
          .from('economic_indicators')
          .upsert(cdiRecords, { onConflict: 'indicator_type,reference_date' });
        
        processedCount += selicRecords.length + cdiRecords.length;
        console.log(`Saved ${selicRecords.length} Selic records and ${cdiRecords.length} CDI records`);
      }
    } catch (error: unknown) {
      errorCount++;
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Selic: ${errMsg}`);
      console.error('Error fetching Selic:', error);
    }

    // Fetch and save IPCA
    try {
      const ipcaData = await fetchIPCA();
      console.log(`Fetched ${ipcaData.length} IPCA records`);
      
      if (ipcaData.length > 0) {
        // Calculate 12-month accumulated
        const accumulated12m = calculateAccumulated12m(
          ipcaData.map(d => ({ date: d.date, value: d.value }))
        );
        
        // Save current and historical
        const ipcaRecords = ipcaData.slice(0, 24).map((item, index) => ({
          indicator_type: 'ipca',
          reference_date: item.date,
          value: item.value / 100, // Monthly rate as decimal
          accumulated_12m: index === 0 ? accumulated12m / 100 : null,
        }));
        
        const { error } = await supabase
          .from('economic_indicators')
          .upsert(ipcaRecords, { onConflict: 'indicator_type,reference_date' });
        
        if (error) throw error;
        
        processedCount += ipcaRecords.length;
        console.log(`Saved ${ipcaRecords.length} IPCA records. Accumulated 12m: ${accumulated12m.toFixed(2)}%`);
      }
    } catch (error: unknown) {
      errorCount++;
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`IPCA: ${errMsg}`);
      console.error('Error fetching IPCA:', error);
    }

    const duration = Date.now() - startTime;

    // Log execution stats
    await supabase.from('sync_execution_stats').insert({
      function_name: 'sync-brapi-rates',
      execution_type: 'manual',
      status: errorCount === 0 ? 'completed' : 'completed_with_errors',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      total_assets_processed: processedCount,
      total_errors: errorCount,
      error_details: errors.length > 0 ? errors : null,
    });

    // Get latest values for response
    const { data: latestSelic } = await supabase
      .from('economic_indicators')
      .select('value, reference_date')
      .eq('indicator_type', 'selic')
      .order('reference_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: latestIPCA } = await supabase
      .from('economic_indicators')
      .select('value, accumulated_12m, reference_date')
      .eq('indicator_type', 'ipca')
      .order('reference_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: latestCDI } = await supabase
      .from('economic_indicators')
      .select('value, reference_date')
      .eq('indicator_type', 'cdi')
      .order('reference_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log(`Sync completed: ${processedCount} records, ${errorCount} errors, ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      errors: errorCount,
      duration_ms: duration,
      current_rates: {
        selic: latestSelic ? {
          value: `${(latestSelic.value * 100).toFixed(2)}%`,
          date: latestSelic.reference_date
        } : null,
        cdi: latestCDI ? {
          value: `${(latestCDI.value * 100).toFixed(2)}%`,
          date: latestCDI.reference_date
        } : null,
        ipca: latestIPCA ? {
          value_monthly: `${(latestIPCA.value * 100).toFixed(2)}%`,
          accumulated_12m: latestIPCA.accumulated_12m ? `${(latestIPCA.accumulated_12m * 100).toFixed(2)}%` : null,
          date: latestIPCA.reference_date
        } : null,
      },
      error_details: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Sync error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);

    await supabase.from('sync_execution_stats').insert({
      function_name: 'sync-brapi-rates',
      execution_type: 'manual',
      status: 'failed',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      error_details: [errMsg],
    });

    return new Response(JSON.stringify({ 
      success: false, 
      error: errMsg 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
