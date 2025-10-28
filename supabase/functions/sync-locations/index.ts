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
    console.log('=== SYNC LOCATIONS ===');
    
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
        
        console.log(`Fetching: ${locationsUrl}`);
        const locationsResponse: Response = await fetch(locationsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!locationsResponse.ok) {
          const errorBody = await locationsResponse.text();
          console.error(`Locations API error for ${account.name}:`, locationsResponse.status, errorBody);
          break;
        }

        const locationsData: any = await locationsResponse.json();
        const pageLocations = locationsData.locations || [];
        
        // Log each location found
        pageLocations.forEach((loc: any) => {
          console.log(`  - ${loc.title || 'No Title'} (${loc.name})`);
          console.log(`    Address: ${loc.storefrontAddress?.addressLines?.join(', ') || 'No address'}`);
          console.log(`    State: ${loc.locationState?.name || 'Unknown'}`);
        });
        
        googleLocations.push(...pageLocations);
        
        nextPageToken = locationsData.nextPageToken || null;
        console.log(`✓ Fetched ${pageLocations.length} locations (${nextPageToken ? 'has more pages' : 'complete'})`);
      } while (nextPageToken);
    }

    console.log(`✓ Total Google locations found: ${googleLocations.length}`);

    // Get existing locations from our database
    const { data: dbLocations } = await supabase
      .from('locations')
      .select('google_location_id')
      .eq('user_id', user.id);

    const dbLocationIds = new Set(dbLocations?.map(loc => loc.google_location_id) || []);

    // Find and insert missing locations
    const missingLocations = googleLocations.filter(loc => !dbLocationIds.has(loc.name));
    console.log(`✓ Found ${missingLocations.length} missing locations to sync`);
    
    if (missingLocations.length > 0) {
      console.log('Missing locations details:');
      missingLocations.forEach((loc: any) => {
        console.log(`  - ${loc.title || 'No Title'}`);
        console.log(`    ID: ${loc.name}`);
        console.log(`    Address: ${loc.storefrontAddress?.addressLines?.join(', ') || 'No address'}`);
      });
    }

    const insertedLocations = [];
    for (const location of missingLocations) {
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
        console.error(`Failed to insert location ${location.name}:`, insertError);
      } else if (newLocation) {
        insertedLocations.push(newLocation);
        console.log(`✓ Inserted: ${newLocation.name}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        syncedCount: insertedLocations.length,
        totalGoogleLocations: googleLocations.length,
        insertedLocations: insertedLocations.map(loc => ({
          name: loc.name,
          address: loc.address,
        })),
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
