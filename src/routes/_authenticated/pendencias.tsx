import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  MessageSquare,
  Upload,
  FileDown,
  Settings,
  Trash2,
  ChevronDown,
  FileSpreadsheet,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { parseDateToISO } from "@/routes/_authenticated/importar";
import { OperationFilterBar } from "@/components/OperationFilterBar";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

type PendenciasSearchParams = {
  id?: string;
};

export const Route = createFileRoute("/_authenticated/pendencias")({
  component: Pendencias,
  validateSearch: (search: Record<string, unknown>): PendenciasSearchParams => {
    return {
      id: typeof search.id === "string" ? search.id : undefined,
    };
  },
});

const PRIO_COLOR: Record<string, string> = {
  baixa: "bg-slate-400",
  media: "bg-blue-500",
  alta: "bg-amber-500",
  critica: "bg-destructive",
};

export function normalizeStatus(s: string): string {
  if (!s) return "";
  return String(s)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

export function getQuadroColor(cor: string): string {
  const c = cor || "bg-slate-500";
  if (c === "bg-success") return "bg-emerald-600";
  return c;
}

export const QUADRO_COLOR_OPTIONS = [
  { label: "Cinza", value: "bg-slate-500" },
  { label: "Azul", value: "bg-blue-600" },
  { label: "Verde", value: "bg-emerald-600" },
  { label: "Amarelo", value: "bg-amber-500" },
  { label: "Laranja", value: "bg-orange-500" },
  { label: "Roxo", value: "bg-purple-600" },
  { label: "Vermelho", value: "bg-red-600" },
  { label: "Ciano", value: "bg-cyan-600" },
  { label: "Rosa", value: "bg-pink-600" },
];

export function matchesColumnStatus(
  pStatus: string,
  colNome: string,
  allQuadrosNomes: string[],
): boolean {
  if (!pStatus || !colNome) return false;
  const normP = normalizeStatus(pStatus);
  const normCol = normalizeStatus(colNome);

  if (normP === normCol) return true;

  const pendingAliases = [
    "pendente",
    "backlog",
    "em analise",
    "em andamento",
    "aguardando",
    "solicitacao acesso",
    "novo",
    "aberto",
  ];
  const erroAliases = ["com erro", "erro", "falha", "com falha", "bug", "problema"];
  const senhaAliases = ["redefinir senha", "reset senha", "trocar senha", "senha", "esqueci senha"];
  const concluidoAliases = [
    "desbloqueio",
    "concluido",
    "concluida",
    "finalizado",
    "finalizada",
    "resolvido",
    "resolvida",
  ];

  const isPendingCol = pendingAliases.some((a) => normCol.includes(a));
  const isErroCol = erroAliases.some((a) => normCol.includes(a));
  const isSenhaCol = senhaAliases.some((a) => normCol.includes(a));
  const isConcluidoCol = concluidoAliases.some((a) => normCol.includes(a));

  if (isPendingCol && pendingAliases.some((a) => normP === a || normP.includes(a))) return true;
  if (isErroCol && erroAliases.some((a) => normP === a || normP.includes(a))) return true;
  if (isSenhaCol && senhaAliases.some((a) => normP === a || normP.includes(a))) return true;
  if (isConcluidoCol && concluidoAliases.some((a) => normP === a || normP.includes(a))) return true;

  const hasMatchAnywhere = allQuadrosNomes.some((qName) => {
    const nQ = normalizeStatus(qName);
    if (normP === nQ) return true;
    if (
      pendingAliases.some((a) => nQ.includes(a)) &&
      pendingAliases.some((a) => normP === a || normP.includes(a))
    )
      return true;
    if (
      erroAliases.some((a) => nQ.includes(a)) &&
      erroAliases.some((a) => normP === a || normP.includes(a))
    )
      return true;
    if (
      senhaAliases.some((a) => nQ.includes(a)) &&
      senhaAliases.some((a) => normP === a || normP.includes(a))
    )
      return true;
    if (
      concluidoAliases.some((a) => nQ.includes(a)) &&
      concluidoAliases.some((a) => normP === a || normP.includes(a))
    )
      return true;
    return false;
  });

  if (!hasMatchAnywhere && allQuadrosNomes.length > 0 && allQuadrosNomes[0] === colNome) {
    return true;
  }

  return false;
}

function Pendencias() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [openQuadros, setOpenQuadros] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(search.id || null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sistemaFiltro, setSistemaFiltro] = useState<string>("todos");
  const [selectedOperacaoId, setSelectedOperacaoId] = useState("todas");
  const [selectedSistemas, setSelectedSistemas] = useState<string[]>([]);
  const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
  const [modalColabSearch, setModalColabSearch] = useState("");
  const [modalColabOpFilter, setModalColabOpFilter] = useState("todas");
  const [modalSisSearch, setModalSisSearch] = useState("");
  const [formDateInicio, setFormDateInicio] = useState(new Date().toISOString().slice(0, 10));
  const [formQuadro, setFormQuadro] = useState<string>("");
  const [novoQuadroCor, setNovoQuadroCor] = useState<string>("bg-slate-500");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const getStartDateStr = (p: any) => {
    if (!p.data_inicio) return "";
    return typeof p.data_inicio === "string"
      ? p.data_inicio.split("T")[0]
      : new Date(p.data_inicio).toISOString().split("T")[0];
  };

  const activateRequest = useMutation({
    mutationFn: async (id: string) => {
      const nowStr = new Date().toISOString().split("T")[0];
      const { error } = await db.from("pendencias").update({ data_inicio: nowStr }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação ativada com sucesso! Card disponível no Quadro Kanban.");
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: quadros = [] } = useQuery({
    queryKey: ["pendencia_quadros"],
    queryFn: async () => (await db.from("pendencia_quadros").select("*").order("ordem")).data ?? [],
  });

  const { data: list = [] } = useQuery({
    queryKey: ["pendencias"],
    queryFn: async () =>
      (
        await db
          .from("pendencias")
          .select(
            "*, colaborador:colaboradores(id, nome, operacao_id, status), sistema:sistemas(id, nome, sla_horas)",
          )
          .eq("arquivado", false)
          .order("posicao")
      ).data ?? [],
  });
  const { data: colabs = [] } = useQuery({
    queryKey: ["colabs-simple"],
    queryFn: async () =>
      (
        await db
          .from("colaboradores")
          .select("id,nome,status,operacao_id,cpf,operacao:operacoes(nome)")
          .neq("status", "inativo")
          .neq("status", "desligado")
          .order("nome")
      ).data ?? [],
  });
  const { data: sistemas = [] } = useQuery({
    queryKey: ["sistemas-simple"],
    queryFn: async () =>
      (await db.from("sistemas").select("id,nome,sla_horas").order("nome")).data ?? [],
  });
  const { data: operacoes = [] } = useQuery({
    queryKey: ["operacoes-simple"],
    queryFn: async () => (await db.from("operacoes").select("id,nome").order("nome")).data ?? [],
  });

  const deletePendencia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("pendencias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pendência excluída");
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is_admin_pendencias"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return false;
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
      return (roles ?? []).some((r) => r.role === "admin" || r.role === "admin_master");
    },
  });

  const create = useMutation({
    mutationFn: async (form: any | any[]) => {
      const { data: u } = await db.auth.getUser();
      const items = Array.isArray(form) ? form : [form];

      // Sanitize payloads and ensure valid foreign keys
      const payloads = items.map((item) => {
        const colabObj = colabs.find((c: any) => c.id === item.colaborador_id);
        const resolvedOpId =
          item.operacao_id &&
          item.operacao_id !== "" &&
          item.operacao_id !== "todas" &&
          item.operacao_id !== "sem_operacao"
            ? item.operacao_id
            : colabObj?.operacao_id || null;

        let dataInicioVal = item.data_inicio;
        if (dataInicioVal && typeof dataInicioVal === "string" && !dataInicioVal.includes("T")) {
          dataInicioVal = `${dataInicioVal}T12:00:00Z`;
        } else if (!dataInicioVal) {
          dataInicioVal = new Date().toISOString();
        }

        let slaVal = item.sla_em;
        if (slaVal && typeof slaVal === "string" && !slaVal.includes("T")) {
          slaVal = `${slaVal}T23:59:59Z`;
        } else if (!slaVal || slaVal === "") {
          slaVal = null;
        }

        return {
          titulo: String(item.titulo || "").trim() || "Nova Solicitação",
          descricao:
            item.descricao && String(item.descricao).trim() !== ""
              ? String(item.descricao).trim()
              : null,
          tipo: item.tipo || "outro",
          status: item.status || "PENDENTE",
          prioridade: item.prioridade || "media",
          colaborador_id:
            item.colaborador_id && item.colaborador_id !== "" ? item.colaborador_id : null,
          sistema_id: item.sistema_id && item.sistema_id !== "" ? item.sistema_id : null,
          operacao_id: resolvedOpId,
          data_inicio: dataInicioVal,
          sla_em: slaVal,
          etiquetas: Array.isArray(item.etiquetas) ? item.etiquetas : [],
          solicitado: item.solicitado ?? true,
          criado_por: u.user?.id || null,
        };
      });

      // Insert in chunks of 50 to prevent huge request timeouts
      const CHUNK_SIZE = 50;
      const allInserted: any[] = [];
      for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
        const chunk = payloads.slice(i, i + CHUNK_SIZE);
        const { data: insertedChunk, error } = await db
          .from("pendencias")
          .insert(chunk)
          .select("*");
        if (error) throw error;
        if (insertedChunk) allInserted.push(...insertedChunk);
      }

      // Fast bulk sync acessos if solicitado = true
      const itemsToSync = allInserted.filter(
        (item) => item.solicitado && item.colaborador_id && item.sistema_id,
      );

      if (itemsToSync.length > 0) {
        const colabIds = Array.from(new Set(itemsToSync.map((i) => i.colaborador_id)));
        const { data: exAcessos = [] } = await db
          .from("acessos")
          .select("id, colaborador_id, sistema_id, login, senha")
          .in("colaborador_id", colabIds);

        const exAcessosMap = new Map<string, any>();
        for (const a of exAcessos ?? []) {
          exAcessosMap.set(`${a.colaborador_id}:${a.sistema_id}`, a);
        }

        const toInsertAcessos: any[] = [];
        const toUpdateAcessos: { id: string; patch: any }[] = [];

        for (const item of itemsToSync) {
          const key = `${item.colaborador_id}:${item.sistema_id}`;
          const ex = exAcessosMap.get(key);
          if (ex) {
            toUpdateAcessos.push({
              id: ex.id,
              patch: {
                login: ex.login && ex.login !== "-" ? ex.login : "Solicitado",
                senha: ex.senha && ex.senha !== "-" ? ex.senha : "Solicitado",
                status: "pendente",
              },
            });
          } else {
            toInsertAcessos.push({
              colaborador_id: item.colaborador_id,
              sistema_id: item.sistema_id,
              login: "Solicitado",
              senha: "Solicitado",
              status: "pendente",
            });
          }
        }

        if (toInsertAcessos.length > 0) {
          for (let i = 0; i < toInsertAcessos.length; i += CHUNK_SIZE) {
            const chunk = toInsertAcessos.slice(i, i + CHUNK_SIZE);
            await db.from("acessos").insert(chunk);
          }
        }

        if (toUpdateAcessos.length > 0) {
          await Promise.all(
            toUpdateAcessos.map(({ id, patch }) => db.from("acessos").update(patch).eq("id", id)),
          );
        }
      }

      return allInserted.length;
    },
    onSuccess: (count) => {
      toast.success(`${count || "Todas as"} pendência(s) criada(s) com sucesso!`);
      setOpen(false);
      setSelectedSistemas([]);
      setSelectedColaboradores([]);
      setModalColabSearch("");
      setModalSisSearch("");
      qc.invalidateQueries({ queryKey: ["pendencias"] });
      qc.invalidateQueries({ queryKey: ["acessos"] });
      qc.invalidateQueries({ queryKey: ["matriz-acessos-full"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar pendências"),
  });

  const moveMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const concluidoAliases = [
        "desbloqueio",
        "concluido",
        "concluida",
        "finalizado",
        "finalizada",
        "resolvido",
        "resolvida",
      ];
      const isConcluidoStatus = concluidoAliases.some((a) => status.toLowerCase().includes(a));
      const patch: any = { status };
      if (isConcluidoStatus) {
        patch.concluido_em = new Date().toISOString();
      } else {
        patch.concluido_em = null;
        patch.data_resolucao = null;
      }
      const { error } = await db.from("pendencias").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pendencias"] }),
  });

  const addQuadro = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await db.from("pendencia_quadros").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quadro criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["pendencia_quadros"] });
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delQuadro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("pendencia_quadros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quadro removido com sucesso!");
      qc.invalidateQueries({ queryKey: ["pendencia_quadros"] });
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pendenciasCounts = useMemo(() => {
    const activeList = list.filter((p: any) => {
      if (p.solicitado === false) return false;
      const st = p.colaborador?.status;
      if (st === "inativo" || st === "desligado") return false;
      return true;
    });
    const map: Record<string, number> = { todas: activeList.length, sem_operacao: 0 };
    for (const p of activeList) {
      const opId = p.operacao_id || p.colaborador?.operacao_id;
      if (!opId) {
        map["sem_operacao"] = (map["sem_operacao"] || 0) + 1;
      } else {
        map[opId] = (map[opId] || 0) + 1;
      }
    }
    return map;
  }, [list]);

  const listPorOperacao = useMemo(() => {
    const listSolicitados = list.filter((p: any) => {
      if (p.solicitado === false) return false;
      const st = p.colaborador?.status;
      if (st === "inativo" || st === "desligado") return false;
      return true;
    });
    if (selectedOperacaoId === "todas") return listSolicitados;
    if (selectedOperacaoId === "sem_operacao") {
      return listSolicitados.filter((p: any) => !p.operacao_id && !p.colaborador?.operacao_id);
    }
    return listSolicitados.filter(
      (p: any) =>
        p.operacao_id === selectedOperacaoId || p.colaborador?.operacao_id === selectedOperacaoId,
    );
  }, [list, selectedOperacaoId]);

  const listFiltrada = useMemo(() => {
    if (sistemaFiltro === "todos") return listPorOperacao;
    return listPorOperacao.filter(
      (p: any) => p.sistema?.id === sistemaFiltro || p.sistema_id === sistemaFiltro,
    );
  }, [listPorOperacao, sistemaFiltro]);

  const handleExport = (type: "atual_xlsx" | "atual_csv" | "todas_xlsx" | "todas_csv") => {
    const isTodas = type.startsWith("todas");
    const isCsv = type.endsWith("csv");
    const sourceList = isTodas ? list : listFiltrada;

    if (sourceList.length === 0) {
      toast.warning("Nenhuma pendência encontrada para exportar.");
      return;
    }

    const operacaoMap = new Map((operacoes as any[]).map((op) => [op.id, op.nome]));

    const rows = sourceList.map((p: any) => {
      const colabName = p.colaborador?.nome ? p.colaborador.nome.toUpperCase() : p.titulo || "-";
      const opName =
        (p.operacao_id ? operacaoMap.get(p.operacao_id) : null) ||
        p.colaborador?.operacao?.nome ||
        "-";

      const dataInicioStr = p.data_inicio
        ? String(p.data_inicio).slice(0, 10).split("-").reverse().join("/")
        : "";
      const slaStr = p.sla_em ? String(p.sla_em).slice(0, 10).split("-").reverse().join("/") : "";
      const criadoEmStr = p.criado_em ? new Date(p.criado_em).toLocaleString("pt-BR") : "";

      return {
        "ID / Protocolo": p.id,
        Título: p.titulo || "",
        Tipo: p.tipo || "Geral",
        "Status / Quadro": p.status || "PENDENTE",
        Prioridade: p.prioridade ? String(p.prioridade).toUpperCase() : "MÉDIA",
        Solicitado: p.solicitado ? "Sim" : "Não",
        Sistema: p.sistema?.nome || "-",
        Colaborador: colabName,
        CPF: p.colaborador?.cpf || "",
        Operação: opName,
        "Status do Colaborador": p.colaborador?.status
          ? String(p.colaborador.status).toUpperCase()
          : "ATIVO",
        "Data Início": dataInicioStr,
        "SLA / Prazo": slaStr,
        "Criado em": criadoEmStr,
        Descrição: p.descricao || "",
      };
    });

    const prefix = isTodas ? "todas_pendencias" : "pendencias_filtradas";
    const filename = `${prefix}_${new Date().toISOString().slice(0, 10)}`;

    if (isCsv) {
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
      XLSX.utils.book_append_sheet(wb, ws, "Pendências");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    toast.success(`${rows.length} pendência(s) exportada(s) com sucesso!`);
  };

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      let text = await file.text();
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      text = text.replace(/^sep=\s*;\s*\r?\n/i, "");

      const parsed = Papa.parse<any>(text, {
        header: true,
        skipEmptyLines: true,
        delimitersToGuess: [";", ",", "\t"],
      });

      const colabMap = new Map();
      const colabObjMap = new Map();
      (colabs as any[]).forEach((c) => {
        if (c.nome) {
          colabMap.set(c.nome.toLowerCase().trim(), c.id);
          colabObjMap.set(c.id, c);
        }
        if (c.cpf) {
          colabMap.set(c.cpf.replace(/\D/g, ""), c.id);
          colabObjMap.set(c.id, c);
        }
        if (c.email) {
          colabMap.set(c.email.toLowerCase().trim(), c.id);
          colabObjMap.set(c.id, c);
        }
      });

      const sisMap = new Map((sistemas as any[]).map((s) => [s.nome.toLowerCase().trim(), s.id]));
      const opMap = new Map(
        (operacoes as any[]).map((op) => [op.nome.toLowerCase().trim(), op.id]),
      );
      const quadrosNomes = (quadros as any[]).map((q) => q.nome);
      const { data: u } = await db.auth.getUser();

      const rawRows = parsed.data.map((r: any) => {
        const newR: any = {};
        for (const [k, v] of Object.entries(r)) {
          newR[String(k).toLowerCase().trim()] = String(v ?? "").trim();
        }
        return newR;
      });

      // Auto-create missing systems if needed
      for (const r of rawRows) {
        const sisVal = (
          r.sistema ||
          r.nome_sistema ||
          r.produto ||
          r.aplicacao ||
          r.modulo ||
          ""
        ).trim();
        if (sisVal && !sisMap.has(sisVal.toLowerCase())) {
          const { data: newSis } = await db
            .from("sistemas")
            .insert({ nome: sisVal })
            .select("id, nome")
            .single();
          if (newSis) {
            sisMap.set(sisVal.toLowerCase(), newSis.id);
          }
        }
      }

      const rows = rawRows
        .map((r: any) => {
          const colabVal = (
            r.colaborador ||
            r.nome_colaborador ||
            r.colaborador_nome ||
            r.nome ||
            r.funcionario ||
            r.usuario ||
            r.cpf_colaborador ||
            r.cpf ||
            ""
          ).trim();
          const colabDigits = colabVal.replace(/\D/g, "");
          const colId =
            (colabDigits ? colabMap.get(colabDigits) : null) ??
            colabMap.get(colabVal.toLowerCase()) ??
            null;

          const matchedColab = colId ? colabObjMap.get(colId) : null;

          const sisVal = (
            r.sistema ||
            r.nome_sistema ||
            r.produto ||
            r.aplicacao ||
            r.modulo ||
            ""
          ).trim();
          const sisId = sisVal ? (sisMap.get(sisVal.toLowerCase()) ?? null) : null;

          const opVal = (
            r.operacao ||
            r.operação ||
            r.operacao_id ||
            r.filial ||
            r.setor ||
            ""
          ).trim();
          const explicitOpId = opVal ? (opMap.get(opVal.toLowerCase()) ?? null) : null;
          const resolvedOpId = explicitOpId || matchedColab?.operacao_id || null;

          const rawStatus = (r.status || r.quadro || r.coluna || r.fase || "").trim();
          let statusVal = rawStatus || (quadrosNomes.length > 0 ? quadrosNomes[0] : "PENDENTE");
          if (quadrosNomes.length > 0) {
            const matchedQ = quadrosNomes.find((qName) =>
              matchesColumnStatus(rawStatus, qName, quadrosNomes),
            );
            if (matchedQ) statusVal = matchedQ;
          }

          const dataInicioVal = (r.data_inicio || r.data_início || r.inicio || r.data || "").trim();
          const slaVal = (
            r.sla_em ||
            r.sla ||
            r.vencimento ||
            r.data_limite ||
            r.prazo ||
            ""
          ).trim();

          const rawTitulo = (
            r.titulo ||
            r.título ||
            r.assunto ||
            r.tarefa ||
            r.solicitacao ||
            ""
          ).trim();
          const finalTitulo =
            rawTitulo ||
            (colabVal
              ? `Solicitação de Acesso - ${colabVal}`
              : sisVal
                ? `Acesso ${sisVal}`
                : "Nova Pendência");

          return {
            titulo: finalTitulo,
            descricao: r.descricao || r.descrição || r.detalhes || r.obs || r.observacao || null,
            tipo: r.tipo || r.categoria || "solicitacao_acesso",
            prioridade: r.prioridade || r.urgencia || "media",
            status: statusVal,
            colaborador_id: colId,
            sistema_id: sisId,
            operacao_id: resolvedOpId,
            data_inicio: parseDateToISO(dataInicioVal) || new Date().toISOString().split("T")[0],
            sla_em: parseDateToISO(slaVal),
            etiquetas: r.etiquetas
              ? String(r.etiquetas)
                  .split(/[,;]/)
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : [],
            criado_por: u.user?.id || null,
            solicitado: true,
          };
        })
        .filter((r: any) => r.titulo);

      if (rows.length === 0) throw new Error("CSV vazio ou nenhum registro válido encontrado");

      const CHUNK_SIZE = 50;
      let totalInserted = 0;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await db.from("pendencias").insert(chunk);
        if (error) throw error;
        totalInserted += chunk.length;
      }

      return totalInserted;
    },
    onSuccess: (n) => {
      toast.success(`${n} pendência(s) importada(s) com sucesso!`);
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao importar CSV"),
  });

  function downloadTemplate() {
    const csv =
      "titulo;descricao;tipo;prioridade;status;colaborador;sistema;sla_em;etiquetas\nExemplo;Descrição;solicitacao_acesso;media;PENDENTE;Nome do Colaborador;Nome do Sistema;2025-12-31T18:00;urgente;tributário\n";
    const blob = new Blob(["\uFEFFsep=;\n" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modelo-pendencias.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const targetStatus = String(e.over.id);
    const item = list.find((p: any) => p.id === id);
    if (item && item.status !== targetStatus) moveMut.mutate({ id, status: targetStatus });
  }

  const activeItem = activeId ? list.find((p: any) => p.id === activeId) : null;
  const detail = detailId ? list.find((p: any) => p.id === detailId) : null;

  const filteredModalColabs = useMemo(() => {
    return colabs.filter((c: any) => {
      if (modalColabOpFilter !== "todas") {
        if (modalColabOpFilter === "sem_operacao") {
          if (c.operacao_id) return false;
        } else if (c.operacao_id !== modalColabOpFilter) {
          return false;
        }
      }
      if (!modalColabSearch.trim()) return true;
      const term = modalColabSearch.toLowerCase().trim();
      const nomeMatch = (c.nome || "").toLowerCase().includes(term);
      const cpfMatch = (c.cpf || "").replace(/\D/g, "").includes(term.replace(/\D/g, ""));
      const opMatch = (c.operacao?.nome || "").toLowerCase().includes(term);
      return nomeMatch || cpfMatch || opMatch;
    });
  }, [colabs, modalColabSearch, modalColabOpFilter]);

  const filteredModalSistemas = useMemo(() => {
    if (!modalSisSearch.trim()) return sistemas;
    const term = modalSisSearch.toLowerCase().trim();
    return sistemas.filter((s: any) => (s.nome || "").toLowerCase().includes(term));
  }, [sistemas, modalSisSearch]);

  const totalCombinations = useMemo(() => {
    const numColabs = selectedColaboradores.length || 1;
    const numSistemas = selectedSistemas.length || 1;
    return numColabs * numSistemas;
  }, [selectedColaboradores.length, selectedSistemas.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Pendências</h1>
          <p className="text-muted-foreground">Kanban — arraste os cards</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={sistemaFiltro} onValueChange={setSistemaFiltro}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filtrar por sistema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os sistemas</SelectItem>
              {sistemas.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <FileDown className="h-4 w-4" /> Modelo CSV
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv.mutate(f);
                e.currentTarget.value = "";
              }}
            />
            <Button asChild variant="outline" className="gap-2">
              <span>
                <Upload className="h-4 w-4" /> Importar CSV
              </span>
            </Button>
          </label>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Exportar</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Exportar Visão Atual ({listFiltrada.length})</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => handleExport("atual_xlsx")}
                className="cursor-pointer gap-2"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Visão Atual (.xlsx)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport("atual_csv")}
                className="cursor-pointer gap-2"
              >
                <FileDown className="h-4 w-4" />
                <span>Visão Atual (.csv)</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Todas as Pendências ({list.length})</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => handleExport("todas_xlsx")}
                className="cursor-pointer gap-2"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Todas as Pendências (.xlsx)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExport("todas_csv")}
                className="cursor-pointer gap-2"
              >
                <FileDown className="h-4 w-4" />
                <span>Todas as Pendências (.csv)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" asChild className="gap-2 border-primary/30 hover:bg-primary/5">
            <Link to="/pendencias-historico">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span>Histórico de Pendências</span>
            </Link>
          </Button>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (o) {
                setSelectedSistemas([]);
                setSelectedColaboradores([]);
                setModalColabSearch("");
                setModalSisSearch("");
                setModalColabOpFilter("todas");
                setFormDateInicio(new Date().toISOString().slice(0, 10));
                setFormQuadro(quadros.length > 0 ? quadros[0].nome : "PENDENTE");
              }
            }}
          >
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova pendência
            </Button>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">Nova Pendência / Solicitação em Lote</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const isAlreadySolicitado = fd.get("solicitado") === "on";
                  const chosenQuadro =
                    formQuadro ||
                    (fd.get("status") as string) ||
                    (quadros.length > 0 ? quadros[0].nome : "PENDENTE");

                  const explicitOpId = (fd.get("operacao_id") as string) || null;
                  const rawDateInicio =
                    (fd.get("data_inicio") as string) ||
                    formDateInicio ||
                    new Date().toISOString().slice(0, 10);
                  const rawSlaEm = (fd.get("sla_em") as string) || null;

                  const basePayload = {
                    titulo: (fd.get("titulo") as string)?.trim() || "Nova Solicitação",
                    descricao: (fd.get("descricao") as string)?.trim() || null,
                    tipo: (fd.get("tipo") as string) || "solicitacao_acesso",
                    prioridade: (fd.get("prioridade") as string) || "media",
                    status: chosenQuadro,
                    operacao_id:
                      explicitOpId && explicitOpId !== "todas" && explicitOpId !== "sem_operacao"
                        ? explicitOpId
                        : null,
                    data_inicio: rawDateInicio,
                    etiquetas: ((fd.get("etiquetas") as string) || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    solicitado: isAlreadySolicitado,
                  };

                  const payloads: any[] = [];
                  const colabsToUse =
                    selectedColaboradores.length > 0 ? selectedColaboradores : [null];
                  const sissToUse = selectedSistemas.length > 0 ? selectedSistemas : [null];

                  for (const colId of colabsToUse) {
                    const colabObj = colabs.find((c: any) => c.id === colId);
                    for (const sisId of sissToUse) {
                      const sisObj = sistemas.find((s: any) => s.id === sisId);
                      let finalSla = rawSlaEm;
                      if (!finalSla && sisObj) {
                        const diasSla = sisObj?.sla_horas ?? 1;
                        const startDate = new Date(rawDateInicio);
                        const slaDate = new Date(startDate.getTime() + diasSla * 24 * 3600 * 1000);
                        finalSla = slaDate.toISOString();
                      }

                      payloads.push({
                        ...basePayload,
                        colaborador_id: colId,
                        sistema_id: sisId,
                        operacao_id: basePayload.operacao_id || colabObj?.operacao_id || null,
                        sla_em: finalSla,
                      });
                    }
                  }

                  create.mutate(payloads);
                }}
                className="space-y-4"
              >
                <div>
                  <Label className="font-semibold">Título da Solicitação</Label>
                  <Input
                    name="titulo"
                    placeholder="Ex: Solicitação de Acesso CRM"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-semibold">Descrição / Observações</Label>
                  <Textarea
                    name="descricao"
                    placeholder="Detalhes da pendência ou instruções..."
                    className="mt-1 min-h-[70px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Quadro de Destino</Label>
                    <Select
                      name="status"
                      value={formQuadro || (quadros.length > 0 ? quadros[0].nome : "PENDENTE")}
                      onValueChange={setFormQuadro}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o quadro..." />
                      </SelectTrigger>
                      <SelectContent>
                        {quadros.map((q: any) => (
                          <SelectItem key={q.id} value={q.nome}>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${getQuadroColor(q.cor)}`}
                              />
                              <span className="font-medium">{q.nome}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Tipo</Label>
                    <Select name="tipo" defaultValue="solicitacao_acesso">
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solicitacao_acesso">Solicitação de acesso</SelectItem>
                        <SelectItem value="exclusao_acesso">Exclusão de acesso</SelectItem>
                        <SelectItem value="revisao">Revisão</SelectItem>
                        <SelectItem value="alteracao">Alteração</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Prioridade</Label>
                    <Select name="prioridade" defaultValue="media">
                      <SelectTrigger className="mt-1">
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
                </div>

                {/* MULTI-SELECT COLABORADORES & SISTEMAS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* COLABORADORES */}
                  <div className="flex flex-col border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="font-semibold text-xs text-foreground">
                          Colaboradores
                        </Label>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                          {selectedColaboradores.length} selecionado(s)
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {filteredModalColabs.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const visibleIds = filteredModalColabs.map((c: any) => c.id);
                              const allVisibleChecked = visibleIds.every((id: string) =>
                                selectedColaboradores.includes(id),
                              );
                              if (allVisibleChecked) {
                                setSelectedColaboradores((prev) =>
                                  prev.filter((id) => !visibleIds.includes(id)),
                                );
                              } else {
                                setSelectedColaboradores((prev) =>
                                  Array.from(new Set([...prev, ...visibleIds])),
                                );
                              }
                            }}
                            className="text-[11px] text-primary hover:underline font-medium"
                          >
                            {filteredModalColabs.every((c: any) =>
                              selectedColaboradores.includes(c.id),
                            )
                              ? "Desmarcar visíveis"
                              : "Marcar visíveis"}
                          </button>
                        )}
                        {selectedColaboradores.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedColaboradores([])}
                            className="text-[11px] text-muted-foreground hover:text-destructive hover:underline ml-1"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-2">
                      <Input
                        placeholder="Buscar por nome ou CPF..."
                        value={modalColabSearch}
                        onChange={(e) => setModalColabSearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Select value={modalColabOpFilter} onValueChange={setModalColabOpFilter}>
                        <SelectTrigger className="h-7 text-[11px]">
                          <SelectValue placeholder="Filtrar por Operação" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todas">
                            Todas as Operações ({colabs.length})
                          </SelectItem>
                          <SelectItem value="sem_operacao">Sem Operação</SelectItem>
                          {operacoes.map((op: any) => (
                            <SelectItem key={op.id} value={op.id}>
                              {op.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-md p-1.5 h-44 overflow-y-auto bg-background space-y-0.5 divide-y divide-border/40">
                      {filteredModalColabs.map((c: any) => {
                        const isChecked = selectedColaboradores.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center justify-between gap-2 text-xs p-1.5 rounded cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-primary/10 font-semibold text-primary"
                                : "hover:bg-accent/50"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedColaboradores((prev) => [...prev, c.id]);
                                  } else {
                                    setSelectedColaboradores((prev) =>
                                      prev.filter((id) => id !== c.id),
                                    );
                                  }
                                }}
                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 shrink-0"
                              />
                              <span className="truncate">{c.nome}</span>
                            </div>
                            {c.operacao?.nome && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {c.operacao.nome}
                              </span>
                            )}
                          </label>
                        );
                      })}
                      {filteredModalColabs.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          Nenhum colaborador encontrado
                        </p>
                      )}
                    </div>
                  </div>

                  {/* SISTEMAS */}
                  <div className="flex flex-col border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="font-semibold text-xs text-foreground">Sistemas</Label>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                          {selectedSistemas.length} selecionado(s)
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {filteredModalSistemas.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const visibleIds = filteredModalSistemas.map((s: any) => s.id);
                              const allVisibleChecked = visibleIds.every((id: string) =>
                                selectedSistemas.includes(id),
                              );
                              if (allVisibleChecked) {
                                setSelectedSistemas((prev) =>
                                  prev.filter((id) => !visibleIds.includes(id)),
                                );
                              } else {
                                setSelectedSistemas((prev) =>
                                  Array.from(new Set([...prev, ...visibleIds])),
                                );
                              }
                            }}
                            className="text-[11px] text-primary hover:underline font-medium"
                          >
                            {filteredModalSistemas.every((s: any) =>
                              selectedSistemas.includes(s.id),
                            )
                              ? "Desmarcar todos"
                              : "Marcar todos"}
                          </button>
                        )}
                        {selectedSistemas.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedSistemas([])}
                            className="text-[11px] text-muted-foreground hover:text-destructive hover:underline ml-1"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-2">
                      <Input
                        placeholder="Buscar sistema / produto..."
                        value={modalSisSearch}
                        onChange={(e) => setModalSisSearch(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <div className="h-7 flex items-center px-1 text-[11px] text-muted-foreground">
                        {sistemas.length} sistemas cadastrados no total
                      </div>
                    </div>

                    <div className="border rounded-md p-1.5 h-44 overflow-y-auto bg-background space-y-0.5 divide-y divide-border/40">
                      {filteredModalSistemas.map((s: any) => {
                        const isChecked = selectedSistemas.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center justify-between gap-2 text-xs p-1.5 rounded cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-primary/10 font-semibold text-primary"
                                : "hover:bg-accent/50"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSistemas((prev) => [...prev, s.id]);
                                  } else {
                                    setSelectedSistemas((prev) => prev.filter((id) => id !== s.id));
                                  }
                                }}
                                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4 shrink-0"
                              />
                              <span className="truncate">{s.nome}</span>
                            </div>
                            {s.sla_horas && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                SLA: {s.sla_horas}d
                              </span>
                            )}
                          </label>
                        );
                      })}
                      {filteredModalSistemas.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          Nenhum sistema encontrado
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* COMBINATION SUMMARY BANNER */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Resumo do lote:</span>
                  <span className="font-semibold text-foreground">
                    {selectedColaboradores.length > 0 && selectedSistemas.length > 0 ? (
                      <>
                        ⚡ Serão geradas{" "}
                        <strong className="text-primary font-bold">
                          {selectedColaboradores.length * selectedSistemas.length}
                        </strong>{" "}
                        pendência(s) ({selectedColaboradores.length} colaborador(es) ×{" "}
                        {selectedSistemas.length} sistema(s))
                      </>
                    ) : selectedColaboradores.length > 0 ? (
                      <>
                        ⚡ Serão geradas{" "}
                        <strong className="text-primary font-bold">
                          {selectedColaboradores.length}
                        </strong>{" "}
                        pendência(s) para {selectedColaboradores.length} colaborador(es)
                      </>
                    ) : selectedSistemas.length > 0 ? (
                      <>
                        ⚡ Serão geradas{" "}
                        <strong className="text-primary font-bold">
                          {selectedSistemas.length}
                        </strong>{" "}
                        pendência(s) para {selectedSistemas.length} sistema(s)
                      </>
                    ) : (
                      <>1 pendência avulsa será gerada</>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Data de início</Label>
                    <Input
                      name="data_inicio"
                      type="date"
                      value={formDateInicio}
                      onChange={(e) => setFormDateInicio(e.target.value)}
                      className="mt-1"
                    />
                    {formDateInicio > todayStr && (
                      <div className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 p-2 rounded mt-1.5 text-[10px] leading-tight flex items-start gap-1">
                        <span>📅</span>
                        <span>Solicitação agendada para o futuro.</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">SLA (data limite - opcional)</Label>
                    <Input name="sla_em" type="datetime-local" className="mt-1" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">
                      Operação (Opcional - padrão é a do colaborador)
                    </Label>
                    <Select
                      name="operacao_id"
                      defaultValue={
                        selectedOperacaoId !== "todas" && selectedOperacaoId !== "sem_operacao"
                          ? selectedOperacaoId
                          : undefined
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Automática (Operação do Colaborador)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automática (Operação do Colaborador)</SelectItem>
                        {operacoes.map((o: any) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">
                      Etiquetas (separadas por vírgula)
                    </Label>
                    <Input name="etiquetas" placeholder="urgente, tributário" className="mt-1" />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-accent/40 rounded-lg">
                  <input
                    type="checkbox"
                    name="solicitado"
                    id="solicitado"
                    defaultChecked
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <Label htmlFor="solicitado" className="cursor-pointer text-xs font-semibold">
                    Iniciar já solicitado (Ir direto para o Quadro Kanban de Pendências)
                  </Label>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={create.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending
                      ? "Criando pendências..."
                      : `Criar ${
                          selectedColaboradores.length > 0 && selectedSistemas.length > 0
                            ? `(${selectedColaboradores.length * selectedSistemas.length})`
                            : selectedColaboradores.length > 0
                              ? `(${selectedColaboradores.length})`
                              : selectedSistemas.length > 0
                                ? `(${selectedSistemas.length})`
                                : ""
                        }`}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={openQuadros} onOpenChange={setOpenQuadros}>
            <Button onClick={() => setOpenQuadros(true)} variant="outline" className="gap-2">
              <Settings className="h-4 w-4" /> Quadros
            </Button>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Gerenciar Quadros</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Quadros ativos no Kanban. Crie ou remova quadros conforme a necessidade do seu
                  fluxo de trabalho.
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {quadros.map((q: any) => {
                    const quadrosNomes = quadros.map((x: any) => x.nome);
                    const countInQuadro = list.filter(
                      (p: any) =>
                        p.solicitado !== false &&
                        matchesColumnStatus(p.status, q.nome, quadrosNomes),
                    ).length;

                    return (
                      <div
                        key={q.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-md border bg-card/60"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-3 w-3 rounded-full shrink-0 ${getQuadroColor(q.cor)}`}
                          />
                          <span className="font-semibold text-sm">{q.nome}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({countInQuadro} card{countInQuadro === 1 ? "" : "s"})
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Remover quadro"
                          onClick={() => {
                            if (
                              confirm(
                                `Deseja realmente remover o quadro "${q.nome}"? As pendências existentes serão mantidas e redistribuídas.`,
                              )
                            ) {
                              delQuadro.mutate(q.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {quadros.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum quadro cadastrado.
                    </p>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const nome = (fd.get("nome") as string)?.trim();
                    if (!nome) return;
                    addQuadro.mutate({
                      nome,
                      cor: novoQuadroCor || "bg-slate-500",
                      ordem: quadros.length + 1,
                    });
                    e.currentTarget.reset();
                    setNovoQuadroCor("bg-slate-500");
                  }}
                  className="space-y-3 pt-4 border-t"
                >
                  <div>
                    <Label className="text-xs font-semibold">Nome do Novo Quadro</Label>
                    <Input name="nome" placeholder="Ex: EM TESTE, EM HOMOLOGAÇÃO..." required />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Cor do Quadro</Label>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {QUADRO_COLOR_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setNovoQuadroCor(opt.value)}
                          className={`h-6 w-6 rounded-full ${opt.value} transition-transform ${
                            novoQuadroCor === opt.value
                              ? "ring-2 ring-foreground ring-offset-2 scale-110"
                              : "opacity-75 hover:opacity-100"
                          }`}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={addQuadro.isPending}>
                    {addQuadro.isPending ? "Adicionando..." : "Adicionar Quadro"}
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <OperationFilterBar
        selectedOperacaoId={selectedOperacaoId}
        onChange={setSelectedOperacaoId}
        counts={pendenciasCounts}
      />

      {sistemaFiltro !== "todos" && (
        <div className="text-sm text-muted-foreground">
          Filtrado: {sistemas.find((s: any) => s.id === sistemaFiltro)?.nome} —{" "}
          {listFiltrada.length} pendência(s)
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-2 gap-4 overflow-x-auto md:grid-cols-3 lg:grid-cols-6">
          {quadros.map((col: any) => {
            const quadrosNomes = quadros.map((q: any) => q.nome);
            const items = listFiltrada.filter((p: any) =>
              matchesColumnStatus(p.status, col.nome, quadrosNomes),
            );
            return (
              <Column
                key={col.id}
                id={col.nome}
                title={col.nome}
                color={getQuadroColor(col.cor)}
                items={items}
                onOpen={setDetailId}
                onDelete={(id: string) => {
                  if (confirm("Deseja realmente excluir esta pendência?")) {
                    deletePendencia.mutate(id);
                  }
                }}
              />
            );
          })}
        </div>
        <DragOverlay>{activeItem && <CardView p={activeItem} />}</DragOverlay>
      </DndContext>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <PendenciaDetail p={detail} quadros={quadros} onClose={() => setDetailId(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Column({ id, title, color, items, onOpen, onDelete }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[400px] flex-col rounded-lg border bg-card ${isOver ? "ring-2 ring-accent" : ""}`}
    >
      <div
        className={`flex items-center justify-between rounded-t-lg px-3 py-2 text-xs font-semibold text-white ${color}`}
      >
        <span>{title}</span>
        <span className="rounded-full bg-white/20 px-2">{items.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {items.map((p: any) => (
          <DraggableCard key={p.id} p={p} onOpen={onOpen} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ p, onOpen, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: p.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
    >
      <CardView p={p} onOpen={onOpen} onDelete={onDelete} />
    </div>
  );
}

function CardView({ p, onOpen, onDelete }: any) {
  const inicio = p.data_inicio ? new Date(p.data_inicio) : new Date(p.criado_em);
  const fim =
    p.data_resolucao || p.concluido_em ? new Date(p.data_resolucao || p.concluido_em) : new Date();
  const dias = Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 86400000));

  let slaTarget: Date | null = null;
  if (p.sla_em) {
    slaTarget = new Date(p.sla_em);
  } else if (p.sistema?.sla_horas) {
    slaTarget = new Date(inicio.getTime() + p.sistema.sla_horas * 24 * 3600 * 1000);
  } else {
    slaTarget = new Date(inicio.getTime() + 24 * 3600 * 1000);
  }

  const concluidoAliases = [
    "desbloqueio",
    "concluido",
    "concluida",
    "finalizado",
    "finalizada",
    "resolvido",
    "resolvida",
  ];
  const normStatus = (p.status || "").toLowerCase();
  const isConcluidoStatus = concluidoAliases.some((a) => normStatus.includes(a));
  const isConcluido = isConcluidoStatus || p.arquivado;
  const isAtrasado = !isConcluido && slaTarget ? new Date() > slaTarget : false;

  return (
    <div
      className="group cursor-grab rounded-md border bg-background p-3 shadow-sm hover:shadow-md transition-shadow relative"
      onClick={() => onOpen && onOpen(p.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PRIO_COLOR[p.prioridade]}`} />
          <p className="flex-1 text-sm font-medium leading-tight">{p.titulo}</p>
        </div>
        {onDelete && (
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
            title="Excluir pendência"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete(p.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {p.colaborador?.nome && (
        <p className="mt-1 text-xs text-muted-foreground truncate">👤 {p.colaborador.nome}</p>
      )}
      {p.sistema?.nome && (
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          🖥 {p.sistema.nome}
          {p.sistema.sla_horas && (
            <span className="text-[10px] text-muted-foreground">({p.sistema.sla_horas}d SLA)</span>
          )}
        </p>
      )}

      {p.etiquetas?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {p.etiquetas.map((t: string) => (
            <Badge key={t} variant="outline" className="text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
        <span className="text-muted-foreground">Início: {inicio.toLocaleDateString("pt-BR")}</span>
        <Badge
          className={
            isConcluido
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              : isAtrasado
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
          }
        >
          {isConcluido
            ? `${dias}d (concluído)`
            : isAtrasado
              ? `SLA Atrasado (${dias}d)`
              : `Em dia (${dias}d)`}
        </Badge>
      </div>
      {slaTarget && (
        <p
          className={`mt-1 text-[10px] ${isAtrasado ? "text-destructive font-semibold" : "text-muted-foreground"}`}
        >
          Limite SLA:{" "}
          {slaTarget.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </p>
      )}
    </div>
  );
}

function toYMD(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    // Ignore date parse errors
  }
  return String(val ?? "").slice(0, 10);
}

function PendenciaDetail({ p, quadros, onClose }: any) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data: coments = [] } = useQuery({
    queryKey: ["coments", p.id],
    queryFn: async () => {
      try {
        const { data, error } = await db
          .from("pendencia_comentarios")
          .select("*, autor:profiles(nome)")
          .eq("pendencia_id", p.id)
          .order("criado_em");
        if (error) {
          const { data: raw } = await db
            .from("pendencia_comentarios")
            .select("*")
            .eq("pendencia_id", p.id)
            .order("criado_em");
          return raw ?? [];
        }
        return data ?? [];
      } catch {
        return [];
      }
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) throw new Error("Usuário não autenticado");
      await db
        .from("pendencia_comentarios")
        .insert({ pendencia_id: p.id, autor_id: u.user.id, conteudo: text });
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["coments", p.id] });
    },
  });

  const updateStatus = async (novoStatus: string) => {
    const concluidoAliases = [
      "desbloqueio",
      "concluido",
      "concluida",
      "finalizado",
      "finalizada",
      "resolvido",
      "resolvida",
    ];
    const isConcluidoStatus = concluidoAliases.some((a) => novoStatus.toLowerCase().includes(a));
    const patch: any = { status: novoStatus };
    if (isConcluidoStatus) {
      patch.concluido_em = new Date().toISOString();
    } else {
      patch.concluido_em = null;
      patch.data_resolucao = null;
    }
    await db.from("pendencias").update(patch).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["pendencias"] });
    toast.success("Status atualizado");
  };

  const deleteItem = async () => {
    if (!confirm("Remover pendência?")) return;
    await db.from("pendencias").delete().eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["pendencias"] });
    toast.success("Removido");
    if (onClose) onClose();
  };

  const archiveItem = async () => {
    if (!confirm("Finalizar e arquivar pendência?")) return;
    await db
      .from("pendencias")
      .update({ arquivado: true, concluido_em: new Date().toISOString() })
      .eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["pendencias"] });
    toast.success("Pendência finalizada e enviada para o histórico.");
    if (onClose) onClose();
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between pr-6">
          <DialogTitle>{p.titulo}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={archiveItem}>
              Finalizar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive h-8 w-8"
              onClick={deleteItem}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogHeader>
      <div className="space-y-3">
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Quadro de Destino / Status</span>
            </Label>
            <span className="text-[11px] text-muted-foreground">
              Mude o quadro a qualquer momento
            </span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {(() => {
              const quadrosNomes = quadros?.map((x: any) => x.nome) ?? [];
              const selectedStatus =
                quadros?.find((q: any) => matchesColumnStatus(p.status, q.nome, quadrosNomes))
                  ?.nome ?? p.status;
              return (
                <Select value={selectedStatus} onValueChange={updateStatus}>
                  <SelectTrigger className="h-8 text-xs font-medium w-full sm:w-[220px]">
                    <SelectValue placeholder="Selecione o quadro" />
                  </SelectTrigger>
                  <SelectContent>
                    {quadros?.map((q: any) => (
                      <SelectItem key={q.id} value={q.nome}>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${getQuadroColor(q.cor)}`}
                          />
                          <span className="font-medium">{q.nome}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })()}
            <Badge variant="outline" className="text-xs py-1">
              Prioridade: <span className="font-semibold ml-1 capitalize">{p.prioridade}</span>
            </Badge>
            <Badge variant="outline" className="text-xs py-1">
              Tipo: <span className="font-semibold ml-1 capitalize">{p.tipo}</span>
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{p.descricao || "Sem descrição"}</p>
        <div className="grid grid-cols-2 gap-3 rounded-md border p-3 bg-muted/30">
          <div>
            <Label className="text-xs">Data de início</Label>
            <Input
              type="date"
              defaultValue={toYMD(p.data_inicio ?? p.criado_em)}
              onBlur={async (e) => {
                await db
                  .from("pendencias")
                  .update({ data_inicio: e.target.value } as any)
                  .eq("id", p.id);
                qc.invalidateQueries({ queryKey: ["pendencias"] });
                toast.success("Data de início atualizada");
              }}
            />
          </div>
          <div>
            <Label className="text-xs">Data de resolução</Label>
            <Input
              type="date"
              defaultValue={toYMD(p.data_resolucao)}
              onBlur={async (e) => {
                await db
                  .from("pendencias")
                  .update({ data_resolucao: e.target.value || null } as any)
                  .eq("id", p.id);
                qc.invalidateQueries({ queryKey: ["pendencias"] });
                toast.success("Data de resolução atualizada");
              }}
            />
          </div>
          <div className="col-span-2 text-xs text-muted-foreground">
            {(() => {
              const inicio = new Date(p.data_inicio ?? p.criado_em);
              const fim = p.data_resolucao ? new Date(p.data_resolucao) : new Date();
              const dias = Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 86400000));
              const alerta = !p.data_resolucao && dias > 5;
              return (
                <span className={alerta ? "font-semibold text-destructive" : ""}>
                  Tempo em aberto: {dias} dia{dias === 1 ? "" : "s"}
                  {alerta ? " — acima do prazo!" : ""}
                </span>
              );
            })()}
          </div>
        </div>

        {p.checklist?.length > 0 && (
          <div>
            <p className="text-sm font-medium">Checklist</p>
            <ul className="mt-1 space-y-1 text-sm">
              {p.checklist.map((c: any, i: number) => (
                <li key={i}>
                  {c.done ? "☑" : "☐"} {c.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="border-t pt-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="h-4 w-4" /> Comentários
          </p>
          <div className="space-y-2 max-h-52 overflow-auto">
            {coments.map((c: any) => (
              <div key={c.id} className="rounded bg-muted p-2 text-sm">
                <p className="text-xs font-medium">{c.autor?.nome}</p>
                <p>{c.conteudo}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escreva..."
            />
            <Button disabled={!text} onClick={() => add.mutate()}>
              Enviar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
