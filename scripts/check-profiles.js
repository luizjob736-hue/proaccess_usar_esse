import pg from "pg";

const NEON_URL =
  "postgresql://neondb_owner:npg_yfSCO5GNgd1n@ep-sweet-sea-ayco0rx7-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || NEON_URL;

async function check() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const res = await client.query(
    `SELECT id, nome, email, cpf, ultima_senha, ativo FROM public.profiles`,
  );
  console.log("PROFILES:", res.rows);

  const roles = await client.query(`SELECT * FROM public.user_roles`);
  console.log("ROLES:", roles.rows);

  await client.end();
}

check().catch(console.error);
