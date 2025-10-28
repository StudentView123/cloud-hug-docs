-- Add review_name column to store the full Google API review path
ALTER TABLE public.reviews 
ADD COLUMN review_name text;