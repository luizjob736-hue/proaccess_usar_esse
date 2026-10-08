import React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOrder = "asc" | "desc";

interface TableSortHeaderProps {
  label: React.ReactNode;
  field: string;
  currentField?: string | null;
  currentOrder?: SortOrder;
  onSort: (field: string) => void;
  className?: string;
  align?: "left" | "center" | "right";
  children?: React.ReactNode;
}

export function TableSortHeader({
  label,
  field,
  currentField,
  currentOrder = "asc",
  onSort,
  className,
  align = "left",
  children,
}: TableSortHeaderProps) {
  const isActive = currentField === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        "group inline-flex items-center gap-1.5 font-semibold text-inherit select-none cursor-pointer transition-colors py-0.5 hover:text-foreground focus:outline-hidden",
        align === "center" && "justify-center w-full",
        align === "right" && "justify-end w-full",
        align === "left" && "justify-start",
        className,
      )}
      title={`Clique para classificar por ${typeof label === "string" ? label : "esta coluna"} (${isActive && currentOrder === "asc" ? "Z-A" : "A-Z"})`}
    >
      {children}
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "inline-flex items-center justify-center transition-transform shrink-0",
          isActive
            ? "text-accent scale-110"
            : "text-muted-foreground/50 group-hover:text-foreground/80",
        )}
      >
        {isActive ? (
          currentOrder === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
        )}
      </span>
    </button>
  );
}

/**
 * Generic helper to sort array of objects by field and order
 */
export function sortData<T>(
  data: T[],
  field: string | null | undefined,
  order: SortOrder = "asc",
  customExtractors?: Record<string, (item: T) => any>,
): T[] {
  if (!field) return data;

  return [...data].sort((a, b) => {
    let valA: any;
    let valB: any;

    if (customExtractors && customExtractors[field]) {
      valA = customExtractors[field](a);
      valB = customExtractors[field](b);
    } else {
      // Support nested paths like 'colaborador.nome'
      if (field.includes(".")) {
        const parts = field.split(".");
        valA = parts.reduce((obj: any, key) => obj?.[key], a);
        valB = parts.reduce((obj: any, key) => obj?.[key], b);
      } else {
        valA = (a as any)?.[field];
        valB = (b as any)?.[field];
      }
    }

    if (valA === undefined || valA === null || valA === "-" || valA === "—") valA = "";
    if (valB === undefined || valB === null || valB === "-" || valB === "—") valB = "";

    // If both are numbers or numeric strings
    if (typeof valA === "number" && typeof valB === "number") {
      return order === "asc" ? valA - valB : valB - valA;
    }

    const strA = String(valA).trim();
    const strB = String(valB).trim();

    // Check for dates (ISO or dd/mm/yyyy)
    const isDateA = !isNaN(Date.parse(strA)) && strA.length > 5;
    const isDateB = !isNaN(Date.parse(strB)) && strB.length > 5;
    if (isDateA && isDateB) {
      const timeA = new Date(strA).getTime();
      const timeB = new Date(strB).getTime();
      return order === "asc" ? timeA - timeB : timeB - timeA;
    }

    // Default string locale compare
    const cmp = strA.localeCompare(strB, "pt-BR", { numeric: true, sensitivity: "base" });
    return order === "asc" ? cmp : -cmp;
  });
}
