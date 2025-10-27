import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, ThumbsUp, AlertCircle, RefreshCw } from "lucide-react";
import { useReviews, useFetchReviews } from "@/hooks/useReviews";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: reviews, isLoading } = useReviews();
  const { fetchReviews } = useFetchReviews();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fetchingReviews, setFetchingReviews] = useState(false);
  const [generatingReply, setGeneratingReply] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Please log in", description: "Your session expired.", variant: "destructive" });
        navigate('/login');
      }
    };
    init();
  }, [navigate, toast]);

  const handleFetchReviews = async () => {
    setFetchingReviews(true);
    try {
      const result = await fetchReviews();
      
      // Check for structured errors from edge function
      if (result && typeof result === 'object' && 'error' in result) {
        const err = result as any;
        
        // Special handling for quota errors
        if (err.status === 429 && err.quotaLimitValue === 0) {
          toast({
            title: "API Quota Not Enabled",
            description: `Google Business Profile API quota is 0. Please request quota increase in Google Cloud Console for: ${err.service || 'Business Profile API'}`,
            variant: "destructive",
          });
          return;
        }
        
        // Special handling for disabled services
        if (err.status === 403 && err.reason === 'SERVICE_DISABLED') {
          toast({
            title: "API Not Enabled",
            description: `Required Google API is disabled: ${err.service || 'Business Profile API'}. Enable it in Google Cloud Console.`,
            variant: "destructive",
          });
          return;
        }
        
        // Generic Google API error
        toast({
          title: `Google API Error (${err.status})`,
          description: err.message || "Failed to fetch reviews from Google",
          variant: "destructive",
        });
        return;
      }
      
      const count = (result && typeof result === 'object' && 'reviews' in result) ? (result.reviews?.length ?? 0) : (result as any)?.reviewsCount ?? 0;
      toast({
        title: "Reviews fetched",
        description: `Successfully fetched ${count} new reviews from Google`,
      });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    } catch (error: any) {
      toast({
        title: "Error fetching reviews",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFetchingReviews(false);
    }
  };

  const handleGenerateReply = async (reviewId: string, reviewText: string, rating: number) => {
    setGeneratingReply(reviewId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-reply", {
        body: { reviewId, reviewText, rating },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Reply generated",
        description: "AI has generated a reply for this review",
      });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    } catch (error: any) {
      toast({
        title: "Error generating reply",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingReply(null);
    }
  };

  const positiveReviews = reviews?.filter(r => r.sentiment === "positive").length || 0;
  const pendingReplies = reviews?.filter(r => !r.replies || r.replies.length === 0).length || 0;
  const averageRating = reviews?.length 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  return (
    <Layout>
      <div className="flex h-16 items-center justify-between border-b border-border px-8">
        <h2>Dashboard</h2>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleFetchReviews}
            disabled={fetchingReviews}
          >
            <RefreshCw className={`h-4 w-4 ${fetchingReviews ? 'animate-spin' : ''}`} />
            Fetch Reviews from Google
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-success/10 p-3">
                <ThumbsUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Positive Reviews</p>
                <p className="text-2xl font-semibold">{positiveReviews}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-3">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Replies</p>
                <p className="text-2xl font-semibold">{pendingReplies}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Rating</p>
                <p className="text-2xl font-semibold">{averageRating}</p>
              </div>
            </div>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !reviews || reviews.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No reviews yet. Click "Fetch Reviews from Google" to get started.</p>
            <Button onClick={handleFetchReviews} disabled={fetchingReviews}>
              <RefreshCw className={`h-4 w-4 ${fetchingReviews ? 'animate-spin' : ''}`} />
              Fetch Reviews
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const existingReply = review.replies?.[0];
              const timeAgo = formatDistanceToNow(new Date(review.review_created_at), { addSuffix: true });
              
              return (
                <Card key={review.id} className="p-6">
                  <div className="space-y-4">
                    {/* Review Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{review.author_name}</h3>
                          {review.sentiment && (
                            <Badge
                              variant="outline"
                              className={
                                review.sentiment === "positive"
                                  ? "border-success text-success"
                                  : review.sentiment === "neutral"
                                  ? "border-warning text-warning"
                                  : "border-destructive text-destructive"
                              }
                            >
                              {review.sentiment}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="flex">
                            {Array.from({ length: review.rating }).map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                            ))}
                          </div>
                          <span>•</span>
                          <span>{timeAgo}</span>
                          {review.location && (
                            <>
                              <span>•</span>
                              <span>{review.location.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Review Text */}
                    {review.text && (
                      <p className="text-foreground">{review.text}</p>
                    )}

                    {/* AI Reply */}
                    {existingReply ? (
                      <div className="rounded-lg bg-secondary p-4">
                        <p className="mb-2 text-sm font-medium text-muted-foreground">
                          {existingReply.is_ai_generated ? "AI-Generated Reply" : "Reply"}
                        </p>
                        <Textarea
                          defaultValue={existingReply.content}
                          className="min-h-[100px] resize-none"
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <Badge variant="outline" className={
                            existingReply.status === "posted" 
                              ? "border-success text-success"
                              : "border-warning text-warning"
                          }>
                            {existingReply.status}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-3">No reply generated yet</p>
                        <Button 
                          size="sm"
                          onClick={() => handleGenerateReply(review.id, review.text || "", review.rating)}
                          disabled={generatingReply === review.id}
                        >
                          {generatingReply === review.id ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            "Generate AI Reply"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
