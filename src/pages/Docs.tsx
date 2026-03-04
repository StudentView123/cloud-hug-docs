import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BookOpen, KeyRound, RefreshCw, Send, ShieldCheck, Server, Webhook } from "lucide-react";

const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-v1`;

const endpoints = [
  { method: "GET", path: "/connection/status", note: "Returns connection health and account metadata." },
  { method: "GET", path: "/locations", note: "Lists locations available to the API key owner." },
  { method: "GET", path: "/reviews?limit=25&page=1", note: "Lists reviews with pagination and optional filters." },
  { method: "GET", path: "/reviews/:id", note: "Returns one review with its reply history." },
  { method: "POST", path: "/reviews/:id/generate-reply", note: "Creates an AI draft reply for a review." },
  { method: "PUT", path: "/reviews/:id/reply", note: "Posts a saved draft reply back to Google Business Profile." },
  { method: "POST", path: "/sync", note: "Triggers a sync for all or selected locations." },
];

const webhookPayloadExample = `{
  "id": "delivery-id",
  "type": "review.created",
  "createdAt": "2026-03-04T16:00:00.000Z",
  "data": {
    "review": {
      "id": "review-id",
      "rating": 5,
      "author_name": "Jane",
      "text": "Amazing service"
    },
    "source": "sync"
  }
}`;

const signatureExample = `const crypto = require("crypto");

function isValidReviewHubWebhook(rawBody, signature, timestamp, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + "." + rawBody)
    .digest("hex");

  return signature === "sha256=" + expected;
}`;

const Docs = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Review Hub API</p>
            <h1 className="mt-1">Backend integration docs</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/login">Open app</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/integrations">Manage API keys</Link>
            </Button>
            <Button asChild>
              <Link to="/settings">Manage connection</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-10 px-4 py-10">
        <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <Card className="p-6">
            <Badge variant="outline" className="mb-4">Server API keys</Badge>
            <h2 className="mb-3">Connect your other website through its backend</h2>
            <p className="max-w-3xl text-muted-foreground">
              Generate an API key in Integrations, store it in your backend secrets, and send it in the <code>x-api-key</code> header.
              Your frontend should call your own backend, not Review Hub directly.
            </p>
            <div className="mt-6 rounded-xl border border-border bg-secondary p-4">
              <p className="text-sm font-medium">Base URL</p>
              <code className="mt-2 block overflow-x-auto text-sm text-muted-foreground">{baseUrl}</code>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-primary" />
              <div>
                <h3>Authentication</h3>
                <p className="text-sm text-muted-foreground">Send <code>x-api-key</code> from a trusted backend environment.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-primary" />
              <div>
                <h3>Stable automation</h3>
                <p className="text-sm text-muted-foreground">Ideal for cron jobs, queues, background syncs, and server actions.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <h3>Scoped access</h3>
                <p className="text-sm text-muted-foreground">Every request is mapped back to the owning Review Hub account.</p>
              </div>
            </div>
          </Card>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2>Endpoints</h2>
          </div>
          <div className="space-y-3">
            {endpoints.map((endpoint) => (
              <Card key={endpoint.path} className="p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{endpoint.method}</Badge>
                      <code className="text-sm">{endpoint.path}</code>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{endpoint.note}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h2>cURL</h2>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"><code>{`curl -X GET "${baseUrl}/reviews?limit=10&page=1" \\
  -H "x-api-key: YOUR_API_KEY"`}</code></pre>
          </Card>

          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h2>Node / Express</h2>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"><code>{`const response = await fetch("${baseUrl}/reviews?limit=10&page=1", {
  headers: {
    "x-api-key": process.env.REVIEW_HUB_API_KEY,
  },
});

const data = await response.json();`}</code></pre>
          </Card>

          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h2>Laravel / PHP</h2>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"><code>{`$response = Http::withHeaders([
    'x-api-key' => env('REVIEW_HUB_API_KEY'),
])->post('${baseUrl}/sync', [
    'location_ids' => [],
]);

$data = $response->json();`}</code></pre>
          </Card>

          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h2>Reply flow</h2>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"><code>{`await fetch("${baseUrl}/reviews/REVIEW_ID/generate-reply", {
  method: "POST",
  headers: {
    "x-api-key": process.env.REVIEW_HUB_API_KEY,
    "Content-Type": "application/json",
  },
});

await fetch("${baseUrl}/reviews/REVIEW_ID/reply", {
  method: "PUT",
  headers: {
    "x-api-key": process.env.REVIEW_HUB_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ replyId: "DRAFT_REPLY_ID" }),
});`}</code></pre>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              <h2>Webhook events</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p><code>review.created</code> fires when a sync inserts a brand-new review.</p>
              <p><code>reply.status_changed</code> fires when a draft reply is generated or a reply becomes posted.</p>
              <p>Each delivery includes <code>x-review-hub-event</code>, <code>x-review-hub-delivery</code>, <code>x-review-hub-timestamp</code>, and <code>x-review-hub-signature</code>.</p>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"><code>{webhookPayloadExample}</code></pre>
          </Card>

          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2>Verify the signature</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Use the signing secret shown once when you create the webhook endpoint in Integrations.
            </p>
            <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"><code>{signatureExample}</code></pre>
          </Card>
        </section>

        <section>
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <Send className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h2 className="mb-2">Recommended architecture</h2>
                <p className="text-muted-foreground">
                  Your other website's backend stores the API key, receives signed webhook events, and uses Review Hub API calls only when it needs more detail or wants to trigger a sync.
                </p>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Docs;
