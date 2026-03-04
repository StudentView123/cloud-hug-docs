import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createUserClient,
  getValidGoogleAccessToken,
  markGoogleError,
  markGoogleSyncSuccess,
} from "../_shared/google-connection.ts";

interface GoogleErrorResponse {
  error?: {
    code?: number;
    status?: string;
    message?: string;
    details?: Array<{
      '@type'?: string;
      reason?: string;
      domain?: string;
      metadata?: {
        service?: string;
        quota_limit_value?: string;
        quota_metric?: string;
        quota_limit?: string;
      };
    }>;
  };
}

function createStructuredError(status: number, body: string, source: string = "google") {
  try {
    const parsed: GoogleErrorResponse = JSON.parse(body);
    const error = parsed.error;
    const quotaDetail = error?.details?.find(d => d['@type']?.includes('ErrorInfo'));

    return {
      error: true,
      source,
      service: quotaDetail?.metadata?.service || "unknown",
      status,
      code: error?.code || status,
      googleStatus: error?.status || "UNKNOWN",
      message: error?.message || body,
      quotaLimitValue: quotaDetail?.metadata?.quota_limit_value ? parseInt(quotaDetail.metadata.quota_limit_value) : undefined,
      quotaLimit: quotaDetail?.metadata?.quota_limit,
      reason: quotaDetail?.reason,
    };
  } catch {
    return {
      error: true,
      source,
      status,
      message: body,
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== FETCH REVIEWS STARTED ===');
    const body = await req.json().catch(() => ({}));
    const targetLocationIds: string[] = body.location_ids || [];
    const maxExecutionTime = 50000;
    const startTime = Date.now();

    const { supabase, user } = await createUserClient(req);
    const { accessToken } = await getValidGoogleAccessToken(supabase, user.id);

    const accountsUrl = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
    const accountsResponse = await fetch(accountsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsResponse.ok) {
      const errorBody = await accountsResponse.text();
      const structuredError = createStructuredError(accountsResponse.status, errorBody);
      await markGoogleError(supabase, user.id, structuredError.message);
      return new Response(JSON.stringify(structuredError), {
        status: accountsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.accounts || [];

    const allReviews = [];
    const allLocations = [];
    const processedLocations = [];
    let foundLocationCount = 0;
    let foundReviewCount = 0;
    let updatedToArchivedTrue = 0;
    let updatedToArchivedFalse = 0;
    let insertedNew = 0;
    let skippedFullySynced = 0;
    let partialCompletion = false;

    for (const account of accounts) {
      const locationsBaseUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`;
      let allLocationsForAccount: any[] = [];
      let locationsNextPageToken: string | null = null;

      do {
        const locationsUrl: string = locationsNextPageToken
          ? `${locationsBaseUrl}&pageToken=${locationsNextPageToken}`
          : locationsBaseUrl;

        const locationsResponse: Response = await fetch(locationsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!locationsResponse.ok) {
          break;
        }

        const locationsData: any = await locationsResponse.json();
        const pageLocations = locationsData.locations || [];
        allLocationsForAccount.push(...pageLocations);
        locationsNextPageToken = locationsData.nextPageToken || null;
      } while (locationsNextPageToken);

      const locations = allLocationsForAccount;
      foundLocationCount += locations.length;

      for (const location of locations) {
        if (Date.now() - startTime > maxExecutionTime) {
          partialCompletion = true;
          break;
        }

        if (targetLocationIds.length > 0 && !targetLocationIds.includes(location.name)) {
          continue;
        }

        if (targetLocationIds.length === 0) {
          const googleReviewCount = location.metadata?.newReviewCount || 0;
          const { data: existingLoc } = await supabase
            .from('locations')
            .select('id, review_count')
            .eq('google_location_id', location.name)
            .eq('user_id', user.id)
            .single();

          if (existingLoc && existingLoc.review_count >= googleReviewCount && googleReviewCount > 0) {
            skippedFullySynced++;
            continue;
          }
        }

        const { data: existingLocation } = await supabase
          .from('locations')
          .select('id')
          .eq('google_location_id', location.name)
          .eq('user_id', user.id)
          .single();

        let locationId;
        if (!existingLocation) {
          const { data: newLocation } = await supabase
            .from('locations')
            .insert({
              user_id: user.id,
              google_location_id: location.name,
              name: location.title || 'Unnamed Location',
              address: location.storefrontAddress?.addressLines?.join(', '),
            })
            .select()
            .single();

          locationId = newLocation?.id;
          allLocations.push(newLocation);
        } else {
          locationId = existingLocation.id;
        }

        const reviewsUrl = `https://mybusiness.googleapis.com/v4/${account.name}/${location.name}/reviews?pageSize=100`;
        let nextPageToken: string | null = null;

        do {
          const paginatedUrl: string = nextPageToken ? `${reviewsUrl}&pageToken=${nextPageToken}` : reviewsUrl;
          const reviewsResponse: Response = await fetch(paginatedUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (!reviewsResponse.ok) {
            const errorBody = await reviewsResponse.text();
            const structuredError = createStructuredError(reviewsResponse.status, errorBody, "reviews");
            await markGoogleError(supabase, user.id, structuredError.message);
            break;
          }

          const reviewsData: any = await reviewsResponse.json();
          const reviews = reviewsData.reviews || [];
          foundReviewCount += reviews.length;

          processedLocations.push({
            name: location.title || location.name,
            reviews_synced: reviews.length,
            status: 'complete',
          });

          for (const review of reviews) {
            const hasGoogleReply = !!(review.reviewReply?.comment?.length);
            const googleReplyContent = hasGoogleReply ? review.reviewReply!.comment : null;
            const googleReplyTime = hasGoogleReply ? review.reviewReply!.updateTime : null;

            const { data: existingReview } = await supabase
              .from('reviews')
              .select('id, has_google_reply, google_reply_content, archived, rating, rating_history, sentiment')
              .eq('google_review_id', review.name || review.reviewId)
              .eq('location_id', locationId)
              .maybeSingle();

            if (existingReview) {
              const currentRating = typeof review.starRating === 'number' ? review.starRating :
                review.starRating === 'FIVE' ? 5 :
                review.starRating === 'FOUR' ? 4 :
                review.starRating === 'THREE' ? 3 :
                review.starRating === 'TWO' ? 2 : 1;

              const getSentiment = (rating: number) => rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative';
              const newSentiment = getSentiment(currentRating);
              const ratingChanged = existingReview.rating !== currentRating;
              let ratingHistory = existingReview.rating_history || [];
              let hasDraftReply = false;

              if (ratingChanged) {
                ratingHistory = [
                  ...(Array.isArray(ratingHistory) ? ratingHistory : []),
                  {
                    rating: existingReview.rating,
                    changed_at: new Date().toISOString(),
                  }
                ];

                await supabase.from('activity_logs').insert({
                  user_id: user.id,
                  review_id: existingReview.id,
                  action: 'review_rating_changed',
                  details: {
                    old_rating: existingReview.rating,
                    new_rating: currentRating,
                    old_sentiment: existingReview.sentiment,
                    new_sentiment: newSentiment,
                  }
                });

                const { data: draftReply } = await supabase
                  .from('replies')
                  .select('id')
                  .eq('review_id', existingReview.id)
                  .eq('status', 'draft')
                  .single();

                if (draftReply) {
                  hasDraftReply = true;
                  await supabase
                    .from('replies')
                    .update({ needs_review: true })
                    .eq('id', draftReply.id);
                }
              }

              const needsUpdate =
                existingReview.has_google_reply !== hasGoogleReply ||
                existingReview.google_reply_content !== googleReplyContent ||
                existingReview.archived === null ||
                existingReview.archived !== hasGoogleReply ||
                ratingChanged;

              if (needsUpdate) {
                const updateData: any = {
                  has_google_reply: hasGoogleReply,
                  google_reply_content: googleReplyContent,
                  google_reply_time: googleReplyTime,
                  archived: hasGoogleReply
                };

                if (ratingChanged) {
                  updateData.rating = currentRating;
                  updateData.sentiment = newSentiment;
                  updateData.rating_history = ratingHistory;
                  updateData.last_rating_change_at = new Date().toISOString();
                  updateData.sentiment_mismatch = hasDraftReply;
                }

                const { error: updateError } = await supabase
                  .from('reviews')
                  .update(updateData)
                  .eq('id', existingReview.id);

                if (!updateError) {
                  if (hasGoogleReply) {
                    updatedToArchivedTrue++;
                  } else {
                    updatedToArchivedFalse++;
                  }
                }
              }
            } else if (locationId) {
              const rating = typeof review.starRating === 'number' ? review.starRating :
                review.starRating === 'FIVE' ? 5 :
                review.starRating === 'FOUR' ? 4 :
                review.starRating === 'THREE' ? 3 :
                review.starRating === 'TWO' ? 2 : 1;

              const { data: newReview } = await supabase
                .from('reviews')
                .insert({
                  location_id: locationId,
                  google_review_id: review.name || review.reviewId,
                  author_name: review.reviewer?.displayName || 'Anonymous',
                  author_photo_url: review.reviewer?.profilePhotoUrl,
                  rating,
                  text: review.comment,
                  review_created_at: review.createTime,
                  has_google_reply: hasGoogleReply,
                  google_reply_content: googleReplyContent,
                  google_reply_time: googleReplyTime,
                  archived: hasGoogleReply,
                })
                .select()
                .single();

              if (newReview) {
                allReviews.push(newReview);
                insertedNew++;
              }
            }
          }

          nextPageToken = reviewsData.nextPageToken || null;
        } while (nextPageToken);

        if (locationId) {
          const { count } = await supabase
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('location_id', locationId);

          await supabase
            .from('locations')
            .update({ review_count: count || 0 })
            .eq('id', locationId);
        }
      }
    }

    await markGoogleSyncSuccess(supabase, user.id);

    return new Response(
      JSON.stringify({
        success: true,
        partial: partialCompletion,
        reviews: allReviews,
        locations: allLocations,
        locations_processed: processedLocations,
        completed_locations: processedLocations.length,
        skipped_locations: skippedFullySynced,
        newReviewsCount: insertedNew,
        newLocationsCount: allLocations.length,
        foundReviewCount,
        foundLocationCount,
        updatedToArchivedTrue,
        updatedToArchivedFalse,
        message: partialCompletion
          ? 'Partial sync completed (timeout protection). Run again to continue.'
          : skippedFullySynced > 0
            ? `Synced successfully. ${skippedFullySynced} locations already up to date.`
            : 'All reviews synced successfully.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    try {
      const { supabase, user } = await createUserClient(req);
      await markGoogleError(supabase, user.id, error);
    } catch {}

    return new Response(
      JSON.stringify({
        error: true,
        source: 'server',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
