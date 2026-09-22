import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { format, formatDistanceStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileDown,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Kanban,
  Filter,
  ArrowUpDown,
  Eye,
  Calendar,
  Layers,
  User,
  Building,
  RefreshCw,
  AlertCircle,
  Tag,
  CheckSquare,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pendencias-historico")({
  component: PendenciasHistorico,
});

const PRIO_LABELS: Record<string, { label: string; color: string }> = {
  baixa: {
    label: "Baixa",
    color:
      "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  },
  media: {
    label: "Média",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  },
  alta: {
    label: "Alta",
    color:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700",
  },
  critica: {
    label: "Crítica",
    color: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700",
  },
};

const TIPO_LABELS: Record<string, string> = {
  solicitacao_acesso: "Solicitação de Acesso",
  exclusao_acesso: "Exclusão de Acesso",
  revisao: "Revisão",
  alteracao: "Alteração",
  outro: "Outro",
};

function formatCPF(val?: string | null): string {
  if (!val) return "-";
  const clean = val.replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return val;
}

function getStatusBadge(status: string) {
  const st = (status || "").toLowerCase().trim();
  if (st.includes("concluid") || st.includes("resolvid")) {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-semibold gap-1"
      >
        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {status.toUpperCase()}
      </Badge>
    );
  }
  if (st.includes("erro")) {
    return (
      <Badge
        variant="outline"
        className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-semibold gap-1"
      >
        <AlertCircle className="h-3 w-3 text-rose-600" /> {status.toUpperCase()}
      </Badge>
    );
  }
  if (st.includes("desbloqueio")) {
    return (
      <Badge
        variant="outline"
        className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 font-semibold gap-1"
      >
        {status.toUpperCase()}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 font-semibold"
    >
      {status.toUpperCase()}
    </Badge>
  );
}

function PendenciasHistorico() {
  const [busca, setBusca] = useState("");
  const [operacaoFiltro, setOperacaoFiltro] = useState("todas");
  const [sistemaFiltro, setSistemaFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [periodoFiltro, setPeriodoFiltro] = useState("todos");
  const [detailItem, setDetailItem] = useState<any | null>(null);

  // 1. Fetch Collaborators
  const { data: colaboradores = [] } = useQuery({
    queryKey: ["historico_pendencias_colabs"],
    queryFn: async () => {
      const { data } = await db
        .from("colaboradores")
        .select("id, nome, cpf, cargo, email, status, operacao_id");
      return data ?? [];
    },
  });

  // 2. Fetch Systems
  const { data: sistemas = [] } = useQuery({
    queryKey: ["historico_pendencias_sistemas"],
    queryFn: async () => {
      const { data } = await db.from("sistemas").select("id, nome, sla_horas");
      return data ?? [];
    },
  });

  // 3. Fetch Operations
  const { data: operacoes = [] } = useQuery({
    queryKey: ["historico_pendencias_operacoes"],
    queryFn: async () => {
      const { data } = await db.from("operacoes").select("id, nome");
      return data ?? [];
    },
  });

  // 4. Fetch Profiles (Responsáveis)
  const { data: profiles = [] } = useQuery({
    queryKey: ["historico_pendencias_profiles"],
    queryFn: async () => {
      const { data } = await db.from("profiles").select("id, nome, email");
      return data ?? [];
    },
  });

  // 5. Fetch ALL Historical / Concluded / Archived Pendências
  const {
    data: rawPendencias = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["historico_pendencias_all"],
    queryFn: async () => {
      const { data } = await db
        .from("pendencias")
        .select(
          "id, titulo, descricao, tipo, status, prioridade, solicitado, criado_em, data_inicio, sla_em, data_resolucao, concluido_em, arquivado, colaborador_id, sistema_id, operacao_id, responsavel_id, criado_por, etiquetas, checklist",
        )
        .order("criado_em", { ascending: false });
      return data ?? [];
    },
  });

  // Maps for fast O(1) enrichment
  const colabMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of colaboradores) {
      m.set(c.id, c);
      if (c.nome) m.set(c.nome.trim().toLowerCase(), c);
      if (c.cpf) m.set(c.cpf.replace(/\D/g, ""), c);
    }
    return m;
  }, [colaboradores]);

  const sistemaMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of sistemas) {
      m.set(s.id, s);
    }
    return m;
  }, [sistemas]);

  const operacaoMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const op of operacoes) {
      m.set(op.id, op);
    }
    return m;
  }, [operacoes]);

  const profileMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of profiles) {
      m.set(p.id, p);
    }
    return m;
  }, [profiles]);

  // Enrich and filter historical records (concluded, resolved, or archived)
  const historicoList = useMemo(() => {
    return rawPendencias
      .filter((p: any) => {
        const st = String(p.status ?? "")
          .toLowerCase()
          .trim();
        const isFinished =
          p.arquivado === true ||
          st.includes("concluid") ||
          st.includes("resolvid") ||
          st.includes("cancelad") ||
          Boolean(p.concluido_em) ||
          Boolean(p.data_resolucao);
        return isFinished;
      })
      .map((p: any) => {
        let colab = p.colaborador_id ? colabMap.get(p.colaborador_id) : null;
        if (!colab && p.titulo) {
          colab = colabMap.get(p.titulo.trim().toLowerCase());
        }
        if (!colab && p.descricao) {
          const digits = p.descricao.replace(/\D/g, "");
          if (digits.length === 11 && colabMap.has(digits)) {
            colab = colabMap.get(digits);
          }
        }

        const sistema = p.sistema_id ? sistemaMap.get(p.sistema_id) : null;
        const opId = p.operacao_id || colab?.operacao_id;
        const operacao = opId ? operacaoMap.get(opId) : null;
        const responsavel = p.responsavel_id ? profileMap.get(p.responsavel_id) : null;
        const criador = p.criado_por ? profileMap.get(p.criado_por) : null;

        const dataInicioObj = p.data_inicio ? new Date(p.data_inicio) : new Date(p.criado_em);
        const dataFimObj = p.concluido_em
          ? new Date(p.concluido_em)
          : p.data_resolucao
            ? new Date(p.data_resolucao)
            : new Date(p.criado_em);

        const duracaoDias = Math.max(
          0,
          Math.floor((dataFimObj.getTime() - dataInicioObj.getTime()) / (1000 * 60 * 60 * 24)),
        );

        return {
          ...p,
          colaborador: colab,
          sistema,
          operacao,
          responsavel,
          criador,
          dataInicioObj,
          dataFimObj,
          duracaoDias,
        };
      })
      .sort((a: any, b: any) => {
        const timeA = a.dataFimObj.getTime() || new Date(a.criado_em).getTime();
        const timeB = b.dataFimObj.getTime() || new Date(b.criado_em).getTime();
        return timeB - timeA;
      });
  }, [rawPendencias, colabMap, sistemaMap, operacaoMap, profileMap]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = historicoList.length;
    const concluidas = historicoList.filter((p: any) =>
      String(p.status).toLowerCase().includes("concluid"),
    ).length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const noMes = historicoList.filter((p: any) => {
      const d = p.dataFimObj;
      return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    let somaDias = 0;
    let countDias = 0;
    historicoList.forEach((p: any) => {
      if (typeof p.duracaoDias === "number" && !isNaN(p.duracaoDias)) {
        somaDias += p.duracaoDias;
        countDias++;
      }
    });

    const tempoMedioDias = countDias > 0 ? (somaDias / countDias).toFixed(1) : "0";

    return { total, concluidas, noMes, tempoMedioDias };
  }, [historicoList]);

  // Unique status values present in historical data
  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    historicoList.forEach((p: any) => {
      if (p.status) set.add(p.status);
    });
    return Array.from(set);
  }, [historicoList]);

  // Filtered List
  const filtered = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return historicoList.filter((p: any) => {
      // Operação
      if (operacaoFiltro !== "todas") {
        const opId = p.operacao?.id || p.operacao_id;
        if (opId !== operacaoFiltro) return false;
      }

      // Sistema
      if (sistemaFiltro !== "todos") {
        if (p.sistema?.id !== sistemaFiltro && p.sistema_id !== sistemaFiltro) return false;
      }

      // Status
      if (statusFiltro !== "todos") {
        if (p.status !== statusFiltro) return false;
      }

      // Tipo
      if (tipoFiltro !== "todos") {
        if (p.tipo !== tipoFiltro) return false;
      }

      // Período
      if (periodoFiltro !== "todos") {
        const dataFim = p.dataFimObj;
        if (periodoFiltro === "hoje" && dataFim.toISOString().split("T")[0] !== todayStr)
          return false;
        if (periodoFiltro === "7dias" && dataFim < sevenDaysAgo) return false;
        if (periodoFiltro === "este_mes" && dataFim < startOfCurrentMonth) return false;
        if (periodoFiltro === "30dias" && dataFim < thirtyDaysAgo) return false;
        if (periodoFiltro === "90dias" && dataFim < ninetyDaysAgo) return false;
      }

      // Text search
      if (busca) {
        const lower = busca.toLowerCase().trim();
        const rawCpf = p.colaborador?.cpf ? p.colaborador.cpf.replace(/\D/g, "") : "";
        const matchTitulo = p.titulo?.toLowerCase().includes(lower);
        const matchDesc = p.descricao?.toLowerCase().includes(lower);
        const matchColab = p.colaborador?.nome?.toLowerCase().includes(lower);
        const matchCpf = p.colaborador?.cpf?.includes(lower) || rawCpf.includes(lower);
        const matchSis = p.sistema?.nome?.toLowerCase().includes(lower);
        const matchOp = p.operacao?.nome?.toLowerCase().includes(lower);
        const matchStatus = p.status?.toLowerCase().includes(lower);

        if (
          !matchTitulo &&
          !matchDesc &&
          !matchColab &&
          !matchCpf &&
          !matchSis &&
          !matchOp &&
          !matchStatus
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    historicoList,
    operacaoFiltro,
    sistemaFiltro,
    statusFiltro,
    tipoFiltro,
    periodoFiltro,
    busca,
  ]);

  // Export handlers
  const handleExport = (fmt: "xlsx" | "csv") => {
    if (filtered.length === 0) {
      toast.warning("Nenhum registro no filtro atual para exportar.");
      return;
    }

    const rows = filtered.map((p: any) => ({
      "ID / Protocolo": p.id,
      Título: p.titulo || "",
      Colaborador: p.colaborador?.nome ? p.colaborador.nome.toUpperCase() : p.titulo || "-",
      CPF: formatCPF(p.colaborador?.cpf),
      Operação: p.operacao?.nome || "-",
      Cargo: p.colaborador?.cargo || "-",
      Sistema: p.sistema?.nome || "-",
      Tipo: TIPO_LABELS[p.tipo] || p.tipo || "Geral",
      Prioridade: p.prioridade ? String(p.prioridade).toUpperCase() : "MÉDIA",
      "Status Final": p.status || "CONCLUÍDO",
      "Data de Início": p.data_inicio
        ? format(new Date(p.data_inicio), "dd/MM/yyyy")
        : p.criado_em
          ? format(new Date(p.criado_em), "dd/MM/yyyy")
          : "",
      "Data de Resolução": p.dataFimObj ? format(p.dataFimObj, "dd/MM/yyyy HH:mm") : "",
      "Tempo Total (Dias)": p.duracaoDias ?? 0,
      "SLA Previsto": p.sla_em ? format(new Date(p.sla_em), "dd/MM/yyyy") : "-",
      "Criado Em": p.criado_em ? format(new Date(p.criado_em), "dd/MM/yyyy HH:mm") : "",
      Responsável: p.responsavel?.nome || "-",
      Descrição: p.descricao || "",
    }));

    const filename = `historico_pendencias_${format(new Date(), "yyyy-MM-dd_HHmm")}`;

    if (fmt === "csv") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const csvOutput = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\uFEFF" + csvOutput], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Histórico");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    toast.success(`${rows.length} pendência(s) exportada(s) com sucesso!`);
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Histórico de Pendências
            </h1>
            <Badge variant="secondary" className="text-xs px-2.5 py-0.5 font-bold">
              {historicoList.length} registro(s)
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Registro detalhado e auditoria de todas as pendências tratadas, concluídas e arquivadas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" asChild className="gap-2">
            <Link to="/pendencias">
              <Kanban className="h-4 w-4" /> Ver Quadro Kanban
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleExport("xlsx")}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel (.xlsx)
          </Button>

          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleExport("csv")}>
            <FileDown className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Histórico
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Pendências registradas</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Concluídas com Sucesso
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.concluidas}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.total > 0
                ? `${Math.round((stats.concluidas / stats.total) * 100)}% do histórico`
                : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Concluídas este Mês
            </CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.noMes}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">No mês corrente</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Tempo Médio Resolução
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.tempoMedioDias}{" "}
              <span className="text-sm font-normal text-muted-foreground">dias</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Média de encerramento</p>
          </CardContent>
        </Card>
      </div>

      {/* FILTER CONTROLS BAR */}
      <Card className="p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por colaborador, CPF, título, sistema..."
              className="pl-8 text-xs h-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {/* Operation Filter */}
          <div>
            <Select value={operacaoFiltro} onValueChange={setOperacaoFiltro}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Operação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Operações ({operacoes.length})</SelectItem>
                {operacoes.map((op: any) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* System Filter */}
          <div>
            <Select value={sistemaFiltro} onValueChange={setSistemaFiltro}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Sistema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Sistemas ({sistemas.length})</SelectItem>
                {sistemas.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                {statusOptions.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Period Filter */}
          <div>
            <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Períodos</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                <SelectItem value="este_mes">Este Mês</SelectItem>
                <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                <SelectItem value="90dias">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters summary bar */}
        {(busca ||
          operacaoFiltro !== "todas" ||
          sistemaFiltro !== "todos" ||
          statusFiltro !== "todos" ||
          periodoFiltro !== "todos" ||
          tipoFiltro !== "todos") && (
          <div className="flex items-center justify-between text-xs pt-2 border-t text-muted-foreground flex-wrap gap-2">
            <span>
              Exibindo <strong>{filtered.length}</strong> de <strong>{historicoList.length}</strong>{" "}
              registro(s) encontrados
            </span>
            <button
              onClick={() => {
                setBusca("");
                setOperacaoFiltro("todas");
                setSistemaFiltro("todos");
                setStatusFiltro("todos");
                setTipoFiltro("todos");
                setPeriodoFiltro("todos");
              }}
              className="text-primary hover:underline font-medium"
            >
              Limpar todos os filtros
            </button>
          </div>
        )}
      </Card>

      {/* DATA TABLE */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground font-semibold">
                <th className="h-10 px-4">Título / Solicitação</th>
                <th className="h-10 px-4">Colaborador & CPF</th>
                <th className="h-10 px-4">Operação</th>
                <th className="h-10 px-4">Sistema</th>
                <th className="h-10 px-4">Status & Tipo</th>
                <th className="h-10 px-4 text-center">Data Início</th>
                <th className="h-10 px-4 text-center">Finalizado Em</th>
                <th className="h-10 px-4 text-center">Duração</th>
                <th className="h-10 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      <span>Carregando histórico de pendências...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <CheckSquare className="h-8 w-8 text-muted-foreground/60" />
                      <p className="font-semibold text-foreground">Nenhuma pendência encontrada</p>
                      <p className="text-xs max-w-sm">
                        {historicoList.length === 0
                          ? "Ainda não existem pendências concluídas ou arquivadas no sistema."
                          : "Tente ajustar ou limpar os filtros de busca acima."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p: any) => {
                  const prioInfo = PRIO_LABELS[p.prioridade] || PRIO_LABELS.media;
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-muted/40">
                      {/* Título */}
                      <td className="p-4 font-medium max-w-[220px]">
                        <div className="font-semibold text-foreground truncate" title={p.titulo}>
                          {p.titulo || "Sem título"}
                        </div>
                        {p.descricao && (
                          <div
                            className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5"
                            title={p.descricao}
                          >
                            {p.descricao}
                          </div>
                        )}
                      </td>

                      {/* Colaborador */}
                      <td className="p-4">
                        <div className="font-medium text-foreground">
                          {p.colaborador?.nome ? p.colaborador.nome.toUpperCase() : "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {formatCPF(p.colaborador?.cpf)}
                        </div>
                      </td>

                      {/* Operação */}
                      <td className="p-4">
                        {p.operacao?.nome ? (
                          <Badge variant="outline" className="text-[10px] font-medium bg-muted/50">
                            {p.operacao.nome}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Sistema */}
                      <td className="p-4 font-medium text-foreground">{p.sistema?.nome || "—"}</td>

                      {/* Status & Tipo */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          {getStatusBadge(p.status)}
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${prioInfo.color}`}
                            >
                              {prioInfo.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {TIPO_LABELS[p.tipo] || p.tipo || "Geral"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Data Início */}
                      <td className="p-4 text-center tabular-nums whitespace-nowrap text-xs text-muted-foreground">
                        {p.data_inicio
                          ? format(new Date(p.data_inicio), "dd/MM/yyyy", { locale: ptBR })
                          : p.criado_em
                            ? format(new Date(p.criado_em), "dd/MM/yyyy", { locale: ptBR })
                            : "—"}
                      </td>

                      {/* Finalizado Em */}
                      <td className="p-4 text-center tabular-nums whitespace-nowrap text-xs font-medium">
                        {p.dataFimObj ? (
                          <div>
                            <div>{format(p.dataFimObj, "dd/MM/yyyy", { locale: ptBR })}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {format(p.dataFimObj, "HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Duração */}
                      <td className="p-4 text-center tabular-nums whitespace-nowrap text-xs">
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {p.duracaoDias} {p.duracaoDias === 1 ? "dia" : "dias"}
                        </Badge>
                      </td>

                      {/* Ações */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailItem(p)}
                          className="h-8 gap-1.5 text-xs text-primary hover:text-primary"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Detalhes
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL DIALOG */}
      <Dialog open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailItem && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {getStatusBadge(detailItem.status)}
                  <Badge variant="outline" className="font-mono text-xs">
                    ID: {detailItem.id.slice(0, 8)}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-bold mt-2">{detailItem.titulo}</DialogTitle>
                <DialogDescription className="text-xs">
                  Criado em{" "}
                  {format(new Date(detailItem.criado_em), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </DialogDescription>
              </DialogHeader>

              {/* COLABORADOR & SISTEMA CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="p-3 bg-muted/30">
                  <div className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-2">
                    <User className="h-3.5 w-3.5 text-primary" /> Dados do Colaborador
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-foreground">
                      {detailItem.colaborador?.nome
                        ? detailItem.colaborador.nome.toUpperCase()
                        : "Não informado"}
                    </p>
                    <p className="text-muted-foreground font-mono">
                      CPF: {formatCPF(detailItem.colaborador?.cpf)}
                    </p>
                    {detailItem.operacao?.nome && (
                      <p className="text-muted-foreground">
                        Operação:{" "}
                        <strong className="text-foreground">{detailItem.operacao.nome}</strong>
                      </p>
                    )}
                    {detailItem.colaborador?.cargo && (
                      <p className="text-muted-foreground">Cargo: {detailItem.colaborador.cargo}</p>
                    )}
                  </div>
                </Card>

                <Card className="p-3 bg-muted/30">
                  <div className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-2">
                    <Layers className="h-3.5 w-3.5 text-primary" /> Sistema & SLA
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-foreground">
                      {detailItem.sistema?.nome || "Sistema Geral / Não especificado"}
                    </p>
                    <p className="text-muted-foreground">
                      Tipo:{" "}
                      <strong>{TIPO_LABELS[detailItem.tipo] || detailItem.tipo || "Geral"}</strong>
                    </p>
                    <p className="text-muted-foreground">
                      Prioridade:{" "}
                      <strong className="uppercase">{detailItem.prioridade || "Média"}</strong>
                    </p>
                    {detailItem.sla_em && (
                      <p className="text-muted-foreground">
                        SLA Previsto:{" "}
                        {format(new Date(detailItem.sla_em), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </Card>
              </div>

              {/* DATAS & CRONOGRAMA */}
              <Card className="p-3 bg-muted/20">
                <div className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground mb-2">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> Cronograma de Atendimento
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Data Início</span>
                    <span className="font-semibold">
                      {detailItem.data_inicio
                        ? format(new Date(detailItem.data_inicio), "dd/MM/yyyy")
                        : format(new Date(detailItem.criado_em), "dd/MM/yyyy")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Data Resolução</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {detailItem.dataFimObj
                        ? format(detailItem.dataFimObj, "dd/MM/yyyy HH:mm")
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Tempo Total</span>
                    <span className="font-semibold">
                      {detailItem.duracaoDias} {detailItem.duracaoDias === 1 ? "dia" : "dias"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Status Arquivo</span>
                    <span className="font-semibold">
                      {detailItem.arquivado ? "Arquivado" : "Concluído"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* DESCRIÇÃO */}
              {detailItem.descricao && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">
                    Descrição / Observações
                  </h4>
                  <div className="rounded-md border p-3 bg-muted/30 text-xs whitespace-pre-wrap leading-relaxed">
                    {detailItem.descricao}
                  </div>
                </div>
              )}

              {/* ETIQUETAS */}
              {Array.isArray(detailItem.etiquetas) && detailItem.etiquetas.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Etiquetas
                  </h4>
                  <div className="flex gap-1.5 flex-wrap">
                    {detailItem.etiquetas.map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[11px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* CHECKLIST */}
              {Array.isArray(detailItem.checklist) && detailItem.checklist.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">
                    Checklist de Verificação
                  </h4>
                  <div className="space-y-1">
                    {detailItem.checklist.map((c: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs p-1.5 rounded border bg-muted/20"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(c.concluido)}
                          disabled
                          className="rounded"
                        />
                        <span
                          className={
                            c.concluido ? "line-through text-muted-foreground" : "font-medium"
                          }
                        >
                          {c.texto || c.item || "Item de verificação"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => setDetailItem(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
