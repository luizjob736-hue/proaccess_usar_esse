import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
  UserCheck,
  UserPlus,
  CheckSquare,
  Menu,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { db } from "@/integrations/database/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { checkAndEnsureDailyBackup } from "@/lib/backups.functions";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { UserInactivityProvider } from "@/components/UserInactivityProvider";

export interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

// Estrutura organizada por categorias
const SECTIONS_FULL: NavSection[] = [
  {
    items: [{ to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    title: "GESTÃO DE ACESSOS",
    items: [
      { to: "/matriz-acessos", icon: Grid3x3, label: "Matriz de Acessos" },
      { to: "/pre-atendimento", icon: UserPlus, label: "Pré-Atendimento" },
      { to: "/usuarios-a-solicitar", icon: UserCheck, label: "Usuários a Solicitar" },
      { to: "/lista-acessos", icon: List, label: "Lista de Acessos" },
    ],
  },
  {
    title: "OPERAÇÃO",
    items: [
      { to: "/sistemas", icon: Server, label: "Sistemas" },
      { to: "/pendencias", icon: Kanban, label: "Pendências" },
      { to: "/pendencias-pine", icon: Table2, label: "Pendências Pine" },
      { to: "/chamados", icon: LifeBuoy, label: "Chamados" },
      { to: "/inativos", icon: UserX, label: "Usuários Inativos" },
    ],
  },
  {
    title: "CONTROLE",
    items: [
      { to: "/historico", icon: History, label: "Histórico" },
      { to: "/pendencias-historico", icon: CheckSquare, label: "Histórico de Pendências" },
      { to: "/backups", icon: Archive, label: "Backup da Matriz" },
    ],
  },
  {
    title: "DADOS",
    items: [{ to: "/importar", icon: Upload, label: "Importar CSV" }],
  },
  {
    title: "RELATÓRIOS",
    items: [{ to: "/relatorios", icon: FileBarChart, label: "Relatórios" }],
  },
  {
    title: "ADMINISTRAÇÃO",
    items: [
      { to: "/administracao", icon: ShieldCheck, label: "Administração" },
      { to: "/configuracoes", icon: Settings, label: "Configurações" },
      { to: "/lixeira", icon: Trash2, label: "Lixeira" },
    ],
  },
];

const SECTIONS_OPERADOR: NavSection[] = [
  {
    items: [
      { to: "/minha-matriz", icon: Grid3x3, label: "Meus Acessos" },
      { to: "/perfil", icon: User, label: "Perfil" },
    ],
  },
];

const SECTIONS_CLIENTE: NavSection[] = [
  {
    items: [{ to: "/pendencias-pine", icon: Table2, label: "Pendências Pine" }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dark, setDark] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      const roleList = (roles ?? []).map((r: any) => r.role);
      if (u.user.role && !roleList.includes(u.user.role)) {
        roleList.push(u.user.role);
      }
      return { user: u.user, profile: prof, roles: roleList };
    },
  });

  // Background Automatic Daily Backup Check
  const checkDailyBackupFn = useServerFn(checkAndEnsureDailyBackup);
  useQuery({
    queryKey: ["global-daily-backup-auto-check", me?.user?.id],
    enabled: !!me?.user,
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchInterval: 1000 * 60 * 60 * 2, // 2 hours
    queryFn: async () => {
      try {
        return await checkDailyBackupFn();
      } catch (_err) {
        return null;
      }
    },
  });

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
  const userRoles = (me?.roles ?? []) as string[];
  const directRole = me?.user?.role;
  const isAdmin =
    userRoles.some((r) => r === "admin" || r === "admin_master") ||
    directRole === "admin" ||
    directRole === "admin_master";
  const isCliente = (userRoles.includes("cliente") || directRole === "cliente") && !isAdmin;
  const isOperador =
    (userRoles.includes("operador") || directRole === "operador") &&
    !isAdmin &&
    !isCliente &&
    !userRoles.some((r) =>
      ["admin", "admin_master", "analista", "supervisor", "consulta"].includes(r),
    );

  let navSections: NavSection[] = SECTIONS_FULL;
  if (isCliente) {
    navSections = SECTIONS_CLIENTE;
  } else if (isOperador) {
    navSections = SECTIONS_OPERADOR;
  }

  const allNavItems = navSections.flatMap((s) => s.items);

  const renderNavSection = (section: NavSection, index: number, isMobile = false) => (
    <div key={section.title || `section-${index}`} className="space-y-1">
      {section.title && (
        <div className="px-3 pt-3.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50 select-none">
          {section.title}
        </div>
      )}
      <div className="space-y-0.5">
        {section.items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => {
                if (isMobile) setMobileMenuOpen(false);
              }}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-semibold shadow-xs"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active
                    ? "text-accent-foreground"
                    : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground",
                )}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <UserInactivityProvider user={me?.user ?? null} profile={me?.profile ?? null}>
      <div className="flex min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <aside className="hidden w-60 min-w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex border-r border-sidebar-border">
          {/* Header do Menu */}
          <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent shrink-0">
              <Shield className="h-5 w-5 text-accent" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold tracking-tight text-sidebar-foreground leading-none">
                ProAccess
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">
                Gestão & Auditoria
              </span>
            </div>
          </div>

          {/* Lista de Navegação Agrupada */}
          <nav className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-sidebar-border">
            {navSections.map((section, idx) => renderNavSection(section, idx))}
          </nav>

          {/* Footer do Menu */}
          <div className="border-t border-sidebar-border p-3 text-[11px] leading-tight opacity-75">
            <div className="font-semibold">ProAccess v1.0</div>
            <div className="mt-0.5 text-[10px] italic text-muted-foreground">
              Produzido e desenvolvido pelo Planejamento
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col min-w-0">
          <header className="flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6 sticky top-0 z-30">
            {/* Mobile Sidebar Trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden shrink-0">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col"
              >
                <SheetHeader className="p-4 border-b border-sidebar-border text-left">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent shrink-0">
                      <Shield className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex flex-col">
                      <SheetTitle className="text-base font-bold text-sidebar-foreground leading-none">
                        ProAccess
                      </SheetTitle>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">
                        Gestão & Auditoria
                      </span>
                    </div>
                  </div>
                </SheetHeader>
                <nav className="flex-1 space-y-2 overflow-y-auto p-3">
                  {navSections.map((section, idx) => renderNavSection(section, idx, true))}
                </nav>
                <div className="border-t border-sidebar-border p-4 text-xs opacity-75">
                  <div className="font-semibold">ProAccess v1.0</div>
                  <div className="text-[11px] italic text-muted-foreground">
                    Produzido e desenvolvido pelo Planejamento
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {!isCliente ? (
              <button
                onClick={() => setCmdOpen(true)}
                className="flex flex-1 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted max-w-md transition-colors"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate">Buscar no sistema... </span>
                <kbd className="ml-auto hidden sm:inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                  ⌘K
                </kbd>
              </button>
            ) : (
              <div className="flex-1" />
            )}

            <div className="flex items-center gap-2 ml-auto">
              <Button size="icon" variant="ghost" onClick={toggleTheme} title="Alternar tema">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden text-left md:block max-w-[140px]">
                      <div className="text-xs font-medium truncate">{displayName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {isCliente
                          ? "Cliente"
                          : isAdmin
                            ? "Administrador"
                            : isOperador
                              ? "Colaborador"
                              : me?.roles?.[0] || directRole || "Usuário"}
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-semibold truncate">{displayName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {me?.profile?.email ?? me?.user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {!isCliente && (
                    <>
                      <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
                        <User className="mr-2 h-4 w-4" /> Perfil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
                        <Settings className="mr-2 h-4 w-4" /> Configurações
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Sair do Sistema
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
          <footer className="border-t bg-card px-4 py-3 text-center text-xs text-muted-foreground">
            Produzido e desenvolvido pelo Planejamento
          </footer>
        </div>

        {/* Global Command Search (⌘K) */}
        <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
          <CommandInput placeholder="Digite um comando ou busque uma tela..." />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            {navSections.map((section, sIdx) => (
              <CommandGroup
                key={section.title || `cmd-group-${sIdx}`}
                heading={section.title || "Geral"}
              >
                {section.items.map((item) => (
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
            ))}
          </CommandList>
        </CommandDialog>
      </div>
    </UserInactivityProvider>
  );
}

