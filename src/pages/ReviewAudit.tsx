import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuditStats, useRunAudit } from "@/hooks/useAuditStats";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useGenerateInsights, AuditInsights } from "@/hooks/useAuditInsights";
import { RefreshCw, AlertTriangle, TrendingUp, Star, CheckCircle2, Sparkles, Target, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";

const ReviewAudit = () => {
  const { data: stats, isLoading, refetch } = useAuditStats();
  const { data: activities } = useActivityLog();
  const { runAudit } = useRunAudit();
  const { generateInsights, isGenerating } = useGenerateInsights();
  const [isRunning, setIsRunning] = useState(false);
  const [insights, setInsights] = useState<AuditInsights | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const handleRunAudit = async () => {
    setIsRunning(true);
    try {
      const result = await runAudit();
      
      if (result.success) {
        toast({
          title: "Audit Complete",
          description: `Processed ${result.stats.total_reviews} reviews (${result.stats.active_reviews} active, ${result.stats.archived_reviews} archived). Assigned ${result.stats.sentiments_assigned} sentiments.`,
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

  const handleGenerateInsights = async () => {
    try {
      toast({
        title: "Generating Insights",
        description: "Analyzing all reviews with AI... This may take a moment.",
      });

      const result = await generateInsights();
      setInsights(result);

      toast({
        title: "Insights Generated",
        description: `Analyzed ${result.stats?.total_reviews || 0} reviews and generated ${result.key_insights?.length || 0} key insights.`,
      });

      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    } catch (error: any) {
      toast({
        title: "Failed to Generate Insights",
        description: error.message || "An error occurred while generating insights",
        variant: "destructive",
      });
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
      <div className={`flex flex-col ${isMobile ? 'gap-4 p-4' : 'gap-6 p-8'}`}>
        {/* Header */}
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
          <div>
            <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>Review Audit</h1>
            <p className="text-muted-foreground">Monitor sentiment health and detect rating changes</p>
          </div>
          <Button onClick={handleRunAudit} disabled={isRunning} className={isMobile ? 'w-full' : ''}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : isMobile ? 'Run Audit' : 'Run Sentiment Audit'}
          </Button>
        </div>

        {/* Alert if issues found */}
        {stats && stats.sentiment_mismatches > 0 && (
          <Card className="border-warning bg-warning/10">
            <CardContent className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3 p-4`}>
              <div className="flex items-center gap-3 flex-1">
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
                <p className="font-medium text-foreground">
                  {stats.sentiment_mismatches} {stats.sentiment_mismatches === 1 ? 'review needs' : 'reviews need'} attention due to rating changes
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className={isMobile ? 'w-full' : ''}>
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
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.total_reviews}</p>
                <p className="text-sm text-muted-foreground">Total reviews</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.reviews_with_sentiment}</p>
                <p className="text-sm text-muted-foreground">With sentiment</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.health_percentage}%</p>
                <p className="text-sm text-muted-foreground">Health score</p>
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

        {/* AI Insights Section */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Powered Insights
            </CardTitle>
            <CardDescription>
              Generate comprehensive analysis of all reviews with AI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!insights ? (
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 text-primary mx-auto mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground mb-4">
                  Generate a comprehensive AI report analyzing all {stats?.total_reviews || 0} reviews
                </p>
                <Button onClick={handleGenerateInsights} disabled={isGenerating}>
                  <Sparkles className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />
                  {isGenerating ? 'Generating...' : 'Generate AI Insights Report'}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Executive Summary */}
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Executive Summary
                  </h3>
                  <p className="text-sm text-muted-foreground">{insights.summary}</p>
                </div>

                {/* Stats Overview */}
                {insights.stats && (
                  <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-2xl font-bold text-foreground">{insights.stats.total_reviews}</p>
                      <p className="text-xs text-muted-foreground">Total Reviews</p>
                    </div>
                    <div className="rounded-lg border bg-green-500/10 p-3">
                      <p className="text-2xl font-bold text-green-600">{insights.stats.sentiment_breakdown.positive}</p>
                      <p className="text-xs text-muted-foreground">Positive</p>
                    </div>
                    <div className="rounded-lg border bg-yellow-500/10 p-3">
                      <p className="text-2xl font-bold text-yellow-600">{insights.stats.sentiment_breakdown.neutral}</p>
                      <p className="text-xs text-muted-foreground">Neutral</p>
                    </div>
                    <div className="rounded-lg border bg-red-500/10 p-3">
                      <p className="text-2xl font-bold text-red-600">{insights.stats.sentiment_breakdown.negative}</p>
                      <p className="text-xs text-muted-foreground">Negative</p>
                    </div>
                  </div>
                )}

                {/* Notable Reviewers */}
                {insights.notable_reviewers && insights.notable_reviewers.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="w-full">
                      <div className={`rounded-lg border bg-card ${isMobile ? 'p-3' : 'p-4'} hover:bg-accent transition-colors`}>
                        <div className="flex items-center justify-between">
                          <h3 className={`font-semibold text-foreground flex items-center gap-2 ${isMobile ? 'text-sm' : ''}`}>
                            <Users className="h-4 w-4 text-primary flex-shrink-0" />
                            Notable Reviewers ({insights.notable_reviewers.length})
                          </h3>
                          <Badge variant="outline" className={isMobile ? 'text-xs' : ''}>View</Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2">
                      {insights.notable_reviewers.map((reviewer, idx) => (
                        <div key={idx} className="rounded-lg border bg-card p-3">
                          <div className={`flex ${isMobile ? 'flex-col gap-1' : 'items-start justify-between'} mb-1`}>
                            <p className="font-medium text-foreground truncate">{reviewer.name}</p>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Star className="h-3 w-3 fill-primary text-primary" />
                              {reviewer.rating}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{reviewer.highlight}</p>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Key Insights */}
                {insights.key_insights && insights.key_insights.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground">Key Insights</h3>
                    {insights.key_insights.map((insight, idx) => (
                      <Collapsible key={idx}>
                        <CollapsibleTrigger className="w-full">
                          <div className="rounded-lg border bg-card p-3 hover:bg-accent transition-colors text-left">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-foreground">{insight.title}</p>
                              <Badge variant="outline">View</Badge>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 rounded-lg border bg-card p-3">
                          <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
                          {insight.examples && insight.examples.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-foreground">Examples:</p>
                              {insight.examples.map((example, exIdx) => (
                                <div key={exIdx} className="rounded bg-muted p-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-medium text-foreground">{example.author}</p>
                                    <Badge variant="outline" className="h-5 text-xs">
                                      {example.rating}★
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground italic">"{example.excerpt}"</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}

                {/* Action Items */}
                {insights.action_items && insights.action_items.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground">Action Items</h3>
                    {insights.action_items.map((item, idx) => (
                      <div key={idx} className="rounded-lg border bg-card p-3">
                        <div className="flex items-start gap-3">
                          <Badge 
                            variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}
                            className={`mt-0.5 ${isMobile ? 'text-xs px-2' : ''}`}
                          >
                            {item.priority}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{item.description}</p>
                            {item.affected_reviews && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Affects {item.affected_reviews} review{item.affected_reviews !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button variant="outline" className="w-full" onClick={handleGenerateInsights} disabled={isGenerating}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  Regenerate Insights
                </Button>
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
