import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, TrendingUp, Calendar, Building2, BarChart3, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { roundNumbersInText, formatNumber } from "@/lib/utils";

interface TestResult {
  id: string;
  asset_type: string;
  asset_code: string;
  emissor: string | null;
  data_vencimento: string | null;
  rentabilidade: string | null;
  risk_score: number;
  risk_category: string;
}

type SortField = 'emissor' | 'data_vencimento' | 'rentabilidade' | 'risk_score';
type SortOrder = 'asc' | 'desc';

export default function TestSearch() {
  const [assetType, setAssetType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskLevel, setRiskLevel] = useState<string>("all");
  const [profitabilityType, setProfitabilityType] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('risk_score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<{
    total: number;
    byType: Record<string, number>;
    avgRiskScore: number;
    byRiskCategory: Record<string, number>;
  } | null>(null);

  // Tipos de investimento unificados (sem distinção CVM/ANBIMA)
  const assetTypes = [
    { value: "all", label: "Todos os tipos" },
    { value: "cri", label: "CRI" },
    { value: "cra", label: "CRA" },
    { value: "debenture", label: "Debêntures" },
    { value: "titulo_publico", label: "Títulos Públicos" },
    { value: "fidc", label: "FIDC" },
    { value: "fundo", label: "Fundos" },
    { value: "letras_financeiras", label: "Letras Financeiras" },
  ];

  const riskLevels = [
    { value: "all", label: "Todos os níveis" },
    { value: "Conservador", label: "Baixo (Conservador)" },
    { value: "Moderado", label: "Médio (Moderado)" },
    { value: "Arrojado", label: "Alto (Arrojado)" },
  ];

  const profitabilityTypes = [
    { value: "all", label: "Todos os tipos" },
    { value: "prefixado", label: "Prefixado" },
    { value: "ipca", label: "Pós-fixado (IPCA)" },
    { value: "cdi", label: "Pós-fixado (CDI)" },
  ];

  const sortOptions = [
    { value: "emissor", label: "Emissor" },
    { value: "data_vencimento", label: "Vencimento" },
    { value: "rentabilidade", label: "Rentabilidade" },
    { value: "risk_score", label: "Risco" },
  ];

  // Mapear tipo selecionado para asset_types do banco (inclui CVM e ANBIMA)
  const getAssetTypeFilters = (type: string): string[] => {
    const typeMap: Record<string, string[]> = {
      'cri': ['cri_cra', 'cvm_cri'],
      'cra': ['cri_cra', 'cvm_cra'],
      'debenture': ['debenture', 'cvm_debenture'],
      'titulo_publico': ['titulo_publico'],
      'fidc': ['fidc'],
      'fundo': ['fundo'],
      'letras_financeiras': ['letras_financeiras'],
    };
    return typeMap[type] || [];
  };

  // Detectar tipo de rentabilidade a partir do texto
  const detectProfitabilityType = (rentabilidade: string | null): string => {
    if (!rentabilidade) return 'unknown';
    const lower = rentabilidade.toLowerCase();
    if (lower.includes('ipca') || lower.includes('igp')) return 'ipca';
    if (lower.includes('cdi') || lower.includes('di')) return 'cdi';
    if (lower.includes('%') && !lower.includes('ipca') && !lower.includes('cdi') && !lower.includes('di')) {
      // Se tem % mas não tem indexador, provavelmente é prefixado
      if (lower.includes('a.a') || lower.match(/^\d+[,.]?\d*\s*%/)) return 'prefixado';
    }
    return 'unknown';
  };

  // Formatar tipo de ativo para exibição (unificado)
  const formatAssetType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'cri_cra': 'CRI/CRA',
      'cvm_cri': 'CRI',
      'cvm_cra': 'CRA',
      'debenture': 'Debênture',
      'cvm_debenture': 'Debênture',
      'fidc': 'FIDC',
      'letras_financeiras': 'Letra Financeira',
      'fundo': 'Fundo',
      'titulo_publico': 'Título Público'
    };
    return typeMap[type] || type;
  };

  // Formatar rentabilidade para exibição (com arredondamento)
  const formatRentabilidade = (rentabilidade: string | null, assetType: string): string => {
    if (rentabilidade && rentabilidade !== 'Consultar') {
      return roundNumbersInText(rentabilidade);
    }
    
    // Retornar informação baseada no tipo de ativo quando não há dados específicos
    if (assetType.includes('titulo_publico')) {
      return 'Taxa Selic ou IPCA+';
    }
    if (assetType.includes('cdi') || assetType === 'letras_financeiras') {
      return 'CDI + spread';
    }
    
    return 'Verificar prospecto';
  };

  const executeSearch = async () => {
    setIsLoading(true);
    try {
      console.log("🔍 Busca - Tipo:", assetType, "Risco:", riskLevel, "Rent:", profitabilityType);

      const today = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('anbima_asset_risk_scores')
        .select('*');

      // Filtro por tipo (busca em múltiplos asset_types)
      if (assetType && assetType !== "all") {
        const assetTypeFilters = getAssetTypeFilters(assetType);
        if (assetTypeFilters.length > 0) {
          query = query.in('asset_type', assetTypeFilters);
        }
      }

      // Filtro por nível de risco
      if (riskLevel && riskLevel !== "all") {
        query = query.eq('risk_category', riskLevel);
      }

      // Filtro por texto
      if (searchQuery) {
        query = query.or(`asset_code.ilike.%${searchQuery}%,emissor.ilike.%${searchQuery}%`);
      }

      // Apenas ativos não vencidos
      query = query.or(`data_vencimento.gte.${today},data_vencimento.is.null`);

      const { data, error } = await query;

      if (error) {
        console.error("❌ Erro na busca:", error);
        toast.error("Erro ao executar busca");
        return;
      }

      // Filtrar por tipo de rentabilidade no cliente (não há campo específico no banco)
      let filteredData = data || [];
      if (profitabilityType && profitabilityType !== "all") {
        filteredData = filteredData.filter(item => {
          const detectedType = detectProfitabilityType(item.rentabilidade);
          return detectedType === profitabilityType;
        });
      }

      console.log(`✅ Encontrados ${filteredData.length} resultados`);
      setResults(filteredData);

      // Calcular estatísticas
      if (filteredData.length > 0) {
        const byType = filteredData.reduce((acc, item) => {
          const formattedType = formatAssetType(item.asset_type);
          acc[formattedType] = (acc[formattedType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const byRiskCategory = filteredData.reduce((acc, item) => {
          acc[item.risk_category] = (acc[item.risk_category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const avgRiskScore = filteredData.reduce((sum, item) => sum + item.risk_score, 0) / filteredData.length;

        setStats({
          total: filteredData.length,
          byType,
          avgRiskScore: Math.round(avgRiskScore * 10) / 10,
          byRiskCategory,
        });

        toast.success(`${filteredData.length} ativos encontrados`);
      } else {
        setStats(null);
        toast.info("Nenhum ativo encontrado");
      }
    } catch (error) {
      console.error("❌ Erro ao executar busca:", error);
      toast.error("Erro ao executar busca");
    } finally {
      setIsLoading(false);
    }
  };

  // Ordenar resultados
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'emissor':
          comparison = (a.emissor || '').localeCompare(b.emissor || '');
          break;
        case 'data_vencimento':
          const dateA = a.data_vencimento ? new Date(a.data_vencimento).getTime() : 0;
          const dateB = b.data_vencimento ? new Date(b.data_vencimento).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case 'rentabilidade':
          comparison = (a.rentabilidade || '').localeCompare(b.rentabilidade || '');
          break;
        case 'risk_score':
          comparison = a.risk_score - b.risk_score;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [results, sortField, sortOrder]);

  const getRiskColor = (score: number): string => {
    if (score <= 7) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    if (score <= 14) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    return 'bg-red-500/10 text-red-700 border-red-500/20';
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Teste de Busca de Investimentos</h1>
          <p className="text-muted-foreground mt-2">
            Valide a busca em todos os tipos de investimentos com diferentes filtros
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtros de Busca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Linha 1: Tipo, Risco, Rentabilidade */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Investimento</label>
                <Select value={assetType} onValueChange={setAssetType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nível de Risco</label>
                <Select value={riskLevel} onValueChange={setRiskLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o risco" />
                  </SelectTrigger>
                  <SelectContent>
                    {riskLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Rentabilidade</label>
                <Select value={profitabilityType} onValueChange={setProfitabilityType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a rentabilidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {profitabilityTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 2: Busca, Ordenação, Botão */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Busca Livre</label>
                <Input
                  placeholder="Código ou emissor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ordenar por</label>
                <div className="flex gap-2">
                  <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={toggleSortOrder}
                    title={sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
                  >
                    <ArrowUpDown className={`h-4 w-4 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                  </Button>
                </div>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={executeSearch} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Executar Busca
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Risco Médio</p>
                    <p className="text-2xl font-bold">{stats.avgRiskScore}/20</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Por Tipo</p>
                  <div className="space-y-1">
                    {Object.entries(stats.byType).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-xs">
                        <span className="truncate">{type}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Por Categoria</p>
                  <div className="space-y-1">
                    {Object.entries(stats.byRiskCategory).map(([category, count]) => (
                      <div key={category} className="flex justify-between text-xs">
                        <span>{category}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Resultados */}
        <Card>
          <CardHeader>
            <CardTitle>
              Resultados ({results.length})
              {results.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  Ordenado por {sortOptions.find(o => o.value === sortField)?.label} ({sortOrder === 'asc' ? '↑' : '↓'})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Buscando investimentos...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum resultado. Execute uma busca usando os filtros acima.
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {sortedResults.map((result) => (
                  <Card key={result.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          {/* Header */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {formatAssetType(result.asset_type)}
                            </Badge>
                            <span className="font-mono text-sm text-muted-foreground">
                              {result.asset_code}
                            </span>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div className="flex items-start gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-muted-foreground">Emissor</p>
                                <p className="font-medium truncate">{result.emissor || 'N/A'}</p>
                              </div>
                            </div>

                            {result.data_vencimento && (
                              <div className="flex items-start gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-muted-foreground">Vencimento</p>
                                  <p className="font-medium">
                                    {new Date(result.data_vencimento).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="flex items-start gap-1">
                              <TrendingUp className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-muted-foreground">Rentabilidade</p>
                                <p className="font-medium truncate">
                                  {formatRentabilidade(result.rentabilidade, result.asset_type)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-1">
                              <BarChart3 className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-muted-foreground">Risco</p>
                                <Badge variant="outline" className={getRiskColor(result.risk_score)}>
                                  {result.risk_score}/20 - {result.risk_category}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
