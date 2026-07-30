import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lixeira")({ component: Lixeira });

function Lixeira() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["lix"],
    queryFn: async () =>
      (await db.from("lixeira").select("*").order("excluido_em", { ascending: false })).data ?? [],
  });
  const purge = useMutation({
    mutationFn: async (id: string) => {
      await db.from("lixeira").delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Removido definitivamente");
      qc.invalidateQueries({ queryKey: ["lix"] });
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lixeira</h1>
        <p className="text-muted-foreground">Registros excluídos (soft-delete)</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Itens ({data.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="font-medium">{l.entidade}</p>
                  <p className="text-xs text-muted-foreground">
                    Excluído em {new Date(l.excluido_em).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Restaurar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => purge.mutate(l.id)}>
                  Excluir
                </Button>
              </div>
            ))}
            {data.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Lixeira vazia.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
