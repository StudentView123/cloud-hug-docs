-- Create table for server-to-server API keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active_user_id ON public.api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON public.api_keys(created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'api_keys' AND policyname = 'Users can view their own api keys'
  ) THEN
    CREATE POLICY "Users can view their own api keys"
    ON public.api_keys
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'api_keys' AND policyname = 'Users can create their own api keys'
  ) THEN
    CREATE POLICY "Users can create their own api keys"
    ON public.api_keys
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'api_keys' AND policyname = 'Users can update their own api keys'
  ) THEN
    CREATE POLICY "Users can update their own api keys"
    ON public.api_keys
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'api_keys' AND policyname = 'Users can delete their own api keys'
  ) THEN
    CREATE POLICY "Users can delete their own api keys"
    ON public.api_keys
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_api_key_last_used(_key_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE key_hash = _key_hash
    AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_api_key(_api_key_id UUID)
RETURNS public.api_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.api_keys;
BEGIN
  UPDATE public.api_keys
  SET revoked_at = COALESCE(revoked_at, now())
  WHERE id = _api_key_id
    AND user_id = auth.uid()
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;