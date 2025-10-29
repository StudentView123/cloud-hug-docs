import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MapPin, RefreshCw } from "lucide-react";
import { useLocations } from "@/hooks/useLocations";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const Locations = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: locations, isLoading } = useLocations();
  const isMobile = useIsMobile();

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["locations"] });
    await queryClient.invalidateQueries({ queryKey: ["review-counts-by-location"] });
    setIsRefreshing(false);
    toast.success("Review counts refreshed");
  };
  
  // Get review counts for each location
  const { data: reviewCountsByLocation } = useQuery({
    queryKey: ["review-counts-by-location"],
    queryFn: async () => {
      const { data: reviews, error } = await supabase
        .from("reviews")
        .select(`
          id,
          location_id,
          archived,
          has_google_reply,
          replies(id)
        `);
      
      if (error) throw error;
      
      const counts: Record<string, { total: number; pending: number }> = {};
      reviews?.forEach((review) => {
        const locId = review.location_id;
        if (!counts[locId]) {
          counts[locId] = { total: 0, pending: 0 };
        }
        
        // Count all reviews (archived + active)
        counts[locId].total++;
        
        // Count pending (not archived AND no reply from either source)
        if (!review.archived) {
          const hasAppReply = review.replies && review.replies.length > 0;
          const hasGoogleReply = review.has_google_reply === true;
          if (!hasAppReply && !hasGoogleReply) {
            counts[locId].pending++;
          }
        }
      });
      
      return counts;
    },
  });

  return (
    <Layout>
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'h-16 items-center justify-between'} border-b border-border ${isMobile ? 'p-4' : 'px-8'}`}>
        <h2>Locations</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || checkingAuth || isLoading}
          className={isMobile ? 'w-full' : ''}
        >
          <RefreshCw className={isRefreshing ? "animate-spin" : ""} />
          Refresh Counts
        </Button>
      </div>

      <div className={isMobile ? 'p-4' : 'p-8'}>
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
              const reviewStats = reviewCountsByLocation?.[location.id] || { total: 0, pending: 0 };
              
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
                          ({location.review_count || reviewStats.total} reviews)
                        </span>
                      </div>
                      {reviewStats.pending > 0 && (
                        <Badge variant="outline" className="border-warning text-warning">
                          {reviewStats.pending} pending
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
