import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { db } from "@/integrations/database/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Check,
  X,
  AlertTriangle,
  FileSpreadsheet,
  Eye,
  ArrowRight,
  Layers,
  HelpCircle,
  Search,
  RefreshCw,
  Sparkles,
  FileCheck,
  CheckCheck,
  FileText,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { matchesColumnStatus } from "./pendencias";
import { OperationFilterBar } from "@/components/OperationFilterBar";

export function parseDateToISO(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getUTCFullYear();
      const m = String(val.getUTCMonth() + 1).padStart(2, "0");
      const d = String(val.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return null;
  }
  const str = String(val).trim();
  if (
    !str ||
    str === "-" ||
    str === "—" ||
    str === "N/A" ||
    str === "null" ||
    str === "undefined"
  ) {
    return null;
  }

  // 1. Check Excel serial date number (e.g. 33009 for 1990-05-15, 45869 for 2025, handles floats like 45869.5)
  if (!isNaN(Number(str)) && Number(str) > 1000 && Number(str) < 900000) {
    const excelNum = Number(str);
    const dateObj = new Date((excelNum - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dateObj.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  // 2. Check Brazilian date format DD/MM/YYYY or DD/MM/YY anywhere in string (e.g. "10/09/2026", "Prev. 10/09/2026")
  const brMatch = str.match(
    /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
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

  // 3. Check Brazilian short date DD/MM without year (e.g. 10/09, 15/09) -> infer current year
  const shortBrMatch = str.match(/(?:^|[^\d])(\d{1,2})[/.-](\d{1,2})(?:$|[^\d])/);
  if (shortBrMatch) {
    const d = Number(shortBrMatch[1]);
    const m = Number(shortBrMatch[2]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // 4. Check Portuguese month names (e.g. "10/set/2026", "10 de setembro", "10-out-26")
  const ptMonths: Record<string, string> = {
    jan: "01",
    fev: "02",
    mar: "03",
    abr: "04",
    mai: "05",
    jun: "06",
    jul: "07",
    ago: "08",
    set: "09",
    out: "10",
    nov: "11",
    dez: "12",
  };
  const monthWordMatch = str
    .toLowerCase()
    .match(/(\d{1,2})\s*(?:de|\/|-|\.)\s*([a-z]{3,9})(?:\s*(?:de|\/|-|\.)\s*(\d{2,4}))?/);
  if (monthWordMatch) {
    const d = String(Number(monthWordMatch[1])).padStart(2, "0");
    const monStr = monthWordMatch[2].substring(0, 3);
    const m = ptMonths[monStr];
    if (m) {
      let y = monthWordMatch[3] ? String(monthWordMatch[3]) : String(new Date().getFullYear());
      if (y.length === 2) y = `20${y}`;
      return `${y}-${m}-${d}`;
    }
  }

  // 5. Check ISO format YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = str.match(
    /(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
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

  // 6. Fallback to standard JS Date constructor
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dayVal = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dayVal}`;
  }

  return null;
}

export function formatTimeVal(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const h = String(val.getHours()).padStart(2, "0");
      const m = String(val.getMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    }
    return null;
  }
  const str = String(val).trim();
  if (
    !str ||
    str === "-" ||
    str === "—" ||
    str === "N/A" ||
    str === "null" ||
    str === "undefined"
  ) {
    return null;
  }

  // 1. If decimal between 0 and 1 (Excel time serial, e.g. 0.5694 for 13:40, 0.7083 for 17:00)
  if (!isNaN(Number(str)) && Number(str) >= 0 && Number(str) < 1) {
    const totalMinutes = Math.round(Number(str) * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // 2. If military time or 3-4 digit number (e.g. 1700 -> 17:00, 800 -> 08:00, 1340 -> 13:40)
  if (/^\d{3,4}$/.test(str)) {
    const padded = str.padStart(4, "0");
    const h = Number(padded.slice(0, 2));
    const m = Number(padded.slice(2, 4));
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // 3. If embedded in a datetime or ISO string (e.g. "1899-12-30T17:00:00.000Z", "10/09/2026 17:00:00")
  const dtMatch = str.match(/(?:T|\s+)(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (dtMatch) {
    const h = dtMatch[1].padStart(2, "0");
    const m = dtMatch[2];
    return `${h}:${m}`;
  }

  // 4. Convert 8h, 8h00, 08h30, 17h00min to 08:00, 08:30, 17:00
  const hMatch = str.match(/(\d{1,2})\s*h(?:(\d{2}))?/i);
  if (hMatch) {
    const h = hMatch[1].padStart(2, "0");
    const m = hMatch[2] ? hMatch[2].padStart(2, "0") : "00";
    return `${h}:${m}`;
  }

  // 5. Standard time format 8:00, 08:00:00, 17.00, 17,00 -> 08:00, 17:00
  const timeMatch = str.match(/(\d{1,2})[:.,](\d{2})(?::\d{2})?/);
  if (timeMatch) {
    const h = timeMatch[1].padStart(2, "0");
    const m = timeMatch[2];
    return `${h}:${m}`;
  }

  return str;
}

import { useUserPermissions } from "@/hooks/useUserPermissions";

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
    desc: "Importe novos colaboradores para a esteira de pré-atendimento com controle de admissão, jornada, produto, horários de entrada/saída, início na operação, apelido intergrall e acessos.",
    icon: UserPlus,
    headers: [
      "Nome",
      "CPF",
      "Admissão",
      "Jornada",
      "Produto",
      "Entrada",
      "Saída",
      "Início na Operação",
      "Apelido Intergrall",
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
        Jornada: "06:20 (6x1)",
        Produto: "Atendimento Voz",
        Entrada: "08:00",
        Saída: "17:00",
        "Início na Operação": "15/09/2026",
        "Apelido Intergrall": "CARLOS.S",
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

function getMandatoryHeaders(kind: TemplateKey): string[] {
  switch (kind) {
    case "matriz":
    case "colaboradores":
    case "inativos":
    case "pre_atendimento":
      return ["Nome", "CPF"];
    case "operacoes":
    case "sistemas":
      return ["Nome"];
    case "perfis_acesso":
      return ["Nome", "Sistema"];
    case "acessos":
      return ["CPF Colaborador", "Sistema", "Login"];
    case "pendencias":
      return ["Título", "Tipo", "Status"];
    case "chamados":
      return ["Título", "Tipo", "Status", "Sistema"];
    default:
      return ["Nome"];
  }
}

function downloadCSV(key: TemplateKey, sistemasAll: any[] = []) {
  let headers: string[];
  let sample: Record<string, string>[];

  if (key === "matriz" || key === "inativos" || key === "pre_atendimento") {
    headers = ["Nome", "CPF"];
    if (key === "pre_atendimento") {
      headers.push(
        "Admissão",
        "Jornada",
        "Produto",
        "Entrada",
        "Saída",
        "Início na Operação",
        "Apelido Intergrall",
      );
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
              Jornada: "06:20 (6x1)",
              Produto: "Atendimento Voz",
              Entrada: "08:00",
              Saída: "17:00",
              "Início na Operação": "15/09/2026",
              "Apelido Intergrall": "CARLOS.S",
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
  const { canWrite, isConsulta } = useUserPermissions();
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
      {isConsulta && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold">Modo Consulta (Somente Leitura)</p>
            <p className="text-xs text-amber-700/90 dark:text-amber-300/90 mt-0.5">
              Usuários com perfil de Consulta possuem permissão apenas para visualização e
              exportação. O envio e processamento de arquivos CSV estão desativados para este
              perfil.
            </p>
          </div>
        </div>
      )}

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

interface MatchedColumnItem {
  expected: string;
  foundInFile: string;
  isMandatory: boolean;
}

interface PendingImportData {
  file: File;
  fileName: string;
  fileSize: string;
  isExcel: boolean;
  rows: Record<string, string>[];
  fileHeaders: string[];
  expectedHeaders: string[];
  matchedColumns: MatchedColumnItem[];
  missingMandatory: string[];
  missingOptional: string[];
  extraHeaders: string[];
  matchScore: number;
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
  const { canWrite, isConsulta } = useUserPermissions();
  const [showPreview, setShowPreview] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImportData | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const PREVIEW_PAGE_SIZE = 25;

  let t;
  let baseHeaders: string[] = [];
  let systemHeaders: string[] = [];

  if (kind === "matriz" || kind === "inativos" || kind === "pre_atendimento") {
    baseHeaders = ["Nome", "CPF"];
    if (kind === "pre_atendimento") {
      baseHeaders.push(
        "Admissão",
        "Jornada",
        "Produto",
        "Entrada",
        "Saída",
        "Início na Operação",
        "Apelido Intergrall",
      );
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
            ? "Importe novos colaboradores para a esteira de pré-atendimento com controle de admissão, jornada, produto, horários de entrada/saída, início na operação, apelido intergrall e acessos."
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
            Jornada: "06:20 (6x1)",
            Produto: "Atendimento Voz",
            Entrada: "08:00",
            Saída: "17:00",
            "Início na Operação": "15/09/2026",
            "Apelido Intergrall": "CARLOS.S",
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
      const fileName = file.name.toLowerCase();
      const isExcel =
        fileName.endsWith(".xlsx") ||
        fileName.endsWith(".xls") ||
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel";

      let rows: Record<string, string>[] = [];
      let fileHeaders: string[] = [];

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          raw: false,
          dateNF: "yyyy-mm-dd",
        });

        if (jsonData.length > 0) {
          fileHeaders = Object.keys(jsonData[0]).map((k) => k.trim());
        }

        rows = jsonData
          .map((r: any) => {
            const newR: Record<string, string> = {};
            for (const [k, v] of Object.entries(r)) {
              if (k) newR[k.trim()] = String(v ?? "").substring(0, 250);
            }
            return newR;
          })
          .filter((r) => Object.values(r).some((v) => v && String(v).trim()));
      } else {
        let text = await file.text();
        // Remove UTF-8 BOM if present
        if (text.charCodeAt(0) === 0xfeff) {
          text = text.slice(1);
        }
        // Remove sep=; directive line if present at start of CSV
        text = text.replace(/^sep=\s*;\s*\r?\n/i, "");

        await new Promise<void>((resolve, reject) => {
          Papa.parse<Record<string, string>>(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            delimitersToGuess: [";", ",", "\t", "|"],
            complete: (res) => {
              fileHeaders = (res.meta.fields || []).map((f) => f.trim());
              rows = res.data
                .map((r) => {
                  const newR: Record<string, string> = {};
                  for (const [k, v] of Object.entries(r)) {
                    if (k) newR[k.trim()] = String(v ?? "").substring(0, 250);
                  }
                  return newR;
                })
                .filter((r) => Object.values(r).some((v) => v && String(v).trim()));
              resolve();
            },
            error: (err) => reject(new Error(`Falha ao ler CSV: ${err.message}`)),
          });
        });
      }

      if (rows.length === 0) {
        toast.warning("Arquivo está vazio ou não possui linhas de dados válidas");
        setBusy(false);
        return;
      }

      const cleanKey = (k: string) =>
        k
          .toLowerCase()
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "");

      const expectedHeaders = t.headers;
      const mandatoryHeaders = getMandatoryHeaders(kind);

      const matchedColumns: MatchedColumnItem[] = [];
      const missingMandatory: string[] = [];
      const missingOptional: string[] = [];

      expectedHeaders.forEach((eh: string) => {
        const isMandatory = mandatoryHeaders.some((mh) => cleanKey(mh) === cleanKey(eh));
        const matchedFileHeader = fileHeaders.find((fh) => cleanKey(fh) === cleanKey(eh));
        if (matchedFileHeader) {
          matchedColumns.push({
            expected: eh,
            foundInFile: matchedFileHeader,
            isMandatory,
          });
        } else {
          if (isMandatory) {
            missingMandatory.push(eh);
          } else {
            missingOptional.push(eh);
          }
        }
      });

      const extraHeaders = fileHeaders.filter(
        (fh) => !expectedHeaders.some((eh: string) => cleanKey(eh) === cleanKey(fh)),
      );

      const matchScore = Math.round(
        (matchedColumns.length / Math.max(expectedHeaders.length, 1)) * 100,
      );

      setPendingImport({
        file,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + " KB",
        isExcel,
        rows,
        fileHeaders,
        expectedHeaders,
        matchedColumns,
        missingMandatory,
        missingOptional,
        extraHeaders,
        matchScore,
      });

      setPreviewSearch("");
      setPreviewPage(1);
      setVerifyOpen(true);
      setBusy(false);
    } catch (err: any) {
      toast.error(`Erro ao carregar o arquivo: ${err?.message || err}`);
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setBusy(true);
    try {
      const out = await importRows(kind, pendingImport.rows, selectedOperacaoId);
      setResult(out);
      setVerifyOpen(false);
      setPendingImport(null);
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
  }

  const filteredPreviewRows = useMemo(() => {
    if (!pendingImport) return [];
    if (!previewSearch.trim()) return pendingImport.rows;
    const term = previewSearch.toLowerCase();
    return pendingImport.rows.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(term)),
    );
  }, [pendingImport, previewSearch]);

  const totalPreviewPages = Math.ceil(filteredPreviewRows.length / PREVIEW_PAGE_SIZE) || 1;
  const paginatedPreviewRows = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return filteredPreviewRows.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [filteredPreviewRows, previewPage]);

  return (
    <>
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
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                disabled={!canWrite || busy}
                className="hidden"
                onChange={(e) => {
                  if (!canWrite) return;
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.currentTarget.value = "";
                }}
              />
              {canWrite ? (
                <Button asChild disabled={busy} className="gap-2">
                  <span>
                    <Upload className="h-4 w-4" />{" "}
                    {busy ? "Carregando..." : "Selecionar Planilha para Conferir e Importar"}
                  </span>
                </Button>
              ) : (
                <Button disabled variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" /> Importação Desativada (Modo Consulta)
                </Button>
              )}
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

      {/* MODAL DE CONFERÊNCIA PRÉVIA DA IMPORTAÇÃO */}
      {pendingImport && (
        <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
            <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                      <span>Conferência Prévia de Importação:</span>
                      <span className="text-primary">{t.title}</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-0.5">
                      Confira se as colunas e os dados da planilha correspondem ao layout esperado
                      antes de gravar no banco de dados.
                    </DialogDescription>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs px-2.5 py-1 font-semibold shrink-0 gap-1.5",
                    pendingImport.missingMandatory.length === 0
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
                  )}
                >
                  {pendingImport.missingMandatory.length === 0 ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Colunas Compatíveis
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                      {pendingImport.missingMandatory.length} Campo(s) Obrigatório(s) Ausente(s)
                    </>
                  )}
                </Badge>
              </div>

              {/* Cards de Métricas Rápidas do Arquivo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                <div className="p-2.5 rounded-lg border bg-background/80 shadow-2xs space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-primary" /> Arquivo
                  </span>
                  <p
                    className="text-xs font-bold text-foreground truncate"
                    title={pendingImport.fileName}
                  >
                    {pendingImport.fileName}
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    {pendingImport.fileSize} • {pendingImport.isExcel ? "Excel XLSX" : "CSV"}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg border bg-background/80 shadow-2xs space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-emerald-600" /> Total de Linhas
                  </span>
                  <p className="text-base font-extrabold text-foreground">
                    {pendingImport.rows.length} registros
                  </p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">
                    Prontos para validação
                  </span>
                </div>

                <div className="p-2.5 rounded-lg border bg-background/80 shadow-2xs space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <CheckCheck className="h-3.5 w-3.5 text-blue-600" /> Colunas Reconhecidas
                  </span>
                  <p className="text-base font-extrabold text-foreground">
                    {pendingImport.matchedColumns.length} de {pendingImport.expectedHeaders.length}
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    {pendingImport.matchScore}% dos campos previstos
                  </span>
                </div>

                <div className="p-2.5 rounded-lg border bg-background/80 shadow-2xs space-y-0.5">
                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-amber-600" /> Operação
                  </span>
                  <p className="text-xs font-bold text-foreground truncate">
                    {selectedOperacaoId === "todas"
                      ? "Detectar por Linha / Todas"
                      : "Operação Ativa"}
                  </p>
                  <span className="text-[10px] text-muted-foreground block">Escopo de destino</span>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="colunas" className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5 pt-2 border-b bg-muted/10">
                <TabsList className="bg-muted/50 h-9 p-0.5">
                  <TabsTrigger value="colunas" className="text-xs gap-1.5 h-8">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Conferência das Colunas ({pendingImport.matchedColumns.length}/
                    {pendingImport.expectedHeaders.length})
                  </TabsTrigger>
                  <TabsTrigger value="dados" className="text-xs gap-1.5 h-8">
                    <FileText className="h-3.5 w-3.5" />
                    Prévia dos Dados ({pendingImport.rows.length} linhas)
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ABA 1: CONFERÊNCIA DAS COLUNAS */}
              <TabsContent value="colunas" className="flex-1 overflow-y-auto p-5 space-y-5 m-0">
                {/* Mensagem de Diagnóstico */}
                {pendingImport.missingMandatory.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                    <div>
                      <span className="font-semibold block">
                        Tudo certo! As colunas obrigatórias estão batendo perfeitamente.
                      </span>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        O cabeçalho do arquivo foi identificado com sucesso. Os dados estão prontos
                        para serem inseridos ou atualizados.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <span className="font-semibold block">
                        Atenção: Campos obrigatórios não localizados na planilha!
                      </span>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        O arquivo não contém os seguintes campos obrigatórios:{" "}
                        <strong>{pendingImport.missingMandatory.join(", ")}</strong>. Ajuste o
                        cabeçalho do seu arquivo para corresponder ao modelo antes de importar.
                      </p>
                    </div>
                  </div>
                )}

                {/* 1. Colunas Identificadas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Colunas Reconhecidas e Mapeadas ({pendingImport.matchedColumns.length})
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Campos que serão lidos da sua planilha
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {pendingImport.matchedColumns.map((col) => (
                      <div
                        key={col.expected}
                        className="p-2 rounded-md border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-emerald-900 dark:text-emerald-200 block truncate">
                            {col.expected}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            Na planilha:{" "}
                            <strong className="text-foreground">"{col.foundInFile}"</strong>
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-[10px] shrink-0"
                        >
                          <Check className="h-3 w-3 mr-0.5" /> OK
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Colunas Opcionais Ausentes */}
                {pendingImport.missingOptional.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Colunas Opcionais Ausentes ({pendingImport.missingOptional.length})
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Não encontradas na planilha (serão deixadas em branco ou mantidas)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {pendingImport.missingOptional.map((h) => (
                        <Badge
                          key={h}
                          variant="outline"
                          className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 text-xs py-1 px-2.5 font-medium"
                        >
                          <Info className="h-3 w-3 mr-1 text-amber-600" /> {h}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Colunas Obrigatórias Ausentes */}
                {pendingImport.missingMandatory.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-destructive" />
                      Campos Obrigatórios Faltando ({pendingImport.missingMandatory.length})
                    </span>

                    <div className="flex flex-wrap gap-1.5">
                      {pendingImport.missingMandatory.map((h) => (
                        <Badge
                          key={h}
                          variant="destructive"
                          className="text-xs py-1 px-2.5 font-bold"
                        >
                          <X className="h-3 w-3 mr-1" /> {h} (Obrigatório)
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Colunas Extras na Planilha */}
                {pendingImport.extraHeaders.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        Colunas Adicionais na Planilha ({pendingImport.extraHeaders.length})
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Colunas presentes no arquivo que não fazem parte do modelo (serão ignoradas)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {pendingImport.extraHeaders.map((h) => (
                        <Badge
                          key={h}
                          variant="secondary"
                          className="text-xs py-0.5 px-2 bg-muted text-muted-foreground border text-[11px]"
                        >
                          {h}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ABA 2: PRÉVIA DOS DADOS (TABELA) */}
              <TabsContent value="dados" className="flex-1 flex flex-col overflow-hidden p-0 m-0">
                {/* Barra de Filtro e Busca na Prévia */}
                <div className="p-3 border-b bg-muted/20 flex items-center justify-between gap-3">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar dados da prévia (nome, CPF, etc.)..."
                      value={previewSearch}
                      onChange={(e) => {
                        setPreviewSearch(e.target.value);
                        setPreviewPage(1);
                      }}
                      className="pl-8 h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <span>
                      Exibindo {paginatedPreviewRows.length} de {filteredPreviewRows.length} linhas
                    </span>
                    {totalPreviewPages > 1 && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                          disabled={previewPage === 1}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-[11px] font-medium px-1">
                          {previewPage} / {totalPreviewPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                          disabled={previewPage === totalPreviewPages}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabela com Scroll */}
                <div className="flex-1 overflow-auto border-b">
                  <table className="min-w-full text-xs divide-y divide-border border-collapse">
                    <thead className="bg-muted/60 sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-muted-foreground w-12 border-r">
                          #
                        </th>
                        {pendingImport.fileHeaders.map((h) => {
                          const isMatched = pendingImport.matchedColumns.some(
                            (c) => c.foundInFile === h,
                          );
                          return (
                            <th
                              key={h}
                              className={cn(
                                "px-3 py-2 text-left font-bold border-r whitespace-nowrap",
                                isMatched
                                  ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                                  : "text-muted-foreground",
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>{h}</span>
                                {isMatched && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 border-emerald-500/40 text-emerald-600"
                                  >
                                    Mapeada
                                  </Badge>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background">
                      {paginatedPreviewRows.map((row, idx) => {
                        const rowNum = (previewPage - 1) * PREVIEW_PAGE_SIZE + idx + 1;
                        return (
                          <tr key={idx} className="hover:bg-muted/40 transition-colors">
                            <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground border-r bg-muted/10">
                              {rowNum}
                            </td>
                            {pendingImport.fileHeaders.map((h) => (
                              <td
                                key={h}
                                className="px-3 py-1.5 border-r whitespace-nowrap text-foreground font-mono text-[11px]"
                              >
                                {row[h] || (
                                  <span className="text-muted-foreground/50 italic">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Pronto para importar <strong>{pendingImport.rows.length} registros</strong> em{" "}
                  <strong>{t.title}</strong>.
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setVerifyOpen(false);
                    setPendingImport(null);
                  }}
                  disabled={busy}
                  className="text-xs"
                >
                  Cancelar
                </Button>

                <Button
                  onClick={confirmImport}
                  disabled={busy || pendingImport.missingMandatory.length > 0}
                  className="text-xs gap-2 bg-primary text-primary-foreground font-bold shadow-xs hover:bg-primary/90"
                >
                  {busy ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Gravando no Banco...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirmar e Importar {pendingImport.rows.length} Registros
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
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
      k === "data_nascimento" ||
      k === "inicio_na_operacao"
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
      k === "jornada" ||
      k === "produto" ||
      k === "horario_entrada" ||
      k === "horario_saida" ||
      k === "apelido_intergrall" ||
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
        "id, nome, cpf, email, email_senha, telefone, cargo, status, inativado_em, data_nascimento, operacao_id, admissao_em, produto, horario_entrada, horario_saida, em_pre_atendimento, jornada, apelido_intergrall, inicio_na_operacao" as any,
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

    const isDataInativacaoCol = (lk: string, ck: string) => {
      const exact = [
        "data inativação",
        "data inativacao",
        "data_inativacao",
        "datainativacao",
        "inativado em",
        "inativado_em",
        "data desligamento",
        "data de desligamento",
        "data_desligamento",
        "datadesligamento",
        "desligado em",
        "desligado_em",
        "dt inativacao",
        "dt inativação",
        "dt desligamento",
        "dt_desligamento",
      ];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return (
        ck.includes("inativac") ||
        ck.includes("desligam") ||
        ck.includes("datadeslig") ||
        ck.includes("datainativ")
      );
    };

    const isDataNascimentoCol = (lk: string, ck: string) => {
      const exact = [
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
        "data de nasc",
      ];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return (
        ck.includes("nasciment") ||
        ck.includes("datanasc") ||
        ck.includes("dtnasc") ||
        ck.includes("aniversar")
      );
    };

    const isInicioOperacaoCol = (lk: string, ck: string) => {
      if (isDataInativacaoCol(lk, ck)) return false;
      if (isDataNascimentoCol(lk, ck)) return false;

      const exact = [
        "início na operação",
        "inicio na operacao",
        "início na operacao",
        "inicio na operação",
        "início da operação",
        "inicio da operacao",
        "início da operacao",
        "inicio da operação",
        "início operação",
        "inicio operacao",
        "início operacao",
        "inicio operação",
        "inicio na op",
        "início na op",
        "inicio op",
        "início op",
        "inicio na op.",
        "início na op.",
        "data início operação",
        "data inicio operacao",
        "data início na operação",
        "data inicio na operacao",
        "data de início na operação",
        "data de inicio na operacao",
        "data de início operação",
        "data de inicio operacao",
        "dt início operação",
        "dt inicio operacao",
        "dt. início operação",
        "dt. inicio operacao",
        "dt início na operação",
        "dt inicio na operacao",
        "dt_inicio_operacao",
        "dt_inicio_na_operacao",
        "dt inicio op",
        "dt início op",
        "dt. inicio op",
        "dt. início op",
        "inicio producao",
        "início produção",
        "inicio em producao",
        "início em produção",
        "data producao",
        "data produção",
        "dt producao",
        "dt produção",
        "inicio atendimento",
        "início atendimento",
        "data atendimento",
        "data de atendimento",
        "entrada na operação",
        "entrada na operacao",
        "data entrada operacao",
        "data entrada operação",
        "data de entrada na operacao",
        "data de entrada na operação",
        "dt entrada operacao",
        "dt entrada operação",
        "inicio oper.",
        "início oper.",
        "inicio oper",
        "início oper",
        "operacao inicio",
        "operação início",
        "operacao_inicio",
        "previsao inicio",
        "previsão início",
        "previsao_inicio",
        "previsão_início",
        "previsao de inicio",
        "previsão de início",
        "data prevista",
        "data prevista de inicio",
        "data prevista inicio",
        "prev inicio",
        "prev. inicio",
        "prev início",
        "prev. início",
        "previsao",
        "previsão",
        "inicio treinamento",
        "início treinamento",
        "fim treinamento",
        "fim de treinamento",
        "início estágio",
        "inicio estagio",
        "data início",
        "data inicio",
        "data de início",
        "data de inicio",
        "dt início",
        "dt inicio",
        "dt. início",
        "dt. inicio",
        "dt_inicio",
        "dt_inicio_op",
        "inicio",
        "início",
      ];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return (
        (ck.includes("inicio") ||
          ck.includes("ini") ||
          ck.includes("previs") ||
          ck.includes("prev")) &&
        (ck.includes("operac") ||
          ck.includes("oper") ||
          ck.includes("op") ||
          ck.includes("prod") ||
          ck.includes("atend") ||
          ck.includes("trein") ||
          ck.includes("estag") ||
          ck.includes("data") ||
          ck.includes("dt") ||
          ck === "inicio" ||
          ck === "inicionaop" ||
          ck === "inicionaaoperacao" ||
          ck === "iniciodaoperacao")
      );
    };

    const isAdmissaoCol = (lk: string, ck: string) => {
      if (isDataInativacaoCol(lk, ck)) return false;
      if (isDataNascimentoCol(lk, ck)) return false;
      if (isInicioOperacaoCol(lk, ck)) return false;

      const exact = [
        "admissao",
        "admissão",
        "admissao_em",
        "admissão em",
        "dt_admissao",
        "dt_admissao_em",
        "dt admissao",
        "dt admissão",
        "data admissao",
        "data admissão",
        "data de admissao",
        "data de admissão",
        "data_admissao",
        "data_admissão",
        "dataadmissao",
        "dataadmissão",
        "dt adm",
        "dt adm.",
        "dt. adm",
        "data adm",
        "data adm.",
        "data_adm",
        "adm",
        "contratacao",
        "contratação",
        "data contratacao",
        "data contratação",
        "dt contratacao",
        "dt contratação",
        "data de contratacao",
        "data de contratação",
        "admitido em",
        "admitido",
        "data admissao/inicio",
        "data admissão/início",
      ];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return (
        ck.includes("admiss") ||
        ck.includes("contratac") ||
        ck === "adm" ||
        ck === "dataadm" ||
        ck === "dtadm"
      );
    };

    const isJornadaCol = (lk: string, ck: string) => {
      const exact = [
        "jornada",
        "jornada de trabalho",
        "jornada_trabalho",
        "jornadatrabalho",
        "jornadadetrabalho",
        "escala",
        "escala de trabalho",
        "escala_trabalho",
        "escaladetrabalho",
        "tipo de escala",
        "carga horaria",
        "carga horária",
        "carga_horaria",
        "cargahoraria",
        "ch",
        "ch diaria",
        "ch semanal",
        "tipo jornada",
        "tipo de jornada",
        "tipo_jornada",
        "tipodejornada",
        "horas",
        "horas semanais",
        "horas/dia",
        "regime",
        "regime de trabalho",
        "regime_trabalho",
      ];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return (
        ck.includes("jornad") ||
        ck.includes("cargahor") ||
        ck.includes("escala") ||
        ck === "ch" ||
        ck === "regime"
      );
    };

    const isApelidoCol = (lk: string, ck: string) => {
      const exact = [
        "apelido intergrall",
        "apelido integrall",
        "apelido integral",
        "apelido intergral",
        "apelido_intergrall",
        "apelido_integrall",
        "apelidointergrall",
        "apelidointegrall",
        "apelido",
        "apelido sistema",
        "apelido_sistema",
        "nick",
        "nick intergrall",
        "nick integrall",
        "intergrall",
        "integrall",
        "usuario intergrall",
        "usuário intergrall",
        "usuario integrall",
        "usuário integrall",
        "user intergrall",
        "user integrall",
        "login intergrall",
        "login integrall",
        "login intergral",
        "login integral",
        "apelido intergrall (voz)",
      ];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return (
        ck.includes("intergral") ||
        ck.includes("integral") ||
        ck.includes("apelid") ||
        ck.includes("nick")
      );
    };

    const isSaidaCol = (lk: string, ck: string) => {
      if (isDataInativacaoCol(lk, ck)) return false;
      if (isInicioOperacaoCol(lk, ck)) return false;
      if (isAdmissaoCol(lk, ck)) return false;

      const exact = [
        "saída",
        "saida",
        "horario saída",
        "horario saida",
        "horário saída",
        "horário saida",
        "horario_saida",
        "horário_saida",
        "hora saída",
        "hora saida",
        "hora_saida",
        "hr saída",
        "hr saida",
        "hr. saída",
        "hr. saida",
        "horario de saída",
        "horario de saida",
        "horário de saída",
        "horário de saida",
        "termino",
        "término",
        "horario termino",
        "horario término",
        "horário término",
        "horário termino",
        "horario de termino",
        "horario de término",
        "hora termino",
        "hora término",
        "fim",
        "horario fim",
        "horário fim",
        "hora fim",
        "hr fim",
        "hr. fim",
        "saida (horário)",
        "saída (horário)",
        "saida (horario)",
        "saída (horario)",
        "saida prevista",
        "saída prevista",
        "fim de expediente",
        "fim do turno",
        "saida turno",
        "saída turno",
        "desconexao",
        "desconexão",
        "horario desconexao",
        "horario desconexão",
        "saida operacao",
        "saída operação",
        "saida oper",
        "saída oper",
        "hr saida operacao",
        "saida (h)",
        "saída (h)",
        "saida/fim",
        "saída/fim",
      ];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return (
        ck.includes("said") ||
        ck.includes("termin") ||
        ck.includes("desconex") ||
        (ck.includes("horario") && ck.includes("fim")) ||
        (ck.includes("hora") && ck.includes("fim")) ||
        (ck.includes("hr") && ck.includes("fim"))
      );
    };

    const isEntradaCol = (lk: string, ck: string) => {
      if (isInicioOperacaoCol(lk, ck)) return false;
      if (isAdmissaoCol(lk, ck)) return false;
      if (isDataNascimentoCol(lk, ck)) return false;
      if (isDataInativacaoCol(lk, ck)) return false;

      const exact = [
        "entrada",
        "horario entrada",
        "horário entrada",
        "horario_entrada",
        "hora entrada",
        "hora_entrada",
        "horario de entrada",
        "horário de entrada",
        "hr entrada",
        "hr. entrada",
        "entrada (horário)",
        "entrada (horario)",
        "horario inicio",
        "horário início",
        "horario de início",
        "horario de inicio",
        "hora inicio",
        "hora início",
        "hr inicio",
        "hr início",
        "inicio turno",
        "início turno",
        "inicio do turno",
        "início do turno",
        "entrada turno",
        "horario conexao",
        "horario conexão",
        "conexao",
        "conexão",
      ];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return (
        ck.includes("entrad") ||
        (ck.includes("horario") && (ck.includes("ini") || ck.includes("entr"))) ||
        (ck.includes("hora") && (ck.includes("ini") || ck.includes("entr")))
      );
    };

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
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
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

    const isCargoCol = (lk: string, ck: string) => {
      const exact = [
        "cargo",
        "funcao",
        "função",
        "posicao",
        "posição",
        "role",
        "perfil_cargo",
        "ocupacao",
        "ocupação",
      ];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return ck === "cargo" || ck === "funcao" || ck === "posicao" || ck === "ocupacao";
    };

    const isStatusCol = (lk: string, ck: string) => {
      const exact = ["status", "situacao", "situação", "estado", "condicao", "condição"];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return ck === "status" || ck === "situacao" || ck === "estado";
    };

    const isProdutoCol = (lk: string, ck: string) => {
      if (isInicioOperacaoCol(lk, ck)) return false;
      const exact = [
        "produto",
        "produto/servico",
        "produto/serviço",
        "produto / servico",
        "produto / serviço",
        "servico",
        "serviço",
        "campanha",
        "projeto",
        "fila",
        "skill",
        "segmento",
        "carteira",
        "linha de negocio",
        "linha de negócio",
      ];
      if (exact.includes(lk) || exact.map(cleanKey).includes(ck)) return true;
      return (
        ck.includes("produt") ||
        ck.includes("servic") ||
        ck.includes("carteir") ||
        ck.includes("segment")
      );
    };

    const isOperacaoColumn = (rawKey: string): boolean => {
      const lk = rawKey.toLowerCase().trim();
      const ck = cleanKey(lk);
      if (isInicioOperacaoCol(lk, ck)) return false;
      if (isEntradaCol(lk, ck)) return false;
      if (isSaidaCol(lk, ck)) return false;
      if (isAdmissaoCol(lk, ck)) return false;
      if (isJornadaCol(lk, ck)) return false;
      if (isApelidoCol(lk, ck)) return false;
      if (isProdutoCol(lk, ck)) return false;

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
      let jornada = "";
      let produto = "";
      let horarioEntrada = "";
      let horarioSaida = "";
      let inicioOperacao = "";
      let apelidoIntergrall = "";

      const rowEntries = Object.entries(r);

      for (const [rowKey, rowValue] of rowEntries) {
        const lowerKey = rowKey.toLowerCase().trim();
        const cleanedKey = cleanKey(lowerKey);
        const rawVal = String(rowValue ?? "").trim();
        if (!rawVal && rawVal !== "") continue;

        if (
          lowerKey === "nome" ||
          cleanedKey === "nome" ||
          lowerKey === "coluna a" ||
          lowerKey === "col a" ||
          (lowerKey === "a" && rowEntries.length <= 4)
        ) {
          nome = rawVal;
        } else if (
          lowerKey === "cpf" ||
          cleanedKey === "cpf" ||
          lowerKey === "coluna b" ||
          lowerKey === "col b" ||
          (lowerKey === "b" && rowEntries.length <= 4)
        ) {
          rawCpf = rawVal;
        } else if (isEmailSenhaColumn(lowerKey)) {
          emailSenha = rawVal;
        } else if (
          lowerKey === "email" ||
          cleanedKey === "email" ||
          lowerKey === "e-mail" ||
          cleanedKey === "correio" ||
          cleanedKey === "webmail"
        ) {
          email = rawVal;
        } else if (isInicioOperacaoCol(lowerKey, cleanedKey)) {
          inicioOperacao = rawVal;
        } else if (isAdmissaoCol(lowerKey, cleanedKey)) {
          admissao = rawVal;
        } else if (isJornadaCol(lowerKey, cleanedKey)) {
          jornada = rawVal;
        } else if (isSaidaCol(lowerKey, cleanedKey)) {
          horarioSaida = rawVal;
        } else if (isEntradaCol(lowerKey, cleanedKey)) {
          horarioEntrada = rawVal;
        } else if (isApelidoCol(lowerKey, cleanedKey)) {
          apelidoIntergrall = rawVal;
        } else if (isDataInativacaoCol(lowerKey, cleanedKey)) {
          dataInativacao = rawVal;
        } else if (isDataNascimentoCol(lowerKey, cleanedKey)) {
          dataNascimento = rawVal;
        } else if (isTelefoneCol(lowerKey, cleanedKey)) {
          telefone = rawVal;
        } else if (isCargoCol(lowerKey, cleanedKey)) {
          cargo = rawVal;
        } else if (isStatusCol(lowerKey, cleanedKey)) {
          rawStatus = rawVal;
        } else if (isProdutoCol(lowerKey, cleanedKey)) {
          produto = rawVal;
        } else if (isOperacaoColumn(lowerKey)) {
          rowOperacao = rawVal;
        }
      }

      // Fallback for 2 or 3-column files (e.g. Column A: Nome, Column B: CPF, Column C: Apelido Intergrall)
      if (rowEntries.length >= 2 && rowEntries.length <= 4) {
        if (!apelidoIntergrall && rowEntries[2]) {
          const col3Val = String(rowEntries[2][1] ?? "").trim();
          if (col3Val && !col3Val.includes("@")) {
            apelidoIntergrall = col3Val;
          }
        }
        if (!nome && rowEntries[0]) {
          nome = String(rowEntries[0][1] ?? "").trim();
        }
        if (!rawCpf && rowEntries[1]) {
          const col2Val = String(rowEntries[1][1] ?? "").trim();
          if (col2Val.replace(/\D/g, "").length >= 7) {
            rawCpf = col2Val;
          }
        }
      }

      // Intelligent positional fallback for Pré-Atendimento template when headers were slightly altered
      if ((!horarioSaida || !inicioOperacao || !horarioEntrada) && rowEntries.length >= 6) {
        for (let colIdx = 0; colIdx < rowEntries.length; colIdx++) {
          const [rk, rv] = rowEntries[colIdx];
          const valStr = String(rv ?? "").trim();
          if (!valStr) continue;

          const lk = rk.toLowerCase().trim();
          const ck = cleanKey(lk);

          // If Saída wasn't matched yet
          if (
            !horarioSaida &&
            (ck.includes("said") || ck.includes("fim") || ck.includes("termin") || colIdx === 6)
          ) {
            const timeCheck = formatTimeVal(valStr);
            if (timeCheck) {
              horarioSaida = valStr;
            }
          }

          // If Início Operação wasn't matched yet
          if (
            !inicioOperacao &&
            (ck.includes("inic") || ck.includes("oper") || ck.includes("prev") || colIdx === 7)
          ) {
            const dateCheck = parseDateToISO(valStr);
            if (dateCheck && valStr !== admissao && valStr !== dataNascimento) {
              inicioOperacao = valStr;
            }
          }

          // If Entrada wasn't matched yet
          if (!horarioEntrada && (ck.includes("entr") || colIdx === 5)) {
            const timeCheck = formatTimeVal(valStr);
            if (timeCheck && valStr !== horarioSaida) {
              horarioEntrada = valStr;
            }
          }
        }
      }

      const cpfKey = rawCpf.replace(/\D/g, "");
      const nomeKey = nome.toLowerCase();

      const colabExistente =
        (cpfKey && colabMap.get(`cpf:${cpfKey}`)) || (nomeKey && colabMap.get(`nome:${nomeKey}`));

      if (!nome && colabExistente) {
        nome = colabExistente.nome;
      }
      if (!rawCpf && colabExistente) {
        rawCpf = colabExistente.cpf || "";
      }

      if (!nome) {
        fail++;
        errors.push(`Linha ${i + 2}: O campo 'nome' é obrigatório.`);
        continue;
      }

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

      const parsedInicioOp = parseDateToISO(inicioOperacao);
      const formattedSaida = formatTimeVal(horarioSaida);
      const formattedEntrada = formatTimeVal(horarioEntrada);

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
        jornada: jornada !== "" ? jornada : colabExistente?.jornada || null,
        produto: produto !== "" ? produto : colabExistente?.produto || null,
        horario_entrada:
          formattedEntrada ||
          (horarioEntrada ? horarioEntrada.trim() : colabExistente?.horario_entrada || null),
        horario_saida:
          formattedSaida ||
          (horarioSaida ? horarioSaida.trim() : colabExistente?.horario_saida || null),
        inicio_na_operacao:
          parsedInicioOp ||
          (inicioOperacao ? inicioOperacao.trim() : colabExistente?.inicio_na_operacao || null),
        apelido_intergrall:
          apelidoIntergrall !== "" ? apelidoIntergrall : colabExistente?.apelido_intergrall || null,
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

          // Auto-resolve any open pendência for this collaborator + system if real credentials were saved
          const isRealLogin =
            userVal && !["", "-", "Solicitado", "solicitado"].includes(userVal.trim());
          const isRealSenha =
            passVal &&
            !["", "-", "Solicitado", "solicitado", "REDEFINIÇÃO", "REENVIAR"].includes(
              passVal.trim(),
            );
          if (isRealLogin && isRealSenha) {
            const nowIso = new Date().toISOString();
            await db
              .from("pendencias")
              .update({
                status: "concluido",
                concluido_em: nowIso,
                data_resolucao: nowIso.split("T")[0],
                arquivado: true,
              })
              .eq("colaborador_id", colId)
              .eq("sistema_id", s.id)
              .eq("arquivado", false);
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

  // Registrar auditoria da importação no histórico
  try {
    const templateTitle = TEMPLATES[kind]?.name || kind;
    const desc = `Importação em lote: ${templateTitle} (${ok} processados com sucesso, ${fail} falhas)`;
    await db.from("historico").insert({
      entidade: "importacao",
      acao: "IMPORT",
      ator_id: loggedIn.user?.id || null,
      descricao: desc,
      dados_depois: {
        tipo: kind,
        template: templateTitle,
        total_linhas: rows.length,
        sucesso: ok,
        falhas: fail,
        operacao_id: selectedOperacaoId !== "todas" ? selectedOperacaoId : null,
        data_execucao: new Date().toISOString(),
      },
    });
  } catch (histErr) {
    console.warn("Falha ao registrar histórico de importação:", histErr);
  }

  return { ok, fail, errors };
}
