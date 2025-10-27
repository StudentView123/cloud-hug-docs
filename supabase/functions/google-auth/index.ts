import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();
    
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${req.headers.get('origin')}/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      throw new Error('Failed to exchange authorization code');
    }

    const tokens = await tokenResponse.json();
    
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userInfo = await userInfoResponse.json();
    console.log('User info retrieved:', { email: userInfo.email, name: userInfo.name });
    
    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Look up user by email instead of Google ID
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const existingUser = users.find(u => u.email === userInfo.email);
    console.log('User lookup result:', existingUser ? 'Found existing user' : 'New user');
    
    let userId;
    if (!existingUser) {
      // Create new user
      console.log('Creating new user for email:', userInfo.email);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: userInfo.email,
        email_confirm: true,
        user_metadata: {
          name: userInfo.name,
          avatar_url: userInfo.picture,
        },
      });

      if (createError) {
        console.error('Error creating user:', createError);
        throw createError;
      }
      userId = newUser.user.id;
      console.log('New user created with ID:', userId);
    } else {
      userId = existingUser.id;
      console.log('Using existing user ID:', userId);
    }

    // Store tokens in profiles table (upsert to handle race conditions)
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }, {
        onConflict: 'id'
      });

    if (upsertError) {
      console.error('Error upserting profile:', upsertError);
      throw upsertError;
    }
    console.log('Profile updated with Google tokens');

    // Generate session for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userInfo.email,
    });

    if (sessionError) {
      console.error('Error generating session:', sessionError);
      throw sessionError;
    }
    
    // Extract session from the properties
    const session = sessionData.properties;
    console.log('Session created successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        session: session,
        user: {
          id: userId,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in google-auth function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
