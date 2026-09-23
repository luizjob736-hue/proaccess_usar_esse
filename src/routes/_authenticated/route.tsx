import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { db } from "@/integrations/database/client";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    let data: any = null;
    try {
      const res = await db.auth.getUser();
      data = res.data;
    } catch (err: any) {
      if (err?.to) throw err;
    }

    if (!data?.user) {
      throw redirect({ to: "/auth" });
    }

    const user = data.user;
    let userRoles: string[] = [];
    if (user?.id) {
      try {
        const { data: rolesData } = await db
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        userRoles = rolesData?.map((r: any) => r.role) ?? [];
      } catch (_e) {
        // ignore
      }
    }

    const isOperador = userRoles.includes("operador") || user.role === "operador";
    const isCliente = userRoles.includes("cliente") || user.role === "cliente";
    const senhaAlterada = user.user_metadata?.senha_alterada;

    if (senhaAlterada === false) {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      if (!pathname.includes("/primeiro-acesso")) {
        throw redirect({ to: "/primeiro-acesso" });
      }
    }

    if (isCliente) {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      if (
        pathname &&
        !pathname.startsWith("/pendencias-pine") &&
        !pathname.includes("/primeiro-acesso")
      ) {
        throw redirect({ to: "/pendencias-pine" });
      }
    } else if (isOperador) {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      if (
        pathname === "/dashboard" ||
        pathname === "/dashboard/" ||
        pathname === "/chamados" ||
        pathname === "/chamados/"
      ) {
        throw redirect({ to: "/minha-matriz" });
      }
    }

    return { userId: user.id, email: user.email };
  },
  component: LayoutComponent,
});

function LayoutComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
