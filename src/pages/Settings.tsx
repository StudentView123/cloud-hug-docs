import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, RefreshCw, LogOut, AlertCircle, Shield, MapPin, PlugZap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLocations } from "@/hooks/useLocations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { AISettingsTab } from "@/components/settings/AISettingsTab";
import { QuickReplyTemplatesTab } from "@/components/settings/QuickReplyTemplatesTab";
import { TrainingExamplesTab } from "@/components/settings/TrainingExamplesTab";
import { GenerationAnalyticsTab } from "@/components/settings/GenerationAnalyticsTab";
import { startGoogleBusinessConnect } from "@/lib/googleConnection";

type ConnectionState = {
  connection_status: string;
  google_account_email: string | null;
  google_account_name: string | null;
  scopes: string[];
  token_expires_at: string | null;
  last_refreshed_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  access_token?: string | null;
};

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string>("");
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [locationDiagnostics, setLocationDiagnostics] = useState<any>(null);
  const [listingLocations, setListingLocations] = useState(false);
  const [syncingLocations, setSyncingLocations] = useState(false);
  const [quickSyncing, setQuickSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { data: locations, isLoading: locationsLoading, refetch: refetchLocations } = useLocations();
  const isMobile = useIsMobile();

  const loadConnectionState = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/login");
      return;
    }

    setUserEmail(user.email ?? "");

    const { data } = await (supabase as any)
      .from("google_connections")
      .select("connection_status, google_account_email, google_account_name, scopes, token_expires_at, last_refreshed_at, last_sync_at, last_error, access_token")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .maybeSingle();

    setConnection(data ?? null);
  };

  useEffect(() => {
    loadConnectionState();
  }, []);

  const handleConnectGoogle = () => {
    try {
      startGoogleBusinessConnect("/settings");
    } catch (error) {
      toast({
        title: "Connection setup error",
        description: error instanceof Error ? error.message : "Unable to start Google connection",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectGoogle = async () => {
    setDisconnecting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("disconnect-google", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Google Business disconnected",
        description: "Your app session is still active. Reconnect anytime.",
      });

      setDiagnostics(null);
      setLocationDiagnostics(null);
      await loadConnectionState();
    } catch (error) {
      toast({
        title: "Error disconnecting",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCheckConnection = async () => {
    setCheckingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-connection");
      if (error) throw error;
      setDiagnostics(data);
      await loadConnectionState();

      toast({
        title: data.apiHealthy ? "Connection healthy" : "Connection needs attention",
        description: data.apiHealthy
          ? `Found ${data.accountsFound ?? 0} Google account(s).`
          : data.lastError || "Google Business authorization should be refreshed.",
        variant: data.apiHealthy ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Diagnostics failed",
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
      const { data, error } = await supabase.functions.invoke("list-locations");
      if (error) throw error;
      setLocationDiagnostics(data);
      toast({
        title: data.missingInDb?.length > 0 ? "Location mismatch found" : "Locations in sync",
        description: data.missingInDb?.length > 0
          ? `${data.missingInDb.length} Google location(s) are not in Review Hub yet.`
          : `All ${data.googleLocationCount} locations are already synced.`,
      });
    } catch (error) {
      toast({
        title: "Failed to list locations",
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
      const { data, error } = await supabase.functions.invoke("sync-locations");
      if (error) throw error;
      toast({
        title: "Locations synced",
        description: `Added ${data.syncedCount} missing location${data.syncedCount === 1 ? "" : "s"}.`,
      });
      await refetchLocations();
      await loadConnectionState();
      setLocationDiagnostics(null);
    } catch (error) {
      toast({
        title: "Sync failed",
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
      const { data: syncStatus, error: syncError } = await supabase.functions.invoke("check-sync-status");
      if (syncError) throw syncError;

      const locationsNeedingSync = syncStatus.locations?.filter(
        (loc: any) => loc.status === "incomplete" && loc.missing > 0
      ) || [];

      if (locationsNeedingSync.length === 0) {
        toast({ title: "All synced", description: "All locations are already up to date." });
        return;
      }

      const locationIds = locationsNeedingSync.map((loc: any) => loc.google_location_id);
      const { data: syncData, error: fetchError } = await supabase.functions.invoke("fetch-reviews", {
        body: { location_ids: locationIds },
      });
      if (fetchError) throw fetchError;

      toast({
        title: "Quick sync complete",
        description: `Synced ${syncData.totalNewReviews || syncData.newReviewsCount || 0} new review${(syncData.totalNewReviews || syncData.newReviewsCount || 0) === 1 ? "" : "s"}.`,
      });

      await refetchLocations();
      await loadConnectionState();
    } catch (error) {
      toast({
        title: "Quick sync failed",
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
      toast({ title: "Signed out successfully", description: "You have been logged out of your account." });
      navigate("/login");
    } catch (error) {
      toast({
        title: "Error signing out",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const isConnected = !!connection?.access_token && connection?.connection_status !== "disconnected";

  return (
    <Layout>
      <div className={`flex h-16 items-center border-b border-border ${isMobile ? "px-4" : "px-8"}`}>
        <h2>Settings</h2>
      </div>

      <div className={isMobile ? "p-4" : "p-8"}>
        <div className="max-w-2xl space-y-6">
          <Card className="p-6">
            <h3 className="mb-4">Google Business connection</h3>
            <div className="space-y-4">
              {isConnected ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium">Connected</p>
                        <p className="text-sm text-muted-foreground">
                          {connection?.google_account_email || connection?.google_account_name || "Google Business connected"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-success text-success">
                      {connection?.connection_status || "connected"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 rounded-lg bg-muted p-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Locations</span>
                      <span>{locationsLoading ? "Loading…" : `${locations?.length || 0} synced`}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Token expires</span>
                      <span>{connection?.token_expires_at ? new Date(connection.token_expires_at).toLocaleString() : "Unknown"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Last refresh</span>
                      <span>{connection?.last_refreshed_at ? new Date(connection.last_refreshed_at).toLocaleString() : "Not yet"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Last sync</span>
                      <span>{connection?.last_sync_at ? new Date(connection.last_sync_at).toLocaleString() : "Not yet"}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button className="w-full" onClick={handleQuickSync} disabled={quickSyncing}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${quickSyncing ? "animate-spin" : ""}`} />
                      Quick Sync
                    </Button>
                    <div className={`flex ${isMobile ? "flex-col" : ""} gap-2`}>
                      <Button variant="outline" className="flex-1" onClick={handleCheckConnection} disabled={checkingConnection}>
                        <Shield className={`mr-2 h-4 w-4 ${checkingConnection ? "animate-spin" : ""}`} />
                        {isMobile ? "Check" : "Check Connection"}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={handleConnectGoogle}>
                        <PlugZap className="mr-2 h-4 w-4" />
                        Reconnect
                      </Button>
                    </div>
                    <div className={`flex ${isMobile ? "flex-col" : ""} gap-2`}>
                      <Button variant="outline" className="flex-1" onClick={handleListLocations} disabled={listingLocations}>
                        <MapPin className={`mr-2 h-4 w-4 ${listingLocations ? "animate-spin" : ""}`} />
                        List Locations
                      </Button>
                      {locationDiagnostics?.missingInDb?.length > 0 && (
                        <Button className="flex-1" onClick={handleSyncLocations} disabled={syncingLocations}>
                          <RefreshCw className={`mr-2 h-4 w-4 ${syncingLocations ? "animate-spin" : ""}`} />
                          Sync Missing Locations
                        </Button>
                      )}
                    </div>
                    <Button variant="ghost" className="w-full" onClick={handleDisconnectGoogle} disabled={disconnecting}>
                      Disconnect Google Business
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <div>
                        <p className="font-medium">Not connected</p>
                        <p className="text-sm text-muted-foreground">Sign in stays active — you only need to reconnect Google Business here.</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-destructive text-destructive">inactive</Badge>
                  </div>
                  <Button className="w-full" onClick={handleConnectGoogle}>
                    <PlugZap className="mr-2 h-4 w-4" />
                    Connect Google Business
                  </Button>
                </>
              )}

              {connection?.last_error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {connection.last_error}
                </div>
              )}

              {diagnostics && (
                <div className="mt-4 space-y-2 rounded-lg bg-muted p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">API healthy</span>
                    <Badge variant={diagnostics.apiHealthy ? "outline" : "destructive"}>{diagnostics.apiHealthy ? "Yes" : "No"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Accounts found</span>
                    <span>{diagnostics.accountsFound ?? 0}</span>
                  </div>
                </div>
              )}

              {locationDiagnostics && (
                <div className="mt-4 space-y-2 rounded-lg bg-muted p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Google Locations</span>
                    <Badge variant="outline">{locationDiagnostics.googleLocationCount}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">In Review Hub</span>
                    <Badge variant="outline">{locationDiagnostics.dbLocationCount}</Badge>
                  </div>
                  {locationDiagnostics.missingInDb?.length > 0 && (
                    <Collapsible className="mt-3">
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive hover:bg-destructive/20">
                        <span>Missing {locationDiagnostics.missingInDb.length} location{locationDiagnostics.missingInDb.length === 1 ? "" : "s"}</span>
                        <AlertCircle className="h-4 w-4" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-2">
                        {locationDiagnostics.missingInDb.map((loc: any, idx: number) => (
                          <div key={idx} className="rounded-md border border-border bg-background p-2">
                            <p className="text-xs font-medium">{loc.title}</p>
                            <p className="text-xs text-muted-foreground">{loc.address}</p>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4">Account information</h3>
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
                  <p className="text-sm text-muted-foreground">Get notified of new reviews</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-lg font-medium">AI Reply Management</h3>
            <Tabs defaultValue="ai-settings">
              <TabsList className={`${isMobile ? "grid h-auto w-full grid-cols-2" : "grid w-full grid-cols-4"}`}>
                <TabsTrigger value="ai-settings" className={isMobile ? "py-2 text-xs" : ""}>{isMobile ? "AI" : "AI Settings"}</TabsTrigger>
                <TabsTrigger value="quick-replies" className={isMobile ? "py-2 text-xs" : ""}>Quick Replies</TabsTrigger>
                <TabsTrigger value="training" className={isMobile ? "py-2 text-xs" : ""}>Training</TabsTrigger>
                <TabsTrigger value="analytics" className={isMobile ? "py-2 text-xs" : ""}>Analytics</TabsTrigger>
              </TabsList>
              <TabsContent value="ai-settings"><AISettingsTab /></TabsContent>
              <TabsContent value="quick-replies"><QuickReplyTemplatesTab /></TabsContent>
              <TabsContent value="training"><TrainingExamplesTab /></TabsContent>
              <TabsContent value="analytics"><GenerationAnalyticsTab /></TabsContent>
            </Tabs>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4">Account Actions</h3>
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
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
