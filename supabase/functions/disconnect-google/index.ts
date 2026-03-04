import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, createUserClient } from "../_shared/google-connection.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await createUserClient(req);

    const { error } = await (supabase as any)
      .from("google_connections")
      .update({
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        connection_status: "disconnected",
        last_error: null,
      })
      .eq("user_id", user.id)
      .eq("provider", "google");

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, message: "Google account disconnected successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
