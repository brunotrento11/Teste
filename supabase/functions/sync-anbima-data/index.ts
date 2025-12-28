import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncResult {
  endpoint: string;
  status: 'success' | 'error';
  records_inserted: number;
  records_updated: number;
  message: string;
  error_details?: string;
}

interface SyncReport {
  timestamp: string;
  environment: string;
  total_records_processed: number;
  results: SyncResult[];
  execution_time_ms: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Health check endpoint
    if (req.method === 'GET' && action === 'health') {
      console.log('🏥 Executando health check para sync-anbima-data');
      
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
        .eq('function_name', 'sync-anbima-data')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      // Buscar estatísticas atuais de cada tabela ANBIMA
      const tables = [
        'anbima_titulos_publicos',
        'anbima_debentures',
        'anbima_cri_cra',
        'anbima_fidc',
        'anbima_letras_financeiras',
        'anbima_fundos',
      ];
      
      const distributionByType: Record<string, number> = {};
      let totalAssets = 0;
      
      for (const table of tables) {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (count) {
          distributionByType[table] = count;
          totalAssets += count;
        }
      }
      
      const currentStats = {
        total_assets: totalAssets,
        distribution_by_type: distributionByType,
      };
      
      // Detectar anomalias
      const anomalies: string[] = [];
      
      if (!lastExecution) {
        anomalies.push('no_previous_execution');
      } else {
        // Verificar falha na última execução
        if (lastExecution.status === 'failed') {
          anomalies.push('execution_failure');
        }
        
        // Verificar queda no número de ativos
        if (lastExecution.total_assets_processed && currentStats.total_assets < lastExecution.total_assets_processed * 0.8) {
          anomalies.push('count_drop');
        }
        
        // Verificar spike no número de ativos
        if (lastExecution.total_assets_processed && currentStats.total_assets > lastExecution.total_assets_processed * 1.5) {
          anomalies.push('count_spike');
        }
        
        // Verificar dados desatualizados (>30 dias sem execução)
        const daysSinceLastExecution = (Date.now() - new Date(lastExecution.completed_at || lastExecution.started_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastExecution > 30) {
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
          status: lastExecution.status,
          total_assets_processed: lastExecution.total_assets_processed,
          total_errors: lastExecution.total_errors,
          distribution_by_type: lastExecution.distribution_by_type,
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

    console.log('🚀 Iniciando sincronização de dados ANBIMA');

    const clientId = Deno.env.get('ANBIMA_CLIENT_ID');
    const clientSecret = Deno.env.get('ANBIMA_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais ANBIMA não encontradas');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Credenciais Supabase não encontradas');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const executionId = crypto.randomUUID();
    
    // Registrar início da execução
    await supabase.from('sync_execution_stats').insert({
      id: executionId,
      function_name: 'sync-anbima-data',
      execution_type: 'data_sync',
      started_at: new Date().toISOString(),
      status: 'running',
      triggered_by: 'manual',
    });

    // Usar sandbox para desenvolvimento
    const baseUrl = 'https://api-sandbox.anbima.com.br';
    const environment = 'sandbox';

    const report: SyncReport = {
      timestamp: new Date().toISOString(),
      environment,
      total_records_processed: 0,
      results: [],
      execution_time_ms: 0,
    };

    // 1. Autenticação OAuth2
    console.log('\n🔐 Autenticando na API ANBIMA...');
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    
    const authResponse = await fetch('https://api.anbima.com.br/oauth/access-token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    });

    if (!authResponse.ok) {
      throw new Error(`Falha na autenticação: ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;
    console.log('✅ Autenticação bem-sucedida');

    // 2. Sincronizar Títulos Públicos
    console.log('\n📊 Sincronizando Títulos Públicos...');
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

      if (titulosResponse.ok) {
        const titulosData = await titulosResponse.json();
        let inserted = 0, updated = 0;

        for (const item of titulosData) {
          const { error } = await supabase
            .from('anbima_titulos_publicos')
            .upsert({
              codigo_isin: item.codigo_isin,
              codigo_selic: item.codigo_selic,
              tipo_titulo: item.tipo_titulo,
              data_referencia: item.data_referencia,
              data_vencimento: item.data_vencimento,
              data_base: item.data_base,
              pu: item.pu,
              taxa_compra: item.taxa_compra,
              taxa_venda: item.taxa_venda,
              taxa_indicativa: item.taxa_indicativa,
              desvio_padrao: item.desvio_padrao,
              intervalo_min_d0: item.intervalo_min_d0,
              intervalo_max_d0: item.intervalo_max_d0,
              intervalo_min_d1: item.intervalo_min_d1,
              intervalo_max_d1: item.intervalo_max_d1,
              expressao: item.expressao,
            }, {
              onConflict: 'codigo_isin,data_referencia',
              ignoreDuplicates: false,
            });

          if (error) {
            console.error('Erro ao inserir título público:', error);
          } else {
            inserted++;
          }
        }

        report.results.push({
          endpoint: 'Títulos Públicos',
          status: 'success',
          records_inserted: inserted,
          records_updated: updated,
          message: `✅ ${inserted} registros processados`,
        });
        report.total_records_processed += inserted;
      } else {
        throw new Error(`Erro ao buscar títulos públicos: ${titulosResponse.status}`);
      }
    } catch (error) {
      report.results.push({
        endpoint: 'Títulos Públicos',
        status: 'error',
        records_inserted: 0,
        records_updated: 0,
        message: '❌ Falha na sincronização',
        error_details: error instanceof Error ? error.message : String(error),
      });
    }

    // 3. Sincronizar Debêntures
    console.log('\n📊 Sincronizando Debêntures...');
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

      if (debenturesResponse.ok) {
        const debenturesData = await debenturesResponse.json();
        let inserted = 0;

        for (const item of debenturesData) {
          const { error } = await supabase
            .from('anbima_debentures')
            .upsert({
              codigo_ativo: item.codigo_ativo,
              emissor: item.emissor,
              data_referencia: item.data_referencia,
              data_vencimento: item.data_vencimento,
              grupo: item.grupo,
              percentual_taxa: item.percentual_taxa,
              pu: item.pu,
              taxa_compra: item.taxa_compra,
              taxa_venda: item.taxa_venda,
              taxa_indicativa: item.taxa_indicativa,
              desvio_padrao: item.desvio_padrao,
              duration: item.duration,
              percent_pu_par: item.percent_pu_par,
              percent_reune: item.percent_reune,
              val_min_intervalo: item.val_min_intervalo,
              val_max_intervalo: item.val_max_intervalo,
            }, {
              onConflict: 'codigo_ativo,data_referencia',
              ignoreDuplicates: false,
            });

          if (!error) inserted++;
        }

        report.results.push({
          endpoint: 'Debêntures',
          status: 'success',
          records_inserted: inserted,
          records_updated: 0,
          message: `✅ ${inserted} registros processados`,
        });
        report.total_records_processed += inserted;
      }
    } catch (error) {
      report.results.push({
        endpoint: 'Debêntures',
        status: 'error',
        records_inserted: 0,
        records_updated: 0,
        message: '❌ Falha na sincronização',
        error_details: error instanceof Error ? error.message : String(error),
      });
    }

    // 4. Sincronizar CRI/CRA
    console.log('\n📊 Sincronizando CRI/CRA...');
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

      if (criCraResponse.ok) {
        const criCraData = await criCraResponse.json();
        let inserted = 0;

        for (const item of criCraData) {
          const { error } = await supabase
            .from('anbima_cri_cra')
            .upsert({
              codigo_ativo: item.codigo_ativo,
              tipo_contrato: item.tipo_contrato,
              emissor: item.emissor,
              originador: item.originador,
              originador_credito: item.originador_credito,
              data_referencia: item.data_referencia,
              data_vencimento: item.data_vencimento,
              emissao: item.emissao,
              serie: item.serie,
              tipo_remuneracao: item.tipo_remuneracao,
              taxa_correcao: item.taxa_correcao,
              pu: item.pu,
              vl_pu: item.vl_pu,
              taxa_compra: item.taxa_compra,
              taxa_venda: item.taxa_venda,
              taxa_indicativa: item.taxa_indicativa,
              desvio_padrao: item.desvio_padrao,
              duration: item.duration,
              percent_pu_par: item.percent_pu_par,
            }, {
              onConflict: 'codigo_ativo,data_referencia',
              ignoreDuplicates: false,
            });

          if (!error) inserted++;
        }

        report.results.push({
          endpoint: 'CRI/CRA',
          status: 'success',
          records_inserted: inserted,
          records_updated: 0,
          message: `✅ ${inserted} registros processados`,
        });
        report.total_records_processed += inserted;
      }
    } catch (error) {
      report.results.push({
        endpoint: 'CRI/CRA',
        status: 'error',
        records_inserted: 0,
        records_updated: 0,
        message: '❌ Falha na sincronização',
        error_details: error instanceof Error ? error.message : String(error),
      });
    }

    // 5. Sincronizar FIDC
    console.log('\n📊 Sincronizando FIDC...');
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

      if (fidcResponse.ok) {
        const fidcData = await fidcResponse.json();
        let inserted = 0;

        for (const item of fidcData) {
          const { error } = await supabase
            .from('anbima_fidc')
            .upsert({
              codigo_b3: item.codigo_b3,
              isin: item.isin,
              nome: item.nome,
              emissor: item.emissor,
              serie: item.serie,
              data_referencia: item.data_referencia,
              data_vencimento: item.data_vencimento,
              tipo_remuneracao: item.tipo_remuneracao,
              taxa_correcao: item.taxa_correcao,
              referencia_ntnb: item.referencia_ntnb,
              pu: item.pu,
              taxa_compra: item.taxa_compra,
              taxa_venda: item.taxa_venda,
              taxa_indicativa: item.taxa_indicativa,
              desvio_padrao: item.desvio_padrao,
              duration: item.duration,
              percent_pu_par: item.percent_pu_par,
            }, {
              onConflict: 'codigo_b3,data_referencia',
              ignoreDuplicates: false,
            });

          if (!error) inserted++;
        }

        report.results.push({
          endpoint: 'FIDC',
          status: 'success',
          records_inserted: inserted,
          records_updated: 0,
          message: `✅ ${inserted} registros processados`,
        });
        report.total_records_processed += inserted;
      }
    } catch (error) {
      report.results.push({
        endpoint: 'FIDC',
        status: 'error',
        records_inserted: 0,
        records_updated: 0,
        message: '❌ Falha na sincronização',
        error_details: error instanceof Error ? error.message : String(error),
      });
    }

    // 6. Sincronizar Letras Financeiras
    console.log('\n📊 Sincronizando Letras Financeiras...');
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

      if (lfResponse.ok) {
        const lfData = await lfResponse.json();
        let inserted = 0;

        for (const item of lfData) {
          const { error } = await supabase
            .from('anbima_letras_financeiras')
            .upsert({
              letra_financeira: item.letra_financeira,
              cnpj_emissor: item.cnpj_emissor,
              emissor: item.emissor,
              data_referencia: item.data_referencia,
              indexador: item.indexador,
              fluxo: item.fluxo,
              vertices: item.vertices,
            }, {
              onConflict: 'letra_financeira,cnpj_emissor,data_referencia',
              ignoreDuplicates: false,
            });

          if (!error) inserted++;
        }

        report.results.push({
          endpoint: 'Letras Financeiras',
          status: 'success',
          records_inserted: inserted,
          records_updated: 0,
          message: `✅ ${inserted} registros processados`,
        });
        report.total_records_processed += inserted;
      }
    } catch (error) {
      report.results.push({
        endpoint: 'Letras Financeiras',
        status: 'error',
        records_inserted: 0,
        records_updated: 0,
        message: '❌ Falha na sincronização',
        error_details: error instanceof Error ? error.message : String(error),
      });
    }

    // 7. Sincronizar Fundos (paginado)
    console.log('\n📊 Sincronizando Fundos...');
    try {
      let totalInserted = 0;
      let page = 0;
      const pageSize = 1000;
      let hasMorePages = true;

      while (hasMorePages) {
        const fundosResponse = await fetch(
          `${baseUrl}/feed/fundos/v2/fundos?page=${page}&size=${pageSize}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'client_id': clientId,
              'access_token': accessToken,
            },
          }
        );

        if (fundosResponse.ok) {
          const fundosResult = await fundosResponse.json();
          const fundosData = fundosResult.content || [];

          if (fundosData.length === 0) {
            hasMorePages = false;
            break;
          }

          for (const item of fundosData) {
            const { error } = await supabase
              .from('anbima_fundos')
              .upsert({
                codigo_fundo: item.codigo_fundo,
                tipo_identificador_fundo: item.tipo_identificador_fundo,
                identificador_fundo: item.identificador_fundo,
                razao_social_fundo: item.razao_social_fundo,
                nome_comercial_fundo: item.nome_comercial_fundo,
                tipo_fundo: item.tipo_fundo,
                data_vigencia: item.data_vigencia,
                data_encerramento_fundo: item.data_encerramento_fundo,
                classes: item.classes,
                data_atualizacao: item.data_atualizacao,
              }, {
                onConflict: 'codigo_fundo',
                ignoreDuplicates: false,
              });

            if (!error) totalInserted++;
          }

          // Se retornou menos que pageSize, não há mais páginas
          if (fundosData.length < pageSize) {
            hasMorePages = false;
          } else {
            page++;
          }
        } else {
          hasMorePages = false;
        }
      }

      report.results.push({
        endpoint: 'Fundos',
        status: 'success',
        records_inserted: totalInserted,
        records_updated: 0,
        message: `✅ ${totalInserted} registros processados (${page + 1} páginas)`,
      });
      report.total_records_processed += totalInserted;
    } catch (error) {
      report.results.push({
        endpoint: 'Fundos',
        status: 'error',
        records_inserted: 0,
        records_updated: 0,
        message: '❌ Falha na sincronização',
        error_details: error instanceof Error ? error.message : String(error),
      });
    }

    report.execution_time_ms = Date.now() - startTime;

    // Calcular distribuição por tipo
    const distributionByType: Record<string, number> = {};
    for (const result of report.results) {
      if (result.status === 'success') {
        distributionByType[result.endpoint] = result.records_inserted;
      }
    }

    // Atualizar estatísticas da execução
    await supabase.from('sync_execution_stats').update({
      completed_at: new Date().toISOString(),
      status: 'completed',
      duration_ms: report.execution_time_ms,
      total_assets_processed: report.total_records_processed,
      total_errors: report.results.filter(r => r.status === 'error').length,
      distribution_by_type: distributionByType,
      metadata: { results: report.results },
    }).eq('id', executionId);

    console.log('\n✅ Sincronização concluída!');
    console.log(`📊 Total de registros processados: ${report.total_records_processed}`);
    console.log(`⏱️ Tempo de execução: ${report.execution_time_ms}ms`);

    // Chamar função de pré-cálculo de riscos após sincronização
    console.log('\n🧮 Iniciando pré-cálculo de scores de risco...');
    try {
      const precalcResponse = await fetch(`${supabaseUrl}/functions/v1/precalculate-anbima-risks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (precalcResponse.ok) {
        const precalcData = await precalcResponse.json();
        console.log('✅ Pré-cálculo concluído:', precalcData.message);
      } else {
        console.error('⚠️ Erro no pré-cálculo (não crítico):', await precalcResponse.text());
      }
    } catch (error) {
      console.error('⚠️ Erro ao chamar pré-cálculo (não crítico):', error);
    }

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro na sincronização:', error);
    
    // Tentar registrar falha na execução
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Buscar execução em andamento
        const { data: runningExecution } = await supabase
          .from('sync_execution_stats')
          .select('id')
          .eq('function_name', 'sync-anbima-data')
          .eq('status', 'running')
          .order('started_at', { ascending: false })
          .limit(1)
          .single();
        
        if (runningExecution) {
          await supabase.from('sync_execution_stats').update({
            completed_at: new Date().toISOString(),
            status: 'failed',
            duration_ms: Date.now() - startTime,
            error_details: { message: errorMessage },
          }).eq('id', runningExecution.id);
        }
      }
    } catch (logError) {
      console.error('❌ Erro ao registrar falha:', logError);
    }
    
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
