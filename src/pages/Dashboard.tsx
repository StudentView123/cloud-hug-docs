import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, ThumbsUp, AlertCircle, RefreshCw, Send, Edit2, Check, ArrowUpDown, CheckSquare, X } from "lucide-react";
import { useReviews, useFetchReviews } from "@/hooks/useReviews";
import { useLocations } from "@/hooks/useLocations";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: reviews, isLoading } = useReviews();
  const { data: locations } = useLocations();
  const { fetchReviews } = useFetchReviews();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fetchingReviews, setFetchingReviews] = useState(false);
  const [generatingReply, setGeneratingReply] = useState<string | null>(null);
  
  const [postingReply, setPostingReply] = useState<string | null>(null);
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedRating, setSelectedRating] = useState<string>("all");
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkPosting, setBulkPosting] = useState(false);

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

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Reply generated",
        description: "AI has generated a reply for this review",
      });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    } catch (error: any) {
      // Handle session expiration
      if (error.message?.includes('Not authenticated') || error.status === 401) {
        toast({
          title: "Session expired",
          description: "Your session expired. Please log in again.",
          variant: "destructive",
        });
        navigate('/login');
        return;
      }
      
      toast({
        title: "Error generating reply",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingReply(null);
    }
  };

  const handlePostReply = async (replyId: string, reviewId: string) => {
    setPostingReply(replyId);
    try {
      const { data, error } = await supabase.functions.invoke("post-reply", {
        body: { replyId, reviewId },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Reply posted",
        description: "Your reply has been posted to Google Business Profile",
      });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    } catch (error: any) {
      // Handle session expiration
      if (error.message?.includes('Not authenticated') || error.status === 401) {
        toast({
          title: "Session expired",
          description: "Your session expired. Please log in again.",
          variant: "destructive",
        });
        navigate('/login');
        return;
      }
      
      toast({
        title: "Error posting reply",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPostingReply(null);
    }
  };

  const handleSaveEdit = async (replyId: string, content: string) => {
    try {
      const { error } = await supabase
        .from('replies')
        .update({ content })
        .eq('id', replyId);

      if (error) throw error;

      toast({
        title: "Reply updated",
        description: "Your changes have been saved",
      });
      setEditingReply(null);
      setEditedContent(prev => {
        const newContent = { ...prev };
        delete newContent[replyId];
        return newContent;
      });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    } catch (error: any) {
      toast({
        title: "Error saving reply",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Helper functions for bulk actions
  const toggleReviewSelection = (reviewId: string) => {
    setSelectedReviewIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (filteredReviews) {
      setSelectedReviewIds(new Set(filteredReviews.map(r => r.id)));
    }
  };

  const deselectAll = () => {
    setSelectedReviewIds(new Set());
  };

  const getSelectedReviewsWithoutReplies = () => {
    return filteredReviews?.filter(r => 
      selectedReviewIds.has(r.id) && (!r.replies || r.replies.length === 0)
    ) || [];
  };

  const getSelectedReviewsWithDraftReplies = () => {
    return filteredReviews?.filter(r => 
      selectedReviewIds.has(r.id) && 
      r.replies && 
      r.replies.length > 0 && 
      r.replies[0].status === "draft"
    ) || [];
  };

  const handleBulkGenerateReplies = async () => {
    const reviewsToGenerate = getSelectedReviewsWithoutReplies();
    if (reviewsToGenerate.length === 0) {
      toast({
        title: "No reviews to process",
        description: "Selected reviews already have replies",
        variant: "destructive",
      });
      return;
    }

    setBulkGenerating(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < reviewsToGenerate.length; i++) {
      const review = reviewsToGenerate[i];
      try {
        toast({
          title: "Generating replies",
          description: `Processing ${i + 1} of ${reviewsToGenerate.length}...`,
        });

        const { data, error } = await supabase.functions.invoke("generate-reply", {
          body: { 
            reviewId: review.id, 
            reviewText: review.text || "", 
            rating: review.rating 
          },
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        successCount++;
      } catch (error: any) {
        failCount++;
        console.error(`Failed to generate reply for review ${review.id}:`, error);
      }
    }

    setBulkGenerating(false);
    queryClient.invalidateQueries({ queryKey: ["reviews"] });
    
    toast({
      title: "Bulk generation complete",
      description: `Generated ${successCount} of ${reviewsToGenerate.length} replies successfully${failCount > 0 ? `. ${failCount} failed.` : ''}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
    
    deselectAll();
    setIsBulkMode(false);
  };

  const handleBulkPostReplies = async () => {
    const reviewsToPost = getSelectedReviewsWithDraftReplies();
    if (reviewsToPost.length === 0) {
      toast({
        title: "No replies to post",
        description: "Selected reviews don't have draft replies",
        variant: "destructive",
      });
      return;
    }

    setBulkPosting(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < reviewsToPost.length; i++) {
      const review = reviewsToPost[i];
      const reply = review.replies![0];
      
      try {
        toast({
          title: "Posting replies",
          description: `Processing ${i + 1} of ${reviewsToPost.length}...`,
        });

        const { data, error } = await supabase.functions.invoke("post-reply", {
          body: { 
            replyId: reply.id, 
            reviewId: review.id 
          },
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        successCount++;
        
        // Add small delay to avoid rate limiting
        if (i < reviewsToPost.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        failCount++;
        console.error(`Failed to post reply for review ${review.id}:`, error);
      }
    }

    setBulkPosting(false);
    queryClient.invalidateQueries({ queryKey: ["reviews"] });
    
    toast({
      title: "Bulk posting complete",
      description: `Posted ${successCount} of ${reviewsToPost.length} replies successfully${failCount > 0 ? `. ${failCount} failed.` : ''}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
    
    deselectAll();
    setIsBulkMode(false);
  };

  const filteredReviews = reviews
    ?.filter(r => selectedLocationId === "all" || r.location_id === selectedLocationId)
    ?.filter(r => selectedRating === "all" || r.rating === parseInt(selectedRating))
    ?.sort((a, b) => {
      const dateA = new Date(a.review_created_at).getTime();
      const dateB = new Date(b.review_created_at).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  const positiveReviews = reviews?.filter(r => r.sentiment === "positive").length || 0;
  const unansweredReviews = reviews?.length || 0;
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
                <p className="text-sm text-muted-foreground">Unanswered Reviews</p>
                <p className="text-2xl font-semibold">{unansweredReviews}</p>
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
            <h3 className="text-lg font-semibold mb-2">All caught up! 🎉</h3>
            <p className="text-muted-foreground mb-4">
              No unanswered reviews. Replied reviews are automatically archived.
            </p>
            <Button onClick={handleFetchReviews} disabled={fetchingReviews} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${fetchingReviews ? 'animate-spin' : ''}`} />
              Check for New Reviews
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <p className="text-sm text-muted-foreground">
                Showing {filteredReviews?.length || 0} of {reviews.length} reviews
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations?.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedRating} onValueChange={setSelectedRating}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All Ratings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">⭐⭐⭐⭐⭐ (5 stars)</SelectItem>
                    <SelectItem value="4">⭐⭐⭐⭐ (4 stars)</SelectItem>
                    <SelectItem value="3">⭐⭐⭐ (3 stars)</SelectItem>
                    <SelectItem value="2">⭐⭐ (2 stars)</SelectItem>
                    <SelectItem value="1">⭐ (1 star)</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {sortOrder === "newest" ? "Newest First" : "Oldest First"}
                </Button>
                
                <Button
                  variant={isBulkMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsBulkMode(!isBulkMode);
                    if (isBulkMode) {
                      deselectAll();
                    }
                  }}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  {isBulkMode ? "Exit Bulk Mode" : "Bulk Actions"}
                </Button>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {isBulkMode && (
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium">
                      {selectedReviewIds.size} review{selectedReviewIds.size !== 1 ? 's' : ''} selected
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectedReviewIds.size === filteredReviews?.length ? deselectAll : selectAll}
                    >
                      {selectedReviewIds.size === filteredReviews?.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleBulkGenerateReplies}
                      disabled={bulkGenerating || bulkPosting || getSelectedReviewsWithoutReplies().length === 0}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${bulkGenerating ? 'animate-spin' : ''}`} />
                      Generate Replies ({getSelectedReviewsWithoutReplies().length})
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleBulkPostReplies}
                      disabled={bulkGenerating || bulkPosting || getSelectedReviewsWithDraftReplies().length === 0}
                    >
                      <Send className={`h-4 w-4 mr-2 ${bulkPosting ? 'animate-spin' : ''}`} />
                      Post Replies ({getSelectedReviewsWithDraftReplies().length})
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsBulkMode(false);
                        deselectAll();
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            {filteredReviews?.map((review) => {
              const existingReply = review.replies?.[0];
              const timeAgo = formatDistanceToNow(new Date(review.review_created_at), { addSuffix: true });
              const isSelected = selectedReviewIds.has(review.id);
              
              return (
                <Card 
                  key={review.id} 
                  className={`p-6 transition-all ${isSelected ? 'ring-2 ring-primary' : ''} ${isBulkMode ? 'cursor-pointer hover:bg-accent/5' : ''}`}
                  onClick={() => isBulkMode && toggleReviewSelection(review.id)}
                >
                  <div className="space-y-4">
                    {/* Bulk Mode Checkbox */}
                    {isBulkMode && (
                      <div className="flex items-center gap-3 pb-2 border-b">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleReviewSelection(review.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-muted-foreground">
                          Select this review
                        </span>
                      </div>
                    )}
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

                    {/* Reply Section */}
                    {review.google_reply_content ? (
                      // Show Google reply if it exists
                      <div className="rounded-lg bg-secondary p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-muted-foreground">
                            Google Reply
                          </p>
                          <Badge variant="outline" className="border-success text-success">
                            Posted on Google
                          </Badge>
                        </div>
                        <p className="text-sm">{review.google_reply_content}</p>
                        {review.google_reply_time && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Posted {formatDistanceToNow(new Date(review.google_reply_time), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    ) : existingReply ? (
                      // Show local reply if exists
                      <div className="rounded-lg bg-secondary p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-muted-foreground">
                            {existingReply.is_ai_generated ? "AI-Generated Reply" : "Reply"}
                          </p>
                          <Badge variant="outline" className={
                            existingReply.status === "posted" 
                              ? "border-success text-success"
                              : "border-warning text-warning"
                          }>
                            {existingReply.status === "posted" ? "Posted" : "Draft"}
                          </Badge>
                        </div>
                        <Textarea
                          value={editingReply === existingReply.id ? (editedContent[existingReply.id] ?? existingReply.content) : existingReply.content}
                          onChange={(e) => setEditedContent(prev => ({ ...prev, [existingReply.id]: e.target.value }))}
                          disabled={existingReply.status === "posted" || editingReply !== existingReply.id}
                          className="min-h-[100px] resize-none"
                        />
                        {existingReply.status === "draft" && (
                          <div className="mt-3 flex justify-end gap-2">
                            {editingReply === existingReply.id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingReply(null);
                                    setEditedContent(prev => {
                                      const newContent = { ...prev };
                                      delete newContent[existingReply.id];
                                      return newContent;
                                    });
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEdit(existingReply.id, editedContent[existingReply.id] ?? existingReply.content)}
                                >
                                  <Check className="h-4 w-4" />
                                  Save Changes
                                </Button>
                              </>
                            ) : (
                              <>
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   onClick={() => {
                                     setEditingReply(existingReply.id);
                                     setEditedContent(prev => ({ ...prev, [existingReply.id]: existingReply.content }));
                                   }}
                                   disabled={isBulkMode}
                                 >
                                   <Edit2 className="h-4 w-4" />
                                   Edit
                                 </Button>
                                 <Button
                                   size="sm"
                                   onClick={() => handlePostReply(existingReply.id, review.id)}
                                   disabled={postingReply === existingReply.id || isBulkMode}
                                 >
                                   {postingReply === existingReply.id ? (
                                     <>
                                       <RefreshCw className="h-4 w-4 animate-spin" />
                                       Posting...
                                     </>
                                   ) : (
                                     <>
                                       <Send className="h-4 w-4" />
                                       Post to Google
                                     </>
                                   )}
                                 </Button>
                              </>
                            )}
                          </div>
                        )}
                        {existingReply.status === "posted" && existingReply.posted_at && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Posted {formatDistanceToNow(new Date(existingReply.posted_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    ) : (
                      // Show generate button if no reply exists
                      <div className="rounded-lg border border-dashed border-border p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-3">No reply generated yet</p>
                        <Button 
                          size="sm"
                          onClick={() => handleGenerateReply(review.id, review.text || "", review.rating)}
                          disabled={generatingReply === review.id || isBulkMode}
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
