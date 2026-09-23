import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { db } from "@/integrations/database/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table2,
  Plus,
  Search,
  FileSpreadsheet,
  Trash2,
  Edit2,
  Check,
  Copy,
  Shield,
  UserCheck,
  Layers,
  Sparkles,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Settings2,
  Filter,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pendencias-pine")({
  component: PendenciasPinePage,
});

// Formatters
function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return cpf;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const raw = dateStr.split("T")[0];
    const parts = raw.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

const PRESET_FUNCOES = [
  "CRIAÇÃO",
  "DESBLOQUEIO DE ACESSO",
  "ERRO DE ACESSO - SEM FUNCIONALIDADES",
  "REDEFINIR SENHA",
  "DESLIGAMENTO",
  "-",
];

function getFuncaoBadgeStyle(funcao: string) {
  const f = (funcao || "").toUpperCase().trim();
  if (f === "CRIAÇÃO") {
    return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800";
  }
  if (f === "DESBLOQUEIO DE ACESSO") {
    return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800";
  }
  if (f.includes("ERRO")) {
    return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800";
  }
  if (f.includes("SENHA")) {
    return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800";
  }
  if (f.includes("DESLIGAMENTO")) {
    return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800";
  }
  if (f === "-" || !f) {
    return "bg-muted text-muted-foreground border-border";
  }
  return "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800";
}

export function PendenciasPinePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // 1. Current user session & roles
  const { data: me, isLoading: loadingMe } = useQuery({
    queryKey: ["current-user-me"],
    queryFn: async () => {
      const { data } = await db.auth.getUser();
      if (!data?.user) return null;
      let roles: any = [];
      try {
        const { data: fetchedRoles } = await db
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        roles = fetchedRoles || [];
      } catch (_e) {
        // ignore
      }
      const { data: profile } = await db
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();
      const roleList = (roles ?? []).map((r: any) => r.role);
      if (data.user.role && !roleList.includes(data.user.role)) {
        roleList.push(data.user.role);
      }
      return {
        user: data.user,
        roles: roleList,
        profile,
      };
    },
  });

  const roles = (me?.roles ?? []) as string[];
  const userRole = me?.user?.role;
  const isAdmin =
    roles.some((r) => r === "admin" || r === "admin_master") ||
    userRole === "admin" ||
    userRole === "admin_master";
  const isCliente = (roles.includes("cliente") || userRole === "cliente") && !isAdmin;
  const hasAccess = isAdmin || isCliente;

  // 2. Systems selected as columns in Pine table
  const { data: pineSistemas = [], isLoading: loadingSistemas } = useQuery({
    queryKey: ["pendencias_pine_sistemas"],
    queryFn: async () => {
      const { data, error } = await db
        .from("pendencias_pine_sistemas")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: hasAccess,
  });

  // 3. Catalog Systems (from the "Sistemas" tab in the system)
  const { data: catalogSistemas = [] } = useQuery({
    queryKey: ["catalog_sistemas_pine"],
    queryFn: async () => {
      const { data, error } = await db.from("sistemas").select("id, nome, categoria").order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // 4. Pendencias Pine rows (each row is a Collaborator)
  const { data: pendencias = [], isLoading: loadingPendencias } = useQuery({
    queryKey: ["pendencias_pine"],
    queryFn: async () => {
      const { data, error } = await db
        .from("pendencias_pine")
        .select(
          "*, colaborador:colaboradores(id, nome, cpf, data_nascimento, email, telefone, cargo, status)",
        )
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: hasAccess,
  });

  // 5. Collaborators from Matriz Principal
  const { data: allColaboradores = [] } = useQuery({
    queryKey: ["colaboradores_para_pine"],
    queryFn: async () => {
      const { data } = await db
        .from("colaboradores")
        .select("id, nome, cpf, data_nascimento, email, telefone, cargo, status")
        .eq("status", "ativo")
        .order("nome");
      return data || [];
    },
    enabled: isAdmin,
  });

  // Filters & Search
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  const filteredRows = useMemo(() => {
    let result = [...pendencias];
    const s = search.trim().toLowerCase();

    if (s) {
      const sClean = s.replace(/\D/g, "");
      result = result.filter((item: any) => {
        const nome = (item.colaborador?.nome || "").toLowerCase();
        const cpf = (item.colaborador?.cpf || "").replace(/\D/g, "");
        const email = (item.colaborador?.email || "").toLowerCase();
        const chamado = (item.numero_chamado || "").toLowerCase();
        const obs = (item.observacao || "").toLowerCase();

        // Check if search matches any system status in this row
        const sistemasVals = Object.values(item.sistemas_valores || {})
          .join(" ")
          .toLowerCase();

        return (
          nome.includes(s) ||
          (sClean && cpf.includes(sClean)) ||
          email.includes(s) ||
          chamado.includes(s) ||
          obs.includes(s) ||
          sistemasVals.includes(s)
        );
      });
    }

    if (filterStatus !== "todos") {
      result = result.filter((item: any) => {
        const vals = Object.values(item.sistemas_valores || {}).map((v: any) =>
          String(v).toUpperCase().trim(),
        );
        return vals.includes(filterStatus.toUpperCase());
      });
    }

    return result;
  }, [pendencias, search, filterStatus]);

  // Modals state
  const [modalManageSistemasOpen, setModalManageSistemasOpen] = useState(false);
  const [selectedCatalogSistemaId, setSelectedCatalogSistemaId] = useState<string>("");
  const [customSistemaNome, setCustomSistemaNome] = useState("");

  const [modalNewColabOpen, setModalNewColabOpen] = useState(false);
  const [colabSearchQuery, setColabSearchQuery] = useState("");
  const [selectedColabId, setSelectedColabId] = useState<string>("");
  const [newColabSistemasStatus, setNewColabSistemasStatus] = useState<Record<string, string>>({});
  const [newColabChamado, setNewColabChamado] = useState("");
  const [newColabObs, setNewColabObs] = useState("");

  const [editRowModal, setEditRowModal] = useState<any>(null);

  // Available systems in catalog that are not yet added as columns
  const availableCatalogSistemas = useMemo(() => {
    const existingPineSistemaIds = new Set(
      pineSistemas.map((ps: any) => ps.sistema_id).filter(Boolean),
    );
    const existingPineNomes = new Set(
      pineSistemas.map((ps: any) => (ps.nome || "").toLowerCase().trim()),
    );

    return catalogSistemas.filter(
      (s: any) =>
        !existingPineSistemaIds.has(s.id) &&
        !existingPineNomes.has((s.nome || "").toLowerCase().trim()),
    );
  }, [catalogSistemas, pineSistemas]);

  // Selected collaborator details preview
  const selectedColaborador = useMemo(() => {
    return allColaboradores.find((c: any) => c.id === selectedColabId) || null;
  }, [allColaboradores, selectedColabId]);

  // Filtered collaborators for the modal selection
  const filteredColabsForModal = useMemo(() => {
    const q = colabSearchQuery.trim().toLowerCase();
    if (!q) return allColaboradores.slice(0, 30);
    const cleanQ = q.replace(/\D/g, "");
    return allColaboradores
      .filter((c: any) => {
        const nome = (c.nome || "").toLowerCase();
        const cpf = (c.cpf || "").replace(/\D/g, "");
        return nome.includes(q) || (cleanQ && cpf.includes(cleanQ));
      })
      .slice(0, 30);
  }, [allColaboradores, colabSearchQuery]);

  // Mutations
  // 1. Add System to Pine Columns
  const addSistemaColumn = useMutation({
    mutationFn: async (payload: { nome: string; sistema_id: string | null }) => {
      const maxOrdem = pineSistemas.reduce((max: number, s: any) => Math.max(max, s.ordem || 0), 0);
      const { data, error } = await db
        .from("pendencias_pine_sistemas")
        .insert({
          nome: payload.nome.trim(),
          sistema_id: payload.sistema_id,
          ordem: maxOrdem + 1,
          ativo: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (newSis: any) => {
      toast.success(`Coluna do sistema "${newSis.nome}" cadastrada com sucesso!`);
      setSelectedCatalogSistemaId("");
      setCustomSistemaNome("");
      qc.invalidateQueries({ queryKey: ["pendencias_pine_sistemas"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao cadastrar coluna de sistema: ${err.message}`);
    },
  });

  // 2. Remove System Column from Pine
  const removeSistemaColumn = useMutation({
    mutationFn: async (sistemaPineId: string) => {
      const { error } = await db.from("pendencias_pine_sistemas").delete().eq("id", sistemaPineId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coluna de sistema removida com sucesso");
      qc.invalidateQueries({ queryKey: ["pendencias_pine_sistemas"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover coluna: ${err.message}`);
    },
  });

  // Helper: Sync "CRIAÇÃO" status to Matriz Principal (acessos table) as "Solicitado"
  const syncCriacaoToMatriz = async (
    colaboradorId: string,
    sistemaPine: { id: string; nome: string; sistema_id: string | null },
  ) => {
    try {
      let targetSistemaId = sistemaPine.sistema_id;

      if (!targetSistemaId) {
        const { data: found } = await db
          .from("sistemas")
          .select("id")
          .ilike("nome", sistemaPine.nome.trim())
          .maybeSingle();

        if (found?.id) {
          targetSistemaId = found.id;
          await db
            .from("pendencias_pine_sistemas")
            .update({ sistema_id: targetSistemaId })
            .eq("id", sistemaPine.id);
        } else {
          const { data: created } = await db
            .from("sistemas")
            .insert({
              nome: sistemaPine.nome.trim(),
              categoria: "Outros",
            })
            .select("id")
            .single();
          if (created?.id) {
            targetSistemaId = created.id;
            await db
              .from("pendencias_pine_sistemas")
              .update({ sistema_id: targetSistemaId })
              .eq("id", sistemaPine.id);
          }
        }
      }

      if (!targetSistemaId) return;

      const { data: existing } = await db
        .from("acessos")
        .select("id, login, senha, status")
        .eq("colaborador_id", colaboradorId)
        .eq("sistema_id", targetSistemaId)
        .maybeSingle();

      if (existing) {
        await db
          .from("acessos")
          .update({
            login: "Solicitado",
            senha: "Solicitado",
            status: "pendente",
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await db.from("acessos").insert({
          colaborador_id: colaboradorId,
          sistema_id: targetSistemaId,
          login: "Solicitado",
          senha: "Solicitado",
          status: "pendente",
        });
      }
    } catch (err) {
      console.error("Erro ao sincronizar status de criação na Matriz Principal:", err);
    }
  };

  // 3. Create new Collaborator row
  const createColaboradorRow = useMutation({
    mutationFn: async (payload: {
      colaborador_id: string;
      sistemas_valores: Record<string, string>;
      numero_chamado: string;
      observacao: string;
    }) => {
      const maxOrdem = pendencias.reduce((max: number, p: any) => Math.max(max, p.ordem || 0), 0);
      const { data, error } = await db
        .from("pendencias_pine")
        .insert({
          colaborador_id: payload.colaborador_id,
          sistemas_valores: payload.sistemas_valores,
          funcao: "-",
          numero_chamado: payload.numero_chamado.slice(0, 200),
          observacao: payload.observacao.slice(0, 200),
          ordem: maxOrdem + 1,
        })
        .select()
        .single();
      if (error) throw error;

      // Sync any systems marked with CRIAÇÃO to the Matriz Principal (acessos table)
      for (const [sisId, statusVal] of Object.entries(payload.sistemas_valores || {})) {
        if (statusVal === "CRIAÇÃO") {
          const sisPine = pineSistemas.find((s: any) => s.id === sisId);
          if (sisPine) {
            await syncCriacaoToMatriz(payload.colaborador_id, sisPine);
          }
        }
      }

      return data;
    },
    onSuccess: (data, variables) => {
      const hasCriacao = Object.values(variables.sistemas_valores || {}).includes("CRIAÇÃO");
      if (hasCriacao) {
        toast.success(
          "Colaborador adicionado à tabela e acessos em CRIAÇÃO marcados como 'Solicitado' na Matriz Principal!",
        );
      } else {
        toast.success("Colaborador adicionado à tabela com sucesso!");
      }
      setModalNewColabOpen(false);
      setSelectedColabId("");
      setColabSearchQuery("");
      setNewColabSistemasStatus({});
      setNewColabChamado("");
      setNewColabObs("");
      qc.invalidateQueries({ queryKey: ["pendencias_pine"] });
      qc.invalidateQueries({ queryKey: ["acessos"] });
      qc.invalidateQueries({ queryKey: ["matriz-acessos"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao adicionar colaborador: ${err.message}`);
    },
  });

  // 4. Update System Status Cell (Admin only)
  const updateSystemStatus = useMutation({
    mutationFn: async ({
      rowId,
      sistemaId,
      newStatus,
      currentValues,
    }: {
      rowId: string;
      sistemaId: string;
      newStatus: string;
      currentValues: Record<string, any>;
    }) => {
      const updatedValues = { ...currentValues, [sistemaId]: newStatus };
      const { error } = await db
        .from("pendencias_pine")
        .update({
          sistemas_valores: updatedValues,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", rowId);
      if (error) throw error;

      // When set to "CRIAÇÃO", sync to Matriz Principal (acessos table) as "Solicitado"
      if (newStatus === "CRIAÇÃO") {
        const row = pendencias.find((p: any) => p.id === rowId);
        const sisPine = pineSistemas.find((s: any) => s.id === sistemaId);
        if (row?.colaborador_id && sisPine) {
          await syncCriacaoToMatriz(row.colaborador_id, sisPine);
        }
      }
    },
    onSuccess: (data, variables) => {
      if (variables.newStatus === "CRIAÇÃO") {
        toast.success(
          "Status atualizado para CRIAÇÃO e acesso marcado como 'Solicitado' na Matriz Principal!",
        );
      }
      qc.invalidateQueries({ queryKey: ["pendencias_pine"] });
      qc.invalidateQueries({ queryKey: ["acessos"] });
      qc.invalidateQueries({ queryKey: ["matriz-acessos"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao atualizar status do sistema: ${err.message}`);
    },
  });

  // 5. Update Chamado or Observação (both Admin and Cliente, max 200 chars)
  const updateChamadoOrObs = useMutation({
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string;
      field: "numero_chamado" | "observacao";
      value: string;
    }) => {
      const sanitized = value.slice(0, 200);
      const { error } = await db
        .from("pendencias_pine")
        .update({
          [field]: sanitized,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendencias_pine"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  // 6. Delete row (Admin only)
  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("pendencias_pine").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido com sucesso");
      qc.invalidateQueries({ queryKey: ["pendencias_pine"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao excluir: ${err.message}`);
    },
  });

  // Copy helper
  function copyText(val: string, label: string) {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast.success(`${label} copiado!`);
  }

  // Export to Excel
  function exportToExcel() {
    if (!filteredRows.length) {
      toast.info("Não há dados para exportar no momento.");
      return;
    }

    const excelRows = filteredRows.map((p: any, idx: number) => {
      const rowObj: Record<string, any> = {
        "#": idx + 1,
        NOME: (p.colaborador?.nome || "SEM NOME").toUpperCase(),
        CPF: formatCpf(p.colaborador?.cpf),
        "DATA DE NASCIMENTO": formatDate(p.colaborador?.data_nascimento),
        EMAIL: p.colaborador?.email || "",
        TELEFONE: formatPhone(p.colaborador?.telefone),
      };

      // Add each system column
      for (const sis of pineSistemas) {
        const val =
          p.sistemas_valores?.[sis.id] ||
          p.sistemas_valores?.[sis.nome] ||
          (p.sistema_pine_id === sis.id ? p.funcao : "-");
        rowObj[sis.nome] = val || "-";
      }

      // Add the last two columns
      rowObj["Nº DO CHAMADO"] = p.numero_chamado || "";
      rowObj["OBSERVAÇÃO"] = p.observacao || "";

      return rowObj;
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);

    // Column widths
    const cols = [
      { wch: 5 }, // #
      { wch: 38 }, // NOME
      { wch: 16 }, // CPF
      { wch: 18 }, // DATA NASCIMENTO
      { wch: 35 }, // EMAIL
      { wch: 18 }, // TELEFONE
    ];

    for (let i = 0; i < pineSistemas.length; i++) {
      cols.push({ wch: 24 });
    }

    cols.push({ wch: 20 }); // Nº CHAMADO
    cols.push({ wch: 35 }); // OBSERVAÇÃO

    ws["!cols"] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pendências Pine");
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Pendencias_Pine_Geral_${dateStr}.xlsx`);
    toast.success("Planilha unificada exportada com sucesso!");
  }

  // Quick stats
  const stats = useMemo(() => {
    const total = pendencias.length;
    const withChamado = pendencias.filter(
      (p: any) => p.numero_chamado && p.numero_chamado.trim() !== "",
    ).length;
    const withoutChamado = total - withChamado;
    const totalSistemas = pineSistemas.length;
    return { total, withChamado, withoutChamado, totalSistemas };
  }, [pendencias, pineSistemas]);

  // Loading screen
  if (loadingMe) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando permissões...</p>
        </div>
      </div>
    );
  }

  // Access denied screen if neither Admin nor Cliente
  if (!hasAccess) {
    return (
      <Card className="max-w-xl mx-auto my-12 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
            <Shield className="h-8 w-8" />
            <h2 className="text-xl font-bold">Acesso Restrito</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            A guia <strong>Pendências Pine</strong> é restrita exclusivamente a usuários com perfil{" "}
            <strong>Administrador</strong> ou <strong>Cliente</strong>.
          </p>
          <Button onClick={() => navigate({ to: "/dashboard" })}>Voltar ao Início</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Pendências Pine
            </h1>
            <Badge
              variant="outline"
              className={
                isAdmin
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
              }
            >
              {isAdmin ? "Acesso Administrador (Full)" : "Acesso Cliente"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "Tabela única integrando todos os sistemas selecionados em colunas dedicadas, com controle total de colaboradores e status."
              : "Tabela única com visualização de todos os sistemas. Edição permitida nas colunas Nº do Chamado e Observação."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={!filteredRows.length}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Exportar Excel</span>
          </Button>

          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalManageSistemasOpen(true)}
                className="gap-2 border-primary/30 hover:bg-primary/5 text-primary"
              >
                <Server className="h-4 w-4" />
                <span>Cadastrar Sistema</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setNewColabSistemasStatus({});
                  setModalNewColabOpen(true);
                }}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <UserPlus className="h-4 w-4" />
                <span>Adicionar Colaborador</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Role Notice Banner for Cliente */}
      {isCliente && (
        <div className="flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50/70 p-3 text-sm text-purple-900 dark:border-purple-900 dark:bg-purple-950/40 dark:text-purple-200">
          <Sparkles className="h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400" />
          <div className="flex-1">
            <span className="font-semibold">Modo Cliente ativo:</span> Você tem visão unificada de
            todos os sistemas da tabela. As duas últimas colunas (<strong>Nº do Chamado</strong> e{" "}
            <strong>Observação</strong>) são de preenchimento livre diretamente na tabela (com
            limite de até 200 caracteres cada).
          </div>
        </div>
      )}

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="bg-card/50 shadow-none border">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Colaboradores</p>
              <p className="text-2xl font-bold tracking-tight text-foreground">{stats.total}</p>
            </div>
            <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 shadow-none border">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Colunas de Sistemas</p>
              <p className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                {stats.totalSistemas}
              </p>
            </div>
            <div className="p-2.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 rounded-lg">
              <Server className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 shadow-none border">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Com Nº de Chamado</p>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {stats.withChamado}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 rounded-lg">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 shadow-none border">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Aguardando Chamado</p>
              <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {stats.withoutChamado}
              </p>
            </div>
            <div className="p-2.5 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 rounded-lg">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por Nome, CPF, E-mail, Nº Chamado, Observação ou Status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Status / Função:
          </Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-44 text-xs">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Status</SelectItem>
              {PRESET_FUNCOES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search || filterStatus !== "todos") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFilterStatus("todos");
              }}
              className="text-xs h-9 text-muted-foreground hover:text-foreground"
            >
              Limpar filtros
            </Button>
          )}

          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModalManageSistemasOpen(true)}
              className="text-xs h-9 text-muted-foreground hover:text-foreground gap-1.5"
              title="Gerenciar Colunas de Sistemas"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Colunas</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Single Unified Table */}
      <Card className="overflow-hidden border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-muted/80 text-muted-foreground border-b text-[12px] font-semibold uppercase tracking-wider">
              <tr>
                {/* 1. Sequential Index */}
                <th className="py-3 px-3 text-center w-12 border-r border-border/50">#</th>

                {/* 2. Fixed Collaborator Columns */}
                <th className="py-3 px-4 min-w-[220px] border-r border-border/50">Nome</th>
                <th className="py-3 px-3 min-w-[130px] border-r border-border/50">CPF</th>
                <th className="py-3 px-3 min-w-[120px] border-r border-border/50">Data de Nasc.</th>
                <th className="py-3 px-4 min-w-[220px] border-r border-border/50">E-mail</th>
                <th className="py-3 px-3 min-w-[140px] border-r border-border/50">Telefone</th>

                {/* 3. Dynamic System Columns */}
                {pineSistemas.map((sis: any) => (
                  <th
                    key={sis.id}
                    className="py-3 px-3 min-w-[170px] border-r border-border/50 bg-secondary/30 text-foreground"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold truncate" title={sis.nome}>
                        {sis.nome}
                      </span>
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs">{sis.nome}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Deseja remover a coluna do sistema "${sis.nome}" desta tabela?`,
                                  )
                                ) {
                                  removeSistemaColumn.mutate(sis.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Remover Coluna
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </th>
                ))}

                {/* 4. The Last Two Columns */}
                <th className="py-3 px-3 min-w-[200px] bg-primary/5 text-foreground font-bold border-r border-border/50">
                  <div className="flex items-center justify-between">
                    <span>Nº do Chamado</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      (200 carac.)
                    </span>
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[230px] bg-primary/5 text-foreground font-bold border-r border-border/50">
                  <div className="flex items-center justify-between">
                    <span>Observação</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      (200 carac.)
                    </span>
                  </div>
                </th>

                {/* 5. Actions Column (Admin only) */}
                {isAdmin && <th className="py-3 px-3 text-center w-20">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6 + pineSistemas.length + 2 + (isAdmin ? 1 : 0)}
                    className="py-12 text-center text-muted-foreground text-sm"
                  >
                    {search || filterStatus !== "todos" ? (
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-6 w-6 text-muted-foreground/60" />
                        <p>Nenhum registro encontrado para os filtros aplicados.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            setFilterStatus("todos");
                          }}
                        >
                          Limpar Busca
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Table2 className="h-8 w-8 text-muted-foreground/50" />
                        <p className="font-medium text-foreground">
                          Nenhum colaborador cadastrado na tabela de Pendências Pine.
                        </p>
                        {isAdmin && (
                          <Button
                            size="sm"
                            onClick={() => setModalNewColabOpen(true)}
                            className="mt-2 gap-2"
                          >
                            <UserPlus className="h-4 w-4" /> Adicionar Primeiro Colaborador
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row: any, index: number) => (
                  <PineUnifiedRow
                    key={row.id}
                    index={index + 1}
                    row={row}
                    sistemas={pineSistemas}
                    isAdmin={isAdmin}
                    isCliente={isCliente}
                    onUpdateSystemStatus={(sistemaId, newStatus) =>
                      updateSystemStatus.mutate({
                        rowId: row.id,
                        sistemaId,
                        newStatus,
                        currentValues: row.sistemas_valores || {},
                      })
                    }
                    onSaveField={(field, val) =>
                      updateChamadoOrObs.mutate({ id: row.id, field, value: val })
                    }
                    onDelete={() => {
                      if (
                        confirm(
                          `Deseja realmente remover o colaborador "${row.colaborador?.nome || "Colaborador"}" desta tabela?`,
                        )
                      ) {
                        deleteRow.mutate(row.id);
                      }
                    }}
                    copyText={copyText}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length > 0 && (
          <div className="bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground border-t flex flex-wrap items-center justify-between gap-2">
            <span>
              Exibindo <strong>{filteredRows.length}</strong> de{" "}
              <strong>{pendencias.length}</strong> colaboradores •{" "}
              <strong>{pineSistemas.length}</strong> sistemas em colunas
            </span>
            <span>Tabela única de Pendências Pine</span>
          </div>
        )}
      </Card>

      {/* Modal: Cadastrar Sistema (Opção de adicionar sistemas a partir da guia Sistemas) */}
      <Dialog open={modalManageSistemasOpen} onOpenChange={setModalManageSistemasOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <span>Cadastrar Sistema nas Colunas da Tabela</span>
            </DialogTitle>
            <DialogDescription>
              Selecione quais sistemas da guia &quot;Sistemas&quot; devem aparecer como colunas
              nesta tabela única de Pendências Pine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. Current columns list */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Colunas de Sistemas Atuais ({pineSistemas.length})
              </Label>
              <div className="border rounded-md divide-y divide-border max-h-40 overflow-y-auto bg-background">
                {pineSistemas.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground text-center">
                    Nenhum sistema adicionado como coluna ainda.
                  </p>
                ) : (
                  pineSistemas.map((sis: any, idx: number) => (
                    <div
                      key={sis.id}
                      className="p-2.5 text-xs flex items-center justify-between hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground text-[11px] w-5">
                          {idx + 1}.
                        </span>
                        <span className="font-medium text-foreground">{sis.nome}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        title="Remover coluna"
                        onClick={() => {
                          if (
                            confirm(
                              `Deseja remover a coluna do sistema "${sis.nome}" desta tabela?`,
                            )
                          ) {
                            removeSistemaColumn.mutate(sis.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Add system from existing Sistemas */}
            <div className="rounded-lg border bg-muted/30 p-3.5 space-y-3">
              <Label className="text-xs font-semibold text-foreground block">
                Adicionar Sistema da guia &quot;Sistemas&quot;:
              </Label>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedCatalogSistemaId}
                  onValueChange={setSelectedCatalogSistemaId}
                >
                  <SelectTrigger className="h-9 flex-1 text-xs">
                    <SelectValue placeholder="Selecione um sistema cadastrado..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {availableCatalogSistemas.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Todos os sistemas já foram adicionados
                      </SelectItem>
                    ) : (
                      availableCatalogSistemas.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome} {s.categoria ? `(${s.categoria})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  className="h-9 gap-1 text-xs shrink-0"
                  disabled={!selectedCatalogSistemaId || selectedCatalogSistemaId === "none"}
                  onClick={() => {
                    const found = catalogSistemas.find(
                      (s: any) => s.id === selectedCatalogSistemaId,
                    );
                    if (found) {
                      addSistemaColumn.mutate({
                        nome: found.nome,
                        sistema_id: found.id,
                      });
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar Coluna
                </Button>
              </div>

              {/* Or type custom system name */}
              <div className="pt-2 border-t">
                <Label className="text-[11px] text-muted-foreground block mb-1">
                  Ou digite um nome de sistema personalizado:
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Ex: Novo Sistema X"
                    value={customSistemaNome}
                    onChange={(e) => setCustomSistemaNome(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    disabled={!customSistemaNome.trim()}
                    onClick={() => {
                      addSistemaColumn.mutate({
                        nome: customSistemaNome.trim(),
                        sistema_id: null,
                      });
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setModalManageSistemasOpen(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Colaborador na Tabela Unificada */}
      <Dialog open={modalNewColabOpen} onOpenChange={setModalNewColabOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <span>Adicionar Colaborador à Tabela Pine</span>
            </DialogTitle>
            <DialogDescription>
              Selecione o colaborador da Matriz Principal. Seus dados (CPF, nascimento, e-mail e
              telefone) serão preenchidos automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Search Colaborador */}
            <div>
              <Label className="text-xs font-semibold">1. Buscar Colaborador *</Label>
              <div className="mt-1 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite o nome ou CPF do colaborador..."
                    value={colabSearchQuery}
                    onChange={(e) => setColabSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                <div className="border rounded-md max-h-44 overflow-y-auto divide-y divide-border bg-background">
                  {filteredColabsForModal.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      Nenhum colaborador ativo encontrado.
                    </div>
                  ) : (
                    filteredColabsForModal.map((colab: any) => {
                      const isSelected = selectedColabId === colab.id;
                      return (
                        <div
                          key={colab.id}
                          onClick={() => setSelectedColabId(colab.id)}
                          className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary/10 font-semibold text-primary"
                              : "hover:bg-muted"
                          }`}
                        >
                          <div>
                            <p className="text-foreground">{colab.nome}</p>
                            <p className="text-[11px] text-muted-foreground">
                              CPF: {formatCpf(colab.cpf)} {colab.cargo ? `• ${colab.cargo}` : ""}
                            </p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Selected Colaborador Preview */}
            {selectedColaborador && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs dark:bg-emerald-950/20 dark:border-emerald-800 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                  <UserCheck className="h-4 w-4" />
                  <span>Dados obtidos da Matriz Principal:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-foreground/80 mt-1">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">CPF:</span>
                    <strong>{formatCpf(selectedColaborador.cpf)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Nascimento:</span>
                    <strong>{formatDate(selectedColaborador.data_nascimento)}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground block">E-mail:</span>
                    <strong className="truncate block">{selectedColaborador.email || "—"}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground block">Telefone:</span>
                    <strong>{formatPhone(selectedColaborador.telefone)}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Set status for each system column */}
            {pineSistemas.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs font-semibold block">
                  2. Status em cada Sistema (Colunas):
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {pineSistemas.map((sis: any) => {
                    const currentVal = newColabSistemasStatus[sis.id] || "-";
                    return (
                      <div key={sis.id} className="p-2 border rounded-md bg-muted/20 space-y-1.5">
                        <span className="text-xs font-medium block truncate">{sis.nome}</span>
                        <div className="flex flex-wrap gap-1">
                          {PRESET_FUNCOES.map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() =>
                                setNewColabSistemasStatus((prev) => ({
                                  ...prev,
                                  [sis.id]: f,
                                }))
                              }
                              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                                currentVal === f
                                  ? "bg-primary text-primary-foreground font-semibold border-primary"
                                  : "bg-background text-muted-foreground hover:bg-muted border-border"
                              }`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nº do Chamado and Observação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Nº do Chamado (máx. 200 caracteres)</Label>
                  <span
                    className={`text-[10px] ${
                      newColabChamado.length > 190
                        ? "text-destructive font-bold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {newColabChamado.length}/200
                  </span>
                </div>
                <Input
                  placeholder="Ex: INC987654"
                  maxLength={200}
                  value={newColabChamado}
                  onChange={(e) => setNewColabChamado(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Observação (máx. 200 caracteres)</Label>
                  <span
                    className={`text-[10px] ${
                      newColabObs.length > 190
                        ? "text-destructive font-bold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {newColabObs.length}/200
                  </span>
                </div>
                <Input
                  placeholder="Observação livre..."
                  maxLength={200}
                  value={newColabObs}
                  onChange={(e) => setNewColabObs(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNewColabOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!selectedColabId) {
                  toast.error("Selecione um colaborador da lista.");
                  return;
                }
                createColaboradorRow.mutate({
                  colaborador_id: selectedColabId,
                  sistemas_valores: newColabSistemasStatus,
                  numero_chamado: newColabChamado,
                  observacao: newColabObs,
                });
              }}
              disabled={createColaboradorRow.isPending || !selectedColabId}
            >
              Adicionar à Tabela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for individual table row in the Unified Table
function PineUnifiedRow({
  index,
  row,
  sistemas,
  isAdmin,
  isCliente,
  onUpdateSystemStatus,
  onSaveField,
  onDelete,
  copyText,
}: {
  index: number;
  row: any;
  sistemas: any[];
  isAdmin: boolean;
  isCliente: boolean;
  onUpdateSystemStatus: (sistemaId: string, newStatus: string) => void;
  onSaveField: (field: "numero_chamado" | "observacao", val: string) => void;
  onDelete: () => void;
  copyText: (val: string, label: string) => void;
}) {
  const colab = row.colaborador || {};

  // Free text editable cells: Chamado & Observação
  const [chamadoVal, setChamadoVal] = useState(row.numero_chamado || "");
  const [obsVal, setObsVal] = useState(row.observacao || "");
  const [isEditingChamado, setIsEditingChamado] = useState(false);
  const [isEditingObs, setIsEditingObs] = useState(false);
  const [savedField, setSavedField] = useState<string | null>(null);

  // Popover state for quick system status change
  const [openStatusPopoverFor, setOpenStatusPopoverFor] = useState<string | null>(null);

  // Sync with prop updates
  useEffect(() => {
    setChamadoVal(row.numero_chamado || "");
  }, [row.numero_chamado]);

  useEffect(() => {
    setObsVal(row.observacao || "");
  }, [row.observacao]);

  const handleBlurChamado = () => {
    setIsEditingChamado(false);
    if (chamadoVal !== (row.numero_chamado || "")) {
      onSaveField("numero_chamado", chamadoVal);
      setSavedField("chamado");
      setTimeout(() => setSavedField(null), 2000);
    }
  };

  const handleBlurObs = () => {
    setIsEditingObs(false);
    if (obsVal !== (row.observacao || "")) {
      onSaveField("observacao", obsVal);
      setSavedField("obs");
      setTimeout(() => setSavedField(null), 2000);
    }
  };

  return (
    <tr className="hover:bg-muted/30 transition-colors border-b border-border/60">
      {/* 1. Sequential Index */}
      <td className="py-2.5 px-3 text-center text-xs text-muted-foreground font-mono border-r border-border/40">
        {index}
      </td>

      {/* 2. Nome */}
      <td className="py-2.5 px-4 font-medium text-foreground border-r border-border/40">
        <div className="flex items-center justify-between gap-1 group">
          <span className="uppercase text-[13px] tracking-wide">
            {colab.nome || "COLABORADOR NÃO IDENTIFICADO"}
          </span>
          {colab.nome && (
            <button
              onClick={() => copyText(colab.nome, "Nome")}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5"
              title="Copiar Nome"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>

      {/* 3. CPF */}
      <td className="py-2.5 px-3 text-xs font-mono text-muted-foreground border-r border-border/40 whitespace-nowrap">
        <div className="flex items-center justify-between gap-1 group">
          <span>{formatCpf(colab.cpf)}</span>
          {colab.cpf && (
            <button
              onClick={() => copyText(colab.cpf, "CPF")}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5"
              title="Copiar CPF"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>

      {/* 4. Data de Nascimento */}
      <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono border-r border-border/40 whitespace-nowrap">
        {formatDate(colab.data_nascimento)}
      </td>

      {/* 5. E-mail */}
      <td className="py-2.5 px-4 text-xs text-muted-foreground border-r border-border/40">
        <div className="flex items-center justify-between gap-1 group max-w-[220px]">
          <span className="truncate" title={colab.email || ""}>
            {colab.email || "—"}
          </span>
          {colab.email && (
            <button
              onClick={() => copyText(colab.email, "E-mail")}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5 shrink-0"
              title="Copiar E-mail"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>

      {/* 6. Telefone */}
      <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono border-r border-border/40 whitespace-nowrap">
        <div className="flex items-center justify-between gap-1 group">
          <span>{formatPhone(colab.telefone)}</span>
          {colab.telefone && (
            <button
              onClick={() => copyText(colab.telefone, "Telefone")}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5"
              title="Copiar Telefone"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
      </td>

      {/* 7. Dynamic System Columns */}
      {sistemas.map((sis: any) => {
        const val =
          row.sistemas_valores?.[sis.id] ||
          row.sistemas_valores?.[sis.nome] ||
          (row.sistema_pine_id === sis.id ? row.funcao : "-");
        const statusText = val || "-";

        if (!isAdmin) {
          // Cliente: Read-only badge
          return (
            <td key={sis.id} className="py-2.5 px-3 text-center border-r border-border/40">
              <Badge
                variant="outline"
                className={`text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 border ${getFuncaoBadgeStyle(
                  statusText,
                )}`}
              >
                {statusText}
              </Badge>
            </td>
          );
        }

        // Admin: Clickable to change status
        return (
          <td key={sis.id} className="py-2 px-2 text-center border-r border-border/40">
            <Popover
              open={openStatusPopoverFor === sis.id}
              onOpenChange={(open) => setOpenStatusPopoverFor(open ? sis.id : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full text-center group cursor-pointer focus:outline-none"
                  title="Clique para alterar status deste sistema"
                >
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 border transition-all group-hover:ring-1 group-hover:ring-primary ${getFuncaoBadgeStyle(
                      statusText,
                    )}`}
                  >
                    {statusText}
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 text-xs space-y-1.5" align="center">
                <p className="font-semibold text-muted-foreground text-[11px] pb-1 border-b">
                  {sis.nome}:
                </p>
                <div className="flex flex-col gap-1">
                  {PRESET_FUNCOES.map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        onUpdateSystemStatus(sis.id, f);
                        setOpenStatusPopoverFor(null);
                      }}
                      className={`text-left px-2 py-1 rounded text-xs transition-colors flex items-center justify-between ${
                        statusText === f
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span>{f}</span>
                      {statusText === f && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </td>
        );
      })}

      {/* 8. Nº do Chamado (Free input, 200 chars limit, editable by Admin & Cliente) */}
      <td className="py-1.5 px-2 bg-primary/[0.02] border-r border-border/40 relative">
        <div className="relative">
          <Input
            value={chamadoVal}
            maxLength={200}
            placeholder="Nº do chamado..."
            onChange={(e) => setChamadoVal(e.target.value)}
            onFocus={() => setIsEditingChamado(true)}
            onBlur={handleBlurChamado}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className={`h-8 text-xs bg-background/80 transition-all font-mono ${
              isEditingChamado
                ? "border-primary ring-1 ring-primary pr-12"
                : "border-transparent hover:border-input focus:border-primary"
            }`}
          />
          {isEditingChamado && (
            <span
              className={`absolute right-1.5 top-2 text-[10px] pointer-events-none ${
                chamadoVal.length > 190 ? "text-destructive font-bold" : "text-muted-foreground/80"
              }`}
            >
              {chamadoVal.length}/200
            </span>
          )}
          {savedField === "chamado" && (
            <span className="absolute right-2 top-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5 pointer-events-none">
              <Check className="h-3 w-3" /> Salvo
            </span>
          )}
        </div>
      </td>

      {/* 9. Observação (Free input, 200 chars limit, editable by Admin & Cliente) */}
      <td className="py-1.5 px-2 bg-primary/[0.02] border-r border-border/40 relative">
        <div className="relative">
          <Input
            value={obsVal}
            maxLength={200}
            placeholder="Observações..."
            onChange={(e) => setObsVal(e.target.value)}
            onFocus={() => setIsEditingObs(true)}
            onBlur={handleBlurObs}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className={`h-8 text-xs bg-background/80 transition-all ${
              isEditingObs
                ? "border-primary ring-1 ring-primary pr-12"
                : "border-transparent hover:border-input focus:border-primary"
            }`}
          />
          {isEditingObs && (
            <span
              className={`absolute right-1.5 top-2 text-[10px] pointer-events-none ${
                obsVal.length > 190 ? "text-destructive font-bold" : "text-muted-foreground/80"
              }`}
            >
              {obsVal.length}/200
            </span>
          )}
          {savedField === "obs" && (
            <span className="absolute right-2 top-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5 pointer-events-none">
              <Check className="h-3 w-3" /> Salvo
            </span>
          )}
        </div>
      </td>

      {/* 10. Actions (Admin only) */}
      {isAdmin && (
        <td className="py-2.5 px-3 text-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="Excluir Colaborador da Tabela"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </td>
      )}
    </tr>
  );
}
