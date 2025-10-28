-- Drop the redundant review_name column since google_review_id already contains the full API path
ALTER TABLE reviews DROP COLUMN IF EXISTS review_name;