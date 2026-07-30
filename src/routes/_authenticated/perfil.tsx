import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({ component: Perfil });

function Perfil() {
  const { data: me } = useQuery({
    queryKey: ["me-full"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return null;
      const { data: prof } = await db.from("profiles").select("*").eq("id", u.user.id).single();
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
      return { profile: prof, roles: (roles ?? []).map((r) => r.role) };
    },
  });
  const [pwd, setPwd] = useState("");
  async function changePwd() {
    if (pwd.length < 8) return toast.error("Mínimo 8 caracteres");
    const { error } = await db.auth.updateUser({ password: pwd });
    if (error) return toast.error(error.message);
    setPwd("");
    toast.success("Senha alterada");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meu Perfil</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Nome:</strong> {me?.profile?.nome}
          </p>
          <p>
            <strong>E-mail:</strong> {me?.profile?.email}
          </p>
          <p>
            <strong>Papéis:</strong>{" "}
            {me?.roles.map((r: string) => (
              <Badge key={r} className="ml-1">
                {r}
              </Badge>
            ))}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="flex-1">
            <Label>Nova senha</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <Button onClick={changePwd}>Salvar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
