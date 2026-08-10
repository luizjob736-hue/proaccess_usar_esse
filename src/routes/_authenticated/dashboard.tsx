import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Server,
  KeyRound,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  PieChart as PieIcon,
  Layers,
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
import { Badge } from "@/components/ui/badge";
import { matchesColumnStatus } from "@/routes/_authenticated/pendencias";

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

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      try {
        const [colabRes, sistRes, accRes, pendRes, quadrosRes] = await Promise.all([
          db.from("colaboradores").select("id, status", { count: "exact" }),
          db.from("sistemas").select("id, nome, responsavel_id", { count: "exact" }),
          db.from("acessos").select("id, status, sistema_id, colaborador_id, login, senha", {
            count: "exact",
          }),
          db.from("pendencias").select("id, status, prioridade, sistema_id, arquivado", {
            count: "exact",
          }),
          db.from("pendencia_quadros").select("*").order("ordem"),
        ]);

        const colabList = colabRes.data ?? [];
        const sistList = sistRes.data ?? [];
        const rawAccList = accRes.data ?? [];
        const accList = rawAccList.filter(isValidAccess);
        const rawPendList = pendRes.data ?? [];
        const pendList = rawPendList.filter((p: any) => !p.arquivado);
        const quadrosList = quadrosRes.data ?? [];

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

        return {
          colabTotal: colabRes.count ?? colabList.length,
          colabAtivos: colabList.filter((c: any) => c.status === "ativo").length,
          sistTotal: sistRes.count ?? sistList.length,
          sistData: sistList,
          acessosTotal: accList.length,
          acessosAtivos: acessosAtivosCount,
          acessosData: accList,
          colabStatusMap,
          pendTotal: pendList.length,
          pendData: pendList,
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
          pendData: [],
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

  // Pendências por Status (mapeado para os Quadros do sistema)
  let pendChart: { name: string; value: number }[] = [];
  if (quadrosList.length > 0) {
    pendChart = quadrosList.map((q: any) => {
      const count = pendData.filter((p: any) =>
        matchesColumnStatus(p.status, q.nome, quadrosNomes),
      ).length;
      return { name: q.nome, value: count };
    });

    const accounted = pendChart.reduce((acc, curr) => acc + curr.value, 0);
    if (accounted < pendData.length) {
      const othersCount = pendData.filter(
        (p: any) =>
          !quadrosNomes.some((qName: string) => matchesColumnStatus(p.status, qName, quadrosNomes)),
      ).length;
      if (othersCount > 0) {
        pendChart.push({ name: "Outros", value: othersCount });
      }
    }
  } else {
    const pendByStatus = pendData.reduce<Record<string, number>>((acc, p) => {
      const st = p.status || "Sem status";
      acc[st] = (acc[st] ?? 0) + 1;
      return acc;
    }, {});
    pendChart = Object.entries(pendByStatus).map(([name, value]) => ({ name, value }));
  }

  // Pendências por Sistema (Produto)
  const sisMap = new Map((data?.sistData ?? []).map((s: any) => [s.id, s.nome]));
  const pendBySisMap: Record<string, number> = {};
  pendData.forEach((p: any) => {
    const sisNome = p.sistema_id
      ? sisMap.get(p.sistema_id) || "Sistema Removido"
      : "Geral / Sem Sistema";
    pendBySisMap[sisNome] = (pendBySisMap[sisNome] || 0) + 1;
  });
  const pendBySistemaChart = Object.entries(pendBySisMap).map(([name, value]) => ({ name, value }));

  // Pendências por Prioridade
  const prioLabels: Record<string, string> = {
    baixa: "Baixa",
    media: "Média",
    alta: "Alta",
    critica: "Crítica",
  };
  const pendByPrioMap: Record<string, number> = {};
  pendData.forEach((p: any) => {
    const label = prioLabels[p.prioridade] || p.prioridade || "Média";
    pendByPrioMap[label] = (pendByPrioMap[label] || 0) + 1;
  });
  const pendByPriorityChart = Object.entries(pendByPrioMap).map(([name, value]) => ({
    name,
    value,
  }));

  // Acessos por Status
  const statusMap = data?.colabStatusMap;
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
  const accChart = Object.entries(accByStatus).map(([name, value]) => ({ name, value }));

  const COLORS = ["#F58220", "#0B1F3A", "#22c55e", "#ef4444", "#a855f7", "#3b82f6", "#eab308"];
  const PRIO_COLORS: Record<string, string> = {
    Baixa: "#22c55e",
    Média: "#3b82f6",
    Alta: "#f97316",
    Crítica: "#ef4444",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema em tempo real</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Users}
          label="Colaboradores"
          value={data?.colabTotal ?? 0}
          sub={`${data?.colabAtivos ?? 0} ativos`}
        />
        <Kpi
          icon={Server}
          label="Sistemas"
          value={data?.sistTotal ?? 0}
          sub={data?.semResp ? `${data.semResp} sem responsável` : "OK"}
          tone={data?.semResp ? "warn" : "ok"}
        />
        <Kpi
          icon={KeyRound}
          label="Acessos"
          value={data?.acessosTotal ?? 0}
          sub={`${data?.acessosAtivos ?? 0} ativos`}
        />
        <Kpi
          icon={AlertTriangle}
          label="Pendências"
          value={data?.pendTotal ?? 0}
          sub={data?.orfaos ? `${data.orfaos} acessos órfãos` : "Sem órfãos"}
          tone={data?.orfaos ? "warn" : "ok"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-accent" /> Pendências por Status (Quadros)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendChart.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {pendChart.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/40 text-xs shadow-2xs"
                  >
                    <span className="font-medium text-foreground">{item.name}:</span>
                    <span className="font-bold text-accent text-sm">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="h-[260px] w-full flex items-center justify-center">
              {pendChart.length === 0 || pendChart.every((item) => item.value === 0) ? (
                <p className="text-sm text-muted-foreground">Nenhuma pendência cadastrada</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pendChart} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}>
                    <XAxis dataKey="name" fontSize={11} interval={0} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      name="Pendências"
                      fill="#F58220"
                      radius={[6, 6, 0, 0]}
                      label={{ position: "top", fill: "#475569", fontSize: 11, fontWeight: 600 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-accent" /> Pendências por Sistema / Produto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="w-full flex items-center justify-center"
              style={{
                height: `${Math.max(280, pendBySistemaChart.length * 32)}px`,
              }}
            >
              {pendBySistemaChart.length === 0 ||
              pendBySistemaChart.every((item) => item.value === 0) ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma pendência vinculada a sistemas
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pendBySistemaChart}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                  >
                    <XAxis type="number" fontSize={12} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      fontSize={11}
                      width={140}
                      interval={0}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      name="Pendências"
                      fill="#0B1F3A"
                      radius={[0, 6, 6, 0]}
                      label={{ position: "right", fill: "#475569", fontSize: 11, fontWeight: 600 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieIcon className="h-4 w-4 text-accent" /> Pendências por Prioridade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full flex items-center justify-center">
              {pendByPriorityChart.length === 0 ||
              pendByPriorityChart.every((item) => item.value === 0) ? (
                <p className="text-sm text-muted-foreground">Nenhuma pendência cadastrada</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pendByPriorityChart}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={85}
                      label
                    >
                      {pendByPriorityChart.map((entry, i) => (
                        <Cell key={i} fill={PRIO_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-accent" /> Acessos por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full flex items-center justify-center">
              {accChart.length === 0 || accChart.every((item) => item.value === 0) ? (
                <p className="text-sm text-muted-foreground">Nenhum acesso cadastrado</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={accChart} dataKey="value" nameKey="name" outerRadius={85} label>
                      {accChart.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Painel de saúde do ambiente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <HealthItem label="Acessos órfãos" value={data?.orfaos ?? 0} good={0} />
          <HealthItem label="Sistemas sem responsável" value={data?.semResp ?? 0} good={0} />
          <HealthItem label="Pendências abertas" value={data?.pendTotal ?? 0} good={0} />
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  sub?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
            {sub && (
              <p
                className={`mt-1 text-xs ${tone === "warn" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {sub}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-accent/10 p-2">
            <Icon className="h-5 w-5 text-accent" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthItem({ label, value, good }: { label: string; value: number; good: number }) {
  const ok = value <= good;
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-sm">{label}</span>
      <Badge
        variant={ok ? "default" : "destructive"}
        className={ok ? "bg-emerald-600 text-white" : ""}
      >
        {value}
      </Badge>
    </div>
  );
}
