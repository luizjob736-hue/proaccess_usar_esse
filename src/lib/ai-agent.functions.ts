import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";
import { requireDatabaseAuth } from "@/integrations/database/auth-middleware";

export interface AiPoint {
  titulo: string;
  descricao: string;
  impacto: "alto" | "medio" | "baixo";
  categoria: "sla" | "gargalo" | "seguranca" | "operacao";
}

export interface AiSystemObs {
  sistema: string;
  observacao: string;
  status: "atencao" | "critico" | "normal";
}

export interface AiPendenciasAnalysis {
  resumoGeral: string;
  nivelRisco: "baixo" | "medio" | "alto" | "critico";
  scoreSaude: number; // 0 a 100
  totalPendencias: number;
  pontosCruciais: AiPoint[];
  observacoesSistemas: AiSystemObs[];
  recomendacoes: string[];
  dataAnalise: string;
  fonte: "gemini" | "heuristica";
}

// Heuristic fallback in case of transient model unavailability or network delay
function generateHeuristicAnalysis(metrics: any): AiPendenciasAnalysis {
  const {
    total = 0,
    padrao = 0,
    pine = 0,
    criticas = 0,
    altas = 0,
    medias = 0,
    baixas = 0,
    sistemasMap = {},
    orfaos = 0,
    semResponsavel = 0,
    colabAtivos = 0,
    acessosAtivos = 0,
  } = metrics;

  const pontosCruciais: AiPoint[] = [];
  const observacoesSistemas: AiSystemObs[] = [];
  const recomendacoes: string[] = [];

  // 1. Critical & High Priority Assessment
  const urgenteTotal = criticas + altas;
  let nivelRisco: "baixo" | "medio" | "alto" | "critico" = "baixo";
  let score = 100;

  if (criticas > 0) {
    nivelRisco = "critico";
    score -= Math.min(45, criticas * 15);
    pontosCruciais.push({
      titulo: `${criticas} Pendência(s) de Severidade Crítica`,
      descricao: `Identificadas solicitações críticas sem conclusão que demandam intervenção imediata para evitar paralisação operacional.`,
      impacto: "alto",
      categoria: "gargalo",
    });
  } else if (altas > 3) {
    nivelRisco = "alto";
    score -= Math.min(30, altas * 5);
  } else if (total > 15) {
    nivelRisco = "medio";
    score -= 15;
  }

  if (altas > 0) {
    pontosCruciais.push({
      titulo: `${altas} Pendência(s) com Alta Prioridade`,
      descricao: `Volume expressivo de acessos urgentes aguardando concessão ou resolução de credenciais.`,
      impacto: "alto",
      categoria: "sla",
    });
  }

  // 2. Pine vs Standard distribution
  if (pine > 0) {
    pontosCruciais.push({
      titulo: `Integração de Pendências Pine (${pine} itens)`,
      descricao: `As pendências da operação Pine representam ${(total > 0 ? ((pine / total) * 100).toFixed(0) : 0)}% do backlog ativo e requerem validação contínua na esteira de concessão.`,
      impacto: pine > 10 ? "alto" : "medio",
      categoria: "operacao",
    });
  }

  // 3. Orphaned Credentials / Security
  if (orfaos > 0) {
    score -= Math.min(25, orfaos * 5);
    pontosCruciais.push({
      titulo: `${orfaos} Acesso(s) Órfão(s) Detectado(s)`,
      descricao: `Credenciais ativas vinculadas a colaboradores desligados ou inativos representam risco de conformidade e segurança da informação.`,
      impacto: "alto",
      categoria: "seguranca",
    });
    recomendacoes.push("Revogar ou transferir imediatamente as credenciais dos colaboradores inativos.");
  }

  // 4. Systems Breakdown
  const topSistemas = Object.entries(sistemasMap)
    .map(([nome, count]: [string, any]) => ({ nome, count: Number(count) }))
    .sort((a, b) => b.count - a.count);

  if (topSistemas.length > 0) {
    const top1 = topSistemas[0];
    if (top1.count > 0) {
      observacoesSistemas.push({
        sistema: top1.nome,
        observacao: `Concentra a maior fatia de pendências ativas (${top1.count} solicitações). Ponto de atenção para alocação de equipe.`,
        status: top1.count >= 5 ? "critico" : "atencao",
      });
    }

    topSistemas.slice(1, 4).forEach((sis) => {
      if (sis.count > 0) {
        observacoesSistemas.push({
          sistema: sis.nome,
          observacao: `${sis.count} pendência(s) registrada(s). Fluxo com demanda moderada.`,
          status: sis.count > 3 ? "atencao" : "normal",
        });
      }
    });
  }

  // Recommendations
  if (criticas > 0 || altas > 0) {
    recomendacoes.push("Priorizar a fila de chamados e solicitações com SLA expirando nas próximas 24 horas.");
  }
  if (topSistemas.length > 0 && topSistemas[0].count > 3) {
    recomendacoes.push(`Realizar mutirão de liberação de acessos focado no sistema "${topSistemas[0].nome}".`);
  }
  if (pine > 0) {
    recomendacoes.push("Realizar o checklist e dar baixa nas pendências solucionadas da guia Pine para atualizar o Dashboard.");
  }
  if (recomendacoes.length === 0) {
    recomendacoes.push("Manter monitoramento rotineiro das solicitações de acesso e matriz de perfis.");
    recomendacoes.push("Garantir que novos colaboradores passem pelo fluxo de Pré-Atendimento com antecedência.");
  }

  score = Math.max(20, Math.min(100, score));

  return {
    resumoGeral:
      total === 0
        ? "Excelente! Nenhuma pendência ativa no momento. Todas as concessões de acesso estão regularizadas e em conformidade."
        : `O backlog atual conta com ${total} pendência(s) ativa(s) (${padrao} gerais e ${pine} Pine). O índice de saúde operacional está avaliado em ${score}/100 com nível de risco ${nivelRisco.toUpperCase()}.`,
    nivelRisco,
    scoreSaude: score,
    totalPendencias: total,
    pontosCruciais: pontosCruciais.length > 0 ? pontosCruciais : [
      {
        titulo: "Operação Estável e Fluida",
        descricao: "Não foram detectados gargalos críticos ou quebras de SLA no volume atual de concessões.",
        impacto: "baixo",
        categoria: "operacao",
      }
    ],
    observacoesSistemas: observacoesSistemas.length > 0 ? observacoesSistemas : [
      {
        sistema: "Geral",
        observacao: "Todos os sistemas operando dentro da normalidade sem acúmulo de requisições.",
        status: "normal",
      }
    ],
    recomendacoes,
    dataAnalise: new Date().toISOString(),
    fonte: "heuristica",
  };
}

export const analyzePendenciasWithAi = createServerFn({ method: "POST" })
  .validator((d: any) => d)
  .handler(async ({ data }): Promise<AiPendenciasAnalysis> => {
    const metrics = data?.metrics || {};
    const {
      total = 0,
      padrao = 0,
      pine = 0,
      criticas = 0,
      altas = 0,
      medias = 0,
      baixas = 0,
      sistemasMap = {},
      orfaos = 0,
      semResponsavel = 0,
      colabAtivos = 0,
      acessosAtivos = 0,
      amostraPendencias = [],
    } = metrics;

    const fallbackResult = generateHeuristicAnalysis(metrics);

    // If Gemini key is missing or no pendencias, return fast
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return fallbackResult;
    }

    const prompt = `
Você é o Agente Inteligente de Diagnóstico e Auditoria do ProAccess (sistema corporativo de gestão de acessos e segurança da informação).
Analise o estado atual das pendências e acessos do sistema e produza um diagnóstico estratégico, pontos cruciais de atenção, observações por sistema e recomendações práticas.

### DADOS ATUAIS DO SISTEMA:
- Total de Pendências Ativas: ${total} (${padrao} solicitações padrão / kanban + ${pine} pendências da esteira Pine)
- Distribuição por Prioridade: ${criticas} Críticas, ${altas} Altas, ${medias} Médias, ${baixas} Baixas
- Acessos Órfãos (colaboradores desligados/inativos com credenciais ativas): ${orfaos}
- Sistemas sem Responsável Definido: ${semResponsavel}
- Total de Colaboradores Ativos: ${colabAtivos}
- Total de Acessos Ativos: ${acessosAtivos}
- Volume por Sistema/Produto: ${JSON.stringify(sistemasMap)}
- Amostra de Títulos e Detalhes de Pendências: ${JSON.stringify(amostraPendencias.slice(0, 15))}

### REQUISITOS DA RESPOSTA:
Responda ESTRITAMENTE em formato JSON válido, sem texto antes ou depois, seguindo esta estrutura:
{
  "resumoGeral": "Texto conciso de 2 a 3 frases com o diagnóstico executivo e estado da operação.",
  "nivelRisco": "baixo" | "medio" | "alto" | "critico",
  "scoreSaude": número inteiro de 0 a 100,
  "pontosCruciais": [
    {
      "titulo": "Título curto e chamativo do ponto crucial",
      "descricao": "Explicação detalhada do impacto operacional ou de segurança",
      "impacto": "alto" | "medio" | "baixo",
      "categoria": "sla" | "gargalo" | "seguranca" | "operacao"
    }
  ],
  "observacoesSistemas": [
    {
      "sistema": "Nome do Sistema",
      "observacao": "Análise específica deste sistema ou produto",
      "status": "atencao" | "critico" | "normal"
    }
  ],
  "recomendacoes": [
    "Recomendação prática acionável 1",
    "Recomendação prática acionável 2",
    "Recomendação prática acionável 3"
  ]
}
`;

    try {
      const ai = new GoogleGenAI();
      const models = ["gemini-3.8-flash", "gemini-flash-latest"];
      
      let responseText = "";
      for (const model of models) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            },
          });
          if (res && res.text) {
            responseText = res.text;
            break;
          }
        } catch (mErr: any) {
          console.warn(`Tentativa com ${model} falhou:`, mErr?.message);
        }
      }

      if (!responseText) {
        return fallbackResult;
      }

      // Parse JSON from Gemini
      let cleaned = responseText.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim();
      }

      const parsed = JSON.parse(cleaned);

      return {
        resumoGeral: parsed.resumoGeral || fallbackResult.resumoGeral,
        nivelRisco: parsed.nivelRisco || fallbackResult.nivelRisco,
        scoreSaude: typeof parsed.scoreSaude === "number" ? parsed.scoreSaude : fallbackResult.scoreSaude,
        totalPendencias: total,
        pontosCruciais: Array.isArray(parsed.pontosCruciais) && parsed.pontosCruciais.length > 0
          ? parsed.pontosCruciais
          : fallbackResult.pontosCruciais,
        observacoesSistemas: Array.isArray(parsed.observacoesSistemas) && parsed.observacoesSistemas.length > 0
          ? parsed.observacoesSistemas
          : fallbackResult.observacoesSistemas,
        recomendacoes: Array.isArray(parsed.recomendacoes) && parsed.recomendacoes.length > 0
          ? parsed.recomendacoes
          : fallbackResult.recomendacoes,
        dataAnalise: new Date().toISOString(),
        fonte: "gemini",
      };
    } catch (err: any) {
      console.warn("Erro ao gerar análise via Gemini, usando heurística especializada:", err?.message || err);
      return fallbackResult;
    }
  });
