
-- Pendências: data_inicio / data_resolucao explícitas e editáveis
ALTER TABLE public.pendencias
  ADD COLUMN IF NOT EXISTS data_inicio timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS data_resolucao timestamptz;

-- Preenche resolução ao concluir; e ao reabrir, limpa
CREATE OR REPLACE FUNCTION public.tg_pend_resolucao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluido' AND NEW.data_resolucao IS NULL THEN
    NEW.data_resolucao := now();
    IF NEW.concluido_em IS NULL THEN NEW.concluido_em := NEW.data_resolucao; END IF;
  ELSIF NEW.status <> 'concluido' AND (OLD.status = 'concluido') THEN
    NEW.data_resolucao := NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS t_pend_resolucao ON public.pendencias;
CREATE TRIGGER t_pend_resolucao BEFORE INSERT OR UPDATE ON public.pendencias
FOR EACH ROW EXECUTE FUNCTION public.tg_pend_resolucao();

-- Lista de acessos editável (documento JSON versionável)
CREATE TABLE IF NOT EXISTS public.lista_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  posicao int NOT NULL DEFAULT 0,
  colunas jsonb NOT NULL DEFAULT '[]'::jsonb,
  linhas  jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lista_acessos TO authenticated;
GRANT ALL ON public.lista_acessos TO service_role;

ALTER TABLE public.lista_acessos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "la_select_auth" ON public.lista_acessos FOR SELECT TO authenticated USING (true);
CREATE POLICY "la_write" ON public.lista_acessos FOR ALL TO authenticated
  USING (public.can_write(auth.uid())) WITH CHECK (public.can_write(auth.uid()));

DROP TRIGGER IF EXISTS t_la_upd ON public.lista_acessos;
CREATE TRIGGER t_la_upd BEFORE UPDATE ON public.lista_acessos
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Seed inicial com dados da imagem
INSERT INTO public.lista_acessos (titulo, posicao, colunas, linhas) VALUES
('Operações e Sistemas', 0,
 '["AMIGOZ","RETENÇÃO","PINE","EMPRÉSTIMOS/HAPPY"]'::jsonb,
 '[
   ["CONDUCTOR/CS LIGHT","CONDUCTOR","FUNÇÃO","ZILICRED"],
   ["SICLO","SICLO","AGX","CELLCOIN"],
   ["AMIGOZ BACKOFFICE","AMIGOZ BACKOFFICE","HAPPY BACKOFFICE","HAPPY BACKOFFICE"],
   ["NUVIDEO","NUVIDEO","NUVIDEO","NUVIDEO"],
   ["-","AMIGOZ CONSIG/FRONT","-","BACKOFFICE BYX"]
 ]'::jsonb),
('Departamentos Nuvidio', 1,
 '["AMIGOZ","RETENÇÃO","PINE","EMPRÉSTIMOS/HAPPY"]'::jsonb,
 '[
   ["Validação de Biometria","Retenção","Pine - Validação biométrica","Confirmação de dados - Empréstimo"]
 ]'::jsonb);
