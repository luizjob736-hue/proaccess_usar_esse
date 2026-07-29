import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Mail, Briefcase, Building2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/colaboradores/$id")({
  component: ColabDetalhe,
});

function ColabDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: c } = useQuery({
    queryKey: ["colab", id],
    queryFn: async () =>
      (
        await supabase
          .from("colaboradores")
          .select("*, operacao:operacoes(nome)")
          .eq("id", id)
          .single()
      ).data,
  });
  const { data: acessos = [] } = useQuery({
    queryKey: ["acessos-colab", id],
    queryFn: async () =>
      (
        await supabase
          .from("acessos")
          .select("*, sistema:sistemas(nome), perfil:perfis_acesso(nome)")
          .eq("colaborador_id", id)
          .order("criado_em", { ascending: false })
      ).data ?? [],
  });
  const { data: historico = [] } = useQuery({
    queryKey: ["hist-colab", id],
    queryFn: async () =>
      (
        await supabase
          .from("historico")
          .select("*")
          .eq("entidade", "colaboradores")
          .eq("entidade_id", id)
          .order("criado_em", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  const updateStatus = useMutation({
    mutationFn: async (status: any) => {
      const patch: any = { status };
      if (status === "desligado") patch.desligamento_em = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("colaboradores").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado — automação executada");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!c) return <p>Carregando...</p>;

  return (
    <div className="space-y-6">
      <Link
        to="/colaboradores"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{c.nome}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" /> {c.email || "—"}
            </div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" /> {c.cargo || "—"}
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> {c.operacao?.nome || "—"}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" /> Admissão:{" "}
              {c.admissao_em || "—"}
            </div>
            <div className="flex items-center gap-2">
              <Badge>{c.status}</Badge>
              <Select onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Alterar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="desligado">Desligar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>QR Code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <QRCodeSVG value={`proacess:colaborador:${c.id}`} size={140} />
            <p className="text-xs text-muted-foreground">Matrícula: {c.matricula || "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="acessos">
        <TabsList>
          <TabsTrigger value="acessos">Acessos ({acessos.length})</TabsTrigger>
          <TabsTrigger value="historico">Timeline ({historico.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="acessos" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {acessos.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{a.sistema?.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Perfil: {a.perfil?.nome || "—"} • Login: {a.login || "—"}
                      </p>
                    </div>
                    <Badge variant={a.status === "ativo" ? "default" : "outline"}>{a.status}</Badge>
                  </div>
                ))}
                {acessos.length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">Sem acessos.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {historico.map((h: any) => (
                  <div key={h.id} className="p-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{h.acao}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.criado_em).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                ))}
                {historico.length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">Sem histórico.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
