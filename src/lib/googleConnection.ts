const GOOGLE_BUSINESS_SCOPE = [
  "openid",
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export const startGoogleBusinessConnect = (returnTo = "/settings") => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error("Google Business connection is not configured.");
  }

  const state = btoa(JSON.stringify({ returnTo }));
  const redirectUri = `${window.location.origin}/auth/callback`;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_BUSINESS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  })}`;

  window.location.href = authUrl;
};

export const getReturnPathFromState = (state: string | null) => {
  if (!state) return "/settings";

  try {
    const parsed = JSON.parse(atob(state));
    return typeof parsed?.returnTo === "string" ? parsed.returnTo : "/settings";
  } catch {
    return "/settings";
  }
};
