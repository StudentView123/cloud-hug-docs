import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) {
      throw new Error("Not authenticated");
    }

    const { code } = await req.json();
    
    if (!code || typeof code !== 'string') {
      throw new Error("Promo code is required");
    }

    // Normalize code (uppercase, trim)
    const normalizedCode = code.trim().toUpperCase();

    console.log(`User ${user.id} attempting to redeem promo code: ${normalizedCode}`);

    // Fetch promo code
    const { data: promoCode, error: promoError } = await supabaseClient
      .from('promo_codes')
      .select('*')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (promoError) {
      console.error('Error fetching promo code:', promoError);
      throw new Error("Failed to validate promo code");
    }

    if (!promoCode) {
      console.log(`Promo code not found: ${normalizedCode}`);
      throw new Error("Invalid or inactive promo code");
    }

    // Validate promo code
    if (!promoCode.is_active) {
      console.log(`Promo code inactive: ${normalizedCode}`);
      throw new Error("Invalid or inactive promo code");
    }

    if (promoCode.expires_at && new Date(promoCode.expires_at) < new Date()) {
      console.log(`Promo code expired: ${normalizedCode}`);
      throw new Error("Promo code has expired");
    }

    if (promoCode.max_uses !== null && promoCode.current_uses >= promoCode.max_uses) {
      console.log(`Promo code usage limit reached: ${normalizedCode}`);
      throw new Error("Promo code limit reached");
    }

    // Check if user already redeemed this code
    const { data: existingRedemption } = await supabaseClient
      .from('promo_redemptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('promo_code_id', promoCode.id)
      .maybeSingle();

    if (existingRedemption) {
      console.log(`User ${user.id} already redeemed code: ${normalizedCode}`);
      throw new Error("You've already used this promo code");
    }

    // Execute transaction: update credits, increment usage, log redemption
    console.log(`Processing redemption: ${promoCode.credit_amount} credits for user ${user.id}`);

    // Get current credits
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    const currentCredits = profile?.credits || 0;
    const newBalance = currentCredits + promoCode.credit_amount;

    // Update user credits
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ credits: newBalance })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating credits:', updateError);
      throw new Error("Failed to add credits");
    }

    // Increment promo code usage
    const { error: usageError } = await supabaseClient
      .from('promo_codes')
      .update({ current_uses: promoCode.current_uses + 1 })
      .eq('id', promoCode.id);

    if (usageError) {
      console.error('Error updating promo usage:', usageError);
      // Continue anyway as credits were already added
    }

    // Log redemption
    const { error: redemptionError } = await supabaseClient
      .from('promo_redemptions')
      .insert({
        user_id: user.id,
        promo_code_id: promoCode.id,
        credits_awarded: promoCode.credit_amount
      });

    if (redemptionError) {
      console.error('Error logging redemption:', redemptionError);
      // Continue anyway
    }

    // Log transaction
    const { error: transactionError } = await supabaseClient
      .from('credit_transactions')
      .insert({
        user_id: user.id,
        amount: promoCode.credit_amount,
        transaction_type: 'promo_redemption',
        notes: `Promo code: ${normalizedCode}`
      });

    if (transactionError) {
      console.error('Error logging transaction:', transactionError);
      // Continue anyway
    }

    console.log(`Successfully redeemed ${normalizedCode}: ${promoCode.credit_amount} credits added`);

    return new Response(
      JSON.stringify({ 
        success: true,
        creditsAwarded: promoCode.credit_amount,
        newBalance: newBalance,
        message: `${promoCode.credit_amount} credits added successfully!`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in redeem-promo-code:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
