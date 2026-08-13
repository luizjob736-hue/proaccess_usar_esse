import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CheckCircle,
  AlertTriangle,
  Calendar,
  Clock,
  Trash2,
  Search,
  Edit,
  ArrowRight,
} from "lucide-react";

function toYMDString(val: any): string {
  if (!val) return "";
  if (typeof val === "string") {
    return val.split("T")[0];
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split("T")[0];
  }
  try {
    const str = String(val);
    if (str.includes("T")) return str.split("T")[0];
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch {
    // ignore
  }
  return "";
}

export const Route = createFileRoute("/_authenticated/usuarios-a-solicitar")({
  component: UsuariosASolicitar,
});

function UsuariosASolicitar() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOperacaoId, setSelectedOperacaoId] = useState("todas");
  const [selectedSistemaId, setSelectedSistemaId] = useState("todos");
  const [dateFilter, setDateFilter] = useState<"todos" | "atrasados" | "hoje" | "futuros">("todos");
  const [detailId, setDetailId] = useState<string | null>(null);

  // States for new/editing
  const [editingItem, setEditingItem] = useState<any>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Fetch list
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["pendencias"],
    queryFn: async () =>
      (
        await db
          .from("pendencias")
          .select(
            "*, colaborador:colaboradores(id, nome, operacao_id), sistema:sistemas(id, nome, sla_horas)",
          )
          .eq("arquivado", false)
          .order("data_inicio", { ascending: true })
      ).data ?? [],
  });

  const { data: colabs = [] } = useQuery({
    queryKey: ["colabs-simple"],
    queryFn: async () =>
      (await db.from("colaboradores").select("id,nome").order("nome")).data ?? [],
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

  // Filter unsought entries (solicitado === false)
  const listASolicitar = useMemo(() => {
    return list.filter((p: any) => p.solicitado === false);
  }, [list]);

  // Apply search/operation/product filters
  const filteredList = useMemo(() => {
    return listASolicitar.filter((p: any) => {
      // Search
      const text =
        `${p.titulo || ""} ${p.descricao || ""} ${p.colaborador?.nome || ""} ${p.sistema?.nome || ""}`.toLowerCase();
      if (searchTerm && !text.includes(searchTerm.toLowerCase())) return false;

      // Operacao
      const opId = p.operacao_id || p.colaborador?.operacao_id;
      if (selectedOperacaoId !== "todas") {
        if (selectedOperacaoId === "sem_operacao" && opId) return false;
        if (selectedOperacaoId !== "sem_operacao" && opId !== selectedOperacaoId) return false;
      }

      // Sistema
      if (selectedSistemaId !== "todos") {
        if (p.sistema_id !== selectedSistemaId) return false;
      }

      // Date status
      if (!p.data_inicio) return dateFilter === "todos";
      const startStr = toYMDString(p.data_inicio);

      if (dateFilter === "atrasados" && startStr >= todayStr) return false;
      if (dateFilter === "hoje" && startStr !== todayStr) return false;
      if (dateFilter === "futuros" && startStr <= todayStr) return false;

      return true;
    });
  }, [listASolicitar, searchTerm, selectedOperacaoId, selectedSistemaId, dateFilter, todayStr]);

  // Date category counts
  const counts = useMemo(() => {
    let atrasados = 0;
    let hoje = 0;
    let futuros = 0;

    for (const p of listASolicitar) {
      if (!p.data_inicio) continue;
      const startStr = toYMDString(p.data_inicio);
      if (startStr < todayStr) atrasados++;
      else if (startStr === todayStr) hoje++;
      else futuros++;
    }

    return { total: listASolicitar.length, atrasados, hoje, futuros };
  }, [listASolicitar, todayStr]);

  // Mutations
  const solicitMutation = useMutation({
    mutationFn: async (id: string) => {
      const nowStr = new Date().toISOString().split("T")[0];
      const { error } = await db
        .from("pendencias")
        .update({ solicitado: true, data_inicio: nowStr, status: "backlog" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso marcado como Solicitado! Transferido para o Quadro de Pendências.");
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("pendencias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação excluída com sucesso.");
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { error } = await db.from("pendencias").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada com sucesso.");
      setEditingItem(null);
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const detail = useMemo(() => {
    return listASolicitar.find((p) => p.id === detailId);
  }, [listASolicitar, detailId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>👤</span> Usuários a solicitar
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o planejamento de novos acessos e marque-os como solicitado para integrá-los ao
            Kanban.
          </p>
        </div>
      </div>

      {/* Grouping Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setDateFilter("todos")}
          className={`p-4 rounded-xl border text-left transition-all ${
            dateFilter === "todos"
              ? "bg-primary/5 border-primary shadow-sm ring-1 ring-primary"
              : "bg-card hover:bg-muted/50"
          }`}
        >
          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Todos Agendados
          </div>
          <div className="text-2xl font-bold mt-1 text-foreground">{counts.total}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Total de solicitações programadas
          </div>
        </button>
        <button
          onClick={() => setDateFilter("atrasados")}
          className={`p-4 rounded-xl border text-left transition-all ${
            dateFilter === "atrasados"
              ? "bg-red-500/5 border-red-500 shadow-sm ring-1 ring-red-500"
              : "bg-card hover:bg-muted/50"
          }`}
        >
          <div className="text-xs text-red-600 dark:text-red-400 font-semibold uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Pendentes / Atrasados
          </div>
          <div className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            {counts.atrasados}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Datas programadas que já passaram
          </div>
        </button>
        <button
          onClick={() => setDateFilter("hoje")}
          className={`p-4 rounded-xl border text-left transition-all ${
            dateFilter === "hoje"
              ? "bg-emerald-500/5 border-emerald-500 shadow-sm ring-1 ring-emerald-500"
              : "bg-card hover:bg-muted/50"
          }`}
        >
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 animate-pulse" /> Solicitar Hoje
          </div>
          <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {counts.hoje}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Agendamentos para o dia atual</div>
        </button>
        <button
          onClick={() => setDateFilter("futuros")}
          className={`p-4 rounded-xl border text-left transition-all ${
            dateFilter === "futuros"
              ? "bg-blue-500/5 border-blue-500 shadow-sm ring-1 ring-blue-500"
              : "bg-card hover:bg-muted/50"
          }`}
        >
          <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Agendados Futuros
          </div>
          <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
            {counts.futuros}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Planejados para os próximos dias</div>
        </button>
      </div>

      {/* Filter and Table View */}
      <Card className="rounded-xl border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <span>📋</span>
            <span>
              {dateFilter === "todos"
                ? "Lista Geral a Solicitar"
                : dateFilter === "atrasados"
                  ? "Solicitações em Atraso"
                  : dateFilter === "hoje"
                    ? "Solicitações para Hoje"
                    : "Solicitações Futuras"}
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              ({filteredList.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar solicitação por título, colaborador, descrição ou produto..."
                className="pl-9 h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={selectedOperacaoId} onValueChange={setSelectedOperacaoId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Filtrar Operação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas Operações</SelectItem>
                  <SelectItem value="sem_operacao">Sem Operação</SelectItem>
                  {operacoes.map((op: any) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Select value={selectedSistemaId} onValueChange={setSelectedSistemaId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Filtrar Sistema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Sistemas</SelectItem>
                  {sistemas.map((sis: any) => (
                    <SelectItem key={sis.id} value={sis.id}>
                      {sis.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando agendamentos...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <div className="text-3xl">📭</div>
              <p className="font-semibold text-sm">Nenhum agendamento a solicitar encontrado.</p>
              <p className="text-xs">
                Utilize o botão "Nova pendência" na página de Pendências para agendar novos acessos.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden divide-y divide-border">
              {filteredList.map((p: any) => {
                const dateStr = toYMDString(p.data_inicio);
                const isHoje = dateStr === todayStr;
                const isAtrasado = dateStr && dateStr < todayStr;

                let dateBadge = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
                if (isHoje) {
                  dateBadge =
                    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 animate-pulse";
                } else if (isAtrasado) {
                  dateBadge =
                    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 font-bold";
                }

                return (
                  <div
                    key={p.id}
                    onClick={() => setDetailId(p.id)}
                    className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${dateBadge} border-0 text-xs py-0.5 px-2`}>
                          📅{" "}
                          {dateStr && !isNaN(new Date(dateStr + "T12:00:00").getTime())
                            ? new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR")
                            : "Não definida"}
                        </Badge>
                        <h3 className="font-bold text-foreground text-sm truncate">{p.titulo}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {p.colaborador?.nome && (
                          <span className="flex items-center gap-0.5">👤 {p.colaborador.nome}</span>
                        )}
                        {p.sistema?.nome && (
                          <span className="flex items-center gap-0.5 font-medium text-foreground">
                            🖥️ {p.sistema.nome}
                          </span>
                        )}
                        {p.prioridade && (
                          <span className="capitalize px-1.5 py-0.5 rounded bg-muted">
                            Prio: {p.prioridade}
                          </span>
                        )}
                      </div>
                      {p.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-1 italic max-w-2xl">
                          {p.descricao}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 h-9 px-3 rounded-lg shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          solicitMutation.mutate(p.id);
                        }}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Solicitado
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 w-9 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem({ ...p });
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 h-9 w-9 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Deseja realmente excluir esta solicitação?")) {
                            deleteMutation.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <span>📅 Detalhes da Solicitação</span>
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm border-b pb-4">
                <div>
                  <div className="text-xs text-muted-foreground">Colaborador</div>
                  <div className="font-semibold">{detail.colaborador?.nome || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Sistema / Produto</div>
                  <div className="font-semibold">{detail.sistema?.nome || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Data da Solicitação</div>
                  <div className="font-semibold">
                    {(() => {
                      const dStr = toYMDString(detail.data_inicio);
                      return dStr && !isNaN(new Date(dStr + "T12:00:00").getTime())
                        ? new Date(dStr + "T12:00:00").toLocaleDateString("pt-BR")
                        : "—";
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Prioridade</div>
                  <div className="font-semibold capitalize">{detail.prioridade || "—"}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">Título</div>
                <div className="text-sm font-semibold">{detail.titulo}</div>
              </div>

              {detail.descricao && (
                <div>
                  <div className="text-xs text-muted-foreground">Descrição</div>
                  <div className="text-sm p-3 bg-muted/40 rounded-lg whitespace-pre-wrap">
                    {detail.descricao}
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                  onClick={() => {
                    solicitMutation.mutate(detail.id);
                    setDetailId(null);
                  }}
                >
                  <CheckCircle className="h-4 w-4" /> Marcar como Solicitado
                </Button>
                <Button variant="outline" onClick={() => setEditingItem({ ...detail })}>
                  Editar
                </Button>
                <Button variant="ghost" onClick={() => setDetailId(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(o) => !o && setEditingItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar Solicitação</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload = {
                  titulo: fd.get("titulo"),
                  descricao: fd.get("descricao"),
                  data_inicio: fd.get("data_inicio"),
                  prioridade: fd.get("prioridade"),
                  colaborador_id: fd.get("colaborador_id") || null,
                  sistema_id: fd.get("sistema_id") || null,
                };
                updateMutation.mutate({ id: editingItem.id, payload });
              }}
              className="space-y-4 py-2"
            >
              <div>
                <Label>Título</Label>
                <Input name="titulo" defaultValue={editingItem.titulo} required />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea name="descricao" defaultValue={editingItem.descricao} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Colaborador</Label>
                  <Select
                    name="colaborador_id"
                    defaultValue={editingItem.colaborador_id || undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
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
                  <Label>Sistema / Produto</Label>
                  <Select name="sistema_id" defaultValue={editingItem.sistema_id || undefined}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sistemas.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de Agendamento</Label>
                  <Input
                    name="data_inicio"
                    type="date"
                    defaultValue={toYMDString(editingItem.data_inicio)}
                  />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select name="prioridade" defaultValue={editingItem.prioridade || "media"}>
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
              <DialogFooter>
                <Button type="submit">Salvar Alterações</Button>
                <Button variant="outline" type="button" onClick={() => setEditingItem(null)}>
                  Cancelar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
