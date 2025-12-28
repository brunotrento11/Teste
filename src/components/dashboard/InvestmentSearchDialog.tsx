import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, TrendingUp, Calendar, Building2, Droplet, AlertCircle, Search, Heart, X, Filter, Info, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFilterPreferences, FilterPreferences } from "@/hooks/useFilterPreferences";
import { useSearchCache } from "@/hooks/useSearchCache";
import { useAdaptiveDebounce } from "@/hooks/useAdaptiveDebounce";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatAssetYield, getYieldFilterType, type UnifiedAssetYield } from "@/lib/yieldUtils";

interface SearchFilters {
  searchQuery?: string;
  type?: string;
  assetType?: string;
  assetTypes?: string[];  // Array de tipos para modo simples
  institution?: string;
  riskFilter?: 'low' | 'medium' | 'high';      // Filtro de risco do modo simples
  maturityFilter?: '1y' | '3y' | '5y+';        // Filtro de vencimento do modo simples
  incomeFilter?: boolean;                       // Flag para filtrar títulos com cupom (objetivo 'income')
}

interface InvestmentCard {
  id: string;
  type: string;
  code: string;
  emissor: string;
  data_vencimento: string | null;
  maturity_date_raw: string | null;
  rentabilidade: string;
  rentabilidadeTooltip?: string;
  isMarketRate: boolean;
  liquidez: string;
  risk_score: number;
  risk_category: string;
  risk_color: string;
  asset_id: string;
  asset_type: string;
  yield_profile?: string;
  contract_spread_percent?: number | null;
}

interface InvestmentSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SearchFilters;
  onSelectAsset: (asset: InvestmentCard) => void;
}

// Mapear categoria para asset_types na unified_assets
const getAssetTypes = (assetType?: string): string[] => {
  if (!assetType) return [];
  
  const typeMap: Record<string, string[]> = {
    'cri_cra': ['cri', 'cra'],
    'cri': ['cri'],
    'cra': ['cra'],
    'debenture': ['debenture'],
    'titulo_publico': ['titulo_publico'],
    'fidc': ['fidc'],
    'fundo': ['fundo'],
    'letra_financeira': ['letra_financeira'],
    'letras_financeiras': ['letra_financeira'],
    'stock': ['stock'],
    'fii': ['fii'],
    'etf': ['etf'],
    'bdr': ['bdr'],
    'unit': ['unit'],
    'acao': ['stock'],
    'acoes': ['stock']
  };
  
  return typeMap[assetType.toLowerCase()] || [assetType];
};

const formatAssetType = (type: string): string => {
  const typeMap: Record<string, string> = {
    'cri_cra': 'CRI/CRA',
    'cri': 'CRI',
    'cra': 'CRA',
    'debenture': 'Debênture',
    'fidc': 'FIDC',
    'letras_financeiras': 'Letra Financeira',
    'letra_financeira': 'Letra Financeira',
    'fundo': 'Fundo',
    'titulo_publico': 'Título Público',
    'stock': 'Ação',
    'fii': 'FII',
    'etf': 'ETF',
    'bdr': 'BDR',
    'unit': 'Unit'
  };
  return typeMap[type] || type;
};

const getLiquidez = (assetType: string, liquidez?: string | null): string => {
  if (liquidez) return liquidez;
  
  if (['cri_cra', 'debenture', 'fidc', 'cri', 'cra'].includes(assetType)) {
    return 'No vencimento';
  }
  if (assetType === 'titulo_publico') {
    return 'Diária';
  }
  if (assetType === 'fundo') {
    return 'Conforme regulamento';
  }
  if (['stock', 'fii', 'etf', 'bdr', 'unit'].includes(assetType)) {
    return 'D+2';
  }
  return 'Consultar';
};

const getRiskColor = (score: number): string => {
  if (score <= 7) return 'green';
  if (score <= 14) return 'yellow';
  return 'red';
};

const getRiskBars = (score: number) => {
  const filled = Math.ceil((score / 20) * 5);
  return Array.from({ length: 5 }, (_, i) => i < filled);
};

const PAGE_SIZE = 100;

export function InvestmentSearchDialog({ 
  open, 
  onOpenChange, 
  filters,
  onSelectAsset 
}: InvestmentSearchDialogProps) {
  const [results, setResults] = useState<InvestmentCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [internalSearch, setInternalSearch] = useState('');
  const [savePopoverOpen, setSavePopoverOpen] = useState(false);
  
  // Estados de paginação
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
const scrollContainerRef = useRef<HTMLDivElement>(null);
const [showScrollTop, setShowScrollTop] = useState(false);

  const { 
    preferences, 
    setPreferences, 
    hasSavedPreference, 
    savePreferences, 
    isAuthenticated 
  } = useFilterPreferences(filters.assetType);

  // Cache para atualizar com resultados do servidor
  const { updateCache } = useSearchCache();

  // Hook de debounce adaptativo para registrar latência das requisições
  const { recordLatency, currentDelay, p75Latency, p90Latency } = useAdaptiveDebounce(internalSearch, {
    minDelay: 150,
    maxDelay: 300,
    initialDelay: 250
  });

  // Flag para mostrar métricas de debug apenas em desenvolvimento
  const SHOW_DEBUG_METRICS = import.meta.env.DEV;

  // Função de busca com paginação
  const searchAssets = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const startTime = performance.now();
      const currentPage = isLoadMore ? page + 1 : 0;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      console.log(`🔍 Buscando ativos (página ${currentPage}, range ${from}-${to}):`, filters);

      const today = new Date().toISOString().split('T')[0];
      
      // Priorizar assetTypes (array do modo simples) sobre assetType (string do modo avançado)
      let assetTypesToSearch: string[] = [];
      if (filters.assetTypes && filters.assetTypes.length > 0) {
        assetTypesToSearch = filters.assetTypes;
      } else if (filters.assetType) {
        assetTypesToSearch = getAssetTypes(filters.assetType);
      }

      // Query combinada: dados + count
      let query = supabase
        .from('mv_investment_search')
        .select('*', { count: 'exact' })
        .not('risk_score', 'is', null)
        .range(from, to);

      if (filters.searchQuery) {
        query = query.or(
          `display_name.ilike.%${filters.searchQuery}%,issuer.ilike.%${filters.searchQuery}%,asset_code.ilike.%${filters.searchQuery}%`
        );
      }

      // CASO ESPECIAL: objetivo 'income' precisa filtrar títulos públicos por tipo (com cupom)
      if (filters.incomeFilter && assetTypesToSearch.includes('titulo_publico')) {
        const titulosComCupom = ['NTN-B', 'NTN-C', 'NTN-F'];
        const tituloConditions = titulosComCupom.map(t => `display_name.ilike.${t}%`).join(',');
        query = query.or(`asset_type.eq.fii,and(asset_type.eq.titulo_publico,or(${tituloConditions}))`);
      } else if (assetTypesToSearch.length > 0) {
        const typeConditions = assetTypesToSearch.map(type => `asset_type.eq.${type}`).join(',');
        query = query.or(typeConditions);
      }

      // Filtro de risco do modo simples (server-side)
      if (filters.riskFilter) {
        if (filters.riskFilter === 'low') {
          query = query.lte('risk_score', 7);
        } else if (filters.riskFilter === 'medium') {
          query = query.gt('risk_score', 7).lte('risk_score', 14);
        } else if (filters.riskFilter === 'high') {
          query = query.gt('risk_score', 14);
        }
      }

      // Filtro de vencimento do modo simples (server-side)
      if (filters.maturityFilter) {
        const now = new Date();
        let maturityLimit: Date | null = null;
        
        if (filters.maturityFilter === '1y') {
          maturityLimit = new Date(now.setFullYear(now.getFullYear() + 1));
        } else if (filters.maturityFilter === '3y') {
          maturityLimit = new Date(now.setFullYear(now.getFullYear() + 3));
        }
        
        if (maturityLimit) {
          query = query.lte('maturity_date', maturityLimit.toISOString().split('T')[0]);
        }
      }

      query = query.or(`maturity_date.gte.${today},maturity_date.is.null`);
      query = query.order('risk_score', { ascending: true });

      const { data, error, count } = await query;
      
      // Registrar latência da requisição para ajuste adaptativo do debounce
      const latency = performance.now() - startTime;
      recordLatency(latency);
      console.log(`⏱️ Latência da busca: ${Math.round(latency)}ms`);

      if (error) {
        console.error("❌ Erro na query:", error);
        toast.error("Erro ao buscar investimentos");
        return;
      }

      console.log(`✅ Encontrados ${data?.length || 0} ativos (total: ${count})`);

      // Transformar usando campos estruturados
      const investmentResults: InvestmentCard[] = (data || []).map(item => {
        const assetYield: UnifiedAssetYield = {
          asset_type: item.asset_type,
          yield_profile: item.yield_profile,
          contract_indexer: item.contract_indexer,
          contract_spread_percent: item.contract_spread_percent,
          contract_rate_type: item.contract_rate_type,
          market_rate_indicative_percent: item.market_rate_indicative_percent,
          dividend_yield: item.dividend_yield,
          profitability: item.profitability,
          price_change_percent: null
        };
        
        const yieldDisplay = formatAssetYield(assetYield);
        
        return {
          id: item.id,
          type: formatAssetType(item.asset_type || ''),
          code: item.asset_code || '',
          emissor: item.issuer || item.display_name || 'N/A',
          data_vencimento: item.maturity_date 
            ? new Date(item.maturity_date).toLocaleDateString('pt-BR') 
            : null,
          maturity_date_raw: item.maturity_date,
          rentabilidade: yieldDisplay.headline,
          rentabilidadeTooltip: yieldDisplay.tooltip,
          isMarketRate: yieldDisplay.isMarketRate,
          liquidez: getLiquidez(item.asset_type || '', item.liquidity),
          risk_score: item.risk_score || 10,
          risk_category: item.risk_category || 'Moderado',
          risk_color: getRiskColor(item.risk_score || 10),
          asset_id: item.source_id || item.id,
          asset_type: item.asset_type || '',
          yield_profile: item.yield_profile,
          contract_spread_percent: item.contract_spread_percent
        };
      });

      if (isLoadMore) {
        setResults(prev => [...prev, ...investmentResults]);
        setPage(currentPage);
      } else {
        setResults(investmentResults);
        setTotalCount(count || 0);
        setPage(0);
        
        // Atualizar cache com resultados do servidor (apenas primeira página)
        if (filters.searchQuery && investmentResults.length > 0) {
          updateCache(
            filters.searchQuery,
            investmentResults.map(r => ({
              code: r.code,
              emissor: r.emissor,
              asset_type: r.asset_type
            }))
          );
        }
      }

      // Verificar se há mais páginas
      const totalLoaded = isLoadMore ? (page + 1) * PAGE_SIZE + investmentResults.length : investmentResults.length;
      setHasMore(totalLoaded < (count || 0));

      if (!isLoadMore && investmentResults.length === 0) {
        toast.info("Nenhum ativo encontrado com os filtros selecionados");
      }

    } catch (error) {
      console.error("❌ Erro ao buscar ativos:", error);
      toast.error("Erro ao buscar investimentos");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filters.assetTypes, filters.assetType, filters.searchQuery, filters.riskFilter, filters.maturityFilter, filters.incomeFilter, page]);

  // Reset de paginação quando filtros mudam
  useEffect(() => {
    if (open) {
      setPage(0);
      setResults([]);
      setTotalCount(0);
      setHasMore(true);
      setInternalSearch('');
      searchAssets(false);
    }
  }, [open, filters.assetTypes, filters.assetType, filters.searchQuery, filters.riskFilter, filters.maturityFilter, filters.incomeFilter]);

  // Scroll infinito e botão voltar ao topo
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;
      
      // Mostrar botão "Voltar ao topo" após rolar 400px
      setShowScrollTop(scrollTop > 400);
      
      if (isNearBottom && hasMore && !isLoadingMore && !isLoading) {
        searchAssets(true);
      }
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [searchAssets, hasMore, isLoadingMore, isLoading]);

  // Função para voltar ao topo
  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Classificar tipo de rentabilidade usando campos estruturados
  const getProfitabilityType = (asset: InvestmentCard): string => {
    // Usar yield_profile estruturado se disponível
    if (asset.yield_profile) {
      const profile = asset.yield_profile.toUpperCase();
      if (profile === 'POS_CDI' || profile === 'POS_SELIC') return 'cdi';
      if (profile === 'HIBRIDO_IPCA' || profile === 'HIBRIDO_IGPM') return 'ipca';
      if (profile === 'PREFIXADO') return 'prefixado';
      if (profile === 'VARIAVEL') return 'variavel';
    }
    
    // Fallback para tipo de ativo
    const type = asset.asset_type?.toLowerCase() || '';
    if (['stock', 'fii', 'etf', 'bdr'].some(t => type.includes(t))) return 'variavel';
    if (type.includes('fundo')) return 'fundos';
    
    return 'outro';
  };

  // Aplicar filtros client-side
  const filteredResults = useMemo(() => {
    return results
      .filter(asset => {
        if (internalSearch) {
          const search = internalSearch.toLowerCase();
          if (!asset.emissor?.toLowerCase().includes(search) &&
              !asset.code?.toLowerCase().includes(search) &&
              !asset.type?.toLowerCase().includes(search)) {
            return false;
          }
        }
        
        if (preferences.riskFilter !== 'all') {
          const score = asset.risk_score || 0;
          if (preferences.riskFilter === 'low' && score > 7) return false;
          if (preferences.riskFilter === 'medium' && (score <= 7 || score > 14)) return false;
          if (preferences.riskFilter === 'high' && score <= 14) return false;
        }
        
        if (preferences.profitabilityFilter !== 'all') {
          const profType = getProfitabilityType(asset);
          if (preferences.profitabilityFilter === 'cdi' && profType !== 'cdi') return false;
          if (preferences.profitabilityFilter === 'ipca' && profType !== 'ipca') return false;
          if (preferences.profitabilityFilter === 'prefixado' && profType !== 'prefixado') return false;
          if (preferences.profitabilityFilter === 'variavel' && profType !== 'variavel') return false;
          if (preferences.profitabilityFilter === 'fundos' && profType !== 'fundos') return false;
        }
        
        if (preferences.maturityFilter !== 'all' && asset.maturity_date_raw) {
          const maturityDate = new Date(asset.maturity_date_raw);
          const today = new Date();
          const diffMonths = (maturityDate.getTime() - today.getTime()) / (30 * 24 * 60 * 60 * 1000);
          
          if (preferences.maturityFilter === '6m' && diffMonths > 6) return false;
          if (preferences.maturityFilter === '1y' && diffMonths > 12) return false;
          if (preferences.maturityFilter === '3y' && (diffMonths <= 12 || diffMonths > 36)) return false;
          if (preferences.maturityFilter === '5y' && (diffMonths <= 36 || diffMonths > 60)) return false;
          if (preferences.maturityFilter === '5y+' && diffMonths <= 60) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        if (preferences.sortBy === 'risk_asc') return (a.risk_score || 0) - (b.risk_score || 0);
        if (preferences.sortBy === 'risk_desc') return (b.risk_score || 0) - (a.risk_score || 0);
        if (preferences.sortBy === 'name') return a.emissor.localeCompare(b.emissor);
        if (preferences.sortBy === 'maturity') {
          if (!a.maturity_date_raw) return 1;
          if (!b.maturity_date_raw) return -1;
          return new Date(a.maturity_date_raw).getTime() - new Date(b.maturity_date_raw).getTime();
        }
        if (preferences.sortBy === 'spread_desc') {
          // Ativos sem spread vão para o final
          const aSpread = a.contract_spread_percent ?? -Infinity;
          const bSpread = b.contract_spread_percent ?? -Infinity;
          return bSpread - aSpread;
        }
        if (preferences.sortBy === 'spread_asc') {
          // Ativos sem spread vão para o final
          const aSpread = a.contract_spread_percent ?? Infinity;
          const bSpread = b.contract_spread_percent ?? Infinity;
          return aSpread - bSpread;
        }
        return 0;
      });
  }, [results, internalSearch, preferences]);

  // Calcular opções disponíveis
  const availableOptions = useMemo(() => {
    const checkOption = (
      filterKey: keyof FilterPreferences,
      value: string,
      asset: InvestmentCard
    ): boolean => {
      if (internalSearch) {
        const search = internalSearch.toLowerCase();
        if (!asset.emissor?.toLowerCase().includes(search) &&
            !asset.code?.toLowerCase().includes(search) &&
            !asset.type?.toLowerCase().includes(search)) {
          return false;
        }
      }
      
      if (filterKey !== 'riskFilter' && preferences.riskFilter !== 'all') {
        const score = asset.risk_score || 0;
        if (preferences.riskFilter === 'low' && score > 7) return false;
        if (preferences.riskFilter === 'medium' && (score <= 7 || score > 14)) return false;
        if (preferences.riskFilter === 'high' && score <= 14) return false;
      }
      
      if (filterKey !== 'profitabilityFilter' && preferences.profitabilityFilter !== 'all') {
        const profType = getProfitabilityType(asset);
        if (preferences.profitabilityFilter === 'cdi' && profType !== 'cdi') return false;
        if (preferences.profitabilityFilter === 'ipca' && profType !== 'ipca') return false;
        if (preferences.profitabilityFilter === 'prefixado' && profType !== 'prefixado') return false;
        if (preferences.profitabilityFilter === 'variavel' && profType !== 'variavel') return false;
        if (preferences.profitabilityFilter === 'fundos' && profType !== 'fundos') return false;
      }
      
      if (filterKey !== 'maturityFilter' && preferences.maturityFilter !== 'all' && asset.maturity_date_raw) {
        const maturityDate = new Date(asset.maturity_date_raw);
        const today = new Date();
        const diffMonths = (maturityDate.getTime() - today.getTime()) / (30 * 24 * 60 * 60 * 1000);
        
        if (preferences.maturityFilter === '6m' && diffMonths > 6) return false;
        if (preferences.maturityFilter === '1y' && diffMonths > 12) return false;
        if (preferences.maturityFilter === '3y' && (diffMonths <= 12 || diffMonths > 36)) return false;
        if (preferences.maturityFilter === '5y' && (diffMonths <= 36 || diffMonths > 60)) return false;
        if (preferences.maturityFilter === '5y+' && diffMonths <= 60) return false;
      }
      
      if (filterKey === 'riskFilter') {
        const score = asset.risk_score || 0;
        if (value === 'low') return score <= 7;
        if (value === 'medium') return score > 7 && score <= 14;
        if (value === 'high') return score > 14;
      }
      
      if (filterKey === 'profitabilityFilter') {
        const profType = getProfitabilityType(asset);
        return profType === value;
      }
      
      if (filterKey === 'maturityFilter') {
        if (!asset.maturity_date_raw) return false;
        const maturityDate = new Date(asset.maturity_date_raw);
        const today = new Date();
        const diffMonths = (maturityDate.getTime() - today.getTime()) / (30 * 24 * 60 * 60 * 1000);
        
        if (value === '6m') return diffMonths <= 6;
        if (value === '1y') return diffMonths <= 12;
        if (value === '3y') return diffMonths > 12 && diffMonths <= 36;
        if (value === '5y') return diffMonths > 36 && diffMonths <= 60;
        if (value === '5y+') return diffMonths > 60;
      }
      
      return true;
    };

    return {
      risk: {
        low: results.some(a => checkOption('riskFilter', 'low', a)),
        medium: results.some(a => checkOption('riskFilter', 'medium', a)),
        high: results.some(a => checkOption('riskFilter', 'high', a))
      },
      profitability: {
        cdi: results.some(a => checkOption('profitabilityFilter', 'cdi', a)),
        ipca: results.some(a => checkOption('profitabilityFilter', 'ipca', a)),
        prefixado: results.some(a => checkOption('profitabilityFilter', 'prefixado', a)),
        variavel: results.some(a => checkOption('profitabilityFilter', 'variavel', a)),
        fundos: results.some(a => checkOption('profitabilityFilter', 'fundos', a))
      },
      maturity: {
        '6m': results.some(a => checkOption('maturityFilter', '6m', a)),
        '1y': results.some(a => checkOption('maturityFilter', '1y', a)),
        '3y': results.some(a => checkOption('maturityFilter', '3y', a)),
        '5y': results.some(a => checkOption('maturityFilter', '5y', a)),
        '5y+': results.some(a => checkOption('maturityFilter', '5y+', a))
      }
    };
  }, [results, internalSearch, preferences]);

  const hasActiveFilters = preferences.riskFilter !== 'all' || 
    preferences.profitabilityFilter !== 'all' || 
    preferences.maturityFilter !== 'all' ||
    preferences.sortBy !== 'risk_asc' ||
    internalSearch !== '';

  const clearFilters = () => {
    setPreferences({
      riskFilter: 'all',
      profitabilityFilter: 'all',
      maturityFilter: 'all',
      sortBy: 'risk_asc'
    });
    setInternalSearch('');
  };

  const handleSavePreferences = async (type: 'specific' | 'global') => {
    const success = await savePreferences(preferences, type);
    if (success) {
      toast.success(type === 'specific' 
        ? `Filtros salvos para ${formatAssetType(filters.assetType || '')}`
        : 'Filtros salvos como padrão global'
      );
    } else {
      toast.error('Erro ao salvar preferências');
    }
    setSavePopoverOpen(false);
  };

  const assetTypeLabel = formatAssetType(filters.assetType || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={scrollContainerRef} className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between gap-4">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Resultados da Busca
          </DialogTitle>
          {SHOW_DEBUG_METRICS && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full font-mono">
              <span>P75: {p75Latency ? `${p75Latency}ms` : 'n/a'}</span>
              <span className="text-muted-foreground/50">|</span>
              <span>P90: {p90Latency ? `${p90Latency}ms` : 'n/a'}</span>
              <span className="text-muted-foreground/50">|</span>
              <span className="text-primary font-semibold">Delay: {currentDelay}ms</span>
            </div>
          )}
        </DialogHeader>

        <TooltipProvider>
        {/* Barra de Filtros */}
        <div className="space-y-4 pb-4 border-b">
          {/* Busca e Coração */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, código ou emissor..."
                value={internalSearch}
                onChange={(e) => setInternalSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {isAuthenticated && (
              <Popover open={savePopoverOpen} onOpenChange={setSavePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className={hasSavedPreference ? 'text-red-500 border-red-200' : ''}
                  >
                    <Heart className={`h-4 w-4 ${hasSavedPreference ? 'fill-current' : ''}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Salvar configuração de filtros</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Os filtros serão carregados automaticamente nas próximas buscas.
                    </p>
                    {filters.assetType && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={() => handleSavePreferences('specific')}
                      >
                        <Heart className="h-4 w-4 mr-2 text-red-500" />
                        Salvar para {assetTypeLabel} apenas
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => handleSavePreferences('global')}
                    >
                      <Heart className="h-4 w-4 mr-2" />
                      Salvar como padrão global
                    </Button>
                    {hasSavedPreference && (
                      <p className="text-xs text-muted-foreground pt-2 border-t">
                        Preferência atual: {hasSavedPreference === 'specific' ? assetTypeLabel : 'Global'}
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Filtro de Risco */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Nível de Risco</label>
            <ToggleGroup 
              type="single" 
              value={preferences.riskFilter}
              onValueChange={(value) => value && setPreferences(prev => ({ ...prev, riskFilter: value as FilterPreferences['riskFilter'] }))}
              className="justify-start flex-wrap"
            >
              <ToggleGroupItem value="all" size="sm" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Todos
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="low" 
                size="sm" 
                disabled={!availableOptions.risk.low}
                className="data-[state=on]:bg-emerald-500 data-[state=on]:text-white disabled:opacity-40"
              >
                🟢 Conservador
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="medium" 
                size="sm"
                disabled={!availableOptions.risk.medium}
                className="data-[state=on]:bg-amber-500 data-[state=on]:text-white disabled:opacity-40"
              >
                🟡 Moderado
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="high" 
                size="sm"
                disabled={!availableOptions.risk.high}
                className="data-[state=on]:bg-red-500 data-[state=on]:text-white disabled:opacity-40"
              >
                🔴 Arrojado
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Filtro de Rentabilidade */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Tipo de Rentabilidade</label>
            <ToggleGroup 
              type="single" 
              value={preferences.profitabilityFilter}
              onValueChange={(value) => value && setPreferences(prev => ({ ...prev, profitabilityFilter: value as FilterPreferences['profitabilityFilter'] }))}
              className="justify-start flex-wrap"
            >
              <ToggleGroupItem value="all" size="sm" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                Todos
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="cdi" 
                size="sm"
                disabled={!availableOptions.profitability.cdi}
                className="data-[state=on]:bg-blue-500 data-[state=on]:text-white disabled:opacity-40"
              >
                Pós-CDI
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="ipca" 
                size="sm"
                disabled={!availableOptions.profitability.ipca}
                className="data-[state=on]:bg-orange-500 data-[state=on]:text-white disabled:opacity-40"
              >
                Pós-IPCA
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="prefixado" 
                size="sm"
                disabled={!availableOptions.profitability.prefixado}
                className="data-[state=on]:bg-purple-500 data-[state=on]:text-white disabled:opacity-40"
              >
                Prefixado
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="variavel" 
                size="sm"
                disabled={!availableOptions.profitability.variavel}
                className="data-[state=on]:bg-green-600 data-[state=on]:text-white disabled:opacity-40"
              >
                Variável
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="fundos" 
                size="sm"
                disabled={!availableOptions.profitability.fundos}
                className="data-[state=on]:bg-teal-500 data-[state=on]:text-white disabled:opacity-40"
              >
                Fundos
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Vencimento e Ordenação */}
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2 min-w-[180px]">
              <label className="text-sm font-medium text-muted-foreground">Vencimento</label>
              <Select 
                value={preferences.maturityFilter}
                onValueChange={(value) => setPreferences(prev => ({ ...prev, maturityFilter: value as FilterPreferences['maturityFilter'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="6m" disabled={!availableOptions.maturity['6m']}>
                    Até 6 meses
                  </SelectItem>
                  <SelectItem value="1y" disabled={!availableOptions.maturity['1y']}>
                    Até 1 ano
                  </SelectItem>
                  <SelectItem value="3y" disabled={!availableOptions.maturity['3y']}>
                    1 a 3 anos
                  </SelectItem>
                  <SelectItem value="5y" disabled={!availableOptions.maturity['5y']}>
                    3 a 5 anos
                  </SelectItem>
                  <SelectItem value="5y+" disabled={!availableOptions.maturity['5y+']}>
                    Mais de 5 anos
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 min-w-[180px]">
              <label className="text-sm font-medium text-muted-foreground">Ordenar por</label>
              <Select 
                value={preferences.sortBy}
                onValueChange={(value) => setPreferences(prev => ({ ...prev, sortBy: value as FilterPreferences['sortBy'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="risk_asc">Menor Risco</SelectItem>
                  <SelectItem value="risk_desc">Maior Risco</SelectItem>
                  <SelectItem value="name">Nome A-Z</SelectItem>
                  <SelectItem value="maturity">Vencimento mais próximo</SelectItem>
                  <SelectItem value="spread_desc">Maior Spread %</SelectItem>
                  <SelectItem value="spread_asc">Menor Spread %</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contador e Limpar Filtros */}
          <div className="flex items-center justify-between pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="text-sm cursor-help">
                  📊 Mostrando {results.length.toLocaleString('pt-BR')} de {totalCount.toLocaleString('pt-BR')} resultados
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {hasMore 
                    ? `Role para carregar mais (${(totalCount - results.length).toLocaleString('pt-BR')} restantes)`
                    : 'Todos os resultados carregados'}
                </p>
              </TooltipContent>
            </Tooltip>
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Resultados */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Buscando investimentos...</span>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhum investimento encontrado</p>
              <p className="text-sm text-muted-foreground mt-2">
                Tente ajustar os filtros de busca
              </p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Limpar todos os filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              {filteredResults.map((result) => (
                <Card key={result.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-3">
                        {/* Header */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {result.type}
                          </Badge>
                          <span className="font-mono text-sm text-muted-foreground truncate">
                            {result.code}
                          </span>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="flex items-start gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Emissor</p>
                              <p className="text-sm font-medium truncate">{result.emissor}</p>
                            </div>
                          </div>

                          {result.data_vencimento && (
                            <div className="flex items-start gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs text-muted-foreground">Vencimento</p>
                                <p className="text-sm font-medium">{result.data_vencimento}</p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-start gap-2">
                            <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">
                                {result.isMarketRate ? 'Taxa indicativa' : 'Rentabilidade'}
                              </p>
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-medium truncate">{result.rentabilidade}</p>
                                {result.rentabilidadeTooltip && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="text-xs">{result.rentabilidadeTooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <Droplet className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground">Liquidez</p>
                              <p className="text-sm font-medium">{result.liquidez}</p>
                            </div>
                          </div>
                        </div>

                        {/* Risk Score */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2 border-t">
                          <span className="text-xs text-muted-foreground">Nível de Risco:</span>
                          <div className="flex gap-0.5 sm:gap-1">
                            {getRiskBars(result.risk_score).map((filled, i) => (
                              <div
                                key={i}
                                className={`h-3 sm:h-4 w-5 sm:w-8 rounded ${
                                  filled
                                    ? result.risk_color === 'green'
                                      ? 'bg-emerald-500'
                                      : result.risk_color === 'yellow'
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                    : 'bg-muted'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-semibold">
                            {result.risk_score}/20
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              result.risk_color === 'green'
                                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                                : result.risk_color === 'yellow'
                                ? 'bg-amber-500/10 text-amber-700 border-amber-500/20'
                                : 'bg-red-500/10 text-red-700 border-red-500/20'
                            }
                          >
                            {result.risk_category}
                          </Badge>
                        </div>
                      </div>

                      {/* Select Button */}
                      <Button
                        onClick={() => {
                          onSelectAsset(result);
                          onOpenChange(false);
                        }}
                        size="sm"
                        className="w-full sm:w-auto shrink-0"
                      >
                        Selecionar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Indicador de carregamento ao rolar */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Carregando mais investimentos...
                  </span>
                </div>
              )}

              {/* Mensagem quando todos foram carregados */}
              {!hasMore && results.length > 0 && !isLoadingMore && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  ✅ Todos os {totalCount.toLocaleString('pt-BR')} investimentos carregados
                </div>
              )}
            </div>
          )}
          
          {/* Botão Voltar ao Topo - sticky para acompanhar o scroll */}
          {showScrollTop && (
            <div className="sticky bottom-4 flex justify-end pointer-events-none">
              <Button
                onClick={scrollToTop}
                size="icon"
                className="rounded-full shadow-lg pointer-events-auto"
                variant="secondary"
              >
                <ArrowUp className="h-5 w-5" />
                <span className="sr-only">Voltar ao topo</span>
              </Button>
            </div>
          )}
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
