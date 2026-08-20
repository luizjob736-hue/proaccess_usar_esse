import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { matchesColumnStatus } from "./pendencias";
import { OperationFilterBar } from "@/components/OperationFilterBar";

export function parseDateToISO(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  // 1. Check Excel serial date number (e.g. 33009 for 1990-05-15, 45869 for 2025)
  if (!isNaN(Number(str)) && Number(str) > 1000 && Number(str) < 90000) {
    const excelNum = Number(str);
    const dateObj = new Date((excelNum - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dateObj.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  // 2. Check Brazilian date format DD/MM/YYYY or DD/MM/YY (supports /, ., -)
  const brMatch = str.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (brMatch) {
    const p1 = Number(brMatch[1]);
    const p2 = Number(brMatch[2]);
    let yearStr = brMatch[3];

    if (yearStr.length === 2) {
      const numY = Number(yearStr);
      yearStr = numY > 30 ? `19${yearStr}` : `20${yearStr}`;
    }

    let day = p1;
    let month = p2;

    if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1;
    }

    const dayStr = String(day).padStart(2, "0");
    const monthStr = String(month).padStart(2, "0");
    const hour = brMatch[4] ? brMatch[4].padStart(2, "0") : null;
    const min = brMatch[5] ? brMatch[5].padStart(2, "0") : null;
    const sec = brMatch[6] ? brMatch[6].padStart(2, "0") : "00";

    if (hour !== null && min !== null) {
      return `${yearStr}-${monthStr}-${dayStr}T${hour}:${min}:${sec}`;
    }
    return `${yearStr}-${monthStr}-${dayStr}`;
  }

  // 3. Check ISO format YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = str.match(
    /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");
    const hour = isoMatch[4] ? isoMatch[4].padStart(2, "0") : null;
    const min = isoMatch[5] ? isoMatch[5].padStart(2, "0") : null;
    const sec = isoMatch[6] ? isoMatch[6].padStart(2, "0") : "00";

    if (hour !== null && min !== null) {
      return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
    }
    return `${year}-${month}-${day}`;
  }

  // 4. Fallback to standard JS Date constructor
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dayVal = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dayVal}`;
  }

  return null;
}

export const Route = createFileRoute("/_authenticated/importar")({ component: Importar });

type TemplateKey =
  | "pre_atendimento"
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
  pre_atendimento: {
    title: "Pré-Atendimento",
    desc: "Importe novos colaboradores para a esteira de pré-atendimento com controle de admissão, produto, horários de entrada/saída e acessos.",
    icon: UserPlus,
    headers: [
      "Nome",
      "CPF",
      "Admissão",
      "Produto",
      "Entrada",
      "Saída",
      "Data de Nascimento",
      "Email",
      "Senha e-mail",
      "Operação",
      "Telefone",
      "Cargo",
      "Status",
    ],
    sample: [
      {
        Nome: "Carlos Eduardo Santos",
        CPF: "456.789.123-00",
        Admissão: "01/09/2026",
        Produto: "Atendimento Voz",
        Entrada: "08:00",
        Saída: "17:00",
        "Data de Nascimento": "12/03/1998",
        Email: "carlos.santos@empresa.com",
        "Senha e-mail": "SenhaForte123",
        Operação: "Operação Central",
        Telefone: "11977777777",
        Cargo: "Operador",
        Status: "ativo",
      },
    ],
  },
  inativos: {
    title: "Usuários Inativos",
    desc: "Importe ou atualize usuários inativos (desligados/afastados) usando o mesmo layout da Matriz unificada.",
    icon: Users,
    headers: [
      "Nome",
      "CPF",
      "Data de Nascimento",
      "Email",
      "Senha e-mail",
      "Operação",
      "Telefone",
      "Cargo",
      "Status",
      "Data Inativação",
    ],
    sample: [
      {
        Nome: "Maria Oliveira",
        CPF: "987.654.321-00",
        "Data de Nascimento": "20/10/1992",
        Email: "maria@empresa.com",
        "Senha e-mail": "SenhaForteEmail987",
        Operação: "Operação Central",
        Telefone: "11988888888",
        Cargo: "Operador",
        Status: "inativo",
        "Data Inativação": "30/07/2026",
      },
    ],
  },
  operacoes: {
    title: "Operações",
    desc: "Importe ou atualize operações/setores da empresa em lote.",
    icon: Building2,
    headers: ["Nome", "Descrição", "Ativo"],
    sample: [
      {
        Nome: "Operação São Paulo",
        Descrição: "Central de Atendimento SP",
        Ativo: "true",
      },
    ],
  },
  sistemas: {
    title: "Sistemas",
    desc: "Importe ou atualize sistemas homologados em lote.",
    icon: Laptop,
    headers: ["Nome", "Categoria", "Criticidade", "Descrição", "URL", "Ativo"],
    sample: [
      {
        Nome: "SAP ERP",
        Categoria: "Sistemas Core",
        Criticidade: "alta",
        Descrição: "Sistema ERP principal da empresa",
        URL: "https://sap.empresa.local",
        Ativo: "true",
      },
    ],
  },
  perfis_acesso: {
    title: "Perfis de Acesso",
    desc: "Importe perfis de acesso vinculados aos sistemas. O sistema correspondente é localizado pelo nome.",
    icon: ShieldCheck,
    headers: ["Nome", "Sistema", "Descrição"],
    sample: [
      {
        Nome: "Administrador SAP",
        Sistema: "SAP ERP",
        Descrição: "Perfil com privilégios administrativos no módulo SAP FI/CO",
      },
    ],
  },
  acessos: {
    title: "Acessos (Credenciais)",
    desc: "Vincule logins e senhas de sistemas aos colaboradores. Localização automática por CPF do colaborador, nome do sistema e nome do perfil de acesso (opcional).",
    icon: KeyRound,
    headers: ["CPF Colaborador", "Sistema", "Perfil de Acesso", "Login", "Senha", "Status"],
    sample: [
      {
        "CPF Colaborador": "123.456.789-00",
        Sistema: "SAP ERP",
        "Perfil de Acesso": "Administrador SAP",
        Login: "joao.silva",
        Senha: "MinhaSenhaForte123",
        Status: "ativo",
      },
    ],
  },
  pendencias: {
    title: "Processos (Pendências)",
    desc: "Importe pendências e fluxos de trabalho de acessos. Vinculação por nome ou CPF do colaborador, nome do sistema, status e etiquetas.",
    icon: ClipboardList,
    headers: [
      "Título",
      "Descrição",
      "Tipo",
      "Prioridade",
      "Status",
      "Colaborador",
      "Sistema",
      "SLA",
      "Etiquetas",
    ],
    sample: [
      {
        Título: "Criar Acesso SAP - João",
        Descrição: "Realizar a criação de credencial do novo colaborador",
        Tipo: "solicitacao_acesso",
        Prioridade: "media",
        Status: "backlog",
        Colaborador: "João da Silva",
        Sistema: "SAP ERP",
        SLA: "2026-08-05",
        Etiquetas: "urgente;tributário",
      },
    ],
  },
  chamados: {
    title: "Chamados de Suporte",
    desc: "Importe tíquetes e chamados de suporte técnico de acessos em lote. Vinculação automática do sistema por nome, operador (usuário) e tratador técnico por e-mail.",
    icon: LifeBuoy,
    headers: [
      "Título",
      "Tipo",
      "Status",
      "Descrição",
      "Sistema",
      "Email Operador",
      "Email Tratador",
      "Resposta",
    ],
    sample: [
      {
        Título: "Senha do SAP expirada",
        Tipo: "erro",
        Status: "aberto",
        Descrição: "Usuário reporta bloqueio de login por tentativas incorretas",
        Sistema: "SAP ERP",
        "Email Operador": "joao@empresa.com",
        "Email Tratador": "tecnico@empresa.com",
        Resposta: "Solicitada redefinição provisória de senha",
      },
    ],
  },
  matriz: {
    title: "Matriz de Acessos Unificada",
    desc: "Importe ou atualize todos os colaboradores, seus dados cadastrais, status (ativo/inativo) e todas as suas credenciais de acesso de uma só vez usando um único arquivo de planilha unificado.",
    icon: Grid3x3,
    headers: [
      "Nome",
      "CPF",
      "Data de Nascimento",
      "Email",
      "Senha e-mail",
      "Operação",
      "Telefone",
      "Cargo",
      "Status",
      "Data Inativação",
    ],
    sample: [
      {
        Nome: "João da Silva",
        CPF: "123.456.789-00",
        "Data de Nascimento": "15/05/1995",
        Email: "joao@empresa.com",
        "Senha e-mail": "SenhaForteEmail123",
        Operação: "Operação Central",
        Telefone: "11999999999",
        Cargo: "Analista de Suporte",
        Status: "ativo",
        "Data Inativação": "",
      },
    ],
  },
};

const TAB_GROUPS: { value: TabGroup; label: string; keys: TemplateKey[] }[] = [
  {
    value: "cadastro",
    label: "Pessoas e Estrutura",
    keys: ["pre_atendimento", "matriz", "inativos", "operacoes"],
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

  if (key === "matriz" || key === "inativos" || key === "pre_atendimento") {
    headers = ["Nome", "CPF"];
    if (key === "pre_atendimento") {
      headers.push("Admissão", "Produto", "Entrada", "Saída");
    }
    headers.push(
      "Data de Nascimento",
      "Email",
      "Senha e-mail",
      "Operação",
      "Telefone",
      "Cargo",
      "Status",
    );
    if (key === "inativos") {
      headers.push("Data Inativação");
    }
    const baseSample: Record<string, string> =
      key === "matriz"
        ? {
            Nome: "João da Silva",
            CPF: "123.456.789-00",
            "Data de Nascimento": "15/05/1995",
            Email: "joao@empresa.com",
            "Senha e-mail": "SenhaForteEmail123",
            Operação: "Operação Central",
            Telefone: "11999999999",
            Cargo: "Analista de Suporte",
            Status: "ativo",
          }
        : key === "pre_atendimento"
          ? {
              Nome: "Carlos Eduardo Santos",
              CPF: "456.789.123-00",
              Admissão: "01/09/2026",
              Produto: "Atendimento Voz",
              Entrada: "08:00",
              Saída: "17:00",
              "Data de Nascimento": "12/03/1998",
              Email: "carlos.santos@empresa.com",
              "Senha e-mail": "SenhaForte123",
              Operação: "Operação Central",
              Telefone: "11977777777",
              Cargo: "Operador",
              Status: "ativo",
            }
          : {
              Nome: "Maria Oliveira",
              CPF: "987.654.321-00",
              "Data de Nascimento": "20/10/1992",
              Email: "maria@empresa.com",
              "Senha e-mail": "SenhaForteEmail987",
              Operação: "Operação Central",
              Telefone: "11988888888",
              Cargo: "Operador",
              Status: "inativo",
              "Data Inativação": "30/07/2026",
            };
    for (const s of sistemasAll) {
      baseSample[`${s.nome} - Usuário`] = key === "inativos" ? "maria.oliveira" : "joao.silva";
      baseSample[`${s.nome} - Senha`] = key === "inativos" ? "" : "SenhaTemporaria123";
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
  const [selectedOperacaoId, setSelectedOperacaoId] = useState("todas");

  const { data: sistemasAll = [] } = useQuery({
    queryKey: ["sistemas-import"],
    queryFn: async () => {
      const { data } = await db.from("sistemas").select("id, nome").order("nome");
      return (data ?? []).filter(
        (s: any) => s.nome.toLowerCase() !== "e-mail" && s.nome.toLowerCase() !== "email",
      );
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

      <OperationFilterBar
        selectedOperacaoId={selectedOperacaoId}
        onChange={setSelectedOperacaoId}
      />

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
          <ImportCard
            key={k}
            kind={k}
            sistemasAll={sistemasAll}
            selectedOperacaoId={selectedOperacaoId}
          />
        ))}
      </div>
    </div>
  );
}

function ImportCard({
  kind,
  sistemasAll = [],
  selectedOperacaoId = "todas",
}: {
  kind: TemplateKey;
  sistemasAll?: any[];
  selectedOperacaoId?: string;
}) {
  const [showPreview, setShowPreview] = useState(false);

  let t;
  let baseHeaders: string[] = [];
  let systemHeaders: string[] = [];

  if (kind === "matriz" || kind === "inativos" || kind === "pre_atendimento") {
    baseHeaders = ["Nome", "CPF"];
    if (kind === "pre_atendimento") {
      baseHeaders.push("Admissão", "Produto", "Entrada", "Saída");
    }
    baseHeaders.push(
      "Data de Nascimento",
      "Email",
      "Senha e-mail",
      "Operação",
      "Telefone",
      "Cargo",
      "Status",
    );
    if (kind === "inativos") {
      baseHeaders.push("Data Inativação");
    }

    systemHeaders = sistemasAll.flatMap((s: any) => [`${s.nome} - Usuário`, `${s.nome} - Senha`]);

    t = {
      title:
        kind === "matriz"
          ? "Matriz de Acessos Unificada"
          : kind === "pre_atendimento"
            ? "Pré-Atendimento"
            : "Usuários Inativos",
      desc:
        kind === "matriz"
          ? "Importe ou atualize todos os colaboradores, seus dados cadastrais, status (ativo/inativo) e todas as suas credenciais de acesso de uma só vez usando um único arquivo de planilha unificado."
          : kind === "pre_atendimento"
            ? "Importe novos colaboradores para a esteira de pré-atendimento com controle de admissão, produto, horários de entrada/saída e acessos."
            : "Importe ou atualize usuários inativos (desligados/afastados) usando o mesmo layout da Matriz unificada.",
      headers: [...baseHeaders, ...systemHeaders],
      icon: kind === "matriz" ? Grid3x3 : kind === "pre_atendimento" ? UserPlus : Users,
    };
  } else {
    t = TEMPLATES[kind];
    baseHeaders = t.headers;
  }
  const Icon = t.icon;
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  // Sample row for preview
  const sampleRow: Record<string, string> =
    kind === "matriz"
      ? {
          Nome: "João da Silva",
          CPF: "123.456.789-00",
          "Data de Nascimento": "15/05/1995",
          Email: "joao@empresa.com",
          "Senha e-mail": "SenhaForteEmail123",
          Operação: "Operação Central",
          Telefone: "11999999999",
          Cargo: "Analista de Suporte",
          Status: "ativo",
          ...Object.fromEntries(
            sistemasAll.flatMap((s: any) => [
              [`${s.nome} - Usuário`, "joao.silva"],
              [`${s.nome} - Senha`, "SenhaTemp123"],
            ]),
          ),
        }
      : kind === "pre_atendimento"
        ? {
            Nome: "Carlos Eduardo Santos",
            CPF: "456.789.123-00",
            Admissão: "01/09/2026",
            Produto: "Atendimento Voz",
            Entrada: "08:00",
            Saída: "17:00",
            "Data de Nascimento": "12/03/1998",
            Email: "carlos.santos@empresa.com",
            "Senha e-mail": "SenhaForte123",
            Operação: "Operação Central",
            Telefone: "11977777777",
            Cargo: "Operador",
            Status: "ativo",
            ...Object.fromEntries(
              sistemasAll.flatMap((s: any) => [
                [`${s.nome} - Usuário`, "carlos.santos"],
                [`${s.nome} - Senha`, "SenhaTemp123"],
              ]),
            ),
          }
        : kind === "inativos"
          ? {
              Nome: "Maria Oliveira",
              CPF: "987.654.321-00",
              "Data de Nascimento": "20/10/1992",
              Email: "maria@empresa.com",
              "Senha e-mail": "SenhaForteEmail987",
              Operação: "Operação Central",
              Telefone: "11988888888",
              Cargo: "Operador",
              Status: "inativo",
              "Data Inativação": "30/07/2026",
              ...Object.fromEntries(
                sistemasAll.flatMap((s: any) => [
                  [`${s.nome} - Usuário`, "maria.oliveira"],
                  [`${s.nome} - Senha`, ""],
                ]),
              ),
            }
          : (TEMPLATES[kind]?.sample?.[0] ?? {});

  async function handleFile(file: File) {
    setBusy(true);
    setResult(null);
    try {
      let text = await file.text();
      // Remove UTF-8 BOM if present
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }
      // Remove sep=; directive line if present at start of CSV
      text = text.replace(/^sep=\s*;\s*\r?\n/i, "");

      Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
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
            const out = await importRows(kind, rows, selectedOperacaoId);
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              Colunas Esperadas (Delimitador: Semicolon / Ponto e vírgula ";")
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs h-7 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              {showPreview ? "Ocultar Prévia" : "Ver Exemplo de Preenchimento"}
            </Button>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex flex-wrap gap-1.5">
                {baseHeaders.map((h) => {
                  const isRequired = h.toLowerCase() === "nome" || h.toLowerCase() === "cpf";
                  return (
                    <Badge
                      key={h}
                      variant="secondary"
                      className={cn(
                        "font-medium text-xs px-2.5 py-0.5 border shadow-none",
                        isRequired
                          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900 dark:border-neutral-100 font-semibold"
                          : "bg-neutral-100 dark:bg-neutral-800/80 text-neutral-800 dark:text-neutral-200 border-neutral-200/80 dark:border-neutral-700/80",
                      )}
                    >
                      {h}
                      {isRequired && <span className="ml-1 text-[10px] opacity-75">*</span>}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {systemHeaders.length > 0 && (
              <div className="pt-1">
                <span className="text-[11px] font-medium text-neutral-500 block mb-1.5">
                  Credenciais por Sistema Homologado ({sistemasAll.length}{" "}
                  {sistemasAll.length === 1 ? "sistema cadastrado" : "sistemas cadastrados"}):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-md bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/60 dark:border-neutral-800/60">
                  {sistemasAll.map((s: any) => (
                    <span key={s.id} className="inline-flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className="text-[11px] px-2 py-0.5 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                      >
                        {s.nome} - Usuário
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[11px] px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      >
                        {s.nome} - Senha
                      </Badge>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {showPreview && (
            <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 p-3 space-y-2 text-xs animate-in fade-in">
              <div className="flex items-center justify-between text-muted-foreground font-medium">
                <span>Pré-visualização do Formato da Planilha:</span>
                <span className="text-[11px]">Codificação: UTF-8 / Separador: ;</span>
              </div>
              <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-950">
                <table className="min-w-full text-[11px] divide-y divide-neutral-200 dark:divide-neutral-800">
                  <thead className="bg-neutral-100 dark:bg-neutral-900">
                    <tr>
                      {t.headers.map((h: string) => (
                        <th
                          key={h}
                          className="px-2.5 py-1.5 text-left font-semibold text-neutral-700 dark:text-neutral-300 border-r border-neutral-200 dark:border-neutral-800 last:border-0 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    <tr>
                      {t.headers.map((h: string) => (
                        <td
                          key={h}
                          className="px-2.5 py-1.5 text-neutral-600 dark:text-neutral-400 border-r border-neutral-200 dark:border-neutral-800 last:border-0 whitespace-nowrap font-mono text-[10.5px]"
                        >
                          {sampleRow[h] ?? "-"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
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

export async function importRows(
  kind: TemplateKey,
  rows: Record<string, string>[],
  selectedOperacaoId = "todas",
) {
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
    if (existing === null || existing === undefined || existing === "") {
      return true; // Any non-empty incoming value is different from null/undefined/empty
    }

    if (k === "cpf") {
      const cleanEx = String(existing).replace(/\D/g, "");
      const cleanNew = String(incoming).replace(/\D/g, "");
      return cleanEx !== cleanNew;
    }

    if (
      k === "admissao_em" ||
      k === "inativado_em" ||
      k === "sla_em" ||
      k === "data_inicio" ||
      k === "data_nascimento"
    ) {
      const iso1 = parseDateToISO(existing);
      const iso2 = parseDateToISO(incoming);
      if (!iso1 || !iso2) return String(existing ?? "").trim() !== String(incoming ?? "").trim();
      return iso1.split("T")[0] !== iso2.split("T")[0];
    }

    if (
      k === "email" ||
      k === "nome" ||
      k === "cargo" ||
      k === "status" ||
      k === "telefone" ||
      k === "produto" ||
      k === "horario_entrada" ||
      k === "horario_saida" ||
      k === "matricula" ||
      k === "email_senha" ||
      k === "em_pre_atendimento"
    ) {
      return String(existing ?? "").trim() !== String(incoming ?? "").trim();
    }

    return String(existing).trim() !== String(incoming).trim();
  };

  // 2. IMPORT OPERAÇÕES
  if (kind === "operacoes") {
    const { data: existentes } = await db.from("operacoes").select("id, nome, descricao, ativo");
    const opMap = new Map((existentes ?? []).map((o: any) => [o.nome.trim().toLowerCase(), o]));

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const nome = getRowVal(r, ["nome", "operacao", "operação", "setor", "unidade"]);
      const ativoVal = getRowVal(r, ["ativo", "status", "habilitado"]);
      const payload = {
        nome,
        descricao: getRowVal(r, ["descricao", "descrição", "detalhes"]) || null,
        ativo: ativoVal ? String(ativoVal).toLowerCase() !== "false" : true,
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
      const nome = getRowVal(r, ["nome", "sistema", "produto", "aplicacao", "ferramenta"]);
      const rawCrit = getRowVal(r, ["criticidade", "prioridade", "impacto"]).toLowerCase();
      const criticidade = validCrit.includes(rawCrit) ? rawCrit : "media";
      const ativoVal = getRowVal(r, ["ativo", "status", "habilitado"]);

      const payload: any = {
        nome,
        categoria: getRowVal(r, ["categoria", "tipo", "grupo"]) || null,
        criticidade: criticidade as any,
        descricao: getRowVal(r, ["descricao", "descrição", "detalhes"]) || null,
        url: getRowVal(r, ["url", "link", "endereco", "site"]) || null,
        ativo: ativoVal ? String(ativoVal).toLowerCase() !== "false" : true,
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
      const nome = getRowVal(r, ["nome", "perfil", "perfil_acesso", "funcao", "cargo"]);
      const sistemaNome = getRowVal(r, ["sistema", "nome_sistema", "produto"]);
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
        descricao: getRowVal(r, ["descricao", "descrição", "detalhes"]) || null,
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
    const { data: cols } = await db.from("colaboradores").select("id, cpf, nome");
    const { data: sis } = await db.from("sistemas").select("id, nome");
    const { data: perfis } = await db.from("perfis_acesso").select("id, nome, sistema_id");

    const colMap = new Map();
    (cols ?? []).forEach((c: any) => {
      if (c.cpf) colMap.set(c.cpf.replace(/\D/g, ""), c.id);
      if (c.nome) colMap.set(c.nome.trim().toLowerCase(), c.id);
    });
    const sisMap = new Map((sis ?? []).map((s: any) => [s.nome.toLowerCase().trim(), s.id]));
    const perfMap = new Map(
      (perfis ?? []).map((p: any) => [`${p.nome.toLowerCase().trim()}:${p.sistema_id}`, p.id]),
    );

    const { data: u } = await db.auth.getUser();
    const validStatuses = ["pendente", "ativo", "suspenso", "exclusao_pendente", "excluido"];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const colabVal = getRowVal(r, [
        "cpf_colaborador",
        "cpf",
        "colaborador",
        "nome_colaborador",
        "documento",
      ]);
      const cpfDigits = colabVal.replace(/\D/g, "");
      const colId =
        (cpfDigits ? colMap.get(cpfDigits) : null) ?? colMap.get(colabVal.toLowerCase()) ?? null;

      const sisVal = getRowVal(r, ["sistema", "nome_sistema", "produto"]);
      const sisId = sisVal ? (sisMap.get(sisVal.trim().toLowerCase()) ?? null) : null;

      if (!colId) {
        fail++;
        errors.push(`Linha ${i + 2}: Colaborador "${colabVal}" não encontrado.`);
        continue;
      }
      if (!sisId) {
        fail++;
        errors.push(`Linha ${i + 2}: Sistema "${sisVal}" não homologado ou não encontrado.`);
        continue;
      }

      const perfilNome = getRowVal(r, [
        "perfil_acesso",
        "perfil_de_acesso",
        "perfil",
        "funcao",
        "perfil de acesso",
      ]);
      const perfilId = perfilNome
        ? (perfMap.get(`${perfilNome.toLowerCase()}:${sisId}`) ?? null)
        : null;

      const rawStatus = getRowVal(r, ["status", "situacao", "estado"]).toLowerCase();
      const status = validStatuses.includes(rawStatus) ? rawStatus : "ativo";

      const loginVal = getRowVal(r, ["login", "usuario", "usuário", "user", "nome_usuario"]);
      const senhaVal = getRowVal(r, ["senha", "password", "chave", "pass"]);

      const payload: any = {
        colaborador_id: colId,
        sistema_id: sisId,
        perfil_acesso_id: perfilId,
        login: loginVal || null,
        senha: senhaVal || null,
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
    const { data: users } = await db.from("profiles").select("id, email, nome");
    const { data: quadrosData } = await db.from("pendencia_quadros").select("nome").order("ordem");
    const quadrosNomes = (quadrosData ?? []).map((q: any) => q.nome);

    const colMap = new Map();
    (cols ?? []).forEach((c: any) => {
      if (c.cpf) colMap.set(c.cpf.replace(/\D/g, ""), c.id);
      if (c.nome) colMap.set(c.nome.trim().toLowerCase(), c.id);
      if (c.email) colMap.set(c.email.trim().toLowerCase(), c.id);
    });

    const sisMap = new Map((sis ?? []).map((s: any) => [s.nome.trim().toLowerCase(), s.id]));
    const userMap = new Map();
    (users ?? []).forEach((u: any) => {
      if (u.email) userMap.set(u.email.trim().toLowerCase(), u.id);
      if (u.nome) userMap.set(u.nome.trim().toLowerCase(), u.id);
    });

    const { data: loggedIn } = await db.auth.getUser();

    const validPriorities = ["baixa", "media", "alta", "critica"];
    const validTypes = ["solicitacao_acesso", "exclusao_acesso", "revisao", "alteracao", "outro"];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const colabVal = getRowVal(r, [
        "colaborador",
        "colaborador_id",
        "cpf_colaborador",
        "cpf",
        "nome_colaborador",
        "nome",
        "usuario",
        "operador",
      ]);
      const colabDigits = colabVal.replace(/\D/g, "");
      const colId =
        (colabDigits ? colMap.get(colabDigits) : null) ??
        colMap.get(colabVal.toLowerCase()) ??
        null;

      const sisName = getRowVal(r, [
        "sistema",
        "sistema_id",
        "nome_sistema",
        "produto",
        "aplicacao",
      ]);
      let sisId = sisName ? (sisMap.get(sisName.toLowerCase()) ?? null) : null;

      // Auto-create system if it doesn't exist
      if (sisName && !sisId) {
        const { data: newSis } = await db
          .from("sistemas")
          .insert({ nome: sisName })
          .select("id, nome")
          .single();
        if (newSis) {
          sisId = newSis.id;
          sisMap.set(sisName.toLowerCase(), sisId);
        }
      }

      let titulo = getRowVal(r, [
        "titulo",
        "título",
        "title",
        "processo",
        "assunto",
        "tarefa",
        "nome",
      ]);
      // Intelligent fallback if title is not explicitly informed:
      if (!titulo) {
        if (sisName && colabVal) {
          titulo = `${sisName} - ${colabVal}`;
        } else if (sisName) {
          titulo = `Solicitação ${sisName}`;
        } else if (colabVal) {
          titulo = `Pendência - ${colabVal}`;
        }
      }

      if (!titulo) {
        fail++;
        errors.push(`Linha ${i + 2}: O campo 'titulo' é obrigatório.`);
        continue;
      }

      const rawType = getRowVal(r, ["tipo", "type", "tipo_solicitacao", "categoria"]).toLowerCase();
      const tipo = validTypes.includes(rawType) ? rawType : "solicitacao_acesso";

      const rawPriority = getRowVal(r, ["prioridade", "priority", "urgencia"]).toLowerCase();
      const prioridade = validPriorities.includes(rawPriority) ? rawPriority : "media";

      const rawStatus = getRowVal(r, [
        "status",
        "estado",
        "situacao",
        "situação",
        "quadro",
        "fase",
      ]);
      let status = rawStatus || "PENDENTE";
      if (quadrosNomes.length > 0) {
        const matchedQ = quadrosNomes.find((qName) =>
          matchesColumnStatus(rawStatus, qName, quadrosNomes),
        );
        if (matchedQ) status = matchedQ;
      }

      const respEmail = getRowVal(r, [
        "email_responsavel",
        "responsavel",
        "responsável",
        "atribuido_a",
        "atribuído a",
      ]);
      const respId = respEmail ? (userMap.get(respEmail.toLowerCase()) ?? null) : null;

      const rawEtiquetasStr = getRowVal(r, ["etiquetas", "tags", "labels", "etiqueta", "tag"]);
      const rawEtiquetas = rawEtiquetasStr
        ? String(rawEtiquetasStr)
            .split(/[,;]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

      const dataInicioVal = getRowVal(r, [
        "data_inicio",
        "data_início",
        "data de início",
        "data de inicio",
        "inicio",
        "abertura",
        "criado_em",
        "data",
      ]);
      const slaVal = getRowVal(r, [
        "sla",
        "sla_em",
        "data_limite",
        "data limite",
        "prazo",
        "vencimento",
      ]);
      const descVal = getRowVal(r, [
        "descricao",
        "descrição",
        "description",
        "detalhes",
        "observacao",
        "observação",
        "obs",
      ]);

      const payload: any = {
        titulo,
        tipo: tipo as any,
        prioridade: prioridade as any,
        status: status as any,
        descricao: descVal || null,
        colaborador_id: colId,
        sistema_id: sisId,
        responsavel_id: respId,
        data_inicio: parseDateToISO(dataInicioVal) || new Date().toISOString().split("T")[0],
        sla_em: parseDateToISO(slaVal),
        etiquetas: rawEtiquetas,
        solicitado: true,
        criado_por: loggedIn.user?.id ?? null,
        ...(selectedOperacaoId !== "todas" && selectedOperacaoId !== "sem_operacao"
          ? { operacao_id: selectedOperacaoId }
          : {}),
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
      const titulo = getRowVal(r, ["titulo", "título", "title", "assunto", "chamado"]);

      if (!titulo) {
        fail++;
        errors.push(`Linha ${i + 2}: O campo 'titulo' é obrigatório.`);
        continue;
      }

      const rawType = getRowVal(r, ["tipo", "type", "categoria"]).toLowerCase();
      const tipo = validTypes.includes(rawType) ? rawType : "erro";

      const rawStatus = getRowVal(r, ["status", "situacao", "situação", "estado"]).toLowerCase();
      const status = validStatuses.includes(rawStatus) ? rawStatus : "aberto";

      const sisName = getRowVal(r, ["sistema", "nome_sistema", "produto"]);
      const sisId = sisName ? (sisMap.get(sisName.toLowerCase()) ?? null) : null;

      const opEmail = getRowVal(r, [
        "email_operador",
        "email operador",
        "email_usuario",
        "email usuario",
        "operador",
        "usuario",
        "email",
      ]);
      const opId = opEmail
        ? (userMap.get(opEmail.toLowerCase()) ?? loggedIn.user?.id)
        : loggedIn.user?.id;

      const tratadorEmail = getRowVal(r, [
        "email_tratador",
        "email tratador",
        "tratador",
        "responsavel",
        "responsável",
        "tecnico",
        "técnico",
      ]);
      const tratadorId = tratadorEmail ? (userMap.get(tratadorEmail.toLowerCase()) ?? null) : null;

      const descVal = getRowVal(r, [
        "descricao",
        "descrição",
        "description",
        "detalhes",
        "mensagem",
      ]);
      const respVal = getRowVal(r, [
        "resposta",
        "solucao",
        "solução",
        "resolucao",
        "resolução",
        "comentario",
        "comentário",
      ]);

      const payload: any = {
        titulo,
        tipo,
        status,
        descricao: descVal || null,
        sistema_id: sisId,
        operador_id: opId,
        tratador_id: tratadorId,
        resposta: respVal || null,
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

  // 8. IMPORT MATRIZ DE ACESSOS UNIFICADA E PRÉ-ATENDIMENTO
  else if (kind === "matriz" || kind === "inativos" || kind === "pre_atendimento") {
    const { data: sis } = await db.from("sistemas").select("id, nome");
    const sistemasList = (sis ?? []).filter(
      (s: any) => s.nome.toLowerCase() !== "e-mail" && s.nome.toLowerCase() !== "email",
    );

    const { data: existingOps } = await db.from("operacoes").select("id, nome");
    const operationsList = [...(existingOps ?? [])];

    const { data: existentes } = await db
      .from("colaboradores")
      .select(
        "id, nome, cpf, email, email_senha, telefone, cargo, status, inativado_em, data_nascimento, operacao_id, admissao_em, produto, horario_entrada, horario_saida, em_pre_atendimento" as any,
      );

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

    const normalizeStr = (str: string) =>
      String(str ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const isEmailSenhaColumn = (rawKey: string): boolean => {
      const lk = rawKey.toLowerCase().trim();
      const ck = cleanKey(lk);
      const exactKeys = [
        "senha e-mail",
        "senha email",
        "senha_email",
        "senha_do_email",
        "senhadoemail",
        "senha_de_email",
        "senhadeemail",
        "email_senha",
        "emailsenha",
        "email senha",
        "e-mail senha",
        "e-mail_senha",
        "senhawebmail",
        "senha webmail",
        "senha_webmail",
        "senhacorreio",
        "senha correio",
        "senha_correio",
        "password email",
        "email password",
        "emailpassword",
        "passwordemail",
        "pass email",
        "email pass",
        "pwd email",
        "email pwd",
        "senha (email)",
        "senha (e-mail)",
      ];
      if (exactKeys.includes(lk) || exactKeys.includes(ck)) return true;
      const hasEmail =
        lk.includes("email") ||
        lk.includes("e-mail") ||
        lk.includes("webmail") ||
        lk.includes("correio");
      const hasSenha = lk.includes("senha") || lk.includes("pass") || lk.includes("pwd");
      return hasEmail && hasSenha;
    };

    const isOperacaoColumn = (rawKey: string): boolean => {
      const lk = rawKey.toLowerCase().trim();
      const ck = cleanKey(lk);
      const opKeys = [
        "operação",
        "operacao",
        "operacoes",
        "op",
        "operation",
        "operations",
        "fila",
        "filas",
        "setor",
        "setores",
        "departamento",
        "departamentos",
        "equipe",
        "equipes",
        "time",
        "times",
        "unidade",
        "celula",
        "célula",
      ];
      if (opKeys.includes(lk) || opKeys.includes(ck)) return true;
      return (
        ck.startsWith("operac") ||
        ck.includes("operacao") ||
        ck.includes("setor") ||
        ck.includes("departamento")
      );
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      let nome = "";
      let rawCpf = "";
      let email = "";
      let emailSenha = "";
      let telefone = "";
      let cargo = "";
      let rawStatus = "";
      let dataInativacao = "";
      let dataNascimento = "";
      let rowOperacao = "";
      let admissao = "";
      let produto = "";
      let horarioEntrada = "";
      let horarioSaida = "";

      const dataInativacaoKeys = [
        "data inativação",
        "data inativacao",
        "data_inativacao",
        "datainativacao",
        "inativado em",
        "inativado_em",
      ];

      const dataNascimentoKeys = [
        "data de nascimento",
        "data_nascimento",
        "datanascimento",
        "nascimento",
        "data nascimento",
        "data nasc",
        "data_nasc",
        "datanasc",
        "dt nascimento",
        "dt_nascimento",
        "dtnascimento",
        "dt nasc",
        "dt_nasc",
        "dtnasc",
        "d. nascimento",
        "d.nascimento",
        "d.nasc",
        "aniversario",
        "aniversário",
        "dob",
        "birthdate",
      ];

      const admissaoKeys = [
        "admissão",
        "admissao",
        "data admissão",
        "data admissao",
        "data_admissao",
        "dt admissao",
        "dt_admissao",
        "admissao_em",
        "admissão em",
        "dt_admissao_em",
        "data de admissao",
        "data de admissão",
      ];

      const produtoKeys = [
        "produto",
        "produto/servico",
        "produto/serviço",
        "servico",
        "serviço",
        "campanha",
        "projeto",
        "fila",
        "skill",
        "produto / servico",
      ];
      const entradaKeys = [
        "entrada",
        "horario entrada",
        "horário entrada",
        "horario_entrada",
        "hora entrada",
        "hora_entrada",
        "horario de entrada",
        "horário de entrada",
        "inicio",
        "início",
        "horario inicio",
        "horário início",
        "hora inicio",
        "hora início",
        "entrada (horário)",
      ];
      const saidaKeys = [
        "saída",
        "saida",
        "horario saída",
        "horario saida",
        "horário saída",
        "horario_saida",
        "hora saída",
        "hora saida",
        "hora_saida",
        "horario de saída",
        "horario de saida",
        "termino",
        "término",
        "horario termino",
        "horário término",
        "hora termino",
        "hora término",
        "fim",
        "horario fim",
        "horário fim",
        "hora fim",
        "saida (horário)",
        "saída (horário)",
        "saida prevista",
      ];

      const isTelefoneCol = (lk: string, ck: string) => {
        const exact = [
          "telefone",
          "celular",
          "fone",
          "tel",
          "cel",
          "contato",
          "whatsapp",
          "whats",
          "wpp",
          "phone",
          "mobile",
        ];
        if (exact.includes(lk) || exact.includes(ck)) return true;
        return (
          ck.includes("telefone") ||
          ck.includes("celular") ||
          ck.includes("fone") ||
          ck.startsWith("tel") ||
          ck.includes("contato") ||
          ck.includes("whatsapp") ||
          ck.includes("whats") ||
          ck.includes("wpp")
        );
      };

      const isSaidaCol = (lk: string, ck: string) => {
        if (
          ck.includes("inativac") ||
          ck.includes("desligam") ||
          ck.includes("datadeslig") ||
          ck.includes("datainativ")
        ) {
          return false;
        }
        if (saidaKeys.includes(lk) || saidaKeys.map(cleanKey).includes(ck)) return true;
        return (
          ck.includes("said") ||
          ck.includes("termin") ||
          (ck.includes("horario") && ck.includes("fim")) ||
          (ck.includes("hora") && ck.includes("fim"))
        );
      };

      const isEntradaCol = (lk: string, ck: string) => {
        if (entradaKeys.includes(lk) || entradaKeys.map(cleanKey).includes(ck)) return true;
        return (
          ck.includes("entrad") ||
          (ck.includes("horario") && ck.includes("ini")) ||
          (ck.includes("hora") && ck.includes("ini"))
        );
      };

      for (const [rowKey, rowValue] of Object.entries(r)) {
        const lowerKey = rowKey.toLowerCase().trim();
        const cleanedKey = cleanKey(lowerKey);

        if (lowerKey === "nome" || cleanedKey === "nome") {
          nome = String(rowValue ?? "")
            .trim()
            .slice(0, 150);
        } else if (lowerKey === "cpf" || cleanedKey === "cpf") {
          rawCpf = String(rowValue ?? "").trim();
        } else if (isEmailSenhaColumn(lowerKey)) {
          emailSenha = String(rowValue ?? "").trim();
        } else if (
          lowerKey === "email" ||
          cleanedKey === "email" ||
          lowerKey === "e-mail" ||
          cleanedKey === "correio" ||
          cleanedKey === "webmail"
        ) {
          email = String(rowValue ?? "").trim();
        } else if (isTelefoneCol(lowerKey, cleanedKey)) {
          // Allow any characters with limit of 80 characters
          telefone = String(rowValue ?? "")
            .trim()
            .slice(0, 80);
        } else if (
          lowerKey === "cargo" ||
          cleanedKey === "cargo" ||
          cleanedKey === "funcao" ||
          cleanedKey === "posicao"
        ) {
          cargo = String(rowValue ?? "")
            .trim()
            .slice(0, 80);
        } else if (lowerKey === "status" || cleanedKey === "status" || cleanedKey === "situacao") {
          rawStatus = String(rowValue ?? "").trim();
        } else if (
          dataInativacaoKeys.includes(lowerKey) ||
          cleanedKey.includes("inativac") ||
          cleanedKey.includes("desligam")
        ) {
          dataInativacao = String(rowValue ?? "").trim();
        } else if (
          dataNascimentoKeys.includes(lowerKey) ||
          cleanedKey.includes("nasciment") ||
          cleanedKey.includes("datanasc") ||
          cleanedKey.includes("dtnasc") ||
          cleanedKey.includes("aniversar")
        ) {
          dataNascimento = String(rowValue ?? "").trim();
        } else if (isOperacaoColumn(lowerKey)) {
          rowOperacao = String(rowValue ?? "").trim();
        } else if (
          admissaoKeys.includes(lowerKey) ||
          cleanedKey.includes("admiss") ||
          cleanedKey === "dataadmissao"
        ) {
          admissao = String(rowValue ?? "").trim();
        } else if (
          produtoKeys.includes(lowerKey) ||
          cleanedKey.includes("produt") ||
          cleanedKey.includes("servic")
        ) {
          produto = String(rowValue ?? "")
            .trim()
            .slice(0, 80);
        } else if (isEntradaCol(lowerKey, cleanedKey)) {
          horarioEntrada = String(rowValue ?? "")
            .trim()
            .slice(0, 80);
        } else if (isSaidaCol(lowerKey, cleanedKey)) {
          // Allow any characters with limit of 80 characters
          horarioSaida = String(rowValue ?? "")
            .trim()
            .slice(0, 80);
        }
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

      let status = "ativo";
      if (kind === "inativos") {
        status = "inativo";
      }
      if (rawStatus && validStatuses.includes(rawStatus.toLowerCase())) {
        status = rawStatus.toLowerCase();
      }

      let inativado_em = null;
      if (status === "inativo" || status === "desligado") {
        inativado_em =
          parseDateToISO(dataInativacao) ||
          colabExistente?.inativado_em ||
          new Date().toISOString();
      }

      let resolvedOperacaoId = null;
      if (rowOperacao && rowOperacao.trim()) {
        const rawOpVal = rowOperacao.trim();
        const normVal = normalizeStr(rawOpVal);
        const cleanVal = cleanKey(normVal);

        // 1. Direct ID match
        let matchedOp = operationsList.find((o: any) => o.id === rawOpVal);

        // 2. Exact match (accent and case insensitive)
        if (!matchedOp) {
          matchedOp = operationsList.find((o: any) => normalizeStr(o.nome) === normVal);
        }

        // 3. Clean alphanumeric match
        if (!matchedOp) {
          matchedOp = operationsList.find((o: any) => cleanKey(o.nome) === cleanVal);
        }

        // 4. Starts with / prefix match
        if (!matchedOp && normVal.length >= 2) {
          matchedOp = operationsList.find((o: any) => {
            const normOp = normalizeStr(o.nome);
            return normOp.startsWith(normVal) || normVal.startsWith(normOp);
          });
        }

        // 5. Substring / contains match
        if (!matchedOp && normVal.length >= 3) {
          matchedOp = operationsList.find((o: any) => {
            const normOp = normalizeStr(o.nome);
            return normOp.includes(normVal) || normVal.includes(normOp);
          });
        }

        // Auto-create new operation if none exists
        if (!matchedOp) {
          const { data: newOp, error: newOpErr } = await db
            .from("operacoes")
            .insert({ nome: rawOpVal, ativo: true })
            .select("id, nome")
            .maybeSingle();
          if (!newOpErr && newOp) {
            matchedOp = newOp;
            operationsList.push(newOp);
          }
        }

        if (matchedOp) {
          resolvedOperacaoId = matchedOp.id;
        }
      }

      const finalOperacaoId =
        resolvedOperacaoId ||
        (selectedOperacaoId !== "todas" && selectedOperacaoId !== "sem_operacao"
          ? selectedOperacaoId
          : colabExistente?.operacao_id || null);

      const colabPayload: any = {
        nome: nome || colabExistente?.nome || "",
        cpf: rawCpf || null,
        email: email || null,
        email_senha: emailSenha || colabExistente?.email_senha || null,
        telefone: telefone !== "" ? telefone : colabExistente?.telefone || null,
        cargo: cargo !== "" ? cargo : colabExistente?.cargo || null,
        status: status as any,
        inativado_em,
        data_nascimento: parseDateToISO(dataNascimento) || colabExistente?.data_nascimento || null,
        operacao_id: finalOperacaoId || null,
        admissao_em: parseDateToISO(admissao) || colabExistente?.admissao_em || null,
        produto: produto !== "" ? produto : colabExistente?.produto || null,
        horario_entrada:
          horarioEntrada !== "" ? horarioEntrada : colabExistente?.horario_entrada || null,
        horario_saida: horarioSaida !== "" ? horarioSaida : colabExistente?.horario_saida || null,
      };

      if (kind === "pre_atendimento") {
        colabPayload.em_pre_atendimento = true;
      } else if (kind === "matriz") {
        colabPayload.em_pre_atendimento = false;
      }

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
        const nameLower = s.nome.toLowerCase().trim();
        const baseNames = [nameLower];
        if (nameLower.includes("intergrall") || nameLower.includes("integrall")) {
          baseNames.push("intergrall", "integrall", "integral", "intergral");
        }

        let userVal = "";
        let passVal = "";

        for (const [rowKey, rowValue] of Object.entries(r)) {
          const colLower = rowKey.toLowerCase().trim();
          if (isEmailSenhaColumn(colLower)) {
            // Do NOT treat email password column as a system password column
            continue;
          }
          const hasBase = baseNames.some((base) => colLower.includes(base));
          if (hasBase) {
            const isPassword =
              colLower.includes("senha") || colLower.includes("pass") || colLower.includes("pw");

            if (isPassword) {
              passVal = String(rowValue ?? "").trim();
            } else {
              const isUser =
                colLower.includes("usu") ||
                colLower.includes("usr") ||
                colLower.includes("log") ||
                colLower.includes("user");

              if (isUser) {
                userVal = String(rowValue ?? "").trim();
              }
            }
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
