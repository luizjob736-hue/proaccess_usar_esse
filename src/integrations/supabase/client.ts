// Client-side Neon adapter providing Supabase-compatible interface
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
    this.action = "select";
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
      },
    });
    return res;
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  auth: {
    async signInWithPassword({ email, password }: { email?: string; password?: string }) {
      const res = await neonAuthServerFn({
        data: {
          action: "signInWithPassword",
          identifier: email,
          password,
        },
      });
      if (res.data?.session) {
        setStoredSession(res.data.session);
        notifyAuthChange("SIGNED_IN", res.data.session);
      }
      return res;
    },

    async getUser() {
      const session = getStoredSession();
      if (!session) return { data: { user: null }, error: null };
      const res = await neonAuthServerFn({
        data: {
          action: "getUser",
          token: session.access_token,
        },
      });
      if (res.data?.user) {
        return { data: { user: res.data.user }, error: null };
      }
      return { data: { user: session.user }, error: null };
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
      const session = getStoredSession();
      const res = await neonAuthServerFn({
        data: {
          action: "updateUser",
          token: session?.access_token,
          password,
        },
      });
      if (res.data?.user && session) {
        session.user.user_metadata = {
          ...session.user.user_metadata,
          senha_alterada: true,
        };
        setStoredSession(session);
      }
      return res;
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
    return await neonRpcServerFn({ data: { fnName, args } });
  },
};
