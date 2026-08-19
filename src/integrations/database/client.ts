// Client-side Neon database adapter
import { neonAuthServerFn, neonQueryServerFn, neonRpcServerFn } from "@/lib/neon-server";

const SESSION_KEY = "proaccess_neon_session";

function getStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
    const match = document.cookie.match(new RegExp("(?:^|; )" + SESSION_KEY + "=([^;]*)"));
    if (match && match[1]) return JSON.parse(decodeURIComponent(match[1]));
    return null;
  } catch {
    return null;
  }
}

function setStoredSession(session: any) {
  if (typeof window === "undefined") return;
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    document.cookie = `${SESSION_KEY}=${encodeURIComponent(JSON.stringify(session))}; path=/; max-age=604800; SameSite=Lax`;
  } else {
    localStorage.removeItem(SESSION_KEY);
    document.cookie = `${SESSION_KEY}=; path=/; max-age=0; path=/`;
  }
}

const authListeners: Set<(event: string, session: any) => void> = new Set();

function notifyAuthChange(event: string, session: any) {
  authListeners.forEach((cb) => {
    try {
      cb(event, session);
    } catch (e) {
      console.error("Auth listener error:", e);
    }
  });
}

class QueryBuilder {
  private table: string;
  private action: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private selectCols = "*";
  private whereClauses: { col: string; op: "eq" | "neq" | "in" | "ilike" | "or"; val: any }[] = [];
  private orderBy: { col: string; ascending: boolean }[] = [];
  private limitVal?: number;
  private offsetVal?: number;
  private isSingle = false;
  private isMaybeSingle = false;
  private payload: any = null;
  private countExact = false;
  private headOnly = false;

  constructor(table: string) {
    this.table = table;
  }

  select(cols = "*", opts?: { count?: "exact"; head?: boolean }) {
    if (
      this.action !== "insert" &&
      this.action !== "update" &&
      this.action !== "upsert" &&
      this.action !== "delete"
    ) {
      this.action = "select";
    }
    this.selectCols = cols;
    if (opts?.count === "exact") this.countExact = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }

  eq(col: string, val: any) {
    this.whereClauses.push({ col, op: "eq", val });
    return this;
  }

  neq(col: string, val: any) {
    this.whereClauses.push({ col, op: "neq", val });
    return this;
  }

  ilike(col: string, val: any) {
    this.whereClauses.push({ col, op: "ilike", val });
    return this;
  }

  in(col: string, val: any[]) {
    this.whereClauses.push({ col, op: "in", val });
    return this;
  }

  or(val: string) {
    this.whereClauses.push({ col: "", op: "or", val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ col, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.limitVal = n;
    return this;
  }

  range(from: number, to: number) {
    this.offsetVal = from;
    this.limitVal = to - from + 1;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(payload: any) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload: any) {
    this.action = "upsert";
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  async execute() {
    try {
      const session = getStoredSession();
      const res = await neonQueryServerFn({
        data: {
          table: this.table,
          action: this.action,
          selectCols: this.selectCols,
          whereClauses: this.whereClauses,
          orderBy: this.orderBy,
          limitVal: this.limitVal,
          offsetVal: this.offsetVal,
          single: this.isSingle,
          maybeSingle: this.isMaybeSingle,
          payload: this.payload,
          countExact: this.countExact,
          headOnly: this.headOnly,
          token: session?.access_token,
        },
      });
      return res || { data: null, error: { message: "Erro de consulta" } };
    } catch (err: any) {
      const isFetchError =
        err?.message?.includes("Failed to fetch") ||
        err?.message?.includes("fetch") ||
        String(err).includes("Failed to fetch") ||
        String(err).includes("fetch");
      if (isFetchError) {
        console.warn(`Erro ao consultar ${this.table} (conexão temporária):`, err);
      } else {
        console.error(`Erro ao consultar ${this.table}:`, err);
      }
      return { data: null, error: { message: err?.message || "Erro de conexão com o banco" } };
    }
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const db = {
  auth: {
    async signInWithPassword({ email, password }: { email?: string; password?: string }) {
      try {
        const res = await neonAuthServerFn({
          data: {
            action: "signInWithPassword",
            identifier: email,
            password,
          },
        });
        if (res?.data?.session) {
          setStoredSession(res.data.session);
          notifyAuthChange("SIGNED_IN", res.data.session);
        }
        return res || { data: null, error: { message: "Servidor não respondeu" } };
      } catch (err: any) {
        console.error("Erro no signInWithPassword:", err);
        return {
          data: null,
          error: { message: err?.message || "Erro de comunicação com o servidor" },
        };
      }
    },

    async getUser() {
      const session = getStoredSession();
      if (!session && typeof window !== "undefined") {
        return { data: { user: null }, error: null };
      }

      try {
        const res = await neonAuthServerFn({
          data: {
            action: "getUser",
            token: session?.access_token,
          },
        });

        if (res?.data?.user) {
          // Update stored session with fresh user data
          if (session) {
            session.user = res.data.user;
            setStoredSession(session);
          }
          return { data: { user: res.data.user }, error: null };
        }
      } catch (err: any) {
        const isFetchError =
          err?.message?.includes("Failed to fetch") ||
          err?.message?.includes("fetch") ||
          String(err).includes("Failed to fetch") ||
          String(err).includes("fetch");
        if (isFetchError) {
          console.warn("Erro ao verificar sessão no servidor (conexão temporária):", err);
        } else {
          console.error("Erro ao verificar sessão no servidor:", err);
        }
      }

      if (session?.user) {
        return { data: { user: session.user }, error: null };
      }

      // Session invalid or expired
      setStoredSession(null);
      return { data: { user: null }, error: null };
    },

    async getSession() {
      const session = getStoredSession();
      return { data: { session }, error: null };
    },

    async signOut() {
      setStoredSession(null);
      notifyAuthChange("SIGNED_OUT", null);
      return { error: null };
    },

    async updateUser({ password }: { password?: string }) {
      try {
        const session = getStoredSession();
        const res = await neonAuthServerFn({
          data: {
            action: "updateUser",
            token: session?.access_token,
            password,
          },
        });
        if (res?.data?.user && session) {
          session.user.user_metadata = {
            ...session.user.user_metadata,
            senha_alterada: true,
          };
          setStoredSession(session);
        }
        return res || { data: null, error: { message: "Servidor não respondeu" } };
      } catch (err: any) {
        return {
          data: null,
          error: { message: err?.message || "Erro de comunicação com o servidor" },
        };
      }
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      authListeners.add(callback);
      const currentSession = getStoredSession();
      callback("INITIAL_SESSION", currentSession);
      return {
        data: {
          subscription: {
            unsubscribe: () => authListeners.delete(callback),
          },
        },
      };
    },
  },

  from(tableName: string) {
    return new QueryBuilder(tableName);
  },

  async rpc(fnName: string, args?: any) {
    try {
      const session = getStoredSession();
      const res = await neonRpcServerFn({ data: { fnName, args, token: session?.access_token } });
      return res || { data: null, error: { message: "Erro na chamada RPC" } };
    } catch (err: any) {
      const isFetchError =
        err?.message?.includes("Failed to fetch") ||
        err?.message?.includes("fetch") ||
        String(err).includes("Failed to fetch") ||
        String(err).includes("fetch");
      if (isFetchError) {
        console.warn(`Erro ao executar RPC ${fnName} (conexão temporária):`, err);
      } else {
        console.error(`Erro ao executar RPC ${fnName}:`, err);
      }
      return {
        data: null,
        error: { message: err?.message || "Erro de comunicação com o servidor" },
      };
    }
  },
};
