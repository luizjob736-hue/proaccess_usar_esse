import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin_master" | "admin" | "analista" | "supervisor" | "consulta" | "operador";

async function ensureAdmin(context: any) {
  const { data: isAdm } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!isAdm) throw new Error("Apenas administradores podem executar esta ação");
}

function genSenha() {
  return Math.random().toString(36).slice(-8) + "A1!";
}

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
      const { data: isMaster } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin_master",
      });
      if (!isMaster) throw new Error("Somente Admin Master pode conceder o papel admin_master");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cpfDigits = (data.cpf ?? "").replace(/\D/g, "");
    let email = data.email;
    let senha = data.senha ?? genSenha();
    if (data.role === "operador") {
      if (!cpfDigits) throw new Error("CPF é obrigatório para criar operador");
      email = data.email || `${cpfDigits}@operador.proaccess.local`;
      senha = data.senha ?? "123456";
    }
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome: data.nome,
        cpf: cpfDigits || undefined,
        username: data.login || (data.role === "operador" ? cpfDigits : undefined),
        senha_alterada: data.role === "operador" ? true : false,
      },
    });
    if (error) throw error;
    const uid = created.user!.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    // guarda senha visível para admins (campo já existente em profiles? adiciona em user_metadata)
    return { user_id: uid, senha_provisoria: senha, login: data.login || email };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; nova_senha?: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const senha = data.nova_senha && data.nova_senha.length >= 6 ? data.nova_senha : genSenha();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: senha,
    });
    if (error) throw error;
    // salva última senha no profile para visibilidade admin
    await supabaseAdmin
      .from("profiles")
      .update({ senha_alterada: false } as any)
      .eq("id", data.user_id);
    await supabaseAdmin
      .from("profiles")
      .update({ ultima_senha: senha } as any)
      .eq("id", data.user_id);
    return { senha };
  });

export const createOperadorFromColaborador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { colaborador_id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { data: col, error: e1 } = await context.supabase
      .from("colaboradores")
      .select("id, nome, cpf, email")
      .eq("id", data.colaborador_id)
      .maybeSingle();
    if (e1) throw e1;
    if (!col) throw new Error("Colaborador não encontrado");
    if (!col.cpf) throw new Error("Colaborador precisa ter CPF cadastrado");
    const cpfDigits = String(col.cpf).replace(/\D/g, "");
    if (!cpfDigits) throw new Error("CPF inválido");
    const email = col.email ?? `${cpfDigits}@operador.proaccess.local`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "123456",
      email_confirm: true,
      user_metadata: { nome: col.nome, cpf: cpfDigits, senha_alterada: true, username: cpfDigits },
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("already")) {
        return { skipped: true, message: "Já existe conta com este e-mail" };
      }
      throw error;
    }
    const uid = created.user!.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "operador" });
    return { user_id: uid, login: cpfDigits, senha: "123456" };
  });
