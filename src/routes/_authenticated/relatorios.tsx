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
    key: "pre_atendimento",
    title: "Pré-Atendimento (Esteira de Admissão)",
    desc: "Colaboradores em pré-atendimento com Admissão, Produto, Entrada, Saída, Operação e Credenciais",
  },
  {
    key: "pendencias",
    title: "Pendências (Fila Detalhada)",
    desc: "Todas as pendências com colaborador, operação, sistema, tipo, status, prioridade, responsável e datas",
  },
  {
    key: "pendencias_matriz",
    title: "Pendências (Matriz por Sistema)",
    desc: "Visão consolidada de pendências por Colaborador × Sistemas com operação e contatos",
  },
  {
    key: "colaboradores",
    title: "Colaboradores",
    desc: "Todos os colaboradores com operação, cargo, contatos, dados de e-mail e status cadastral",
  },
  {
    key: "matriz",
    title: "Matriz de Acessos (Ativos)",
    desc: "Colaboradores ativos × Sistemas com usuário, senha e operação vinculada",
  },
  {
    key: "inativos",
    title: "Usuários Inativos",
    desc: "Colaboradores inativados/desligados com data de inativação, operação e acessos",
  },
  {
    key: "acessos",
    title: "Acessos Concedidos",
    desc: "Matriz de acessos concedidos com usuário, sistema, cargo e operação",
  },
  {
    key: "sistemas",
    title: "Sistemas Cadastrados",
    desc: "Sistemas cadastrados com responsáveis, categoria e nível de criticidade",
  },
] as const;

const formatCPF = (val: string | null | undefined) => {
  if (!val) return "";
  const clean = val.replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return val;
};

const formatDateBR = (val: string | Date | null | undefined): string => {
  if (!val) return "";
  if (typeof val === "string") {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      return `${d}/${m}/${y}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      return val;
    }
  }
  const d = typeof val === "string" ? new Date(val) : val;
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

const formatDateTimeBR = (val: string | Date | null | undefined): string => {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  if (!d || isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const getPendenciaTipoLabel = (tipo: string | null | undefined, titulo?: string | null) => {
  const t = tipo ?? "";
  const tit = (titulo ?? "").toUpperCase();

  if (t === "solicitacao_acesso" || tit.includes("CRIAÇÃO") || tit.includes("CRIACAO")) {
    return "Criação de Acesso";
  }
  if (
    t === "exclusao_acesso" ||
    tit.includes("EXCLUSÃO") ||
    tit.includes("EXCLUSAO") ||
    tit.includes("INATIVAÇÃO") ||
    tit.includes("INATIVACAO")
  ) {
    return "Exclusão de Acesso";
  }
  if (
    t === "revisao" ||
    tit.includes("DESBLOQUEIO") ||
    tit.includes("REVISÃO") ||
    tit.includes("REVISAO")
  ) {
    return "Desbloqueio / Revisão";
  }
  if (t === "alteracao" || tit.includes("ALTERAÇÃO") || tit.includes("ALTERACAO")) {
    return "Alteração de Acesso";
  }
  if (t === "solicitacao_acesso") return "Criação de Acesso";
  if (t === "exclusao_acesso") return "Exclusão de Acesso";
  if (t === "revisao") return "Desbloqueio / Revisão";
  if (t === "alteracao") return "Alteração de Acesso";
  return tipo || "Geral";
};

const getPendenciaPrioridadeLabel = (prio: string | null | undefined) => {
  if (!prio) return "Média";
  const p = prio.toLowerCase();
  if (p === "baixa") return "Baixa";
  if (p === "media" || p === "média") return "Média";
  if (p === "alta") return "Alta";
  if (p === "critica" || p === "crítica") return "Crítica";
  return prio;
};

const getPendenciaStatusLabel = (status: string | null | undefined) => {
  if (!status) return "Pendente";
  const s = status.toLowerCase().trim();
  if (s === "pendente" || s === "backlog" || s === "aberto") return "Pendente";
  if (s === "em_andamento" || s === "em andamento" || s === "andamento") return "Em Andamento";
  if (s === "concluido" || s === "concluído" || s === "resolvido") return "Concluído";
  if (s === "redefinir_senha" || s === "redefinir senha") return "Redefinir Senha";
  if (s === "com_erro" || s === "com erro" || s === "erro") return "Com Erro";
  if (s === "cancelado") return "Cancelado";
  return status;
};

const getPendenciaGridLabel = (p: any) => {
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

  return statusNorm || "SOLICITADO";
};

async function fetchRel(k: string) {
  if (k === "colaboradores") {
    const { data: colabs = [] } = await db
      .from("colaboradores")
      .select(
        "nome,cpf,matricula,data_nascimento,email,email_senha,telefone,cargo,status,admissao_em,desligamento_em,inativado_em,operacao:operacoes(nome)",
      )
      .order("nome");

    return (colabs ?? []).map((c: any) => ({
      Nome: c.nome ? c.nome.toUpperCase() : "",
      CPF: formatCPF(c.cpf),
      Matrícula: c.matricula ?? "",
      "Data de Nascimento": formatDateBR(c.data_nascimento),
      Email: c.email ? c.email.toLowerCase() : "",
      "Senha E-mail": c.email_senha ?? "",
      Operação: c.operacao?.nome ?? "",
      Cargo: c.cargo ?? "",
      Status: c.status ? String(c.status).toUpperCase() : "ATIVO",
      Telefone: c.telefone ?? "",
      Admissão: formatDateBR(c.admissao_em),
      "Desligamento / Inativação": formatDateBR(c.desligamento_em || c.inativado_em),
    }));
  }

  if (k === "sistemas") {
    const { data: sistemas = [] } = await db
      .from("sistemas")
      .select(
        "nome,categoria,criticidade,ativo,url,instrucoes_acesso,responsavel:profiles(nome,email)",
      )
      .order("nome");

    return (sistemas ?? []).map((s: any) => ({
      Sistema: s.nome,
      Categoria: s.categoria ? s.categoria.toUpperCase() : "GERAL",
      Criticidade: s.criticidade ? s.criticidade.toUpperCase() : "MÉDIA",
      Status: s.ativo ? "ATIVO" : "INATIVO",
      Responsável: s.responsavel?.nome ?? (s.responsavel?.email || "-"),
      Link: s.url ?? "",
    }));
  }

  if (k === "acessos") {
    const { data: acessos = [] } = await db
      .from("acessos")
      .select(
        "status,login,concedido_em,colaborador:colaboradores(nome,cpf,cargo,status,operacao:operacoes(nome)),sistema:sistemas(nome)",
      )
      .order("concedido_em", { ascending: false });

    return (acessos ?? []).map((a: any) => ({
      Colaborador: a.colaborador?.nome ? a.colaborador.nome.toUpperCase() : "-",
      CPF: formatCPF(a.colaborador?.cpf),
      Operação: a.colaborador?.operacao?.nome ?? "",
      Cargo: a.colaborador?.cargo ?? "",
      "Status Colaborador": a.colaborador?.status ? String(a.colaborador.status).toUpperCase() : "",
      Sistema: a.sistema?.nome ?? "-",
      "Usuário / Login": a.login ?? "",
      "Status do Acesso": a.status ? String(a.status).toUpperCase() : "ATIVO",
      "Concedido em": formatDateTimeBR(a.concedido_em),
    }));
  }

  if (k === "pendencias") {
    const { data: pendenciasRaw = [] } = await db
      .from("pendencias")
      .select(
        "id,titulo,descricao,tipo,status,prioridade,solicitado,criado_em,data_inicio,sla_em,data_resolucao,concluido_em,arquivado,colaborador_id,sistema_id,responsavel_id",
      )
      .order("criado_em", { ascending: false });

    const { data: colabsAll = [] } = await db
      .from("colaboradores")
      .select(
        "id,nome,cpf,data_nascimento,email,email_senha,telefone,cargo,status,operacao:operacoes(nome)",
      );

    const { data: sistemasAll = [] } = await db.from("sistemas").select("id,nome");
    const { data: profilesAll = [] } = await db.from("profiles").select("id,nome,email");

    const colabById = new Map<string, any>();
    const colabByName = new Map<string, any>();
    for (const c of colabsAll ?? []) {
      colabById.set(c.id, c);
      if (c.nome) {
        colabByName.set(c.nome.trim().toLowerCase(), c);
      }
    }

    const sistemaById = new Map<string, any>();
    for (const s of sistemasAll ?? []) {
      sistemaById.set(s.id, s);
    }

    const profileById = new Map<string, any>();
    for (const p of profilesAll ?? []) {
      profileById.set(p.id, p);
    }

    return (pendenciasRaw ?? []).map((p: any) => {
      let colab = p.colaborador_id ? colabById.get(p.colaborador_id) : null;
      if (!colab && p.titulo) {
        colab = colabByName.get(p.titulo.trim().toLowerCase());
      }
      const sistema = p.sistema_id ? sistemaById.get(p.sistema_id) : null;
      const responsavel = p.responsavel_id ? profileById.get(p.responsavel_id) : null;

      return {
        "ID / Protocolo": p.id,
        Título: p.titulo ?? "",
        Tipo: getPendenciaTipoLabel(p.tipo, p.titulo),
        "Status da Pendência": getPendenciaStatusLabel(p.status),
        Prioridade: getPendenciaPrioridadeLabel(p.prioridade),
        Solicitado: p.solicitado ? "Sim" : "Não",
        Sistema: sistema?.nome ?? "-",
        Colaborador: colab?.nome ? colab.nome.toUpperCase() : p.titulo || "-",
        CPF: formatCPF(colab?.cpf),
        "Data de Nascimento": formatDateBR(colab?.data_nascimento),
        Email: colab?.email ? colab.email.toLowerCase() : "",
        "Senha E-mail": colab?.email_senha ?? "",
        Operação: colab?.operacao?.nome ?? "",
        Cargo: colab?.cargo ?? "",
        "Status do Colaborador": colab?.status ? String(colab.status).toUpperCase() : "",
        Telefone: colab?.telefone ?? "",
        Responsável: responsavel?.nome ?? (responsavel?.email || "-"),
        "Criado em": formatDateTimeBR(p.criado_em),
        SLA: formatDateBR(p.sla_em),
        "Data Início": formatDateBR(p.data_inicio),
        "Data Resolução": formatDateBR(p.data_resolucao || p.concluido_em),
        Arquivado: p.arquivado ? "Sim" : "Não",
        Descrição: p.descricao ?? "",
      };
    });
  }

  if (k === "pendencias_matriz") {
    const { data: activePendencias = [] } = await db
      .from("pendencias")
      .select("id, colaborador_id, sistema_id, status, tipo, titulo, criado_em")
      .eq("arquivado", false);

    const { data: rawSistemas = [] } = await db.from("sistemas").select("id, nome").order("nome");
    const sistemas = (rawSistemas ?? []).filter(
      (s: any) => s.nome.toLowerCase() !== "e-mail" && s.nome.toLowerCase() !== "email",
    );

    const { data: colabsAll = [] } = await db
      .from("colaboradores")
      .select(
        "id, nome, cpf, data_nascimento, email, email_senha, telefone, cargo, status, operacao:operacoes(nome)",
      );

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

    return colabs.map((c: any) => {
      const pListAll = colabPendencias.get(c.id) || [];
      const row: any = {
        Nome: c.nome ? c.nome.toUpperCase() : "",
        CPF: formatCPF(c.cpf),
        "Data de Nascimento": formatDateBR(c.data_nascimento),
        Email: c.email ? c.email.toLowerCase() : "",
        "Senha E-mail": c.email_senha ?? "",
        Operação: c.operacao?.nome ?? "",
        Cargo: c.cargo ?? "",
        Status: c.status ? String(c.status).toUpperCase() : "ATIVO",
        Telefone: c.telefone ?? "",
        "Total de Pendências": pListAll.length,
      };

      for (const s of sistemas) {
        const pList = pListAll.filter((p: any) => p.sistema_id === s.id);
        if (pList.length === 0) {
          row[s.nome] = "-";
        } else {
          const labels = pList.map(getPendenciaGridLabel);
          const uniqueLabels = Array.from(new Set(labels));
          row[s.nome] = uniqueLabels.join(", ");
        }
      }

      let latestDate: string | null = null;
      for (const p of pListAll) {
        if (p.criado_em) {
          if (!latestDate || new Date(p.criado_em) > new Date(latestDate)) {
            latestDate = p.criado_em;
          }
        }
      }
      row["Última Solicitação"] = latestDate ? formatDateTimeBR(latestDate) : "";

      return row;
    });
  }

  if (k === "matriz" || k === "inativos" || k === "pre_atendimento") {
    const { data: colabs = [] } = await db
      .from("colaboradores")
      .select(
        "id,nome,cpf,email,email_senha,telefone,cargo,status,inativado_em,data_nascimento,admissao_em,produto,horario_entrada,horario_saida,em_pre_atendimento,operacao:operacoes(nome)" as any,
      )
      .order("nome");
    const { data: acessos = [] } = await db
      .from("acessos")
      .select("login,senha,colaborador_id,sistema:sistemas(id,nome)");
    const { data: rawSistemas = [] } = await db.from("sistemas").select("id,nome").order("nome");
    const sistemas = (rawSistemas ?? []).filter(
      (s: any) => s.nome.toLowerCase() !== "e-mail" && s.nome.toLowerCase() !== "email",
    );

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
      const isPre = c.em_pre_atendimento === true && !isInactive;

      if (k === "inativos" && !isInactive) continue;
      if (k === "pre_atendimento" && !isPre) continue;
      if (k === "matriz" && (isInactive || isPre)) continue;

      const cAcs = accessMap.get(c.id) || {};
      const base: any = {
        Nome: c.nome ? c.nome.toUpperCase() : "",
        CPF: formatCPF(c.cpf),
      };

      if (k === "pre_atendimento") {
        base["Admissão"] = formatDateBR(c.admissao_em);
        base["Produto"] = c.produto ?? "";
        base["Entrada"] = c.horario_entrada ?? "";
        base["Saída"] = c.horario_saida ?? "";
      }

      base["Data de Nascimento"] = formatDateBR(c.data_nascimento);
      base["Email"] = c.email ? c.email.toLowerCase() : "";
      base["Senha e-mail"] = c.email_senha ?? "";
      base["Operação"] = c.operacao?.nome ?? "";
      base["Telefone"] = c.telefone ?? "";
      base["Cargo"] = c.cargo ?? "";
      base["Status"] = c.status ? String(c.status).toUpperCase() : "ATIVO";

      if (k === "inativos") {
        base["Data Inativação"] = formatDateBR(c.inativado_em);
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
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [41, 58, 82] },
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
        <p className="text-muted-foreground">Exporte dados completos em Excel, CSV ou PDF</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {RELATORIOS.map((r) => (
          <Card key={r.key} className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-lg">{r.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportar(r.key, "xlsx")}
                className="gap-1.5"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportar(r.key, "csv")}
                className="gap-1.5"
              >
                <FileDown className="h-4 w-4 text-blue-600" /> CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportar(r.key, "pdf")}
                className="gap-1.5"
              >
                <FileText className="h-4 w-4 text-rose-600" /> PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
