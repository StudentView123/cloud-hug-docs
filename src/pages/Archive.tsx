import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, Search, Archive as ArchiveIcon } from "lucide-react";
import { useArchive } from "@/hooks/useArchive";
import { useLocations } from "@/hooks/useLocations";
import { useTrainingExamples } from "@/hooks/useTrainingExamples";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

const Archive = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");
  const [selectedRating, setSelectedRating] = useState<string>("all");
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [trainingNotes, setTrainingNotes] = useState("");
  const [selectedReviewForTraining, setSelectedReviewForTraining] = useState<any>(null);
  
  const { data: reviews, isLoading } = useArchive(searchTerm);
  const { data: locations } = useLocations();
  const { trainingExamples, addExample, deleteExample } = useTrainingExamples();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const isTrainingExample = (reviewId: string) => {
    return trainingExamples?.some(ex => ex.review_id === reviewId);
  };

  const handleToggleTrainingExample = async (review: any) => {
    const reply = review.google_reply_content || review.replies?.[0]?.content;
    if (!reply) {
      toast({ title: "No reply to use as training example", variant: "destructive" });
      return;
    }

    const existing = trainingExamples?.find(ex => ex.review_id === review.id);
    
    if (existing) {
      // Remove
      await deleteExample.mutateAsync(existing.id);
      toast({ title: "Removed from training examples" });
    } else {
      // Show notes modal
      setSelectedReviewForTraining(review);
      setTrainingNotes("");
      setShowNotesModal(true);
    }
  };

  const handleSaveTrainingExample = async () => {
    const review = selectedReviewForTraining;
    const reply = review?.google_reply_content || review?.replies?.[0]?.content;
    
    try {
      const sentiment = review.rating >= 4 ? 'positive' : review.rating === 3 ? 'neutral' : 'negative';
      
      await addExample.mutateAsync({
        review_id: review.id,
        reply_content: reply,
        review_rating: review.rating,
        review_text: review.text || "",
        sentiment,
        notes: trainingNotes || null
      });
      
      toast({ title: "Added to training examples!" });
      setShowNotesModal(false);
      setSelectedReviewForTraining(null);
      setTrainingNotes("");
    } catch (error) {
      toast({ title: "Error adding training example", variant: "destructive" });
    }
  };

  const getSentimentColor = (sentiment: string | null) => {
    if (!sentiment) return "secondary";
    if (sentiment === "positive") return "default";
    if (sentiment === "negative") return "destructive";
    return "secondary";
  };

  const filteredReviews = reviews?.filter((review) => {
    const matchesLocation = selectedLocationId === "all" || review.location_id === selectedLocationId;
    const matchesRating = selectedRating === "all" || review.rating === parseInt(selectedRating);
    return matchesLocation && matchesRating;
  });

  return (
    <Layout>
      <div className={isMobile ? 'p-4' : 'p-8'}>
        <div className="mb-8">
          <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold mb-2 flex items-center gap-2`}>
            <ArchiveIcon className={isMobile ? 'h-6 w-6' : 'h-8 w-8'} />
            Review Archive
          </h1>
          <p className="text-muted-foreground">
            Search and view your responded reviews
          </p>
        </div>

        {/* Search and Filters */}
        <div className={`grid gap-4 mb-6 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-4'}`}>
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reviews by customer name or text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
            <SelectTrigger>
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations?.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                  {location.address && (
                    <span className="text-xs text-muted-foreground ml-2">
                      • {location.address}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedRating} onValueChange={setSelectedRating}>
            <SelectTrigger>
              <SelectValue placeholder="All Ratings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="5">5 Stars</SelectItem>
              <SelectItem value="4">4 Stars</SelectItem>
              <SelectItem value="3">3 Stars</SelectItem>
              <SelectItem value="2">2 Stars</SelectItem>
              <SelectItem value="1">1 Star</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        {filteredReviews && (
          <p className="text-sm text-muted-foreground mb-4">
            {filteredReviews.length} archived {filteredReviews.length === 1 ? 'review' : 'reviews'}
          </p>
        )}

        {/* Reviews List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading archived reviews...</p>
            </Card>
          ) : !filteredReviews || filteredReviews.length === 0 ? (
            <Card className="p-8 text-center">
              <ArchiveIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No archived reviews</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "No reviews match your search." : "Archived reviews will appear here."}
              </p>
            </Card>
          ) : (
            filteredReviews.map((review) => {
              const reply = review.replies?.[0];
              
              return (
                <Card key={review.id} className="p-6">
                  <div className="flex items-start gap-4">
                    {review.author_photo_url && (
                      <img
                        src={review.author_photo_url}
                        alt={review.author_name}
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{review.author_name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < review.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                            {review.sentiment && (
                              <Badge variant={getSentimentColor(review.sentiment)}>
                                {review.sentiment}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(review.review_created_at), {
                              addSuffix: true,
                            })}
                          </p>
                          {review.location && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {review.location.name}
                            </p>
                          )}
                        </div>
                      </div>

                      {review.text && (
                        <p className="text-sm mb-4 text-foreground">{review.text}</p>
                      )}

                      {/* Display Reply - prioritize Google replies */}
                      {(review.google_reply_content || reply) && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {review.google_reply_content 
                                  ? "Google Reply" 
                                  : reply?.is_ai_generated 
                                    ? "AI Reply" 
                                    : "Manual Reply"}
                              </Badge>
                              {(review.google_reply_time || reply?.posted_at) && (
                                <span className="text-xs text-muted-foreground">
                                  Posted {formatDistanceToNow(
                                    new Date(review.google_reply_time || reply!.posted_at!), 
                                    { addSuffix: true }
                                  )}
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={isTrainingExample(review.id) ? "default" : "outline"}
                              onClick={() => handleToggleTrainingExample(review)}
                            >
                              <Star className={`h-4 w-4 mr-1 ${isTrainingExample(review.id) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                              {isTrainingExample(review.id) ? 'Training Example' : 'Use for Training'}
                            </Button>
                          </div>
                          <p className="text-sm">
                            {review.google_reply_content || reply?.content}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Training Example Notes Modal */}
        <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Training Example</DialogTitle>
              <DialogDescription>
                Why do you like this reply? (Optional - helps the AI understand your preferences)
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="e.g., 'Love the casual tone and specific mention of the dish'"
              value={trainingNotes}
              onChange={(e) => setTrainingNotes(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNotesModal(false)}>Cancel</Button>
              <Button onClick={handleSaveTrainingExample}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Archive;
