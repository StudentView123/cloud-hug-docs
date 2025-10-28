-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can update reviews for their locations" ON public.reviews;

-- Allow users to UPDATE reviews for their own locations
-- Mirrors existing SELECT/INSERT policy
CREATE POLICY "Users can update reviews for their locations"
ON public.reviews
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.locations
    WHERE locations.id = reviews.location_id
      AND locations.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.locations
    WHERE locations.id = reviews.location_id
      AND locations.user_id = auth.uid()
  )
);