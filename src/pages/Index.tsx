import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Star, LayoutDashboard, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-secondary to-background">
      {/* Navigation */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold">ReviewHub</h1>
          <Button onClick={() => navigate("/login")}>Get Started</Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl font-bold leading-tight">
              Manage Google Reviews
              <br />
              <span className="text-primary">Beautifully Simple</span>
            </h1>
            <p className="mb-8 text-xl text-muted-foreground">
              Centralize, simplify, and scale your reputation management with
              AI-assisted replies and secure bulk workflows.
            </p>
            <Button size="lg" onClick={() => navigate("/login")}>
              Continue with Google
            </Button>
          </div>

          {/* Features */}
          <div className="mx-auto mt-24 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Star className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">AI-Powered Replies</h3>
              <p className="text-sm text-muted-foreground">
                Auto-generate professional responses to every review with
                sentiment analysis
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <LayoutDashboard className="h-6 w-6 text-success" />
              </div>
              <h3 className="mb-2 font-semibold">Multi-Location Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Manage reviews across all your business locations from one
                central hub
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <Zap className="h-6 w-6 text-warning" />
              </div>
              <h3 className="mb-2 font-semibold">Bulk Actions</h3>
              <p className="text-sm text-muted-foreground">
                Approve and post multiple replies at once to save time and stay
                responsive
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
