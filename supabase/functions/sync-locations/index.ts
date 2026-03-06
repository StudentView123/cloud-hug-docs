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
    const googleLocations: any[] = [];

    for (const account of accounts) {
      const locationsBaseUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`;
      let nextPageToken: string | null = null;

      do {
        const locationsUrl: string = nextPageToken ? `${locationsBaseUrl}&pageToken=${nextPageToken}` : locationsBaseUrl;
        const locationsResponse: Response = await fetch(locationsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!locationsResponse.ok) break;

        const locationsData: any = await locationsResponse.json();
        const pageLocations = locationsData.locations || [];
        googleLocations.push(...pageLocations);
        nextPageToken = locationsData.nextPageToken || null;
      } while (nextPageToken);
    }

    const { data: dbLocations } = await supabase
      .from('locations')
      .select('google_location_id')
      .eq('user_id', user.id);

    const dbLocationIds = new Set(dbLocations?.map(loc => loc.google_location_id) || []);
    const missingLocations = googleLocations.filter(loc => !dbLocationIds.has(loc.name));

    const insertedLocations = [];
    for (const location of missingLocations) {
      const locationName = location.title || 'Unnamed Location';
      const locationAddress = location.storefrontAddress?.addressLines?.join(', ') || null;

      const { data: newLocation, error: insertError } = await supabase
        .from('locations')
        .insert({
          user_id: user.id,
          google_location_id: location.name,
          name: locationName,
          address: locationAddress,
        })
        .select()
        .single();

      if (!insertError && newLocation) {
        // Resolve Place ID from Google Places API (non-blocking)
        try {
          const searchQuery = locationAddress
            ? `${locationName}, ${locationAddress}`
            : locationName;

          const placesResponse = await fetch(
            'https://places.googleapis.com/v1/places:searchText',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
              },
              body: JSON.stringify({ textQuery: searchQuery }),
            }
          );

          if (placesResponse.ok) {
            const placesData = await placesResponse.json();
            const placeId = placesData.places?.[0]?.id;
            if (placeId) {
              await supabase
                .from('locations')
                .update({ place_id: placeId })
                .eq('id', newLocation.id);
              newLocation.place_id = placeId;
            }
          }
        } catch (placeError) {
          console.warn(`Failed to resolve Place ID for ${locationName}:`, placeError);
        }

        insertedLocations.push(newLocation);
      }
    }

    await markGoogleSyncSuccess(supabase, user.id);

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: insertedLocations.length,
        totalGoogleLocations: googleLocations.length,
        insertedLocations: insertedLocations.map(loc => ({ name: loc.name, address: loc.address })),
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
