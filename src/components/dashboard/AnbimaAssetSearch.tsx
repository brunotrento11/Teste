import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssetSearchResult {
  id: string;
  code: string;
  name: string;
  type: 'titulo_publico' | 'debenture' | 'cri_cra' | 'fidc' | 'letra_financeira' | 'fundo';
  displayName: string;
  taxa_indicativa?: number;
  data_referencia?: string;
}

interface AnbimaAssetSearchProps {
  onSelectAsset: (asset: AssetSearchResult) => void;
}

export function AnbimaAssetSearch({ onSelectAsset }: AnbimaAssetSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.length >= 3) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [searchQuery]);

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const searchTerm = searchQuery.toUpperCase();
      const allResults: AssetSearchResult[] = [];

      // Buscar em Títulos Públicos
      const { data: titulos } = await supabase
        .from('anbima_titulos_publicos')
        .select('codigo_isin, tipo_titulo, taxa_indicativa, data_referencia')
        .or(`codigo_isin.ilike.%${searchTerm}%,tipo_titulo.ilike.%${searchTerm}%`)
        .order('data_referencia', { ascending: false })
        .limit(10);

      if (titulos) {
        titulos.forEach(item => {
          allResults.push({
            id: item.codigo_isin,
            code: item.codigo_isin,
            name: item.tipo_titulo,
            type: 'titulo_publico',
            displayName: `${item.tipo_titulo} - ${item.codigo_isin}`,
            taxa_indicativa: item.taxa_indicativa,
            data_referencia: item.data_referencia,
          });
        });
      }

      // Buscar em Debêntures
      const { data: debentures } = await supabase
        .from('anbima_debentures')
        .select('codigo_ativo, emissor, taxa_indicativa, data_referencia')
        .or(`codigo_ativo.ilike.%${searchTerm}%,emissor.ilike.%${searchTerm}%`)
        .order('data_referencia', { ascending: false })
        .limit(10);

      if (debentures) {
        debentures.forEach(item => {
          allResults.push({
            id: item.codigo_ativo,
            code: item.codigo_ativo,
            name: item.emissor,
            type: 'debenture',
            displayName: `${item.emissor} - ${item.codigo_ativo}`,
            taxa_indicativa: item.taxa_indicativa,
            data_referencia: item.data_referencia,
          });
        });
      }

      // Buscar em CRI/CRA
      const { data: criCra } = await supabase
        .from('anbima_cri_cra')
        .select('codigo_ativo, emissor, tipo_contrato, taxa_indicativa, data_referencia')
        .or(`codigo_ativo.ilike.%${searchTerm}%,emissor.ilike.%${searchTerm}%`)
        .order('data_referencia', { ascending: false })
        .limit(10);

      if (criCra) {
        criCra.forEach(item => {
          allResults.push({
            id: item.codigo_ativo,
            code: item.codigo_ativo,
            name: `${item.tipo_contrato} - ${item.emissor}`,
            type: 'cri_cra',
            displayName: `${item.tipo_contrato} ${item.emissor} - ${item.codigo_ativo}`,
            taxa_indicativa: item.taxa_indicativa,
            data_referencia: item.data_referencia,
          });
        });
      }

      // Buscar em FIDC
      const { data: fidc } = await supabase
        .from('anbima_fidc')
        .select('codigo_b3, nome, taxa_indicativa, data_referencia')
        .or(`codigo_b3.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`)
        .order('data_referencia', { ascending: false })
        .limit(10);

      if (fidc) {
        fidc.forEach(item => {
          allResults.push({
            id: item.codigo_b3,
            code: item.codigo_b3,
            name: item.nome,
            type: 'fidc',
            displayName: `FIDC ${item.nome} - ${item.codigo_b3}`,
            taxa_indicativa: item.taxa_indicativa,
            data_referencia: item.data_referencia,
          });
        });
      }

      // Buscar em Fundos
      const { data: fundos } = await supabase
        .from('anbima_fundos')
        .select('codigo_fundo, razao_social_fundo, nome_comercial_fundo, tipo_fundo')
        .or(`codigo_fundo.ilike.%${searchTerm}%,razao_social_fundo.ilike.%${searchTerm}%,nome_comercial_fundo.ilike.%${searchTerm}%`)
        .limit(10);

      if (fundos) {
        fundos.forEach(item => {
          allResults.push({
            id: item.codigo_fundo,
            code: item.codigo_fundo,
            name: item.razao_social_fundo,
            type: 'fundo',
            displayName: `${item.tipo_fundo} ${item.nome_comercial_fundo || item.razao_social_fundo}`,
          });
        });
      }

      setResults(allResults.slice(0, 20));
    } catch (error) {
      console.error('Erro ao buscar ativos:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const getTypeLabel = (type: AssetSearchResult['type']) => {
    const labels = {
      titulo_publico: 'Título Público',
      debenture: 'Debênture',
      cri_cra: 'CRI/CRA',
      fidc: 'FIDC',
      letra_financeira: 'Letra Financeira',
      fundo: 'Fundo',
    };
    return labels[type];
  };

  const getTypeColor = (type: AssetSearchResult['type']) => {
    const colors = {
      titulo_publico: 'bg-green-100 text-green-800',
      debenture: 'bg-blue-100 text-blue-800',
      cri_cra: 'bg-purple-100 text-purple-800',
      fidc: 'bg-orange-100 text-orange-800',
      letra_financeira: 'bg-yellow-100 text-yellow-800',
      fundo: 'bg-pink-100 text-pink-800',
    };
    return colors[type];
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar ativos ANBIMA (código, emissor, nome...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {isSearching && (
        <div className="text-center text-sm text-muted-foreground py-4">
          Buscando ativos...
        </div>
      )}

      {results.length > 0 && (
        <Card className="p-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-2">
            {results.map((result) => (
              <div
                key={`${result.type}-${result.id}`}
                className="flex items-center justify-between p-3 hover:bg-accent rounded-lg cursor-pointer transition-colors"
                onClick={() => onSelectAsset(result)}
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{result.displayName}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getTypeColor(result.type)} variant="secondary">
                      {getTypeLabel(result.type)}
                    </Badge>
                    {result.taxa_indicativa && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {result.taxa_indicativa.toFixed(2)}% a.a.
                      </span>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="ghost">
                  Adicionar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {searchQuery.length >= 3 && results.length === 0 && !isSearching && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Nenhum ativo encontrado para "{searchQuery}"
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Tente buscar por código ISIN, código do ativo ou nome do emissor
          </p>
        </Card>
      )}
    </div>
  );
}
