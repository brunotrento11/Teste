import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRAPI_API_KEY = Deno.env.get('BRAPI_API_KEY');
const BRAPI_BASE_URL = 'https://brapi.dev/api';

// Tickers representativos para teste
const TEST_TICKERS = {
  stocks: ['PETR4', 'VALE3', 'ITUB4'],
  fiis: ['HGLG11', 'MXRF11', 'KNRI11'],
  etfs: ['BOVA11', 'IVVB11', 'SMAL11'],
  bdrs: ['AAPL34', 'MSFT34', 'GOGL34']
};

interface TickerResult {
  ticker: string;
  type: string;
  withoutModules: {
    dividendYield: number | null;
    regularMarketPrice: number | null;
    hasData: boolean;
  };
  withModules: {
    dividendYield: number | null;
    dividendYieldLocation: string | null;
    regularMarketPrice: number | null;
    hasData: boolean;
    defaultKeyStatistics: Record<string, unknown> | null;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!BRAPI_API_KEY) {
      throw new Error('BRAPI_API_KEY not configured');
    }

    const allTickers = [
      ...TEST_TICKERS.stocks,
      ...TEST_TICKERS.fiis,
      ...TEST_TICKERS.etfs,
      ...TEST_TICKERS.bdrs
    ];

    const tickerString = allTickers.join(',');
    console.log(`Testing ${allTickers.length} tickers: ${tickerString}`);

    // Chamada 1: SEM modules (comportamento atual)
    const urlWithoutModules = `${BRAPI_BASE_URL}/quote/${tickerString}?token=${BRAPI_API_KEY}`;
    console.log('Fetching WITHOUT modules...');
    const responseWithout = await fetch(urlWithoutModules);
    const dataWithout = await responseWithout.json();

    // Pequeno delay para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));

    // Chamada 2: COM modules=defaultKeyStatistics
    const urlWithModules = `${BRAPI_BASE_URL}/quote/${tickerString}?token=${BRAPI_API_KEY}&modules=defaultKeyStatistics`;
    console.log('Fetching WITH modules=defaultKeyStatistics...');
    const responseWithModules = await fetch(urlWithModules);
    const dataWithModules = await responseWithModules.json();

    // Analisar resultados
    const results: TickerResult[] = [];
    const analysis = {
      totalTickers: allTickers.length,
      withoutModules: {
        tickersReturned: 0,
        dividendYieldFound: 0,
        dividendYieldNull: 0,
        dividendYieldMissing: 0
      },
      withModules: {
        tickersReturned: 0,
        dividendYieldFound: 0,
        dividendYieldNull: 0,
        dividendYieldMissing: 0,
        dividendYieldLocation: [] as string[]
      },
      byType: {
        stocks: { withoutModules: 0, withModules: 0 },
        fiis: { withoutModules: 0, withModules: 0 },
        etfs: { withoutModules: 0, withModules: 0 },
        bdrs: { withoutModules: 0, withModules: 0 }
      }
    };

    // Determinar tipo do ticker
    const getTickerType = (ticker: string): string => {
      if (TEST_TICKERS.stocks.includes(ticker)) return 'stocks';
      if (TEST_TICKERS.fiis.includes(ticker)) return 'fiis';
      if (TEST_TICKERS.etfs.includes(ticker)) return 'etfs';
      if (TEST_TICKERS.bdrs.includes(ticker)) return 'bdrs';
      return 'unknown';
    };

    // Processar cada ticker
    for (const ticker of allTickers) {
      const tickerType = getTickerType(ticker);
      
      // Dados SEM modules
      const quoteWithout = dataWithout.results?.find((r: any) => r.symbol === ticker);
      const withoutModulesData = {
        dividendYield: quoteWithout?.dividendYield ?? null,
        regularMarketPrice: quoteWithout?.regularMarketPrice ?? null,
        hasData: !!quoteWithout
      };

      if (quoteWithout) {
        analysis.withoutModules.tickersReturned++;
        if (quoteWithout.dividendYield !== undefined && quoteWithout.dividendYield !== null) {
          analysis.withoutModules.dividendYieldFound++;
          analysis.byType[tickerType as keyof typeof analysis.byType].withoutModules++;
        } else if (quoteWithout.dividendYield === null) {
          analysis.withoutModules.dividendYieldNull++;
        } else {
          analysis.withoutModules.dividendYieldMissing++;
        }
      }

      // Dados COM modules
      const quoteWith = dataWithModules.results?.find((r: any) => r.symbol === ticker);
      let dividendYieldWithModules: number | null = null;
      let dividendYieldLocation: string | null = null;
      let defaultKeyStatistics: Record<string, unknown> | null = null;

      if (quoteWith) {
        analysis.withModules.tickersReturned++;
        
        // Verificar em diferentes localizações possíveis
        if (quoteWith.dividendYield !== undefined && quoteWith.dividendYield !== null) {
          dividendYieldWithModules = quoteWith.dividendYield;
          dividendYieldLocation = 'root';
        } else if (quoteWith.defaultKeyStatistics?.dividendYield !== undefined) {
          dividendYieldWithModules = quoteWith.defaultKeyStatistics.dividendYield;
          dividendYieldLocation = 'defaultKeyStatistics.dividendYield';
        } else if (quoteWith.defaultKeyStatistics?.trailingAnnualDividendYield !== undefined) {
          dividendYieldWithModules = quoteWith.defaultKeyStatistics.trailingAnnualDividendYield;
          dividendYieldLocation = 'defaultKeyStatistics.trailingAnnualDividendYield';
        }

        if (quoteWith.defaultKeyStatistics) {
          defaultKeyStatistics = quoteWith.defaultKeyStatistics;
        }

        if (dividendYieldWithModules !== null) {
          analysis.withModules.dividendYieldFound++;
          analysis.byType[tickerType as keyof typeof analysis.byType].withModules++;
          if (dividendYieldLocation && !analysis.withModules.dividendYieldLocation.includes(dividendYieldLocation)) {
            analysis.withModules.dividendYieldLocation.push(dividendYieldLocation);
          }
        } else if (quoteWith.dividendYield === null) {
          analysis.withModules.dividendYieldNull++;
        } else {
          analysis.withModules.dividendYieldMissing++;
        }
      }

      results.push({
        ticker,
        type: tickerType,
        withoutModules: withoutModulesData,
        withModules: {
          dividendYield: dividendYieldWithModules,
          dividendYieldLocation,
          regularMarketPrice: quoteWith?.regularMarketPrice ?? null,
          hasData: !!quoteWith,
          defaultKeyStatistics
        }
      });
    }

    // Calcular métricas de comparação
    const comparison = {
      improvement: analysis.withModules.dividendYieldFound - analysis.withoutModules.dividendYieldFound,
      coverageWithoutModules: `${analysis.withoutModules.dividendYieldFound}/${analysis.totalTickers}`,
      coverageWithModules: `${analysis.withModules.dividendYieldFound}/${analysis.totalTickers}`,
      recommendation: ''
    };

    if (analysis.withModules.dividendYieldFound > analysis.withoutModules.dividendYieldFound) {
      comparison.recommendation = 'USE_MODULES - Melhoria significativa no preenchimento de dividendYield';
    } else if (analysis.withModules.dividendYieldFound === analysis.withoutModules.dividendYieldFound) {
      comparison.recommendation = 'NO_CHANGE - Sem diferença no preenchimento';
    } else {
      comparison.recommendation = 'KEEP_CURRENT - Versão atual retorna mais dados';
    }

    console.log('Analysis complete:', JSON.stringify(analysis, null, 2));

    return new Response(JSON.stringify({
      success: true,
      testTickers: TEST_TICKERS,
      rawResponses: {
        withoutModules: dataWithout,
        withModules: dataWithModules
      },
      results,
      analysis,
      comparison
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error testing Brapi modules:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
