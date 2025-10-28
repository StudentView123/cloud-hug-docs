-- Add columns to store Google reply information
ALTER TABLE reviews 
ADD COLUMN google_reply_content text,
ADD COLUMN google_reply_time timestamp with time zone;