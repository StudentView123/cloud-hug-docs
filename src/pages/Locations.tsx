import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, RefreshCw } from "lucide-react";
import { useLocations } from "@/hooks/useLocations";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Locations = () => {
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { data: locations, isLoading } = useLocations();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      }
      setCheckingAuth(false);
    };
    checkSession();
  }, [navigate]);
  
  // Get pending replies count for each location
  const { data: pendingRepliesByLocation } = useQuery({
    queryKey: ["pending-replies-by-location"],
    queryFn: async () => {
      const { data: reviews, error } = await supabase
        .from("reviews")
        .select(`
          id,
          location_id,
          archived,
          has_google_reply,
          replies(id)
        `)
        .eq("archived", false);
      
      if (error) throw error;
      
      const pending: Record<string, number> = {};
      reviews?.forEach((review) => {
        const hasAppReply = review.replies && review.replies.length > 0;
        const hasGoogleReply = review.has_google_reply === true;
        
        // Pending = not archived AND no reply from either source
        if (!hasAppReply && !hasGoogleReply) {
          pending[review.location_id] = (pending[review.location_id] || 0) + 1;
        }
      });
      
      return pending;
    },
  });

  return (
    <Layout>
      <div className="flex h-16 items-center border-b border-border px-8">
        <h2>Locations</h2>
      </div>

      <div className="p-8">
        <p className="mb-6 text-muted-foreground">
          Your Google Business Profile locations
        </p>
        
        {checkingAuth || isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !locations || locations.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No locations found. Fetch reviews from Google to import your locations.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locations.map((location) => {
              const pendingCount = pendingRepliesByLocation?.[location.id] || 0;
              
              return (
                <Card key={location.id} className="p-6">
                  <div className="flex-1">
                    <h3 className="font-semibold">{location.name}</h3>
                    {location.address && (
                      <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{location.address}</span>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {location.rating && (
                          <>
                            <Star className="h-4 w-4 fill-primary text-primary" />
                            <span className="text-sm font-medium">{location.rating}</span>
                          </>
                        )}
                        <span className="text-sm text-muted-foreground">
                          ({location.review_count || 0} reviews)
                        </span>
                      </div>
                      {pendingCount > 0 && (
                        <Badge variant="outline" className="border-warning text-warning">
                          {pendingCount} pending
                        </Badge>
                      )}
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

export default Locations;
