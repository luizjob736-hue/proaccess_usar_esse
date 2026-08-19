import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { db } from "@/integrations/database/client";
import { useMemo, useState, Fragment, memo, useCallback } from "react";
import { OperationFilterBar } from "@/components/OperationFilterBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye,
  EyeOff,
  Search,
  Copy,
  Grid3x3,
  FileDown,
  Plus,
  UserX,
  Upload,
  Pencil,
  Trash2,
  CheckSquare,
  CheckCircle2,
  UserCheck,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createOperadorFromColaborador } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/matriz-acessos")({
  component: MatrizAcessos,
});

function formatDateBR(val: string | Date | null | undefined): string {
  if (!val) return "—";
  if (typeof val === "string") {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      return `${d}/${m}/${y}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      return val;
    }
  }
  const dateObj = typeof val === "string" ? new Date(val) : val;
  if (!dateObj || isNaN(dateObj.getTime())) return "—";
  return dateObj.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function toInputDateValue(val: any): string {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  if (!d || isNaN(d.getTime())) {
    const match = String(val).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const ValCell = memo(function ValCell({
  v,
  label,
  reveal,
  onEdit,
  onCopy,
}: {
  v: string | null | undefined;
  label: string;
  reveal: boolean;
  onEdit?: () => void;
  onCopy: (v: string, label: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 group min-w-0">
      <span className="font-mono text-[11px] truncate">{v ? (reveal ? v : "••••") : "—"}</span>
      {v && (
        <button
          onClick={() => onCopy(v, label)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity"
          title="Copiar"
        >
          <Copy className="h-3 w-3" />
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity"
          title="Editar"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
});

export function MatrizView({
  onlyInativos = false,
  onlyPreAtendimento = false,
}: {
  onlyInativos?: boolean;
  onlyPreAtendimento?: boolean;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [colFilterNome, setColFilterNome] = useState("");
  const [colFilterCpf, setColFilterCpf] = useState("");
  const [colFilterAdmissao, setColFilterAdmissao] = useState("");
  const [colFilterProduto, setColFilterProduto] = useState("");
  const [colFilterEntrada, setColFilterEntrada] = useState("");
  const [colFilterSaida, setColFilterSaida] = useState("");
  const [colFilterNascimento, setColFilterNascimento] = useState("");
  const [colFilterEmail, setColFilterEmail] = useState("");
  const [colFilterSenhaEmail, setColFilterSenhaEmail] = useState("");
  const [colFilterTelefone, setColFilterTelefone] = useState("");
  const [colFilterCargo, setColFilterCargo] = useState("");
  const [colFilterInativado, setColFilterInativado] = useState("");
  const [colFilterSistemas, setColFilterSistemas] = useState<
    Record<string, { usuario: string; senha: string }>
  >({});
  const [selectedOperacaoId, setSelectedOperacaoId] = useState("todas");
  const [reveal, setReveal] = useState(false);
  const [newSisOpen, setNewSisOpen] = useState(false);
  const [newColOpen, setNewColOpen] = useState(false);
  const [addAcessoFor, setAddAcessoFor] = useState<any | null>(null);
  const [editColab, setEditColab] = useState<any | null>(null);
  const [editAcesso, setEditAcesso] = useState<any | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const { data: me } = useQuery({
    queryKey: ["me-matriz"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return null;
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
      return { user: u.user, roles: roles?.map((r) => r.role) ?? [] };
    },
  });

  const isMaster =
    (me?.roles ?? []).includes("admin_master") ||
    (me?.roles ?? []).includes("admin") ||
    me?.user?.role === "admin_master";

  const excluirColab = useMutation({
    mutationFn: async (id: string) => {
      await db.from("acessos").delete().eq("colaborador_id", id);
      const { error } = await db.from("colaboradores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador excluído com sucesso");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: acessos = [] } = useQuery({
    queryKey: ["matriz-acessos-full"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await db
        .from("acessos")
        .select(
          "id, login, senha, sistema:sistemas(id,nome), colaborador:colaboradores(id, nome, cpf, email, email_senha, telefone, cargo, status, operacao_id, matricula, admissao_em, inativado_em, data_nascimento, produto, horario_entrada, horario_saida, em_pre_atendimento)",
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: colabsRaw = [] } = useQuery({
    queryKey: ["colabs-full"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () =>
      (
        await db
          .from("colaboradores")
          .select(
            "id, nome, cpf, email, email_senha, telefone, cargo, status, operacao_id, matricula, admissao_em, inativado_em, data_nascimento, produto, horario_entrada, horario_saida, em_pre_atendimento" as any,
          )
          .order("nome")
      ).data ?? [],
  });

  const { data: sistemasAll = [] } = useQuery({
    queryKey: ["sistemas-all"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const data = (await db.from("sistemas").select("id,nome").order("nome")).data ?? [];
      return data.filter(
        (s: any) => s.nome.toLowerCase() !== "e-mail" && s.nome.toLowerCase() !== "email",
      );
    },
  });

  const { data: operacoes = [] } = useQuery({
    queryKey: ["operacoes-all"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => (await db.from("operacoes").select("id,nome").order("nome")).data ?? [],
  });

  const criarSistema = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await db.from("sistemas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sistema criado");
      setNewSisOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const criarColab = useMutation({
    mutationFn: async (form: any) => {
      const { data, error } = await db
        .from("colaboradores")
        .insert(form)
        .select("id,cpf")
        .maybeSingle();
      if (error) throw error;
      if (data?.id && data?.cpf) {
        try {
          const r: any = await createOperador({ data: { colaborador_id: data.id } });
          if (r?.login) toast.success(`Operador criado: usuário ${r.login} / senha 123456`);
        } catch (err: any) {
          toast.warning("Colaborador criado, acesso operador falhou: " + err.message);
        }
      }
    },
    onSuccess: () => {
      toast.success("Colaborador criado");
      setNewColOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editarColab = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...rest } = payload;
      const { error } = await db.from("colaboradores").update(rest).eq("id", id);
      if (error) throw error;
      if (rest.status === "inativo" || rest.status === "desligado") {
        await db
          .from("pendencias")
          .update({ arquivado: true, concluido_em: new Date().toISOString() })
          .eq("colaborador_id", id)
          .eq("arquivado", false);
      }
    },
    onSuccess: () => {
      toast.success("Colaborador atualizado");
      setEditColab(null);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const criarAcesso = useMutation({
    mutationFn: async (payload: any) => {
      const toSend = {
        ...payload,
        login: payload.login && payload.login.trim() ? payload.login : "Solicitado",
        senha: payload.senha && payload.senha.trim() ? payload.senha : "Solicitado",
      };
      const { error } = await db.from("acessos").insert(toSend);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso adicionado");
      setAddAcessoFor(null);
      qc.invalidateQueries({ queryKey: ["matriz-acessos-full"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editarAcesso = useMutation({
    mutationFn: async (payload: any) => {
      const { id, login, senha } = payload;
      const { error } = await db.from("acessos").update({ login, senha }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso atualizado");
      setEditAcesso(null);
      qc.invalidateQueries({ queryKey: ["matriz-acessos-full"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const flagInativo = useMutation({
    mutationFn: async ({ id, inativo }: { id: string; inativo: boolean }) => {
      const nowIso = new Date().toISOString();
      const { error } = await db
        .from("colaboradores")
        .update({
          status: inativo ? "inativo" : "ativo",
          inativado_em: inativo ? nowIso : null,
          desligamento_em: inativo ? nowIso : null,
        })
        .eq("id", id);
      if (error) throw error;

      if (inativo) {
        await db
          .from("pendencias")
          .update({ arquivado: true, concluido_em: nowIso })
          .eq("colaborador_id", id)
          .eq("arquivado", false);
      }
    },
    onSuccess: (_, vars) => {
      toast.success(vars.inativo ? "Marcado como inativo" : "Reativado");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const transferirParaMatriz = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("colaboradores")
        .update({
          em_pre_atendimento: false,
          status: "ativo",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador transferido para a Matriz de Acessos!");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const transferirParaInativos = useMutation({
    mutationFn: async (id: string) => {
      const nowIso = new Date().toISOString();
      const { error } = await db
        .from("colaboradores")
        .update({
          status: "inativo",
          inativado_em: nowIso,
          desligamento_em: nowIso,
          em_pre_atendimento: false,
        })
        .eq("id", id);
      if (error) throw error;

      await db
        .from("pendencias")
        .update({ arquivado: true, concluido_em: nowIso })
        .eq("colaborador_id", id)
        .eq("arquivado", false);
    },
    onSuccess: () => {
      toast.success("Colaborador transferido para a guia de Usuários Inativos!");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const transferirSelecionadosParaMatriz = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await db
          .from("colaboradores")
          .update({
            em_pre_atendimento: false,
            status: "ativo",
          })
          .eq("id", id);
      }
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.length} colaborador(es) transferido(s) para a Matriz de Acessos!`);
      setSelectedIds(new Set());
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const transferirSelecionadosParaInativos = useMutation({
    mutationFn: async (ids: string[]) => {
      const nowIso = new Date().toISOString();
      for (const id of ids) {
        await db
          .from("colaboradores")
          .update({
            status: "inativo",
            inativado_em: nowIso,
            desligamento_em: nowIso,
            em_pre_atendimento: false,
          })
          .eq("id", id);

        await db
          .from("pendencias")
          .update({ arquivado: true, concluido_em: nowIso })
          .eq("colaborador_id", id)
          .eq("arquivado", false);
      }
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.length} colaborador(es) transferido(s) para Usuários Inativos!`);
      setSelectedIds(new Set());
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { sistemas, linhas } = useMemo(() => {
    const colabMap = new Map<string, any>();
    for (const c of colabsRaw as any[]) colabMap.set(c.id, { ...c, acessos: {} });
    for (const a of acessos as any[]) {
      if (a.colaborador) {
        const id = a.colaborador.id;
        if (!colabMap.has(id)) colabMap.set(id, { ...a.colaborador, acessos: {} });
        colabMap.get(id).acessos[a.sistema?.id] = {
          id: a.id,
          login: a.login,
          senha: a.senha,
          sistema_nome: a.sistema?.nome,
        };
      }
    }
    const sistemas = (sistemasAll as any[])
      .filter((s: any) => s.nome.toLowerCase() !== "e-mail" && s.nome.toLowerCase() !== "email")
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const linhas = Array.from(colabMap.values())
      .filter((c: any) => {
        if (onlyInativos) {
          return c.status === "inativo" || c.status === "desligado";
        }
        if (onlyPreAtendimento) {
          return (
            c.em_pre_atendimento === true && c.status !== "inativo" && c.status !== "desligado"
          );
        }
        return c.em_pre_atendimento !== true && c.status !== "inativo" && c.status !== "desligado";
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { sistemas, linhas };
  }, [acessos, colabsRaw, sistemasAll, onlyInativos, onlyPreAtendimento]);

  const operacaoCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: linhas.length, sem_operacao: 0 };
    for (const r of linhas) {
      if (!r.operacao_id) {
        counts["sem_operacao"] = (counts["sem_operacao"] || 0) + 1;
      } else {
        counts[r.operacao_id] = (counts[r.operacao_id] || 0) + 1;
      }
    }
    return counts;
  }, [linhas]);

  const filteredByOp = useMemo(() => {
    if (selectedOperacaoId === "todas") return linhas;
    if (selectedOperacaoId === "sem_operacao") return linhas.filter((r: any) => !r.operacao_id);
    return linhas.filter((r: any) => r.operacao_id === selectedOperacaoId);
  }, [linhas, selectedOperacaoId]);

  const filtered = useMemo(() => {
    return filteredByOp.filter((r: any) => {
      // 1. Global filter (q)
      const t = q.trim().toLowerCase();
      if (t) {
        const matchesGlobal = [r.nome, r.email, r.telefone, r.cpf].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(t),
        );
        if (!matchesGlobal) return false;
      }

      // 2. Column filters
      if (
        colFilterNome.trim() &&
        !String(r.nome ?? "")
          .toLowerCase()
          .includes(colFilterNome.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        colFilterCpf.trim() &&
        !String(r.cpf ?? "")
          .toLowerCase()
          .includes(colFilterCpf.trim().toLowerCase())
      ) {
        return false;
      }
      if (colFilterNascimento.trim()) {
        const dateStr = formatDateBR(r.data_nascimento).toLowerCase();
        if (!dateStr.includes(colFilterNascimento.trim().toLowerCase())) {
          return false;
        }
      }
      if (
        colFilterEmail.trim() &&
        !String(r.email ?? "")
          .toLowerCase()
          .includes(colFilterEmail.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        colFilterSenhaEmail.trim() &&
        !String(r.email_senha ?? "")
          .toLowerCase()
          .includes(colFilterSenhaEmail.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        colFilterTelefone.trim() &&
        !String(r.telefone ?? "")
          .toLowerCase()
          .includes(colFilterTelefone.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        colFilterCargo.trim() &&
        !String(r.cargo ?? "")
          .toLowerCase()
          .includes(colFilterCargo.trim().toLowerCase())
      ) {
        return false;
      }
      if (onlyInativos && colFilterInativado.trim()) {
        const dateStr = formatDateBR(r.inativado_em).toLowerCase();
        if (!dateStr.includes(colFilterInativado.trim().toLowerCase())) {
          return false;
        }
      }

      if (onlyPreAtendimento) {
        if (colFilterAdmissao.trim()) {
          const dateStr = formatDateBR(r.admissao_em).toLowerCase();
          if (!dateStr.includes(colFilterAdmissao.trim().toLowerCase())) {
            return false;
          }
        }
        if (
          colFilterProduto.trim() &&
          !String(r.produto ?? "")
            .toLowerCase()
            .includes(colFilterProduto.trim().toLowerCase())
        ) {
          return false;
        }
        if (
          colFilterEntrada.trim() &&
          !String(r.horario_entrada ?? "")
            .toLowerCase()
            .includes(colFilterEntrada.trim().toLowerCase())
        ) {
          return false;
        }
        if (
          colFilterSaida.trim() &&
          !String(r.horario_saida ?? "")
            .toLowerCase()
            .includes(colFilterSaida.trim().toLowerCase())
        ) {
          return false;
        }
      }

      // 3. Dynamic systems filters
      for (const [sisId, sFilter] of Object.entries(colFilterSistemas)) {
        const acesso = r.acessos?.[sisId];
        if (sFilter.usuario.trim()) {
          const userVal = String(acesso?.login ?? "").toLowerCase();
          if (!userVal.includes(sFilter.usuario.trim().toLowerCase())) {
            return false;
          }
        }
        if (sFilter.senha.trim()) {
          const passVal = String(acesso?.senha ?? "").toLowerCase();
          if (!passVal.includes(sFilter.senha.trim().toLowerCase())) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    filteredByOp,
    q,
    colFilterNome,
    colFilterCpf,
    colFilterAdmissao,
    colFilterProduto,
    colFilterEntrada,
    colFilterSaida,
    colFilterNascimento,
    colFilterEmail,
    colFilterSenhaEmail,
    colFilterTelefone,
    colFilterCargo,
    colFilterInativado,
    colFilterSistemas,
    onlyInativos,
    onlyPreAtendimento,
  ]);

  const totalPages = pageSize > 0 ? Math.ceil(filtered.length / pageSize) : 1;
  const currentPage = Math.min(Math.max(1, page), totalPages || 1);
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return filtered;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r: any) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r: any) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r: any) => next.add(r.id));
        return next;
      });
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const copy = useCallback((v: string | null, label: string) => {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  }, []);

  function exportar(onlySelected = false) {
    const targetRows = onlySelected ? filtered.filter((r: any) => selectedIds.has(r.id)) : filtered;

    if (onlySelected && targetRows.length === 0) {
      toast.error("Nenhum operador selecionado para exportar");
      return;
    }

    const rows = targetRows.map((r: any) => {
      const base: any = {
        Nome: r.nome,
        CPF: r.cpf ?? "",
      };

      if (onlyPreAtendimento) {
        base["Admissão"] = formatDateBR(r.admissao_em);
        base["Produto"] = r.produto ?? "";
        base["Entrada"] = r.horario_entrada ?? "";
        base["Saída"] = r.horario_saida ?? "";
      }

      base["Data de Nascimento"] = formatDateBR(r.data_nascimento);
      base["Email"] = r.email ?? "";
      base["Senha e-mail"] = r.email_senha ?? "";
      base["Telefone"] = r.telefone ?? "";
      base["Cargo"] = r.cargo ?? "";
      base["Status"] = r.status ?? "ativo";

      if (onlyInativos) {
        base["Data Inativação"] = formatDateBR(r.inativado_em);
      }
      for (const s of sistemas) {
        base[`${s.nome} - Usuário`] = r.acessos[s.id]?.login ?? "";
        base[`${s.nome} - Senha`] = r.acessos[s.id]?.senha ?? "";
      }
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const sheetName = onlyInativos ? "Inativos" : onlyPreAtendimento ? "Pré-Atendimento" : "Matriz";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const fileName = onlySelected
      ? onlyInativos
        ? "usuarios-inativos-selecionados.xlsx"
        : onlyPreAtendimento
          ? "pre-atendimento-selecionados.xlsx"
          : "matriz-acessos-selecionados.xlsx"
      : onlyInativos
        ? "usuarios-inativos.xlsx"
        : onlyPreAtendimento
          ? "pre-atendimento.xlsx"
          : "matriz-acessos.xlsx";

    XLSX.writeFile(wb, fileName);
    toast.success(`${rows.length} operador(es) exportado(s) com sucesso!`);
  }

  const Val = ({
    v,
    label,
    onEdit,
  }: {
    v: string | null | undefined;
    label: string;
    onEdit?: () => void;
  }) => (
    <div className="flex items-center gap-1 group min-w-0">
      <span className="font-mono text-[11px] truncate">{v ? (reveal ? v : "••••") : "—"}</span>
      {v && (
        <button onClick={() => copy(v, label)} className="opacity-0 group-hover:opacity-100">
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
      {onEdit && (
        <button onClick={onEdit} className="opacity-0 group-hover:opacity-100">
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {onlyInativos
              ? "Usuários Inativos"
              : onlyPreAtendimento
                ? "Pré-Atendimento"
                : "Matriz de Acessos"}
          </h1>
          <p className="text-muted-foreground">
            {onlyInativos
              ? "Colaboradores marcados como inativos e seus acessos"
              : onlyPreAtendimento
                ? "Colaboradores em pré-atendimento com controle de admissão, produto, horários e transferências"
                : "Colaboradores, credenciais e sistemas em uma única visão"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setReveal((r) => !r)} className="gap-2">
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {reveal ? "Ocultar" : "Mostrar"}
          </Button>
          {selectedIds.size > 0 ? (
            <Button
              variant="default"
              onClick={() => exportar(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <FileDown className="h-4 w-4" /> Exportar Selecionados ({selectedIds.size})
            </Button>
          ) : (
            <Button variant="outline" onClick={() => exportar(false)} className="gap-2">
              <FileDown className="h-4 w-4" /> Exportar Excel
            </Button>
          )}
          {!onlyInativos && (
            <>
              <Link to="/importar">
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" /> Importar CSV
                </Button>
              </Link>
              <Dialog open={newSisOpen} onOpenChange={setNewSisOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Novo sistema
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo sistema</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      criarSistema.mutate({
                        nome: fd.get("nome"),
                        categoria: fd.get("categoria") || null,
                        criticidade: fd.get("criticidade") || "media",
                        ativo: true,
                      });
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <Label>Nome</Label>
                      <Input name="nome" required />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Input name="categoria" />
                    </div>
                    <div>
                      <Label>Criticidade</Label>
                      <Select name="criticidade" defaultValue="media">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="critica">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Criar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={newColOpen} onOpenChange={setNewColOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Novo colaborador
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {onlyPreAtendimento
                        ? "Novo Colaborador — Pré-Atendimento"
                        : "Novo Colaborador"}
                    </DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      criarColab.mutate({
                        nome: fd.get("nome"),
                        cpf: (fd.get("cpf") as string) || null,
                        matricula: (fd.get("matricula") as string) || null,
                        email: (fd.get("email") as string) || null,
                        email_senha: (fd.get("email_senha") as string) || null,
                        telefone: (fd.get("telefone") as string) || null,
                        cargo: (fd.get("cargo") as string) || null,
                        operacao_id: (fd.get("operacao_id") as string) || null,
                        admissao_em: (fd.get("admissao_em") as string) || null,
                        data_nascimento: (fd.get("data_nascimento") as string) || null,
                        produto: (fd.get("produto") as string) || null,
                        horario_entrada: (fd.get("horario_entrada") as string) || null,
                        horario_saida: (fd.get("horario_saida") as string) || null,
                        em_pre_atendimento: onlyPreAtendimento,
                        observacoes: (fd.get("observacoes") as string) || null,
                      });
                    }}
                    className="grid grid-cols-2 gap-3"
                  >
                    <div className="col-span-2">
                      <Label>Nome completo *</Label>
                      <Input name="nome" required />
                    </div>
                    <div>
                      <Label>CPF *</Label>
                      <Input name="cpf" placeholder="Obrigatório p/ operador" />
                    </div>
                    <div>
                      <Label>Matrícula</Label>
                      <Input name="matricula" />
                    </div>
                    {onlyPreAtendimento && (
                      <>
                        <div>
                          <Label>Produto</Label>
                          <Input name="produto" placeholder="Ex: Voz, Chat, Backoffice..." />
                        </div>
                        <div>
                          <Label>Entrada (Horário)</Label>
                          <Input name="horario_entrada" placeholder="Ex: 08:00" />
                        </div>
                        <div>
                          <Label>Saída (Horário)</Label>
                          <Input name="horario_saida" placeholder="Ex: 17:00" />
                        </div>
                      </>
                    )}
                    <div>
                      <Label>E-mail</Label>
                      <Input name="email" type="email" />
                    </div>
                    <div>
                      <Label>Senha do e-mail</Label>
                      <Input name="email_senha" />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input name="telefone" />
                    </div>
                    <div>
                      <Label>Cargo</Label>
                      <Input name="cargo" />
                    </div>
                    <div>
                      <Label>Operação</Label>
                      <Select
                        name="operacao_id"
                        defaultValue={
                          selectedOperacaoId !== "todas" && selectedOperacaoId !== "sem_operacao"
                            ? selectedOperacaoId
                            : undefined
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {operacoes.map((o: any) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Admissão</Label>
                      <Input name="admissao_em" type="date" />
                    </div>
                    <div>
                      <Label>Data de Nascimento</Label>
                      <Input name="data_nascimento" type="date" />
                    </div>
                    <div className="col-span-2">
                      <Label>Observações</Label>
                      <Input name="observacoes" />
                    </div>
                    <DialogFooter className="col-span-2">
                      <Button type="submit" disabled={criarColab.isPending}>
                        Salvar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <OperationFilterBar
        selectedOperacaoId={selectedOperacaoId}
        onChange={setSelectedOperacaoId}
        counts={operacaoCounts}
      />

      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 h-9 text-xs"
                placeholder="Buscar por nome, CPF, e-mail ou telefone..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Total: {filtered.length} colaborador{filtered.length === 1 ? "" : "es"}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-2 px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-primary font-medium">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span>
                <strong>{selectedIds.size}</strong> colaborador(es) selecionado(s) de{" "}
                {filtered.length}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onlyPreAtendimento && (
                <>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => transferirSelecionadosParaMatriz.mutate(Array.from(selectedIds))}
                    disabled={transferirSelecionadosParaMatriz.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Transferir p/ Matriz ({selectedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() =>
                      transferirSelecionadosParaInativos.mutate(Array.from(selectedIds))
                    }
                    disabled={transferirSelecionadosParaInativos.isPending}
                  >
                    <UserX className="h-3.5 w-3.5" />
                    Transferir p/ Inativos ({selectedIds.size})
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs hover:bg-primary/10 text-primary"
                onClick={clearSelection}
              >
                Limpar seleção
              </Button>
              <Button
                size="sm"
                onClick={() => exportar(true)}
                className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <FileDown className="h-3.5 w-3.5" />
                Exportar Selecionados ({selectedIds.size})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-primary" /> Colaboradores × Sistemas
            <Badge variant="secondary" className="ml-1 text-xs">
              {filtered.length} registro{filtered.length === 1 ? "" : "s"}
            </Badge>
            {selectedIds.size > 0 && (
              <Badge variant="default" className="bg-emerald-600 text-white text-xs">
                {selectedIds.size} selecionado(s)
              </Badge>
            )}
          </CardTitle>
          <div className="text-xs text-muted-foreground font-medium">
            Página {currentPage} de {totalPages || 1}
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-auto max-h-[calc(100vh-280px)] relative">
          <table className="text-xs border-collapse w-full relative">
            <thead className="bg-muted uppercase text-[11px] font-semibold text-muted-foreground sticky top-0 z-30 shadow-sm">
              <tr>
                <th className="p-2.5 text-left border-b border-r sticky left-0 top-0 bg-muted z-40 min-w-[210px] shadow-sm">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos os colaboradores"
                    />
                    <span>Nome</span>
                  </div>
                </th>
                <th className="p-2.5 text-left border-b border-r min-w-[110px]">CPF</th>
                {onlyPreAtendimento && (
                  <>
                    <th className="p-2.5 text-left border-b border-r min-w-[110px]">Admissão</th>
                    <th className="p-2.5 text-left border-b border-r min-w-[130px]">Produto</th>
                    <th className="p-2.5 text-left border-b border-r min-w-[90px]">Entrada</th>
                    <th className="p-2.5 text-left border-b border-r min-w-[90px]">Saída</th>
                  </>
                )}
                <th className="p-2.5 text-left border-b border-r min-w-[100px]">Nascimento</th>
                <th className="p-2.5 text-left border-b border-r min-w-[160px]">E-mail</th>
                <th className="p-2.5 text-left border-b border-r min-w-[120px]">Senha e-mail</th>
                <th className="p-2.5 text-left border-b border-r min-w-[110px]">Telefone</th>
                <th className="p-2.5 text-left border-b border-r min-w-[120px]">Cargo</th>
                {onlyInativos && (
                  <th className="p-2.5 text-left border-b border-r min-w-[110px]">Inativado em</th>
                )}
                <th className="p-2.5 text-center border-b border-r min-w-[120px]">Ações</th>
                {sistemas.map((s) => (
                  <th
                    key={s.id}
                    colSpan={2}
                    className="p-2 text-center border-b border-r bg-primary/10 font-semibold text-foreground min-w-[200px]"
                  >
                    {s.nome}
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/80 border-b text-[10px]">
                <th className="border-r sticky left-0 bg-muted z-40 shadow-sm" />
                <th className="border-r" />
                {onlyPreAtendimento && (
                  <>
                    <th className="border-r" />
                    <th className="border-r" />
                    <th className="border-r" />
                    <th className="border-r" />
                  </>
                )}
                <th className="border-r" />
                <th className="border-r" />
                <th className="border-r" />
                <th className="border-r" />
                <th className="border-r" />
                {onlyInativos && <th className="border-r" />}
                <th className="border-r" />
                {sistemas.map((s) => (
                  <Fragment key={s.id}>
                    <th className="p-1 text-left border-r font-medium">Usuário</th>
                    <th className="p-1 text-left border-r font-medium">Senha</th>
                  </Fragment>
                ))}
              </tr>
              <tr className="bg-muted/50 border-b text-[10px] h-9">
                <th className="p-1 border-r sticky left-0 bg-muted z-40 shadow-sm min-w-[210px]">
                  <Input
                    value={colFilterNome}
                    onChange={(e) => {
                      setColFilterNome(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Filtrar nome..."
                    className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                  />
                </th>
                <th className="p-1 border-r min-w-[110px]">
                  <Input
                    value={colFilterCpf}
                    onChange={(e) => {
                      setColFilterCpf(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Filtrar CPF..."
                    className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                  />
                </th>
                {onlyPreAtendimento && (
                  <>
                    <th className="p-1 border-r min-w-[110px]">
                      <Input
                        value={colFilterAdmissao}
                        onChange={(e) => {
                          setColFilterAdmissao(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Filtrar adm..."
                        className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                      />
                    </th>
                    <th className="p-1 border-r min-w-[130px]">
                      <Input
                        value={colFilterProduto}
                        onChange={(e) => {
                          setColFilterProduto(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Filtrar prod..."
                        className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                      />
                    </th>
                    <th className="p-1 border-r min-w-[90px]">
                      <Input
                        value={colFilterEntrada}
                        onChange={(e) => {
                          setColFilterEntrada(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Entrada..."
                        className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                      />
                    </th>
                    <th className="p-1 border-r min-w-[90px]">
                      <Input
                        value={colFilterSaida}
                        onChange={(e) => {
                          setColFilterSaida(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Saída..."
                        className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                      />
                    </th>
                  </>
                )}
                <th className="p-1 border-r min-w-[100px]">
                  <Input
                    value={colFilterNascimento}
                    onChange={(e) => {
                      setColFilterNascimento(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Filtrar nasc..."
                    className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                  />
                </th>
                <th className="p-1 border-r min-w-[160px]">
                  <Input
                    value={colFilterEmail}
                    onChange={(e) => {
                      setColFilterEmail(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Filtrar e-mail..."
                    className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                  />
                </th>
                <th className="p-1 border-r min-w-[120px]">
                  <Input
                    value={colFilterSenhaEmail}
                    onChange={(e) => {
                      setColFilterSenhaEmail(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Filtrar senha..."
                    className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                  />
                </th>
                <th className="p-1 border-r min-w-[110px]">
                  <Input
                    value={colFilterTelefone}
                    onChange={(e) => {
                      setColFilterTelefone(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Filtrar tel..."
                    className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                  />
                </th>
                <th className="p-1 border-r min-w-[120px]">
                  <Input
                    value={colFilterCargo}
                    onChange={(e) => {
                      setColFilterCargo(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Filtrar cargo..."
                    className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                  />
                </th>
                {onlyInativos && (
                  <th className="p-1 border-r min-w-[110px]">
                    <Input
                      value={colFilterInativado}
                      onChange={(e) => {
                        setColFilterInativado(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Filtrar inativ..."
                      className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                    />
                  </th>
                )}
                <th className="p-1 border-r min-w-[120px] text-center">
                  {!!(
                    colFilterNome ||
                    colFilterCpf ||
                    colFilterAdmissao ||
                    colFilterProduto ||
                    colFilterEntrada ||
                    colFilterSaida ||
                    colFilterNascimento ||
                    colFilterEmail ||
                    colFilterSenhaEmail ||
                    colFilterTelefone ||
                    colFilterCargo ||
                    colFilterInativado ||
                    Object.values(colFilterSistemas).some((sf) => sf.usuario || sf.senha)
                  ) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Limpar todos os filtros"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setColFilterNome("");
                        setColFilterCpf("");
                        setColFilterAdmissao("");
                        setColFilterProduto("");
                        setColFilterEntrada("");
                        setColFilterSaida("");
                        setColFilterNascimento("");
                        setColFilterEmail("");
                        setColFilterSenhaEmail("");
                        setColFilterTelefone("");
                        setColFilterCargo("");
                        setColFilterInativado("");
                        setColFilterSistemas({});
                        setPage(1);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </th>
                {sistemas.map((s) => (
                  <Fragment key={s.id}>
                    <th className="p-1 border-r min-w-[100px]">
                      <Input
                        value={colFilterSistemas[s.id]?.usuario ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setColFilterSistemas((prev) => ({
                            ...prev,
                            [s.id]: {
                              usuario: val,
                              senha: prev[s.id]?.senha ?? "",
                            },
                          }));
                          setPage(1);
                        }}
                        placeholder="User..."
                        className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                      />
                    </th>
                    <th className="p-1 border-r min-w-[100px]">
                      <Input
                        value={colFilterSistemas[s.id]?.senha ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setColFilterSistemas((prev) => ({
                            ...prev,
                            [s.id]: {
                              usuario: prev[s.id]?.usuario ?? "",
                              senha: val,
                            },
                          }));
                          setPage(1);
                        }}
                        placeholder="Senha..."
                        className="h-6 text-[10px] px-1.5 py-0 bg-background border border-muted-foreground/20 rounded font-normal w-full"
                      />
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedRows.map((r: any) => {
                const isSelected = selectedIds.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className={
                      "transition-colors " +
                      (isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/40 ") +
                      (r.status === "inativo" || r.status === "desligado" ? " opacity-85" : "")
                    }
                  >
                    <td className="p-2 border-r font-medium sticky left-0 bg-background z-20 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(r.id)}
                            aria-label={`Selecionar ${r.nome}`}
                          />
                          <span className="truncate max-w-[140px]" title={r.nome}>
                            {r.nome}
                          </span>
                        </div>
                        {(r.status === "inativo" || r.status === "desligado") && (
                          <Badge
                            variant="destructive"
                            className="text-[9px] px-1 py-0 h-4 shrink-0"
                          >
                            {r.status}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-2 border-r font-mono text-[11px] text-muted-foreground">
                      {r.cpf ?? "—"}
                    </td>
                    {onlyPreAtendimento && (
                      <>
                        <td className="p-2 border-r text-[11px]">{formatDateBR(r.admissao_em)}</td>
                        <td
                          className="p-2 border-r text-[11px] truncate max-w-[130px]"
                          title={r.produto ?? ""}
                        >
                          {r.produto || "—"}
                        </td>
                        <td className="p-2 border-r text-[11px]">{r.horario_entrada || "—"}</td>
                        <td className="p-2 border-r text-[11px]">{r.horario_saida || "—"}</td>
                      </>
                    )}
                    <td className="p-2 border-r text-[11px]">{formatDateBR(r.data_nascimento)}</td>
                    <td
                      className="p-2 border-r text-[11px] truncate max-w-[160px]"
                      title={r.email ?? ""}
                    >
                      {r.email ?? "—"}
                    </td>
                    <td className="p-2 border-r">
                      <ValCell
                        v={r.email_senha}
                        label="Senha e-mail"
                        reveal={reveal}
                        onCopy={copy}
                      />
                    </td>
                    <td className="p-2 border-r text-[11px]">{r.telefone ?? "—"}</td>
                    <td className="p-2 border-r text-[11px] truncate max-w-[120px]">
                      {r.cargo ?? "—"}
                    </td>
                    {onlyInativos && (
                      <td className="p-2 border-r text-[11px]">{formatDateBR(r.inativado_em)}</td>
                    )}
                    <td className="p-2 border-r">
                      <div className="flex items-center justify-center gap-1">
                        {onlyPreAtendimento && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              title="Check: Transferir para Matriz de Acessos"
                              onClick={() => transferirParaMatriz.mutate(r.id)}
                              disabled={transferirParaMatriz.isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              title="Transferir para Inativos (Data atual)"
                              onClick={() => transferirParaInativos.mutate(r.id)}
                              disabled={transferirParaInativos.isPending}
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          title="Editar"
                          onClick={() => setEditColab(r)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          title="Adicionar acesso"
                          onClick={() => setAddAcessoFor(r)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        {!onlyPreAtendimento && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            title={r.status === "inativo" ? "Reativar" : "Marcar inativo"}
                            onClick={() =>
                              flagInativo.mutate({ id: r.id, inativo: r.status !== "inativo" })
                            }
                          >
                            <UserX
                              className={
                                "h-3 w-3 " + (r.status === "inativo" ? "text-destructive" : "")
                              }
                            />
                          </Button>
                        )}
                        {isMaster && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Excluir colaborador"
                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (window.confirm(`Tem certeza que deseja excluir ${r.nome}?`)) {
                                excluirColab.mutate(r.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                    {sistemas.map((s) => {
                      const a = r.acessos[s.id];
                      return (
                        <Fragment key={s.id}>
                          <td className="p-2 border-r">
                            <ValCell
                              v={a?.login}
                              label="Usuário"
                              reveal={reveal}
                              onCopy={copy}
                              onEdit={() => {
                                if (a) {
                                  setEditAcesso({
                                    ...a,
                                    colab_nome: r.nome,
                                    sistema_nome: s.nome,
                                  });
                                } else {
                                  setAddAcessoFor({ colab: r, sistemaId: s.id });
                                }
                              }}
                            />
                          </td>
                          <td className="p-2 border-r">
                            <ValCell
                              v={a?.senha}
                              label="Senha"
                              reveal={reveal}
                              onCopy={copy}
                              onEdit={() => {
                                if (a) {
                                  setEditAcesso({
                                    ...a,
                                    colab_nome: r.nome,
                                    sistema_nome: s.nome,
                                  });
                                } else {
                                  setAddAcessoFor({ colab: r, sistemaId: s.id });
                                }
                              }}
                            />
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8 + (onlyInativos ? 1 : 0) + sistemas.length * 2}
                    className="p-8 text-center text-muted-foreground text-sm"
                  >
                    Nenhum colaborador encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>

        <div className="px-4 py-3 bg-muted/20 border-t text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>
              Exibindo{" "}
              {filtered.length === 0
                ? 0
                : pageSize > 0
                  ? Math.min((currentPage - 1) * pageSize + 1, filtered.length)
                  : 1}{" "}
              - {pageSize > 0 ? Math.min(currentPage * pageSize, filtered.length) : filtered.length}{" "}
              de <strong>{filtered.length}</strong> colaboradores
            </span>
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="text-[11px] font-normal">
                {selectedIds.size} selecionado(s)
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Por página:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 text-xs w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                  <SelectItem value="0">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pageSize > 0 && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Anterior
                </Button>
                <span className="px-2 text-xs font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={!!addAcessoFor} onOpenChange={(o) => !o && setAddAcessoFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Adicionar acesso — {addAcessoFor?.colab?.nome || addAcessoFor?.nome}
            </DialogTitle>
          </DialogHeader>
          {addAcessoFor && (
            <form
              key={
                (addAcessoFor?.colab?.id || addAcessoFor?.id) +
                "-" +
                (addAcessoFor?.sistemaId ?? "new")
              }
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const colabId = addAcessoFor?.colab?.id || addAcessoFor?.id;
                criarAcesso.mutate({
                  colaborador_id: colabId,
                  sistema_id: fd.get("sistema_id"),
                  login: fd.get("login") || null,
                  senha: fd.get("senha") || null,
                  status: "ativo",
                });
              }}
              className="space-y-3"
            >
              <div>
                <Label>Sistema *</Label>
                <Select name="sistema_id" defaultValue={addAcessoFor?.sistemaId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {sistemasAll.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Usuário *</Label>
                <Input name="login" required />
              </div>
              <div>
                <Label>Senha *</Label>
                <Input name="senha" required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={criarAcesso.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editColab} onOpenChange={(o) => !o && setEditColab(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar colaborador</DialogTitle>
          </DialogHeader>
          {editColab && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                editarColab.mutate({
                  id: editColab.id,
                  nome: fd.get("nome"),
                  cpf: (fd.get("cpf") as string) || null,
                  matricula: (fd.get("matricula") as string) || null,
                  email: (fd.get("email") as string) || null,
                  email_senha: (fd.get("email_senha") as string) || null,
                  telefone: (fd.get("telefone") as string) || null,
                  cargo: (fd.get("cargo") as string) || null,
                  operacao_id: (fd.get("operacao_id") as string) || null,
                  admissao_em: (fd.get("admissao_em") as string) || null,
                  produto: (fd.get("produto") as string) || null,
                  horario_entrada: (fd.get("horario_entrada") as string) || null,
                  horario_saida: (fd.get("horario_saida") as string) || null,
                  data_nascimento: (fd.get("data_nascimento") as string) || null,
                  status: (fd.get("status") as string) || "ativo",
                });
              }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input name="nome" defaultValue={editColab.nome} required />
              </div>
              <div>
                <Label>CPF</Label>
                <Input name="cpf" defaultValue={editColab.cpf ?? ""} />
              </div>
              <div>
                <Label>Matrícula</Label>
                <Input name="matricula" defaultValue={editColab.matricula ?? ""} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input name="email" defaultValue={editColab.email ?? ""} />
              </div>
              <div>
                <Label>Senha do e-mail</Label>
                <Input name="email_senha" defaultValue={editColab.email_senha ?? ""} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input name="telefone" defaultValue={editColab.telefone ?? ""} />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input name="cargo" defaultValue={editColab.cargo ?? ""} />
              </div>
              <div>
                <Label>Operação</Label>
                <Select name="operacao_id" defaultValue={editColab.operacao_id ?? undefined}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {operacoes.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Admissão</Label>
                <Input
                  name="admissao_em"
                  type="date"
                  defaultValue={toInputDateValue(editColab.admissao_em)}
                />
              </div>
              <div>
                <Label>Produto</Label>
                <Input name="produto" defaultValue={editColab.produto ?? ""} />
              </div>
              <div>
                <Label>Entrada (Horário)</Label>
                <Input name="horario_entrada" defaultValue={editColab.horario_entrada ?? ""} />
              </div>
              <div>
                <Label>Saída (Horário)</Label>
                <Input name="horario_saida" defaultValue={editColab.horario_saida ?? ""} />
              </div>
              <div>
                <Label>Data de Nascimento</Label>
                <Input
                  name="data_nascimento"
                  type="date"
                  defaultValue={toInputDateValue(editColab.data_nascimento)}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue={editColab.status ?? "ativo"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="desligado">Desligado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="col-span-2">
                <Button type="submit" disabled={editarColab.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAcesso} onOpenChange={(o) => !o && setEditAcesso(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar acesso — {editAcesso?.colab_nome} / {editAcesso?.sistema_nome}
            </DialogTitle>
          </DialogHeader>
          {editAcesso && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                editarAcesso.mutate({
                  id: editAcesso.id,
                  login: fd.get("login") || null,
                  senha: fd.get("senha") || null,
                });
              }}
              className="space-y-3"
            >
              <div>
                <Label>Usuário</Label>
                <Input name="login" defaultValue={editAcesso.login ?? ""} />
              </div>
              <div>
                <Label>Senha</Label>
                <Input name="senha" defaultValue={editAcesso.senha ?? ""} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={editarAcesso.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MatrizAcessos() {
  return <MatrizView />;
}
