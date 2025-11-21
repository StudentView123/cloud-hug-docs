import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const PACKAGES = [
  {
    name: "Starter",
    credits: 5,
    price: 2.50,
    priceId: "price_1SW07eGKOTYzY5Wxx0hYa4xr",
    perCredit: 0.50,
  },
  {
    name: "Growth",
    credits: 15,
    price: 6.00,
    priceId: "price_1SW07wGKOTYzY5WxSAeptol8",
    perCredit: 0.40,
    discount: "20% off",
  },
  {
    name: "Pro",
    credits: 30,
    price: 10.50,
    priceId: "price_1SW08BGKOTYzY5WxYSGbGe1h",
    perCredit: 0.35,
    discount: "30% off",
    popular: true,
  },
];

export const BuyCreditsDialog = ({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) => {
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePurchase = async (priceId: string, packageName: string) => {
    setPurchasing(priceId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error creating checkout",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Buy Credits</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {PACKAGES.map((pkg) => (
            <Card
              key={pkg.priceId}
              className={`p-6 relative ${pkg.popular ? 'border-primary border-2' : ''}`}
            >
              {pkg.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Best Value
                </Badge>
              )}
              <div className="text-center space-y-4">
                <div>
                  <h3 className="text-xl font-bold">{pkg.name}</h3>
                  {pkg.discount && (
                    <Badge variant="secondary" className="mt-2">
                      {pkg.discount}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Coins className="h-8 w-8 text-primary" />
                  <span className="text-3xl font-bold">{pkg.credits}</span>
                </div>
                <div>
                  <div className="text-2xl font-bold">${pkg.price.toFixed(2)}</div>
                  <div className="text-sm text-muted-foreground">
                    ${pkg.perCredit.toFixed(2)} per credit
                  </div>
                </div>
                <ul className="text-sm text-left space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    {pkg.credits} AI reply generations
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Never expires
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Instant activation
                  </li>
                </ul>
                <Button
                  className="w-full"
                  onClick={() => handlePurchase(pkg.priceId, pkg.name)}
                  disabled={purchasing !== null}
                  variant={pkg.popular ? "default" : "outline"}
                >
                  {purchasing === pkg.priceId ? "Processing..." : "Purchase"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
