import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditStats {
  total_reviews: number;
  reviews_with_sentiment: number;
  reviews_missing_sentiment: number;
  sentiment_mismatches: number;
  recent_rating_changes: Array<{
    id: string;
    author_name: string;
    rating: number;
    rating_history: any;
    last_rating_change_at: string;
    location_name: string;
  }>;
  health_percentage: number;
}

export const useAuditStats = () => {
  return useQuery({
    queryKey: ["audit-stats"],
    queryFn: async () => {
      // Get total reviews count
      const { count: totalCount } = await supabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq('archived', false);

      // Get reviews with sentiment
      const { count: withSentimentCount } = await supabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq('archived', false)
        .not('sentiment', 'is', null);

      // Get sentiment mismatches
      const { count: mismatchCount } = await supabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq('archived', false)
        .eq('sentiment_mismatch', true);

      // Get recent rating changes (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentChanges } = await supabase
        .from("reviews")
        .select(`
          id,
          author_name,
          rating,
          rating_history,
          last_rating_change_at,
          location:locations(name)
        `)
        .eq('archived', false)
        .not('last_rating_change_at', 'is', null)
        .gte('last_rating_change_at', sevenDaysAgo.toISOString())
        .order('last_rating_change_at', { ascending: false })
        .limit(10);

      const total = totalCount || 0;
      const withSentiment = withSentimentCount || 0;
      const missingSentiment = total - withSentiment;
      const mismatches = mismatchCount || 0;

      const stats: AuditStats = {
        total_reviews: total,
        reviews_with_sentiment: withSentiment,
        reviews_missing_sentiment: missingSentiment,
        sentiment_mismatches: mismatches,
        recent_rating_changes: (recentChanges || []).map(change => ({
          id: change.id,
          author_name: change.author_name,
          rating: change.rating,
          rating_history: change.rating_history,
          last_rating_change_at: change.last_rating_change_at!,
          location_name: (change.location as any)?.name || 'Unknown',
        })),
        health_percentage: total > 0 ? Math.round((withSentiment / total) * 100) : 100,
      };

      return stats;
    },
  });
};

export const useRunAudit = () => {
  const runAudit = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please log in and try again.');
    }

    const { data, error } = await supabase.functions.invoke("audit-review-sentiments", {
      body: {},
    });
    
    if (error) throw error;
    return data;
  };

  return { runAudit };
};
