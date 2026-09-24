import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Leaf, Play, ShieldAlert, Sparkles, User, Clock, AlertTriangle, LogOut, ZapOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/integrations/database/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// Constantes de Inatividade
const INACTIVITY_DATA_SAVER_MS = 7 * 60 * 1000; // 7 minutos (Entra em Modo de Economia de Dados)
const INACTIVITY_LOGOUT_MS = 15 * 60 * 1000; // 15 minutos (Desconecta automaticamente o usuário)
const HEARTBEAT_THROTTLE_MS = 2.5 * 60 * 1000; // Heartbeat a cada 2.5 min quando ativo

interface InactivityContextType {
  isDataSaver: boolean;
  secondsRemaining: number;
  lastActive: number;
  resumeSession: () => void;
  logoutNow: () => void;
}

const InactivityContext = createContext<InactivityContextType>({
  isDataSaver: false,
  secondsRemaining: INACTIVITY_LOGOUT_MS / 1000,
  lastActive: Date.now(),
  resumeSession: () => {},
  logoutNow: () => {},
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

  const [isDataSaver, setIsDataSaver] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(Math.floor(INACTIVITY_LOGOUT_MS / 1000));
  
  const lastActiveRef = useRef<number>(Date.now());
  const lastHeartbeatRef = useRef<number>(0);
  const isDataSaverRef = useRef<boolean>(false);
  const isLoggingOutRef = useRef<boolean>(false);

  // Manter ref sincronizada para uso dentro de event listeners sem stale closure
  useEffect(() => {
    isDataSaverRef.current = isDataSaver;
  }, [isDataSaver]);

  // Função para efetuar Logout por inatividade
  const handleInactivityLogout = useCallback(async () => {
    if (isLoggingOutRef.current || !userId) return;
    isLoggingOutRef.current = true;

    try {
      // Notificar backend sobre inatividade final
      await db.rpc("set_user_inactive").catch(() => {});
    } catch (_e) {
      // ignore
    }

    try {
      await db.auth.signOut();
    } catch (_e) {
      // ignore
    }

    // Limpar sessões locais e storage
    localStorage.removeItem("proaccess_neon_session");
    document.cookie = "proaccess_neon_session=; path=/; max-age=0";
    if (userId) {
      localStorage.removeItem(`proaccess_last_activity_${userId}`);
    }

    // Sinalizar motivo do logout para a página de login
    sessionStorage.setItem("proaccess_logout_reason", "inactivity_15min");

    qc.clear();

    // Redirecionar para tela de autenticação
    window.location.href = "/auth";
  }, [userId, qc]);

  // Carregar timestamp anterior do usuário específico
  useEffect(() => {
    if (!userId) return;

    const storageKey = `proaccess_last_activity_${userId}`;
    const stored = localStorage.getItem(storageKey);
    const now = Date.now();

    if (stored) {
      const storedTime = parseInt(stored, 10);
      if (!isNaN(storedTime)) {
        const elapsed = now - storedTime;
        if (elapsed >= INACTIVITY_LOGOUT_MS) {
          // Já se passaram 15 min ou mais, efetuar logout imediato
          handleInactivityLogout();
          return;
        } else if (elapsed >= INACTIVITY_DATA_SAVER_MS) {
          // Já está no período de economia de dados (7 a 15 min)
          setIsDataSaver(true);
          lastActiveRef.current = storedTime;
          setSecondsRemaining(Math.max(0, Math.floor((INACTIVITY_LOGOUT_MS - elapsed) / 1000)));
          return;
        } else {
          lastActiveRef.current = storedTime;
          setSecondsRemaining(Math.max(0, Math.floor((INACTIVITY_LOGOUT_MS - elapsed) / 1000)));
        }
      }
    }

    lastActiveRef.current = now;
    localStorage.setItem(storageKey, now.toString());
  }, [userId, handleInactivityLogout]);

  // Sincronizar atividade entre abas do mesmo navegador
  useEffect(() => {
    if (!userId) return;
    const storageKey = `proaccess_last_activity_${userId}`;

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        const newTime = parseInt(e.newValue, 10);
        if (!isNaN(newTime)) {
          lastActiveRef.current = newTime;
          const elapsed = Date.now() - newTime;
          if (elapsed < INACTIVITY_DATA_SAVER_MS && isDataSaverRef.current) {
            setIsDataSaver(false);
          }
          setSecondsRemaining(Math.max(0, Math.floor((INACTIVITY_LOGOUT_MS - elapsed) / 1000)));
        }
      }
    };

    window.addEventListener("storage", handleStorageEvent);
    return () => window.removeEventListener("storage", handleStorageEvent);
  }, [userId]);

  // Função para reativar sessão (sair do modo economia de dados)
  const resumeSession = useCallback(async (silent = false) => {
    if (!userId || isLoggingOutRef.current) return;

    const wasDataSaver = isDataSaverRef.current;
    const now = Date.now();
    lastActiveRef.current = now;
    const storageKey = `proaccess_last_activity_${userId}`;
    localStorage.setItem(storageKey, now.toString());

    setIsDataSaver(false);
    setSecondsRemaining(Math.floor(INACTIVITY_LOGOUT_MS / 1000));

    // Notificar backend que este usuário está ativo novamente
    try {
      db.rpc("touch_user_activity").catch(() => {});
    } catch (_e) {
      // ignore
    }

    // Se estava em economia de dados, recarregar e sincronizar queries
    if (wasDataSaver) {
      qc.invalidateQueries();
      if (!silent) {
        toast.success("Conexão ativa restaurada!", {
          description: "O modo de economia de dados foi desativado e as informações foram sincronizadas.",
          duration: 3500,
        });
      }
    }
  }, [userId, qc]);

  // Registrar atividade do usuário (com throttle inteligente)
  const handleUserActivity = useCallback(() => {
    if (!userId || isLoggingOutRef.current) return;

    // Se estava em economia de dados, qualquer interação restaura a sessão
    if (isDataSaverRef.current) {
      resumeSession(false);
      return;
    }

    const now = Date.now();
    lastActiveRef.current = now;

    const storageKey = `proaccess_last_activity_${userId}`;
    localStorage.setItem(storageKey, now.toString());
    setSecondsRemaining(Math.floor(INACTIVITY_LOGOUT_MS / 1000));

    // Enviar heartbeat para o backend a cada 2.5 min
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
      }, 2500); // Throttle de 2.5s para movimento de cursor
    };

    const onDirectInteraction = () => {
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

  // Timer de verificação contínua de inatividade e contagem regressiva
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      if (isLoggingOutRef.current) return;

      const now = Date.now();
      const elapsed = now - lastActiveRef.current;
      const left = Math.max(0, Math.floor((INACTIVITY_LOGOUT_MS - elapsed) / 1000));
      setSecondsRemaining(left);

      // 1. Atingiu 15 minutos de inatividade -> DESLOGAR
      if (elapsed >= INACTIVITY_LOGOUT_MS) {
        handleInactivityLogout();
        return;
      }

      // 2. Atingiu 7 minutos de inatividade (7 a 15 min) -> MODO DE ECONOMIA DE DADOS
      if (elapsed >= INACTIVITY_DATA_SAVER_MS && !isDataSaverRef.current) {
        setIsDataSaver(true);
        // Pausar consultas em background e notificar status inativo ao backend
        db.rpc("set_user_inactive").catch(() => {});
      }
    }, 1000); // Atualiza a cada 1 segundo para o relógio regressivo

    return () => clearInterval(interval);
  }, [userId, handleInactivityLogout]);

  // Formatação dos minutos e segundos restantes
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedCountdown = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

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
        isDataSaver,
        secondsRemaining,
        lastActive: lastActiveRef.current,
        resumeSession,
        logoutNow: handleInactivityLogout,
      }}
    >
      {/* Banner Superior / Floating Bar do Modo de Economia de Dados (7min aos 15min) */}
      {isDataSaver && (
        <div
          id="data-saver-floating-banner"
          className="sticky top-0 z-40 w-full bg-amber-500/15 border-b border-amber-500/30 backdrop-blur-md px-4 py-2.5 shadow-sm transition-all duration-300 animate-in slide-in-from-top-2"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Leaf className="h-4 w-4 animate-pulse" />
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-900 dark:text-amber-200">
                    Modo de Economia de Dados Ativo
                  </span>
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 text-[10px] px-1.5 py-0"
                  >
                    7+ min sem uso
                  </Badge>
                </div>
                <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 hidden sm:inline">
                  As atualizações em segundo plano foram suspensas. Qualquer movimento ou clique restaura a conexão.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 ml-auto shrink-0">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-900 dark:text-amber-100 bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-md">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>Desconexão em {formattedCountdown}</span>
              </div>

              <Button
                id="btn-resume-datasaver"
                size="sm"
                variant="default"
                onClick={() => resumeSession(false)}
                className="h-7 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm transition-transform active:scale-95"
              >
                <Play className="h-3 w-3 mr-1 fill-current" />
                Continuar Ativo
              </Button>

              <Button
                id="btn-logout-datasaver"
                size="sm"
                variant="ghost"
                onClick={handleInactivityLogout}
                className="h-7 px-2 text-xs text-amber-900 dark:text-amber-300 hover:bg-amber-500/20"
                title="Sair do sistema agora"
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {children}
    </InactivityContext.Provider>
  );
}
