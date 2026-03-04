import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocations } from "@/hooks/useLocations";
import { ApiKeyManager } from "@/components/integrations/ApiKeyManager";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

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

const Integrations = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const { data: locations } = useLocations();
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const token = session?.access_token ?? null;

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

  useEffect(() => {
    if (token) {
      void loadConnection();
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
              Connect your other website through backend API keys, monitor connection health, and copy server-ready examples.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                setRefreshing(true);
                await loadConnection();
                setRefreshing(false);
              }}
              disabled={refreshing || loading || !token}
            >
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
          <ApiKeyManager baseUrl={baseUrl} token={token} />

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

            <Card className="p-6">
              <h2>Recommended connection flow</h2>
              <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>1. Create an API key for your backend.</li>
                <li>2. Save it in your other website's server secrets.</li>
                <li>3. Call Review Hub from your backend, not directly from the browser.</li>
                <li>4. Use sync on a schedule and fetch reviews or post replies on demand.</li>
              </ol>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Integrations;
