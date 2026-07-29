import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Server, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sistemas")({ component: Sistemas });

function Sistemas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: list = [] } = useQuery({
    queryKey: ["sistemas"],
    queryFn: async () =>
      (await supabase.from("sistemas").select("*, responsavel:profiles(nome)").order("nome"))
        .data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-simple"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,nome").order("nome")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from("sistemas").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sistema criado");
      setOpen(false);
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
