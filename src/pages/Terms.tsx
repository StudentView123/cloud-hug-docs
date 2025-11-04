import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
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
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">
            <strong>Last Updated:</strong> November 2025
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="text-foreground/90 mb-6">
            By accessing or using Review Reply Manager ("Service"), you agree to be bound by these Terms of Service
            and our Privacy Policy. If you do not agree, do not use the Service.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">2. Description of Service</h2>
          <p className="text-foreground/90 mb-6">
            Review Reply Manager enables verified Google Business Profile owners to manage and respond to reviews
            using AI-assisted suggestions. You are responsible for ensuring that replies generated through the
            Service comply with Google's content and community guidelines.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">3. Account and Permissions</h2>
          <p className="text-foreground/90 mb-6">
            You must log in with a valid Google account that owns or manages a Business Profile. You may revoke
            access at any time through your{" "}
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

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">4. Payments</h2>
          <p className="text-foreground/90 mb-6">
            Paid plans and billing are handled by Stripe. You authorize Stripe to securely store your payment method
            and bill recurring charges according to your selected plan.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">5. Data Ownership</h2>
          <p className="text-foreground/90 mb-6">
            You retain all rights to the business and review data accessed through the Service. We do not claim any
            ownership or authorship of your business information or reviews.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">6. Disclaimer</h2>
          <p className="text-foreground/90 mb-6">
            AI-generated replies are provided for convenience and may not always reflect your intended message or
            tone. You are responsible for reviewing all replies before posting.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">7. Limitation of Liability</h2>
          <p className="text-foreground/90 mb-6">
            To the fullest extent permitted by law, Review Reply Manager and its affiliates are not liable for any
            indirect, incidental, or consequential damages arising from your use of the Service.
          </p>

          <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">8. Contact</h2>
          <p className="text-foreground/90 mb-6">
            For support or legal inquiries, contact:{" "}
            <a 
              href="mailto:support@reviewreplymanager.com"
              className="text-primary hover:underline"
            >
              support@reviewreplymanager.com
            </a>
          </p>
        </article>
      </div>
    </div>
  );
};

export default Terms;
