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
    console.log('=== GENERATING AUDIT INSIGHTS ===');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      throw new Error('Not authenticated');
    }
    console.log('✓ User authenticated:', user.id);

    // Fetch ALL reviews with details
    const { data: reviews, error: fetchError } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        sentiment,
        text,
        author_name,
        review_created_at,
        archived,
        rating_history,
        last_rating_change_at,
        location:locations(name)
      `)
      .eq('locations.user_id', user.id)
      .order('review_created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching reviews:', fetchError);
      throw fetchError;
    }

    console.log(`✓ Fetched ${reviews?.length || 0} reviews for analysis`);

    // Prepare data for AI analysis
    const reviewsSummary = reviews?.map(r => ({
      author: r.author_name,
      rating: r.rating,
      sentiment: r.sentiment,
      text: r.text?.substring(0, 500) || '', // Truncate to save tokens
      location: r.location?.name,
      archived: r.archived,
      rating_changed: r.rating_history && Array.isArray(r.rating_history) && r.rating_history.length > 0,
      created_at: r.review_created_at,
    })) || [];

    const totalReviews = reviews?.length || 0;
    const activeReviews = reviews?.filter(r => !r.archived).length || 0;
    const archivedReviews = reviews?.filter(r => r.archived).length || 0;
    const positiveReviews = reviews?.filter(r => r.sentiment === 'positive').length || 0;
    const neutralReviews = reviews?.filter(r => r.sentiment === 'neutral').length || 0;
    const negativeReviews = reviews?.filter(r => r.sentiment === 'negative').length || 0;
    const ratingChanges = reviews?.filter(r => r.rating_history && Array.isArray(r.rating_history) && r.rating_history.length > 0) || [];

    // Build prompt for AI analysis
    const analysisPrompt = `You are analyzing ${totalReviews} Google reviews (${activeReviews} active, ${archivedReviews} archived).

Current sentiment distribution:
- Positive: ${positiveReviews} reviews
- Neutral: ${neutralReviews} reviews  
- Negative: ${negativeReviews} reviews
- Rating changes detected: ${ratingChanges.length} reviews

Sample reviews for analysis:
${JSON.stringify(reviewsSummary.slice(0, 100), null, 2)}

Please analyze these reviews and provide:
1. An executive summary highlighting the overall sentiment and key patterns
2. Notable reviewers with specific examples (include actual names and what made their feedback stand out)
3. Key themes appearing in positive vs negative reviews (look for common topics, staff mentions, service quality, etc.)
4. Analysis of rating changes - identify patterns in upgrades vs downgrades
5. Action items with priority (high/medium/low) for business improvement
6. Any concerning trends that need immediate attention

Focus on providing specific, actionable insights with real examples from the reviews.`;

    console.log('✓ Calling Lovable AI for insights generation...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a business intelligence analyst specializing in customer feedback analysis. Provide detailed, actionable insights with specific examples.' },
          { role: 'user', content: analysisPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_audit_insights',
              description: 'Generate comprehensive review audit insights',
              parameters: {
                type: 'object',
                properties: {
                  summary: { type: 'string', description: 'Executive summary of findings' },
                  sentiment_breakdown: {
                    type: 'object',
                    properties: {
                      positive: { type: 'number' },
                      neutral: { type: 'number' },
                      negative: { type: 'number' }
                    }
                  },
                  notable_reviewers: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        rating: { type: 'number' },
                        sentiment: { type: 'string' },
                        highlight: { type: 'string' }
                      }
                    }
                  },
                  key_insights: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        examples: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              author: { type: 'string' },
                              rating: { type: 'number' },
                              excerpt: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  },
                  rating_changes: {
                    type: 'object',
                    properties: {
                      upgrades: { type: 'number' },
                      downgrades: { type: 'number' },
                      patterns: { type: 'string' }
                    }
                  },
                  action_items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                        description: { type: 'string' },
                        affected_reviews: { type: 'number' }
                      }
                    }
                  }
                },
                required: ['summary', 'sentiment_breakdown', 'key_insights', 'action_items']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_audit_insights' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('✓ AI analysis complete');

    // Extract structured insights from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const insights = toolCall?.function?.arguments 
      ? JSON.parse(toolCall.function.arguments)
      : {
          summary: 'Unable to generate insights',
          sentiment_breakdown: { positive: positiveReviews, neutral: neutralReviews, negative: negativeReviews },
          key_insights: [],
          action_items: []
        };

    // Add computed stats
    insights.stats = {
      total_reviews: totalReviews,
      active_reviews: activeReviews,
      archived_reviews: archivedReviews,
      sentiment_breakdown: {
        positive: positiveReviews,
        neutral: neutralReviews,
        negative: negativeReviews
      }
    };

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'insights_generated',
      details: {
        total_reviews_analyzed: totalReviews,
        key_insights_count: insights.key_insights?.length || 0,
        action_items_count: insights.action_items?.length || 0,
      },
    });

    console.log('=== INSIGHTS GENERATION COMPLETE ===');

    return new Response(
      JSON.stringify({
        success: true,
        insights,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-audit-insights:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
