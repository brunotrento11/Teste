import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { TrendingUp, Shield, Brain } from "lucide-react";

const Welcome = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-primary shadow-strong">
              <TrendingUp className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              InvestIA
            </h1>
            <p className="text-xl text-muted-foreground">
              Seu assistente inteligente para investimentos
            </p>
          </div>

          <div className="space-y-4 pt-8">
            <div className="flex items-start gap-3 text-left">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                <Brain className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Recomendações Personalizadas</h3>
                <p className="text-sm text-muted-foreground">
                  IA analisa seu perfil e sugere os melhores investimentos
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-left">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Acompanhamento Completo</h3>
                <p className="text-sm text-muted-foreground">
                  Veja todos seus investimentos em um só lugar
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-left">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold">100% Seguro</h3>
                <p className="text-sm text-muted-foreground">
                  Proteção total dos seus dados conforme LGPD
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-8">
            <Link to="/consent" className="block">
              <Button className="w-full h-12 text-base font-semibold shadow-medium hover:shadow-strong transition-all">
                Começar
              </Button>
            </Link>
            <Link to="/login" className="block">
              <Button variant="ghost" className="w-full">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <footer className="p-6 text-center text-sm text-muted-foreground">
        <p>© 2025 InvestIA. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default Welcome;
