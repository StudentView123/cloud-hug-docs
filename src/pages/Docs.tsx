import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BookOpen, KeyRound, RefreshCw, Send, ShieldCheck } from "lucide-react";

const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-v1`;

const endpoints = [
  { method: "GET", path: "/connection/status", note: "Returns connection health and account metadata." },
  { method: "GET", path: "/locations", note: "Lists the signed-in user's synced locations." },
  { method: "GET", path: "/reviews?limit=25&page=1", note: "Lists reviews with pagination and filters." },
  { method: "GET", path: "/reviews/:id", note: "Returns a single review with replies." },
  { method: "POST", path: "/reviews/:id/generate-reply", note: "Creates an AI draft reply for a review." },
  { method: "PUT", path: "/reviews/:id/reply", note: "Posts a draft reply back to Google Business Profile." },
  { method: "POST", path: "/sync", note: "Triggers a review sync, optionally for specific locations." },
];

const Docs = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Review Hub API</p>
            <h1 className="mt-1">Integration docs</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/login">Open app</Link>
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
            <Badge variant="outline" className="mb-4">User token auth</Badge>
            <h2 className="mb-3">Use your existing session to call Review Hub from another app</h2>
            <p className="max-w-3xl text-muted-foreground">
              Sign in once, connect Google Business once, then use the same bearer token to read reviews,
              sync data, generate drafts, and post replies from your other platform.
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
                <h3>Auth flow</h3>
                <p className="text-sm text-muted-foreground">Bearer token from the signed-in user session.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-primary" />
              <div>
                <h3>Durable Google connection</h3>
                <p className="text-sm text-muted-foreground">Refresh tokens are stored separately from app login.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <h3>Scoped access</h3>
                <p className="text-sm text-muted-foreground">Every request runs inside the current user's data boundary.</p>
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
            <h2 className="mb-3">Get an access token</h2>
            <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"><code>{`const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;`}</code></pre>
          </Card>

          <Card className="p-6">
            <h2 className="mb-3">Fetch reviews</h2>
            <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"><code>{`const response = await fetch("${baseUrl}/reviews?limit=10&page=1", {
  headers: {
    Authorization: \`Bearer \${token}\`,
  },
});

const data = await response.json();`}</code></pre>
          </Card>

          <Card className="p-6">
            <h2 className="mb-3">Generate a draft reply</h2>
            <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"><code>{`await fetch("${baseUrl}/reviews/REVIEW_ID/generate-reply", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${token}\`,
  },
});`}</code></pre>
          </Card>

          <Card className="p-6">
            <h2 className="mb-3">Post a reply</h2>
            <pre className="overflow-x-auto rounded-xl bg-secondary p-4 text-sm text-secondary-foreground"><code>{`await fetch("${baseUrl}/reviews/REVIEW_ID/reply", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${token}\`,
  },
  body: JSON.stringify({ replyId: "DRAFT_REPLY_ID" }),
});`}</code></pre>
          </Card>
        </section>

        <section>
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <Send className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h2 className="mb-2">What comes next</h2>
                <p className="text-muted-foreground">
                  This first docs surface is intentionally simple: user-token auth, the core review endpoints,
                  and a stable base URL. Next we can add webhooks, SDK snippets, changelogs, and a branded docs shell.
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
