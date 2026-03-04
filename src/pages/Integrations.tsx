import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocations } from "@/hooks/useLocations";
import { Copy, ExternalLink, KeyRound, Link2, RefreshCw, ShieldCheck, TerminalSquare } from "lucide-react";

interface ConnectionStatus {
  connected: boolean;
  status: string;
  googleAccountEmail: string | null;
  googleAccountName: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  lastRefreshedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  locationCount: number;
}

const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-v1`;

const formatDate = (value: string | null) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
};

const maskToken = (token: string | null) => {
  if (!token) return "No active session token";
  if (token.length <= 24) return token;
  return `${token.slice(0, 16)}••••${token.slice(-12)}`;
};

const Integrations = () => {
  const { toast } = useToast();
  const { session, user } = useAuth();
  const { data: locations } = useLocations();
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const token = session?.access_token ?? null;

  const examples = useMemo(() => {
    const authHeader = token ? `Bearer ${token}` : "Bearer YOUR_USER_TOKEN";

    return [
      {
        title: "List reviews",
        language: "curl",
        code: `curl -X GET "${baseUrl}/reviews?limit=10&page=1" \\\n  -H "Authorization: ${authHeader}"`,
      },
      {
        title: "Check connection health",
        language: "JavaScript",
        code: `const response = await fetch("${baseUrl}/connection/status", {
  headers: {
    Authorization: "${authHeader}",
  },
});

const data = await response.json();`,
      },
      {
        title: "Post a reply from another platform",
        language: "JavaScript",
        code: `await fetch("${baseUrl}/reviews/REVIEW_ID/reply", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: "${authHeader}",
  },
  body: JSON.stringify({ replyId: "DRAFT_REPLY_ID" }),
});`,
      },
    ];
  }, [token]);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: "Ready to paste into your integration." });
    } catch {
      toast({ title: `Couldn't copy ${label.toLowerCase()}`, description: "Copy it manually instead.", variant: "destructive" });
    }
  };

  const loadConnection = async () => {
    setLoading(true);
    try {
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${baseUrl}/connection/status`, { headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load connection status");
      }

      setConnection(data as ConnectionStatus);
    } catch (error) {
      toast({
        title: "Failed to load integrations",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConnection();
    setRefreshing(false);
  };

  useEffect(() => {
    if (token) {
      loadConnection();
    }
  }, [token]);

  return (
    <Layout>
      <div className="border-b border-border px-8 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">External platforms</p>
            <h1 className="mt-1">Integrations</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Use your signed-in user token to read reviews, monitor connection health, sync data, and post replies from another app.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing || loading || !token}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing || loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild>
              <Link to="/docs">Open docs</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-primary" />
                    <h2>User API token</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This bearer token lets external platforms call Review Hub on behalf of the currently signed-in user.
                  </p>
                </div>
                <Badge variant="outline">User token auth</Badge>
              </div>

              <div className="mt-5 rounded-xl border border-border bg-secondary p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current token</p>
                <code className="mt-3 block overflow-x-auto text-sm text-secondary-foreground">{maskToken(token)}</code>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Button onClick={() => copyText(token ?? "", "Token")} disabled={!token}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy token
                </Button>
                <Button variant="outline" onClick={() => copyText(baseUrl, "Base URL")}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Copy base URL
                </Button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm text-muted-foreground">Signed-in account</p>
                  <p className="mt-2 font-medium">{user?.email ?? "Not available"}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm text-muted-foreground">API base URL</p>
                  <p className="mt-2 break-all font-medium">{baseUrl}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <TerminalSquare className="h-5 w-5 text-primary" />
                <h2>Copy-paste examples</h2>
              </div>
              <div className="space-y-4">
                {examples.map((example) => (
                  <div key={example.title} className="rounded-xl border border-border p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{example.title}</p>
                        <p className="text-sm text-muted-foreground">{example.language}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => copyText(example.code, example.title)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-secondary p-4 text-sm text-secondary-foreground"><code>{example.code}</code></pre>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2>Connection health</h2>
              </div>

              <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="mt-2 font-medium">
                    {loading ? "Loading..." : connection?.connected ? "Connected" : "Needs reconnection"}
                  </p>
                </div>
                <Badge variant="outline">{connection?.status ?? "unknown"}</Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary p-3">
                  <span className="text-muted-foreground">Google account</span>
                  <span className="text-right">{connection?.googleAccountEmail ?? connection?.googleAccountName ?? "Not connected"}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary p-3">
                  <span className="text-muted-foreground">Last sync</span>
                  <span className="text-right">{formatDate(connection?.lastSyncAt ?? null)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary p-3">
                  <span className="text-muted-foreground">Last refresh</span>
                  <span className="text-right">{formatDate(connection?.lastRefreshedAt ?? null)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary p-3">
                  <span className="text-muted-foreground">Token expiry</span>
                  <span className="text-right">{formatDate(connection?.tokenExpiresAt ?? null)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary p-3">
                  <span className="text-muted-foreground">Locations</span>
                  <span className="text-right">{connection?.locationCount ?? locations?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg bg-secondary p-3">
                  <span className="text-muted-foreground">Granted scopes</span>
                  <span className="text-right">{connection?.scopes?.length ?? 0}</span>
                </div>
              </div>

              {connection?.lastError && (
                <div className="mt-4 rounded-xl border border-border p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Latest error</p>
                  <p className="mt-2">{connection.lastError}</p>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button asChild className="flex-1">
                  <Link to="/settings">Manage Google connection</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link to="/docs">
                    Full API reference
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Integrations;
