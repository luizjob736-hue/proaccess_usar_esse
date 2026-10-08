ALTER TABLE public.acessos ADD COLUMN IF NOT EXISTS senha text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS email_senha text;