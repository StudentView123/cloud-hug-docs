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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    // Get user's Google access token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, token_expires_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.google_access_token) {
      throw new Error('Google account not connected');
    }

    // Check if token needs refresh
    let accessToken = profile.google_access_token;
    if (profile.token_expires_at && new Date(profile.token_expires_at) < new Date()) {
      // Refresh token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          refresh_token: profile.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        accessToken = tokens.access_token;
        
        // Update stored token
        await supabase
          .from('profiles')
          .update({
            google_access_token: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq('id', user.id);
      }
    }

    // Fetch Google Business Profile accounts
    const accountsResponse = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsResponse.ok) {
      throw new Error('Failed to fetch accounts');
    }

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.accounts || [];

    // Fetch locations and reviews for each account
    const allReviews = [];
    const allLocations = [];

    for (const account of accounts) {
      const locationsResponse = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json();
        const locations = locationsData.locations || [];

        for (const location of locations) {
          // Store location
          const { data: existingLocation } = await supabase
            .from('locations')
            .select('id')
            .eq('google_location_id', location.name)
            .eq('user_id', user.id)
            .single();

          let locationId;
          if (!existingLocation) {
            const { data: newLocation } = await supabase
              .from('locations')
              .insert({
                user_id: user.id,
                google_location_id: location.name,
                name: location.title || 'Unnamed Location',
                address: location.storefrontAddress?.addressLines?.join(', '),
              })
              .select()
              .single();
            locationId = newLocation?.id;
            allLocations.push(newLocation);
          } else {
            locationId = existingLocation.id;
          }

          // Fetch reviews for this location
          const reviewsResponse = await fetch(
            `https://mybusiness.googleapis.com/v4/${location.name}/reviews`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (reviewsResponse.ok) {
            const reviewsData = await reviewsResponse.json();
            const reviews = reviewsData.reviews || [];

            for (const review of reviews) {
              // Store review
              const { data: existingReview } = await supabase
                .from('reviews')
                .select('id')
                .eq('google_review_id', review.reviewId)
                .single();

              if (!existingReview) {
                const { data: newReview } = await supabase
                  .from('reviews')
                  .insert({
                    location_id: locationId,
                    google_review_id: review.reviewId,
                    author_name: review.reviewer?.displayName || 'Anonymous',
                    author_photo_url: review.reviewer?.profilePhotoUrl,
                    rating: review.starRating === 'FIVE' ? 5 : review.starRating === 'FOUR' ? 4 : review.starRating === 'THREE' ? 3 : review.starRating === 'TWO' ? 2 : 1,
                    text: review.comment,
                    review_created_at: review.createTime,
                  })
                  .select()
                  .single();
                  
                if (newReview) {
                  allReviews.push(newReview);
                }
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        reviews: allReviews,
        locations: allLocations,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-reviews function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
