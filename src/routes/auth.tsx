import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      if (data.session.user?.role === "operador") {
        throw redirect({ to: "/chamados" });
      }
      throw redirect({ to: "/dashboard" });
    }
  },
});

function AuthPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const emailToUse = identifier.includes("@")
        ? identifier.trim().toLowerCase()
        : `${identifier.trim().toLowerCase()}@proacess.local`;

      const res = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (res.error || !res.data?.user) {
        setLoading(false);
        return toast.error("Credenciais inválidas", {
          description: res.error?.message || "Usuário ou senha incorretos",
        });
      }

      // Verificar se precisa trocar senha
      const { data: profile } = await supabase
        .from("profiles")
        .select("senha_alterada")
        .eq("id", res.data.user.id)
        .maybeSingle();

      setLoading(false);

      const isOperador = res.data.user.role === "operador";

      if (profile && !profile.senha_alterada) {
        toast.info("Primeiro acesso — troque sua senha");
        window.location.href = "/primeiro-acesso";
      } else if (isOperador) {
        toast.success("Bem-vindo!");
        window.location.href = "/chamados";
      } else {
        toast.success("Bem-vindo!");
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      setLoading(false);
      toast.error("Erro ao realizar login", {
        description: err?.message || "Ocorreu uma falha inesperada.",
      });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-primary/80 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Shield className="h-6 w-6 text-accent" />
          </div>
          <CardTitle className="text-2xl">ProAccess</CardTitle>
          <CardDescription>Entre com suas credenciais</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">E-mail ou Usuário</Label>
              <Input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Usuário master: <code className="rounded bg-muted px-1">Luiz.Reis</code>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
