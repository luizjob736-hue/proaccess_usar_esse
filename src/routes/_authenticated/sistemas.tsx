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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Server, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sistemas")({ component: Sistemas });

function Sistemas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editSis, setEditSis] = useState<any | null>(null);

  const { data: list = [] } = useQuery({
    queryKey: ["sistemas"],
    queryFn: async () =>
      (await db.from("sistemas").select("*, responsavel:profiles(nome)").order("nome")).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-simple"],
    queryFn: async () => (await db.from("profiles").select("id,nome").order("nome")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await db.from("sistemas").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sistema criado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["sistemas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...rest } = payload;
      const { error } = await db.from("sistemas").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sistema atualizado");
      setEditSis(null);
      qc.invalidateQueries({ queryKey: ["sistemas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await db.from("acessos").delete().eq("sistema_id", id);
      const { error } = await db.from("sistemas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sistema excluído");
      qc.invalidateQueries({ queryKey: ["sistemas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      nome: fd.get("nome"),
      descricao: fd.get("descricao"),
      categoria: fd.get("categoria"),
      criticidade: fd.get("criticidade") || "media",
      responsavel_id: (fd.get("responsavel_id") as string) || null,
      url: fd.get("url"),
      sla_horas: fd.get("sla_horas") ? Number(fd.get("sla_horas")) : 24,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sistemas</h1>
          <p className="text-muted-foreground">{list.length} sistema(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo sistema</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input name="nome" required />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea name="descricao" />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div>
                <Label>Responsável</Label>
                <Select name="responsavel_id">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>URL</Label>
                <Input name="url" placeholder="https://..." />
              </div>
              <div>
                <Label>SLA de Atendimento / Criação (Horas)</Label>
                <Input
                  name="sla_horas"
                  type="number"
                  min="1"
                  defaultValue="24"
                  placeholder="Ex: 24, 48"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Prazo padrão de atendimento refletido nas pendências deste sistema.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map((s: any) => (
          <Card key={s.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-accent" />
                  <CardTitle className="text-base">{s.nome}</CardTitle>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  >
                    ⏱ SLA: {s.sla_horas ?? 24}h
                  </Badge>
                  <Badge
                    variant={
                      s.criticidade === "critica" || s.criticidade === "alta"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {s.criticidade}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">{s.descricao || "—"}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Responsável:{" "}
                  {s.responsavel?.nome || (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" /> Sem responsável
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">{s.categoria || "—"}</span>
              </div>
              <div className="mt-4 flex justify-end gap-2 border-t pt-2">
                <Button size="sm" variant="ghost" onClick={() => setEditSis(s)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm(`Tem certeza que deseja excluir o sistema ${s.nome}?`)) {
                      remove.mutate(s.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editSis} onOpenChange={(o) => !o && setEditSis(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar sistema — {editSis?.nome}</DialogTitle>
          </DialogHeader>
          {editSis && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                update.mutate({
                  id: editSis.id,
                  nome: fd.get("nome"),
                  descricao: fd.get("descricao"),
                  categoria: fd.get("categoria"),
                  criticidade: fd.get("criticidade"),
                  responsavel_id: (fd.get("responsavel_id") as string) || null,
                  url: fd.get("url"),
                  sla_horas: fd.get("sla_horas") ? Number(fd.get("sla_horas")) : 24,
                });
              }}
              className="space-y-3"
            >
              <div>
                <Label>Nome</Label>
                <Input name="nome" defaultValue={editSis.nome} required />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea name="descricao" defaultValue={editSis.descricao ?? ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Input name="categoria" defaultValue={editSis.categoria ?? ""} />
                </div>
                <div>
                  <Label>Criticidade</Label>
                  <Select name="criticidade" defaultValue={editSis.criticidade ?? "media"}>
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
              <div>
                <Label>Responsável</Label>
                <Select name="responsavel_id" defaultValue={editSis.responsavel_id ?? undefined}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>URL</Label>
                <Input name="url" defaultValue={editSis.url ?? ""} placeholder="https://..." />
              </div>
              <div>
                <Label>SLA de Atendimento / Criação (Horas)</Label>
                <Input
                  name="sla_horas"
                  type="number"
                  min="1"
                  defaultValue={editSis.sla_horas ?? 24}
                  placeholder="Ex: 24, 48"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={update.isPending}>
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
