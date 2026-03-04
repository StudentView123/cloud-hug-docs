import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getReturnPathFromState } from "@/lib/googleConnection";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError("Please sign in before connecting Google Business.");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        const code = searchParams.get("code");
        const errorParam = searchParams.get("error");
        const returnPath = getReturnPathFromState(searchParams.get("state"));

        if (errorParam) {
          setError("Google authorization failed. Please try again.");
          setTimeout(() => navigate(returnPath), 2500);
          return;
        }

        if (!code) {
          setError("No authorization code received.");
          setTimeout(() => navigate(returnPath), 2500);
          return;
        }

        const { data, error: authError } = await supabase.functions.invoke("google-auth", {
          body: { code },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (authError) {
          throw authError;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        navigate(returnPath, { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        setTimeout(() => navigate("/settings"), 2500);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary">
      <div className="text-center">
        {error ? (
          <div className="text-destructive">
            <p className="mb-2 text-lg font-semibold">Connection error</p>
            <p>{error}</p>
            <p className="mt-2 text-sm text-muted-foreground">Redirecting…</p>
          </div>
        ) : (
          <div>
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
            <p className="text-lg">Connecting Google Business…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
