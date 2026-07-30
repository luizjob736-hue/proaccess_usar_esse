import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      throw redirect({ to: "/auth" });
    }

    const user = data.user;
    const isOperador = user.role === "operador";
    const senhaAlterada = user.user_metadata?.senha_alterada;

    if (senhaAlterada === false) {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      if (!pathname.includes("/primeiro-acesso")) {
        throw redirect({ to: "/primeiro-acesso" });
      }
    }

    if (isOperador) {
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      if (pathname === "/dashboard" || pathname === "/dashboard/") {
        throw redirect({ to: "/chamados" });
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
