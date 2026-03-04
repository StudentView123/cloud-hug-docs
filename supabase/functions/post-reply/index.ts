import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createUserClient,
  getOwnedReview,
  getValidGoogleAccessToken,
  markGoogleError,
  markGoogleSyncSuccess,
} from "../_shared/google-connection.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { replyId, reviewId } = await req.json();
    const { supabase, user } = await createUserClient(req);
    const { accessToken } = await getValidGoogleAccessToken(supabase, user.id);

    const { data: reply, error: replyError } = await supabase
      .from("replies")
      .select("content, review_id")
      .eq("id", replyId)
      .eq("user_id", user.id)
      .single();

    if (replyError || !reply) {
      throw new Error("Reply not found or unauthorized");
    }

    const ownedReview = await getOwnedReview(
      supabase,
      user.id,
      reviewId || reply.review_id,
      "id, google_review_id"
    );

    if (!ownedReview?.google_review_id) {
      throw new Error("Review not found or unauthorized");
    }

    const googleApiUrl = `https://mybusiness.googleapis.com/v4/${ownedReview.google_review_id}/reply`;
    const googleResponse = await fetch(googleApiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: reply.content }),
    });

    if (!googleResponse.ok) {
      throw new Error(`Failed to post reply to Google: ${await googleResponse.text()}`);
    }

    const googleReplyData = await googleResponse.json();

    const { error: updateError } = await supabase
      .from("replies")
      .update({ status: "posted", posted_at: new Date().toISOString() })
      .eq("id", replyId)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    await supabase
      .from("reviews")
      .update({
        has_google_reply: true,
        google_reply_content: reply.content,
        google_reply_time: new Date().toISOString(),
        archived: true,
      })
      .eq("id", ownedReview.id);

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      review_id: ownedReview.id,
      action: "reply_posted",
      details: {
        reply_id: replyId,
        posted_at: new Date().toISOString(),
        google_reply: googleReplyData,
      },
    });

    await markGoogleSyncSuccess(supabase, user.id);

    return new Response(JSON.stringify({ success: true, message: "Reply posted to Google successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    try {
      const { supabase, user } = await createUserClient(req);
      await markGoogleError(supabase, user.id, error);
    } catch {
      // ignore secondary logging failures
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
