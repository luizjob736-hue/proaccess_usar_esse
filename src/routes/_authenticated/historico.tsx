import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/historico")({ component: Historico });

function Historico() {
  const [entidade, setEntidade] = useState("todas");
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["historico", entidade, q],
    queryFn: async () => {
      let query = db
        .from("historico")
        .select("*, ator:profiles!historico_ator_id_fkey(nome)")
        .order("criado_em", { ascending: false })
        .limit(200);
      if (entidade !== "todas") query = query.eq("entidade", entidade);
      const { data } = await query;
      let rows = data ?? [];
      if (q) rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
      return rows;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Histórico</h1>
        <p className="text-muted-foreground">Auditoria imutável de todas as ações</p>
      </div>
      <Card>
        <CardContent className="flex gap-3 pt-6">
          <Select value={entidade} onValueChange={setEntidade}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as entidades</SelectItem>
              <SelectItem value="colaboradores">Colaboradores</SelectItem>
              <SelectItem value="sistemas">Sistemas</SelectItem>
              <SelectItem value="acessos">Acessos</SelectItem>
              <SelectItem value="pendencias">Pendências</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Eventos ({data.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {data.map((h: any) => (
              <div key={h.id} className="flex items-center gap-3 p-3 text-sm">
                <Badge variant="outline">{h.acao}</Badge>
                <span className="font-mono text-xs">{h.entidade}</span>
                <span className="flex-1 truncate">{h.ator?.nome || "Sistema"}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.criado_em).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
