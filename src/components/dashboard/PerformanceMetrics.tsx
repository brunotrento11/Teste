import { formatNumber, formatCurrency } from "@/lib/utils";

interface PerformanceMetricsProps {
  amount: number;
  estimatedReturnMin: number;
  estimatedReturnMax: number;
}

export const PerformanceMetrics = ({ 
  amount, 
  estimatedReturnMin, 
  estimatedReturnMax 
}: PerformanceMetricsProps) => {
  const calculateReturn = (months: number, returnRate: number) => {
    const monthlyRate = returnRate / 12 / 100;
    const futureValue = amount * Math.pow(1 + monthlyRate, months);
    return futureValue - amount;
  };

  const avgReturn = (estimatedReturnMin + estimatedReturnMax) / 2;

  const metrics = [
    { period: '3m', months: 3 },
    { period: '6m', months: 6 },
    { period: '12m', months: 12 },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">Rendimento Estimado:</p>
      <div className="grid grid-cols-3 gap-2">
        {metrics.map(({ period, months }) => {
          const estimatedReturn = calculateReturn(months, avgReturn);
          return (
            <div key={period} className="bg-secondary/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">{period}</p>
              <p className="text-sm font-semibold text-emerald-600">
                +{formatCurrency(estimatedReturn)}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Taxa média: {formatNumber(avgReturn)}% a.a.
      </p>
    </div>
  );
};