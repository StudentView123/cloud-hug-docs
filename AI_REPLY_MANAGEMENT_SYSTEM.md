# AI Reply Management System

## Overview

Transform the current hardcoded AI reply generation into a fully customizable system with training examples, preset prompts, phrase control, and template management.

---

## Component 1: Training Examples from Archive

### What it does:
- Adds a "Use as Training Example" button to each archived review/reply
- Stores selected examples in a new `training_examples` table
- Passes these examples to the AI during generation to learn your preferred style

### Database Schema

```sql
CREATE TABLE training_examples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  review_id UUID REFERENCES reviews(id),
  reply_content TEXT NOT NULL,
  review_rating INTEGER NOT NULL,
  review_text TEXT,
  sentiment TEXT NOT NULL, -- 'positive', 'neutral', 'negative'
  notes TEXT, -- User can add why they like this example
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE -- Can temporarily disable examples
);
```

### Archive UI Changes

- Add a ⭐ "Use as Training Example" button to each review card
- Show indicator if already being used as an example
- Add "Manage Training Examples" link to Settings

### Settings UI - New Tab: "AI Style Training"

Features:
- List all selected training examples
- Preview the review and reply side-by-side
- Add/edit notes about what you like ("I like the casual tone here")
- Remove examples
- Enable/disable examples temporarily

---

## Component 2: Quick Reply Template Manager

### What it does:
- Makes the hardcoded star-only responses visible and editable
- Allows adding unlimited variations for each rating tier
- Tracks which variations were used recently to avoid repetition

### Database Schema

```sql
CREATE TABLE quick_reply_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  rating_min INTEGER NOT NULL, -- e.g., 5 for 5-star only
  rating_max INTEGER NOT NULL, -- e.g., 5 for 5-star only
  template_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track recent usage to avoid repetition
CREATE TABLE quick_reply_usage_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  template_id UUID REFERENCES quick_reply_templates(id),
  review_id UUID REFERENCES reviews(id),
  used_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Settings UI - New Tab: "Quick Reply Templates"

Features:
- Sections for each rating tier: "5-Star", "4-Star", "3-Star", "1-2 Star"
- List all templates for each tier
- Add new templates (simple text input + save button)
- Edit/delete existing templates
- Toggle active/inactive
- See usage stats ("Used 15 times, last used 2 days ago")

### Smart Selection Logic

When generating a quick reply, the system:
1. Filters to active templates for that rating
2. Excludes templates used in the last X reviews (configurable, default: 10)
3. Prioritizes least-recently-used templates
4. Falls back to random selection if all have been used recently

---

## Component 3: AI Prompt Customization & Variation Control

### What it does:
- Stores user preferences for AI tone, style, and constraints
- Dynamically builds the system prompt based on training examples
- Adds variation mechanisms to prevent repetition

### Database Schema (add to profiles table)

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  reply_style_settings JSONB DEFAULT '{
    "formality": "professional",
    "length": "concise",
    "personality": "friendly",
    "custom_instructions": "",
    "avoid_phrases": [],
    "variation_strength": "high"
  }'::jsonb;
```

**Settings Options:**
- **Formality**: casual, professional, formal
- **Length**: brief (1-2 sentences), concise (2-3), detailed (3-4)
- **Personality**: friendly, warm, reserved
- **Custom Instructions**: Free-text field for specific guidance
- **Avoid Phrases**: Array of phrases to never use
- **Variation Strength**: low, medium, high

### Settings UI - New Tab: "AI Generation Settings"

#### 1. Basic Style Controls
- Formality slider: Casual ↔ Professional ↔ Formal
- Length preference: Brief (1-2 sentences) / Concise (2-3) / Detailed (3-4)
- Personality: Friendly / Warm / Reserved / Custom

#### 2. Custom Instructions
- Large text area for specific guidance
- Examples: "Always mention our commitment to quality" or "Use 'we' instead of 'I'"

#### 3. Phrase Blacklist
- List of phrases to avoid
- Add button to input phrases like "Thank you so much for your kind words!"
- Each phrase can be removed with an X button

#### 4. Variation Control
- Slider: Low → Medium → High variation
- Explanation text: "Higher variation means more unique phrasing, but less consistency"

#### 5. Training Examples Preview
- "You have X training examples selected"
- Link to manage them
- Quick preview of 2-3 examples

### Modified Edge Function Logic

```typescript
// 1. Fetch user's style settings
const { data: profile } = await supabase
  .from('profiles')
  .select('reply_style_settings')
  .eq('id', user.id)
  .single();

const settings = profile?.reply_style_settings || {};

// 2. Fetch training examples
const { data: examples } = await supabase
  .from('training_examples')
  .select('review_text, reply_content, review_rating, sentiment, notes')
  .eq('user_id', user.id)
  .eq('is_active', true)
  .eq('sentiment', sentiment) // Match sentiment
  .limit(3); // Use 3 most relevant examples

// 3. Build dynamic system prompt
let systemPrompt = `You are a customer service representative writing responses to Google Business reviews.

Style Guidelines:
- Formality: ${settings.formality || 'professional'}
- Length: ${settings.length || 'concise'} (2-3 sentences)
- Personality: ${settings.personality || 'friendly'}

${settings.custom_instructions ? `Additional Instructions:\n${settings.custom_instructions}\n` : ''}

${settings.avoid_phrases?.length ? `NEVER use these phrases:\n${settings.avoid_phrases.map(p => `- "${p}"`).join('\n')}\n` : ''}

${settings.variation_strength === 'high' ? 'IMPORTANT: Generate UNIQUE phrasing. Avoid common customer service clichés. Be creative and natural.\n' : ''}

${examples?.length ? `Here are examples of the style we want:\n${examples.map((ex, i) => 
  `Example ${i+1} (${ex.review_rating}-star):\nReview: "${ex.review_text}"\nOur Reply: "${ex.reply_content}"${ex.notes ? `\nWhat we like: ${ex.notes}` : ''}`
).join('\n\n')}\n\nMatch this tone and style, but make it unique for the current review.` : ''}

Generate a response that thanks the customer, ${sentiment === 'positive' ? 'expresses appreciation' : sentiment === 'negative' ? 'apologizes and offers solutions' : 'acknowledges their feedback'}, and maintains the specified style.`;

// 4. Add variation by including a uniqueness instruction
const userPrompt = `Generate a UNIQUE response to this ${rating}-star review: "${reviewText}"

Make sure this response is different from typical customer service replies. Avoid overused phrases and be authentic.`;
```

---

## Component 4: Generation Dashboard

### What it shows:

#### 1. Recent Generations
- Last 50 AI-generated replies with the review context

#### 2. Phrase Frequency Analysis
- Word cloud or list showing most-used opening phrases
- Example: "Thank you so much" (used 23 times), "We appreciate" (used 15 times)
- Click a phrase → Add to blacklist

#### 3. Style Consistency Score
- How varied your replies are (calculated by analyzing n-gram overlap)

#### 4. Training Example Impact
- "AI is currently learning from X examples"

#### 5. Quick Actions
- "Add more training examples"
- "Adjust variation settings"
- "Review blacklisted phrases"

### Implementation

```typescript
// Analyze replies table where is_ai_generated = true
// Use simple NLP:
// 1. Split by sentence
// 2. Extract first 5 words of each reply
// 3. Group and count common openings
// 4. Display in a sortable table or visual chart

const analyzeReplyPatterns = (replies: Reply[]) => {
  const openings = replies.map(r => {
    const firstSentence = r.content.split(/[.!?]/)[0];
    const firstFiveWords = firstSentence.split(' ').slice(0, 5).join(' ');
    return firstFiveWords;
  });

  const frequencyMap = openings.reduce((acc, phrase) => {
    acc[phrase] = (acc[phrase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(frequencyMap)
    .map(([phrase, count]) => ({
      phrase,
      count,
      percentage: Math.round((count / replies.length) * 100)
    }))
    .sort((a, b) => b.count - a.count);
};
```

---

## Component 5: Smart Template Selection for Star-Only Reviews

### Modified Edge Function Logic for Quick Replies

```typescript
// When review has no text
if (!hasSubstantiveText) {
  // 1. Get all active templates for this rating
  const { data: templates } = await supabase
    .from('quick_reply_templates')
    .select('id, template_text, last_used_at, usage_count')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .gte('rating_max', rating)
    .lte('rating_min', rating)
    .order('last_used_at', { ascending: true, nullsFirst: true });

  if (!templates || templates.length === 0) {
    // Fallback to default if user hasn't configured any
    generatedReply = getDefaultResponse(rating);
  } else {
    // 2. Get recently used template IDs (last 10 reviews)
    const { data: recentUsage } = await supabase
      .from('quick_reply_usage_history')
      .select('template_id')
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })
      .limit(10);

    const recentlyUsedIds = new Set(recentUsage?.map(u => u.template_id) || []);

    // 3. Filter out recently used templates
    const availableTemplates = templates.filter(t => !recentlyUsedIds.has(t.id));

    // 4. Select template (prefer least recently used)
    const selectedTemplate = availableTemplates.length > 0
      ? availableTemplates[0]
      : templates[Math.floor(Math.random() * templates.length)]; // Fallback to random

    generatedReply = selectedTemplate.template_text;

    // 5. Record usage
    await supabase.from('quick_reply_usage_history').insert({
      user_id: user.id,
      template_id: selectedTemplate.id,
      review_id: reviewId
    });

    // 6. Update template's last_used_at
    await supabase
      .from('quick_reply_templates')
      .update({ 
        last_used_at: new Date().toISOString(),
        usage_count: selectedTemplate.usage_count + 1 
      })
      .eq('id', selectedTemplate.id);
  }
}
```

---

## User Workflow Example

### Scenario: You notice the AI keeps saying "Thank you so much for your kind words!"

#### Step 1: Blacklist the phrase
1. Go to Settings → AI Generation Settings
2. Under "Avoid Phrases", click "Add Phrase"
3. Type: "Thank you so much for your kind words"
4. Save

#### Step 2: Add training examples
1. Go to Archive
2. Find 3-5 replies you really like
3. Click ⭐ "Use as Training Example" on each
4. Optionally add notes: "Love the casual, specific tone here"

#### Step 3: Adjust variation settings
1. Go to Settings → AI Generation Settings
2. Move "Variation Control" slider to "High"
3. Add custom instruction: "Be specific to what the customer mentioned. Use their name if available."

#### Step 4: Manage quick replies
1. Go to Settings → Quick Reply Templates
2. Add 10 new variations for 5-star reviews:
   - "Thanks for the stars! 🌟"
   - "We're grateful for your support!"
   - "Your rating made our day!"
   - etc.
3. Disable the ones you don't like anymore

#### Step 5: Monitor results
1. Go to Settings → Generation Dashboard
2. Check "Phrase Frequency Analysis"
3. Verify "Thank you so much for your kind words" is now at 0%
4. See your new training examples in action

---

## Benefits of This System

✅ **Full Control**: You decide what the AI should sound like

✅ **Learning from Examples**: AI adapts to your preferred style by studying real examples you approve

✅ **No More Repetition**: Smart template selection and phrase blacklisting prevent overuse

✅ **Transparency**: See exactly what's being generated and why

✅ **Flexibility**: Works for both AI-generated (text reviews) and quick replies (star-only)

✅ **Scalable**: Add unlimited training examples and template variations

✅ **Human-Centric**: Forces variety while maintaining your brand voice

---

## Implementation Checklist

### Database Setup
- [ ] Create `training_examples` table with RLS policies
- [ ] Create `quick_reply_templates` table with RLS policies
- [ ] Create `quick_reply_usage_history` table with RLS policies
- [ ] Add `reply_style_settings` JSONB column to `profiles` table
- [ ] Create indexes for performance optimization

### Archive Page
- [ ] Add "Use as Training Example" button to review cards
- [ ] Implement training example toggle functionality
- [ ] Add notes modal for training examples
- [ ] Show indicator for reviews already used as examples

### Settings Page - AI Management Tabs
- [ ] Create tabbed interface in Settings
- [ ] **Tab 1: AI Style Training**
  - [ ] List all training examples
  - [ ] Review and reply preview
  - [ ] Add/edit notes functionality
  - [ ] Enable/disable examples
  - [ ] Delete examples
- [ ] **Tab 2: Quick Reply Templates**
  - [ ] Sections for each rating tier (5★, 4★, 3★, 1-2★)
  - [ ] Add/edit/delete templates
  - [ ] Toggle active/inactive
  - [ ] Display usage statistics
- [ ] **Tab 3: AI Generation Settings**
  - [ ] Formality slider
  - [ ] Length preference selector
  - [ ] Personality selector
  - [ ] Custom instructions text area
  - [ ] Phrase blacklist management
  - [ ] Variation control slider
  - [ ] Training examples preview
- [ ] **Tab 4: Generation Dashboard**
  - [ ] Recent generations list
  - [ ] Phrase frequency analysis
  - [ ] Style consistency score
  - [ ] Quick action buttons

### Edge Function Updates
- [ ] Modify `generate-reply` function to fetch user settings
- [ ] Implement dynamic prompt building with training examples
- [ ] Add phrase blacklist filtering
- [ ] Implement smart quick reply template selection
- [ ] Track template usage in history table
- [ ] Update template usage statistics

### Custom Hooks
- [ ] Create `useTrainingExamples` hook
- [ ] Create `useQuickReplyTemplates` hook
- [ ] Create `useReplyStyleSettings` hook
- [ ] Create `useReplyAnalytics` hook

### Testing
- [ ] Test training example flow end-to-end
- [ ] Test quick reply template rotation
- [ ] Test phrase blacklist functionality
- [ ] Test variation control impact
- [ ] Test analytics dashboard accuracy
- [ ] Test edge cases (no templates, no examples, etc.)

---

## Success Metrics

Track these metrics after implementation:

- **Adoption Rate**: % of users who customize their AI settings
- **Training Example Usage**: Average # of training examples per user
- **Variation Improvement**: Compare variation scores before/after customization
- **User Satisfaction**: Survey users on AI reply quality
- **Phrase Diversity**: Track reduction in repetitive phrases
- **Template Rotation**: Verify no template is used too frequently

---

## Future Enhancements

1. **A/B Testing Presets**: Test multiple presets and auto-select the best
2. **Sentiment-Specific Presets**: Different presets for positive vs negative reviews
3. **Import/Export Presets**: Share presets with team members
4. **AI Training from Feedback**: "Was this reply helpful?" thumbs up/down
5. **Bulk Regeneration**: Re-generate all drafts with new settings
6. **Smart Suggestions**: AI suggests which reviews to use as training examples
7. **Template Variables**: Use `{customer_name}`, `{rating}` in templates
8. **Multi-Language Support**: Different presets per language
