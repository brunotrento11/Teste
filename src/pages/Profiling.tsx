import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type QuestionType = {
  id: string;
  question: string;
  description?: string;
  explanation?: (answers: Record<string, string>) => string | null;
  options?: { label: string; value: string; points: number; description?: string }[];
  inputType?: "currency" | "number";
  inputLabel?: string;
  inputSuffix?: string;
  shouldShow?: (answers: Record<string, string>) => boolean;
};

const allQuestions: QuestionType[] = [
  {
    id: "experience",
    question: "Qual é sua experiência com investimentos?",
    options: [
      { label: "Nunca investi", value: "beginner", points: 1 },
      { label: "Já investi em renda fixa", value: "basic", points: 2 },
      { label: "Invisto regularmente em diversos produtos", value: "intermediate", points: 3 },
      { label: "Tenho experiência avançada em mercado financeiro", value: "advanced", points: 4 },
    ],
  },
  {
    id: "knowledge",
    question: "Qual é seu nível de conhecimento sobre termos financeiros?",
    description: "Termos como: rentabilidade, liquidez, volatilidade, diversificação",
    options: [
      { label: "Não conheço esses termos", value: "none", points: 1 },
      { label: "Já ouvi falar, mas não sei bem o que significa", value: "basic", points: 2 },
      { label: "Entendo o básico", value: "intermediate", points: 3 },
      { label: "Tenho conhecimento técnico", value: "advanced", points: 4 },
    ],
  },
  {
    id: "goal",
    question: "Qual é seu principal objetivo financeiro?",
    options: [
      { label: "Ter dinheiro guardado para emergências", value: "emergency", points: 1 },
      { label: "Juntar dinheiro para usar quando quiser", value: "freedom", points: 2 },
      { label: "Comprar um carro ou moto", value: "vehicle", points: 3 },
      { label: "Comprar uma casa ou apartamento", value: "property", points: 4 },
      { label: "Juntar um valor específico", value: "custom", points: 2 },
    ],
  },
  {
    id: "vehicleAmount",
    question: "Quanto vai custar o carro ou moto que você quer comprar?",
    inputType: "currency",
    inputLabel: "Valor do veículo (R$)",
    shouldShow: (answers) => answers.goal === "vehicle",
  },
  {
    id: "propertyAmount",
    question: "Quanto vai custar a casa ou apartamento que você quer comprar?",
    inputType: "currency",
    inputLabel: "Valor do imóvel (R$)",
    shouldShow: (answers) => answers.goal === "property",
  },
  {
    id: "customAmount",
    question: "Quanto você quer juntar?",
    inputType: "currency",
    inputLabel: "Valor desejado (R$)",
    shouldShow: (answers) => answers.goal === "custom",
  },
  {
    id: "emergencyAmount",
    question: "Quanto você quer ter guardado para emergências?",
    description: "Recomendamos guardar de 3 a 6 meses de suas despesas mensais",
    inputType: "currency",
    inputLabel: "Valor desejado (R$)",
    shouldShow: (answers) => answers.goal === "emergency",
  },
  {
    id: "freedomAmount",
    question: "Quanto você quer ter de liberdade financeira?",
    description: "Qual valor você considera ideal para ter liberdade?",
    inputType: "currency",
    inputLabel: "Valor desejado (R$)",
    shouldShow: (answers) => answers.goal === "freedom",
  },
  {
    id: "timeframe",
    question: "Em quanto tempo você pretende juntar esse dinheiro?",
    inputType: "number",
    inputLabel: "Prazo",
    inputSuffix: "meses",
    shouldShow: (answers) => 
      answers.goal === "vehicle" || 
      answers.goal === "property" || 
      answers.goal === "custom" ||
      answers.goal === "emergency" ||
      answers.goal === "freedom",
  },
  {
    id: "liquidity",
    question: "Com que frequência você acha que vai precisar do dinheiro?",
    shouldShow: (answers) => answers.goal === "freedom",
    options: [
      { label: "A qualquer momento, preciso ter acesso rápido", value: "immediate", points: 1 },
      { label: "Talvez em alguns meses", value: "fewmonths", points: 2 },
      { label: "Provavelmente não vou precisar logo", value: "notsoon", points: 3 },
      { label: "Só em caso de real emergência", value: "emergency", points: 4 },
    ],
  },
  {
    id: "risk",
    question: "Como você reagiria se seu investimento perdesse valor?",
    explanation: (answers) => {
      if (answers.knowledge === "none" || answers.knowledge === "basic") {
        return "Exemplo prático: imagine que você investiu R$ 1.000. Se perder 20%, seu investimento valerá R$ 800. Isso pode acontecer temporariamente em alguns tipos de investimento.";
      }
      return null;
    },
    options: [
      { 
        label: "Ficaria muito preocupado e venderia tudo", 
        value: "panic", 
        points: 1,
        description: "Prefiro não arriscar meu dinheiro"
      },
      { 
        label: "Ficaria preocupado e pensaria em vender", 
        value: "worried", 
        points: 2,
        description: "Não gosto de ver perdas"
      },
      { 
        label: "Manteria e esperaria melhorar", 
        value: "hold", 
        points: 3,
        description: "Entendo que é temporário"
      },
      { 
        label: "Aproveitaria para investir mais", 
        value: "buy", 
        points: 4,
        description: "Vejo oportunidade na queda"
      },
    ],
  },
  {
    id: "amount",
    question: "Quanto você pode investir mensalmente?",
    options: [
      { label: "Menos de R$ 500", value: "low", points: 1 },
      { label: "R$ 500 a R$ 2.000", value: "medium", points: 2 },
      { label: "R$ 2.000 a R$ 5.000", value: "high", points: 3 },
      { label: "Mais de R$ 5.000", value: "veryhigh", points: 4 },
    ],
  },
  {
    id: "investmentTypes",
    question: "Quais tipos de investimento você já conhece ou tem interesse?",
    description: "Selecione a opção que melhor descreve sua familiaridade",
    shouldShow: (answers) => 
      answers.experience === "intermediate" || 
      answers.experience === "advanced",
    options: [
      { label: "Poupança e CDB", value: "conservative", points: 1 },
      { label: "Tesouro Direto e fundos de renda fixa", value: "moderate", points: 2 },
      { label: "Ações e fundos imobiliários", value: "growth", points: 3 },
      { label: "Criptomoedas e derivativos", value: "aggressive", points: 4 },
    ],
  },
  {
    id: "rebalancing",
    question: "Com que frequência você pretende acompanhar seus investimentos?",
    shouldShow: (answers) => 
      answers.experience === "intermediate" || 
      answers.experience === "advanced",
    options: [
      { label: "Raramente, prefiro deixar quieto", value: "rarely", points: 1 },
      { label: "A cada 6 meses ou 1 ano", value: "yearly", points: 2 },
      { label: "Mensalmente", value: "monthly", points: 3 },
      { label: "Semanalmente ou diariamente", value: "frequently", points: 4 },
    ],
  },
];

const Profiling = () => {
  const navigate = useNavigate();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [points, setPoints] = useState<number[]>([]);
  const [questionPath, setQuestionPath] = useState<QuestionType[]>([allQuestions[0]]);
  const [inputValue, setInputValue] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [inputError, setInputError] = useState(false);

  const currentQuestion = questionPath[currentQuestionIndex];
  // Estima o total de perguntas baseado nas respostas até agora
  const estimatedTotalQuestions = allQuestions.filter(q => 
    !q.shouldShow || q.shouldShow(answers)
  ).length;
  const progress = ((currentQuestionIndex + 1) / estimatedTotalQuestions) * 100;

  const getNextQuestion = (currentAnswers: Record<string, string>): QuestionType | null => {
    const answeredIds = new Set(Object.keys(currentAnswers));
    
    for (const question of allQuestions) {
      if (answeredIds.has(question.id)) continue;
      
      if (!question.shouldShow || question.shouldShow(currentAnswers)) {
        return question;
      }
    }
    
    return null;
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "";
    const formatted = new Intl.NumberFormat("pt-BR").format(parseInt(numbers));
    return formatted;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (currentQuestion.inputType === "currency") {
      const numbers = value.replace(/\D/g, "");
      setInputValue(numbers);
      setDisplayValue(formatCurrency(value));
    } else if (currentQuestion.inputType === "number") {
      const numbers = value.replace(/\D/g, "");
      setInputValue(numbers);
      setDisplayValue(numbers);
    } else {
      setInputValue(value);
      setDisplayValue(value);
    }
  };

  const handleAnswer = (value: string, answerPoints: number) => {
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    const newPoints = [...points, answerPoints];
    
    setAnswers(newAnswers);
    setPoints(newPoints);
    setInputValue("");
    setDisplayValue("");
    setInputError(false);

    const nextQuestion = getNextQuestion(newAnswers);
    
    if (nextQuestion) {
      setQuestionPath([...questionPath, nextQuestion]);
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Finaliza o questionário e vai para adicionar investimentos
      const totalPoints = newPoints.reduce((a, b) => a + b, 0);
      let profile = "conservador";
      if (totalPoints >= 15) profile = "arrojado";
      else if (totalPoints >= 10) profile = "moderado";
      
      navigate("/add-investments", { state: { profile, totalPoints, answers: newAnswers } });
    }
  };

  const handleInputSubmit = () => {
    if (!inputValue || inputValue.trim() === "") return;
    
    // Para inputs numéricos, calculamos pontos baseado no valor
    let points = 2; // pontos padrão
    if (currentQuestion.inputType === "number") {
      const months = parseInt(inputValue);
      if (months < 12) points = 1;
      else if (months < 36) points = 2;
      else if (months < 60) points = 3;
      else points = 4;
    }
    
    handleAnswer(inputValue, points);
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      // Remove a última pergunta do caminho
      const newPath = questionPath.slice(0, -1);
      const lastQuestionId = questionPath[currentQuestionIndex].id;
      
      // Remove a resposta da pergunta atual
      const newAnswers = { ...answers };
      delete newAnswers[lastQuestionId];
      
      // Remove os pontos
      const newPoints = points.slice(0, -1);
      
      setQuestionPath(newPath);
      setAnswers(newAnswers);
      setPoints(newPoints);
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl p-6 py-8">
        <div className="mb-8">
          <h1 className="text-fluid-3xl font-bold">Vamos conhecer você melhor</h1>
          <p className="mt-2 text-muted-foreground">
            Estas perguntas nos ajudam a recomendar investimentos adequados ao seu
            perfil. Responda com sinceridade - não há respostas certas ou erradas.
          </p>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="mt-2 text-fluid-sm text-muted-foreground">
              Pergunta {currentQuestionIndex + 1} de {estimatedTotalQuestions}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-fluid-2xl font-semibold mb-4">{currentQuestion.question}</h2>
            {currentQuestion.description && (
              <p className="text-muted-foreground mb-4 text-fluid-sm">{currentQuestion.description}</p>
            )}
            {currentQuestion.explanation && (
              <>
                {currentQuestion.explanation(answers) && (
                  <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="text-sm text-foreground">
                      💡 {currentQuestion.explanation(answers)}
                    </p>
                  </div>
                )}
              </>
            )}
            
            {currentQuestion.inputType ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="input-value">{currentQuestion.inputLabel}</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="input-value"
                      type="text"
                      placeholder={currentQuestion.inputType === "currency" ? "Ex: 10.000" : "Ex: 24"}
                      value={displayValue}
                      onChange={handleInputChange}
                      className="flex-1"
                    />
                    {currentQuestion.inputSuffix && (
                      <span className="flex items-center px-3 border rounded-md bg-muted text-muted-foreground">
                        {currentQuestion.inputSuffix}
                      </span>
                    )}
                  </div>
                </div>
                <Button 
                  onClick={handleInputSubmit} 
                  className="w-full"
                  disabled={!inputValue || inputValue.trim() === ""}
                >
                  Continuar
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {currentQuestion.options?.map((option) => (
                  <Card
                    key={option.value}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary"
                    onClick={() => handleAnswer(option.value, option.points)}
                  >
                    <div className="p-4">
                      <p className="font-medium">{option.label}</p>
                      {option.description && (
                        <p className="text-fluid-sm text-muted-foreground mt-1">{option.description}</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {currentQuestionIndex > 0 && (
            <Button variant="outline" onClick={handleBack} className="w-full">
              Voltar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profiling;
