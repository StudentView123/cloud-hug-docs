-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table to store user info and Google tokens
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create locations table for Google Business locations
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  rating DECIMAL(2,1),
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, google_location_id)
);

-- Create reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  google_review_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_photo_url TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  review_created_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(google_review_id)
);

-- Create replies table
CREATE TABLE public.replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'posted')) DEFAULT 'draft',
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  review_id UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Locations policies
CREATE POLICY "Users can view their own locations"
  ON public.locations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own locations"
  ON public.locations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own locations"
  ON public.locations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own locations"
  ON public.locations FOR DELETE
  USING (auth.uid() = user_id);

-- Reviews policies
CREATE POLICY "Users can view reviews for their locations"
  ON public.reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.locations
      WHERE locations.id = reviews.location_id
      AND locations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reviews for their locations"
  ON public.reviews FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.locations
      WHERE locations.id = reviews.location_id
      AND locations.user_id = auth.uid()
    )
  );

-- Replies policies
CREATE POLICY "Users can view their own replies"
  ON public.replies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own replies"
  ON public.replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own replies"
  ON public.replies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replies"
  ON public.replies FOR DELETE
  USING (auth.uid() = user_id);

-- Activity logs policies
CREATE POLICY "Users can view their own activity logs"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_replies_updated_at
  BEFORE UPDATE ON public.replies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();