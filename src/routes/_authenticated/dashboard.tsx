import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Server, KeyRound, AlertTriangle, TrendingUp, ShieldCheck, PieChart as PieIcon, Layers } from "lucide-react";
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

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [colab, sist, acc, pend, orfaos, semResp, quadros] = await Promise.all([
        db.from("colaboradores").select("status", { count: "exact" }),
        db.from("sistemas").select("id, nome", { count: "exact" }),
        db.from("acessos").select("status, sistema_id", { count: "exact" }),
        db.from("pendencias").select("status, prioridade, sistema_id", { count: "exact" }),
        db
          .from("acessos")
          .select("id,colaborador:colaboradores!inner(status)")
          .eq("status", "ativo")
          .eq("colaboradores.status", "desligado"),
        db.from("sistemas").select("id", { count: "exact", head: true }).is("responsavel_id", null),
        db.from("pendencia_quadros").select("*").order("ordem"),
      ]);
      return {
        colabTotal: colab.count ?? 0,
        colabAtivos: (colab.data ?? []).filter((c) => c.status === "ativo").length,
        sistTotal: sist.count ?? 0,
        sistData: sist.data ?? [],
        acessosTotal: acc.count ?? 0,
        acessosAtivos: (acc.data ?? []).filter((a) => a.status === "ativo").length,
        acessosData: acc.data ?? [],
        pendTotal: pend.count ?? 0,
        pendData: pend.data ?? [],
        orfaos: orfaos.data?.length ?? 0,
        semResp: semResp.count ?? 0,
        quadros: quadros.data ?? [],
      };
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
    const sisNome = p.sistema_id ? sisMap.get(p.sistema_id) || "Sistema Removido" : "Geral / Sem Sistema";
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
  const pendByPriorityChart = Object.entries(pendByPrioMap).map(([name, value]) => ({ name, value }));

  // Acessos por Status
  const accByStatus = (data?.acessosData ?? []).reduce<Record<string, number>>((acc, a) => {
    const st = a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : "Indefinido";
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
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pendChart}>
                <XAxis dataKey="name" fontSize={11} interval={0} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Pendências" fill="#F58220" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-accent" /> Pendências por Sistema / Produto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pendBySistemaChart} layout="vertical">
                <XAxis type="number" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                <Tooltip />
                <Bar dataKey="value" name="Pendências" fill="#0B1F3A" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pendByPriorityChart} dataKey="value" nameKey="name" outerRadius={85} label>
                  {pendByPriorityChart.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={PRIO_COLORS[entry.name] || COLORS[i % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-accent" /> Acessos por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
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

