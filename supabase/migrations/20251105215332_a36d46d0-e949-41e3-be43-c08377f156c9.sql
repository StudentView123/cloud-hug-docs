-- Create training examples table
CREATE TABLE training_examples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  reply_content TEXT NOT NULL,
  review_rating INTEGER NOT NULL,
  review_text TEXT,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Create quick reply templates table
CREATE TABLE quick_reply_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating_min INTEGER NOT NULL CHECK (rating_min >= 1 AND rating_min <= 5),
  rating_max INTEGER NOT NULL CHECK (rating_max >= 1 AND rating_max <= 5),
  template_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_rating_range CHECK (rating_min <= rating_max)
);

-- Track recent usage to avoid repetition
CREATE TABLE quick_reply_usage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES quick_reply_templates(id) ON DELETE CASCADE,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE training_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_reply_usage_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_examples
CREATE POLICY "Users manage own training examples" ON training_examples
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for quick_reply_templates
CREATE POLICY "Users manage own templates" ON quick_reply_templates
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for usage history
CREATE POLICY "Users view own usage history" ON quick_reply_usage_history
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_training_examples_user_sentiment ON training_examples(user_id, sentiment, is_active);
CREATE INDEX idx_quick_templates_user_rating ON quick_reply_templates(user_id, rating_min, rating_max, is_active);
CREATE INDEX idx_usage_history_recent ON quick_reply_usage_history(user_id, used_at DESC);

-- Add reply_style_settings to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reply_style_settings JSONB DEFAULT '{
    "formality": "professional",
    "length": "concise",
    "personality": "friendly",
    "custom_instructions": "",
    "avoid_phrases": [],
    "variation_strength": "high"
  }'::jsonb;