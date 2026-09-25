import React, { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Bot,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Server,
  RefreshCw,
  Zap,
  ArrowUpRight,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { analyzePendenciasWithAi } from "@/lib/ai-agent.functions";
import { cn } from "@/lib/utils";

interface AiAgentInsightsCardProps {
  metrics: {
    total: number;
    padrao: number;
    pine: number;
    criticas: number;
    altas: number;
    medias: number;
    baixas: number;
    sistemasMap: Record<string, number>;
    orfaos: number;
    semResponsavel: number;
    colabAtivos: number;
    acessosAtivos: number;
    amostraPendencias: Array<{
      titulo?: string;
      descricao?: string;
      status?: string;
      prioridade?: string;
      sistema?: string;
    }>;
  };
  isLoadingData?: boolean;
}

export function AiAgentInsightsCard({ metrics, isLoadingData }: AiAgentInsightsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const analyzeFn = useServerFn(analyzePendenciasWithAi);

  const {
    data: analysis,
    isLoading: isAnalyzing,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "dashboard-ai-agent-analysis",
      metrics.total,
      metrics.padrao,
      metrics.pine,
      metrics.criticas,
      metrics.altas,
      metrics.orfaos,
    ],
    queryFn: async () => {
      try {
        return await analyzeFn({
          data: {
            metrics,
          },
        });
      } catch (err) {
        console.error("Erro ao obter análise da IA:", err);
        return null;
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes cache
    enabled: !isLoadingData,
  });

  const isWorking = isAnalyzing || isFetching;
  const score = analysis?.scoreSaude ?? 85;
  const riskLevel = analysis?.nivelRisco ?? "baixo";

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "critico":
        return (
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30 gap-1 font-semibold text-[11px] px-2 py-0.5">
            <Flame className="h-3 w-3 text-red-600 animate-pulse" />
            Crítico
          </Badge>
        );
      case "alto":
        return (
          <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30 gap-1 font-semibold text-[11px] px-2 py-0.5">
            <AlertTriangle className="h-3 w-3 text-orange-600" />
            Elevado
          </Badge>
        );
      case "medio":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 font-semibold text-[11px] px-2 py-0.5">
            <Activity className="h-3 w-3 text-amber-600" />
            Moderado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 font-semibold text-[11px] px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Normal
          </Badge>
        );
    }
  };

  const getCategoryIcon = (categoria: string) => {
    switch (categoria) {
      case "sla":
        return <Clock className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
      case "gargalo":
        return <Flame className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case "seguranca":
        return <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />;
      default:
        return <Layers className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    }
  };

  return (
    <Card className="relative overflow-hidden border-border/80 shadow-xs bg-gradient-to-r from-card via-card to-accent/5 transition-all">
      {/* Accent top gradient */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-accent via-primary to-orange-400" />

      <CardContent className="p-3.5 sm:p-4 space-y-3">
        {/* Header Compacto com Status, Score e Ações */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent border border-accent/20 shrink-0">
              <Sparkles className="h-4 w-4 animate-pulse text-accent" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Agente ProAccess IA
            </span>
            <Badge
              variant="outline"
              className="bg-accent/10 border-accent/30 text-accent font-semibold text-[10px] px-1.5 py-0 h-5"
            >
              Auditoria Ativa
            </Badge>
            {getRiskBadge(riskLevel)}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {/* Score Pill */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border text-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Saúde:</span>
              <span
                className={cn(
                  "font-black text-xs",
                  score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400",
                )}
              >
                {score}%
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isWorking}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-accent gap-1"
              title="Reanalisar com IA"
            >
              <RefreshCw className={cn("h-3 w-3", isWorking && "animate-spin text-accent")} />
              <span className="hidden xs:inline">{isWorking ? "Analisando..." : "Reanalisar"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 px-2 text-xs gap-1 border-border/80 shadow-2xs"
            >
              <span>{expanded ? "Menos" : "Detalhes"}</span>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Linha Resumo Executivo */}
        <div className="flex items-start gap-2 text-xs bg-muted/30 border border-border/50 rounded-lg p-2.5 leading-relaxed text-foreground/90">
          <Bot className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <p className="flex-1">
            {isWorking && !analysis ? (
              <span className="text-muted-foreground italic flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin text-accent" />
                Analisando pendências, filas e prioridades...
              </span>
            ) : (
              analysis?.resumoGeral || "Nenhuma pendência ativa no momento. Operação em conformidade."
            )}
          </p>
        </div>

        {/* Chips de Pontos Cruciais em 1 Linha Horizontal (Compacto) */}
        {analysis?.pontosCruciais && analysis.pontosCruciais.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {analysis.pontosCruciais.slice(0, 3).map((ponto, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-md border bg-card/60 text-xs shadow-2xs hover:bg-muted/30 transition-colors"
              >
                {getCategoryIcon(ponto.categoria)}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-foreground truncate block leading-tight">
                    {ponto.titulo}
                  </span>
                </div>
                {ponto.impacto === "alto" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="Alto Impacto" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Seção Expandida Opcional (Sob Clique em "Detalhes") */}
        {expanded && (
          <div className="pt-2 border-t border-border/60 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid gap-3 md:grid-cols-2">
              {/* Observações de Sistemas */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Server className="h-3.5 w-3.5 text-primary" /> Observações por Sistema
                </span>
                <div className="space-y-1.5 text-xs">
                  {analysis?.observacoesSistemas?.map((sis, idx) => (
                    <div key={idx} className="p-2 rounded-md border bg-muted/20 text-muted-foreground">
                      <strong className="text-foreground">{sis.sistema}:</strong> {sis.observacao}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recomendações */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-500" /> Ações Recomendadas
                </span>
                <div className="space-y-1.5 text-xs">
                  {analysis?.recomendacoes?.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 p-2 rounded-md bg-accent/5 border border-accent/15 text-foreground/90">
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Links Rápidos */}
            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <span className="text-[10px]">
                Motor: {analysis?.fonte === "gemini" ? "Gemini 3.8 IA" : "Heurístico"}
              </span>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="ghost" className="h-6 text-xs text-accent gap-1 px-2">
                  <Link to="/pendencias">
                    Ver Pendências <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-6 text-xs text-accent gap-1 px-2">
                  <Link to="/pendencias-pine">
                    Ver Pine <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
