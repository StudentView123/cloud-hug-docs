ALTER TABLE public.webhook_endpoints
ADD COLUMN signing_secret TEXT;

UPDATE public.webhook_endpoints
SET signing_secret = signing_secret_hint
WHERE signing_secret IS NULL;

ALTER TABLE public.webhook_endpoints
ALTER COLUMN signing_secret SET NOT NULL;