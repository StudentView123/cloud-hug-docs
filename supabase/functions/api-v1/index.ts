import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, createUserClient, getGoogleConnection } from "../_shared/google-connection.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const invokeInternalFunction = async (name: string, jwt: string, body?: unknown) => {
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }

  return { ok: true, status: response.status, data };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase, user, jwt } = await createUserClient(req);
    const url = new URL(req.url);
    const route = url.pathname.split("/api-v1")[1] || "/";
    const segments = route.split("/").filter(Boolean);

    if (req.method === "GET" && route === "/connection/status") {
      const [connection, locations] = await Promise.all([
        getGoogleConnection(supabase, user.id),
        supabase.from("locations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      return json({
        connected: !!connection?.access_token,
        status: connection?.connection_status ?? "disconnected",
        googleAccountEmail: connection?.google_account_email ?? null,
        googleAccountName: connection?.google_account_name ?? null,
        scopes: connection?.scopes ?? [],
        tokenExpiresAt: connection?.token_expires_at ?? null,
        lastRefreshedAt: connection?.last_refreshed_at ?? null,
        lastSyncAt: connection?.last_sync_at ?? null,
        lastError: connection?.last_error ?? null,
        locationCount: locations.count ?? 0,
      });
    }

    if (req.method === "GET" && route === "/locations") {
      const { data, error } = await supabase
        .from("locations")
        .select("id, google_location_id, name, address, rating, review_count, updated_at")
        .order("name", { ascending: true });

      if (error) throw error;
      return json({ data });
    }

    if (req.method === "GET" && segments[0] === "reviews" && segments.length === 1) {
      const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25), 1), 100);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from("reviews")
        .select(`
          id,
          google_review_id,
          location_id,
          author_name,
          author_photo_url,
          rating,
          text,
          sentiment,
          archived,
          has_google_reply,
          google_reply_content,
          google_reply_time,
          review_created_at,
          updated_at,
          location:locations(id, name, address),
          replies(id, content, status, is_ai_generated, created_at, posted_at, needs_review)
        `, { count: "exact" })
        .order("review_created_at", { ascending: false })
        .range(from, to);

      const locationId = url.searchParams.get("locationId");
      const rating = url.searchParams.get("rating");
      const archived = url.searchParams.get("archived");

      if (locationId) query = query.eq("location_id", locationId);
      if (rating) query = query.eq("rating", Number(rating));
      if (archived === "true" || archived === "false") query = query.eq("archived", archived === "true");

      const { data, error, count } = await query;
      if (error) throw error;

      return json({
        data,
        pagination: {
          page,
          limit,
          total: count ?? 0,
          hasMore: (count ?? 0) > to + 1,
        },
      });
    }

    if (req.method === "GET" && segments[0] === "reviews" && segments[1] && segments.length === 2) {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          id,
          google_review_id,
          location_id,
          author_name,
          author_photo_url,
          rating,
          text,
          sentiment,
          archived,
          has_google_reply,
          google_reply_content,
          google_reply_time,
          review_created_at,
          updated_at,
          location:locations(id, name, address),
          replies(id, content, status, is_ai_generated, created_at, posted_at, needs_review)
        `)
        .eq("id", segments[1])
        .single();

      if (error) throw error;
      return json({ data });
    }

    if (req.method === "POST" && segments[0] === "reviews" && segments[1] && segments[2] === "generate-reply") {
      const { data: review, error } = await supabase
        .from("reviews")
        .select("id, text, rating, author_name")
        .eq("id", segments[1])
        .single();

      if (error || !review) {
        return json({ error: "Review not found" }, 404);
      }

      const result = await invokeInternalFunction("generate-reply", jwt, {
        reviewId: review.id,
        reviewText: review.text ?? "",
        rating: review.rating,
        authorName: review.author_name,
      });

      return json(result.data, result.status);
    }

    if (req.method === "PUT" && segments[0] === "reviews" && segments[1] && segments[2] === "reply") {
      const body = await req.json().catch(() => ({}));
      let replyId = body.replyId as string | undefined;

      if (!replyId) {
        const { data: reply } = await supabase
          .from("replies")
          .select("id")
          .eq("review_id", segments[1])
          .eq("user_id", user.id)
          .eq("status", "draft")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        replyId = reply?.id;
      }

      if (!replyId) {
        return json({ error: "No draft reply found for this review" }, 404);
      }

      const result = await invokeInternalFunction("post-reply", jwt, {
        replyId,
        reviewId: segments[1],
      });

      return json(result.data, result.status);
    }

    if (req.method === "POST" && route === "/sync") {
      const body = await req.json().catch(() => ({}));
      const result = await invokeInternalFunction("fetch-reviews", jwt, body);
      return json(result.data, result.status);
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
