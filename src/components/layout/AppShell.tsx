import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Server,
  KeyRound,
  Kanban,
  History,
  FileBarChart,
  Bell,
  Settings,
  ShieldCheck,
  Trash2,
  LogOut,
  Sparkles,
  Shield,
  Search,
  User,
  Sun,
  Moon,
  Table2,
  Upload,
  Grid3x3,
  UserX,
  List,
  LifeBuoy,
  Archive,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { db } from "@/integrations/database/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

const NAV_FULL = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/matriz-acessos", icon: Grid3x3, label: "Matriz de Acessos" },
  { to: "/sistemas", icon: Server, label: "Sistemas" },
  { to: "/inativos", icon: UserX, label: "Usuários Inativos" },
  { to: "/backups", icon: Archive, label: "Backup da Matriz" },
  { to: "/lista-acessos", icon: List, label: "Lista de Acessos" },
  { to: "/importar", icon: Upload, label: "Importar CSV" },
  { to: "/pendencias", icon: Kanban, label: "Pendências" },
  { to: "/chamados", icon: LifeBuoy, label: "Chamados" },
  { to: "/historico", icon: History, label: "Histórico" },
  { to: "/relatorios", icon: FileBarChart, label: "Relatórios" },
  { to: "/notificacoes", icon: Bell, label: "Notificações" },
  { to: "/administracao", icon: ShieldCheck, label: "Administração" },
  { to: "/lixeira", icon: Trash2, label: "Lixeira" },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
] as const;

const NAV_OPERADOR = [
  { to: "/minha-matriz", icon: Grid3x3, label: "Meus Acessos" },
  { to: "/perfil", icon: User, label: "Perfil" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dark, setDark] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("proacess-theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await db.auth.getUser();
      if (!u.user) return null;
      const { data: prof } = await db
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
      return { user: u.user, profile: prof, roles: roles?.map((r) => r.role) ?? [] };
    },
  });

  const { data: notifCount = 0 } = useQuery({
    queryKey: ["notif-count", me?.user?.id],
    enabled: !!me?.user?.id,
    queryFn: async () => {
      try {
        const res = await db
          .from("notificacoes")
          .select("*", { count: "exact", head: true })
          .eq("lida", false);
        return res?.count ?? 0;
      } catch (_err) {
        return 0;
      }
    },
    refetchInterval: 30_000,
  });

  // Background check for scheduled access request dates arriving
  useEffect(() => {
    if (!me?.user?.id) return;

    const checkAndGenerateScheduledNotifications = async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];

        // Fetch all active pendências (not completed, not archived)
        const { data: pends } = await db
          .from("pendencias")
          .select("id, titulo, data_inicio, status")
          .eq("arquivado", false);

        if (!pends || pends.length === 0) return;

        // Filter those whose start date is today or in the past
        const activeScheduled = pends.filter((p: any) => {
          if (!p.data_inicio) return false;
          const startStr =
            typeof p.data_inicio === "string"
              ? p.data_inicio.split("T")[0]
              : new Date(p.data_inicio).toISOString().split("T")[0];

          const isDateMet = startStr <= todayStr;
          const isUnconcluded =
            p.status !== "concluido" && p.status !== "concluida" && p.status !== "cancelado";
          return isDateMet && isUnconcluded;
        });

        if (activeScheduled.length === 0) return;

        // Fetch active user profiles so we notify everyone
        const { data: profiles } = await db.from("profiles").select("id");
        if (!profiles || profiles.length === 0) return;

        let notificationsCreated = false;

        for (const pend of activeScheduled) {
          const targetLink = `/pendencias?id=${pend.id}`;

          // Check existing notifications for this link
          const { data: existing } = await db
            .from("notificacoes")
            .select("destinatario_id")
            .eq("link", targetLink);

          const notifiedUsers = new Set((existing || []).map((n: any) => n.destinatario_id));

          for (const prof of profiles) {
            if (!notifiedUsers.has(prof.id)) {
              await db.from("notificacoes").insert({
                destinatario_id: prof.id,
                titulo: "📅 Solicitação de Acesso Agendada!",
                corpo: `A data de início para solicitar o acesso "${pend.titulo}" chegou.`,
                tipo: "alerta",
                link: targetLink,
                lida: false,
                criado_em: new Date().toISOString(),
              });
              notificationsCreated = true;
            }
          }
        }

        if (notificationsCreated) {
          qc.invalidateQueries({ queryKey: ["notif-count"] });
          qc.invalidateQueries({ queryKey: ["notif-list"] });
        }
      } catch (err) {
        console.error("Erro ao verificar/gerar notificações agendadas:", err);
      }
    };

    // Run immediately and then every 2 minutes
    checkAndGenerateScheduledNotifications();
    const interval = setInterval(checkAndGenerateScheduledNotifications, 120_000);
    return () => clearInterval(interval);
  }, [me?.user?.id, qc]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("proacess-theme", next ? "dark" : "light");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await db.auth.signOut();
    window.location.href = "/auth";
  }

  const displayName =
    me?.profile?.nome ?? me?.user?.user_metadata?.nome ?? me?.user?.email ?? "Usuário";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const isOperador =
    (me?.roles ?? []).includes("operador") &&
    !(me?.roles ?? []).some((r: string) =>
      ["admin", "admin_master", "analista", "supervisor", "consulta"].includes(r),
    );
  const NAV = (isOperador ? NAV_OPERADOR : NAV_FULL) as ReadonlyArray<{
    to: string;
    icon: any;
    label: string;
  }>;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-60 min-w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <Shield className="h-6 w-6 text-accent" />
          <span className="text-lg font-bold">ProAccess</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-[11px] leading-tight opacity-80">
          <div>ProAccess v1.0</div>
          <div className="mt-1 italic">Produzido e desenvolvido pelo Planejamento</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6">
          <button
            onClick={() => setCmdOpen(true)}
            className="flex flex-1 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            <Search className="h-4 w-4" />
            <span>Buscar... </span>
            <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd>
          </button>
          <Button size="icon" variant="ghost" onClick={toggleTheme} title="Tema">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Link to="/notificacoes">
            <Button size="icon" variant="ghost" className="relative" title="Notificações">
              <Bell className="h-4 w-4" />
              {notifCount ? (
                <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full bg-accent p-0 text-[10px]">
                  {notifCount}
                </Badge>
              ) : null}
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left md:block">
                  <div className="text-xs font-medium">{displayName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {me?.roles?.[0] === "operador"
                      ? "Colaborador"
                      : me?.roles?.[0] === "admin_master"
                        ? "Admin Master"
                        : me?.roles?.[0] === "admin"
                          ? "Administrador"
                          : me?.roles?.[0] || "Usuário"}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{me?.profile?.email ?? me?.user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
                <User className="mr-2 h-4 w-4" /> Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
                <Settings className="mr-2 h-4 w-4" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        <footer className="border-t bg-card px-4 py-3 text-center text-xs text-muted-foreground">
          Produzido e desenvolvido pelo Planejamento
        </footer>
      </div>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Digite um comando ou busque..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado.</CommandEmpty>
          <CommandGroup heading="Navegação">
            {NAV.map((item) => (
              <CommandItem
                key={item.to}
                onSelect={() => {
                  setCmdOpen(false);
                  navigate({ to: item.to });
                }}
              >
                <item.icon className="mr-2 h-4 w-4" /> {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
