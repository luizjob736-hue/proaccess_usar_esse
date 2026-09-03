import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { FileDown, Search, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pendencias-historico")({
  component: PendenciasHistorico,
});

function PendenciasHistorico() {
  const [busca, setBusca] = useState("");

  const { data: isAdmin = false, isLoading: isLoadingRole } = useQuery({
    queryKey: ["is_admin_historico"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return false;
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
      return (roles ?? []).some((r) => r.role === "admin" || r.role === "admin_master");
    },
  });

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["pendencias_historico"],
    enabled: isAdmin,
    queryFn: async () =>
      (
        await db
          .from("pendencias")
          .select(
            "*, colaborador:colaboradores(nome, cpf, operacao:operacoes(nome)), sistema:sistemas(nome)",
          )
          .eq("arquivado", true)
          .order("concluido_em", { ascending: false })
      ).data ?? [],
  });

  const filtered = useMemo(() => {
    if (!busca) return historico;
    const lower = busca.toLowerCase();
    return historico.filter(
      (p: any) =>
        p.titulo?.toLowerCase().includes(lower) ||
        p.descricao?.toLowerCase().includes(lower) ||
        p.colaborador?.nome?.toLowerCase().includes(lower) ||
        p.colaborador?.cpf?.includes(lower) ||
        p.sistema?.nome?.toLowerCase().includes(lower) ||
        p.colaborador?.operacao?.nome?.toLowerCase().includes(lower),
    );
  }, [historico, busca]);

  const handleExport = (fmt: "xlsx" | "csv") => {
    if (filtered.length === 0) {
      toast.warning("Nenhum histórico encontrado para exportar.");
      return;
    }

    const rows = filtered.map((p: any) => ({
      ID: p.id,
      Título: p.titulo || "",
      Tipo: p.tipo || "Geral",
      Prioridade: p.prioridade ? String(p.prioridade).toUpperCase() : "MÉDIA",
      "Status de Finalização": p.status || "CONCLUIDO",
      Colaborador: p.colaborador?.nome ? p.colaborador.nome.toUpperCase() : p.titulo || "-",
      CPF: p.colaborador?.cpf || "",
      Operação: p.colaborador?.operacao?.nome || "-",
      Sistema: p.sistema?.nome || "-",
      "Criado Em": p.criado_em ? format(new Date(p.criado_em), "dd/MM/yyyy HH:mm") : "",
      "Finalizado Em": p.concluido_em ? format(new Date(p.concluido_em), "dd/MM/yyyy HH:mm") : "",
      Descrição: p.descricao || "",
    }));

    const filename = `historico_pendencias_${format(new Date(), "yyyy-MM-dd")}`;

    if (fmt === "csv") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const csvOutput = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\uFEFF" + csvOutput], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Histórico");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    toast.success(`${rows.length} registro(s) exportado(s) com sucesso!`);
  };

  if (isLoadingRole)
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold">Acesso Negado</h2>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Histórico de Pendências</h1>
          <p className="text-muted-foreground">
            Registro de todas as pendências finalizadas ou arquivadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => handleExport("xlsx")}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Exportar Excel (.xlsx)
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => handleExport("csv")}>
            <FileDown className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar histórico..."
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b transition-colors hover:bg-muted/50 text-left">
                <th className="h-10 px-4 font-medium">Título</th>
                <th className="h-10 px-4 font-medium">Colaborador</th>
                <th className="h-10 px-4 font-medium">Sistema</th>
                <th className="h-10 px-4 font-medium">Status / Tipo</th>
                <th className="h-10 px-4 font-medium text-right">Criado em</th>
                <th className="h-10 px-4 font-medium text-right">Finalizado em</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((p: any) => (
                  <tr key={p.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="p-4 font-medium">{p.titulo}</td>
                    <td className="p-4">{p.colaborador?.nome || "—"}</td>
                    <td className="p-4">{p.sistema?.nome || "—"}</td>
                    <td className="p-4">
                      <div className="flex gap-1 flex-wrap">
                        <Badge variant="outline">{p.status}</Badge>
                        <Badge variant="secondary">{p.tipo}</Badge>
                      </div>
                    </td>
                    <td className="p-4 text-right tabular-nums whitespace-nowrap">
                      {p.criado_em
                        ? format(new Date(p.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—"}
                    </td>
                    <td className="p-4 text-right tabular-nums whitespace-nowrap">
                      {p.concluido_em
                        ? format(new Date(p.concluido_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
