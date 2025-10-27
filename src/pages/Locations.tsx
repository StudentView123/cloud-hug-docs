import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Star } from "lucide-react";

const mockLocations = [
  {
    id: "1",
    name: "Downtown Store",
    address: "123 Main St, New York, NY 10001",
    rating: 4.8,
    reviewCount: 156,
    pendingReplies: 3,
  },
  {
    id: "2",
    name: "North Branch",
    address: "456 Oak Ave, Brooklyn, NY 11201",
    rating: 4.5,
    reviewCount: 89,
    pendingReplies: 5,
  },
  {
    id: "3",
    name: "East Side Location",
    address: "789 Park Blvd, Queens, NY 11375",
    rating: 4.7,
    reviewCount: 124,
    pendingReplies: 0,
  },
];

const Locations = () => {
  return (
    <Layout>
      <div className="flex h-16 items-center border-b border-border px-8">
        <h2>Locations</h2>
      </div>

      <div className="p-8">
        <p className="mb-6 text-muted-foreground">
          Select locations to filter reviews on the dashboard
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockLocations.map((location) => (
            <Card key={location.id} className="p-6">
              <div className="flex items-start gap-4">
                <Checkbox id={location.id} defaultChecked />
                <div className="flex-1">
                  <label
                    htmlFor={location.id}
                    className="cursor-pointer font-semibold"
                  >
                    {location.name}
                  </label>
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{location.address}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      <span className="text-sm font-medium">{location.rating}</span>
                      <span className="text-sm text-muted-foreground">
                        ({location.reviewCount})
                      </span>
                    </div>
                    {location.pendingReplies > 0 && (
                      <span className="rounded-full bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
                        {location.pendingReplies} pending
                      </span>
                    )}
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

export default Locations;
