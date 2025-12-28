import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Re-exportar tipos do módulo de classificação centralizado
export type { InvestmentObjective } from "@/lib/objectiveClassification";
export { getAssetTypesForObjective } from "@/lib/objectiveClassification";

import type { InvestmentObjective } from "@/lib/objectiveClassification";

interface ObjectiveSelectorProps {
  selectedObjective: InvestmentObjective | null;
  onSelectObjective: (objective: InvestmentObjective) => void;
}

const objectives = [
  {
    id: 'accumulate' as const,
    icon: '💰',
    title: 'Acumular Riqueza',
    description: 'Crescimento de patrimônio a longo prazo',
    examples: 'Ações, Units, Fundos, ETFs, BDRs, Debêntures, CRI/CRA',
  },
  {
    id: 'income' as const,
    icon: '📊',
    title: 'Renda Regular',
    description: 'Receber rendimentos periódicos',
    examples: 'FIIs, Units com dividendos, Tesouro com cupom',
  },
  {
    id: 'security' as const,
    icon: '🛡️',
    title: 'Segurança + Ganhos',
    description: 'Preservar capital com rendimento garantido',
    examples: 'Tesouro Direto (LFT, LTN, NTN-B, NTN-F)',
  },
];

export function ObjectiveSelector({ selectedObjective, onSelectObjective }: ObjectiveSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {objectives.map((obj) => (
        <Card
          key={obj.id}
          className={cn(
            "cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-md",
            selectedObjective === obj.id && "border-primary ring-2 ring-primary/20 bg-primary/5"
          )}
          onClick={() => onSelectObjective(obj.id)}
        >
          <CardContent className="p-4 text-center space-y-2">
            <span className="text-4xl block">{obj.icon}</span>
            <h4 className="font-semibold text-foreground">{obj.title}</h4>
            <p className="text-sm text-muted-foreground">{obj.description}</p>
            <p className="text-xs text-muted-foreground/70 italic">{obj.examples}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
