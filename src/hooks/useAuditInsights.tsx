import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

interface NotableReviewer {
  name: string;
  rating: number;
  sentiment: string;
  highlight: string;
}

interface KeyInsightExample {
  author: string;
  rating: number;
  excerpt: string;
}

interface KeyInsight {
  title: string;
  description: string;
  examples?: KeyInsightExample[];
}

interface RatingChanges {
  upgrades?: number;
  downgrades?: number;
  patterns?: string;
}

interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  description: string;
  affected_reviews?: number;
}

export interface AuditInsights {
  summary: string;
  sentiment_breakdown: SentimentBreakdown;
  notable_reviewers?: NotableReviewer[];
  key_insights: KeyInsight[];
  rating_changes?: RatingChanges;
  action_items: ActionItem[];
  stats?: {
    total_reviews: number;
    active_reviews: number;
    archived_reviews: number;
    sentiment_breakdown: SentimentBreakdown;
  };
}

export const useGenerateInsights = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateInsights = async (): Promise<AuditInsights> => {
    setIsGenerating(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke("generate-audit-insights", {
        body: {},
      });
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate insights');
      }

      return data.insights;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateInsights, isGenerating };
};
