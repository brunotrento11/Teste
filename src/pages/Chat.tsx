import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const Chat = () => {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Olá! Sou seu assistente de investimentos. Como posso ajudá-lo hoje?",
    },
  ]);
  const [input, setInput] = useState("");

  const suggestions = [
    "Quanto posso investir este mês?",
    "Compare produtos para mim",
    "Explique sobre ações",
    "Como está meu portfólio?",
  ];

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages([...messages, { role: "user", content: input }]);
    setInput("");
    
    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Com base no seu perfil moderado e horizonte de médio prazo (3-5 anos), ações podem fazer parte do seu portfólio, representando 20-30% do total investido. As ações oferecem potencial de retorno maior, mas também mais volatilidade. Gostaria de ver algumas opções adequadas ao seu perfil?",
        },
      ]);
    }, 1000);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-semibold">Assistente de Investimentos</h1>
              <p className="text-xs text-muted-foreground">Powered by IA</p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <Card
              className={`max-w-[80%] p-4 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              {msg.role === "assistant" && i === messages.length - 1 && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-muted">
                  Esta é uma sugestão baseada em IA e dados públicos. Não constitui recomendação de investimento.
                </p>
              )}
            </Card>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="p-4 space-y-2">
          <p className="text-sm text-muted-foreground mb-3">Sugestões:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, i) => (
              <Badge
                key={i}
                variant="outline"
                className="cursor-pointer hover:bg-muted"
                onClick={() => setInput(suggestion)}
              >
                {suggestion}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-card p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Digite sua mensagem..."
            className="flex-1"
          />
          <Button onClick={handleSend} size="icon">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
