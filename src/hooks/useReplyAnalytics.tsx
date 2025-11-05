import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useReplyAnalytics = () => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["reply-analytics"],
    queryFn: async () => {
      // Fetch AI-generated replies from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: repliesData, error } = await supabase
        .from("replies")
        .select("content, created_at, review_id, reviews(rating, text)")
        .eq("is_ai_generated", true)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const replies = repliesData || [];

      // Analyze phrase frequency
      const openings = replies.map(r => {
        const firstSentence = r.content.split(/[.!?]/)[0];
        const firstFiveWords = firstSentence.split(' ').slice(0, 5).join(' ');
        return firstFiveWords;
      });

      const frequencyMap = openings.reduce((acc, phrase) => {
        acc[phrase] = (acc[phrase] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const phraseFrequency = Object.entries(frequencyMap)
        .map(([phrase, count]) => ({
          phrase,
          count,
          percentage: Math.round((count / replies.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate variation score (lower repetition = higher score)
      const uniqueOpenings = Object.keys(frequencyMap).length;
      const totalReplies = replies.length;
      const variationScore = totalReplies > 0 ? Math.round((uniqueOpenings / totalReplies) * 100) : 0;

      return {
        totalAIReplies: replies.length,
        uniqueOpenings,
        variationScore,
        phraseFrequency,
        recentReplies: replies.slice(0, 10).map(r => ({
          id: r.review_id,
          reply_content: r.content,
          created_at: r.created_at,
          rating: (r.reviews as any)?.rating,
          review_text: (r.reviews as any)?.text
        }))
      };
    },
  });

  return { analytics, isLoading };
};
