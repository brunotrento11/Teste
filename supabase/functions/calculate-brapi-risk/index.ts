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

interface HistoricalPrice {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
}

interface RiskMetrics {
  volatility_1y: number;
  var_95: number;
  sharpe_ratio: number;
  max_drawdown: number;
  beta: number | null;
}

async function fetchHistoricalPrices(ticker: string): Promise<HistoricalPrice[]> {
  const url = `https://brapi.dev/api/quote/${ticker}?token=${BRAPI_API_KEY}&range=1y&interval=1d`;
  
  console.log(`Fetching historical prices for ${ticker}...`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Brapi API error: ${response.status}`);
  }
  
  const data = await response.json();
  const result = data.results?.[0];
  
  if (!result?.historicalDataPrice) {
    throw new Error(`No historical data for ${ticker}`);
  }
  
  return result.historicalDataPrice;
}

async function fetchIbovHistorical(): Promise<HistoricalPrice[]> {
  return fetchHistoricalPrices('^BVSP');
}

function calculateReturns(prices: HistoricalPrice[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prevClose = prices[i - 1].adjustedClose || prices[i - 1].close;
    const currClose = prices[i].adjustedClose || prices[i].close;
    if (prevClose && currClose && prevClose > 0) {
      returns.push((currClose - prevClose) / prevClose);
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

function calculateVolatility(returns: number[]): number {
  const dailyStd = standardDeviation(returns);
  return dailyStd * Math.sqrt(252);
}

function calculateVaR95(returns: number[]): number {
  if (returns.length === 0) return 0;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor(returns.length * 0.05);
  return -sortedReturns[index] * 100;
}

function calculateSharpeRatio(returns: number[], riskFreeRate: number): number {
  const avgReturn = mean(returns) * 252;
  const volatility = calculateVolatility(returns);
  if (volatility === 0) return 0;
  return (avgReturn - riskFreeRate) / volatility;
}

function calculateMaxDrawdown(prices: HistoricalPrice[]): number {
  let maxDrawdown = 0;
  let peak = -Infinity;
  
  for (const price of prices) {
    const value = price.adjustedClose || price.close;
    if (value > peak) peak = value;
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  return maxDrawdown * 100;
}

function calculateBeta(assetReturns: number[], marketReturns: number[]): number | null {
  if (assetReturns.length !== marketReturns.length || assetReturns.length === 0) {
    return null;
  }
  
  const avgAsset = mean(assetReturns);
  const avgMarket = mean(marketReturns);
  
  let covariance = 0;
  let marketVariance = 0;
  
  for (let i = 0; i < assetReturns.length; i++) {
    const assetDiff = assetReturns[i] - avgAsset;
    const marketDiff = marketReturns[i] - avgMarket;
    covariance += assetDiff * marketDiff;
    marketVariance += marketDiff * marketDiff;
  }
  
  if (marketVariance === 0) return null;
  return covariance / marketVariance;
}

function calculateRiskScore(metrics: RiskMetrics, assetType: string): { score: number; category: string } {
  let score = 0;
  
  // Volatilidade (30%)
  score += Math.min(metrics.volatility_1y * 10, 6);
  
  // Beta (25%)
  const beta = metrics.beta || 1;
  score += Math.min(Math.abs(beta) * 2.5, 5);
  
  // VaR 95% (20%)
  score += Math.min(metrics.var_95 / 2, 4);
  
  // Max Drawdown (15%)
  score += Math.min(metrics.max_drawdown / 10, 3);
  
  // Ajuste por tipo de ativo
  const typeMultiplier: Record<string, number> = {
    'fii': 0.8,
    'etf': 0.9,
    'stock': 1.0,
    'bdr': 1.2,
  };
  score *= (typeMultiplier[assetType] || 1.0);
  
  score = Math.max(1, Math.min(20, Math.round(score)));
  
  let category: string;
  if (score <= 6) category = 'Baixo';
  else if (score <= 12) category = 'Moderado';
  else category = 'Alto';
  
  return { score, category };
}

async function getCurrentSelic(supabase: any): Promise<number> {
  const { data } = await supabase
    .from('economic_indicators')
    .select('value')
    .eq('indicator_type', 'selic')
    .order('reference_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return data?.value || 0.1175;
}

async function processTickerBatch(
  supabase: any,
  tickers: string[],
  ibovReturns: number[],
  selic: number
): Promise<{ processed: number; errors: string[] }> {
  let processed = 0;
  const errors: string[] = [];
  
  for (const t of tickers) {
    try {
      const prices = await fetchHistoricalPrices(t);
      const returns = calculateReturns(prices);
      
      if (returns.length < 30) {
        throw new Error(`Insufficient data: only ${returns.length} days`);
      }
      
      const volatility = calculateVolatility(returns);
      const var95 = calculateVaR95(returns);
      const sharpe = calculateSharpeRatio(returns, selic);
      const maxDrawdown = calculateMaxDrawdown(prices);
      
      let beta: number | null = null;
      if (ibovReturns.length > 0) {
        const minLength = Math.min(returns.length, ibovReturns.length);
        beta = calculateBeta(returns.slice(-minLength), ibovReturns.slice(-minLength));
      }
      
      const { data: assetData } = await supabase
        .from('brapi_market_data')
        .select('asset_type, beta')
        .eq('ticker', t)
        .maybeSingle();
      
      const assetType = assetData?.asset_type || 'stock';
      const finalBeta = assetData?.beta || beta;
      
      const metrics: RiskMetrics = {
        volatility_1y: volatility,
        var_95: var95,
        sharpe_ratio: sharpe,
        max_drawdown: maxDrawdown,
        beta: finalBeta,
      };
      
      const { score, category } = calculateRiskScore(metrics, assetType);
      
      await supabase
        .from('brapi_market_data')
        .update({
          volatility_1y: volatility,
          beta: finalBeta,
          var_95: var95,
          sharpe_ratio: sharpe,
          max_drawdown: maxDrawdown,
          risk_score: score,
          risk_category: category,
          last_risk_calculation: new Date().toISOString(),
        })
        .eq('ticker', t);
      
      // Cache historical prices
      const pricesToInsert = prices.slice(-252).map(p => ({
        ticker: t,
        price_date: new Date(p.date * 1000).toISOString().split('T')[0],
        open_price: p.open,
        high_price: p.high,
        low_price: p.low,
        close_price: p.close,
        adjusted_close: p.adjustedClose,
        volume: p.volume,
      }));
      
      await supabase
        .from('brapi_historical_prices')
        .upsert(pricesToInsert, { onConflict: 'ticker,price_date' });
      
      processed++;
      console.log(`${t}: Vol=${(volatility*100).toFixed(1)}%, VaR=${var95.toFixed(1)}%, Score=${score} (${category})`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${t}: ${errMsg}`);
      console.error(`Error processing ${t}:`, error);
      
      // Marcar como tentado para não reprocessar indefinidamente
      // Se for erro 404 ou dados insuficientes, marcar com score -1
      const is404 = errMsg.includes('404') || errMsg.includes('Insufficient') || errMsg.includes('No historical');
      if (is404) {
        await supabase
          .from('brapi_market_data')
          .update({
            last_risk_calculation: new Date().toISOString(),
            risk_score: -1, // Marcador especial para "sem dados disponíveis"
            risk_category: 'Indisponível',
          })
          .eq('ticker', t);
        console.log(`Marked ${t} as unavailable (no historical data)`);
      }
    }
  }
  
  return { processed, errors };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const ticker = body.ticker;
    const processAll = body.processAll === true;
    const chunkIndex = body.chunkIndex || 0;
    const chunkSize = body.chunkSize || 50; // Menor para cálculo de risco (mais lento)
    const prioritizeLiquid = body.prioritizeLiquid !== false; // Priorizar ativos líquidos
    
    let allTickers: string[] = [];
    
    if (ticker) {
      allTickers = [ticker];
    } else if (processAll) {
      // Buscar TODOS os ativos (sem limite de 1000)
      let allAssets: any[] = [];
      let lastId = '';
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('brapi_market_data')
          .select('id, ticker, average_daily_volume, last_risk_calculation, risk_score')
          .order('id', { ascending: true })
          .limit(1000);
        
        if (lastId) {
          query = query.gt('id', lastId);
        }
        
        const { data: batch, error: fetchError } = await query;
        
        if (fetchError) {
          console.error('[DEBUG] Error fetching assets:', fetchError);
          break;
        }
        
        if (batch && batch.length > 0) {
          allAssets = allAssets.concat(batch);
          lastId = batch[batch.length - 1].id;
          hasMore = batch.length === 1000;
        } else {
          hasMore = false;
        }
      }
      
      console.log(`[DEBUG v3] Fetched ${allAssets.length} total assets from brapi_market_data (paginated)`);
      
      // Filtrar ativos sem cálculo de risco ou desatualizados (>7 dias)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const pendingAssets = allAssets
        .filter((a: any) => {
          // Incluir ativos que:
          // 1. Nunca foram calculados (last_risk_calculation é null)
          // 2. Foram calculados há mais de 7 dias
          // 3. Não têm risk_score válido (null ou 0)
          const needsCalculation = !a.last_risk_calculation || a.last_risk_calculation < oneWeekAgo;
          const noValidScore = a.risk_score === null || a.risk_score === 0;
          return needsCalculation || noValidScore;
        });
      
      console.log(`[DEBUG v3] Found ${pendingAssets.length} pending assets after filtering`);
      
      // Ordenar: ativos com volume primeiro, depois os sem volume
      if (prioritizeLiquid) {
        pendingAssets.sort((a: any, b: any) => {
          const volA = a.average_daily_volume || 0;
          const volB = b.average_daily_volume || 0;
          return volB - volA; // Maior volume primeiro
        });
      }
      
      allTickers = pendingAssets.map((a: any) => a.ticker);
    }
    
    if (allTickers.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No tickers to process or all are up to date' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calcular chunks
    const totalChunks = Math.ceil(allTickers.length / chunkSize);
    const startIdx = chunkIndex * chunkSize;
    const endIdx = Math.min(startIdx + chunkSize, allTickers.length);
    const chunkTickers = allTickers.slice(startIdx, endIdx);
    
    if (chunkTickers.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All chunks processed',
        totalAssets: allTickers.length,
        totalChunks
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing risk chunk ${chunkIndex + 1}/${totalChunks} (${chunkTickers.length} tickers)`);
    
    // Fetch IBOV for beta calculation
    let ibovReturns: number[] = [];
    try {
      const ibovPrices = await fetchIbovHistorical();
      ibovReturns = calculateReturns(ibovPrices);
    } catch (error) {
      console.warn('Could not fetch IBOV data for beta calculation:', error);
    }
    
    const selic = await getCurrentSelic(supabase);
    console.log(`Using Selic rate: ${(selic * 100).toFixed(2)}%`);

    const { processed, errors } = await processTickerBatch(supabase, chunkTickers, ibovReturns, selic);

    const duration = Date.now() - startTime;
    const hasMoreChunks = endIdx < allTickers.length;

    // Log execution stats
    await supabase.from('sync_execution_stats').insert({
      function_name: 'calculate-brapi-risk',
      execution_type: processAll ? 'batch' : 'manual',
      status: errors.length === 0 ? 'completed' : 'completed_with_errors',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      total_assets_processed: processed,
      total_errors: errors.length,
      error_details: errors.length > 0 ? errors.slice(0, 30) : null,
      metadata: {
        chunkIndex,
        totalChunks,
        chunkSize,
        totalPending: allTickers.length,
        prioritizeLiquid
      }
    });

    console.log(`Risk calculation completed: ${processed} processed, ${errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      chunkIndex,
      totalChunks,
      processed,
      errors: errors.length,
      hasMoreChunks,
      nextChunkIndex: hasMoreChunks ? chunkIndex + 1 : null,
      totalPending: allTickers.length,
      duration_ms: duration,
      error_details: errors.length > 0 && errors.length <= 10 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Risk calculation error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);

    await supabase.from('sync_execution_stats').insert({
      function_name: 'calculate-brapi-risk',
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
