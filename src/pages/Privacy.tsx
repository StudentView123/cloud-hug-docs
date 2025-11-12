import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <article className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            <strong>Last Updated:</strong> November 2025
          </p>

          <p className="text-foreground/90 mb-6">
            Review Hub ("we", "our", or "us") values your privacy. This policy explains how we collect,
            use, and protect your information when you use our website and services.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-2 text-foreground/90">
            <li>Basic profile information (name, email) provided through Google OAuth.</li>
            <li>Access tokens for Google Business Profile API, stored securely and encrypted.</li>
            <li>Usage analytics for performance and security monitoring.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-2 text-foreground/90">
            <li>To fetch and display your Google reviews.</li>
            <li>To generate AI-assisted reply suggestions at your request.</li>
            <li>To post your approved replies back to Google Business Profile.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">Data Security</h2>
          <p className="text-foreground/90 mb-6">
            We encrypt all sensitive data (such as refresh tokens) and never share your data with third parties
            except to operate our service or comply with legal obligations. We do not sell or rent personal data.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">Third-Party Services</h2>
          <p className="text-foreground/90 mb-6">
            Review Hub integrates with Google APIs and Stripe. Your use of these services is governed by{" "}
            <a 
              href="https://policies.google.com/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Google's Privacy Policy
            </a>{" "}
            and{" "}
            <a 
              href="https://stripe.com/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Stripe's Privacy Policy
            </a>.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">Access and Revocation</h2>
          <p className="text-foreground/90 mb-6">
            You may revoke access at any time via your{" "}
            <a 
              href="https://myaccount.google.com/permissions" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Google Account Permissions
            </a>{" "}
            page.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">Contact Us</h2>
          <p className="text-foreground/90 mb-6">
            For any privacy-related concerns, contact us at:{" "}
            <a 
              href="mailto:support@reviewhub.com"
              className="text-primary hover:underline"
            >
              support@reviewhub.com
            </a>
          </p>
        </article>
      </div>
    </div>
  );
};

export default Privacy;
