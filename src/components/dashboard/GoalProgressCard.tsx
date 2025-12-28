import { Card } from "@/components/ui/card";
import { ProgressBar } from "./ProgressBar";
import { RocketAnimation } from "./RocketAnimation";
import { Badge } from "@/components/ui/badge";

interface GoalProgressCardProps {
  currentAmount: number;
  goalAmount: number;
  goalTimeframe: number;
  financialGoal: string;
  averageReturn: number;
}

export const GoalProgressCard = ({
  currentAmount,
  goalAmount,
  goalTimeframe,
  financialGoal,
  averageReturn,
}: GoalProgressCardProps) => {
  // Calcular projeção: FV = PV * (1 + r)^n
  const monthlyRate = averageReturn / 12 / 100;
  const projectedValue = currentAmount * Math.pow(1 + monthlyRate, goalTimeframe);
  const monthsNeeded = currentAmount > 0 && averageReturn > 0
    ? Math.log(goalAmount / currentAmount) / Math.log(1 + monthlyRate)
    : Infinity;

  // Status do objetivo
  const progressPercentage = (currentAmount / goalAmount) * 100;
  const isOnTrack = monthsNeeded <= goalTimeframe;
  const willReachGoal = projectedValue >= goalAmount;

  const statusConfig = {
    badge: willReachGoal 
      ? { variant: 'default' as const, label: '🟢 No Prazo', className: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30' }
      : isOnTrack
      ? { variant: 'secondary' as const, label: '🟡 Atenção', className: 'bg-amber-500/20 text-amber-600 border-amber-500/30' }
      : { variant: 'destructive' as const, label: '🔴 Atrasado', className: 'bg-red-500/20 text-red-600 border-red-500/30' }
  };

  const yearsNeeded = Math.ceil(monthsNeeded / 12);
  const remainingMonths = Math.ceil(monthsNeeded);

  return (
    <Card className="p-6 bg-gradient-to-br from-background to-secondary/20 border-border/50">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Seu Objetivo
            </h3>
            <p className="text-sm text-muted-foreground">{financialGoal}</p>
          </div>
          <RocketAnimation />
        </div>

        {/* Progress Bar */}
        <ProgressBar 
          current={currentAmount}
          target={goalAmount}
        />

        {/* Projection */}
        <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Projeção em {goalTimeframe} meses:</span>
            <Badge variant={statusConfig.badge.variant} className={statusConfig.badge.className}>
              {statusConfig.badge.label}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Valor projetado:</span>
              <span className="text-lg font-bold text-primary">
                R$ {projectedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            
            {willReachGoal ? (
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Excedente:</span>
                <span className="text-sm font-semibold text-emerald-600">
                  +R$ {(projectedValue - goalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Faltam:</span>
                <span className="text-sm font-semibold text-amber-600">
                  R$ {(goalAmount - projectedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Tempo estimado */}
          {!willReachGoal && monthsNeeded < Infinity && (
            <div className="pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                Com a rentabilidade atual, você atingirá sua meta em aproximadamente{' '}
                <span className="font-semibold text-foreground">
                  {yearsNeeded > 1 ? `${yearsNeeded} anos` : `${remainingMonths} meses`}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Info adicional */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>💡</span>
          <span>
            {willReachGoal
              ? 'Parabéns! Você está no caminho certo para atingir seu objetivo.'
              : 'Considere aumentar seus aportes ou diversificar seus investimentos.'}
          </span>
        </div>
      </div>
    </Card>
  );
};