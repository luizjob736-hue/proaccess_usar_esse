CREATE TABLE IF NOT EXISTS public.backups_pendencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em TIMESTAMPTZ DEFAULT now(),
  data_layout TEXT NOT NULL,
  descricao TEXT NOT NULL,
  tipo TEXT DEFAULT 'manual',
  total_pendencias INTEGER DEFAULT 0,
  sistemas_json JSONB DEFAULT '[]'::jsonb,
  dados_json JSONB DEFAULT '[]'::jsonb
);
