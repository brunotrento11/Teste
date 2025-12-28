import { Card } from "@/components/ui/card";
import { RiskBadge } from "./RiskBadge";
import { PerformanceMetrics } from "./PerformanceMetrics";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface InvestmentRiskCardProps {
  categoryName: string;
  investmentName: string;
  institutionName?: string;
  amount: number;
  estimatedReturnMin: number;
  estimatedReturnMax: number;
  riskStatus?: 'green' | 'yellow' | 'red';
  riskScore?: number;
  compatibility?: string;
  riskMessage?: string;
}

export const InvestmentRiskCard = ({
  categoryName,
  investmentName,
  institutionName,
  amount,
  estimatedReturnMin,
  estimatedReturnMax,
  riskStatus,
  riskScore,
  compatibility,
  riskMessage,
}: InvestmentRiskCardProps) => {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header com categoria e badge de risco */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{categoryName}</p>
            <h4 className="font-semibold text-foreground truncate">{investmentName}</h4>
            {institutionName && (
              <p className="text-xs text-muted-foreground truncate">{institutionName}</p>
            )}
          </div>
          
          {riskStatus && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <RiskBadge status={riskStatus} compatibility={compatibility || ''} />
                    {riskScore && <Info className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </TooltipTrigger>
                {riskMessage && (
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">{riskMessage}</p>
                    {riskScore && (
                      <p className="text-xs mt-1 font-semibold">
                        Score de risco: {riskScore}/20
                      </p>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Valor investido */}
        <div className="bg-secondary/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Valor Investido</p>
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(amount)}
          </p>
        </div>

        {/* Métricas de performance */}
        {estimatedReturnMin > 0 && estimatedReturnMax > 0 && (
          <PerformanceMetrics
            amount={amount}
            estimatedReturnMin={estimatedReturnMin}
            estimatedReturnMax={estimatedReturnMax}
          />
        )}
      </div>
    </Card>
  );
};