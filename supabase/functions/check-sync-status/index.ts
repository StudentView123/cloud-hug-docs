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
    console.log('=== CHECK SYNC STATUS STARTED ===');
    
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

    // Get user's Google tokens
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
    const tokenExpired = profile.token_expires_at && new Date(profile.token_expires_at) < new Date();
    
    if (tokenExpired && profile.google_refresh_token) {
      console.log('Refreshing expired token...');
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
        await supabase
          .from('profiles')
          .update({
            google_access_token: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq('id', user.id);
        console.log('✓ Token refreshed');
      }
    }

    // Fetch accounts
    console.log('Fetching accounts from Business Profile API v1...');
    const accountsUrl = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
    const accountsResponse = await fetch(accountsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsResponse.ok) {
      const errorBody = await accountsResponse.text();
      throw new Error(`Failed to fetch accounts: ${errorBody}`);
    }

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.accounts || [];
    console.log(`✓ Found ${accounts.length} accounts`);

    const locationStatuses = [];
    let totalGoogleReviews = 0;
    let totalDbReviews = 0;
    let fullySyncedCount = 0;
    let needsSyncCount = 0;
    let unknownLocationsCount = 0;

    for (const account of accounts) {
      console.log(`Processing account: ${account.name}`);
      
      // Fetch locations with pagination
      const locationsBaseUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,metadata&pageSize=100`;
      let allLocationsForAccount: any[] = [];
      let locationsNextPageToken: string | null = null;

      do {
        const locationsUrl: string = locationsNextPageToken 
          ? `${locationsBaseUrl}&pageToken=${locationsNextPageToken}` 
          : locationsBaseUrl;
        
        const locationsResponse: Response = await fetch(locationsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!locationsResponse.ok) {
          console.error('Locations API error:', locationsResponse.status);
          break;
        }

        const locationsData: any = await locationsResponse.json();
        const pageLocations = locationsData.locations || [];
        allLocationsForAccount.push(...pageLocations);
        
        locationsNextPageToken = locationsData.nextPageToken || null;
      } while (locationsNextPageToken);

      // Process each location
      for (const location of allLocationsForAccount) {
        const googleLocationId = location.name;
        const locationName = location.title || 'Unnamed Location';
        const address = location.storefrontAddress?.addressLines?.join(', ') || '';
        
        // Fetch actual reviews to get accurate count using pageSize=0 for efficiency
        let googleReviewCount: number | null = null;
        let googleError: { status: number; message: string; source: string } | undefined;
        let staleGoogleCount: number | undefined;
        
        try {
          // Try pageSize=0 first for maximum efficiency (only metadata)
          const reviewsUrl = `https://mybusiness.googleapis.com/v4/${googleLocationId}/reviews?pageSize=0`;
          console.log(`Fetching review count for ${locationName}: ${reviewsUrl}`);
          
          const reviewsResponse = await fetch(reviewsUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          
          if (reviewsResponse.ok) {
            const reviewsData = await reviewsResponse.json();
            console.log(`API response for ${locationName}:`, JSON.stringify(reviewsData));
            
            // The API returns totalReviewCount directly in the response
            googleReviewCount = reviewsData.totalReviewCount ?? 0;
            console.log(`✓ Got totalReviewCount=${googleReviewCount} for ${locationName}`);
          } else {
            const errorText = await reviewsResponse.text();
            console.log(`⚠ API error for ${locationName} (${reviewsResponse.status}): ${errorText}`);
            
            googleError = {
              status: reviewsResponse.status,
              message: errorText || `HTTP ${reviewsResponse.status}`,
              source: 'reviews_api'
            };
            
            // Try to get stale count from locations table
            const { data: locationData } = await supabase
              .from('locations')
              .select('review_count')
              .eq('google_location_id', googleLocationId)
              .eq('user_id', user.id)
              .single();
            
            if (locationData?.review_count) {
              staleGoogleCount = locationData.review_count;
            }
          }
        } catch (error) {
          console.error(`Error fetching reviews for ${locationName}:`, error);
          googleError = {
            status: 0,
            message: error instanceof Error ? error.message : 'Unknown error',
            source: 'reviews_api'
          };
          
          // Try to get stale count from locations table
          const { data: locationData } = await supabase
            .from('locations')
            .select('review_count')
            .eq('google_location_id', googleLocationId)
            .eq('user_id', user.id)
            .single();
          
          if (locationData?.review_count) {
            staleGoogleCount = locationData.review_count;
          }
        }
        
        // Get review count from database
        const { count: dbReviewCount } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', (
            await supabase
              .from('locations')
              .select('id')
              .eq('google_location_id', googleLocationId)
              .eq('user_id', user.id)
              .single()
          ).data?.id || '');

        const dbCount = dbReviewCount || 0;
        
        let missing: number;
        let syncPercentage: number | null;
        let status: 'complete' | 'incomplete' | 'unknown';
        
        if (googleReviewCount === null) {
          // Google count unavailable - status unknown
          missing = 0;
          syncPercentage = null;
          status = 'unknown';
          unknownLocationsCount++;
        } else {
          // Normal calculation
          missing = Math.max(0, googleReviewCount - dbCount);
          syncPercentage = googleReviewCount > 0 
            ? Math.round((dbCount / googleReviewCount) * 100) 
            : 100;
          status = syncPercentage === 100 ? 'complete' : 'incomplete';
          
          if (status === 'complete') {
            fullySyncedCount++;
          } else {
            needsSyncCount++;
          }
          
          totalGoogleReviews += googleReviewCount;
          totalDbReviews += dbCount;
        }

        const locationStatus: any = {
          google_location_id: googleLocationId,
          name: locationName,
          address,
          google_count: googleReviewCount,
          db_count: dbCount,
          missing,
          sync_percentage: syncPercentage,
          status,
        };
        
        if (googleError) {
          locationStatus.google_error = googleError;
        }
        
        if (staleGoogleCount !== undefined) {
          locationStatus.stale_google_count = staleGoogleCount;
        }
        
        locationStatuses.push(locationStatus);

        const percentDisplay = syncPercentage !== null ? `${syncPercentage}%` : 'unknown';
        console.log(`✓ ${locationName}: ${dbCount}/${googleReviewCount ?? 'unknown'} reviews (${percentDisplay})`);
      }
    }

    const totalMissing = Math.max(0, totalGoogleReviews - totalDbReviews);

    const overallSyncPercentage = totalGoogleReviews > 0 
      ? Math.round((totalDbReviews / totalGoogleReviews) * 100)
      : (unknownLocationsCount === locationStatuses.length ? null : 100);
    
    const response = {
      success: true,
      locations: locationStatuses,
      summary: {
        total_locations: locationStatuses.length,
        fully_synced: fullySyncedCount,
        needs_sync: needsSyncCount,
        unknown_locations: unknownLocationsCount,
        total_google_reviews: totalGoogleReviews,
        total_db_reviews: totalDbReviews,
        total_missing_reviews: totalMissing,
        overall_sync_percentage: overallSyncPercentage,
      },
    };

    console.log('✓ Sync status check complete');
    console.log(`Summary: ${fullySyncedCount}/${locationStatuses.length} locations fully synced, ${totalMissing} reviews missing`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
