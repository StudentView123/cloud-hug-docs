import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DisputeStatus = "none" | "flagged" | "resolved" | "rejected";

export interface DisputeReview {
  id: string;
  google_review_id: string;
  location_id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  text: string | null;
  sentiment: string | null;
  sentiment_mismatch: boolean | null;
  review_created_at: string;
  archived: boolean | null;
  has_google_reply: boolean | null;
  google_reply_content: string | null;
  dispute_status: DisputeStatus;
  dispute_notes: string | null;
  disputed_at: string | null;
  location?: {
    id: string;
    name: string;
    address: string | null;
    place_id: string | null;
  };
}

interface UseDisputesOptions {
  maxRating?: number; // default 1 — fetch reviews with rating <= maxRating
}

export const useDisputes = ({ maxRating = 1 }: UseDisputesOptions = {}) => {
  return useQuery({
    queryKey: ["disputes", maxRating],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          `
          id,
          google_review_id,
          location_id,
          author_name,
          author_photo_url,
          rating,
          text,
          sentiment,
          sentiment_mismatch,
          review_created_at,
          archived,
          has_google_reply,
          google_reply_content,
          dispute_status,
          dispute_notes,
          disputed_at,
          location:locations(id, name, address, place_id)
        `
        )
        .lte("rating", maxRating)
        .order("review_created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as DisputeReview[];
    },
  });
};

export const useUpdateDisputeStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      status,
      notes,
    }: {
      reviewId: string;
      status: DisputeStatus;
      notes?: string | null;
    }) => {
      const update: Record<string, unknown> = {
        dispute_status: status,
        disputed_at: status === "flagged" ? new Date().toISOString() : null,
      };
      if (notes !== undefined) update.dispute_notes = notes;

      const { data, error } = await supabase
        .from("reviews")
        .update(update)
        .eq("id", reviewId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disputes"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
};

export const useArchiveReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, archived }: { reviewId: string; archived: boolean }) => {
      const { error } = await supabase
        .from("reviews")
        .update({ archived })
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disputes"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
};
