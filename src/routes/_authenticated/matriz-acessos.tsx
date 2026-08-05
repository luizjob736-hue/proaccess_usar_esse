import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { db } from "@/integrations/database/client";
import { useMemo, useState, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  EyeOff,
  Search,
  Copy,
  Grid3x3,
  FileDown,
  Plus,
  UserX,
  Upload,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createOperadorFromColaborador } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/matriz-acessos")({
  component: MatrizAcessos,
});

export function MatrizView({ onlyInativos = false }: { onlyInativos?: boolean }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [reveal, setReveal] = useState(false);
  const [newSisOpen, setNewSisOpen] = useState(false);
  const [newColOpen, setNewColOpen] = useState(false);
  const [addAcessoFor, setAddAcessoFor] = useState<any | null>(null);
  const [editColab, setEditColab] = useState<any | null>(null);
  const [editAcesso, setEditAcesso] = useState<any | null>(null);
  const { data: me } = useQuery({
    queryKey: ["me-matriz"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return null;
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
      return { user: u.user, roles: roles?.map((r) => r.role) ?? [] };
    },
  });

  const isMaster =
    (me?.roles ?? []).includes("admin_master") ||
    (me?.roles ?? []).includes("admin") ||
    me?.user?.role === "admin_master";

  const excluirColab = useMutation({
    mutationFn: async (id: string) => {
      await db.from("acessos").delete().eq("colaborador_id", id);
      const { error } = await db.from("colaboradores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador excluído com sucesso");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: acessos = [] } = useQuery({
    queryKey: ["matriz-acessos-full"],
    queryFn: async () => {
      const { data, error } = await db
        .from("acessos")
        .select(
          "id, login, senha, sistema:sistemas(id,nome), colaborador:colaboradores(id, nome, cpf, email, email_senha, telefone, cargo, status, operacao_id, matricula, admissao_em)",
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: colabsRaw = [] } = useQuery({
    queryKey: ["colabs-full"],
    queryFn: async () =>
      (
        await db
          .from("colaboradores")
          .select(
            "id, nome, cpf, email, email_senha, telefone, cargo, status, operacao_id, matricula, admissao_em, inativado_em, data_nascimento" as any,
          )
          .order("nome")
      ).data ?? [],
  });

  const { data: sistemasAll = [] } = useQuery({
    queryKey: ["sistemas-all"],
    queryFn: async () => (await db.from("sistemas").select("id,nome").order("nome")).data ?? [],
  });

  const { data: operacoes = [] } = useQuery({
    queryKey: ["operacoes-all"],
    queryFn: async () => (await db.from("operacoes").select("id,nome").order("nome")).data ?? [],
  });

  const criarSistema = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await db.from("sistemas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sistema criado");
      setNewSisOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const criarColab = useMutation({
    mutationFn: async (form: any) => {
      const { data, error } = await db
        .from("colaboradores")
        .insert(form)
        .select("id,cpf")
        .maybeSingle();
      if (error) throw error;
      if (data?.id && data?.cpf) {
        try {
          const r: any = await createOperador({ data: { colaborador_id: data.id } });
          if (r?.login) toast.success(`Operador criado: usuário ${r.login} / senha 123456`);
        } catch (err: any) {
          toast.warning("Colaborador criado, acesso operador falhou: " + err.message);
        }
      }
    },
    onSuccess: () => {
      toast.success("Colaborador criado");
      setNewColOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editarColab = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...rest } = payload;
      const { error } = await db.from("colaboradores").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador atualizado");
      setEditColab(null);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const criarAcesso = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await db.from("acessos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso adicionado");
      setAddAcessoFor(null);
      qc.invalidateQueries({ queryKey: ["matriz-acessos-full"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editarAcesso = useMutation({
    mutationFn: async (payload: any) => {
      const { id, login, senha } = payload;
      const { error } = await db.from("acessos").update({ login, senha }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso atualizado");
      setEditAcesso(null);
      qc.invalidateQueries({ queryKey: ["matriz-acessos-full"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const flagInativo = useMutation({
    mutationFn: async ({ id, inativo }: { id: string; inativo: boolean }) => {
      const { error } = await db
        .from("colaboradores")
        .update({ status: inativo ? "inativo" : "ativo" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.inativo ? "Marcado como inativo" : "Reativado");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { sistemas, linhas } = useMemo(() => {
    const sisMap = new Map<string, string>();
    const colabMap = new Map<string, any>();
    for (const c of colabsRaw as any[]) colabMap.set(c.id, { ...c, acessos: {} });
    for (const a of acessos as any[]) {
      if (a.sistema) sisMap.set(a.sistema.id, a.sistema.nome);
      if (a.colaborador) {
        const id = a.colaborador.id;
        if (!colabMap.has(id)) colabMap.set(id, { ...a.colaborador, acessos: {} });
        colabMap.get(id).acessos[a.sistema?.id] = {
          id: a.id,
          login: a.login,
          senha: a.senha,
          sistema_nome: a.sistema?.nome,
        };
      }
    }
    const sistemas = Array.from(sisMap.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const linhas = Array.from(colabMap.values())
      .filter((c: any) =>
        onlyInativos
          ? c.status === "inativo" || c.status === "desligado"
          : c.status !== "inativo" && c.status !== "desligado",
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { sistemas, linhas };
  }, [acessos, colabsRaw, onlyInativos]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return linhas;
    return linhas.filter((r: any) =>
      [r.nome, r.email, r.telefone, r.cpf].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(t),
      ),
    );
  }, [linhas, q]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function copy(v: string | null, label: string) {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  }

  function exportar() {
    const rows = filtered.map((r: any) => {
      const base: any = {
        Nome: r.nome,
        CPF: r.cpf ?? "",
        "Data de Nascimento": r.data_nascimento
          ? new Date(r.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR")
          : "",
        Email: r.email ?? "",
        Telefone: r.telefone ?? "",
        Cargo: r.cargo ?? "",
      };
      if (onlyInativos) {
        base["Data Inativação"] = r.inativado_em
          ? new Date(r.inativado_em).toLocaleDateString("pt-BR")
          : "—";
      }
      for (const s of sistemas) {
        base[`${s.nome} - Usuário`] = r.acessos[s.id]?.login ?? "";
        base[`${s.nome} - Senha`] = r.acessos[s.id]?.senha ?? "";
      }
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, onlyInativos ? "Inativos" : "Matriz");
    XLSX.writeFile(wb, onlyInativos ? "usuarios-inativos.xlsx" : "matriz-acessos.xlsx");
  }

  const Val = ({
    v,
    label,
    onEdit,
  }: {
    v: string | null | undefined;
    label: string;
    onEdit?: () => void;
  }) => (
    <div className="flex items-center gap-1 group min-w-0">
      <span className="font-mono text-[11px] truncate">{v ? (reveal ? v : "••••") : "—"}</span>
      {v && (
        <button onClick={() => copy(v, label)} className="opacity-0 group-hover:opacity-100">
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
      {onEdit && (
        <button onClick={onEdit} className="opacity-0 group-hover:opacity-100">
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">
            {onlyInativos ? "Usuários Inativos" : "Matriz de Acessos"}
          </h1>
          <p className="text-muted-foreground">
            {onlyInativos
              ? "Colaboradores marcados como inativos e seus acessos"
              : "Colaboradores, credenciais e sistemas em uma única visão"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setReveal((r) => !r)} className="gap-2">
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {reveal ? "Ocultar" : "Mostrar"}
          </Button>
          <Button variant="outline" onClick={exportar} className="gap-2">
            <FileDown className="h-4 w-4" /> Exportar
          </Button>
          {!onlyInativos && (
            <>
              <Link to="/importar">
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" /> Importar CSV
                </Button>
              </Link>
              <Dialog open={newSisOpen} onOpenChange={setNewSisOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" /> Novo sistema
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo sistema</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      criarSistema.mutate({
                        nome: fd.get("nome"),
                        categoria: fd.get("categoria") || null,
                        criticidade: fd.get("criticidade") || "media",
                        ativo: true,
                      });
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <Label>Nome</Label>
                      <Input name="nome" required />
                    </div>
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
                    <DialogFooter>
                      <Button type="submit">Criar</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Dialog open={newColOpen} onOpenChange={setNewColOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Novo colaborador
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Novo colaborador</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      criarColab.mutate({
                        nome: fd.get("nome"),
                        cpf: (fd.get("cpf") as string) || null,
                        matricula: (fd.get("matricula") as string) || null,
                        email: (fd.get("email") as string) || null,
                        email_senha: (fd.get("email_senha") as string) || null,
                        telefone: (fd.get("telefone") as string) || null,
                        cargo: (fd.get("cargo") as string) || null,
                        operacao_id: (fd.get("operacao_id") as string) || null,
                        admissao_em: (fd.get("admissao_em") as string) || null,
                        data_nascimento: (fd.get("data_nascimento") as string) || null,
                        observacoes: (fd.get("observacoes") as string) || null,
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
                      <Input name="cpf" placeholder="Obrigatório p/ operador" />
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
                      <Label>Admissão</Label>
                      <Input name="admissao_em" type="date" />
                    </div>
                    <div>
                      <Label>Data de Nascimento</Label>
                      <Input name="data_nascimento" type="date" />
                    </div>
                    <div className="col-span-2">
                      <Label>Observações</Label>
                      <Input name="observacoes" />
                    </div>
                    <DialogFooter className="col-span-2">
                      <Button type="submit" disabled={criarColab.isPending}>
                        Salvar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 h-9 text-sm"
                placeholder="Buscar por nome, CPF, e-mail ou telefone..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto text-xs text-muted-foreground">
              <span>Exibir</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>itens por página</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-primary" /> Colaboradores × Sistemas
            <Badge variant="secondary" className="ml-1 text-xs">
              {filtered.length} registro{filtered.length === 1 ? "" : "s"}
            </Badge>
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Página {currentPage} de {totalPages}
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="text-xs border-collapse w-full">
            <thead className="bg-muted/70 uppercase text-[11px] font-semibold text-muted-foreground">
              <tr>
                <th className="p-2.5 text-left border-b border-r sticky left-0 bg-muted/90 z-20 min-w-[180px] shadow-sm">
                  Nome
                </th>
                <th className="p-2.5 text-left border-b border-r min-w-[110px]">CPF</th>
                <th className="p-2.5 text-left border-b border-r min-w-[100px]">Nascimento</th>
                <th className="p-2.5 text-left border-b border-r min-w-[160px]">E-mail</th>
                <th className="p-2.5 text-left border-b border-r min-w-[120px]">Senha e-mail</th>
                <th className="p-2.5 text-left border-b border-r min-w-[110px]">Telefone</th>
                <th className="p-2.5 text-left border-b border-r min-w-[120px]">Cargo</th>
                {onlyInativos && (
                  <th className="p-2.5 text-left border-b border-r min-w-[110px]">Inativado em</th>
                )}
                <th className="p-2.5 text-center border-b border-r min-w-[100px]">Ações</th>
                {sistemas.map((s) => (
                  <th
                    key={s.id}
                    colSpan={2}
                    className="p-2 text-center border-b border-r bg-primary/5 font-semibold text-foreground min-w-[200px]"
                  >
                    {s.nome}
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/40 border-b text-[10px]">
                <th className="border-r sticky left-0 bg-muted/80 z-20 shadow-sm" />
                <th className="border-r" />
                <th className="border-r" />
                <th className="border-r" />
                <th className="border-r" />
                <th className="border-r" />
                <th className="border-r" />
                {onlyInativos && <th className="border-r" />}
                <th className="border-r" />
                {sistemas.map((s) => (
                  <Fragment key={s.id}>
                    <th className="p-1 text-left border-r font-medium">Usuário</th>
                    <th className="p-1 text-left border-r font-medium">Senha</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedRows.map((r: any) => (
                <tr
                  key={r.id}
                  className={
                    "hover:bg-muted/40 transition-colors " +
                    (r.status === "inativo" || r.status === "desligado"
                      ? "opacity-75 bg-muted/10"
                      : "")
                  }
                >
                  <td className="p-2 border-r font-medium sticky left-0 bg-background z-10 shadow-sm">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate max-w-[160px]" title={r.nome}>
                        {r.nome}
                      </span>
                      {(r.status === "inativo" || r.status === "desligado") && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                          {r.status}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-2 border-r font-mono text-[11px] text-muted-foreground">
                    {r.cpf ?? "—"}
                  </td>
                  <td className="p-2 border-r text-[11px]">
                    {r.data_nascimento
                      ? new Date(r.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td
                    className="p-2 border-r text-[11px] truncate max-w-[160px]"
                    title={r.email ?? ""}
                  >
                    {r.email ?? "—"}
                  </td>
                  <td className="p-2 border-r">
                    <Val v={r.email_senha} label="Senha e-mail" />
                  </td>
                  <td className="p-2 border-r text-[11px]">{r.telefone ?? "—"}</td>
                  <td className="p-2 border-r text-[11px] truncate max-w-[120px]">
                    {r.cargo ?? "—"}
                  </td>
                  {onlyInativos && (
                    <td className="p-2 border-r text-[11px]">
                      {r.inativado_em ? new Date(r.inativado_em).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  )}
                  <td className="p-2 border-r">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Editar"
                        onClick={() => setEditColab(r)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Adicionar acesso"
                        onClick={() => setAddAcessoFor(r)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title={r.status === "inativo" ? "Reativar" : "Marcar inativo"}
                        onClick={() =>
                          flagInativo.mutate({ id: r.id, inativo: r.status !== "inativo" })
                        }
                      >
                        <UserX
                          className={
                            "h-3 w-3 " + (r.status === "inativo" ? "text-destructive" : "")
                          }
                        />
                      </Button>
                      {isMaster && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Excluir colaborador"
                          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (window.confirm(`Tem certeza que deseja excluir ${r.nome}?`)) {
                              excluirColab.mutate(r.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                  {sistemas.map((s) => {
                    const a = r.acessos[s.id];
                    return (
                      <Fragment key={s.id}>
                        <td className="p-2 border-r">
                          <Val
                            v={a?.login}
                            label="Usuário"
                            onEdit={
                              a
                                ? () =>
                                    setEditAcesso({
                                      ...a,
                                      colab_nome: r.nome,
                                      sistema_nome: s.nome,
                                    })
                                : undefined
                            }
                          />
                        </td>
                        <td className="p-2 border-r">
                          <Val
                            v={a?.senha}
                            label="Senha"
                            onEdit={
                              a
                                ? () =>
                                    setEditAcesso({
                                      ...a,
                                      colab_nome: r.nome,
                                      sistema_nome: s.nome,
                                    })
                                : undefined
                            }
                          />
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8 + (onlyInativos ? 1 : 0) + sistemas.length * 2}
                    className="p-8 text-center text-muted-foreground text-sm"
                  >
                    Nenhum colaborador encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>

        {/* Pagination Footer */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-muted/20 border-t text-xs">
            <span className="text-muted-foreground">
              Mostrando {Math.min((currentPage - 1) * pageSize + 1, filtered.length)} a{" "}
              {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} colaboradores
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={currentPage <= 1}
                onClick={() => setPage(1)}
              >
                Primeira
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="px-2 font-medium">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                Última
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={!!addAcessoFor} onOpenChange={(o) => !o && setAddAcessoFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar acesso — {addAcessoFor?.nome}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              criarAcesso.mutate({
                colaborador_id: addAcessoFor.id,
                sistema_id: fd.get("sistema_id"),
                login: fd.get("login") || null,
                senha: fd.get("senha") || null,
                status: "ativo",
              });
            }}
            className="space-y-3"
          >
            <div>
              <Label>Sistema *</Label>
              <Select name="sistema_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {sistemasAll.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Usuário *</Label>
              <Input name="login" required />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input name="senha" required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={criarAcesso.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editColab} onOpenChange={(o) => !o && setEditColab(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar colaborador</DialogTitle>
          </DialogHeader>
          {editColab && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                editarColab.mutate({
                  id: editColab.id,
                  nome: fd.get("nome"),
                  cpf: (fd.get("cpf") as string) || null,
                  matricula: (fd.get("matricula") as string) || null,
                  email: (fd.get("email") as string) || null,
                  email_senha: (fd.get("email_senha") as string) || null,
                  telefone: (fd.get("telefone") as string) || null,
                  cargo: (fd.get("cargo") as string) || null,
                  operacao_id: (fd.get("operacao_id") as string) || null,
                  admissao_em: (fd.get("admissao_em") as string) || null,
                  data_nascimento: (fd.get("data_nascimento") as string) || null,
                  status: (fd.get("status") as string) || "ativo",
                });
              }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input name="nome" defaultValue={editColab.nome} required />
              </div>
              <div>
                <Label>CPF</Label>
                <Input name="cpf" defaultValue={editColab.cpf ?? ""} />
              </div>
              <div>
                <Label>Matrícula</Label>
                <Input name="matricula" defaultValue={editColab.matricula ?? ""} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input name="email" defaultValue={editColab.email ?? ""} />
              </div>
              <div>
                <Label>Senha do e-mail</Label>
                <Input name="email_senha" defaultValue={editColab.email_senha ?? ""} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input name="telefone" defaultValue={editColab.telefone ?? ""} />
              </div>
              <div>
                <Label>Cargo</Label>
                <Input name="cargo" defaultValue={editColab.cargo ?? ""} />
              </div>
              <div>
                <Label>Operação</Label>
                <Select name="operacao_id" defaultValue={editColab.operacao_id ?? undefined}>
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
                <Label>Admissão</Label>
                <Input name="admissao_em" type="date" defaultValue={editColab.admissao_em ?? ""} />
              </div>
              <div>
                <Label>Data de Nascimento</Label>
                <Input
                  name="data_nascimento"
                  type="date"
                  defaultValue={editColab.data_nascimento ?? ""}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue={editColab.status ?? "ativo"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                    <SelectItem value="desligado">Desligado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="col-span-2">
                <Button type="submit" disabled={editarColab.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editAcesso} onOpenChange={(o) => !o && setEditAcesso(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar acesso — {editAcesso?.colab_nome} / {editAcesso?.sistema_nome}
            </DialogTitle>
          </DialogHeader>
          {editAcesso && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                editarAcesso.mutate({
                  id: editAcesso.id,
                  login: fd.get("login") || null,
                  senha: fd.get("senha") || null,
                });
              }}
              className="space-y-3"
            >
              <div>
                <Label>Usuário</Label>
                <Input name="login" defaultValue={editAcesso.login ?? ""} />
              </div>
              <div>
                <Label>Senha</Label>
                <Input name="senha" defaultValue={editAcesso.senha ?? ""} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={editarAcesso.isPending}>
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

function MatrizAcessos() {
  return <MatrizView />;
}
