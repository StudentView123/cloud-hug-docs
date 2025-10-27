import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";

const mockActivity = [
  {
    id: "1",
    action: "Posted reply",
    reviewer: "Sarah Johnson",
    location: "Downtown Store",
    user: "You",
    timestamp: "2 hours ago",
    status: "completed",
  },
  {
    id: "2",
    action: "Approved reply",
    reviewer: "Michael Chen",
    location: "North Branch",
    user: "You",
    timestamp: "5 hours ago",
    status: "completed",
  },
  {
    id: "3",
    action: "Posted reply",
    reviewer: "Emily Rodriguez",
    location: "Downtown Store",
    user: "You",
    timestamp: "1 day ago",
    status: "completed",
  },
  {
    id: "4",
    action: "Bulk posted",
    reviewer: "3 reviews",
    location: "Multiple locations",
    user: "You",
    timestamp: "2 days ago",
    status: "completed",
  },
];

const ActivityLog = () => {
  return (
    <Layout>
      <div className="flex h-16 items-center border-b border-border px-8">
        <h2>Activity Log</h2>
      </div>

      <div className="p-8">
        <div className="space-y-3">
          {mockActivity.map((activity) => (
            <Card key={activity.id} className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-success/10 p-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{activity.action}</span>
                      <span className="text-muted-foreground">for</span>
                      <span className="font-medium">{activity.reviewer}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{activity.location}</span>
                      <span>•</span>
                      <span>by {activity.user}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-success text-success">
                    {activity.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{activity.timestamp}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default ActivityLog;
