import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TrendingUp, Shield, Target, AlertCircle, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ProfileResult = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile = "moderado", answers = {}, userInvestments = [] } = location.state || {};
  
  const userKnowledge = answers.knowledge || "basic";
  const isBeginnerFriendly = userKnowledge === "none" || userKnowledge === "basic";

  // Análise de compatibilidade de perfil com investimentos
  const analyzeInvestmentProfile = () => {
    if (userInvestments.length === 0) return null;

    // Contar investimentos por nível de risco
    const riskCounts = {
      conservador: 0,
      moderado: 0,
      arrojado: 0
    };

    userInvestments.forEach((inv: any) => {
      // Buscar o nível de risco baseado no tipo
      const categoryName = inv.category_name || "";
      
      if (categoryName.includes("Poupança") || categoryName.includes("CDB") || 
          categoryName.includes("LCI") || categoryName.includes("LCA") || 
          categoryName.includes("Tesouro") || categoryName.includes("Previdência")) {
        riskCounts.conservador++;
      } else if (categoryName.includes("CRI") || categoryName.includes("CRA") || 
                 categoryName.includes("Debêntures") || categoryName.includes("FII") || 
                 categoryName.includes("Multimercado") || categoryName.includes("ETF")) {
        riskCounts.moderado++;
      } else if (categoryName.includes("Ações") || categoryName.includes("Fundos de Ações")) {
        riskCounts.arrojado++;
      }
    });

    const total = Object.values(riskCounts).reduce((a, b) => a + b, 0);
    const percentages = {
      conservador: (riskCounts.conservador / total) * 100,
      moderado: (riskCounts.moderado / total) * 100,
      arrojado: (riskCounts.arrojado / total) * 100
    };

    // Determinar perfil predominante nos investimentos
    let investmentProfile = "moderado";
    if (percentages.conservador > 60) investmentProfile = "conservador";
    else if (percentages.arrojado > 40) investmentProfile = "arrojado";

    return { investmentProfile, percentages, total, riskCounts };
  };

  const investmentAnalysis = analyzeInvestmentProfile();

  const glossary: Record<string, { simple: string; detailed: string }> = {
    "tolerância a perdas": {
      simple: "O quanto você consegue aceitar ver seu dinheiro diminuir temporariamente",
      detailed: "Imagine que você investiu R$ 1.000. Se o valor cair para R$ 800, você vai vender com medo ou vai esperar? Tolerância a perdas significa o quanto você consegue lidar emocionalmente com essas quedas temporárias sem entrar em pânico."
    },
    "renda fixa": {
      simple: "Investimentos onde você já sabe quanto vai ganhar",
      detailed: "Na renda fixa, você empresta seu dinheiro (para o governo ou bancos) e recebe de volta com juros. É como um empréstimo ao contrário: você é o banco! Exemplos: Tesouro Direto, CDB, poupança. A vantagem é que você já sabe quanto vai ganhar no final."
    },
    "renda variável": {
      simple: "Investimentos onde o valor pode subir ou descer",
      detailed: "Aqui o retorno não é garantido - pode aumentar muito ou diminuir. Você compra uma parte de empresas (ações) ou imóveis (fundos imobiliários), e o valor muda conforme o mercado. Maior potencial de ganho, mas também maior risco."
    },
    "fundos multimercado": {
      simple: "Investimento que mistura vários tipos diferentes",
      detailed: "É como uma cesta variada de investimentos gerenciada por profissionais. Pode ter ações, títulos do governo, moedas estrangeiras, tudo junto. O gestor decide onde investir tentando aproveitar as melhores oportunidades do momento."
    },
    "CDI": {
      simple: "Taxa que serve de referência para investimentos",
      detailed: "CDI (Certificado de Depósito Interbancário) é uma taxa usada pelos bancos entre si. Quando um investimento promete 'X% do CDI', significa que vai render uma porcentagem dessa taxa. Hoje o CDI está em torno de 10-11% ao ano. Se um CDB paga '100% do CDI', significa que rende cerca de 10-11% ao ano."
    },
    "IPCA": {
      simple: "Índice que mede a inflação (aumento de preços)",
      detailed: "IPCA é a inflação oficial do Brasil - quanto os preços subiram em média. Investimentos que pagam 'IPCA + X%' garantem que seu dinheiro vai crescer acima da inflação. Por exemplo, se a inflação foi 4% e seu investimento paga IPCA + 5%, você ganhou 9% no total, mas o ganho 'real' (acima da inflação) foi 5%."
    },
    "Tesouro Direto": {
      simple: "Forma de emprestar dinheiro para o governo brasileiro",
      detailed: "Você empresta dinheiro para o governo e ele te paga de volta com juros. É considerado o investimento mais seguro do Brasil, porque é garantido pelo Tesouro Nacional. Tem várias opções: Selic (liquidez diária), Prefixado (taxa fixa), e IPCA+ (protege da inflação)."
    },
    "liquidez": {
      simple: "Rapidez com que você consegue transformar seu investimento em dinheiro",
      detailed: "Liquidez é a facilidade de resgatar seu dinheiro. Liquidez diária = você pode tirar a qualquer dia. Sem liquidez = seu dinheiro fica 'preso' até uma data específica. Poupança tem liquidez alta, mas alguns CDBs e títulos do Tesouro têm liquidez baixa."
    },
    "volatilidade": {
      simple: "O quanto o valor do seu investimento sobe e desce",
      detailed: "Pense em uma montanha-russa: quanto mais altos e baixos, maior a volatilidade. Investimentos voláteis (como ações) podem valer R$ 1.000 hoje, R$ 800 amanhã e R$ 1.200 na semana que vem. Investimentos com baixa volatilidade (como Tesouro Selic) mudam muito pouco de valor."
    },
    "diversificação": {
      simple: "Não colocar todo o dinheiro no mesmo lugar",
      detailed: "É o famoso 'não colocar todos os ovos na mesma cesta'. Se você divide seu dinheiro entre renda fixa, ações, fundos imobiliários, etc., quando um vai mal, outro pode estar indo bem. Isso reduz seus riscos e deixa seus investimentos mais equilibrados."
    },
    "fundos imobiliários": {
      simple: "Forma de investir em imóveis sem ter que comprar um imóvel inteiro",
      detailed: "Você compra 'pedacinhos' de imóveis (shoppings, prédios comerciais, galpões) junto com outras pessoas. Recebe uma parte do aluguel todo mês como dividendos. É mais acessível que comprar um imóvel inteiro e você pode vender suas cotas na bolsa quando quiser."
    },
  };

  const TermExplainer = ({ term, children }: { term: string; children: React.ReactNode }) => {
    const explanation = glossary[term.toLowerCase()];
    if (!explanation) return <>{children}</>;

    return (
      <Dialog>
        <span className="inline-flex items-center gap-1">
          {children}
          <DialogTrigger asChild>
            <button className="inline-flex items-center text-primary hover:text-primary/80 text-xs ml-1">
              (o que é isso?)
            </button>
          </DialogTrigger>
        </span>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{term}</DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p className="font-medium text-foreground">
                {explanation.simple}
              </p>
              <p className="text-sm">
                {explanation.detailed}
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  };

  const profiles = {
    conservador: {
      color: "bg-success",
      title: "Conservador",
      description:
        "Você prioriza a segurança e a preservação do seu patrimônio, aceitando retornos mais modestos em troca de menor volatilidade.",
      characteristics: [
        { text: "Baixa tolerância a perdas", hasExplanation: true, term: "tolerância a perdas" },
        { text: "Preferência por renda fixa", hasExplanation: true, term: "renda fixa" },
        { text: "Foco em preservação de capital", hasExplanation: false },
        { text: "Investimentos com liquidez", hasExplanation: true, term: "liquidez" },
      ],
      recommendations: [
        { text: "Tesouro Direto (Selic e pré-fixados)", hasExplanation: true, term: "Tesouro Direto" },
        { text: "CDBs de bancos sólidos", hasExplanation: false },
        { text: "Fundos DI", hasExplanation: false },
        { text: "LCIs e LCAs", hasExplanation: false },
      ],
      riskLevel: "Baixo",
    },
    moderado: {
      color: "bg-primary",
      title: "Moderado",
      description:
        "Você busca um equilíbrio entre segurança e rentabilidade, aceitando alguma volatilidade para obter retornos superiores à renda fixa.",
      characteristics: [
        { text: "Tolerância moderada a perdas", hasExplanation: true, term: "tolerância a perdas" },
        { text: "Mix de renda fixa e variável", hasExplanation: true, term: "renda fixa" },
        { text: "Horizonte de médio prazo", hasExplanation: false },
        { text: "Busca diversificação", hasExplanation: true, term: "diversificação" },
      ],
      recommendations: [
        { text: "60-70% em renda fixa", hasExplanation: true, term: "renda fixa" },
        { text: "20-30% em ações e fundos multimercado", hasExplanation: true, term: "fundos multimercado" },
        { text: "10% em fundos imobiliários", hasExplanation: true, term: "fundos imobiliários" },
        { text: "Tesouro IPCA+ para longo prazo", hasExplanation: true, term: "IPCA" },
      ],
      riskLevel: "Médio",
    },
    arrojado: {
      color: "bg-accent",
      title: "Arrojado",
      description:
        "Você está disposto a assumir riscos maiores em busca de retornos superiores, com foco no longo prazo e capacidade de suportar volatilidade.",
      characteristics: [
        { text: "Alta tolerância a perdas", hasExplanation: true, term: "tolerância a perdas" },
        { text: "Foco em renda variável", hasExplanation: true, term: "renda variável" },
        { text: "Horizonte de longo prazo", hasExplanation: false },
        { text: "Busca retornos acima do mercado", hasExplanation: false },
      ],
      recommendations: [
        { text: "40-50% em ações", hasExplanation: true, term: "renda variável" },
        { text: "20-30% em fundos multimercado", hasExplanation: true, term: "fundos multimercado" },
        { text: "20% em fundos imobiliários", hasExplanation: true, term: "fundos imobiliários" },
        { text: "10-20% em renda fixa para liquidez", hasExplanation: true, term: "liquidez" },
      ],
      riskLevel: "Alto",
    },
  };

  const currentProfile = profiles[profile as keyof typeof profiles];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-6 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Badge
              className={`${currentProfile.color} text-white text-lg px-6 py-2`}
            >
              {currentProfile.title}
            </Badge>
          </div>
          <h1 className="text-fluid-3xl font-bold mb-4">Seu Perfil de Investidor</h1>
          <p className="text-fluid-lg text-muted-foreground max-w-2xl mx-auto">
            {currentProfile.description}
          </p>
        </div>

        {/* Alerta de Divergência de Perfil */}
        {investmentAnalysis && investmentAnalysis.investmentProfile !== profile && (
          <Card className="p-6 mb-8 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-500/20">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-fluid-lg mb-2 text-yellow-900 dark:text-yellow-100">
                  Seus investimentos não correspondem ao seu perfil
                </h3>
                <p className="text-fluid-sm text-yellow-800 dark:text-yellow-200 mb-4">
                  Identificamos que sua carteira atual ({investmentAnalysis.total} investimentos) tem características de um perfil{" "}
                  <strong>{investmentAnalysis.investmentProfile}</strong>, mas o questionário indicou que você é{" "}
                  <strong>{profile}</strong>.
                </p>
                <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Distribuição dos seus investimentos:</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Conservadores (Renda Fixa):</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {investmentAnalysis.riskCounts.conservador} ({investmentAnalysis.percentages.conservador.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Moderados (Híbridos):</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {investmentAnalysis.riskCounts.moderado} ({investmentAnalysis.percentages.moderado.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Arrojados (Renda Variável):</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {investmentAnalysis.riskCounts.arrojado} ({investmentAnalysis.percentages.arrojado.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                  <strong>Por que isso importa?</strong> Se você se identificou como {profile} mas seus investimentos são mais{" "}
                  {investmentAnalysis.investmentProfile === "conservador" ? "conservadores" : 
                   investmentAnalysis.investmentProfile === "arrojado" ? "arrojados" : "moderados"}, pode haver um desalinhamento entre:
                </p>
                <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-2 mb-4 ml-4 list-disc">
                  <li>
                    <strong>Sua tolerância ao risco real vs. percebida:</strong> Por exemplo, você pode ter respondido que aceita perdas temporárias de 10%, mas na prática investe 80% em poupança e Tesouro Selic (perfil conservador). Ou o contrário: diz ser conservador mas 60% da carteira está em ações voláteis.
                  </li>
                  <li>
                    <strong>Seus objetivos financeiros atuais vs. históricos:</strong> Talvez você tenha investido há anos com objetivos diferentes dos atuais. Por exemplo, começou investindo para aposentadoria (longo prazo, perfil arrojado) mas agora está juntando para entrada de um imóvel (curto prazo, perfil conservador).
                  </li>
                  <li>
                    <strong>Investimentos feitos sem análise de perfil:</strong> Muitos investimentos podem ter sido feitos por indicação de amigos, "dicas quentes" ou sem considerar seu perfil de risco adequado. Exemplo: comprou ações de empresas X porque "estava na moda" sem avaliar se combina com seu perfil.
                  </li>
                </ul>
                <div className="bg-yellow-100 dark:bg-yellow-900 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                    Qual perfil você realmente deseja seguir?
                  </p>
                  <p className="text-xs text-yellow-800 dark:text-yellow-200 mb-3">
                    Escolha o perfil que melhor representa como você quer investir daqui em diante. Isso afetará as recomendações que você receberá.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={profile === investmentAnalysis.investmentProfile ? "default" : "outline"}
                      onClick={() => {
                        if (profile !== investmentAnalysis.investmentProfile) {
                          navigate("/profile-result", { 
                            state: { 
                              profile: investmentAnalysis.investmentProfile, 
                              answers, 
                              userInvestments,
                              profileChanged: true 
                            } 
                          });
                        }
                      }}
                      className="text-xs"
                    >
                      Seguir minha carteira atual ({investmentAnalysis.investmentProfile})
                    </Button>
                    <Button
                      size="sm"
                      variant={profile !== investmentAnalysis.investmentProfile ? "default" : "outline"}
                      className="text-xs"
                    >
                      Manter perfil do questionário ({profile})
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Características Principais</h3>
                <ul className="space-y-2">
                  {currentProfile.characteristics.map((char, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>
                        {isBeginnerFriendly && char.hasExplanation ? (
                          <TermExplainer term={char.term}>{char.text}</TermExplainer>
                        ) : (
                          char.text
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Investimentos Recomendados</h3>
                <ul className="space-y-2">
                  {currentProfile.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-success mt-1">•</span>
                      <span>
                        {isBeginnerFriendly && rec.hasExplanation ? (
                          <TermExplainer term={rec.term}>{rec.text}</TermExplainer>
                        ) : (
                          rec.text
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <div className="grid md:grid-cols-1 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger/10">
                  <Shield className="h-4 w-4 text-danger" />
                </div>
                <h3 className="font-semibold">Nível de Risco</h3>
              </div>
              <p className="text-sm text-muted-foreground ml-11">
                {currentProfile.riskLevel}
              </p>
            </Card>
          </div>

          <Card className="p-6 bg-muted/50 border-muted">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Este perfil é uma orientação baseada em suas respostas. Você pode
                  investir em produtos de outros perfis, mas recomendamos atenção
                  aos riscos. Rentabilidade passada não garante rentabilidade
                  futura.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            Começar a Investir
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/profiling")}
            className="w-full"
          >
            Refazer Questionário
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileResult;
