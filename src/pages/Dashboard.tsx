import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, ThumbsUp, AlertCircle } from "lucide-react";

// Mock data for demonstration
const mockReviews = [
  {
    id: "1",
    author: "Sarah Johnson",
    rating: 5,
    text: "Absolutely fantastic service! The team went above and beyond to help me. Highly recommend!",
    date: "2 days ago",
    location: "Downtown Store",
    sentiment: "positive",
    aiReply: "Thank you so much for your wonderful feedback, Sarah! We're thrilled to hear that our team provided you with exceptional service. Your recommendation means the world to us!",
  },
  {
    id: "2",
    author: "Michael Chen",
    rating: 3,
    text: "Good service but wait times were longer than expected. Staff was friendly though.",
    date: "3 days ago",
    location: "North Branch",
    sentiment: "neutral",
    aiReply: "Hi Michael, thank you for taking the time to share your experience. We appreciate your patience and are glad our team was friendly. We're working on improving our wait times and hope to serve you better next time!",
  },
  {
    id: "3",
    author: "Emily Rodriguez",
    rating: 5,
    text: "Best experience ever! Clean facility, professional staff, and great results.",
    date: "5 days ago",
    location: "Downtown Store",
    sentiment: "positive",
    aiReply: "Emily, we're so grateful for your kind words! It's wonderful to hear that you had such a positive experience with us. We look forward to serving you again soon!",
  },
];

const Dashboard = () => {
  return (
    <Layout>
      <div className="flex h-16 items-center justify-between border-b border-border px-8">
        <h2>Dashboard</h2>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm">
            Bulk Approve
          </Button>
          <Button size="sm">
            Post All
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
                <p className="text-2xl font-semibold">24</p>
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
                <p className="text-2xl font-semibold">8</p>
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
                <p className="text-2xl font-semibold">4.6</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {mockReviews.map((review) => (
            <Card key={review.id} className="p-6">
              <div className="space-y-4">
                {/* Review Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{review.author}</h3>
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
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                        ))}
                      </div>
                      <span>•</span>
                      <span>{review.date}</span>
                      <span>•</span>
                      <span>{review.location}</span>
                    </div>
                  </div>
                </div>

                {/* Review Text */}
                <p className="text-foreground">{review.text}</p>

                {/* AI Reply */}
                <div className="rounded-lg bg-secondary p-4">
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    AI-Generated Reply
                  </p>
                  <Textarea
                    defaultValue={review.aiReply}
                    className="min-h-[100px] resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button size="sm">
                    Post Reply
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
