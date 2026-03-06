import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createUserClient,
  getValidGoogleAccessToken,
} from "../_shared/google-connection.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await createUserClient(req);
    const { accessToken } = await getValidGoogleAccessToken(supabase, user.id);

    // Find locations missing a place_id
    const { data: locations, error } = await supabase
      .from('locations')
      .select('id, name, address, google_location_id')
      .eq('user_id', user.id)
      .is('place_id', null);

    if (error) throw error;
    if (!locations || locations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, resolved: 0, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all GBP locations with metadata to get placeId
    const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsResponse.ok) {
      throw new Error(`Failed to fetch accounts: ${await accountsResponse.text()}`);
    }

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.accounts || [];

    // Build a map of google_location_id -> placeId from GBP metadata
    const placeIdMap = new Map<string, string>();

    for (const account of accounts) {
      const locationsBaseUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/locations?readMask=name,title,metadata&pageSize=100`;
      let nextPageToken: string | null = null;

      do {
        const locationsUrl = nextPageToken ? `${locationsBaseUrl}&pageToken=${nextPageToken}` : locationsBaseUrl;
        const locationsResponse = await fetch(locationsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!locationsResponse.ok) break;

        const locationsData = await locationsResponse.json();
        const pageLocations = locationsData.locations || [];

        for (const loc of pageLocations) {
          const placeId = loc.metadata?.placeId;
          if (placeId && loc.name) {
            placeIdMap.set(loc.name, placeId);
          }
        }

        nextPageToken = locationsData.nextPageToken || null;
      } while (nextPageToken);
    }

    let resolved = 0;
    const results: { id: string; name: string; placeId: string | null }[] = [];

    for (const location of locations) {
      const placeId = placeIdMap.get(location.google_location_id) || null;

      if (placeId) {
        await supabase
          .from('locations')
          .update({ place_id: placeId })
          .eq('id', location.id);
        resolved++;
      }

      results.push({ id: location.id, name: location.name, placeId });
    }

    return new Response(
      JSON.stringify({ success: true, resolved, total: locations.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: true, message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
