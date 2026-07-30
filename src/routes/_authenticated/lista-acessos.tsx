import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { List, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lista-acessos")({ component: ListaAcessos });

type Lista = { id: string; titulo: string; posicao: number; colunas: string[]; linhas: string[][] };

function ListaAcessos() {
  const qc = useQueryClient();
  const { data: listas = [] } = useQuery({
    queryKey: ["lista-acessos"],
    queryFn: async () => {
      const { data, error } = await (db as any).from("lista_acessos").select("*").order("posicao");
      if (error) throw error;
      return (data as Lista[]) ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (l: Lista) => {
      const { error } = await (db as any)
        .from("lista_acessos")
        .update({
          titulo: l.titulo,
          colunas: l.colunas,
          linhas: l.linhas,
        })
        .eq("id", l.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["lista-acessos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await (db as any).from("lista_acessos").insert({
        titulo: "Nova lista",
        posicao: listas.length,
        colunas: ["Coluna 1", "Coluna 2"],
        linhas: [["", ""]],
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lista-acessos"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (db as any).from("lista_acessos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["lista-acessos"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lista de Acessos</h1>
          <p className="text-muted-foreground">Tabelas informativas 100% editáveis</p>
        </div>
        <Button onClick={() => create.mutate()} className="gap-2">
          <Plus className="h-4 w-4" /> Nova tabela
        </Button>
      </div>

      {listas.map((l) => (
        <ListaEditor
          key={l.id}
          lista={l}
          onSave={(v) => save.mutate(v)}
          onDelete={() => remove.mutate(l.id)}
        />
      ))}

      {listas.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-center text-muted-foreground">
            Nenhuma tabela. Clique em "Nova tabela".
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ListaEditor({
  lista,
  onSave,
  onDelete,
}: {
  lista: Lista;
  onSave: (l: Lista) => void;
  onDelete: () => void;
}) {
  const [state, setState] = useState<Lista>(lista);
  const dirty = JSON.stringify(state) !== JSON.stringify(lista);

  function setCell(r: number, c: number, v: string) {
    setState((s) => {
      const linhas = s.linhas.map((row, i) =>
        i === r ? row.map((cell, j) => (j === c ? v : cell)) : row,
      );
      return { ...s, linhas };
    });
  }
  function setColuna(i: number, v: string) {
    setState((s) => ({ ...s, colunas: s.colunas.map((c, idx) => (idx === i ? v : c)) }));
  }
  function addLinha() {
    setState((s) => ({ ...s, linhas: [...s.linhas, s.colunas.map(() => "")] }));
  }
  function removeLinha(i: number) {
    setState((s) => ({ ...s, linhas: s.linhas.filter((_, idx) => idx !== i) }));
  }
  function addColuna() {
    setState((s) => ({
      ...s,
      colunas: [...s.colunas, "Nova"],
      linhas: s.linhas.map((r) => [...r, ""]),
    }));
  }
  function removeColuna(i: number) {
    setState((s) => ({
      ...s,
      colunas: s.colunas.filter((_, idx) => idx !== i),
      linhas: s.linhas.map((r) => r.filter((_, idx) => idx !== i)),
    }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <List className="h-4 w-4 text-accent" />
        <Input
          value={state.titulo}
          onChange={(e) => setState({ ...state, titulo: e.target.value })}
          className="flex-1 text-lg font-semibold border-0 focus-visible:ring-0 shadow-none px-0"
        />
        <Button size="sm" variant="outline" onClick={addLinha} className="gap-1">
          <Plus className="h-3 w-3" /> Linha
        </Button>
        <Button size="sm" variant="outline" onClick={addColuna} className="gap-1">
          <Plus className="h-3 w-3" /> Coluna
        </Button>
        <Button size="sm" disabled={!dirty} onClick={() => onSave(state)}>
          Salvar
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-accent/10">
            <tr>
              {state.colunas.map((c, i) => (
                <th key={i} className="p-1 border">
                  <div className="flex items-center gap-1">
                    <Input
                      value={c}
                      onChange={(e) => setColuna(i, e.target.value)}
                      className="h-8 font-semibold text-center"
                    />
                    <button
                      onClick={() => removeColuna(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-8 border" />
            </tr>
          </thead>
          <tbody>
            {state.linhas.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border p-0">
                    <Input
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      className="h-9 border-0 focus-visible:ring-1 rounded-none"
                    />
                  </td>
                ))}
                <td className="border text-center">
                  <button
                    onClick={() => removeLinha(r)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
