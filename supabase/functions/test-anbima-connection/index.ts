import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestResult {
  status: 'success' | 'error';
  message: string;
  records_found?: number;
  sample_data?: any;
  error_details?: string;
}

interface TestReport {
  timestamp: string;
  environment: 'production' | 'sandbox';
  tests: {
    authentication: TestResult;
    titulos_publicos: TestResult;
    debentures: TestResult;
    debentures_plus: TestResult;
    cri_cra: TestResult;
    fidc: TestResult;
    letras_financeiras: TestResult;
    fundos: TestResult;
  };
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    ready_for_production: boolean;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando testes de conexão com API ANBIMA');
    
    const clientId = Deno.env.get('ANBIMA_CLIENT_ID');
    const clientSecret = Deno.env.get('ANBIMA_CLIENT_SECRET');
    
    // Testar primeiro Sandbox, depois Produção se falhar
    const environments = [
      { name: 'sandbox' as const, baseUrl: 'https://api-sandbox.anbima.com.br' },
      { name: 'production' as const, baseUrl: 'https://api.anbima.com.br' }
    ];
    
    let workingEnvironment: typeof environments[0] | null = null;

    if (!clientId || !clientSecret) {
      throw new Error('ANBIMA credentials not found in environment variables');
    }

    console.log('✅ Credenciais ANBIMA encontradas');
    console.log(`Client ID: ${clientId.substring(0, 4)}***`);

    const report: TestReport = {
      timestamp: new Date().toISOString(),
      environment: 'sandbox',
      tests: {
        authentication: { status: 'error', message: '' },
        titulos_publicos: { status: 'error', message: '' },
        debentures: { status: 'error', message: '' },
        debentures_plus: { status: 'error', message: '' },
        cri_cra: { status: 'error', message: '' },
        fidc: { status: 'error', message: '' },
        letras_financeiras: { status: 'error', message: '' },
        fundos: { status: 'error', message: '' },
      },
      summary: {
        total_tests: 8,
        passed: 0,
        failed: 0,
        ready_for_production: false,
      },
    };

    // Teste 1: Autenticação OAuth2
    console.log('\n📝 Teste 1: Autenticação OAuth2');
    try {
      const basicAuth = btoa(`${clientId}:${clientSecret}`);
      console.log('Enviando requisição de autenticação...');
      
      const authResponse = await fetch('https://api.anbima.com.br/oauth/access-token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ grant_type: 'client_credentials' }),
      });

      const authData = await authResponse.json();
      console.log('Resposta de autenticação:', authResponse.status);
      console.log('Dados:', authData);

      if (authResponse.ok && authData.access_token) {
        report.tests.authentication = {
          status: 'success',
          message: `✅ Autenticação OAuth2 funcionando (expires_in: ${authData.expires_in}s)`,
        };
        report.summary.passed++;
        console.log('✅ Autenticação bem-sucedida');

        const accessToken = authData.access_token;

        // Testar qual ambiente funciona
        console.log('\n🔍 Testando ambientes...');
        for (const env of environments) {
          try {
            console.log(`\nTestando ${env.name}...`);
            const testResponse = await fetch(
              `${env.baseUrl}/feed/precos-indices/v1/titulos-publicos/mercado-secundario-TPF`,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'client_id': clientId,
                  'access_token': accessToken,
                },
              }
            );
            
            console.log(`Status ${env.name}:`, testResponse.status);
            
            if (testResponse.ok) {
              workingEnvironment = env;
              report.environment = env.name;
              console.log(`✅ Ambiente ${env.name} funciona!`);
              break;
            } else {
              const errorText = await testResponse.text();
              console.log(`❌ Ambiente ${env.name} não funciona: ${testResponse.status} - ${errorText}`);
            }
          } catch (envError) {
            const errorMessage = envError instanceof Error ? envError.message : String(envError);
            console.log(`❌ Erro ao testar ${env.name}: ${errorMessage}`);
          }
        }

        if (!workingEnvironment) {
          throw new Error('Nenhum ambiente (production/sandbox) está acessível com essas credenciais');
        }

        const baseUrl = workingEnvironment.baseUrl;
        console.log(`\n✅ Usando ambiente: ${workingEnvironment.name}`);

        // Teste 2: API de Títulos Públicos (Mercado Secundário)
        console.log('\n📝 Teste 2: API de Títulos Públicos - Mercado Secundário TPF');
        try {
          const titulosResponse = await fetch(
            `${baseUrl}/feed/precos-indices/v1/titulos-publicos/mercado-secundario-TPF`,
            {
              headers: {
                'Content-Type': 'application/json',
                'client_id': clientId,
                'access_token': accessToken,
              },
            }
          );

          console.log('Status:', titulosResponse.status);
          
          // Capturar resposta como texto primeiro para ver erro completo
          const titulosText = await titulosResponse.text();
          console.log('Resposta completa:', titulosText);
          
          let titulosData;
          try {
            titulosData = JSON.parse(titulosText);
          } catch {
            // Se não for JSON, é uma mensagem de erro em texto
            titulosData = { error: titulosText };
          }
          
          console.log('Total de registros:', Array.isArray(titulosData) ? titulosData.length : 'N/A');

          if (titulosResponse.ok && Array.isArray(titulosData)) {
            report.tests.titulos_publicos = {
              status: 'success',
              message: '✅ API de Títulos Públicos acessível',
              records_found: titulosData.length,
              sample_data: titulosData[0] || null,
            };
            report.summary.passed++;
            console.log('✅ Títulos Públicos OK');
          } else {
            report.tests.titulos_publicos = {
              status: 'error',
              message: '❌ Erro ao acessar Títulos Públicos',
              error_details: JSON.stringify(titulosData).substring(0, 200),
            };
            report.summary.failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          report.tests.titulos_publicos = {
            status: 'error',
            message: '❌ Erro ao acessar Títulos Públicos',
            error_details: errorMessage,
          };
          report.summary.failed++;
          console.error('❌ Erro Títulos Públicos:', error);
        }

        // Teste 3: API de Debêntures
        console.log('\n📝 Teste 3: API de Debêntures');
        try {
          const debenturesResponse = await fetch(
            `${baseUrl}/feed/precos-indices/v1/debentures/mercado-secundario`,
            {
              headers: {
                'Content-Type': 'application/json',
                'client_id': clientId,
                'access_token': accessToken,
              },
            }
          );

          const debenturesData = await debenturesResponse.json();
          console.log('Status:', debenturesResponse.status);
          console.log('Total de registros:', Array.isArray(debenturesData) ? debenturesData.length : 'N/A');

          if (debenturesResponse.ok && Array.isArray(debenturesData)) {
            report.tests.debentures = {
              status: 'success',
              message: '✅ API de Debêntures acessível',
              records_found: debenturesData.length,
              sample_data: debenturesData[0] || null,
            };
            report.summary.passed++;
            console.log('✅ Debêntures OK');
          } else {
            report.tests.debentures = {
              status: 'error',
              message: '❌ Erro ao acessar Debêntures',
              error_details: JSON.stringify(debenturesData).substring(0, 200),
            };
            report.summary.failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          report.tests.debentures = {
            status: 'error',
            message: '❌ Erro ao acessar Debêntures',
            error_details: errorMessage,
          };
          report.summary.failed++;
          console.error('❌ Erro Debêntures:', error);
        }

        // Teste 4: API de CRI/CRA
        console.log('\n📝 Teste 4: API de CRI/CRA');
        try {
          const criCraResponse = await fetch(
            `${baseUrl}/feed/precos-indices/v1/cri-cra/mercado-secundario`,
            {
              headers: {
                'Content-Type': 'application/json',
                'client_id': clientId,
                'access_token': accessToken,
              },
            }
          );

          const criCraData = await criCraResponse.json();
          console.log('Status:', criCraResponse.status);
          console.log('Total de registros:', Array.isArray(criCraData) ? criCraData.length : 'N/A');

          if (criCraResponse.ok && Array.isArray(criCraData)) {
            report.tests.cri_cra = {
              status: 'success',
              message: '✅ API de CRI/CRA acessível',
              records_found: criCraData.length,
              sample_data: criCraData[0] || null,
            };
            report.summary.passed++;
            console.log('✅ CRI/CRA OK');
          } else {
            report.tests.cri_cra = {
              status: 'error',
              message: '❌ Erro ao acessar CRI/CRA',
              error_details: JSON.stringify(criCraData).substring(0, 200),
            };
            report.summary.failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          report.tests.cri_cra = {
            status: 'error',
            message: '❌ Erro ao acessar CRI/CRA',
            error_details: errorMessage,
          };
          report.summary.failed++;
          console.error('❌ Erro CRI/CRA:', error);
        }

        // Teste 5: API de Debêntures+ (Incentivadas)
        console.log('\n📝 Teste 5: API de Debêntures+ (Incentivadas)');
        try {
          const debenturesPlusResponse = await fetch(
            `${baseUrl}/feed/precos-indices/v1/debentures-mais/mercado-secundario`,
            {
              headers: {
                'Content-Type': 'application/json',
                'client_id': clientId,
                'access_token': accessToken,
              },
            }
          );

          const debenturesPlusData = await debenturesPlusResponse.json();
          console.log('Status:', debenturesPlusResponse.status);
          console.log('Total de registros:', Array.isArray(debenturesPlusData) ? debenturesPlusData.length : 'N/A');

          if (debenturesPlusResponse.ok && Array.isArray(debenturesPlusData)) {
            report.tests.debentures_plus = {
              status: 'success',
              message: '✅ API de Debêntures+ acessível',
              records_found: debenturesPlusData.length,
              sample_data: debenturesPlusData[0] || null,
            };
            report.summary.passed++;
            console.log('✅ Debêntures+ OK');
          } else {
            report.tests.debentures_plus = {
              status: 'error',
              message: '❌ Erro ao acessar Debêntures+',
              error_details: JSON.stringify(debenturesPlusData).substring(0, 200),
            };
            report.summary.failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          report.tests.debentures_plus = {
            status: 'error',
            message: '❌ Erro ao acessar Debêntures+',
            error_details: errorMessage,
          };
          report.summary.failed++;
          console.error('❌ Erro Debêntures+:', error);
        }

        // Teste 6: API de FIDC
        console.log('\n📝 Teste 6: API de FIDC');
        try {
          const fidcResponse = await fetch(
            `${baseUrl}/feed/precos-indices/v1/fidc/mercado-secundario`,
            {
              headers: {
                'Content-Type': 'application/json',
                'client_id': clientId,
                'access_token': accessToken,
              },
            }
          );

          const fidcData = await fidcResponse.json();
          console.log('Status:', fidcResponse.status);
          console.log('Total de registros:', Array.isArray(fidcData) ? fidcData.length : 'N/A');

          if (fidcResponse.ok && Array.isArray(fidcData)) {
            report.tests.fidc = {
              status: 'success',
              message: '✅ API de FIDC acessível',
              records_found: fidcData.length,
              sample_data: fidcData[0] || null,
            };
            report.summary.passed++;
            console.log('✅ FIDC OK');
          } else {
            report.tests.fidc = {
              status: 'error',
              message: '❌ Erro ao acessar FIDC',
              error_details: JSON.stringify(fidcData).substring(0, 200),
            };
            report.summary.failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          report.tests.fidc = {
            status: 'error',
            message: '❌ Erro ao acessar FIDC',
            error_details: errorMessage,
          };
          report.summary.failed++;
          console.error('❌ Erro FIDC:', error);
        }

        // Teste 7: API de Letras Financeiras
        console.log('\n📝 Teste 7: API de Letras Financeiras');
        try {
          const lfResponse = await fetch(
            `${baseUrl}/feed/precos-indices/v1/letras-financeiras/matrizes-vertices-emissor`,
            {
              headers: {
                'Content-Type': 'application/json',
                'client_id': clientId,
                'access_token': accessToken,
              },
            }
          );

          const lfData = await lfResponse.json();
          console.log('Status:', lfResponse.status);
          console.log('Total de registros:', Array.isArray(lfData) ? lfData.length : 'N/A');

          if (lfResponse.ok && Array.isArray(lfData)) {
            report.tests.letras_financeiras = {
              status: 'success',
              message: '✅ API de Letras Financeiras acessível',
              records_found: lfData.length,
              sample_data: lfData[0] || null,
            };
            report.summary.passed++;
            console.log('✅ Letras Financeiras OK');
          } else {
            report.tests.letras_financeiras = {
              status: 'error',
              message: '❌ Erro ao acessar Letras Financeiras',
              error_details: JSON.stringify(lfData).substring(0, 200),
            };
            report.summary.failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          report.tests.letras_financeiras = {
            status: 'error',
            message: '❌ Erro ao acessar Letras Financeiras',
            error_details: errorMessage,
          };
          report.summary.failed++;
          console.error('❌ Erro Letras Financeiras:', error);
        }

        // Teste 8: API de Fundos
        console.log('\n📝 Teste 8: API de Fundos (RCVM 175)');
        try {
          const fundosResponse = await fetch(
            `${baseUrl}/feed/fundos/v2/fundos?page=0&size=100`,
            {
              headers: {
                'Content-Type': 'application/json',
                'client_id': clientId,
                'access_token': accessToken,
              },
            }
          );

          console.log('Status Fundos:', fundosResponse.status);

          if (fundosResponse.ok) {
            const fundosData = await fundosResponse.json();
            const dataArray = fundosData?.content || [];
            const total = fundosData?.total || 0;
            const pagina = fundosData?.pagina || 0;
            
            report.tests.fundos = {
              status: 'success',
              message: `✅ API de Fundos acessível (Total: ${total} fundos, Página: ${pagina})`,
              records_found: dataArray.length,
              sample_data: dataArray[0] || null,
            };
            report.summary.passed++;
            console.log(`✅ ${dataArray.length} fundos retornados (Total: ${total}, Página: ${pagina})`);
          } else {
            const errorText = await fundosResponse.text();
            report.tests.fundos = {
              status: 'error',
              message: '❌ Erro ao acessar Fundos',
              error_details: errorText.substring(0, 200),
            };
            report.summary.failed++;
            console.log('❌ Erro Fundos:', fundosResponse.status, errorText);
          }
        } catch (fundosError) {
          const errorMessage = fundosError instanceof Error ? fundosError.message : String(fundosError);
          report.tests.fundos = {
            status: 'error',
            message: `❌ Erro ao testar Fundos: ${errorMessage}`,
          };
          report.summary.failed++;
          console.error('❌ Erro ao testar Fundos:', errorMessage);
        }

      } else {
        report.tests.authentication = {
          status: 'error',
          message: '❌ Falha na autenticação OAuth2',
          error_details: JSON.stringify(authData),
        };
        report.summary.failed++;
        console.error('❌ Falha na autenticação');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      report.tests.authentication = {
        status: 'error',
        message: '❌ Erro ao tentar autenticar',
        error_details: errorMessage,
      };
      report.summary.failed++;
      console.error('❌ Erro na autenticação:', error);
    }

    // Calcular totais
    report.summary.failed = report.summary.total_tests - report.summary.passed;
    report.summary.ready_for_production = report.summary.passed === report.summary.total_tests;

    console.log('\n📊 Resumo dos testes:');
    console.log(`✅ Passou: ${report.summary.passed}/${report.summary.total_tests}`);
    console.log(`❌ Falhou: ${report.summary.failed}/${report.summary.total_tests}`);
    console.log(`🚀 Pronto para produção: ${report.summary.ready_for_production ? 'SIM' : 'NÃO'}`);

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro geral:', error);
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
