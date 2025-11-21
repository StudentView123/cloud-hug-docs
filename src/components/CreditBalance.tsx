import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const CreditBalance = ({ onBuyCredits }: { onBuyCredits: () => void }) => {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchCredits = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke("check-credits", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      setCredits(data.credits);
    } catch (error: any) {
      console.error('Error fetching credits:', error);
      toast({
        title: "Error fetching credits",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  const getVariant = () => {
    if (credits === null || credits === 0) return "destructive";
    if (credits < 5) return "secondary";
    return "default";
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={getVariant()} className="flex items-center gap-1 px-3 py-1.5">
        <Coins className="h-4 w-4" />
        <span className="font-semibold">{credits ?? "..."} credits</span>
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        onClick={fetchCredits}
        disabled={loading}
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
      <Button variant="outline" size="sm" onClick={onBuyCredits}>
        Buy Credits
      </Button>
    </div>
  );
};
