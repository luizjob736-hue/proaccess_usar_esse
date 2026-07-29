import pg from "pg";

const NEON_URL =
  "postgresql://neondb_owner:npg_yfSCO5GNgd1n@ep-sweet-sea-ayco0rx7-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || NEON_URL;

async function seed() {
  console.log("Conectando ao Neon para popular dados operacionais...");
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // 1. Obter o perfil master criado
    const adminRes = await client.query(
      "SELECT id FROM profiles WHERE email = 'luiz.reis@proacess.local' LIMIT 1",
    );
    const masterId = adminRes.rows[0]?.id || null;

    // 2. Inserir Operações
    console.log("Semeando Operações...");
    const opsData = [
      { nome: "AMIGOZ", descricao: "Operação Amigoz - Atendimento e Biometria" },
      { nome: "RETENÇÃO", descricao: "Operação Retenção de Clientes" },
      { nome: "PINE", descricao: "Operação Pine - Validação Biométrica" },
      { nome: "EMPRÉSTIMOS/HAPPY", descricao: "Operação Empréstimos e Crédito Happy" },
      { nome: "TECNOLOGIA", descricao: "Operação Interna de TI e Infraestrutura" },
    ];

    const opMap: Record<string, string> = {};
    for (const op of opsData) {
      const res = await client.query(
        `INSERT INTO operacoes (nome, descricao, ativo) 
         VALUES ($1, $2, true) 
         ON CONFLICT (nome) DO UPDATE SET descricao = EXCLUDED.descricao 
         RETURNING id, nome`,
        [op.nome, op.descricao],
      );
      opMap[res.rows[0].nome] = res.rows[0].id;
    }

    // 3. Inserir Sistemas
    console.log("Semeando Sistemas...");
    const sistemasData = [
      {
        nome: "CONDUCTOR",
        categoria: "Core Financeiro",
        criticidade: "alta",
        url: "https://conductor.internal",
      },
      {
        nome: "SICLO",
        categoria: "Gestão Operacional",
        criticidade: "media",
        url: "https://siclo.internal",
      },
      { nome: "AGX", categoria: "Automação", criticidade: "alta", url: "https://agx.internal" },
      {
        nome: "CELLCOIN",
        categoria: "Pagamentos",
        criticidade: "critica",
        url: "https://cellcoin.internal",
      },
      {
        nome: "ZILICRED",
        categoria: "Crédito",
        criticidade: "alta",
        url: "https://zilicred.internal",
      },
      {
        nome: "AMIGOZ BACKOFFICE",
        categoria: "Backoffice",
        criticidade: "media",
        url: "https://amigoz.internal",
      },
      {
        nome: "HAPPY BACKOFFICE",
        categoria: "Backoffice",
        criticidade: "media",
        url: "https://happy.internal",
      },
      {
        nome: "NUVIDEO",
        categoria: "Atendimento Vídeo",
        criticidade: "alta",
        url: "https://nuvideo.internal",
      },
      {
        nome: "AMIGOZ CONSIG/FRONT",
        categoria: "Consignado",
        criticidade: "alta",
        url: "https://consig.internal",
      },
      {
        nome: "BACKOFFICE BYX",
        categoria: "Backoffice",
        criticidade: "baixa",
        url: "https://byx.internal",
      },
    ];

    const sistemaMap: Record<string, string> = {};
    for (const sis of sistemasData) {
      const res = await client.query(
        `INSERT INTO sistemas (nome, categoria, criticidade, url, ativo, responsavel_id) 
         VALUES ($1, $2, $3, $4, true, $5) 
         ON CONFLICT (nome) DO UPDATE SET categoria = EXCLUDED.categoria 
         RETURNING id, nome`,
        [sis.nome, sis.categoria, sis.criticidade, sis.url, masterId],
      );
      sistemaMap[res.rows[0].nome] = res.rows[0].id;

      // Inserir perfil de acesso padrão para o sistema
      await client.query(
        `INSERT INTO perfis_acesso (sistema_id, nome, descricao)
         VALUES ($1, 'Operador Padrão', 'Acesso padrão de operador no sistema')
         ON CONFLICT DO NOTHING`,
        [res.rows[0].id],
      );
    }

    // 4. Inserir Colaboradores de Exemplo
    console.log("Semeando Colaboradores...");
    const colaboradoresData = [
      {
        nome: "Luiz Reis",
        cpf: "111.222.333-00",
        matricula: "PRO001",
        email: "luiz.reis@proacess.local",
        telefone: "(11) 98888-7777",
        cargo: "Administrador Master",
        opNome: "TECNOLOGIA",
        status: "ativo",
      },
      {
        nome: "Ana Carolina Silva",
        cpf: "222.333.444-11",
        matricula: "PRO002",
        email: "ana.silva@proacess.local",
        telefone: "(11) 97777-6666",
        cargo: "Analista de Suporte",
        opNome: "AMIGOZ",
        status: "ativo",
      },
      {
        nome: "Carlos Eduardo Santos",
        cpf: "333.444.555-22",
        matricula: "PRO003",
        email: "carlos.santos@proacess.local",
        telefone: "(11) 96666-5555",
        cargo: "Supervisor de Atendimento",
        opNome: "RETENÇÃO",
        status: "ativo",
      },
      {
        nome: "Mariana Oliveira",
        cpf: "444.555.666-33",
        matricula: "PRO004",
        email: "mariana.oliveira@proacess.local",
        telefone: "(11) 95555-4444",
        cargo: "Operadora de Biometria",
        opNome: "PINE",
        status: "ativo",
      },
      {
        nome: "Roberto Costa",
        cpf: "555.666.777-44",
        matricula: "PRO005",
        email: "roberto.costa@proacess.local",
        telefone: "(11) 94444-3333",
        cargo: "Analista de Crédito",
        opNome: "EMPRÉSTIMOS/HAPPY",
        status: "inativo",
      },
    ];

    const colabMap: Record<string, string> = {};
    for (const col of colaboradoresData) {
      const opId = opMap[col.opNome] || null;
      const res = await client.query(
        `INSERT INTO colaboradores (nome, cpf, matricula, email, telefone, cargo, operacao_id, status, admissao_em, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, $9)
         ON CONFLICT (cpf) DO UPDATE SET status = EXCLUDED.status
         RETURNING id, nome`,
        [
          col.nome,
          col.cpf,
          col.matricula,
          col.email,
          col.telefone,
          col.cargo,
          opId,
          col.status,
          masterId,
        ],
      );
      colabMap[res.rows[0].nome] = res.rows[0].id;
    }

    // 5. Inserir Acessos Concedidos
    console.log("Semeando Acessos...");
    const acessosData = [
      { colab: "Ana Carolina Silva", sis: "CONDUCTOR", login: "ana.silva", status: "ativo" },
      { colab: "Ana Carolina Silva", sis: "SICLO", login: "ana.silva", status: "ativo" },
      { colab: "Carlos Eduardo Santos", sis: "RETENÇÃO", login: "carlos.santos", status: "ativo" },
      { colab: "Carlos Eduardo Santos", sis: "NUVIDEO", login: "carlos.santos", status: "ativo" },
      { colab: "Mariana Oliveira", sis: "PINE", login: "mariana.o", status: "ativo" },
      { colab: "Mariana Oliveira", sis: "AGX", login: "mariana.o", status: "ativo" },
      { colab: "Roberto Costa", sis: "CELLCOIN", login: "roberto.c", status: "excluido" },
    ];

    for (const ac of acessosData) {
      const colId = colabMap[ac.colab];
      const sisId = sistemaMap[ac.sis];
      if (colId && sisId) {
        // Pega perfil de acesso do sistema
        const perfRes = await client.query(
          "SELECT id FROM perfis_acesso WHERE sistema_id = $1 LIMIT 1",
          [sisId],
        );
        const perfilId = perfRes.rows[0]?.id || null;

        await client.query(
          `INSERT INTO acessos (colaborador_id, sistema_id, perfil_acesso_id, status, login, concedido_em, concedido_por)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6)
           ON CONFLICT DO NOTHING`,
          [colId, sisId, perfilId, ac.status, ac.login, masterId],
        );
      }
    }

    // 6. Inserir Pendências no Kanban
    console.log("Semeando Pendências (Kanban)...");
    const pendenciasData = [
      {
        titulo: "Solicitação de Acesso CONDUCTOR - Ana Silva",
        descricao: "Criar usuário de operador com permissão de biometria.",
        tipo: "solicitacao_acesso",
        status: "backlog",
        prioridade: "alta",
        colab: "Ana Carolina Silva",
        sis: "CONDUCTOR",
      },
      {
        titulo: "Revogação de Acesso CELLCOIN - Roberto Costa",
        descricao: "Desligamento efetuado. Necessário revogar credenciais.",
        tipo: "exclusao_acesso",
        status: "em_andamento",
        prioridade: "critica",
        colab: "Roberto Costa",
        sis: "CELLCOIN",
      },
      {
        titulo: "Alteração de Perfil NUVIDEO - Carlos Santos",
        descricao: "Promoção para supervisor de operações.",
        tipo: "alteracao",
        status: "concluido",
        prioridade: "media",
        colab: "Carlos Eduardo Santos",
        sis: "NUVIDEO",
      },
    ];

    for (const p of pendenciasData) {
      const colId = colabMap[p.colab] || null;
      const sisId = sistemaMap[p.sis] || null;
      await client.query(
        `INSERT INTO pendencias (titulo, descricao, tipo, status, prioridade, colaborador_id, sistema_id, criado_por, responsavel_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         ON CONFLICT DO NOTHING`,
        [p.titulo, p.descricao, p.tipo, p.status, p.prioridade, colId, sisId, masterId],
      );
    }

    // 7. Limpar duplicados em lista_acessos se houver
    console.log("Higienizando lista_acessos...");
    await client.query(`
      DELETE FROM lista_acessos a USING lista_acessos b
      WHERE a.id > b.id AND a.titulo = b.titulo;
    `);

    console.log("Banco de dados Neon populado e ajustado com sucesso!");
  } catch (err) {
    console.error("Erro ao semear banco Neon:", err);
  } finally {
    await client.end();
  }
}

seed();
