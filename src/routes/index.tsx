import { createFileRoute, redirect } from "@tanstack/react-router";
import { db } from "@/integrations/database/client";

export const Route = createFileRoute("/")({
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
    if (data.user.role === "operador") {
      throw redirect({ to: "/chamados" });
    }
    throw redirect({ to: "/dashboard" });
  },
  component: IndexRedirect,
});

function IndexRedirect() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
        <p className="mt-3 text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
