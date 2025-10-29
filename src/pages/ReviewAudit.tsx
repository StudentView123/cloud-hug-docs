import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuditStats, useRunAudit } from "@/hooks/useAuditStats";
import { useActivityLog } from "@/hooks/useActivityLog";
import { RefreshCw, AlertTriangle, TrendingUp, Star, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

const ReviewAudit = () => {
  const { data: stats, isLoading, refetch } = useAuditStats();
  const { data: activities } = useActivityLog();
  const { runAudit } = useRunAudit();
  const [isRunning, setIsRunning] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleRunAudit = async () => {
    setIsRunning(true);
    try {
      const result = await runAudit();
      
      if (result.success) {
        toast({
          title: "Audit Complete",
          description: `Processed ${result.stats.total_reviews} reviews. Assigned ${result.stats.sentiments_assigned} sentiments. Found ${result.stats.mismatches_found} mismatches.`,
        });
        
        // Refetch audit stats and invalidate reviews
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["reviews"] });
        queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
      }
    } catch (error: any) {
      toast({
        title: "Audit Failed",
        description: error.message || "Failed to run sentiment audit",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const ratingChangedActivities = activities?.filter(
    (activity) => activity.action === "review_rating_changed"
  ).slice(0, 5) || [];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-full items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Review Audit</h1>
            <p className="text-muted-foreground">Monitor sentiment health and detect rating changes</p>
          </div>
          <Button onClick={handleRunAudit} disabled={isRunning}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running Audit...' : 'Run Sentiment Audit'}
          </Button>
        </div>

        {/* Alert if issues found */}
        {stats && stats.sentiment_mismatches > 0 && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {stats.sentiment_mismatches} {stats.sentiment_mismatches === 1 ? 'review needs' : 'reviews need'} attention due to rating changes
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                View Dashboard
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sentiment Health Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Sentiment Health Overview
            </CardTitle>
            <CardDescription>
              Track sentiment assignment across all reviews
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.health_percentage}%</p>
                <p className="text-sm text-muted-foreground">Reviews with sentiment assigned</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">{stats?.reviews_with_sentiment}</p>
                <p className="text-sm text-muted-foreground">of {stats?.total_reviews} reviews</p>
              </div>
            </div>
            <Progress value={stats?.health_percentage || 0} className="h-2" />
            
            {stats && stats.reviews_missing_sentiment > 0 && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-foreground">
                  <strong>{stats.reviews_missing_sentiment}</strong> reviews missing sentiment data.
                  Run an audit to assign sentiments automatically.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Sentiment Mismatches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Sentiment Mismatches
              </CardTitle>
              <CardDescription>
                Reviews with rating changes affecting existing replies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-3xl font-bold text-foreground">{stats?.sentiment_mismatches || 0}</p>
                  <p className="text-sm text-muted-foreground">Active mismatches detected</p>
                </div>
                
                {stats && stats.sentiment_mismatches > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      These reviews have draft replies that may no longer match the current rating.
                      Review them on the Dashboard to regenerate appropriate responses.
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => navigate('/dashboard')}
                    >
                      View Affected Reviews
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No sentiment mismatches detected. All draft replies match their review ratings.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Rating Changes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Recent Rating Changes
              </CardTitle>
              <CardDescription>
                Reviews updated in the last 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats && stats.recent_rating_changes.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_rating_changes.map((change) => {
                    const history = Array.isArray(change.rating_history) ? change.rating_history : [];
                    const oldRating = history.length > 0 ? history[history.length - 1].rating : null;
                    
                    return (
                      <div key={change.id} className="flex items-start justify-between rounded-lg border p-3">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{change.author_name}</p>
                          <p className="text-sm text-muted-foreground">{change.location_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(change.last_rating_change_at), { addSuffix: true })}
                          </p>
                        </div>
                        {oldRating && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-primary text-primary" />
                            {oldRating} → {change.rating}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No rating changes in the last 7 days
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Log */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Rating Change Activity</CardTitle>
            <CardDescription>
              Latest rating change events from your activity log
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ratingChangedActivities.length > 0 ? (
              <div className="space-y-2">
                {ratingChangedActivities.map((activity) => {
                  const details = activity.details as any;
                  return (
                    <div key={activity.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <TrendingUp className="mt-1 h-4 w-4 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Rating Changed</p>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-primary text-primary" />
                            {details?.old_rating} → {details?.new_rating}
                          </Badge>
                          <span>•</span>
                          <span>{details?.old_sentiment} → {details?.new_sentiment}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <Button 
                  variant="outline" 
                  className="w-full mt-2" 
                  onClick={() => navigate('/activity-log')}
                >
                  View All Activity
                </Button>
              </div>
            ) : (
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No rating change activity recorded yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ReviewAudit;
