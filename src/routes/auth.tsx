import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, AlertCircle, Eye, EyeOff, KeyRound, Database, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { db } from "@/integrations/database/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    try {
      const { data } = await db.auth.getUser();
      if (data?.user) {
        if (data.user.role === "operador") {
          throw redirect({ to: "/chamados" });
        }
        throw redirect({ to: "/dashboard" });
      }
    } catch (err: any) {
      if (err?.to) throw err;
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg("Preencha todos os campos");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await db.auth.signInWithPassword({
        email: identifier.trim(),
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
      const user = res.data.user;
      const isOperador = user.role === "operador";
      const senhaAlterada = user.user_metadata?.senha_alterada;

      toast.success(`Bem-vindo, ${user.user_metadata?.nome || user.email}!`);

      if (senhaAlterada === false) {
        toast.info("Primeiro acesso — altere sua senha");
        navigate({ to: "/primeiro-acesso" });
      } else if (isOperador) {
        navigate({ to: "/chamados" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      setLoading(false);
      const msg = err?.message || "Ocorreu uma falha ao autenticar.";
      setErrorMsg(msg);
      toast.error("Erro ao realizar login", { description: msg });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden transition-colors duration-300">
      {/* Background decoration */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md shadow-xl border border-border bg-card text-card-foreground z-10">
        <CardHeader className="space-y-2 text-center pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            ProAccess
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Gestão Integrada de Acessos e Matriz de Perfis
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {errorMsg && (
            <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/25 font-medium animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1 text-left">
                <p className="font-semibold text-destructive">Falha na autenticação</p>
                <p className="text-xs text-destructive/90 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-foreground text-sm font-medium">
                Usuário, E-mail ou Nome
              </Label>
              <div className="relative">
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Ex: luiz.reis, admin, email@empresa.com"
                  required
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMsg(null);
                  }}
                  className={cn(
                    "bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-11 transition-all duration-200",
                    errorMsg && "border-destructive focus-visible:ring-destructive",
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  className={cn(
                    "bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-11 pr-10 transition-all duration-200",
                    errorMsg && "border-destructive focus-visible:ring-destructive",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold text-base transition-all shadow-md mt-2"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  <span>Autenticando...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Lock className="h-4 w-4" />
                  <span>Entrar no Sistema</span>
                </div>
              )}
            </Button>
          </form>

          <div className="pt-2 text-center border-t border-border mt-4">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                Autenticação segura via Neon Postgres (
                <code className="text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                  profiles
                </code>
                )
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
