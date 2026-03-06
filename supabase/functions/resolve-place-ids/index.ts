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
      .select('id, name, address')
      .eq('user_id', user.id)
      .is('place_id', null);

    if (error) throw error;
    if (!locations || locations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, resolved: 0, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let resolved = 0;
    const results: { id: string; name: string; placeId: string | null }[] = [];

    for (const location of locations) {
      const searchQuery = location.address
        ? `${location.name}, ${location.address}`
        : location.name;

      try {
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
              .eq('id', location.id);
            resolved++;
            results.push({ id: location.id, name: location.name, placeId });
          } else {
            results.push({ id: location.id, name: location.name, placeId: null });
          }
        } else {
          console.warn(`Places API error for ${location.name}: ${placesResponse.status}`);
          results.push({ id: location.id, name: location.name, placeId: null });
        }
      } catch (err) {
        console.warn(`Failed to resolve Place ID for ${location.name}:`, err);
        results.push({ id: location.id, name: location.name, placeId: null });
      }
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
