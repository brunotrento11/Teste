import { Badge } from "@/components/ui/badge";

type RiskStatus = 'green' | 'yellow' | 'red';

interface RiskBadgeProps {
  status: RiskStatus;
  compatibility: string;
}

export const RiskBadge = ({ status, compatibility }: RiskBadgeProps) => {
  const statusConfig = {
    green: {
      variant: 'default' as const,
      className: 'bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 border-emerald-500/30',
      icon: '🟢',
      label: 'Compatível'
    },
    yellow: {
      variant: 'secondary' as const,
      className: 'bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 border-amber-500/30',
      icon: '🟡',
      label: 'Atenção'
    },
    red: {
      variant: 'destructive' as const,
      className: 'bg-red-500/20 text-red-600 hover:bg-red-500/30 border-red-500/30',
      icon: '🔴',
      label: 'Alto Risco'
    }
  };

  const config = statusConfig[status];

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} transition-colors`}
    >
      <span className="mr-1">{config.icon}</span>
      {compatibility || config.label}
    </Badge>
  );
};