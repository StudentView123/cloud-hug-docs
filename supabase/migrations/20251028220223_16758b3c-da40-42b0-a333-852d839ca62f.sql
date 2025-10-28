-- Add archived and has_google_reply columns to reviews table
ALTER TABLE reviews 
ADD COLUMN archived boolean DEFAULT false,
ADD COLUMN has_google_reply boolean DEFAULT false;

-- Add indexes for performance
CREATE INDEX idx_reviews_archived ON reviews(archived);
CREATE INDEX idx_reviews_has_google_reply ON reviews(has_google_reply);

-- Archive existing reviews that have local replies marked as posted
UPDATE reviews 
SET archived = true 
WHERE id IN (
  SELECT DISTINCT review_id 
  FROM replies 
  WHERE status = 'posted'
);