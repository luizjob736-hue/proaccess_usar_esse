import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Server, KeyRound, AlertTriangle, TrendingUp, ShieldCheck } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [colab, sist, acc, pend, orfaos, semResp] = await Promise.all([
        supabase.from("colaboradores").select("status", { count: "exact" }),
        supabase.from("sistemas").select("id", { count: "exact", head: true }),
        supabase.from("acessos").select("status", { count: "exact" }),
        supabase.from("pendencias").select("status,prioridade", { count: "exact" }),
        supabase
          .from("acessos")
          .select("id,colaborador:colaboradores!inner(status)")
          .eq("status", "ativo")
          .eq("colaboradores.status", "desligado"),
        supabase
          .from("sistemas")
          .select("id", { count: "exact", head: true })
          .is("responsavel_id", null),
      ]);
      return {
        colabTotal: colab.count ?? 0,
        colabAtivos: (colab.data ?? []).filter((c) => c.status === "ativo").length,
        sistTotal: sist.count ?? 0,
        acessosTotal: acc.count ?? 0,
        acessosAtivos: (acc.data ?? []).filter((a) => a.status === "ativo").length,
        pendTotal: pend.count ?? 0,
        pendData: pend.data ?? [],
        acessosData: acc.data ?? [],
        orfaos: orfaos.data?.length ?? 0,
        semResp: semResp.count ?? 0,
      };
    },
  });

  const pendByStatus = (data?.pendData ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const pendChart = Object.entries(pendByStatus).map(([name, value]) => ({ name, value }));

  const accByStatus = (data?.acessosData ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});
  const accChart = Object.entries(accByStatus).map(([name, value]) => ({ name, value }));
  const COLORS = ["#F58220", "#0B1F3A", "#22c55e", "#ef4444", "#a855f7"];

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
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Pendências por status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pendChart}>
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="#F58220" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Acessos por status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={accChart} dataKey="value" nameKey="name" outerRadius={90} label>
                  {accChart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Painel de saúde</CardTitle>
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
        className={ok ? "bg-success text-success-foreground" : ""}
      >
        {value}
      </Badge>
    </div>
  );
}
