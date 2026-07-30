import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, FileDown, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/importar")({ component: Importar });

type TemplateKey = "colaboradores" | "sistemas" | "acessos";

const TEMPLATES: Record<
  TemplateKey,
  { title: string; desc: string; headers: string[]; sample: Record<string, string>[] }
> = {
  colaboradores: {
    title: "Colaboradores",
    desc: "Importe colaboradores em lote. Campos aceitos abaixo. A coluna 'operacao' é opcional e será vinculada pelo nome.",
    headers: [
      "nome",
      "cpf",
      "matricula",
      "email",
      "email_senha",
      "telefone",
      "cargo",
      "operacao",
      "admissao_em",
      "status",
    ],
    sample: [
      {
        nome: "João da Silva",
        cpf: "123.456.789-00",
        matricula: "M001",
        email: "joao@empresa.com",
        email_senha: "senhaSegura123",
        telefone: "11999999999",
        cargo: "Analista",
        operacao: "Operação A",
        admissao_em: "2025-01-15",
        status: "ativo",
      },
    ],
  },
  sistemas: {
    title: "Sistemas",
    desc: "Importe sistemas em lote.",
    headers: ["nome", "categoria", "criticidade", "descricao", "url", "ativo"],
    sample: [
      {
        nome: "SAP",
        categoria: "ERP",
        criticidade: "alta",
        descricao: "Sistema ERP",
        url: "https://sap.empresa.com",
        ativo: "true",
      },
    ],
  },
  acessos: {
    title: "Acessos (com credenciais)",
    desc: "Importe acessos em lote. Vinculação pelo CPF do colaborador e nome do sistema.",
    headers: ["cpf_colaborador", "sistema", "login", "senha", "status"],
    sample: [
      {
        cpf_colaborador: "123.456.789-00",
        sistema: "SAP",
        login: "joao.silva",
        senha: "MinhaSenha!23",
        status: "ativo",
      },
    ],
  },
};

function downloadCSV(key: TemplateKey) {
  const t = TEMPLATES[key];
  const csv = Papa.unparse({
    fields: t.headers,
    data: t.sample.map((r) => t.headers.map((h) => r[h] ?? "")),
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `modelo_${key}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Importar() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importar CSV</h1>
        <p className="text-muted-foreground">
          Baixe o modelo, preencha e faça upload para importação em lote.
        </p>
      </div>
      {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
        <ImportCard key={k} kind={k} />
      ))}
    </div>
  );
}

function ImportCard({ kind }: { kind: TemplateKey }) {
  const t = TEMPLATES[kind];
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        try {
          const rows = res.data.filter((r) => Object.values(r).some((v) => v && String(v).trim()));
          if (rows.length === 0) {
            toast.warning("CSV vazio");
            setBusy(false);
            return;
          }
          const out = await importRows(kind, rows);
          setResult(out);
          if (out.fail === 0) toast.success(`${out.ok} registro(s) importado(s)`);
          else toast.warning(`${out.ok} importados, ${out.fail} com erro`);
        } catch (e: any) {
          toast.error(e.message ?? "Erro ao importar");
        } finally {
          setBusy(false);
        }
      },
      error: (err) => {
        toast.error(err.message);
        setBusy(false);
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4" /> {t.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t.desc}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {t.headers.map((h) => (
            <Badge key={h} variant="outline" className="font-mono text-[10px]">
              {h}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadCSV(kind)} className="gap-2">
            <FileDown className="h-4 w-4" /> Baixar modelo CSV
          </Button>
          <label className="inline-flex">
            <Input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.currentTarget.value = "";
              }}
            />
            <Button asChild disabled={busy} className="gap-2">
              <span>
                <Upload className="h-4 w-4" /> {busy ? "Importando..." : "Enviar CSV"}
              </span>
            </Button>
          </label>
        </div>
        {result && (
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Importados: {result.ok}
            </div>
            {result.fail > 0 && (
              <>
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" /> Falhas: {result.fail}
                </div>
                <ul className="list-disc pl-6 text-xs text-muted-foreground max-h-40 overflow-auto">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function importRows(kind: TemplateKey, rows: Record<string, string>[]) {
  const errors: string[] = [];
  let ok = 0,
    fail = 0;

  if (kind === "colaboradores") {
    const { data: ops } = await db.from("operacoes").select("id,nome");
    const opMap = new Map((ops ?? []).map((o: any) => [o.nome.toLowerCase(), o.id]));
    const { data: existentes } = await db
      .from("colaboradores")
      .select(
        "id, nome, cpf, matricula, email, email_senha, telefone, cargo, operacao_id, admissao_em, status",
      );
    const byKey = new Map<string, any>();
    for (const c of existentes ?? []) {
      const cpfKey = (c.cpf ?? "").replace(/\D/g, "");
      const nomeKey = String(c.nome ?? "")
        .trim()
        .toLowerCase();
      if (cpfKey) byKey.set(`cpf:${cpfKey}`, c);
      if (nomeKey) byKey.set(`nome:${nomeKey}`, c);
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const cpfKey = (r.cpf ?? "").replace(/\D/g, "");
      const nomeKey = String(r.nome ?? "")
        .trim()
        .toLowerCase();
      const payload: any = {
        nome: r.nome?.trim(),
        cpf: r.cpf?.trim() || null,
        matricula: r.matricula?.trim() || null,
        email: r.email?.trim() || null,
        email_senha: r.email_senha?.trim() || null,
        telefone: r.telefone?.trim() || null,
        cargo: r.cargo?.trim() || null,
        operacao_id: r.operacao ? (opMap.get(r.operacao.trim().toLowerCase()) ?? null) : null,
        admissao_em: r.admissao_em?.trim() || null,
        status: (r.status?.trim() as any) || "ativo",
      };
      if (!payload.nome) {
        fail++;
        errors.push(`Linha ${i + 2}: nome é obrigatório`);
        continue;
      }
      const existente = (cpfKey && byKey.get(`cpf:${cpfKey}`)) || byKey.get(`nome:${nomeKey}`);
      if (existente) {
        // atualiza apenas campos divergentes (mantém valor existente quando novo veio vazio)
        const diff: any = {};
        for (const [k, v] of Object.entries(payload)) {
          if (v == null || v === "") continue;
          if ((existente as any)[k] !== v) diff[k] = v;
        }
        if (Object.keys(diff).length === 0) {
          ok++;
          continue;
        }
        const { error } = await db.from("colaboradores").update(diff).eq("id", existente.id);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: ${error.message}`);
        } else ok++;
      } else {
        const { error } = await db.from("colaboradores").insert(payload);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: ${error.message}`);
        } else ok++;
      }
    }
  } else if (kind === "sistemas") {
    const { data: existentes } = await db
      .from("sistemas")
      .select("id, nome, categoria, criticidade, descricao, url, ativo");
    const sisMap = new Map((existentes ?? []).map((s: any) => [s.nome.trim().toLowerCase(), s]));
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const payload: any = {
        nome: r.nome?.trim(),
        categoria: r.categoria?.trim() || null,
        criticidade: (r.criticidade?.trim() as any) || "media",
        descricao: r.descricao?.trim() || null,
        url: r.url?.trim() || null,
        ativo: r.ativo ? String(r.ativo).toLowerCase() !== "false" : true,
      };
      if (!payload.nome) {
        fail++;
        errors.push(`Linha ${i + 2}: nome é obrigatório`);
        continue;
      }
      const ex = sisMap.get(payload.nome.toLowerCase());
      if (ex) {
        const diff: any = {};
        for (const [k, v] of Object.entries(payload)) {
          if (v == null || v === "") continue;
          if ((ex as any)[k] !== v) diff[k] = v;
        }
        if (Object.keys(diff).length === 0) {
          ok++;
          continue;
        }
        const { error } = await db.from("sistemas").update(diff).eq("id", ex.id);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: ${error.message}`);
        } else ok++;
      } else {
        const { error } = await db.from("sistemas").insert(payload);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: ${error.message}`);
        } else ok++;
      }
    }
  } else if (kind === "acessos") {
    const { data: cols } = await db.from("colaboradores").select("id,cpf");
    const { data: sis } = await db.from("sistemas").select("id,nome");
    const colMap = new Map(
      (cols ?? []).filter((c: any) => c.cpf).map((c: any) => [c.cpf.replace(/\D/g, ""), c.id]),
    );
    const sisMap = new Map((sis ?? []).map((s: any) => [s.nome.toLowerCase(), s.id]));
    const { data: u } = await db.auth.getUser();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const cpfKey = (r.cpf_colaborador ?? "").replace(/\D/g, "");
      const colId = colMap.get(cpfKey);
      const sisId = sisMap.get((r.sistema ?? "").trim().toLowerCase());
      if (!colId) {
        fail++;
        errors.push(`Linha ${i + 2}: colaborador com CPF ${r.cpf_colaborador} não encontrado`);
        continue;
      }
      if (!sisId) {
        fail++;
        errors.push(`Linha ${i + 2}: sistema "${r.sistema}" não encontrado`);
        continue;
      }
      const status = (r.status?.trim() as any) || "pendente";
      const payload: any = {
        colaborador_id: colId,
        sistema_id: sisId,
        login: r.login?.trim() || null,
        senha: r.senha?.trim() || null,
        status,
        concedido_por: u.user?.id ?? null,
        concedido_em: status === "ativo" ? new Date().toISOString() : null,
      };

      const { data: exAcesso } = await db
        .from("acessos")
        .select("id, login, senha, status")
        .eq("colaborador_id", colId)
        .eq("sistema_id", sisId)
        .maybeSingle();

      if (exAcesso) {
        const diff: any = {};
        if (payload.login && exAcesso.login !== payload.login) diff.login = payload.login;
        if (payload.senha && exAcesso.senha !== payload.senha) diff.senha = payload.senha;
        if (payload.status && exAcesso.status !== payload.status) diff.status = payload.status;
        if (Object.keys(diff).length === 0) {
          ok++;
          continue;
        }
        const { error } = await db.from("acessos").update(diff).eq("id", exAcesso.id);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: ${error.message}`);
        } else ok++;
      } else {
        const { error } = await db.from("acessos").insert(payload);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: ${error.message}`);
        } else ok++;
      }
    }
  }

  return { ok, fail, errors };
}
