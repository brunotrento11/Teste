import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InvestmentObjective } from "./ObjectiveSelector";

export interface ObjectiveFiltersState {
  timeHorizon?: '1-3y' | '3-10y' | '10y+';
  needTime?: '1y' | '3y' | '5y+';
  riskTolerance?: 'low' | 'medium' | 'high';
}

interface ObjectiveFiltersProps {
  objective: InvestmentObjective;
  filters: ObjectiveFiltersState;
  onFiltersChange: (filters: ObjectiveFiltersState) => void;
}

export function ObjectiveFilters({ objective, filters, onFiltersChange }: ObjectiveFiltersProps) {
  // ACCUMULATE: Horizonte temporal (informativo, não filtra ativos de renda variável)
  if (objective === 'accumulate') {
    return (
      <div className="space-y-3 animate-fade-in p-4 bg-muted/50 rounded-lg">
        <Label className="text-foreground">Por quanto tempo pretende investir?</Label>
        <Select 
          value={filters.timeHorizon || ''} 
          onValueChange={(v) => onFiltersChange({ ...filters, timeHorizon: v as ObjectiveFiltersState['timeHorizon'] })}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Selecione o horizonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1-3y">1 a 3 anos</SelectItem>
            <SelectItem value="3-10y">3 a 10 anos</SelectItem>
            <SelectItem value="10y+">Mais de 10 anos</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          💡 Renda variável não tem vencimento fixo - este filtro é apenas para referência.
        </p>
      </div>
    );
  }

  // INCOME: Quando precisa do dinheiro (filtra por maturity)
  if (objective === 'income') {
    return (
      <div className="space-y-3 animate-fade-in p-4 bg-muted/50 rounded-lg">
        <Label className="text-foreground">Quando você precisa do dinheiro?</Label>
        <Select 
          value={filters.needTime || ''} 
          onValueChange={(v) => onFiltersChange({ ...filters, needTime: v as ObjectiveFiltersState['needTime'] })}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Selecione o prazo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1y">Em até 1 ano</SelectItem>
            <SelectItem value="3y">Em até 3 anos</SelectItem>
            <SelectItem value="5y+">Mais de 3 anos</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  // SECURITY: Tolerância ao risco (filtra por risk_category)
  if (objective === 'security') {
    return (
      <div className="space-y-3 animate-fade-in p-4 bg-muted/50 rounded-lg">
        <Label className="text-foreground">Qual sua tolerância ao risco?</Label>
        <RadioGroup
          value={filters.riskTolerance || ''}
          onValueChange={(v) => onFiltersChange({ ...filters, riskTolerance: v as ObjectiveFiltersState['riskTolerance'] })}
          className="flex flex-wrap gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="low" id="risk-low" />
            <Label htmlFor="risk-low" className="cursor-pointer text-foreground">Baixo</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="medium" id="risk-medium" />
            <Label htmlFor="risk-medium" className="cursor-pointer text-foreground">Médio</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="high" id="risk-high" />
            <Label htmlFor="risk-high" className="cursor-pointer text-foreground">Alto</Label>
          </div>
        </RadioGroup>
      </div>
    );
  }

  return null;
}

// Helper: Mapear filtros do objetivo para parâmetros de busca
export function getSearchParamsFromObjectiveFilters(
  objective: InvestmentObjective | null,
  filters: ObjectiveFiltersState
): { maturityFilter?: '1y' | '3y' | '5y+'; riskFilter?: 'low' | 'medium' | 'high' } {
  if (!objective) return {};
  
  // INCOME: needTime -> maturityFilter
  if (objective === 'income' && filters.needTime) {
    return { maturityFilter: filters.needTime };
  }
  
  // SECURITY: riskTolerance -> riskFilter
  if (objective === 'security' && filters.riskTolerance) {
    return { riskFilter: filters.riskTolerance };
  }
  
  // ACCUMULATE: timeHorizon é informativo, não filtra
  return {};
}
