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
    console.log('=== FETCH REVIEWS STARTED ===');
    
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    if (!authHeader) {
      console.error('ERROR: No authorization header');
      throw new Error('No authorization header');
    }

    const jwt = authHeader.replace('Bearer ', '');
    console.log('JWT token extracted (length):', jwt.length);
    console.log('JWT preview:', jwt.substring(0, 20) + '...' + jwt.substring(jwt.length - 20));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    console.log('Getting user from JWT...');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error('ERROR: Authentication failed:', userError);
      throw new Error('Not authenticated');
    }
    console.log('✓ User authenticated:', user.id);

    // Get user's Google access token
    console.log('Fetching Google tokens from profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, token_expires_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('ERROR: Profile fetch failed:', profileError);
      throw new Error('Failed to fetch profile');
    }
    
    console.log('Profile data:', {
      hasAccessToken: !!profile?.google_access_token,
      hasRefreshToken: !!profile?.google_refresh_token,
      tokenExpiresAt: profile?.token_expires_at,
      accessTokenPreview: profile?.google_access_token?.substring(0, 15) + '...',
    });

    if (!profile?.google_access_token) {
      console.error('ERROR: No Google access token in profile');
      throw new Error('Google account not connected');
    }

    // Check if token needs refresh
    let accessToken = profile.google_access_token;
    const tokenExpired = profile.token_expires_at && new Date(profile.token_expires_at) < new Date();
    console.log('Token expiration check:', {
      expiresAt: profile.token_expires_at,
      isExpired: tokenExpired,
    });
    
    if (tokenExpired) {
      console.log('Token expired, attempting refresh...');
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

      console.log('Token refresh response status:', refreshResponse.status);
      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        accessToken = tokens.access_token;
        console.log('✓ Token refreshed successfully');
        
        // Update stored token
        await supabase
          .from('profiles')
          .update({
            google_access_token: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq('id', user.id);
      } else {
        const errorBody = await refreshResponse.text();
        console.error('ERROR: Token refresh failed:', errorBody);
      }
    }

    // Fetch Google Business Profile accounts
    console.log('=== FETCHING GOOGLE BUSINESS ACCOUNTS ===');
    console.log('API URL:', 'https://mybusinessbusinessinformation.googleapis.com/v1/accounts');
    console.log('Access token preview:', accessToken.substring(0, 15) + '...');
    
    const accountsResponse = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    console.log('Accounts API response status:', accountsResponse.status);
    
    if (!accountsResponse.ok) {
      const errorBody = await accountsResponse.text();
      console.error('ERROR: Failed to fetch accounts');
      console.error('Response status:', accountsResponse.status);
      console.error('Response body:', errorBody);
      throw new Error(`Failed to fetch accounts: ${accountsResponse.status} - ${errorBody}`);
    }

    const accountsData = await accountsResponse.json();
    console.log('✓ Accounts fetched:', accountsData);
    const accounts = accountsData.accounts || [];
    console.log('Number of accounts:', accounts.length);

    // Fetch locations and reviews for each account
    const allReviews = [];
    const allLocations = [];

    for (const account of accounts) {
      console.log(`\n=== Processing account: ${account.name} ===`);
      const locationsUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`;
      console.log('Fetching locations from:', locationsUrl);
      
      const locationsResponse = await fetch(locationsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      console.log('Locations response status:', locationsResponse.status);
      
      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json();
        const locations = locationsData.locations || [];
        console.log(`✓ Found ${locations.length} locations`);

        for (const location of locations) {
          console.log(`\n--- Processing location: ${location.title || location.name} ---`);
          // Store location
          const { data: existingLocation } = await supabase
            .from('locations')
            .select('id')
            .eq('google_location_id', location.name)
            .eq('user_id', user.id)
            .single();

          let locationId;
          if (!existingLocation) {
            console.log('Creating new location in database...');
            const { data: newLocation, error: insertError } = await supabase
              .from('locations')
              .insert({
                user_id: user.id,
                google_location_id: location.name,
                name: location.title || 'Unnamed Location',
                address: location.storefrontAddress?.addressLines?.join(', '),
              })
              .select()
              .single();
            
            if (insertError) {
              console.error('ERROR: Failed to insert location:', insertError);
            } else {
              console.log('✓ Location created:', newLocation?.id);
            }
            
            locationId = newLocation?.id;
            allLocations.push(newLocation);
          } else {
            console.log('Using existing location:', existingLocation.id);
            locationId = existingLocation.id;
          }

          // Fetch reviews for this location
          const reviewsUrl = `https://mybusiness.googleapis.com/v4/${location.name}/reviews`;
          console.log('Fetching reviews from:', reviewsUrl);
          
          const reviewsResponse = await fetch(reviewsUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          console.log('Reviews response status:', reviewsResponse.status);
          
          if (reviewsResponse.ok) {
            const reviewsData = await reviewsResponse.json();
            const reviews = reviewsData.reviews || [];
            console.log(`✓ Found ${reviews.length} reviews for this location`);

            for (const review of reviews) {
              // Store review
              const { data: existingReview } = await supabase
                .from('reviews')
                .select('id')
                .eq('google_review_id', review.reviewId)
                .single();

              if (!existingReview) {
                console.log('Inserting new review:', review.reviewId);
                const { data: newReview, error: reviewError } = await supabase
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
                  
                if (reviewError) {
                  console.error('ERROR: Failed to insert review:', reviewError);
                } else if (newReview) {
                  console.log('✓ Review inserted');
                  allReviews.push(newReview);
                }
              } else {
                console.log('Review already exists, skipping');
              }
            }
          } else {
            const reviewsErrorBody = await reviewsResponse.text();
            console.error('ERROR: Failed to fetch reviews for location');
            console.error('Response status:', reviewsResponse.status);
            console.error('Response body:', reviewsErrorBody);
          }
        }
      } else {
        const locErrorBody = await locationsResponse.text();
        console.error('ERROR: Failed to fetch locations for account');
        console.error('Response status:', locationsResponse.status);
        console.error('Response body:', locErrorBody);
      }
    }

    console.log('\n=== FETCH REVIEWS COMPLETED ===');
    console.log('Total new reviews:', allReviews.length);
    console.log('Total new locations:', allLocations.filter(Boolean).length);

    return new Response(
      JSON.stringify({ 
        success: true,
        reviews: allReviews,
        locations: allLocations,
        reviewsCount: allReviews.length,
        locationsCount: allLocations.filter(Boolean).length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('\n=== ERROR IN FETCH-REVIEWS FUNCTION ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
