# PRD — ProAcess v1.0

**Sistema de Gestão de Acessos** • pt-BR • Lovable Cloud + TanStack Start

---

## 1. Capa

- **Projeto:** ProAcess
- **Versão:** 1.0
- **Objetivo:** Substituir planilhas de controle de acessos por uma plataforma segura, auditável e escalável.
- **Responsável:** Administrador Master
- **Histórico:** v1.0 — Lançamento inicial (2026-07)

## 2. Visão Geral

- **Problema:** Controle de acessos disperso, sem auditoria, sem SLA, com risco de acessos órfãos.
- **Solução:** Plataforma web com RBAC, Kanban, IA, auditoria imutável e automações de ciclo de vida.
- **Benefícios:** Segurança, rastreabilidade, produtividade, compliance.
- **Público:** RH, Segurança, TI, Gestores.

## 3. Identidade Visual

- Cores: `#0B1F3A` (azul escuro), `#F58220` (laranja), Branco, Cinza.
- Tipografia: Inter / system-ui.
- Dark mode nativo. Animações sutis. Ícones lucide-react.

## 4. Perfis de Usuário (RBAC)

| Perfil       | Descrição                                          |
| ------------ | -------------------------------------------------- |
| admin_master | Acesso irrestrito, gerencia papéis                 |
| admin        | Gerencia usuários (exceto masters), configurações  |
| analista     | Opera colaboradores, sistemas, acessos, pendências |
| supervisor   | Vê tudo, gerencia próprias pendências              |
| consulta     | Somente leitura                                    |

## 5. Módulos

Dashboard • Colaboradores • Sistemas • Acessos • Pendências (Kanban) • IA • Histórico • Relatórios • Notificações • Administração • Lixeira • Configurações • Perfil.

## 6. Login

- Usuário inicial: `admin@proacess.local` / `JediForever06`
- Troca obrigatória de senha no primeiro acesso.
- Senhas com hash + verificação HIBP habilitada.

## 7. Regras de Negócio (automatizadas via triggers)

- **Admissão:** cria colaborador e permite gerar pendências de acesso.
- **Alteração de função/operação:** registrada em histórico.
- **Férias/Retorno:** status muda e afeta acessos.
- **Desligamento:** move acessos para `exclusao_pendente` e cria pendências.
- **Recontratação:** reativa colaborador.
- **Mudança de operação, promoções, exclusões:** rastreadas.

## 8. Banco de Dados

Tabelas: `profiles`, `user_roles`, `operacoes`, `colaboradores`, `colaborador_favoritos`, `sistemas`, `perfis_acesso`, `acessos`, `pendencias`, `pendencia_comentarios`, `pendencia_anexos`, `historico`, `logs_auditoria`, `notificacoes`, `lixeira`, `ia_conversas`, `ia_mensagens`.

Enums: `app_role`, `colab_status`, `acesso_status`, `pendencia_status`, `pendencia_prioridade`, `pendencia_tipo`.

Índices em FKs, status e datas. Triggers: `tg_touch_updated_at`, `tg_log_historico`, `tg_colab_desligamento`, `handle_new_user`. Funções: `has_role`, `is_admin`, `can_write`.

## 9. Segurança

- Auth Lovable Cloud (email/senha, sessão gerenciada).
- RLS em todas as tabelas + GRANTs.
- Auditoria imutável (`historico` — INSERT-only).
- Logs de eventos sensíveis (`logs_auditoria`).
- Lixeira lógica.
- HTTPS. HIBP habilitado.

## 10. IA Integrada (Lovable AI • gemini-3.5-flash)

- Chat contextualizado com snapshot da base.
- Detecta acessos órfãos, sistemas sem responsável, riscos.
- Sugere acessos por cargo, gera resumos e relatórios.
- Sugestões prontas na interface.

## 11. Dashboard Inteligente

KPIs (colaboradores, sistemas, acessos, pendências), gráficos (bar, pie), painel de saúde (órfãos, sem responsável, pendências).

## 12. Relatórios

Colaboradores, Sistemas, Acessos, Pendências — exportação em Excel, CSV e PDF.

## 13. Notificações

Central com marcação individual/coletiva, badge em tempo (30s polling).

## 14. Kanban

6 colunas (Backlog → Concluído/Cancelado), drag-and-drop com @dnd-kit, etiquetas, prioridades, SLA, checklist, comentários.

## 15. Histórico

Timeline global e por entidade, filtros e busca.

## 16. Funcionalidades Inteligentes

Favoritos, QR Code do colaborador, timeline visual, atalhos globais (⌘K), busca global, painel de saúde, dark mode, sistema de cores por prioridade/criticidade.

## 17. Roadmap

- **v1.0:** Este release. Gestão completa + IA + Kanban.
- **v2.0:** Integrações (AD/LDAP, SSO, e-mail), workflows configuráveis, mobile PWA, tools calling na IA.
- **v3.0:** API pública, marketplace de conectores, IA agente (executa ações).

## 18. Critérios de Aceite (amostra)

- CA-01 Login com Admin realiza troca de senha obrigatória. ✅
- CA-02 RLS bloqueia acesso de `consulta` a escritas. ✅
- CA-03 Desligar colaborador gera pendências de exclusão. ✅
- CA-04 IA responde com base no snapshot atual. ✅
- CA-05 Kanban persiste mudanças de coluna. ✅
- CA-06 Relatório em Excel abre corretamente. ✅
- CA-07 Auditoria não pode ser editada/apagada. ✅
- CA-08 Dashboard exibe KPIs em <2s. ✅

## 19. Requisitos Funcionais (RF-001 a RF-150+)

### Autenticação (RF-001..010)

RF-001 Login por email/senha. RF-002 Bloqueio após tentativas (Lovable Cloud). RF-003 Troca de senha obrigatória no 1º acesso. RF-004 Recuperação de senha. RF-005 Logout com limpeza de cache. RF-006 Verificação HIBP. RF-007 Sessão persistente com auto-refresh. RF-008 Redirecionamento para `/dashboard` após login. RF-009 Rota pública apenas `/` e `/auth`. RF-010 Guard `_authenticated` em rotas privadas.

### Perfis e Permissões (RF-011..025)

RF-011..015 CRUD de papéis (só master). RF-016..020 Matriz de permissões. RF-021 has_role SECURITY DEFINER. RF-022 is_admin. RF-023 can_write. RF-024 Papel padrão `consulta` para novos. RF-025 Impossível se auto-promover.

### Colaboradores (RF-026..050)

RF-026 CRUD. RF-027 Busca por nome. RF-028 Filtro por status. RF-029 Favoritar. RF-030 QR Code. RF-031 Timeline. RF-032 Detalhe com acessos. RF-033 Upload foto (v2). RF-034 CPF/matrícula únicos. RF-035 Vinculação a operação. RF-036 Gestor hierárquico. RF-037..050 Automações de ciclo de vida.

### Sistemas (RF-051..065)

RF-051 CRUD. RF-052 Responsável obrigatório visualmente. RF-053 Criticidade (4 níveis). RF-054 Categoria. RF-055 URL. RF-056..060 Perfis-modelo. RF-061 Detecção de sistemas sem responsável. RF-062..065 Ativação/desativação.

### Acessos (RF-066..085)

RF-066 CRUD. RF-067 Estados: pendente, ativo, suspenso, exclusão pendente, excluído. RF-068 Data de concessão. RF-069 Expiração. RF-070 Login no sistema. RF-071 Perfil no sistema. RF-072..080 Fluxos automatizados. RF-081..085 Matriz colab×sistema.

### Pendências / Kanban (RF-086..115)

RF-086 6 colunas. RF-087 Drag-and-drop. RF-088 Etiquetas. RF-089 Prioridade (4 níveis). RF-090 SLA. RF-091 Checklist. RF-092 Comentários. RF-093 Anexos. RF-094 Filtros. RF-095..100 Tipos. RF-101 Vínculo com colaborador/sistema/acesso. RF-102..115 Fluxos.

### Histórico e Auditoria (RF-116..125)

RF-116 Registro automático via trigger. RF-117 Imutável. RF-118 Diff antes/depois. RF-119 Filtro por entidade. RF-120 Busca. RF-121..125 Logs de auditoria.

### Notificações (RF-126..132)

RF-126 In-app. RF-127 Badge. RF-128 Marcar como lida. RF-129 Marcar todas. RF-130..132 Tipos.

### IA (RF-133..145)

RF-133 Chat. RF-134 Contexto da base. RF-135 Sugestões prontas. RF-136 Markdown. RF-137 Streaming (v2). RF-138..145 Skills.

### Relatórios / Config / Perfil / Lixeira (RF-146..165)

RF-146..150 Relatórios em 3 formatos. RF-151..155 Configurações. RF-156..160 Perfil pessoal. RF-161..165 Lixeira.

## 20. Requisitos Não Funcionais (RNF-001 a RNF-060+)

### Performance

RNF-001 Dashboard <2s. RNF-002 Kanban <300ms drag. RNF-003 Consultas paginadas. RNF-004 Cache React Query. RNF-005 Índices em FKs. RNF-006 Lazy loading. RNF-007 Bundle <500KB gzip.

### Segurança

RNF-008 RLS em todas as tabelas. RNF-009 SECURITY DEFINER apenas quando necessário. RNF-010 Senhas com hash bcrypt. RNF-011 HIBP. RNF-012 HTTPS. RNF-013 Session refresh. RNF-014 CORS restrito. RNF-015 XSS via ReactMarkdown seguro. RNF-016 SQL injection via cliente parametrizado. RNF-017 Auditoria imutável. RNF-018 Logs de acesso. RNF-019 Backup automático (Lovable Cloud). RNF-020 Recuperação de desastre. RNF-021 Least privilege. RNF-022 Zero secrets no cliente.

### UX

RNF-023 pt-BR completo. RNF-024 Dark mode. RNF-025 Responsivo mobile-first. RNF-026 Atalhos ⌘K. RNF-027 Feedback via toast. RNF-028 Loading states. RNF-029 Empty states. RNF-030 Error boundaries. RNF-031 Confirmações destrutivas. RNF-032 Ícones consistentes. RNF-033 Tipografia legível.

### Acessibilidade

RNF-034 ARIA labels. RNF-035 Foco visível. RNF-036 Contraste WCAG AA. RNF-037 Navegação por teclado.

### Escalabilidade

RNF-038 Postgres particionável. RNF-039 CDN estática. RNF-040 Edge functions serverless. RNF-041 Realtime (v2). RNF-042 Multi-tenant ready (v3).

### Confiabilidade

RNF-043 Errors não deixam a UI branca (error boundaries). RNF-044 Retries em falhas de rede. RNF-045 Timeouts razoáveis. RNF-046 Graceful degradation da IA.

### Manutenibilidade

RNF-047 TypeScript estrito. RNF-048 Types gerados do DB. RNF-049 Componentes shadcn. RNF-050 Tokens semânticos. RNF-051 ESLint. RNF-052 Prettier. RNF-053 Estrutura por feature.

### Compliance

RNF-054 LGPD-friendly (dados pessoais isolados). RNF-055 Trilha de auditoria completa. RNF-056 Exportação de dados. RNF-057 Direito ao esquecimento (lixeira).

### Observabilidade

RNF-058 Console logs estruturados. RNF-059 Erros reportados. RNF-060 Métricas em dashboard.

## 21. Melhorias Futuras

- SSO / SAML / Google Workspace / Microsoft Entra.
- Sincronização com AD/LDAP.
- Workflows configuráveis por operação.
- Notificações por e-mail e webhooks.
- App móvel (PWA + push).
- IA com tools calling (executa ações).
- Streaming de resposta da IA.
- Assinatura digital em concessão de acesso.
- Certificação periódica (revisão de acessos).
- Integração com sistemas de ticketing.
- API pública com OAuth 2.1.
- Dashboards customizáveis (widgets).
- Multi-idioma (EN, ES).
- Modo offline com sync.
