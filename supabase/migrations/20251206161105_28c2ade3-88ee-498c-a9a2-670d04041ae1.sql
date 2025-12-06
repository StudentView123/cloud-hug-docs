-- Create received_emails table for storing incoming emails
CREATE TABLE public.received_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT NOT NULL UNIQUE,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE public.received_emails ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_received_emails_created_at ON public.received_emails(created_at DESC);
CREATE INDEX idx_received_emails_is_read ON public.received_emails(is_read);

-- RLS policy: Only admins can access (for now, using service role in edge function)
-- We'll manage access through the edge function using service role key