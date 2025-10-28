import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleErrorResponse {
  error?: {
    code?: number;
    status?: string;
    message?: string;
    details?: Array<{
      '@type'?: string;
      reason?: string;
      domain?: string;
      metadata?: {
        service?: string;
        quota_limit_value?: string;
        quota_metric?: string;
        quota_limit?: string;
      };
    }>;
  };
}

function createStructuredError(status: number, body: string, source: string = "google") {
  try {
    const parsed: GoogleErrorResponse = JSON.parse(body);
    const error = parsed.error;
    const quotaDetail = error?.details?.find(d => d['@type']?.includes('ErrorInfo'));
    
    return {
      error: true,
      source,
      service: quotaDetail?.metadata?.service || "unknown",
      status,
      code: error?.code || status,
      googleStatus: error?.status || "UNKNOWN",
      message: error?.message || body,
      quotaLimitValue: quotaDetail?.metadata?.quota_limit_value ? parseInt(quotaDetail.metadata.quota_limit_value) : undefined,
      quotaLimit: quotaDetail?.metadata?.quota_limit,
      reason: quotaDetail?.reason,
    };
  } catch {
    return {
      error: true,
      source,
      status,
      message: body,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== FETCH REVIEWS STARTED ===');
    
    // Parse request body for optional parameters
    const body = await req.json().catch(() => ({}));
    const targetLocationIds: string[] = body.location_ids || [];
    const maxExecutionTime = 50000; // 50 seconds timeout protection
    const startTime = Date.now();
    
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

    // Fetch accounts using modern Business Profile API
    console.log('Fetching accounts from Business Profile API v1...');
    const accountsUrl = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
    const accountsResponse = await fetch(accountsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsResponse.ok) {
      const errorBody = await accountsResponse.text();
      console.error('Accounts API error:', accountsResponse.status, errorBody);
      const structuredError = createStructuredError(accountsResponse.status, errorBody);
      return new Response(JSON.stringify(structuredError), {
        status: accountsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.accounts || [];
    console.log(`✓ Found ${accounts.length} accounts`);

    const allReviews = [];
    const allLocations = [];
    const processedLocations = [];
    let foundLocationCount = 0;
    let foundReviewCount = 0;
    let updatedToArchivedTrue = 0;
    let updatedToArchivedFalse = 0;
    let insertedNew = 0;
    let skippedFullySynced = 0;
    let partialCompletion = false;

    for (const account of accounts) {
      console.log(`Processing account: ${account.name}`);
      
      // Fetch locations with pagination using Business Account Management API
      const locationsBaseUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`;
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
          const errorBody = await locationsResponse.text();
          console.error('Locations API error:', locationsResponse.status, errorBody);
          break; // Skip this account if error, but continue with others
        }

        const locationsData: any = await locationsResponse.json();
        const pageLocations = locationsData.locations || [];
        allLocationsForAccount.push(...pageLocations);
        
        locationsNextPageToken = locationsData.nextPageToken || null;
        console.log(`✓ Fetched ${pageLocations.length} locations (page ${locationsNextPageToken ? 'has more' : 'complete'})`);
      } while (locationsNextPageToken);

      const locations = allLocationsForAccount;
      foundLocationCount += locations.length;
      console.log(`✓ Total locations for account: ${locations.length}`);

      for (const location of locations) {
        // Check timeout
        if (Date.now() - startTime > maxExecutionTime) {
          console.log('⚠️ Approaching timeout limit, exiting gracefully...');
          partialCompletion = true;
          break;
        }

        // Skip if targeting specific locations and this isn't one of them
        if (targetLocationIds.length > 0 && !targetLocationIds.includes(location.name)) {
          console.log(`⊘ Skipping location (not in target list): ${location.title}`);
          continue;
        }

        // Check if location is already 100% synced (when no target locations specified)
        if (targetLocationIds.length === 0) {
          const googleReviewCount = location.metadata?.newReviewCount || 0;
          const { data: existingLoc } = await supabase
            .from('locations')
            .select('id, review_count')
            .eq('google_location_id', location.name)
            .eq('user_id', user.id)
            .single();
          
          if (existingLoc && existingLoc.review_count >= googleReviewCount && googleReviewCount > 0) {
            console.log(`✓ Skipping ${location.title} (already synced: ${existingLoc.review_count}/${googleReviewCount})`);
            skippedFullySynced++;
            continue;
          }
        }

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

        // Fetch reviews using Google My Business API v4
        const reviewsUrl = `https://mybusiness.googleapis.com/v4/${account.name}/${location.name}/reviews?pageSize=100`;
        let nextPageToken: string | null = null;
        
        do {
          const paginatedUrl: string = nextPageToken ? `${reviewsUrl}&pageToken=${nextPageToken}` : reviewsUrl;
          const reviewsResponse: Response = await fetch(paginatedUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (!reviewsResponse.ok) {
            const errorBody = await reviewsResponse.text();
            console.error('Reviews API error:', reviewsResponse.status);
            console.error('Attempted URL:', paginatedUrl);
            console.error('Reviews API error body:', errorBody);
            const structuredError = createStructuredError(reviewsResponse.status, errorBody, "reviews");
            console.error('Structured error:', JSON.stringify(structuredError, null, 2));
            break;
          }

          const reviewsData: any = await reviewsResponse.json();
          const reviews = reviewsData.reviews || [];
          foundReviewCount += reviews.length;
          console.log(`✓ Found ${reviews.length} reviews for ${location.title || location.name}`);

          // Track processed location
          processedLocations.push({
            name: location.title || location.name,
            reviews_synced: reviews.length,
            status: 'complete',
          });

          for (const review of reviews) {
            // Strict boolean for reply status
            const hasGoogleReply = !!(review.reviewReply?.comment?.length);
            const googleReplyContent = hasGoogleReply ? review.reviewReply!.comment : null;
            const googleReplyTime = hasGoogleReply ? review.reviewReply!.updateTime : null;
            
            const { data: existingReview } = await supabase
              .from('reviews')
              .select('id, has_google_reply, google_reply_content, archived')
              .eq('google_review_id', review.name || review.reviewId)
              .maybeSingle();

            if (existingReview) {
              // Update if reply status changed, content changed, or archived is null/incorrect
              const needsUpdate = 
                existingReview.has_google_reply !== hasGoogleReply || 
                existingReview.google_reply_content !== googleReplyContent ||
                existingReview.archived === null ||
                existingReview.archived !== hasGoogleReply;
              
              if (needsUpdate) {
                const { error: updateError } = await supabase
                  .from('reviews')
                  .update({ 
                    has_google_reply: hasGoogleReply,
                    google_reply_content: googleReplyContent,
                    google_reply_time: googleReplyTime,
                    archived: hasGoogleReply
                  })
                  .eq('id', existingReview.id);
                
                if (updateError) {
                  console.error(`⚠️ Failed to update review ${existingReview.id}:`, updateError.message);
                } else {
                  if (hasGoogleReply) {
                    updatedToArchivedTrue++;
                  } else {
                    updatedToArchivedFalse++;
                  }
                  console.log(`✓ Updated review ${existingReview.id} - archived: ${hasGoogleReply}`);
                }
              }
            } else if (locationId) {
              // Insert ALL reviews (both answered and unanswered)
              const rating = typeof review.starRating === 'number' ? review.starRating : 
                             review.starRating === 'FIVE' ? 5 : 
                             review.starRating === 'FOUR' ? 4 : 
                             review.starRating === 'THREE' ? 3 : 
                             review.starRating === 'TWO' ? 2 : 1;

              const { data: newReview } = await supabase
                .from('reviews')
                .insert({
                  location_id: locationId,
                  google_review_id: review.name || review.reviewId,
                  author_name: review.reviewer?.displayName || 'Anonymous',
                  author_photo_url: review.reviewer?.profilePhotoUrl,
                  rating,
                  text: review.comment,
                  review_created_at: review.createTime,
                  has_google_reply: hasGoogleReply,
                  google_reply_content: googleReplyContent,
                  google_reply_time: googleReplyTime,
                  archived: hasGoogleReply,
                })
                .select()
                .single();
              
              if (newReview) {
                allReviews.push(newReview);
                insertedNew++;
              }
            }
          }

          nextPageToken = reviewsData.nextPageToken || null;
        } while (nextPageToken);

        // Update review count for this location
        if (locationId) {
          const { count } = await supabase
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('location_id', locationId);

          await supabase
            .from('locations')
            .update({ review_count: count || 0 })
            .eq('id', locationId);
        }
      }
    }

    console.log(`✓ Completed: Found ${foundReviewCount} reviews from ${foundLocationCount} locations`);
    console.log(`✓ Inserted: ${insertedNew} new reviews, ${allLocations.length} new locations`);
    console.log(`✓ Updated: ${updatedToArchivedTrue} archived (replied), ${updatedToArchivedFalse} unarchived (no reply)`);
    if (skippedFullySynced > 0) {
      console.log(`✓ Skipped: ${skippedFullySynced} fully synced locations`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        partial: partialCompletion,
        reviews: allReviews,
        locations: allLocations,
        locations_processed: processedLocations,
        completed_locations: processedLocations.length,
        skipped_locations: skippedFullySynced,
        newReviewsCount: insertedNew,
        newLocationsCount: allLocations.length,
        foundReviewCount,
        foundLocationCount,
        updatedToArchivedTrue,
        updatedToArchivedFalse,
        message: partialCompletion 
          ? 'Partial sync completed (timeout protection). Run again to continue.'
          : skippedFullySynced > 0 
            ? `Synced successfully. ${skippedFullySynced} locations already up to date.`
            : 'All reviews synced successfully.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: true,
        source: "server",
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
