import { createServerFn } from "@tanstack/react-start";
import { requireDatabaseAuth } from "@/integrations/database/auth-middleware";

type Role = "admin_master" | "admin" | "analista" | "supervisor" | "consulta" | "operador";

async function ensureAdmin(context: any) {
  const { data: isAdm } = await context.db.rpc("is_admin", { _user_id: context.userId });
  if (!isAdm) throw new Error("Apenas administradores podem executar esta ação");
}

function genSenha() {
  return Math.random().toString(36).slice(-8) + "A1!";
}

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator(
    (d: {
      nome: string;
      email: string;
      role: Role;
      senha?: string;
      cpf?: string;
      login?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.role === "admin_master") {
      const { data: isMaster } = await context.db.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin_master",
      });
      if (!isMaster) throw new Error("Somente Admin Master pode conceder o papel admin_master");
    }
    const { dbAdmin } = await import("@/integrations/database/client.server");
    const cpfDigits = (data.cpf ?? "").replace(/\D/g, "");
    let email = data.email;
    let senha = data.senha ?? genSenha();
    let login = data.login;

    if (data.role === "operador") {
      if (!cpfDigits || cpfDigits.length !== 11) {
        throw new Error("CPF é obrigatório para criar operador (precisa ter 11 dígitos)");
      }
      email = `${cpfDigits}@operador.proaccess.local`;
      senha = data.senha ?? "123456";
      login = cpfDigits;
    }

    const { data: created, error } = await dbAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome: data.nome,
        cpf: cpfDigits || undefined,
        username: login || email,
        senha_alterada: data.role === "operador" ? true : false,
      },
    });
    if (error) {
      throw new Error("Erro ao criar/atualizar usuário: " + error.message);
    }
    const uid = created.user!.id;
    await dbAdmin.from("user_roles").delete().eq("user_id", uid);
    await dbAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    await dbAdmin
      .from("profiles")
      .update({
        nome: data.nome,
        ultima_senha: senha,
        email: data.email || email,
      } as any)
      .eq("id", uid);
    return { user_id: uid, senha_provisoria: senha, login: login || email };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator((d: { user_id: string; nova_senha?: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const senha = data.nova_senha && data.nova_senha.length >= 6 ? data.nova_senha : genSenha();
    const { dbAdmin } = await import("@/integrations/database/client.server");
    const { error } = await dbAdmin.auth.admin.updateUserById(data.user_id, {
      password: senha,
    });
    if (error) throw error;
    // salva última senha no profile para visibilidade admin
    await dbAdmin
      .from("profiles")
      .update({ senha_alterada: false } as any)
      .eq("id", data.user_id);
    await dbAdmin
      .from("profiles")
      .update({ ultima_senha: senha } as any)
      .eq("id", data.user_id);
    return { senha };
  });

export const createOperadorFromColaborador = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator((d: { colaborador_id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: col, error: e1 } = await context.db
      .from("colaboradores")
      .select("id, nome, cpf, email")
      .eq("id", data.colaborador_id)
      .maybeSingle();
    if (e1) throw e1;
    if (!col) throw new Error("Colaborador não encontrado");
    const cpfDigits = col.cpf ? String(col.cpf).replace(/\D/g, "") : "";
    if (!cpfDigits || cpfDigits.length !== 11) {
      throw new Error(
        "Colaborador precisa ter um CPF válido de 11 dígitos cadastrado para gerar o acesso.",
      );
    }
    const email = `${cpfDigits}@operador.proaccess.local`;
    const { dbAdmin } = await import("@/integrations/database/client.server");

    // Verificar se já existe uma conta com esse CPF/e-mail no auth/profiles
    const { data: existingProfile } = await dbAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const { data: created, error } = await dbAdmin.auth.admin.createUser({
      email,
      password: "123456",
      email_confirm: true,
      user_metadata: {
        nome: col.nome,
        cpf: cpfDigits,
        senha_alterada: true,
        username: cpfDigits,
      },
    });
    if (error) {
      throw new Error("Erro ao criar operador: " + error.message);
    }
    const uid = created.user!.id;
    await dbAdmin.from("user_roles").delete().eq("user_id", uid);
    await dbAdmin.from("user_roles").insert({ user_id: uid, role: "operador" });
    return { user_id: uid, login: cpfDigits, senha: "123456" };
  });

export const getUsersList = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { dbAdmin } = await import("@/integrations/database/client.server");

    const { data: profs } = await dbAdmin.from("profiles").select("*").order("nome");
    const { data: roles } = await dbAdmin.from("user_roles").select("*");

    let authUserMap = new Map<string, any>();
    try {
      const { data: authData } = await dbAdmin.auth.admin.listUsers();
      if (authData?.users) {
        authUserMap = new Map(authData.users.map((u: any) => [u.id, u]));
      }
    } catch (_e) {
      // fallback if auth list fails
    }

    return (profs ?? []).map((p: any) => {
      const authUser = authUserMap.get(p.id);
      const meta = authUser?.user_metadata ?? {};
      return {
        ...p,
        cpf: meta.cpf || "",
        login: meta.username || (authUser?.email ? authUser.email.split("@")[0] : ""),
        roles: (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
      };
    });
  });

export const updateUserAccount = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator(
    (d: {
      user_id: string;
      nome: string;
      email: string;
      role?: Role;
      cpf?: string;
      login?: string;
      ativo?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);

    if (data.role === "admin_master") {
      const { data: isMaster } = await context.db.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin_master",
      });
      if (!isMaster) throw new Error("Somente Admin Master pode conceder o papel admin_master");
    }

    const { dbAdmin } = await import("@/integrations/database/client.server");
    const cpfDigits = (data.cpf ?? "").replace(/\D/g, "");

    // 1. Fetch current user metadata to merge
    let existingMeta: any = {};
    try {
      const { data: userObj } = await dbAdmin.auth.admin.getUserById(data.user_id);
      if (userObj?.user?.user_metadata) {
        existingMeta = userObj.user.user_metadata;
      }
    } catch (_e) {
      // ignores
    }

    const updatedMeta = {
      ...existingMeta,
      nome: data.nome,
      cpf: cpfDigits || existingMeta.cpf || undefined,
      username: data.login || existingMeta.username || data.email,
    };

    // 2. Update Auth user
    try {
      await dbAdmin.auth.admin.updateUserById(data.user_id, {
        email: data.email,
        user_metadata: updatedMeta,
      });
    } catch (authErr: any) {
      console.error("Auth updateUserById error:", authErr);
    }

    // 3. Update profiles table
    const profilePayload: any = {
      nome: data.nome,
      email: data.email,
      atualizado_em: new Date().toISOString(),
    };
    if (data.ativo !== undefined) {
      profilePayload.ativo = data.ativo;
    }

    const { error: profErr } = await dbAdmin
      .from("profiles")
      .update(profilePayload)
      .eq("id", data.user_id);

    if (profErr) {
      throw new Error("Erro ao atualizar o perfil: " + profErr.message);
    }

    // 4. Update user_roles
    if (data.role) {
      await dbAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      await dbAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    }

    return { success: true };
  });
