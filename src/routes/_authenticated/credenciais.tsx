import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Search, Copy, Table2, FileDown } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/credenciais")({ component: Credenciais });

function Credenciais() {
  const [q, setQ] = useState("");
  const [reveal, setReveal] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["credenciais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acessos")
        .select(
          "id, login, senha, sistema:sistemas(nome), colaborador:colaboradores(nome, cpf, email, email_senha, telefone)",
        )
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r: any) =>
      [
        r.colaborador?.nome,
        r.colaborador?.cpf,
        r.colaborador?.email,
        r.colaborador?.telefone,
        r.sistema?.nome,
        r.login,
      ].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(t),
      ),
    );
  }, [rows, q]);

  function copy(value: string | null | undefined, label: string) {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  }

  function exportar() {
    const data = filtered.map((r: any) => ({
      Sistema: r.sistema?.nome ?? "",
      Nome: r.colaborador?.nome ?? "",
      CPF: r.colaborador?.cpf ?? "",
      Telefone: r.colaborador?.telefone ?? "",
      Email: r.colaborador?.email ?? "",
      "Senha do Email": r.colaborador?.email_senha ?? "",
      Login: r.login ?? "",
      Senha: r.senha ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Credenciais");
    XLSX.writeFile(wb, "credenciais.xlsx");
    toast.success("Exportado");
  }

  const Cell = ({ value, label }: { value: string | null; label: string }) => (
    <div className="flex items-center gap-1 group">
      <span className="font-mono text-xs truncate max-w-[160px]">
        {value ? (reveal ? value : "••••••••") : "—"}
      </span>
      {value && (
        <button
          onClick={() => copy(value, label)}
          className="opacity-0 group-hover:opacity-100 transition"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credenciais</h1>
          <p className="text-muted-foreground">Todas as credenciais dos acessos concedidos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReveal((r) => !r)} className="gap-2">
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {reveal ? "Ocultar senhas" : "Mostrar senhas"}
          </Button>
          <Button variant="outline" onClick={exportar} className="gap-2">
            <FileDown className="h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, CPF, e-mail, sistema ou login..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Table2 className="h-4 w-4" /> Tabela de credenciais
            <Badge variant="outline" className="ml-2">
              {filtered.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Sistema</th>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">CPF</th>
                <th className="p-3 text-left">Telefone</th>
                <th className="p-3 text-left">E-mail</th>
                <th className="p-3 text-left">Senha do E-mail</th>
                <th className="p-3 text-left">Login</th>
                <th className="p-3 text-left">Senha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{r.sistema?.nome ?? "—"}</td>
                  <td className="p-3">{r.colaborador?.nome ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{r.colaborador?.cpf ?? "—"}</td>
                  <td className="p-3 text-xs">{r.colaborador?.telefone ?? "—"}</td>
                  <td className="p-3 text-xs">{r.colaborador?.email ?? "—"}</td>
                  <td className="p-3">
                    <Cell value={r.colaborador?.email_senha ?? null} label="Senha do e-mail" />
                  </td>
                  <td className="p-3 font-mono text-xs">{r.login ?? "—"}</td>
                  <td className="p-3">
                    <Cell value={r.senha ?? null} label="Senha" />
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    Nenhuma credencial encontrada.
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
