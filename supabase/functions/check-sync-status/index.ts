import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createUserClient,
  getValidGoogleAccessToken,
  markGoogleError,
  markGoogleSyncSuccess,
} from "../_shared/google-connection.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await createUserClient(req);
    const { accessToken } = await getValidGoogleAccessToken(supabase, user.id);

    const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsResponse.ok) {
      throw new Error(`Failed to fetch accounts: ${await accountsResponse.text()}`);
    }

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.accounts || [];
    const locationStatuses = [];
    let totalGoogleReviews = 0;
    let totalDbReviews = 0;
    let fullySyncedCount = 0;
    let needsSyncCount = 0;
    let unknownLocationsCount = 0;

    for (const account of accounts) {
      const locationsBaseUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,metadata&pageSize=100`;
      let allLocationsForAccount: any[] = [];
      let locationsNextPageToken: string | null = null;

      do {
        const locationsUrl: string = locationsNextPageToken ? `${locationsBaseUrl}&pageToken=${locationsNextPageToken}` : locationsBaseUrl;
        const locationsResponse: Response = await fetch(locationsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!locationsResponse.ok) break;

        const locationsData: any = await locationsResponse.json();
        const pageLocations = locationsData.locations || [];
        allLocationsForAccount.push(...pageLocations);
        locationsNextPageToken = locationsData.nextPageToken || null;
      } while (locationsNextPageToken);

      for (const location of allLocationsForAccount) {
        const googleLocationId = location.name;
        const locationName = location.title || 'Unnamed Location';
        const address = location.storefrontAddress?.addressLines?.join(', ') || '';

        let googleReviewCount: number | null = null;
        let googleError: { status: number; message: string; source: string } | undefined;
        let staleGoogleCount: number | undefined;

        try {
          const parentName = googleLocationId.startsWith('accounts/') ? googleLocationId : `${account.name}/${googleLocationId}`;
          const reviewsUrl = `https://mybusiness.googleapis.com/v4/${parentName}/reviews?pageSize=0`;
          const reviewsResponse = await fetch(reviewsUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (reviewsResponse.ok) {
            const reviewsData = await reviewsResponse.json();
            googleReviewCount = reviewsData.totalReviewCount ?? 0;
          } else {
            const errorText = await reviewsResponse.text();
            googleError = {
              status: reviewsResponse.status,
              message: errorText || `HTTP ${reviewsResponse.status}`,
              source: 'reviews_api'
            };

            const { data: locationData } = await supabase
              .from('locations')
              .select('review_count')
              .eq('google_location_id', googleLocationId)
              .eq('user_id', user.id)
              .single();

            if (locationData?.review_count) staleGoogleCount = locationData.review_count;
          }
        } catch (error) {
          googleError = {
            status: 0,
            message: error instanceof Error ? error.message : 'Unknown error',
            source: 'reviews_api'
          };

          const { data: locationData } = await supabase
            .from('locations')
            .select('review_count')
            .eq('google_location_id', googleLocationId)
            .eq('user_id', user.id)
            .single();

          if (locationData?.review_count) staleGoogleCount = locationData.review_count;
        }

        const { data: locationRecord } = await supabase
          .from('locations')
          .select('id')
          .eq('google_location_id', googleLocationId)
          .eq('user_id', user.id)
          .single();

        const { count: dbReviewCount } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', locationRecord?.id || '');

        const dbCount = dbReviewCount || 0;
        let missing: number;
        let syncPercentage: number | null;
        let status: 'complete' | 'incomplete' | 'unknown';

        if (googleReviewCount === null) {
          missing = 0;
          syncPercentage = null;
          status = 'unknown';
          unknownLocationsCount++;
        } else {
          missing = Math.max(0, googleReviewCount - dbCount);
          syncPercentage = googleReviewCount > 0 ? Math.round((dbCount / googleReviewCount) * 100) : 100;
          status = syncPercentage === 100 ? 'complete' : 'incomplete';

          if (status === 'complete') fullySyncedCount++;
          else needsSyncCount++;

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

        if (googleError) locationStatus.google_error = googleError;
        if (staleGoogleCount !== undefined) locationStatus.stale_google_count = staleGoogleCount;
        locationStatuses.push(locationStatus);
      }
    }

    const totalMissing = Math.max(0, totalGoogleReviews - totalDbReviews);
    const overallSyncPercentage = totalGoogleReviews > 0
      ? Math.round((totalDbReviews / totalGoogleReviews) * 100)
      : (unknownLocationsCount === locationStatuses.length ? null : 100);

    await markGoogleSyncSuccess(supabase, user.id);

    return new Response(
      JSON.stringify({
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
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    try {
      const { supabase, user } = await createUserClient(req);
      await markGoogleError(supabase, user.id, error);
    } catch {}

    return new Response(
      JSON.stringify({ error: true, message: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
