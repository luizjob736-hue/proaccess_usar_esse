import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useMemo } from "react";
import {
  History,
  User,
  Calendar,
  Clock,
  Search,
  Download,
  ArrowRight,
  FileSpreadsheet,
  Edit3,
  PlusCircle,
  Trash2,
  Key,
  Shield,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  CheckCircle2,
  Users,
  Database,
  Building,
  CheckSquare,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/historico")({
  component: Historico,
});

const FIELD_LABELS: Record<string, string> = {
  nome: "Nome",
  cpf: "CPF",
  matricula: "Matrícula",
  status: "Status",
  cargo: "Cargo",
  operacao_id: "Operação (ID)",
  gestor_id: "Gestor (ID)",
  email: "E-mail",
  telefone: "Telefone",
  admissao_em: "Data de Admissão",
  desligamento_em: "Data de Desligamento",
  inativado_em: "Data de Inativação",
  data_nascimento: "Data de Nascimento",
  inicio_na_operacao: "Início na Operação",
  horario_entrada: "Horário de Entrada",
  horario_saida: "Horário de Saída",
  jornada: "Jornada",
  produto: "Produto / Fila",
  apelido_intergrall: "Apelido Intergrall",
  email_senha: "Senha do E-mail",
  em_pre_atendimento: "Pré-Atendimento",
  foto_url: "Foto URL",
  observacoes: "Observações",
  login: "Login de Acesso",
  senha: "Senha de Acesso",
  sistema_id: "Sistema (ID)",
  perfil_acesso_id: "Perfil de Acesso (ID)",
  concedido_por: "Concedido Por (ID)",
  concedido_em: "Concedido Em",
  expira_em: "Data de Expiração",
  titulo: "Título",
  descricao: "Descrição",
  tipo: "Tipo",
  prioridade: "Prioridade",
  responsavel_id: "Responsável (ID)",
  sla_em: "SLA / Vencimento",
  concluido_em: "Concluído Em",
  etiquetas: "Etiquetas",
  posicao: "Posição",
  url: "URL",
  criticidade: "Criticidade",
  categoria: "Categoria",
  ativo: "Ativo",
};

function formatValueDisplay(key: string, val: any): string {
  if (val === null || val === undefined || val === "") return "-";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  if (key.includes("senha") || key === "password") return "••••••••";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "object") return JSON.stringify(val);

  const str = String(val).trim();
  // Formatação de data ISO
  if (
    (key.endsWith("_em") ||
      key.includes("data_") ||
      key.includes("inicio_") ||
      key.includes("nascimento")) &&
    /^\d{4}-\d{2}-\d{2}/.test(str)
  ) {
    try {
      const parts = str.split("T")[0].split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch {
      // ignore
    }
  }

  return str;
}

function getFieldDiff(antes: any, depois: any) {
  if (!antes && !depois) return [];
  const oldObj = antes || {};
  const newObj = depois || {};

  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  const ignoredKeys = ["id", "atualizado_em", "criado_em", "criado_por", "checklist"];

  const diffs: {
    key: string;
    label: string;
    oldVal: any;
    newVal: any;
    oldDisplay: string;
    newDisplay: string;
    changed: boolean;
  }[] = [];

  for (const k of allKeys) {
    if (ignoredKeys.includes(k)) continue;
    const oldV = oldObj[k];
    const newV = newObj[k];

    const strOld = oldV === undefined || oldV === null ? "" : String(oldV);
    const strNew = newV === undefined || newV === null ? "" : String(newV);

    const changed = strOld !== strNew;
    if (changed) {
      diffs.push({
        key: k,
        label: FIELD_LABELS[k] || k,
        oldVal: oldV,
        newVal: newV,
        oldDisplay: formatValueDisplay(k, oldV),
        newDisplay: formatValueDisplay(k, newV),
        changed: true,
      });
    }
  }

  return diffs;
}

function getTargetInfo(h: any) {
  const data = h.dados_depois || h.dados_antes || {};
  if (h.entidade === "colaboradores") {
    const nome = data.nome || "Colaborador";
    const cpf = data.cpf ? ` (CPF: ${data.cpf})` : "";
    return `${nome}${cpf}`;
  }
  if (h.entidade === "sistemas") {
    return data.nome || "Sistema";
  }
  if (h.entidade === "acessos") {
    const login = data.login ? `Login: ${data.login}` : "Credencial";
    const status = data.status ? ` [${data.status}]` : "";
    return `${login}${status}`;
  }
  if (h.entidade === "pendencias") {
    return data.titulo || "Pendência";
  }
  if (h.entidade === "importacao") {
    const template = data.template || data.tipo || "Arquivo";
    const total = data.total_linhas ? ` (${data.total_linhas} linhas)` : "";
    return `${template}${total}`;
  }
  if (h.entidade === "operacoes") {
    return data.nome || "Operação";
  }
  return h.entidade_id ? `ID: ${h.entidade_id.slice(0, 8)}...` : "-";
}

function getActionBadge(action: string) {
  const a = (action || "").toUpperCase().trim();
  if (a === "INSERT") {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 gap-1 font-medium"
      >
        <PlusCircle className="h-3 w-3" /> Cadastro
      </Badge>
    );
  }
  if (a === "UPDATE") {
    return (
      <Badge
        variant="outline"
        className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 gap-1 font-medium"
      >
        <Edit3 className="h-3 w-3" /> Edição
      </Badge>
    );
  }
  if (a === "DELETE") {
    return (
      <Badge
        variant="outline"
        className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 gap-1 font-medium"
      >
        <Trash2 className="h-3 w-3" /> Exclusão
      </Badge>
    );
  }
  if (a === "IMPORT") {
    return (
      <Badge
        variant="outline"
        className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 gap-1 font-medium"
      >
        <FileSpreadsheet className="h-3 w-3" /> Importação
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-medium">
      {action}
    </Badge>
  );
}

function getEntityIcon(entity: string) {
  switch (entity) {
    case "colaboradores":
      return <Users className="h-3.5 w-3.5 text-blue-500" />;
    case "acessos":
      return <Key className="h-3.5 w-3.5 text-amber-500" />;
    case "sistemas":
      return <Layers className="h-3.5 w-3.5 text-emerald-500" />;
    case "pendencias":
      return <CheckSquare className="h-3.5 w-3.5 text-violet-500" />;
    case "importacao":
      return <FileSpreadsheet className="h-3.5 w-3.5 text-purple-500" />;
    case "operacoes":
      return <Building className="h-3.5 w-3.5 text-orange-500" />;
    default:
      return <Database className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getEntityLabel(entity: string) {
  switch (entity) {
    case "colaboradores":
      return "Colaboradores";
    case "acessos":
      return "Acessos";
    case "sistemas":
      return "Sistemas";
    case "pendencias":
      return "Pendências";
    case "importacao":
      return "Importação";
    case "operacoes":
      return "Operações";
    case "user_roles":
      return "Permissões";
    case "profiles":
      return "Usuários";
    default:
      return entity;
  }
}

function getRoleLabel(role?: string) {
  switch (role) {
    case "admin_master":
      return "Admin Master";
    case "admin":
      return "Administrador";
    case "analista":
      return "Analista";
    case "supervisor":
      return "Supervisor";
    case "operador":
      return "Operador";
    case "consulta":
      return "Consulta";
    default:
      return role || "Usuário";
  }
}

function Historico() {
  const [entidade, setEntidade] = useState("todas");
  const [acao, setAcao] = useState("todas");
  const [atorFiltro, setAtorFiltro] = useState("todos");
  const [periodo, setPeriodo] = useState("todos");
  const [q, setQ] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [limit, setLimit] = useState("300");

  const { data: isAdmin = false, isLoading: isLoadingRole } = useQuery({
    queryKey: ["is_admin_historico_page"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return false;
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
      return (roles ?? []).some((r) => r.role === "admin" || r.role === "admin_master");
    },
  });

  // Buscar todos os profiles para associar dados completos de autor/usuário
  const { data: profiles = [] } = useQuery({
    queryKey: ["all_profiles_for_historico"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profs } = await db.from("profiles").select("id, nome, email, avatar_url");
      const { data: roles } = await db.from("user_roles").select("user_id, role");
      const roleMap = new Map<string, string>();
      for (const r of roles ?? []) {
        roleMap.set(r.user_id, r.role);
      }
      return (profs ?? []).map((p: any) => ({
        ...p,
        role: roleMap.get(p.id) || "consulta",
      }));
    },
  });

  const profilesMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of profiles) {
      m.set(p.id, p);
    }
    return m;
  }, [profiles]);

  // Buscar histórico com ordenação decrescente
  const {
    data: rawHistorico = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["historico_completo", limit],
    enabled: isAdmin,
    queryFn: async () => {
      const limitNum = parseInt(limit, 10) || 300;
      const { data } = await db
        .from("historico")
        .select("*, ator:profiles(id, nome, email, avatar_url)")
        .order("criado_em", { ascending: false })
        .limit(limitNum);
      return data ?? [];
    },
  });

  // Enriquecer registros com dados do usuário
  const enrichedHistorico = useMemo(() => {
    return rawHistorico.map((h: any) => {
      const profile = h.ator_id ? profilesMap.get(h.ator_id) : null;
      const actorName = h.ator?.nome || profile?.nome || (h.ator_id ? "Usuário" : "Sistema");
      const actorEmail = h.ator?.email || profile?.email || null;
      const actorRole = profile?.role || (h.ator_id ? null : "sistema");
      const target = getTargetInfo(h);
      const diffs = h.acao === "UPDATE" ? getFieldDiff(h.dados_antes, h.dados_depois) : [];

      return {
        ...h,
        actorName,
        actorEmail,
        actorRole,
        target,
        diffs,
      };
    });
  }, [rawHistorico, profilesMap]);

  // Filtragem
  const filteredData = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    return enrichedHistorico.filter((h: any) => {
      // Entidade
      if (entidade !== "todas" && h.entidade !== entidade) return false;

      // Ação
      if (acao !== "todas") {
        const hAcao = (h.acao || "").toUpperCase();
        if (acao === "UPDATE" && hAcao !== "UPDATE") return false;
        if (acao === "INSERT" && hAcao !== "INSERT") return false;
        if (acao === "DELETE" && hAcao !== "DELETE") return false;
        if (acao === "IMPORT" && hAcao !== "IMPORT") return false;
      }

      // Ator
      if (atorFiltro !== "todos") {
        if (atorFiltro === "sistema" && h.ator_id) return false;
        if (atorFiltro !== "sistema" && h.ator_id !== atorFiltro) return false;
      }

      // Período
      if (periodo !== "todos" && h.criado_em) {
        const itemDate = new Date(h.criado_em);
        const itemDateStr = h.criado_em.split("T")[0];

        if (periodo === "hoje" && itemDateStr !== todayStr) return false;
        if (periodo === "ontem" && itemDateStr !== yesterdayStr) return false;
        if (periodo === "7dias" && itemDate < sevenDaysAgo) return false;
        if (periodo === "30dias" && itemDate < thirtyDaysAgo) return false;
      }

      // Busca textual
      if (q) {
        const searchTerms = q.toLowerCase();
        const fullString =
          `${h.actorName} ${h.actorEmail || ""} ${h.acao} ${h.entidade} ${h.descricao || ""} ${h.target || ""} ${JSON.stringify(h.dados_antes || {})} ${JSON.stringify(h.dados_depois || {})}`.toLowerCase();
        if (!fullString.includes(searchTerms)) return false;
      }

      return true;
    });
  }, [enrichedHistorico, entidade, acao, atorFiltro, periodo, q]);

  // Estatísticas calculadas
  const stats = useMemo(() => {
    let updates = 0;
    let inserts = 0;
    let imports = 0;
    let deletes = 0;
    const uniqueActors = new Set<string>();

    for (const item of filteredData) {
      const a = (item.acao || "").toUpperCase();
      if (a === "UPDATE") updates++;
      else if (a === "INSERT") inserts++;
      else if (a === "IMPORT") imports++;
      else if (a === "DELETE") deletes++;

      if (item.ator_id) {
        uniqueActors.add(item.ator_id);
      }
    }

    return {
      total: filteredData.length,
      updates,
      inserts,
      imports,
      deletes,
      uniqueUsers: uniqueActors.size,
    };
  }, [filteredData]);

  // Exportação para Excel
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      toast.warning("Não há dados no histórico para exportar");
      return;
    }

    const exportRows = filteredData.map((h: any) => {
      const d = new Date(h.criado_em);
      const dataStr = d.toLocaleDateString("pt-BR");
      const horaStr = d.toLocaleTimeString("pt-BR");

      const diffDesc =
        h.diffs?.length > 0
          ? h.diffs.map((df: any) => `${df.label}: ${df.oldDisplay} → ${df.newDisplay}`).join(" | ")
          : "";

      return {
        Data: dataStr,
        Hora: horaStr,
        "Usuário (Ator)": h.actorName,
        "E-mail": h.actorEmail || "-",
        Perfil: getRoleLabel(h.actorRole),
        "Tipo de Ação": h.acao,
        Entidade: getEntityLabel(h.entidade),
        Descrição: h.descricao || "-",
        "Alvo / Registro": h.target,
        "Campos Alterados": diffDesc || "-",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Auditoria");

    // Ajustar largura das colunas
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 10 },
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 16 },
      { wch: 35 },
      { wch: 30 },
      { wch: 45 },
    ];

    const fileName = `historico_auditoria_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Histórico exportado com sucesso!");
  };

  if (isLoadingRole) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Carregando permissões...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4 p-8 text-center">
        <Shield className="mx-auto h-12 w-12 text-rose-500" />
        <h2 className="text-2xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Apenas administradores possuem acesso à auditoria de histórico.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Histórico de Auditoria</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Rastreamento completo e imutável de importações, edições de dados, cadastros e exclusões
            com usuário, data e hora.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            variant="default"
            size="sm"
            onClick={handleExportExcel}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Cards de Métricas e Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Card className="bg-card/50">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total de Eventos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-[11px] text-muted-foreground">registros filtrados</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-blue-500/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5" /> Edições de Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.updates}
            </div>
            <p className="text-[11px] text-muted-foreground">alterações registradas</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-purple-500/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Importações em Lote
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.imports}
            </div>
            <p className="text-[11px] text-muted-foreground">arquivos processados</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-emerald-500/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" /> Cadastros Individuais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.inserts}
            </div>
            <p className="text-[11px] text-muted-foreground">novas inserções</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 col-span-2 sm:col-span-4 lg:col-span-1 border-primary/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Usuários Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-primary">{stats.uniqueUsers}</div>
            <p className="text-[11px] text-muted-foreground">autores das alterações</p>
          </CardContent>
        </Card>
      </div>

      {/* Painel de Filtros Avançados */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {/* Filtro por Entidade */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Entidade
              </label>
              <Select value={entidade} onValueChange={setEntidade}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Todas as entidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as entidades</SelectItem>
                  <SelectItem value="importacao">Importações em Lote</SelectItem>
                  <SelectItem value="colaboradores">Colaboradores</SelectItem>
                  <SelectItem value="acessos">Acessos & Credenciais</SelectItem>
                  <SelectItem value="sistemas">Sistemas</SelectItem>
                  <SelectItem value="pendencias">Pendências</SelectItem>
                  <SelectItem value="operacoes">Operações</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Ação */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Tipo de Ação
              </label>
              <Select value={acao} onValueChange={setAcao}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as ações</SelectItem>
                  <SelectItem value="UPDATE">Edição / Alteração (UPDATE)</SelectItem>
                  <SelectItem value="IMPORT">Importação em Lote (IMPORT)</SelectItem>
                  <SelectItem value="INSERT">Cadastro / Criação (INSERT)</SelectItem>
                  <SelectItem value="DELETE">Exclusão (DELETE)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Usuário / Ator */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Usuário / Autor
              </label>
              <Select value={atorFiltro} onValueChange={setAtorFiltro}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Todos os usuários" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os usuários</SelectItem>
                  <SelectItem value="sistema">Sistema / Automático</SelectItem>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome || p.email} ({getRoleLabel(p.role)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Período */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Período
              </label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Qualquer data" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todo o período</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="ontem">Ontem</SelectItem>
                  <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                  <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Limite de Registros */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Quantidade
              </label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Limite" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">Últimos 100 eventos</SelectItem>
                  <SelectItem value="300">Últimos 300 eventos</SelectItem>
                  <SelectItem value="500">Últimos 500 eventos</SelectItem>
                  <SelectItem value="1000">Últimos 1000 eventos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campo de Busca Livre */}
          <div className="relative pt-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por colaborador, sistema, usuário, e-mail, ação, descrição ou valor alterado..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 h-9"
            />
            {q && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1.5 h-7 px-2 text-xs"
                onClick={() => setQ("")}
              >
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela Principal de Eventos de Histórico */}
      <Card>
        <CardHeader className="py-4 px-6 flex flex-row items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">
              Registros de Auditoria ({filteredData.length})
            </CardTitle>
            {isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <span className="text-xs text-muted-foreground">
            Clique em qualquer linha para inspecionar os detalhes e comparação de alterações
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Carregando trilha de auditoria...</span>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <History className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="font-medium text-foreground">Nenhum registro encontrado</p>
              <p className="text-sm mt-1">
                Tente ajustar os filtros de busca, usuário, entidade ou período.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[170px]">Data e Hora</TableHead>
                    <TableHead className="w-[210px]">Usuário / Autor</TableHead>
                    <TableHead className="w-[110px]">Ação</TableHead>
                    <TableHead className="w-[140px]">Entidade</TableHead>
                    <TableHead className="min-w-[260px]">Descrição & Alvo</TableHead>
                    <TableHead className="w-[180px]">Modificações</TableHead>
                    <TableHead className="w-[80px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((h: any) => {
                    const dateObj = new Date(h.criado_em);
                    const formattedDate = dateObj.toLocaleDateString("pt-BR");
                    const formattedTime = dateObj.toLocaleTimeString("pt-BR");

                    const initials = h.actorName
                      ? h.actorName
                          .split(" ")
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      : "S";

                    return (
                      <TableRow
                        key={h.id}
                        onClick={() => setSelectedEvent(h)}
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                      >
                        {/* Data e Hora */}
                        <TableCell className="align-top py-3">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span>{formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>{formattedTime}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Usuário / Autor */}
                        <TableCell className="align-top py-3">
                          <div className="flex items-start gap-2.5">
                            <Avatar className="h-7 w-7 text-[10px] font-semibold border shrink-0 bg-primary/10 text-primary">
                              <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold truncate text-foreground">
                                {h.actorName}
                              </span>
                              {h.actorEmail && (
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {h.actorEmail}
                                </span>
                              )}
                              {h.actorRole && (
                                <span className="text-[10px] font-medium text-primary/80 uppercase tracking-wider mt-0.5">
                                  {getRoleLabel(h.actorRole)}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Ação */}
                        <TableCell className="align-top py-3">{getActionBadge(h.acao)}</TableCell>

                        {/* Entidade */}
                        <TableCell className="align-top py-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            {getEntityIcon(h.entidade)}
                            <span>{getEntityLabel(h.entidade)}</span>
                          </div>
                        </TableCell>

                        {/* Descrição & Alvo */}
                        <TableCell className="align-top py-3">
                          <div className="flex flex-col space-y-1">
                            <span className="text-xs font-medium text-foreground">
                              {h.descricao || `${getEntityLabel(h.entidade)} - ${h.acao}`}
                            </span>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                              <span className="font-semibold text-foreground/80">Alvo:</span>
                              <span className="truncate">{h.target}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Modificações / Diffs */}
                        <TableCell className="align-top py-3">
                          {h.acao === "UPDATE" && h.diffs?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {h.diffs.slice(0, 3).map((df: any) => (
                                <span
                                  key={df.key}
                                  className="inline-flex items-center text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900 font-mono"
                                >
                                  {df.label}
                                </span>
                              ))}
                              {h.diffs.length > 3 && (
                                <span className="text-[10px] text-muted-foreground self-center">
                                  +{h.diffs.length - 3} mais
                                </span>
                              )}
                            </div>
                          ) : h.acao === "IMPORT" ? (
                            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                              Lote de dados
                            </span>
                          ) : h.acao === "INSERT" ? (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                              Novo registro
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">-</span>
                          )}
                        </TableCell>

                        {/* Botão Ver Detalhes */}
                        <TableCell className="align-top py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-70 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(h);
                            }}
                          >
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Evento de Auditoria */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  {getActionBadge(selectedEvent.acao)}
                  <span className="text-xs text-muted-foreground">ID: {selectedEvent.id}</span>
                </div>
                <DialogTitle className="text-xl">
                  {selectedEvent.descricao || "Detalhes do Evento de Auditoria"}
                </DialogTitle>
                <DialogDescription>
                  Registro imutável capturado pelo sistema de auditoria.
                </DialogDescription>
              </DialogHeader>

              {/* Informações Gerais do Autor e Data/Hora */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border text-xs mt-2">
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-8 w-8 text-xs font-semibold bg-primary/10 text-primary shrink-0">
                    <AvatarFallback>
                      {selectedEvent.actorName
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase() || "S"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-muted-foreground">Usuário Responsável</span>
                    <span className="font-semibold text-foreground text-sm">
                      {selectedEvent.actorName}
                    </span>
                    {selectedEvent.actorEmail && (
                      <span className="text-muted-foreground text-xs">
                        {selectedEvent.actorEmail}
                      </span>
                    )}
                    {selectedEvent.actorRole && (
                      <span className="text-[10px] font-medium text-primary mt-0.5 uppercase">
                        {getRoleLabel(selectedEvent.actorRole)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-center space-y-1 sm:border-l sm:pl-4">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">
                      {new Date(selectedEvent.criado_em).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(selectedEvent.criado_em).toLocaleTimeString("pt-BR")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] pt-0.5">
                    <span className="font-medium text-foreground">Entidade:</span>
                    <span>{getEntityLabel(selectedEvent.entidade)}</span>
                  </div>
                </div>
              </div>

              {/* Abas com Diff, Dados e JSON Bruto */}
              <Tabs defaultValue="diff" className="mt-4">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="diff" className="text-xs">
                    {selectedEvent.acao === "UPDATE"
                      ? `Campos Alterados (${selectedEvent.diffs?.length || 0})`
                      : "Dados da Operação"}
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="text-xs">
                    Payload Completo (JSON)
                  </TabsTrigger>
                </TabsList>

                {/* Conteúdo: Comparativo de Campos */}
                <TabsContent value="diff" className="mt-3 space-y-3">
                  {selectedEvent.acao === "UPDATE" && selectedEvent.diffs?.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 text-xs">
                            <TableHead className="w-1/3">Campo</TableHead>
                            <TableHead className="w-1/3">Valor Anterior (Antes)</TableHead>
                            <TableHead className="w-1/3 text-primary">
                              Novo Valor (Depois)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedEvent.diffs.map((df: any) => (
                            <TableRow key={df.key} className="text-xs">
                              <TableCell className="font-medium">
                                <span className="font-mono text-xs">{df.label}</span>
                                <span className="block text-[10px] text-muted-foreground font-mono">
                                  {df.key}
                                </span>
                              </TableCell>
                              <TableCell className="bg-rose-500/5 text-rose-700 dark:text-rose-300 font-mono">
                                {df.oldDisplay}
                              </TableCell>
                              <TableCell className="bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 font-semibold font-mono">
                                {df.newDisplay}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : selectedEvent.acao === "IMPORT" ? (
                    <div className="p-4 bg-muted/30 rounded-lg border space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold">
                        <FileSpreadsheet className="h-4 w-4" /> Detalhes da Importação em Lote
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div>
                          <span className="text-muted-foreground block">Template:</span>
                          <span className="font-medium text-foreground">
                            {selectedEvent.dados_depois?.template ||
                              selectedEvent.dados_depois?.tipo ||
                              "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Total de Linhas:</span>
                          <span className="font-medium text-foreground">
                            {selectedEvent.dados_depois?.total_linhas ?? "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Sucesso:</span>
                          <span className="font-medium text-emerald-600">
                            {selectedEvent.dados_depois?.sucesso ?? "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Falhas / Erros:</span>
                          <span className="font-medium text-rose-600">
                            {selectedEvent.dados_depois?.falhas ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/30 rounded-lg border space-y-2 text-xs">
                      <div className="font-semibold text-foreground mb-2">
                        {selectedEvent.acao === "INSERT"
                          ? "Registro Criado / Inserido"
                          : "Registro Excluído"}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(
                          selectedEvent.dados_depois || selectedEvent.dados_antes || {},
                        ).map(([k, v]) => (
                          <div key={k} className="border-b pb-1">
                            <span className="text-muted-foreground text-[11px] block">
                              {FIELD_LABELS[k] || k}
                            </span>
                            <span className="font-mono text-xs text-foreground font-medium">
                              {formatValueDisplay(k, v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Conteúdo: JSON Bruto */}
                <TabsContent value="raw" className="mt-3">
                  <div className="relative">
                    <pre className="p-3 bg-muted rounded-md text-[11px] font-mono overflow-x-auto max-h-[350px]">
                      {JSON.stringify(
                        {
                          id: selectedEvent.id,
                          entidade: selectedEvent.entidade,
                          acao: selectedEvent.acao,
                          ator_id: selectedEvent.ator_id,
                          ator: {
                            nome: selectedEvent.actorName,
                            email: selectedEvent.actorEmail,
                            role: selectedEvent.actorRole,
                          },
                          descricao: selectedEvent.descricao,
                          criado_em: selectedEvent.criado_em,
                          dados_antes: selectedEvent.dados_antes,
                          dados_depois: selectedEvent.dados_depois,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
