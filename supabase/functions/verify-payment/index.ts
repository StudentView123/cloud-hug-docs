import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map price IDs to credit amounts
const CREDIT_PACKAGES = {
  'price_1SVznfGKOTYzY5WxMSHtXjup': { credits: 10, name: 'Starter' },
  'price_1SVzoFGKOTYzY5WxtWx5MUfC': { credits: 50, name: 'Growth' },
  'price_1SVzoQGKOTYzY5Wxmx4FSXVi': { credits: 100, name: 'Pro' }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      throw new Error('Payment not completed');
    }

    // Check if already processed
    const { data: existingTransaction } = await supabaseClient
      .from('credit_transactions')
      .select('id')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();

    if (existingTransaction) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Credits already added',
        alreadyProcessed: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credit package details
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
    const priceId = lineItems.data[0]?.price?.id as string;
    const creditPackage = CREDIT_PACKAGES[priceId as keyof typeof CREDIT_PACKAGES];
    
    if (!creditPackage) {
      throw new Error('Invalid price ID in session');
    }

    // Add credits to user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .maybeSingle();

    const newCreditBalance = (profile?.credits || 0) + creditPackage.credits;

    await supabaseClient
      .from('profiles')
      .update({ credits: newCreditBalance })
      .eq('id', user.id);

    // Record transaction
    await supabaseClient
      .from('credit_transactions')
      .insert({
        user_id: user.id,
        amount: creditPackage.credits,
        transaction_type: 'purchase',
        stripe_payment_intent_id: session.payment_intent,
        stripe_checkout_session_id: sessionId,
        notes: `Purchased ${creditPackage.name} package (${creditPackage.credits} credits)`
      });

    console.log(`Added ${creditPackage.credits} credits to user ${user.id}. New balance: ${newCreditBalance}`);

    return new Response(JSON.stringify({ 
      success: true,
      creditsAdded: creditPackage.credits,
      newBalance: newCreditBalance
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error('Error in verify-payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
