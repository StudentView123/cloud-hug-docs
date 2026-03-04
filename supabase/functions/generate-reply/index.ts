import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, createUserClient, getOwnedReview } from "../_shared/google-connection.ts";
import { emitWebhookEvent } from "../_shared/webhooks.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reviewId, reviewText, rating, authorName } = await req.json();
    const { supabase, user } = await createUserClient(req);

    const ownedReview = await getOwnedReview(supabase, user.id, reviewId, "id, text, rating, author_name");
    if (!ownedReview) {
      return new Response(JSON.stringify({ error: "Review not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedReviewText = ownedReview.text ?? reviewText ?? "";
    const resolvedRating = ownedReview.rating ?? rating;
    const resolvedAuthorName = ownedReview.author_name ?? authorName ?? "";

    const cleanedText = resolvedReviewText.trim() || "";
    const hasSubstantiveText = cleanedText.length > 5;

    if (hasSubstantiveText) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();

      if (!profile || profile.credits < 1) {
        return new Response(
          JSON.stringify({ error: "Insufficient credits. Please purchase more credits to continue." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const getDefaultResponse = (reviewRating: number): string => {
      if (reviewRating === 5) {
        const responses = [
          "Thank you so much!",
          "We appreciate your support!",
          "Thank you for the 5 stars!",
          "We're grateful for your rating!",
        ];
        return responses[Math.floor(Math.random() * responses.length)];
      }

      if (reviewRating === 4) {
        const responses = [
          "Thank you for your feedback!",
          "We appreciate your rating!",
          "Thanks for taking the time to rate us!",
        ];
        return responses[Math.floor(Math.random() * responses.length)];
      }

      if (reviewRating === 3) {
        const responses = [
          "Thank you for your feedback!",
          "We appreciate you taking the time to rate us.",
          "Thanks for sharing your rating with us!",
        ];
        return responses[Math.floor(Math.random() * responses.length)];
      }

      const responses = [
        "Thank you for your feedback. We'd like to learn more about your experience.",
        "We appreciate your feedback and would love the opportunity to make things right.",
        "Thank you for sharing your rating. We take all feedback seriously.",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    };

    let generatedReply: string;

    if (!hasSubstantiveText) {
      const { data: templates } = await supabase
        .from("quick_reply_templates")
        .select("id, template_text, last_used_at, usage_count")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .gte("rating_max", resolvedRating)
        .lte("rating_min", resolvedRating)
        .order("last_used_at", { ascending: true, nullsFirst: true });

      if (templates && templates.length > 0) {
        const { data: recentUsage } = await supabase
          .from("quick_reply_usage_history")
          .select("template_id")
          .eq("user_id", user.id)
          .order("used_at", { ascending: false })
          .limit(10);

        const recentlyUsedIds = new Set(recentUsage?.map((usage) => usage.template_id) || []);
        const availableTemplates = templates.filter((template) => !recentlyUsedIds.has(template.id));
        const selectedTemplate =
          availableTemplates.length > 0
            ? availableTemplates[0]
            : templates[Math.floor(Math.random() * templates.length)];

        generatedReply = selectedTemplate.template_text;

        await supabase.from("quick_reply_usage_history").insert({
          user_id: user.id,
          template_id: selectedTemplate.id,
          review_id: reviewId,
        });

        await supabase
          .from("quick_reply_templates")
          .update({
            last_used_at: new Date().toISOString(),
            usage_count: selectedTemplate.usage_count + 1,
          })
          .eq("id", selectedTemplate.id);
      } else {
        generatedReply = getDefaultResponse(resolvedRating);
      }
    } else {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY not configured");
      }

      const firstName = resolvedAuthorName.split(" ")[0] || "";
      const sentiment = resolvedRating >= 4 ? "positive" : resolvedRating === 3 ? "neutral" : "negative";

      const { data: profile } = await supabase
        .from("profiles")
        .select("reply_style_settings")
        .eq("id", user.id)
        .single();

      const settings = profile?.reply_style_settings || {};

      const { data: examples } = await supabase
        .from("training_examples")
        .select("review_text, reply_content, review_rating, sentiment, notes")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .eq("sentiment", sentiment)
        .limit(3);

      const systemPrompt = `You are a professional customer service representative writing responses to Google Business reviews.

Style Guidelines:
- Formality: ${settings.formality || "professional"}
- Length: ${settings.length || "concise"} (2-3 sentences)
- Personality: ${settings.personality || "friendly"}
${firstName ? `- Address the reviewer by their first name (${firstName}) at the beginning of your response` : ""}

${settings.custom_instructions ? `Additional Instructions:\n${settings.custom_instructions}\n` : ""}

${settings.avoid_phrases?.length ? `NEVER use these exact phrases:\n${settings.avoid_phrases.map((phrase: string) => `- "${phrase}"`).join("\n")}\n` : ""}

${settings.variation_strength === "high" ? "IMPORTANT: Generate UNIQUE phrasing. Avoid common customer service clichés. Be creative and natural. Do not start with the same phrase as previous replies.\n" : ""}

${examples && examples.length > 0 ? `Here are examples of replies we like:\n${examples.map((example, index) => `Example ${index + 1} (${example.review_rating}-star):\nReview: "${example.review_text}"\nOur Reply: "${example.reply_content}"${example.notes ? `\nWhy we like it: ${example.notes}` : ""}`).join("\n\n")}\n\nMatch this tone and style, but make it unique for the current review.\n` : ""}

Generate a response that thanks the customer, ${sentiment === "positive" ? "expresses appreciation for their positive experience" : sentiment === "negative" ? "apologizes for any issues and offers to make things right" : "acknowledges their feedback"}, and maintains the specified style.
Do not use generic phrases. Make it specific to their review when possible.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate a response to this ${resolvedRating}-star review${firstName ? ` from ${firstName}` : ""}: "${resolvedReviewText}"` },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add funds to your workspace.");
        }
        throw new Error("Failed to generate reply");
      }

      const aiData = await response.json();
      generatedReply = aiData.choices[0].message.content;

      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();

      await supabase
        .from("profiles")
        .update({ credits: (currentProfile?.credits || 1) - 1 })
        .eq("id", user.id);

      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        amount: -1,
        transaction_type: "usage",
        review_id: reviewId,
        notes: `AI reply generated for ${resolvedRating}-star review`,
      });
    }

    await supabase.from("replies").delete().eq("review_id", reviewId).eq("user_id", user.id).eq("status", "draft");

    const { data: reply, error: replyError } = await supabase
      .from("replies")
      .insert({
        review_id: reviewId,
        user_id: user.id,
        content: generatedReply,
        status: "draft",
        is_ai_generated: true,
        needs_review: false,
      })
      .select()
      .single();

    if (replyError) {
      throw replyError;
    }

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      review_id: reviewId,
      action: "ai_reply_generated",
      details: {
        rating: resolvedRating,
        sentiment: resolvedRating >= 4 ? "positive" : resolvedRating === 3 ? "neutral" : "negative",
        usedDefaultResponse: !hasSubstantiveText,
      },
    });

    await emitWebhookEvent({
      supabase,
      userId: user.id,
      eventType: "reply.status_changed",
      resourceType: "reply",
      resourceId: reply.id,
      payload: {
        reviewId,
        replyId: reply.id,
        previousStatus: null,
        currentStatus: "draft",
        content: reply.content,
        isAiGenerated: reply.is_ai_generated,
        needsReview: reply.needs_review,
        createdAt: reply.created_at,
        source: "generate-reply",
      },
    });

    return new Response(JSON.stringify({ success: true, reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-reply function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
