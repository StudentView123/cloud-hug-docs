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
    console.log('=== SENTIMENT AUDIT STARTED ===');
    
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

    // Helper function to calculate sentiment from rating
    const getSentiment = (rating: number): string => {
      if (rating >= 4) return 'positive';
      if (rating === 3) return 'neutral';
      return 'negative';
    };

    // Fetch ALL reviews for this user (including archived)
    const { data: reviews, error: fetchError } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        sentiment,
        location_id,
        rating_history,
        archived,
        locations!inner(user_id)
      `)
      .eq('locations.user_id', user.id);

    if (fetchError) {
      console.error('Error fetching reviews:', fetchError);
      throw fetchError;
    }

    console.log(`✓ Found ${reviews?.length || 0} reviews to audit`);

    let sentimentsAssigned = 0;
    let mismatchesFound = 0;
    let activeReviews = 0;
    let archivedReviews = 0;
    const mismatchDetails: any[] = [];

    // Process each review
    for (const review of reviews || []) {
      // Track active vs archived
      if (review.archived) {
        archivedReviews++;
      } else {
        activeReviews++;
      }

      const calculatedSentiment = getSentiment(review.rating);
      let needsUpdate = false;
      const updateData: any = {};

      // Check if sentiment is missing or incorrect
      if (review.sentiment !== calculatedSentiment) {
        updateData.sentiment = calculatedSentiment;
        needsUpdate = true;
        sentimentsAssigned++;
        console.log(`📊 Assigning sentiment to review ${review.id}: ${review.rating}★ → ${calculatedSentiment}`);
      }

      // Check if review has rating history (meaning it changed)
      const hasRatingHistory = review.rating_history && Array.isArray(review.rating_history) && review.rating_history.length > 0;
      
      if (hasRatingHistory) {
        // Check if there are draft replies that need review
        const { data: draftReplies } = await supabase
          .from('replies')
          .select('id, needs_review')
          .eq('review_id', review.id)
          .eq('status', 'draft');

        if (draftReplies && draftReplies.length > 0) {
          mismatchesFound++;
          mismatchDetails.push({
            review_id: review.id,
            rating: review.rating,
            sentiment: calculatedSentiment,
            rating_history: review.rating_history,
            draft_replies: draftReplies.length,
          });

          // Flag draft replies that aren't already flagged
          for (const reply of draftReplies) {
            if (!reply.needs_review) {
              await supabase
                .from('replies')
                .update({ needs_review: true })
                .eq('id', reply.id);
              console.log(`⚠️ Flagged draft reply ${reply.id} for review (rating changed)`);
            }
          }

          // Mark this review as having a sentiment mismatch
          updateData.sentiment_mismatch = true;
          needsUpdate = true;
        }
      }

      // Update the review if needed
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('reviews')
          .update(updateData)
          .eq('id', review.id);

        if (updateError) {
          console.error(`⚠️ Failed to update review ${review.id}:`, updateError.message);
        }
      }
    }

    console.log('=== AUDIT COMPLETE ===');
    console.log(`Total reviews processed: ${reviews?.length || 0}`);
    console.log(`Active reviews: ${activeReviews}`);
    console.log(`Archived reviews: ${archivedReviews}`);
    console.log(`Sentiments assigned: ${sentimentsAssigned}`);
    console.log(`Mismatches found: ${mismatchesFound}`);

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'audit_completed',
      details: {
        total_reviews_processed: reviews?.length || 0,
        active_reviews: activeReviews,
        archived_reviews: archivedReviews,
        sentiments_assigned: sentimentsAssigned,
        mismatches_found: mismatchesFound,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total_reviews: reviews?.length || 0,
          active_reviews: activeReviews,
          archived_reviews: archivedReviews,
          sentiments_assigned: sentimentsAssigned,
          mismatches_found: mismatchesFound,
          mismatch_details: mismatchDetails,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in audit-review-sentiments:', error);
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
