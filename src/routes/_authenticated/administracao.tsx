import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Users,
  Building2,
  ShieldCheck,
  UserPlus,
  Eye,
  EyeOff,
  Copy,
  KeyRound,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { createUserAccount, resetUserPassword } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/administracao")({ component: Adm });

const ROLES = ["admin_master", "admin", "analista", "supervisor", "consulta", "operador"] as const;

function Adm() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Administração</h1>
        <p className="text-muted-foreground">Usuários, permissões e operações</p>
      </div>
      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">
            <Users className="mr-2 h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="operacoes">
            <Building2 className="mr-2 h-4 w-4" />
            Operações
          </TabsTrigger>
          <TabsTrigger value="permissoes">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Permissões
          </TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios" className="mt-4">
          <UsuariosTab />
        </TabsContent>
        <TabsContent value="operacoes" className="mt-4">
          <OperacoesTab />
        </TabsContent>
        <TabsContent value="permissoes" className="mt-4">
          <PermissoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsuariosTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [resetFor, setResetFor] = useState<any | null>(null);
  const createFn = useServerFn(createUserAccount);
  const resetFn = useServerFn(resetUserPassword);

  const { data = [] } = useQuery({
    queryKey: ["adm-users"],
    queryFn: async () => {
      const { data: profs } = await supabase.from("profiles").select("*").order("nome");
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profs ?? []).map((p: any) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: any) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role });
    },
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["adm-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async (payload: any) => await createFn({ data: payload }),
    onSuccess: (r: any) => {
      toast.success(`Acesso criado — Login: ${r.login} | Senha: ${r.senha_provisoria}`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["adm-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: async (payload: any) => await resetFn({ data: payload }),
    onSuccess: (r: any) => {
      toast.success(`Senha redefinida: ${r.senha}`);
      setResetFor(null);
      qc.invalidateQueries({ queryKey: ["adm-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["adm-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function copy(v: string | null | undefined, label: string) {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Usuários ({data.length})</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReveal((r) => !r)}
            className="gap-2"
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {reveal ? "Ocultar senhas" : "Mostrar senhas"}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" /> Novo acesso
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar acesso por hierarquia</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const role = fd.get("role") as string;
                  create.mutate({
                    nome: fd.get("nome"),
                    email: fd.get("email"),
                    cpf: fd.get("cpf"),
                    login: (fd.get("login") as string) || undefined,
                    senha:
                      (fd.get("senha") as string) || (role === "operador" ? "123456" : undefined),
                    role,
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
                  <Input name="cpf" required placeholder="Usado no login do operador" />
                </div>
                <div>
                  <Label>E-mail *</Label>
                  <Input name="email" type="email" required />
                </div>
                <div>
                  <Label>Usuário (opcional)</Label>
                  <Input name="login" placeholder="Deixe em branco para usar e-mail" />
                </div>
                <div>
                  <Label>Senha (opcional)</Label>
                  <Input name="senha" placeholder="Gerada automaticamente" />
                </div>
                <div className="col-span-2">
                  <Label>Hierarquia *</Label>
                  <Select name="role" required defaultValue="consulta">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Operador terá senha padrão <code>123456</code> se nada for informado; demais
                  papéis recebem senha provisória.
                </p>
                <DialogFooter className="col-span-2">
                  <Button type="submit" disabled={create.isPending}>
                    Criar acesso
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.map((u: any) => (
            <div key={u.id} className="flex items-center gap-3 p-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium">{u.nome}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <KeyRound className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono">
                  {u.ultima_senha ? (reveal ? u.ultima_senha : "••••••••") : "—"}
                </span>
                {u.ultima_senha && (
                  <Button size="sm" variant="ghost" onClick={() => copy(u.ultima_senha, "Senha")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {u.roles.map((r: string) => (
                <Badge key={r}>{r}</Badge>
              ))}
              <Select
                value={u.roles[0] ?? ""}
                onValueChange={(v) => setRole.mutate({ userId: u.id, role: v })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Papel" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => setResetFor(u)} className="gap-1">
                <KeyRound className="h-3 w-3" /> Redefinir
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Excluir usuário"
                onClick={() => {
                  if (window.confirm(`Tem certeza que deseja excluir o usuário ${u.nome}?`)) {
                    deleteUser.mutate(u.id);
                  }
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha — {resetFor?.nome}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              reset.mutate({
                user_id: resetFor.id,
                nova_senha: (fd.get("nova_senha") as string) || undefined,
              });
            }}
            className="space-y-3"
          >
            <div>
              <Label>Nova senha (opcional)</Label>
              <Input name="nova_senha" placeholder="Deixe em branco para gerar automaticamente" />
            </div>
            <p className="text-xs text-muted-foreground">
              A nova senha aparecerá na tela e ficará visível na lista de usuários.
            </p>
            <DialogFooter>
              <Button type="submit" disabled={reset.isPending}>
                Redefinir
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function OperacoesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["ops"],
    queryFn: async () => (await supabase.from("operacoes").select("*").order("nome")).data ?? [],
  });
  const create = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from("operacoes").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Operação criada");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ops"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Operações</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova operação</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({ nome: fd.get("nome"), descricao: fd.get("descricao") });
              }}
              className="space-y-3"
            >
              <div>
                <Label>Nome</Label>
                <Input name="nome" required />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input name="descricao" />
              </div>
              <DialogFooter>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between p-3">
              <span className="font-medium">{o.nome}</span>
              <span className="text-xs text-muted-foreground">{o.descricao}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PermissoesTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Matriz de permissões por papel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">Módulo / Ação</th>
                {ROLES.map((r) => (
                  <th key={r} className="p-2 text-center">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Dashboard", "✓", "✓", "✓", "✓", "✓", ""],
                ["Matriz de Acessos", "✓", "✓", "✓", "✓", "", "(própria)"],
                ["Sistemas", "✓", "✓", "✓", "", "", ""],
                ["Pendências", "✓", "✓", "✓", "(próprias)", "", ""],
                ["Chamados", "✓", "✓", "", "", "", "(próprios)"],
                ["Relatórios", "✓", "✓", "✓", "✓", "", ""],
                ["Administração", "✓", "(exceto master)", "", "", "", ""],
                ["Lixeira", "✓", "✓", "", "", "", ""],
              ].map((row, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{row[0]}</td>
                  {row.slice(1).map((v, j) => (
                    <td key={j} className="p-2 text-center">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
