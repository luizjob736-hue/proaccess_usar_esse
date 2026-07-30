import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Copy, Grid3x3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/minha-matriz")({ component: MinhaMatriz });

function MinhaMatriz() {
  const [reveal, setReveal] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["minha-matriz"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return [];
      const email = u.user.email ?? "";
      const meta: any = u.user.user_metadata ?? {};
      const cpfMeta = String(meta.cpf ?? "").replace(/\D/g, "");
      const cpfFromEmail = email.includes("@operador.proaccess.local")
        ? email.split("@")[0].replace(/\D/g, "")
        : "";
      const cpf = cpfMeta || cpfFromEmail;
      if (!cpf) return [];
      const { data: cols } = await db.from("colaboradores").select("id, cpf");
      const col = (cols ?? []).find((c: any) => String(c.cpf ?? "").replace(/\D/g, "") === cpf);
      if (!col) return [];
      const { data } = await db
        .from("acessos")
        .select("id, login, senha, sistema:sistemas(nome)")
        .eq("colaborador_id", col.id);
      return data ?? [];
    },
  });

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
                <th className="p-3 text-left">Sistema</th>
                <th className="p-3 text-left">Usuário</th>
                <th className="p-3 text-left">Senha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r: any) => (
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
              {rows.length === 0 && (
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
