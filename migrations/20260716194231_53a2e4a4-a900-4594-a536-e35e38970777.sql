
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin_master','admin','analista','supervisor','consulta');
CREATE TYPE public.colab_status AS ENUM ('ativo','ferias','afastado','inativo','desligado');
CREATE TYPE public.acesso_status AS ENUM ('pendente','ativo','suspenso','exclusao_pendente','excluido');
CREATE TYPE public.pendencia_status AS ENUM ('backlog','em_analise','em_andamento','aguardando','concluido','cancelado');
CREATE TYPE public.pendencia_prioridade AS ENUM ('baixa','media','alta','critica');
CREATE TYPE public.pendencia_tipo AS ENUM ('solicitacao_acesso','exclusao_acesso','revisao','alteracao','outro');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  senha_alterada BOOLEAN NOT NULL DEFAULT false,
  ultimo_login TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin_master','admin'));
$$;

CREATE OR REPLACE FUNCTION public.can_write(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin_master','admin','analista'));
$$;

-- ============ OPERAÇÕES ============
CREATE TABLE public.operacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacoes TO authenticated;
GRANT ALL ON public.operacoes TO service_role;
ALTER TABLE public.operacoes ENABLE ROW LEVEL SECURITY;

-- ============ COLABORADORES ============
CREATE TABLE public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  matricula TEXT UNIQUE,
  email TEXT,
  telefone TEXT,
  cargo TEXT,
  operacao_id UUID REFERENCES public.operacoes(id) ON DELETE SET NULL,
  status colab_status NOT NULL DEFAULT 'ativo',
  admissao_em DATE,
  desligamento_em DATE,
  gestor_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  observacoes TEXT,
  foto_url TEXT,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_colab_status ON public.colaboradores(status);
CREATE INDEX idx_colab_operacao ON public.colaboradores(operacao_id);
CREATE INDEX idx_colab_nome ON public.colaboradores(nome);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaboradores TO authenticated;
GRANT ALL ON public.colaboradores TO service_role;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

-- Colaborador favorito (por usuário)
CREATE TABLE public.colaborador_favoritos (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, colaborador_id)
);
GRANT SELECT, INSERT, DELETE ON public.colaborador_favoritos TO authenticated;
GRANT ALL ON public.colaborador_favoritos TO service_role;
ALTER TABLE public.colaborador_favoritos ENABLE ROW LEVEL SECURITY;

-- ============ SISTEMAS ============
CREATE TABLE public.sistemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  categoria TEXT,
  criticidade TEXT NOT NULL DEFAULT 'media',
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistemas TO authenticated;
GRANT ALL ON public.sistemas TO service_role;
ALTER TABLE public.sistemas ENABLE ROW LEVEL SECURITY;

-- Perfis de acesso por sistema
CREATE TABLE public.perfis_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sistema_id UUID NOT NULL REFERENCES public.sistemas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sistema_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis_acesso TO authenticated;
GRANT ALL ON public.perfis_acesso TO service_role;
ALTER TABLE public.perfis_acesso ENABLE ROW LEVEL SECURITY;

-- ============ ACESSOS ============
CREATE TABLE public.acessos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  sistema_id UUID NOT NULL REFERENCES public.sistemas(id) ON DELETE CASCADE,
  perfil_acesso_id UUID REFERENCES public.perfis_acesso(id) ON DELETE SET NULL,
  status acesso_status NOT NULL DEFAULT 'pendente',
  login TEXT,
  concedido_em TIMESTAMPTZ,
  concedido_por UUID REFERENCES auth.users(id),
  expira_em DATE,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_acessos_colab ON public.acessos(colaborador_id);
CREATE INDEX idx_acessos_sistema ON public.acessos(sistema_id);
CREATE INDEX idx_acessos_status ON public.acessos(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acessos TO authenticated;
GRANT ALL ON public.acessos TO service_role;
ALTER TABLE public.acessos ENABLE ROW LEVEL SECURITY;

-- ============ PENDÊNCIAS (Kanban) ============
CREATE TABLE public.pendencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo pendencia_tipo NOT NULL DEFAULT 'outro',
  status pendencia_status NOT NULL DEFAULT 'backlog',
  prioridade pendencia_prioridade NOT NULL DEFAULT 'media',
  colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  sistema_id UUID REFERENCES public.sistemas(id) ON DELETE SET NULL,
  acesso_id UUID REFERENCES public.acessos(id) ON DELETE SET NULL,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES auth.users(id),
  sla_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  etiquetas TEXT[] NOT NULL DEFAULT '{}',
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  posicao INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pend_status ON public.pendencias(status);
CREATE INDEX idx_pend_resp ON public.pendencias(responsavel_id);
CREATE INDEX idx_pend_prio ON public.pendencias(prioridade);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pendencias TO authenticated;
GRANT ALL ON public.pendencias TO service_role;
ALTER TABLE public.pendencias ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pendencia_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pendencia_id UUID NOT NULL REFERENCES public.pendencias(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pendencia_comentarios TO authenticated;
GRANT ALL ON public.pendencia_comentarios TO service_role;
ALTER TABLE public.pendencia_comentarios ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pendencia_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pendencia_id UUID NOT NULL REFERENCES public.pendencias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  tamanho INTEGER,
  mime TEXT,
  enviado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pendencia_anexos TO authenticated;
GRANT ALL ON public.pendencia_anexos TO service_role;
ALTER TABLE public.pendencia_anexos ENABLE ROW LEVEL SECURITY;

-- ============ HISTÓRICO (imutável) ============
CREATE TABLE public.historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID,
  acao TEXT NOT NULL,
  ator_id UUID REFERENCES auth.users(id),
  dados_antes JSONB,
  dados_depois JSONB,
  descricao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hist_entidade ON public.historico(entidade, entidade_id);
CREATE INDEX idx_hist_criado ON public.historico(criado_em DESC);
GRANT SELECT, INSERT ON public.historico TO authenticated;
GRANT ALL ON public.historico TO service_role;
ALTER TABLE public.historico ENABLE ROW LEVEL SECURITY;

-- ============ LOGS DE AUDITORIA ============
CREATE TABLE public.logs_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento TEXT NOT NULL,
  ator_id UUID REFERENCES auth.users(id),
  ip TEXT,
  user_agent TEXT,
  meta JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.logs_auditoria TO authenticated;
GRANT ALL ON public.logs_auditoria TO service_role;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICAÇÕES ============
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  corpo TEXT,
  tipo TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_dest ON public.notificacoes(destinatario_id, lida);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- ============ LIXEIRA ============
CREATE TABLE public.lixeira (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  snapshot JSONB NOT NULL,
  excluido_por UUID REFERENCES auth.users(id),
  excluido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.lixeira TO authenticated;
GRANT ALL ON public.lixeira TO service_role;
ALTER TABLE public.lixeira ENABLE ROW LEVEL SECURITY;

-- ============ CHAT IA ============
CREATE TABLE public.ia_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT 'Nova conversa',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_conversas TO authenticated;
GRANT ALL ON public.ia_conversas TO service_role;
ALTER TABLE public.ia_conversas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ia_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.ia_conversas(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ia_msg_conv ON public.ia_mensagens(conversa_id, criado_em);
GRANT SELECT, INSERT, DELETE ON public.ia_mensagens TO authenticated;
GRANT ALL ON public.ia_mensagens TO service_role;
ALTER TABLE public.ia_mensagens ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- profiles
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR id = auth.uid());
CREATE POLICY "profiles_delete_master" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin_master'));

-- user_roles
CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "roles_manage_master" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin_master')) WITH CHECK (public.has_role(auth.uid(),'admin_master'));

-- operacoes
CREATE POLICY "op_select_auth" ON public.operacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "op_write_admin" ON public.operacoes FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- colaboradores
CREATE POLICY "colab_select_auth" ON public.colaboradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "colab_write" ON public.colaboradores FOR ALL TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));

-- favoritos (só o próprio user)
CREATE POLICY "fav_own" ON public.colaborador_favoritos FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- sistemas
CREATE POLICY "sis_select_auth" ON public.sistemas FOR SELECT TO authenticated USING (true);
CREATE POLICY "sis_write" ON public.sistemas FOR ALL TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));

-- perfis_acesso
CREATE POLICY "perf_select_auth" ON public.perfis_acesso FOR SELECT TO authenticated USING (true);
CREATE POLICY "perf_write" ON public.perfis_acesso FOR ALL TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));

-- acessos
CREATE POLICY "acc_select_auth" ON public.acessos FOR SELECT TO authenticated USING (true);
CREATE POLICY "acc_write" ON public.acessos FOR ALL TO authenticated USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));

-- pendencias
CREATE POLICY "pen_select_auth" ON public.pendencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "pen_write" ON public.pendencias FOR ALL TO authenticated USING (public.can_write(auth.uid()) OR responsavel_id = auth.uid()) WITH CHECK (public.can_write(auth.uid()) OR responsavel_id = auth.uid());

-- comentarios
CREATE POLICY "com_select_auth" ON public.pendencia_comentarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "com_insert_auth" ON public.pendencia_comentarios FOR INSERT TO authenticated WITH CHECK (autor_id = auth.uid());
CREATE POLICY "com_update_own" ON public.pendencia_comentarios FOR UPDATE TO authenticated USING (autor_id = auth.uid());
CREATE POLICY "com_delete_own_or_admin" ON public.pendencia_comentarios FOR DELETE TO authenticated USING (autor_id = auth.uid() OR public.is_admin(auth.uid()));

-- anexos
CREATE POLICY "anx_select_auth" ON public.pendencia_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "anx_write_auth" ON public.pendencia_anexos FOR ALL TO authenticated USING (true) WITH CHECK (enviado_por = auth.uid() OR public.can_write(auth.uid()));

-- historico (imutável: só select+insert; admins veem todos)
CREATE POLICY "hist_select_auth" ON public.historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "hist_insert_auth" ON public.historico FOR INSERT TO authenticated WITH CHECK (true);

-- logs
CREATE POLICY "log_select_admin" ON public.logs_auditoria FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "log_insert_auth" ON public.logs_auditoria FOR INSERT TO authenticated WITH CHECK (true);

-- notificacoes
CREATE POLICY "not_select_own" ON public.notificacoes FOR SELECT TO authenticated USING (destinatario_id = auth.uid());
CREATE POLICY "not_update_own" ON public.notificacoes FOR UPDATE TO authenticated USING (destinatario_id = auth.uid());
CREATE POLICY "not_delete_own" ON public.notificacoes FOR DELETE TO authenticated USING (destinatario_id = auth.uid());
CREATE POLICY "not_insert_auth" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);

-- lixeira
CREATE POLICY "lix_select_admin" ON public.lixeira FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "lix_insert_auth" ON public.lixeira FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lix_delete_admin" ON public.lixeira FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ia
CREATE POLICY "ia_conv_own" ON public.ia_conversas FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ia_msg_own" ON public.ia_mensagens FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.ia_conversas c WHERE c.id = conversa_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM public.ia_conversas c WHERE c.id = conversa_id AND c.user_id = auth.uid()));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em := now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER t_op_upd BEFORE UPDATE ON public.operacoes FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER t_colab_upd BEFORE UPDATE ON public.colaboradores FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER t_sis_upd BEFORE UPDATE ON public.sistemas FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER t_acc_upd BEFORE UPDATE ON public.acessos FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER t_pen_upd BEFORE UPDATE ON public.pendencias FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER t_ia_conv_upd BEFORE UPDATE ON public.ia_conversas FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Handle new user - cria profile
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, nome, email, senha_alterada)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'senha_alterada')::boolean, true)
  ) ON CONFLICT (id) DO NOTHING;
  -- por padrão, novo usuário é 'consulta'
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'consulta')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Histórico automático genérico
CREATE OR REPLACE FUNCTION public.tg_log_historico() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ator UUID; v_id UUID;
BEGIN
  v_ator := auth.uid();
  v_id := COALESCE((NEW).id, (OLD).id);
  INSERT INTO public.historico(entidade, entidade_id, acao, ator_id, dados_antes, dados_depois)
  VALUES (TG_TABLE_NAME, v_id, TG_OP, v_ator,
          CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP IN ('UPDATE','INSERT') THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER h_colab AFTER INSERT OR UPDATE OR DELETE ON public.colaboradores FOR EACH ROW EXECUTE FUNCTION public.tg_log_historico();
CREATE TRIGGER h_sis AFTER INSERT OR UPDATE OR DELETE ON public.sistemas FOR EACH ROW EXECUTE FUNCTION public.tg_log_historico();
CREATE TRIGGER h_acc AFTER INSERT OR UPDATE OR DELETE ON public.acessos FOR EACH ROW EXECUTE FUNCTION public.tg_log_historico();
CREATE TRIGGER h_pen AFTER INSERT OR UPDATE OR DELETE ON public.pendencias FOR EACH ROW EXECUTE FUNCTION public.tg_log_historico();

-- Automação: desligamento gera pendências de exclusão
CREATE OR REPLACE FUNCTION public.tg_colab_desligamento() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.status = 'desligado' AND (OLD.status IS DISTINCT FROM 'desligado') THEN
    FOR r IN SELECT a.id, a.sistema_id, s.nome AS sistema_nome
             FROM public.acessos a JOIN public.sistemas s ON s.id=a.sistema_id
             WHERE a.colaborador_id = NEW.id AND a.status IN ('ativo','pendente','suspenso') LOOP
      UPDATE public.acessos SET status='exclusao_pendente', atualizado_em=now() WHERE id=r.id;
      INSERT INTO public.pendencias(titulo, descricao, tipo, prioridade, colaborador_id, sistema_id, acesso_id)
      VALUES ('Excluir acesso: '||r.sistema_nome,
              'Colaborador desligado. Remover acesso ao sistema '||r.sistema_nome,
              'exclusao_acesso','alta', NEW.id, r.sistema_id, r.id);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER t_colab_desligamento AFTER UPDATE ON public.colaboradores FOR EACH ROW EXECUTE FUNCTION public.tg_colab_desligamento();

-- ============ SEED: Admin Master ============
DO $$
DECLARE v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email='admin@proacess.local' LIMIT 1;
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users(id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
      'admin@proacess.local',
      crypt('JediForever06', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nome":"Administrador Master","senha_alterada":false}'::jsonb,
      now(), now(),'','','','');
    INSERT INTO auth.identities(id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id, v_user_id::text,
            jsonb_build_object('sub', v_user_id::text, 'email','admin@proacess.local'),
            'email', now(), now(), now());
  END IF;
  -- Garantir profile e role
  INSERT INTO public.profiles(id, nome, email, senha_alterada)
  VALUES (v_user_id, 'Administrador Master','admin@proacess.local', false)
  ON CONFLICT (id) DO UPDATE SET senha_alterada=false;
  DELETE FROM public.user_roles WHERE user_id=v_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (v_user_id, 'admin_master');
END $$;
