import pg from "pg";
import fs from "fs";
import path from "path";

const NEON_URL =
  "postgresql://neondb_owner:npg_yfSCO5GNgd1n@ep-sweet-sea-ayco0rx7-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || NEON_URL;

async function main() {
  console.log("Connecting to Neon database...");
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected successfully!");

  try {
    console.log("Setting up base schemas, extensions, and roles...");
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      DROP SCHEMA IF EXISTS auth CASCADE;
      DROP SCHEMA IF EXISTS storage CASCADE;

      CREATE SCHEMA auth;
      CREATE SCHEMA storage;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
      END
      $$;

      CREATE TABLE auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID,
        aud VARCHAR(255),
        role VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        encrypted_password VARCHAR(255),
        email_confirmed_at TIMESTAMPTZ,
        invited_at TIMESTAMPTZ,
        confirmation_token VARCHAR(255),
        confirmation_sent_at TIMESTAMPTZ,
        recovery_token VARCHAR(255),
        recovery_sent_at TIMESTAMPTZ,
        email_change_token_new VARCHAR(255),
        email_change VARCHAR(255),
        email_change_sent_at TIMESTAMPTZ,
        last_sign_in_at TIMESTAMPTZ,
        raw_app_meta_data JSONB,
        raw_user_meta_data JSONB,
        is_super_admin BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        phone TEXT,
        phone_confirmed_at TIMESTAMPTZ,
        phone_change TEXT,
        phone_change_token VARCHAR(255),
        phone_change_sent_at TIMESTAMPTZ,
        email_change_token_current VARCHAR(255),
        email_change_confirm_status SMALLINT,
        banned_until TIMESTAMPTZ,
        reauthentication_token VARCHAR(255),
        reauthentication_sent_at TIMESTAMPTZ,
        is_sso_user BOOLEAN DEFAULT false,
        deleted_at TIMESTAMPTZ,
        is_anonymous BOOLEAN DEFAULT false
      );

      CREATE TABLE auth.identities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        identity_data JSONB NOT NULL,
        provider TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        last_sign_in_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );

      CREATE TABLE storage.buckets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        public BOOLEAN DEFAULT false,
        avif_autodetection BOOLEAN DEFAULT false,
        file_size_limit BIGINT,
        allowed_mime_types TEXT[]
      );

      CREATE TABLE storage.objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id TEXT REFERENCES storage.buckets(id),
        name TEXT,
        owner UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        last_accessed_at TIMESTAMPTZ DEFAULT now(),
        metadata JSONB
      );

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT COALESCE(
          NULLIF(current_setting('request.jwt.claim.sub', true), ''),
          '00000000-0000-0000-0000-000000000000'
        )::uuid;
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS jsonb LANGUAGE sql STABLE AS $$
        SELECT '{}'::jsonb;
      $$;
    `);

    // 2. Read all migration files in order
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      console.log(`Executing migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      try {
        await client.query(sql);
        console.log(`Successfully executed ${file}`);
      } catch (err: any) {
        console.error(`Error executing ${file}:`, err.message);
      }
    }

    console.log("Migration completed!");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
