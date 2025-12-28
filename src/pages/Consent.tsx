import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Shield, FileText } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const Consent = () => {
  const navigate = useNavigate();
  const [requiredConsents, setRequiredConsents] = useState({
    terms: false,
    privacy: false,
  });
  const [optionalConsents, setOptionalConsents] = useState({
    notifications: false,
    personalization: false,
  });
  const [openSections, setOpenSections] = useState<string[]>([]);

  const canContinue = requiredConsents.terms && requiredConsents.privacy;

  const handleContinue = () => {
    if (canContinue) {
      navigate("/register");
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl p-6 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Sua privacidade é importante</h1>
          <p className="mt-2 text-muted-foreground">
            Leia e aceite os termos para continuar
          </p>
        </div>

        <div className="space-y-4">
          <Collapsible open={openSections.includes("data")}>
            <CollapsibleTrigger
              onClick={() => toggleSection("data")}
              className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="font-semibold">Quais dados coletamos</span>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${
                  openSections.includes("data") ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Nome completo, CPF e data de nascimento</li>
                <li>• E-mail e telefone celular</li>
                <li>• Perfil de investidor e objetivos financeiros</li>
                <li>• Histórico de interações com a plataforma</li>
                <li>• Dados de acesso (IP, dispositivo, localização)</li>
              </ul>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={openSections.includes("usage")}>
            <CollapsibleTrigger
              onClick={() => toggleSection("usage")}
              className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="font-semibold">Como usamos seus dados</span>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${
                  openSections.includes("usage") ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Criar e gerenciar sua conta</li>
                <li>• Personalizar recomendações de investimento</li>
                <li>• Enviar notificações relevantes</li>
                <li>• Melhorar nossos serviços e funcionalidades</li>
                <li>• Cumprir obrigações legais e regulatórias</li>
              </ul>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={openSections.includes("rights")}>
            <CollapsibleTrigger
              onClick={() => toggleSection("rights")}
              className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="font-semibold">Seus direitos (LGPD)</span>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${
                  openSections.includes("rights") ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Acessar e corrigir seus dados a qualquer momento</li>
                <li>• Solicitar portabilidade dos seus dados</li>
                <li>• Revogar consentimentos específicos</li>
                <li>• Excluir permanentemente sua conta e dados</li>
                <li>• Contatar nosso DPO: dpo@investia.com.br</li>
              </ul>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={openSections.includes("sharing")}>
            <CollapsibleTrigger
              onClick={() => toggleSection("sharing")}
              className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="font-semibold">Compartilhamento com terceiros</span>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${
                  openSections.includes("sharing") ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                Não compartilhamos seus dados com terceiros para fins comerciais.
                Dados podem ser compartilhados apenas com:
              </p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>• Provedores de infraestrutura (armazenamento seguro)</li>
                <li>• Autoridades legais quando obrigatório por lei</li>
                <li>• Parceiros de Open Finance (com seu consentimento explícito)</li>
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="mt-8 space-y-4 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Consentimentos Obrigatórios</h3>
          
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={requiredConsents.terms}
              onCheckedChange={(checked) =>
                setRequiredConsents((prev) => ({ ...prev, terms: !!checked }))
              }
            />
            <label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
              Li e aceito os{" "}
              <a href="#" className="text-primary hover:underline">
                Termos de Uso
              </a>{" "}
              da plataforma
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="privacy"
              checked={requiredConsents.privacy}
              onCheckedChange={(checked) =>
                setRequiredConsents((prev) => ({ ...prev, privacy: !!checked }))
              }
            />
            <label htmlFor="privacy" className="text-sm leading-relaxed cursor-pointer">
              Li e aceito a{" "}
              <a href="#" className="text-primary hover:underline">
                Política de Privacidade
              </a>
            </label>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-4">Consentimentos Opcionais</h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="notifications"
                  checked={optionalConsents.notifications}
                  onCheckedChange={(checked) =>
                    setOptionalConsents((prev) => ({
                      ...prev,
                      notifications: !!checked,
                    }))
                  }
                />
                <label htmlFor="notifications" className="text-sm leading-relaxed cursor-pointer">
                  Aceito receber notificações de oportunidades de mercado
                </label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="personalization"
                  checked={optionalConsents.personalization}
                  onCheckedChange={(checked) =>
                    setOptionalConsents((prev) => ({
                      ...prev,
                      personalization: !!checked,
                    }))
                  }
                />
                <label htmlFor="personalization" className="text-sm leading-relaxed cursor-pointer">
                  Aceito compartilhar dados para recomendações personalizadas pela IA
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link to="/" className="flex-1">
            <Button variant="outline" className="w-full">
              Voltar
            </Button>
          </Link>
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            className="flex-1"
          >
            Continuar
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Última atualização: 09 de novembro de 2025
        </p>
      </div>
    </div>
  );
};

export default Consent;
