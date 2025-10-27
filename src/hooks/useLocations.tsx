import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Location {
  id: string;
  google_location_id: string;
  name: string;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const useLocations = () => {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Location[];
    },
  });
};
