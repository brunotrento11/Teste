// Função temporária para analisar estrutura do dataset CVM de Ofertas Públicas
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Analisando dataset CVM de Ofertas Públicas...');
    
    const url = 'https://dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip';
    
    // Download do ZIP
    console.log(`📡 Baixando de: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Falha ao baixar: ${response.status} ${response.statusText}`);
    }
    
    const zipBuffer = await response.arrayBuffer();
    console.log(`📦 ZIP baixado: ${zipBuffer.byteLength} bytes`);
    
    // Descompactar ZIP
    const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
    const zip = await JSZip.loadAsync(zipBuffer);
    
    console.log(`📂 Arquivos no ZIP: ${Object.keys(zip.files).length}`);
    
    // Encontrar CSV
    const csvFileName = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.csv'));
    
    if (!csvFileName) {
      throw new Error('Nenhum arquivo CSV encontrado no ZIP');
    }
    
    console.log(`📄 Extraindo: ${csvFileName}`);
    const csvText = await zip.files[csvFileName].async('text');
    
    // Analisar estrutura
    const lines = csvText.split('\n').filter(line => line.trim());
    console.log(`📊 Total de linhas: ${lines.length}`);
    
    // Headers
    const headers = lines[0].split(';').map(h => h.trim());
    console.log(`🏷️ Total de colunas: ${headers.length}`);
    
    // Amostra de dados
    const sampleSize = Math.min(10, lines.length - 1);
    const samples = [];
    
    for (let i = 1; i <= sampleSize; i++) {
      const values = lines[i].split(';');
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      samples.push(row);
    }
    
    // Identificar ativos CRI/CRA/Debêntures
    const assetTypesFound = new Set<string>();
    const targetAssets = [];
    const tipoAtivoIndex = headers.indexOf('Tipo_Ativo');
    const jurosIndex = headers.indexOf('Juros');
    const atualizacaoIndex = headers.indexOf('Atualizacao_Monetaria');
    
    console.log(`📍 Índices - Tipo: ${tipoAtivoIndex}, Juros: ${jurosIndex}, Atualização: ${atualizacaoIndex}`);
    
    for (let i = 1; i < Math.min(5000, lines.length); i++) {
      const values = lines[i].split(';');
      const tipoAtivo = values[tipoAtivoIndex]?.trim() || '';
      
      if (tipoAtivo) {
        assetTypesFound.add(tipoAtivo);
      }
      
      // Capturar CRI/CRA/Debêntures
      if (tipoAtivo.toLowerCase().includes('cri') || 
          tipoAtivo.toLowerCase().includes('cra') || 
          tipoAtivo.toLowerCase().includes('deb')) {
        
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        targetAssets.push({
          tipo: tipoAtivo,
          emissor: values[headers.indexOf('Nome_Emissor')] || '',
          serie: values[headers.indexOf('Serie')] || '',
          dataEmissao: values[headers.indexOf('Data_Emissao')] || '',
          dataVencimento: values[headers.indexOf('Data_Vencimento')] || '',
          juros: values[jurosIndex] || '',
          atualizacaoMonetaria: values[atualizacaoIndex] || '',
        });
      }
    }
    
    console.log(`🎯 Total de CRI/CRA/Debêntures encontrados: ${targetAssets.length}`);
    
    const result = {
      success: true,
      fileName: csvFileName,
      totalLines: lines.length,
      totalColumns: headers.length,
      headers: headers,
      assetTypesFound: Array.from(assetTypesFound),
      sampleData: samples,
      targetAssets: {
        total: targetAssets.length,
        withJuros: targetAssets.filter(a => a.juros).length,
        withAtualizacao: targetAssets.filter(a => a.atualizacaoMonetaria).length,
        samples: targetAssets.slice(0, 20), // Primeiros 20 exemplos
      },
      analysis: {
        hasIssuerField: headers.some(h => h.toLowerCase().includes('emissor') || h.toLowerCase().includes('issuer')),
        hasSeriesField: headers.some(h => h.toLowerCase().includes('serie') || h.toLowerCase().includes('series')),
        hasMaturityField: headers.some(h => h.toLowerCase().includes('vencimento') || h.toLowerCase().includes('maturity')),
        hasProfitabilityField: headers.some(h => h.toLowerCase().includes('rentabilidade') || h.toLowerCase().includes('profit') || h.toLowerCase().includes('taxa')),
        hasCNPJField: headers.some(h => h.toLowerCase().includes('cnpj')),
        hasDateField: headers.some(h => h.toLowerCase().includes('data') || h.toLowerCase().includes('date')),
        hasJurosField: headers.includes('Juros'),
        hasAtualizacaoField: headers.includes('Atualizacao_Monetaria'),
      }
    };
    
    console.log('✅ Análise concluída');
    
    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
