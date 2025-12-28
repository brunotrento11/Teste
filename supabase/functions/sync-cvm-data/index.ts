import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CVMAsset {
  tipo_ativo?: string;
  cnpj_emissor?: string;
  nome_emissor?: string;
  serie?: string;
  data_emissao?: string;
  data_vencimento?: string;
  valor_total_emissao?: number;
  juros?: string;
  atualizacao_monetaria?: string;
  data_inicio_rentabilidade?: string;
  publico_alvo?: string;
}

interface SyncResult {
  assetType: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Health check endpoint
  if (url.searchParams.get('action') === 'health') {
    return handleHealthCheck(supabase);
  }

  // Registrar início da execução
  const executionId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  
  await supabase.from('sync_execution_stats').insert({
    id: executionId,
    function_name: 'sync-cvm-data',
    execution_type: 'manual',
    started_at: startedAt,
    status: 'running'
  });

  try {
    console.log('🚀 Iniciando sincronização de dados CVM...');

    const body = await req.json().catch(() => ({}));
    const assetTypes = body.assetTypes || ['CRA', 'CRI', 'DEBÊNTURE'];

    console.log(`📥 Processando ofertas públicas da CVM para: ${assetTypes.join(', ')}`);
    
    const result = await syncOfertasPublicas(assetTypes);

    console.log(`🎉 Sincronização concluída: ${result.validRecords} válidos, ${result.invalidRecords} inválidos`);

    // Calcular estatísticas para o banco
    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    // Buscar ativos inseridos para calcular distribuição
    const { data: cvmAssets } = await supabase
      .from('cvm_ofertas_publicas')
      .select('tipo_ativo, is_active');

    const distributionByType: Record<string, number> = {};
    let totalActive = 0;

    cvmAssets?.forEach(asset => {
      if (asset.is_active) {
        totalActive++;
        const tipo = asset.tipo_ativo || 'Desconhecido';
        distributionByType[tipo] = (distributionByType[tipo] || 0) + 1;
      }
    });

    // Atualizar registro de execução
    await supabase.from('sync_execution_stats').update({
      completed_at: completedAt,
      duration_ms: durationMs,
      status: 'success',
      total_assets_processed: result.validRecords,
      total_assets_skipped: result.invalidRecords,
      total_errors: result.errors.length,
      distribution_by_type: distributionByType,
      metadata: {
        asset_types_requested: assetTypes,
        total_active: totalActive
      }
    }).eq('id', executionId);

    // Criar alertas de anomalias
    await createAnomalyAlerts(supabase, executionId);

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: executionId,
        summary: {
          totalValid: result.validRecords,
          totalInvalid: result.invalidRecords,
          totalErrors: result.errors.length,
          durationMs
        },
        details: result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro na sincronização CVM:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Atualizar registro com erro
    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    
    await supabase.from('sync_execution_stats').update({
      completed_at: completedAt,
      duration_ms: durationMs,
      status: 'error',
      error_details: [{ message: errorMessage, stack: errorStack }]
    }).eq('id', executionId);

    return new Response(
      JSON.stringify({ 
        success: false,
        execution_id: executionId,
        error: errorMessage,
        details: errorStack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function syncOfertasPublicas(assetTypes: string[]): Promise<SyncResult> {
  const url = 'https://dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip';
  
  console.log(`📡 Baixando ofertas públicas de: ${url}`);

  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Falha ao baixar arquivo: ${response.status} ${response.statusText}`);
  }

  // Ler o conteúdo como array buffer
  const zipBuffer = await response.arrayBuffer();
  console.log(`📦 ZIP baixado: ${zipBuffer.byteLength} bytes`);

  // Descompactar o ZIP usando JSZip
  try {
    const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
    console.log('✅ JSZip importado com sucesso');
    
    const zip = await JSZip.loadAsync(zipBuffer);
    console.log('✅ ZIP descompactado com sucesso');
    
    const fileNames = Object.keys(zip.files);
    console.log(`📂 Arquivos no ZIP: ${fileNames.length}`);
    console.log(`📂 Lista de arquivos:`, fileNames);
    
    // Procurar o arquivo CSV dentro do ZIP
    const csvFileName = fileNames.find(name => name.toLowerCase().endsWith('.csv'));
    
    if (!csvFileName) {
      console.error('❌ Nenhum arquivo CSV encontrado');
      console.error('Arquivos disponíveis:', fileNames);
      throw new Error('Nenhum arquivo CSV encontrado no ZIP');
    }
    
    console.log(`📄 Extraindo: ${csvFileName}`);
    
    // Extrair o conteúdo do CSV com encoding correto (ISO-8859-1 / Latin1)
    const csvBytes = await zip.files[csvFileName].async('uint8array');
    const decoder = new TextDecoder('iso-8859-1');
    const csvText = decoder.decode(csvBytes);
    
    console.log(`📄 CSV extraído: ${csvText.length} bytes`);
    
    // Parse do CSV
    const assets = parseCSV(csvText);
    
    console.log(`📊 Total de registros parseados: ${assets.length}`);
    
    // Log de TODOS os tipos de ativos únicos encontrados
    const allTypes = new Set<string>();
    assets.forEach(asset => {
      if (asset.tipo_ativo) {
        allTypes.add(asset.tipo_ativo);
      }
    });
    console.log(`📋 Tipos de ativos únicos encontrados (${allTypes.size} tipos):`, Array.from(allTypes).sort());

    // Filtrar apenas os tipos de ativos solicitados
    const filteredAssets = assets.filter(asset => {
      if (!asset.tipo_ativo) return false;
      
      const tipo = asset.tipo_ativo.toUpperCase();
      
      return assetTypes.some(requestedType => {
        if (requestedType === 'CRI') return tipo.includes('CERTIFICADO') && tipo.includes('IMOBILIÁRIOS');
        if (requestedType === 'CRA') return tipo.includes('CERTIFICADO') && tipo.includes('AGRONEGÓCIO');
        if (requestedType === 'DEBÊNTURE') return tipo.includes('DEBÊNTURE');
        return false;
      });
    });
    
    console.log(`🔍 Registros filtrados por tipo: ${filteredAssets.length}`);

    // Validar registros
    const validAssets: CVMAsset[] = [];
    const errors: string[] = [];

    for (const asset of filteredAssets) {
      const validation = validateAsset(asset);
      if (validation.valid) {
        validAssets.push(asset);
      } else {
        errors.push(...validation.errors);
      }
    }

    // Contar por tipo de ativo
    const countByType: Record<string, number> = {};
    validAssets.forEach(asset => {
      const tipo = asset.tipo_ativo || 'Desconhecido';
      countByType[tipo] = (countByType[tipo] || 0) + 1;
    });
    
    console.log(`📊 Distribuição por tipo:`, countByType);

    // Inserir dados validados na tabela cvm_ofertas_publicas
    console.log('💾 Iniciando inserção no banco de dados...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Deduplicate validAssets based on unique constraint (cnpj_emissor, serie, data_emissao, tipo_ativo)
    const uniqueAssets = Array.from(
      new Map(
        validAssets.map(asset => {
          const key = `${asset.cnpj_emissor}|${asset.serie || ''}|${asset.data_emissao}|${asset.tipo_ativo}`;
          return [key, asset];
        })
      ).values()
    );

    console.log(`🔄 Registros únicos após deduplicação: ${uniqueAssets.length} (eram ${validAssets.length})`);

    // Preparar dados para inserção
    const dataToInsert = uniqueAssets.map(asset => ({
      tipo_ativo: asset.tipo_ativo!,
      cnpj_emissor: asset.cnpj_emissor!,
      nome_emissor: asset.nome_emissor!,
      serie: asset.serie || null,
      data_emissao: asset.data_emissao || null,
      data_vencimento: asset.data_vencimento || null,
      valor_total_emissao: asset.valor_total_emissao || null,
      juros: asset.juros || null,
      atualizacao_monetaria: asset.atualizacao_monetaria || null,
      data_inicio_rentabilidade: asset.data_inicio_rentabilidade || null,
      publico_alvo: asset.publico_alvo || null,
      is_active: asset.data_vencimento ? new Date(asset.data_vencimento) >= new Date() : true
    }));

    // Upsert em lote
    const { error: insertError } = await supabase
      .from('cvm_ofertas_publicas')
      .upsert(dataToInsert, {
        onConflict: 'cnpj_emissor,serie,data_emissao,tipo_ativo',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.error('❌ Erro ao inserir dados:', insertError);
      throw insertError;
    }

    console.log(`✅ ${uniqueAssets.length} registros inseridos/atualizados na tabela cvm_ofertas_publicas`);

    return {
      assetType: assetTypes.join(', '),
      totalRecords: filteredAssets.length,
      validRecords: uniqueAssets.length,
      invalidRecords: filteredAssets.length - validAssets.length,
      errors: errors.slice(0, 20) // Limitar a 20 erros para não sobrecarregar o log
    };
  } catch (error) {
    console.error('❌ Erro durante processamento do ZIP:', error);
    throw error;
  }
}

function parseCSV(csvText: string): CVMAsset[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    console.log('⚠️ CSV vazio ou sem dados');
    return [];
  }

  // Primeira linha é o cabeçalho
  const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  console.log(`📋 Total de cabeçalhos: ${headers.length}`);

  const assets: CVMAsset[] = [];

  // Processar cada linha de dados
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(';').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length < headers.length) {
        continue; // Linha incompleta
      }

      const asset: CVMAsset = {};

      // Mapear campos do dataset de ofertas públicas
      headers.forEach((header, index) => {
        const value = values[index];
        
        if (header === 'Tipo_Ativo') {
          asset.tipo_ativo = value;
        } else if (header === 'CNPJ_Emissor') {
          asset.cnpj_emissor = value;
        } else if (header === 'Nome_Emissor') {
          asset.nome_emissor = value;
        } else if (header === 'Serie') {
          asset.serie = value;
        } else if (header === 'Data_Emissao') {
          asset.data_emissao = parseDate(value);
        } else if (header === 'Data_Vencimento') {
          asset.data_vencimento = parseDate(value);
        } else if (header === 'Valor_Total_Emissao') {
          asset.valor_total_emissao = parseNumber(value);
        } else if (header === 'Juros') {
          asset.juros = value;
        } else if (header === 'Atualizacao_Monetaria') {
          asset.atualizacao_monetaria = value;
        } else if (header === 'Data_Inicio_Rentabilidade') {
          asset.data_inicio_rentabilidade = parseDate(value);
        } else if (header === 'Publico_Alvo') {
          asset.publico_alvo = value;
        }
      });

      assets.push(asset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Erro ao parsear linha ${i}:`, errorMessage);
    }
  }

  return assets;
}

function parseDate(dateStr: string): string | undefined {
  if (!dateStr || dateStr === '-' || dateStr === '') {
    return undefined;
  }

  try {
    // Formato esperado: DD/MM/YYYY ou YYYY-MM-DD
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (dateStr.includes('-')) {
      return dateStr; // Já está no formato ISO
    }
  } catch (error) {
    console.error(`Erro ao parsear data: ${dateStr}`, error);
  }

  return undefined;
}

function parseNumber(numStr: string): number | undefined {
  if (!numStr || numStr === '-' || numStr === '') {
    return undefined;
  }

  try {
    // Remover pontos de milhar e substituir vírgula por ponto
    const cleaned = numStr.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  } catch (error) {
    return undefined;
  }
}

function validateAsset(asset: CVMAsset): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validações obrigatórias
  if (!asset.tipo_ativo) {
    errors.push('Tipo de ativo ausente');
  }

  if (!asset.cnpj_emissor) {
    errors.push('CNPJ do emissor ausente');
  }

  if (!asset.nome_emissor) {
    errors.push('Nome do emissor ausente');
  }

  if (!asset.data_emissao) {
    errors.push('Data de emissão ausente');
  }

  if (!asset.data_vencimento) {
    errors.push('Data de vencimento ausente');
  }

  // Validar formato de data
  if (asset.data_emissao && !isValidDate(asset.data_emissao)) {
    errors.push(`Data de emissão inválida: ${asset.data_emissao}`);
  }

  if (asset.data_vencimento && !isValidDate(asset.data_vencimento)) {
    errors.push(`Data de vencimento inválida: ${asset.data_vencimento}`);
  }

  // Validar valores numéricos
  if (asset.valor_total_emissao !== undefined && asset.valor_total_emissao <= 0) {
    errors.push('Valor de emissão deve ser positivo');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    return false;
  }

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
}

async function handleHealthCheck(supabase: any) {
  try {
    // 1. Buscar última execução
    const { data: lastExecutions } = await supabase
      .from('sync_execution_stats')
      .select('*')
      .eq('function_name', 'sync-cvm-data')
      .order('started_at', { ascending: false })
      .limit(1);

    const lastExecution = lastExecutions?.[0] || null;

    // 2. Calcular estatísticas atuais do banco
    const { data: cvmAssets } = await supabase
      .from('cvm_ofertas_publicas')
      .select('tipo_ativo, is_active');

    const currentStats = {
      total_assets: cvmAssets?.length || 0,
      total_active: cvmAssets?.filter((a: any) => a.is_active).length || 0,
      by_type: {} as Record<string, number>
    };

    cvmAssets?.forEach((asset: any) => {
      if (asset.is_active) {
        const tipo = asset.tipo_ativo || 'Desconhecido';
        currentStats.by_type[tipo] = (currentStats.by_type[tipo] || 0) + 1;
      }
    });

    // 3. Detectar anomalias
    const anomalies = detectAnomalies(lastExecution, currentStats);

    // 4. Buscar alertas pendentes
    const { data: pendingAlerts } = await supabase
      .from('sync_anomaly_alerts')
      .select('*')
      .eq('is_acknowledged', false)
      .order('created_at', { ascending: false });

    const status = anomalies.length > 0 ? 'warning' : 'healthy';

    return new Response(
      JSON.stringify({
        status,
        last_execution: lastExecution,
        current_stats: currentStats,
        anomalies,
        pending_alerts: pendingAlerts?.length || 0,
        generated_at: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('❌ Erro no health check:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        status: 'error',
        error: errorMessage,
        generated_at: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

interface Anomaly {
  type: string;
  severity: string;
  metric?: string;
  expected?: number;
  actual?: number;
  deviation?: number;
  message: string;
}

function detectAnomalies(lastExecution: any, currentStats: any): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (!lastExecution) {
    anomalies.push({
      type: 'no_history',
      severity: 'info',
      message: 'Nenhuma execução anterior encontrada'
    });
    return anomalies;
  }

  // Verificar se última execução falhou
  if (lastExecution.status === 'error') {
    anomalies.push({
      type: 'execution_failure',
      severity: 'critical',
      message: 'Última execução falhou'
    });
  }

  // Verificar variação no total de ativos ativos
  const lastTotal = lastExecution.metadata?.total_active || lastExecution.total_assets_processed || 0;
  const currentTotal = currentStats.total_active;
  
  if (lastTotal > 0) {
    const countVariation = ((currentTotal - lastTotal) / lastTotal) * 100;

    if (countVariation < -10) {
      anomalies.push({
        type: 'count_drop',
        severity: 'warning',
        metric: 'total_active_assets',
        expected: lastTotal,
        actual: currentTotal,
        deviation: countVariation,
        message: `Queda de ${Math.abs(countVariation).toFixed(1)}% no total de ativos ativos`
      });
    } else if (countVariation > 50) {
      anomalies.push({
        type: 'count_spike',
        severity: 'info',
        metric: 'total_active_assets',
        expected: lastTotal,
        actual: currentTotal,
        deviation: countVariation,
        message: `Aumento de ${countVariation.toFixed(1)}% no total de ativos ativos`
      });
    }
  }

  // Verificar dados obsoletos (última execução > 7 dias)
  const lastExecutionDate = new Date(lastExecution.completed_at || lastExecution.started_at);
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

async function createAnomalyAlerts(supabase: any, executionId: string) {
  try {
    // Buscar última execução anterior (não a atual)
    const { data: previousExecutions } = await supabase
      .from('sync_execution_stats')
      .select('*')
      .eq('function_name', 'sync-cvm-data')
      .neq('id', executionId)
      .order('started_at', { ascending: false })
      .limit(1);

    const previousExecution = previousExecutions?.[0];

    if (!previousExecution) {
      console.log('ℹ️ Primeira execução, sem comparação para anomalias');
      return;
    }

    // Buscar execução atual
    const { data: currentExecutions } = await supabase
      .from('sync_execution_stats')
      .select('*')
      .eq('id', executionId)
      .single();

    if (!currentExecutions) {
      console.log('⚠️ Execução atual não encontrada');
      return;
    }

    const currentStats = {
      total_active: currentExecutions.metadata?.total_active || currentExecutions.total_assets_processed || 0
    };

    // Detectar anomalias comparando com execução anterior
    const anomalies = detectAnomalies(previousExecution, currentStats);

    // Inserir alertas no banco
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'info' || anomaly.type === 'no_history') {
        continue; // Não criar alertas para info ou primeira execução
      }

      await supabase.from('sync_anomaly_alerts').insert({
        execution_id: executionId,
        alert_type: anomaly.type,
        severity: anomaly.severity,
        metric_name: anomaly.metric || 'unknown',
        expected_value: anomaly.expected,
        actual_value: anomaly.actual,
        deviation_percent: anomaly.deviation,
        message: anomaly.message
      });

      console.log(`🚨 Alerta criado: ${anomaly.type} - ${anomaly.message}`);
    }
  } catch (error) {
    console.error('❌ Erro ao criar alertas de anomalias:', error);
  }
}
