import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileDown,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  Laptop,
  ShieldCheck,
  KeyRound,
  ClipboardList,
  LifeBuoy,
  Grid3x3,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/importar")({ component: Importar });

type TemplateKey =
  | "operacoes"
  | "sistemas"
  | "perfis_acesso"
  | "acessos"
  | "pendencias"
  | "chamados"
  | "matriz"
  | "inativos";

type TabGroup = "cadastro" | "sistemas" | "seguranca" | "processos";

const TEMPLATES: Record<
  TemplateKey,
  {
    title: string;
    desc: string;
    headers: string[];
    sample: Record<string, string>[];
    icon: any;
  }
> = {
  inativos: {
    title: "Usuários Inativos",
    desc: "Importe ou atualize usuários inativos (desligados/afastados) usando o mesmo layout da Matriz unificada.",
    icon: Users,
    headers: ["nome", "cpf", "email", "telefone", "cargo", "status", "data inativação"],
    sample: [
      {
        nome: "Maria Oliveira",
        cpf: "987.654.321-00",
        email: "maria@empresa.com",
        telefone: "11988888888",
        cargo: "Operador",
        status: "inativo",
        "data inativação": "2026-07-30",
      },
    ],
  },
  operacoes: {
    title: "Operações",
    desc: "Importe ou atualize operações/setores da empresa em lote.",
    icon: Building2,
    headers: ["nome", "descricao", "ativo"],
    sample: [
      {
        nome: "Operação São Paulo",
        descricao: "Central de Atendimento SP",
        ativo: "true",
      },
    ],
  },
  sistemas: {
    title: "Sistemas",
    desc: "Importe ou atualize sistemas homologados em lote.",
    icon: Laptop,
    headers: ["nome", "categoria", "criticidade", "descricao", "url", "ativo"],
    sample: [
      {
        nome: "SAP ERP",
        categoria: "Sistemas Core",
        criticidade: "alta",
        descricao: "Sistema ERP principal da empresa",
        url: "https://sap.empresa.local",
        ativo: "true",
      },
    ],
  },
  perfis_acesso: {
    title: "Perfis de Acesso",
    desc: "Importe perfis de acesso vinculados aos sistemas. O sistema correspondente é localizado pelo nome.",
    icon: ShieldCheck,
    headers: ["nome", "sistema", "descricao"],
    sample: [
      {
        nome: "Administrador SAP",
        sistema: "SAP ERP",
        descricao: "Perfil com privilégios administrativos no módulo SAP FI/CO",
      },
    ],
  },
  acessos: {
    title: "Acessos (Credenciais)",
    desc: "Vincule logins e senhas de sistemas aos colaboradores. Localização automática por CPF do colaborador, nome do sistema e nome do perfil de acesso (opcional).",
    icon: KeyRound,
    headers: ["cpf_colaborador", "sistema", "perfil_acesso", "login", "senha", "status"],
    sample: [
      {
        cpf_colaborador: "123.456.789-00",
        sistema: "SAP ERP",
        perfil_acesso: "Administrador SAP",
        login: "joao.silva",
        senha: "MinhaSenhaForte123",
        status: "ativo",
      },
    ],
  },
  pendencias: {
    title: "Processos (Pendências)",
    desc: "Importe pendências e fluxos de trabalho de acessos. Vinculação por nome ou CPF do colaborador, nome do sistema, status e etiquetas.",
    icon: ClipboardList,
    headers: [
      "titulo",
      "descricao",
      "tipo",
      "prioridade",
      "status",
      "colaborador",
      "sistema",
      "sla_em",
      "etiquetas",
    ],
    sample: [
      {
        titulo: "Criar Acesso SAP - João",
        descricao: "Realizar a criação de credencial do novo colaborador",
        tipo: "solicitacao_acesso",
        prioridade: "media",
        status: "PENDENTE",
        colaborador: "João da Silva",
        sistema: "SAP ERP",
        sla_em: "2026-08-05",
        etiquetas: "urgente;tributário",
      },
    ],
  },
  chamados: {
    title: "Chamados de Suporte",
    desc: "Importe tíquetes e chamados de suporte técnico de acessos em lote. Vinculação automática do sistema por nome, operador (usuário) e tratador técnico por e-mail.",
    icon: LifeBuoy,
    headers: [
      "titulo",
      "tipo",
      "status",
      "descricao",
      "sistema",
      "email_operador",
      "email_tratador",
      "resposta",
    ],
    sample: [
      {
        titulo: "Senha do SAP expirada",
        tipo: "erro",
        status: "aberto",
        descricao: "Usuário reporta bloqueio de login por tentativas incorretas",
        sistema: "SAP ERP",
        email_operador: "joao@empresa.com",
        email_tratador: "tecnico@empresa.com",
        resposta: "Solicitada redefinição provisória de senha",
      },
    ],
  },
  matriz: {
    title: "Matriz de Acessos Unificada",
    desc: "Importe ou atualize todos os colaboradores, seus dados cadastrais, status (ativo/inativo) e todas as suas credenciais de acesso de uma só vez usando um único arquivo de planilha unificado.",
    icon: Grid3x3,
    headers: ["nome", "cpf", "email", "telefone", "cargo", "status", "data inativação"],
    sample: [
      {
        nome: "João da Silva",
        cpf: "123.456.789-00",
        email: "joao@empresa.com",
        telefone: "11999999999",
        cargo: "Analista de Suporte",
        status: "ativo",
        "data inativação": "",
      },
    ],
  },
};

const TAB_GROUPS: { value: TabGroup; label: string; keys: TemplateKey[] }[] = [
  {
    value: "cadastro",
    label: "Pessoas e Estrutura",
    keys: ["matriz", "inativos", "operacoes"],
  },
  {
    value: "sistemas",
    label: "Sistemas e Perfis",
    keys: ["sistemas", "perfis_acesso"],
  },
  {
    value: "seguranca",
    label: "Acessos e Segurança",
    keys: ["acessos"],
  },
  {
    value: "processos",
    label: "Processos e Chamados",
    keys: ["pendencias", "chamados"],
  },
];

function downloadCSV(key: TemplateKey, sistemasAll: any[] = []) {
  let headers: string[];
  let sample: Record<string, string>[];

  if (key === "matriz" || key === "inativos") {
    headers = ["nome", "cpf", "email", "telefone", "cargo", "status", "data inativação"];
    const baseSample: Record<string, string> =
      key === "matriz"
        ? {
            nome: "João da Silva",
            cpf: "123.456.789-00",
            email: "joao@empresa.com",
            telefone: "11999999999",
            cargo: "Analista de Suporte",
            status: "ativo",
            "data inativação": "",
          }
        : {
            nome: "Maria Oliveira",
            cpf: "987.654.321-00",
            email: "maria@empresa.com",
            telefone: "11988888888",
            cargo: "Operador",
            status: "inativo",
            "data inativação": "2026-07-30",
          };
    for (const s of sistemasAll) {
      baseSample[`${s.nome} - Usuário`] = key === "matriz" ? "joao.silva" : "maria.oliveira";
      baseSample[`${s.nome} - Senha`] = key === "matriz" ? "SenhaTemporaria123" : "";
    }
    headers = [
      ...headers,
      ...sistemasAll.flatMap((s) => [`${s.nome} - Usuário`, `${s.nome} - Senha`]),
    ];
    sample = [baseSample];
  } else {
    const t = TEMPLATES[key];
    headers = t.headers;
    sample = t.sample;
  }

  const csv = Papa.unparse(
    {
      fields: headers,
      data: sample.map((r) => headers.map((h) => r[h] ?? "")),
    },
    {
      delimiter: ";", // Force semicolon delimiter so it opens as clean columns in Excel PT-BR!
    },
  );

  // Add sep=;\n directive for Excel + UTF-8 BOM so Excel automatically splits columns by semicolon
  const blob = new Blob(["\uFEFFsep=;\n" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `modelo_${key}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Importar() {
  const [activeTab, setActiveTab] = useState<TabGroup>("cadastro");

  const { data: sistemasAll = [] } = useQuery({
    queryKey: ["sistemas-import"],
    queryFn: async () => {
      const { data } = await db.from("sistemas").select("id, nome").order("nome");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Importar CSV
        </h1>
        <p className="text-muted-foreground mt-1">
          Baixe os modelos CSV com colunas pré-definidas (delimitadas por ponto e vírgula), preencha
          no Excel e faça o envio para importação direta no banco de dados.
        </p>
      </div>

      {/* Modern custom tab navigation */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 space-x-1 overflow-x-auto pb-px">
        {TAB_GROUPS.map((g) => (
          <button
            key={g.value}
            onClick={() => setActiveTab(g.value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-200 ${
              activeTab === g.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {TAB_GROUPS.find((g) => g.value === activeTab)?.keys.map((k) => (
          <ImportCard key={k} kind={k} sistemasAll={sistemasAll} />
        ))}
      </div>
    </div>
  );
}

function ImportCard({ kind, sistemasAll = [] }: { kind: TemplateKey; sistemasAll?: any[] }) {
  let t;
  if (kind === "matriz" || kind === "inativos") {
    const headers = [
      "nome",
      "cpf",
      "email",
      "telefone",
      "cargo",
      "status",
      "data inativação",
      ...sistemasAll.flatMap((s: any) => [`${s.nome} - Usuário`, `${s.nome} - Senha`]),
    ];
    t = {
      title: kind === "matriz" ? "Matriz de Acessos Unificada" : "Usuários Inativos",
      desc:
        kind === "matriz"
          ? "Importe ou atualize todos os colaboradores, seus dados cadastrais, status (ativo/inativo) e todas as suas credenciais de acesso de uma só vez usando um único arquivo de planilha unificado."
          : "Importe ou atualize usuários inativos (desligados/afastados) usando o mesmo layout da Matriz unificada.",
      headers,
      icon: kind === "matriz" ? Grid3x3 : Users,
    };
  } else {
    t = TEMPLATES[kind];
  }
  const Icon = t.icon;
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setResult(null);
    try {
      let text = await file.text();
      // Remove UTF-8 BOM if present
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
      }
      // Remove sep=; directive line if present at start of CSV
      text = text.replace(/^sep=\s*;\s*\r?\n/i, "");

      Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        delimitersToGuess: [";", ",", "\t"],
        complete: async (res) => {
          try {
            const rows = res.data
              .map((r) => {
                const newR: Record<string, string> = {};
                for (const [k, v] of Object.entries(r)) {
                  newR[k] = String(v ?? "").substring(0, 200);
                }
                return newR;
              })
              .filter((r) => Object.values(r).some((v) => v && String(v).trim()));
            if (rows.length === 0) {
              toast.warning("Arquivo CSV está vazio ou sem linhas de dados");
              setBusy(false);
              return;
            }
            const out = await importRows(kind, rows);
            setResult(out);
            if (out.ok > 0) {
              qc.invalidateQueries();
            }
            if (out.fail === 0) {
              toast.success(`${out.ok} registros importados com sucesso!`);
            } else {
              toast.warning(`${out.ok} importados, ${out.fail} falhas encontradas.`);
            }
          } catch (e: any) {
            toast.error(e.message ?? "Erro interno ao processar importação");
          } finally {
            setBusy(false);
          }
        },
        error: (err) => {
          toast.error(`Falha ao ler o arquivo CSV: ${err.message}`);
          setBusy(false);
        },
      });
    } catch (err: any) {
      toast.error(`Erro ao carregar o arquivo: ${err?.message || err}`);
      setBusy(false);
    }
  }

  return (
    <Card className="border border-neutral-200 dark:border-neutral-800 shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          <Icon className="h-5 w-5 text-primary" /> {t.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1.5">
            Colunas Esperadas (Delimitador: Semicolon / Ponto e vírgula ";")
          </span>
          <div className="flex flex-wrap gap-1.5">
            {t.headers.map((h) => (
              <Badge
                key={h}
                variant="secondary"
                className="font-mono text-[11px] px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              >
                {h}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => downloadCSV(kind, sistemasAll)}
            className="gap-2 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <FileDown className="h-4 w-4" /> Baixar Modelo Excel (.CSV)
          </Button>
          <label className="inline-flex cursor-pointer">
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
                <Upload className="h-4 w-4" /> {busy ? "Importando..." : "Selecionar e Enviar CSV"}
              </span>
            </Button>
          </label>
        </div>

        {result && (
          <div className="rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-4 text-sm space-y-2 mt-4 animate-fade-in">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Importados/Atualizados: {result.ok}
            </div>
            {result.fail > 0 && (
              <>
                <div className="flex items-center gap-2 text-destructive font-medium">
                  <AlertCircle className="h-4 w-4" /> Erros de Validação: {result.fail}
                </div>
                <div className="max-h-48 overflow-auto rounded-md bg-white dark:bg-neutral-950 p-3 border border-neutral-200 dark:border-neutral-800">
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {result.errors.slice(0, 30).map((e, i) => (
                      <li key={i} className="text-red-500 dark:text-red-400">
                        {e}
                      </li>
                    ))}
                    {result.errors.length > 30 && (
                      <li className="list-none text-neutral-400 pt-1">
                        ...e mais {result.errors.length - 30} erros ocultados.
                      </li>
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export async function importRows(kind: TemplateKey, rows: Record<string, string>[]) {
  const errors: string[] = [];
  let ok = 0,
    fail = 0;

  const cleanKey = (k: string) =>
    k
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const getRowVal = (row: Record<string, string>, possibleKeys: string[]): string => {
    const cleanPossible = possibleKeys.map((pk) => cleanKey(pk));
    for (const [rk, rv] of Object.entries(row)) {
      if (cleanPossible.includes(cleanKey(rk))) {
        return String(rv ?? "").trim();
      }
    }
    return "";
  };

  // Helper function to check if a value is actually different
  const isFieldDifferent = (k: string, existing: any, incoming: any): boolean => {
    if (incoming === null || incoming === undefined || incoming === "") {
      return false; // Skip empty incoming values to avoid overwriting existing data
    }
    if (existing === null || existing === undefined) {
      return true; // Any non-empty incoming value is different from null/undefined
    }

    if (k === "cpf" || k === "telefone") {
      const cleanEx = String(existing).replace(/\D/g, "");
      const cleanNew = String(incoming).replace(/\D/g, "");
      return cleanEx !== cleanNew;
    }

    if (k === "email" || k === "nome" || k === "cargo" || k === "status") {
      return String(existing).trim().toLowerCase() !== String(incoming).trim().toLowerCase();
    }

    if (k === "admissao_em" || k === "inativado_em") {
      try {
        const d1 = new Date(existing);
        let d2;
        const cleanInc = String(incoming).trim();
        if (cleanInc.includes("/")) {
          const parts = cleanInc.split("/");
          if (parts.length === 3) {
            d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          }
        }
        if (!d2 || isNaN(d2.getTime())) {
          d2 = new Date(cleanInc);
        }
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
          return String(existing).trim() !== String(incoming).trim();
        }
        return d1.toISOString().split("T")[0] !== d2.toISOString().split("T")[0];
      } catch (_) {
        return String(existing).trim() !== String(incoming).trim();
      }
    }

    return String(existing).trim() !== String(incoming).trim();
  };

  // 2. IMPORT OPERAÇÕES
  if (kind === "operacoes") {
    const { data: existentes } = await db.from("operacoes").select("id, nome, descricao, ativo");
    const opMap = new Map((existentes ?? []).map((o: any) => [o.nome.trim().toLowerCase(), o]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const nome = r.nome?.trim();
      const payload = {
        nome,
        descricao: r.descricao?.trim() || null,
        ativo: r.ativo ? String(r.ativo).toLowerCase() !== "false" : true,
      };

      if (!nome) {
        fail++;
        errors.push(`Linha ${i + 2}: O campo 'nome' é obrigatório.`);
        continue;
      }

      const ex = opMap.get(nome.toLowerCase());
      if (ex) {
        const diff: any = {};
        if (payload.descricao !== ex.descricao) diff.descricao = payload.descricao;
        if (payload.ativo !== ex.ativo) diff.ativo = payload.ativo;

        if (Object.keys(diff).length === 0) {
          ok++;
          continue;
        }

        const { error } = await db.from("operacoes").update(diff).eq("id", ex.id);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao atualizar: ${error.message}`);
        } else ok++;
      } else {
        const { error } = await db.from("operacoes").insert(payload);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao criar: ${error.message}`);
        } else ok++;
      }
    }
  }

  // 3. IMPORT SISTEMAS
  else if (kind === "sistemas") {
    const { data: existentes } = await db
      .from("sistemas")
      .select("id, nome, categoria, criticidade, descricao, url, ativo");
    const sisMap = new Map((existentes ?? []).map((s: any) => [s.nome.trim().toLowerCase(), s]));

    const validCrit = ["baixa", "media", "alta"];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const nome = r.nome?.trim();
      const rawCrit = (r.criticidade ?? "").trim().toLowerCase();
      const criticidade = validCrit.includes(rawCrit) ? rawCrit : "media";

      const payload: any = {
        nome,
        categoria: r.categoria?.trim() || null,
        criticidade: criticidade as any,
        descricao: r.descricao?.trim() || null,
        url: r.url?.trim() || null,
        ativo: r.ativo ? String(r.ativo).toLowerCase() !== "false" : true,
      };

      if (!nome) {
        fail++;
        errors.push(`Linha ${i + 2}: O campo 'nome' é obrigatório.`);
        continue;
      }

      const ex = sisMap.get(nome.toLowerCase());
      if (ex) {
        const diff: any = {};
        for (const [k, v] of Object.entries(payload)) {
          if (v === null || v === "") continue;
          if ((ex as any)[k] !== v) diff[k] = v;
        }
        if (Object.keys(diff).length === 0) {
          ok++;
          continue;
        }
        const { error } = await db.from("sistemas").update(diff).eq("id", ex.id);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao atualizar: ${error.message}`);
        } else ok++;
      } else {
        const { error } = await db.from("sistemas").insert(payload);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao criar: ${error.message}`);
        } else ok++;
      }
    }
  }

  // 4. IMPORT PERFIS DE ACESSO
  else if (kind === "perfis_acesso") {
    const { data: sis } = await db.from("sistemas").select("id, nome");
    const sisMap = new Map((sis ?? []).map((s: any) => [s.nome.trim().toLowerCase(), s.id]));

    const { data: existentes } = await db
      .from("perfis_acesso")
      .select("id, nome, sistema_id, descricao");
    const perfMap = new Map(
      (existentes ?? []).map((p: any) => [`${p.nome.trim().toLowerCase()}:${p.sistema_id}`, p]),
    );

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const nome = r.nome?.trim();
      const sistemaNome = r.sistema?.trim() || "";
      const sistemaId = sistemaNome ? sisMap.get(sistemaNome.toLowerCase()) : null;

      if (!nome) {
        fail++;
        errors.push(`Linha ${i + 2}: O campo 'nome' é obrigatório.`);
        continue;
      }
      if (!sistemaId) {
        fail++;
        errors.push(`Linha ${i + 2}: Sistema "${sistemaNome}" não encontrado ou não cadastrado.`);
        continue;
      }

      const key = `${nome.toLowerCase()}:${sistemaId}`;
      const ex = perfMap.get(key);
      const payload = {
        nome,
        sistema_id: sistemaId,
        descricao: r.descricao?.trim() || null,
      };

      if (ex) {
        const diff: any = {};
        if (payload.descricao !== ex.descricao) diff.descricao = payload.descricao;

        if (Object.keys(diff).length === 0) {
          ok++;
          continue;
        }
        const { error } = await db.from("perfis_acesso").update(diff).eq("id", ex.id);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao atualizar perfil: ${error.message}`);
        } else ok++;
      } else {
        const { error } = await db.from("perfis_acesso").insert(payload);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao criar perfil: ${error.message}`);
        } else ok++;
      }
    }
  }

  // 5. IMPORT ACESSOS / CREDENCIAIS
  else if (kind === "acessos") {
    const { data: cols } = await db.from("colaboradores").select("id, cpf");
    const { data: sis } = await db.from("sistemas").select("id, nome");
    const { data: perfis } = await db.from("perfis_acesso").select("id, nome, sistema_id");

    const colMap = new Map(
      (cols ?? []).filter((c: any) => c.cpf).map((c: any) => [c.cpf.replace(/\D/g, ""), c.id]),
    );
    const sisMap = new Map((sis ?? []).map((s: any) => [s.nome.toLowerCase().trim(), s.id]));
    const perfMap = new Map(
      (perfis ?? []).map((p: any) => [`${p.nome.toLowerCase().trim()}:${p.sistema_id}`, p.id]),
    );

    const { data: u } = await db.auth.getUser();
    const validStatuses = ["pendente", "ativo", "suspenso", "exclusao_pendente", "excluido"];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const cpfKey = (r.cpf_colaborador ?? "").replace(/\D/g, "");
      const colId = colMap.get(cpfKey);
      const sisId = r.sistema ? sisMap.get(r.sistema.trim().toLowerCase()) : null;

      if (!colId) {
        fail++;
        errors.push(`Linha ${i + 2}: Colaborador com CPF "${r.cpf_colaborador}" não cadastrado.`);
        continue;
      }
      if (!sisId) {
        fail++;
        errors.push(`Linha ${i + 2}: Sistema "${r.sistema}" não homologado ou não encontrado.`);
        continue;
      }

      const perfilNome = r.perfil_acesso?.trim() || "";
      const perfilId = perfilNome
        ? (perfMap.get(`${perfilNome.toLowerCase()}:${sisId}`) ?? null)
        : null;

      const rawStatus = (r.status ?? "").trim().toLowerCase();
      const status = validStatuses.includes(rawStatus) ? rawStatus : "pendente";

      const payload: any = {
        colaborador_id: colId,
        sistema_id: sisId,
        perfil_acesso_id: perfilId,
        login: r.login?.trim() || null,
        senha: r.senha?.trim() || null,
        status: status as any,
        concedido_por: u.user?.id ?? null,
        concedido_em: status === "ativo" ? new Date().toISOString() : null,
      };

      const { data: exAcesso } = await db
        .from("acessos")
        .select("id, login, senha, status, perfil_acesso_id")
        .eq("colaborador_id", colId)
        .eq("sistema_id", sisId)
        .maybeSingle();

      if (exAcesso) {
        const diff: any = {};
        if (payload.login && exAcesso.login !== payload.login) diff.login = payload.login;
        if (payload.senha && exAcesso.senha !== payload.senha) diff.senha = payload.senha;
        if (payload.status && exAcesso.status !== payload.status) diff.status = payload.status;
        if (payload.perfil_acesso_id && exAcesso.perfil_acesso_id !== payload.perfil_acesso_id) {
          diff.perfil_acesso_id = payload.perfil_acesso_id;
        }

        if (Object.keys(diff).length === 0) {
          ok++;
          continue;
        }
        const { error } = await db.from("acessos").update(diff).eq("id", exAcesso.id);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao atualizar credencial: ${error.message}`);
        } else ok++;
      } else {
        const { error } = await db.from("acessos").insert(payload);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao inserir credencial: ${error.message}`);
        } else ok++;
      }
    }
  }

  // 6. IMPORT PENDÊNCIAS
  else if (kind === "pendencias") {
    const { data: cols } = await db.from("colaboradores").select("id, cpf, nome, email");
    const { data: sis } = await db.from("sistemas").select("id, nome");
    const { data: users } = await db.from("profiles").select("id, email");

    const colMap = new Map();
    (cols ?? []).forEach((c: any) => {
      if (c.cpf) colMap.set(c.cpf.replace(/\D/g, ""), c.id);
      if (c.nome) colMap.set(c.nome.trim().toLowerCase(), c.id);
      if (c.email) colMap.set(c.email.trim().toLowerCase(), c.id);
    });

    const sisMap = new Map((sis ?? []).map((s: any) => [s.nome.trim().toLowerCase(), s.id]));
    const userMap = new Map((users ?? []).map((u: any) => [u.email.trim().toLowerCase(), u.id]));

    const { data: loggedIn } = await db.auth.getUser();

    const validPriorities = ["baixa", "media", "alta", "critica"];
    const validTypes = ["solicitacao_acesso", "exclusao_acesso", "revisao", "alteracao", "outro"];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const titulo = (r.titulo || r.título || "").trim();

      if (!titulo) {
        fail++;
        errors.push(`Linha ${i + 2}: O campo 'titulo' é obrigatório.`);
        continue;
      }

      const rawType = (r.tipo ?? "").trim().toLowerCase();
      const tipo = validTypes.includes(rawType) ? rawType : "solicitacao_acesso";

      const rawPriority = (r.prioridade ?? "").trim().toLowerCase();
      const prioridade = validPriorities.includes(rawPriority) ? rawPriority : "media";

      const status = (r.status ?? "").trim() || "PENDENTE";

      const colabVal = (r.colaborador || r.cpf_colaborador || r.cpf || "").trim();
      const colabDigits = colabVal.replace(/\D/g, "");
      const colId =
        (colabDigits ? colMap.get(colabDigits) : null) ??
        colMap.get(colabVal.toLowerCase()) ??
        null;

      const sisName = (r.sistema || r.nome_sistema || "").trim();
      const sisId = sisName ? (sisMap.get(sisName.toLowerCase()) ?? null) : null;

      const respEmail = (r.email_responsavel || r.responsavel || "").trim();
      const respId = respEmail ? (userMap.get(respEmail.toLowerCase()) ?? null) : null;

      const rawEtiquetas = r.etiquetas
        ? String(r.etiquetas)
            .split(/[,;]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

      const payload: any = {
        titulo,
        tipo: tipo as any,
        prioridade: prioridade as any,
        status: status as any,
        descricao: r.descricao?.trim() || null,
        colaborador_id: colId,
        sistema_id: sisId,
        responsavel_id: respId,
        data_inicio: r.data_inicio?.trim() || new Date().toISOString().split("T")[0],
        sla_em: r.sla_em?.trim() || null,
        etiquetas: rawEtiquetas,
        criado_por: loggedIn.user?.id ?? null,
      };

      // Check if similar task already exists for this collaborator + system or title
      const query = db.from("pendencias").select("id, status, prioridade, descricao");
      let existingPendencia: any = null;

      if (colId && sisId) {
        const { data } = await query
          .eq("titulo", titulo)
          .eq("colaborador_id", colId)
          .eq("sistema_id", sisId)
          .maybeSingle();
        existingPendencia = data;
      } else {
        const { data } = await query.eq("titulo", titulo).maybeSingle();
        existingPendencia = data;
      }

      if (existingPendencia) {
        const diff: any = {};
        if (payload.status !== existingPendencia.status) diff.status = payload.status;
        if (payload.prioridade !== existingPendencia.prioridade)
          diff.prioridade = payload.prioridade;
        if (payload.descricao && payload.descricao !== existingPendencia.descricao) {
          diff.descricao = payload.descricao;
        }

        if (Object.keys(diff).length === 0) {
          ok++;
          continue;
        }

        const { error } = await db.from("pendencias").update(diff).eq("id", existingPendencia.id);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao atualizar pendência: ${error.message}`);
        } else ok++;
      } else {
        const { error } = await db.from("pendencias").insert(payload);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao criar pendência: ${error.message}`);
        } else ok++;
      }
    }
  }

  // 7. IMPORT CHAMADOS
  else if (kind === "chamados") {
    const { data: sis } = await db.from("sistemas").select("id, nome");
    const { data: users } = await db.from("profiles").select("id, email");

    const sisMap = new Map((sis ?? []).map((s: any) => [s.nome.trim().toLowerCase(), s.id]));
    const userMap = new Map((users ?? []).map((u: any) => [u.email.trim().toLowerCase(), u.id]));

    const { data: loggedIn } = await db.auth.getUser();

    const validTypes = ["erro", "desbloqueio", "redefinicao_senha"];
    const validStatuses = ["aberto", "em_analise", "aceito", "recusado", "concluido"];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const titulo = r.titulo?.trim();

      if (!titulo) {
        fail++;
        errors.push(`Linha ${i + 2}: O campo 'titulo' é obrigatório.`);
        continue;
      }

      const rawType = (r.tipo ?? "").trim().toLowerCase();
      const tipo = validTypes.includes(rawType) ? rawType : "erro";

      const rawStatus = (r.status ?? "").trim().toLowerCase();
      const status = validStatuses.includes(rawStatus) ? rawStatus : "aberto";

      const sisName = r.sistema?.trim() || "";
      const sisId = sisName ? (sisMap.get(sisName.toLowerCase()) ?? null) : null;

      const opEmail = r.email_operador?.trim() || "";
      const opId = opEmail
        ? (userMap.get(opEmail.toLowerCase()) ?? loggedIn.user?.id)
        : loggedIn.user?.id;

      const tratadorEmail = r.email_tratador?.trim() || "";
      const tratadorId = tratadorEmail ? (userMap.get(tratadorEmail.toLowerCase()) ?? null) : null;

      const payload: any = {
        titulo,
        tipo,
        status,
        descricao: r.descricao?.trim() || null,
        sistema_id: sisId,
        operador_id: opId,
        tratador_id: tratadorId,
        resposta: r.resposta?.trim() || null,
      };

      // Check if ticket already exists for the user with same title
      const { data: exChamado } = await db
        .from("chamados")
        .select("id, status, resposta")
        .eq("titulo", titulo)
        .eq("operador_id", opId)
        .maybeSingle();

      if (exChamado) {
        const diff: any = {};
        if (payload.status !== exChamado.status) diff.status = payload.status;
        if (payload.resposta && payload.resposta !== exChamado.resposta)
          diff.resposta = payload.resposta;

        if (Object.keys(diff).length === 0) {
          ok++;
          continue;
        }

        const { error } = await db.from("chamados").update(diff).eq("id", exChamado.id);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao atualizar chamado: ${error.message}`);
        } else ok++;
      } else {
        const { error } = await db.from("chamados").insert(payload);
        if (error) {
          fail++;
          errors.push(`Linha ${i + 2}: Falha ao criar chamado: ${error.message}`);
        } else ok++;
      }
    }
  }

  // 8. IMPORT MATRIZ DE ACESSOS UNIFICADA
  else if (kind === "matriz" || kind === "inativos") {
    const { data: sis } = await db.from("sistemas").select("id, nome");
    const sistemasList = sis ?? [];

    const { data: existentes } = await db
      .from("colaboradores")
      .select("id, nome, cpf, email, telefone, cargo, status, inativado_em");

    const colabMap = new Map<string, any>();
    for (const c of existentes ?? []) {
      const cpfKey = (c.cpf ?? "").replace(/\D/g, "");
      const nomeKey = String(c.nome ?? "")
        .trim()
        .toLowerCase();
      if (cpfKey) colabMap.set(`cpf:${cpfKey}`, c);
      if (nomeKey) colabMap.set(`nome:${nomeKey}`, c);
    }

    const { data: loggedIn } = await db.auth.getUser();

    const validStatuses = ["ativo", "ferias", "afastado", "inativo", "desligado"];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      let nome = "";
      let rawCpf = "";
      let email = "";
      let telefone = "";
      let cargo = "";
      let rawStatus = "";
      let dataInativacao = "";

      const dataInativacaoKeys = [
        "data inativação",
        "data inativacao",
        "data_inativacao",
        "datainativacao",
        "inativado em",
        "inativado_em",
      ];

      for (const [rowKey, rowValue] of Object.entries(r)) {
        const lowerKey = rowKey.toLowerCase().trim();
        if (lowerKey === "nome") nome = String(rowValue ?? "").trim();
        else if (lowerKey === "cpf") rawCpf = String(rowValue ?? "").trim();
        else if (lowerKey === "email") email = String(rowValue ?? "").trim();
        else if (lowerKey === "telefone") telefone = String(rowValue ?? "").trim();
        else if (lowerKey === "cargo") cargo = String(rowValue ?? "").trim();
        else if (lowerKey === "status") rawStatus = String(rowValue ?? "").trim();
        else if (dataInativacaoKeys.includes(lowerKey))
          dataInativacao = String(rowValue ?? "").trim();
      }

      if (!nome) {
        fail++;
        errors.push(`Linha ${i + 2}: O campo 'nome' é obrigatório.`);
        continue;
      }

      const cpfKey = rawCpf.replace(/\D/g, "");
      const nomeKey = nome.toLowerCase();

      const colabExistente =
        (cpfKey && colabMap.get(`cpf:${cpfKey}`)) || colabMap.get(`nome:${nomeKey}`);

      const status = validStatuses.includes(rawStatus.toLowerCase())
        ? rawStatus.toLowerCase()
        : "ativo";

      let inativado_em = null;
      if (status === "inativo" || status === "desligado") {
        if (dataInativacao) {
          try {
            let parsedDate;
            if (dataInativacao.includes("/")) {
              const parts = dataInativacao.split("/");
              if (parts.length === 3) {
                parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              }
            }
            if (!parsedDate || isNaN(parsedDate.getTime())) {
              parsedDate = new Date(dataInativacao);
            }
            if (!isNaN(parsedDate.getTime())) {
              inativado_em = parsedDate.toISOString();
            } else {
              inativado_em = colabExistente?.inativado_em || new Date().toISOString();
            }
          } catch (_) {
            inativado_em = colabExistente?.inativado_em || new Date().toISOString();
          }
        } else {
          inativado_em = colabExistente?.inativado_em || new Date().toISOString();
        }
      }

      const colabPayload: any = {
        nome,
        cpf: rawCpf || null,
        email: email || null,
        telefone: telefone || null,
        cargo: cargo || null,
        status: status as any,
        inativado_em,
      };

      let colId: string;

      if (colabExistente) {
        colId = colabExistente.id;
        const diff: any = {};
        for (const [k, v] of Object.entries(colabPayload)) {
          if (isFieldDifferent(k, colabExistente[k], v)) {
            diff[k] = v;
          }
        }

        if (Object.keys(diff).length > 0) {
          const { error } = await db.from("colaboradores").update(diff).eq("id", colId);
          if (error) {
            fail++;
            errors.push(`Linha ${i + 2}: Falha ao atualizar colaborador: ${error.message}`);
            continue;
          }
        }
      } else {
        const { data: novoColab, error } = await db
          .from("colaboradores")
          .insert(colabPayload)
          .select("id")
          .maybeSingle();

        if (error || !novoColab) {
          fail++;
          errors.push(
            `Linha ${i + 2}: Falha ao cadastrar colaborador: ${error?.message || "Erro desconhecido"}`,
          );
          continue;
        }
        colId = novoColab.id;
        const newColabObj = { id: colId, ...colabPayload };
        if (cpfKey) colabMap.set(`cpf:${cpfKey}`, newColabObj);
        if (nomeKey) colabMap.set(`nome:${nomeKey}`, newColabObj);
      }

      const isOperadorCargo =
        (cargo || colabExistente?.cargo || "").toLowerCase().trim() === "operador";
      if (isOperadorCargo && (rawCpf || colabExistente?.cpf)) {
        try {
          const { createOperadorFromColaborador } = await import("@/lib/admin-users.functions");
          await createOperadorFromColaborador({ data: { colaborador_id: colId } });
        } catch (err) {
          console.error("Erro ao criar operador no login:", err);
        }
      }

      let rowCredErrors = false;
      for (const s of sistemasList) {
        const userKeys = [
          `${s.nome} - Usuário`,
          `${s.nome} - Usuario`,
          `${s.nome} - usuario`,
          `${s.nome} - usuário`,
        ].map((k) => k.toLowerCase());
        const passKeys = [`${s.nome} - Senha`, `${s.nome} - senha`].map((k) => k.toLowerCase());

        let userVal = "";
        let passVal = "";

        for (const [rowKey, rowValue] of Object.entries(r)) {
          const lowerKey = rowKey.toLowerCase().trim();
          if (userKeys.includes(lowerKey)) {
            userVal = String(rowValue ?? "").trim();
          }
          if (passKeys.includes(lowerKey)) {
            passVal = String(rowValue ?? "").trim();
          }
        }

        if (userVal || passVal) {
          const { data: exAcesso } = await db
            .from("acessos")
            .select("id, login, senha, status")
            .eq("colaborador_id", colId)
            .eq("sistema_id", s.id)
            .maybeSingle();

          const accessPayload: any = {
            colaborador_id: colId,
            sistema_id: s.id,
            login: userVal || null,
            senha: passVal || null,
            status: status === "inativo" || status === "desligado" ? "inativo" : "ativo",
            concedido_por: loggedIn.user?.id ?? null,
            concedido_em: new Date().toISOString(),
          };

          if (exAcesso) {
            const accessDiff: any = {};
            if (accessPayload.login && exAcesso.login !== accessPayload.login)
              accessDiff.login = accessPayload.login;
            if (accessPayload.senha && exAcesso.senha !== accessPayload.senha)
              accessDiff.senha = accessPayload.senha;
            if (accessPayload.status && exAcesso.status !== accessPayload.status)
              accessDiff.status = accessPayload.status;

            if (Object.keys(accessDiff).length > 0) {
              const { error } = await db.from("acessos").update(accessDiff).eq("id", exAcesso.id);
              if (error) {
                rowCredErrors = true;
                errors.push(
                  `Linha ${i + 2} (${s.nome}): Erro ao atualizar credencial: ${error.message}`,
                );
              }
            }
          } else {
            const { error } = await db.from("acessos").insert(accessPayload);
            if (error) {
              rowCredErrors = true;
              errors.push(
                `Linha ${i + 2} (${s.nome}): Erro ao inserir credencial: ${error.message}`,
              );
            }
          }
        }
      }

      if (rowCredErrors) {
        fail++;
      } else {
        ok++;
      }
    }
  }

  return { ok, fail, errors };
}
