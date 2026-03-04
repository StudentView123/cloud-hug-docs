-- Create dedicated Google Business connection table
CREATE TABLE IF NOT EXISTS public.google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  connection_status TEXT NOT NULL DEFAULT 'connected',
  google_account_email TEXT,
  google_account_name TEXT,
  google_account_picture_url TEXT,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT google_connections_user_provider_key UNIQUE (user_id, provider)
);

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Google connection"
ON public.google_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Google connection"
ON public.google_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Google connection"
ON public.google_connections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Google connection"
ON public.google_connections
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_google_connections_user_id ON public.google_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_google_connections_status ON public.google_connections(connection_status);

CREATE TRIGGER update_google_connections_updated_at
BEFORE UPDATE ON public.google_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill from profiles for existing users
INSERT INTO public.google_connections (
  user_id,
  provider,
  connection_status,
  access_token,
  refresh_token,
  token_expires_at,
  scopes,
  created_at,
  updated_at
)
SELECT
  p.id,
  'google',
  CASE
    WHEN p.google_refresh_token IS NOT NULL OR p.google_access_token IS NOT NULL THEN 'connected'
    ELSE 'disconnected'
  END,
  p.google_access_token,
  p.google_refresh_token,
  p.token_expires_at,
  ARRAY[]::TEXT[],
  now(),
  now()
FROM public.profiles p
WHERE p.google_refresh_token IS NOT NULL OR p.google_access_token IS NOT NULL
ON CONFLICT (user_id, provider) DO NOTHING;

-- Lock down inbox table explicitly until ownership model is defined
ALTER TABLE public.received_emails ENABLE ROW LEVEL SECURITY;