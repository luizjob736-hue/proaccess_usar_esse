import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/relatorios")({ component: Relatorios });

const RELATORIOS = [
  {
    key: "colaboradores",
    title: "Colaboradores",
    desc: "Todos os colaboradores com operação e status",
  },
  { key: "sistemas", title: "Sistemas", desc: "Sistemas com responsáveis e criticidade" },
  { key: "acessos", title: "Acessos ativos", desc: "Matriz de acessos concedidos" },
  { key: "pendencias", title: "Pendências", desc: "Fila completa de pendências" },
  {
    key: "matriz",
    title: "Matriz de Acessos (completa)",
    desc: "Colaboradores × Sistemas com usuário e senha",
  },
  {
    key: "inativos",
    title: "Usuários Inativos",
    desc: "Colaboradores inativados com data e acessos",
  },
] as const;

async function fetchRel(k: string) {
  if (k === "colaboradores")
    return (
      (
        await db
          .from("colaboradores")
          .select(
            "nome,cpf,matricula,email,cargo,status,admissao_em,desligamento_em,operacao:operacoes(nome)",
          )
      ).data ?? []
    );
  if (k === "sistemas")
    return (
      (
        await db
          .from("sistemas")
          .select("nome,categoria,criticidade,ativo,responsavel:profiles(nome)")
      ).data ?? []
    );
  if (k === "acessos")
    return (
      (
        await db
          .from("acessos")
          .select(
            "status,login,concedido_em,colaborador:colaboradores(nome),sistema:sistemas(nome)",
          )
      ).data ?? []
    );
  if (k === "pendencias") {
    const { data: raw = [] } = await db
      .from("pendencias")
      .select(
        "titulo,descricao,tipo,status,prioridade,criado_em,data_inicio,sla_em,concluido_em,colaborador:colaboradores(nome,operacao:operacoes(nome)),sistema:sistemas(nome)",
      );
    return (raw as any[]).map((p) => ({
      Título: p.titulo ?? "",
      Descrição: p.descricao ?? "",
      Tipo: p.tipo ?? "",
      Status: p.status ?? "",
      Prioridade: p.prioridade ?? "",
      "Produto / Sistema": p.sistema?.nome ?? "—",
      Colaborador: p.colaborador?.nome ?? "—",
      Operação: p.colaborador?.operacao?.nome ?? "—",
      "Data Início": p.data_inicio
        ? new Date(p.data_inicio).toLocaleDateString("pt-BR")
        : p.criado_em
          ? new Date(p.criado_em).toLocaleDateString("pt-BR")
          : "",
      "SLA (Data Limite)": p.sla_em ? new Date(p.sla_em).toLocaleString("pt-BR") : "",
      "Concluído em": p.concluido_em
        ? new Date(p.concluido_em).toLocaleString("pt-BR")
        : "Em aberto",
    }));
  }
  if (k === "matriz" || k === "inativos") {
    const { data: colabs = [] } = await db
      .from("colaboradores")
      .select("id,nome,cpf,email,email_senha,telefone,cargo,status,inativado_em" as any);
    const { data: acessos = [] } = await db
      .from("acessos")
      .select("login,senha,colaborador_id,sistema:sistemas(nome)");
    const rows: any[] = [];
    for (const c of colabs as any[]) {
      if (k === "inativos" && !["inativo", "desligado"].includes(c.status)) continue;
      const acs = (acessos as any[]).filter((a) => a.colaborador_id === c.id);
      if (acs.length === 0) {
        const base: any = {
          Nome: c.nome,
          CPF: c.cpf ?? "",
          Email: c.email ?? "",
          "Senha e-mail": c.email_senha ?? "",
          Telefone: c.telefone ?? "",
          Cargo: c.cargo ?? "",
          Status: c.status,
          Sistema: "",
          Usuario: "",
          Senha: "",
        };
        if (k === "inativos")
          base["Inativado em"] = c.inativado_em
            ? new Date(c.inativado_em).toLocaleString("pt-BR")
            : "";
        rows.push(base);
      } else
        for (const a of acs) {
          const base: any = {
            Nome: c.nome,
            CPF: c.cpf ?? "",
            Email: c.email ?? "",
            "Senha e-mail": c.email_senha ?? "",
            Telefone: c.telefone ?? "",
            Cargo: c.cargo ?? "",
            Status: c.status,
            Sistema: a.sistema?.nome ?? "",
            Usuario: a.login ?? "",
            Senha: a.senha ?? "",
          };
          if (k === "inativos")
            base["Inativado em"] = c.inativado_em
              ? new Date(c.inativado_em).toLocaleString("pt-BR")
              : "";
          rows.push(base);
        }
    }
    return rows;
  }
  return [];
}
function flatten(rows: any[]) {
  return rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        v && typeof v === "object" && "nome" in (v as any) ? (v as any).nome : v,
      ]),
    ),
  );
}

function Relatorios() {
  async function exportar(k: string, fmt: "xlsx" | "csv" | "pdf") {
    const rows = flatten(await fetchRel(k));
    if (rows.length === 0) return toast.warning("Sem dados para exportar");
    if (fmt === "xlsx" || fmt === "csv") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, k);
      XLSX.writeFile(wb, `${k}.${fmt}`);
    } else {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.text(`Relatório: ${k}`, 14, 14);
      autoTable(doc, {
        head: [Object.keys(rows[0])],
        body: rows.map((r) => Object.values(r).map((v) => String(v ?? ""))),
        startY: 20,
        styles: { fontSize: 8 },
      });
      doc.save(`${k}.pdf`);
    }
    toast.success("Exportado");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Exporte dados em Excel, CSV ou PDF</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {RELATORIOS.map((r) => (
          <Card key={r.key}>
            <CardHeader>
              <CardTitle>{r.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportar(r.key, "xlsx")}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportar(r.key, "csv")}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" /> CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportar(r.key, "pdf")}
                className="gap-2"
              >
                <FileText className="h-4 w-4" /> PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
