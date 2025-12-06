import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

interface EmailReceivedPayload {
  created_at: string;
  email_id: string;
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    content: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Received webhook request:", req.method);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the raw payload
    const payload = await req.text();
    console.log("Received payload:", payload.substring(0, 200) + "...");

    // Verify webhook signature using svix headers
    const headers = Object.fromEntries(req.headers);
    console.log("Webhook headers:", JSON.stringify({
      "webhook-id": headers["webhook-id"],
      "webhook-timestamp": headers["webhook-timestamp"],
      "webhook-signature": headers["webhook-signature"] ? "present" : "missing"
    }));

    const wh = new Webhook(webhookSecret);
    
    let event: { type: string; data: EmailReceivedPayload };
    try {
      event = wh.verify(payload, headers) as { type: string; data: EmailReceivedPayload };
      console.log("Webhook verified successfully, event type:", event.type);
    } catch (verifyError) {
      console.error("Webhook verification failed:", verifyError);
      return new Response(
        JSON.stringify({ error: "Invalid webhook signature" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Only process email.received events
    if (event.type !== "email.received") {
      console.log("Ignoring event type:", event.type);
      return new Response(
        JSON.stringify({ message: "Event type ignored" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailData = event.data;
    console.log("Processing received email:", {
      email_id: emailData.email_id,
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
    });

    // Initialize Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Store the email in the database
    const { data, error } = await supabase
      .from("received_emails")
      .insert({
        email_id: emailData.email_id,
        from_address: emailData.from,
        to_address: emailData.to.join(", "),
        subject: emailData.subject || "(No subject)",
        body_text: emailData.text || null,
        body_html: emailData.html || null,
        attachments: emailData.attachments || [],
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Database insert error:", error);
      // Return 200 even on DB error to prevent Resend from retrying
      // Log the error for debugging
      return new Response(
        JSON.stringify({ error: "Failed to store email", details: error.message }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email stored successfully:", data.id);

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
