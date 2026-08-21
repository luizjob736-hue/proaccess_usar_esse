import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL ||
  "postgresql://neondb_owner:npg_yfSCO5GNgd1n@ep-sweet-sea-ayco0rx7-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function checkOrphan() {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT * FROM public.pendencias WHERE colaborador_id IS NULL OR sistema_id IS NULL;
    `);
    console.log("Orphan pendencias:", res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

checkOrphan().catch(console.error);
