import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      throw redirect({ to: "/auth" });
    }
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      if (data.session.user?.role === "operador") {
        throw redirect({ to: "/chamados" });
      }
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/auth" });
  },
  component: IndexRedirect,
});

function IndexRedirect() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        window.location.href = data.session.user?.role === "operador" ? "/chamados" : "/dashboard";
      } else {
        window.location.href = "/auth";
      }
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
        <p className="mt-3 text-sm text-muted-foreground">Redirecionando para o login...</p>
      </div>
    </div>
  );
}
