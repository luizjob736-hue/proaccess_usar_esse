
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operador';

CREATE TABLE IF NOT EXISTS public.chamados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('erro','desbloqueio','redefinicao_senha')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  sistema_id UUID REFERENCES public.sistemas(id) ON DELETE SET NULL,
  print_url TEXT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_analise','aceito','recusado','concluido')),
  tratador_id UUID REFERENCES auth.users(id),
  resposta TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvido_em TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chamados TO authenticated;
GRANT ALL ON public.chamados TO service_role;

ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chamados_select_own_or_admin" ON public.chamados
  FOR SELECT TO authenticated
  USING (operador_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "chamados_insert_own" ON public.chamados
  FOR INSERT TO authenticated
  WITH CHECK (operador_id = auth.uid());

CREATE POLICY "chamados_update_admin_or_own_open" ON public.chamados
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR (operador_id = auth.uid() AND status = 'aberto'))
  WITH CHECK (public.is_admin(auth.uid()) OR operador_id = auth.uid());

CREATE POLICY "chamados_delete_admin" ON public.chamados
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER chamados_touch BEFORE UPDATE ON public.chamados
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.chamado_comentarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chamado_id UUID NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES auth.users(id),
  mensagem TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.chamado_comentarios TO authenticated;
GRANT ALL ON public.chamado_comentarios TO service_role;

ALTER TABLE public.chamado_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coment_select" ON public.chamado_comentarios
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = chamado_id AND (c.operador_id = auth.uid() OR public.is_admin(auth.uid()))));

CREATE POLICY "coment_insert" ON public.chamado_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chamados c WHERE c.id = chamado_id AND (c.operador_id = auth.uid() OR public.is_admin(auth.uid()))));

CREATE POLICY "coment_delete_own_or_admin" ON public.chamado_comentarios
  FOR DELETE TO authenticated
  USING (autor_id = auth.uid() OR public.is_admin(auth.uid()));
