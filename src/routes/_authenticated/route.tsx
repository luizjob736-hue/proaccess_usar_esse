import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // checar primeiro acesso
    const { data: prof } = await supabase
      .from("profiles")
      .select("senha_alterada")
      .eq("id", data.user.id)
      .maybeSingle();
    if (prof && !prof.senha_alterada) {
      const url = typeof window !== "undefined" ? window.location.pathname : "";
      if (!url.endsWith("/primeiro-acesso")) throw redirect({ to: "/primeiro-acesso" });
    }
    // Operador / Colaborador não acessa dashboard
    if (data.user.role === "operador") {
      const url = typeof window !== "undefined" ? window.location.pathname : "";
      if (url === "/dashboard" || url === "/dashboard/") {
        throw redirect({ to: "/chamados" });
      }
    }
    return { userId: data.user.id, email: data.user.email };
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
