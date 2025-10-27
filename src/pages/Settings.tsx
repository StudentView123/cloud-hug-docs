import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RefreshCw } from "lucide-react";

const Settings = () => {
  return (
    <Layout>
      <div className="flex h-16 items-center border-b border-border px-8">
        <h2>Settings</h2>
      </div>

      <div className="p-8">
        <div className="max-w-2xl space-y-6">
          <Card className="p-6">
            <h3 className="mb-4">Google Business Profile Connection</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium">Connected</p>
                    <p className="text-sm text-muted-foreground">
                      Access to 3 business locations
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-success text-success">
                  Active
                </Badge>
              </div>
              <Button variant="outline" className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reconnect Account
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4">Account Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">user@example.com</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="font-medium">Professional</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4">Preferences</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified of new reviews
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">AI reply tone</p>
                  <p className="text-sm text-muted-foreground">
                    Customize automatic reply style
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Customize
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
