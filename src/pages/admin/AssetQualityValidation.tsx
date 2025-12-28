import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, ArrowLeft, Download, HelpCircle, BookOpen, History, Eye, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AlertsSection } from "@/components/admin/AlertsSection";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AssetTypeCount {
  asset_type: string;
  count: number;
}

interface ReclassificationData {
  original_type: string;
  current_type: string;
  count: number;
}

interface ValidationResult {
  assetCounts: AssetTypeCount[];
  reclassifications: ReclassificationData[];
  bdrValidation: {
    total: number;
    validPattern: number;
    withDrMarker: number;
    nullName: number;
  };
  criticalDivergences: {
    bdrsWithoutName: string[];
    invalidPatternBdrs: string[];
  };
  summary: {
    totalAssets: number;
    totalReclassified: number;
    reclassificationSuccessRate: number;
    patternValidRate: number;
    qualityScore: number;
  };
  status?: "PASSED" | "FAILED";
  timestamp: string;
}

interface ValidationHistoryItem {
  id: string;
  executed_at: string;
  total_assets: number;
  bdrs: number;
  fiis: number;
  stocks: number;
  etfs: number;
  units: number;
  bdrs_with_marker: number;
  critical_divergences: number;
  quality_score: number;
  status: "PASSED" | "FAILED";
  executed_by: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  full_result: any;
  created_at: string;
}

export default function AssetQualityValidation() {
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ValidationHistoryItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Single query that fetches all data from the edge function (single source of truth)
  const { data: validationData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["asset-quality-validation"],
    queryFn: async (): Promise<ValidationResult> => {
      console.log("Invoking asset-quality-check edge function...");
      const { data, error } = await supabase.functions.invoke("asset-quality-check");
      
      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }
      
      console.log("Edge function response:", data);
      return data as ValidationResult;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Query para buscar histórico de validações
  const { data: validationHistory, isLoading: isLoadingHistory, isError: isHistoryError } = useQuery({
    queryKey: ["validation-history"],
    queryFn: async (): Promise<ValidationHistoryItem[]> => {
      const { data, error } = await supabase
        .from("asset_validation_history")
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(10);
      
      if (error) {
        console.error("Error fetching validation history:", error);
        throw error;
      }
      
      return data as ValidationHistoryItem[];
    },
    staleTime: 1000 * 60, // 1 minute
  });

  const handleRunValidation = async () => {
    try {
      await refetch();
      // Invalidate history to refetch after new validation is saved
      queryClient.invalidateQueries({ queryKey: ["validation-history"] });
      toast.success("Validação concluída com sucesso!");
    } catch (error) {
      toast.error("Erro ao executar validação: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    }
  };

  // Helper to calculate delta between current and previous value
  const getDelta = (current: number, previous: number | undefined) => {
    if (previous === undefined) return null;
    const diff = current - previous;
    if (diff === 0) return { value: 0, icon: <Minus className="h-3 w-3 text-muted-foreground" /> };
    if (diff > 0) return { value: diff, icon: <TrendingUp className="h-3 w-3 text-green-400" /> };
    return { value: diff, icon: <TrendingDown className="h-3 w-3 text-red-400" /> };
  };

  // Format delta display
  const formatDelta = (delta: { value: number; icon: React.ReactNode } | null) => {
    if (delta === null) return null;
    const sign = delta.value > 0 ? "+" : "";
    return (
      <span className="flex items-center gap-0.5 text-xs">
        {delta.icon}
        <span className={delta.value > 0 ? "text-green-400" : delta.value < 0 ? "text-red-400" : "text-muted-foreground"}>
          {sign}{delta.value}
        </span>
      </span>
    );
  };

  const handleViewDetails = (item: ValidationHistoryItem) => {
    setSelectedHistoryItem(item);
    setIsDetailsOpen(true);
  };

  const getAssetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      bdr: "BDRs",
      stock: "Ações",
      fii: "FIIs",
      etf: "ETFs",
      unit: "Units",
      stock_fractional: "Fracionários",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (successRate: number) => {
    if (successRate >= 99) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> OK</Badge>;
    } else if (successRate >= 90) {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertTriangle className="w-3 h-3 mr-1" /> Atenção</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Crítico</Badge>;
  };

  const downloadReport = () => {
    if (!validationData) {
      toast.error("Execute uma validação primeiro");
      return;
    }

    const report = `
# Relatório de Validação de Qualidade de Ativos
Data: ${new Date(validationData.timestamp).toLocaleString("pt-BR")}

## Resumo
- Total de Ativos: ${validationData.summary.totalAssets}
- Total Reclassificados: ${validationData.summary.totalReclassified}
- Taxa de Sucesso: ${validationData.summary.reclassificationSuccessRate}%
- Taxa de Padrão Válido: ${validationData.summary.patternValidRate}%
- Score de Qualidade: ${validationData.summary.qualityScore}%

## Distribuição por Tipo
${validationData.assetCounts.map(a => `- ${getAssetTypeLabel(a.asset_type)}: ${a.count}`).join("\n")}

## Validação de BDRs
- Total de BDRs: ${validationData.bdrValidation.total}
- Com padrão válido: ${validationData.bdrValidation.validPattern}
- Com marcador DR: ${validationData.bdrValidation.withDrMarker}
- Sem nome: ${validationData.bdrValidation.nullName}

## Reclassificações
${validationData.reclassifications.map(r => 
  `- ${r.original_type} → ${r.current_type}: ${r.count}`
).join("\n")}

## Divergências Críticas
### BDRs sem Nome (${validationData.criticalDivergences.bdrsWithoutName.length})
${validationData.criticalDivergences.bdrsWithoutName.map(b => `- ${b}`).join("\n")}
    `;

    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `validation-report-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalAssets = validationData?.summary.totalAssets || 0;
  const assetCounts = validationData?.assetCounts || [];
  const bdrValidation = validationData?.bdrValidation;
  const bdrsWithoutName = validationData?.criticalDivergences.bdrsWithoutName || [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">Validação de Qualidade de Dados</h1>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Verifica integridade dos ativos</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-muted-foreground">Monitoramento e validação de classificação de ativos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Como usar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Como usar este dashboard</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-start gap-3">
                    <Badge className="rounded-full h-6 w-6 flex items-center justify-center shrink-0">1</Badge>
                    <div>
                      <p className="font-medium">Clique em "Executar Validação"</p>
                      <p className="text-sm text-muted-foreground">Atualiza todos os dados em tempo real</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge className="rounded-full h-6 w-6 flex items-center justify-center shrink-0">2</Badge>
                    <div>
                      <p className="font-medium">Verifique os cards de resumo</p>
                      <p className="text-sm text-muted-foreground">Total de ativos, BDRs validados e divergências</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge className="rounded-full h-6 w-6 flex items-center justify-center shrink-0">3</Badge>
                    <div>
                      <p className="font-medium">Analise as tabelas de detalhes</p>
                      <p className="text-sm text-muted-foreground">Distribuição por tipo e reclassificações</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge className="rounded-full h-6 w-6 flex items-center justify-center shrink-0">4</Badge>
                    <div>
                      <p className="font-medium">Exporte o relatório</p>
                      <p className="text-sm text-muted-foreground">Baixe um arquivo Markdown com todos os dados</p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={downloadReport}
              disabled={!validationData}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Relatório
            </Button>
            <Button
              onClick={handleRunValidation}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Executar Validação
            </Button>
          </div>
        </div>

        {/* Alerts Section */}
        <AlertsSection
          currentValidation={validationData || null}
          previousValidation={validationHistory?.[0] || null}
          isLoading={isLoading || isLoadingHistory}
          historyError={isHistoryError}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                Total de Ativos
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Todos os ativos listados na base</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardDescription>
              <CardTitle className="text-3xl">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalAssets.toLocaleString("pt-BR")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Última atualização: {validationData ? new Date(validationData.timestamp).toLocaleString("pt-BR") : "Carregando..."}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                BDRs Validados
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>BDRs com ticker terminando em 34/35</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardDescription>
              <CardTitle className="text-3xl">
                {bdrValidation ? `${bdrValidation.validPattern}/${bdrValidation.total}` : "-"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {bdrValidation ? 
                  `${Math.round((bdrValidation.validPattern / bdrValidation.total) * 1000) / 10}% com padrão válido` : 
                  "Carregando..."}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                BDRs com Marcador DR
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>BDRs com DRN/DRE/DR2/DR3 no nome</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardDescription>
              <CardTitle className="text-3xl">
                {bdrValidation ? `${bdrValidation.withDrMarker}/${bdrValidation.total}` : "-"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {bdrValidation ? 
                  `${Math.round((bdrValidation.withDrMarker / bdrValidation.total) * 1000) / 10}% com DRN/DRE/DR2/DR3` : 
                  "Carregando..."}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                Divergências Críticas
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>BDRs sem nome identificado no cadastro</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardDescription>
              <CardTitle className="text-3xl text-yellow-400">
                {bdrsWithoutName.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">BDRs sem nome identificado</p>
            </CardContent>
          </Card>
        </div>

        {/* Distribution by Type */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Distribuição por Tipo de Ativo
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Quantidade de cada categoria no banco</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>Contagem atual de ativos no banco de dados</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Percentual</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  assetCounts.map((item) => (
                    <TableRow key={item.asset_type}>
                      <TableCell className="font-medium">{getAssetTypeLabel(item.asset_type)}</TableCell>
                      <TableCell className="text-right">{item.count.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        {totalAssets > 0 ? ((item.count / totalAssets) * 100).toFixed(1) : 0}%
                      </TableCell>
                      <TableCell className="text-right">
                        {getStatusBadge(100)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Reclassification Table */}
        {validationData && validationData.reclassifications.length > 0 && (
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle>Rastreamento de Reclassificações</CardTitle>
              <CardDescription>Comparação entre backup (19/01/2025) e dados atuais</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>De → Para</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Taxa Sucesso</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationData.reclassifications.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {item.original_type} → {item.current_type}
                      </TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right">100%</TableCell>
                      <TableCell className="text-right">
                        {getStatusBadge(100)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">
                      {validationData.reclassifications.reduce((acc, r) => acc + r.count, 0)}
                    </TableCell>
                    <TableCell className="text-right">100%</TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(100)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Critical Divergences */}
        {bdrsWithoutName.length > 0 && (
          <Card className="bg-card/50 backdrop-blur border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                BDRs sem Nome Identificado
              </CardTitle>
              <CardDescription>
                Estes BDRs não possuem short_name definido e podem precisar de correção manual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {bdrsWithoutName.slice(0, 20).map((ticker) => (
                  <Badge key={ticker} variant="outline" className="border-yellow-500/30 text-yellow-400">
                    {ticker}
                  </Badge>
                ))}
                {bdrsWithoutName.length > 20 && (
                  <Badge variant="outline" className="border-muted">
                    +{bdrsWithoutName.length - 20} mais
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Card */}
        {validationData && (
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle>Resumo da Validação</CardTitle>
              <CardDescription>Métricas gerais de qualidade dos dados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-background/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">
                    {validationData.summary.totalAssets.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground">Total de Ativos</p>
                </div>
                <div className="text-center p-4 bg-background/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">
                    {validationData.summary.totalReclassified}
                  </p>
                  <p className="text-xs text-muted-foreground">Reclassificados</p>
                </div>
                <div className="text-center p-4 bg-background/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">
                    {validationData.summary.patternValidRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">Padrão Válido</p>
                </div>
                <div className="text-center p-4 bg-background/50 rounded-lg">
                  <p className="text-2xl font-bold text-green-400">
                    {validationData.summary.qualityScore}%
                  </p>
                  <p className="text-xs text-muted-foreground">Score de Qualidade</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation History Section */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Validações
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Últimas 10 execuções de validação</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>Histórico das últimas execuções de validação de qualidade</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">BDRs</TableHead>
                  <TableHead className="text-right">FIIs</TableHead>
                  <TableHead className="text-right">Stocks</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingHistory ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : validationHistory && validationHistory.length > 0 ? (
                  validationHistory.map((item, idx) => {
                    const previousItem = validationHistory[idx + 1];
                    const totalDelta = getDelta(item.total_assets, previousItem?.total_assets);
                    const bdrsDelta = getDelta(item.bdrs, previousItem?.bdrs);
                    const fiisDelta = getDelta(item.fiis, previousItem?.fiis);
                    const stocksDelta = getDelta(item.stocks, previousItem?.stocks);

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {format(new Date(item.executed_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.total_assets.toLocaleString("pt-BR")}
                            {formatDelta(totalDelta)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.bdrs}
                            {formatDelta(bdrsDelta)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.fiis}
                            {formatDelta(fiisDelta)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {item.stocks}
                            {formatDelta(stocksDelta)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quality_score}%
                        </TableCell>
                        <TableCell className="text-center">
                          {item.status === "PASSED" ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              PASSOU
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                              <XCircle className="w-3 h-3 mr-1" />
                              FALHOU
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(item)}
                            className="gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            Ver detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhuma validação registrada ainda. Execute uma validação para criar o primeiro registro.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Detalhes da Validação
                {selectedHistoryItem && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {format(new Date(selectedHistoryItem.executed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedHistoryItem && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-6 p-1">
                  {/* Status Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-background/50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedHistoryItem.total_assets.toLocaleString("pt-BR")}
                      </p>
                      <p className="text-xs text-muted-foreground">Total de Ativos</p>
                    </div>
                    <div className="text-center p-4 bg-background/50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedHistoryItem.critical_divergences}
                      </p>
                      <p className="text-xs text-muted-foreground">Divergências</p>
                    </div>
                    <div className="text-center p-4 bg-background/50 rounded-lg">
                      <p className="text-2xl font-bold text-foreground">
                        {selectedHistoryItem.bdrs_with_marker}
                      </p>
                      <p className="text-xs text-muted-foreground">BDRs c/ Marcador</p>
                    </div>
                    <div className="text-center p-4 bg-background/50 rounded-lg">
                      <p className={`text-2xl font-bold ${selectedHistoryItem.status === "PASSED" ? "text-green-400" : "text-red-400"}`}>
                        {selectedHistoryItem.quality_score}%
                      </p>
                      <p className="text-xs text-muted-foreground">Score</p>
                    </div>
                  </div>

                  {/* Asset Distribution */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Distribuição por Tipo</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-lg font-semibold">{selectedHistoryItem.bdrs}</p>
                        <p className="text-xs text-muted-foreground">BDRs</p>
                      </div>
                      <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-lg font-semibold">{selectedHistoryItem.fiis}</p>
                        <p className="text-xs text-muted-foreground">FIIs</p>
                      </div>
                      <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-lg font-semibold">{selectedHistoryItem.stocks}</p>
                        <p className="text-xs text-muted-foreground">Stocks</p>
                      </div>
                      <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-lg font-semibold">{selectedHistoryItem.etfs}</p>
                        <p className="text-xs text-muted-foreground">ETFs</p>
                      </div>
                      <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-lg font-semibold">{selectedHistoryItem.units}</p>
                        <p className="text-xs text-muted-foreground">Units</p>
                      </div>
                    </div>
                  </div>

                  {/* Full Result (if available) */}
                  {selectedHistoryItem.full_result && (
                    <div>
                      <h3 className="text-sm font-medium mb-3">Divergências Críticas</h3>
                      {selectedHistoryItem.full_result.criticalDivergences?.bdrsWithoutName?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedHistoryItem.full_result.criticalDivergences.bdrsWithoutName.slice(0, 20).map((ticker: string) => (
                            <Badge key={ticker} variant="outline" className="border-yellow-500/30 text-yellow-400">
                              {ticker}
                            </Badge>
                          ))}
                          {selectedHistoryItem.full_result.criticalDivergences.bdrsWithoutName.length > 20 && (
                            <Badge variant="outline" className="border-muted">
                              +{selectedHistoryItem.full_result.criticalDivergences.bdrsWithoutName.length - 20} mais
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma divergência crítica registrada.</p>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
