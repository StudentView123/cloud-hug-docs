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

    const accountsUrl = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
    const accountsResponse = await fetch(accountsUrl, {
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

        if (!locationsResponse.ok) {
          const fallbackUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`;
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const fallbackLocations = fallbackData.locations || [];
            googleLocations.push(...fallbackLocations.map((loc: any) => ({ ...loc, accountName: account.name, source: 'fallback' })));
          }
          break;
        }

        const locationsData: any = await locationsResponse.json();
        const pageLocations = locationsData.locations || [];
        googleLocations.push(...pageLocations.map((loc: any) => ({ ...loc, accountName: account.name, source: 'primary' })));
        nextPageToken = locationsData.nextPageToken || null;
      } while (nextPageToken);
    }

    const { data: dbLocations, error: dbError } = await supabase
      .from('locations')
      .select('id, google_location_id, name, address')
      .eq('user_id', user.id);

    if (dbError) throw dbError;

    const dbLocationIds = new Set(dbLocations?.map(loc => loc.google_location_id) || []);
    const googleLocationIds = new Set(googleLocations.map(loc => loc.name));

    const missingInDb = googleLocations
      .filter(loc => !dbLocationIds.has(loc.name))
      .map(loc => ({
        resourceName: loc.name,
        title: loc.title || 'Unnamed Location',
        address: loc.storefrontAddress?.addressLines?.join(', ') || 'No address',
        state: loc.locationState?.name || 'Unknown',
        accountName: loc.accountName,
        source: loc.source
      }));

    const extraInDb = dbLocations?.filter(loc => !googleLocationIds.has(loc.google_location_id)) || [];
    await markGoogleSyncSuccess(supabase, user.id);

    return new Response(
      JSON.stringify({
        success: true,
        googleLocations: googleLocations.map(loc => ({
          resourceName: loc.name,
          title: loc.title,
          address: loc.storefrontAddress?.addressLines?.join(', '),
          accountName: loc.accountName,
        })),
        googleLocationCount: googleLocations.length,
        dbLocations: dbLocations?.map(loc => ({
          id: loc.id,
          google_location_id: loc.google_location_id,
          name: loc.name,
          address: loc.address,
        })),
        dbLocationCount: dbLocations?.length || 0,
        missingInDb,
        extraInDb,
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
