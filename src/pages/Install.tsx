import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Download, Home, Share2, CheckCircle2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Install() {
  const isMobile = useIsMobile();
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Capture the install prompt event
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  return (
    <Layout>
      <div className={isMobile ? "p-4" : "p-8"}>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <Smartphone className="h-16 w-16 mx-auto text-primary" />
            <h1 className="text-3xl font-bold">Install ReviewHub</h1>
            <p className="text-muted-foreground">
              Get the app experience on your device
            </p>
          </div>

          {isInstalled ? (
            <Card className="border-success">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  App Installed!
                </CardTitle>
                <CardDescription>
                  ReviewHub is now installed on your device. You can access it from your home screen.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              {/* Android Chrome Install */}
              {deferredPrompt && !isIOS && (
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Install</CardTitle>
                    <CardDescription>
                      Click the button below to install ReviewHub
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={handleInstallClick} className="w-full" size="lg">
                      <Download className="mr-2 h-5 w-5" />
                      Install App
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* iOS Safari Instructions */}
              {isIOS && (
                <Card>
                  <CardHeader>
                    <CardTitle>Install on iOS</CardTitle>
                    <CardDescription>
                      Follow these steps to install ReviewHub on your iPhone or iPad
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-medium">Open Share Menu</p>
                        <p className="text-sm text-muted-foreground">
                          Tap the <Share2 className="inline h-4 w-4" /> share button at the bottom of your browser
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        2
                      </div>
                      <div>
                        <p className="font-medium">Add to Home Screen</p>
                        <p className="text-sm text-muted-foreground">
                          Scroll down and tap "Add to Home Screen"
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        3
                      </div>
                      <div>
                        <p className="font-medium">Confirm Installation</p>
                        <p className="text-sm text-muted-foreground">
                          Tap "Add" in the top right corner
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Generic Android Instructions */}
              {!deferredPrompt && !isIOS && (
                <Card>
                  <CardHeader>
                    <CardTitle>Install on Android</CardTitle>
                    <CardDescription>
                      Follow these steps to install ReviewHub
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-medium">Open Browser Menu</p>
                        <p className="text-sm text-muted-foreground">
                          Tap the three dots menu in your browser
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        2
                      </div>
                      <div>
                        <p className="font-medium">Install App</p>
                        <p className="text-sm text-muted-foreground">
                          Look for "Install app" or "Add to Home screen"
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle>Why Install?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                    <div>
                      <p className="font-medium">Quick Access</p>
                      <p className="text-sm text-muted-foreground">Launch directly from your home screen</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                    <div>
                      <p className="font-medium">Offline Support</p>
                      <p className="text-sm text-muted-foreground">Access cached content without internet</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                    <div>
                      <p className="font-medium">Native Experience</p>
                      <p className="text-sm text-muted-foreground">Runs fullscreen without browser chrome</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                    <div>
                      <p className="font-medium">Faster Loading</p>
                      <p className="text-sm text-muted-foreground">Cached assets load instantly</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
