import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, TrendingUp } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const Pricing = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const packages = [
    {
      name: "Starter",
      credits: 5,
      price: 2.50,
      priceId: "price_1SW07eGKOTYzY5Wxx0hYa4xr",
      perCredit: 0.50,
      icon: Zap,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      name: "Growth",
      credits: 15,
      price: 6.00,
      priceId: "price_1SW07wGKOTYzY5WxSAeptol8",
      perCredit: 0.40,
      popular: true,
      icon: Sparkles,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      name: "Pro",
      credits: 30,
      price: 10.50,
      priceId: "price_1SW08BGKOTYzY5WxYSGbGe1h",
      perCredit: 0.35,
      icon: TrendingUp,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  const features = [
    "AI-powered review responses",
    "Multi-location support",
    "Bulk reply generation",
    "Custom tone & style settings",
    "Training examples library",
    "Quick reply templates",
    "Sentiment analysis",
    "Review audit insights",
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-secondary to-background">
      {/* Navigation */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-bold cursor-pointer" onClick={() => navigate("/")}>
            Review Hub
          </h1>
          <Button onClick={() => navigate("/login")}>Get Started</Button>
        </div>
      </header>

      <main className="flex-1">
        <div className={`container mx-auto px-4 ${isMobile ? 'py-12' : 'py-20'}`}>
          {/* Hero Section */}
          <div className="mx-auto max-w-3xl text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              Simple, Credit-Based Pricing
            </Badge>
            <h1 className={`mb-6 ${isMobile ? 'text-3xl' : 'text-5xl'} font-bold leading-tight`}>
              Pay Only for What You Use
            </h1>
            <p className={`mb-4 ${isMobile ? 'text-lg' : 'text-xl'} text-muted-foreground`}>
              No subscriptions. No hidden fees. Just simple credits that power your AI-generated review responses.
            </p>
            <p className="text-sm text-muted-foreground">
              1 credit = 1 AI-generated review reply
            </p>
          </div>

          {/* Pricing Cards */}
          <div className={`mx-auto max-w-6xl grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'} mb-20`}>
            {packages.map((pkg) => {
              const Icon = pkg.icon;
              return (
                <Card
                  key={pkg.name}
                  className={`relative p-6 ${
                    pkg.popular ? 'border-primary shadow-lg scale-105' : ''
                  } transition-all hover:shadow-xl`}
                >
                  {pkg.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Most Popular
                    </Badge>
                  )}
                  
                  <div className="text-center mb-6">
                    <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl ${pkg.bgColor}`}>
                      <Icon className={`h-8 w-8 ${pkg.color}`} />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{pkg.name}</h3>
                    <div className="mb-4">
                      <span className="text-4xl font-bold">${pkg.price}</span>
                    </div>
                    <p className="text-muted-foreground">
                      {pkg.credits} credits
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ${pkg.perCredit.toFixed(2)} per credit
                    </p>
                  </div>

                  <Button
                    className="w-full mb-4"
                    variant={pkg.popular ? "default" : "outline"}
                    onClick={() => navigate("/login")}
                  >
                    Get Started
                  </Button>

                  <div className="text-xs text-center text-muted-foreground">
                    Credits never expire
                  </div>
                </Card>
              );
            })}
          </div>

          {/* How It Works */}
          <div className="mx-auto max-w-4xl mb-20">
            <h2 className={`text-center ${isMobile ? 'text-2xl' : 'text-3xl'} font-bold mb-12`}>
              How Credits Work
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xl">
                  1
                </div>
                <h3 className="font-semibold mb-2">Buy Credits</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a package that fits your needs. Credits never expire.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xl">
                  2
                </div>
                <h3 className="font-semibold mb-2">Generate Replies</h3>
                <p className="text-sm text-muted-foreground">
                  Each AI-generated review response uses 1 credit.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xl">
                  3
                </div>
                <h3 className="font-semibold mb-2">Buy More Anytime</h3>
                <p className="text-sm text-muted-foreground">
                  Top up whenever you need. No contracts or commitments.
                </p>
              </div>
            </div>
          </div>

          {/* Features Included */}
          <div className="mx-auto max-w-2xl">
            <h2 className={`text-center ${isMobile ? 'text-2xl' : 'text-3xl'} font-bold mb-12`}>
              Everything Included
            </h2>
            <Card className="p-8">
              <div className="grid gap-4 md:grid-cols-2">
                {features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* CTA Section */}
          <div className="mx-auto max-w-2xl text-center mt-20">
            <h2 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold mb-4`}>
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground mb-8">
              Connect your Google Business Profile and start managing reviews with AI assistance.
            </p>
            <Button size="lg" onClick={() => navigate("/login")}>
              Continue with Google
            </Button>
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
    </div>
  );
};

export default Pricing;
