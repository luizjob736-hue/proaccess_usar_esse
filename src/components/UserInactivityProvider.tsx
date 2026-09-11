import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Moon, Play, ShieldAlert, Sparkles, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/integrations/database/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// 15 minutos em milissegundos
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const HEARTBEAT_THROTTLE_MS = 3 * 60 * 1000; // Heartbeat a cada 3 min quando ativo

interface InactivityContextType {
  isInactive: boolean;
  lastActive: number;
  resumeSession: () => void;
}

const InactivityContext = createContext<InactivityContextType>({
  isInactive: false,
  lastActive: Date.now(),
  resumeSession: () => {},
});

export const useUserInactivity = () => useContext(InactivityContext);

interface UserInactivityProviderProps {
  children: React.ReactNode;
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      nome?: string;
    };
  } | null;
  profile?: {
    nome?: string;
    email?: string;
  } | null;
}

export function UserInactivityProvider({ children, user, profile }: UserInactivityProviderProps) {
  const qc = useQueryClient();
  const userId = user?.id;

  const [isInactive, setIsInactive] = useState(false);
  const [_inactiveSince, setInactiveSince] = useState<Date | null>(null);
  const lastActiveRef = useRef<number>(Date.now());
  const lastHeartbeatRef = useRef<number>(0);
  const isInactiveRef = useRef<boolean>(false);

  // Manter ref sincronizada para uso dentro de event listeners sem stale closure
  useEffect(() => {
    isInactiveRef.current = isInactive;
  }, [isInactive]);

  // Carregar timestamp anterior do usuário específico
  useEffect(() => {
    if (!userId) return;

    const storageKey = `proaccess_last_activity_${userId}`;
    const stored = localStorage.getItem(storageKey);
    const now = Date.now();

    if (stored) {
      const storedTime = parseInt(stored, 10);
      if (!isNaN(storedTime)) {
        if (now - storedTime >= INACTIVITY_TIMEOUT_MS) {
          // Já se passaram 15 min desde a última atividade deste usuário
          setIsInactive(true);
          setInactiveSince(new Date(storedTime));
          lastActiveRef.current = storedTime;
          return;
        } else {
          lastActiveRef.current = storedTime;
        }
      }
    }

    lastActiveRef.current = now;
    localStorage.setItem(storageKey, now.toString());
  }, [userId]);

  // Função para reativar sessão
  const resumeSession = useCallback(async () => {
    if (!userId) return;

    const now = Date.now();
    lastActiveRef.current = now;
    const storageKey = `proaccess_last_activity_${userId}`;
    localStorage.setItem(storageKey, now.toString());

    setIsInactive(false);
    setInactiveSince(null);

    // Notificar backend que este usuário está ativo novamente
    try {
      await db.rpc("touch_user_activity");
    } catch (_e) {
      // ignore
    }

    // Invalidar e recarregar consultas no TanStack Query com dados frescos
    qc.invalidateQueries();

    toast.success("Sessão reativada!", {
      description: "Você voltou à atividade e as consultas foram sincronizadas.",
      duration: 3000,
    });
  }, [userId, qc]);

  // Registrar atividade do usuário (throttled)
  const handleUserActivity = useCallback(() => {
    if (!userId) return;

    // Se estava inativo, qualquer clique/interação acorda o sistema
    if (isInactiveRef.current) {
      resumeSession();
      return;
    }

    const now = Date.now();
    lastActiveRef.current = now;

    // Salvar no localStorage para persistir entre abas do mesmo usuário
    const storageKey = `proaccess_last_activity_${userId}`;
    localStorage.setItem(storageKey, now.toString());

    // Enviar heartbeat para o backend de tempos em tempos (a cada 3 min)
    if (now - lastHeartbeatRef.current > HEARTBEAT_THROTTLE_MS) {
      lastHeartbeatRef.current = now;
      db.rpc("touch_user_activity").catch(() => {});
    }
  }, [userId, resumeSession]);

  // Listeners de eventos de atividade global do usuário
  useEffect(() => {
    if (!userId) return;

    let throttleTimeout: NodeJS.Timeout | null = null;

    const onThrottledMove = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
        handleUserActivity();
      }, 2000); // 2 segundos throttle para movimento de mouse
    };

    const onDirectInteraction = (e: Event) => {
      // Se estava inativo, interceptar
      if (isInactiveRef.current) {
        // Evitar que o clique de acordar dispare ações indesejadas na tela abaixo
        e.stopPropagation();
      }
      handleUserActivity();
    };

    // Eventos capturados no topo da árvore de eventos
    window.addEventListener("mousedown", onDirectInteraction, { capture: true, passive: true });
    window.addEventListener("click", onDirectInteraction, { capture: true, passive: true });
    window.addEventListener("keydown", onDirectInteraction, { capture: true, passive: true });
    window.addEventListener("touchstart", onDirectInteraction, { capture: true, passive: true });
    window.addEventListener("scroll", onDirectInteraction, { capture: true, passive: true });
    window.addEventListener("wheel", onDirectInteraction, { capture: true, passive: true });
    window.addEventListener("mousemove", onThrottledMove, { passive: true });

    return () => {
      if (throttleTimeout) clearTimeout(throttleTimeout);
      window.removeEventListener("mousedown", onDirectInteraction, { capture: true });
      window.removeEventListener("click", onDirectInteraction, { capture: true });
      window.removeEventListener("keydown", onDirectInteraction, { capture: true });
      window.removeEventListener("touchstart", onDirectInteraction, { capture: true });
      window.removeEventListener("scroll", onDirectInteraction, { capture: true });
      window.removeEventListener("wheel", onDirectInteraction, { capture: true });
      window.removeEventListener("mousemove", onThrottledMove);
    };
  }, [userId, handleUserActivity]);

  // Intervalo de verificação de inatividade (roda a cada 5 segundos)
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActiveRef.current;

      if (elapsed >= INACTIVITY_TIMEOUT_MS && !isInactiveRef.current) {
        setIsInactive(true);
        setInactiveSince(new Date(lastActiveRef.current));
        // Notificar backend que este usuário está inativo
        db.rpc("set_user_inactive").catch(() => {});
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [userId]);

  const displayName = profile?.nome ?? user?.user_metadata?.nome ?? user?.email ?? "Usuário";
  const userEmail = profile?.email ?? user?.email ?? "";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <InactivityContext.Provider
      value={{
        isInactive,
        lastActive: lastActiveRef.current,
        resumeSession,
      }}
    >
      {children}

      {/* Overlay de Inatividade por Usuário */}
      {isInactive && (
        <div
          id="user-inactivity-overlay"
          onClick={resumeSession}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md transition-all duration-300 animate-in fade-in cursor-pointer select-none p-4"
        >
          <div
            onClick={(e) => {
              // Permitir clique no card ou no botão acordar normalmente
              e.stopPropagation();
              resumeSession();
            }}
            className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 md:p-8 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200"
          >
            {/* Ícone de status */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-8 ring-amber-500/5">
              <Moon className="h-8 w-8 animate-pulse" />
            </div>

            {/* Cabeçalho */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Badge
                  variant="outline"
                  className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold"
                >
                  <Clock className="w-3 h-3 mr-1 inline" /> 15 min sem uso
                </Badge>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Sessão em Espera por Inatividade
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                As consultas e atualizações em segundo plano foram suspensas para o seu usuário após
                15 minutos sem atividade.
              </p>
            </div>

            {/* Identificação do Usuário */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/60 border text-left">
              <Avatar className="h-10 w-10 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate text-foreground">{displayName}</div>
                <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Inativo
              </span>
            </div>

            {/* Dica e Botão de Ação */}
            <div className="space-y-3 pt-2">
              <Button
                id="btn-resume-session"
                size="lg"
                onClick={resumeSession}
                className="w-full gap-2 font-semibold shadow-md text-sm transition-transform active:scale-95"
              >
                <Play className="h-4 w-4 fill-current" />
                Retomar Sessão Agora
              </Button>
              <p className="text-[11px] text-muted-foreground">
                💡 Pressione{" "}
                <kbd className="px-1 py-0.5 rounded bg-muted border text-[10px]">
                  Qualquer tecla
                </kbd>{" "}
                ou clique em qualquer lugar para continuar
              </p>
            </div>
          </div>
        </div>
      )}
    </InactivityContext.Provider>
  );
}
