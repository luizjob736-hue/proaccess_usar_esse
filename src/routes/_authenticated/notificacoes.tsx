import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/notificacoes")({ component: Notif });

function Notif() {
  const qc = useQueryClient();
  const [openClearDialog, setOpenClearDialog] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["notif-list"],
    queryFn: async () => {
      try {
        const res = await db
          .from("notificacoes")
          .select("*")
          .order("criado_em", { ascending: false });
        return res?.data ?? [];
      } catch (_err) {
        return [];
      }
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await db.from("notificacoes").update({ lida: true }).eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-list"] });
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
  });

  const deleteSingle = useMutation({
    mutationFn: async (id: string) => {
      await db.from("notificacoes").delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Notificação removida!");
      qc.invalidateQueries({ queryKey: ["notif-list"] });
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      await db.from("notificacoes").update({ lida: true }).eq("lida", false);
    },
    onSuccess: () => {
      toast.success("Todas as notificações marcadas como lidas!");
      qc.invalidateQueries({ queryKey: ["notif-list"] });
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      await db.from("notificacoes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    },
    onSuccess: () => {
      toast.success("Todas as notificações foram limpas com sucesso!");
      setOpenClearDialog(false);
      qc.invalidateQueries({ queryKey: ["notif-list"] });
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao limpar notificações: " + (err?.message || ""));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">
            {data.filter((n: any) => !n.lida).length} não lidas (Total: {data.length})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="gap-2 text-xs"
              >
                <Check className="h-3.5 w-3.5" /> Marcar todas como lidas
              </Button>

              <AlertDialog open={openClearDialog} onOpenChange={setOpenClearDialog}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Limpar Notificações
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar todas as notificações?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso removerá permanentemente todas as {data.length} notificações do sistema.
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        clearAll.mutate();
                      }}
                      disabled={clearAll.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {clearAll.isPending ? "Limpando..." : "Sim, Limpar Tudo"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Central de Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 transition-colors ${n.lida ? "opacity-60 bg-muted/20" : "bg-card"}`}
              >
                <Badge variant={n.tipo === "alerta" ? "destructive" : "outline"}>{n.tipo}</Badge>
                <div className="flex-1">
                  <p className="font-medium">{n.titulo}</p>
                  {n.corpo && <p className="text-sm text-muted-foreground">{n.corpo}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.criado_em).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {n.link && (
                    <Link
                      to={n.link.includes("?") ? (n.link.split("?")[0] as any) : (n.link as any)}
                      search={n.link.includes("id=") ? { id: n.link.split("id=")[1] } : undefined}
                      onClick={() => {
                        if (!n.lida) markRead.mutate(n.id);
                      }}
                    >
                      <Button size="sm" variant="outline" className="gap-1 h-8 text-xs font-medium">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ir para solicitação
                      </Button>
                    </Link>
                  )}
                  {!n.lida && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markRead.mutate(n.id)}
                      className="h-8 text-xs"
                    >
                      Marcar como lida
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteSingle.mutate(n.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="Excluir notificação"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {data.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm font-medium">Nenhuma notificação encontrada.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  A central de notificações está totalmente limpa.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
