import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      if (data.user.role === "operador") {
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const emailToUse = identifier.includes("@")
        ? identifier.trim().toLowerCase()
        : `${identifier.trim().toLowerCase()}@proacess.local`;

      const res = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password.trim(),
      });

      if (res.error || !res.data?.user) {
        setLoading(false);
        const errMsg = res.error?.message || "Usuário ou senha incorretos";
        setErrorMsg(errMsg);
        return toast.error("Falha no login", {
          description: errMsg,
        });
      }

      setLoading(false);
      const isOperador = res.data.user.role === "operador";
      const senhaAlterada = res.data.user.user_metadata?.senha_alterada;

      toast.success("Login realizado com sucesso!");

      if (senhaAlterada === false) {
        toast.info("Primeiro acesso — troque sua senha");
        window.location.replace("/primeiro-acesso");
      } else if (isOperador) {
        window.location.replace("/chamados");
      } else {
        window.location.replace("/dashboard");
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      setLoading(false);
      const msg = err?.message || "Ocorreu uma falha inesperada.";
      setErrorMsg(msg);
      toast.error("Erro ao realizar login", {
        description: msg,
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
          <CardDescription>Gestão de Acessos e Perfis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">E-mail ou Usuário</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Digite seu e-mail ou usuário"
                required
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setErrorMsg(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
              />
            </div>
            <Button type="submit" className="w-full font-semibold" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


