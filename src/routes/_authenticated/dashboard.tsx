import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Server,
  KeyRound,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  PieChart as PieIcon,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ExternalLink,
  ShieldAlert,
  Flame,
  UserCheck,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { matchesColumnStatus } from "@/routes/_authenticated/pendencias";
import { AiAgentInsightsCard } from "@/components/dashboard/AiAgentInsightsCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function isValidAccess(a: any) {
  const hasLogin =
    a.login && a.login.trim() !== "" && a.login.trim() !== "-" && a.login.trim() !== "—";
  const hasSenha =
    a.senha && a.senha.trim() !== "" && a.senha.trim() !== "-" && a.senha.trim() !== "—";
  return Boolean(hasLogin || hasSenha);
}

// Custom Glassmorphism Tooltip for Recharts
function CustomChartTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="rounded-lg border bg-popover/95 p-2.5 shadow-md backdrop-blur-xs text-xs">
        <p className="font-semibold text-foreground mb-1">{label || data.name}</p>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: data.fill || data.color || "#F58220" }}
          />
          <span className="text-muted-foreground">{data.name || "Total"}:</span>
          <span className="font-bold text-foreground text-sm">{data.value}</span>
        </div>
      </div>
    );
  }
  return null;
}

function Dashboard() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      try {
        const [colabRes, sistRes, accRes, pendRes, quadrosRes, pinePendRes, pineSistRes] =
          await Promise.all([
            db.from("colaboradores").select("id, status, nome", { count: "exact" }),
            db.from("sistemas").select("id, nome, responsavel_id", { count: "exact" }),
            db.from("acessos").select("id, status, sistema_id, colaborador_id, login, senha", {
              count: "exact",
            }),
            db.from("pendencias").select("id, titulo, descricao, status, prioridade, sistema_id, arquivado, sla_em", {
              count: "exact",
            }),
            db.from("pendencia_quadros").select("*").order("ordem"),
            (async () => {
              try {
                return await db
                  .from("pendencias_pine")
                  .select("id, status, arquivado, sistemas_valores, funcao, sistema_pine_id, criado_em, colaborador_nome");
              } catch {
                return { data: [] };
              }
            })(),
            (async () => {
              try {
                return await db.from("pendencias_pine_sistemas").select("id, nome, sistema_id");
              } catch {
                return { data: [] };
              }
            })(),
          ]);

        const colabList = colabRes.data ?? [];
        const sistList = sistRes.data ?? [];
        const rawAccList = accRes.data ?? [];
        const accList = rawAccList.filter(isValidAccess);
        const rawPendList = pendRes.data ?? [];
        // Only active pendencias (not archived and not concluded)
        const pendList = rawPendList.filter((p: any) => !p.arquivado && p.status !== "concluido" && p.status !== "concluida");
        const rawPinePendList = pinePendRes.data ?? [];
        // Only active Pine pendencias (not archived and not concluded)
        const pinePendList = rawPinePendList.filter(
          (p: any) => !p.arquivado && p.status !== "concluido" && p.status !== "concluida",
        );
        const quadrosList = quadrosRes.data ?? [];
        const pineSistList = pineSistRes.data ?? [];

        const colabStatusMap = new Map(colabList.map((c: any) => [c.id, c.status]));

        const desligadosIds = new Set(
          colabList
            .filter((c: any) => c.status === "desligado" || c.status === "inativo")
            .map((c: any) => c.id),
        );

        const orfaosCount = accList.filter(
          (a: any) => a.colaborador_id && desligadosIds.has(a.colaborador_id),
        ).length;

        const acessosAtivosCount = accList.filter((a: any) => {
          const isAccAtivo =
            a.status === "ativo" || a.status === "ATIVO" || !a.status || a.status !== "inativo";
          if (!isAccAtivo) return false;
          if (a.colaborador_id) {
            const cStatus = colabStatusMap.get(a.colaborador_id);
            if (cStatus === "desligado" || cStatus === "inativo") {
              return false;
            }
          }
          return true;
        }).length;

        const semRespCount = sistList.filter((s: any) => !s.responsavel_id).length;

        // Combined pendencias data (both standard and Pine)
        const combinedPendData = [
          ...pendList.map((p: any) => ({
            id: p.id,
            titulo: p.titulo,
            descricao: p.descricao,
            status: p.status || "pendente",
            prioridade: p.prioridade || "media",
            sistema_id: p.sistema_id,
            sla_em: p.sla_em,
            isPine: false,
          })),
          ...pinePendList.map((p: any) => ({
            id: p.id,
            titulo: `Pendência Pine - ${p.colaborador_nome || p.funcao || "Colaborador"}`,
            descricao: `Função: ${p.funcao || "-"}`,
            status: p.status || "pendente",
            prioridade: "media",
            sistema_id: p.sistema_pine_id || null,
            isPine: true,
            sistemas_valores: p.sistemas_valores,
          })),
        ];

        return {
          colabTotal: colabRes.count ?? colabList.length,
          colabAtivos: colabList.filter((c: any) => c.status === "ativo").length,
          sistTotal: sistRes.count ?? sistList.length,
          sistData: sistList,
          acessosTotal: accList.length,
          acessosAtivos: acessosAtivosCount,
          acessosData: accList,
          colabStatusMap,
          pendTotal: combinedPendData.length,
          pendPadraoTotal: pendList.length,
          pinePendTotal: pinePendList.length,
          pendData: combinedPendData,
          pineSistemas: pineSistList,
          orfaos: orfaosCount,
          semResp: semRespCount,
          quadros: quadrosList,
        };
      } catch (err) {
        console.error("Erro ao carregar dados do dashboard:", err);
        return {
          colabTotal: 0,
          colabAtivos: 0,
          sistTotal: 0,
          sistData: [],
          acessosTotal: 0,
          acessosAtivos: 0,
          acessosData: [],
          pendTotal: 0,
          pendPadraoTotal: 0,
          pinePendTotal: 0,
          pendData: [],
          pineSistemas: [],
          orfaos: 0,
          semResp: 0,
          quadros: [],
        };
      }
    },
  });

  const quadrosList = data?.quadros ?? [];
  const quadrosNomes = quadrosList.map((q: any) => q.nome);
  const pendData = data?.pendData ?? [];

  // 1. Pendências por Status (mapeado para os Quadros do sistema)
  const pendChart = useMemo(() => {
    if (quadrosList.length > 0) {
      const items = quadrosList.map((q: any) => {
        const count = pendData.filter((p: any) =>
          matchesColumnStatus(p.status, q.nome, quadrosNomes),
        ).length;
        return { name: q.nome, value: count, cor: q.cor || "#F58220" };
      });

      const accounted = items.reduce((acc: number, curr: any) => acc + curr.value, 0);
      if (accounted < pendData.length) {
        const othersCount = pendData.filter(
          (p: any) =>
            !quadrosNomes.some((qName: string) => matchesColumnStatus(p.status, qName, quadrosNomes)),
        ).length;
        if (othersCount > 0) {
          items.push({ name: "Outros", value: othersCount, cor: "#64748b" });
        }
      }
      return items;
    } else {
      const pendByStatus = pendData.reduce<Record<string, number>>((acc, p) => {
        const st = p.status || "Sem status";
        acc[st] = (acc[st] ?? 0) + 1;
        return acc;
      }, {});
      return Object.entries(pendByStatus).map(([name, value], i) => ({
        name,
        value,
        cor: ["#F58220", "#3b82f6", "#10b981", "#ef4444", "#a855f7"][i % 5],
      }));
    }
  }, [quadrosList, pendData, quadrosNomes]);

  // 2. Pendências por Sistema (Produto) - Integrando sistemas padrão e sistemas Pine
  const sisMap = useMemo(() => new Map((data?.sistData ?? []).map((s: any) => [s.id, s.nome])), [data?.sistData]);
  const pineSistemas = data?.pineSistemas ?? [];
  
  const pendBySistemaChart = useMemo(() => {
    const pendBySisMap: Record<string, number> = {};
    pendData.forEach((p: any) => {
      if (p.isPine) {
        let matchedCount = 0;
        if (pineSistemas.length > 0) {
          for (const pineSis of pineSistemas) {
            const val = p.sistemas_valores?.[pineSis.id] || p.sistemas_valores?.[pineSis.nome];
            if (val && val !== "-" && val !== "—") {
              const sisCatalogNome = pineSis.sistema_id ? sisMap.get(pineSis.sistema_id) : null;
              const finalNome = sisCatalogNome || pineSis.nome || "Pine";
              pendBySisMap[finalNome] = (pendBySisMap[finalNome] || 0) + 1;
              matchedCount++;
            }
          }
        }
        if (matchedCount === 0) {
          pendBySisMap["Pine"] = (pendBySisMap["Pine"] || 0) + 1;
        }
      } else {
        const sisNome = p.sistema_id
          ? sisMap.get(p.sistema_id) || "Sistema Removido"
          : "Geral / Sem Sistema";
        pendBySisMap[sisNome] = (pendBySisMap[sisNome] || 0) + 1;
      }
    });

    return Object.entries(pendBySisMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [pendData, pineSistemas, sisMap]);

  // 3. Pendências por Prioridade
  const prioLabels: Record<string, string> = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
    critica: "Crítica",
  };
  const pendByPriorityChart = useMemo(() => {
    const pendByPrioMap: Record<string, number> = {
      Crítica: 0,
      Alta: 0,
      Média: 0,
      Baixa: 0,
    };
    pendData.forEach((p: any) => {
      const rawPrio = (p.prioridade || "media").toLowerCase();
      const label = prioLabels[rawPrio] || "Média";
      pendByPrioMap[label] = (pendByPrioMap[label] || 0) + 1;
    });
    return Object.entries(pendByPrioMap)
      .filter(([_, val]) => val > 0 || pendData.length === 0)
      .map(([name, value]) => ({ name, value }));
  }, [pendData]);

  // 4. Acessos por Status
  const statusMap = data?.colabStatusMap;
  const accChart = useMemo(() => {
    const accByStatus = (data?.acessosData ?? []).reduce<Record<string, number>>((acc, a: any) => {
      let st = "Ativo";
      const colabStatus = a.colaborador_id && statusMap ? statusMap.get(a.colaborador_id) : null;
      if (a.status === "inativo" || colabStatus === "desligado" || colabStatus === "inativo") {
        st = "Inativo / Órfão";
      } else if (a.status) {
        st = a.status.charAt(0).toUpperCase() + a.status.slice(1).toLowerCase();
      }
      acc[st] = (acc[st] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(accByStatus).map(([name, value]) => ({ name, value }));
  }, [data?.acessosData, statusMap]);

  // Paletas de Cores Modernas
  const PALETTE = ["#F58220", "#0B1F3A", "#10b981", "#8b5cf6", "#f43f5e", "#0ea5e9", "#f59e0b"];
  const STATUS_COLORS: Record<string, string> = {
    Pendente: "#f59e0b",
    "Em Análise": "#0ea5e9",
    "Aprovado / Em Criação": "#10b981",
    "Com Erro": "#ef4444",
    Concluído: "#22c55e",
  };
  const PRIO_COLORS: Record<string, string> = {
    Crítica: "#f43f5e",
    Alta: "#f97316",
    Média: "#0ea5e9",
    Baixa: "#10b981",
  };
  const ACC_COLORS: Record<string, string> = {
    Ativo: "#10b981",
    "Inativo / Órfão": "#f43f5e",
    Pendente: "#f59e0b",
  };

  // Métricas compiladas para o Agente de IA
  const aiMetrics = useMemo(() => {
    const sistCountMap: Record<string, number> = {};
    pendBySistemaChart.forEach((item) => {
      sistCountMap[item.name] = item.value;
    });

    const criticas = pendData.filter((p: any) => (p.prioridade || "").toLowerCase() === "critica").length;
    const altas = pendData.filter((p: any) => (p.prioridade || "").toLowerCase() === "alta").length;
    const medias = pendData.filter((p: any) => (p.prioridade || "media").toLowerCase() === "media").length;
    const baixas = pendData.filter((p: any) => (p.prioridade || "").toLowerCase() === "baixa").length;

    return {
      total: data?.pendTotal ?? 0,
      padrao: data?.pendPadraoTotal ?? 0,
      pine: data?.pinePendTotal ?? 0,
      criticas,
      altas,
      medias,
      baixas,
      sistemasMap: sistCountMap,
      orfaos: data?.orfaos ?? 0,
      semResponsavel: data?.semResp ?? 0,
      colabAtivos: data?.colabAtivos ?? 0,
      acessosAtivos: data?.acessosAtivos ?? 0,
      amostraPendencias: pendData.slice(0, 15).map((p: any) => ({
        titulo: p.titulo,
        descricao: p.descricao,
        status: p.status,
        prioridade: p.prioridade,
      })),
    };
  }, [data, pendData, pendBySistemaChart]);

  return (
    <div className="space-y-6">
      {/* Header com Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão analítica, volumetria operacional e diagnósticos de inteligência em tempo real
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 text-xs gap-1.5 shadow-2xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {isFetching ? "Atualizando..." : "Atualizar Dados"}
          </Button>

          <Button asChild size="sm" className="h-8 text-xs bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-xs">
            <Link to="/matriz-acessos">
              Matriz de Acessos <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Colaboradores"
          value={data?.colabTotal ?? 0}
          sub={`${data?.colabAtivos ?? 0} ativos no quadro`}
          tone="primary"
          linkTo="/colaboradores"
        />
        <KpiCard
          icon={Server}
          label="Sistemas & Aplicações"
          value={data?.sistTotal ?? 0}
          sub={data?.semResp ? `${data.semResp} sem responsável atribuído` : "Todos com gestor definido"}
          tone={data?.semResp ? "warn" : "ok"}
          linkTo="/sistemas"
        />
        <KpiCard
          icon={KeyRound}
          label="Acessos & Credenciais"
          value={data?.acessosTotal ?? 0}
          sub={`${data?.acessosAtivos ?? 0} regulares • ${data?.orfaos ?? 0} órfãos`}
          tone={data?.orfaos ? "warn" : "ok"}
          linkTo="/lista-acessos"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Pendências Totais"
          value={data?.pendTotal ?? 0}
          sub={
            data?.pinePendTotal && data?.pendPadraoTotal
              ? `${data.pendPadraoTotal} geral • ${data.pinePendTotal} Pine`
              : data?.pinePendTotal
                ? `${data.pinePendTotal} na esteira Pine`
                : (data?.pendTotal ?? 0) === 0
                  ? "Nenhuma pendência ativa"
                  : `${data?.pendTotal} aguardando resolução`
          }
          tone={(data?.pendTotal ?? 0) > 0 ? "accent" : "ok"}
          linkTo="/pendencias"
        />
      </div>

      {/* AGENTE DE INTELIGÊNCIA IA - PONTOS CRUCIAIS & DIAGNÓSTICO */}
      <AiAgentInsightsCard metrics={aiMetrics} isLoadingData={isLoading} />

      {/* SEÇÃO PRINCIPAL DE GRÁFICOS */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* GRÁFICO 1: Pendências por Status (Quadros Kanban) */}
        <Card className="shadow-xs border-border/80 overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <TrendingUp className="h-4 w-4 text-accent" />
                Pendências por Status do Fluxo
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-semibold bg-background">
                {pendData.length} ativas
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Distribuição de solicitações ativas nas colunas e esteiras de atendimento
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Status chips */}
            {pendChart.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {pendChart.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-md border bg-card text-xs shadow-2xs hover:border-accent/40 transition-colors"
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[item.name] || item.cor || "#F58220" }}
                    />
                    <span className="font-medium text-foreground">{item.name}:</span>
                    <span className="font-bold text-accent">{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="h-[270px] w-full flex items-center justify-center">
              {pendChart.length === 0 || pendChart.every((item) => item.value === 0) ? (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-medium text-foreground">Fluxo 100% Liberado</p>
                  <p className="text-xs text-muted-foreground">Nenhuma pendência ativa nos quadros no momento.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pendChart} margin={{ top: 20, right: 15, left: -15, bottom: 5 }}>
                    <XAxis
                      dataKey="name"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "rgba(150,150,150,0.2)" }}
                      interval={0}
                    />
                    <YAxis fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar
                      dataKey="value"
                      name="Pendências"
                      radius={[6, 6, 0, 0]}
                      label={{
                        position: "top",
                        fill: "var(--foreground, #334155)",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {pendChart.map((entry, index) => (
                        <Cell
                          key={`cell-status-${index}`}
                          fill={STATUS_COLORS[entry.name] || entry.cor || PALETTE[index % PALETTE.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* GRÁFICO 2: Pendências por Sistema / Produto */}
        <Card className="shadow-xs border-border/80 overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Layers className="h-4 w-4 text-accent" />
                Pendências por Sistema & Produto
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-semibold bg-background">
                {pendBySistemaChart.length} sistemas
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Consolidação de chamados e demandas de acessos por sistema e aplicação
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div
              className="w-full flex items-center justify-center"
              style={{
                height: `${Math.max(270, Math.min(360, pendBySistemaChart.length * 34))}px`,
              }}
            >
              {pendBySistemaChart.length === 0 ||
              pendBySistemaChart.every((item) => item.value === 0) ? (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-medium text-foreground">Sem Gargalos em Sistemas</p>
                  <p className="text-xs text-muted-foreground">Nenhuma pendência vinculada aos sistemas ativos.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pendBySistemaChart}
                    layout="vertical"
                    margin={{ top: 10, right: 35, left: 10, bottom: 10 }}
                  >
                    <XAxis type="number" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      fontSize={11}
                      width={130}
                      tickLine={false}
                      axisLine={{ stroke: "rgba(150,150,150,0.2)" }}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar
                      dataKey="value"
                      name="Pendências"
                      radius={[0, 6, 6, 0]}
                      fill="#0B1F3A"
                      label={{
                        position: "right",
                        fill: "var(--foreground, #334155)",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {pendBySistemaChart.map((_, index) => (
                        <Cell
                          key={`cell-sis-${index}`}
                          fill={index === 0 ? "#F58220" : index === 1 ? "#3b82f6" : "#0B1F3A"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEGUNDA LINHA DE GRÁFICOS: DONUT CHARTS COM ALTO IMPACTO VISUAL */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* GRÁFICO 3: Pendências por Prioridade */}
        <Card className="shadow-xs border-border/80 overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Flame className="h-4 w-4 text-accent" />
                Matriz de Prioridade das Pendências
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-semibold bg-background">
                SLA & Severidade
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Classificação por urgência para triagem e atendimento
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[270px] w-full flex items-center justify-center">
              {pendByPriorityChart.length === 0 ||
              pendByPriorityChart.every((item) => item.value === 0) ? (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-medium text-foreground">Nenhuma pendência crítica</p>
                  <p className="text-xs text-muted-foreground">Tudo em dia com os acordos de nível de serviço.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pendByPriorityChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {pendByPriorityChart.map((entry, i) => (
                        <Cell
                          key={`cell-prio-${i}`}
                          fill={PRIO_COLORS[entry.name] || PALETTE[i % PALETTE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value, entry: any) => (
                        <span className="text-xs font-medium text-foreground ml-1">
                          {value}: <strong className="text-accent">{entry.payload?.value ?? 0}</strong>
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* GRÁFICO 4: Acessos por Status */}
        <Card className="shadow-xs border-border/80 overflow-hidden">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Conformidade & Status dos Acessos
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-semibold bg-background">
                {data?.acessosTotal ?? 0} credenciais
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Proporção de acessos válidos, inativos e credenciais órfãs
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[270px] w-full flex items-center justify-center">
              {accChart.length === 0 || accChart.every((item) => item.value === 0) ? (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <KeyRound className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Nenhum acesso cadastrado</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={accChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {accChart.map((entry, i) => (
                        <Cell
                          key={`cell-acc-${i}`}
                          fill={ACC_COLORS[entry.name] || PALETTE[i % PALETTE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value, entry: any) => (
                        <span className="text-xs font-medium text-foreground ml-1">
                          {value}: <strong className="text-accent">{entry.payload?.value ?? 0}</strong>
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// KPI Card Component Modernizado
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
  linkTo,
}: {
  icon: any;
  label: string;
  value: number;
  sub?: string;
  tone?: "ok" | "warn" | "accent" | "primary";
  linkTo?: string;
}) {
  const CardWrapper = linkTo ? Link : "div";

  return (
    <Card className="group relative overflow-hidden border-border/80 shadow-xs hover:shadow-md transition-all duration-200">
      {/* Accent border highlight */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 h-1 transition-all group-hover:h-1.5",
          tone === "warn"
            ? "bg-red-500"
            : tone === "accent"
              ? "bg-accent"
              : tone === "ok"
                ? "bg-emerald-500"
                : "bg-primary",
        )}
      />

      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              {label}
            </p>
            <p className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {value.toLocaleString("pt-BR")}
            </p>
            {sub && (
              <p
                className={cn(
                  "mt-1 text-xs font-medium truncate",
                  tone === "warn"
                    ? "text-red-600 dark:text-red-400 font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {sub}
              </p>
            )}
          </div>

          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-2 transition-transform group-hover:scale-105",
              tone === "warn"
                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                : tone === "accent"
                  ? "bg-accent/15 text-accent"
                  : tone === "ok"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {linkTo && (
          <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground group-hover:text-accent font-medium">
            <span>Ver detalhes</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
