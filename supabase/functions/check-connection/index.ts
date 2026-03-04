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

    const { data: profileConnection } = await (supabase as any)
      .from('google_connections')
      .select('google_account_email, google_account_name, google_account_picture_url, token_expires_at, refresh_token, last_error')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle();

    const endpoints = [
      'https://businessprofile.googleapis.com/v1/accounts',
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    ];

    const attempts: any[] = [];
    let anySuccess = false;
    let accountsFound = 0;

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const contentType = resp.headers.get('content-type') || '';
        const bodyText = await resp.text();
        const trimmed = bodyText.trim().slice(0, 1000);
        const htmlDetected = contentType.includes('text/html') || trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html');

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
            } catch {
              attempt.bodySnippet = trimmed;
            }
          } else {
            attempt.bodySnippet = trimmed;
          }
        } else {
          if (!htmlDetected && contentType.includes('application/json')) {
            try {
              const data = JSON.parse(bodyText);
              accountsFound = data.accounts?.length || 0;
              attempt.accountsFound = accountsFound;
            } catch {}
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

    if (anySuccess) {
      await markGoogleSyncSuccess(supabase, user.id);
    }

    return new Response(
      JSON.stringify({
        connected: true,
        tokenExpired: profileConnection?.token_expires_at ? new Date(profileConnection.token_expires_at) < new Date() : false,
        tokenExpiresAt: profileConnection?.token_expires_at,
        hasRefreshToken: !!profileConnection?.refresh_token,
        apiHealthy: anySuccess,
        accountsFound,
        accountEmail: profileConnection?.google_account_email ?? null,
        accountName: profileConnection?.google_account_name ?? null,
        accountPictureUrl: profileConnection?.google_account_picture_url ?? null,
        lastError: profileConnection?.last_error ?? null,
        apiTest: attempts[0] || null,
        apiTests: attempts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    try {
      const { supabase, user } = await createUserClient(req);
      await markGoogleError(supabase, user.id, error);
    } catch {}

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
