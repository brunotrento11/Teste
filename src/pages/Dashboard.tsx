import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Search, Bot, PieChart, User, Eye, EyeOff, Bell, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { GoalProgressCard } from "@/components/dashboard/GoalProgressCard";
import { InvestmentRiskCard } from "@/components/dashboard/InvestmentRiskCard";

interface UserInvestment {
  id: string;
  investment_name: string;
  amount: number | null;
  category_id: string;
  institution_id: string;
  investment_categories?: {
    name: string;
    type: string;
    estimated_annual_return_min: number;
    estimated_annual_return_max: number;
  };
  financial_institutions?: {
    short_name: string;
  };
}

interface InvestmentWithRisk extends UserInvestment {
  riskStatus?: 'green' | 'yellow' | 'red';
  riskScore?: number;
  compatibility?: string;
  riskMessage?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  investor_profile: string | null;
  has_investments: boolean;
  financial_goal: string | null;
  goal_amount: number | null;
  goal_timeframe: number | null;
}

const Dashboard = () => {
  const { toast } = useToast();
  const [showBalance, setShowBalance] = useState(true);
  const [investments, setInvestments] = useState<InvestmentWithRisk[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRisks, setIsLoadingRisks] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadUserData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Erro ao carregar perfil:", profileError);
      } else {
        setProfile(profileData);
      }

      if (profileData?.has_investments) {
        const { data: investmentsData, error: investmentsError } = await supabase
          .from("user_investments")
          .select(`
            *,
            investment_categories(name, type, estimated_annual_return_min, estimated_annual_return_max),
            financial_institutions(short_name)
          `)
          .eq("user_id", user.id);

        if (investmentsError) {
          console.error("Erro ao carregar investimentos:", investmentsError);
        } else {
          setInvestments(investmentsData || []);
          
          if (investmentsData && investmentsData.length > 0) {
            loadInvestmentRisks(investmentsData);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadInvestmentRisks = async (investmentsList: UserInvestment[]) => {
    setIsLoadingRisks(true);
    
    const investmentsWithRisks = await Promise.all(
      investmentsList.map(async (investment) => {
        try {
          const { data, error } = await supabase.functions.invoke('evaluate-investment-risk', {
            body: { investment_id: investment.id }
          });

          if (error) {
            return investment;
          }

          if (data?.requires_calculation) {
            // Need to calculate risk indicators and score first
            try {
              // Step 1: Calculate risk indicators
              const { data: indicatorsData, error: indicatorsError } = await supabase.functions.invoke('calculate-risk-indicators', {
                body: { user_investment_id: investment.id }
              });

              if (indicatorsError || !indicatorsData?.success) {
                console.error('Failed to calculate indicators:', indicatorsError);
                return investment;
              }

              // Step 2: Generate risk score using AI
              const { data: scoreData, error: scoreError } = await supabase.functions.invoke('generate-risk-score', {
                body: { 
                  risk_indicators_id: indicatorsData.indicators.id,
                  investment_id: investment.id
                }
              });

              if (scoreError || !scoreData?.success) {
                console.error('Failed to generate score:', scoreError);
                return investment;
              }

              // Step 3: Evaluate investment risk again
              const { data: evalData, error: evalError } = await supabase.functions.invoke('evaluate-investment-risk', {
                body: { investment_id: investment.id }
              });

              if (evalError || !evalData?.success) {
                return investment;
              }

              return {
                ...investment,
                riskStatus: evalData.evaluation.status,
                riskScore: evalData.evaluation.score,
                compatibility: evalData.evaluation.compatibility,
                riskMessage: evalData.evaluation.message,
              };
            } catch (calcError) {
              console.error('Error in calculation workflow:', calcError);
              return investment;
            }
          }

          if (data?.success && data?.evaluation) {
            return {
              ...investment,
              riskStatus: data.evaluation.status,
              riskScore: data.evaluation.score,
              compatibility: data.evaluation.compatibility,
              riskMessage: data.evaluation.message,
            };
          }

          return investment;
        } catch (error) {
          console.error('Error loading risk for investment:', error);
          return investment;
        }
      })
    );

    setInvestments(investmentsWithRisks);
    setIsLoadingRisks(false);
  };

  const totalValue = investments.reduce((acc, inv) => acc + (inv.amount || 0), 0);
  
  const averageReturn = investments.reduce((sum, inv) => {
    const amount = inv.amount || 0;
    const returnMin = inv.investment_categories?.estimated_annual_return_min || 0;
    const returnMax = inv.investment_categories?.estimated_annual_return_max || 0;
    const avgReturn = (returnMin + returnMax) / 2;
    return sum + (amount * avgReturn);
  }, 0) / (totalValue || 1);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-fluid-sm text-muted-foreground">{getGreeting()}</p>
            <h1 className="text-fluid-lg font-semibold">{profile?.full_name || "Usuário"}</h1>
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Balance Card */}
        {profile?.has_investments && investments.length > 0 && (
          <Card className="p-6 bg-gradient-primary text-primary-foreground shadow-strong">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-fluid-sm font-medium opacity-90">Saldo Total Investido</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowBalance(!showBalance)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-fluid-3xl font-bold">
              {showBalance ? `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••••'}
            </p>
          </Card>
        )}

        {/* Goal Progress Card */}
        {profile?.financial_goal && profile?.goal_amount && profile?.goal_timeframe && (
          <GoalProgressCard
            currentAmount={totalValue}
            goalAmount={profile.goal_amount}
            goalTimeframe={profile.goal_timeframe}
            financialGoal={profile.financial_goal}
            averageReturn={averageReturn}
          />
        )}

        {/* Investments Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-fluid-lg font-semibold">Seus Investimentos</h2>
            <Link to="/add-investments">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </Link>
          </div>

          {isLoadingRisks && (
            <div className="text-fluid-sm text-muted-foreground text-center py-2">
              🔍 Analisando riscos dos investimentos...
            </div>
          )}

          {!profile?.has_investments || investments.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-full bg-secondary p-4">
                  <PieChart className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Nenhum investimento cadastrado</h3>
                  <p className="text-fluid-sm text-muted-foreground mb-4">
                    Comece adicionando seus primeiros investimentos
                  </p>
                  <Link to="/add-investments">
                    <Button>Adicionar Investimento</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {investments.map((investment) => (
                <InvestmentRiskCard
                  key={investment.id}
                  categoryName={investment.investment_categories?.name || ''}
                  investmentName={investment.investment_name}
                  institutionName={investment.financial_institutions?.short_name}
                  amount={investment.amount || 0}
                  estimatedReturnMin={investment.investment_categories?.estimated_annual_return_min || 0}
                  estimatedReturnMax={investment.investment_categories?.estimated_annual_return_max || 0}
                  riskStatus={investment.riskStatus}
                  riskScore={investment.riskScore}
                  compatibility={investment.compatibility}
                  riskMessage={investment.riskMessage}
                />
              ))}
            </div>
          )}
        </div>

        {/* Goals Section */}
        {(!profile?.financial_goal || !profile?.goal_amount) && (
          <Card className="p-6 bg-secondary/30">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-accent/20 p-3">
                <span className="text-2xl">🎯</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Defina seus objetivos</h3>
                <p className="text-fluid-sm text-muted-foreground mb-4">
                  Configure suas metas financeiras para acompanhar seu progresso
                </p>
                <Link to="/profiling">
                  <Button variant="outline" size="sm">
                    Configurar Objetivos
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t">
        <div className="flex items-center justify-around py-2 px-4">
          <Link to="/dashboard" className="flex flex-col items-center gap-1 py-2 px-3">
            <Home className="h-5 w-5 text-primary" />
            <span className="text-fluid-xs font-medium text-primary">Início</span>
          </Link>
          <Link to="#" className="flex flex-col items-center gap-1 py-2 px-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <span className="text-fluid-xs text-muted-foreground">Explorar</span>
          </Link>
          <Link to="/add-investments" className="relative -top-4">
            <div className="bg-primary text-primary-foreground rounded-full p-4 shadow-lg">
              <Plus className="h-6 w-6" />
            </div>
          </Link>
          <Link to="/chat" className="flex flex-col items-center gap-1 py-2 px-3">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <span className="text-fluid-xs text-muted-foreground">Chat</span>
          </Link>
          <Link to="/settings" className="flex flex-col items-center gap-1 py-2 px-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <span className="text-fluid-xs text-muted-foreground">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;