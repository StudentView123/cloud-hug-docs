-- Webhook subscriptions for outbound event delivery
CREATE TABLE public.webhook_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  target_url TEXT NOT NULL,
  signing_secret_hash TEXT NOT NULL,
  signing_secret_hint TEXT NOT NULL,
  subscribed_events TEXT[] NOT NULL DEFAULT ARRAY['review.created','reply.status_changed']::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at TIMESTAMPTZ NULL,
  last_success_at TIMESTAMPTZ NULL,
  last_failure_at TIMESTAMPTZ NULL,
  last_failure_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT webhook_endpoints_target_url_http_chk CHECK (target_url ~ '^https?://')
);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhook endpoints"
ON public.webhook_endpoints
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhook endpoints"
ON public.webhook_endpoints
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook endpoints"
ON public.webhook_endpoints
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhook endpoints"
ON public.webhook_endpoints
FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_webhook_endpoints_updated_at
BEFORE UPDATE ON public.webhook_endpoints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.webhook_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_id UUID NOT NULL DEFAULT gen_random_uuid(),
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  response_status INTEGER NULL,
  response_body TEXT NULL,
  delivered_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhook deliveries"
ON public.webhook_deliveries
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert webhook deliveries"
ON public.webhook_deliveries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_webhook_endpoints_user_id ON public.webhook_endpoints(user_id);
CREATE INDEX idx_webhook_endpoints_active_events ON public.webhook_endpoints(user_id, is_active);
CREATE INDEX idx_webhook_deliveries_endpoint_id_created_at ON public.webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_user_id_created_at ON public.webhook_deliveries(user_id, created_at DESC);