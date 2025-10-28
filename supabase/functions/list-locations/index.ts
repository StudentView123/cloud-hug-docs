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
    console.log('=== LIST LOCATIONS DIAGNOSTICS ===');
    
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

    const googleLocations: any[] = [];

    // Fetch all locations from Google with full pagination
    for (const account of accounts) {
      console.log(`Processing account: ${account.name}`);
      
      const locationsBaseUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,locationState&pageSize=100`;
      let nextPageToken: string | null = null;

      do {
        const locationsUrl: string = nextPageToken 
          ? `${locationsBaseUrl}&pageToken=${nextPageToken}` 
          : locationsBaseUrl;
        
        const locationsResponse: Response = await fetch(locationsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!locationsResponse.ok) {
          const errorBody = await locationsResponse.text();
          console.error(`Locations API error for ${account.name}:`, locationsResponse.status, errorBody);
          
          // Try fallback to Business Profile API
          console.log('Trying fallback to Business Profile API...');
          const fallbackUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,locationState&pageSize=100`;
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const fallbackLocations = fallbackData.locations || [];
            console.log(`✓ Fallback found ${fallbackLocations.length} locations`);
            googleLocations.push(...fallbackLocations.map((loc: any) => ({
              ...loc,
              accountName: account.name,
              source: 'fallback'
            })));
          }
          break;
        }

        const locationsData: any = await locationsResponse.json();
        const pageLocations = locationsData.locations || [];
        googleLocations.push(...pageLocations.map((loc: any) => ({
          ...loc,
          accountName: account.name,
          source: 'primary'
        })));
        
        nextPageToken = locationsData.nextPageToken || null;
        console.log(`✓ Fetched ${pageLocations.length} locations (${nextPageToken ? 'has more pages' : 'complete'})`);
      } while (nextPageToken);
    }

    console.log(`✓ Total Google locations found: ${googleLocations.length}`);

    // Get locations from our database
    const { data: dbLocations, error: dbError } = await supabase
      .from('locations')
      .select('id, google_location_id, name, address')
      .eq('user_id', user.id);

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    console.log(`✓ Database locations: ${dbLocations?.length || 0}`);

    // Find missing locations
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

    console.log(`✓ Missing in DB: ${missingInDb.length}`);
    console.log(`✓ Extra in DB: ${extraInDb.length}`);

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
