import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, createUserClient } from "../_shared/google-connection.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    const { supabase, user } = await createUserClient(req);

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth credentials not configured");
    }

    const redirectUri = `${req.headers.get("origin")}/auth/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to exchange authorization code: ${error}`);
    }

    const tokens = await tokenResponse.json();
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch Google account details");
    }

    const userInfo = await userInfoResponse.json();
    const existingConnection = await (supabase as any)
      .from("google_connections")
      .select("refresh_token")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle();

    const { error: upsertError } = await (supabase as any)
      .from("google_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "google",
          connection_status: "connected",
          google_account_email: userInfo.email ?? null,
          google_account_name: userInfo.name ?? null,
          google_account_picture_url: userInfo.picture ?? null,
          scopes: typeof tokens.scope === "string" ? tokens.scope.split(" ") : [],
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? existingConnection.data?.refresh_token ?? null,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          last_refreshed_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      throw upsertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        account: {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
