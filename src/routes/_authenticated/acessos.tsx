import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/acessos")({ component: Acessos });

function Acessos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("todos");

  const { data: list = [] } = useQuery({
    queryKey: ["acessos", statusFilter],
    queryFn: async () => {
      let q = db
        .from("acessos")
        .select(
          "*, colaborador:colaboradores(nome,status), sistema:sistemas(nome), perfil:perfis_acesso(nome)",
        )
        .order("criado_em", { ascending: false });
      if (statusFilter !== "todos") q = q.eq("status", statusFilter as any);
      return (await q).data ?? [];
    },
  });
  const { data: colabs = [] } = useQuery({
    queryKey: ["colabs-simple"],
    queryFn: async () =>
      (await db.from("colaboradores").select("id,nome").eq("status", "ativo").order("nome")).data ??
      [],
  });
  const { data: sistemas = [] } = useQuery({
    queryKey: ["sistemas-simple"],
    queryFn: async () => (await db.from("sistemas").select("id,nome").order("nome")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (form: any) => {
      const { data: u } = await db.auth.getUser();
      const { error } = await db.from("acessos").insert({
        ...form,
        concedido_por: u.user?.id,
        concedido_em: form.status === "ativo" ? new Date().toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso registrado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["acessos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: any) => {
      const patch: any = { status };
      if (status === "ativo") {
        patch.concedido_em = new Date().toISOString();
      }
      const { error } = await db.from("acessos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["acessos"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Acessos</h1>
          <p className="text-muted-foreground">Matriz de acessos concedidos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Conceder acesso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo acesso</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({
                  colaborador_id: fd.get("colaborador_id"),
                  sistema_id: fd.get("sistema_id"),
                  login: fd.get("login"),
                  senha: fd.get("senha"),
                  status: fd.get("status") || "pendente",
                });
              }}
              className="space-y-3"
            >
              <div>
                <Label>Colaborador</Label>
                <Select name="colaborador_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
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
                <Select name="sistema_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
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
              <div>
                <Label>Login no sistema</Label>
                <Input name="login" />
              </div>
              <div>
                <Label>Senha</Label>
                <Input name="senha" type="text" />
              </div>
              <div>
                <Label>Status inicial</Label>
                <Select name="status" defaultValue="pendente">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
              <SelectItem value="exclusao_pendente">Exclusão pendente</SelectItem>
              <SelectItem value="excluido">Excluído</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Acessos ({list.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {list.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="font-medium">
                    {a.colaborador?.nome} → {a.sistema?.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Login: {a.login || "—"} • {a.perfil?.nome || "sem perfil"}
                  </p>
                </div>
                <Badge variant={a.status === "ativo" ? "default" : "outline"}>{a.status}</Badge>
                <Select
                  value={a.status}
                  onValueChange={(v) => updateStatus.mutate({ id: a.id, status: v })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativar</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="suspenso">Suspender</SelectItem>
                    <SelectItem value="exclusao_pendente">Excluir</SelectItem>
                    <SelectItem value="excluido">Excluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {list.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Sem acessos.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
