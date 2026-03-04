import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, Globe, RefreshCw, Trash2, Webhook } from "lucide-react";

interface WebhookEndpointRecord {
  id: string;
  label: string;
  targetUrl: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdAt: string;
  lastDeliveryAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  signingSecretHint: string;
}

interface WebhookDeliveryRecord {
  id: string;
  eventType: string;
  responseStatus: number | null;
  deliveredAt: string | null;
  failedAt: string | null;
  createdAt: string;
  endpointLabel: string | null;
  endpointUrl: string | null;
}

interface WebhookManagerProps {
  baseUrl: string;
  token: string | null;
}

const availableEvents = [
  { id: "review.created", label: "New reviews", description: "Sent after a sync inserts a brand-new review." },
  { id: "reply.status_changed", label: "Reply status changes", description: "Sent when a draft is generated or a reply is posted." },
];

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : "Never");

export function WebhookManager({ baseUrl, token }: WebhookManagerProps) {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(availableEvents.map((event) => event.id));
  const [endpoints, setEndpoints] = useState<WebhookEndpointRecord[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const copyText = async (value: string, labelText: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${labelText} copied`, description: "Ready for your backend." });
    } catch {
      toast({ title: `Couldn't copy ${labelText.toLowerCase()}`, variant: "destructive" });
    }
  };

  const loadData = async (showLoading = true) => {
    if (!token) return;
    if (showLoading) setLoading(true);

    try {
      const [endpointsResponse, deliveriesResponse] = await Promise.all([
        fetch(`${baseUrl}/webhooks`, { headers }),
        fetch(`${baseUrl}/webhooks/deliveries?limit=8`, { headers }),
      ]);

      const [endpointsData, deliveriesData] = await Promise.all([
        endpointsResponse.json(),
        deliveriesResponse.json(),
      ]);

      if (!endpointsResponse.ok) throw new Error(endpointsData.error || "Failed to load webhooks");
      if (!deliveriesResponse.ok) throw new Error(deliveriesData.error || "Failed to load deliveries");

      setEndpoints(endpointsData.data ?? []);
      setDeliveries(deliveriesData.data ?? []);
    } catch (error) {
      toast({
        title: "Failed to load webhooks",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const toggleEvent = (eventId: string, checked: boolean) => {
    setSelectedEvents((current) =>
      checked ? Array.from(new Set([...current, eventId])) : current.filter((value) => value !== eventId)
    );
  };

  const handleCreate = async () => {
    if (!token) return;
    if (!label.trim() || !targetUrl.trim()) {
      toast({ title: "Add a name and URL", variant: "destructive" });
      return;
    }
    if (selectedEvents.length === 0) {
      toast({ title: "Pick at least one event", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${baseUrl}/webhooks`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          label: label.trim(),
          targetUrl: targetUrl.trim(),
          subscribedEvents: selectedEvents,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create webhook");

      setEndpoints((current) => [data.endpoint, ...current]);
      setNewSecret(data.signingSecret);
      setLabel("");
      setTargetUrl("");
      setSelectedEvents(availableEvents.map((event) => event.id));
      toast({ title: "Webhook created", description: "Copy the signing secret now — it will only be shown once." });
    } catch (error) {
      toast({
        title: "Failed to create webhook",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (endpoint: WebhookEndpointRecord) => {
    if (!token) return;
    setTogglingId(endpoint.id);
    try {
      const response = await fetch(`${baseUrl}/webhooks/${endpoint.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isActive: !endpoint.isActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update webhook");
      setEndpoints((current) => current.map((item) => (item.id === endpoint.id ? data.endpoint : item)));
    } catch (error) {
      toast({
        title: "Failed to update webhook",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeletingId(id);
    try {
      const response = await fetch(`${baseUrl}/webhooks/${id}`, {
        method: "DELETE",
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete webhook");
      setEndpoints((current) => current.filter((item) => item.id !== id));
      setDeliveries((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      toast({
        title: "Failed to delete webhook",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              <h2>Outbound webhooks</h2>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Send signed events to your other website when new reviews arrive or reply statuses change.
            </p>
          </div>
          <Badge variant="outline">Automatic sync</Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Main site webhook" />
          <Input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://your-site.com/api/review-hub/webhook" />
        </div>

        <div className="mt-4 space-y-3 rounded-xl border border-border p-4">
          {availableEvents.map((event) => {
            const checked = selectedEvents.includes(event.id);
            return (
              <label key={event.id} className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={checked} onCheckedChange={(value) => toggleEvent(event.id, value === true)} />
                <div>
                  <p className="font-medium">{event.label}</p>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                </div>
              </label>
            );
          })}
        </div>

        {newSecret && (
          <div className="mt-5 rounded-xl border border-border bg-secondary p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Copy this signing secret now</p>
            <code className="mt-3 block overflow-x-auto text-sm text-secondary-foreground">{newSecret}</code>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => copyText(newSecret, "Signing secret")}>
                <Copy className="mr-2 h-4 w-4" />
                Copy secret
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={handleCreate} disabled={saving || !token}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Create webhook
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setRefreshing(true);
              void loadData(false);
            }}
            disabled={refreshing || loading || !token}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h2>Registered endpoints</h2>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Loading webhooks...</div>
          ) : endpoints.length === 0 ? (
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No webhooks yet. Create one to push updates to your other website automatically.</div>
          ) : (
            endpoints.map((endpoint) => (
              <div key={endpoint.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{endpoint.label}</p>
                      <Badge variant="outline">{endpoint.isActive ? "Active" : "Paused"}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{endpoint.targetUrl}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {endpoint.subscribedEvents.map((event) => (
                        <Badge key={event} variant="secondary">{event}</Badge>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                      <span>Created: {formatDate(endpoint.createdAt)}</span>
                      <span>Last delivery: {formatDate(endpoint.lastDeliveryAt)}</span>
                      <span>Last success: {formatDate(endpoint.lastSuccessAt)}</span>
                      <span>Secret hint: {endpoint.signingSecretHint}</span>
                    </div>
                    {endpoint.lastFailureReason && (
                      <p className="mt-3 text-sm text-muted-foreground">Last error: {endpoint.lastFailureReason}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => handleToggleActive(endpoint)} disabled={togglingId === endpoint.id}>
                      {togglingId === endpoint.id ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {endpoint.isActive ? "Pause" : "Resume"}
                    </Button>
                    <Button variant="outline" onClick={() => handleDelete(endpoint.id)} disabled={deletingId === endpoint.id}>
                      {deletingId === endpoint.id ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <h2>Recent deliveries</h2>
        </div>

        <div className="space-y-3">
          {deliveries.length === 0 ? (
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No deliveries yet. Trigger a sync or reply action to send events.</div>
          ) : (
            deliveries.map((delivery) => (
              <div key={delivery.id} className="rounded-xl border border-border p-4 text-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{delivery.eventType}</p>
                    <p className="text-muted-foreground">{delivery.endpointLabel ?? delivery.endpointUrl ?? "Unknown endpoint"}</p>
                  </div>
                  <Badge variant="outline">
                    {delivery.responseStatus ? `HTTP ${delivery.responseStatus}` : delivery.failedAt ? "Failed" : "Pending"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-muted-foreground md:grid-cols-2">
                  <span>Created: {formatDate(delivery.createdAt)}</span>
                  <span>Delivered: {formatDate(delivery.deliveredAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
