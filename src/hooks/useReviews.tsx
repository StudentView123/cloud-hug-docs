import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Review {
  id: string;
  google_review_id: string;
  location_id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  text: string | null;
  sentiment: string | null;
  review_created_at: string;
  created_at: string;
  google_reply_content: string | null;
  google_reply_time: string | null;
  has_google_reply: boolean;
  location?: {
    id: string;
    name: string;
    address: string | null;
  };
  replies?: Array<{
    id: string;
    content: string;
    status: string;
    is_ai_generated: boolean;
    created_at: string;
    posted_at: string | null;
  }>;
}

export const useReviews = () => {
  return useQuery({
    queryKey: ["reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          *,
          location:locations(id, name, address),
          replies(id, content, status, is_ai_generated, created_at, posted_at)
        `)
        .eq('archived', false)
        .order("review_created_at", { ascending: false });

      if (error) throw error;
      return data as Review[];
    },
  });
};

export const useFetchReviews = () => {
  const fetchReviews = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please log in and try again.');
    }

    const { data, error } = await supabase.functions.invoke("fetch-reviews", {
      body: {},
    });
    
    if (error) throw error;
    return data;
  };

  return { fetchReviews };
};
