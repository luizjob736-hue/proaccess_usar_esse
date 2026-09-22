# 📘 Documentação Completa do Sistema — ProAcess

**Plataforma Integrada de Gestão de Acessos, Matriz de Credenciais, Auditoria e Processos de TI**  
*Versão: 2.0 • Data de Atualização: Setembro/2026 • Idioma: Português (Brasil)*

---

## 📑 Sumário Executivo

1. [Visão Geral e Objetivos do Sistema](#1-visão-geral-e-objetivos-do-sistema)
2. [Arquitetura Tecnológica e Infraestrutura](#2-arquitetura-tecnológica-e-infraestrutura)
3. [Controle de Acesso e Perfis (RBAC)](#3-controle-de-acesso-e-perfis-rbac)
4. [Módulos e Funcionalidades Detalhadas](#4-módulos-e-funcionalidades-detalhadas)
   - 4.1. [Dashboard & Métricas](#41-dashboard--métricas)
   - 4.2. [Matriz de Acessos (Principal)](#42-matriz-de-acessos-principal)
   - 4.3. [Pré-Atendimento](#43-pré-atendimento)
   - 4.4. [Usuários Inativos (Gestão de Desligados)](#44-usuários-inativos-gestão-de-desligados)
   - 4.5. [Usuários a Solicitar](#45-usuários-a-solicitar)
   - 4.6. [Gestão de Sistemas & Aplicações](#46-gestão-de-sistemas--aplicações)
   - 4.7. [Lista de Acessos Detalhada](#47-lista-de-acessos-detalhada)
   - 4.8. [Importação em Lote (CSV / Planilhas)](#48-importação-em-lote-csv--planilhas)
   - 4.9. [Gestão de Pendências (Kanban de Provisionamento)](#49-gestão-de-pendências-kanban-de-provisionamento)
   - 4.10. [Central de Chamados & Suporte](#410-central-de-chamados--suporte)
   - 4.11. [Backups Automáticos & Histórico de Snapshots](#411-backups-automáticos--histórico-de-snapshots)
   - 4.12. [Relatórios Avançados & Matriz de Pendências](#412-relatórios-avançados--matriz-de-pendências)
   - 4.13. [Histórico e Trilha de Auditoria](#413-histórico-e-trilha-de-auditoria)
   - 4.14. [Administração de Usuários e Permissões](#414-administração-de-usuários-e-permissões)
   - 4.15. [Lixeira & Recuperação de Dados](#415-lixeira--recuperação-de-dados)
   - 4.16. [Configurações do Sistema](#416-configurações-do-sistema)
5. [Mecanismos de Segurança e Sessão](#5-mecanismos-de-segurança-e-sessão)
   - 5.1. [Proteção de Inatividade Individual (15 Minutos)](#51-proteção-de-inatividade-individual-15-minutos)
   - 5.2. [Mascaramento e Revelação Segura de Credenciais](#52-mascaramento-e-revelação-segura-de-credenciais)
   - 5.3. [Trilha de Auditoria Imutável](#53-trilha-de-auditoria-imutável)
6. [Estrutura do Banco de Dados](#6-estrutura-do-banco-de-dados)
7. [Guia de Operações Comuns](#7-guia-de-operações-comuns)

---

## 1. Visão Geral e Objetivos do Sistema

O **ProAcess** foi desenvolvido para centralizar, automatizar e proteger o ciclo de vida completo dos acessos de colaboradores a sistemas internos e externos corporativos (como CRMs, BKO, Telefonia, E-mail, VPN e Sistemas Bancários).

### Principais Dores Resolvidas:
- **Fim das planilhas manuais e desatualizadas:** Eliminação de controles paralelos em Excel suscetíveis a perdas e vazamentos.
- **Prevenção de Acessos Órfãos:** Bloqueio e inativação imediata de credenciais de colaboradores desligados.
- **Rastreabilidade e Compliance:** Registro de quem solicitou, quem aprovou, quem criou e quando qualquer usuário/senha foi alterado.
- **Continuidade Operacional:** Backups automáticos diários salvos em banco de dados com histórico navegável e exportação rápida em múltiplos formatos.

---

## 2. Arquitetura Tecnológica e Infraestrutura

- **Frontend & Full-Stack:** React 18, TypeScript, TanStack Router / TanStack Start, TanStack Query (React Query).
- **Estilização & UI:** Tailwind CSS, Radix UI (shadcn/ui), Lucide Icons, animações com Framer Motion.
- **Manipulação e Exportação de Dados:** XLSX (SheetJS), jsPDF, autoTable, PapaParse (CSV).
- **Banco de Dados & Backend:** PostgreSQL em nuvem (Neon / Postgres Serverless) com autenticação de sessão e RPCs seguras.
- **Manipulação de Fuso Horário:** Padronizado para o horário oficial de Brasília (`America/Sao_Paulo` / UTC-3).

---

## 3. Controle de Acesso e Perfis (RBAC)

O sistema implementa **Controle de Acesso Baseado em Papéis** com segregação rígida de privilégios:

| Papel (`role`) | Nível de Acesso | Permissões Principais |
|:---|:---:|:---|
| **Admin Master** (`admin_master`) | Total | Acesso irrestrito; gestão de usuários do sistema, exclusões permanentes, configurações globais e backups. |
| **Administrador** (`admin`) | Alto | Gestão de colaboradores, sistemas, acessos, operações e relatórios; sem permissão de alterar papéis de Admin Master. |
| **Analista de Acessos** (`analista`) | Operacional | Criação e edição de colaboradores, concessão/revogação de acessos na Matriz, movimentação de pendências e atendimento de chamados. |
| **Supervisor** (`supervisor`) | Gerencial | Visualização de matrizes e relatórios da sua equipe/operação, abertura de solicitações e acompanhamento de SLA. |
| **Operador** (`operador`) | Restrito / Pessoal | Visualização exclusiva da sua própria matriz de acessos (`/minha-matriz`) e perfil pessoal. |
| **Consulta** (`consulta`) | Somente Leitura | Consulta a dados da Matriz e relatórios, sem permissão de edição. |

---

## 4. Módulos e Funcionalidades Detalhadas

### 4.1. Dashboard & Métricas
- **Indicadores em Tempo Real:** Total de colaboradores ativos, inativos, sistemas cadastrados, acessos concedidos e pendências em aberto.
- **Gráficos de Distribuição:** Acessos por operação, sistemas mais utilizados e status de solicitações.
- **Painel de Atenção:** Alertas de colaboradores sem acessos cadastrados e pendências próximas do vencimento de SLA.

### 4.2. Matriz de Acessos (Principal)
- **Visão Bidimensional (Colaborador × Sistemas):**
  - Linhas representam os colaboradores (com Nome, CPF, Cargo, Operação e E-mail corporativo).
  - Colunas representam cada sistema/aplicação ativa da organização.
  - Células exibem o Usuário (Login) e Senha associados.
- **Edição Ágil Direta:** Edição inline de credenciais com salvamento instantâneo.
- **Modo Ocultar/Revelar Senhas:** Senhas vêm mascaradas com asteriscos (`••••••••`) e podem ser reveladas por clique mediante permissão.
- **Busca Global & Filtros:** Busca simultânea por nome, CPF, e-mail, cargo, operação ou login de qualquer sistema.

### 4.3. Pré-Atendimento
- **Fluxo de Integração (Novas Admissões):** Espaço dedicado para cadastrar colaboradores antes do início efetivo das atividades.
- **Provisionamento Antecipado:** Permite cadastrar todos os logins e senhas necessários antes do primeiro dia de trabalho do colaborador.
- **Migração com 1 Clique:** Ao concluir a integração, o colaborador é promovido diretamente para a Matriz Principal de Ativos.

### 4.4. Usuários Inativos (Gestão de Desligados)
- **Controle de Desligamentos:** Histórico completo de colaboradores inativados com data e hora exata do desligamento.
- **Revogação de Credenciais:** Assegura que todos os acessos vinculados sejam suspensos no momento da inativação.
- **Reativação Facilitada:** Possibilidade de reativar colaboradores (ex.: retorno de licença ou recontratação) restaurando seu histórico.

### 4.5. Usuários a Solicitar
- **Fila de Demandas de Criação de Contas:** Gestão de novos colaboradores ou transferências pendentes de provisionamento externo em fornecedores de TI/Bancos.

### 4.6. Gestão de Sistemas & Aplicações
- Cadastro, edição e desativação de sistemas.
- Definição de Criticidade (Alta, Média, Baixa), Categoria, URL de acesso e descrição.
- Gestão de **Perfis de Acesso** vinculados a cada sistema (ex.: Admin, Operador, Leitura, Supervisor).

### 4.7. Lista de Acessos Detalhada
- Tabela linear com todos os acessos individuais registrados, facilitando auditorias pontuais por sistema, colaborador ou data de atualização.

### 4.8. Importação em Lote (CSV / Planilhas)
- **Mapeador Inteligente de Colunas:** Reconhecimento automático de colunas (Nome, CPF, E-mail, Cargo, Operação, Sistemas).
- **Validação Prévia:** Validação de formato de CPF, detecção de duplicidades e visualização prévia antes da gravação definitiva.
- **Atualização em Massa:** Atualiza cadastros existentes sem sobrescrever dados não preenchidos.

### 4.9. Gestão de Pendências (Kanban de Provisionamento)
- **Quadro Visual (Kanban):** Colunas organizadas por status (`Pendente`, `Em Andamento`, `Aguardando TI`, `Concluído`, `Cancelado`).
- **Controle de SLA:** Prazos limites com destaque visual para solicitações críticas ou em atraso.
- **Tipos de Solicitação:** Concessão de Acesso, Revogação (Desligamento), Alteração de Perfil e Reset de Senha.
- **Arrastar e Soltar (Drag & Drop):** Movimentação rápida de cartões entre colunas.

### 4.10. Central de Chamados & Suporte
- Abertura de chamados técnicos de erro de acesso, bloqueio de usuário ou indisponibilidade de sistema.
- Atribuição a operadores responsáveis, histórico de mensagens e respostas de resolução.

### 4.11. Backups Automáticos & Histórico de Snapshots
- **Execução Diária Automática:** Rotina em segundo plano acionada no primeiro acesso diário de qualquer usuário, salvando o snapshot integral de todas as tabelas.
- **Política de Retenção de 30 Dias:** Armazenamento dos últimos 30 snapshots diários com expurgo automático de versões anteriores.
- **Seletor de Snapshots Históricos:** Navegação visual por qualquer data anterior para auditar o estado exato da matriz naquele dia.
- **Exportação Multiformato:**
  - Planilha Completa em Excel com 7 guias estruturadas (`.xlsx`).
  - Planilha da guia ativa (`.xlsx`).
  - Arquivo de texto separado por vírgulas (`.csv`).
- **Geração Manual:** Botão de geração/atualização forçada sob demanda.

### 4.12. Relatórios Avançados & Matriz de Pendências
- **Matriz de Pendências:** Relatório cruzado de solicitações com exibição do título da demanda por sistema e colaborador.
- **Relatório Geral por Operação e Sistema:** Quantitativo de acessos por departamento.
- **Exportações:** Relatórios para impressão em PDF, planilhas Excel formatadas e CSV.

### 4.13. Histórico e Trilha de Auditoria
- **Log de Eventos:** Registro cronológico de todas as ações executadas (criação, edição, exclusão, inativação, visualização de senhas).
- Identificação do usuário executor, IP, data/hora e valores anteriores vs. novos.

### 4.14. Administração de Usuários e Permissões
- Gestão de contas de acesso à plataforma ProAcess.
- Atribuição de perfis (`admin_master`, `admin`, `analista`, `supervisor`, `operador`, `consulta`).
- Reset de senhas administrativas e bloqueio temporário de operadores.

### 4.15. Lixeira & Recuperação de Dados
- **Soft Delete (Exclusão Lógica):** Registros excluídos vão para a lixeira protegida antes da exclusão permanente.
- Restauração com 1 clique para evitar exclusões acidentais.

### 4.16. Configurações do Sistema
- Preferências de tema (Modo Claro / Modo Escuro).
- Parâmetros de tempo de sessão e segurança.

---

## 5. Mecanismos de Segurança e Sessão

### 5.1. Proteção de Inatividade Individual (15 Minutos)
- O sistema monitora a atividade de cada usuário individualmente (movimento do mouse, cliques, digitação, toques em tela).
- Após **15 minutos ininterruptos de inatividade**, a sessão é automaticamente bloqueada com overlay de segurança para prevenir acessos indevidos em estações de trabalho desatendidas.
- Sincronização via `BroadcastChannel` entre todas as abas abertas no mesmo navegador.

### 5.2. Mascaramento e Revelação Segura de Credenciais
- Todas as senhas armazenadas são exibidas por padrão como `••••••••`.
- O botão de revelar senha requer autenticação de sessão e é auditado para prevenir vazamentos.

### 5.3. Trilha de Auditoria Imutável
- A tabela de histórico é configurada como estritamente *Append-Only* (apenas inserções), garantindo que nenhum usuário possa apagar ou alterar logs de auditoria passados.

---

## 6. Estrutura do Banco de Dados

```
├── profiles (Usuários da plataforma ProAcess)
├── user_roles (Papéis e permissões RBAC)
├── operacoes (Departamentos / Operações / Setores)
├── colaboradores (Base de funcionários ativos/inativos)
├── sistemas (Catálogo de softwares e aplicações)
├── perfis_acesso (Tipos de perfis por sistema)
├── acessos (Credenciais: Colaborador × Sistema × Perfil × Login × Senha)
├── pendencias (Demandas do Kanban de TI/RH)
├── chamados (Tickets de suporte e chamados operacionais)
├── backups_sistema (Snapshots diários consolidados em JSONB)
├── backups_matriz (Snapshots legados de matriz)
├── backups_pendencias (Snapshots legados de pendências)
├── historico (Logs de auditoria imutáveis)
└── lixeira (Registros em quarentena pré-exclusão)
```

---

## 7. Guia de Operações Comuns

### Como cadastrar um novo colaborador e seus acessos:
1. Acesse o menu **Pré-Atendimento** (para integração) ou **Matriz de Acessos** (admissão direta).
2. Clique em **Novo Colaborador**, preencha Nome, CPF, Data de Nascimento, Cargo, Operação e E-mail.
3. Na linha do colaborador na Matriz, clique nos campos dos sistemas correspondentes e preencha Usuário e Senha.
4. As alterações são salvas automaticamente em tempo real.

### Como desligar um colaborador:
1. Na **Matriz de Acessos**, localize o colaborador.
2. Altere o status para **Inativo** ou clique na opção **Inativar**.
3. O colaborador será movido imediatamente para a guia **Usuários Inativos**, revogando o acesso ativo e registrando a data/hora do desligamento.

### Como baixar o Backup Completo do Sistema:
1. Acesse o menu **Backup da Matriz** (`/backups`).
2. Clique no botão **Baixar Planilha Completa (7 Guias .XLSX)**.
3. O arquivo baixado conterá abas estruturadas para: Matriz Geral, Colaboradores, Sistemas, Credenciais & Senhas, Pendências, Operações e Chamados.

---

*Documentação mantida pela equipe de TI e Governança de Acessos ProAcess.*
