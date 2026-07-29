# ProAcess v1 — Plano de Implementação

Sistema web em português (Brasil) para gestão de acessos de colaboradores, com autenticação, RBAC de 5 perfis, IA integrada (Lovable AI), Kanban de pendências, auditoria imutável e relatórios. Stack: TanStack Start + Lovable Cloud (Supabase gerenciado) + Tailwind + shadcn/ui.

## Identidade Visual

- Paleta: Azul Escuro `#0B1F3A`, Laranja `#F58220`, Branco, Cinza Claro.
- Tokens semânticos em `src/styles.css` (oklch). Dark mode com inversão. Tipografia Inter/Manrope. Cards, botões, animações sutis (fade/slide), ícones lucide-react.

## Backend (Lovable Cloud)

### Tabelas principais

- `profiles` (id → auth.users, nome, email, avatar, ativo, senha_alterada bool)
- `app_role` enum: `admin_master`, `admin`, `analista`, `supervisor`, `consulta`
- `user_roles` (user_id, role) + função `has_role()` SECURITY DEFINER
- `permissions` (chave, descrição, módulo) e `role_permissions` (matriz de permissões granulares)
- `operacoes` (unidades/áreas)
- `colaboradores` (nome, cpf, matrícula, cargo, operacao_id, status: ativo/inativo/férias/desligado, admissao_em, desligamento_em, favorito_por[])
- `sistemas` (nome, descrição, responsável_id, criticidade, categoria)
- `perfis_acesso` (sistema_id, nome, descrição) — perfis-modelo por cargo
- `acessos` (colaborador_id, sistema_id, perfil_acesso_id, status: ativo/pendente/exclusao_pendente/excluido, concedido_em, expira_em)
- `pendencias` (tipo, colaborador_id, sistema_id, status kanban, prioridade, sla_em, responsavel_id, checklist jsonb, etiquetas[])
- `pendencia_comentarios`, `pendencia_anexos`
- `historico` (entidade, entidade_id, acao, ator_id, dados_antes jsonb, dados_depois jsonb, criado_em) — imutável
- `logs_auditoria` (evento, ator_id, ip, user_agent, meta jsonb)
- `notificacoes` (destinatario_id, titulo, corpo, tipo, lida, link)
- `lixeira` (entidade, entidade_id, snapshot jsonb, excluido_por, excluido_em)
- `anexos` (bucket storage + metadados)
- Índices em FKs, status, datas; triggers para: histórico automático em INSERT/UPDATE/DELETE, geração de pendências em admissão/desligamento/mudança, cópia para lixeira em soft-delete.
- RLS por perfil + `GRANT`s apropriados. Seed: usuário `Admin` / `JediForever06` como `admin_master`, marcado com `senha_alterada=false`.

### Automações (triggers/funções)

- Admissão → cria pendências de solicitação de acesso conforme cargo (sugestões).
- Mudança de função/operação → pendência de revisão.
- Férias/Retorno → suspende/reativa acessos.
- Desligamento → move colaborador para inativo, gera pendências de exclusão em todos os sistemas com acesso ativo.
- Recontratação → restaura do arquivo.

## Frontend — Rotas

Rota pública: `/` (landing + CTA), `/auth` (login).
Sob `_authenticated/`:

- `/dashboard` — KPIs, gráficos (recharts), painel de saúde, pendências recentes, widgets, últimos acessados.
- `/colaboradores` — lista, filtros, busca global, QR Code, favoritos, upload de documentos, timeline.
- `/colaboradores/$id` — perfil completo com histórico visual, acessos, anexos, comentários.
- `/sistemas` — CRUD, responsáveis, criticidade, perfis-modelo, detecção de sistemas sem responsável.
- `/acessos` — matriz colaborador×sistema, mapa de acessos, duplicados.
- `/pendencias` — **Kanban** (colunas configuráveis) com filtros, etiquetas, prioridade, SLA, checklist, comentários, anexos, drag-and-drop (@dnd-kit).
- `/historico` — timeline auditável, filtros por entidade/ator/período.
- `/relatorios` — geração + export Excel (xlsx), PDF (jspdf), CSV; gráficos.
- `/notificacoes` — central + toasts.
- `/ia` — chat com IA (Lovable AI Gateway, `google/gemini-3.5-flash`) com ferramentas: consultar acessos, detectar inconsistências, sugerir perfis, gerar resumos, encontrar órfãos/esquecidos, alertas de risco.
- `/configuracoes` — preferências, dark mode, atalhos.
- `/administracao` — usuários, perfis, permissões (matriz), operações, backup manual.
- `/administracao/lixeira` — restaurar/excluir definitivamente.
- `/perfil` — dados pessoais, trocar senha, dashboard pessoal.
- `/primeiro-acesso` — troca obrigatória de senha após login inicial.

Layout: Sidebar + Topbar (busca global, notificações, avatar, atalhos ⌘K via cmdk).

## IA Integrada (Lovable AI)

Server function `chat` (streaming) com histórico persistido, tools do AI SDK:

- `buscar_colaborador`, `listar_acessos`, `detectar_orfaos`, `sistemas_sem_responsavel`, `sugerir_acessos_por_cargo`, `gerar_resumo`, `alertas_risco`, `gerar_relatorio`.
  Painel de IA com alertas proativos gerados em background (edge/cron opcional v2).

## Segurança

- Auth Supabase email/senha, sessão gerenciada.
- Bloqueio após N tentativas (tabela `login_attempts`).
- RBAC via `user_roles` + `has_role()` em todas as políticas RLS.
- Histórico + auditoria imutáveis (sem UPDATE/DELETE via policy).
- Lixeira lógica; nada é apagado fisicamente na v1.
- Logs de sessão, IP, user-agent.
- HTTPS, hash de senha (Supabase Auth), HIBP habilitado.

## Requisitos

- README dedicado com >150 RFs numerados (RF-001…) e >60 RNFs, critérios de aceite, roadmap v1/v2/v3 e melhorias futuras. Documento em `docs/PRD_ProAcess.md`.

## Ordem de implementação (executada de forma contínua)

1. Ativar Lovable Cloud + Lovable AI Key.
2. Migrations: enum, tabelas, RLS, grants, triggers, seed do Admin Master.
3. Design system (tokens, dark mode, layout base, sidebar/topbar).
4. Auth + primeiro acesso (troca obrigatória de senha) + guarda `_authenticated`.
5. CRUDs: Operações, Sistemas, Perfis, Colaboradores.
6. Fluxo de Acessos + automações (admissão/desligamento/férias).
7. Kanban de Pendências (dnd-kit) com etiquetas, SLA, checklist, comentários, anexos.
8. Histórico + Auditoria + Lixeira.
9. Dashboard + Relatórios (xlsx/pdf/csv/gráficos).
10. Notificações (in-app + toasts).
11. IA (chat + tools + painel de alertas).
12. Administração (permissões, usuários), Perfil, Configurações, Busca global (⌘K), QR Code, favoritos, timeline, widgets.
13. Documentação (PRD expandido + requisitos).

## Considerações

Escopo enorme — a v1 entregará todos os módulos funcionalmente, mas com profundidade proporcional (algumas “funcionalidades inteligentes” ficarão em versões básicas e evoluirão). Vou construir iterativamente e você poderá pedir refinamentos por módulo.
