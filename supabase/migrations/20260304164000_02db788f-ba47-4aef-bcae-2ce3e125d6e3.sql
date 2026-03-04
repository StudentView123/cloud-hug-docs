CREATE POLICY "System can update webhook deliveries"
ON public.webhook_deliveries
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);