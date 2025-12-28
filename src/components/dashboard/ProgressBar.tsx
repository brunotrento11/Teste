import { Progress } from "@/components/ui/progress";
import { formatNumber, formatCurrency } from "@/lib/utils";

interface ProgressBarProps {
  current: number;
  target: number;
  className?: string;
}

export const ProgressBar = ({ current, target, className = '' }: ProgressBarProps) => {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Progresso</span>
        <span className="font-semibold text-primary">{formatNumber(percentage)}%</span>
      </div>
      <Progress 
        value={percentage} 
        className="h-3 bg-secondary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(current)}</span>
        <span>{formatCurrency(target)}</span>
      </div>
    </div>
  );
};