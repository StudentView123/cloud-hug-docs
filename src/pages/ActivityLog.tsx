import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, RefreshCw, TrendingUp, Star } from "lucide-react";
import { useActivityLog } from "@/hooks/useActivityLog";
import { formatDistanceToNow } from "date-fns";

const ActivityLog = () => {
  const { data: activities, isLoading } = useActivityLog();

  return (
    <Layout>
      <div className="flex h-16 items-center border-b border-border px-8">
        <h2>Activity Log</h2>
      </div>

      <div className="p-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !activities || activities.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No activity logged yet. Actions like generating and posting replies will appear here.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });
              const isRatingChange = activity.action === 'review_rating_changed';
              const details = activity.details as any;
              
              return (
                <Card key={activity.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-full p-2 ${isRatingChange ? 'bg-info/10' : 'bg-success/10'}`}>
                        {isRatingChange ? (
                          <TrendingUp className="h-5 w-5 text-info" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {isRatingChange ? 'Review Rating Changed' : activity.action.replace(/_/g, ' ')}
                          </span>
                          {isRatingChange && details && (
                            <Badge variant="secondary" className="bg-info/10 text-info border-info">
                              {details.old_rating}★ → {details.new_rating}★
                            </Badge>
                          )}
                        </div>
                        {activity.details && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            {isRatingChange && details ? (
                              <span>
                                Sentiment changed from <span className="font-medium">{details.old_sentiment}</span> to{' '}
                                <span className="font-medium">{details.new_sentiment}</span>
                              </span>
                            ) : (
                              JSON.stringify(activity.details)
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{timeAgo}</span>
                      </div>
                    </div>
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

export default ActivityLog;
