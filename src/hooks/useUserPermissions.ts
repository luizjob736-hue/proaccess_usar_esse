import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";

export function useUserPermissions() {
  const { data } = useQuery({
    queryKey: ["user-permissions"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) {
        return {
          user: null,
          profile: null,
          roles: [],
          isAdmin: false,
          isConsulta: false,
          isOperador: false,
          isCliente: false,
          canWrite: false,
        };
      }

      const { data: prof } = await db
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();

      const { data: rolesData } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);

      const roles = (rolesData ?? []).map((r: any) => r.role);
      if (u.user.role && !roles.includes(u.user.role)) {
        roles.push(u.user.role);
      }

      const isAdmin =
        roles.some((r) => r === "admin" || r === "admin_master") ||
        u.user.role === "admin" ||
        u.user.role === "admin_master";

      const isConsulta =
        (roles.includes("consulta") || u.user.role === "consulta") && !isAdmin;

      const isCliente =
        (roles.includes("cliente") || u.user.role === "cliente") && !isAdmin;

      const isOperador =
        (roles.includes("operador") || u.user.role === "operador") &&
        !isAdmin &&
        !isCliente &&
        !isConsulta;

      const canWrite = !isConsulta; // Permissão de escrita bloqueada para Consulta

      return {
        user: u.user,
        profile: prof,
        roles,
        isAdmin,
        isConsulta,
        isOperador,
        isCliente,
        canWrite,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
  });

  return (
    data ?? {
      user: null,
      profile: null,
      roles: [],
      isAdmin: false,
      isConsulta: false,
      isOperador: false,
      isCliente: false,
      canWrite: true,
    }
  );
}
