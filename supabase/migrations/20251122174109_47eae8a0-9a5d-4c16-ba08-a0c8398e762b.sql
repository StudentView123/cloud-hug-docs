-- Create feedback_submissions table for simple feedback logging
CREATE TABLE public.feedback_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone (authenticated or not) to insert feedback
CREATE POLICY "Anyone can submit feedback"
ON public.feedback_submissions
FOR INSERT
TO public
WITH CHECK (true);

-- Users can view their own submissions if authenticated
CREATE POLICY "Users can view their own feedback"
ON public.feedback_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_feedback_user_id ON public.feedback_submissions(user_id);
CREATE INDEX idx_feedback_created_at ON public.feedback_submissions(created_at DESC);