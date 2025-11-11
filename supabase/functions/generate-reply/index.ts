import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reviewId, reviewText, rating, authorName } = await req.json();
    
    // Check if review text is empty or just whitespace/emojis
    const cleanedText = reviewText?.trim() || '';
    const hasSubstantiveText = cleanedText.length > 5;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token from Bearer header
    const token = authHeader.replace(/^Bearer\s+/i, '');
    console.log('Auth header present:', !!authHeader, 'Token length:', token.length);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(`Missing environment variables: ${!supabaseUrl ? 'SUPABASE_URL' : ''} ${!supabaseKey ? 'SUPABASE_ANON_KEY' : ''}`);
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user by explicitly passing the token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('User authentication failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper function for default responses on star-only reviews
    const getDefaultResponse = (rating: number): string => {
      if (rating === 5) {
        const responses = [
          "Thank you so much!",
          "We appreciate your support!",
          "Thank you for the 5 stars!",
          "We're grateful for your rating!",
        ];
        return responses[Math.floor(Math.random() * responses.length)];
      }
      
      if (rating === 4) {
        const responses = [
          "Thank you for your feedback!",
          "We appreciate your rating!",
          "Thanks for taking the time to rate us!",
        ];
        return responses[Math.floor(Math.random() * responses.length)];
      }
      
      if (rating === 3) {
        const responses = [
          "Thank you for your feedback!",
          "We appreciate you taking the time to rate us.",
          "Thanks for sharing your rating with us!",
        ];
        return responses[Math.floor(Math.random() * responses.length)];
      }
      
      // 1-2 star reviews
      const responses = [
        "Thank you for your feedback. We'd like to learn more about your experience.",
        "We appreciate your feedback and would love the opportunity to make things right.",
        "Thank you for sharing your rating. We take all feedback seriously.",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    };

    let generatedReply: string;

    // If review has no substantive text, check for custom templates
    if (!hasSubstantiveText) {
      console.log('Review has no text, checking for custom templates');
      
      // Get all active templates for this rating
      const { data: templates } = await supabase
        .from('quick_reply_templates')
        .select('id, template_text, last_used_at, usage_count')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gte('rating_max', rating)
        .lte('rating_min', rating)
        .order('last_used_at', { ascending: true, nullsFirst: true });

      if (templates && templates.length > 0) {
        // Get recently used template IDs (last 10 reviews)
        const { data: recentUsage } = await supabase
          .from('quick_reply_usage_history')
          .select('template_id')
          .eq('user_id', user.id)
          .order('used_at', { ascending: false })
          .limit(10);

        const recentlyUsedIds = new Set(recentUsage?.map(u => u.template_id) || []);
        
        // Filter out recently used templates
        const availableTemplates = templates.filter(t => !recentlyUsedIds.has(t.id));
        
        // Select least recently used (or random if all were recent)
        const selectedTemplate = availableTemplates.length > 0
          ? availableTemplates[0]
          : templates[Math.floor(Math.random() * templates.length)];

        generatedReply = selectedTemplate.template_text;

        // Record usage
        await supabase.from('quick_reply_usage_history').insert({
          user_id: user.id,
          template_id: selectedTemplate.id,
          review_id: reviewId
        });

        // Update template stats
        await supabase
          .from('quick_reply_templates')
          .update({ 
            last_used_at: new Date().toISOString(),
            usage_count: selectedTemplate.usage_count + 1 
          })
          .eq('id', selectedTemplate.id);
      } else {
        // Fallback to default responses
        console.log('No custom templates found, using default response for', rating, 'stars');
        generatedReply = getDefaultResponse(rating);
      }
    } else {
      // AI generation logic for reviews with text
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY not configured');
      }

      // Extract first name from author name
      const firstName = authorName?.split(' ')[0] || '';

      const sentiment = rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative';
      
      // Fetch user's style settings
      const { data: profile } = await supabase
        .from('profiles')
        .select('reply_style_settings')
        .eq('id', user.id)
        .single();

      const settings = profile?.reply_style_settings || {};
      
      // Fetch training examples matching sentiment
      const { data: examples } = await supabase
        .from('training_examples')
        .select('review_text, reply_content, review_rating, sentiment, notes')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('sentiment', sentiment)
        .limit(3);

      // Build dynamic system prompt
      let systemPrompt = `You are a professional customer service representative writing responses to Google Business reviews.

Style Guidelines:
- Formality: ${settings.formality || 'professional'}
- Length: ${settings.length || 'concise'} (2-3 sentences)
- Personality: ${settings.personality || 'friendly'}
${firstName ? `- Address the reviewer by their first name (${firstName}) at the beginning of your response` : ''}

${settings.custom_instructions ? `Additional Instructions:\n${settings.custom_instructions}\n` : ''}

${settings.avoid_phrases?.length ? `NEVER use these exact phrases:\n${settings.avoid_phrases.map((p: string) => `- "${p}"`).join('\n')}\n` : ''}

${settings.variation_strength === 'high' ? 'IMPORTANT: Generate UNIQUE phrasing. Avoid common customer service clichés. Be creative and natural. Do not start with the same phrase as previous replies.\n' : ''}

${examples && examples.length > 0 ? `Here are examples of replies we like:\n${examples.map((ex, i) => 
  `Example ${i+1} (${ex.review_rating}-star):\nReview: "${ex.review_text}"\nOur Reply: "${ex.reply_content}"${ex.notes ? `\nWhy we like it: ${ex.notes}` : ''}`
).join('\n\n')}\n\nMatch this tone and style, but make it unique for the current review.\n` : ''}

Generate a response that thanks the customer, ${sentiment === 'positive' ? 'expresses appreciation for their positive experience' : sentiment === 'negative' ? 'apologizes for any issues and offers to make things right' : 'acknowledges their feedback'}, and maintains the specified style.
Do not use generic phrases. Make it specific to their review when possible.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a response to this ${rating}-star review${firstName ? ` from ${firstName}` : ''}: "${reviewText}"` },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        if (response.status === 402) {
          throw new Error('AI credits exhausted. Please add funds to your workspace.');
        }
        throw new Error('Failed to generate reply');
      }

      const aiData = await response.json();
      generatedReply = aiData.choices[0].message.content;
    }

    // Delete any existing draft replies for this review (to handle regeneration)
    await supabase
      .from('replies')
      .delete()
      .eq('review_id', reviewId)
      .eq('status', 'draft');

    // Save the generated reply
    const { data: reply, error: replyError } = await supabase
      .from('replies')
      .insert({
        review_id: reviewId,
        user_id: user.id,
        content: generatedReply,
        status: 'draft',
        is_ai_generated: true,
        needs_review: false,
      })
      .select()
      .single();

    if (replyError) {
      console.error('Error saving reply:', replyError);
      throw replyError;
    }

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        review_id: reviewId,
        action: 'ai_reply_generated',
        details: { 
          rating, 
          sentiment: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
          usedDefaultResponse: !hasSubstantiveText 
        },
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        reply,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-reply function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
