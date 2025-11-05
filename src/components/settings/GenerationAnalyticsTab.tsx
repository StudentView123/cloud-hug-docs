import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useReplyAnalytics } from "@/hooks/useReplyAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export const GenerationAnalyticsTab = () => {
  const { analytics, isLoading } = useReplyAnalytics();
  const { toast } = useToast();

  const handleAddToBlacklist = async (phrase: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('reply_style_settings')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      const currentSettings = (data?.reply_style_settings || {}) as any;
      const avoidPhrases = Array.isArray(currentSettings.avoid_phrases) ? currentSettings.avoid_phrases : [];

      if (avoidPhrases.includes(phrase)) {
        toast({ title: "Phrase already in blacklist" });
        return;
      }

      await supabase
        .from('profiles')
        .update({
          reply_style_settings: {
            ...currentSettings,
            avoid_phrases: [...avoidPhrases, phrase]
          }
        })
        .eq('id', user.id);

      toast({ title: "Phrase added to blacklist" });
    } catch (error) {
      toast({ title: "Error adding phrase", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6 mt-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">AI Replies Generated</p>
          <p className="text-2xl font-bold">{analytics?.totalAIReplies || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Unique Opening Phrases</p>
          <p className="text-2xl font-bold">{analytics?.uniqueOpenings || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Higher is better</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Variation Score</p>
          <p className="text-2xl font-bold">{analytics?.variationScore || 0}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(analytics?.variationScore || 0) > 70 ? 'Excellent' : (analytics?.variationScore || 0) > 50 ? 'Good' : 'Needs improvement'}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h4 className="font-medium mb-3">Most Common Opening Phrases</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Click a phrase to add it to your blacklist
        </p>
        <div className="space-y-2">
          {analytics?.phraseFrequency && analytics.phraseFrequency.length > 0 ? (
            analytics.phraseFrequency.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 hover:bg-muted rounded gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">"{item.phrase}"</p>
                  <p className="text-xs text-muted-foreground">
                    Used {item.count} times ({item.percentage}%)
                  </p>
                </div>
                <div className="w-32 flex-shrink-0">
                  <Progress value={item.percentage} className="h-2" />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAddToBlacklist(item.phrase)}
                  className="flex-shrink-0"
                >
                  <Ban className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Not enough data yet. Generate more replies to see patterns.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="font-medium mb-3">Recent AI-Generated Replies</h4>
        <div className="space-y-3 max-h-96 overflow-auto">
          {analytics?.recentReplies && analytics.recentReplies.length > 0 ? (
            analytics.recentReplies.map(reply => (
              <div key={reply.id} className="p-3 bg-muted rounded text-sm">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={reply.rating >= 4 ? 'default' : 'secondary'}>
                    {reply.rating} stars
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(reply.created_at))} ago
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-1">Review:</p>
                <p className="mb-2">{reply.review_text || <em>No text</em>}</p>
                <p className="text-xs text-muted-foreground mb-1">AI Reply:</p>
                <p className="font-medium">{reply.reply_content}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No recent AI-generated replies yet.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
