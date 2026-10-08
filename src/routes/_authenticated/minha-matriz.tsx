import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Copy, Grid3x3 } from "lucide-react";
import { toast } from "sonner";
import { TableSortHeader, SortOrder, sortData } from "@/components/ui/table-sort-header";

export const Route = createFileRoute("/_authenticated/minha-matriz")({ component: MinhaMatriz });

function MinhaMatriz() {
  const [reveal, setReveal] = useState(false);
  const [sortField, setSortField] = useState<string>("sistema.nome");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const { data: rows = [] } = useQuery({
    queryKey: ["minha-matriz"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return [];
      const email = (u.user.email ?? "").trim().toLowerCase();
      const meta: any = u.user.user_metadata ?? {};
      const cpfMeta = String(meta.cpf ?? "").replace(/\D/g, "");
      const cpfFromEmail = email.includes("@operador.proaccess.local")
        ? email.split("@")[0].replace(/\D/g, "")
        : "";
      const cpf = cpfMeta || cpfFromEmail;

      const { data: cols } = await db.from("colaboradores").select("id, cpf, email");
      const col = (cols ?? []).find((c: any) => {
        const matchesEmail = c.email && email && c.email.trim().toLowerCase() === email;
        const matchesCpf = cpf && c.cpf && String(c.cpf).replace(/\D/g, "") === cpf;
        return matchesEmail || matchesCpf;
      });

      if (!col) return [];
      const { data } = await db
        .from("acessos")
        .select("id, login, senha, sistema:sistemas(nome)")
        .eq("colaborador_id", col.id);
      return data ?? [];
    },
  });

  const sortedRows = useMemo(() => {
    return sortData(rows, sortField, sortOrder);
  }, [rows, sortField, sortOrder]);

  const total = useMemo(() => rows.length, [rows]);

  function copy(v: string | null, label: string) {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Minha Matriz de Acessos</h1>
          <p className="text-muted-foreground">Seus usuários e senhas — clique para copiar</p>
        </div>
        <Button variant="outline" onClick={() => setReveal((r) => !r)} className="gap-2">
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {reveal ? "Ocultar" : "Mostrar"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4" /> Meus acessos{" "}
            <Badge variant="outline" className="ml-2">
              {total}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">
                  <TableSortHeader
                    label="Sistema"
                    field="sistema.nome"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="p-3 text-left">
                  <TableSortHeader
                    label="Usuário"
                    field="login"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="p-3 text-left">
                  <TableSortHeader
                    label="Senha"
                    field="senha"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedRows.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{r.sistema?.nome ?? "—"}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{r.login ?? "—"}</span>
                      {r.login && (
                        <Button size="sm" variant="ghost" onClick={() => copy(r.login, "Usuário")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {r.senha ? (reveal ? r.senha : "••••••••") : "—"}
                      </span>
                      {r.senha && (
                        <Button size="sm" variant="ghost" onClick={() => copy(r.senha, "Senha")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    Nenhum acesso vinculado ainda.
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
