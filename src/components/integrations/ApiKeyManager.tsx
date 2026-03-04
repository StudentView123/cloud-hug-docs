import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, KeyRound, RefreshCw, ShieldCheck, TerminalSquare, Trash2 } from "lucide-react";

interface ApiKeyRecord {
  id: string;
  label: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface ApiKeyManagerProps {
  baseUrl: string;
  token: string | null;
}

const formatDate = (value: string | null) => {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
};

const maskKeyPrefix = (value: string) => `${value}••••••••`;

export function ApiKeyManager({ baseUrl, token }: ApiKeyManagerProps) {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const examples = useMemo(
    () => [
      {
        title: "List reviews",
        language: "cURL",
        code: `curl -X GET "${baseUrl}/reviews?limit=10&page=1" \\\n  -H "x-api-key: YOUR_API_KEY"`,
      },
      {
        title: "Node / Express",
        language: "JavaScript",
        code: `const response = await fetch("${baseUrl}/reviews?limit=10&page=1", {
  headers: {
    "x-api-key": process.env.REVIEW_HUB_API_KEY,
  },
});

const data = await response.json();`,
      },
      {
        title: "Laravel / PHP",
        language: "PHP",
        code: `$response = Http::withHeaders([
    'x-api-key' => env('REVIEW_HUB_API_KEY'),
])->get('${baseUrl}/connection/status');

$data = $response->json();`,
      },
      {
        title: "Trigger sync from cron",
        language: "cURL",
        code: `curl -X POST "${baseUrl}/sync" \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: YOUR_API_KEY" \\\n  -d '{"location_ids":[]}'`,
      },
    ],
    [baseUrl]
  );

  const copyText = async (value: string, labelText: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${labelText} copied`, description: "Ready to paste into your backend." });
    } catch {
      toast({
        title: `Couldn't copy ${labelText.toLowerCase()}`,
        description: "Copy it manually instead.",
        variant: "destructive",
      });
    }
  };

  const getHeaders = () => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  const loadApiKeys = async (showLoadingState = true) => {
    if (!token) return;

    if (showLoadingState) setLoading(true);
    try {
      const response = await fetch(`${baseUrl}/api-keys`, {
        headers: getHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load API keys");
      }

      setApiKeys(data.data ?? []);
    } catch (error) {
      toast({
        title: "Failed to load API keys",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      if (showLoadingState) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadApiKeys();
  }, [token]);

  const handleCreateKey = async () => {
    if (!token) return;

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      toast({ title: "Add a label", description: "Use a clear name for the backend using this key.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${baseUrl}/api-keys`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ label: trimmedLabel }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create API key");
      }

      setNewSecret(data.apiKey);
      setLabel("");
      setApiKeys((current) => [data.key, ...current]);
      toast({ title: "API key created", description: "Copy it now — it won't be shown again." });
    } catch (error) {
      toast({
        title: "Failed to create API key",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!token) return;

    setRevokingId(id);
    try {
      const response = await fetch(`${baseUrl}/api-keys/${id}/revoke`, {
        method: "POST",
        headers: getHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to revoke API key");
      }

      setApiKeys((current) => current.map((key) => (key.id === id ? data.key : key)));
      toast({ title: "API key revoked", description: "That backend can no longer access Review Hub." });
    } catch (error) {
      toast({
        title: "Failed to revoke API key",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h2>Server API keys</h2>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Create long-lived keys for your other website's backend. Store them in backend secrets, then send them as <code>x-api-key</code>.
            </p>
          </div>
          <Badge variant="outline">Server-to-server auth</Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Main website backend"
            aria-label="API key label"
          />
          <Button onClick={handleCreateKey} disabled={creating || !token}>
            {creating ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Create API key
          </Button>
        </div>

        {newSecret && (
          <div className="mt-5 rounded-xl border border-border bg-secondary p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Copy this now</p>
                <code className="mt-3 block overflow-x-auto text-sm text-secondary-foreground">{newSecret}</code>
              </div>
              <Button variant="outline" onClick={() => copyText(newSecret, "API key")}>
                <Copy className="mr-2 h-4 w-4" />
                Copy key
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => copyText(baseUrl, "Base URL")}>
            <Copy className="mr-2 h-4 w-4" />
            Copy base URL
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setRefreshing(true);
              void loadApiKeys(false);
            }}
            disabled={refreshing || loading || !token}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh keys
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2>Active credentials</h2>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No API keys yet. Create one for your other website backend.</div>
          ) : (
            apiKeys.map((key) => {
              const isRevoked = !!key.revokedAt;
              return (
                <div key={key.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{key.label}</p>
                        <Badge variant="outline">{isRevoked ? "Revoked" : "Active"}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{maskKeyPrefix(key.keyPrefix)}</p>
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                        <span>Created: {formatDate(key.createdAt)}</span>
                        <span>Last used: {formatDate(key.lastUsedAt)}</span>
                        <span>Revoked: {formatDate(key.revokedAt)}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleRevokeKey(key.id)}
                      disabled={isRevoked || revokingId === key.id}
                    >
                      {revokingId === key.id ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <TerminalSquare className="h-5 w-5 text-primary" />
          <h2>Backend examples</h2>
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
  );
}
