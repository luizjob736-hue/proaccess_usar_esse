CREATE TABLE IF NOT EXISTS public.pendencia_quadros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL DEFAULT 'bg-slate-500',
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pendencia_quadros TO authenticated;
GRANT ALL ON public.pendencia_quadros TO service_role;
ALTER TABLE public.pendencia_quadros ENABLE ROW LEVEL SECURITY;

-- Insert defaults
INSERT INTO public.pendencia_quadros (nome, cor, ordem) VALUES
('PENDENTE', 'bg-slate-500', 1),
('COM ERRO', 'bg-amber-500', 2),
('REDEFINIR SENHA', 'bg-blue-500', 3),
('DESBLOQUEIO', 'bg-emerald-600', 4)
ON CONFLICT (nome) DO NOTHING;

-- Change status column in pendencias to TEXT
ALTER TABLE public.pendencias ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.pendencias ALTER COLUMN status TYPE TEXT USING status::TEXT;
ALTER TABLE public.pendencias ALTER COLUMN status SET DEFAULT 'PENDENTE';

-- Update existing pendencias with old statuses to one of the new ones if needed, or leave as is.
UPDATE public.pendencias SET status = 'PENDENTE' WHERE status = 'backlog';
UPDATE public.pendencias SET status = 'PENDENTE' WHERE status = 'em_analise';
UPDATE public.pendencias SET status = 'PENDENTE' WHERE status = 'em_andamento';
UPDATE public.pendencias SET status = 'PENDENTE' WHERE status = 'aguardando';
UPDATE public.pendencias SET status = 'DESBLOQUEIO' WHERE status = 'concluido';
UPDATE public.pendencias SET status = 'COM ERRO' WHERE status = 'cancelado';
