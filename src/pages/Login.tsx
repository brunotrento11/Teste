import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState(""); // E-mail ou CPF
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    identifier: false,
    password: false,
  });

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .substring(0, 14);
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Se contém apenas números ou já está formatado como CPF, formatar
    const numbersOnly = value.replace(/\D/g, "");
    if (numbersOnly.length > 0 && numbersOnly.length <= 11 && !value.includes("@")) {
      setIdentifier(formatCPF(value));
    } else {
      setIdentifier(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors = {
      identifier: !identifier.trim(),
      password: !password,
    };
    
    setErrors(newErrors);
    
    if (Object.values(newErrors).some(error => error)) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios destacados em vermelho.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // Verificar se é CPF ou e-mail
      const isCPF = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(identifier) || /^\d{11}$/.test(identifier);
      
      let email = identifier;
      
      // Se for CPF, buscar o e-mail correspondente
      if (isCPF) {
        const cleanCPF = identifier.replace(/\D/g, "");
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("email, id")
          .eq("cpf", cleanCPF)
          .maybeSingle();

        if (profileError || !profileData) {
          toast({
            title: "CPF não encontrado",
            description: "Não encontramos uma conta com este CPF.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Se o email não estiver na tabela profiles, mostrar mensagem para usar email
        if (!profileData.email) {
          toast({
            title: "Use seu e-mail",
            description: "Por favor, faça login usando seu e-mail cadastrado.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        email = profileData.email;
      }

      // Fazer login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Erro ao fazer login",
          description: error.message.includes("Invalid login credentials") 
            ? "E-mail/CPF ou senha incorretos." 
            : error.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Atualizar o email na tabela profiles se estiver faltando
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", data.user.id)
          .maybeSingle();
        
        if (profile && !profile.email) {
          await supabase
            .from("profiles")
            .update({ email: data.user.email })
            .eq("id", data.user.id);
        }

        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta.",
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Erro ao fazer login:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao fazer login. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Bem-vindo de volta</h1>
          <p className="mt-2 text-muted-foreground">Entre com sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="identifier">
              E-mail ou CPF
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input 
              id="identifier" 
              type="text" 
              placeholder="seu@email.com ou 000.000.000-00"
              value={identifier}
              onChange={(e) => {
                handleIdentifierChange(e);
                setErrors(prev => ({ ...prev, identifier: false }));
              }}
              className={errors.identifier ? "border-red-300 bg-red-50" : ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              Senha
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors(prev => ({ ...prev, password: false }));
              }}
              className={errors.password ? "border-red-300 bg-red-50" : ""}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <Link to="#" className="text-sm text-primary hover:underline">
              Esqueceu a senha?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Não tem uma conta?{" "}
          <Link to="/" className="text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
