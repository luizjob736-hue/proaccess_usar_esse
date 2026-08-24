import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BellOff, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notificacoes")({ component: Notif });

function Notif() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notificações</h1>
        <p className="text-muted-foreground">Central de alertas e avisos do sistema</p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-2">
            <BellOff className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">Módulo Temporariamente Desativado</CardTitle>
        </CardHeader>
        <CardContent className="text-center max-w-md mx-auto space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            A central de notificações está inativada temporariamente e não será utilizada neste
            momento.
          </p>
          <Link to="/dashboard">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
