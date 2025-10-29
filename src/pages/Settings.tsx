import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RefreshCw, LogOut, AlertCircle, Shield, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLocations } from "@/hooks/useLocations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string>("");
  const [hasGoogleTokens, setHasGoogleTokens] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [locationDiagnostics, setLocationDiagnostics] = useState<any>(null);
  const [listingLocations, setListingLocations] = useState(false);
  const [syncingLocations, setSyncingLocations] = useState(false);
  const [quickSyncing, setQuickSyncing] = useState(false);
  const { data: locations, isLoading: locationsLoading, refetch: refetchLocations } = useLocations();
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
        
        // Check if user has Google tokens
        const { data: profile } = await supabase
          .from('profiles')
          .select('google_access_token')
          .eq('id', user.id)
          .single();
        
        setHasGoogleTokens(!!profile?.google_access_token);
      }
    };
    fetchUser();
  }, []);

  const handleReconnectGoogle = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('disconnect-google', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Google account disconnected",
        description: "Please sign in again to reconnect with updated permissions.",
      });

      // Redirect to login to get fresh tokens
      navigate("/login");
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: "Error disconnecting Google account",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleCheckConnection = async () => {
    setCheckingConnection(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('check-connection', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setDiagnostics(data);
      
      // Check for HTML error responses
      if (data.apiTest?.htmlDetected) {
        toast({
          title: "API Endpoint Error",
          description: `Received an HTML error page from Google. URL: ${data.apiTest?.urlUsed || 'unknown'}`,
          variant: "destructive",
        });
      } else if (data.apiTest?.parsedError?.quota?.quota_limit_value === "0" || data.apiTest?.quotaLimitValue === "0") {
        const svc = data.apiTest?.parsedError?.quota?.service || data.apiTest?.service || "Business Profile API";
        toast({
          title: "Quota Issue Detected",
          description: `${svc} has 0 quota. Request increase in Google Cloud Console.`,
          variant: "destructive",
        });
      } else if (!data.apiTest?.ok) {
        const msg = data.apiTest?.parsedError?.message || data.apiTest?.error || "Failed to connect to Google API";
        toast({
          title: "Connection Issue",
          description: msg,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Connection Healthy",
          description: `Found ${data.apiTest.accountsFound ?? 0} account(s). All systems operational.`,
        });
      }
    } catch (error) {
      toast({
        title: "Diagnostics Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleListLocations = async () => {
    setListingLocations(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('list-locations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setLocationDiagnostics(data);
      
      if (data.missingInDb?.length > 0) {
        toast({
          title: "Location Mismatch Found",
          description: `Google: ${data.googleLocationCount} | In app: ${data.dbLocationCount}. ${data.missingInDb.length} missing.`,
        });
      } else {
        toast({
          title: "Locations in Sync",
          description: `All ${data.googleLocationCount} Google locations are in your app.`,
        });
      }
    } catch (error) {
      toast({
        title: "Failed to List Locations",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setListingLocations(false);
    }
  };

  const handleSyncLocations = async () => {
    setSyncingLocations(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('sync-locations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      toast({
        title: "Locations Synced",
        description: `Added ${data.syncedCount} missing location${data.syncedCount === 1 ? '' : 's'} to your app.`,
      });

      // Refetch locations and clear diagnostics
      await refetchLocations();
      setLocationDiagnostics(null);
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSyncingLocations(false);
    }
  };

  const handleQuickSync = async () => {
    setQuickSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Step 1: Check sync status
      const { data: syncStatus, error: syncError } = await supabase.functions.invoke('check-sync-status', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (syncError) throw syncError;

      // Find locations that need syncing
      const locationsNeedingSync = syncStatus.locations?.filter(
        (loc: any) => loc.status === 'incomplete' && loc.missing > 0
      ) || [];

      if (locationsNeedingSync.length === 0) {
        toast({
          title: "All Synced",
          description: "All locations are up to date!",
        });
        return;
      }

      // Step 2: Sync those locations
      const locationIds = locationsNeedingSync.map((loc: any) => loc.google_location_id);
      
      const { data: syncData, error: fetchError } = await supabase.functions.invoke('fetch-reviews', {
        body: { location_ids: locationIds },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fetchError) throw fetchError;

      toast({
        title: "Quick Sync Complete",
        description: `Synced ${locationsNeedingSync.length} location${locationsNeedingSync.length === 1 ? '' : 's'} with ${syncData.totalNewReviews || 0} new review${syncData.totalNewReviews === 1 ? '' : 's'}.`,
      });

      await refetchLocations();
    } catch (error) {
      toast({
        title: "Quick Sync Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setQuickSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
      
      navigate("/login");
    } catch (error) {
      toast({
        title: "Error signing out",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className={`flex h-16 items-center border-b border-border ${isMobile ? 'px-4' : 'px-8'}`}>
        <h2>Settings</h2>
      </div>

      <div className={isMobile ? 'p-4' : 'p-8'}>
        <div className="max-w-2xl space-y-6">
          <Card className="p-6">
            <h3 className="mb-4">Google Business Profile Connection</h3>
            <div className="space-y-4">
              {hasGoogleTokens ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium">Connected</p>
                        <p className="text-sm text-muted-foreground">
                          {locationsLoading 
                            ? "Loading locations..." 
                            : `Access to ${locations?.length || 0} business location${locations?.length === 1 ? '' : 's'}`
                          }
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-success text-success">
                      Active
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Button 
                      variant="default" 
                      className="w-full"
                      onClick={handleQuickSync}
                      disabled={quickSyncing}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${quickSyncing ? 'animate-spin' : ''}`} />
                      Quick Sync
                    </Button>
                    <div className={`flex ${isMobile ? 'flex-col' : ''} gap-2`}>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={handleCheckConnection}
                        disabled={checkingConnection}
                      >
                        <Shield className={`mr-2 h-4 w-4 ${checkingConnection ? 'animate-spin' : ''}`} />
                        {isMobile ? 'Check' : 'Check Connection'}
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={handleReconnectGoogle}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reconnect
                      </Button>
                    </div>
                    <div className={`flex ${isMobile ? 'flex-col' : ''} gap-2`}>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={handleListLocations}
                        disabled={listingLocations}
                      >
                        <MapPin className={`mr-2 h-4 w-4 ${listingLocations ? 'animate-spin' : ''}`} />
                        List Locations (Diagnostics)
                      </Button>
                      {locationDiagnostics?.missingInDb?.length > 0 && (
                        <Button 
                          variant="default" 
                          className="flex-1"
                          onClick={handleSyncLocations}
                          disabled={syncingLocations}
                        >
                          <RefreshCw className={`mr-2 h-4 w-4 ${syncingLocations ? 'animate-spin' : ''}`} />
                          Sync Missing Locations
                        </Button>
                      )}
                    </div>
                  </div>
                  {diagnostics && (
                    <div className="mt-4 space-y-2 rounded-lg bg-muted p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Token Status:</span>
                        <Badge variant={diagnostics.tokenExpired ? "destructive" : "outline"}>
                          {diagnostics.tokenExpired ? "Expired" : "Valid"}
                        </Badge>
                      </div>
                      {diagnostics.apiTest && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">API Status:</span>
                            <Badge variant={diagnostics.apiTest.ok ? "outline" : "destructive"}>
                              {diagnostics.apiTest.status}
                            </Badge>
                          </div>
                          {diagnostics.apiTest.urlUsed && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Endpoint Used:</span>
                              <span className="font-medium break-all">{diagnostics.apiTest.urlUsed}</span>
                            </div>
                          )}
                          {diagnostics.apiTest.contentType && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Content-Type:</span>
                              <span className="font-medium">{diagnostics.apiTest.contentType}</span>
                            </div>
                          )}
                          {diagnostics.apiTest.accountsFound !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Accounts Found:</span>
                              <span className="font-medium">{diagnostics.apiTest.accountsFound}</span>
                            </div>
                          )}
                          {diagnostics.apiTest.quotaLimitValue !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">API Quota:</span>
                              <Badge variant={diagnostics.apiTest.quotaLimitValue === "0" ? "destructive" : "outline"}>
                                {diagnostics.apiTest.quotaLimitValue} requests/min
                              </Badge>
                            </div>
                          )}
                          {(diagnostics.apiTest.parsedError?.message || diagnostics.apiTest.error || diagnostics.apiTest.htmlDetected) && (
                            <div className="mt-2 space-y-1">
                              <span className="text-muted-foreground">Error:</span>
                              {diagnostics.apiTest.parsedError?.message && (
                                <p className="text-xs text-destructive">{diagnostics.apiTest.parsedError.message}</p>
                              )}
                              {!diagnostics.apiTest.parsedError?.message && diagnostics.apiTest.error && (
                                <p className="text-xs text-destructive">{diagnostics.apiTest.error}</p>
                              )}
                              {diagnostics.apiTest.htmlDetected && !diagnostics.apiTest.parsedError?.message && !diagnostics.apiTest.error && (
                                <p className="text-xs text-destructive">Received HTML error page from Google.</p>
                              )}
                              {(diagnostics.apiTest.bodySnippet || diagnostics.apiTest.rawError) && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                    Show raw error
                                  </summary>
                                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">
                                    {diagnostics.apiTest.bodySnippet || diagnostics.apiTest.rawError}
                                  </pre>
                                </details>
                              )}
                            </div>
                          )}
                          {Array.isArray(diagnostics.apiTests) && diagnostics.apiTests.length > 0 && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                Show all connection attempts
                              </summary>
                              <div className="mt-2 space-y-3">
                                {diagnostics.apiTests.map((t: any, idx: number) => (
                                  <div key={idx} className="rounded-md border border-border p-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-muted-foreground">URL</span>
                                      <span className="font-medium break-all">{t.urlUsed || 'unknown'}</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between">
                                      <span className="text-muted-foreground">Status</span>
                                      <Badge variant={t.ok ? "outline" : "destructive"}>{t.status ?? "N/A"}</Badge>
                                    </div>
                                    {t.contentType && (
                                      <div className="mt-1 flex items-center justify-between">
                                        <span className="text-muted-foreground">Content-Type</span>
                                        <span className="font-medium">{t.contentType}</span>
                                      </div>
                                    )}
                                    {t.htmlDetected && (
                                      <p className="mt-1 text-xs text-destructive">HTML error page detected</p>
                                    )}
                                    {t.parsedError?.message && (
                                      <div className="mt-2">
                                        <p className="text-xs text-destructive">{t.parsedError.message}</p>
                                      </div>
                                    )}
                                    {t.bodySnippet && (
                                      <details className="mt-1">
                                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                          Show raw error
                                        </summary>
                                        <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">{t.bodySnippet}</pre>
                                      </details>
                                    )}
                                    {t.networkError && (
                                      <p className="mt-1 text-xs text-destructive">Network error: {t.networkError}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {locationDiagnostics && (
                    <div className="mt-4 space-y-2 rounded-lg bg-muted p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Google Locations:</span>
                        <Badge variant="outline">{locationDiagnostics.googleLocationCount}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">In App:</span>
                        <Badge variant="outline">{locationDiagnostics.dbLocationCount}</Badge>
                      </div>
                      {locationDiagnostics.missingInDb?.length > 0 && (
                        <Collapsible className="mt-3">
                          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive hover:bg-destructive/20">
                            <span>Missing {locationDiagnostics.missingInDb.length} location{locationDiagnostics.missingInDb.length === 1 ? '' : 's'}</span>
                            <AlertCircle className="h-4 w-4" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-2">
                            {locationDiagnostics.missingInDb.map((loc: any, idx: number) => (
                              <div key={idx} className="rounded-md border border-border bg-background p-2">
                                <p className="font-medium text-xs">{loc.title}</p>
                                <p className="text-xs text-muted-foreground">{loc.address}</p>
                                <p className="text-xs text-muted-foreground mt-1">State: {loc.state}</p>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      {locationDiagnostics.extraInDb?.length > 0 && (
                        <Collapsible className="mt-3">
                          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-muted p-2 text-xs font-medium hover:bg-muted/80">
                            <span>Extra in DB (not in Google): {locationDiagnostics.extraInDb.length}</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 space-y-2">
                            {locationDiagnostics.extraInDb.map((loc: any, idx: number) => (
                              <div key={idx} className="rounded-md border border-border bg-background p-2">
                                <p className="font-medium text-xs">{loc.name}</p>
                                <p className="text-xs text-muted-foreground">{loc.address}</p>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="font-medium">Not Connected</p>
                        <p className="text-sm text-muted-foreground">
                          Please connect your Google Business Profile
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-destructive text-destructive">
                      Inactive
                    </Badge>
                  </div>
                  <Button 
                    variant="default" 
                    className="w-full"
                    onClick={handleReconnectGoogle}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Connect Google Account
                  </Button>
                </>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4">Account Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{userEmail || "Loading..."}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="font-medium">Professional</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4">Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified of new reviews
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">AI reply tone</p>
                  <p className="text-sm text-muted-foreground">
                    Customize automatic reply style
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Customize
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4">Account Actions</h3>
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
