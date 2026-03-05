import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

type WebhookEndpointRecord = {
  id: string;
  user_id: string;
  label?: string;
  target_url: string;
  signing_secret: string;
};

type WebhookEventType = "review.created" | "reply.status_changed";
type WebhookResourceType = "review" | "reply";

type SendWebhookInput = {
  supabase: SupabaseClient;
  endpoint: WebhookEndpointRecord;
  userId: string;
  eventType: WebhookEventType;
  resourceType: WebhookResourceType;
  resourceId: string;
  payload: Record<string, unknown>;
};

type EmitWebhookEventInput = {
  supabase: SupabaseClient;
  userId: string;
  eventType: WebhookEventType;
  resourceType: WebhookResourceType;
  resourceId: string;
  payload: Record<string, unknown>;
};

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const signPayload = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
};

const truncate = (value: string | null | undefined, limit = 1500) => {
  if (!value) return null;
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
};

const updateEndpointStatus = async (
  supabase: SupabaseClient,
  endpointId: string,
  status: {
    last_delivery_at: string;
    last_success_at?: string | null;
    last_failure_at?: string | null;
    last_failure_reason?: string | null;
  }
) => {
  await supabase.from("webhook_endpoints").update(status).eq("id", endpointId);
};

const sendWebhook = async ({
  supabase,
  endpoint,
  userId,
  eventType,
  resourceType,
  resourceId,
  payload,
}: SendWebhookInput) => {
  const eventId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const body = JSON.stringify({
    id: eventId,
    type: eventType,
    createdAt,
    data: payload,
  });

  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .insert({
      endpoint_id: endpoint.id,
      user_id: userId,
      event_type: eventType,
      event_id: eventId,
      resource_type: resourceType,
      resource_id: resourceId,
      payload,
    })
    .select("id")
    .single();

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await signPayload(endpoint.signing_secret, `${timestamp}.${body}`);
  const attemptedAt = new Date().toISOString();

  try {
    const response = await fetch(endpoint.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-review-hub-event": eventType,
        "x-review-hub-delivery": eventId,
        "x-review-hub-timestamp": timestamp,
        "x-review-hub-signature": `sha256=${signature}`,
      },
      body,
    });

    const responseBody = truncate(await response.text().catch(() => ""));
    const wasSuccessful = response.ok;

    if (delivery?.id) {
      await supabase
        .from("webhook_deliveries")
        .update({
          response_status: response.status,
          response_body: responseBody,
          delivered_at: wasSuccessful ? attemptedAt : null,
          failed_at: wasSuccessful ? null : attemptedAt,
        })
        .eq("id", delivery.id);
    }

    await updateEndpointStatus(supabase, endpoint.id, {
      last_delivery_at: attemptedAt,
      last_success_at: wasSuccessful ? attemptedAt : null,
      last_failure_at: wasSuccessful ? null : attemptedAt,
      last_failure_reason: wasSuccessful ? null : truncate(responseBody ?? `HTTP ${response.status}`),
    });

    return { ok: wasSuccessful, status: response.status, deliveryId: delivery?.id ?? null };
  } catch (error) {
    const reason = truncate(error instanceof Error ? error.message : String(error));

    if (delivery?.id) {
      await supabase
        .from("webhook_deliveries")
        .update({
          response_body: reason,
          failed_at: attemptedAt,
        })
        .eq("id", delivery.id);
    }

    await updateEndpointStatus(supabase, endpoint.id, {
      last_delivery_at: attemptedAt,
      last_success_at: null,
      last_failure_at: attemptedAt,
      last_failure_reason: reason,
    });

    return { ok: false, status: null, deliveryId: delivery?.id ?? null, error: reason };
  }
};

export const emitWebhookEvent = async ({
  supabase,
  userId,
  eventType,
  resourceType,
  resourceId,
  payload,
}: EmitWebhookEventInput) => {
  const { data: endpoints, error } = await supabase
    .from("webhook_endpoints")
    .select("id, user_id, target_url, signing_secret")
    .eq("user_id", userId)
    .eq("is_active", true)
    .contains("subscribed_events", [eventType]);

  if (error) {
    console.error("Failed to load webhook endpoints", error);
    return;
  }

  if (!endpoints?.length) return;

  await Promise.allSettled(
    (endpoints as WebhookEndpointRecord[]).map((endpoint) =>
      sendWebhook({
        supabase,
        endpoint,
        userId,
        eventType,
        resourceType,
        resourceId,
        payload,
      })
    )
  );
};

export const sendTestWebhook = async ({
  supabase,
  endpoint,
  userId,
}: {
  supabase: SupabaseClient;
  endpoint: WebhookEndpointRecord;
  userId: string;
}) => {
  const createdAt = new Date().toISOString();

  return sendWebhook({
    supabase,
    endpoint,
    userId,
    eventType: "review.created",
    resourceType: "review",
    resourceId: crypto.randomUUID(),
    payload: {
      test: true,
      endpointLabel: endpoint.label ?? null,
      message: "This is a test webhook delivery from Review Hub.",
      review: {
        id: crypto.randomUUID(),
        authorName: "Test Customer",
        rating: 5,
        text: "This is a sample review payload for webhook verification.",
        createdAt,
      },
    },
  });
};
