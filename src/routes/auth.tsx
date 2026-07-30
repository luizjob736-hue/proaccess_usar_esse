import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, AlertCircle, Eye, EyeOff, KeyRound, Database, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getUser();
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
      const res = await supabase.auth.signInWithPassword({
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md shadow-2xl border-slate-800 bg-slate-900/90 backdrop-blur text-slate-100 z-10">
        <CardHeader className="space-y-2 text-center pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">ProAccess</CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Gestão Integrada de Acessos e Matriz de Perfis
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-slate-200 text-sm font-medium">
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
                  className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200 text-sm font-medium">
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
                  className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-primary h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
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
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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

          <div className="pt-2 text-center border-t border-slate-800/80 mt-4">
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Autenticação segura via Neon Postgres (
                <code className="text-slate-400 font-mono">profiles</code>)
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
