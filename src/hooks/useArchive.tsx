import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Review } from "./useReviews";

export const useArchive = (searchTerm: string = "") => {
  return useQuery({
    queryKey: ["archive", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("reviews")
        .select(`
          *,
          location:locations(id, name, address),
          replies(id, content, status, is_ai_generated, created_at, posted_at, needs_review)
        `)
        .eq('archived', true);

      if (searchTerm) {
        const searchQuery = `%${searchTerm}%`;
        query = query.or(`text.ilike.${searchQuery},author_name.ilike.${searchQuery}`);
      }

      const { data, error } = await query.order("review_created_at", { ascending: false });

      if (error) throw error;
      return data as Review[];
    },
  });
};
