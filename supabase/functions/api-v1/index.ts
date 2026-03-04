import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createInternalFunctionHeaders,
  createUserClient,
  getGoogleConnection,
  getOwnedReview,
  getUserLocationIds,
  type UserClient,
} from "../_shared/google-connection.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const invokeInternalFunction = async (name: string, auth: UserClient, body?: unknown) => {
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`, {
    method: "POST",
    headers: createInternalFunctionHeaders(auth),
    body: JSON.stringify(body ?? {}),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }

  return { ok: true, status: response.status, data };
};

const createSecretValue = (prefix: string, bytesLength = 24) => {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  const secret = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${prefix}_${secret}`;
};

const hashValue = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const normalizeApiKey = (row: {
  id: string;
  label: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}) => ({
  id: row.id,
  label: row.label,
  keyPrefix: row.key_prefix,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
  revokedAt: row.revoked_at,
});

const allowedWebhookEvents = ["review.created", "reply.status_changed"] as const;
type AllowedWebhookEvent = (typeof allowedWebhookEvents)[number];

const normalizeWebhookEvents = (events: unknown): AllowedWebhookEvent[] => {
  if (!Array.isArray(events)) return [...allowedWebhookEvents];
  const filtered = events.filter((event): event is AllowedWebhookEvent =>
    typeof event === "string" && allowedWebhookEvents.includes(event as AllowedWebhookEvent)
  );
  return filtered.length > 0 ? Array.from(new Set(filtered)) : [...allowedWebhookEvents];
};

const normalizeWebhookEndpoint = (row: {
  id: string;
  label: string;
  target_url: string;
  subscribed_events: string[];
  is_active: boolean;
  created_at: string;
  last_delivery_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_reason: string | null;
  signing_secret_hint: string;
}) => ({
  id: row.id,
  label: row.label,
  targetUrl: row.target_url,
  subscribedEvents: row.subscribed_events,
  isActive: row.is_active,
  createdAt: row.created_at,
  lastDeliveryAt: row.last_delivery_at,
  lastSuccessAt: row.last_success_at,
  lastFailureAt: row.last_failure_at,
  lastFailureReason: row.last_failure_reason,
  signingSecretHint: row.signing_secret_hint,
});

const normalizeWebhookDelivery = (row: {
  id: string;
  event_type: string;
  response_status: number | null;
  delivered_at: string | null;
  failed_at: string | null;
  created_at: string;
  endpoint?: { label?: string | null; target_url?: string | null } | null;
}) => ({
  id: row.id,
  eventType: row.event_type,
  responseStatus: row.response_status,
  deliveredAt: row.delivered_at,
  failedAt: row.failed_at,
  createdAt: row.created_at,
  endpointLabel: row.endpoint?.label ?? null,
  endpointUrl: row.endpoint?.target_url ?? null,
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await createUserClient(req);
    const { supabase, user } = auth;
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
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      return json({ data });
    }

    if (req.method === "GET" && route === "/api-keys") {
      if (auth.authMode !== "user_token") {
        return json({ error: "API key management requires a signed-in session" }, 403);
      }

      const { data, error } = await supabase
        .from("api_keys")
        .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return json({ data: (data ?? []).map(normalizeApiKey) });
    }

    if (req.method === "POST" && route === "/api-keys") {
      if (auth.authMode !== "user_token") {
        return json({ error: "API key management requires a signed-in session" }, 403);
      }

      const body = await req.json().catch(() => ({}));
      const label = typeof body.label === "string" ? body.label.trim() : "";
      if (!label) {
        return json({ error: "Label is required" }, 400);
      }

      const apiKey = createSecretValue("rh_live");
      const keyHash = await hashValue(apiKey);
      const keyPrefix = apiKey.slice(0, 14);

      const { data, error } = await supabase
        .from("api_keys")
        .insert({
          user_id: user.id,
          label,
          key_prefix: keyPrefix,
          key_hash: keyHash,
        })
        .select("id, label, key_prefix, created_at, last_used_at, revoked_at")
        .single();

      if (error) throw error;
      return json({ apiKey, key: normalizeApiKey(data) }, 201);
    }

    if (req.method === "POST" && segments[0] === "api-keys" && segments[1] && segments[2] === "revoke") {
      if (auth.authMode !== "user_token") {
        return json({ error: "API key management requires a signed-in session" }, 403);
      }

      const { data, error } = await supabase.rpc("revoke_api_key", { _api_key_id: segments[1] });
      if (error) throw error;
      if (!data) return json({ error: "API key not found" }, 404);

      return json({ key: normalizeApiKey(data) });
    }

    if (req.method === "GET" && route === "/webhooks/deliveries") {
      if (auth.authMode !== "user_token") {
        return json({ error: "Webhook management requires a signed-in session" }, 403);
      }

      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 50);
      const { data, error } = await supabase
        .from("webhook_deliveries")
        .select("id, event_type, response_status, delivered_at, failed_at, created_at, endpoint:webhook_endpoints(label, target_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return json({ data: (data ?? []).map(normalizeWebhookDelivery) });
    }

    if (req.method === "GET" && route === "/webhooks") {
      if (auth.authMode !== "user_token") {
        return json({ error: "Webhook management requires a signed-in session" }, 403);
      }

      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select("id, label, target_url, subscribed_events, is_active, created_at, last_delivery_at, last_success_at, last_failure_at, last_failure_reason, signing_secret_hint")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return json({ data: (data ?? []).map(normalizeWebhookEndpoint) });
    }

    if (req.method === "POST" && route === "/webhooks") {
      if (auth.authMode !== "user_token") {
        return json({ error: "Webhook management requires a signed-in session" }, 403);
      }

      const body = await req.json().catch(() => ({}));
      const label = typeof body.label === "string" ? body.label.trim() : "";
      const targetUrl = typeof body.targetUrl === "string" ? body.targetUrl.trim() : "";
      const subscribedEvents = normalizeWebhookEvents(body.subscribedEvents);

      if (!label || !targetUrl) {
        return json({ error: "Label and target URL are required" }, 400);
      }

      try {
        const parsedUrl = new URL(targetUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          return json({ error: "Webhook URL must start with http or https" }, 400);
        }
      } catch {
        return json({ error: "Webhook URL is invalid" }, 400);
      }

      const signingSecret = createSecretValue("whsec", 32);
      const signingSecretHash = await hashValue(signingSecret);
      const signingSecretHint = `${signingSecret.slice(0, 10)}••••••`;

      const { data, error } = await supabase
        .from("webhook_endpoints")
        .insert({
          user_id: user.id,
          label,
          target_url: targetUrl,
          signing_secret: signingSecret,
          signing_secret_hash: signingSecretHash,
          signing_secret_hint: signingSecretHint,
          subscribed_events: subscribedEvents,
        })
        .select("id, label, target_url, subscribed_events, is_active, created_at, last_delivery_at, last_success_at, last_failure_at, last_failure_reason, signing_secret_hint")
        .single();

      if (error) throw error;
      return json({ endpoint: normalizeWebhookEndpoint(data), signingSecret }, 201);
    }

    if (req.method === "PATCH" && segments[0] === "webhooks" && segments[1]) {
      if (auth.authMode !== "user_token") {
        return json({ error: "Webhook management requires a signed-in session" }, 403);
      }

      const body = await req.json().catch(() => ({}));
      const updates: Record<string, unknown> = {};

      if (typeof body.label === "string" && body.label.trim()) updates.label = body.label.trim();
      if (typeof body.targetUrl === "string" && body.targetUrl.trim()) {
        try {
          const parsedUrl = new URL(body.targetUrl.trim());
          if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            return json({ error: "Webhook URL must start with http or https" }, 400);
          }
        } catch {
          return json({ error: "Webhook URL is invalid" }, 400);
        }
        updates.target_url = body.targetUrl.trim();
      }
      if (Array.isArray(body.subscribedEvents)) updates.subscribed_events = normalizeWebhookEvents(body.subscribedEvents);
      if (typeof body.isActive === "boolean") updates.is_active = body.isActive;

      if (Object.keys(updates).length === 0) {
        return json({ error: "No valid webhook updates provided" }, 400);
      }

      const { data, error } = await supabase
        .from("webhook_endpoints")
        .update(updates)
        .eq("id", segments[1])
        .eq("user_id", user.id)
        .select("id, label, target_url, subscribed_events, is_active, created_at, last_delivery_at, last_success_at, last_failure_at, last_failure_reason, signing_secret_hint")
        .single();

      if (error) throw error;
      return json({ endpoint: normalizeWebhookEndpoint(data) });
    }

    if (req.method === "DELETE" && segments[0] === "webhooks" && segments[1]) {
      if (auth.authMode !== "user_token") {
        return json({ error: "Webhook management requires a signed-in session" }, 403);
      }

      const { error } = await supabase.from("webhook_endpoints").delete().eq("id", segments[1]).eq("user_id", user.id);
      if (error) throw error;
      return json({ success: true });
    }

    const locationIds = await getUserLocationIds(supabase, user.id);

    if (req.method === "GET" && segments[0] === "reviews" && segments.length === 1) {
      const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25), 1), 100);
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      if (locationIds.length === 0) {
        return json({ data: [], pagination: { page, limit, total: 0, hasMore: false } });
      }

      let query = supabase
        .from("reviews")
        .select(
          `
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
        `,
          { count: "exact" }
        )
        .in("location_id", locationIds)
        .order("review_created_at", { ascending: false })
        .range(from, to);

      const locationId = url.searchParams.get("locationId");
      const rating = url.searchParams.get("rating");
      const archived = url.searchParams.get("archived");

      if (locationId && locationIds.includes(locationId)) query = query.eq("location_id", locationId);
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
      const data = await getOwnedReview(
        supabase,
        user.id,
        segments[1],
        `
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
        `
      );

      if (!data) return json({ error: "Review not found" }, 404);
      return json({ data });
    }

    if (req.method === "POST" && segments[0] === "reviews" && segments[1] && segments[2] === "generate-reply") {
      const review = await getOwnedReview(supabase, user.id, segments[1], "id, text, rating, author_name");

      if (!review) {
        return json({ error: "Review not found" }, 404);
      }

      const result = await invokeInternalFunction("generate-reply", auth, {
        reviewId: review.id,
        reviewText: review.text ?? "",
        rating: review.rating,
        authorName: review.author_name,
      });

      return json(result.data, result.status);
    }

    if (req.method === "PUT" && segments[0] === "reviews" && segments[1] && segments[2] === "reply") {
      const ownedReview = await getOwnedReview(supabase, user.id, segments[1], "id");
      if (!ownedReview) {
        return json({ error: "Review not found" }, 404);
      }

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

      const result = await invokeInternalFunction("post-reply", auth, {
        replyId,
        reviewId: segments[1],
      });

      return json(result.data, result.status);
    }

    if (req.method === "POST" && route === "/sync") {
      const body = await req.json().catch(() => ({}));
      const result = await invokeInternalFunction("fetch-reviews", auth, body);
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
