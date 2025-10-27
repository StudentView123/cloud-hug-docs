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

    // Probe multiple valid Business Profile API endpoints to avoid misrouted HTML 404s
    const endpoints = [
      'https://businessprofile.googleapis.com/v1/accounts',
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    ];

    const attempts: any[] = [];
    let anySuccess = false;
    let accountsFound = 0;

    for (const url of endpoints) {
      try {
        console.log('Probing Google API:', url);
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${profile.google_access_token}` },
        });

        const contentType = resp.headers.get('content-type') || '';
        const bodyText = await resp.text();
        const trimmed = bodyText.trim().slice(0, 1000);
        const htmlDetected = contentType.includes('text/html') ||
          trimmed.startsWith('<!DOCTYPE html') ||
          trimmed.startsWith('<html');

        const attempt: any = {
          urlUsed: url,
          status: resp.status,
          ok: resp.ok,
          contentType,
          htmlDetected,
        };

        if (!resp.ok) {
          if (!htmlDetected) {
            try {
              const parsed = JSON.parse(bodyText);
              attempt.parsedError = {
                message: parsed.error?.message,
                code: parsed.error?.code || parsed.error?.status,
                status: parsed.error?.status,
              };
              const quotaDetail = parsed.error?.details?.find((d: any) => d['@type']?.includes('ErrorInfo'));
              if (quotaDetail) {
                attempt.parsedError.quota = {
                  service: quotaDetail?.metadata?.service,
                  quota_limit_value: quotaDetail?.metadata?.quota_limit_value,
                  reason: quotaDetail?.reason,
                };
              }
            } catch {
              attempt.parseError = true;
              attempt.bodySnippet = trimmed;
            }
          } else {
            attempt.bodySnippet = trimmed;
          }
        } else {
          // Successful call
          if (!htmlDetected && contentType.includes('application/json')) {
            try {
              const data = JSON.parse(bodyText);
              accountsFound = data.accounts?.length || 0;
              attempt.accountsFound = accountsFound;
            } catch (_) {
              // ignore parse error on success without JSON
            }
          }
          anySuccess = true;
        }

        attempts.push(attempt);
      } catch (e) {
        attempts.push({
          urlUsed: url,
          networkError: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    const primary = attempts[0] || null;

    const diagnostics: any = {
      connected: true,
      tokenExpired,
      tokenExpiresAt: profile.token_expires_at,
      hasRefreshToken: !!profile.google_refresh_token,
      apiHealthy: anySuccess,
      accountsFound,
      apiTest: primary,
      apiTests: attempts,
    };

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
