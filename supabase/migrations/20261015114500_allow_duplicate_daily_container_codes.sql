-- Container display codes are date-based and may repeat when multiple
-- operational containers are created on the same day. The UUID primary key
-- remains the unique identifier for each container.
ALTER TABLE public.contenedores DROP CONSTRAINT IF EXISTS contenedores_codigo_key;
ALTER TABLE public.contenedores DROP CONSTRAINT IF EXISTS contenedores_codigo_unique;
DROP INDEX IF EXISTS public.contenedores_codigo_key;
DROP INDEX IF EXISTS public.contenedores_codigo_unique;
CREATE INDEX IF NOT EXISTS contenedores_codigo_idx ON public.contenedores (codigo);
