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
    key: "usuarios_a_solicitar_matriz",
    title: "Usuários a Solicitar (Matriz por Sistema)",
    desc: "Visão consolidada em matriz (Colaborador × Sistemas) contendo apenas os usuários com acessos pendentes de solicitação",
  },
  {
    key: "usuarios_a_solicitar",
    title: "Usuários a Solicitar (Fila Detalhada)",
    desc: "Lista detalhada de solicitações a solicitar / agendadas com colaborador, sistema, datas, status e prioridade",
  },
  {
    key: "pre_atendimento",
    title: "Pré-Atendimento (Esteira de Admissão)",
    desc: "Colaboradores em pré-atendimento com Admissão, Produto, Entrada, Saída, Operação e Credenciais",
  },
  {
    key: "pendencias",
    title: "Pendências Abertas (Fila Detalhada)",
    desc: "Apenas pendências ativas e não tratadas com colaborador, operação, sistema, tipo, status e SLA",
  },
  {
    key: "pendencias_matriz",
    title: "Pendências Abertas (Matriz por Sistema)",
    desc: "Visão consolidada de pendências em aberto por Colaborador × Sistemas ativos",
  },
  {
    key: "pendencias_historico",
    title: "Histórico Completo de Pendências (Geral)",
    desc: "Histórico integral de pendências (incluindo tratadas, concluídas e arquivadas) com datas de resolução",
  },
  {
    key: "colaboradores",
    title: "Colaboradores (Cadastro Completo)",
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

const toYMDString = (val: any): string => {
  if (!val) return "";
  if (typeof val === "string") return val.split("T")[0];
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().split("T")[0];
  try {
    const str = String(val);
    if (str.includes("T")) return str.split("T")[0];
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {
    // ignore
  }
  return "";
};

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
  // Substituir o status pelo título da solicitação
  const titulo = p.titulo ? String(p.titulo).trim() : "";
  if (titulo) {
    return titulo.toUpperCase();
  }

  const tipo = p.tipo ?? "";
  if (tipo === "solicitacao_acesso") return "CRIAÇÃO";
  if (tipo === "exclusao_acesso") return "EXCLUSÃO";
  if (tipo === "revisao") return "DESBLOQUEIO";
  if (tipo === "alteracao") return "ALTERAÇÃO";

  const statusNorm = p.status ? String(p.status).toUpperCase().trim() : "";
  if (statusNorm === "COM ERRO" || statusNorm === "ERRO") {
    return "ERRO";
  }
  if (statusNorm === "REDEFINIR SENHA") {
    return "REDEFINIR SENHA";
  }

  return statusNorm || "SOLICITADO";
};

export async function fetchRel(k: string) {
  if (k === "usuarios_a_solicitar_matriz") {
    const { data: activePendencias = [] } = await db
      .from("pendencias")
      .select(
        "id, colaborador_id, sistema_id, status, tipo, titulo, criado_em, concluido_em, data_resolucao, arquivado, solicitado, data_inicio, sla_em, descricao, prioridade, operacao_id",
      )
      .eq("arquivado", false)
      .eq("solicitado", false)
      .is("concluido_em", null);

    const { data: rawSistemas = [] } = await db.from("sistemas").select("id, nome").order("nome");
    const sistemas = (rawSistemas ?? []).filter(
      (s: any) => s.nome.toLowerCase() !== "e-mail" && s.nome.toLowerCase() !== "email",
    );

    const { data: colabsAll = [] } = await db
      .from("colaboradores")
      .select(
        "id, nome, cpf, data_nascimento, email, email_senha, telefone, cargo, status, operacao:operacoes(nome)",
      )
      .not("status", "in", '("inativo","desligado")');

    const colabById = new Map<string, any>();
    const colabByName = new Map<string, any>();
    const colabByCPF = new Map<string, any>();
    for (const c of colabsAll ?? []) {
      colabById.set(c.id, c);
      if (c.nome) {
        colabByName.set(c.nome.trim().toLowerCase(), c);
      }
      if (c.cpf) {
        colabByCPF.set(c.cpf.replace(/\D/g, ""), c);
      }
    }

    const todayStr = new Date().toISOString().split("T")[0];

    const colabPendencias = new Map<string, any[]>();
    for (const p of activePendencias ?? []) {
      const stNorm = String(p.status ?? "")
        .toLowerCase()
        .trim();
      if (["concluido", "concluído", "resolvido", "cancelado"].includes(stNorm)) {
        continue;
      }

      let matchedColabId = p.colaborador_id;
      if (!matchedColabId && p.titulo) {
        const matchedColab = colabByName.get(p.titulo.trim().toLowerCase());
        if (matchedColab) {
          matchedColabId = matchedColab.id;
        }
      }
      if (!matchedColabId && p.descricao) {
        const digits = p.descricao.replace(/\D/g, "");
        if (digits.length === 11 && colabByCPF.has(digits)) {
          matchedColabId = colabByCPF.get(digits).id;
        }
      }

      if (!matchedColabId || !colabById.has(matchedColabId)) {
        continue;
      }

      if (!colabPendencias.has(matchedColabId)) {
        colabPendencias.set(matchedColabId, []);
      }
      colabPendencias.get(matchedColabId)!.push(p);
    }

    // Include ONLY collaborators who have users/accesses pending request (solicitado === false)
    const colabs = (colabsAll ?? []).filter(
      (c: any) => colabPendencias.has(c.id) && colabPendencias.get(c.id)!.length > 0,
    );

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
        "Total a Solicitar": pListAll.length,
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

      let earliestDate: string | null = null;
      for (const p of pListAll) {
        if (p.data_inicio) {
          const dStr = toYMDString(p.data_inicio);
          if (dStr) {
            if (!earliestDate || dStr < earliestDate) {
              earliestDate = dStr;
            }
          }
        }
      }

      let situacaoPrazo = "Sem data definida";
      if (earliestDate) {
        if (earliestDate < todayStr) {
          situacaoPrazo = "Pendente / Em Atraso";
        } else if (earliestDate === todayStr) {
          situacaoPrazo = "Solicitar Hoje";
        } else {
          situacaoPrazo = "Agendado Futuro";
        }
      }

      row["Data Programada"] = earliestDate ? formatDateBR(earliestDate) : "-";
      row["Situação do Agendamento"] = situacaoPrazo;

      return row;
    });
  }

  if (k === "usuarios_a_solicitar") {
    const { data: pendenciasRaw = [] } = await db
      .from("pendencias")
      .select(
        "id,titulo,descricao,tipo,status,prioridade,solicitado,criado_em,data_inicio,sla_em,data_resolucao,concluido_em,arquivado,colaborador_id,sistema_id,responsavel_id,operacao_id",
      )
      .eq("arquivado", false)
      .eq("solicitado", false)
      .is("concluido_em", null)
      .order("data_inicio", { ascending: true });

    const { data: colabsAll = [] } = await db
      .from("colaboradores")
      .select(
        "id,nome,cpf,data_nascimento,email,email_senha,telefone,cargo,status,operacao:operacoes(nome)",
      );

    const { data: operacoesAll = [] } = await db.from("operacoes").select("id,nome");
    const { data: sistemasAll = [] } = await db.from("sistemas").select("id,nome");
    const { data: profilesAll = [] } = await db.from("profiles").select("id,nome,email");

    const operacaoById = new Map<string, any>();
    for (const op of operacoesAll ?? []) {
      operacaoById.set(op.id, op);
    }

    const colabById = new Map<string, any>();
    const colabByName = new Map<string, any>();
    const colabByCPF = new Map<string, any>();
    for (const c of colabsAll ?? []) {
      colabById.set(c.id, c);
      if (c.nome) {
        colabByName.set(c.nome.trim().toLowerCase(), c);
      }
      if (c.cpf) {
        colabByCPF.set(c.cpf.replace(/\D/g, ""), c);
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

    const todayStr = new Date().toISOString().split("T")[0];
    const rows: any[] = [];

    for (const p of pendenciasRaw ?? []) {
      const stNorm = String(p.status ?? "")
        .toLowerCase()
        .trim();
      if (["concluido", "concluído", "resolvido", "cancelado"].includes(stNorm)) {
        continue;
      }

      let colab = p.colaborador_id ? colabById.get(p.colaborador_id) : null;
      if (!colab && p.titulo) {
        colab = colabByName.get(p.titulo.trim().toLowerCase());
      }
      if (!colab && p.descricao) {
        const digits = p.descricao.replace(/\D/g, "");
        if (digits.length === 11 && colabByCPF.has(digits)) {
          colab = colabByCPF.get(digits);
        }
      }

      if (colab && ["inativo", "desligado"].includes(colab.status)) {
        continue;
      }

      const sistema = p.sistema_id ? sistemaById.get(p.sistema_id) : null;
      const responsavel = p.responsavel_id ? profileById.get(p.responsavel_id) : null;
      const opName =
        (p.operacao_id ? operacaoById.get(p.operacao_id)?.nome : null) ||
        colab?.operacao?.nome ||
        "-";

      const dInicioStr = toYMDString(p.data_inicio);
      let situacaoPrazo = "Sem data";
      if (dInicioStr) {
        if (dInicioStr < todayStr) situacaoPrazo = "Pendente / Em Atraso";
        else if (dInicioStr === todayStr) situacaoPrazo = "Solicitar Hoje";
        else situacaoPrazo = "Agendado Futuro";
      }

      rows.push({
        "ID / Protocolo": p.id,
        Título: p.titulo ?? "",
        Tipo: getPendenciaTipoLabel(p.tipo, p.titulo),
        "Status / Quadro": getPendenciaStatusLabel(p.status),
        "Situação do Agendamento": situacaoPrazo,
        "Data Programada": formatDateBR(p.data_inicio),
        Prioridade: getPendenciaPrioridadeLabel(p.prioridade),
        Sistema: sistema?.nome ?? "-",
        Colaborador: colab?.nome ? colab.nome.toUpperCase() : p.titulo || "-",
        CPF: formatCPF(colab?.cpf),
        "Data de Nascimento": formatDateBR(colab?.data_nascimento),
        Email: colab?.email ? colab.email.toLowerCase() : "",
        "Senha E-mail": colab?.email_senha ?? "",
        Operação: opName,
        Cargo: colab?.cargo ?? "",
        "Status do Colaborador": colab?.status ? String(colab.status).toUpperCase() : "ATIVO",
        Telefone: colab?.telefone ?? "",
        Responsável: responsavel?.nome ?? (responsavel?.email || "-"),
        "Criado em": formatDateTimeBR(p.criado_em),
        SLA: formatDateBR(p.sla_em),
        Descrição: p.descricao ?? "",
      });
    }

    return rows;
  }

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
        "id,titulo,descricao,tipo,status,prioridade,solicitado,criado_em,data_inicio,sla_em,data_resolucao,concluido_em,arquivado,colaborador_id,sistema_id,responsavel_id,operacao_id",
      )
      .eq("arquivado", false)
      .order("criado_em", { ascending: false });

    const { data: colabsAll = [] } = await db
      .from("colaboradores")
      .select(
        "id,nome,cpf,data_nascimento,email,email_senha,telefone,cargo,status,operacao:operacoes(nome)",
      );

    const { data: operacoesAll = [] } = await db.from("operacoes").select("id,nome");
    const { data: sistemasAll = [] } = await db.from("sistemas").select("id,nome");
    const { data: profilesAll = [] } = await db.from("profiles").select("id,nome,email");

    const operacaoById = new Map<string, any>();
    for (const op of operacoesAll ?? []) {
      operacaoById.set(op.id, op);
    }

    const colabById = new Map<string, any>();
    const colabByName = new Map<string, any>();
    const colabByCPF = new Map<string, any>();
    for (const c of colabsAll ?? []) {
      colabById.set(c.id, c);
      if (c.nome) {
        colabByName.set(c.nome.trim().toLowerCase(), c);
      }
      if (c.cpf) {
        colabByCPF.set(c.cpf.replace(/\D/g, ""), c);
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

    const rows: any[] = [];
    for (const p of pendenciasRaw ?? []) {
      const stNorm = String(p.status ?? "")
        .toLowerCase()
        .trim();
      // Skip completed or canceled items only when marked as finished
      if (
        ["concluido", "concluído", "resolvido", "resolvida", "cancelado", "cancelada"].includes(
          stNorm,
        ) &&
        p.concluido_em
      ) {
        continue;
      }

      let colab = p.colaborador_id ? colabById.get(p.colaborador_id) : null;
      if (!colab && p.titulo) {
        colab = colabByName.get(p.titulo.trim().toLowerCase());
      }
      if (!colab && p.descricao) {
        const digits = p.descricao.replace(/\D/g, "");
        if (digits.length === 11 && colabByCPF.has(digits)) {
          colab = colabByCPF.get(digits);
        }
      }

      const sistema = p.sistema_id ? sistemaById.get(p.sistema_id) : null;
      const responsavel = p.responsavel_id ? profileById.get(p.responsavel_id) : null;
      const opName =
        (p.operacao_id ? operacaoById.get(p.operacao_id)?.nome : null) ||
        colab?.operacao?.nome ||
        "-";

      rows.push({
        "ID / Protocolo": p.id,
        Título: p.titulo ?? "",
        Tipo: getPendenciaTipoLabel(p.tipo, p.titulo),
        "Status / Quadro": getPendenciaStatusLabel(p.status),
        Prioridade: getPendenciaPrioridadeLabel(p.prioridade),
        Solicitado: p.solicitado ? "Sim" : "Não",
        Sistema: sistema?.nome ?? "-",
        Colaborador: colab?.nome ? colab.nome.toUpperCase() : p.titulo || "-",
        CPF: formatCPF(colab?.cpf),
        "Data de Nascimento": formatDateBR(colab?.data_nascimento),
        Email: colab?.email ? colab.email.toLowerCase() : "",
        "Senha E-mail": colab?.email_senha ?? "",
        Operação: opName,
        Cargo: colab?.cargo ?? "",
        "Status do Colaborador": colab?.status ? String(colab.status).toUpperCase() : "ATIVO",
        Telefone: colab?.telefone ?? "",
        Responsável: responsavel?.nome ?? (responsavel?.email || "-"),
        "Criado em": formatDateTimeBR(p.criado_em),
        SLA: formatDateBR(p.sla_em),
        "Data Início": formatDateBR(p.data_inicio),
        Descrição: p.descricao ?? "",
      });
    }

    return rows;
  }

  if (k === "pendencias_historico") {
    const { data: pendenciasRaw = [] } = await db
      .from("pendencias")
      .select(
        "id,titulo,descricao,tipo,status,prioridade,solicitado,criado_em,data_inicio,sla_em,data_resolucao,concluido_em,arquivado,colaborador_id,sistema_id,responsavel_id,operacao_id",
      )
      .order("criado_em", { ascending: false });

    const { data: colabsAll = [] } = await db
      .from("colaboradores")
      .select(
        "id,nome,cpf,data_nascimento,email,email_senha,telefone,cargo,status,operacao:operacoes(nome)",
      );

    const { data: operacoesAll = [] } = await db.from("operacoes").select("id,nome");
    const { data: sistemasAll = [] } = await db.from("sistemas").select("id,nome");
    const { data: profilesAll = [] } = await db.from("profiles").select("id,nome,email");

    const operacaoById = new Map<string, any>();
    for (const op of operacoesAll ?? []) {
      operacaoById.set(op.id, op);
    }

    const colabById = new Map<string, any>();
    const colabByName = new Map<string, any>();
    const colabByCPF = new Map<string, any>();
    for (const c of colabsAll ?? []) {
      colabById.set(c.id, c);
      if (c.nome) {
        colabByName.set(c.nome.trim().toLowerCase(), c);
      }
      if (c.cpf) {
        colabByCPF.set(c.cpf.replace(/\D/g, ""), c);
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
      if (!colab && p.descricao) {
        const digits = p.descricao.replace(/\D/g, "");
        if (digits.length === 11 && colabByCPF.has(digits)) {
          colab = colabByCPF.get(digits);
        }
      }

      const sistema = p.sistema_id ? sistemaById.get(p.sistema_id) : null;
      const responsavel = p.responsavel_id ? profileById.get(p.responsavel_id) : null;
      const opName =
        (p.operacao_id ? operacaoById.get(p.operacao_id)?.nome : null) ||
        colab?.operacao?.nome ||
        "-";

      let statusDisplay = getPendenciaStatusLabel(p.status);
      if (p.arquivado && statusDisplay === "Pendente") {
        statusDisplay = "Arquivado / Concluído";
      }

      return {
        "ID / Protocolo": p.id,
        Título: p.titulo ?? "",
        Tipo: getPendenciaTipoLabel(p.tipo, p.titulo),
        "Status da Pendência": statusDisplay,
        Prioridade: getPendenciaPrioridadeLabel(p.prioridade),
        Solicitado: p.solicitado ? "Sim" : "Não",
        Sistema: sistema?.nome ?? "-",
        Colaborador: colab?.nome ? colab.nome.toUpperCase() : p.titulo || "-",
        CPF: formatCPF(colab?.cpf),
        "Data de Nascimento": formatDateBR(colab?.data_nascimento),
        Email: colab?.email ? colab.email.toLowerCase() : "",
        "Senha E-mail": colab?.email_senha ?? "",
        Operação: opName,
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
      .select(
        "id, colaborador_id, sistema_id, status, tipo, titulo, criado_em, concluido_em, data_resolucao, arquivado, operacao_id",
      )
      .eq("arquivado", false);

    const { data: rawSistemas = [] } = await db.from("sistemas").select("id, nome").order("nome");
    const sistemas = (rawSistemas ?? []).filter(
      (s: any) => s.nome.toLowerCase() !== "e-mail" && s.nome.toLowerCase() !== "email",
    );

    const { data: colabsAll = [] } = await db
      .from("colaboradores")
      .select(
        "id, nome, cpf, data_nascimento, email, email_senha, telefone, cargo, status, operacao:operacoes(nome)",
      )
      .not("status", "in", '("inativo","desligado")');

    const colabById = new Map<string, any>();
    const colabByName = new Map<string, any>();
    const colabByCPF = new Map<string, any>();
    for (const c of colabsAll ?? []) {
      colabById.set(c.id, c);
      if (c.nome) {
        colabByName.set(c.nome.trim().toLowerCase(), c);
      }
      if (c.cpf) {
        colabByCPF.set(c.cpf.replace(/\D/g, ""), c);
      }
    }

    const colabPendencias = new Map<string, any[]>();
    for (const p of activePendencias ?? []) {
      const stNorm = String(p.status ?? "")
        .toLowerCase()
        .trim();
      if (
        ["concluido", "concluído", "resolvido", "resolvida", "cancelado", "cancelada"].includes(
          stNorm,
        ) &&
        p.concluido_em
      ) {
        continue;
      }

      let matchedColabId = p.colaborador_id;
      if (!matchedColabId && p.titulo) {
        const matchedColab = colabByName.get(p.titulo.trim().toLowerCase());
        if (matchedColab) {
          matchedColabId = matchedColab.id;
        }
      }
      if (!matchedColabId && p.descricao) {
        const digits = p.descricao.replace(/\D/g, "");
        if (digits.length === 11 && colabByCPF.has(digits)) {
          matchedColabId = colabByCPF.get(digits).id;
        }
      }

      if (!matchedColabId || !colabById.has(matchedColabId)) {
        continue;
      }

      if (!colabPendencias.has(matchedColabId)) {
        colabPendencias.set(matchedColabId, []);
      }
      colabPendencias.get(matchedColabId)!.push(p);
    }

    const colabs = (colabsAll ?? []).filter(
      (c: any) => colabPendencias.has(c.id) && colabPendencias.get(c.id)!.length > 0,
    );
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
        "id,nome,cpf,email,email_senha,telefone,cargo,status,inativado_em,data_nascimento,admissao_em,produto,horario_entrada,horario_saida,em_pre_atendimento,jornada,apelido_intergrall,inicio_na_operacao,operacao:operacoes(nome)" as any,
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
        base["Jornada"] = c.jornada ?? "";
        base["Produto"] = c.produto ?? "";
        base["Entrada"] = c.horario_entrada ?? "";
        base["Saída"] = c.horario_saida ?? "";
        base["Início na Operação"] = formatDateBR(c.inicio_na_operacao);
        base["Apelido Intergrall"] = c.apelido_intergrall ?? "";
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
      const itemInfo = RELATORIOS.find((r) => r.key === k);
      const title = itemInfo?.title || k;
      const safeFilename = `relatorio_${k}_${new Date().toISOString().slice(0, 10)}`;

      if (fmt === "xlsx" || fmt === "csv") {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, k.slice(0, 31));
        XLSX.writeFile(wb, `${safeFilename}.${fmt}`);
      } else {
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14);
        doc.text(title, 14, 13);
        doc.setFontSize(8);
        doc.text(
          `Gerado em: ${new Date().toLocaleString("pt-BR")} | Total de registros: ${rows.length}`,
          14,
          18,
        );
        autoTable(doc, {
          head: [Object.keys(rows[0])],
          body: rows.map((r) => Object.values(r).map((v) => String(v ?? ""))),
          startY: 22,
          styles: { fontSize: 6.5, cellPadding: 1.2 },
          headStyles: { fillColor: [41, 58, 82] },
        });
        doc.save(`${safeFilename}.pdf`);
      }
      toast.dismiss(loadingToast);
      toast.success("Relatório exportado com sucesso!");
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
