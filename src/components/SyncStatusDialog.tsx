import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { LocationSyncStatus, SyncStatusResponse } from "@/hooks/useSyncStatus";

interface SyncStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syncStatus: SyncStatusResponse | null;
  onSyncLocation: (locationId: string, locationName: string) => void;
  syncing: boolean;
}

export const SyncStatusDialog = ({ 
  open, 
  onOpenChange, 
  syncStatus,
  onSyncLocation,
  syncing,
}: SyncStatusDialogProps) => {
  if (!syncStatus) return null;

  const { locations, summary } = syncStatus;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Sync Status</DialogTitle>
          <DialogDescription>
            Compare your database reviews with Google Business Profile
          </DialogDescription>
        </DialogHeader>

        {/* Summary Card */}
        <Card className="p-4 bg-muted/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Locations</p>
              <p className="text-2xl font-semibold">{summary.total_locations}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fully Synced</p>
              <p className="text-2xl font-semibold text-success">{summary.fully_synced}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Needs Sync</p>
              <p className="text-2xl font-semibold text-warning">{summary.needs_sync}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Missing Reviews</p>
              <p className="text-2xl font-semibold text-destructive">{summary.total_missing_reviews}</p>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Sync Progress</span>
              <span className="text-sm font-semibold">{summary.overall_sync_percentage}%</span>
            </div>
            <Progress value={summary.overall_sync_percentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {summary.total_db_reviews} / {summary.total_google_reviews} reviews synced
            </p>
          </div>
        </Card>

        {/* Location Details */}
        <div className="space-y-3 mt-4">
          <h3 className="font-semibold text-sm">Location Details</h3>
          {locations.map((location: LocationSyncStatus) => (
            <Card key={location.google_location_id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{location.name}</h4>
                    {location.status === 'complete' ? (
                      <Badge variant="outline" className="border-success text-success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Synced
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-warning text-warning">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Incomplete
                      </Badge>
                    )}
                  </div>
                  {location.address && (
                    <p className="text-sm text-muted-foreground mb-2">{location.address}</p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sync Progress</span>
                      <span className="font-medium">{location.sync_percentage}%</span>
                    </div>
                    <Progress value={location.sync_percentage} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{location.db_count} in database</span>
                      <span>{location.google_count} on Google</span>
                    </div>
                  </div>

                  {location.missing > 0 && (
                    <p className="text-sm text-destructive mt-2">
                      Missing {location.missing} review{location.missing !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {location.status === 'incomplete' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSyncLocation(location.google_location_id, location.name)}
                    disabled={syncing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    Sync
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
