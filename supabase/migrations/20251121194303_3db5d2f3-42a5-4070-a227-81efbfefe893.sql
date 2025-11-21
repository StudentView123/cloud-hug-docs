-- Create promo_codes table
CREATE TABLE promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  credit_amount integer NOT NULL,
  max_uses integer,
  current_uses integer DEFAULT 0,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  description text
);

-- Create case-insensitive unique index for code lookups
CREATE UNIQUE INDEX promo_codes_code_upper_idx ON promo_codes (UPPER(code));

-- Enable RLS on promo_codes
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view active promo codes
CREATE POLICY "Authenticated users can view active promo codes"
ON promo_codes
FOR SELECT
TO authenticated
USING (is_active = true);

-- Create promo_redemptions table
CREATE TABLE promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  promo_code_id uuid REFERENCES promo_codes(id) ON DELETE CASCADE NOT NULL,
  credits_awarded integer NOT NULL,
  redeemed_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, promo_code_id)
);

-- Enable RLS on promo_redemptions
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own redemptions
CREATE POLICY "Users can view their own redemptions"
ON promo_redemptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: System can insert redemptions
CREATE POLICY "System can insert redemptions"
ON promo_redemptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Insert initial "TRIAL" promo code (3 free credits)
INSERT INTO promo_codes (code, credit_amount, description)
VALUES ('TRIAL', 3, 'Trial promo - 3 free credits for new users');