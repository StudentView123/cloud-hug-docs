-- Add columns to reviews table for tracking rating changes
ALTER TABLE public.reviews
ADD COLUMN rating_history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN last_rating_change_at timestamp with time zone,
ADD COLUMN sentiment_mismatch boolean DEFAULT false;

-- Add column to replies table for flagging reviews that need attention
ALTER TABLE public.replies
ADD COLUMN needs_review boolean DEFAULT false;

-- Create index for faster querying of reviews with sentiment mismatches
CREATE INDEX idx_reviews_sentiment_mismatch ON public.reviews(sentiment_mismatch) WHERE sentiment_mismatch = true;

-- Create index for faster querying of replies that need review
CREATE INDEX idx_replies_needs_review ON public.replies(needs_review) WHERE needs_review = true;