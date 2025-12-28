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

// ============================================================
// LISTAS CONHECIDAS (mantidas para fallback quando API não tem dados)
// ============================================================

// Lista expandida de ETFs conhecidos
const KNOWN_ETFS = [
  // ETFs de índices de ações
  'BOVA11', 'SMAL11', 'IVVB11', 'BOVV11', 'PIBB11', 'DIVO11', 'FIND11',
  'MATB11', 'ISUS11', 'ECOO11', 'SMAC11', 'ESGB11', 'BRAX11', 'BBOV11',
  // ETFs internacionais
  'SPXI11', 'NASD11', 'EURP11', 'ACWI11', 'WRLD11', 'XINA11', 'ASIA11',
  // ETFs de commodities e cripto
  'GOLD11', 'HASH11', 'BITH11', 'ETHE11', 'QBTC11', 'BITI11', 'DEFI11',
  'NFTS11', 'META11', 'WEB311', 'QDFI11', 'CRPT11',
  // ETFs de renda fixa
  'IMAB11', 'IRFM11', 'FIXA11', 'B5P211', 'IB5M11', 'DEBB11', 'LFTS11', 
  'NTNS11', 'IMBB11', 'TEPP11', 'BGIF11',
  // ETFs temáticos e setoriais
  'TECK11', 'SHOT11', 'GURU11', 'JOGO11', 'FOOD11', 'AGRI11', 'REVE11',
  'DNAI11', '5GTK11', 'MILL11', 'GENB11', 'SXXX11', 'HTEK11',
  // ETFs de dividendos
  'DIVD11', 'NDIV11', 'BBSD11', 'TIRB11', 'NSDV11', 'YDIV11',
];

// Units conhecidas (ações compostas ON + PN, terminam em 11 mas NÃO são FIIs)
const KNOWN_UNITS = [
  'SANB11', 'TAEE11', 'KLBN11', 'BPAC11', 'ENGI11', 'ALUP11',
  'IGTI11', 'SAPR11', 'BRBI11', 'FLMA11', 'SULA11', 'TIET11',
  'AERI11', 'BRAP11', 'GGBR11', 'CSNA11', 'ELET11',
];

// ETFs com foco em dividendos (para classificação multi-objetivo)
const KNOWN_DIVIDEND_ETFS = [
  'DIVD11', 'NDIV11', 'BBSD11', 'TIRB11', 'NSDV11', 'YDIV11', 'DIVO11',
];

// ETFs de renda fixa (para classificação multi-objetivo)
const KNOWN_FIXED_INCOME_ETFS = [
  'FIXA11', 'IRFM11', 'IMAB11', 'B5P211', 'IMBB11', 'IB5M11', 
  'LFTS11', 'NTNS11', 'DEBB11', 'TEPP11', 'BGIF11',
];

// ============================================================
// SUITE DE TESTES (Fase 1 do plano)
// ============================================================

interface TestCase {
  ticker: string;
  expected: string;
  description: string;
}

const TEST_CASES: TestCase[] = [
  // Ações
  { ticker: 'PETR4', expected: 'stock', description: 'Ação comum' },
  { ticker: 'VALE3', expected: 'stock', description: 'Ação comum' },
  { ticker: 'ITUB4', expected: 'stock', description: 'Ação preferencial' },
  { ticker: 'BEEF3', expected: 'stock', description: 'Ação com F no meio (não fracionária)' },
  { ticker: 'WEGE3', expected: 'stock', description: 'Ação WEG' },
  
  // BDRs classe 31-39
  { ticker: 'AAPL34', expected: 'bdr', description: 'BDR padrão 34' },
  { ticker: 'MSFT34', expected: 'bdr', description: 'BDR Microsoft' },
  { ticker: 'M1TA34', expected: 'bdr', description: 'BDR com dígito no meio' },
  { ticker: 'P2LT34', expected: 'bdr', description: 'BDR com dígito no meio' },
  { ticker: 'XPBR31', expected: 'bdr', description: 'BDR classe 31' },
  { ticker: 'GOGL35', expected: 'bdr', description: 'BDR classe 35' },
  { ticker: 'ABGD39', expected: 'bdr', description: 'BDR classe 39' },
  
  // Units (NÃO são FIIs! - terminam em 11)
  { ticker: 'SANB11', expected: 'unit', description: 'Unit Santander' },
  { ticker: 'TAEE11', expected: 'unit', description: 'Unit Taesa' },
  { ticker: 'KLBN11', expected: 'unit', description: 'Unit Klabin' },
  { ticker: 'BPAC11', expected: 'unit', description: 'Unit BTG' },
  { ticker: 'ENGI11', expected: 'unit', description: 'Unit Energisa' },
  { ticker: 'ALUP11', expected: 'unit', description: 'Unit Alupar' },
  
  // FIIs reais
  { ticker: 'HGLG11', expected: 'fii', description: 'FII Logística CSHG' },
  { ticker: 'MXRF11', expected: 'fii', description: 'FII Recebíveis' },
  { ticker: 'XPLG11', expected: 'fii', description: 'FII XP Log' },
  { ticker: 'VISC11', expected: 'fii', description: 'FII Vinci Shopping' },
  { ticker: 'BCFF11', expected: 'fii', description: 'FII BTG Fundo de Fundos' },
  
  // ETFs
  { ticker: 'BOVA11', expected: 'etf', description: 'ETF Ibovespa' },
  { ticker: 'HASH11', expected: 'etf', description: 'ETF Crypto' },
  { ticker: 'IVVB11', expected: 'etf', description: 'ETF S&P500' },
  { ticker: 'DIVD11', expected: 'etf', description: 'ETF Dividendos' },
  { ticker: 'IMAB11', expected: 'etf', description: 'ETF Renda Fixa IMAB' },
  
  // Ações fracionárias
  { ticker: 'PETR4F', expected: 'stock_fractional', description: 'Fracionária Petrobras' },
  { ticker: 'VALE3F', expected: 'stock_fractional', description: 'Fracionária Vale' },
  
  // Tickers inválidos (devem ser rejeitados)
  { ticker: '123434', expected: 'invalid', description: 'Ticker numérico puro - inválido' },
  { ticker: '11', expected: 'invalid', description: 'Ticker muito curto - inválido' },
];

// ============================================================
// INTERFACES
// ============================================================

interface DefaultKeyStatistics {
  dividendYield?: number;
  trailingAnnualDividendYield?: number;
  forwardDividendYield?: number;
}

interface BrapiQuote {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
  averageDailyVolume10Day?: number;
  priceEarnings?: number;
  dividendYield?: number;
  priceToBook?: number;
  defaultKeyStatistics?: DefaultKeyStatistics;
}

interface BrapiResponse {
  results: BrapiQuote[];
  error?: boolean;
  message?: string;
}

// ============================================================
// DETECÇÃO DE TIPO DE ATIVO (Fase 2 do plano)
// ============================================================

/**
 * Detecta o tipo de ativo com base em:
 * 1. Conteúdo do nome (mais confiável)
 * 2. Listas conhecidas (fallback)
 * 3. Padrão do ticker (último recurso)
 */
function detectAssetType(ticker: string, quote?: BrapiQuote): string {
  // 0. Validar ticker básico - deve começar com letra
  if (!ticker || !/^[A-Z]/.test(ticker)) {
    return 'invalid';
  }
  
  // 1. ETFs conhecidos (prioridade máxima para lista conhecida)
  if (KNOWN_ETFS.includes(ticker)) {
    return 'etf';
  }
  
  // 2. Units conhecidas (prioridade sobre detecção por nome para evitar confusão com FII)
  if (KNOWN_UNITS.includes(ticker)) {
    return 'unit';
  }
  
  // 3. Detecção por conteúdo do nome (mais confiável que regex)
  if (quote?.shortName || quote?.longName) {
    const name = `${quote.shortName || ''} ${quote.longName || ''}`.toUpperCase();
    
    // ETFs: contém "ETF" ou "FUNDO DE INDICE"
    if (name.includes('ETF') || name.includes('FUNDO DE INDICE') || 
        name.includes('FUNDO DE ÍNDICE') || name.includes('FDO INDICE')) {
      return 'etf';
    }
    
    // Units: contém "UNT" ou "UNIT" no nome
    if (name.includes(' UNT') || name.includes(' UNIT') || 
        name.includes('UNT ') || name.includes('UNIT ') ||
        /\bUNT\b/.test(name) || /\bUNIT\b/.test(name)) {
      return 'unit';
    }
    
    // FIIs: contém padrões específicos de FII
    if (name.includes('FII ') || name.includes(' FII') || 
        name.includes('FIAGRO') || 
        name.includes('FUNDO DE INVESTIMENTO IMOBILIARIO') ||
        name.includes('FUNDO DE INVESTIMENTO IMOBILIÁRIO') ||
        name.includes('FDO INV IMOB') || name.includes('F.I.I')) {
      return 'fii';
    }
  }
  
  // 4. Fallback: detecção por padrão de ticker
  
  // Ações fracionárias: terminam em F (PETR4F, VALE3F)
  if (/F$/.test(ticker) && ticker.length >= 5) {
    return 'stock_fractional';
  }
  
  // BDRs: começam com letra, podem ter dígitos no meio, terminam em 31-39
  // Padrões válidos: AAPL34, GOGL34, M1TA34, P2LT34, XPBR31, ABGD39
  // Comprimento entre 5 e 7 caracteres
  if (/^[A-Z][A-Z0-9]{2,4}3[1-9]$/.test(ticker) && 
      ticker.length >= 5 && ticker.length <= 7) {
    return 'bdr';
  }
  
  // Ações: padrão XXXX3-8 (4 letras + dígito 3-8)
  if (/^[A-Z]{4}[3-8]$/.test(ticker)) {
    return 'stock';
  }
  
  // FIIs: terminam em 11 e têm 6 caracteres (fallback final)
  if (ticker.endsWith('11') && ticker.length === 6) {
    return 'fii';
  }
  
  // Default para ações (caso não identificado)
  return 'stock';
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

async function fetchAvailableAssets(): Promise<string[]> {
  const url = `https://brapi.dev/api/available?token=${BRAPI_API_KEY}`;
  
  console.log('Fetching all available assets from Brapi...');
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Brapi API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.stocks || !Array.isArray(data.stocks)) {
    throw new Error('Invalid response from Brapi available endpoint');
  }
  
  // Filtrar índices (começam com ^) e ações fracionárias (terminam em F)
  const assets = data.stocks.filter((ticker: string) => 
    !ticker.startsWith('^') && !/F$/.test(ticker)
  );
  
  const fractionalCount = data.stocks.filter((t: string) => /F$/.test(t)).length;
  console.log(`Found ${assets.length} available assets (excluded ${fractionalCount} fractional tickers)`);
  return assets;
}

async function fetchQuotes(tickers: string[]): Promise<BrapiQuote[]> {
  const tickerString = tickers.join(',');
  const url = `https://brapi.dev/api/quote/${tickerString}?token=${BRAPI_API_KEY}&modules=defaultKeyStatistics`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Brapi API error: ${response.status} ${response.statusText}`);
  }
  
  const data: BrapiResponse = await response.json();
  
  if (data.error) {
    throw new Error(`Brapi error: ${data.message}`);
  }
  
  return data.results || [];
}

function extractDividendYield(quote: BrapiQuote): number | null {
  if (quote.defaultKeyStatistics?.dividendYield != null) {
    const value = quote.defaultKeyStatistics.dividendYield;
    return value > 1 ? value : value * 100;
  }
  if (quote.dividendYield != null) {
    return quote.dividendYield;
  }
  return null;
}

// ============================================================
// PROCESSAMENTO DE CHUNKS
// ============================================================

async function processChunk(
  supabase: any,
  tickers: string[],
  chunkIndex: number,
  totalChunks: number
): Promise<{ processed: number; errors: string[] }> {
  let processedCount = 0;
  const errors: string[] = [];
  
  const batchSize = 20;
  
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    
    try {
      const quotes = await fetchQuotes(batch);
      
      for (const quote of quotes) {
        try {
          // Usar detecção por nome quando disponível
          const assetType = detectAssetType(quote.symbol, quote);
          
          // Pular tipos inválidos
          if (assetType === 'invalid') {
            console.log(`Skipping invalid ticker: ${quote.symbol}`);
            continue;
          }
          
          const dividendYield = extractDividendYield(quote);
          
          const marketData = {
            ticker: quote.symbol,
            asset_type: assetType,
            short_name: quote.shortName || null,
            long_name: quote.longName || null,
            regular_market_price: quote.regularMarketPrice || null,
            regular_market_change_percent: quote.regularMarketChangePercent || null,
            market_cap: quote.marketCap || null,
            average_daily_volume: quote.averageDailyVolume10Day || null,
            price_earnings: quote.priceEarnings || null,
            dividend_yield: dividendYield,
            price_to_book: quote.priceToBook || null,
            last_quote_update: new Date().toISOString(),
          };

          const { error } = await supabase
            .from('brapi_market_data')
            .upsert(marketData, { onConflict: 'ticker' });

          if (error) throw error;
          processedCount++;
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          errors.push(`${quote.symbol}: ${errMsg}`);
        }
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Batch ${i}-${i + batchSize}: ${errMsg}`);
    }
    
    if (i + batchSize < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  console.log(`Chunk ${chunkIndex + 1}/${totalChunks}: ${processedCount} processed, ${errors.length} errors`);
  return { processed: processedCount, errors };
}

// ============================================================
// ENDPOINT DE TESTE (Fase 7 do plano)
// ============================================================

function runTestSuite(): { summary: string; passed: number; failed: TestCase[]; results: any[] } {
  const results = TEST_CASES.map(tc => {
    const actual = detectAssetType(tc.ticker);
    return {
      ticker: tc.ticker,
      expected: tc.expected,
      actual,
      passed: tc.expected === actual,
      description: tc.description,
    };
  });
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).map(r => ({
    ticker: r.ticker,
    expected: r.expected,
    description: r.description,
  }));
  
  return {
    summary: `${passed}/${TEST_CASES.length} tests passed`,
    passed,
    failed: failed as TestCase[],
    results,
  };
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'full'; // 'full' | 'incremental' | 'chunk' | 'test' | 'rollback'
    
    // ========================
    // MODO TEST: Executar suite de testes
    // ========================
    if (mode === 'test') {
      console.log('Running test suite...');
      const testResults = runTestSuite();
      
      return new Response(JSON.stringify({
        success: true,
        mode: 'test',
        ...testResults,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // ========================
    // MODO ROLLBACK: Instruções para reverter
    // ========================
    if (mode === 'rollback') {
      console.log('Rollback mode requested');
      
      // Verificar se backup existe
      const { count, error } = await supabase
        .from('brapi_market_data_backup_20250119')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        return new Response(JSON.stringify({
          success: false,
          mode: 'rollback',
          error: 'Backup table not found. Cannot rollback.',
          instructions: [
            'Backup table brapi_market_data_backup_20250119 does not exist.',
            'Manual intervention required.',
          ],
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        mode: 'rollback',
        backupRecords: count,
        message: 'Rollback instructions provided. Execute the SQL manually.',
        instructions: [
          '-- STEP 1: Truncate current table',
          'TRUNCATE TABLE brapi_market_data;',
          '',
          '-- STEP 2: Restore from backup',
          'INSERT INTO brapi_market_data SELECT * FROM brapi_market_data_backup_20250119;',
          '',
          '-- STEP 3: Verify restoration',
          'SELECT COUNT(*) FROM brapi_market_data;',
        ],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // ========================
    // MODOS NORMAIS: full, incremental, chunk
    // ========================
    const chunkIndex = body.chunkIndex || 0;
    const chunkSize = body.chunkSize || 150;
    const customTickers = body.tickers;
    
    let allTickers: string[];
    
    if (customTickers && Array.isArray(customTickers)) {
      allTickers = customTickers;
    } else if (mode === 'incremental') {
      const { data: existing } = await supabase
        .from('brapi_market_data')
        .select('ticker');
      allTickers = existing?.map((a: any) => a.ticker) || [];
    } else {
      allTickers = await fetchAvailableAssets();
    }
    
    console.log(`Mode: ${mode}, Total available: ${allTickers.length}`);
    
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
    
    console.log(`Processing chunk ${chunkIndex + 1}/${totalChunks} (${chunkTickers.length} assets)`);
    
    const { processed, errors } = await processChunk(supabase, chunkTickers, chunkIndex, totalChunks);
    
    const duration = Date.now() - startTime;
    const hasMoreChunks = endIdx < allTickers.length;

    await supabase.from('sync_execution_stats').insert({
      function_name: 'sync-brapi-quotes',
      execution_type: mode,
      status: errors.length === 0 ? 'completed' : 'completed_with_errors',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      total_assets_processed: processed,
      total_errors: errors.length,
      error_details: errors.length > 0 ? errors.slice(0, 50) : null,
      metadata: { 
        mode,
        chunkIndex,
        totalChunks,
        chunkSize,
        totalAvailable: allTickers.length
      }
    });

    console.log(`Chunk completed: ${processed} processed, ${errors.length} errors, ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      mode,
      chunkIndex,
      totalChunks,
      processed,
      errors: errors.length,
      hasMoreChunks,
      nextChunkIndex: hasMoreChunks ? chunkIndex + 1 : null,
      totalAvailable: allTickers.length,
      duration_ms: duration,
      error_details: errors.length > 0 && errors.length <= 10 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Sync error:', error);
    const errMsg = error instanceof Error ? error.message : String(error);

    await supabase.from('sync_execution_stats').insert({
      function_name: 'sync-brapi-quotes',
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
