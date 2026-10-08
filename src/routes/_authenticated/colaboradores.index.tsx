import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { db } from "@/integrations/database/client";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableSortHeader, SortOrder, sortData } from "@/components/ui/table-sort-header";
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

import { useUserPermissions } from "@/hooks/useUserPermissions";

export const Route = createFileRoute("/_authenticated/colaboradores/")({
  component: Colaboradores,
});

type Status = "ativo" | "ferias" | "afastado" | "inativo" | "desligado";

function Colaboradores() {
  const { canWrite, isConsulta } = useUserPermissions();
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

  const [sortField, setSortField] = useState<string>("nome");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedList = useMemo(() => {
    return sortData(list, sortField, sortOrder, {
      favorito: (c: any) => (favoritos.includes(c.id) ? 1 : 0),
      nome: (c: any) => c.nome || "",
      cargo: (c: any) => c.cargo || "",
      "operacao.nome": (c: any) => c.operacao?.nome || "",
      status: (c: any) => c.status || "",
    });
  }, [list, sortField, sortOrder, favoritos]);

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
        {canWrite && (
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
        )}
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
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Tabela de Colaboradores ({sortedList.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/80 text-muted-foreground border-b text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">
                  <TableSortHeader
                    label=""
                    field="favorito"
                    currentField={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="py-2.5 px-4 text-left">
                  <TableSortHeader
                    label="Colaborador / Nome"
                    field="nome"
                    currentField={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="py-2.5 px-4 text-left">
                  <TableSortHeader
                    label="Cargo"
                    field="cargo"
                    currentField={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="py-2.5 px-4 text-left">
                  <TableSortHeader
                    label="Operação"
                    field="operacao.nome"
                    currentField={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="py-2.5 px-4 text-center w-28">
                  <TableSortHeader
                    label="Status"
                    field="status"
                    currentField={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    align="center"
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedList.map((c: any) => (
                <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => toggleFav.mutate(c.id)}
                      title={favoritos.includes(c.id) ? "Remover dos favoritos" : "Favoritar"}
                      className="cursor-pointer"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          favoritos.includes(c.id)
                            ? "fill-accent text-accent"
                            : "text-muted-foreground/40 hover:text-accent"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <Link
                          to="/colaboradores/$id"
                          params={{ id: c.id }}
                          className="font-medium text-foreground hover:underline hover:text-primary"
                        >
                          {c.nome}
                        </Link>
                        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-foreground">{c.cargo || "—"}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {c.operacao?.nome || "Sem operação"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge
                      variant="outline"
                      className={
                        c.status === "ativo"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : c.status === "inativo" || c.status === "desligado"
                            ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300"
                            : ""
                      }
                    >
                      {c.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {sortedList.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum colaborador encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
