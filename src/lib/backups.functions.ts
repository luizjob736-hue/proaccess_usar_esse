import { createServerFn } from "@tanstack/react-start";
import { requireDatabaseAuth } from "@/integrations/database/auth-middleware";

async function ensureAdmin(context: any) {
  const { data: isAdm } = await context.db.rpc("is_admin", { _user_id: context.userId });
  if (!isAdm) throw new Error("Apenas administradores podem executar esta ação");
}

function formatDatePtBr(val: any, withTime = false) {
  if (!val) return "";
  const dateObj = typeof val === "string" ? new Date(val) : val;
  if (!dateObj || isNaN(dateObj.getTime())) return "";

  const dateStr = dateObj.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (!withTime) return dateStr;

  const timeStr = dateObj.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateStr} ${timeStr}`;
}

// 1. GENERATE FULL SYSTEM BACKUP WITH AUTO-REPLACEMENT
export const generateSistemaBackup = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator(
    (d?: { tipo?: "diario" | "manual"; descricao?: string; substituirAnterior?: boolean }) =>
      d ?? {},
  )
  .handler(async ({ data }) => {
    const { dbAdmin } = await import("@/integrations/database/client.server");

    // Fetch all entities across the entire system
    const [
      { data: colabs = [] },
      { data: operacoes = [] },
      { data: sistemasRaw = [] },
      { data: perfis = [] },
      { data: acessos = [] },
      { data: pendencias = [] },
      { data: chamados = [] },
    ] = await Promise.all([
      dbAdmin.from("colaboradores").select("*").order("nome"),
      dbAdmin.from("operacoes").select("*").order("nome"),
      dbAdmin.from("sistemas").select("*").order("nome"),
      dbAdmin.from("perfis_acesso").select("*").order("nome"),
      dbAdmin.from("acessos").select("*"),
      dbAdmin
        .from("pendencias")
        .select("*, colaborador:colaboradores(id, nome, cpf), sistema:sistemas(id, nome)"),
      dbAdmin
        .from("chamados")
        .select("*, operador:profiles!operador_id(id, nome, email), sistema:sistemas(id, nome)"),
    ]);

    const opMap = new Map((operacoes ?? []).map((o: any) => [o.id, o.nome]));
    const sisMap = new Map((sistemasRaw ?? []).map((s: any) => [s.id, s.nome]));
    const perfMap = new Map((perfis ?? []).map((p: any) => [p.id, p.nome]));

    const sistemasFiltrados = (sistemasRaw ?? []).filter(
      (s: any) => s.nome?.toLowerCase() !== "e-mail" && s.nome?.toLowerCase() !== "email",
    );

    // Map accesses by colaborador
    const accessMap = new Map<
      string,
      Record<string, { usuario: string; senha: string; perfil: string }>
    >();
    const acessosDetalhadoRows: any[] = [];

    for (const a of (acessos ?? []) as any[]) {
      if (a.colaborador_id && a.sistema_id) {
        if (!accessMap.has(a.colaborador_id)) {
          accessMap.set(a.colaborador_id, {});
        }
        accessMap.get(a.colaborador_id)![a.sistema_id] = {
          usuario: a.login ?? "",
          senha: a.senha ?? "",
          perfil: perfMap.get(a.perfil_acesso_id) || "",
        };
      }

      const cObj = (colabs ?? []).find((c: any) => c.id === a.colaborador_id);
      acessosDetalhadoRows.push({
        id: a.id,
        colaborador_nome: cObj?.nome || "Sem colaborador",
        colaborador_cpf: cObj?.cpf || "",
        sistema_nome: sisMap.get(a.sistema_id) || "Sem sistema",
        perfil_nome: perfMap.get(a.perfil_acesso_id) || "-",
        login: a.login || "",
        senha: a.senha || "",
        status: a.status || "ativo",
        atualizado_em: formatDatePtBr(a.atualizado_em, true),
      });
    }

    let totalAtivos = 0;
    let totalInativos = 0;

    // 1. Matriz Snapshot
    const matrizRows = (colabs ?? []).map((c: any) => {
      const isAtivo = c.status === "ativo";
      if (isAtivo) totalAtivos++;
      else totalInativos++;

      const userAcessos = accessMap.get(c.id) || {};
      const sisAcessos: Record<string, { usuario: string; senha: string; perfil?: string }> = {};

      for (const sis of sistemasFiltrados) {
        sisAcessos[sis.id] = {
          usuario: userAcessos[sis.id]?.usuario || "",
          senha: userAcessos[sis.id]?.senha || "",
          perfil: userAcessos[sis.id]?.perfil || "",
        };
      }

      return {
        colaborador_id: c.id,
        nome: c.nome || "",
        cpf: c.cpf || "",
        data_nascimento: formatDatePtBr(c.data_nascimento),
        email: c.email || "",
        email_senha: c.email_senha || "",
        telefone: c.telefone || "",
        cargo: c.cargo || "",
        operacao_nome: opMap.get(c.operacao_id) || "",
        status: isAtivo ? "Ativo" : "Inativo",
        inativado_em: !isAtivo ? formatDatePtBr(c.inativado_em) || "-" : "-",
        sistemas_acessos: sisAcessos,
      };
    });

    // 2. Colaboradores Snapshot
    const colaboradoresRows = (colabs ?? []).map((c: any) => ({
      id: c.id,
      nome: c.nome || "",
      cpf: c.cpf || "",
      email: c.email || "",
      telefone: c.telefone || "",
      cargo: c.cargo || "",
      operacao: opMap.get(c.operacao_id) || "Sem operação",
      status: c.status || "ativo",
      data_nascimento: formatDatePtBr(c.data_nascimento),
      criado_em: formatDatePtBr(c.criado_em, true),
      inativado_em: formatDatePtBr(c.inativado_em, true) || "-",
    }));

    // 3. Sistemas Snapshot
    const sistemasRows = (sistemasRaw ?? []).map((s: any) => ({
      id: s.id,
      nome: s.nome || "",
      categoria: s.categoria || "Geral",
      criticidade: s.criticidade || "media",
      url: s.url || "",
      descricao: s.descricao || "",
      ativo: s.ativo !== false ? "Sim" : "Não",
    }));

    // 4. Pendencias Snapshot
    const pendenciasRows = (pendencias ?? []).map((p: any) => ({
      id: p.id,
      titulo: p.titulo || "",
      tipo: p.tipo || "",
      prioridade: p.prioridade || "media",
      status: p.status || "PENDENTE",
      colaborador_nome: p.colaborador?.nome || "Sem colaborador",
      colaborador_cpf: p.colaborador?.cpf || "",
      sistema_nome: p.sistema?.nome || "Sem sistema",
      data_inicio: formatDatePtBr(p.data_inicio),
      sla_em: formatDatePtBr(p.sla_em, true),
      concluido_em: formatDatePtBr(p.concluido_em, true),
      descricao: p.descricao || "",
    }));

    // 5. Operações Snapshot
    const operacoesRows = (operacoes ?? []).map((o: any) => ({
      id: o.id,
      nome: o.nome || "",
      descricao: o.descricao || "",
      ativo: o.ativo !== false ? "Sim" : "Não",
    }));

    // 6. Perfis de Acesso Snapshot
    const perfisRows = (perfis ?? []).map((p: any) => ({
      id: p.id,
      nome: p.nome || "",
      sistema_nome: sisMap.get(p.sistema_id) || "Sem sistema",
      descricao: p.descricao || "",
    }));

    // 7. Chamados Snapshot
    const chamadosRows = (chamados ?? []).map((ch: any) => ({
      id: ch.id,
      titulo: ch.titulo || "",
      tipo: ch.tipo || "erro",
      status: ch.status || "aberto",
      sistema_nome: ch.sistema?.nome || "Sem sistema",
      operador_nome: ch.operador?.nome || ch.operador?.email || "-",
      descricao: ch.descricao || "",
      resposta: ch.resposta || "",
      criado_em: formatDatePtBr(ch.criado_em, true),
    }));

    const backupDate = new Date();
    const dataLayout = formatDatePtBr(backupDate, true);
    const tipo = data.tipo || "diario";
    const desc =
      data.descricao ||
      (tipo === "diario"
        ? `Backup Diário Automático (${dataLayout})`
        : `Backup Geral do Sistema (${dataLayout})`);

    // AUTO-REPLACEMENT LOGIC:
    // To prevent overloading the database, remove existing daily backups before inserting the new one!
    if (data.substituirAnterior !== false) {
      try {
        await dbAdmin
          .from("backups_sistema")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (_e) {
        // ignore
      }
    }

    const { data: inserted, error } = await dbAdmin
      .from("backups_sistema")
      .insert({
        data_layout: dataLayout,
        descricao: desc,
        tipo,
        total_colaboradores: colabs.length,
        total_ativos: totalAtivos,
        total_inativos: totalInativos,
        total_sistemas: sistemasRaw.length,
        total_acessos: acessos.length,
        total_pendencias: pendencias.length,
        total_operacoes: operacoes.length,
        total_chamados: chamados.length,
        matriz_json: { sistemas: sistemasFiltrados, rows: matrizRows },
        colaboradores_json: colaboradoresRows,
        sistemas_json: sistemasRows,
        acessos_json: acessosDetalhadoRows,
        pendencias_json: pendenciasRows,
        operacoes_json: operacoesRows,
        perfis_json: perfisRows,
        chamados_json: chamadosRows,
      })
      .select()
      .single();

    if (error) {
      throw new Error("Erro ao persistir backup do sistema: " + error.message);
    }

    return inserted;
  });

// 2. GET SYSTEM BACKUP (LATEST ACTIVE)
export const getSistemaBackup = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async () => {
    const { dbAdmin } = await import("@/integrations/database/client.server");

    // Fetch the latest system backup
    const { data: bks, error } = await dbAdmin
      .from("backups_sistema")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(1);

    if (error || !bks || bks.length === 0) {
      return null;
    }

    return bks[0];
  });

// 3. DELETE SYSTEM BACKUP
export const deleteSistemaBackup = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { dbAdmin } = await import("@/integrations/database/client.server");
    const { error } = await dbAdmin.from("backups_sistema").delete().eq("id", data.id);
    if (error) throw new Error("Erro ao excluir backup: " + error.message);
    return { success: true };
  });

// Legacy helpers for backwards compatibility
export const getBackupsList = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async () => {
    const { dbAdmin } = await import("@/integrations/database/client.server");
    const { data: existing = [] } = await dbAdmin
      .from("backups_matriz")
      .select(
        "id, criado_em, data_layout, descricao, tipo, total_colaboradores, total_ativos, total_inativos",
      )
      .order("criado_em", { ascending: false });
    return existing ?? [];
  });

export const getBackupsPendenciasList = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async () => {
    const { dbAdmin } = await import("@/integrations/database/client.server");
    const { data: existing = [] } = await dbAdmin
      .from("backups_pendencias")
      .select("id, criado_em, data_layout, descricao, tipo, total_pendencias")
      .order("criado_em", { ascending: false });
    return existing ?? [];
  });

export const getBackupById = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { dbAdmin } = await import("@/integrations/database/client.server");
    const { data: bk, error } = await dbAdmin
      .from("backups_matriz")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !bk) throw new Error("Backup não encontrado");
    return bk;
  });

export const getBackupPendenciasById = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { dbAdmin } = await import("@/integrations/database/client.server");
    const { data: bk, error } = await dbAdmin
      .from("backups_pendencias")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !bk) throw new Error("Backup de pendências não encontrado");
    return bk;
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { dbAdmin } = await import("@/integrations/database/client.server");
    const { error } = await dbAdmin.from("backups_matriz").delete().eq("id", data.id);
    if (error) throw new Error("Erro ao excluir backup: " + error.message);
    return { success: true };
  });

export const deleteBackupPendencias = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { dbAdmin } = await import("@/integrations/database/client.server");
    const { error } = await dbAdmin.from("backups_pendencias").delete().eq("id", data.id);
    if (error) throw new Error("Erro ao excluir backup: " + error.message);
    return { success: true };
  });
