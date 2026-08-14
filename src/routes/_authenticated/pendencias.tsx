import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, MessageSquare, Upload, FileDown, Settings, Trash2 } from "lucide-react";
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
  const [formDateInicio, setFormDateInicio] = useState(new Date().toISOString().slice(0, 10));
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
          .select("id,nome,status")
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
      const payloads = items.map((item) => ({
        ...item,
        criado_por: u.user?.id || null,
      }));
      const { data: inserted, error } = await db.from("pendencias").insert(payloads).select("*");
      if (error) throw error;

      if (inserted) {
        for (const item of inserted) {
          if (item.solicitado && item.colaborador_id && item.sistema_id) {
            const { data: exAcesso } = await db
              .from("acessos")
              .select("id, login, senha")
              .eq("colaborador_id", item.colaborador_id)
              .eq("sistema_id", item.sistema_id)
              .maybeSingle();

            if (exAcesso) {
              await db
                .from("acessos")
                .update({
                  login: exAcesso.login && exAcesso.login !== "-" ? exAcesso.login : "Solicitado",
                  senha: exAcesso.senha && exAcesso.senha !== "-" ? exAcesso.senha : "Solicitado",
                  status: "pendente",
                })
                .eq("id", exAcesso.id);
            } else {
              await db.from("acessos").insert({
                colaborador_id: item.colaborador_id,
                sistema_id: item.sistema_id,
                login: "Solicitado",
                senha: "Solicitado",
                status: "pendente",
              });
            }
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Pendências criadas com sucesso");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["pendencias"] });
      qc.invalidateQueries({ queryKey: ["acessos"] });
      qc.invalidateQueries({ queryKey: ["matriz-acessos-full"] });
    },
    onError: (e: any) => toast.error(e.message),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pendencia_quadros"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const delQuadro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("pendencia_quadros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pendencia_quadros"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const pendenciasCounts = useMemo(() => {
    const activeList = list.filter((p: any) => {
      if (p.solicitado !== true) return false;
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
      if (p.solicitado !== true) return false;
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
      (colabs as any[]).forEach((c) => {
        if (c.nome) colabMap.set(c.nome.toLowerCase().trim(), c.id);
        if (c.cpf) colabMap.set(c.cpf.replace(/\D/g, ""), c.id);
        if (c.email) colabMap.set(c.email.toLowerCase().trim(), c.id);
      });

      const sisMap = new Map((sistemas as any[]).map((s) => [s.nome.toLowerCase().trim(), s.id]));
      const quadrosNomes = (quadros as any[]).map((q) => q.nome);
      const { data: u } = await db.auth.getUser();

      const rawRows = parsed.data.map((r: any) => {
        const newR: any = {};
        for (const [k, v] of Object.entries(r)) {
          newR[k] = String(v ?? "").substring(0, 200);
        }
        return newR;
      });

      // Auto-create missing systems if needed
      for (const r of rawRows) {
        const sisVal = (r.sistema || r.nome_sistema || r.produto || "").trim();
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
          const colabVal = (r.colaborador || r.cpf_colaborador || r.cpf || "").trim();
          const colabDigits = colabVal.replace(/\D/g, "");
          const colId =
            (colabDigits ? colabMap.get(colabDigits) : null) ??
            colabMap.get(colabVal.toLowerCase()) ??
            null;

          const sisVal = (r.sistema || r.nome_sistema || r.produto || "").trim();
          const sisId = sisVal ? (sisMap.get(sisVal.toLowerCase()) ?? null) : null;

          const rawStatus = (r.status ?? "").trim();
          let statusVal = rawStatus || "backlog";
          if (quadrosNomes.length > 0) {
            const matchedQ = quadrosNomes.find((qName) =>
              matchesColumnStatus(rawStatus, qName, quadrosNomes),
            );
            if (matchedQ) statusVal = matchedQ;
          }

          const dataInicioVal = (r.data_inicio || r.data_início || r.inicio || "").trim();
          const slaVal = (r.sla_em || r.sla || r.vencimento || r.data_limite || "").trim();

          return {
            titulo: r.titulo || r.título || "",
            descricao: r.descricao || r.descrição || null,
            tipo: r.tipo || "solicitacao_acesso",
            prioridade: r.prioridade || "media",
            status: statusVal,
            colaborador_id: colId,
            sistema_id: sisId,
            data_inicio: parseDateToISO(dataInicioVal) || new Date().toISOString().split("T")[0],
            sla_em: parseDateToISO(slaVal),
            etiquetas: r.etiquetas
              ? String(r.etiquetas)
                  .split(/[,;]/)
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : [],
            criado_por: u.user?.id,
          };
        })
        .filter((r: any) => r.titulo);

      if (rows.length === 0) throw new Error("CSV vazio ou sem coluna 'titulo'");
      const { error } = await db.from("pendencias").insert(rows);
      if (error) throw error;
      return rows.length;
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
          {isAdmin && (
            <Button variant="outline" asChild className="gap-2">
              <Link to="/pendencias-historico">
                <MessageSquare className="h-4 w-4" /> Histórico
              </Link>
            </Button>
          )}
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) {
                setSelectedSistemas([]);
              } else {
                setFormDateInicio(new Date().toISOString().slice(0, 10));
              }
            }}
          >
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova pendência
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova pendência</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const isAlreadySolicitado = fd.get("solicitado") === "on";
                  const basePayload = {
                    titulo: fd.get("titulo"),
                    descricao: fd.get("descricao"),
                    tipo: fd.get("tipo") || "outro",
                    prioridade: fd.get("prioridade") || "media",
                    colaborador_id: (fd.get("colaborador_id") as string) || null,
                    operacao_id:
                      (fd.get("operacao_id") as string) ||
                      (selectedOperacaoId !== "todas" && selectedOperacaoId !== "sem_operacao"
                        ? selectedOperacaoId
                        : null),
                    data_inicio: (fd.get("data_inicio") as string) || undefined,
                    etiquetas: ((fd.get("etiquetas") as string) || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    solicitado: isAlreadySolicitado,
                  };

                  if (selectedSistemas.length > 0) {
                    const payloads = selectedSistemas.map((sisId) => {
                      const sisObj = sistemas.find((s: any) => s.id === sisId);
                      const diasSla = sisObj?.sla_horas ?? 1;
                      const startVal =
                        (fd.get("data_inicio") as string) || new Date().toISOString();
                      const startDate = new Date(startVal);
                      const slaDate = new Date(startDate.getTime() + diasSla * 24 * 3600 * 1000);
                      const finalSla = (fd.get("sla_em") as string) || slaDate.toISOString();

                      return {
                        ...basePayload,
                        sistema_id: sisId,
                        sla_em: finalSla,
                      };
                    });
                    create.mutate(payloads);
                  } else {
                    const startVal = (fd.get("data_inicio") as string) || new Date().toISOString();
                    const startDate = new Date(startVal);
                    const slaDate = new Date(startDate.getTime() + 1 * 24 * 3600 * 1000);
                    const finalSla = (fd.get("sla_em") as string) || slaDate.toISOString();

                    create.mutate({
                      ...basePayload,
                      sistema_id: null,
                      sla_em: finalSla,
                    });
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <Label>Título</Label>
                  <Input name="titulo" required />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea name="descricao" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo</Label>
                    <Select name="tipo" defaultValue="outro">
                      <SelectTrigger>
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
                    <Label>Prioridade</Label>
                    <Select name="prioridade" defaultValue="media">
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Colaborador</Label>
                    <Select name="colaborador_id">
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {colabs.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sistemas (Marcação múltipla)</Label>
                    <div className="border border-input rounded-md p-2 max-h-32 overflow-y-auto bg-background space-y-1 mt-1">
                      {sistemas.map((s: any) => {
                        const isChecked = selectedSistemas.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 text-sm font-normal cursor-pointer hover:bg-accent/50 p-1 rounded-sm transition-colors"
                          >
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
                              className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                            />
                            <span className="truncate">{s.nome}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data de início</Label>
                    <Input
                      name="data_inicio"
                      type="date"
                      value={formDateInicio}
                      onChange={(e) => setFormDateInicio(e.target.value)}
                    />
                    {formDateInicio > todayStr && (
                      <div className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 p-2 rounded mt-1.5 text-[10px] leading-tight flex items-start gap-1">
                        <span>📅</span>
                        <span>Solicitação agendada para o futuro.</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>SLA (data limite)</Label>
                    <Input name="sla_em" type="datetime-local" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                    <Label>Etiquetas (separadas por vírgula)</Label>
                    <Input name="etiquetas" placeholder="urgente, tributário" />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-accent/40 rounded-lg">
                  <input
                    type="checkbox"
                    name="solicitado"
                    id="solicitado"
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  <Label htmlFor="solicitado" className="cursor-pointer text-xs font-semibold">
                    Iniciar já solicitado (Ir direto para o Quadro Kanban de Pendências)
                  </Label>
                </div>

                <DialogFooter>
                  <Button type="submit">Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={openQuadros} onOpenChange={setOpenQuadros}>
            <Button onClick={() => setOpenQuadros(true)} variant="outline" className="gap-2">
              <Settings className="h-4 w-4" /> Quadros
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerenciar Quadros</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {quadros.map((q: any) => (
                  <div key={q.id} className="flex items-center justify-between gap-3">
                    <Badge className={getQuadroColor(q.cor)}>{q.nome}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => delQuadro.mutate(q.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    addQuadro.mutate({
                      nome: fd.get("nome"),
                      cor: fd.get("cor") || "bg-slate-500",
                      ordem: quadros.length + 1,
                    });
                    e.currentTarget.reset();
                  }}
                  className="flex gap-2 items-end pt-4 border-t"
                >
                  <div className="flex-1">
                    <Label className="text-xs">Novo quadro (Nome)</Label>
                    <Input name="nome" placeholder="Ex: EM TESTE" required />
                  </div>
                  <div className="w-32">
                    <Label className="text-xs">Cor (Tailwind bg)</Label>
                    <Input name="cor" defaultValue="bg-slate-500" />
                  </div>
                  <Button type="submit">Add</Button>
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
        <div className="flex gap-2">
          {(() => {
            const quadrosNomes = quadros?.map((x: any) => x.nome) ?? [];
            const selectedStatus =
              quadros?.find((q: any) => matchesColumnStatus(p.status, q.nome, quadrosNomes))
                ?.nome ?? p.status;
            return (
              <Select value={selectedStatus} onValueChange={updateStatus}>
                <SelectTrigger className="h-7 text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quadros?.map((q: any) => (
                    <SelectItem key={q.id} value={q.nome}>
                      {q.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          })()}
          <Badge variant="outline">{p.prioridade}</Badge>
          <Badge variant="outline">{p.tipo}</Badge>
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
