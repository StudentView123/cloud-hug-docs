import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type UserClient = {
  supabase: SupabaseClient;
  user: { id: string; email?: string | null };
  jwt: string | null;
  authMode: "user_token" | "api_key";
  apiKey: string | null;
  apiKeyHash: string | null;
};

const getEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

const createAnonClient = (jwt: string) =>
  createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

const createServiceRoleClient = () =>
  createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

const hashApiKey = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const resolveBearerAuth = async (jwt: string): Promise<UserClient> => {
  const supabase = createAnonClient(jwt);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt);

  if (error || !user) {
    throw new Error("Not authenticated");
  }

  return {
    supabase,
    user: { id: user.id, email: user.email },
    jwt,
    authMode: "user_token",
    apiKey: null,
    apiKeyHash: null,
  };
};

const resolveApiKeyAuth = async (apiKey: string): Promise<UserClient> => {
  const supabase = createServiceRoleClient();
  const keyHash = await hashApiKey(apiKey);

  const { data: apiKeyRecord, error } = await supabase
    .from("api_keys")
    .select("user_id")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!apiKeyRecord) throw new Error("Invalid API key");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", apiKeyRecord.user_id)
    .maybeSingle();

  await supabase.rpc("touch_api_key_last_used", { _key_hash: keyHash });

  return {
    supabase,
    user: { id: apiKeyRecord.user_id, email: profile?.email ?? null },
    jwt: null,
    authMode: "api_key",
    apiKey,
    apiKeyHash: keyHash,
  };
};

export const createUserClient = async (req: Request): Promise<UserClient> => {
  const apiKey = req.headers.get("x-api-key")?.trim();
  if (apiKey) {
    return resolveApiKeyAuth(apiKey);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("No authorization header");
  }

  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    throw new Error("Not authenticated");
  }

  return resolveBearerAuth(jwt);
};

export const createInternalFunctionHeaders = (auth: UserClient) => ({
  ...(auth.jwt ? { Authorization: `Bearer ${auth.jwt}` } : {}),
  ...(auth.apiKey ? { "x-api-key": auth.apiKey } : {}),
  apikey: getEnv("SUPABASE_ANON_KEY"),
  "Content-Type": "application/json",
});

type GoogleConnectionRecord = {
  id: string;
  user_id: string;
  provider: string;
  connection_status: string;
  google_account_email: string | null;
  google_account_name: string | null;
  google_account_picture_url: string | null;
  scopes: string[];
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  last_refreshed_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

export const getGoogleConnection = async (supabase: SupabaseClient, userId: string) => {
  const { data, error } = await supabase
    .from("google_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as GoogleConnectionRecord | null;
};

export const getUserLocationIds = async (supabase: SupabaseClient, userId: string) => {
  const { data, error } = await supabase.from("locations").select("id").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((location) => location.id);
};

export const getOwnedReview = async (
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
  columns: string
) => {
  const locationIds = await getUserLocationIds(supabase, userId);
  if (locationIds.length === 0) return null;

  const { data, error } = await supabase
    .from("reviews")
    .select(columns)
    .eq("id", reviewId)
    .in("location_id", locationIds)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const persistConnectionStatus = async (
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<GoogleConnectionRecord>
) => {
  const { error } = await supabase
    .from("google_connections")
    .update(updates)
    .eq("user_id", userId)
    .eq("provider", "google");

  if (error) {
    console.error("Failed updating google connection", error);
  }
};

export const getValidGoogleAccessToken = async (supabase: SupabaseClient, userId: string) => {
  const connection = await getGoogleConnection(supabase, userId);

  if (!connection?.access_token) {
    throw new Error("Google account not connected");
  }

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : null;
  const shouldRefresh = !!connection.refresh_token && (!!expiresAt && expiresAt <= Date.now() + 60_000);

  if (!shouldRefresh) {
    await persistConnectionStatus(supabase, userId, {
      connection_status: "connected",
      last_error: null,
    });
    return { accessToken: connection.access_token, connection };
  }

  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: connection.refresh_token!,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshResponse.ok) {
    const body = await refreshResponse.text();
    await persistConnectionStatus(supabase, userId, {
      connection_status: "reauth_required",
      last_error: body,
    });
    throw new Error("Google connection needs to be re-authorized");
  }

  const refreshed = await refreshResponse.json();
  const nextAccessToken = refreshed.access_token as string;
  const nextExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  const nextScopes = typeof refreshed.scope === "string" ? refreshed.scope.split(" ") : connection.scopes;

  await persistConnectionStatus(supabase, userId, {
    access_token: nextAccessToken,
    token_expires_at: nextExpiresAt,
    last_refreshed_at: new Date().toISOString(),
    connection_status: "connected",
    last_error: null,
    scopes: nextScopes,
  });

  return {
    accessToken: nextAccessToken,
    connection: {
      ...connection,
      access_token: nextAccessToken,
      token_expires_at: nextExpiresAt,
      scopes: nextScopes,
      connection_status: "connected",
    },
  };
};

export const markGoogleSyncSuccess = async (supabase: SupabaseClient, userId: string) => {
  await persistConnectionStatus(supabase, userId, {
    last_sync_at: new Date().toISOString(),
    connection_status: "connected",
    last_error: null,
  });
};

export const markGoogleError = async (supabase: SupabaseClient, userId: string, error: unknown) => {
  await persistConnectionStatus(supabase, userId, {
    connection_status: "error",
    last_error: error instanceof Error ? error.message : String(error),
  });
};
