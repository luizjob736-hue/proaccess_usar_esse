import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { useState } from "react";
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
import { Plus, MessageSquare, Upload, FileDown } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
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

export const Route = createFileRoute("/_authenticated/pendencias")({ component: Pendencias });

const COLUMNS = [
  { key: "backlog", title: "Backlog", color: "bg-slate-500" },
  { key: "em_analise", title: "Em análise", color: "bg-blue-500" },
  { key: "em_andamento", title: "Em andamento", color: "bg-accent" },
  { key: "aguardando", title: "Aguardando", color: "bg-amber-500" },
  { key: "concluido", title: "Concluído", color: "bg-success" },
  { key: "cancelado", title: "Cancelado", color: "bg-destructive" },
] as const;

const PRIO_COLOR: Record<string, string> = {
  baixa: "bg-slate-400",
  media: "bg-blue-500",
  alta: "bg-amber-500",
  critica: "bg-destructive",
};

function Pendencias() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sistemaFiltro, setSistemaFiltro] = useState<string>("todos");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: list = [] } = useQuery({
    queryKey: ["pendencias"],
    queryFn: async () =>
      (
        await db
          .from("pendencias")
          .select("*, colaborador:colaboradores(nome), sistema:sistemas(nome)")
          .order("posicao")
      ).data ?? [],
  });
  const { data: colabs = [] } = useQuery({
    queryKey: ["colabs-simple"],
    queryFn: async () =>
      (await db.from("colaboradores").select("id,nome").order("nome")).data ?? [],
  });
  const { data: sistemas = [] } = useQuery({
    queryKey: ["sistemas-simple"],
    queryFn: async () => (await db.from("sistemas").select("id,nome").order("nome")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (form: any) => {
      const { data: u } = await db.auth.getUser();
      const { error } = await db.from("pendencias").insert({ ...form, criado_por: u.user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pendência criada");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "concluido") patch.concluido_em = new Date().toISOString();
      const { error } = await db.from("pendencias").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pendencias"] }),
  });

  const listFiltrada =
    sistemaFiltro === "todos"
      ? list
      : list.filter((p: any) => p.sistema?.id === sistemaFiltro || p.sistema_id === sistemaFiltro);

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const parsed = Papa.parse<any>(text, { header: true, skipEmptyLines: true });
      const colabMap = new Map((colabs as any[]).map((c) => [c.nome.toLowerCase(), c.id]));
      const sisMap = new Map((sistemas as any[]).map((s) => [s.nome.toLowerCase(), s.id]));
      const { data: u } = await db.auth.getUser();
      const rows = parsed.data
        .map((r: any) => ({
          titulo: r.titulo || r.título || "",
          descricao: r.descricao || r.descrição || null,
          tipo: r.tipo || "outro",
          prioridade: r.prioridade || "media",
          status: r.status || "backlog",
          colaborador_id: r.colaborador
            ? (colabMap.get(String(r.colaborador).toLowerCase()) ?? null)
            : null,
          sistema_id: r.sistema ? (sisMap.get(String(r.sistema).toLowerCase()) ?? null) : null,
          sla_em: r.sla_em || null,
          etiquetas: r.etiquetas
            ? String(r.etiquetas)
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [],
          criado_por: u.user?.id,
        }))
        .filter((r: any) => r.titulo);
      if (rows.length === 0) throw new Error("CSV vazio ou sem coluna 'titulo'");
      const { error } = await db.from("pendencias").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} pendência(s) importada(s)`);
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function downloadTemplate() {
    const csv =
      "titulo,descricao,tipo,prioridade,status,colaborador,sistema,sla_em,etiquetas\nExemplo,Descrição,solicitacao_acesso,media,backlog,Nome do Colaborador,Nome do Sistema,2025-12-31T18:00,urgente;tributário\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modelo-pendencias.csv";
    a.click();
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
          <Dialog open={open} onOpenChange={setOpen}>
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
                  create.mutate({
                    titulo: fd.get("titulo"),
                    descricao: fd.get("descricao"),
                    tipo: fd.get("tipo") || "outro",
                    prioridade: fd.get("prioridade") || "media",
                    colaborador_id: (fd.get("colaborador_id") as string) || null,
                    sistema_id: (fd.get("sistema_id") as string) || null,
                    sla_em: (fd.get("sla_em") as string) || null,
                    data_inicio: (fd.get("data_inicio") as string) || undefined,
                    etiquetas: ((fd.get("etiquetas") as string) || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  });
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
                    <Label>Sistema</Label>
                    <Select name="sistema_id">
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data de início</Label>
                    <Input
                      name="data_inicio"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <Label>SLA (data limite)</Label>
                    <Input name="sla_em" type="datetime-local" />
                  </div>
                </div>
                <div>
                  <Label>Etiquetas (separadas por vírgula)</Label>
                  <Input name="etiquetas" placeholder="urgente, tributário" />
                </div>

                <DialogFooter>
                  <Button type="submit">Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
          {COLUMNS.map((col) => {
            const items = listFiltrada.filter((p: any) => p.status === col.key);
            return (
              <Column
                key={col.key}
                id={col.key}
                title={col.title}
                color={col.color}
                items={items}
                onOpen={setDetailId}
              />
            );
          })}
        </div>
        <DragOverlay>{activeItem && <CardView p={activeItem} />}</DragOverlay>
      </DndContext>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl">
          {detail && <PendenciaDetail p={detail} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Column({ id, title, color, items, onOpen }: any) {
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
          <DraggableCard key={p.id} p={p} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ p, onOpen }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: p.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(p.id)}
    >
      <CardView p={p} />
    </div>
  );
}

function CardView({ p }: any) {
  const inicio = p.data_inicio ? new Date(p.data_inicio) : new Date(p.criado_em);
  const fim = p.data_resolucao ? new Date(p.data_resolucao) : new Date();
  const dias = Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 86400000));
  const alerta = !p.data_resolucao && dias > 5;
  return (
    <div className="cursor-grab rounded-md border bg-background p-3 shadow-sm hover:shadow-md">
      <div className="flex items-start gap-2">
        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PRIO_COLOR[p.prioridade]}`} />
        <p className="flex-1 text-sm font-medium">{p.titulo}</p>
      </div>
      {p.colaborador?.nome && (
        <p className="mt-1 text-xs text-muted-foreground">👤 {p.colaborador.nome}</p>
      )}
      {p.sistema?.nome && <p className="text-xs text-muted-foreground">🖥 {p.sistema.nome}</p>}
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
            alerta ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground"
          }
        >
          {p.data_resolucao ? `${dias}d (resolvido)` : `${dias} dia${dias === 1 ? "" : "s"}`}
        </Badge>
      </div>
      {p.sla_em && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          SLA: {new Date(p.sla_em).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}

function PendenciaDetail({ p }: any) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data: coments = [] } = useQuery({
    queryKey: ["coments", p.id],
    queryFn: async () =>
      (
        await db
          .from("pendencia_comentarios")
          .select("*, autor:profiles!pendencia_comentarios_autor_id_fkey(nome)")
          .eq("pendencia_id", p.id)
          .order("criado_em")
      ).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await db.auth.getUser();
      await db
        .from("pendencia_comentarios")
        .insert({ pendencia_id: p.id, autor_id: u.user!.id, conteudo: text });
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["coments", p.id] });
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{p.titulo}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Badge>{p.status}</Badge>
          <Badge variant="outline">{p.prioridade}</Badge>
          <Badge variant="outline">{p.tipo}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{p.descricao || "Sem descrição"}</p>
        <div className="grid grid-cols-2 gap-3 rounded-md border p-3 bg-muted/30">
          <div>
            <Label className="text-xs">Data de início</Label>
            <Input
              type="date"
              defaultValue={(p.data_inicio ?? p.criado_em)?.slice(0, 10)}
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
              defaultValue={p.data_resolucao?.slice(0, 10) ?? ""}
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
