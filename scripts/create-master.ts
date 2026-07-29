import pg from "pg";

const NEON_URL =
  "postgresql://neondb_owner:npg_yfSCO5GNgd1n@ep-sweet-sea-ayco0rx7-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const connectionString =
  process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres")
    ? process.env.DATABASE_URL
    : NEON_URL;

async function createMasterUser() {
  console.log("Conectando ao banco Neon para criar o usuário master...");
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const email = "luiz.reis@proacess.local";
    const username = "Luiz.Reis";
    const password = "LuizReis&%2026";
    const nome = "Luiz Reis (Master)";

    console.log(`Criando/Atualizando usuário master: ${username} (${email})...`);

    await client.query(`
      DO $$
      DECLARE
        v_user_id UUID;
      BEGIN
        SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower('${email}') OR raw_user_meta_data->>'username' = '${username}' LIMIT 1;
        
        IF v_user_id IS NULL THEN
          v_user_id := gen_random_uuid();
          INSERT INTO auth.users(
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, email_change, email_change_token_new, recovery_token
          )
          VALUES (
            v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            '${email}',
            crypt('${password}', gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"nome":"${nome}", "username":"${username}", "senha_alterada": true}'::jsonb,
            now(), now(), '', '', '', ''
          );

          INSERT INTO auth.identities(id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
          VALUES (
            gen_random_uuid(), v_user_id, v_user_id::text,
            jsonb_build_object('sub', v_user_id::text, 'email', '${email}'),
            'email', now(), now(), now()
          );
        ELSE
          UPDATE auth.users
          SET encrypted_password = crypt('${password}', gen_salt('bf')),
              raw_user_meta_data = jsonb_build_object('nome', '${nome}', 'username', '${username}', 'senha_alterada', true),
              updated_at = now()
          WHERE id = v_user_id;
        END IF;

        -- Perfil
        INSERT INTO public.profiles(id, nome, email, senha_alterada)
        VALUES (v_user_id, '${nome}', '${email}', true)
        ON CONFLICT (id) DO UPDATE SET nome = '${nome}', email = '${email}', senha_alterada = true;

        -- Role admin_master
        DELETE FROM public.user_roles WHERE user_id = v_user_id;
        INSERT INTO public.user_roles(user_id, role) VALUES (v_user_id, 'admin_master');

      END $$;
    `);

    console.log("Usuário master 'Luiz.Reis' criado/atualizado com sucesso!");
  } finally {
    await client.end();
  }
}

createMasterUser().catch((err) => {
  console.error("Erro ao criar usuário master:", err);
  process.exit(1);
});
