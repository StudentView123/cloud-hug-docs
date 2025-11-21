import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CreditBalanceRef {
  fetchCredits: () => Promise<void>;
}

export const CreditBalance = forwardRef<CreditBalanceRef, { onBuyCredits: () => void }>(({ onBuyCredits }, ref) => {
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

      // Try edge function first
      const { data, error } = await supabase.functions.invoke("check-credits", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) {
        console.error('Edge function error, trying direct query:', error);
        // Fallback to direct database query
        const { data: profile, error: dbError } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (dbError) throw dbError;
        console.log('Direct query result:', profile);
        setCredits(profile?.credits || 0);
        return;
      }
      
      console.log('check-credits response:', data);
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

  useImperativeHandle(ref, () => ({
    fetchCredits,
  }));

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
});
