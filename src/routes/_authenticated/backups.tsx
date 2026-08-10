import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  generateMatrizBackup,
  getBackupsList,
  getBackupById,
  deleteBackup,
} from "@/lib/backups.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Download,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { db } from "@/integrations/database/client";

export const Route = createFileRoute("/_authenticated/backups")({
  component: BackupsPage,
});

function BackupsPage() {
  const qc = useQueryClient();
  const getListFn = useServerFn(getBackupsList);
  const getBackupFn = useServerFn(getBackupById);
  const generateFn = useServerFn(generateMatrizBackup);
  const deleteFn = useServerFn(deleteBackup);

  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "inativo">("todos");
  const [reveal, setReveal] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Check user admin status
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

  // List backups
  const { data: backupsList = [], isLoading: loadingList } = useQuery({
    queryKey: ["backups-list"],
    queryFn: async () => {
      const list = await getListFn();
      if (list && list.length > 0 && !selectedBackupId) {
        setSelectedBackupId(list[0].id);
      }
      return list ?? [];
    },
  });

  // Selected backup detail
  const { data: selectedBackup, isLoading: loadingBackup } = useQuery({
    queryKey: ["backup-detail", selectedBackupId],
    enabled: !!selectedBackupId,
    queryFn: async () => {
      if (!selectedBackupId) return null;
      return await getBackupFn({ data: { id: selectedBackupId } });
    },
  });

  // Generate backup mutation
  const generateMutation = useMutation({
    mutationFn: async (tipo: "manual" | "semanal" = "manual") => {
      return await generateFn({ data: { tipo } });
    },
    onSuccess: (newBk) => {
      toast.success("Backup da Matriz gerado com sucesso!");
      qc.invalidateQueries({ queryKey: ["backups-list"] });
      if (newBk?.id) setSelectedBackupId(newBk.id);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao gerar backup"),
  });

  // Delete backup mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteFn({ data: { id } });
    },
    onSuccess: () => {
      toast.success("Backup excluído com sucesso");
      setSelectedBackupId(null);
      qc.invalidateQueries({ queryKey: ["backups-list"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao excluir backup"),
  });

  const sistemas = selectedBackup?.sistemas_json ?? [];
  const snapshotData: any[] = selectedBackup?.dados_json ?? [];

  // Filter snapshot data
  const filteredData = snapshotData.filter((row: any) => {
    // Status filter
    if (statusFilter === "ativo" && row.status !== "Ativo") return false;
    if (statusFilter === "inativo" && row.status === "Ativo") return false;

    // Search query
    if (q.trim()) {
      const searchStr = q.toLowerCase();
      const matchBasic =
        row.nome?.toLowerCase().includes(searchStr) ||
        row.cpf?.includes(searchStr) ||
        row.email?.toLowerCase().includes(searchStr) ||
        row.cargo?.toLowerCase().includes(searchStr) ||
        row.operacao_nome?.toLowerCase().includes(searchStr);

      if (matchBasic) return true;

      // Check system access logins
      for (const sis of sistemas) {
        const acc = row.sistemas_acessos?.[sis.id];
        if (acc?.usuario?.toLowerCase().includes(searchStr)) return true;
      }
      return false;
    }

    return true;
  });

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredData.length / pageSize);
  const currentPageData =
    pageSize === 0 ? filteredData : filteredData.slice((page - 1) * pageSize, page * pageSize);

  // Export to Excel
  const exportToExcel = () => {
    if (!selectedBackup) return;

    const exportRows = filteredData.map((row: any) => {
      const baseObj: Record<string, any> = {
        "Data do Layout": row.data_layout || selectedBackup.data_layout,
        Colaborador: row.nome,
        CPF: row.cpf,
        "Data Nascimento": row.data_nascimento,
        "E-mail": row.email,
        "Senha E-mail": row.email_senha,
        Telefone: row.telefone,
        Cargo: row.cargo,
        Operação: row.operacao_nome,
        "Status do Operador": row.status,
        "Data de Inativação": row.inativado_em || "-",
      };

      for (const sis of sistemas) {
        const acc = row.sistemas_acessos?.[sis.id];
        baseObj[`${sis.nome} (Usuário)`] = acc?.usuario || "";
        baseObj[`${sis.nome} (Senha)`] = acc?.senha || "";
      }

      return baseObj;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, "Backup Matriz");
    XLSX.writeFile(wb, `Backup_Matriz_${selectedBackup.data_layout.replace(/[/ :]/g, "_")}.xlsx`);
  };

  const activeBk = backupsList.find((b: any) => b.id === selectedBackupId);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1700px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="h-7 w-7 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Backup da Matriz de Acessos
            </h1>
          </div>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Histórico unificado de operadores ativos e inativos com data de layout e inativação.
            <span className="font-semibold text-primary ml-1">
              (Agendado automaticamente toda Sexta-feira às 18:00)
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => generateMutation.mutate("manual")}
            disabled={generateMutation.isPending}
            className="gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {generateMutation.isPending ? "Gerando Backup..." : "Gerar Backup Agora"}
          </Button>

          {selectedBackup && (
            <Button variant="outline" onClick={exportToExcel} className="gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Exportar Excel
            </Button>
          )}

          {isAdmin && selectedBackupId && (
            <Button
              variant="destructive"
              size="icon"
              title="Excluir este Backup"
              onClick={() => {
                if (confirm("Tem certeza que deseja excluir este instantâneo de backup?")) {
                  deleteMutation.mutate(selectedBackupId);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-[#10b981] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total de Backups
              </p>
              <p className="text-2xl font-bold mt-1">{backupsList.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Disponíveis na plataforma</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Archive className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Layout do Backup
              </p>
              <p className="text-lg font-bold mt-1 text-primary truncate max-w-[180px]">
                {activeBk?.data_layout || "Nenhum selecionado"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tipo:{" "}
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {activeBk?.tipo || "-"}
                </Badge>
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Operadores no Backup
              </p>
              <p className="text-2xl font-bold mt-1">{activeBk?.total_colaboradores ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="text-emerald-600 font-semibold">
                  {activeBk?.total_ativos ?? 0} Ativos
                </span>{" "}
                •{" "}
                <span className="text-amber-600 font-semibold">
                  {activeBk?.total_inativos ?? 0} Inativos
                </span>
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Próximo Backup
              </p>
              <p className="text-sm font-semibold mt-1">Sexta-feira às 18:00</p>
              <p className="text-xs text-muted-foreground mt-0.5">Rotina Semanal Automática</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600">
              <Calendar className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup Selector & Controls */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="min-w-[140px] text-sm font-medium">Selecionar Backup:</div>
              <Select
                value={selectedBackupId ?? ""}
                onValueChange={(val) => {
                  setSelectedBackupId(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="max-w-md w-full bg-background">
                  <SelectValue placeholder="Escolha um backup para visualizar..." />
                </SelectTrigger>
                <SelectContent>
                  {backupsList.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      🗓️ {b.data_layout} — {b.descricao} ({b.total_colaboradores} reg.)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Status Filters */}
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg">
              <Button
                size="sm"
                variant={statusFilter === "todos" ? "default" : "ghost"}
                className="text-xs h-8"
                onClick={() => {
                  setStatusFilter("todos");
                  setPage(1);
                }}
              >
                Todos ({snapshotData.length})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "ativo" ? "default" : "ghost"}
                className="text-xs h-8 gap-1"
                onClick={() => {
                  setStatusFilter("ativo");
                  setPage(1);
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Ativos ({snapshotData.filter((r) => r.status === "Ativo").length})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "inativo" ? "default" : "ghost"}
                className="text-xs h-8 gap-1"
                onClick={() => {
                  setStatusFilter("inativo");
                  setPage(1);
                }}
              >
                <XCircle className="h-3.5 w-3.5 text-amber-500" />
                Inativos ({snapshotData.filter((r) => r.status !== "Ativo").length})
              </Button>
            </div>
          </div>

          {/* Search bar & password reveal */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/40">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF, e-mail, cargo..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="flex items-center justify-between w-full sm:w-auto gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReveal((r) => !r)}
                className="gap-2 text-xs h-9"
              >
                {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {reveal ? "Ocultar Senhas" : "Exibir Senhas"}
              </Button>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Exibir:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[80px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="0">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Unified Table */}
      {!selectedBackupId && backupsList.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="max-w-md mx-auto space-y-4">
            <Archive className="h-12 w-12 text-muted-foreground/60 mx-auto" />
            <h2 className="text-xl font-bold">Nenhum backup encontrado</h2>
            <p className="text-sm text-muted-foreground">
              Você pode gerar um primeiro backup instantâneo da Matriz agora mesmo clicando no botão
              abaixo.
            </p>
            <Button
              onClick={() => generateMutation.mutate("manual")}
              disabled={generateMutation.isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {generateMutation.isPending ? "Gerando Backup..." : "Gerar Primeiro Backup Agora"}
            </Button>
          </div>
        </Card>
      ) : loadingBackup ? (
        <Card className="p-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-3">Carregando dados do backup...</p>
        </Card>
      ) : (
        <Card className="shadow-sm border-border/80 overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/80 sticky top-0 z-10 backdrop-blur-xs border-b border-border font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 whitespace-nowrap min-w-[130px] border-r border-border/50">
                    Data do Layout
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[200px] border-r border-border/50">
                    Colaborador
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[110px] border-r border-border/50">
                    CPF
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[100px] border-r border-border/50">
                    Data Nasc.
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[180px] border-r border-border/50">
                    E-mail
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[120px] border-r border-border/50">
                    Senha E-mail
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[120px] border-r border-border/50">
                    Telefone
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[140px] border-r border-border/50">
                    Cargo
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[140px] border-r border-border/50">
                    Operação
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[120px] border-r border-border/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                    Status Operador
                  </th>
                  <th className="p-3 whitespace-nowrap min-w-[130px] border-r border-border/50 bg-red-500/10 text-red-900 dark:text-red-200">
                    Data Inativação
                  </th>
                  {sistemas.map((s: any) => (
                    <th
                      key={s.id}
                      className="p-3 whitespace-nowrap min-w-[140px] border-r border-border/50 text-center"
                    >
                      {s.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {currentPageData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11 + sistemas.length}
                      className="p-8 text-center text-muted-foreground"
                    >
                      Nenhum registro encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  currentPageData.map((row: any, idx: number) => {
                    const isAtivo = row.status === "Ativo";
                    return (
                      <tr
                        key={row.colaborador_id || idx}
                        className={`hover:bg-muted/40 transition-colors ${
                          !isAtivo ? "bg-amber-500/5 dark:bg-amber-500/10" : ""
                        }`}
                      >
                        {/* Data do Layout */}
                        <td className="p-3 whitespace-nowrap font-mono text-[11px] border-r border-border/40 text-muted-foreground">
                          {row.data_layout || selectedBackup?.data_layout}
                        </td>

                        {/* Nome */}
                        <td className="p-3 whitespace-nowrap font-medium border-r border-border/40">
                          {row.nome}
                        </td>

                        {/* CPF */}
                        <td className="p-3 whitespace-nowrap font-mono text-[11px] border-r border-border/40 text-muted-foreground">
                          {row.cpf || "-"}
                        </td>

                        {/* Data Nasc */}
                        <td className="p-3 whitespace-nowrap border-r border-border/40 text-muted-foreground">
                          {row.data_nascimento || "-"}
                        </td>

                        {/* Email */}
                        <td className="p-3 whitespace-nowrap border-r border-border/40 font-mono text-[11px]">
                          {row.email || "-"}
                        </td>

                        {/* Senha Email */}
                        <td className="p-3 whitespace-nowrap border-r border-border/40 font-mono text-[11px]">
                          {row.email_senha ? (
                            reveal ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {row.email_senha}
                              </span>
                            ) : (
                              "••••••••"
                            )
                          ) : (
                            "-"
                          )}
                        </td>

                        {/* Telefone */}
                        <td className="p-3 whitespace-nowrap border-r border-border/40 text-muted-foreground">
                          {row.telefone || "-"}
                        </td>

                        {/* Cargo */}
                        <td className="p-3 whitespace-nowrap border-r border-border/40 text-muted-foreground">
                          {row.cargo || "-"}
                        </td>

                        {/* Operacao */}
                        <td className="p-3 whitespace-nowrap border-r border-border/40 text-muted-foreground">
                          {row.operacao_nome || "-"}
                        </td>

                        {/* Status Operador */}
                        <td className="p-3 whitespace-nowrap border-r border-border/40">
                          {isAtivo ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 gap-1 font-normal">
                              <CheckCircle2 className="h-3 w-3" /> Ativo
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 font-normal">
                              <XCircle className="h-3 w-3" /> Inativo
                            </Badge>
                          )}
                        </td>

                        {/* Data Inativação */}
                        <td className="p-3 whitespace-nowrap border-r border-border/40 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                          {!isAtivo && row.inativado_em !== "-" ? (
                            <span className="font-semibold">{row.inativado_em}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>

                        {/* System columns */}
                        {sistemas.map((s: any) => {
                          const acc = row.sistemas_acessos?.[s.id];
                          const hasAcc = acc && (acc.usuario || acc.senha);
                          return (
                            <td
                              key={s.id}
                              className="p-2 whitespace-nowrap border-r border-border/40 text-center font-mono text-[11px]"
                            >
                              {hasAcc ? (
                                <div className="p-1.5 bg-muted/50 rounded border border-border/50 text-left space-y-0.5">
                                  {acc.usuario && (
                                    <div className="truncate max-w-[120px]">
                                      <span className="text-[10px] text-muted-foreground mr-1">
                                        u:
                                      </span>
                                      <span className="font-medium">{acc.usuario}</span>
                                    </div>
                                  )}
                                  {acc.senha && (
                                    <div className="truncate max-w-[120px] text-[10px]">
                                      <span className="text-muted-foreground mr-1">p:</span>
                                      {reveal ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                          {acc.senha}
                                        </span>
                                      ) : (
                                        "••••••"
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/50">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          {filteredData.length > 0 && (
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground bg-muted/20">
              <div>
                Exibindo{" "}
                <span className="font-medium text-foreground">
                  {pageSize === 0
                    ? filteredData.length
                    : Math.min((page - 1) * pageSize + 1, filteredData.length)}
                </span>{" "}
                a{" "}
                <span className="font-medium text-foreground">
                  {pageSize === 0
                    ? filteredData.length
                    : Math.min(page * pageSize, filteredData.length)}
                </span>{" "}
                de <span className="font-medium text-foreground">{filteredData.length}</span>{" "}
                registros
              </div>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 text-xs"
                  >
                    Anterior
                  </Button>
                  <span>
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 text-xs"
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
