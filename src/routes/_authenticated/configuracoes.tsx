import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/configuracoes")({ component: Config });

function Config() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle(v: boolean) {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("proacess-theme", v ? "dark" : "light");
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Preferências pessoais</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label htmlFor="dark">Modo escuro</Label>
          <Switch id="dark" checked={dark} onCheckedChange={toggle} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Atalhos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <kbd className="rounded bg-muted px-1.5">⌘K</kbd> — Busca global / comandos rápidos
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
