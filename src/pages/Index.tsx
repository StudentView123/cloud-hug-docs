import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Star, LayoutDashboard, Zap } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
const Index = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  return <div className="flex min-h-screen flex-col bg-gradient-to-b from-secondary to-background">
      {/* Navigation */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold">Review Hub</h1>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/pricing")}>Pricing</Button>
            <Button onClick={() => navigate("/login")}>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className={`container mx-auto px-4 ${isMobile ? 'py-12' : 'py-20'}`}>
          <div className="mx-auto max-w-3xl text-center">
            <h1 className={`mb-6 ${isMobile ? 'text-3xl' : 'text-5xl'} font-bold leading-tight`}>
              Manage Google Reviews
              <br />
              <span className="text-primary">Beautifully Simple</span>
            </h1>
            <p className={`mb-8 ${isMobile ? 'text-lg' : 'text-xl'} text-muted-foreground`}>
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

          {/* Demo Video Section */}
          <div className="mx-auto mt-24 max-w-4xl">
            <h2 className="mb-8 text-center text-2xl font-bold">See it in action</h2>
            <div className="overflow-hidden rounded-xl border border-border shadow-lg">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src="https://player.vimeo.com/video/1131961741"
                  className="absolute inset-0 h-full w-full"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title="Review Hub Demo"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-20">
        <div className="container mx-auto px-4 py-6 text-center">
          <div className="flex justify-center gap-6">
            <a href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Terms of Service
            </a>
            <a href="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Pricing
            </a>
          </div>
        </div>
      </footer>
    </div>;
};
export default Index;