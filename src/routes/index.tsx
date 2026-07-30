import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      if (data.user.role === "operador") {
        throw redirect({ to: "/chamados" });
      }
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/auth" });
  },
  component: IndexRedirect,
});

function IndexRedirect() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
        <p className="mt-3 text-sm text-muted-foreground">Redirecionando para o login...</p>
      </div>
    </div>
  );
}
