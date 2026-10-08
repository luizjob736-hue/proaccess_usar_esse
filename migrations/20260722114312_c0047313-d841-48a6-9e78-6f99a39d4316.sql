
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS inativado_em TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.tg_colab_inativado_em()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('inativo','desligado') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.inativado_em := COALESCE(NEW.inativado_em, now());
  ELSIF NEW.status = 'ativo' AND OLD.status IN ('inativo','desligado') THEN
    NEW.inativado_em := NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_colab_inativado_em ON public.colaboradores;
CREATE TRIGGER trg_colab_inativado_em BEFORE UPDATE ON public.colaboradores
FOR EACH ROW EXECUTE FUNCTION public.tg_colab_inativado_em();

UPDATE public.colaboradores SET inativado_em = COALESCE(desligamento_em, atualizado_em, now())
WHERE status IN ('inativo','desligado') AND inativado_em IS NULL;

INSERT INTO public.lista_acessos (titulo, posicao, colunas, linhas)
SELECT 'Sistemas por Operação', 0,
  '["AMIGOZ","RETENÇÃO","PINE","EMPRÉSTIMOS/HAPPY"]'::jsonb,
  '[
    ["CONDUCTOR/CS LIGHT","CONDUCTOR","FUNÇÃO","ZILICRED"],
    ["SICLO","SICLO","AGX","CELLCOIN"],
    ["AMIGOZ BACKOFFICE","AMIGOZ BACKOFFICE","HAPPY BACKOFFICE","HAPPY BACKOFFICE"],
    ["NUVIDEO","NUVIDEO","NUVIDEO","NUVIDEO"],
    ["-","AMIGOZ CONSIG/FRONT","-","BACKOFFICE BYX"]
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.lista_acessos);

INSERT INTO public.lista_acessos (titulo, posicao, colunas, linhas)
SELECT 'Departamentos NUVIDIO', 1,
  '["AMIGOZ","RETENÇÃO","PINE","EMPRÉSTIMOS/HAPPY"]'::jsonb,
  '[["Validação de Biometria","Retenção","Pine - Validação biométrica","Confirmação de dados - Empréstimo"]]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.lista_acessos WHERE titulo = 'Departamentos NUVIDIO');
