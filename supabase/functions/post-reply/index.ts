import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== POST REPLY TO GOOGLE STARTED ===');
    
    const { replyId, reviewId } = await req.json();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract token from Bearer header
    const token = authHeader.replace(/^Bearer\s+/i, '');
    console.log('Auth header present:', !!authHeader, 'Token length:', token.length);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user by explicitly passing the token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('User authentication failed:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✓ User authenticated:', user.id);

    // Get the reply content
    const { data: reply, error: replyError } = await supabase
      .from('replies')
      .select('content')
      .eq('id', replyId)
      .eq('user_id', user.id)
      .single();

    if (replyError || !reply) {
      throw new Error('Reply not found or unauthorized');
    }

    console.log('✓ Reply found:', replyId);

    // Get the review and its full Google API path
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('google_review_id')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review?.google_review_id) {
      throw new Error('Review not found or missing google_review_id');
    }

    console.log('✓ Review found:', review.google_review_id);

    // Get user's Google tokens
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_access_token, google_refresh_token, token_expires_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.google_access_token) {
      throw new Error('Google account not connected');
    }

    // Check if token needs refresh
    let accessToken = profile.google_access_token;
    const tokenExpired = profile.token_expires_at && new Date(profile.token_expires_at) < new Date();
    
    if (tokenExpired && profile.google_refresh_token) {
      console.log('Refreshing expired token...');
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          refresh_token: profile.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        accessToken = tokens.access_token;
        await supabase
          .from('profiles')
          .update({
            google_access_token: tokens.access_token,
            token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq('id', user.id);
        console.log('✓ Token refreshed');
      } else {
        throw new Error('Failed to refresh Google token');
      }
    }

    // Post reply to Google My Business API
    console.log('Posting reply to Google...');
    const googleApiUrl = `https://mybusiness.googleapis.com/v4/${review.google_review_id}/reply`;
    const googleResponse = await fetch(googleApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: reply.content,
      }),
    });

    if (!googleResponse.ok) {
      const errorBody = await googleResponse.text();
      console.error('Google API error:', googleResponse.status, errorBody);
      throw new Error(`Failed to post reply to Google: ${errorBody}`);
    }

    const googleReplyData = await googleResponse.json();
    console.log('✓ Reply posted to Google:', googleReplyData);

    // Update reply status in database
    const { error: updateError } = await supabase
      .from('replies')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
      })
      .eq('id', replyId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating reply status:', updateError);
      throw updateError;
    }

    // Archive the review since it now has a reply
    await supabase
      .from('reviews')
      .update({ 
        has_google_reply: true,
        archived: true 
      })
      .eq('id', reviewId);

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      review_id: reviewId,
      action: 'reply_posted',
      details: {
        reply_id: replyId,
        posted_at: new Date().toISOString(),
      },
    });

    console.log('✓ Reply posted successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Reply posted to Google successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in post-reply function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});