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
    const email = data.email;
    let senha = data.senha ?? genSenha();
    if (data.role === "operador") {
      if (!email) throw new Error("E-mail é obrigatório para criar operador");
      senha = data.senha ?? "123456";
    }
    const { data: created, error } = await dbAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome: data.nome,
        cpf: cpfDigits || undefined,
        username: data.login || email,
        senha_alterada: data.role === "operador" ? true : false,
      },
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("already") && data.role === "operador") {
        const { data: existingProfile } = await dbAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (existingProfile) {
          await dbAdmin.from("user_roles").delete().eq("user_id", existingProfile.id);
          await dbAdmin
            .from("user_roles")
            .insert({ user_id: existingProfile.id, role: "operador" });
          return {
            user_id: existingProfile.id,
            senha_provisoria: "123456",
            login: email,
            message: "Acesso de operador vinculado ao usuário existente",
          };
        }
      }
      throw error;
    }
    const uid = created.user!.id;
    await dbAdmin.from("user_roles").delete().eq("user_id", uid);
    await dbAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    // guarda senha visível para admins (campo já existente em profiles? adiciona em user_metadata)
    return { user_id: uid, senha_provisoria: senha, login: data.login || email };
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
    if (!col.email) throw new Error("Colaborador precisa ter e-mail cadastrado");
    const cpfDigits = col.cpf ? String(col.cpf).replace(/\D/g, "") : "";
    const email = col.email.trim().toLowerCase();
    const { dbAdmin } = await import("@/integrations/database/client.server");

    // Verificar se já existe uma conta com esse e-mail no auth/profiles
    const { data: existingProfile } = await dbAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      // Se já existe, garante que ele tenha a role "operador"
      await dbAdmin.from("user_roles").delete().eq("user_id", existingProfile.id);
      await dbAdmin.from("user_roles").insert({ user_id: existingProfile.id, role: "operador" });
      return {
        user_id: existingProfile.id,
        login: email,
        senha: "123456",
        message: "Acesso de operador vinculado ao usuário existente",
      };
    }

    const { data: created, error } = await dbAdmin.auth.admin.createUser({
      email,
      password: "123456",
      email_confirm: true,
      user_metadata: {
        nome: col.nome,
        cpf: cpfDigits || undefined,
        senha_alterada: true,
        username: email,
      },
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("already")) {
        return {
          skipped: true,
          message: "Já existe conta com este e-mail",
          login: email,
          senha: "123456",
        };
      }
      throw error;
    }
    const uid = created.user!.id;
    await dbAdmin.from("user_roles").delete().eq("user_id", uid);
    await dbAdmin.from("user_roles").insert({ user_id: uid, role: "operador" });
    return { user_id: uid, login: email, senha: "123456" };
  });
