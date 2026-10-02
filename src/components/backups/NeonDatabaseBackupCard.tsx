import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Database,
  Download,
  FileCode,
  FileJson,
  RefreshCw,
  HardDrive,
  Table,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Server,
  Layers,
  Terminal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getNeonDatabaseStats,
  generateNeonDumpServerFn,
  downloadNeonDumpServerFn,
} from "@/lib/backups.functions";
import { cn } from "@/lib/utils";

export function NeonDatabaseBackupCard() {
  const qc = useQueryClient();
  const [showTableDetails, setShowTableDetails] = useState(false);
  const [showCliInstructions, setShowCliInstructions] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<
    "sql" | "sql.gz" | "json" | "json.gz" | null
  >(null);

  const getStatsFn = useServerFn(getNeonDatabaseStats);
  const generateDumpFn = useServerFn(generateNeonDumpServerFn);
  const downloadDumpFn = useServerFn(downloadNeonDumpServerFn);

  const { data: dbInfo, isLoading, isFetching } = useQuery({
    queryKey: ["neon-database-info"],
    queryFn: async () => {
      return await getStatsFn();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return await generateDumpFn();
    },
    onSuccess: (res) => {
      toast.success(
        `Cópia do banco gerada com sucesso! ${res.totalRows.toLocaleString("pt-BR")} registros exportados em ${(res.durationMs / 1000).toFixed(1)}s.`,
      );
      qc.invalidateQueries({ queryKey: ["neon-database-info"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao gerar cópia do banco de dados");
    },
  });

  const handleDownload = async (format: "sql" | "sql.gz" | "json" | "json.gz") => {
    if (downloadingFormat) return;
    setDownloadingFormat(format);
    const toastId = toast.loading(`Preparando e exportando cópia (${format.toUpperCase()})...`);

    try {
      const res = await downloadDumpFn({ data: { format } });
      let blob: Blob;

      if (res.isBase64) {
        const binaryString = atob(res.content);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: res.mimeType });
      } else {
        blob = new Blob([res.content], { type: res.mimeType });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Download concluído: ${res.filename} (${res.sizeMb} MB)!`, {
        id: toastId,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao realizar o download da cópia do banco de dados", {
        id: toastId,
      });
    } finally {
      setDownloadingFormat(null);
    }
  };

  const isWorking = generateMutation.isPending || isFetching || !!downloadingFormat;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-md overflow-hidden">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg md:text-xl font-bold tracking-tight">
                  Cópia Completa do Banco de Dados Neon (PostgreSQL)
                </CardTitle>
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[11px] font-semibold"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  PostgreSQL Serverless Online
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Exportação de dump íntegro contendo estrutura DDL (CREATE TABLE) e dados DML (INSERT INTO) de todas as tabelas.
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={isWorking}
            className="gap-2 shrink-0 border-primary/30 hover:bg-primary/5"
            title="Atualizar dump do banco de dados"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isWorking && "animate-spin text-primary")} />
            <span>{generateMutation.isPending ? "Gerando Cópia..." : "Atualizar Cópia Agora"}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 md:p-6 space-y-5">
        {/* Metadados e Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border bg-background/60 shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" /> Total de Tabelas
            </span>
            <p className="text-xl font-black text-foreground">
              {isLoading ? "..." : `${dbInfo?.totalTables ?? 27} tabelas`}
            </p>
            <span className="text-[10px] text-muted-foreground block truncate">
              Schema public completo
            </span>
          </div>

          <div className="p-3 rounded-lg border bg-background/60 shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Table className="h-3.5 w-3.5 text-emerald-600" /> Registros no Banco
            </span>
            <p className="text-xl font-black text-foreground">
              {isLoading ? "..." : (dbInfo?.totalRows ?? 0).toLocaleString("pt-BR")}
            </p>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block truncate">
              100% dos dados relacionais
            </span>
          </div>

          <div className="p-3 rounded-lg border bg-background/60 shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-blue-600" /> Tamanho do Dump
            </span>
            <p className="text-xl font-black text-foreground">
              {isLoading ? "..." : `${dbInfo?.sqlFileSizeMb || "60.9"} MB`}
            </p>
            <span className="text-[10px] text-muted-foreground block truncate">
              {isLoading ? "..." : `Compactado: ${dbInfo?.sqlGzSizeMb || "7.2"} MB`}
            </span>
          </div>

          <div className="p-3 rounded-lg border bg-background/60 shadow-2xs space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-amber-600" /> Servidor Neon
            </span>
            <p className="text-sm font-bold text-foreground truncate">
              AWS us-east-2
            </p>
            <span className="text-[10px] text-muted-foreground block truncate">
              Banco: {dbInfo?.database || "neondb"}
            </span>
          </div>
        </div>

        {/* Botões de Ação de Download */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Opções de Exportação e Download da Cópia
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Button
              onClick={() => handleDownload("sql")}
              disabled={isWorking}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs justify-start h-11"
            >
              {downloadingFormat === "sql" ? (
                <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <FileCode className="h-4 w-4 shrink-0" />
              )}
              <div className="text-left min-w-0">
                <div className="text-xs font-bold leading-tight">
                  {downloadingFormat === "sql" ? "Baixando..." : "Baixar Dump SQL (.sql)"}
                </div>
                <div className="text-[10px] opacity-80 font-normal">
                  {dbInfo?.sqlFileSizeMb || "60.9"} MB — DDL + INSERTS
                </div>
              </div>
            </Button>

            <Button
              onClick={() => handleDownload("sql.gz")}
              disabled={isWorking}
              variant="outline"
              className="gap-2 border-emerald-600/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 justify-start h-11 shadow-xs"
            >
              {downloadingFormat === "sql.gz" ? (
                <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
              ) : (
                <Download className="h-4 w-4 text-emerald-600 shrink-0" />
              )}
              <div className="text-left min-w-0">
                <div className="text-xs font-bold leading-tight">
                  {downloadingFormat === "sql.gz" ? "Compactando e Baixando..." : "SQL Compactado (.sql.gz)"}
                </div>
                <div className="text-[10px] text-muted-foreground font-normal">
                  ⚡ Recomendado ({dbInfo?.sqlGzSizeMb || "7.2"} MB)
                </div>
              </div>
            </Button>

            <Button
              onClick={() => handleDownload("json")}
              disabled={isWorking}
              variant="outline"
              className="gap-2 border-blue-500/40 text-blue-800 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 justify-start h-11 shadow-xs"
            >
              {downloadingFormat === "json" ? (
                <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
              ) : (
                <FileJson className="h-4 w-4 text-blue-600 shrink-0" />
              )}
              <div className="text-left min-w-0">
                <div className="text-xs font-bold leading-tight">
                  {downloadingFormat === "json" ? "Baixando JSON..." : "Baixar Dump JSON (.json)"}
                </div>
                <div className="text-[10px] text-muted-foreground font-normal">
                  {dbInfo?.jsonFileSizeMb || "100.0"} MB — Objeto Estruturado
                </div>
              </div>
            </Button>

            <Button
              onClick={() => handleDownload("json.gz")}
              disabled={isWorking}
              variant="outline"
              className="gap-2 border-border/80 text-muted-foreground hover:text-foreground justify-start h-11 shadow-xs"
            >
              {downloadingFormat === "json.gz" ? (
                <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Download className="h-4 w-4 shrink-0" />
              )}
              <div className="text-left min-w-0">
                <div className="text-xs font-bold leading-tight">
                  {downloadingFormat === "json.gz" ? "Baixando..." : "JSON Compactado (.json.gz)"}
                </div>
                <div className="text-[10px] opacity-80 font-normal">
                  Leve ({dbInfo?.jsonGzSizeMb || "7.6"} MB)
                </div>
              </div>
            </Button>
          </div>
        </div>

        {/* Toggles Expansíveis para Detalhes das Tabelas e Instruções CLI */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTableDetails(!showTableDetails)}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2.5"
          >
            <Table className="h-3.5 w-3.5" />
            <span>{showTableDetails ? "Ocultar Mapeamento de Tabelas" : "Mapeamento das 27 Tabelas"}</span>
            {showTableDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCliInstructions(!showCliInstructions)}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2.5"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>{showCliInstructions ? "Ocultar Instruções de Restauração" : "Como Restaurar (CLI)"}</span>
            {showCliInstructions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>

          {dbInfo?.lastDumpAt && (
            <span className="text-[11px] text-muted-foreground ml-auto">
              Último dump gerado em: {new Date(dbInfo.lastDumpAt).toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {/* Lista de Tabelas do Banco */}
        {showTableDetails && (
          <div className="p-3.5 rounded-lg border bg-muted/20 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                Tabelas Públicas Incluídas na Cópia ({dbInfo?.tables?.length ?? 27}):
              </span>
              <span className="text-[11px] text-muted-foreground">
                Total acumulado: {(dbInfo?.totalRows ?? 0).toLocaleString("pt-BR")} linhas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {dbInfo?.tables?.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between p-2 rounded-md border bg-card/80 text-xs shadow-2xs hover:bg-accent/10 transition-colors"
                >
                  <span className="font-mono text-[11px] truncate text-foreground" title={t.name}>
                    {t.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono shrink-0 ml-1">
                    {t.rows.toLocaleString("pt-BR")}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instruções de Restauração */}
        {showCliInstructions && (
          <div className="p-3.5 rounded-lg border bg-muted/30 space-y-2 text-xs font-mono animate-in fade-in duration-200">
            <span className="font-sans font-bold text-xs text-foreground block">
              Instruções para Restaurar este Dump no PostgreSQL / Neon:
            </span>
            <div className="bg-background/90 border rounded-md p-2.5 space-y-1.5 text-[11px] text-muted-foreground overflow-x-auto">
              <p className="text-foreground font-semibold">1. Restaurar arquivo SQL descompactado:</p>
              <code>psql "sua_connection_string_aqui" &lt; neon_database_dump.sql</code>

              <p className="text-foreground font-semibold pt-1">2. Restaurar arquivo compactado (.gz) diretamente:</p>
              <code>gunzip -c neon_database_dump.sql.gz | psql "sua_connection_string_aqui"</code>
            </div>
            <p className="font-sans text-[11px] text-muted-foreground">
              O arquivo SQL inclui cabeçalhos transacionais e <code>SET session_replication_role = 'replica';</code>, permitindo restauração sem violação de integridade referencial ou dependências circulares.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
