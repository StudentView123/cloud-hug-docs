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

    const { data: profile } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, token_expires_at')
      .eq('id', user.id)
      .single();

    if (!profile?.google_access_token) {
      return new Response(
        JSON.stringify({
          connected: false,
          message: "No Google tokens found"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenExpired = profile.token_expires_at && new Date(profile.token_expires_at) < new Date();
    
    // Test accounts endpoint - using correct Google My Business Account Management API
    console.log('Testing Google API connection with access token...');
    const testResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${profile.google_access_token}` },
    });

    console.log('API Response Status:', testResponse.status);
    console.log('API Response Content-Type:', testResponse.headers.get('content-type'));

    const diagnostics: any = {
      connected: true,
      tokenExpired,
      tokenExpiresAt: profile.token_expires_at,
      hasRefreshToken: !!profile.google_refresh_token,
      apiTest: {
        status: testResponse.status,
        ok: testResponse.ok,
      },
    };

    if (!testResponse.ok) {
      const errorBody = await testResponse.text();
      console.log('API Error Response (first 500 chars):', errorBody.substring(0, 500));
      
      // Check if response is HTML (error page) vs JSON
      const contentType = testResponse.headers.get('content-type');
      if (contentType?.includes('text/html')) {
        diagnostics.apiTest.error = 'Received HTML error page instead of JSON';
        diagnostics.apiTest.isHtmlError = true;
        diagnostics.apiTest.rawError = errorBody.substring(0, 1000); // First 1000 chars
      } else {
        try {
          const parsed = JSON.parse(errorBody);
          const quotaDetail = parsed.error?.details?.find((d: any) => d['@type']?.includes('ErrorInfo'));
          
          diagnostics.apiTest.error = parsed.error?.message;
          diagnostics.apiTest.code = parsed.error?.code;
          diagnostics.apiTest.service = quotaDetail?.metadata?.service;
          diagnostics.apiTest.quotaLimitValue = quotaDetail?.metadata?.quota_limit_value;
          diagnostics.apiTest.reason = quotaDetail?.reason;
          
          console.log('Parsed API Error:', parsed.error?.message);
          if (quotaDetail) {
            console.log('Quota Details:', quotaDetail);
          }
        } catch (parseError) {
          diagnostics.apiTest.error = errorBody.substring(0, 500);
          diagnostics.apiTest.parseError = true;
        }
      }
    } else {
      const data = await testResponse.json();
      diagnostics.apiTest.accountsFound = data.accounts?.length || 0;
      console.log('API Success: Found', diagnostics.apiTest.accountsFound, 'account(s)');
    }

    return new Response(
      JSON.stringify(diagnostics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
