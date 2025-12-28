import { useState, useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * Tipos de ativos suportados no mercado brasileiro
 */
export type AssetType = 
  | 'stock' 
  | 'fii' 
  | 'unit' 
  | 'etf' 
  | 'bdr' 
  | 'titulo_publico' 
  | 'cdb' 
  | 'lci' 
  | 'lca' 
  | 'debenture'
  | 'cri'
  | 'cra'
  | 'fidc';

/**
 * Ativo cacheado para sugestões instantâneas
 * Inclui metadata para ordenação por popularidade dinâmica
 */
export interface CachedAsset {
  ticker: string;
  name: string;
  type: AssetType | string;
  emissor?: string;
  lastSearched?: number;   // Timestamp da última busca
  searchCount?: number;    // Frequência de busca (popularidade dinâmica)
}

/**
 * Retorno tipado do hook useSearchCache
 */
export interface UseSearchCacheReturn {
  getInstantSuggestions: (query: string, limit?: number) => CachedAsset[];
  updateCache: (query: string, results: Array<{ code: string; emissor: string; asset_type: string }>) => void;
  clearCache: () => void;
  cachedAssets: CachedAsset[];
  popularAssets: CachedAsset[];
}

/**
 * Lista de ativos populares do mercado brasileiro
 * Usada para mostrar sugestões imediatas antes da primeira busca
 */
const POPULAR_ASSETS: CachedAsset[] = [
  // Ações mais negociadas
  { ticker: 'PETR4', name: 'Petrobras PN', type: 'stock', emissor: 'Petrobras' },
  { ticker: 'VALE3', name: 'Vale ON', type: 'stock', emissor: 'Vale' },
  { ticker: 'ITUB4', name: 'Itaú Unibanco PN', type: 'stock', emissor: 'Itaú Unibanco' },
  { ticker: 'BBDC4', name: 'Bradesco PN', type: 'stock', emissor: 'Bradesco' },
  { ticker: 'ABEV3', name: 'Ambev ON', type: 'stock', emissor: 'Ambev' },
  { ticker: 'WEGE3', name: 'WEG ON', type: 'stock', emissor: 'WEG' },
  { ticker: 'BBAS3', name: 'Banco do Brasil ON', type: 'stock', emissor: 'Banco do Brasil' },
  { ticker: 'RENT3', name: 'Localiza ON', type: 'stock', emissor: 'Localiza' },
  // FIIs populares
  { ticker: 'MXRF11', name: 'Maxi Renda FII', type: 'fii', emissor: 'XP Asset' },
  { ticker: 'XPML11', name: 'XP Malls FII', type: 'fii', emissor: 'XP Asset' },
  { ticker: 'HGLG11', name: 'CSHG Logística FII', type: 'fii', emissor: 'Credit Suisse' },
  { ticker: 'KNRI11', name: 'Kinea Renda Imobiliária', type: 'fii', emissor: 'Kinea' },
  { ticker: 'VISC11', name: 'Vinci Shopping Centers', type: 'fii', emissor: 'Vinci Partners' },
  // Units
  { ticker: 'TAEE11', name: 'Taesa Unit', type: 'unit', emissor: 'Taesa' },
  { ticker: 'SAPR11', name: 'Sanepar Unit', type: 'unit', emissor: 'Sanepar' },
  // ETFs
  { ticker: 'BOVA11', name: 'iShares Ibovespa', type: 'etf', emissor: 'BlackRock' },
  { ticker: 'IVVB11', name: 'iShares S&P 500', type: 'etf', emissor: 'BlackRock' },
  // Títulos públicos populares
  { ticker: 'TESOURO SELIC', name: 'Tesouro Selic 2029', type: 'titulo_publico', emissor: 'Tesouro Nacional' },
  { ticker: 'TESOURO IPCA+', name: 'Tesouro IPCA+ 2035', type: 'titulo_publico', emissor: 'Tesouro Nacional' },
];

const MAX_CACHE_SIZE = 100;
const CACHE_KEY = 'investia_searchCache';
const QUERIES_KEY = 'investia_lastSearchQueries';

/**
 * Hook para gerenciar cache inteligente de sugestões de busca.
 * 
 * - Pré-popula com ativos populares do mercado brasileiro
 * - Armazena últimos resultados de busca no localStorage
 * - Fornece sugestões instantâneas enquanto aguarda servidor
 * 
 * @example
 * const { getInstantSuggestions, updateCache } = useSearchCache();
 * 
 * // Mostrar sugestões imediatas
 * const suggestions = getInstantSuggestions('petr');
 * 
 * // Após receber resposta do servidor
 * updateCache('petr', serverResults);
 */
export function useSearchCache(): UseSearchCacheReturn {
  const [cachedAssets, setCachedAssets] = useLocalStorage<CachedAsset[]>(CACHE_KEY, POPULAR_ASSETS);
  const [lastQueries, setLastQueries] = useLocalStorage<Record<string, CachedAsset[]>>(QUERIES_KEY, {});
  
  // Inicializar cache com ativos populares se estiver vazio
  useEffect(() => {
    if (cachedAssets.length === 0) {
      setCachedAssets(POPULAR_ASSETS);
    }
  }, []);

  /**
   * Calcula score de relevância para ordenação de resultados (Fuzzy Search)
   * 
   * @param asset - Ativo a ser avaliado
   * @param query - Termo de busca normalizado
   * @returns Score de 0-100 (maior = mais relevante)
   * 
   * @example
   * calculateMatchScore({ ticker: 'PETR4', ... }, 'pe')  // → 100 (começa com PE)
   * calculateMatchScore({ ticker: 'PETR4', ... }, 'tr')  // → 60 (contém TR)
   * calculateMatchScore({ ticker: 'VALE3', ... }, 'pe')  // → 0 (sem match)
   */
  const calculateMatchScore = useCallback((asset: CachedAsset, query: string): number => {
    const ticker = asset.ticker.toLowerCase();
    const name = asset.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const emissor = asset.emissor
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') || '';
    
    // Match exato no início do ticker = máxima relevância
    if (ticker.startsWith(query)) return 100;
    
    // Match no início do nome = alta relevância
    if (name.startsWith(query)) return 85;
    
    // Match no início do emissor = boa relevância
    if (emissor.startsWith(query)) return 75;
    
    // Match em qualquer posição do ticker
    if (ticker.includes(query)) return 60;
    
    // Match em qualquer posição do nome
    if (name.includes(query)) return 40;
    
    // Match em qualquer posição do emissor
    if (emissor.includes(query)) return 30;
    
    // Sem match
    return 0;
  }, []);

  /**
   * Busca sugestões instantâneas no cache local com Fuzzy Search
   * Ordena por score de relevância e desempata por frequência
   * 
   * @param query - Termo de busca (mínimo 2 caracteres)
   * @param limit - Número máximo de sugestões (default: 5)
   * @returns Lista de ativos ordenados por relevância
   */
  const getInstantSuggestions = useCallback((query: string, limit = 5): CachedAsset[] => {
    if (!query || query.length < 2) return [];
    
    const normalizedQuery = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    // Primeiro, verificar se já temos resultado cacheado para esta query exata
    const cachedQueryResult = lastQueries[normalizedQuery];
    if (cachedQueryResult) {
      return cachedQueryResult.slice(0, limit);
    }
    
    // Calcular score para cada ativo e filtrar/ordenar
    const scoredAssets = cachedAssets
      .map(asset => ({
        asset,
        score: calculateMatchScore(asset, normalizedQuery)
      }))
      .filter(item => item.score > 0)  // Remover não-matches
      .sort((a, b) => {
        // Ordenar por score (maior primeiro)
        if (b.score !== a.score) return b.score - a.score;
        
        // Desempate: frequência de busca (se disponível)
        const aCount = a.asset.searchCount || 0;
        const bCount = b.asset.searchCount || 0;
        return bCount - aCount;
      })
      .map(item => item.asset);
    
    return scoredAssets.slice(0, limit);
  }, [cachedAssets, lastQueries, calculateMatchScore]);

  /**
   * Atualiza o cache com novos resultados do servidor
   * Incrementa frequência para ativos já existentes
   * 
   * @param query - Query que gerou estes resultados
   * @param results - Resultados do servidor (formato InvestmentCard simplificado)
   */
  const updateCache = useCallback((query: string, results: Array<{
    code: string;
    emissor: string;
    asset_type: string;
  }>) => {
    if (!query || query.length < 2 || !results || results.length === 0) return;
    
    const normalizedQuery = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    const now = Date.now();
    
    // Converter para formato CachedAsset com metadata
    const newAssets: CachedAsset[] = results.slice(0, 10).map(r => ({
      ticker: r.code,
      name: r.emissor,
      type: r.asset_type as AssetType,
      emissor: r.emissor,
      lastSearched: now,
      searchCount: 1
    }));
    
    // Salvar query específica
    setLastQueries(prev => ({
      ...prev,
      [normalizedQuery]: newAssets
    }));
    
    // Merge com cache existente (incrementar frequência se já existe)
    setCachedAssets(prev => {
      const existingMap = new Map(prev.map(a => [a.ticker, a]));
      
      newAssets.forEach(newAsset => {
        const existing = existingMap.get(newAsset.ticker);
        if (existing) {
          // Incrementar frequência e atualizar timestamp
          existingMap.set(newAsset.ticker, {
            ...existing,
            lastSearched: now,
            searchCount: (existing.searchCount || 0) + 1
          });
        } else {
          existingMap.set(newAsset.ticker, newAsset);
        }
      });
      
      // Ordenar por frequência e limitar tamanho
      return Array.from(existingMap.values())
        .sort((a, b) => (b.searchCount || 0) - (a.searchCount || 0))
        .slice(0, MAX_CACHE_SIZE);
    });
  }, [setLastQueries, setCachedAssets]);

  /**
   * Limpa o cache local (útil para logout ou reset)
   */
  const clearCache = useCallback(() => {
    setCachedAssets(POPULAR_ASSETS);
    setLastQueries({});
  }, [setCachedAssets, setLastQueries]);

  return {
    getInstantSuggestions,
    updateCache,
    clearCache,
    cachedAssets,
    popularAssets: POPULAR_ASSETS
  };
}
