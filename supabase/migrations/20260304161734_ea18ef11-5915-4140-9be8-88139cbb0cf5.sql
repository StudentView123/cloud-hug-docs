-- Explicitly deny direct client access to received_emails until ownership/access rules are defined
CREATE POLICY "No direct select access to received emails"
ON public.received_emails
FOR SELECT
USING (false);

CREATE POLICY "No direct insert access to received emails"
ON public.received_emails
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct update access to received emails"
ON public.received_emails
FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct delete access to received emails"
ON public.received_emails
FOR DELETE
USING (false);