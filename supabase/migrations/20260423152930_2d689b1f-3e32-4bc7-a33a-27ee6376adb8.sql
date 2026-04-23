ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS dispute_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dispute_notes text,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_dispute_status_check
  CHECK (dispute_status IN ('none', 'flagged', 'resolved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_reviews_dispute_status ON public.reviews(dispute_status) WHERE dispute_status <> 'none';
CREATE INDEX IF NOT EXISTS idx_reviews_rating_created ON public.reviews(rating, review_created_at DESC);