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
import { Plus, LifeBuoy, Check, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chamados")({ component: Chamados });

const TIPO_LABEL: Record<string, string> = {
  erro: "Erro",
  desbloqueio: "Desbloqueio",
  redefinicao_senha: "Redefinição de senha",
};

const STATUS_COLOR: Record<string, string> = {
  aberto: "bg-blue-500",
  em_analise: "bg-yellow-500",
  aceito: "bg-emerald-500",
  recusado: "bg-red-500",
  concluido: "bg-slate-500",
};

function Chamados() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const { data: me } = useQuery({
    queryKey: ["me-chamados"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return null;
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin" || r.role === "admin_master");
      return { user: u.user, isAdmin };
    },
  });

  const { data: sistemas = [] } = useQuery({
    queryKey: ["sistemas-lite"],
    queryFn: async () => (await db.from("sistemas").select("id,nome").order("nome")).data ?? [],
  });

  const { data: chamados = [] } = useQuery({
    queryKey: ["chamados"],
    queryFn: async () => {
      const { data, error } = await db
        .from("chamados")
        .select("*, sistema:sistemas(nome)")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (payload: any) => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      let print_url: string | null = null;
      const file: File | null = payload._file;
      if (file) {
        const path = `${u.user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await db.storage
          .from("chamados")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await db.storage
          .from("chamados")
          .createSignedUrl(path, 60 * 60 * 24 * 30);
        print_url = signed?.signedUrl ?? path;
      }
      const { _file, ...rest } = payload;
      const { error } = await db
        .from("chamados")
        .insert({ ...rest, operador_id: u.user.id, print_url });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado aberto");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["chamados"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      resposta,
    }: {
      id: string;
      status: string;
      resposta?: string;
    }) => {
      const patch: any = { status };
      if (resposta !== undefined) patch.resposta = resposta;
      if (status === "concluido" || status === "recusado" || status === "aceito")
        patch.resolvido_em = new Date().toISOString();
      if (me?.isAdmin) patch.tratador_id = me.user.id;
      const { error } = await db.from("chamados").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado atualizado");
      qc.invalidateQueries({ queryKey: ["chamados"] });
      qc.invalidateQueries({ queryKey: ["chamado-comentarios"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <LifeBuoy className="h-7 w-7 text-accent" /> Chamados
          </h1>
          <p className="text-muted-foreground">
            {me?.isAdmin ? "Todos os chamados abertos por operadores" : "Seus chamados"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Abrir chamado
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo chamado</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const file = (fd.get("print") as File) || null;
                create.mutate({
                  tipo: fd.get("tipo"),
                  titulo: fd.get("titulo"),
                  descricao: fd.get("descricao") || null,
                  sistema_id: fd.get("sistema_id") || null,
                  _file: file && file.size > 0 ? file : null,
                });
              }}
              className="space-y-3"
            >
              <div>
                <Label>Tipo</Label>
                <Select name="tipo" required defaultValue="erro">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="erro">Erro</SelectItem>
                    <SelectItem value="desbloqueio">Desbloqueio</SelectItem>
                    <SelectItem value="redefinicao_senha">Redefinição de senha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título</Label>
                <Input name="titulo" required />
              </div>
              <div>
                <Label>Sistema (opcional)</Label>
                <Select name="sistema_id">
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
                <Label>Descrição</Label>
                <Textarea name="descricao" rows={3} />
              </div>
              <div>
                <Label>Print (opcional)</Label>
                <Input name="print" type="file" accept="image/*" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  Enviar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chamados ({chamados.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {chamados.map((c: any) => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{c.titulo}</span>
                      <Badge variant="outline">{TIPO_LABEL[c.tipo] ?? c.tipo}</Badge>
                      <Badge className={STATUS_COLOR[c.status] + " text-white"}>{c.status}</Badge>
                      {c.sistema?.nome && <Badge variant="secondary">{c.sistema.nome}</Badge>}
                    </div>
                    {c.descricao && (
                      <p className="text-xs text-muted-foreground mt-1">{c.descricao}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Aberto em {new Date(c.criado_em).toLocaleString("pt-BR")}
                    </p>
                    {c.print_url && (
                      <a
                        href={c.print_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-accent underline"
                      >
                        Ver print
                      </a>
                    )}
                    {c.resposta && (
                      <p className="text-xs mt-2 rounded bg-muted p-2">
                        <strong>Resposta:</strong> {c.resposta}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setSelected(c)}
                    >
                      <MessageCircle className="h-3 w-3" /> Observações
                    </Button>
                    {me?.isAdmin && c.status === "aberto" && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => {
                            const r = prompt("Resposta (opcional):") ?? "";
                            updateStatus.mutate({ id: c.id, status: "aceito", resposta: r });
                          }}
                        >
                          <Check className="h-3 w-3" /> Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1"
                          onClick={() => {
                            const r = prompt("Motivo da recusa:") ?? "";
                            updateStatus.mutate({ id: c.id, status: "recusado", resposta: r });
                          }}
                        >
                          <X className="h-3 w-3" /> Recusar
                        </Button>
                      </>
                    )}
                    {me?.isAdmin && ["aceito", "em_analise"].includes(c.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus.mutate({ id: c.id, status: "concluido" })}
                      >
                        Concluir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {chamados.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhum chamado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Observações — {selected?.titulo}</DialogTitle>
          </DialogHeader>
          {selected && <Comentarios chamadoId={selected.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Comentarios({ chamadoId }: { chamadoId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["chamado-comentarios", chamadoId],
    queryFn: async () =>
      (
        await db
          .from("chamado_comentarios")
          .select("*")
          .eq("chamado_id", chamadoId)
          .order("criado_em")
      ).data ?? [],
  });
  const add = useMutation({
    mutationFn: async (msg: string) => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await db
        .from("chamado_comentarios")
        .insert({ chamado_id: chamadoId, autor_id: u.user.id, mensagem: msg });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chamado-comentarios", chamadoId] }),
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <div className="max-h-64 overflow-auto space-y-2">
        {data.map((c: any) => (
          <div key={c.id} className="rounded bg-muted p-2 text-sm">
            <p>{c.mensagem}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {new Date(c.criado_em).toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">Sem observações.</p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const msg = String(fd.get("msg") ?? "").trim();
          if (msg) {
            add.mutate(msg);
            e.currentTarget.reset();
          }
        }}
        className="flex gap-2"
      >
        <Input name="msg" placeholder="Escreva uma observação..." />
        <Button type="submit">Enviar</Button>
      </form>
    </div>
  );
}
