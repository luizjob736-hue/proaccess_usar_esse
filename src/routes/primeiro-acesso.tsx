import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { db } from "@/integrations/database/client";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/primeiro-acesso")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await db.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: PrimeiroAcesso,
});

function PrimeiroAcesso() {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Senha deve ter pelo menos 8 caracteres");
    if (pwd !== confirm) return toast.error("Senhas não conferem");
    setLoading(true);
    const { error } = await db.auth.updateUser({ password: pwd });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    const { data: u } = await db.auth.getUser();
    if (u.user) await db.from("profiles").update({ senha_alterada: true }).eq("id", u.user.id);
    setLoading(false);
    toast.success("Senha alterada");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary to-primary/80 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>Primeiro acesso</CardTitle>
          <CardDescription>Defina uma nova senha para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                required
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
