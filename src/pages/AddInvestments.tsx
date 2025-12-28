import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, Trash2, Plus, HelpCircle, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { InvestmentSearchDialog } from "@/components/dashboard/InvestmentSearchDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchCache } from "@/hooks/useSearchCache";
import { sanitizeSearchQuery } from "@/lib/utils";
import { ObjectiveSelector, InvestmentObjective, getAssetTypesForObjective } from "@/components/add-investments/ObjectiveSelector";
import { ObjectiveFilters, ObjectiveFiltersState, getSearchParamsFromObjectiveFilters } from "@/components/add-investments/ObjectiveFilters";
import { requiresIncomeSubfilter } from "@/lib/objectiveClassification";

/** Configuração de validação da busca */
const SEARCH_CONFIG = {
  minChars: 2,      // Mínimo para evitar muitos resultados
  maxChars: 50,     // Máximo para prevenir abuso e SQL injection
  debounceMs: 300   // Espera 300ms após usuário parar de digitar
} as const;

interface InvestmentCategory {
  id: string;
  name: string;
  type: string;
  risk_level: string;
  description: string;
  keywords: string[];
  anbima_asset_type?: string | null;
}

interface FinancialInstitution {
  id: string;
  code: string;
  name: string;
  short_name: string;
}

interface UserInvestment {
  id?: string;
  category_id: string;
  category_name?: string;
  institution_id: string;
  institution_name?: string;
  investment_name: string;
  amount?: number;
  asset_id?: string;
  asset_code?: string;
  asset_type?: string;
}

export default function AddInvestments() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, totalPoints, answers } = location.state || {};
  
  const isFromOnboarding = Boolean(profile && answers);

  const [categories, setCategories] = useState<InvestmentCategory[]>([]);
  const [institutions, setInstitutions] = useState<FinancialInstitution[]>([]);
  const [investments, setInvestments] = useState<UserInvestment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedInstitution, setSelectedInstitution] = useState<string>("");
  const [investmentName, setInvestmentName] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [errors, setErrors] = useState({
    selectedCategory: false,
    selectedInstitution: false,
    investmentName: false,
    amount: false,
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [suggestedCategories, setSuggestedCategories] = useState<InvestmentCategory[]>([]);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  
  // Debounce da busca para evitar chamadas excessivas
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_CONFIG.debounceMs);
  
  // Cache inteligente de sugestões
  const { getInstantSuggestions } = useSearchCache();
  
  // Sugestões instantâneas de ativos (aparecem enquanto aguarda servidor)
  const instantAssetSuggestions = searchQuery.length >= SEARCH_CONFIG.minChars 
    ? getInstantSuggestions(searchQuery, 5) 
    : [];
  
  // Detectar quando está digitando (debounce em andamento)
  const isTyping = searchQuery !== debouncedSearchQuery && searchQuery.length >= SEARCH_CONFIG.minChars;
  
  // Estado calculado: busca livre válida (>= 2 chars)
  const hasValidFreeSearch = debouncedSearchQuery.trim().length >= SEARCH_CONFIG.minChars;
  
  const [fieldStates, setFieldStates] = useState({
    categoryEnabled: false,
    searchButtonEnabled: false,
    detailsEnabled: false,
  });
  
  // Botão habilitado se: busca válida OU categoria selecionada
  const isSearchButtonEnabled = hasValidFreeSearch || fieldStates.searchButtonEnabled;

  // Progressive Disclosure: Modo Simples vs Avançado
  const [advancedMode, setAdvancedMode] = useLocalStorage('investia_advancedMode', false);
  const [selectedObjective, setSelectedObjective] = useState<InvestmentObjective | null>(null);
  const [objectiveFilters, setObjectiveFilters] = useState<ObjectiveFiltersState>({});

  // Dados do ativo selecionado
  const [selectedAssetData, setSelectedAssetData] = useState<{
    asset_id: string;
    asset_code: string;
    asset_type: string;
    emissor: string;
    risk_score: number;
  } | null>(null);

  const getGoalData = (profile: string, answers: Record<string, string>) => {
    const goalLabels: Record<string, string> = {
      emergency: "Reserva de emergência",
      freedom: "Liberdade financeira",
      vehicle: "Comprar veículo",
      property: "Comprar imóvel",
      custom: "Valor específico"
    };
    
    let amount = null;
    let timeframe = null;
    
    if (answers.vehicleAmount) amount = parseFloat(answers.vehicleAmount);
    else if (answers.propertyAmount) amount = parseFloat(answers.propertyAmount);
    else if (answers.customAmount) amount = parseFloat(answers.customAmount);
    else if (answers.emergencyAmount) amount = parseFloat(answers.emergencyAmount);
    else if (answers.freedomAmount) amount = parseFloat(answers.freedomAmount);
    
    if (answers.timeframe) timeframe = parseInt(answers.timeframe);
    
    return {
      goal: goalLabels[answers.goal] || null,
      amount,
      timeframe
    };
  };

  useEffect(() => {
    loadCategories();
    loadInstitutions();
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length > 2) {
      handleSearch(searchQuery);
    } else {
      setSuggestedCategories([]);
    }
  }, [searchQuery]);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("investment_categories")
      .select("*")
      .order("name");
    
    if (error) {
      toast.error("Erro ao carregar categorias");
      return;
    }
    setCategories(data || []);
  };

  const loadInstitutions = async () => {
    const { data, error } = await supabase
      .from("financial_institutions")
      .select("*")
      .eq("is_active", true)
      .order("short_name");
    
    if (error) {
      toast.error("Erro ao carregar instituições");
      return;
    }
    setInstitutions(data || []);
  };

  const handleSearch = (query: string) => {
    const lowerQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const matches = categories.filter(cat => {
      const nameMatch = cat.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowerQuery);
      const keywordMatch = cat.keywords?.some(kw => 
        kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowerQuery)
      );
      return nameMatch || keywordMatch;
    });
    setSuggestedCategories(matches.slice(0, 5));
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "";
    const numberValue = parseInt(numbers) / 100;
    return numberValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAmountChange = (value: string) => {
    const formatted = formatCurrency(value);
    setAmount(formatted);
  };

  const handleAssetSelection = (asset: any) => {
    const category = categories.find(c => c.id === selectedCategory);
    setInvestmentName(`${category?.name || asset.type || 'Investimento'} - ${asset.emissor}`);
    
    setSelectedAssetData({
      asset_id: asset.asset_id || asset.id,
      asset_code: asset.code,
      asset_type: asset.asset_type,
      emissor: asset.emissor,
      risk_score: asset.risk_score,
    });
    
    setFieldStates(prev => ({ ...prev, detailsEnabled: true }));
    setShowSearchDialog(false);
    toast.success("Investimento selecionado");
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setFieldStates(prev => ({ ...prev, categoryEnabled: true }));
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setFieldStates(prev => ({ ...prev, searchButtonEnabled: true }));
  };

  // Progressive Disclosure handlers
  const handleObjectiveChange = (objective: InvestmentObjective) => {
    setSelectedObjective(objective);
    setObjectiveFilters({}); // Reset filtros ao mudar objetivo
  };

  const toggleAdvancedMode = () => {
    setAdvancedMode(!advancedMode);
    // Reset estados ao alternar
    if (!advancedMode) {
      // Indo para avançado: resetar objetivo
      setSelectedObjective(null);
      setObjectiveFilters({});
    } else {
      // Indo para simples: resetar dropdowns
      setSelectedType("all");
      setSelectedCategory("");
      setFieldStates({
        categoryEnabled: false,
        searchButtonEnabled: false,
        detailsEnabled: false,
      });
    }
  };

  const addInvestment = () => {
    const newErrors = {
      selectedCategory: !selectedCategory,
      selectedInstitution: !selectedInstitution,
      investmentName: !investmentName.trim(),
      amount: !amount,
    };
    
    setErrors(newErrors);
    
    if (Object.values(newErrors).some(error => error)) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    
    const finalInvestmentName = customName.trim() || investmentName;

    const category = categories.find(c => c.id === selectedCategory);
    const institution = institutions.find(i => i.id === selectedInstitution);
    
    const amountValue = amount ? parseFloat(amount.replace(/\./g, "").replace(",", ".")) : undefined;

    const newInvestment: UserInvestment = {
      category_id: selectedCategory,
      category_name: category?.name,
      institution_id: selectedInstitution,
      institution_name: institution?.short_name,
      investment_name: finalInvestmentName,
      amount: amountValue,
    };

    if (selectedAssetData) {
      newInvestment.asset_id = selectedAssetData.asset_id;
      newInvestment.asset_code = selectedAssetData.asset_code;
      newInvestment.asset_type = selectedAssetData.asset_type;
    }

    setInvestments([...investments, newInvestment]);
    
    // Reset form
    setSelectedType("all");
    setSelectedCategory("");
    setSelectedInstitution("");
    setInvestmentName("");
    setCustomName("");
    setAmount("");
    setSearchQuery("");
    setSuggestedCategories([]);
    setSelectedAssetData(null);
    setFieldStates({
      categoryEnabled: false,
      searchButtonEnabled: false,
      detailsEnabled: false,
    });
    setErrors({
      selectedCategory: false,
      selectedInstitution: false,
      investmentName: false,
      amount: false,
    });
    
    toast.success("Investimento adicionado à lista");
  };

  const removeInvestment = (index: number) => {
    setInvestments(investments.filter((_, i) => i !== index));
    toast.success("Investimento removido");
  };

  const handleContinue = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast.error("Sessão expirada. Por favor, faça login novamente.");
        navigate("/login");
        return;
      }
      
      const user = session.user;

      if (!isFromOnboarding) {
        if (investments.length === 0) {
          toast.error("Adicione pelo menos um investimento");
          return;
        }

        const investmentsToInsert = investments.map(inv => ({
          user_id: user.id,
          category_id: inv.category_id,
          institution_id: inv.institution_id,
          investment_name: inv.investment_name,
          amount: inv.amount,
          notes: inv.asset_code ? `Código: ${inv.asset_code}` : null,
        }));

        const { data: savedInvestments, error } = await supabase
          .from("user_investments")
          .insert(investmentsToInsert)
          .select();

        if (error) {
          toast.error("Erro ao salvar investimentos");
          console.error("Erro ao inserir investimentos:", error);
          return;
        }

        if (savedInvestments && savedInvestments.length > 0) {
          for (let i = 0; i < savedInvestments.length; i++) {
            const originalInv = investments[i];
            if (originalInv?.asset_id && originalInv?.asset_type) {
              try {
                await supabase.functions.invoke('calculate-investment-risk', {
                  body: {
                    investment_id: savedInvestments[i].id,
                    asset_type: originalInv.asset_type,
                    asset_code: originalInv.asset_code,
                  }
                });
              } catch (error) {
                console.error('Erro ao calcular risco:', error);
              }
            }
          }
        }

        toast.success("Investimentos adicionados com sucesso!");
        navigate("/dashboard");
        return;
      }

      // Fluxo de onboarding
      if (investments.length > 0) {
        const investmentsToInsert = investments.map(inv => ({
          user_id: user.id,
          category_id: inv.category_id,
          institution_id: inv.institution_id,
          investment_name: inv.investment_name,
          amount: inv.amount,
          notes: inv.asset_code ? `Código: ${inv.asset_code}` : null,
        }));

        const { data: savedInvestments, error } = await supabase
          .from("user_investments")
          .insert(investmentsToInsert)
          .select();

        if (error) {
          toast.error("Erro ao salvar investimentos");
          console.error("Erro ao inserir investimentos:", error);
          return;
        }

        if (savedInvestments && savedInvestments.length > 0) {
          for (let i = 0; i < savedInvestments.length; i++) {
            const originalInv = investments[i];
            if (originalInv?.asset_id && originalInv?.asset_type) {
              try {
                await supabase.functions.invoke('calculate-investment-risk', {
                  body: {
                    investment_id: savedInvestments[i].id,
                    asset_type: originalInv.asset_type,
                    asset_code: originalInv.asset_code,
                  }
                });
              } catch (error) {
                console.error('Erro ao calcular risco:', error);
              }
            }
          }
        }

        const goalData = getGoalData(profile, answers);
        
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ 
            has_investments: true, 
            investor_profile: profile,
            financial_goal: goalData.goal,
            goal_amount: goalData.amount,
            goal_timeframe: goalData.timeframe
          })
          .eq("id", user.id);

        if (profileError) {
          console.error("Erro ao atualizar perfil:", profileError);
          toast.error("Erro ao atualizar perfil");
          return;
        }

        toast.success("Investimentos salvos com sucesso!");
      } else {
        const goalData = getGoalData(profile, answers);
        
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ 
            has_investments: false, 
            investor_profile: profile,
            financial_goal: goalData.goal,
            goal_amount: goalData.amount,
            goal_timeframe: goalData.timeframe
          })
          .eq("id", user.id);

        if (profileError) {
          console.error("Erro ao atualizar perfil:", profileError);
          toast.error("Erro ao atualizar perfil");
          return;
        }
      }

      navigate("/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/dashboard");
  };

  // Mapear categoria para asset_type da mv_investment_search
  const getAssetTypeFromCategory = (categoryId: string): string | undefined => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return undefined;

    // Mapeamento de categorias para asset_types
    const categoryToAssetType: Record<string, string> = {
      'CRI': 'cri',
      'CRA': 'cra',
      'Debêntures': 'debenture',
      'Debênture': 'debenture',
      'FIDC': 'fidc',
      'Fundos de Investimento': 'fundo',
      'Fundos': 'fundo',
      'Títulos Públicos': 'titulo_publico',
      'Tesouro Direto': 'titulo_publico',
      'Letras Financeiras': 'letra_financeira',
      'LF': 'letra_financeira',
      'Ações': 'stock',
      'FII': 'fii',
      'ETF': 'etf',
      'BDR': 'bdr',
    };

    return categoryToAssetType[category.name] || category.anbima_asset_type || undefined;
  };

  // Categorias sem dados de mercado (entrada manual)
  const categoriesWithoutMarketData = ['CDB', 'LCI', 'LCA', 'Poupança'];
  
  const isCategoryWithoutMarketData = (categoryId: string): boolean => {
    const category = categories.find(c => c.id === categoryId);
    return category ? categoriesWithoutMarketData.includes(category.name) : false;
  };

  // Habilitar entrada manual para categorias sem dados de mercado
  const handleCategoryChangeEnhanced = (value: string) => {
    setSelectedCategory(value);
    
    if (isCategoryWithoutMarketData(value)) {
      // Para CDB/LCI/LCA/Poupança, habilitar entrada manual diretamente
      const category = categories.find(c => c.id === value);
      setInvestmentName(`${category?.name || 'Investimento'}`);
      setFieldStates(prev => ({ 
        ...prev, 
        searchButtonEnabled: false, // Desabilitar busca
        detailsEnabled: true // Habilitar detalhes diretamente
      }));
      toast.info(`${category?.name} não está disponível para busca. Preencha os dados manualmente.`);
    } else {
      setFieldStates(prev => ({ ...prev, searchButtonEnabled: true }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-3xl">Adicionar Investimentos</CardTitle>
          <CardDescription>
            Busque e adicione seus investimentos. Isso nos ajudará a avaliar melhor seu perfil e fazer recomendações personalizadas.
            {isFromOnboarding && " Se preferir, você pode pular esta etapa."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle Modo Avançado - canto superior direito */}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAdvancedMode}
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-4 w-4 mr-1" />
              {advancedMode ? 'Modo Simples' : 'Modo Avançado'}
            </Button>
          </div>

          {/* ========== MODO SIMPLES ========== */}
          {!advancedMode && (
            <div className="space-y-6 animate-fade-in">
              {/* Seção 1: Objetivo */}
              <div className="space-y-4 p-4 border rounded-lg bg-card">
                <h3 className="text-lg font-semibold">1. Qual seu objetivo?</h3>
                <ObjectiveSelector
                  selectedObjective={selectedObjective}
                  onSelectObjective={handleObjectiveChange}
                />
              </div>

              {/* Seção 2: Filtros contextuais (após selecionar objetivo) */}
              {selectedObjective && (
                <div className="space-y-4 p-4 border rounded-lg bg-card animate-fade-in">
                  <h3 className="text-lg font-semibold">2. Refinando sua busca</h3>
                  <ObjectiveFilters
                    objective={selectedObjective}
                    filters={objectiveFilters}
                    onFiltersChange={setObjectiveFilters}
                  />
                </div>
              )}

              {/* Botão de Busca (aparece após selecionar objetivo) */}
              {selectedObjective && (
                <Button 
                  onClick={() => setShowSearchDialog(true)} 
                  className="w-full animate-fade-in"
                  size="lg"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Investimentos
                </Button>
              )}
            </div>
          )}

          {/* ========== MODO AVANÇADO ========== */}
          {advancedMode && (
            <div className="space-y-4 animate-fade-in">
              {/* SEÇÃO 1: BUSCA INICIAL */}
              <div className="space-y-4 p-4 border rounded-lg bg-card">
                <h3 className="text-lg font-semibold">1. Como você quer buscar?</h3>
                
                {/* Search Field */}
                <div className="space-y-2">
                  <Label htmlFor="search">Busca Livre (Opcional)</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Ex: CDB, tesouro, ações, fundo imobiliário..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        handleSearch(e.target.value);
                      }}
                      className="pl-9 pr-9"
                      maxLength={SEARCH_CONFIG.maxChars}
                    />
                    {/* Spinner de loading durante debounce */}
                    {isTyping && (
                      <div className="absolute right-3 top-3">
                        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  {/* Contador de caracteres - só mostra quando há texto */}
                  {searchQuery.length > 0 && (
                    <div className="text-xs text-muted-foreground text-right">
                      {searchQuery.length}/{SEARCH_CONFIG.maxChars}
                    </div>
                  )}
                  {suggestedCategories.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-muted-foreground">Sugestões:</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestedCategories.map(cat => (
                          <Badge
                            key={cat.id}
                            variant="outline"
                            className="cursor-pointer hover:bg-accent"
                            onClick={() => {
                              setSelectedType(cat.type);
                              setSelectedCategory(cat.id);
                              setFieldStates(prev => ({ 
                                ...prev, 
                                categoryEnabled: true,
                                searchButtonEnabled: true 
                              }));
                              setSearchQuery("");
                              setSuggestedCategories([]);
                            }}
                          >
                            {cat.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Sugestões instantâneas de ativos (cache local) */}
                  {instantAssetSuggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-muted-foreground">Ativos sugeridos:</p>
                      <div className="flex flex-wrap gap-2">
                        {instantAssetSuggestions.map(asset => (
                          <Badge
                            key={asset.ticker}
                            variant="secondary"
                            className="cursor-pointer hover:bg-accent"
                            onClick={() => {
                              setSearchQuery(asset.ticker);
                              handleSearch(asset.ticker);
                            }}
                          >
                            {asset.ticker} - {asset.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Mensagem durante debounce */}
                  {isTyping && hasValidFreeSearch && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                      🔍 Preparando busca completa...
                    </p>
                  )}
                </div>

                {/* Type Filter */}
                <div className="space-y-2">
                  <Label htmlFor="type">
                    Tipo de Investimento
                    {!hasValidFreeSearch && <span className="text-destructive"> *</span>}
                  </Label>
                  <Select value={selectedType} onValueChange={handleTypeChange}>
                    <SelectTrigger id="type" className="bg-background">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="renda_fixa">Renda Fixa</SelectItem>
                      <SelectItem value="renda_variavel">Renda Variável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">
                    Categoria
                    {!hasValidFreeSearch && <span className="text-destructive"> *</span>}
                  </Label>
                  <Select 
                    value={selectedCategory} 
                    onValueChange={handleCategoryChangeEnhanced}
                    disabled={!fieldStates.categoryEnabled && !hasValidFreeSearch}
                  >
                    <SelectTrigger 
                      id="category" 
                      className={errors.selectedCategory ? "border-destructive" : "bg-background"}
                    >
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter(cat => selectedType === "all" || cat.type === selectedType)
                        .map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mensagem de ajuda contextual */}
                {hasValidFreeSearch && !selectedCategory && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md flex items-center gap-2">
                    <span>💡</span>
                    <span>Você pode buscar diretamente ou refinar com tipo/categoria</span>
                  </div>
                )}

                {!hasValidFreeSearch && !selectedCategory && searchQuery.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Digite ao menos {SEARCH_CONFIG.minChars} caracteres para buscar diretamente
                  </p>
                )}

                {/* Search Button */}
                <Button 
                  onClick={() => setShowSearchDialog(true)} 
                  disabled={!isSearchButtonEnabled}
                  className="w-full"
                  size="lg"
                  type="button"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar Investimento
                </Button>
              </div>
            </div>
          )}

          {/* SEÇÃO 2: DETALHES DO INVESTIMENTO */}
          {fieldStates.detailsEnabled && (
            <div className="space-y-4 p-4 border rounded-lg bg-card">
              <h3 className="text-lg font-semibold">2. Confirme os detalhes</h3>
              
              {/* Investment Name - Auto-filled */}
              <div className="space-y-2">
                <Label htmlFor="investment-name">Nome do Investimento</Label>
                <Input
                  id="investment-name"
                  value={investmentName}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-preenchido com base nos dados de mercado
                </p>
              </div>

              {/* Custom Name - Optional */}
              <div className="space-y-2">
                <Label htmlFor="custom-name">Nome Customizado (opcional)</Label>
                <Input
                  id="custom-name"
                  placeholder="Ex: Meu CDB do Agro"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Personalize o nome do investimento
                </p>
              </div>

              {/* Institution */}
              <div className="space-y-2">
                <Label htmlFor="institution">
                  Instituição Financeira 
                  <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={selectedInstitution} 
                  onValueChange={(value) => {
                    setSelectedInstitution(value);
                    setErrors(prev => ({ ...prev, selectedInstitution: false }));
                  }}
                >
                  <SelectTrigger 
                    id="institution" 
                    className={errors.selectedInstitution ? "border-destructive" : "bg-background"}
                  >
                    <SelectValue placeholder="Onde você tem este investimento?" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.short_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Banco ou corretora onde você mantém este investimento
                </p>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">
                  Valor Investido 
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="amount"
                  type="text"
                  placeholder="R$ 0,00"
                  value={amount}
                  onChange={(e) => {
                    handleAmountChange(e.target.value);
                    setErrors(prev => ({ ...prev, amount: false }));
                  }}
                  className={errors.amount ? "border-destructive" : ""}
                />
              </div>

              {/* Add Button */}
              <Button 
                onClick={addInvestment} 
                className="w-full"
                size="lg"
                type="button"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Investimento
              </Button>
            </div>
          )}

          {/* Como funciona? */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Como funciona?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium">Busque o investimento</p>
                  <p className="text-muted-foreground">
                    Pesquise por nome, código ou emissor
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium">Informe o valor</p>
                  <p className="text-muted-foreground">
                    Digite quanto você investiu ou pretende investir
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium flex items-center gap-2">
                    Análise automática
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-2 text-xs">
                            <p className="font-semibold">Indicadores técnicos calculados:</p>
                            <ul className="space-y-1 list-disc list-inside">
                              <li><strong>VaR 95%:</strong> Perda máxima esperada em 95% dos casos</li>
                              <li><strong>Sharpe Ratio:</strong> Retorno ajustado ao risco</li>
                              <li><strong>Beta:</strong> Volatilidade comparada ao mercado</li>
                              <li><strong>Score:</strong> Compatibilidade de 1 a 20 pontos</li>
                            </ul>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </p>
                  <p className="text-muted-foreground">
                    Avaliamos o risco e verificamos se combina com seu perfil de investidor
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Investimentos */}
          {investments.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Investimentos Adicionados ({investments.length})</h3>
              <div className="space-y-2">
                {investments.map((inv, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{inv.investment_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {inv.category_name} • {inv.institution_name}
                        {inv.amount && ` • R$ ${inv.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInvestment(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {isFromOnboarding ? (
              <Button
                variant="outline"
                onClick={() => handleContinue()}
                className="flex-1"
                disabled={isSubmitting}
              >
                Pular esta etapa
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            )}
            <Button
              onClick={() => handleContinue()}
              className="flex-1"
              disabled={isSubmitting || (isFromOnboarding ? false : investments.length === 0)}
            >
              {isSubmitting ? "Salvando..." : "Continuar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de busca de investimentos - usa mv_investment_search */}
      <InvestmentSearchDialog
        open={showSearchDialog}
        onOpenChange={setShowSearchDialog}
        filters={
          advancedMode
            ? {
                searchQuery: sanitizeSearchQuery(debouncedSearchQuery, SEARCH_CONFIG.maxChars),
                type: selectedType !== "all" ? selectedType : undefined,
                assetType: getAssetTypeFromCategory(selectedCategory),
              }
            : {
                assetTypes: getAssetTypesForObjective(selectedObjective!),
                incomeFilter: requiresIncomeSubfilter(selectedObjective!),
                ...getSearchParamsFromObjectiveFilters(selectedObjective, objectiveFilters),
              }
        }
        onSelectAsset={handleAssetSelection}
      />
    </div>
  );
}
