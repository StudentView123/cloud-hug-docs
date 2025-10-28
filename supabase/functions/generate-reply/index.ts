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
    const { reviewId, reviewText, rating } = await req.json();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Create AI prompt based on review rating
    const sentiment = rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative';
    const systemPrompt = `You are a professional customer service representative writing responses to Google Business reviews. 
Generate a professional, empathetic response that:
- Thanks the customer for their feedback
- ${sentiment === 'positive' ? 'Expresses appreciation for their positive experience' : sentiment === 'negative' ? 'Apologizes for any issues and offers to make things right' : 'Acknowledges their feedback'}
- Keeps the response concise (2-3 sentences)
- Maintains a friendly, professional tone
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
          { role: 'user', content: `Generate a response to this ${rating}-star review: "${reviewText}"` },
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
    const generatedReply = aiData.choices[0].message.content;

    // Save the generated reply
    const { data: reply, error: replyError } = await supabase
      .from('replies')
      .insert({
        review_id: reviewId,
        user_id: user.id,
        content: generatedReply,
        status: 'draft',
        is_ai_generated: true,
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
        details: { rating, sentiment },
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
