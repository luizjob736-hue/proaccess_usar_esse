import { db } from "./client";
import { getNeonPool } from "@/lib/neon-server";

export const dbAdmin = {
  ...db,
  auth: {
    ...db.auth,
    admin: {
      async createUser(params: {
        email: string;
        password?: string;
        email_confirm?: boolean;
        user_metadata?: any;
      }) {
        let client: any = null;
        try {
          const pool = await getNeonPool();
          client = await pool.connect();
          await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
          const pass = params.password || "123456";
          const res = await client.query(
            `INSERT INTO auth.users (
               id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
               raw_user_meta_data, created_at, updated_at
             ) VALUES (
               gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
               $1, crypt($2, gen_salt('bf')), NOW(), $3, NOW(), NOW()
             ) RETURNING id, email`,
            [params.email, pass, JSON.stringify(params.user_metadata || {})],
          );

          const uid = res.rows[0].id;
          const nome = params.user_metadata?.nome || params.email.split("@")[0];
          const senhaAlterada = params.user_metadata?.senha_alterada ?? false;

          await client.query(
            `INSERT INTO public.profiles (id, nome, email, senha_alterada)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, email = EXCLUDED.email`,
            [uid, nome, params.email, senhaAlterada],
          );

          return { data: { user: { id: uid, email: params.email } }, error: null };
        } catch (err: any) {
          console.error("Error creating user in Neon:", err);
          return { data: null, error: { message: err.message } };
        } finally {
          if (client) {
            try {
              client.release();
            } catch (_err) {
              // ignore release error
            }
          }
        }
      },

      async updateUserById(userId: string, params: { password?: string }) {
        let client: any = null;
        try {
          const pool = await getNeonPool();
          client = await pool.connect();
          if (params.password) {
            await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
            await client.query(
              `UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf')), updated_at = NOW() WHERE id = $2`,
              [params.password, userId],
            );
          }
          return { data: { user: { id: userId } }, error: null };
        } catch (err: any) {
          console.error("Error updating user in Neon:", err);
          return { data: null, error: { message: err.message } };
        } finally {
          if (client) {
            try {
              client.release();
            } catch (_err) {
              // ignore release error
            }
          }
        }
      },
    },
  },
};
