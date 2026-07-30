import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notificacoes")({ component: Notif });

function Notif() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notif-list"],
    queryFn: async () => {
      try {
        const res = await supabase
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
      await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries(),
  });
  const markAll = useMutation({
    mutationFn: async () => {
      await supabase.from("notificacoes").update({ lida: true }).eq("lida", false);
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">
            {data.filter((n: any) => !n.lida).length} não lidas
          </p>
        </div>
        <Button variant="outline" onClick={() => markAll.mutate()} className="gap-2">
          <Check className="h-4 w-4" /> Marcar todas
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Central
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 ${n.lida ? "opacity-60" : ""}`}
              >
                <Badge variant={n.tipo === "alerta" ? "destructive" : "outline"}>{n.tipo}</Badge>
                <div className="flex-1">
                  <p className="font-medium">{n.titulo}</p>
                  {n.corpo && <p className="text-sm text-muted-foreground">{n.corpo}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.criado_em).toLocaleString("pt-BR")}
                  </p>
                </div>
                {!n.lida && (
                  <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                    Marcar
                  </Button>
                )}
              </div>
            ))}
            {data.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Sem notificações.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
