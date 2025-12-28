import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [cpfError, setCpfError] = useState("");
  const [checkingCPF, setCheckingCPF] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    birthDate: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [passwordError, setPasswordError] = useState("");
  const [errors, setErrors] = useState({
    name: false,
    cpf: false,
    birthDate: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
  });

  const progress = Object.values(formData).filter((val, idx) => idx < 6 && Boolean(val)).length * (100 / 6);

  const validateCPF = (cpf: string): boolean => {
    const cleanCPF = cpf.replace(/\D/g, "");
    
    if (cleanCPF.length !== 11) return false;
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cleanCPF)) return false;
    
    // Extrai os 9 primeiros dígitos
    const digits = cleanCPF.split("").map(Number);
    
    // Calcula o primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }
    let remainder = sum % 11;
    const firstDigit = remainder < 2 ? 0 : 11 - remainder;
    
    // Calcula o segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += digits[i] * (11 - i);
    }
    remainder = sum % 11;
    const secondDigit = remainder < 2 ? 0 : 11 - remainder;
    
    // Verifica se os dígitos calculados conferem
    return digits[9] === firstDigit && digits[10] === secondDigit;
  };

  const handleCPFBlur = async () => {
    if (!formData.cpf) return;
    
    if (!validateCPF(formData.cpf)) {
      setCpfError("CPF inválido");
      return;
    }
    
    // Verificar se CPF já existe no banco
    setCheckingCPF(true);
    const cleanCPF = formData.cpf.replace(/\D/g, "");
    
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('cpf')
      .eq('cpf', cleanCPF)
      .maybeSingle();
    
    setCheckingCPF(false);
    
    if (existingProfile) {
      setCpfError("Este CPF já está em uso");
      toast({
        title: "CPF já cadastrado",
        description: "Este CPF já está registrado no sistema. Tente fazer login.",
        variant: "destructive",
      });
    } else {
      setCpfError("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors = {
      name: !formData.name.trim(),
      cpf: !formData.cpf.trim(),
      birthDate: !formData.birthDate,
      email: !formData.email.trim(),
      phone: !formData.phone.trim(),
      password: !formData.password,
      confirmPassword: !formData.confirmPassword,
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
    
    // Validar senha e confirmação
    if (formData.password !== formData.confirmPassword) {
      setPasswordError("As senhas não coincidem");
      setErrors(prev => ({ ...prev, password: true, confirmPassword: true }));
      return;
    }
    
    if (!validateCPF(formData.cpf)) {
      setCpfError("CPF inválido");
      setErrors(prev => ({ ...prev, cpf: true }));
      return;
    }
    
    // Navegar para tela de verificação
    navigate("/verify", { state: { formData } });
  };

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .substring(0, 14);
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .substring(0, 15);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md p-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Criar Conta</h1>
          <p className="mt-2 text-muted-foreground">
            Preencha seus dados para começar
          </p>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="mt-2 text-sm text-muted-foreground">
              {Math.round(progress)}% completo
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome Completo
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="name"
              placeholder="João Silva"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                setErrors(prev => ({ ...prev, name: false }));
              }}
              className={errors.name ? "border-red-300 bg-red-50" : ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">
              CPF
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="cpf"
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={formData.cpf}
              onChange={(e) => {
                setFormData({ ...formData, cpf: formatCPF(e.target.value) });
                setCpfError("");
                setErrors(prev => ({ ...prev, cpf: false }));
              }}
              onBlur={handleCPFBlur}
              className={cpfError || errors.cpf ? "border-red-300 bg-red-50" : ""}
              required
            />
            {cpfError && (
              <p className="text-sm text-destructive font-medium">{cpfError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">
              Data de Nascimento
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="birthDate"
              type="date"
              value={formData.birthDate}
              onChange={(e) => {
                setFormData({ ...formData, birthDate: e.target.value });
                setErrors(prev => ({ ...prev, birthDate: false }));
              }}
              className={errors.birthDate ? "border-red-300 bg-red-50" : ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              E-mail
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="joao@exemplo.com"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                setErrors(prev => ({ ...prev, email: false }));
              }}
              className={errors.email ? "border-red-300 bg-red-50" : ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Telefone Celular
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              value={formData.phone}
              onChange={(e) => {
                setFormData({ ...formData, phone: formatPhone(e.target.value) });
                setErrors(prev => ({ ...prev, phone: false }));
              }}
              className={errors.phone ? "border-red-300 bg-red-50" : ""}
              required
            />
          </div>

          <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 mt-4">
            <p className="text-sm text-foreground">
              💡 <span className="font-medium">Importante:</span> Certifique-se de ter acesso ao e-mail e telefone informados. 
              Você receberá códigos de confirmação durante o cadastro.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              Senha
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  setPasswordError("");
                  setErrors(prev => ({ ...prev, password: false }));
                }}
                className={errors.password ? "border-red-300 bg-red-50" : ""}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>A senha deve conter:</p>
              <ul className="list-inside list-disc space-y-1">
                <li className={formData.password.length >= 8 ? "text-success" : ""}>
                  Mínimo 8 caracteres
                </li>
                <li className={/[A-Z]/.test(formData.password) ? "text-success" : ""}>
                  Uma letra maiúscula
                </li>
                <li className={/[0-9]/.test(formData.password) ? "text-success" : ""}>
                  Um número
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              Confirmar Senha
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Digite a senha novamente"
              value={formData.confirmPassword}
              onChange={(e) => {
                setFormData({ ...formData, confirmPassword: e.target.value });
                setPasswordError("");
                setErrors(prev => ({ ...prev, confirmPassword: false }));
              }}
              className={passwordError || errors.confirmPassword ? "border-red-300 bg-red-50" : ""}
              required
            />
            {passwordError && (
              <p className="text-sm text-destructive font-medium">{passwordError}</p>
            )}
          </div>

          <Button type="submit" className="w-full">
            Continuar
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Register;
