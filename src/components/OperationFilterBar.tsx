import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/database/client";
import { Button } from "@/components/ui/button";
import { Building2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Operacao {
  id: string;
  nome: string;
  descricao?: string | null;
  ativo?: boolean | null;
}

interface OperationFilterBarProps {
  selectedOperacaoId: string; // "todas" | "sem_operacao" | UUID
  onChange: (id: string) => void;
  counts?: Record<string, number>; // opId -> count
  className?: string;
  label?: string;
}

export function OperationFilterBar({
  selectedOperacaoId,
  onChange,
  counts,
  className,
  label = "Filtrar por Operação:",
}: OperationFilterBarProps) {
  const { data: operacoes = [] } = useQuery({
    queryKey: ["operacoes-filter"],
    queryFn: async () => {
      const { data } = await db
        .from("operacoes")
        .select("id, nome, descricao, ativo")
        .order("nome");
      return (data as Operacao[]) ?? [];
    },
  });

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center justify-between bg-card border rounded-lg p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <span>{label}</span>
      </div>

      {/* Quick Pills for Desktop/Tablet */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          key="todas"
          variant={selectedOperacaoId === "todas" ? "default" : "outline"}
          size="sm"
          onClick={() => onChange("todas")}
          className="h-8 gap-1.5 text-xs font-medium"
        >
          <Layers className="h-3.5 w-3.5" />
          Todas as Operações
          {counts && counts["todas"] !== undefined && (
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.5 text-[10px]",
                selectedOperacaoId === "todas"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {counts["todas"]}
            </span>
          )}
        </Button>

        {operacoes.map((op) => {
          const isSelected = selectedOperacaoId === op.id;
          const count = counts?.[op.id];
          return (
            <Button
              key={op.id}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onChange(op.id)}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <Building2 className="h-3.5 w-3.5" />
              {op.nome}
              {count !== undefined && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-1.5 py-0.5 text-[10px]",
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              )}
            </Button>
          );
        })}

        <Button
          key="sem_operacao"
          variant={selectedOperacaoId === "sem_operacao" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onChange("sem_operacao")}
          className="h-8 gap-1.5 text-xs font-medium text-muted-foreground"
        >
          Sem Operação
          {counts && counts["sem_operacao"] !== undefined && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
              {counts["sem_operacao"]}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
