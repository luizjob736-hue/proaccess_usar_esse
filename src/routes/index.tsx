import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Shield, Users, Sparkles, Kanban, BarChart3, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: LandingPage,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-accent" />
            <span className="text-xl font-bold tracking-tight">ProAccess</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="secondary" size="sm">
                Entrar
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <Sparkles className="h-3 w-3" /> Sistema de Gestão de Acessos v1.0
        </div>
        <h1 className="mt-6 text-5xl font-bold tracking-tight text-foreground md:text-6xl">
          Gestão de acessos <span className="text-accent">inteligente</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Substitua planilhas por uma plataforma segura, auditável e escalável. Automatize
          admissões, desligamentos, pendências e auditoria com IA integrada.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              Acessar sistema
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-20 md:grid-cols-3">
        {[
          {
            icon: Users,
            title: "Colaboradores",
            desc: "Cadastro, favoritos, timeline, QR Code e histórico visual completo.",
          },
          {
            icon: Kanban,
            title: "Kanban de Pendências",
            desc: "Fluxo completo com etiquetas, SLA, checklist e comentários.",
          },
          {
            icon: Sparkles,
            title: "IA integrada",
            desc: "Sugere acessos, detecta inconsistências e gera relatórios automáticos.",
          },
          {
            icon: BarChart3,
            title: "Dashboard inteligente",
            desc: "Indicadores em tempo real e painel de saúde dos acessos.",
          },
          {
            icon: Lock,
            title: "Segurança & RBAC",
            desc: "Cinco perfis, auditoria imutável, lixeira lógica e logs completos.",
          },
          {
            icon: Shield,
            title: "Automações",
            desc: "Admissão, desligamento e revisão de acesso executados sozinhos.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <f.icon className="h-8 w-8 text-accent" />
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} ProAccess • v1.0
      </footer>
    </div>
  );
}
