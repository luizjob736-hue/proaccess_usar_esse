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
    const { data: activePendencias = [] } = await db
      .from("pendencias")
      .select("colaborador_id, sistema_id, status, tipo, titulo, criado_em")
      .eq("arquivado", false);

    const { data: sistemas = [] } = await db.from("sistemas").select("id, nome").order("nome");

    const { data: colabsAll = [] } = await db
      .from("colaboradores")
      .select("id, nome, cpf, data_nascimento, email");

    const colabById = new Map<string, any>();
    const colabByName = new Map<string, any>();
    for (const c of colabsAll ?? []) {
      colabById.set(c.id, c);
      if (c.nome) {
        colabByName.set(c.nome.trim().toLowerCase(), c);
      }
    }

    const colabPendencias = new Map<string, any[]>();
    for (const p of activePendencias ?? []) {
      let matchedColabId = p.colaborador_id;
      if (!matchedColabId && p.titulo) {
        const matchedColab = colabByName.get(p.titulo.trim().toLowerCase());
        if (matchedColab) {
          matchedColabId = matchedColab.id;
        }
      }

      if (matchedColabId) {
        if (!colabPendencias.has(matchedColabId)) {
          colabPendencias.set(matchedColabId, []);
        }
        colabPendencias.get(matchedColabId)!.push(p);
      }
    }

    const colabs = (colabsAll ?? []).filter((c: any) => colabPendencias.has(c.id));
    colabs.sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""));

    const formatCPF = (val: string | null | undefined) => {
      if (!val) return "";
      return val.replace(/\D/g, "");
    };

    const formatDateBR = (val: string | Date | null | undefined): string => {
      if (!val) return "";
      if (typeof val === "string") {
        const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const [, y, m, d] = match;
          return `${d}/${m}/${y}`;
        }
      }
      const d = typeof val === "string" ? new Date(val) : val;
      if (!d || isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    };

    const formatDateTimeBR = (val: string | Date | null | undefined): string => {
      if (!val) return "";
      const d = typeof val === "string" ? new Date(val) : val;
      if (!d || isNaN(d.getTime())) return "";
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const getPendenciaLabel = (p: any) => {
      const statusNorm = p.status ? p.status.toUpperCase().trim() : "";

      if (statusNorm === "COM ERRO" || statusNorm === "ERRO") {
        return "ERRO";
      }
      if (statusNorm === "REDEFINIR SENHA") {
        return "REDEFINIR SENHA";
      }

      const tipo = p.tipo ?? "";
      const titulo = (p.titulo ?? "").toUpperCase();

      if (
        tipo === "solicitacao_acesso" ||
        titulo.includes("CRIAÇÃO") ||
        titulo.includes("CRIACAO") ||
        titulo === "CRIAÇÃO"
      ) {
        return "CRIAÇÃO";
      }
      if (
        tipo === "exclusao_acesso" ||
        titulo.includes("EXCLUSÃO") ||
        titulo.includes("EXCLUSAO") ||
        titulo.includes("INATIVAÇÃO") ||
        titulo.includes("INATIVACAO")
      ) {
        return "EXCLUSÃO";
      }
      if (
        tipo === "revisao" ||
        titulo.includes("DESBLOQUEIO") ||
        titulo.includes("REVISÃO") ||
        titulo.includes("REVISAO")
      ) {
        return "DESBLOQUEIO";
      }
      if (tipo === "alteracao" || titulo.includes("ALTERAÇÃO") || titulo.includes("ALTERACAO")) {
        return "ALTERAÇÃO";
      }

      if (tipo === "solicitacao_acesso") return "CRIAÇÃO";
      if (tipo === "exclusao_acesso") return "EXCLUSÃO";
      if (tipo === "revisao") return "DESBLOQUEIO";
      if (tipo === "alteracao") return "ALTERAÇÃO";

      return statusNorm || "PENDENTE";
    };

    return colabs.map((c: any) => {
      const row: any = {
        Nome: c.nome ? c.nome.toUpperCase() : "",
        CPF: formatCPF(c.cpf),
        "Data de Nascimento": formatDateBR(c.data_nascimento),
        Email: c.email ? c.email.toLowerCase() : "",
      };

      for (const s of sistemas) {
        const pList = (colabPendencias.get(c.id) || []).filter((p: any) => p.sistema_id === s.id);
        if (pList.length === 0) {
          row[s.nome] = "-";
        } else {
          const labels = pList.map(getPendenciaLabel);
          const uniqueLabels = Array.from(new Set(labels));
          row[s.nome] = uniqueLabels.join(", ");
        }
      }

      const pListAll = colabPendencias.get(c.id) || [];
      let latestDate: string | null = null;
      for (const p of pListAll) {
        if (p.criado_em) {
          if (!latestDate || new Date(p.criado_em) > new Date(latestDate)) {
            latestDate = p.criado_em;
          }
        }
      }
      row["Data"] = latestDate ? formatDateTimeBR(latestDate) : "";

      return row;
    });
  }
  if (k === "matriz" || k === "inativos") {
    const { data: colabs = [] } = await db
      .from("colaboradores")
      .select(
        "id,nome,cpf,email,email_senha,telefone,cargo,status,inativado_em,data_nascimento" as any,
      );
    const { data: acessos = [] } = await db
      .from("acessos")
      .select("login,senha,colaborador_id,sistema:sistemas(id,nome)");
    const { data: sistemas = [] } = await db.from("sistemas").select("id,nome").order("nome");

    const formatDate = (val: any) => {
      if (!val) return "";
      const dateObj = typeof val === "string" ? new Date(val) : val;
      if (!dateObj || isNaN(dateObj.getTime())) return "";
      return dateObj.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    };

    const accessMap = new Map<string, Record<string, { login: string; senha: string }>>();
    for (const a of (acessos || []) as any[]) {
      if (a.colaborador_id && a.sistema) {
        if (!accessMap.has(a.colaborador_id)) {
          accessMap.set(a.colaborador_id, {});
        }
        accessMap.get(a.colaborador_id)![a.sistema.id] = {
          login: a.login ?? "",
          senha: a.senha ?? "",
        };
      }
    }

    const rows: any[] = [];
    for (const c of colabs as any[]) {
      const isInactive = ["inativo", "desligado"].includes(c.status);
      if (k === "inativos" && !isInactive) continue;
      if (k === "matriz" && isInactive) continue;

      const cAcs = accessMap.get(c.id) || {};
      const base: any = {
        Nome: c.nome,
        CPF: c.cpf ?? "",
        "Data de Nascimento": formatDate(c.data_nascimento),
        Email: c.email ?? "",
        "Senha e-mail": c.email_senha ?? "",
        Telefone: c.telefone ?? "",
        Cargo: c.cargo ?? "",
        Status: c.status,
      };

      if (k === "inativos") {
        base["Data Inativação"] = formatDate(c.inativado_em);
      }

      for (const s of sistemas as any[]) {
        base[`${s.nome} - Usuário`] = cAcs[s.id]?.login ?? "";
        base[`${s.nome} - Senha`] = cAcs[s.id]?.senha ?? "";
      }

      rows.push(base);
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
    const loadingToast = toast.loading("Preparando dados para exportação...");
    try {
      const rawData = await fetchRel(k);
      const rows = flatten(rawData);
      if (rows.length === 0) {
        toast.dismiss(loadingToast);
        return toast.warning("Sem dados para exportar");
      }
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
      toast.dismiss(loadingToast);
      toast.success("Exportado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao exportar relatório:", error);
      toast.dismiss(loadingToast);
      toast.error(`Falha ao exportar: ${error?.message || error}`);
    }
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
