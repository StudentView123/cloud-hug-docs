import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // First, check if we already have a session (after magic link redirect)
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log('Session already exists, redirecting to dashboard');
          navigate('/dashboard');
          return;
        }

        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          setError('Authentication failed. Please try again.');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (!code) {
          setError('No authorization code received.');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        console.log('Exchanging Google code for magic link');
        
        // Exchange code for magic link via edge function
        const { data, error: authError } = await supabase.functions.invoke('google-auth', {
          body: { code },
        });

        if (authError) {
          console.error('Auth error:', authError);
          setError(authError.message || 'Failed to complete authentication.');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (data?.error) {
          console.error('Backend error:', data.error);
          setError(data.error);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (data?.action_link) {
          console.log('Redirecting to magic link to establish session');
          // Redirect to the magic link - Supabase will handle session creation
          window.location.href = data.action_link;
        } else {
          console.error('Invalid response data:', data);
          setError('Authentication response invalid - no action link returned.');
          setTimeout(() => navigate('/login'), 3000);
        }
      } catch (err) {
        console.error('Callback error:', err);
        setError('An unexpected error occurred.');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <div className="text-center">
        {error ? (
          <div className="text-destructive">
            <p className="text-lg font-semibold mb-2">Error</p>
            <p>{error}</p>
            <p className="text-sm text-muted-foreground mt-2">Redirecting...</p>
          </div>
        ) : (
          <div>
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-lg">Completing authentication...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
