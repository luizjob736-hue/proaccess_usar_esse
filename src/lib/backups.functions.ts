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

export const generateMatrizBackup = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator(
    (d?: { tipo?: "semanal" | "manual"; descricao?: string; data_layout_custom?: string }) =>
      d ?? {},
  )
  .handler(async ({ data, context }) => {
    const { dbAdmin } = await import("@/integrations/database/client.server");

    // Fetch all colaboradores
    const { data: colabs = [] } = await dbAdmin
      .from("colaboradores")
      .select(
        "id, nome, cpf, email, email_senha, telefone, cargo, status, operacao_id, inativado_em, data_nascimento",
      )
      .order("nome");

    // Fetch operacoes
    const { data: operacoes = [] } = await dbAdmin.from("operacoes").select("id, nome");
    const opMap = new Map((operacoes ?? []).map((o: any) => [o.id, o.nome]));

    // Fetch sistemas
    const { data: sistemasRaw = [] } = await dbAdmin
      .from("sistemas")
      .select("id, nome")
      .order("nome");
    const sistemas = (sistemasRaw ?? []).filter(
      (s: any) => s.nome.toLowerCase() !== "e-mail" && s.nome.toLowerCase() !== "email",
    );

    // Fetch acessos
    const { data: acessos = [] } = await dbAdmin
      .from("acessos")
      .select("id, login, senha, colaborador_id, sistema_id");

    const accessMap = new Map<string, Record<string, { usuario: string; senha: string }>>();
    for (const a of (acessos ?? []) as any[]) {
      if (a.colaborador_id && a.sistema_id) {
        if (!accessMap.has(a.colaborador_id)) {
          accessMap.set(a.colaborador_id, {});
        }
        accessMap.get(a.colaborador_id)![a.sistema_id] = {
          usuario: a.login ?? "",
          senha: a.senha ?? "",
        };
      }
    }

    const backupDate = new Date();
    const dataLayout = data.data_layout_custom || formatDatePtBr(backupDate, true);
    const tipo = data.tipo || "manual";
    const desc =
      data.descricao ||
      (tipo === "semanal" ? "Backup Semanal - Sexta-feira 18:00" : `Backup Manual (${dataLayout})`);

    let totalAtivos = 0;
    let totalInativos = 0;

    const snapshotRows = (colabs ?? []).map((c: any) => {
      const isAtivo = c.status === "ativo";
      if (isAtivo) totalAtivos++;
      else totalInativos++;

      const userAcessos = accessMap.get(c.id) || {};
      const sisAcessos: Record<string, { usuario: string; senha: string }> = {};

      for (const sis of sistemas) {
        sisAcessos[sis.id] = {
          usuario: userAcessos[sis.id]?.usuario || "",
          senha: userAcessos[sis.id]?.senha || "",
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
        raw_status: c.status,
        inativado_em: !isAtivo ? formatDatePtBr(c.inativado_em) || "-" : "-",
        data_layout: dataLayout,
        sistemas_acessos: sisAcessos,
      };
    });

    const { data: inserted, error } = await dbAdmin
      .from("backups_matriz")
      .insert({
        data_layout: dataLayout,
        descricao: desc,
        tipo,
        total_colaboradores: colabs.length,
        total_ativos: totalAtivos,
        total_inativos: totalInativos,
        sistemas_json: sistemas,
        dados_json: snapshotRows,
      })
      .select()
      .single();

    if (error) {
      throw new Error("Erro ao criar backup: " + error.message);
    }

    return inserted;
  });

export const generatePendenciasBackup = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator(
    (d?: { tipo?: "dois_dias" | "manual"; descricao?: string; data_layout_custom?: string }) =>
      d ?? {},
  )
  .handler(async ({ data }) => {
    const { dbAdmin } = await import("@/integrations/database/client.server");

    const { data: pendencias = [] } = await dbAdmin
      .from("pendencias")
      .select("*, colaborador:colaboradores(id, nome, cpf), sistema:sistemas(id, nome)");

    const backupDate = new Date();
    const dataLayout = data.data_layout_custom || formatDatePtBr(backupDate, true);
    const tipo = data.tipo || "manual";
    const desc =
      data.descricao ||
      (tipo === "dois_dias"
        ? "Backup Automático (A cada 2 dias)"
        : `Backup Pendências (${dataLayout})`);

    const snapshotRows = (pendencias ?? []).map((p: any) => ({
      id: p.id,
      titulo: p.titulo || "",
      descricao: p.descricao || "",
      tipo: p.tipo || "",
      prioridade: p.prioridade || "",
      status: p.status || "",
      colaborador_nome: p.colaborador?.nome || "Sem colaborador",
      colaborador_cpf: p.colaborador?.cpf || "",
      sistema_nome: p.sistema?.nome || "Sem sistema",
      data_inicio: formatDatePtBr(p.data_inicio),
      sla_em: formatDatePtBr(p.sla_em, true),
      concluido_em: formatDatePtBr(p.concluido_em, true),
      criado_em: formatDatePtBr(p.criado_em, true),
    }));

    const { data: inserted, error } = await dbAdmin
      .from("backups_pendencias")
      .insert({
        data_layout: dataLayout,
        descricao: desc,
        tipo,
        total_pendencias: pendencias.length,
        sistemas_json: [],
        dados_json: snapshotRows,
      })
      .select()
      .single();

    if (error) {
      throw new Error("Erro ao criar backup de pendências: " + error.message);
    }

    return inserted;
  });

export const getBackupsList = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async () => {
    const { dbAdmin } = await import("@/integrations/database/client.server");

    // Auto trigger if no backups exist at all
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

    if (error || !bk) {
      throw new Error("Backup não encontrado");
    }
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

    if (error || !bk) {
      throw new Error("Backup de pendências não encontrado");
    }
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
