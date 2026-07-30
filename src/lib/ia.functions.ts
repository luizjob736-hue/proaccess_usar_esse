import { createServerFn } from "@tanstack/react-start";
import { requireDatabaseAuth } from "@/integrations/database/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

async function fetchContext(db: any) {
  const [c, s, a, p] = await Promise.all([
    db.from("colaboradores").select("nome,cargo,status,operacao:operacoes(nome)").limit(200),
    db.from("sistemas").select("nome,criticidade,responsavel:profiles(nome)").limit(200),
    db
      .from("acessos")
      .select("status,colaborador:colaboradores(nome,status),sistema:sistemas(nome)")
      .limit(300),
    db.from("pendencias").select("titulo,status,prioridade,tipo").limit(200),
  ]);
  const orfaos = (a.data ?? [])
    .filter((x: any) => x.status === "ativo" && x.colaborador?.status === "desligado")
    .map((x: any) => `${x.colaborador?.nome} → ${x.sistema?.nome}`);
  const semResp = (s.data ?? []).filter((x: any) => !x.responsavel).map((x: any) => x.nome);
  return {
    resumo: {
      colaboradores: c.data?.length ?? 0,
      sistemas: s.data?.length ?? 0,
      acessos: a.data?.length ?? 0,
      pendencias: p.data?.length ?? 0,
      acessos_orfaos: orfaos,
      sistemas_sem_responsavel: semResp,
    },
    colaboradores: c.data ?? [],
    sistemas: s.data ?? [],
    pendencias: p.data ?? [],
  };
}

export const iaChat = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .inputValidator((d: { messages: { role: string; content: string }[] }) => d)
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");
    const ctx = await fetchContext(context.db);
    const system = `Você é o assistente do ProAccess, sistema de gestão de acessos. Responda em português (Brasil), de forma direta e útil.
Você tem acesso ao contexto ATUAL da base de dados abaixo em JSON. Use-o para responder perguntas, detectar inconsistências, sugerir acessos, gerar relatórios/resumos, apontar acessos órfãos (colaborador desligado com acesso ativo), sistemas sem responsável e riscos.

CONTEXTO:
${JSON.stringify(ctx, null, 2)}`;
    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429)
        throw new Error("Limite de requisições. Tente novamente em instantes.");
      if (res.status === 402)
        throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`Erro IA (${res.status}): ${t}`);
    }
    const j = await res.json();
    return { content: j.choices?.[0]?.message?.content ?? "" };
  });
