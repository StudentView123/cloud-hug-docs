import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  review_id: string | null;
  details: any;
  created_at: string;
}

export const useActivityLog = () => {
  return useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ActivityLog[];
    },
  });
};
