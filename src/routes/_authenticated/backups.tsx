import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  generateSistemaBackup,
  getSistemaBackup,
  deleteSistemaBackup,
} from "@/lib/backups.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Archive,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Calendar,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Plus,
  FileSpreadsheet,
  Download,
  Database,
  Layers,
  Sparkles,
  Key,
  FolderGit2,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { db } from "@/integrations/database/client";

export const Route = createFileRoute("/_authenticated/backups")({
  component: BackupsPage,
});

type GuiaTab =
  "matriz" | "colaboradores" | "sistemas" | "acessos" | "pendencias" | "operacoes" | "chamados";

function BackupsPage() {
  const qc = useQueryClient();
  const [activeGuia, setActiveGuia] = useState<GuiaTab>("matriz");

  const getBackupFn = useServerFn(getSistemaBackup);
  const generateFn = useServerFn(generateSistemaBackup);
  const deleteFn = useServerFn(deleteSistemaBackup);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "inativo">("todos");
  const [reveal, setReveal] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Check admin
  const { data: me } = useQuery({
    queryKey: ["me-backups"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return null;
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
      return { user: u.user, roles: roles?.map((r) => r.role) ?? [] };
    },
  });

  const isAdmin =
    (me?.roles ?? []).includes("admin_master") ||
    (me?.roles ?? []).includes("admin") ||
    me?.user?.role === "admin_master";

  // Active Daily Backup from Database
  const {
    data: backup,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["sistema-backup-diario"],
    queryFn: async () => {
      let b = await getBackupFn();
      // Auto-generate if no backup exists yet
      if (!b) {
        try {
          b = await generateFn({ data: { tipo: "diario" } });
        } catch (_e) {
          // ignore
        }
      }
      return b;
    },
  });

  // Mutation to manually regenerate / replace backup in DB
  const generateMutation = useMutation({
    mutationFn: async () => {
      return await generateFn({
        data: {
          tipo: "diario",
          substituirAnterior: true,
        },
      });
    },
    onSuccess: () => {
      toast.success("Backup do Sistema atualizado com sucesso no banco de dados!");
      qc.invalidateQueries({ queryKey: ["sistema-backup-diario"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao gerar backup"),
  });

  // Mutation to delete backup
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Backup removido do banco de dados");
      qc.invalidateQueries({ queryKey: ["sistema-backup-diario"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir backup"),
  });

  // Data sets from the snapshot
  const matrizSistemas: any[] = backup?.matriz_json?.sistemas ?? [];
  const matrizRows: any[] = backup?.matriz_json?.rows ?? [];
  const colabsRows: any[] = backup?.colaboradores_json ?? [];
  const sistemasRows: any[] = backup?.sistemas_json ?? [];
  const acessosRows: any[] = backup?.acessos_json ?? [];
  const pendenciasRows: any[] = backup?.pendencias_json ?? [];
  const operacoesRows: any[] = backup?.operacoes_json ?? [];
  const chamadosRows: any[] = backup?.chamados_json ?? [];

  // Filter current active tab data
  const getFilteredGuiaData = () => {
    const search = q.trim().toLowerCase();
    switch (activeGuia) {
      case "matriz":
        return matrizRows.filter((r) => {
          if (statusFilter === "ativo" && r.status !== "Ativo") return false;
          if (statusFilter === "inativo" && r.status === "Ativo") return false;
          if (!search) return true;
          const matchBasic =
            r.nome?.toLowerCase().includes(search) ||
            r.cpf?.includes(search) ||
            r.email?.toLowerCase().includes(search) ||
            r.cargo?.toLowerCase().includes(search) ||
            r.operacao_nome?.toLowerCase().includes(search);
          if (matchBasic) return true;
          for (const sis of matrizSistemas) {
            const acc = r.sistemas_acessos?.[sis.id];
            if (acc?.usuario?.toLowerCase().includes(search)) return true;
          }
          return false;
        });

      case "colaboradores":
        return colabsRows.filter((r) => {
          if (statusFilter === "ativo" && r.status !== "ativo") return false;
          if (statusFilter === "inativo" && r.status === "ativo") return false;
          if (!search) return true;
          return (
            r.nome?.toLowerCase().includes(search) ||
            r.cpf?.includes(search) ||
            r.email?.toLowerCase().includes(search) ||
            r.cargo?.toLowerCase().includes(search) ||
            r.operacao?.toLowerCase().includes(search)
          );
        });

      case "sistemas":
        return sistemasRows.filter((r) => {
          if (!search) return true;
          return (
            r.nome?.toLowerCase().includes(search) ||
            r.categoria?.toLowerCase().includes(search) ||
            r.criticidade?.toLowerCase().includes(search)
          );
        });

      case "acessos":
        return acessosRows.filter((r) => {
          if (!search) return true;
          return (
            r.colaborador_nome?.toLowerCase().includes(search) ||
            r.colaborador_cpf?.includes(search) ||
            r.sistema_nome?.toLowerCase().includes(search) ||
            r.login?.toLowerCase().includes(search)
          );
        });

      case "pendencias":
        return pendenciasRows.filter((r) => {
          if (!search) return true;
          return (
            r.titulo?.toLowerCase().includes(search) ||
            r.colaborador_nome?.toLowerCase().includes(search) ||
            r.sistema_nome?.toLowerCase().includes(search) ||
            r.status?.toLowerCase().includes(search)
          );
        });

      case "operacoes":
        return operacoesRows.filter((r) => {
          if (!search) return true;
          return r.nome?.toLowerCase().includes(search);
        });

      case "chamados":
        return chamadosRows.filter((r) => {
          if (!search) return true;
          return (
            r.titulo?.toLowerCase().includes(search) ||
            r.sistema_nome?.toLowerCase().includes(search) ||
            r.operador_nome?.toLowerCase().includes(search)
          );
        });

      default:
        return [];
    }
  };

  const filteredData = getFilteredGuiaData();
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredData.length / pageSize);
  const currentPageData =
    pageSize === 0 ? filteredData : filteredData.slice((page - 1) * pageSize, page * pageSize);

  // 1. Export COMPLETE MULTI-TAB WORKBOOK (ALL GUIDES)
  const exportFullWorkbook = () => {
    if (!backup) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Matriz
    const matrizExport = matrizRows.map((r: any) => {
      const obj: Record<string, any> = {
        Colaborador: r.nome,
        CPF: r.cpf,
        "Data Nascimento": r.data_nascimento,
        "E-mail": r.email,
        "Senha E-mail": r.email_senha,
        Telefone: r.telefone,
        Cargo: r.cargo,
        Operação: r.operacao_nome,
        Status: r.status,
        "Data Inativação": r.inativado_em || "-",
      };
      for (const sis of matrizSistemas) {
        const acc = r.sistemas_acessos?.[sis.id];
        obj[`${sis.nome} (Usuário)`] = acc?.usuario || "";
        obj[`${sis.nome} (Senha)`] = acc?.senha || "";
      }
      return obj;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matrizExport), "Matriz de Acessos");

    // Sheet 2: Colaboradores
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colabsRows), "Colaboradores");

    // Sheet 3: Credenciais
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(acessosRows),
      "Credenciais & Acessos",
    );

    // Sheet 4: Sistemas
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sistemasRows), "Sistemas");

    // Sheet 5: Pendencias
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(pendenciasRows),
      "Processos & Pendências",
    );

    // Sheet 6: Operações
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(operacoesRows), "Operações");

    // Sheet 7: Chamados
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chamadosRows), "Chamados de Suporte");

    const safeDate = (backup.data_layout || "diario").replace(/[/ :]/g, "_");
    XLSX.writeFile(wb, `Backup_Completo_Sistema_${safeDate}.xlsx`);
    toast.success("Planilha completa com todas as 7 guias baixada com sucesso!");
  };

  // 2. Export ONLY ACTIVE GUIA (.XLSX)
  const exportActiveGuiaXlsx = () => {
    if (!backup) return;
    const wb = XLSX.utils.book_new();
    const dataToExport = filteredData;
    let sheetName = "Guia";

    if (activeGuia === "matriz") {
      sheetName = "Matriz";
      const customRows = dataToExport.map((r: any) => {
        const obj: Record<string, any> = {
          Colaborador: r.nome,
          CPF: r.cpf,
          "Data Nascimento": r.data_nascimento,
          "E-mail": r.email,
          "Senha E-mail": r.email_senha,
          Telefone: r.telefone,
          Cargo: r.cargo,
          Operação: r.operacao_nome,
          Status: r.status,
        };
        for (const sis of matrizSistemas) {
          const acc = r.sistemas_acessos?.[sis.id];
          obj[`${sis.nome} (Usuário)`] = acc?.usuario || "";
          obj[`${sis.nome} (Senha)`] = acc?.senha || "";
        }
        return obj;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customRows), sheetName);
    } else {
      sheetName = activeGuia.charAt(0).toUpperCase() + activeGuia.slice(1);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataToExport), sheetName);
    }

    const safeDate = (backup.data_layout || "diario").replace(/[/ :]/g, "_");
    XLSX.writeFile(wb, `Backup_${sheetName}_${safeDate}.xlsx`);
    toast.success(`Guia "${sheetName}" exportada com sucesso!`);
  };

  // 3. Export ONLY ACTIVE GUIA (.CSV)
  const exportActiveGuiaCsv = () => {
    if (!backup) return;
    const dataToExport = filteredData;
    let ws: XLSX.WorkSheet;

    if (activeGuia === "matriz") {
      const customRows = dataToExport.map((r: any) => {
        const obj: Record<string, any> = {
          Colaborador: r.nome,
          CPF: r.cpf,
          "Data Nascimento": r.data_nascimento,
          "E-mail": r.email,
          "Senha E-mail": r.email_senha,
          Telefone: r.telefone,
          Cargo: r.cargo,
          Operação: r.operacao_nome,
          Status: r.status,
        };
        for (const sis of matrizSistemas) {
          const acc = r.sistemas_acessos?.[sis.id];
          obj[`${sis.nome} (Usuário)`] = acc?.usuario || "";
          obj[`${sis.nome} (Senha)`] = acc?.senha || "";
        }
        return obj;
      });
      ws = XLSX.utils.json_to_sheet(customRows);
    } else {
      ws = XLSX.utils.json_to_sheet(dataToExport);
    }

    const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeDate = (backup.data_layout || "diario").replace(/[/ :]/g, "_");
    link.setAttribute("href", url);
    link.setAttribute("download", `Backup_${activeGuia}_${safeDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Guia "${activeGuia}" exportada em CSV com sucesso!`);
  };

  const guiasConfig: { id: GuiaTab; label: string; count: number; icon: any }[] = [
    { id: "matriz", label: "Matriz Geral", count: matrizRows.length, icon: Layers },
    { id: "colaboradores", label: "Colaboradores", count: colabsRows.length, icon: Users },
    { id: "sistemas", label: "Sistemas & Apps", count: sistemasRows.length, icon: FolderGit2 },
    { id: "acessos", label: "Credenciais & Senhas", count: acessosRows.length, icon: Key },
    {
      id: "pendencias",
      label: "Pendências & Processos",
      count: pendenciasRows.length,
      icon: Clock,
    },
    { id: "operacoes", label: "Operações", count: operacoesRows.length, icon: ShieldCheck },
    { id: "chamados", label: "Chamados / Suporte", count: chamadosRows.length, icon: Ticket },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1750px] mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-7 w-7 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Backup Diário do Sistema (Em Banco)
            </h1>
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-medium"
            >
              <Sparkles className="h-3 w-3 mr-1" /> Substituição Ativa
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Backup consolidado de todas as guias e tabelas em banco de dados. O backup mais recente
            substitui o anterior diariamente para manter o banco leve.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2 shadow-sm bg-primary hover:bg-primary/90 text-white"
          >
            <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            {generateMutation.isPending
              ? "Substituindo Backup..."
              : "Gerar / Substituir Backup Agora"}
          </Button>

          {backup && (
            <>
              <Button
                variant="outline"
                onClick={exportFullWorkbook}
                className="gap-2 border-emerald-600/30 text-emerald-800 hover:bg-emerald-50 bg-emerald-50/50"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Baixar Planilha Completa (7 Guias .XLSX)
              </Button>

              <Button variant="outline" onClick={exportActiveGuiaXlsx} className="gap-2">
                <Download className="h-4 w-4 text-blue-600" />
                Baixar Esta Guia (.XLSX)
              </Button>

              <Button
                variant="ghost"
                onClick={exportActiveGuiaCsv}
                className="gap-1.5 text-xs text-muted-foreground"
              >
                Baixar Guia (.CSV)
              </Button>
            </>
          )}

          {isAdmin && backup && (
            <Button
              variant="destructive"
              size="icon"
              title="Limpar Backup do Banco"
              onClick={() => {
                if (confirm("Deseja realmente limpar o snapshot de backup do banco?")) {
                  deleteMutation.mutate(backup.id);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Snapshot Info Card */}
      <Card className="bg-gradient-to-r from-muted/40 via-muted/20 to-background border-border shadow-xs">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {backup?.descricao || "Backup Diário em Banco"}
                </span>
                <Badge variant="secondary" className="text-[11px]">
                  {backup?.data_layout
                    ? `Atualizado em ${backup.data_layout}`
                    : "Aguardando geração"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Política de Retenção: <strong>1 Snapshot Ativo</strong> (substituição contínua sem
                inchar tabelas).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="text-right">
              <span className="font-semibold text-foreground block text-sm">
                {(backup?.total_colaboradores ?? 0) +
                  (backup?.total_sistemas ?? 0) +
                  (backup?.total_acessos ?? 0) +
                  (backup?.total_pendencias ?? 0)}
              </span>
              <span>Total de Registros</span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-right">
              <span className="font-semibold text-emerald-600 block text-sm">
                {backup?.total_ativos ?? 0}
              </span>
              <span>Colabs Ativos</span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-right">
              <span className="font-semibold text-blue-600 block text-sm">
                {backup?.total_pendencias ?? 0}
              </span>
              <span>Pendências</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guias Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-border">
        {guiasConfig.map((g) => {
          const Icon = g.icon;
          const isActive = activeGuia === g.id;
          return (
            <button
              key={g.id}
              onClick={() => {
                setActiveGuia(g.id);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{g.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-white/20 text-white" : "bg-background text-muted-foreground"
                }`}
              >
                {g.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <Card className="shadow-xs border-border/60">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Pesquisar em ${activeGuia}...`}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>

            {(activeGuia === "matriz" || activeGuia === "colaboradores") && (
              <Select
                value={statusFilter}
                onValueChange={(v: any) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Apenas Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {activeGuia === "matriz" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReveal(!reveal)}
                className="gap-2"
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {reveal ? "Ocultar Senhas" : "Ver Senhas"}
              </Button>
            )}

            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 por pág.</SelectItem>
                <SelectItem value="50">50 por pág.</SelectItem>
                <SelectItem value="100">100 por pág.</SelectItem>
                <SelectItem value="0">Ver Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Viewer */}
      <Card className="shadow-xs border-border/80 overflow-hidden">
        <div className="overflow-x-auto">
          {activeGuia === "matriz" && (
            <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
              <thead className="bg-muted/70 uppercase text-[10px] font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3 sticky left-0 bg-muted/90 z-10">Colaborador</th>
                  <th className="p-3">CPF</th>
                  <th className="p-3">Cargo</th>
                  <th className="p-3">Operação</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">E-mail Corporativo</th>
                  {matrizSistemas.map((sis: any) => (
                    <th key={sis.id} className="p-3 text-center border-l border-border/50">
                      {sis.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentPageData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6 + matrizSistemas.length}
                      className="p-8 text-center text-muted-foreground"
                    >
                      Nenhum registro encontrado neste snapshot.
                    </td>
                  </tr>
                ) : (
                  currentPageData.map((row: any, idx: number) => (
                    <tr key={row.colaborador_id || idx} className="hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground sticky left-0 bg-background/95">
                        {row.nome}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono">{row.cpf || "-"}</td>
                      <td className="p-3 text-muted-foreground">{row.cargo || "-"}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {row.operacao_nome || "Sem operação"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={row.status === "Ativo" ? "default" : "secondary"}
                          className={`text-[10px] ${row.status === "Ativo" ? "bg-emerald-600 text-white" : ""}`}
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        <div>{row.email || "-"}</div>
                        {reveal && row.email_senha && (
                          <div className="text-[10px] text-amber-600 font-mono">
                            🔑 {row.email_senha}
                          </div>
                        )}
                      </td>
                      {matrizSistemas.map((sis: any) => {
                        const acc = row.sistemas_acessos?.[sis.id];
                        return (
                          <td key={sis.id} className="p-3 text-center border-l border-border/30">
                            {acc?.usuario ? (
                              <div className="space-y-0.5">
                                <div className="font-mono text-[11px] font-medium">
                                  {acc.usuario}
                                </div>
                                {reveal && acc.senha && (
                                  <div className="text-[10px] text-amber-600 font-mono">
                                    {acc.senha}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeGuia === "colaboradores" && (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/70 uppercase text-[10px] font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">CPF</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3">Telefone</th>
                  <th className="p-3">Cargo</th>
                  <th className="p-3">Operação</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Nascimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentPageData.map((c: any, i: number) => (
                  <tr key={c.id || i} className="hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">{c.nome}</td>
                    <td className="p-3 font-mono text-muted-foreground">{c.cpf || "-"}</td>
                    <td className="p-3 text-muted-foreground">{c.email || "-"}</td>
                    <td className="p-3 text-muted-foreground">{c.telefone || "-"}</td>
                    <td className="p-3 text-muted-foreground">{c.cargo || "-"}</td>
                    <td className="p-3">{c.operacao}</td>
                    <td className="p-3">
                      <Badge variant={c.status === "ativo" ? "default" : "secondary"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.data_nascimento || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeGuia === "sistemas" && (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/70 uppercase text-[10px] font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Nome do Sistema</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Criticidade</th>
                  <th className="p-3">URL</th>
                  <th className="p-3">Ativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentPageData.map((s: any, i: number) => (
                  <tr key={s.id || i} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold text-foreground">{s.nome}</td>
                    <td className="p-3 text-muted-foreground">{s.categoria}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {s.criticidade}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground truncate max-w-[200px]">
                      {s.url || "-"}
                    </td>
                    <td className="p-3">{s.ativo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeGuia === "acessos" && (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/70 uppercase text-[10px] font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">CPF</th>
                  <th className="p-3">Sistema</th>
                  <th className="p-3">Perfil</th>
                  <th className="p-3">Login / Usuário</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentPageData.map((a: any, i: number) => (
                  <tr key={a.id || i} className="hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">{a.colaborador_nome}</td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {a.colaborador_cpf || "-"}
                    </td>
                    <td className="p-3 font-semibold text-foreground">{a.sistema_nome}</td>
                    <td className="p-3 text-muted-foreground">{a.perfil_nome}</td>
                    <td className="p-3 font-mono font-medium">{a.login || "-"}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">
                        {a.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeGuia === "pendencias" && (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/70 uppercase text-[10px] font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Título</th>
                  <th className="p-3">Colaborador</th>
                  <th className="p-3">Sistema</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3">Status / Quadro</th>
                  <th className="p-3">Data Início</th>
                  <th className="p-3">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentPageData.map((p: any, i: number) => (
                  <tr key={p.id || i} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold text-foreground">{p.titulo}</td>
                    <td className="p-3 text-muted-foreground">{p.colaborador_nome}</td>
                    <td className="p-3 text-muted-foreground">{p.sistema_nome}</td>
                    <td className="p-3">{p.tipo}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">
                        {p.prioridade}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className="text-[10px]">{p.status}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{p.data_inicio || "-"}</td>
                    <td className="p-3 text-muted-foreground">{p.sla_em || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeGuia === "operacoes" && (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/70 uppercase text-[10px] font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Nome da Operação</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Ativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentPageData.map((o: any, i: number) => (
                  <tr key={o.id || i} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold text-foreground">{o.nome}</td>
                    <td className="p-3 text-muted-foreground">{o.descricao || "-"}</td>
                    <td className="p-3">{o.ativo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeGuia === "chamados" && (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/70 uppercase text-[10px] font-semibold text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3">Título</th>
                  <th className="p-3">Sistema</th>
                  <th className="p-3">Operador</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentPageData.map((ch: any, i: number) => (
                  <tr key={ch.id || i} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold text-foreground">{ch.titulo}</td>
                    <td className="p-3 text-muted-foreground">{ch.sistema_nome}</td>
                    <td className="p-3 text-muted-foreground">{ch.operador_nome}</td>
                    <td className="p-3">{ch.tipo}</td>
                    <td className="p-3">
                      <Badge variant="outline">{ch.status}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">{ch.criado_em}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Mostrando {currentPageData.length} de {filteredData.length} registros
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <span className="font-medium text-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
