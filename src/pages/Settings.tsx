import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Type, Eye, Sparkles, RotateCcw, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { settings, updateSettings, resetSettings } = useAccessibility();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate("/login");
  };

  const fontScaleLabels = {
    small: 'Pequeno',
    normal: 'Normal',
    large: 'Grande',
    'extra-large': 'Extra Grande',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-4 p-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-fluid-lg font-semibold">Configurações</h1>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Accessibility Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <h2 className="text-fluid-lg font-semibold">Acessibilidade</h2>
          </div>
          
          <Card className="p-6 space-y-6">
            {/* Minimum Font Size */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-fluid-base font-medium">
                    Tamanho Mínimo da Fonte
                  </Label>
                </div>
                <span className="text-fluid-sm text-muted-foreground font-mono">
                  {settings.minFontSize}px
                </span>
              </div>
              
              <div className="px-1">
                <Slider
                  value={[settings.minFontSize]}
                  onValueChange={([value]) => updateSettings({ minFontSize: value })}
                  min={12}
                  max={24}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between mt-2 text-fluid-xs text-muted-foreground">
                  <span>12px</span>
                  <span>24px</span>
                </div>
              </div>
              
              {/* Preview */}
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-fluid-sm text-muted-foreground mb-1">Prévia:</p>
                <p style={{ fontSize: `${settings.minFontSize}px` }}>
                  Este é um texto de exemplo com o tamanho mínimo selecionado.
                </p>
              </div>
            </div>

            {/* Font Scale */}
            <div className="space-y-3">
              <Label className="text-fluid-base font-medium">
                Escala da Fonte
              </Label>
              <Select
                value={settings.fontScale}
                onValueChange={(value: 'small' | 'normal' | 'large' | 'extra-large') => 
                  updateSettings({ fontScale: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a escala" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="small">Pequeno (87.5%)</SelectItem>
                  <SelectItem value="normal">Normal (100%)</SelectItem>
                  <SelectItem value="large">Grande (112.5%)</SelectItem>
                  <SelectItem value="extra-large">Extra Grande (125%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reduce Motion */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-fluid-base font-medium">
                  Reduzir Animações
                </Label>
                <p className="text-fluid-sm text-muted-foreground">
                  Diminui ou remove animações do app
                </p>
              </div>
              <Switch
                checked={settings.reduceMotion}
                onCheckedChange={(checked) => updateSettings({ reduceMotion: checked })}
              />
            </div>

            {/* High Contrast */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-fluid-base font-medium">
                  Alto Contraste
                </Label>
                <p className="text-fluid-sm text-muted-foreground">
                  Aumenta o contraste das cores
                </p>
              </div>
              <Switch
                checked={settings.highContrast}
                onCheckedChange={(checked) => updateSettings({ highContrast: checked })}
              />
            </div>
          </Card>
        </section>

        {/* Appearance Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-fluid-lg font-semibold">Aparência</h2>
          </div>
          
          <Card className="p-6">
            <p className="text-fluid-sm text-muted-foreground">
              Mais opções de personalização em breve...
            </p>
          </Card>
        </section>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={resetSettings}
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar Configurações Padrão
          </Button>
          
          <Button
            variant="destructive"
            className="w-full justify-start gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sair da Conta
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
