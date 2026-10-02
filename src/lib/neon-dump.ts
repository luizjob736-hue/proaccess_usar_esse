import { getNeonPool } from "@/lib/neon-server";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function escapeSqlVal(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return isFinite(val) ? String(val) : "NULL";
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === "object") {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function mapDataType(col: any): string {
  const dt = (col.data_type || "").toLowerCase();
  const udt = (col.udt_name || "").toLowerCase();
  if (dt === "uuid" || udt === "uuid") return "UUID";
  if (dt === "boolean" || udt === "bool") return "BOOLEAN";
  if (dt === "integer" || udt === "int4") return "INTEGER";
  if (dt === "bigint" || udt === "int8") return "BIGINT";
  if (dt === "smallint" || udt === "int2") return "SMALLINT";
  if (dt === "numeric" || dt === "decimal") return "NUMERIC";
  if (dt === "real" || udt === "float4") return "REAL";
  if (dt === "double precision" || udt === "float8") return "DOUBLE PRECISION";
  if (dt === "timestamp with time zone" || udt === "timestamptz") return "TIMESTAMP WITH TIME ZONE";
  if (dt === "timestamp without time zone" || udt === "timestamp") return "TIMESTAMP WITHOUT TIME ZONE";
  if (dt === "date") return "DATE";
  if (dt === "time without time zone" || dt === "time with time zone") return "TIME";
  if (dt === "jsonb" || udt === "jsonb") return "JSONB";
  if (dt === "json" || udt === "json") return "JSON";
  if (dt === "array" || udt.startsWith("_")) return `${udt.replace("_", "").toUpperCase()}[]`;
  if (dt === "character varying" || dt === "varchar") {
    return col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : "VARCHAR";
  }
  if (dt === "text") return "TEXT";
  return udt.toUpperCase() || "TEXT";
}

export interface NeonTableStat {
  name: string;
  rows: number;
  columns: number;
}

export interface NeonDatabaseInfo {
  database: string;
  host: string;
  totalTables: number;
  totalRows: number;
  lastDumpAt: string | null;
  sqlFileSizeMb: string;
  sqlGzSizeMb: string;
  jsonFileSizeMb: string;
  jsonGzSizeMb: string;
  tables: NeonTableStat[];
}

export async function getNeonDatabaseInfo(): Promise<NeonDatabaseInfo> {
  const pool = await getNeonPool();

  const tablesRes = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;",
  );
  const tables = tablesRes.rows.map((r: any) => r.table_name);

  const tableStats: NeonTableStat[] = [];
  let totalRows = 0;

  for (const t of tables) {
    try {
      const [colRes, countRes] = await Promise.all([
        pool.query(
          "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;",
          [t],
        ),
        pool.query(`SELECT COUNT(*) as count FROM "${t}";`),
      ]);
      const rowCount = parseInt(countRes.rows[0]?.count || "0", 10);
      const colCount = parseInt(colRes.rows[0]?.count || "0", 10);
      totalRows += rowCount;
      tableStats.push({
        name: t,
        rows: rowCount,
        columns: colCount,
      });
    } catch {
      tableStats.push({ name: t, rows: 0, columns: 0 });
    }
  }

  let lastDumpAt: string | null = null;
  let sqlFileSizeMb = "0";
  let sqlGzSizeMb = "0";
  let jsonFileSizeMb = "0";
  let jsonGzSizeMb = "0";

  try {
    const cwd = process.cwd();
    const sqlPath = path.join(cwd, "neon_database_dump.sql");
    const sqlGzPath = path.join(cwd, "neon_database_dump.sql.gz");
    const jsonPath = path.join(cwd, "neon_database_dump.json");
    const jsonGzPath = path.join(cwd, "neon_database_dump.json.gz");

    if (fs.existsSync(sqlPath)) {
      const stat = fs.statSync(sqlPath);
      lastDumpAt = stat.mtime.toISOString();
      sqlFileSizeMb = (stat.size / 1024 / 1024).toFixed(2);
    }
    if (fs.existsSync(sqlGzPath)) {
      const stat = fs.statSync(sqlGzPath);
      sqlGzSizeMb = (stat.size / 1024 / 1024).toFixed(2);
    }
    if (fs.existsSync(jsonPath)) {
      const stat = fs.statSync(jsonPath);
      jsonFileSizeMb = (stat.size / 1024 / 1024).toFixed(2);
    }
    if (fs.existsSync(jsonGzPath)) {
      const stat = fs.statSync(jsonGzPath);
      jsonGzSizeMb = (stat.size / 1024 / 1024).toFixed(2);
    }
  } catch {
    // ignore
  }

  return {
    database: "neondb",
    host: "ep-sweet-sea-ayco0rx7-pooler.c-5.us-east-2.aws.neon.tech",
    totalTables: tables.length,
    totalRows,
    lastDumpAt,
    sqlFileSizeMb,
    sqlGzSizeMb,
    jsonFileSizeMb,
    jsonGzSizeMb,
    tables: tableStats,
  };
}

export async function generateNeonDatabaseDumpFiles(): Promise<{
  success: boolean;
  totalRows: number;
  totalTables: number;
  durationMs: number;
  generatedAt: string;
}> {
  const start = Date.now();
  const pool = await getNeonPool();

  const tablesRes = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;",
  );
  const tables = tablesRes.rows.map((r: any) => r.table_name);

  const timestamp = new Date().toISOString();

  let sql = `-- ==========================================================================\n`;
  sql += `-- PROACCESS - BACKUP COMPLETO DO BANCO DE DADOS NEON (POSTGRESQL)\n`;
  sql += `-- Gerado em: ${timestamp} (UTC)\n`;
  sql += `-- Host: ep-sweet-sea-ayco0rx7-pooler.c-5.us-east-2.aws.neon.tech\n`;
  sql += `-- Banco: neondb\n`;
  sql += `-- Total de Tabelas: ${tables.length}\n`;
  sql += `-- ==========================================================================\n\n`;

  sql += `SET statement_timeout = 0;\n`;
  sql += `SET client_encoding = 'UTF8';\n`;
  sql += `SET standard_conforming_strings = on;\n`;
  sql += `SET check_function_bodies = false;\n`;
  sql += `SET client_min_messages = warning;\n`;
  sql += `SET row_security = off;\n\n`;
  sql += `BEGIN;\n\n`;
  sql += `-- Desabilita triggers e checagem de chaves temporariamente para restauracao sem conflitos de ordem\n`;
  sql += `SET session_replication_role = 'replica';\n\n`;

  const jsonDump: any = {
    metadata: {
      sistema: "ProAccess",
      gerado_em: timestamp,
      banco: "neondb",
      engine: "PostgreSQL (Neon Serverless)",
      total_tabelas: tables.length,
    },
    tabelas: {},
    estatisticas: {},
  };

  let totalRowsAcrossAll = 0;

  for (const t of tables) {
    const colRes = await pool.query(
      "SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position;",
      [t],
    );
    const cols = colRes.rows;

    const rowRes = await pool.query(`SELECT * FROM "${t}";`);
    const rows = rowRes.rows;
    totalRowsAcrossAll += rows.length;

    jsonDump.tabelas[t] = rows;
    jsonDump.estatisticas[t] = {
      colunas: cols.length,
      registros: rows.length,
    };

    sql += `-- --------------------------------------------------------------------------\n`;
    sql += `-- Tabela: "${t}" (${rows.length} registros, ${cols.length} colunas)\n`;
    sql += `-- --------------------------------------------------------------------------\n`;

    // CREATE TABLE DDL
    const colDefs = cols.map((c: any) => {
      let def = `  "${c.column_name}" ${mapDataType(c)}`;
      if (c.column_default) {
        def += ` DEFAULT ${c.column_default}`;
      }
      if (c.is_nullable === "NO") {
        def += ` NOT NULL`;
      }
      return def;
    });

    sql += `CREATE TABLE IF NOT EXISTS "${t}" (\n${colDefs.join(",\n")}\n);\n\n`;

    // INSERT INTO DML (Batched)
    if (rows.length > 0) {
      const colNames = cols.map((c: any) => `"${c.column_name}"`).join(", ");
      const BATCH_SIZE = 100;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const valuesList = batch
          .map((r: any) => {
            const vals = cols.map((c: any) => escapeSqlVal(r[c.column_name]));
            return `(${vals.join(", ")})`;
          })
          .join(",\n");

        sql += `INSERT INTO "${t}" (${colNames}) VALUES\n${valuesList};\n`;
      }
      sql += `\n`;
    }
  }

  sql += `-- Restaura verificacao de chaves e conclui transacao\n`;
  sql += `SET session_replication_role = 'DEFAULT';\n\n`;
  sql += `COMMIT;\n`;
  sql += `-- =================== FIM DO DUMP NEON ===================\n`;

  const cwd = process.cwd();
  const sqlPath = path.join(cwd, "neon_database_dump.sql");
  const sqlGzPath = path.join(cwd, "neon_database_dump.sql.gz");
  const jsonPath = path.join(cwd, "neon_database_dump.json");
  const jsonGzPath = path.join(cwd, "neon_database_dump.json.gz");

  fs.writeFileSync(sqlPath, sql, "utf-8");
  fs.writeFileSync(jsonPath, JSON.stringify(jsonDump, null, 2), "utf-8");

  // Compress gzip
  const sqlBuffer = Buffer.from(sql, "utf-8");
  const sqlGz = zlib.gzipSync(sqlBuffer, { level: 9 });
  fs.writeFileSync(sqlGzPath, sqlGz);

  const jsonBuffer = Buffer.from(JSON.stringify(jsonDump), "utf-8");
  const jsonGz = zlib.gzipSync(jsonBuffer, { level: 9 });
  fs.writeFileSync(jsonGzPath, jsonGz);

  return {
    success: true,
    totalRows: totalRowsAcrossAll,
    totalTables: tables.length,
    durationMs: Date.now() - start,
    generatedAt: timestamp,
  };
}
