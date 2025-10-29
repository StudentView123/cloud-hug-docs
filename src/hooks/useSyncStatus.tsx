import { supabase } from "@/integrations/supabase/client";

export interface LocationSyncStatus {
  google_location_id: string;
  name: string;
  address: string;
  google_count: number | null;
  db_count: number;
  missing: number;
  sync_percentage: number | null;
  status: 'complete' | 'incomplete' | 'unknown';
  google_error?: {
    status: number;
    message: string;
    source: string;
  };
  stale_google_count?: number;
}

export interface SyncStatusSummary {
  total_locations: number;
  fully_synced: number;
  needs_sync: number;
  unknown_locations: number;
  total_google_reviews: number;
  total_db_reviews: number;
  total_missing_reviews: number;
  overall_sync_percentage: number | null;
}

export interface SyncStatusResponse {
  success: boolean;
  locations: LocationSyncStatus[];
  summary: SyncStatusSummary;
}

export const useCheckSyncStatus = () => {
  const checkSyncStatus = async (): Promise<SyncStatusResponse> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please log in and try again.');
    }

    const { data, error } = await supabase.functions.invoke("check-sync-status", {
      body: {},
    });
    
    if (error) throw error;
    return data;
  };

  return { checkSyncStatus };
};

export const useSyncMissingReviews = () => {
  const syncMissingReviews = async (locationIds?: string[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please log in and try again.');
    }

    const { data, error } = await supabase.functions.invoke("fetch-reviews", {
      body: locationIds ? { location_ids: locationIds } : {},
    });
    
    if (error) throw error;
    return data;
  };

  return { syncMissingReviews };
};
