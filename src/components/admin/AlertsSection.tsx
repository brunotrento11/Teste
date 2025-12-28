import { AlertTriangle, AlertCircle, CheckCircle, Info, ChevronDown, XCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

interface AlertItem {
  id: string;
  type: 'critical' | 'success' | 'warning' | 'info';
  message: string;
  highlight?: boolean;
}

interface ValidationResult {
  bdrValidation: {
    total: number;
    validPattern: number;
    withDrMarker: number;
    nullName: number;
  };
  criticalDivergences: {
    bdrsWithoutName: string[];
    invalidPatternBdrs: string[];
  };
  summary: {
    totalAssets: number;
    totalReclassified: number;
    reclassificationSuccessRate: number;
    patternValidRate: number;
    qualityScore: number;
  };
  assetCounts: { asset_type: string; count: number }[];
  status?: "PASSED" | "FAILED";
}

interface ValidationHistoryItem {
  id: string;
  total_assets: number;
  bdrs: number;
  fiis: number;
  stocks: number;
  etfs: number;
  units: number;
  bdrs_with_marker: number;
  critical_divergences: number;
  quality_score: number;
  status: "PASSED" | "FAILED";
}

interface AlertsSectionProps {
  currentValidation: ValidationResult | null;
  previousValidation: ValidationHistoryItem | null;
  isLoading: boolean;
  historyError?: boolean;
}

const alertStyles = {
  critical: 'bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  success: 'bg-green-50/50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  warning: 'bg-yellow-50/50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
  info: 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
};

const alertIcons = {
  critical: <AlertTriangle className="h-4 w-4 shrink-0" />,
  success: <CheckCircle className="h-4 w-4 shrink-0" />,
  warning: <AlertCircle className="h-4 w-4 shrink-0" />,
  info: <Info className="h-4 w-4 shrink-0" />,
};

type AlertLevel = 'critical' | 'warning' | 'info';

const calculateAlertLevel = (current: number, previous: number): { level: AlertLevel; highlight: boolean } => {
  const delta = current - previous;
  const deltaPercent = previous > 0 ? Math.abs(delta / previous) * 100 : 0;
  const absDelta = Math.abs(delta);
  
  // CRÍTICO: |delta| ≥ 10 OU |delta%| ≥ 5%
  if (absDelta >= 10 || deltaPercent >= 5) {
    return { level: 'critical', highlight: deltaPercent > 50 };
  }
  
  // AVISO: |delta| ≥ 1 E 1% ≤ |delta%| < 5%
  if (absDelta >= 1 && deltaPercent >= 1 && deltaPercent < 5) {
    return { level: 'warning', highlight: false };
  }
  
  // INFO: |delta%| < 1% (colapsado por padrão)
  return { level: 'info', highlight: false };
};

const formatDeltaMessage = (name: string, current: number, previous: number): string => {
  const delta = current - previous;
  const deltaPercent = previous > 0 ? ((delta / previous) * 100).toFixed(1) : '0';
  const sign = delta > 0 ? '+' : '';
  const direction = delta > 0 ? 'aumentaram' : 'diminuíram';
  return `${name} ${direction} de ${previous} → ${current} (${sign}${deltaPercent}%)`;
};

const getCountByType = (assetCounts: { asset_type: string; count: number }[], type: string): number => {
  return assetCounts.find(a => a.asset_type === type)?.count || 0;
};

export function AlertsSection({ currentValidation, previousValidation, isLoading, historyError }: AlertsSectionProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  
  if (isLoading) {
    return null;
  }

  const alerts: AlertItem[] = [];
  const infoAlerts: AlertItem[] = [];

  // Edge case: History error
  if (historyError) {
    alerts.push({
      id: 'history-error',
      type: 'warning',
      message: 'Não foi possível carregar histórico de validações',
    });
  }

  // Edge case: No current validation data
  if (!currentValidation) {
    return null;
  }

  // Edge case: Validation FAILED - show critical and stop
  if (currentValidation.status === 'FAILED') {
    return (
      <div 
        className="rounded-lg border border-border/50 bg-card/30 backdrop-blur p-4 mb-6 animate-in fade-in duration-300"
        role="alert"
        aria-live="assertive"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Alertas e Avisos
        </h3>
        <div className={`flex items-start gap-2 px-3 py-2 rounded-md border ${alertStyles.critical} font-bold underline decoration-2`}>
          <XCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">Validação FALHOU - Verifique os dados e tente novamente</span>
        </div>
      </div>
    );
  }

  // Edge case: First execution (no previous validation)
  const isFirstExecution = !previousValidation;

  if (isFirstExecution && !historyError) {
    infoAlerts.push({
      id: 'first-execution',
      type: 'info',
      message: 'Primeira execução - sem dados para comparação com validações anteriores',
    });
  }

  // Edge case: Quality score < 80% (Critical)
  if (currentValidation.summary.qualityScore < 80) {
    alerts.push({
      id: 'quality-critical',
      type: 'critical',
      message: `Score de Qualidade crítico: ${currentValidation.summary.qualityScore}% (mínimo recomendado: 80%)`,
    });
  }

  // Calculate deltas only if we have previous validation
  if (previousValidation) {
    const currentBdrs = getCountByType(currentValidation.assetCounts, 'bdr');
    const currentFiis = getCountByType(currentValidation.assetCounts, 'fii');
    const currentStocks = getCountByType(currentValidation.assetCounts, 'stock');
    const currentEtfs = getCountByType(currentValidation.assetCounts, 'etf');
    const currentUnits = getCountByType(currentValidation.assetCounts, 'unit');

    const deltaChecks = [
      { name: 'BDRs', current: currentBdrs, previous: previousValidation.bdrs },
      { name: 'FIIs', current: currentFiis, previous: previousValidation.fiis },
      { name: 'Stocks', current: currentStocks, previous: previousValidation.stocks },
      { name: 'ETFs', current: currentEtfs, previous: previousValidation.etfs },
      { name: 'Units', current: currentUnits, previous: previousValidation.units },
    ];

    deltaChecks.forEach(({ name, current, previous }) => {
      if (current === previous) {
        infoAlerts.push({
          id: `delta-${name.toLowerCase()}`,
          type: 'info',
          message: `${name}: ${current} (sem mudança)`,
        });
        return;
      }

      const { level, highlight } = calculateAlertLevel(current, previous);
      const message = formatDeltaMessage(name, current, previous);

      if (level === 'info') {
        infoAlerts.push({ id: `delta-${name.toLowerCase()}`, type: 'info', message, highlight });
      } else {
        alerts.push({ id: `delta-${name.toLowerCase()}`, type: level, message, highlight });
      }
    });
  }

  // Known issues warnings
  const bdrsWithoutName = currentValidation.criticalDivergences.bdrsWithoutName.length;
  if (bdrsWithoutName > 0) {
    alerts.push({
      id: 'bdrs-without-name',
      type: 'warning',
      message: `${bdrsWithoutName} BDRs sem nome identificado - Recomendado sincronizar com BRAPI`,
    });
  }

  const invalidPatternBdrs = currentValidation.criticalDivergences.invalidPatternBdrs?.length || 0;
  if (invalidPatternBdrs > 0) {
    alerts.push({
      id: 'invalid-pattern-bdrs',
      type: 'warning',
      message: `${invalidPatternBdrs} BDRs com padrão de ticker inválido`,
    });
  }

  // Success alerts
  if (currentValidation.summary.patternValidRate >= 99) {
    alerts.push({
      id: 'pattern-valid-success',
      type: 'success',
      message: `${currentValidation.summary.patternValidRate.toFixed(1)}% dos BDRs com padrão válido`,
    });
  }

  if (currentValidation.summary.reclassificationSuccessRate === 100) {
    alerts.push({
      id: 'reclassification-success',
      type: 'success',
      message: '100% das reclassificações validadas com sucesso',
    });
  }

  if (currentValidation.summary.qualityScore >= 90) {
    alerts.push({
      id: 'quality-success',
      type: 'success',
      message: `Score de Qualidade excelente: ${currentValidation.summary.qualityScore}%`,
    });
  }

  if (bdrsWithoutName === 0 && invalidPatternBdrs === 0) {
    alerts.push({
      id: 'no-divergences',
      type: 'success',
      message: 'Zero divergências críticas encontradas',
    });
  }

  // Sort alerts: critical → success → warning → info
  const sortOrder = { critical: 0, success: 1, warning: 2, info: 3 };
  alerts.sort((a, b) => sortOrder[a.type] - sortOrder[b.type]);

  if (alerts.length === 0 && infoAlerts.length === 0) {
    return null;
  }

  return (
    <div 
      className="rounded-lg border border-border/50 bg-card/30 backdrop-blur p-4 mb-6 animate-in fade-in duration-300"
      role="alert"
      aria-live="polite"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Alertas e Avisos
      </h3>
      
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start gap-2 px-3 py-2 rounded-md border ${alertStyles[alert.type]} ${
              alert.highlight ? 'font-bold underline decoration-2' : ''
            }`}
          >
            {alert.type === 'critical' && alert.id === 'validation-failed' ? (
              <XCircle className="h-4 w-4 shrink-0" />
            ) : (
              alertIcons[alert.type]
            )}
            <span className="text-sm">{alert.message}</span>
          </div>
        ))}

        {/* Collapsible info section */}
        {infoAlerts.length > 0 && (
          <Collapsible open={isInfoOpen} onOpenChange={setIsInfoOpen}>
            <CollapsibleTrigger className={`flex items-center gap-2 px-3 py-2 rounded-md border w-full text-left ${alertStyles.info} hover:opacity-80 transition-opacity`}>
              <Info className="h-4 w-4 shrink-0" />
              <span className="text-sm flex-1">Detalhes adicionais ({infoAlerts.length} itens)</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isInfoOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1 pl-4">
              {infoAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2 px-3 py-1.5 rounded-md text-sm ${alertStyles.info} border-l-2 border-blue-300 dark:border-blue-700`}
                >
                  <span>{alert.message}</span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
