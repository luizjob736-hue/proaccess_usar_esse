import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { Plus, Star, Search, User } from "lucide-react";
import { toast } from "sonner";
import { createOperadorFromColaborador } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/colaboradores/")({
  component: Colaboradores,
});

type Status = "ativo" | "ferias" | "afastado" | "inativo" | "desligado";

function Colaboradores() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [open, setOpen] = useState(false);

  const { data: list = [] } = useQuery({
    queryKey: ["colaboradores", q, statusFilter],
    queryFn: async () => {
      let query = db.from("colaboradores").select("*, operacao:operacoes(nome)").order("nome");
      if (q) query = query.ilike("nome", `%${q}%`);
      if (statusFilter !== "todos") query = query.eq("status", statusFilter as Status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: operacoes = [] } = useQuery({
    queryKey: ["operacoes"],
    queryFn: async () => (await db.from("operacoes").select("*").order("nome")).data ?? [],
  });

  const { data: favoritos = [] } = useQuery({
    queryKey: ["favoritos"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return [];
      const { data } = await db
        .from("colaborador_favoritos")
        .select("colaborador_id")
        .eq("user_id", u.user.id);
      return (data ?? []).map((f) => f.colaborador_id);
    },
  });

  const toggleFav = useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return;
      if (favoritos.includes(id)) {
        await db
          .from("colaborador_favoritos")
          .delete()
          .eq("user_id", u.user.id)
          .eq("colaborador_id", id);
      } else {
        await db.from("colaborador_favoritos").insert({ user_id: u.user.id, colaborador_id: id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favoritos"] }),
  });

  const createOperador = useServerFn(createOperadorFromColaborador);
  const create = useMutation({
    mutationFn: async (form: any) => {
      const { data, error } = await db
        .from("colaboradores")
        .insert(form)
        .select("id")
        .maybeSingle();
      if (error) throw error;

      const isCargoOperador = form.cargo && String(form.cargo).toLowerCase().trim() === "operador";
      if (data?.id && isCargoOperador) {
        if (form.cpf) {
          try {
            const r: any = await createOperador({ data: { colaborador_id: data.id } });
            if (r?.login)
              toast.success(`Acesso Operador criado: usuário ${r.login} / senha 123456`);
          } catch (err: any) {
            toast.warning("Colaborador criado, mas o acesso de operador falhou: " + err.message);
          }
        } else {
          toast.warning(
            "Colaborador com cargo Operador cadastrado, mas o login não foi criado por falta de CPF.",
          );
        }
      }
    },
    onSuccess: () => {
      toast.success("Colaborador criado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["colaboradores"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: fd.get("nome") as string,
      cpf: (fd.get("cpf") as string) || null,
      matricula: (fd.get("matricula") as string) || null,
      email: (fd.get("email") as string) || null,
      email_senha: (fd.get("email_senha") as string) || null,
      telefone: (fd.get("telefone") as string) || null,
      cargo: (fd.get("cargo") as string) || null,
      operacao_id: (fd.get("operacao_id") as string) || null,
      admissao_em: (fd.get("admissao_em") as string) || null,
      observacoes: (fd.get("observacoes") as string) || null,
    };
    create.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Colaboradores</h1>
          <p className="text-muted-foreground">
            {list.length} registro(s) — novos operadores ganham automaticamente um acesso Operador
            (usuário = e-mail, senha = 123456)
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo colaborador</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome completo *</Label>
                <Input name="nome" required />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input name="cpf" placeholder="Necessário para acesso operador" />
              </div>
              <div>
                <Label>Matrícula</Label>
                <Input name="matricula" />
              </div>
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
                <Select name="operacao_id">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {operacoes.map((o) => (
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
              <div className="col-span-2">
                <Label>Observações</Label>
                <Input name="observacoes" />
              </div>
              <DialogFooter className="col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="flex gap-3 pt-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="ferias">Férias</SelectItem>
              <SelectItem value="afastado">Afastado</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="desligado">Desligado</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {list.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                <button onClick={() => toggleFav.mutate(c.id)}>
                  <Star
                    className={`h-4 w-4 ${favoritos.includes(c.id) ? "fill-accent text-accent" : "text-muted-foreground"}`}
                  />
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Link
                    to="/colaboradores/$id"
                    params={{ id: c.id }}
                    className="font-medium hover:underline"
                  >
                    {c.nome}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {c.cargo || "—"} • {c.operacao?.nome || "Sem operação"}
                  </p>
                </div>
                <Badge variant="outline">{c.status}</Badge>
              </div>
            ))}
            {list.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhum colaborador cadastrado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
