import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Mail, Phone, CheckCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Verify = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { formData } = location.state || {};

  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editMode, setEditMode] = useState<"email" | "phone" | null>(null);
  const [editedEmail, setEditedEmail] = useState(formData?.email || "");
  const [editedPhone, setEditedPhone] = useState(formData?.phone || "");

  useEffect(() => {
    if (!formData) {
      navigate("/");
      return;
    }
    // [DEV MODE] Envio de códigos desabilitado para facilitar desenvolvimento
    // sendVerificationCodes();
  }, []);

  const sendVerificationCodes = async () => {
    // [DEV MODE] Envio de códigos desabilitado para facilitar desenvolvimento
    console.log("[DEV MODE] Envio de códigos desabilitado");
    toast({
      title: "Modo Desenvolvimento",
      description: "Envio de códigos desabilitado. Clique em Continuar para prosseguir.",
    });
  };

  const resendCode = async (type: "email" | "phone") => {
    // [DEV MODE] Reenvio de códigos desabilitado para facilitar desenvolvimento
    console.log("[DEV MODE] Reenvio de códigos desabilitado");
    toast({
      title: "Modo Desenvolvimento",
      description: "Reenvio de códigos desabilitado.",
    });
  };

  const verifyCode = async (type: "email" | "phone", code: string) => {
    if (code.length !== 6) {
      toast({
        title: "Código inválido",
        description: "O código deve ter 6 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Verificar código (simulação - em produção, usar edge function)
      // Por enquanto, aceitar qualquer código de 6 dígitos
      if (type === "email") {
        setEmailVerified(true);
        toast({
          title: "Email verificado!",
          description: "Seu email foi verificado com sucesso.",
        });
      } else {
        setPhoneVerified(true);
        toast({
          title: "Telefone verificado!",
          description: "Seu telefone foi verificado com sucesso.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao verificar código",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    // [DEV MODE] Validação de verificação desabilitada para facilitar desenvolvimento
    
    // Criar conta no Supabase Auth
    if (formData) {
      setIsLoading(true);
      
      // Verificar se CPF já existe (limpar formatação para comparar)
      const cleanCPF = formData.cpf.replace(/\D/g, "");
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('cpf')
        .eq('cpf', cleanCPF)
        .maybeSingle();
      
      if (existingProfile) {
        toast({
          title: "CPF já cadastrado",
          description: "Este CPF já está registrado no sistema. Tente fazer login ou use outro CPF.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // Validar e formatar a data de nascimento para o formato ISO
      let birthDateISO = formData.birthDate;
      if (birthDateISO && !birthDateISO.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Se a data não estiver no formato YYYY-MM-DD, tentar converter
        const date = new Date(birthDateISO);
        if (!isNaN(date.getTime())) {
          birthDateISO = date.toISOString().split('T')[0];
        }
      }
      
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            cpf: cleanCPF,
            birth_date: birthDateISO,
            phone: formData.phone,
          },
          emailRedirectTo: `${window.location.origin}/profiling`
        }
      });

      if (error) {
        console.error("Erro detalhado ao criar conta:", error);
        
        // Tratamento de erros mais amigável
        let errorMessage = "Erro ao criar conta. Tente novamente.";
        const errorStr = error.message.toLowerCase();
        
        if (errorStr.includes("already registered") || errorStr.includes("user already registered")) {
          errorMessage = "Este e-mail já está cadastrado. Tente fazer login.";
        } else if (errorStr.includes("duplicate") || errorStr.includes("profiles_cpf_key") || errorStr.includes("database error")) {
          errorMessage = "CPF ou e-mail já cadastrado no sistema.";
        }
        
        toast({
          title: "Erro ao criar conta",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Verificar se a sessão foi estabelecida corretamente
        let sessionEstablished = false;
        let attempts = 0;
        
        while (!sessionEstablished && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            sessionEstablished = true;
          }
          attempts++;
        }
        
        if (!sessionEstablished) {
          toast({
            title: "Erro ao estabelecer sessão",
            description: "Tente fazer login novamente.",
            variant: "destructive",
          });
          setIsLoading(false);
          navigate("/login");
          return;
        }
        
        toast({
          title: "Conta criada com sucesso!",
          description: "Vamos começar a criar seu perfil.",
        });
        setIsLoading(false);
        navigate("/profiling");
      }
    } else {
      navigate("/profiling");
    }
  };

  const saveEdit = (type: "email" | "phone") => {
    setEditMode(null);
    sendVerificationCodes();
  };

  if (!formData) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md p-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Verificar Contato</h1>
          <p className="mt-2 text-muted-foreground">
            Enviamos códigos de verificação para seu email e telefone
          </p>
        </div>

        <div className="space-y-6">
          {/* Email Verification */}
          <Card className={`p-6 ${emailVerified ? "border-success" : ""}`}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${emailVerified ? "bg-success/10" : "bg-primary/10"}`}>
                {emailVerified ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <Mail className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Verificação de Email</h3>
                {editMode === "email" ? (
                  <div className="space-y-2">
                    <Input
                      type="email"
                      value={editedEmail}
                      onChange={(e) => setEditedEmail(e.target.value)}
                      placeholder="novo@email.com"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit("email")} disabled={isLoading}>
                        Salvar e Reenviar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditMode(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">{editedEmail}</p>
                    {!emailVerified && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditMode("email")}
                        className="text-xs"
                      >
                        Alterar email
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            {!emailVerified && editMode !== "email" && (
              <>
                <div className="space-y-2 mb-3">
                  <Label htmlFor="emailCode">Código do Email</Label>
                  <Input
                    id="emailCode"
                    placeholder="000000"
                    maxLength={6}
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => verifyCode("email", emailCode)}
                    disabled={isLoading || emailCode.length !== 6}
                    className="flex-1"
                  >
                    Verificar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resendCode("email")}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
            {emailVerified && (
              <p className="text-sm text-success font-medium">✓ Email verificado com sucesso!</p>
            )}
          </Card>

          {/* Phone Verification */}
          <Card className={`p-6 ${phoneVerified ? "border-success" : ""}`}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${phoneVerified ? "bg-success/10" : "bg-primary/10"}`}>
                {phoneVerified ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <Phone className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Verificação de Telefone</h3>
                {editMode === "phone" ? (
                  <div className="space-y-2">
                    <Input
                      type="tel"
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit("phone")} disabled={isLoading}>
                        Salvar e Reenviar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditMode(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">{editedPhone}</p>
                    {!phoneVerified && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditMode("phone")}
                        className="text-xs"
                      >
                        Alterar telefone
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            {!phoneVerified && editMode !== "phone" && (
              <>
                <div className="space-y-2 mb-3">
                  <Label htmlFor="phoneCode">Código do SMS</Label>
                  <Input
                    id="phoneCode"
                    placeholder="000000"
                    maxLength={6}
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => verifyCode("phone", phoneCode)}
                    disabled={isLoading || phoneCode.length !== 6}
                    className="flex-1"
                  >
                    Verificar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resendCode("phone")}
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
            {phoneVerified && (
              <p className="text-sm text-success font-medium">✓ Telefone verificado com sucesso!</p>
            )}
          </Card>

          <Button
            onClick={handleContinue}
            disabled={isLoading}
            className="w-full"
          >
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Verify;